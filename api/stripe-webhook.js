// api/stripe-webhook.js — Stripe previent ici quand un paiement aboutit ou qu'un abonnement s'arrete.
// C'est le SEUL endroit qui active/desactive Rituel+.
// URL a declarer dans Stripe : https://monrituel.app/api/stripe-webhook
//
// AUTHENTIFICATION : on ne verifie pas la signature (Vercel modifie le corps de la requete,
// ce qui la rend inverifiable). A la place, on REDEMANDE l'evenement a Stripe avec notre cle
// secrete : si Stripe le confirme, il est authentique. Un faux message ne peut pas passer,
// car on n'utilise QUE les donnees renvoyees par Stripe, jamais celles recues.

const STRIPE = 'https://api.stripe.com/v1';

module.exports = async function handler(req, res){
  if (req.method !== 'POST') return res.status(405).end();

  const diag = [];

  try{
    // 1) L'identifiant de l'evenement (seule chose qu'on retient du message recu)
    const recu = req.body || {};
    const evtId = recu.id;
    if (!evtId || typeof evtId !== 'string' || evtId.indexOf('evt_') !== 0){
      return res.status(400).json({ error:'pas un evenement Stripe' });
    }

    // 2) On demande a Stripe : "cet evenement existe-t-il vraiment ?"
    const vr = await fetch(STRIPE + '/events/' + encodeURIComponent(evtId), {
      headers: { 'Authorization': 'Bearer ' + process.env.STRIPE_SECRET_KEY }
    });
    if (!vr.ok){
      const t = await vr.text();
      return res.status(400).json({ error:'evenement inconnu de Stripe', detail: t.slice(0,200) });
    }
    const evt = await vr.json();   // <- la version officielle, la seule qu'on utilise
    diag.push('evenement verifie aupres de Stripe : ' + evt.type);

    const SB  = process.env.SUPABASE_URL;
    const KEY = process.env.SUPABASE_SERVICE_ROLE;
    if (!SB || !KEY){
      return res.status(200).json({ recu:true, erreur:'SUPABASE_URL ou SUPABASE_SERVICE_ROLE manquant dans Vercel' });
    }
    const H  = { 'apikey':KEY, 'Authorization':'Bearer ' + KEY };
    const HJ = Object.assign({}, H, { 'Content-Type':'application/json' });

    // Met a jour le profil ; renvoie le nombre de lignes reellement modifiees
    async function majProfil(champs, userId, customerId){
      let url = null;
      if (userId)          url = SB + '/rest/v1/profiles?id=eq.' + userId;
      else if (customerId) url = SB + '/rest/v1/profiles?stripe_customer_id=eq.' + encodeURIComponent(customerId);
      if (!url){ diag.push('AUCUNE CLE : ni user_id ni customer'); return 0; }

      const r = await fetch(url, {
        method:'PATCH',
        headers: Object.assign({}, HJ, { 'Prefer':'return=representation' }),
        body: JSON.stringify(champs)
      });
      const txt = await r.text();
      if (!r.ok){ diag.push('ECHEC ECRITURE (' + r.status + ') : ' + txt.slice(0,200)); return 0; }
      let rows = [];
      try { rows = JSON.parse(txt); } catch(e){}
      const n = Array.isArray(rows) ? rows.length : 0;
      if (n === 0) diag.push('AUCUNE LIGNE MODIFIEE pour ' + (userId ? ('user_id=' + userId) : ('customer=' + customerId)));
      else diag.push('OK : profil mis a jour ' + JSON.stringify(champs));
      return n;
    }

    // Retrouve le user_id : d'abord dans les metadata, sinon via le client Stripe
    async function trouverUserId(o){
      if (o.metadata && o.metadata.user_id) return o.metadata.user_id;
      if (o.customer){
        const cr = await fetch(STRIPE + '/customers/' + o.customer, {
          headers: { 'Authorization': 'Bearer ' + process.env.STRIPE_SECRET_KEY }
        });
        if (cr.ok){
          const cust = await cr.json();
          if (cust.metadata && cust.metadata.user_id){
            diag.push('user_id retrouve via le client Stripe');
            return cust.metadata.user_id;
          }
        }
      }
      return null;
    }

    const o = (evt.data && evt.data.object) ? evt.data.object : {};

    // La date de fin de periode : selon les versions de l'API, elle est sur
    // l'abonnement lui-meme ou sur sa premiere ligne. On regarde les deux.
    function finDePeriode(sub){
      let ts = sub.current_period_end;
      if (!ts && sub.items && Array.isArray(sub.items.data) && sub.items.data.length){
        ts = sub.items.data[0].current_period_end;
      }
      return ts ? new Date(ts * 1000).toISOString() : null;
    }

    switch (evt.type){

      case 'checkout.session.completed': {
        const userId = await trouverUserId(o);
        const champs = { is_premium:true, stripe_customer_id: o.customer || null };
        // On va chercher l'abonnement pour connaitre la date de renouvellement tout de suite
        if (o.subscription){
          const sr = await fetch(STRIPE + '/subscriptions/' + o.subscription, {
            headers: { 'Authorization': 'Bearer ' + process.env.STRIPE_SECRET_KEY }
          });
          if (sr.ok){
            const sub = await sr.json();
            champs.premium_until  = finDePeriode(sub);
            champs.premium_cancel = !!sub.cancel_at_period_end;
            diag.push('abonnement lu : fin=' + champs.premium_until + ' annule=' + champs.premium_cancel);
          }
        }
        await majProfil(champs, userId, o.customer);
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const actif = (o.status === 'active' || o.status === 'trialing');
        const userId = await trouverUserId(o);
        await majProfil({
          is_premium: actif,
          premium_until: finDePeriode(o),
          premium_cancel: !!o.cancel_at_period_end,
          stripe_customer_id: o.customer || null
        }, userId, o.customer);
        break;
      }

      case 'customer.subscription.deleted': {
        const userId = await trouverUserId(o);
        await majProfil({ is_premium:false, premium_cancel:false, premium_until:null }, userId, o.customer);
        break;
      }

      default:
        diag.push('evenement ignore : ' + evt.type);
    }

    return res.status(200).json({ recu:true, type: evt.type, diag: diag });

  }catch(e){
    return res.status(200).json({ recu:true, erreur: e.message, diag: diag });
  }
};
