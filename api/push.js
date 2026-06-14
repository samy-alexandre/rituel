// api/push.js — clé publique (GET) + abonnements (POST), sans dépendance
export default async function handler(req, res){
  const SB = process.env.SUPABASE_URL, KEY = process.env.SUPABASE_SERVICE_ROLE;
  if (req.method === 'GET') return res.status(200).json({ publicKey: process.env.VAPID_PUBLIC_KEY || null });
  if (req.method !== 'POST') return res.status(405).json({ error:'method' });
  try{
    const b = req.body || {};
    const H = { 'apikey':KEY, 'Authorization':'Bearer '+KEY, 'Content-Type':'application/json' };
    if (b.action === 'subscribe' && b.endpoint && b.p256dh && b.auth){
      const row = { endpoint:b.endpoint, p256dh:b.p256dh, auth:b.auth, user_id:b.user_id||null, matin:true, soir:true };
      const r = await fetch(SB+'/rest/v1/push_subs', { method:'POST', headers:{...H,'Prefer':'resolution=merge-duplicates'}, body:JSON.stringify(row) });
      return res.status(200).json({ ok:r.ok });
    }
    if (b.action === 'unsubscribe' && b.endpoint){
      await fetch(SB+'/rest/v1/push_subs?endpoint=eq.'+encodeURIComponent(b.endpoint), { method:'DELETE', headers:H });
      return res.status(200).json({ ok:true });
    }
    return res.status(400).json({ error:'bad request' });
  }catch(e){ return res.status(500).json({ error:e.message }); }
}
