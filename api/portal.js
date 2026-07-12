// api/portal.js — ouvre le portail Stripe : la personne y gere ou annule son abonnement seule.
// (Aucune demande d'annulation a traiter a la main.)

function form(obj){
  return Object.keys(obj)
    .filter(k => obj[k] !== undefined && obj[k] !== null)
    .map(k => encodeURIComponent(k) + '=' + encodeURIComponent(String(obj[k])))
    .join('&');
}

module.exports = async function handler(req, res){
  if (req.method !== 'POST') return res.status(405).json({ error:'method' });

  try{
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ error:'non connecte' });

    const SB = process.env.SUPABASE_URL;
    const ur = await fetch(SB + '/auth/v1/user', {
      headers: { 'apikey': process.env.SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + token }
    });
    if (!ur.ok) return res.status(401).json({ error:'session invalide' });
    const user = await ur.json();

    const KEY = process.env.SUPABASE_SERVICE_ROLE;
    const H = { 'apikey':KEY, 'Authorization':'Bearer ' + KEY };
    const pr = await fetch(SB + '/rest/v1/profiles?id=eq.' + user.id + '&select=stripe_customer_id', { headers:H });
    const rows = await pr.json();
    const customerId = (Array.isArray(rows) && rows.length) ? rows[0].stripe_customer_id : null;
    if (!customerId) return res.status(400).json({ error:'aucun abonnement' });

    const origin = 'https://' + (req.headers['x-forwarded-host'] || req.headers.host);
    const r = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
      method:'POST',
      headers:{
        'Authorization':'Bearer ' + process.env.STRIPE_SECRET_KEY,
        'Content-Type':'application/x-www-form-urlencoded'
      },
      body: form({ customer: customerId, return_url: origin + '/' })
    });
    const j = await r.json();
    if (!r.ok) throw new Error((j.error && j.error.message) || 'Erreur Stripe');

    return res.status(200).json({ url: j.url });

  }catch(e){
    return res.status(500).json({ error: e.message });
  }
};
