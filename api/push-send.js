// api/push-send.js — envoi des rappels (déclenché par les crons Vercel)
// N'envoie la notif qu'aux personnes qui ont un rituel actif à ce moment (matin/soir).
const webpush = require('web-push');
module.exports = async function handler(req, res){
  const secret = process.env.CRON_SECRET;
  const okAuth = !secret || req.headers.authorization === 'Bearer '+secret || (req.query && req.query.key === secret);
  if (!okAuth) return res.status(401).json({ error:'unauthorized' });
  const slot = (req.query && req.query.slot) === 'soir' ? 'soir' : 'matin';
  const MSG = {
    matin: { title:'Rituel ☀️', body:"C'est l'heure de ta routine du matin 🌸" },
    soir:  { title:'Rituel 🌙', body:'Petit rappel : ta routine du soir t\'attend 💛' }
  };
  const SB = process.env.SUPABASE_URL, KEY = process.env.SUPABASE_SERVICE_ROLE;
  const H = { 'apikey':KEY, 'Authorization':'Bearer '+KEY };
  try{
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:contact@monrituel.app', process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);

    // 1) Récupérer les abonnés push pour ce créneau
    const r = await fetch(SB+'/rest/v1/push_subs?select=endpoint,p256dh,auth,user_id&'+slot+'=eq.true', { headers:H });
    const subs = await r.json();

    // 2) Récupérer les utilisateurs qui ont un rituel ACTIF à ce moment (matin/soir/both)
    //    On lit les rituels actifs et on garde ceux dont le moment correspond au créneau.
    const rr = await fetch(SB+'/rest/v1/rituels?select=user_id,moment,actif&actif=eq.true', { headers:H });
    const rituels = await rr.json();
    const usersWithSlot = new Set();
    for (const rit of (rituels||[])){
      const m = (rit.moment||'').toLowerCase();
      if (m === slot || m === 'both' || m === 'matinsoir' || m === 'tous'){
        if (rit.user_id) usersWithSlot.add(rit.user_id);
      }
    }

    let sent=0, gone=0, skipped=0;
    for (const s of (subs||[])){
      // Filtre : on envoie seulement si la personne a un rituel actif à ce moment.
      // (Si l'abonné n'a pas de user_id, on envoie quand même, pour ne pas le perdre.)
      if (s.user_id && !usersWithSlot.has(s.user_id)){ skipped++; continue; }
      try{
        await webpush.sendNotification({ endpoint:s.endpoint, keys:{ p256dh:s.p256dh, auth:s.auth } }, JSON.stringify({ ...MSG[slot], url:'/', tag:'rituel-'+slot }));
        sent++;
      }catch(e){
        if (e.statusCode === 404 || e.statusCode === 410){
          gone++;
          await fetch(SB+'/rest/v1/push_subs?endpoint=eq.'+encodeURIComponent(s.endpoint), { method:'DELETE', headers:H });
        }
      }
    }
    return res.status(200).json({ slot, sent, skipped, cleaned: gone, total:(subs||[]).length });
  }catch(e){ return res.status(500).json({ error:e.message }); }
};
