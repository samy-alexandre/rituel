// api/push-send.js — envoi des rappels selon les jours et heures choisis dans chaque rituel.
// Déclenché toutes les ~10 minutes par un cron externe (cron-job.org) qui appelle :
//   https://monrituel.app/api/push-send?key=CRON_SECRET
//
// Pour chaque rituel actif dont les rappels sont activés :
//   - est-il prévu aujourd'hui ? (jour de la semaine, dans le fuseau de la personne)
//   - l'heure choisie vient-elle de passer ? (fenêtre de tolérance)
//   - on pose un verrou dans push_log (1 envoi max par rituel / jour / créneau)
//   - on envoie la notification à tous les appareils de la personne

const webpush = require('web-push');

const WINDOW = 15;                    // minutes de tolérance après l'heure prévue
const DEFAULT_TZ = 'Europe/Paris';    // si le fuseau n'a pas encore été enregistré

// Heure locale de la personne : jour de la semaine, minutes depuis minuit, date du jour
function localNow(tz){
  const opts = { hourCycle:'h23', weekday:'short', hour:'2-digit', minute:'2-digit', year:'numeric', month:'2-digit', day:'2-digit' };
  let f;
  try { f = new Intl.DateTimeFormat('en-US', { ...opts, timeZone: tz }); }
  catch(e){ f = new Intl.DateTimeFormat('en-US', { ...opts, timeZone: DEFAULT_TZ }); }
  const p = {};
  for (const part of f.formatToParts(new Date())) p[part.type] = part.value;
  const WD = { Sun:0, Mon:1, Tue:2, Wed:3, Thu:4, Fri:5, Sat:6 };
  return {
    dow:  WD[p.weekday],
    min:  (parseInt(p.hour, 10) % 24) * 60 + parseInt(p.minute, 10),
    date: p.year + '-' + p.month + '-' + p.day
  };
}

// "08:30" -> 510
function hhmmToMin(s){
  if (typeof s !== 'string') return null;
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10), mi = parseInt(m[2], 10);
  if (h > 23 || mi > 59) return null;
  return h * 60 + mi;
}

module.exports = async function handler(req, res){
  const secret = process.env.CRON_SECRET;
  const okAuth = !secret
    || req.headers.authorization === 'Bearer ' + secret
    || (req.query && req.query.key === secret);
  if (!okAuth) return res.status(401).json({ error:'unauthorized' });

  const SB  = process.env.SUPABASE_URL;
  const KEY = process.env.SUPABASE_SERVICE_ROLE;
  const H   = { 'apikey':KEY, 'Authorization':'Bearer ' + KEY };
  const HJ  = { ...H, 'Content-Type':'application/json' };

  try{
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || 'mailto:rituel.app.contact@gmail.com',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );

    // 1) Les appareils abonnes (avec le fuseau horaire si la colonne existe)
    let subs = [];
    let r = await fetch(SB + '/rest/v1/push_subs?select=endpoint,p256dh,auth,user_id,tz', { headers:H });
    if (r.ok) {
      subs = await r.json();
    } else {
      r = await fetch(SB + '/rest/v1/push_subs?select=endpoint,p256dh,auth,user_id', { headers:H });
      if (!r.ok) return res.status(500).json({ error:'lecture push_subs impossible' });
      subs = await r.json();
    }
    if (!Array.isArray(subs) || !subs.length) return res.status(200).json({ sent:0, note:'aucun appareil abonne' });

    // Regrouper les appareils par personne
    const byUser = new Map();
    for (const s of subs){
      if (!s.user_id) continue;
      if (!byUser.has(s.user_id)) byUser.set(s.user_id, []);
      byUser.get(s.user_id).push(s);
    }

    // 2) Les rituels actifs qui ont des rappels
    const rr = await fetch(SB + '/rest/v1/rituels?select=id,user_id,nom,moment,actif,rappels&actif=eq.true', { headers:H });
    if (!rr.ok) return res.status(500).json({ error:'lecture rituels impossible' });
    const rituels = await rr.json();
    if (!Array.isArray(rituels)) return res.status(500).json({ error:'rituels invalides' });

    let sent = 0, dup = 0, due = 0, gone = 0, logMissing = false;

    for (const rit of rituels){
      const rap = rit.rappels;
      if (!rap || rap.on !== true) continue;                 // rappels desactives
      const devices = byUser.get(rit.user_id);
      if (!devices || !devices.length) continue;             // personne pas abonnee

      const tz  = devices[0].tz || DEFAULT_TZ;
      const now = localNow(tz);

      const days = Array.isArray(rap.days) ? rap.days.map(Number) : [];
      if (!days.includes(now.dow)) continue;                 // pas prevu aujourd'hui

      // Quels creneaux ce rituel doit-il declencher ?
      const moment = String(rit.moment || '').toLowerCase();
      const slots = [];
      if (moment === 'hebdo'){
        if (rap.soir) slots.push(['hebdo', hhmmToMin(rap.soir)]);
      } else {
        if ((moment === 'matin' || moment === 'both') && rap.matin) slots.push(['matin', hhmmToMin(rap.matin)]);
        if ((moment === 'soir'  || moment === 'both') && rap.soir)  slots.push(['soir',  hhmmToMin(rap.soir)]);
      }

      for (const pair of slots){
        const slot = pair[0], remMin = pair[1];
        if (remMin == null) continue;
        const delta = now.min - remMin;
        if (delta < 0 || delta >= WINDOW) continue;          // l'heure n'est pas (encore) venue
        due++;

        // Verrou anti-doublon : une seule notif par rituel / jour / creneau
        const lock = await fetch(SB + '/rest/v1/push_log', {
          method:'POST',
          headers: Object.assign({}, HJ, { 'Prefer':'return=minimal' }),
          body: JSON.stringify({ rituel_id: rit.id, jour: now.date, slot: slot, user_id: rit.user_id })
        });
        if (lock.status === 409){ dup++; continue; }          // deja envoye aujourd'hui
        if (lock.status === 404 || lock.status === 400){ logMissing = true; continue; }
        if (!lock.ok) continue;

        const emoji = slot === 'matin' ? '\u2600\uFE0F' : (slot === 'hebdo' ? '\uD83E\uDDD6\u200D\u2640\uFE0F' : '\uD83C\uDF19');
        const nom   = rit.nom || (slot === 'matin' ? 'Ta routine du matin'
                                 : slot === 'hebdo' ? 'Ton soin de la semaine'
                                 : 'Ta routine du soir');
        const payload = JSON.stringify({
          title: 'Rituel ' + emoji,
          body:  nom + " t'attend \uD83C\uDF38",
          url:   '/',
          tag:   'rituel-' + rit.id + '-' + slot
        });

        for (const s of devices){
          try{
            await webpush.sendNotification(
              { endpoint:s.endpoint, keys:{ p256dh:s.p256dh, auth:s.auth } },
              payload
            );
            sent++;
          }catch(e){
            if (e.statusCode === 404 || e.statusCode === 410){
              gone++;
              await fetch(SB + '/rest/v1/push_subs?endpoint=eq.' + encodeURIComponent(s.endpoint), { method:'DELETE', headers:H });
            }
          }
        }
      }
    }

    if (logMissing){
      return res.status(500).json({ error:"table push_log manquante - execute SQL-notifications.sql dans Supabase" });
    }
    return res.status(200).json({ sent:sent, dup:dup, due:due, cleaned:gone, appareils:subs.length, rituels:rituels.length });

  }catch(e){
    return res.status(500).json({ error:e.message });
  }
};
