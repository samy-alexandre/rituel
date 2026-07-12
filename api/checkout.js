// api/checkout.js — ouvre une page de paiement Stripe pour Rituel+
// Le client appelle : POST /api/checkout  { plan: 'mois' | 'an' }
// avec l'en-tete Authorization: Bearer <access_token Supabase>

const STRIPE = 'https://api.stripe.com/v1';

// Encode un objet en form-urlencoded (format attendu par Stripe)
function form(obj, prefix){
  const parts = [];
  for (const k in obj){
    const v = obj[k];
    if (v === undefined || v === null) continue;
    const key = prefix ? prefix + '[' + k + ']' : k;
    if (typeof v === 'object') parts.push(form(v, key));
    else parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(String(v)));
  }
  return parts.filter(Boolean).join('&');
}

async function stripe(path, body, method){
  const r = await fetch(STRIPE + path, {
    method: method || (body ? 'POST' : 'GET'),
    headers: {
      'Authorization': 'Bearer ' + process.env.STRIPE_SECRET_KEY,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: body ? form(body) : undefined
  });
  const j = await r.json();
  if (!r.ok) throw new Error((j.error && j.error.message) || 'Erreur Stripe');
  return j;
}

module.exports = async function handler(req, res){
  if (req.method !== 'POST') return res.status(405).json({ error:'method' });

  try{
    // 1) Qui es-tu ? (verification du jeton Supabase)
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

    // 2) Quel abonnement ?
    const plan = (req.body && req.body.plan) === 'an' ? 'an' : 'mois';
    const price = plan === 'an' ? process.env.STRIPE_PRICE_AN : process.env.STRIPE_PRICE_MOIS;
    if (!price) return res.status(500).json({ error:'prix Stripe non configure' });

    // 3) Retrouver ou creer le client Stripe
    const KEY = process.env.SUPABASE_SERVICE_ROLE;
    const H = { 'apikey':KEY, 'Authorization':'Bearer ' + KEY, 'Content-Type':'application/json' };

    let customerId = null;
    const pr = await fetch(SB + '/rest/v1/profiles?id=eq.' + user.id + '&select=stripe_customer_id', { headers:H });
    if (pr.ok){
      const rows = await pr.json();
      if (Array.isArray(rows) && rows.length) customerId = rows[0].stripe_customer_id || null;
    }
    if (!customerId){
      const cust = await stripe('/customers', { email: user.email, metadata: { user_id: user.id } });
      customerId = cust.id;
      await fetch(SB + '/rest/v1/profiles?id=eq.' + user.id, {
        method:'PATCH', headers:H, body: JSON.stringify({ stripe_customer_id: customerId })
      });
    }

    // 4) Page de paiement
    const origin = 'https://' + (req.headers['x-forwarded-host'] || req.headers.host);
    const session = await stripe('/checkout/sessions', {
      mode: 'subscription',
      customer: customerId,
      'line_items[0][price]': price,
      'line_items[0][quantity]': 1,
      success_url: origin + '/?paiement=ok',
      cancel_url:  origin + '/?paiement=annule',
      locale: 'fr',
      allow_promotion_codes: 'true',
      'subscription_data[metadata][user_id]': user.id,
      'metadata[user_id]': user.id
    });

    return res.status(200).json({ url: session.url });

  }catch(e){
    return res.status(500).json({ error: e.message });
  }
};
