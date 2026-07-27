// Toast — notification éphémère. Brique UI transverse et autonome (dépend uniquement du DOM).
let toastTimer;

export function showToast(msg) {
  if (!msg) return;
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}

// Pont transitoire : appelé partout dans le code hérité et une fois en onclick inline.
window.showToast = showToast;
