// Domaine « Badges & souvenirs » — récompenses calculées depuis l'historique (photos, série,
// produits, rituels, jours notés). Extrait de app.legacy.js (Phase B), déplacé VERBATIM.
// Le barème BADGES migre avec le module. Deps héritées (currentUser, sb, showToast, bestStreak)
// globales. Aucune const partagée.

// ===== Badges & souvenirs (calculés depuis l'historique) =====
const BADGES = [
  { e: '📷', n: 'Première photo', c: 'Prends ta photo du jour', t: (s) => s.photos >= 1 },
  { e: '🎞️', n: 'Album vivant', c: '10 photos au journal', t: (s) => s.photos >= 10 },
  { e: '🪻', n: 'Premier élan', c: '3 jours de série', t: (s) => s.best >= 3 },
  { e: '🔥', n: 'Une semaine', c: '7 jours de série', t: (s) => s.best >= 7 },
  { e: '🌹', n: 'Trente jours', c: '30 jours de série', t: (s) => s.best >= 30 },
  { e: '☁️', n: "L'art du repos", c: 'Prends un jour de repos', t: (s) => s.repos },
  { e: '🧴', n: 'Vanity rempli', c: '5 produits ajoutés', t: (s) => s.prod >= 5 },
  { e: '🌸', n: 'Architecte', c: 'Crée ton premier rituel', t: (s) => s.rit >= 1 },
  { e: '📔', n: 'Fidèle au carnet', c: '7 jours notés', t: (s) => s.days >= 7 },
];
async function openBadgesSheet() {
  if (!currentUser) {
    showToast("Connecte-toi d'abord");
    return;
  }
  document.getElementById('badges-grid').innerHTML =
    '<div style="grid-column:1/-1;color:var(--muted);font-size:13px;text-align:center;padding:10px;">Un instant… 🌸</div>';
  document.getElementById('badges-sheet').classList.add('open');
  const [ent, prods, rits, best] = await Promise.all([
    sb.from('entries').select('date,photo_path,repos').eq('user_id', currentUser.id),
    sb.from('products').select('id').eq('user_id', currentUser.id),
    sb.from('rituels').select('id').eq('user_id', currentUser.id),
    bestStreak(),
  ]);
  const es = (ent && ent.data) || [];
  const s = {
    photos: es.filter((x) => x.photo_path).length,
    days: new Set(es.map((x) => x.date)).size,
    repos: es.some((x) => x.repos),
    prod: ((prods && prods.data) || []).length,
    rit: ((rits && rits.data) || []).length,
    best,
  };
  let got = 0;
  document.getElementById('badges-grid').innerHTML = BADGES.map((b) => {
    const on = b.t(s);
    if (on) got++;
    return (
      '<div style="background:' +
      (on ? 'var(--blush-soft)' : 'var(--surface)') +
      ';border:1.5px solid ' +
      (on ? 'var(--accent)' : 'var(--line)') +
      ';border-radius:16px;padding:12px 6px;text-align:center;' +
      (on ? '' : 'opacity:0.55;') +
      '">' +
      '<div style="font-size:26px;' +
      (on ? '' : 'filter:grayscale(1);') +
      '">' +
      (on ? b.e : '🔒') +
      '</div>' +
      '<div style="font-size:11.5px;font-weight:600;margin-top:5px;line-height:1.25;">' +
      b.n +
      '</div>' +
      '<div style="font-size:10px;color:var(--muted);margin-top:3px;line-height:1.3;">' +
      b.c +
      '</div>' +
      '</div>'
    );
  }).join('');
  document.getElementById('badges-count').textContent =
    got + '/' + BADGES.length + ' débloqués · ils se gagnent en vivant ton rituel 🌿';
}
function closeBadgesSheet() {
  document.getElementById('badges-sheet').classList.remove('open');
}

// Pont transitoire : onclick inline (ouverture badges). Résolution contre window.
Object.assign(window, { openBadgesSheet, closeBadgesSheet });
