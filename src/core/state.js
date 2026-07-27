// État partagé transitoire (Phase B de la migration — voir docs/ARCHITECTURE-CIBLE.md).
//
// currentUser / state / chDraft sont référencés des centaines de fois dans le code hérité
// (script classique) ET seront lus/écrits par les modules extraits. Pour partager la MÊME
// donnée sans réécrire ces ~400 références d'un coup, on les expose en PROPRIÉTÉS de l'objet
// global : un identifiant nu `currentUser` (lecture comme écriture) s'y résout aussi bien en
// mode strict que non-strict, du moment que la propriété existe avant tout accès — d'où
// l'initialisation ici, importée avant le code hérité.
//
// Cible finale : un véritable store observable dans core/. Ceci est le pont qui permet d'y
// arriver progressivement.
window.currentUser = window.currentUser ?? null;
window.isPremium = window.isPremium ?? false;
window.premiumUntil = window.premiumUntil ?? null;
window.premiumCancel = window.premiumCancel ?? false;

window.chDraft = window.chDraft ?? null;
window.state = window.state ?? {
  skinType: null,
  concerns: [],
  goal: null,
  name: '',
  email: '',
  genre: null,
  coachGenre: 'femme',
  onbStep: 0,
};
