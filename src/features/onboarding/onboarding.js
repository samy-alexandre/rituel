// Domaine « Onboarding » — parcours d'accueil (étapes, choix type de peau/objectifs, premiers
// produits) jusqu'à l'entrée dans l'app. Extrait de app.legacy.js (Phase B), déplacé VERBATIM.
// État privé : onbProducts. L'étape courante vit sur `state` partagé (state.onbStep). Deps
// héritées (state, enterApp, saveProfile, sb, currentUser, showToast) : globales window.

// ===== Onboarding =====
function onbShow(n) {
  // Sauter la page genre (4) si déjà renseigné à l'inscription
  if (n === 4 && state.genre) {
    n = state.onbStep < 4 ? 5 : 3;
  }
  state.onbStep = n;
  if (n === 6) {
    document.getElementById('onb-name').textContent = state.name ? ', ' + state.name : '';
  }
  document.querySelectorAll('.onb-page').forEach((p) => p.classList.remove('active'));
  const pg = document.querySelector(`.onb-page[data-page="${n}"]`);
  if (pg) pg.classList.add('active');
  window.scrollTo(0, 0);
}
function onbNext() {
  onbShow(state.onbStep + 1);
}
function onbBack() {
  if (state.onbStep > 0) onbShow(state.onbStep - 1);
}
function toggleOpt(el, key) {
  el.parentElement.querySelectorAll('.onb-opt').forEach((o) => o.classList.remove('selected'));
  el.classList.add('selected');
  state[key] = el.dataset.value;
  if (key === 'skinType') document.getElementById('btn-step1').disabled = false;
  if (key === 'goal') document.getElementById('btn-step3').disabled = false;
  if (key === 'genre') {
    document.getElementById('btn-step4').disabled = false;
  }
}
function toggleOptMulti(el, key) {
  el.classList.toggle('selected');
  const v = el.dataset.value;
  if (el.classList.contains('selected')) {
    if (!state[key].includes(v)) state[key].push(v);
  } else state[key] = state[key].filter((x) => x !== v);
}
let onbProducts = [];
function onbAddProduct() {
  const inp = document.getElementById('onb-prod-input');
  const br = document.getElementById('onb-brand-input');
  if (!inp || !br) return;
  const cap = function (s) {
    if (!s) return '';
    s = s.trim();
    return s.charAt(0).toUpperCase() + s.slice(1);
  };
  const nom = inp.value.trim();
  const marque = br.value.trim();
  if (!nom) {
    inp.focus();
    return;
  }
  if (!marque) {
    showToast('Ajoute aussi la marque 🌸');
    br.focus();
    return;
  }
  onbProducts.push({ nom: cap(nom), marque: cap(marque) });
  inp.value = '';
  br.value = '';
  renderOnbProducts();
  inp.focus();
}
function onbRemoveProduct(i) {
  onbProducts.splice(i, 1);
  renderOnbProducts();
}
function renderOnbProducts() {
  const el = document.getElementById('onb-prod-list');
  if (!el) return;
  el.innerHTML = onbProducts
    .map(
      (p, i) =>
        '<div style="display:flex;align-items:center;justify-content:space-between;background:var(--surface-warm);border-radius:12px;padding:10px 14px;font-size:14px;"><span>🧴 ' +
        escapeHtml(p.nom) +
        (p.marque
          ? ' <span style="color:var(--muted);font-size:12px;">· ' +
            escapeHtml(p.marque) +
            '</span>'
          : '') +
        '</span><button onclick="onbRemoveProduct(' +
        i +
        ')" style="background:none;border:none;color:var(--muted);font-size:18px;cursor:pointer;line-height:1;">×</button></div>'
    )
    .join('');
}
async function finishOnboarding() {
  const btn = document.querySelector('.onb-page[data-page="6"] .btn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Un instant…';
  }
  await saveProfile();
  if (onbProducts.length && currentUser) {
    const rows = onbProducts.map((p, idx) => ({
      user_id: currentUser.id,
      moment: 'matin',
      position: idx,
      nom: p.marque ? p.nom + ' · ' + p.marque : p.nom,
      emoji: '🧴',
      in_matin: true,
      in_soir: true,
    }));
    try {
      await sb.from('products').insert(rows);
    } catch (e) {}
  }
  // filet de sécurité : on mémorise localement que l'onboarding est fait
  try {
    localStorage.setItem(
      'rituel_profile_' + currentUser.id,
      JSON.stringify({
        prenom: state.name,
        type_peau: state.skinType,
        objectifs: { concerns: state.concerns || [], goal: state.goal || null },
      })
    );
  } catch (e) {}
  document.getElementById('onboarding').classList.remove('active');
  enterApp();
}

// Pont transitoire : onclick inline (pages d'onboarding) + appels hérités. Résolution window.
Object.assign(window, {
  onbShow,
  onbNext,
  onbBack,
  toggleOpt,
  toggleOptMulti,
  onbAddProduct,
  onbRemoveProduct,
  renderOnbProducts,
  finishOnboarding,
});
