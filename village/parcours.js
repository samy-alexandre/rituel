/* ------------------------------------------------------------------
   parcours.js — la composition
   ------------------------------------------------------------------
   Un parcours = un itinéraire logique + une mise en scène.
   Il dit QUELLES étapes, DANS QUEL ORDRE, et OÙ se pose leur bâtiment.

   Il ne dit rien de l'ambiance (ciel, lumière, saison) : c'est worlds.js.
   Le même parcours se rejoue donc à l'identique en été, en hiver, à Noël.

   ------------------------------------------------------------------
   Repère de coordonnées
   ------------------------------------------------------------------
   Tout est en fraction de la SCÈNE, jamais de l'écran.
   La scène a un ratio verrouillé (celui du fond), donc une position
   écrite ici est vraie sur tous les téléphones. Plus de calibrage.

     x  0 = bord gauche,  1 = bord droit
     y  0 = haut,         1 = bas
     w  largeur du bâtiment en fraction de la largeur de scène
     z  ordre d'affichage. Omis = calculé depuis y (plus bas = devant).

   Le point (x, y) est le POINT AU SOL du bâtiment, pas son centre.
   ------------------------------------------------------------------ */

export const PARCOURS = {

  matin: {
    label: 'Matin',
    world: 'aube',          // monde par défaut, surchargeable à l'appel
    layout: 'chemin',
    order: ['depart', 'preparer', 'nettoyer', 'equilibrer', 'traiter', 'hydrater', 'proteger', 'arrivee'],

    // Bande de ciel réservée au titre. Rien ne doit y monter,
    // panneaux compris. checkComposition() le vérifie tout seul.
    reserveHaut: 0.16,

    // Axe du chemin, du haut vers le bas. hw = demi-largeur.
    // Sert de guide de composition tant que le fond n'est pas branché.
    // Passe show à false quand le chemin est dessiné dans l'image.
    path: {
      show: true,
      points: [
        { y: 0.16, x: 0.500, hw: 0.022 },
        { y: 0.30, x: 0.492, hw: 0.038 },
        { y: 0.45, x: 0.516, hw: 0.062 },
        { y: 0.60, x: 0.492, hw: 0.105 },
        { y: 0.75, x: 0.508, hw: 0.165 },
        { y: 0.90, x: 0.500, hw: 0.225 },
        { y: 1.02, x: 0.500, hw: 0.262 }
      ]
    },

    stations: [
      // Le portail est le seul à enjamber le chemin.
      { step: 'depart', building: 'portail', x: 0.500, y: 0.952, w: 0.340 },

      // CONSERVÉE, DÉSACTIVÉE. Le cahier V2 retire « Préparer » ;
      // la station reste écrite, coordonnées intactes. Repasser
      // enabled à true la fait revenir entière, sans recalibrage.
      { step: 'preparer', building: 'cabane', x: 0.270, y: 0.855, w: 0.225, enabled: false },

      { step: 'nettoyer',   building: 'lavoir',      x: 0.735, y: 0.775, w: 0.215 },
      { step: 'equilibrer', building: 'pavillon',    x: 0.285, y: 0.665, w: 0.190 },
      { step: 'traiter',    building: 'apothicaire', x: 0.715, y: 0.555, w: 0.165 },
      { step: 'hydrater',   building: 'serre',       x: 0.305, y: 0.455, w: 0.175 },
      { step: 'proteger',   building: 'phare',       x: 0.665, y: 0.375, w: 0.105 },
      { step: 'arrivee',    building: 'belvedere',   x: 0.500, y: 0.290, w: 0.150 }
    ]
  },

  // Même village, même plan, autre heure.
  // On n'écrit que ce qui change — le reste suit matin automatiquement.
  soir: {
    extends: 'matin',
    label: 'Soir',
    world: 'crepuscule',
    overrides: {
      proteger: { enabled: false }   // pas de SPF le soir
      // Pour remplacer le phare par la tour d'observation le soir :
      // proteger: { building: 'tour', w: 0.085 }
    }
  },

  // ------------------------------------------------------------------
  // EN ATTENTE. Composition libre (clairière / place), pas de chemin.
  // Volontairement vide : rien ne se développe ici avant validation
  // de la composition et de la nouvelle illustration de fond.
  // Le moteur sait déjà rendre layout: 'libre' — il n'y aura que ce
  // tableau à remplir.
  // ------------------------------------------------------------------
  hebdo: {
    label: 'Hebdo',
    world: 'voile',
    layout: 'libre',
    order: [],
    stations: []
  }
};

/** Applique extends + overrides et renvoie un parcours complet. */
export function resolveParcours(id) {
  const raw = PARCOURS[id];
  if (!raw) return null;

  const base = raw.extends ? resolveParcours(raw.extends) : { stations: [], path: null, layout: 'chemin' };
  const merged = { ...base, ...raw, id };
  delete merged.extends;
  delete merged.overrides;

  const ov = raw.overrides || {};
  merged.stations = (raw.stations || base.stations).map(st => ({
    enabled: true,
    ...st,
    ...(ov[st.step] || {})
  }));

  return merged;
}

/** Stations réellement affichées, triées de l'arrière vers l'avant. */
export function activeStations(parcours) {
  return parcours.stations
    .filter(st => st.enabled !== false)
    .sort((a, b) => a.y - b.y);
}

/* ------------------------------------------------------------------
   Contrôle automatique de la composition.
   ------------------------------------------------------------------
   Remplace la mesure à l'œil sur six écrans. Les coordonnées étant
   normalisées, un défaut détecté ici est un défaut partout, et un
   défaut absent ici est absent partout.

   Renvoie une liste d'anomalies. Vide = composition saine.
   ------------------------------------------------------------------ */
export function checkComposition(parcours, buildings, stageRatio = 2 / 3) {
  const out = [];
  const stations = activeStations(parcours);
  const reserve = parcours.reserveHaut ?? 0;

  const boite = st => {
    const b = buildings[st.building];
    if (!b) return null;
    const w = st.w * (st.scale || 1);
    const h = (w * stageRatio) / b.ratio;
    return { haut: st.y - h, bas: st.y, gauche: st.x - w / 2, droite: st.x + w / 2, h, w };
  };

  stations.forEach(st => {
    const bx = boite(st);
    if (!bx) { out.push(`${st.step} : bâtiment « ${st.building} » absent du catalogue`); return; }

    // Le panneau se pose au-dessus du toit : il compte dans l'empiètement.
    const hautAvecPanneau = bx.haut - (st.panel === false ? 0 : 0.040);
    if (reserve && hautAvecPanneau < reserve) {
      out.push(`${st.step} : monte à ${hautAvecPanneau.toFixed(3)}, sous la réserve de ${reserve}`);
    }
    if (bx.gauche < 0 || bx.droite > 1) {
      out.push(`${st.step} : déborde du cadre (${bx.gauche.toFixed(3)} → ${bx.droite.toFixed(3)})`);
    }
  });

  // Deux bâtiments ne doivent pas se marcher dessus.
  for (let i = 0; i < stations.length; i++) {
    for (let j = i + 1; j < stations.length; j++) {
      const a = boite(stations[i]), b = boite(stations[j]);
      if (!a || !b) continue;
      const chevauche = a.gauche < b.droite && b.gauche < a.droite && a.haut < b.bas && b.haut < a.bas;
      if (chevauche) out.push(`${stations[i].step} et ${stations[j].step} se chevauchent`);
    }
  }

  return out;
}
