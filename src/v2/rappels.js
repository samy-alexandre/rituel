// LES RAPPELS.
//
// Une application de rituel quotidien qui ne rappelle rien se fait desinstaller
// en une semaine, et aucun paywall ne sauve ca. C'est le levier de retention le
// plus evident du produit, et toute l'infrastructure existait deja dans le
// depot sans que rien ne l'appelle.
//
// LE MOMENT DE LA DEMANDE EST TOUT. Une autorisation de notification demandee
// a l'ouverture est refusee par reflexe, et un refus est DEFINITIF - le
// navigateur ne repose plus jamais la question. On ne la demande donc qu'apres
// un premier chemin termine : a ce moment-la, la personne sait ce que
// l'application lui apporte, et le rappel a un sens pour elle.

const CLE_DEMANDE = 'rituel.v2.rappels.demande';

function base64VersOctets(base64) {
  const complet = (base64 + '='.repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, '+').replace(/_/g, '/');
  const brut = atob(complet);
  return Uint8Array.from([...brut].map((c) => c.charCodeAt(0)));
}

export function rappelsPossibles() {
  return typeof Notification !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window;
}

/** Deja repondu, dans un sens ou dans l'autre : on ne redemande jamais. */
export function dejaDemande() {
  if (!rappelsPossibles()) return true;
  if (Notification.permission !== 'default') return true;
  try {
    return localStorage.getItem(CLE_DEMANDE) === 'oui';
  } catch {
    return false;
  }
}

export async function enregistrerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js');
  } catch {
    return null; // en developpement sur certains navigateurs, sans consequence
  }
}

/**
 * Demande l'autorisation puis abonne. Rend true si les rappels sont actifs.
 * N'appeler qu'apres une vraie reussite dans l'application.
 */
export async function activerRappels(userId) {
  if (!rappelsPossibles()) return false;
  try {
    localStorage.setItem(CLE_DEMANDE, 'oui');
  } catch { /* sans stockage on pourrait redemander une fois, tant pis */ }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return false;

  const reponse = await fetch('/api/push');
  const { publicKey } = await reponse.json();
  if (!publicKey) return false;

  const sw = await navigator.serviceWorker.ready;
  const abonnement = await sw.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: base64VersOctets(publicKey),
  });

  const brut = abonnement.toJSON();
  await fetch('/api/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'subscribe',
      endpoint: brut.endpoint,
      p256dh: brut.keys.p256dh,
      auth: brut.keys.auth,
      user_id: userId || null,
      // Le fuseau, pour que le rappel du soir tombe le soir de la personne et
      // pas celui du serveur.
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
    }),
  });

  return true;
}
