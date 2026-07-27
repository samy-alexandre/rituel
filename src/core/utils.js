// Utilitaires transverses, purs (aucune dépendance à l'état applicatif).

// Échappe le HTML pour une insertion sûre dans une chaîne de markup.
export function escapeHtml(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Charge un script externe à la demande (idempotent). Utilisé pour les libs lourdes
// et optionnelles (ex. jsPDF), afin de ne pas peser sur le premier chargement mobile.
export function loadScript(src) {
  return new Promise((res, rej) => {
    if (document.querySelector('script[data-src="' + src + '"]')) {
      res();
      return;
    }
    const s = document.createElement('script');
    s.src = src;
    s.setAttribute('data-src', src);
    s.onload = () => res();
    s.onerror = () => rej(new Error('load fail'));
    document.head.appendChild(s);
  });
}

// Date du jour au format ISO court (YYYY-MM-DD), en heure locale du navigateur.
export function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// Zéro-padding sur deux chiffres (9 → "09").
export function pad2(n) {
  return n < 10 ? '0' + n : '' + n;
}

// Validation d'adresse e-mail (suffisante pour un contrôle de formulaire côté client).
export function validEmail(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

// Pont transitoire : le code hérité appelle ces fonctions en identifiant nu.
window.escapeHtml = escapeHtml;
window.loadScript = loadScript;
window.todayStr = todayStr;
window.pad2 = pad2;
window.validEmail = validEmail;
