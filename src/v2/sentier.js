// LE SENTIER DE PIERRE.
//
// La version precedente tracait une ligne SVG : un trait blanc pose sur une
// illustration peinte, qui se voyait pour ce qu'il etait. Un chemin de jardin
// n'est pas un trait, c'est une matiere - des pierres irregulieres, des joints
// de terre, une ombre qui les detache du sol, et une largeur qui grandit quand
// on se rapproche.
//
// Tout est dessine en Canvas, pierre par pierre. Rien n'est aleatoire au sens
// ou le rendu changerait a chaque affichage : le hasard est SEME par la forme
// du chemin, donc le meme sentier redonne les memes pierres. Un chemin qui se
// reorganise a chaque rendu donnerait le tournis.

const TAU = Math.PI * 2;

// Generateur reproductible : la meme graine redonne le meme sentier.
function hasardDe(graine) {
  let etat = (graine * 2654435761) >>> 0;
  return () => {
    etat = (etat * 1664525 + 1013904223) >>> 0;
    return etat / 4294967296;
  };
}

// Position sur une courbe de Bezier cubique.
function surCourbe(p0, p1, p2, p3, t) {
  const u = 1 - t;
  return [
    u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
    u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
  ];
}

// Echantillonne la suite de courbes en une polyligne dense, en pixels.
function echantillonner(points, l, h) {
  const sortie = [];
  for (let i = 1; i < points.length; i += 1) {
    const a = [(points[i - 1][0] / 100) * l, (points[i - 1][1] / 100) * h];
    const b = [(points[i][0] / 100) * l, (points[i][1] / 100) * h];
    const milieu = (a[1] + b[1]) / 2;
    const c1 = [a[0], milieu];
    const c2 = [b[0], milieu];
    const pas = Math.max(12, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 6));
    for (let k = i === 1 ? 0 : 1; k <= pas; k += 1) {
      sortie.push(surCourbe(a, c1, c2, b, k / pas));
    }
  }
  return sortie;
}

const PIERRES_CLAIRES = [
  [214, 200, 178], [201, 186, 163], [223, 210, 190], [190, 176, 155], [208, 196, 176],
];
const PIERRES_SOMBRES = [
  [156, 132, 100], [138, 116, 88], [170, 146, 112], [126, 106, 82], [148, 126, 96],
];

/**
 * Dessine un chemin pave sur un canvas.
 * @param {HTMLCanvasElement} canvas
 * @param {number[][]} points  - la ligne directrice, en pourcentages [x, y]
 * @param {'matin'|'soir'} moment
 */
export function dessinerSentier(canvas, points, moment) {
  const ctx = canvas.getContext('2d');
  const r = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const l = r.width;
  const h = r.height;
  if (!l || !h) return;

  canvas.width = Math.round(l * dpr);
  canvas.height = Math.round(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, l, h);

  const ligne = echantillonner(points, l, h);
  if (ligne.length < 2) return;

  const soir = moment === 'soir';
  const palette = soir ? PIERRES_SOMBRES : PIERRES_CLAIRES;
  const hasard = hasardDe(Math.round(l + h * 7 + points.length * 131));

  // La largeur du chemin grandit vers le bas : c'est ce qui donne au jardin sa
  // profondeur sans avoir a dessiner de perspective ailleurs.
  const largeurA = (y) => 15 + 30 * (y / h);

  // 1. Le lit du chemin : une bande de terre plus sombre sous les pierres, qui
  //    empeche le pave de flotter au-dessus de l'illustration.
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < ligne.length; i += 1) {
    const [x, y] = ligne[i];
    ctx.lineTo(x, y);
  }
  ctx.strokeStyle = soir ? 'rgba(24, 16, 10, 0.5)' : 'rgba(96, 74, 48, 0.28)';
  ctx.lineWidth = largeurA(h * 0.6) + 12;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.filter = 'blur(6px)';
  ctx.stroke();
  ctx.restore();

  // 2. Les pierres, posees le long de la ligne en rangees decalees.
  let parcouru = 0;
  let prochaine = 0;
  for (let i = 1; i < ligne.length; i += 1) {
    const [x0, y0] = ligne[i - 1];
    const [x1, y1] = ligne[i];
    const seg = Math.hypot(x1 - x0, y1 - y0);
    parcouru += seg;
    if (parcouru < prochaine) continue;

    const large = largeurA(y1);
    prochaine = parcouru + large * (0.32 + hasard() * 0.12);

    // Perpendiculaire au chemin : les pierres s'alignent en travers, comme un
    // vrai pavage, pas dans le sens de la marche.
    const angle = Math.atan2(y1 - y0, x1 - x0);
    const nx = -Math.sin(angle);
    const ny = Math.cos(angle);

    const parRangee = 2 + Math.round(hasard() * 1.6);
    for (let k = 0; k < parRangee; k += 1) {
      const decalage = ((k + 0.5) / parRangee - 0.5) * large * (1.5 + hasard() * 0.3);
      const cx = x1 + nx * decalage + (hasard() - 0.5) * 3;
      const cy = y1 + ny * decalage + (hasard() - 0.5) * 3;
      const rayon = large * (0.2 + hasard() * 0.13);

      const [pr, pv, pb] = palette[Math.floor(hasard() * palette.length)];
      const variation = 0.86 + hasard() * 0.28;

      // Une pierre : un polygone irregulier a 7 cotes. Un cercle ferait galet,
      // un rectangle ferait carrelage ; ni l'un ni l'autre ne fait sentier.
      ctx.beginPath();
      const cotes = 7;
      for (let s = 0; s <= cotes; s += 1) {
        const a = (s / cotes) * TAU;
        const rr = rayon * (0.76 + hasard() * 0.44);
        const px = cx + Math.cos(a) * rr * 1.15;
        const py = cy + Math.sin(a) * rr * 0.82;
        if (s === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();

      ctx.fillStyle = `rgb(${Math.round(pr * variation)}, ${Math.round(pv * variation)}, ${Math.round(pb * variation)})`;
      ctx.shadowColor = soir ? 'rgba(0, 0, 0, 0.65)' : 'rgba(70, 52, 32, 0.45)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetY = 1.5;
      ctx.fill();
      ctx.shadowColor = 'transparent';

      // Un lisere clair sur le haut de la pierre : c'est lui qui donne le
      // relief, pas l'ombre portee.
      ctx.strokeStyle = soir
        ? `rgba(255, 214, 150, ${0.1 + hasard() * 0.12})`
        : `rgba(255, 252, 240, ${0.24 + hasard() * 0.2})`;
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
  }

  // 3. La lumiere du moment, posee sur l'ensemble : ambre au couchant, blanche
  //    au matin. Sans elle les pierres restent grises au milieu d'un jardin
  //    dore, et l'oeil voit tout de suite le collage.
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  const lueur = ctx.createLinearGradient(0, 0, 0, h);
  if (soir) {
    lueur.addColorStop(0, 'rgba(255, 168, 74, 0.34)');
    lueur.addColorStop(1, 'rgba(120, 62, 20, 0.24)');
  } else {
    lueur.addColorStop(0, 'rgba(255, 244, 214, 0.3)');
    lueur.addColorStop(1, 'rgba(232, 216, 180, 0.16)');
  }
  ctx.fillStyle = lueur;
  ctx.fillRect(0, 0, l, h);
  ctx.restore();
}
