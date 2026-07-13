// api/portal.js — ouvre le portail Stripe : la personne y gere ou annule son abonnement seule.

const STRIPE = 'https://api.stripe.com/v1';

function form(obj){
  return Object.keys(obj)
    .filter(k => obj[k] !== undefined && obj[k] !== null)
    .map(k => encodeURIComponent(k) + '=' + encodeURIComponent(String(obj[k])))
    .join('&');
}

async function stripeGet(path){
  const r = await fetch(STRIPE + path, {
    headers: { 'Authorization': 'Bearer ' + process.env.STRIPE_SECRET_KEY }
  });
  const j = await r.json();
  if (!r.ok) throw new Error((j.error && j.error.message) || 'Erreur Stripe');
  return j;
}

module.exports = async function handler(req, res){
  if (req.method !== 'POST') return res.status(405).json({ error:'method' });

  try{
    // 1) Qui es-tu ?
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ error:'non connecte' });

    const SB = process.env.SUPABASE_URL;
    const ur = await fetch(SB + '/auth/v1/user', {
      headers: { 'apikey': process.env.SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + token }
    });
    if (!ur.ok) return res.status(401).json({ error:'session invalide' });
    const user = await ur.json();
    if (!user || !user.id) return res.status(401).json({ error:'session invalide' });

    const KEY = process.env.SUPABASE_SERVICE_ROLE;
    const H  = { 'apikey':KEY, 'Authorization':'Bearer ' + KEY };
    const HJ = { ...H, 'Content-Type':'application/json' };

    // 2) Le client Stripe, depuis le profil
    let customerId = null;
    const pr = await fetch(SB + '/rest/v1/profiles?id=eq.' + user.id + '&select=stripe_customer_id', { headers:H });
    if (pr.ok){
      const rows = await pr.json();
      if (Array.isArray(rows) && rows.length) customerId = rows[0].stripe_customer_id || null;
    }

    // 3) Pas d'ID en base ? On le retrouve chez Stripe grace a l'e-mail, et on repare le profil.
    if (!customerId && user.email){
      const found = await stripeGet('/customers?email=' + encodeURIComponent(user.email) + '&limit=1');
      if (found && Array.isArray(found.data) && found.data.length){
        customerId = found.data[0].id;
        await fetch(SB + '/rest/v1/profiles?id=eq.' + user.id, {
          method:'PATCH', headers:HJ, body: JSON.stringify({ stripe_customer_id: customerId })
        });
      }
    }

    if (!customerId){
      return res.status(400).json({ error:"Aucun abonnement trouve pour ce compte" });
    }

    // 4) Ouvrir le portail
    const origin = 'https://' + (req.headers['x-forwarded-host'] || req.headers.host);
    const r = await fetch(STRIPE + '/billing_portal/sessions', {
      method:'POST',
      headers:{
        'Authorization':'Bearer ' + process.env.STRIPE_SECRET_KEY,
        'Content-Type':'application/x-www-form-urlencoded'
      },
      body: form({ customer: customerId, return_url: origin + '/' })
    });
    const j = await r.json();
    if (!r.ok){
      const msg = (j.error && j.error.message) || 'Erreur Stripe';
      // Cas classique : le portail client n'a pas ete configure dans le Dashboard
      if (/configuration/i.test(msg)){
        return res.status(500).json({ error:"Le portail client n'est pas encore active dans Stripe" });
      }
      return res.status(500).json({ error: msg });
    }

    return res.status(200).json({ url: j.url });

  }catch(e){
    return res.status(500).json({ error: e.message });
  }
};
