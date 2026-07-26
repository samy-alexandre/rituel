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

// Pont transitoire : le code hérité appelle ces fonctions en identifiant nu.
window.escapeHtml = escapeHtml;
window.loadScript = loadScript;
