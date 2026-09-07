// LA VIE DU JARDIN.
//
// Une illustration fixe, si belle soit-elle, se regarde une fois. Ce qui donne
// envie de rouvrir une application le soir, c'est que le lieu ait continue de
// vivre pendant l'absence.
//
// La regle qui gouverne tout ce fichier : PEU, et CREDIBLE. Trois lucioles qui
// derivent, hesitent et s'eteignent valent mieux que vingt points jaunes qui
// clignotent en cadence - c'est la difference entre un jardin et un economiseur
// d'ecran. Aucune creature ne va jamais en ligne droite, aucune ne bat des
// ailes a intervalle regulier, et chacune disparait de temps en temps.
//
// Canvas plutot que DOM : une centaine d'elements animes en CSS ferait ramer
// un telephone, et le rendu doux (halos, degrades) n'existe pas en SVG a ce
// prix-la.

const TAU = Math.PI * 2;

const alea = (min, max) => min + Math.random() * (max - min);
const doux = (t) => t * t * (3 - 2 * t);

class Luciole {
  constructor(l, h) {
    this.reset(l, h, true);
  }

  reset(l, h, premiere) {
    this.x = alea(l * 0.1, l * 0.9);
    // Sur toute la hauteur : le jardin depasse largement l'ecran, et des
    // lucioles cantonnees en bas ne se voient jamais.
    this.y = alea(h * 0.06, h * 0.96);
    this.cibleX = this.x;
    this.cibleY = this.y;
    this.vx = 0;
    this.vy = 0;
    // L'illustration porte deja des lanternes et des guirlandes : une luciole
    // discrete s'y noie completement. Elle doit etre plus lumineuse qu'elle ne
    // le serait sur un fond neutre.
    this.r = alea(2.4, 3.6);
    // Chaque luciole a son propre rythme : une pulsation commune serait
    // immediatement lue comme une animation.
    this.periode = alea(2.4, 4.6);
    this.phase = alea(0, TAU);
    this.vie = premiere ? alea(0, 14) : 0;
    this.duree = alea(11, 22);
    this.repos = 0;
  }

  maj(dt, l, h) {
    this.vie += dt;
    if (this.vie > this.duree) this.reset(l, h, false);

    // Une hesitation de temps en temps : l'insecte s'arrete, puis repart.
    if (this.repos > 0) {
      this.repos -= dt;
    } else if (Math.random() < dt * 0.35) {
      this.repos = alea(0.3, 1.1);
    } else if (Math.random() < dt * 0.7) {
      this.cibleX = this.x + alea(-70, 70);
      this.cibleY = this.y + alea(-46, 46);
    }

    if (this.repos <= 0) {
      this.vx += ((this.cibleX - this.x) * 0.6 - this.vx) * dt * 1.6;
      this.vy += ((this.cibleY - this.y) * 0.6 - this.vy) * dt * 1.6;
    } else {
      this.vx *= 1 - dt * 3;
      this.vy *= 1 - dt * 3;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.x < 8 || this.x > l - 8) this.cibleX = l / 2;
    if (this.y < h * 0.25 || this.y > h - 8) this.cibleY = h * 0.65;
  }

  dessiner(ctx, t) {
    // Apparition et extinction en fondu : une luciole qui surgit d'un coup
    // trahit le programme.
    const age = Math.min(1, this.vie / 2.2);
    const fin = Math.min(1, (this.duree - this.vie) / 2.2);
    const pulse = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t / this.periode * TAU + this.phase));
    const a = doux(Math.max(0, Math.min(age, fin))) * pulse;
    if (a <= 0.01) return;

    const rayon = this.r * 9;
    const halo = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, rayon);
    halo.addColorStop(0, `rgba(255, 232, 165, ${a * 0.95})`);
    halo.addColorStop(0.35, `rgba(255, 198, 96, ${a * 0.4})`);
    halo.addColorStop(1, 'rgba(255, 180, 70, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(this.x, this.y, rayon, 0, TAU);
    ctx.fill();

    ctx.fillStyle = `rgba(255, 248, 214, ${a})`;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, TAU);
    ctx.fill();
  }
}

class Papillon {
  constructor(l, h) {
    this.reset(l, h, true);
  }

  reset(l, h, premiere) {
    this.x = premiere ? alea(l * 0.15, l * 0.85) : alea(-40, l + 40);
    this.y = alea(h * 0.3, h * 0.8);
    this.vx = alea(14, 30) * (Math.random() < 0.5 ? -1 : 1);
    this.vy = alea(-8, 8);
    this.taille = alea(5, 8);
    this.battement = alea(7, 11);
    this.phase = alea(0, TAU);
    this.teinte = Math.random() < 0.5 ? [255, 244, 226] : [255, 226, 190];
    this.vie = 0;
    this.duree = alea(14, 26);
  }

  maj(dt, l, h) {
    this.vie += dt;
    if (this.vie > this.duree) this.reset(l, h, false);
    // Le vol du papillon monte et descend sans cesse : c'est ce qui le rend
    // reconnaissable, bien plus que la forme de ses ailes.
    this.vy += Math.sin(this.vie * 3.1 + this.phase) * 34 * dt;
    this.vx += Math.sin(this.vie * 0.7) * 9 * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vy *= 1 - dt * 1.2;
    if (this.y < h * 0.2) this.vy += 24 * dt;
    if (this.y > h * 0.92) this.vy -= 24 * dt;
    if (this.x < -60 || this.x > l + 60) this.reset(l, h, false);
  }

  dessiner(ctx, t) {
    const a = doux(Math.min(1, Math.min(this.vie / 1.5, (this.duree - this.vie) / 1.5)));
    if (a <= 0.01) return;
    // L'ouverture des ailes se lit comme une largeur qui varie : de face, un
    // papillon disparait presque a chaque battement.
    const ouvert = Math.abs(Math.sin(t * this.battement + this.phase));
    const [r, v, b] = this.teinte;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(Math.atan2(this.vy, this.vx) * 0.25);
    ctx.fillStyle = `rgba(${r}, ${v}, ${b}, ${a * 0.92})`;
    for (const cote of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(cote * this.taille * 0.55 * ouvert, 0,
        this.taille * 0.62 * ouvert + 0.6, this.taille * 0.85, 0, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = `rgba(90, 70, 55, ${a * 0.8})`;
    ctx.fillRect(-0.7, -this.taille * 0.6, 1.4, this.taille * 1.2);
    ctx.restore();
  }
}

class Oiseau {
  constructor(l, h) {
    this.attente = alea(6, 22);
    this.actif = false;
    this.l = l;
    this.h = h;
  }

  reset(l, h) {
    this.sens = Math.random() < 0.5 ? 1 : -1;
    this.x = this.sens > 0 ? -50 : l + 50;
    this.y = alea(h * 0.1, h * 0.3);
    this.v = alea(52, 86);
    this.taille = alea(4.5, 7);
    this.phase = alea(0, TAU);
    this.actif = true;
  }

  maj(dt, l, h) {
    if (!this.actif) {
      this.attente -= dt;
      // Rare, et jamais a heure fixe : un oiseau qui passe toutes les dix
      // secondes devient un metronome.
      if (this.attente <= 0) { this.reset(l, h); this.attente = alea(26, 70); }
      return;
    }
    this.x += this.v * this.sens * dt;
    this.y += Math.sin(this.x * 0.012 + this.phase) * 9 * dt;
    if (this.x < -70 || this.x > l + 70) this.actif = false;
  }

  dessiner(ctx, t) {
    if (!this.actif) return;
    const bat = Math.sin(t * 9 + this.phase);
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(this.sens, 1);
    ctx.strokeStyle = 'rgba(58, 46, 38, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-this.taille, bat * this.taille * 0.55);
    ctx.quadraticCurveTo(-this.taille * 0.35, -this.taille * 0.28, 0, 0);
    ctx.quadraticCurveTo(this.taille * 0.35, -this.taille * 0.28, this.taille, bat * this.taille * 0.55);
    ctx.stroke();
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------

export function animerJardin(canvas, moment) {
  const ctx = canvas.getContext('2d');
  const calme = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let l = 0;
  let h = 0;
  let habitants = [];
  let brut = null;
  let dernier = 0;
  let t = 0;

  function dimensionner() {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    l = r.width;
    h = r.height;
    canvas.width = Math.round(l * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function peupler() {
    // Une par tranche de 300 px de jardin : la densite reste la meme qu'on ait
    // trois produits ou sept, sans jamais depasser la poignee qui rend la
    // scene credible.
    const combien = Math.max(3, Math.min(6, Math.round(h / 300)));
    habitants = [new Oiseau(l, h)];
    for (let i = 0; i < combien; i += 1) {
      habitants.push(moment === 'soir' ? new Luciole(l, h) : new Papillon(l, h));
    }
  }

  function image(maintenant) {
    const dt = Math.min(0.05, (maintenant - dernier) / 1000 || 0);
    dernier = maintenant;
    t += dt;
    ctx.clearRect(0, 0, l, h);
    for (const e of habitants) {
      e.maj(dt, l, h);
      e.dessiner(ctx, t);
    }
    brut = requestAnimationFrame(image);
  }

  function demarrer() {
    if (brut || calme) return;
    dernier = performance.now();
    brut = requestAnimationFrame(image);
  }

  function arreter() {
    if (brut) cancelAnimationFrame(brut);
    brut = null;
  }

  dimensionner();
  peupler();

  // Un jardin qui continue de tourner dans un onglet cache ne fait que vider
  // la batterie.
  const surVisibilite = () => (document.hidden ? arreter() : demarrer());
  document.addEventListener('visibilitychange', surVisibilite);

  const surTaille = () => { dimensionner(); };
  window.addEventListener('resize', surTaille);

  if (calme) {
    // Immobile, mais pas vide : on pose les habitants une fois.
    for (const e of habitants) e.dessiner(ctx, 0);
  } else {
    demarrer();
  }

  return () => {
    arreter();
    document.removeEventListener('visibilitychange', surVisibilite);
    window.removeEventListener('resize', surTaille);
  };
}
