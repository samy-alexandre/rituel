// src/features/profile/profile.js
// Domaine Profil : chargement/application/sauvegarde du profil utilisateur + profil de peau.
// Extrait verbatim de public/app.legacy.js.
// Le pont transitoire window.* est conservé pour les handlers onclick inline du HTML.

// ===== Profil (table profiles) =====
async function loadProfile() {
  if (!currentUser) return null;
  const { data } = await sb.from('profiles').select('*').eq('id', currentUser.id).maybeSingle();
  return data;
}
function applyProfile(p) {
  if (!p) return;
  isPremium = !!p.is_premium;
  premiumUntil = p.premium_until || null;
  premiumCancel = !!p.premium_cancel;
  refreshPremiumUI();
  if (p.prenom) state.name = p.prenom;
  if (p.type_peau) state.skinType = p.type_peau;
  if (p.objectifs) {
    try {
      const o = JSON.parse(p.objectifs);
      if (Array.isArray(o)) {
        state.concerns = o;
      } else {
        state.concerns = o.concerns || [];
        state.goal = o.goal || null;
        state.age = o.age || null;
      }
    } catch (e) {
      state.concerns = [];
    }
  }
  state.rituelType = p.rituel_type || state.rituelType || 'both';
  if (p.genre) state.genre = p.genre;
  state.coachGenre = 'femme';  state.cycleEnabled = !!p.cycle_enabled;
  state.cycleLastStart = p.cycle_last_start || null;
  state.cycleLength = p.cycle_length || 28;
  if (typeof window.updateCycleMenuMeta === 'function') window.updateCycleMenuMeta();
  applyCoachIdentity();
  state.email = currentUser ? currentUser.email : '';
}
async function saveProfile() {
  if (!currentUser) return;
  const { error } = await sb.from('profiles').upsert({
    id: currentUser.id,
    prenom: state.name,
    type_peau: state.skinType,
    objectifs: JSON.stringify({ concerns: state.concerns || [], goal: state.goal || null, age: state.age || null }),
    genre: state.genre,
    coach_genre: state.coachGenre || 'femme',
  });
  if (error) console.warn('saveProfile:', error.message);
}

// ===== Profil : badges + édition de la peau =====
const SKIN_LABELS = {
  seche: 'Peau sèche',
  mixte: 'Peau mixte',
  grasse: 'Peau grasse',
  sensible: 'Peau sensible',
  normale: 'Peau normale',
};
const CONCERN_LABELS = {
  acne: 'Acné',
  taches: 'Taches',
  rides: 'Rides',
  eclat: 'Éclat',
  pores: 'Pores',
  cernes: 'Cernes',
};
window.SKIN_LABELS = SKIN_LABELS; // partagés (ex. contexte chat)
window.CONCERN_LABELS = CONCERN_LABELS;
const SKIN_TYPES = [
  ['seche', '🌾', 'Sèche'],
  ['mixte', '🍯', 'Mixte'],
  ['grasse', '✨', 'Grasse'],
  ['sensible', '🌸', 'Sensible'],
  ['normale', '🌿', 'Normale'],
];
window.SKIN_TYPES = SKIN_TYPES; // partagée avec le module Quiz (lecture via window)
const CONCERNS = [
  ['acne', '🌷', 'Acné, imperfections'],
  ['taches', '🍃', 'Taches, pigmentation'],
  ['rides', '🌹', 'Rides, fermeté'],
  ['eclat', '💫', 'Éclat, teint terne'],
  ['pores', '🌼', 'Pores dilatés'],
  ['cernes', '👁️', 'Cernes'],
];

async function renderProfileBadges() {
  const el = document.getElementById('profile-badges');
  if (!el) return;
  let html = '';
  if (state.skinType) html += `<span class="badge">${SKIN_LABELS[state.skinType] || 'Peau'}</span>`;
  (state.concerns || []).forEach((c) => {
    if (CONCERN_LABELS[c]) html += `<span class="badge">${CONCERN_LABELS[c]}</span>`;
  });
  const n = currentUser ? await computeStreak() : 0;
  html += `<span class="badge-accent badge">${n > 0 ? ('🔥 Série ' + n + ' j') : '🌱 Pas encore de série'}</span>`;
  el.innerHTML = html;
}

let tmpSkin = null,
  tmpConcerns = [];
function openSkinSheet() {
  tmpSkin = state.skinType;
  tmpConcerns = [...(state.concerns || [])];
  renderSkinOpts();
  document.getElementById('skin-sheet').classList.add('open');
}
function renderSkinOpts() {
  document.getElementById('skin-type-opts').innerHTML = SKIN_TYPES.map(
    ([v, e, l]) =>
      `<button class="onb-opt${tmpSkin === v ? ' selected' : ''}" onclick="pickSkin('${v}')"><span class="onb-opt-emoji">${e}</span><div class="onb-opt-text"><div class="onb-opt-title">${l}</div></div><div class="onb-opt-check"></div></button>`
  ).join('');
  document.getElementById('skin-concern-opts').innerHTML = CONCERNS.map(
    ([v, e, l]) =>
      `<button class="onb-opt${tmpConcerns.includes(v) ? ' selected' : ''}" onclick="toggleConcern('${v}')"><span class="onb-opt-emoji">${e}</span><div class="onb-opt-text"><div class="onb-opt-title">${l}</div></div><div class="onb-opt-check"></div></button>`
  ).join('');
}
function pickSkin(v) {
  tmpSkin = v;
  renderSkinOpts();
}
function toggleConcern(v) {
  tmpConcerns = tmpConcerns.includes(v) ? tmpConcerns.filter((x) => x !== v) : [...tmpConcerns, v];
  renderSkinOpts();
}
function closeSkinSheet() {
  document.getElementById('skin-sheet').classList.remove('open');
}

async function saveSkinProfile() {
  if (!tmpSkin) {
    showToast('Choisis un type de peau');
    return;
  }
  state.skinType = tmpSkin;
  state.concerns = tmpConcerns;
  await saveProfile();
  try {
    localStorage.setItem(
      'rituel_profile_' + currentUser.id,
      JSON.stringify({ prenom: state.name, type_peau: state.skinType, objectifs: { concerns: state.concerns || [], goal: state.goal || null } })
    );
  } catch (e) {
    console.error('catch silencieux (app.legacy.js):', e);
  }
  closeSkinSheet();
  renderProfileBadges();
  showToast('Profil peau mis à jour 🌸');
}

// Pont transitoire : ces fonctions sont appelées par les handlers onclick inline de index.html.
window.loadProfile = loadProfile;
window.applyProfile = applyProfile;
window.saveProfile = saveProfile;
window.renderProfileBadges = renderProfileBadges;
window.saveSkinProfile = saveSkinProfile;
window.openSkinSheet = openSkinSheet;
window.closeSkinSheet = closeSkinSheet;
window.renderSkinOpts = renderSkinOpts;
window.pickSkin = pickSkin;
window.toggleConcern = toggleConcern;
