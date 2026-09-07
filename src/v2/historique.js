// LA MEMOIRE.
//
// C'est la seule chose que l'abonnement vend vraiment : savoir ce que la peau
// a recu, et depuis combien de temps. La garder dans le navigateur revenait a
// vendre une memoire qui disparait au changement de telephone.
//
// Cette couche ecrit donc SUR LE SERVEUR quand la table existe, et retombe sur
// le stockage local sinon - sans jamais perdre ce qui a deja ete note. La
// bascule se fait toute seule le jour ou la table est creee : voir
// docs/migration-historique.sql, cinq lignes a coller dans Supabase.
//
// Regle de fusion : le serveur et le local peuvent tous deux avoir des jours
// que l'autre ignore (une session hors ligne, un autre appareil). On garde
// TOUJOURS l'union des deux, jamais l'un a la place de l'autre - perdre une
// application de retinol fausse le conseil du lendemain.

import { sb } from '../core/supabase.js';

const TABLE = 'historique_actifs';
let serveurDisponible = null; // null = pas encore teste

function cleLocale(userId) {
  return `rituel.v2.historique.${userId || 'anon'}`;
}

function lireLocal(userId) {
  try {
    const brut = localStorage.getItem(cleLocale(userId));
    const lu = brut ? JSON.parse(brut) : [];
    return Array.isArray(lu) ? lu : [];
  } catch {
    return [];
  }
}

function ecrireLocal(userId, liste) {
  try {
    localStorage.setItem(cleLocale(userId), JSON.stringify(liste.slice(-180)));
  } catch {
    /* navigation privee : le conseil du jour reste juste, seule la memoire manque */
  }
}

const cle = (t) => `${t.date}|${t.moment}`;

function fusionner(a, b) {
  const par = new Map();
  for (const t of [...a, ...b]) {
    if (t && t.date && t.moment) par.set(cle(t), t);
  }
  return [...par.values()].sort((x, y) => (x.date < y.date ? -1 : 1));
}

/**
 * Lit la memoire complete, serveur et local reunis.
 * @param {string} userId
 */
export async function lireHistorique(userId) {
  const local = lireLocal(userId);
  if (!userId || serveurDisponible === false) return local;

  try {
    const { data, error } = await sb
      .from(TABLE)
      .select('date,moment,actifs')
      .eq('user_id', userId)
      .order('date', { ascending: true })
      .limit(400);
    if (error) throw error;
    serveurDisponible = true;
    const distant = (data || []).map((l) => ({
      date: l.date,
      moment: l.moment,
      actifs: Array.isArray(l.actifs) ? l.actifs : [],
    }));
    const tout = fusionner(distant, local);
    // On renvoie au serveur ce qu'il ignorait : une session hors ligne ne doit
    // pas rester prisonniere de l'appareil ou elle a eu lieu.
    const connus = new Set(distant.map(cle));
    const aPousser = tout.filter((t) => !connus.has(cle(t)));
    if (aPousser.length) void pousser(userId, aPousser);
    ecrireLocal(userId, tout);
    return tout;
  } catch {
    // Table absente, hors ligne, ou droits refuses : le local suffit a decider.
    serveurDisponible = false;
    return local;
  }
}

async function pousser(userId, traces) {
  const lignes = traces.map((t) => ({
    user_id: userId,
    date: t.date,
    moment: t.moment,
    actifs: t.actifs || [],
  }));
  const { error } = await sb.from(TABLE).upsert(lignes, { onConflict: 'user_id,date,moment' });
  if (error) serveurDisponible = false;
}

/**
 * Note ce qui vient d'etre applique. Ecrit en local tout de suite - le conseil
 * de demain ne doit pas dependre d'un aller-retour reseau - puis pousse au
 * serveur sans bloquer l'interface.
 */
export async function consigner(userId, trace) {
  const liste = fusionner(lireLocal(userId), [trace]);
  ecrireLocal(userId, liste);
  if (userId && serveurDisponible !== false) {
    try {
      await pousser(userId, [trace]);
    } catch {
      serveurDisponible = false;
    }
  }
  return liste;
}

/** Depuis combien de jours cette personne tient son rituel. */
export function profondeur(liste) {
  if (!liste.length) return 0;
  const plusVieux = liste.reduce((a, b) => (a.date < b.date ? a : b));
  return Math.round((Date.now() - new Date(plusVieux.date)) / 86400000);
}

/** L'etat de la synchronisation, pour le dire honnetement dans l'interface. */
export function synchronise() {
  return serveurDisponible === true;
}
