// Domaine « Quiz type de peau » — questionnaire dermato court qui déduit le type de peau
// (+ sensibilité) et l'applique au profil ou à l'onboarding. Extrait de app.legacy.js
// (Phase B), déplacé VERBATIM (octets identiques ; indentation héritée conservée).
// État privé au module : quizStep, quizAns, quizCtx. Le barème QUIZ (propre au quiz) migre
// avec le module. Dépendances héritées lues en identifiant nu, résolues via l'objet global :
//  - SKIN_TYPES : constante PARTAGÉE (profil/onboarding) laissée dans app.legacy.js et exposée
//    sur window (window.SKIN_TYPES) ;
//  - state : état partagé (core/state.js) ; showToast, pickSkin : globales.

// ===== Quizz type de peau (base dermato : type = sébum/sécheresse, sensibilité à part) =====
const QUIZ = [
  {
    q: "3-4h après t'être lavé le visage (sans rien appliquer), ta peau…",
    opts: [
      { l: 'Tiraille, un peu rêche', t: 'seche' },
      { l: 'Brille un peu partout', t: 'grasse' },
      { l: 'Brille sur le front/nez/menton, normale ailleurs', t: 'mixte' },
      { l: 'Est confortable, équilibrée', t: 'normale' },
    ],
  },
  {
    q: 'Tes pores sont plutôt…',
    opts: [
      { l: 'Quasi invisibles', t: 'seche' },
      { l: 'Visibles sur le nez / le front', t: 'mixte' },
      { l: 'Dilatés un peu partout', t: 'grasse' },
      { l: 'Peu visibles', t: 'normale' },
    ],
  },
  {
    q: 'En milieu de journée, ton front et ton nez…',
    opts: [
      { l: 'Restent mats', t: 'normale' },
      { l: 'Deviennent brillants un peu partout', t: 'grasse' },
      { l: 'Brillent seulement sur la zone T', t: 'mixte' },
      { l: 'Tiraillent, inconfort', t: 'seche' },
    ],
  },
  {
    q: "Tiraillements ou peau qui pèle, c'est…",
    opts: [
      { l: 'Souvent', t: 'seche' },
      { l: 'De temps en temps', t: 'mixte' },
      { l: 'Rarement / jamais', t: 'normale' },
    ],
  },
  {
    q: 'Face à un nouveau produit, au froid ou au parfum, ta peau…',
    opts: [
      { l: 'Rougit / picote facilement', t: null, sens: 2 },
      { l: 'Réagit un peu, parfois', t: null, sens: 1 },
      { l: 'Tolère bien, aucun souci', t: 'normale', sens: 0 },
    ],
  },
  {
    q: 'Boutons / imperfections ?',
    opts: [
      { l: 'Fréquents', t: 'grasse' },
      { l: 'Occasionnels', t: 'mixte' },
      { l: 'Rares', t: 'normale' },
    ],
  },
];
let quizStep = 0,
  quizAns = [],
  quizCtx = 'profile';
function openQuiz(ctx) {
  quizCtx = ctx || 'profile';
  quizStep = 0;
  quizAns = [];
  renderQuiz();
  document.getElementById('quiz-sheet').classList.add('open');
}
function closeQuiz() {
  document.getElementById('quiz-sheet').classList.remove('open');
}
function quizPick(i) {
  quizAns[quizStep] = QUIZ[quizStep].opts[i];
  quizStep++;
  renderQuiz();
}
function quizBack() {
  if (quizStep > 0) {
    quizStep--;
    renderQuiz();
  }
}
function quizResult() {
  const sc = { seche: 0, grasse: 0, mixte: 0, normale: 0 };
  let sens = 0;
  quizAns.forEach((o) => {
    if (o) {
      if (o.t && sc[o.t] != null) sc[o.t]++;
      if (o.sens != null) sens = Math.max(sens, o.sens);
    }
  });
  const order = ['mixte', 'grasse', 'seche', 'normale'];
  let best = order[0];
  order.forEach((t) => {
    if (sc[t] > sc[best]) best = t;
  });
  if (sens >= 2) best = 'sensible';
  return { type: best, sens };
}
function renderQuiz() {
  const body = document.getElementById('quiz-body');
  if (!body) return;
  if (quizStep < QUIZ.length) {
    const Q = QUIZ[quizStep];
    body.innerHTML =
      '<div class="onb-progress" style="margin-bottom:18px;">' +
      QUIZ.map((_, k) => '<div class="onb-dot' + (k < quizStep ? ' done' : '') + '"></div>').join(
        ''
      ) +
      '</div>' +
      '<h2 class="onb-title" style="font-size:20px;">' +
      Q.q +
      '</h2>' +
      '<div class="onb-options" style="margin-top:16px;">' +
      Q.opts
        .map(
          (o, i) =>
            '<button class="onb-opt" onclick="quizPick(' +
            i +
            ')"><div class="onb-opt-text"><div class="onb-opt-title">' +
            o.l +
            '</div></div><div class="onb-opt-check"></div></button>'
        )
        .join('') +
      '</div>' +
      (quizStep > 0
        ? '<button class="btn btn-ghost" style="margin-top:6px;" onclick="quizBack()">← Précédent</button>'
        : '');
  } else {
    const r = quizResult();
    const meta = SKIN_TYPES.find((s) => s[0] === r.type) || ['normale', '🌿', 'Normale'];
    const sensLine =
      r.sens >= 1 && r.type !== 'sensible'
        ? '<p style="color:var(--ink-soft);font-size:13px;margin-top:8px;line-height:1.5;">Ta peau a aussi l\'air réactive · pense à privilégier des produits doux 🌸</p>'
        : '';
    body.innerHTML =
      '<div style="text-align:center;padding:6px 0 2px;">' +
      '<div style="font-size:52px;">' +
      meta[1] +
      '</div>' +
      '<div class="eyebrow" style="margin-top:6px;">Ton résultat</div>' +
      '<h2 class="display" style="font-size:30px;margin:6px 0;">Peau <em class="italic" style="color:var(--accent);">' +
      meta[2].toLowerCase() +
      '</em></h2>' +
      sensLine +
      '</div>' +
      '<button class="btn btn-accent" style="margin-top:16px;" onclick="quizApply()">Garder ce résultat</button>' +
      '<button class="btn btn-ghost" style="margin-top:8px;" onclick="openQuiz(quizCtx)">Refaire le test</button>';
  }
}
function quizApply() {
  const r = quizResult();
  if (quizCtx === 'onboarding') {
    state.skinType = r.type;
    const page = document.querySelector('.onb-page[data-page="1"]');
    if (page) {
      page
        .querySelectorAll('.onb-opt')
        .forEach((o) => o.classList.toggle('selected', o.dataset.value === r.type));
    }
    const btn = document.getElementById('btn-step1');
    if (btn) btn.disabled = false;
    closeQuiz();
    showToast(
      'Type de peau : ' +
        (SKIN_TYPES.find((s) => s[0] === r.type) || ['', '', 'peau'])[2].toLowerCase() +
        ' 🌸'
    );
  } else {
    if (document.getElementById('skin-type-opts')) {
      pickSkin(r.type);
    }
    closeQuiz();
    showToast('Résultat appliqué · pense à enregistrer 🌸');
  }
}

// Pont transitoire : invoquées par des handlers onclick inline (index.html + HTML généré).
Object.assign(window, {
  openQuiz,
  closeQuiz,
  quizPick,
  quizBack,
  quizResult,
  renderQuiz,
  quizApply,
});
