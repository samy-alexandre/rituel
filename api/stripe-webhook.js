// api/stripe-webhook.js — Stripe previent ici quand un paiement aboutit ou qu'un abonnement s'arrete.
// C'est le SEUL endroit qui a le droit d'activer/desactiver Rituel+.
// URL a declarer dans Stripe : https://monrituel.app/api/stripe-webhook

const crypto = require('crypto');

function rawBody(req){
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// Verifie que le message vient bien de Stripe (et pas d'un plaisantin)
function verifie(raw, header, secret){
  if (!header || !secret) return false;
  const parts = {};
  header.split(',').forEach(p => { const [k, v] = p.split('='); parts[k] = v; });
  if (!parts.t || !parts.v1) return false;

  // Rejeter les messages trop vieux (protection contre le rejeu)
  const age = Math.abs(Math.floor(Date.now()/1000) - parseInt(parts.t, 10));
  if (age > 300) return false;

  const attendu = crypto.createHmac('sha256', secret)
    .update(parts.t + '.' + raw.toString('utf8'))
    .digest('hex');
  const a = Buffer.from(attendu, 'utf8');
  const b = Buffer.from(parts.v1, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function handler(req, res){
  if (req.method !== 'POST') return res.status(405).end();

  const raw = await rawBody(req);
  if (!verifie(raw, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET)){
    return res.status(400).json({ error:'signature invalide' });
  }

  let evt;
  try { evt = JSON.parse(raw.toString('utf8')); }
  catch(e){ return res.status(400).json({ error:'json invalide' }); }

  const SB  = process.env.SUPABASE_URL;
  const KEY = process.env.SUPABASE_SERVICE_ROLE;
  const H   = { 'apikey':KEY, 'Authorization':'Bearer ' + KEY, 'Content-Type':'application/json' };

  // Met a jour le profil, en le retrouvant par user_id ou par client Stripe
  async function majProfil(champs, userId, customerId){
    let url = null;
    if (userId)          url = SB + '/rest/v1/profiles?id=eq.' + userId;
    else if (customerId) url = SB + '/rest/v1/profiles?stripe_customer_id=eq.' + encodeURIComponent(customerId);
    if (!url) return;
    await fetch(url, { method:'PATCH', headers:H, body: JSON.stringify(champs) });
  }

  try{
    const o = evt.data && evt.data.object ? evt.data.object : {};

    switch (evt.type){

      // Le paiement vient d'aboutir
      case 'checkout.session.completed': {
        const userId = (o.metadata && o.metadata.user_id) || null;
        await majProfil({ is_premium:true, stripe_customer_id: o.customer || null }, userId, o.customer);
        break;
      }

      // Abonnement cree, renouvele, suspendu, ou repris
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const actif = (o.status === 'active' || o.status === 'trialing');
        const fin = o.current_period_end ? new Date(o.current_period_end * 1000).toISOString() : null;
        const userId = (o.metadata && o.metadata.user_id) || null;
        await majProfil({ is_premium: actif, premium_until: fin }, userId, o.customer);
        break;
      }

      // Abonnement termine (annulation arrivee a echeance, ou impaye)
      case 'customer.subscription.deleted': {
        const userId = (o.metadata && o.metadata.user_id) || null;
        await majProfil({ is_premium:false }, userId, o.customer);
        break;
      }

      // Un renouvellement a echoue : on laisse Stripe reessayer, on ne coupe pas tout de suite
      case 'invoice.payment_failed':
        break;
    }

    return res.status(200).json({ recu:true });

  }catch(e){
    // On renvoie 200 : sinon Stripe reessaie en boucle sur une erreur de notre cote
    return res.status(200).json({ recu:true, note:e.message });
  }
};

module.exports = handler;
// Vercel doit nous livrer le corps BRUT : sinon la signature Stripe ne peut pas être vérifiée.
// (Cet export doit venir APRÈS module.exports = handler, sinon il est écrasé.)
module.exports.config = { api: { bodyParser: false } };
