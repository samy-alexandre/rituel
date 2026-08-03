// src/features/home/home.js
// Domaine Home : accueil, humeur, routine matin/soir, streak, plante, « ma journée »,
// photo du jour, jour de repos, petit mot de Léa. Extrait verbatim de public/app.legacy.js.
// Le pont transitoire window.* est conservé pour les handlers onclick inline du HTML.

// ===== Entrée du jour (une ligne par jour dans 'entries') =====
async function getTodayEntryId() {
  if (!currentUser) return null;
  const { data } = await sb
    .from('entries')
    .select('id')
    .eq('user_id', currentUser.id)
    .eq('date', todayStr())
    .order('created_at', { ascending: true })
    .limit(1);
  if (data && data.length) return data[0].id;
  const { data: ins, error } = await sb
    .from('entries')
    .insert({ user_id: currentUser.id, date: todayStr() })
    .select('id')
    .single();
  if (error) {
    console.warn('getTodayEntryId:', error.message);
    return null;
  }
  return ins ? ins.id : null;
}

async function updateTodayEntry(fields) {
  const id = await getTodayEntryId();
  if (!id) return;
  const { error } = await sb.from('entries').update(fields).eq('id', id);
  if (error) console.warn('updateTodayEntry:', error.message);
}

// ===== Humeur + intensité =====
let currentMood = null;

function selectMood(el, val) {
  el.parentElement.querySelectorAll('.mood-btn').forEach((b) => b.classList.remove('selected'));
  el.classList.add('selected');
  currentMood = val;
  document.getElementById('intensity-box').classList.remove('hidden');
  saveMood();
}

function onIntensity(v) {
  document.getElementById('intensity-val').textContent = v + '%';
}

async function saveMood() {
  if (!currentUser || !currentMood) return;
  const intensite = parseInt(document.getElementById('intensity-slider').value, 10);
  await updateTodayEntry({ humeur: currentMood, humeur_intensite: intensite });
  showToast('Humeur enregistrée ✓');
}

// ===== Routine matin / soir =====
let currentPeriod = 'matin';

function switchPeriod(p) {
  currentPeriod = p;
  window.currentPeriod = p; // miroir pour le module Voyage (lit window.currentPeriod)
  document.getElementById('pb-matin').classList.toggle('active', p === 'matin');
  document.getElementById('pb-soir').classList.toggle('active', p === 'soir');
  const em = document.getElementById('hr-emoji');
  const ti = document.getElementById('hr-title');
  if (em) {
    em.textContent = p === 'soir' ? '🌙' : '☀️';
    em.classList.toggle('soir', p === 'soir');
  }
  if (ti) ti.textContent = p === 'soir' ? 'Rituel du soir' : 'Rituel du matin';
  document.getElementById('routine-matin').classList.toggle('hidden', p !== 'matin');
  document.getElementById('routine-soir').classList.toggle('hidden', p !== 'soir');
  updateRoutineCount();
  if (typeof renderHomeVoyage === 'function') renderHomeVoyage();
}

function listStats(period) {
  const list = document.getElementById('routine-' + period);
  const total = list.querySelectorAll('.routine-item').length;
  const done = list.querySelectorAll('.routine-item.done').length;
  return { done, total, complete: total > 0 && done === total };
}

function updateRoutineCount() {
  const s = listStats(currentPeriod);
  const fill = document.getElementById('hr-bar-fill');
  const sub = document.getElementById('hr-sub');
  const pct = s.total ? Math.round((s.done / s.total) * 100) : 0;
  if (fill) fill.style.width = pct + '%';
  if (sub) {
    if (!s.total) sub.textContent = "Aucune étape pour l'instant";
    else if (s.complete) sub.textContent = 'Terminé, bravo 🌸';
    else sub.textContent = s.done + ' sur ' + s.total + (s.done === 0 ? ' · c\'est parti 🌸' : ' · continue 🌿');
  }
}

async function toggleRoutine(el) {
  el.classList.toggle('done');
  const list = el.closest('.routine-list');
  const period = list && list.id === 'routine-soir' ? 'soir' : 'matin';
  if (navigator.vibrate) navigator.vibrate(10);
  updateRoutineCount();
  // Mémoriser les étapes cochées de ce créneau
  const doneIds = [...list.querySelectorAll('.routine-item.done')].map((x) => x.dataset.pid).filter(Boolean);
  window.__homeSteps = window.__homeSteps || { matin: [], soir: [] };
  window.__homeSteps[period] = doneIds;
  const complete = listStats(period).complete;
  const fields = period === 'soir' ? { routine_soir: complete } : { routine_matin: complete };
  fields.steps = { matin: window.__homeSteps.matin || [], soir: window.__homeSteps.soir || [] };
  try {
    await updateTodayEntry(fields);
  } catch (e) {
    await updateTodayEntry(period === 'soir' ? { routine_soir: complete } : { routine_matin: complete });
  }
  bustStreak();
  renderStreak();
  if (typeof renderHomeVoyage === 'function') renderHomeVoyage();
}

function applyRoutineState(period, complete) {
  const list = document.getElementById('routine-' + period);
  if (!list) return;
  list.querySelectorAll('.routine-item').forEach((it) => {
    it.classList.toggle('done', !!complete);
    const _rt = it.querySelector('.routine-time');
    if (_rt) _rt.textContent = complete ? '✓' : '…';
  });
}

// ===== Streak (selon le type de rituel choisi) =====
function dayComplete(e) {
  if (!e) return false;
  if (e.repos) return true;
  const t = state.rituelType || 'both';
  if (t === 'matin') return !!e.routine_matin;
  if (t === 'soir') return !!e.routine_soir;
  return !!(e.routine_matin && e.routine_soir);
}

let _stkCache = null;
function bustStreak() {
  _stkCache = null;
}
async function computeStreak() {
  if (!currentUser) return 0;
  if (_stkCache && _stkCache.d === todayStr()) return _stkCache.v;
  const { data } = await sb
    .from('entries')
    .select('date,routine_matin,routine_soir,repos')
    .eq('user_id', currentUser.id)
    .order('date', { ascending: false })
    .limit(90);
  if (!data || !data.length) return 0;
  const done = {};
  data.forEach((e) => {
    done[e.date] = dayComplete(e);
  });
  let streak = 0;
  const d = new Date();
  if (!done[d.toISOString().slice(0, 10)]) d.setDate(d.getDate() - 1);
  for (let i = 0; i < 90; i++) {
    const ds = d.toISOString().slice(0, 10);
    if (done[ds]) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else break;
  }
  _stkCache = { d: todayStr(), v: streak };
  return streak;
}

async function renderStreak() {
  if (!currentUser) return;
  const n = await computeStreak();
  document.getElementById('streak-num').textContent = n;
  document.getElementById('streak-unit').textContent = n > 1 ? "jours d'affilée" : 'jour';
  document.getElementById('streak-flame').textContent = n === 0 ? '🌱' : n >= 7 ? '🔥' : '🌸';
  const label = document.getElementById('streak-label');
  if (n === 0) label.textContent = 'Fais ton rituel pour démarrer ta série ✨';
  else if (n < 3) label.textContent = 'Beau début, continue comme ça 🌸';
  else if (n < 7) label.textContent = 'Belle régularité, ça se voit sur la peau ✨';
  else label.textContent = 'Tu es rayonnante de constance 🔥';
  const { data } = await sb
    .from('entries')
    .select('date,routine_matin,routine_soir')
    .eq('user_id', currentUser.id)
    .order('date', { ascending: false })
    .limit(14);
  const done = {};
  (data || []).forEach((e) => {
    done[e.date] = dayComplete(e);
  });
  // Semainier : lundi → dimanche, avec l'initiale du jour
  const LETTRES = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
  const today = new Date();
  const jour = today.getDay(); // 0 = dimanche
  const depuisLundi = jour === 0 ? 6 : jour - 1; // recule jusqu'au lundi
  let mini = '';
  for (let i = 0; i < 7; i++) {
    const dd = new Date();
    dd.setDate(dd.getDate() - depuisLundi + i);
    const ds = dd.toISOString().slice(0, 10);
    const futur = dd > today && ds !== todayStr();
    const cls = done[ds] ? 'active' : futur ? 'futur' : '';
    const auj = ds === todayStr() ? ' auj' : '';
    mini += '<div class="sk-day ' + cls + auj + '"><span class="sk-l">' + LETTRES[dd.getDay()] + '</span><span class="sk-p">' + (done[ds] ? '✓' : '') + '</span></div>';
  }
  document.getElementById('streak-mini').innerHTML = mini;
  renderPlant(n);
}

// ===== Plante qui pousse avec la série =====
function plantStage(n) {
  if (n <= 0) return 0;
  if (n < 3) return 1;
  if (n < 7) return 2;
  if (n < 14) return 3;
  if (n < 21) return 4;
  return 5;
}

const PLANT_TYPES = {
  fleur: { name: 'Fleur', emoji: '🌸', unlock: 0 },
  lavande: { name: 'Lavande', emoji: '🪻', unlock: 3 },
  tournesol: { name: 'Tournesol', emoji: '🌻', unlock: 7 },
  cactus: { name: 'Cactus', emoji: '🌵', unlock: 14 },
  rose: { name: 'Rose', emoji: '🌹', unlock: 30 },
};
window.PLANT_TYPES = PLANT_TYPES;

function currentPlant() {
  try {
    return localStorage.getItem('rituel_plant') || 'fleur';
  } catch (e) {
    return 'fleur';
  }
}

function bloomSVG(type, topY, stage) {
  const P = [];
  if (type === 'lavande') {
    const count = stage >= 5 ? 6 : stage >= 4 ? 3 : 0;
    for (let i = 0; i < count; i++) {
      const yy = topY - i * 8;
      P.push('<ellipse cx="100" cy="' + yy + '" rx="5.5" ry="6.5" fill="' + (i % 2 ? '#9B82D6' : '#8B7CC4') + '"/>');
    }
    return P.join('');
  }
  if (type === 'cactus') {
    if (stage >= 5) {
      for (let k = 0; k < 5; k++) {
        const a = (-Math.PI / 2 + k * ((2 * Math.PI) / 5));
        const px = Math.round(100 + Math.cos(a) * 7);
        const py = Math.round(topY + Math.sin(a) * 7);
        P.push('<circle cx="' + px + '" cy="' + py + '" r="5" fill="#E8729B"/>');
      }
      P.push('<circle cx="100" cy="' + topY + '" r="3.5" fill="#F4C84B"/>');
    }
    return P.join('');
  }
  if (type === 'rose') {
    if (stage >= 5) {
      for (let k = 0; k < 8; k++) {
        const a = k * (Math.PI / 4);
        const px = Math.round(100 + Math.cos(a) * 14);
        const py = Math.round(topY + Math.sin(a) * 14);
        P.push('<circle cx="' + px + '" cy="' + py + '" r="8" fill="#D6457B"/>');
      }
      for (let k = 0; k < 5; k++) {
        const a = k * ((2 * Math.PI) / 5) + 0.4;
        const px = Math.round(100 + Math.cos(a) * 7);
        const py = Math.round(topY + Math.sin(a) * 7);
        P.push('<circle cx="' + px + '" cy="' + py + '" r="6" fill="#B83266"/>');
      }
      P.push('<circle cx="100" cy="' + topY + '" r="4" fill="#8E2150"/>');
    } else if (stage >= 4) {
      P.push('<circle cx="100" cy="' + topY + '" r="9" fill="#E59ABA"/>');
      P.push('<path d="M100 ' + (topY - 9) + ' Q109 ' + topY + ' 100 ' + (topY + 9) + ' Q91 ' + topY + ' 100 ' + (topY - 9) + ' Z" fill="#C85084"/>');
    }
    return P.join('');
  }
  if (stage >= 5) {
    const r = type === 'tournesol' ? 14 : 13;
    const pr = type === 'tournesol' ? 6 : 9;
    const petalColor = type === 'tournesol' ? '#F4C026' : 'var(--blush)';
    const centerColor = type === 'tournesol' ? '#7A5230' : 'var(--gold)';
    for (let k = 0; k < petals; k++) {
      const a = k * ((2 * Math.PI) / petals);
      const px = Math.round(100 + Math.cos(a) * r);
      const py = Math.round(topY + Math.sin(a) * r);
      P.push('<circle cx="' + px + '" cy="' + py + '" r="' + pr + '" fill="' + petalColor + '"/>');
    }
    P.push('<circle cx="100" cy="' + topY + '" r="8" fill="' + centerColor + '"/>');
  } else if (stage >= 4) {
    const c = type === 'tournesol' ? '#E8C25A' : 'var(--accent-soft)';
    const c2 = type === 'tournesol' ? '#C99B2E' : 'var(--accent)';
    P.push('<circle cx="100" cy="' + topY + '" r="9" fill="' + c + '"/>');
    P.push('<path d="M100 ' + (topY - 9) + ' Q109 ' + topY + ' 100 ' + (topY + 9) + ' Q91 ' + topY + ' 100 ' + (topY - 9) + ' Z" fill="' + c2 + '"/>');
  }
  return P.join('');
}

function plantSVG(stage, type) {
  type = type || 'fleur';
  const soilY = 150;
  const stemH = 10 + stage * 22;
  const topY = soilY - stemH;
  const isCactus = type === 'cactus';
  const stemW = isCactus ? 13 : 4;
  const stemColor = isCactus ? '#6FA368' : 'var(--sage)';
  const parts = [];
  parts.push('<path d="M70 150 L75 182 Q76 188 82 188 L118 188 Q124 188 125 182 L130 150 Z" fill="#D7A286"/>');
  parts.push('<path d="M64 144 H136 L134 154 H66 Z" fill="#C68E70"/>');
  parts.push('<ellipse cx="100" cy="150" rx="32" ry="5" fill="#7C5A44"/>');
  if (stage === 0) {
    parts.push('<path d="M100 150 C95 143 87 142 83 145 C88 150 96 151 100 150 Z" fill="var(--sage)"/>');
    parts.push('<path d="M100 150 C105 143 113 142 117 145 C112 150 104 151 100 150 Z" fill="var(--sage)"/>');
  } else {
    const midY = Math.round((soilY + topY) / 2);
    parts.push('<path d="M100 ' + soilY + ' Q' + (isCactus ? 100 : 97) + ' ' + midY + ' 100 ' + topY + '" stroke="' + stemColor + '" stroke-width="' + stemW + '" fill="none" stroke-linecap="round"/>');
    const pairs = Math.min(stage, 4);
    for (let i = 0; i < pairs; i++) {
      const ly = Math.round(soilY - (stemH * (i + 1)) / (pairs + 1));
      if (isCactus) {
        parts.push('<ellipse cx="89" cy="' + ly + '" rx="7" ry="11" fill="#6FA368"/>');
        parts.push('<ellipse cx="111" cy="' + (ly - 4) + '" rx="7" ry="11" fill="#6FA368"/>');
      } else {
        parts.push('<path d="M100 ' + ly + ' C84 ' + (ly - 9) + ' 73 ' + (ly - 3) + ' 71 ' + (ly + 6) + ' C84 ' + (ly + 8) + ' 96 ' + (ly + 4) + ' 100 ' + ly + ' Z" fill="var(--sage)"/>');
        parts.push('<path d="M100 ' + ly + ' C116 ' + (ly - 9) + ' 127 ' + (ly - 3) + ' 129 ' + (ly + 6) + ' C116 ' + (ly + 8) + ' 104 ' + (ly + 4) + ' 100 ' + ly + ' Z" fill="var(--sage)"/>');
      }
    }
    parts.push(bloomSVG(type, topY, stage));
  }
  return '<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" style="width:150px;height:150px;">' + parts.join('') + '</svg>';
}

async function renderPlant(n) {
  const host = document.getElementById('plant-host');
  if (!host) return;
  if (typeof n !== 'number') {
    n = currentUser ? await computeStreak() : 0;
  }
  const st = plantStage(n);
  host.innerHTML = plantSVG(st, currentPlant());
  const cap = document.getElementById('plant-caption');
  if (cap) {
    if (n === 0) cap.textContent = 'Fais ton rituel pour faire pousser ta plante 🌱';
    else if (st >= 5) cap.textContent = 'En fleur ! ' + n + ' jours de rituel 🌸';
    else cap.textContent = 'Ta plante pousse · ' + n + ' jour' + (n > 1 ? 's' : '') + ' 🌿';
  }
  // Félicitations quand la plante change de palier (pas au tout premier affichage)
  try {
    const key = currentUser ? 'rituel_plant_stage_' + currentUser.id : 'rituel_plant_stage';
    const prev = parseInt(localStorage.getItem(key) || '-1', 10);
    if (st > 0 && prev >= 0 && st > prev) {
      const msgs = {
        1: 'Ta graine a germé 🌱',
        2: 'Ta plante grandit 🌿',
        3: 'De belles feuilles ! 🍃',
        4: 'Un bouton apparaît 🌸',
        5: 'Ta plante est en fleur ! 🌸',
      };
      showToast(msgs[st] || 'Ta plante a poussé 🌿');
    }
    if (st !== prev) localStorage.setItem(key, String(st));
  } catch (e) {
    console.error('renderPlant (stage) :', e);
  }
  // Déblocage de nouvelles plantes selon la série (notif au passage d'un palier)
  try {
    const uid = currentUser ? currentUser.id : 'anon';
    const ukey = 'rituel_unlocked_' + uid;
    if (localStorage.getItem(ukey) === null) {
      const achieved = Object.values(PLANT_TYPES).reduce((mx, v) => (v.unlock <= n ? Math.max(mx, v.unlock) : mx), 0);
      localStorage.setItem(ukey, String(achieved));
    } else {
      const prevU = parseInt(localStorage.getItem(ukey), 10);
      const newly = Object.values(PLANT_TYPES)
        .filter((v) => v.unlock > prevU && v.unlock <= n)
        .sort((a, b) => a.unlock - b.unlock);
      if (newly.length) {
        const last = newly[newly.length - 1];
        showToast(last.emoji + ' Nouvelle plante débloquée : ' + last.name + ' !');
        localStorage.setItem(ukey, String(last.unlock));
      }
    }
  } catch (e) {
    console.error('renderPlant (unlock) :', e);
  }
}

async function bestStreak() {
  if (!currentUser) return 0;
  const { data } = await sb
    .from('entries')
    .select('date,routine_matin,routine_soir,repos')
    .eq('user_id', currentUser.id)
    .order('date', { ascending: true });
  const es = data || [];
  const done = new Set();
  es.forEach((e) => {
    if (dayComplete(e)) done.add(e.date);
  });
  if (!done.size) return 0;
  const dates = [...done].sort();
  let best = 0,
    run = 0,
    prev = null;
  for (const d of dates) {
    if (prev) {
      const diff = Math.round((new Date(d) - new Date(prev)) / 86400000);
      run = diff === 1 ? run + 1 : 1;
    } else run = 1;
    if (run > best) best = run;
    prev = d;
  }
  return best;
}

function plantLockedToast(d) {
  showToast('🔒 Plante à débloquer dès ' + d + ' jours de série 🌱');
}

async function openPlantSheet() {
  const cur = currentPlant();
  let best = 0;
  try {
    best = await bestStreak();
  } catch (e) {
    best = 0;
  }
  document.getElementById('plant-list').innerHTML = Object.keys(PLANT_TYPES)
    .map((k) => {
      const v = PLANT_TYPES[k];
      const locked = best < (v.unlock || 0);
      const onclick = locked ? 'plantLockedToast(' + v.unlock + ')' : "pickPlant('" + k + "')";
      const border = k === cur && !locked ? 'var(--accent)' : 'var(--line)';
      const bg = k === cur && !locked ? 'var(--blush-soft)' : 'var(--surface)';
      const right = locked
        ? '<div style="font-size:11px;color:var(--muted);text-align:right;line-height:1.3;flex-shrink:0;">🔒<br>dès ' + v.unlock + ' j</div>'
        : k === cur
          ? '<div style="font-size:13px;color:var(--accent-deep);flex-shrink:0;">✓</div>'
          : '';
      return (
        '<button onclick="' +
        onclick +
        '" style="display:flex;align-items:center;gap:14px;width:100%;padding:10px 12px;border-radius:14px;border:1.5px solid ' +
        border +
        ';background:' +
        bg +
        ';cursor:pointer;text-align:left;' +
        (locked ? 'opacity:0.55;' : '') +
        '">' +
        '<div style="width:54px;height:54px;flex-shrink:0;display:flex;align-items:center;justify-content:center;overflow:hidden;background:var(--surface-warm);border-radius:12px;"><div style="transform:scale(0.36);transform-origin:center;">' +
        plantSVG(5, k) +
        '</div></div>' +
        '<div style="flex:1;font-family:var(--serif);font-size:16px;">' +
        v.emoji +
        ' ' +
        v.name +
        '</div>' +
        right +
        '</button>'
      );
    })
    .join('');
  document.getElementById('plant-sheet').classList.add('open');
}

function pickPlant(k) {
  try {
    localStorage.setItem('rituel_plant', k);
  } catch (e) {
    console.error('pickPlant :', e);
  }
  renderPlant();
  openPlantSheet();
  showToast(PLANT_TYPES[k].emoji + ' Jolie plante !');
}

function closePlantSheet() {
  document.getElementById('plant-sheet').classList.remove('open');
}

// ===== Chargement de l'accueil =====
async function loadHomeData() {
  if (!currentUser) return;
  // on repart toujours d'une humeur "vierge" à l'affichage…
  document.querySelectorAll('#home .mood-btn').forEach((b) => b.classList.remove('selected'));
  document.getElementById('intensity-box').classList.add('hidden');
  document.getElementById('intensity-slider').value = 50;
  onIntensity(50);
  currentMood = null;

  const { data } = await sb
    .from('entries')
    .select('*')
    .eq('user_id', currentUser.id)
    .eq('date', todayStr())
    .order('created_at', { ascending: true })
    .limit(1);
  const e = data && data.length ? data[0] : null;
  // …et on ne ré-affiche l'humeur QUE si elle a été notée aujourd'hui
  if (e && e.humeur) {
    const btns = document.querySelectorAll('#home .mood-btn');
    if (btns[e.humeur - 1]) btns[e.humeur - 1].classList.add('selected');
    currentMood = e.humeur;
    document.getElementById('intensity-box').classList.remove('hidden');
    const slider = document.getElementById('intensity-slider');
    slider.value = e.humeur_intensite || 50;
    onIntensity(slider.value);
  }
  await loadHomeRoutine();
  applyRoutineState('matin', e ? e.routine_matin : false);
  applyRoutineState('soir', e ? e.routine_soir : false);
  applyRituelTypeToHome();
  renderStreak();
  renderDayTiles(e);
  loadHabits();
  loadLeaTip();
  updateRestBtn(e);
  loadLeaProactive(e);
  updateChatBadge();
  maybeShowLettreCta();
  maybeShowBilan5();
  loadUV();
  loadCycleCard();
  loadEclatProgram();
}

// ===== Jour de repos (joker hebdo qui protège la série) =====
function updateRestBtn(e) {
  const btn = document.getElementById('rest-btn');
  if (!btn) return;
  const isRepos = e && e.repos;
  btn.textContent = isRepos ? '☁️ Repos actif' : '☁️ Repos';
}

async function takeRestDay() {
  if (!currentUser) {
    showToast("Connecte-toi d'abord");
    return;
  }
  const today = todayStr();
  const { data } = await sb
    .from('entries')
    .select('repos')
    .eq('user_id', currentUser.id)
    .eq('date', today)
    .order('created_at', { ascending: true })
    .limit(1);
  const isRepos = data && data.length && data[0].repos;
  if (isRepos) {
    await updateTodayEntry({ repos: false });
    showToast('Jour de repos annulé');
  } else {
    const since = new Date();
    since.setDate(since.getDate() - 6);
    const sinceStr = since.toISOString().slice(0, 10);
    const { data: wk } = await sb
      .from('entries')
      .select('date')
      .eq('user_id', currentUser.id)
      .eq('repos', true)
      .gte('date', sinceStr)
      .neq('date', today);
    if (wk && wk.length >= 1) {
      showToast('Tu as déjà pris ton jour de repos cette semaine 🌸');
      return;
    }
    await updateTodayEntry({ repos: true });
    showToast('Jour de repos pris · ta série est protégée ☁️');
  }
  const { data: d2 } = await sb
    .from('entries')
    .select('repos')
    .eq('user_id', currentUser.id)
    .eq('date', today)
    .limit(1);
  updateRestBtn(d2 && d2.length ? d2[0] : null);
  bustStreak();
  renderStreak();
}

// Affiche les bons moments sur l'accueil selon le type de rituel choisi
function applyRituelTypeToHome() {
  /* géré dynamiquement par loadHomeRoutine selon les rituels existants */
}

// Construit la checklist de l'accueil à partir des vrais produits du Rituel
async function loadHomeRoutine() {
  if (!currentUser) return;
  const { data: rits } = await sb
    .from('rituels')
    .select('id,nom,moment,produits,position,actif')
    .eq('user_id', currentUser.id)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });
  const rituels = rits || [];
  const homeSec = document.getElementById('home-rituel-section');
  if (homeSec) homeSec.style.display = 'block';
  const emptyEl = document.getElementById('home-rituel-empty');
  const partEls = [document.getElementById('hr-card')];
  if (!rituels.length) {
    if (emptyEl) emptyEl.style.display = 'block';
    partEls.forEach((el) => {
      if (el) el.style.display = 'none';
    });
    const cb = document.getElementById('rituel-choose-btn');
    if (cb) cb.style.display = 'none';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';
  partEls.forEach((el) => {
    if (el) el.style.display = '';
  });
  ensureActiveRituels(rituels);
  window.__allRituels = rituels;
  const act = pickActive(rituels);
  const hasM = !!act.matin;
  const hasS = !!act.soir;
  const chooseBtn = document.getElementById('rituel-choose-btn');
  if (chooseBtn) chooseBtn.style.display = rituels.length > 1 ? 'inline-block' : 'none';
  // Le sélecteur ☀️/🌙 n'a de sens que si les deux créneaux existent
  const swEl = homeSec ? homeSec.querySelector('.hr-switch') : null;
  if (swEl) swEl.style.display = hasM && hasS ? 'flex' : 'none';
  // Créneau par défaut selon l'heure : le soir à partir de midi
  const _h = new Date().getHours();
  const _prefSoir = _h >= 12;
  let _p = 'matin';
  if (_prefSoir && hasS) _p = 'soir';
  else if (hasM) _p = 'matin';
  else if (hasS) _p = 'soir';
  switchPeriod(_p);
  try {
    const gi2 = document.getElementById('greet-invite');
    if (gi2) {
      const allDone = (function () {
        const mEl = document.getElementById('routine-matin');
        const sEl = document.getElementById('routine-soir');
        const items = [].concat(
          [...(mEl ? mEl.querySelectorAll('.routine-item') : [])],
          [...(sEl ? sEl.querySelectorAll('.routine-item') : [])]
        );
        if (!items.length) return false;
        return items.every((it) => it.classList.contains('done'));
      })();
      if (allDone) gi2.textContent = 'Ton rituel du jour est fait, bravo 🌸';
    }
  } catch (e) {
    console.error('loadHomeRoutine (greet) :', e);
  }
  const { data: prods } = await sb
    .from('products')
    .select('id,nom,effets,emoji,categorie,photo_path')
    .eq('user_id', currentUser.id);
  const pmap = {};
  (prods || []).forEach((p) => {
    pmap[p.id] = p;
  });
  // Étapes déjà cochées aujourd'hui (mémorisées en base)
  window.__homeSteps = { matin: [], soir: [] };
  try {
    const { data: te } = await sb
      .from('entries')
      .select('steps')
      .eq('user_id', currentUser.id)
      .eq('date', todayStr())
      .limit(1);
    const st = te && te.length && te[0].steps ? te[0].steps : null;
    if (st) {
      window.__homeSteps = {
        matin: Array.isArray(st.matin) ? st.matin : [],
        soir: Array.isArray(st.soir) ? st.soir : [],
      };
    }
  } catch (e) {
    console.error('loadHomeRoutine (steps) :', e);
  }
  for (const moment of ['matin', 'soir']) {
    const list = document.getElementById('routine-' + moment);
    const src = act[moment];
    const ids = src && Array.isArray(src.produits) ? src.produits : [];
    const items = ids.map((id) => pmap[id]).filter(Boolean);
    window.__homeRoutine = window.__homeRoutine || {};
    window.__homeRoutine[moment] = items;
    if (!items.length) {
      list.innerHTML =
        '<div style="padding:18px;text-align:center;color:var(--muted);font-size:13px;line-height:1.5;">Rien pour le ' +
        (moment === 'soir' ? 'soir' : 'matin') +
        " pour l'instant.<br><button class=\"btn-soft\" style=\"padding:7px 14px;font-size:11.5px;margin-top:8px;\" onclick=\"navTo('ritual')\">Complète-le dans l'onglet Rituel →</button></div>";
    } else {
      const doneIds = (window.__homeSteps && window.__homeSteps[moment]) || [];
      list.innerHTML = items
        .map((p, i) => {
          const parts = (p.nom || '').split(' · ');
          const isDone = doneIds.indexOf(p.id) >= 0;
          return (
            '<div class="routine-item' +
            (isDone ? ' done' : '') +
            '" data-pid="' +
            p.id +
            '" onclick="toggleRoutine(this)">' +
            '<div class="routine-thumb"><span class="n">' +
            (i + 1) +
            '</span>' +
            (p.emoji || '🧴') +
            '</div>' +
            '<div class="routine-info"><div class="routine-name">' +
            escapeHtml(parts[0] || '') +
            '</div>' +
            (parts[1]
              ? '<div class="routine-product">' + escapeHtml(parts[1]) + '</div>'
              : p.effets
                ? '<div class="routine-product">' + escapeHtml(p.effets) + '</div>'
                : '') +
            '</div>' +
            '<div class="routine-check"></div></div>'
          );
        })
        .join('');
    }
  }
  if (typeof renderHomeVoyage === 'function') renderHomeVoyage();
}

// ===== Ma journée (sommeil / hydratation / alimentation) =====
const ALIM_LABELS = ['', 'À améliorer', 'Correcte', 'Équilibrée', 'Bonne', 'Parfaite'];
window.ALIM_LABELS = ALIM_LABELS; // partagé (contexte chat)

function fmtSleep(v) {
  v = parseFloat(v);
  const h = Math.floor(v);
  const m = Math.round((v - h) * 60);
  return m ? h + 'h' + (m < 10 ? '0' + m : m) : h + 'h';
}

function onDaySommeil(v) {
  document.getElementById('ds-sommeil-val').textContent = fmtSleep(v);
}

function onDayHydra(v) {
  const n = parseInt(v, 10);
  document.getElementById('ds-hydra-val').textContent = n + (n > 1 ? ' verres' : ' verre');
}

function onDayAlim(v) {
  document.getElementById('ds-alim-val').textContent = ALIM_LABELS[parseInt(v, 10)] || '…';
}

async function openDaySheet() {
  if (!currentUser) {
    showToast("Connecte-toi d'abord");
    return;
  }
  let som = 7,
    hyd = 6,
    ali = 3;
  const { data } = await sb
    .from('entries')
    .select('sommeil,hydratation,alimentation')
    .eq('user_id', currentUser.id)
    .eq('date', todayStr())
    .order('created_at', { ascending: true })
    .limit(1);
  const e = data && data.length ? data[0] : null;
  if (e) {
    if (e.sommeil != null) som = e.sommeil;
    if (e.hydratation != null) hyd = e.hydratation;
    if (e.alimentation != null) ali = e.alimentation;
  }
  const s = document.getElementById('ds-sommeil');
  s.value = som;
  onDaySommeil(som);
  try {
    sb.from('entries')
      .select('humeur')
      .eq('user_id', currentUser.id)
      .eq('date', todayStr())
      .limit(1)
      .then(({ data }) => {
        const hv = data && data[0] ? data[0].humeur : null;
        document.querySelectorAll('#ds-mood .mood-btn').forEach((bt, i) => bt.classList.toggle('selected', hv === i + 1));
      });
  } catch (e) {
    console.error('openDaySheet (mood) :', e);
  }
  const h = document.getElementById('ds-hydra');
  h.value = hyd;
  onDayHydra(hyd);
  const a = document.getElementById('ds-alim');
  a.value = ali;
  onDayAlim(ali);
  document.getElementById('day-sheet').classList.add('open');
}

function closeDaySheet() {
  document.getElementById('day-sheet').classList.remove('open');
}

async function saveDay() {
  const sommeil = parseFloat(document.getElementById('ds-sommeil').value);
  const hydratation = parseInt(document.getElementById('ds-hydra').value, 10);
  const alimentation = parseInt(document.getElementById('ds-alim').value, 10);
  showToast('Enregistrement…');
  await updateTodayEntry({ sommeil, hydratation, alimentation });
  closeDaySheet();
  showToast('Journée enregistrée 🌸');
  const { data } = await sb
    .from('entries')
    .select('*')
    .eq('user_id', currentUser.id)
    .eq('date', todayStr())
    .order('created_at', { ascending: true })
    .limit(1);
  renderDayTiles(data && data.length ? data[0] : null);
}

function renderDayTiles(e) {
  const MOOD_EMOJI = ['', '😣', '😕', '😌', '😊', '✨'];
  const set = (id, val, sub) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '<em>' + val + '</em>';
    const s = document.getElementById(id + '-sub');
    if (s && sub != null) s.textContent = sub;
  };
  const PLUS = '<span style="color:var(--accent);">+</span>';
  if (e && e.sommeil != null) set('tile-sommeil', fmtSleep(e.sommeil), "aujourd'hui");
  else set('tile-sommeil', PLUS, '');
  if (e && e.hydratation != null) {
    const n = e.hydratation;
    set('tile-hydra', n + '<span style="font-size:15px;color:var(--muted);"> ' + (n > 1 ? 'verres' : 'verre') + '</span>', "aujourd'hui");
  } else set('tile-hydra', PLUS, '');
  if (e && e.alimentation != null) set('tile-alim', ALIM_LABELS[e.alimentation] || '…', "aujourd'hui");
  else set('tile-alim', PLUS, '');
  if (e && e.humeur) set('tile-humeur', MOOD_EMOJI[e.humeur] || '…', e.humeur_intensite != null ? e.humeur_intensite + '%' : "aujourd'hui");
  else set('tile-humeur', PLUS, '');
}

// ===== Photo du jour =====
async function handlePhoto(input) {
  const f = input.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = (e) => {
    document.getElementById('photo-img').src = e.target.result;
    document.getElementById('photo-empty').classList.add('hidden');
    document.getElementById('photo-display').classList.remove('hidden');
  };
  r.readAsDataURL(f);
  const ext = (f.name.split('.').pop() || 'jpg').toLowerCase();
  await uploadDayPhoto(f, ext);
  input.value = '';
}

// Recharge la photo du jour si elle existe déjà
async function loadTodayPhoto() {
  if (!currentUser) return;
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await sb
    .from('entries')
    .select('photo_path')
    .eq('user_id', currentUser.id)
    .eq('date', today)
    .order('created_at', { ascending: false })
    .limit(1);
  const path = data && data.length ? data[0].photo_path : null;
  const url = path ? await signedPhoto(path) : null;
  const sec = document.getElementById('lea-photo-section');
  if (url) {
    document.getElementById('photo-img').src = url;
    document.getElementById('photo-empty').classList.add('hidden');
    document.getElementById('photo-display').classList.remove('hidden');
    if (sec) sec.style.display = 'block';
  } else {
    document.getElementById('photo-display').classList.add('hidden');
    document.getElementById('photo-empty').classList.remove('hidden');
    if (sec) sec.style.display = 'none';
  }
}

// ===== Petit mot proactif de Léa (1×/jour, doux, jamais culpabilisant) =====
async function loadLeaProactive(e) {
  const line = document.getElementById('lea-proactive-line');
  if (!line) return;
  if (!currentUser) {
    line.textContent = '';
    return;
  }
  let streak = 0;
  try {
    streak = await computeStreak();
  } catch (err) {
    console.error('loadLeaProactive :', err);
  }
  const h = new Date().getHours();
  const done = e && dayComplete(e);
  const hasPhoto = e && e.photo_path;
  const fier = 'fière';
  let msg;
  if (streak > 0 && streak % 7 === 0) {
    msg = 'Waouh, ' + streak + ' jours de rituel · je suis si ' + fier + ' de toi 🌟';
  } else if (done && !hasPhoto) {
    msg = 'Rituel fait, bravo ✨ Une petite photo pour garder une trace ?';
  } else if (done) {
    msg = "Ton rituel est fait pour aujourd'hui, bravo 💛";
  } else if (h < 12) {
    msg = 'Coucou 🌸 Un petit rituel pour bien démarrer la journée ?';
  } else if (h < 18) {
    msg = "Ta peau attend son petit moment rituel aujourd'hui 🌿";
  } else {
    msg = 'Bonsoir 🌙 Un rituel du soir avant de dormir ?';
  }
  line.textContent = msg;
}

// ===== Souvenir : une photo d'il y a un moment =====
async function loadMemory() {
  const sec = document.getElementById('memory-section');
  if (!sec) return;
  sec.style.display = 'none';
  if (!currentUser) return;
  try {
    const lim = new Date();
    lim.setDate(lim.getDate() - 30);
    const { data } = await sb
      .from('entries')
      .select('date,photo_path')
      .eq('user_id', currentUser.id)
      .not('photo_path', 'is', null)
      .lte('date', lim.toISOString().slice(0, 10))
      .order('date', { ascending: false })
      .limit(1);
    const row = (data && data[0]) || null;
    if (!row) return;
    const url = await signedPhoto(row.photo_path);
    if (!url) return;
    const days = Math.round((new Date(todayStr()) - new Date(row.date)) / 86400000);
    document.getElementById('memory-img').src = url;
    document.getElementById('memory-caption').textContent =
      "Cette photo date d'il y a " + days + ' jours · regarde le chemin parcouru 🌸';
    sec.style.display = 'block';
  } catch (e) {
    console.error('loadMemory :', e);
  }
}

// Pont transitoire : ces fonctions sont appelées par les handlers onclick inline de index.html.
window.getTodayEntryId = getTodayEntryId;
window.updateTodayEntry = updateTodayEntry;
window.selectMood = selectMood;
window.onIntensity = onIntensity;
window.saveMood = saveMood;
window.switchPeriod = switchPeriod;
window.toggleRoutine = toggleRoutine;
window.bustStreak = bustStreak;
window.computeStreak = computeStreak;
window.renderStreak = renderStreak;
window.renderPlant = renderPlant;
window.openPlantSheet = openPlantSheet;
window.pickPlant = pickPlant;
window.closePlantSheet = closePlantSheet;
window.plantLockedToast = plantLockedToast;
window.loadHomeData = loadHomeData;
window.takeRestDay = takeRestDay;
window.loadHomeRoutine = loadHomeRoutine;
window.openDaySheet = openDaySheet;
window.closeDaySheet = closeDaySheet;
window.saveDay = saveDay;
window.handlePhoto = handlePhoto;
window.loadTodayPhoto = loadTodayPhoto;
window.loadLeaProactive = loadLeaProactive;
window.loadMemory = loadMemory;
