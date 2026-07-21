/* ------------------------------------------------------------------
   buildings.js — catalogue graphique des bâtiments
   ------------------------------------------------------------------
   Un bâtiment est UNIQUEMENT une illustration.
   Il ne sait pas où il est, ni à quelle taille, ni dans quel parcours.
   C'est la composition (parcours.js) qui en décide.

   Conséquence voulue : une même illustration se réutilise partout.
   ------------------------------------------------------------------

   ratio   largeur / hauteur de l'image détourée. Sert à réserver la
           place avant chargement — évite le saut de mise en page.
   anchor  point de l'image qui touche le sol, en fraction de l'image.
           [0.5, 1] = bas-centre. À ajuster si le sprite est de biais.
   tint    couleur du bloc de substitution tant que l'asset manque.
   ------------------------------------------------------------------ */

export const BUILDINGS = {
  portail: {
    label: 'Portail de sentier',
    src: 'img/bld/portail.webp',
    ratio: 1.30, anchor: [0.5, 1], tint: '#B99A6B'
  },
  cabane: {
    label: 'Cabane-vestiaire',
    src: 'img/bld/cabane.webp',
    ratio: 1.05, anchor: [0.5, 1], tint: '#C9AE85'
  },
  lavoir: {
    label: 'Lavoir de pierre',
    src: 'img/bld/lavoir.webp',
    ratio: 1.15, anchor: [0.5, 1], tint: '#AEB4A6'
  },
  pavillon: {
    label: 'Pavillon à colonnes',
    src: 'img/bld/pavillon.webp',
    ratio: 1.00, anchor: [0.5, 1], tint: '#D2CBBD'
  },
  apothicaire: {
    label: 'Échoppe d\u2019apothicaire',
    src: 'img/bld/apothicaire.webp',
    ratio: 0.85, anchor: [0.5, 1], tint: '#C08A5E'
  },
  serre: {
    label: 'Serre-orangerie',
    src: 'img/bld/serre.webp',
    ratio: 1.10, anchor: [0.5, 1], tint: '#9FBBA6'
  },
  phare: {
    label: 'Petit phare',
    src: 'img/bld/phare.webp',
    ratio: 0.52, anchor: [0.5, 1], tint: '#E4E0D6'
  },
  belvedere: {
    label: 'Belvédère',
    src: 'img/bld/belvedere.webp',
    ratio: 1.20, anchor: [0.5, 1], tint: '#D8C9AE'
  },

  // Variantes déjà générées, disponibles pour d'autres compositions.
  bains: {
    label: 'Pavillon de bains',
    src: 'img/bld/bains.webp',
    ratio: 1.25, anchor: [0.5, 1], tint: '#B8C4C2'
  },
  tour: {
    label: 'Tour d\u2019observation',
    src: 'img/bld/tour.webp',
    ratio: 0.60, anchor: [0.5, 1], tint: '#A79BB0'
  }
};

export const getBuilding = id => BUILDINGS[id] || null;
