/* ------------------------------------------------------------------
   layers.js — registre des couches
   ------------------------------------------------------------------
   Une scène est une pile de couches rendues dans l'ordre.
   Chaque couche est une fonction pure : (ctx) => Element | null.

   Ajouter une couche = écrire une fonction et poser son nom dans
   LAYER_ORDER. Le moteur n'est pas modifié. C'est tout l'intérêt.

   ctx = { parcours, world, stations, state, stageRatio, onStation }
   ------------------------------------------------------------------ */

import { getStep, isSoin } from './steps.js';
import { getBuilding } from './buildings.js';

const el = (tag, cls, style) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (style) Object.assign(n.style, style);
  return n;
};

const pct = v => (v * 100).toFixed(3) + '%';

/** Hauteur d'un bâtiment en fraction de la hauteur de scène. */
const heightFrac = (w, spriteRatio, stageRatio) => (w * stageRatio) / spriteRatio;

/* ---------------------------------------------------------------- */

function background(ctx) {
  const { world } = ctx;
  const p = world.palette;
  const layer = el('div', 'vlg-layer vlg-bg');

  // Dégradé de repli, dans la palette réelle du monde.
  layer.style.background =
    `linear-gradient(180deg, ${p.cielHaut} 0%, ${p.halo} 34%, ${p.cielBas} 52%, ${p.prairie} 100%)`;

  if (world.bg?.src) {
    const img = el('img', 'vlg-bg-img');
    img.src = world.bg.src;
    img.alt = '';
    img.decoding = 'async';
    img.addEventListener('error', () => img.remove());
    layer.appendChild(img);
  }
  return layer;
}

/* ---------------------------------------------------------------- */

function path(ctx) {
  const { parcours, world } = ctx;
  const cfg = parcours.path;
  if (!cfg?.show || !cfg.points?.length) return null;

  const layer = el('div', 'vlg-layer vlg-path');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('preserveAspectRatio', 'none');

  const left  = cfg.points.map(pt => `${(pt.x - pt.hw) * 100},${pt.y * 100}`);
  const right = cfg.points.map(pt => `${(pt.x + pt.hw) * 100},${pt.y * 100}`).reverse();

  const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
  poly.setAttribute('points', [...left, ...right].join(' '));
  poly.setAttribute('fill', world.palette.chemin);
  svg.appendChild(poly);
  layer.appendChild(svg);
  return layer;
}

/* ---------------------------------------------------------------- */

function decor(ctx) {
  const { world, stageRatio } = ctx;
  if (!world.decor?.length) return null;

  const layer = el('div', 'vlg-layer vlg-decor');
  world.decor.forEach(d => {
    const node = el('div', 'vlg-prop', {
      left: pct(d.x), top: pct(d.y), width: pct(d.w),
      aspectRatio: String(d.ratio || 1)
    });
    const img = el('img');
    img.src = d.art; img.alt = '';
    img.addEventListener('error', () => node.classList.add('is-absent'));
    node.appendChild(img);
    layer.appendChild(node);
  });
  return layer;
}

/* ---------------------------------------------------------------- */

function buildings(ctx) {
  const { world, stations, state, stageRatio, onStation } = ctx;
  const layer = el('div', 'vlg-layer vlg-buildings');
  const glow = world.lighting?.glow;

  stations.forEach(st => {
    const b = getBuilding(st.building);
    const step = getStep(st.step);
    if (!b) return;

    const w = st.w * (st.scale || 1);
    const slot = el('div', 'vlg-slot', {
      left: pct(st.x),
      top: pct(st.y),
      width: pct(w),
      aspectRatio: String(b.ratio),
      zIndex: String(st.z ?? Math.round(st.y * 1000))
    });

    // L'ancrage passe par des variables, pas par un transform inline :
    // le survol et les futures animations peuvent ainsi s'y composer
    // sans écraser le placement.
    slot.style.setProperty('--tx', pct(-b.anchor[0]));
    slot.style.setProperty('--ty', pct(-b.anchor[1]));
    if (st.rotate) slot.style.setProperty('--rot', st.rotate + 'deg');

    slot.dataset.step = st.step;
    slot.dataset.building = st.building;
    slot.classList.add('is-' + (state[st.step] || 'vide'));
    if (!isSoin(st.step)) slot.classList.add('is-repere');

    // Ombre de contact au sol.
    slot.appendChild(el('span', 'vlg-shadow'));

    // Halo des fenêtres allumées, piloté par le monde.
    if (glow) {
      slot.appendChild(el('span', 'vlg-glow', {
        background: `radial-gradient(ellipse at 50% 62%, ${glow.color} 0%, transparent 70%)`,
        opacity: String(glow.opacity),
        transform: `scale(${1 + glow.spread})`
      }));
    }

    // L'illustration, ou son bloc de substitution si l'asset manque.
    const src = world.skins?.[st.building] || b.src;
    const img = el('img', 'vlg-art');
    img.src = src;
    img.alt = b.label;
    img.decoding = 'async';
    img.addEventListener('error', () => {
      slot.classList.add('is-absent');
      slot.style.setProperty('--tint', b.tint);
      img.remove();
    });
    slot.appendChild(img);

    // Simple point d'accroche. Aucune interaction n'est construite ici.
    if (onStation && isSoin(st.step)) {
      slot.tabIndex = 0;
      slot.setAttribute('role', 'button');
      slot.setAttribute('aria-label', `${step?.label ?? st.step} — ${b.label}`);
      slot.addEventListener('click', () => onStation(st.step, st));
    }

    layer.appendChild(slot);
  });

  return layer;
}

/* ---------------------------------------------------------------- */

function panels(ctx) {
  const { stations, stageRatio } = ctx;
  const layer = el('div', 'vlg-layer vlg-panels');

  stations.forEach(st => {
    if (st.panel === false) return;
    const b = getBuilding(st.building);
    const step = getStep(st.step);
    if (!b || !step) return;

    const w = st.w * (st.scale || 1);
    const top = st.y - heightFrac(w, b.ratio, stageRatio) - 0.014;

    const panel = el('div', 'vlg-panel', {
      left: pct(st.x + (st.panelDx || 0)),
      top: pct(top + (st.panelDy || 0))
    });
    panel.textContent = step.label;
    layer.appendChild(panel);
  });

  return layer;
}

/* ---------------------------------------------------------------- */

/** Réservé. Le schéma existe (world.weather), le rendu viendra. */
function weather(ctx) {
  return null;
}

/* ---------------------------------------------------------------- */

export const LAYERS = { background, path, decor, buildings, panels, weather };

export const LAYER_ORDER = ['background', 'path', 'decor', 'buildings', 'panels', 'weather'];
