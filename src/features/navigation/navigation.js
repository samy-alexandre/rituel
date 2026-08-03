// src/features/navigation/navigation.js
// Domaine Navigation : bascule entre écrans, FAB « + », ouverture/fermeture du chat,
// identité du coach (Léa/Léo). Extrait verbatim de public/app.legacy.js.
// Le pont transitoire window.* est conservé pour les handlers onclick inline du HTML.

// ===== Bouton + flottant (FAB) =====
function fabAction() {
  const cur = document.getElementById('app').getAttribute('data-screen');
  if (cur === 'routine') {
    openProductForm();
  } else if (cur === 'ritual') {
    openRituelChemin(
      null,
      (typeof rhActiveTab !== 'undefined' && rhActiveTab) || 'matin'
    );
  }
}

function updateFab(screen) {
  const fab = document.getElementById('fab-add');
  if (!fab) return;
  const cur = screen || document.getElementById('app').getAttribute('data-screen');
  const show = cur === 'routine' || cur === 'ritual'; // + visible sur Produits et Rituel
  fab.classList.toggle('show', show);
}

// ===== Bascule d'écran principale =====
function navTo(screen) {
  const prev = document.getElementById('app').getAttribute('data-screen');
  if (prev && prev !== 'chat') window._lastScreen = prev;
  if (prev === 'ritual' && screen !== 'ritual') closeRituelChemin();
  // sinon l'aperçu reste affiché par-dessus les autres onglets
  document.querySelectorAll('.screen, .chat-screen').forEach((s) => s.classList.remove('active'));
  document.getElementById(screen).classList.add('active');
  if (screen === 'chat') {
    try {
      leaInjectDaily();
    } catch (e) {
      // Douloureux mais non bloquant : le fil de discussion s'affiche quand même
      console.error('leaInjectDaily :', e);
    }
    try {
      refreshChatLock();
    } catch (e) {
      console.error('refreshChatLock :', e);
    }
  }
  document.querySelectorAll('.nav-item').forEach((n) =>
    n.classList.toggle('active', n.dataset.screen === screen)
  );
  document.getElementById('app').setAttribute('data-screen', screen);
  const host = document.getElementById('scroll-host');
  if (host) host.scrollTo(0, 0);
  window.scrollTo(0, 0);
  const bub = document.getElementById('lea-bubble');
  if (bub) bub.style.display = currentUser && screen !== 'chat' ? 'flex' : 'none';
  closeLeaPop();
  updateFab(screen);
  if (screen === 'profile') refreshPremiumUI();
  if (screen === 'ritual') {
    // On propose le créneau du moment, et on synchronise les onglets
    const h = new Date().getHours();
    rpSlotView = h >= 12 ? 'soir' : 'matin';
    document.querySelectorAll('.rt-tab').forEach((b) =>
      b.classList.toggle('sel', b.dataset.m === rpSlotView)
    );
    if (currentUser) cmEnterRitual();
    // affichage immédiat (cache ou léger fondu), jamais la liste derrière
  }
  if (currentUser) {
    if (screen === 'home') {
      loadHomeData();
      loadTodayPhoto();
    } else if (screen === 'routine') {
      loadProducts();
    } else if (screen === 'ritual') {
      loadRitual();
    } else if (screen === 'journal') {
      loadJournalFromDB();
      renderCalendar();
    } else if (screen === 'profile') {
      renderProfileBadges();
    }
  }
}

// ===== Identité du coach =====
function coachName() {
  return 'Léa';
}
function coachTitre() {
  return 'ta compagne de soin';
}
function updateChatIntro() {
  const el = document.getElementById('chat-intro');
  if (!el) return;
  el.textContent =
    "Coucou 🌸 Moi c'est " +
    coachName() +
    ', ' +
    coachTitre() +
    ". Je suis là pour t'aider avec ta peau, tes produits, ta routine… ou juste pour répondre à tes questions, sans jugement. Dis-moi tout, qu'est-ce qui t'amène aujourd'hui ?";
}
function applyCoachIdentity() {
  const nm = coachName();
  const h = document.getElementById('chat-coach-name-text');
  if (h) h.textContent = nm;
  const bub = document.getElementById('lea-bubble');
  if (bub) bub.setAttribute('aria-label', 'Parler à ' + nm);
  const pb = document.getElementById('lea-photo-btn');
  if (pb) pb.textContent = "✨ Demander l'avis de " + nm + ' sur ma photo';
  updateChatIntro();
}

function openChat() {
  refreshChatQuota();
  updateChatIntro();
  navTo('chat');
}
function closeChat() {
  navTo(window._lastScreen || 'home');
}

// Pont transitoire : ces fonctions sont appelées par les handlers onclick inline de index.html.
window.fabAction = fabAction;
window.updateFab = updateFab;
window.navTo = navTo;
window.coachName = coachName;
window.coachTitre = coachTitre;
window.updateChatIntro = updateChatIntro;
window.applyCoachIdentity = applyCoachIdentity;
window.openChat = openChat;
window.closeChat = closeChat;
