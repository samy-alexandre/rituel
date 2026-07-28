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

// Moment courant de l'accueil (matin / soir / hebdo) — état partagé lu par le domaine
// Voyage (module) et écrit par switchPeriod (hérité), qui le met en miroir ici.
window.currentPeriod = window.currentPeriod ?? 'matin';

// Filtre catégorie et tri de la liste produits — état partagé lu par le rendu du carnet
// (modules) et écrit par les contrôles de tri/filtre (hérité). Promu ici pour une source
// unique ; les lectures/écritures en identifiant nu du code hérité s'y résolvent (non-strict).
window.productCatFilter = window.productCatFilter ?? 'all';
window.productSort = window.productSort ?? 'cat';

// État de vue du cœur rituel — créneau/onglet affiché (matin/soir/hebdo), vue routine,
// et forçage de l'écran d'accueil de création. Partagé entre la liste produits, l'éditeur
// de rituel et le domaine cm (chemin + panneau fleur). Promu ici pour une source unique ;
// les lectures/écritures en identifiant nu du code hérité s'y résolvent (script non-strict).
window.rpSlotView = window.rpSlotView ?? 'matin';
window.rpForceWelcome = window.rpForceWelcome ?? false;
window.currentRoutineView = window.currentRoutineView ?? 'matin';

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
