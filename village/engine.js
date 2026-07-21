/* ------------------------------------------------------------------
   engine.js — le moteur
   ------------------------------------------------------------------
   Un seul point d'entrée. Il ne connaît ni Noël, ni les produits,
   ni la feuille. Il compose un parcours et un monde, empile les
   couches, applique l'état. C'est tout.

       renderVillage(hote, { parcours: 'matin', world: 'noel' })

   Si ce fichier doit être modifié pour ajouter une saison, un décor
   ou un nouveau parcours, c'est que l'architecture a échoué.
   ------------------------------------------------------------------ */

import { resolveParcours, activeStations } from './parcours.js';
import { resolveWorld } from './worlds.js';
import { LAYERS, LAYER_ORDER } from './layers.js';

export function renderVillage(host, opts = {}) {
  const parcours = resolveParcours(opts.parcours || 'matin');
  if (!parcours) throw new Error(`Parcours inconnu : ${opts.parcours}`);

  const world = resolveWorld(opts.world || parcours.world);
  if (!world) throw new Error(`Monde inconnu : ${opts.world || parcours.world}`);

  // Le monde peut retoucher un placement sans réécrire le parcours.
  const stations = activeStations(parcours).map(st => ({
    ...st,
    ...(world.overrides?.[st.step] || {})
  }));

  const stageRatio = world.bg?.ratio || 2 / 3;

  const ctx = {
    parcours, world, stations,
    state: opts.state || {},
    stageRatio,
    onStation: opts.onStation || null
  };

  const stage = document.createElement('div');
  stage.className = `vlg-stage vlg-layout-${parcours.layout} vlg-light-${world.lighting?.mode || 'jour'}`;
  stage.style.aspectRatio = String(stageRatio);
  stage.dataset.parcours = parcours.id;
  stage.dataset.world = world.id;

  // La palette du monde descend dans le CSS. Aucune couleur de thème
  // n'est écrite en dur dans la feuille de style.
  for (const [k, v] of Object.entries(world.palette || {})) {
    stage.style.setProperty(`--vlg-${k}`, v);
  }

  for (const name of LAYER_ORDER) {
    const node = LAYERS[name]?.(ctx);
    if (node) stage.appendChild(node);
  }

  host.replaceChildren(stage);

  // Poignée minimale : on redessine, on ne bricole pas le DOM.
  return {
    stage,
    parcours,
    world,
    update(next = {}) { return renderVillage(host, { ...opts, ...next }); }
  };
}
