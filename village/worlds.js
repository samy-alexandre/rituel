/* ------------------------------------------------------------------
   worlds.js — les mondes
   ------------------------------------------------------------------
   Un monde, c'est l'univers : le ciel, la lumière, la matière, la
   saison. Il ne connaît AUCUNE étape et AUCUN produit.

   C'est la deuxième moitié de l'équation :

        rendu = parcours (l'itinéraire)  ×  monde (l'atmosphère)

   Les deux sont indépendants. Trois parcours et cinq mondes donnent
   quinze rendus à partir de huit fichiers — pas quinze fichiers.
   Ajouter Noël ne touche ni au moteur, ni aux parcours, ni aux étapes.

   ------------------------------------------------------------------
   Champs réservés
   ------------------------------------------------------------------
   ambient, weather, soundtrack et animations sont DÉCLARÉS mais pas
   implémentés. Une clé qui vaut null ne coûte rien ; un moteur météo
   écrit aujourd'hui pour une fonctionnalité de l'an prochain, si.
   Le schéma est prêt, la machinerie viendra quand la fonctionnalité
   sera décidée.
   ------------------------------------------------------------------ */

export const WORLDS = {

  aube: {
    label: 'Aube',
    bg: { src: 'img/matin.webp', ratio: 1024 / 1536 },

    // Palette réelle des illustrations. Sert aussi à dessiner la scène
    // de substitution tant que les images ne sont pas branchées.
    palette: {
      cielHaut:  '#F6E7D2',
      cielBas:   '#F7F1EA',
      halo:      '#FFE0A8',
      haloVif:   '#FBB56E',
      relief:    '#E6DBC7',
      prairie:   '#E7DFC9',
      feuillage: '#A9BE97',
      chemin:    '#E8D4AC',
      encre:     '#6B5B45'
    },

    lighting: { mode: 'jour', glow: null },

    skins: {},      // remplacements d'illustrations : { lavoir: 'img/bld/ete/lavoir.webp' }
    overrides: {},  // retouches de placement : { phare: { w: 0.11 } }
    decor: [],      // éléments non interactifs : { art, x, y, w }

    ambient: null, weather: null, soundtrack: null, animations: null
  },

  crepuscule: {
    label: 'Crépuscule',
    bg: { src: 'img/soir.webp', ratio: 1024 / 1536 },

    palette: {
      cielHaut:  '#5B4A6E',
      cielBas:   '#E9A079',
      halo:      '#B56E7B',
      haloVif:   '#E9A079',
      relief:    '#7C5A73',
      prairie:   '#4E3F52',
      feuillage: '#5C6B58',
      chemin:    '#E8CBAE',
      encre:     '#F0E4D4'
    },

    // Les fenêtres s'allument. Le moteur pose un halo derrière chaque
    // bâtiment, l'apparence est entièrement en CSS.
    lighting: {
      mode: 'nuit',
      glow: { color: '#FFC98A', spread: 0.42, opacity: 0.55 }
    },

    skins: {}, overrides: {}, decor: [],
    ambient: null, weather: null, soundtrack: null, animations: null
  },

  voile: {
    label: 'Jour voilé',
    bg: { src: 'img/hebdo.webp', ratio: 1024 / 1536 },

    palette: {
      cielHaut:  '#CDE0D2',
      cielBas:   '#EBD8C6',
      halo:      '#E7E0D0',
      haloVif:   '#E7E0D0',
      relief:    '#B6C7A9',
      prairie:   '#D3D8C4',
      feuillage: '#9AAE8C',
      chemin:    '#D8C09B',
      encre:     '#5F6152'
    },

    lighting: { mode: 'jour', glow: null },
    skins: {}, overrides: {}, decor: [],
    ambient: null, weather: null, soundtrack: null, animations: null
  },

  // ------------------------------------------------------------------
  // Démonstration : voilà tout ce que coûte un monde saisonnier.
  // Aucun autre fichier n'est touché. Non branché dans l'app.
  // ------------------------------------------------------------------
  noel: {
    extends: 'aube',
    label: 'Noël',
    bg: { src: 'img/matin-noel.webp', ratio: 1024 / 1536 },
    palette: { cielHaut: '#DCE6F0', cielBas: '#F2EFEA', feuillage: '#8FA894' },
    lighting: { mode: 'jour', glow: { color: '#FFD9A0', spread: 0.30, opacity: 0.40 } },
    skins:  { serre: 'img/bld/noel/serre.webp' },
    decor:  [{ art: 'img/decor/sapin.webp', x: 0.16, y: 0.60, w: 0.09 }],
    weather: { type: 'neige', density: 0.3 }   // réservé, non rendu
  }
};

/** Applique extends et renvoie un monde complet. */
export function resolveWorld(id) {
  const raw = WORLDS[id];
  if (!raw) return null;

  const base = raw.extends ? resolveWorld(raw.extends) : {};
  const merged = { ...base, ...raw, id };
  delete merged.extends;

  merged.palette   = { ...(base.palette || {}),   ...(raw.palette || {}) };
  merged.skins     = { ...(base.skins || {}),     ...(raw.skins || {}) };
  merged.overrides = { ...(base.overrides || {}), ...(raw.overrides || {}) };
  merged.decor     = raw.decor || base.decor || [];

  return merged;
}
