// LE JARDIN, EN VOLUME.
//
// Ce n'est pas une image du jardin : c'est le jardin. Un sentier de dalles qui
// s'eloigne, des lanternes qui marquent chaque etape de la routine du jour, et
// une vegetation clairsemee. Le parti pris est le luxe epure - PEU d'objets,
// beaucoup d'espace, et toute la depense mise dans la lumiere. Un decor charge
// fait riche cinq secondes puis fait cheap ; un decor vide et bien eclaire
// tient.
//
// Les modeles sont de vrais assets 3D sous licence verifiee (CC0 et CC-BY,
// voir public/models/CREDITS.json). Chacun n'est charge QU'UNE fois puis
// clone : charger vingt fougeres serait vingt fois le meme telechargement.
//
// Ce qui fait la difference entre une scene 3D amateur et une scene qui se
// vend, et qui est applique ici :
//   - un ton mapping cinema (ACES) plutot que des couleurs brutes ;
//   - une lumiere rasante, pas une lampe frontale ;
//   - de la brume, qui donne la distance et pardonne le vide ;
//   - aucune ombre portee calculee - trop couteux sur telephone pour ce
//     qu'elles apportent a cette echelle.

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const AMBIANCES = {
  soir: {
    haut: 0x1b1410,
    bas: 0x8a4a20,
    brume: 0x2a1c14,
    sol: 0x241b15,
    cle: 0xffa855,
    intensiteCle: 2.6,
    ciel: 0x2a2440,
    remplissage: 0x6b4a30,
    lanterne: 0xffb055,
    puissanceLanterne: 5.5,
    exposition: 1.05,
    eau: 0x3c5a63,
    verre: 0xd8c9a8,
  },
  matin: {
    haut: 0x9dc4de,
    bas: 0xf6e3bd,
    brume: 0xd7cdb6,
    sol: 0x5c6b46,
    cle: 0xfff0d2,
    intensiteCle: 3.1,
    ciel: 0xbfd4e8,
    remplissage: 0x8fa070,
    lanterne: 0xfff0cc,
    puissanceLanterne: 1.2,
    exposition: 1.15,
    eau: 0x8fb4c4,
    verre: 0xeae2d2,
  },
};

// Modeles retenus : les plus legers a licence verifiee, dans un style coherent.
const MODELES = {
  dalle: '/models/rock-OQvi8PIZ40.glb',
  buisson: '/models/bush-ooG6CkLyE8.glb',
  fleur: '/models/flower-2zT-C10njmX.glb',
  lanterne: '/models/lantern-CtHBJ1ufeW.glb',
};

const chargeur = new GLTFLoader();
const cache = new Map();

function charger(url) {
  if (!cache.has(url)) {
    cache.set(url, new Promise((resolve) => {
      chargeur.load(url, (g) => resolve(g.scene), undefined, () => resolve(null));
    }));
  }
  return cache.get(url);
}

// Met un modele a une taille voulue et le pose sur le sol, quelle que soit
// l'echelle avec laquelle son auteur l'a exporte.
function normaliser(objet, hauteurVoulue) {
  const boite = new THREE.Box3().setFromObject(objet);
  const taille = boite.getSize(new THREE.Vector3());
  const facteur = hauteurVoulue / (taille.y || 1);
  objet.scale.setScalar(facteur);
  const apres = new THREE.Box3().setFromObject(objet);
  objet.position.y -= apres.min.y;
  return objet;
}

// LES STATIONS SONT DES OBJETS, PAS DES BORNES.
//
// Une lanterne repetee cinq fois dit « etape 1, etape 2, etape 3 » : c'est la
// grammaire d'un jeu de progression, et ca se lit tout de suite comme tel. Un
// objet different par geste - un bassin pour nettoyer, un flacon de verre sur
// son socle pour un serum, une vasque d'eau pour hydrater - dit a la fois la
// beaute et le sens. C'est le plus gros levier du rendu.
//
// Ces objets n'existent pas en CC0 : on les compose en geometrie primitive
// avec des matieres soignees. Une pierre mate, une eau lisse et un verre en
// transmission valent mieux qu'un modele de jeu approximatif.

function matierePierre(soir) {
  return new THREE.MeshStandardMaterial({
    color: soir ? 0xb9a88f : 0xded3c0,
    roughness: 0.95,
    metalness: 0,
    flatShading: true,
  });
}

function matiereEau(A) {
  return new THREE.MeshStandardMaterial({
    color: A.eau,
    roughness: 0.06,
    metalness: 0.5,
    envMapIntensity: 1,
  });
}

// Le verre est IMITE, pas simule. `transmission` de MeshPhysicalMaterial rend
// la scene dans une texture a chaque image et par objet : avec un flacon par
// station, cela figeait deja un ordinateur de bureau, donc n'aurait aucune
// chance sur un telephone. Un standard translucide, tres lisse et legerement
// emissif, donne le meme eclat pour un cout normal.
function matiereVerre(A) {
  return new THREE.MeshStandardMaterial({
    color: A.verre,
    roughness: 0.12,
    metalness: 0.1,
    transparent: true,
    opacity: 0.72,
    emissive: A.verre,
    emissiveIntensity: 0.12,
  });
}

// Un bassin de pierre : nettoyer, demaquiller. L'eau capte la lumiere du ciel
// et devient le point brillant de la scene.
function bassin(A, soir) {
  const g = new THREE.Group();
  const cuve = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.7, 0.34, 12), matierePierre(soir));
  cuve.position.y = 0.17;
  g.add(cuve);
  const eau = new THREE.Mesh(new THREE.CircleGeometry(0.53, 20), matiereEau(A));
  eau.rotation.x = -Math.PI / 2;
  eau.position.y = 0.3;
  g.add(eau);
  return g;
}

// Un flacon de verre sur son socle : les serums et les soins cibles.
function flacon(A, soir) {
  const g = new THREE.Group();
  const socle = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.3, 0.62), matierePierre(soir));
  socle.position.y = 0.15;
  g.add(socle);
  const corps = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.19, 0.42, 10), matiereVerre(A));
  corps.position.y = 0.51;
  g.add(corps);
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.16, 8), matiereVerre(A));
  col.position.y = 0.79;
  g.add(col);
  const bouchon = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.09, 8), matierePierre(soir));
  bouchon.position.y = 0.9;
  g.add(bouchon);
  return g;
}

// Une vasque large et basse : l'hydratation, la creme, le geste qui enveloppe.
function vasque(A, soir) {
  const g = new THREE.Group();
  const pied = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 0.36, 10), matierePierre(soir));
  pied.position.y = 0.18;
  g.add(pied);
  const coupe = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.4, 0.22, 16), matierePierre(soir));
  coupe.position.y = 0.46;
  g.add(coupe);
  const eau = new THREE.Mesh(new THREE.CircleGeometry(0.66, 22), matiereEau(A));
  eau.rotation.x = -Math.PI / 2;
  eau.position.y = 0.55;
  g.add(eau);
  return g;
}

// Une pierre dressee : le masque, l'exfoliant, le geste rare et fort.
function stele(A, soir) {
  const g = new THREE.Group();
  const p = new THREE.Mesh(new THREE.BoxGeometry(0.46, 1.05, 0.2), matierePierre(soir));
  p.position.y = 0.52;
  p.rotation.z = 0.035;
  g.add(p);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.46, 0.12, 10), matierePierre(soir));
  base.position.y = 0.06;
  g.add(base);
  return g;
}

const OBJET_DE = {
  demaquillant: bassin,
  nettoyant: bassin,
  toner: vasque,
  serum: flacon,
  cible: flacon,
  yeux: flacon,
  creme: vasque,
  autre: vasque,
  masque: stele,
  spf: stele,
};

function courbeDuSentier(nombre) {
  const points = [new THREE.Vector3(0, 0, 8)];
  for (let i = 0; i < nombre; i += 1) {
    points.push(new THREE.Vector3(
      (i % 2 === 0 ? -1 : 1) * (1.9 + (i % 3) * 0.35),
      0,
      -4 - i * 7.5,
    ));
  }
  points.push(new THREE.Vector3(0, 0, -8 - nombre * 7.5));
  return new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.35);
}

// Generateur reproductible : le meme jardin d'un affichage a l'autre.
function hasardDe(graine) {
  let e = (graine * 2654435761) >>> 0;
  return () => {
    e = (e * 1664525 + 1013904223) >>> 0;
    return e / 4294967296;
  };
}

export async function monterJardin3d(canvas, etapes, moment, surStation = () => {}) {
  const A = AMBIANCES[moment] || AMBIANCES.soir;
  const calme = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const soir = moment === 'soir';

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(A.brume, 0.021);
  scene.background = new THREE.Color(A.brume);

  const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 300);
  camera.position.set(0, 3.1, 11);

  const rendu = new THREE.WebGLRenderer({ canvas, antialias: true });
  rendu.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  // Le ton mapping fait la moitie du rendu : sans lui les hautes lumieres
  // brulent et la scene a l'air d'une capture de moteur de jeu des annees 2000.
  rendu.toneMapping = THREE.ACESFilmicToneMapping;
  rendu.toneMappingExposure = A.exposition;
  rendu.outputColorSpace = THREE.SRGBColorSpace;

  // Le ciel : un degrade peint, pose loin derriere. Il donne la couleur de
  // l'heure sans qu'aucun objet n'ait a la porter.
  const toileCiel = document.createElement('canvas');
  toileCiel.width = 4;
  toileCiel.height = 256;
  const cctx = toileCiel.getContext('2d');
  const grad = cctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, `#${new THREE.Color(A.haut).getHexString()}`);
  grad.addColorStop(0.55, `#${new THREE.Color(A.bas).getHexString()}`);
  grad.addColorStop(1, `#${new THREE.Color(A.brume).getHexString()}`);
  cctx.fillStyle = grad;
  cctx.fillRect(0, 0, 4, 256);
  const texCiel = new THREE.CanvasTexture(toileCiel);
  texCiel.colorSpace = THREE.SRGBColorSpace;
  scene.add(new THREE.Mesh(
    new THREE.SphereGeometry(140, 20, 14),
    new THREE.MeshBasicMaterial({ map: texCiel, side: THREE.BackSide, fog: false, depthWrite: false }),
  ));

  // Le sol prend une teinte proche de la brume : sinon la ligne d'horizon
  // tranche net entre la terre et le ciel, et la profondeur s'effondre.
  const sol = new THREE.Mesh(
    new THREE.PlaneGeometry(300, 300),
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(A.sol).lerp(new THREE.Color(A.brume), 0.45),
      roughness: 1,
      metalness: 0,
    }),
  );
  sol.rotation.x = -Math.PI / 2;
  scene.add(sol);

  // Lumiere : une cle rasante tres basse (soleil couchant ou lever), un ciel
  // qui remplit le haut, un rebond depuis le sol. Trois sources, pas une.
  scene.add(new THREE.HemisphereLight(A.ciel, A.remplissage, soir ? 0.75 : 1.5));
  const cle = new THREE.DirectionalLight(A.cle, A.intensiteCle);
  cle.position.set(soir ? -9 : 9, 3.4, -16);
  scene.add(cle);

  const courbe = courbeDuSentier(etapes.length);
  const hasard = hasardDe(etapes.length * 977 + (soir ? 13 : 41));

  const [buisson, fleur, lanterne] = await Promise.all([
    charger(MODELES.buisson), charger(MODELES.fleur), charger(MODELES.lanterne),
  ]);

  // Le sentier : de vraies dalles posees une a une, plus rares et plus larges
  // quand elles s'eloignent. Un ruban texture aurait fait moquette.
  // Les dalles. Un rocher aplati donnait un eboulis d'eclats anguleux : ce
  // n'est pas la meme chose qu'une pierre taillee. Une dalle de sentier est un
  // galet a six ou sept cotes, large, basse, et separee de sa voisine par un
  // joint de terre. Une geometrie tenue en main donne exactement cela, et pese
  // moins qu'un modele charge.
  {
    const matiereDalle = new THREE.MeshStandardMaterial({
      color: soir ? 0xbba382 : 0xded2bb,
      roughness: 0.92,
      metalness: 0,
      flatShading: true,
    });
    const total = 30 + etapes.length * 9;
    for (let i = 0; i < total; i += 1) {
      const t = i / total;
      const p = courbe.getPointAt(t);
      const tan = courbe.getTangentAt(t);
      const cote = new THREE.Vector3().crossVectors(tan, new THREE.Vector3(0, 1, 0)).normalize();
      for (let k = 0; k < 2; k += 1) {
        const rayon = 0.44 + hasard() * 0.16;
        const geo = new THREE.CylinderGeometry(rayon, rayon * 0.94, 0.07, 6 + Math.floor(hasard() * 2));
        // Un leger froissement des sommets : sans lui les dalles sont trop
        // parfaites et le sentier fait pave autoroutier.
        const pos = geo.attributes.position;
        for (let v = 0; v < pos.count; v += 1) {
          pos.setX(v, pos.getX(v) * (0.93 + hasard() * 0.14));
          pos.setZ(v, pos.getZ(v) * (0.93 + hasard() * 0.14));
        }
        geo.computeVertexNormals();

        const d = new THREE.Mesh(geo, matiereDalle);
        const ecart = (k - 0.5) * (0.72 + hasard() * 0.14);
        d.position.copy(p).addScaledVector(cote, ecart + (hasard() - 0.5) * 0.1);
        d.position.y = 0.035;
        d.rotation.y = hasard() * Math.PI;
        d.rotation.x = (hasard() - 0.5) * 0.04;
        scene.add(d);
      }
    }
  }

  // La vegetation : clairsemee, et toujours EN DEHORS du sentier. Le luxe est
  // dans le vide qu'on laisse, pas dans le nombre de plantes.
  const semer = (modele, combien, hauteur, ecartMin, ecartMax) => {
    if (!modele) return;
    for (let i = 0; i < combien; i += 1) {
      const t = hasard() * 0.97;
      const p = courbe.getPointAt(t);
      const tan = courbe.getTangentAt(t);
      const cote = new THREE.Vector3().crossVectors(tan, new THREE.Vector3(0, 1, 0)).normalize();
      const sens = hasard() < 0.5 ? -1 : 1;
      const o = normaliser(modele.clone(true), hauteur * (0.75 + hasard() * 0.6));
      o.position.copy(p).addScaledVector(cote, sens * (ecartMin + hasard() * (ecartMax - ecartMin)));
      o.rotation.y = hasard() * Math.PI * 2;
      scene.add(o);
    }
  };

  semer(buisson, 16 + etapes.length * 3, 0.9, 2.2, 7);
  semer(fleur, 10 + etapes.length * 2, 0.42, 1.9, 5);

  // Une lanterne par etape : c'est elle qui dit « il se passe quelque chose
  // ici », et c'est la seule source de couleur chaude du soir.
  // Les ancres : la position sur la courbe de chaque etape. C'est la meme
  // liste qui place les lanternes et qui sert de point d'arret au doigt -
  // sinon le parcours s'arreterait a cote des stations.
  const ancres = etapes.map((_, i) => Math.min(0.93, (i + 0.8) / (etapes.length + 0.9)));

  const lampes = [];
  etapes.forEach((e, i) => {
    const t = ancres[i];
    const p = courbe.getPointAt(Math.min(0.95, t));
    const tan = courbe.getTangentAt(Math.min(0.95, t));
    const cote = new THREE.Vector3().crossVectors(tan, new THREE.Vector3(0, 1, 0)).normalize();
    const sens = i % 2 === 0 ? 1 : -1;

    // L'objet du geste, pose au bord du chemin.
    const composer = OBJET_DE[e.categorie] || vasque;
    const objet = composer(A, soir);
    objet.position.copy(p).addScaledVector(cote, sens * 1.7);
    objet.rotation.y = -sens * 0.35 + (hasard() - 0.5) * 0.2;
    scene.add(objet);

    // Une lanterne discrete DERRIERE l'objet : elle l'eclaire au lieu de le
    // remplacer, et c'est elle qui signale la station quand la brume avale le
    // detail.
    if (lanterne) {
      const l = normaliser(lanterne.clone(true), 1.15);
      l.position.copy(p).addScaledVector(cote, sens * 2.75);
      l.position.z -= 0.5;
      l.rotation.y = -sens * 0.4;
      scene.add(l);
    }

    const feu = new THREE.PointLight(A.lanterne, A.puissanceLanterne, 8.5, 2);
    feu.position.copy(p).addScaledVector(cote, sens * 2.45);
    feu.position.y = 1.15;
    scene.add(feu);
    lampes.push({ feu, phase: i * 1.7 });
  });

  // Les lucioles, seulement le soir : des points additifs qui derivent.
  let lucioles = null;
  let baseLucioles = [];
  if (soir) {
    const combien = 70;
    const pos = new Float32Array(combien * 3);
    for (let i = 0; i < combien; i += 1) {
      const p = courbe.getPointAt(hasard() * 0.95);
      const v = new THREE.Vector3(
        p.x + (hasard() - 0.5) * 11,
        0.5 + hasard() * 2.6,
        p.z + (hasard() - 0.5) * 7,
      );
      baseLucioles.push({ v, phase: hasard() * 7, vitesse: 0.22 + hasard() * 0.4 });
      pos.set([v.x, v.y, v.z], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    lucioles = new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0xffd489,
      size: 0.11,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    }));
    scene.add(lucioles);
  }

  // ---------------------------------------------------------------------
  // Le parcours. C'est ce qui separe un decor d'un produit : on AVANCE sur le
  // chemin avec le doigt, on s'arrete a chaque station, on valide, on repart.
  // ---------------------------------------------------------------------

  let progres = 0; // 0 = entree du jardin, 1 = fin du sentier
  let cible = ancres.length ? ancres[0] : 0;
  let stationCourante = -1;
  let saisie = null;

  const DEBUT = 0.02;

  function plusProche(p) {
    let meilleur = 0;
    for (let i = 1; i < ancres.length; i += 1) {
      if (Math.abs(ancres[i] - p) < Math.abs(ancres[meilleur] - p)) meilleur = i;
    }
    return meilleur;
  }

  function poser() {
    // Sans saisie en cours, on glisse vers l'ancre visee : le chemin se cale
    // toujours sur une station, jamais entre deux.
    cible = ancres.length ? ancres[plusProche(progres)] : DEBUT;
  }

  const surDebut = (e) => {
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    saisie = { y, depart: progres };
    canvas.setPointerCapture?.(e.pointerId ?? 1);
  };

  const surDeplacement = (e) => {
    if (!saisie) return;
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    // Glisser vers le HAUT fait avancer : le geste suit le chemin qui defile,
    // comme on pousserait le decor derriere soi.
    const delta = (saisie.y - y) / canvas.clientHeight;
    progres = Math.max(0, Math.min(0.97, saisie.depart + delta * 0.85));
    cible = progres;
    e.preventDefault();
  };

  const surFin = () => {
    if (!saisie) return;
    saisie = null;
    poser();
  };

  canvas.style.touchAction = 'none';
  canvas.addEventListener('pointerdown', surDebut);
  canvas.addEventListener('pointermove', surDeplacement, { passive: false });
  canvas.addEventListener('pointerup', surFin);
  canvas.addEventListener('pointercancel', surFin);
  canvas.addEventListener('pointerleave', surFin);

  // Aller a une station donnee, appele depuis l'interface.
  function allerA(index) {
    if (index < 0 || index >= ancres.length) return;
    cible = ancres[index];
  }

  let brut = null;
  const t0 = performance.now();

  function dimensionner() {
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    rendu.setSize(r.width, r.height, false);
    camera.aspect = r.width / r.height;
    camera.updateProjectionMatrix();
  }

  function image(maintenant) {
    const t = (maintenant - t0) / 1000;

    // La camera SUIT le parcours : elle se pose un peu en arriere de la
    // position visee, assez pour que la station qu'on atteint reste devant
    // soi plutot que de defiler dans le dos.
    progres += (cible - progres) * 0.09;
    const ici = Math.max(0, Math.min(0.97, progres));
    // Assez en arriere et assez haut pour que le premier plan ne mange pas le
    // cadre : a hauteur d'yeux et colle au sol, les dalles remplissaient tout.
    const derriere = Math.max(0, ici - 0.1);
    const devant = Math.min(0.995, ici + 0.06);
    const pc = courbe.getPointAt(derriere);
    const pv = courbe.getPointAt(devant);

    camera.position.set(
      pc.x + Math.sin(t * 0.13) * 0.16,
      3.1 + Math.sin(t * 0.21) * 0.07,
      pc.z,
    );
    camera.lookAt(pv.x, 0.9, pv.z);

    // Prevenir l'interface quand on arrive vraiment sur une station.
    if (ancres.length) {
      const proche = plusProche(ici);
      if (proche !== stationCourante && Math.abs(ancres[proche] - ici) < 0.02) {
        stationCourante = proche;
        surStation(proche);
      }
    }

    // Les lanternes vacillent, chacune a son rythme.
    for (const l of lampes) {
      l.feu.intensity = A.puissanceLanterne
        * (0.86 + Math.sin(t * 2.4 + l.phase) * 0.07 + Math.sin(t * 5.7 + l.phase * 2) * 0.05);
    }

    if (lucioles) {
      const p = lucioles.geometry.attributes.position.array;
      for (let i = 0; i < baseLucioles.length; i += 1) {
        const b = baseLucioles[i];
        p[i * 3] = b.v.x + Math.sin(t * b.vitesse + b.phase) * 0.8;
        p[i * 3 + 1] = b.v.y + Math.sin(t * b.vitesse * 0.8 + b.phase * 1.6) * 0.34;
        p[i * 3 + 2] = b.v.z + Math.cos(t * b.vitesse * 0.55 + b.phase) * 0.6;
      }
      lucioles.geometry.attributes.position.needsUpdate = true;
      lucioles.material.opacity = 0.72 + Math.sin(t * 1.6) * 0.2;
    }

    rendu.render(scene, camera);
    brut = requestAnimationFrame(image);
  }

  dimensionner();
  const surTaille = () => dimensionner();
  window.addEventListener('resize', surTaille);

  const surVisibilite = () => {
    if (document.hidden) {
      if (brut) cancelAnimationFrame(brut);
      brut = null;
    } else if (!brut && !calme) {
      brut = requestAnimationFrame(image);
    }
  };
  document.addEventListener('visibilitychange', surVisibilite);

  if (calme) rendu.render(scene, camera);
  else brut = requestAnimationFrame(image);

  const demonter = () => {
    if (brut) cancelAnimationFrame(brut);
    window.removeEventListener('resize', surTaille);
    document.removeEventListener('visibilitychange', surVisibilite);
    canvas.removeEventListener('pointerdown', surDebut);
    canvas.removeEventListener('pointermove', surDeplacement);
    canvas.removeEventListener('pointerup', surFin);
    canvas.removeEventListener('pointercancel', surFin);
    canvas.removeEventListener('pointerleave', surFin);
    scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          if (m.map) m.map.dispose();
          m.dispose();
        }
      }
    });
    rendu.dispose();
  };

  demonter.allerA = allerA;
  return demonter;
}
