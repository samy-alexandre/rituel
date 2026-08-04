// ui/overlay.js — fermeture au tap en dehors d'une fenêtre (.sheet-overlay ouverte). Extrait de
// app.legacy.js (Phase B). Appels hérités : stopBcCamera/tlStop/camStop (globales). Aucune const.
document.addEventListener('click', (e) => {
  const t = e.target;
  if (t && t.classList && t.classList.contains('sheet-overlay') && t.classList.contains('open')) {
    t.classList.remove('open');
    try {
      stopBcCamera();
    } catch (_e) {
      console.error('catch silencieux (app.legacy.js):', _e);
    }
    try {
      tlStop();
    } catch (_e) {
      console.error('catch silencieux (app.legacy.js):', _e);
    }
    try {
      camStop();
    } catch (_e) {
      console.error('catch silencieux (app.legacy.js):', _e);
    }
  }
});
