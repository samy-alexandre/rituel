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
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { clone as clonerSquelette } from 'three/examples/jsm/utils/SkeletonUtils.js';

// LA BRUME EST CLAIRE, TOUJOURS.
//
// C'est la correction la plus importante de cette palette. La version
// precedente eloignait vers du vert-noir (0x0a1c16) : le fond s'ASSOMBRISSAIT
// avec la distance, ce qui est la signature d'un niveau de jeu - un espace
// clos dont on devine les murs. Une photographie fait l'inverse : la
// profondeur delave vers la lumiere. Premier plan net, jardin intermediaire
// adouci, arriere-plan presque blanc. C'est ce qui fait qu'un lieu semble
// continuer au-dela du cadre, et ca supprime tout bord de monde sans avoir a
// construire quoi que ce soit au loin.
//
// Et il n'y a plus d'orange. Un soleil orange rasant plus des lanternes
// ambrees, c'est le cliche exact du jeu mobile. Le soir de Rituel est une
// heure bleue - ciel bleu-gris profond, lumiere creme - qui se photographie
// au lieu de se rendre.
const AMBIANCES = {
  soir: {
    haut: 0x2f3d4c,
    bas: 0x8e96a3,
    brume: 0x828c99,
    sol: 0x4b544f,
    cle: 0xf2e8db,
    intensiteCle: 2.6,
    ciel: 0x93a3b5,
    remplissage: 0x59615c,
    lanterne: 0xf7ecd6,
    puissanceLanterne: 2.1,
    exposition: 1.12,
    eau: 0x2e3b45,
    verre: 0xe9e3d7,
    pierre: 0xa2a6a2,
    dalle: 0xacada6,
    feuillage: 0x59654f,
  },
  matin: {
    haut: 0xc6d7e3,
    bas: 0xf4ede1,
    brume: 0xf2ebe1,
    sol: 0x9ca487,
    cle: 0xfff7ea,
    intensiteCle: 3.2,
    ciel: 0xe1eaf1,
    remplissage: 0xbab69c,
    lanterne: 0xfff5e4,
    puissanceLanterne: 0.5,
    exposition: 1.15,
    eau: 0x4a6472,
    verre: 0xefebe1,
    pierre: 0xe3ded2,
    dalle: 0xe1dccf,
    feuillage: 0x7d8a66,
  },
};

// Le point de vue, en unites de monde. 17 de haut pour 15 de recul : le regard
// tombe a 49 degres, dans la fourchette d'une prise de vue en plongee douce.
// A cette inclinaison la ligne d'horizon sort du cadre par le haut, et c'est
// voulu - un horizon, un ciel spectaculaire et une silhouette de decor au fond
// sont trois signaux « niveau de jeu ». Il ne reste que le sol qui se delave
// dans la lumiere, comme le fond d'une nature morte.
// Preset editorial : ~57 degres de plongee a quinze unites. Le cadrage
// precedent, plus large, montrait « le niveau entier » ; celui-ci dit
// « regarde cet endroit ». C'est la difference entre un plan d'ensemble et une
// photographie d'objet.
const HAUTEUR = 12.6;
const RECUL = 8.2;

// Modeles retenus : les plus legers a licence verifiee, dans un style coherent.
// DE VRAIS OBJETS, PAS DES SILHOUETTES.
//
// Les modeles Quaternius etaient du low-poly de jeu : meme detextures et
// reteints, leur geometrie restait lisible comme « asset 3D stylise » - de
// grosses spheres polygonales assemblees. Ceux-ci sont des scans
// photogrammetriques de Poly Haven, en CC0 : une fougere est une fougere, un
// rocher a la surface d'un vrai rocher. C'est le seul moyen d'arreter de
// bricoler des primitives.
const MODELES = {
  fleur: '/models/flower-2zT-C10njmX.glb',
  fleur2: '/models/flower-dYQFgjU5Eqx.glb',
  fougere: '/models/fern_02/fern_02.gltf',
  herbe: '/models/grass_medium_01/grass_medium_01.gltf',
};

// Le ciel qui eclaire la scene. Un HDRI d'un vrai jardin : c'est lui qui donne
// aux matieres leur lumiere indirecte et leurs reflets, et aucun reglage
// manuel de lampes n'approche ce qu'une capture reelle fournit gratuitement.
const CIEL_HDR = '/hdri/jardin_1k.hdr';

// LA VIE.
//
// Un jardin sans un seul etre vivant est un caveau, si soigne soit-il. Ces
// trois-la sont animes (24 a 26 clips chacun) et surtout ils sont COLORES :
// on ne les patine pas. Dans une scene volontairement desaturee, un pelage
// roux est le seul accent, et c'est exactement ce qu'il doit etre - le regard
// va la, se rend compte que quelque chose bouge, et le lieu cesse d'etre une
// image pour devenir un endroit.
const ANIMAUX = {
  biche: '/models/animaux/biche.glb',
  renard: '/models/animaux/renard.glb',
  cerf: '/models/animaux/cerf.glb',
};

// LE PETIT PEUPLE.
//
// Les trois grands portent leurs propres animations ; ceux-la n'en ont aucune,
// et c'est tres bien : un lapin n'a pas besoin d'un squelette pour etre vivant,
// il a besoin de BONDIR. Le mouvement est donc ecrit ici - bonds, trottinement,
// vol - ce qui coute quelques kilo-octets au lieu de plusieurs mega.
const PETITS = {
  papillon: '/models/animaux/papillon.glb',
  lapin: '/models/animaux/lapin.glb',
};

const HAUT = new THREE.Vector3(0, 1, 0);
// Les modeles sont compresses en Draco : leur geometrie n'est plus lisible
// telle quelle, il faut un decodeur. Il pese 700 Ko en WebAssembly, arrive une
// seule fois, et fait gagner bien plus que son poids sur les modeles.
const decodeurDraco = new DRACOLoader();
decodeurDraco.setDecoderPath('/draco/');

const chargeur = new GLTFLoader();
chargeur.setDRACOLoader(decodeurDraco);
const cache = new Map();

// Les animaux gardent leur gltf entier : c'est lui qui porte les animations,
// alors que `charger` ne rend que la scene.
function chargerAnime(url) {
  return new Promise((resolve) => {
    chargeur.load(url, resolve, undefined, () => resolve(null));
  });
}

function charger(url) {
  if (!cache.has(url)) {
    cache.set(url, new Promise((resolve) => {
      chargeur.load(url, (g) => resolve(g.scene), undefined, (err) => {
        // Sans ce message, un chemin faux vide la scene en silence : c'est
        // exactement ce qui est arrive en renommant deux fichiers.
        console.error('modele introuvable :', url, err && err.message);
        resolve(null);
      });
    }));
  }
  return cache.get(url);
}

// UN FICHIER DE VEGETATION CONTIENT PLUSIEURS PLANTES, PAS UNE.
//
// C'est ce qui a mis le telephone a genoux. `grass_medium_01` porte DIX-SEPT
// touffes distinctes dans un seul fichier - 24 700 triangles et 17 dessins - et
// on clonait les dix-sept a chaque fois qu'on voulait une touffe. Semees
// soixante-dix fois, cela faisait a soi seul 1,7 million de triangles et 1 190
// appels de dessin.
//
// On ne prend donc qu'UNE plante du lot, tiree au sort. Le fichier devient une
// banque de variantes - ce qu'il a toujours ete - et chaque exemplaire coute
// dix-sept fois moins cher tout en etant PLUS varie qu'avant.
function unePlante(modele, tirage) {
  const parties = [];
  modele.traverse((o) => { if (o.isMesh) parties.push(o); });
  if (parties.length < 2) return modele.clone(true);
  const choisie = parties[Math.floor(tirage() * parties.length)].clone();
  choisie.position.set(0, 0, 0);
  choisie.rotation.set(0, 0, 0);
  choisie.scale.set(1, 1, 1);
  const g = new THREE.Group();
  g.add(choisie);
  return g;
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

function matierePierre(A) {
  return matierePBR('pierre', 2, A.pierre, 0.95);
}

// PATINER UN MODELE DE JEU.
//
// Un asset low-poly gratuit reste lisible comme un asset de jeu meme sous une
// belle lumiere, et c'est presque toujours sa COULEUR qui le trahit : un vert
// franc, sature, decide par son auteur pour se voir de loin dans un niveau.
// On tire donc chaque matiere vers le vert sauge desature de la palette. Les
// clones partagent leurs matieres avec le modele source : teinter la source
// une fois suffit, et ne coute rien par instance.
function patiner(modele, teinte, force) {
  const cible = new THREE.Color(teinte);
  modele.traverse((o) => {
    if (!o.material) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      // On GARDE la texture. La version precedente la supprimait pour sauver
      // des assets de jeu dont le vert sature trahissait tout ; avec des scans,
      // la retirer detruirait la seule chose qui les rend credibles. On se
      // contente de faire glisser leur teinte vers celle de l'heure.
      if (m.color) m.color.lerp(cible, force);
      if ('roughness' in m) m.roughness = Math.max(m.roughness ?? 1, 0.85);
      if ('metalness' in m) m.metalness = 0;
    }
  });
  return modele;
}

// LE SOL VIENT D'UNE VRAIE MESURE, PLUS D'UN BRUIT PEINT.
//
// Les deux versions precedentes dessinaient le sol au canvas : d'abord des
// sillons de rateau (un motif regulier sur 70 % de l'image - le pire defaut de
// la scene), puis du bruit multi-echelle (mieux, mais toujours un aplat gris
// sans relief). Aucune des deux n'avait ce qu'une surface reelle a : une carte
// de NORMALES et une carte de RUGOSITE. Ce sont elles qui font qu'un grain
// accroche la lumiere rasante et que la surface cesse d'etre du papier peint.
//
// Ici : un sable aerien scanne, en CC0. Trois cartes, 1,3 Mo, et le sol se met
// enfin a exister sous la lumiere.
const chargeurTexture = new THREE.TextureLoader();
const cacheTexture = new Map();

// Une texture chargee une seule fois par couple fichier/repetition. Sans ce
// cache, chaque vasque du chemin retelechargerait ses trois cartes.
function carte(url, repetition, srgb = false) {
  const cle = url + '@' + repetition;
  if (!cacheTexture.has(cle)) {
    const t = chargeurTexture.load(url);
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repetition, repetition);
    t.anisotropy = 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    cacheTexture.set(cle, t);
  }
  return cacheTexture.get(cle);
}

// TOUTE SURFACE PORTE UNE MATIERE MESUREE.
//
// C'etait le defaut que Sam a pointe : le sol avait ses cartes, mais la vasque,
// le flacon, la stele et la terrasse n'etaient que des couleurs unies. Une
// couleur unie ne recoit pas la lumiere - elle la subit. Trois cartes (couleur,
// normales, rugosite) et la meme geometrie se met a exister.
//
// La carte ARM empile occlusion (R), rugosite (V) et metal (B) : Three.js lit
// la rugosite dans le canal vert, ce qui suffit.
function matierePBR(base, repetition, teinte, rugosite = 1) {
  return new THREE.MeshStandardMaterial({
    map: carte(`/textures/${base}_diff.jpg`, repetition, true),
    normalMap: carte(`/textures/${base}_nor.jpg`, repetition),
    roughnessMap: carte(`/textures/${base}_arm.jpg`, repetition),
    color: teinte,
    roughness: rugosite,
    metalness: 0,
  });
}

// Le sol n'est plus du sable. « Le sol ca doit etre de l'herbe non ? comme une
// randonnee » - et c'est juste : un jardin ou l'on marche est vert, un desert
// de sable ne raconte rien. L'herbe donne aussi au vert des plantes une raison
// d'etre la, alors qu'il flottait sur du minéral.
function matiereSol(A, allege = false) {
  const m = matierePBR('herbe', 58, new THREE.Color(A.sol).lerp(new THREE.Color(A.brume), 0.34));
  if (allege) {
    // Le sol occupe la totalite de l'ecran : chaque carte qu'il porte se paie
    // a CHAQUE pixel. Sur telephone on ne garde que la couleur - le relief de
    // l'herbe ne se lit de toute facon pas a cette distance, et les deux
    // cartes retirees sont deux lectures de texture par pixel en moins.
    m.normalMap = null;
    m.roughnessMap = null;
    m.roughness = 0.95;
    m.needsUpdate = true;
  }
  return m;
}

function matiereEau(A) {
  return new THREE.MeshStandardMaterial({
    color: A.eau,
    roughness: 0.03,
    metalness: 0.32,
    envMapIntensity: 1.1,
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
function bassin(A) {
  const g = new THREE.Group();

  // UNE VASQUE EST UN PROFIL TOURNE, PAS UN CYLINDRE.
  //
  // La version precedente empilait un cylindre PLEIN, une paroi et un disque
  // d'eau : le dessus du cylindre masquait l'eau, et il ne restait qu'un galet
  // blanc bombe. Un LatheGeometry fait tourner une coupe autour de son axe -
  // le bord exterieur monte, la levre s'affine, l'interieur redescend. Le creux
  // existe vraiment, donc l'eau se voit, et la levre attrape la lumiere rasante
  // sur toute sa circonference. C'est ce liser clair qui dit « taille ».
  const coupe = [
    [0.001, 0], [0.6, 0], [0.66, 0.27], [0.645, 0.34],
    [0.53, 0.325], [0.46, 0.12], [0.001, 0.1],
  ].map(([x, y]) => new THREE.Vector2(x, y));

  const pierre = matierePBR('pierre', 2, A.pierre, 0.94);
  pierre.side = THREE.DoubleSide;
  const vasqueMesh = new THREE.Mesh(new THREE.LatheGeometry(coupe, 26), pierre);
  g.add(vasqueMesh);

  // L'eau se pose sous la levre. Presque noire et tres lisse : un miroir clair
  // sur un jardin clair ne se voit pas, alors qu'une eau sombre renvoie le ciel
  // et devient le seul point brillant de l'image.
  const eau = new THREE.Mesh(new THREE.CircleGeometry(0.5, 40), matiereEau(A));
  eau.rotation.x = -Math.PI / 2;
  eau.position.y = 0.28;
  g.add(eau);
  return g;
}

// LE FLACON — la station la plus frequente, et c'etait la plus laide.
//
// C'etait un empilement de primitives : une BOITE pour le socle, trois
// cylindres pour le corps, le col et le bouchon. Vu en plongee, l'ensemble
// lisait « cube blanc », et comme serum, soin cible et contour des yeux le
// partagent, on le voyait trois fois par routine.
//
// Ici, un profil tourne, comme la vasque : epaule arrondie, col resserre,
// verre translucide, et une dalle ronde plutot qu'un cube.
function flacon(A) {
  const g = new THREE.Group();

  const dalle = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.37, 0.07, 20), matierePierre(A));
  dalle.position.y = 0.035;
  g.add(dalle);

  const coupe = [
    [0.001, 0], [0.15, 0.008], [0.163, 0.05], [0.158, 0.27],
    [0.118, 0.345], [0.055, 0.4], [0.052, 0.47], [0.001, 0.47],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const corps = new THREE.Mesh(new THREE.LatheGeometry(coupe, 24), matiereVerre(A));
  corps.position.y = 0.07;
  g.add(corps);

  // Le bouchon est mat : c'est le contraste mat/translucide qui fait lire le
  // verre. Deux surfaces brillantes l'une sur l'autre ne disent rien.
  const bouchon = new THREE.Mesh(
    new THREE.CylinderGeometry(0.062, 0.058, 0.085, 18),
    matierePBR('pierre', 3, new THREE.Color(A.pierre).multiplyScalar(0.86), 0.65),
  );
  bouchon.position.y = 0.585;
  g.add(bouchon);
  return g;
}

// LA VASQUE — l'hydratation, le geste qui enveloppe. Meme principe que le
// bassin : un profil tourne, une eau posee sous la levre. Elle s'en distingue
// par sa forme, evasee et montee sur un pied, la ou le bassin est pose a terre.
function vasque(A) {
  const g = new THREE.Group();

  const pied = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.26, 0.3, 18), matierePierre(A));
  pied.position.y = 0.15;
  g.add(pied);

  const coupe = [
    [0.001, 0], [0.5, 0.04], [0.56, 0.19], [0.545, 0.235],
    [0.45, 0.215], [0.36, 0.06], [0.001, 0.045],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const pierre = matierePBR('pierre', 2, A.pierre, 0.94);
  pierre.side = THREE.DoubleSide;
  const coupeMesh = new THREE.Mesh(new THREE.LatheGeometry(coupe, 24), pierre);
  coupeMesh.position.y = 0.29;
  g.add(coupeMesh);

  const eau = new THREE.Mesh(new THREE.CircleGeometry(0.44, 32), matiereEau(A));
  eau.rotation.x = -Math.PI / 2;
  eau.position.y = 0.48;
  g.add(eau);
  return g;
}

// Une pierre dressee : le masque, l'exfoliant, le geste rare et fort.
function stele(A) {
  const g = new THREE.Group();
  const p = new THREE.Mesh(new THREE.BoxGeometry(0.46, 1.05, 0.2), matierePierre(A));
  p.position.y = 0.52;
  p.rotation.z = 0.035;
  g.add(p);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.46, 0.12, 10), matierePierre(A));
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
  const points = [new THREE.Vector3(0, 0, 22)];
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

export async function monterJardin3d(
  canvas,
  etapes,
  moment,
  surStation = () => {},
  surTouche = () => {},
) {
  // TOUT CE QUI COUTE SE REGLE ICI.
  //
  // Un telephone n'a pas seulement moins de puissance : il a une batterie et il
  // chauffe. Une scene qui tourne a 60 images par seconde en continu le fait
  // ralentir au bout d'une minute, quel que soit son processeur - c'est le
  // ralentissement thermique, et c'est souvent lui qu'on prend pour un bug.
  const petitEcran = Math.min(window.innerWidth, window.innerHeight) < 720;
  const densite = petitEcran ? 0.36 : 1;
  // Trente images par seconde suffisent tres largement a une camera qui derive
  // lentement et a des betes qui broutent. C'est deux fois moins de travail
  // pour le processeur graphique, et une image que personne ne distingue.
  const cadence = petitEcran ? 1000 / 31 : 0;
  const A = AMBIANCES[moment] || AMBIANCES.soir;
  const calme = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const soir = moment === 'soir';

  const scene = new THREE.Scene();
  // Reglee pour que la station visee reste nette (~15 % de brume a 24 unites)
  // et que tout ce qui depasse 90 unites ait disparu dans la lumiere. Le bord
  // du sol est a 150 : personne ne le verra jamais.
  scene.fog = new THREE.FogExp2(A.brume, 0.017);
  scene.background = new THREE.Color(A.brume);

  // LA CAMERA FAIT 80 % DU TRAVAIL.
  //
  // C'est le seul reglage qui, a lui seul, fait basculer la lecture de « jeu »
  // a « objet de beaute ». L'ancienne camera etait a 3,1 unites du sol avec un
  // champ de 58 degres : la hauteur d'un personnage, l'ouverture d'un moteur
  // de jeu. On regardait le monde depuis l'interieur, comme un joueur.
  //
  // Ici : haute, tres inclinee (~48 degres), et surtout un champ SERRE. Un
  // champ serre vu de loin est une perspective quasi orthographique - c'est
  // exactement ce qui separe la photographie de produit (au teleobjectif, sans
  // deformation) de la capture de jeu (grand angle, fuyantes violentes). On
  // regarde le jardin, on ne l'habite pas.
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 300);

  const rendu = new THREE.WebGLRenderer({ canvas, antialias: true });
  // LE PIXEL RATIO EST LE PREMIER LEVIER, ET DE LOIN.
  //
  // Mesure sur le telephone de Sam : 20 images par seconde pour 700 000
  // triangles seulement. A ce rapport-la, ce n'est pas la geometrie qui coince
  // mais le REMPLISSAGE - le nombre de pixels multiplie par le cout du nuanceur
  // a chaque pixel. Or rendre a 1,6 fois la resolution, c'est 2,6 fois plus de
  // pixels a calculer, pour une difference que personne ne voit a bout de bras
  // sur une scene aussi douce.
  rendu.setPixelRatio(petitEcran ? 1 : Math.min(window.devicePixelRatio || 1, 1.6));
  // LES OMBRES. Il n'y en avait aucune, et c'est ce qui faisait le plus de mal :
  // sans ombre portee, rien n'est POSE. Les objets flottent au-dessus du sol,
  // la lumiere n'a pas de direction lisible, et l'oeil classe l'image en
  // « rendu 3D » plutot qu'en « photographie ». Le commentaire d'origine les
  // jugeait trop couteuses ; c'etait vrai avec quarante lanternes, ca ne l'est
  // plus avec une carte unique qui suit la station regardee.
  rendu.shadowMap.enabled = !petitEcran;
  rendu.shadowMap.type = THREE.PCFShadowMap;
  // Le ton mapping fait la moitie du rendu : sans lui les hautes lumieres
  // brulent et la scene a l'air d'une capture de moteur de jeu des annees 2000.
  rendu.toneMapping = THREE.ACESFilmicToneMapping;
  rendu.toneMappingExposure = A.exposition;
  rendu.outputColorSpace = THREE.SRGBColorSpace;

  // L'ENVIRONNEMENT VIENT D'UN VRAI CIEL.
  //
  // On derivait l'environnement du degrade peint : mieux que rien, mais un
  // degrade n'a ni nuages, ni soleil, ni variation - donc les reflets restaient
  // plats et les matieres mortes. Un HDRI capture dans un vrai jardin porte
  // toute cette information d'un coup. C'est ce qui separe « rendu 3D » de
  // « photographie », bien plus que n'importe quel reglage de materiau.
  //
  // Il pese 1,7 Mo : on ne l'attend PAS pour afficher la scene. Elle s'allume
  // d'abord avec ses lampes, puis s'enrichit quand le ciel arrive - un premier
  // ecran rapide vaut mieux qu'un bel ecran en retard.
  const pmrem = new THREE.PMREMGenerator(rendu);
  pmrem.compileEquirectangularShader();
  let cielCharge = null;
  new HDRLoader().load(CIEL_HDR, (hdr) => {
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    cielCharge = pmrem.fromEquirectangular(hdr).texture;
    scene.environment = cielCharge;
    // Le fond, lui, reste la brume - voir plus haut.
    hdr.dispose();
    pmrem.dispose();
  }, undefined, () => pmrem.dispose());

  const sol = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), matiereSol(A, petitEcran));
  sol.rotation.x = -Math.PI / 2;
  sol.receiveShadow = true;
  scene.add(sol);

  // Lumiere : une cle rasante tres basse (soleil couchant ou lever), un ciel
  // qui remplit le haut, un rebond depuis le sol. Trois sources, pas une.
  // La part du ciel est volontairement forte : c'est la lumiere indirecte qui
  // fait « photographie en exterieur », alors qu'une cle dominante fait
  // « projecteur de scene ». Et la cle est montee : rasante au ras du sol elle
  // decoupait des silhouettes noires: sous une camera en plongee, il faut
  // qu'elle eclaire aussi le dessus des choses.
  // L'appoint seulement : l'essentiel de l'indirect vient de `scene.environment`.
  scene.add(new THREE.HemisphereLight(A.ciel, A.remplissage, soir ? 0.55 : 0.8));
  const cle = new THREE.DirectionalLight(A.cle, A.intensiteCle);
  cle.castShadow = !petitEcran;
  cle.shadow.mapSize.set(petitEcran ? 512 : 1024, petitEcran ? 512 : 1024);
  cle.shadow.camera.near = 1;
  cle.shadow.camera.far = 62;
  // Une carte d'ombre serree autour de la station regardee : 1024 pixels
  // etales sur tout le jardin donneraient un escalier, etales sur 26 unites
  // ils donnent un contour net que le filtrage adoucit ensuite.
  cle.shadow.camera.left = -13;
  cle.shadow.camera.right = 13;
  cle.shadow.camera.top = 13;
  cle.shadow.camera.bottom = -13;
  cle.shadow.bias = -0.0016;
  cle.shadow.normalBias = 0.025;
  scene.add(cle);
  scene.add(cle.target);

  // Le soleil se deplace avec le regard, sinon la carte d'ombre reste au point
  // de depart et les ombres disparaissent des qu'on avance sur le chemin.
  const ECART_SOLEIL = new THREE.Vector3(soir ? -15 : 15, 15, -13);
  function poserSoleil(centre) {
    cle.position.set(
      centre.x + ECART_SOLEIL.x,
      ECART_SOLEIL.y,
      centre.z + ECART_SOLEIL.z,
    );
    cle.target.position.set(centre.x, 0, centre.z);
    cle.target.updateMatrixWorld();
  }

  const courbe = courbeDuSentier(etapes.length);
  const hasard = hasardDe(etapes.length * 977 + (soir ? 13 : 41));

  const [
    fougere, herbe, fleur, fleur2, biche, renard, cerf,
    papillon, lapin,
  ] = await Promise.all([
    charger(MODELES.fougere), charger(MODELES.herbe),
    charger(MODELES.fleur), charger(MODELES.fleur2),
    chargerAnime(ANIMAUX.biche), chargerAnime(ANIMAUX.renard), chargerAnime(ANIMAUX.cerf),
    charger(PETITS.papillon), chargerAnime(PETITS.lapin),
  ]);

  // On ne patine plus qu'a peine. Le patinage servait a sauver des assets de
  // jeu ; ceux-ci sont des scans, leurs matieres sont mesurees, et les ecraser
  // reviendrait a jeter exactement ce pour quoi on les a pris. Juste un souffle
  // de la teinte de l'heure, pour que tout appartienne au meme lieu.
  if (fougere) patiner(fougere, A.feuillage, 0.62);
  if (herbe) patiner(herbe, A.feuillage, 0.42);

  // PLUS AUCUNE PIERRE POSEE.
  //
  // Il y avait ici un sentier de dalles taillees, semees une a une le long de
  // la courbe. Vu en plongee, ca donnait exactement ceci : une file de
  // polygones clairs, regulierement espaces, sur un fond uni. C'est le dessin
  // litteral d'une checklist, et c'est le langage visuel d'un jeu de
  // plateformes. Le raffiner n'aurait servi a rien - il fallait le supprimer.
  //
  // A la place, une bande minerale CONTINUE : une terrasse de pierre claire qui
  // traverse le jardin, dont la largeur respire legerement pour qu'elle ne
  // ressemble pas a une route. Elle ne compte rien, elle ne segmente rien. Elle
  // ne fait que porter le regard d'une clairiere a la suivante.
  {
    const longueur = courbe.getLength();
    const pas = 14 * (etapes.length + 2);
    const sommets = new Float32Array((pas + 1) * 2 * 3);
    const coord = new Float32Array((pas + 1) * 2 * 2);
    const faces = [];
    const cote = new THREE.Vector3();

    for (let i = 0; i <= pas; i += 1) {
      const t = i / pas;
      const point = courbe.getPointAt(t);
      cote.crossVectors(courbe.getTangentAt(t), HAUT).normalize();
      // La largeur ondule sur deux frequences : une terrasse taillee n'est pas
      // un ruban d'autoroute, mais elle n'est pas non plus decoupee au hasard.
      const demi = (1.3 + Math.sin(t * 31) * 0.2 + Math.sin(t * 8.5) * 0.16) / 2;
      const g = point.clone().addScaledVector(cote, -demi);
      const d = point.clone().addScaledVector(cote, demi);
      sommets.set([g.x, 0.022, g.z, d.x, 0.022, d.z], i * 6);
      // Les coordonnees de texture se mesurent en UNITES DE MONDE, pas en
      // fraction de ruban : sinon la meme tuile se repete cent fois sur la
      // longueur et donne un motif d'ecailles - exactement le motif regulier
      // qu'on vient de chasser du sol.
      const v = (t * longueur) / 25;
      coord.set([0, v, demi * 2 / 25, v], i * 4);
      if (i < pas) {
        const k = i * 2;
        faces.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(sommets, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(coord, 2));
    geo.setIndex(faces);
    geo.computeVertexNormals();

    // « Il ne doit pas ressembler a une route, il doit ressembler a une partie
    // du paysage » : la terrasse n'est donc qu'un peu plus claire et un peu plus
    // lisse que la terre autour. C'est la matiere qui la distingue, pas le
    // contraste.
    // Un vrai sentier de randonnee : la terre tassee et l'herbe rase d'un
    // passage. C'est une texture a part entiere, pas le sol du dessous
    // reteinte - la difference de MATIERE fait tout le travail, et le chemin
    // cesse d'etre une bande peinte pour devenir un endroit ou l'on marche.
    const matTerrasse = matierePBR(
      'sentier',
      13,
      new THREE.Color(A.sol).lerp(new THREE.Color(A.brume), 0.3).lerp(new THREE.Color(A.dalle), 0.4),
      0.95,
    );
    const terrasse = new THREE.Mesh(geo, matTerrasse);
    terrasse.receiveShadow = true;
    scene.add(terrasse);
  }

  const ancres = etapes.map((_, i) => Math.min(0.9, (i + 0.8) / (etapes.length + 0.9)));

  // LA CLAIRIERE DE CHAQUE STATION.
  //
  // Sam : « y'a trop de plantes dans les stations, on les voit plus ». En
  // multipliant la vegetation par quatre grace a l'instanciation, on l'a semee
  // partout - y compris sur le seul objet que l'ecran est cense montrer. Une
  // station a donc son degagement : rien ne pousse a moins de trois unites de
  // l'objet du geste. C'est aussi ce qui fait qu'un jardin entretenu se lit
  // comme entretenu.
  const clairieres = etapes.map((_, i) => {
    const t = ancres[i];
    const p = courbe.getPointAt(t);
    const cote = new THREE.Vector3().crossVectors(courbe.getTangentAt(t), HAUT).normalize();
    const sens = i % 2 === 0 ? 1 : -1;
    return p.clone().addScaledVector(cote, sens * 2.1);
  });

  function loinDesStations(x, z) {
    for (const c of clairieres) {
      if (Math.hypot(c.x - x, c.z - z) < 3.1) return false;
    }
    return true;
  }

  // L'INSTANCIATION : UN SEUL DESSIN POUR TOUTE UNE ESPECE.
  //
  // C'est la technique qui deplace vraiment le plafond. Le cout d'une scene sur
  // telephone ne se mesure pas d'abord en triangles mais en APPELS DE DESSIN :
  // chaque objet pose separement oblige le processeur a re-parler a la carte
  // graphique. Trois mille appels tuent un telephone qui avalerait sans broncher
  // les triangles correspondants.
  //
  // Un InstancedMesh dit l'inverse : « voici une geometrie, et voici les quatre
  // cents endroits ou la dessiner ». Un seul appel. La vegetation ne coute donc
  // presque plus rien a multiplier - on peut en mettre beaucoup PLUS qu'avant,
  // et non moins.
  const matriceTemp = new THREE.Matrix4();
  const quatTemp = new THREE.Quaternion();
  const echelleTemp = new THREE.Vector3();
  const posTemp = new THREE.Vector3();

  // DEUX SORTES DE FICHIERS, DEUX TRAITEMENTS.
  //
  // `grass_medium_01` contient dix-sept touffes DIFFERENTES : on repartit les
  // exemplaires entre elles, et chacune est une plante entiere.
  //
  // Une fleur, elle, est livree en MORCEAUX - petales, tige, feuilles. Les
  // repartir revenait a semer des petales tout seuls, d'ou les grandes formes
  // roses plates qui flottaient au-dessus de l'herbe. Il faut alors dessiner
  // TOUTES les parties aux MEMES endroits, chacune gardant sa place dans la
  // plante.
  function semerInstancie(modele, combien, hauteur, placer, mode = 'variantes') {
    if (!modele) return;
    modele.updateMatrixWorld(true);
    const parties = [];
    modele.traverse((o) => { if (o.isMesh) parties.push(o); });
    if (!parties.length) return;

    // La hauteur de reference : celle de la plante entiere en mode « entier »,
    // celle de chaque variante sinon.
    const boiteTout = new THREE.Box3().setFromObject(modele);
    const hautTout = (boiteTout.max.y - boiteTout.min.y) || 1;

    const lots = parties.map(() => []);
    if (mode === 'entier') {
      const places = [];
      for (let i = 0; i < combien; i += 1) places.push(placer());
      lots.forEach((_, i) => { lots[i] = places; });
    } else {
      for (let i = 0; i < combien; i += 1) {
        lots[Math.floor(hasard() * parties.length)].push(placer());
      }
    }

    const locale = new THREE.Matrix4();
    parties.forEach((partie, i) => {
      const places = lots[i];
      if (!places.length) return;
      const geo = partie.geometry;
      if (!geo.boundingBox) geo.computeBoundingBox();

      let hautRef = hautTout;
      let basRef = boiteTout.min.y;
      if (mode !== 'entier') {
        hautRef = (geo.boundingBox.max.y - geo.boundingBox.min.y) || 1;
        basRef = geo.boundingBox.min.y;
      }

      const tas = new THREE.InstancedMesh(geo, partie.material, places.length);
      tas.castShadow = true;
      tas.receiveShadow = true;
      places.forEach((place, k) => {
        const facteur = (hauteur * place.taille) / hautRef;
        echelleTemp.setScalar(facteur);
        quatTemp.setFromAxisAngle(HAUT, place.tour);
        posTemp.set(place.x, -basRef * facteur, place.z);
        matriceTemp.compose(posTemp, quatTemp, echelleTemp);
        // En mode « entier », chaque morceau garde sa position dans la plante.
        if (mode === 'entier') {
          locale.copy(partie.matrixWorld);
          matriceTemp.multiply(locale);
        }
        tas.setMatrixAt(k, matriceTemp);
      });
      tas.instanceMatrix.needsUpdate = true;
      scene.add(tas);
    });
  }

  // Un emplacement au bord du sentier, du cote qu'on veut, jamais dessus.
  function auBordDuChemin(ecartMin, ecartMax) {
    return () => {
      let x = 0;
      let z = 0;
      // Jusqu'a douze essais pour tomber hors des clairieres. Au-dela on
      // accepte : mieux vaut une plante mal placee qu'une boucle sans fin.
      for (let essai = 0; essai < 12; essai += 1) {
        const t = hasard() * 0.97;
        const p = courbe.getPointAt(t);
        const cote = new THREE.Vector3().crossVectors(courbe.getTangentAt(t), HAUT).normalize();
        const sens = hasard() < 0.5 ? -1 : 1;
        const d = sens * (ecartMin + hasard() * (ecartMax - ecartMin));
        x = p.x + cote.x * d;
        z = p.z + cote.z * d;
        if (loinDesStations(x, z)) break;
      }
      return { x, z, tour: hasard() * Math.PI * 2, taille: 0.75 + hasard() * 0.6 };
    };
  }

  // La vegetation : clairsemee, et toujours EN DEHORS du sentier. Le luxe est
  // dans le vide qu'on laisse, pas dans le nombre de plantes.

  // Beaucoup plus qu'avant, pour deux appels de dessin par espece.
  semerInstancie(herbe, Math.round(230 * densite), 0.9, auBordDuChemin(1.8, 9));
  semerInstancie(fougere, Math.round(85 * densite), 1.4, auBordDuChemin(2.2, 8));
  // Non patinees, volontairement : ce sont les seuls accents vifs.
  semerInstancie(fleur, Math.round(55 * densite), 0.42, auBordDuChemin(1.6, 6.5), 'entier');
  semerInstancie(fleur2, Math.round(40 * densite), 0.38, auBordDuChemin(1.7, 7), 'entier');

  // LE LOINTAIN, DEVANT LE BOUT DU CHEMIN.
  //
  // Tout etait seme le long du sentier, donc dans les dix premieres unites. Au
  // belvedere la camera regarde DEVANT la fin de la courbe : elle y trouvait un
  // desert. Ces silhouettes ne seront jamais vues de pres - elles n'existent
  // que pour peupler cet horizon et donner a la brume de quoi mordre.
  {
    const bout = courbe.getPointAt(1);
    const avant = courbe.getTangentAt(1);
    const cote = new THREE.Vector3().crossVectors(avant, HAUT).normalize();
    const auLoinPlace = (hauteurMin) => () => ({
      x: bout.x + avant.x * (8 + hasard() * 62) + cote.x * ((hasard() - 0.5) * 78),
      z: bout.z + avant.z * (8 + hasard() * 62) + cote.z * ((hasard() - 0.5) * 78),
      tour: hasard() * Math.PI * 2,
      taille: hauteurMin,
    });
    semerInstancie(fougere, Math.round(40 * densite), 2.2, auLoinPlace(0.6 + hasard() * 0.9));
    semerInstancie(herbe, Math.round(60 * densite), 1.5, auLoinPlace(0.6 + hasard() * 0.9));

  }

  // Une lanterne par etape : c'est elle qui dit « il se passe quelque chose
  // ici », et c'est la seule source de couleur chaude du soir.
  // Les ancres : la position sur la courbe de chaque etape. C'est la meme
  // liste qui place les lanternes et qui sert de point d'arret au doigt -
  // sinon le parcours s'arreterait a cote des stations.

  // LE BELVEDERE.
  //
  // Idee de Sam, et c'est la meilleure du lot : il ne se passait RIEN au bout du
  // chemin. On validait la derniere station et on restait le nez sur le sol, en
  // plongee, devant un jardin qui ne disait pas qu'on avait fini.
  //
  // Il y a donc un arret de plus que de stations. En l'atteignant, la camera se
  // releve : la plongee a 57 degres s'ouvre vers l'horizon, le ciel entre dans
  // le cadre pour la seule et unique fois du parcours, et le lieu se revele plus
  // grand qu'on ne le croyait. C'est la recompense, et elle ne coute ni score,
  // ni etoile, ni animation de jeu - juste un mouvement de tete.
  const BELVEDERE = 0.965;
  const arrets = [...ancres, BELVEDERE];

  const lampes = [];
  etapes.forEach((e, i) => {
    const t = ancres[i];
    const p = courbe.getPointAt(Math.min(0.95, t));
    const tan = courbe.getTangentAt(Math.min(0.95, t));
    const cote = new THREE.Vector3().crossVectors(tan, new THREE.Vector3(0, 1, 0)).normalize();
    const sens = i % 2 === 0 ? 1 : -1;

    // L'objet du geste, pose au bord du chemin.
    const composer = OBJET_DE[e.categorie] || vasque;
    const objet = composer(A);
    objet.scale.setScalar(1.45);
    objet.position.copy(p).addScaledVector(cote, sens * 2.1);
    objet.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    objet.rotation.y = -sens * 0.35 + (hasard() - 0.5) * 0.2;
    scene.add(objet);

    // UNE STATION N'EST PAS UN OBJET POSE SUR UN DESERT.
    //
    // La vegetation etait semee au hasard le long du chemin, donc jamais la ou
    // se porte le regard : le sujet se retrouvait seul au milieu du gravier.
    // Trois plantes autour de lui, a des distances et des tailles toutes
    // differentes, lui donnent son assise - c'est l'accompagnement d'une nature
    // morte, pas un decor de fond.
    // L'objet du geste est mis a l'echelle 1,45 : une vasque fait donc pres de
    // deux unites de rayon. Semer sa vegetation a 1,15 la faisait pousser DANS
    // le bassin. On part du bord de l'objet, pas de son centre.
    for (let v = 0; v < 3; v += 1) {
      const modele = hasard() < 0.55 ? herbe : fougere;
      if (!modele) continue;
      const angle = hasard() * Math.PI * 2;
      const distance = 3.4 + hasard() * 1.5;
      const plante = normaliser(unePlante(modele, hasard), 0.55 + hasard() * 0.95);
      plante.position.x = objet.position.x + Math.cos(angle) * distance;
      plante.position.z = objet.position.z + Math.sin(angle) * distance;
      plante.rotation.y = hasard() * Math.PI * 2;
      plante.traverse((n) => { if (n.isMesh) n.castShadow = true; });
      scene.add(plante);
    }

    // LA SOURCE EST INVISIBLE.
    //
    // Il y avait ici un modele de lampion, repete a chaque etape. C'etait le
    // dernier objet ouvertement « jeu » de la scene : une borne de niveau, et
    // en plus la seule chose qui restait orange. On garde sa lumiere et on
    // supprime sa silhouette - une lumiere dont on ne voit pas la source
    // eclaire l'objet du geste au lieu de rivaliser avec lui.

    const feu = new THREE.PointLight(A.lanterne, A.puissanceLanterne, 8.5, 2);
    feu.position.copy(p).addScaledVector(cote, sens * 2.45);
    feu.position.y = 1.15;
    scene.add(feu);
    // `validee` porte le sentiment de reussite : une station appliquee
    // s'ALLUME et le reste. C'est la lumiere qui dit « j'ai fait ca », pas un
    // score ni une etoile - le registre haut de gamme ne survivrait pas a une
    // barre d'experience.
    lampes.push({ feu, phase: i * 1.7, objet, validee: false, montee: 0, sens, fete: -1, onde: null });
  });

  // Les lucioles, seulement le soir : des points additifs qui derivent.
  let lucioles = null;
  let baseLucioles = [];
  if (soir) {
    // Vingt-deux, et non soixante-dix. Un nuage de points lumineux dense est
    // un effet de jeu ; ce qu'on veut ici est la poussiere qu'on voit flotter
    // dans un rai de lumiere sur une photographie - assez rare pour qu'on ne
    // sache pas dire si on l'a vraiment vue.
    const combien = 22;
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
      color: 0xf6f0e4,
      size: 0.07,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    }));
    scene.add(lucioles);
  }

  // « FAUDRAIT VOIR VISUELLEMENT QU'ON PEUT CLIQUER DESSUS ».
  //
  // Rien ne signalait que l'objet du geste repondait au doigt. Un contour
  // surligne ou une pastille auraient ramene le vocabulaire du jeu ; un anneau
  // pose au sol, tres pale, qui respire lentement, dit « ici » sans rien
  // promettre d'autre. Il ne suit QUE la station en cours - deux anneaux
  // allumes en meme temps redeviendraient une liste a cocher.
  const halo = new THREE.Mesh(
    new THREE.RingGeometry(1.05, 1.22, 48),
    new THREE.MeshBasicMaterial({
      color: A.lanterne,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = 0.05;
  halo.visible = false;
  scene.add(halo);

  // ---------------------------------------------------------------------
  // LA VIE DANS LE JARDIN
  // ---------------------------------------------------------------------

  // UNE BETE QUI FAIT SA VIE.
  //
  // Premiere version : un seul clip choisi par expression reguliere sur
  // « eat|graz|idle ». Elle tombait raide. La raison est idiote et vaut d'etre
  // ecrite : **`Death` contient `eat`** (D-eat-h), et c'est le premier clip du
  // fichier. La bete jouait sa mort en boucle.
  //
  // Corrige, mais surtout remplace : une seule animation en boucle, meme la
  // bonne, se repere en trois secondes et fait automate. Ici la bete enchaine
  // des occupations tirees au sort - brouter longtemps, relever la tete,
  // marcher un peu - avec un fondu entre les deux. Elle ne fait rien d'utile,
  // et c'est exactement le but : elle vit a cote, sans nous attendre.
  const betes = [];

  function poserAnimal(gltf, hauteur, t, ecart) {
    if (!gltf || !gltf.scene) return;
    const p = courbe.getPointAt(t);
    const cote = new THREE.Vector3().crossVectors(courbe.getTangentAt(t), HAUT).normalize();
    const o = normaliser(gltf.scene, hauteur);
    o.position.x = p.x + cote.x * ecart;
    o.position.z = p.z + cote.z * ecart;
    o.rotation.y = hasard() * Math.PI * 2;
    o.traverse((n) => { if (n.isMesh) { n.castShadow = true; n.frustumCulled = false; } });
    scene.add(o);

    const mixeur = new THREE.AnimationMixer(o);
    // Chaque clip existe en double dans ces fichiers, avec et sans le prefixe
    // de l'armature. On ne garde que le premier de chaque nom.
    const actions = {};
    for (const clip of gltf.animations || []) {
      const nom = clip.name.split('|').pop();
      if (!actions[nom]) actions[nom] = mixeur.clipAction(clip);
    }

    const repertoire = [
      { nom: 'Eating', min: 8, max: 16 },
      { nom: 'Idle', min: 4, max: 9 },
      { nom: 'Idle_2', min: 3, max: 7 },
      { nom: 'Idle_Headlow', min: 4, max: 8 },
      { nom: 'Idle_2_HeadLow', min: 4, max: 8 },
      { nom: 'Walk', min: 3, max: 6, avance: 0.45 },
    ].filter((c) => actions[c.nom]);
    if (!repertoire.length) return;

    const bete = {
      objet: o,
      mixeur,
      ancre: o.position.clone(),
      courant: null,
      action: null,
      reste: 0,
      changer() {
        // Jamais deux fois la meme occupation d'affilee.
        let suivant = this.courant;
        for (let i = 0; i < 6 && suivant === this.courant; i += 1) {
          suivant = repertoire[Math.floor(hasard() * repertoire.length)];
        }
        const action = actions[suivant.nom];
        action.reset().play();
        if (this.action && this.action !== action) this.action.crossFadeTo(action, 0.7, false);
        this.action = action;
        this.courant = suivant;
        this.reste = suivant.min + hasard() * (suivant.max - suivant.min);
      },
      vivre(dt) {
        this.mixeur.update(dt);
        this.reste -= dt;
        if (this.reste <= 0) this.changer();
        if (!this.courant || !this.courant.avance) return;

        const y = this.objet.rotation.y;
        this.objet.position.x += Math.sin(y) * this.courant.avance * dt;
        this.objet.position.z += Math.cos(y) * this.courant.avance * dt;

        // Elle reste dans son coin : au-dela, elle se retourne doucement vers
        // son point de depart. Sans cela elle finirait par traverser le jardin
        // et sortir du monde.
        const dx = this.ancre.x - this.objet.position.x;
        const dz = this.ancre.z - this.objet.position.z;
        if (Math.hypot(dx, dz) > 16) {
          const vers = Math.atan2(dx, dz);
          let ecartAngle = ((vers - y + Math.PI) % (Math.PI * 2)) - Math.PI;
          this.objet.rotation.y += ecartAngle * Math.min(1, dt * 1.1);
        } else {
          this.objet.rotation.y += (hasard() - 0.5) * dt * 0.5;
        }
      },
    };
    // Chacune demarre a un moment different, sinon elles broutent en choeur.
    bete.changer();
    bete.reste *= hasard();
    if (bete.action) bete.action.time = hasard() * (bete.action.getClip().duration || 1);
    betes.push(bete);
  }

  // Assez loin pour qu'on ne les detaille pas, assez pres pour qu'on les voie.
  poserAnimal(biche, 1.5, 0.3, 3.6);
  poserAnimal(renard, 0.68, 0.66, -3.4);
  poserAnimal(cerf, 1.7, 0.86, 4.6);

  // LE PETIT PEUPLE, ET SA DEAMBULATION.
  //
  // Les papillons etaient deux triangles plats - « c'est encore des SVG », et
  // c'etait vrai. Ce sont maintenant de vrais modeles, comme les autres.
  //
  // Chacun se donne un but quelque part dans une zone LARGE, s'y rend, attend,
  // s'en donne un autre. La zone deborde volontairement du cadre : ils sortent
  // de l'ecran et reviennent, ce qui est la seule facon de faire croire que le
  // jardin continue en dehors de ce qu'on en voit.
  const habitants = [];

  // `source` est soit une scene simple, soit un gltf complet. Dans le second
  // cas la bete porte ses propres animations et on s'en sert : un lapin qui a
  // un clip « Walk » n'a pas besoin qu'on lui invente des bonds.
  function poserPetit(source, hauteur, t, style, combien, portee) {
    if (!source) return;
    const gltf = source.scene ? source : null;
    const modele = gltf ? gltf.scene : source;
    for (let i = 0; i < combien; i += 1) {
      const point = courbe.getPointAt(Math.min(0.97, Math.max(0.02, t + (hasard() - 0.5) * 0.55)));
      // Un modele squelette ne se clone pas comme un maillage : sans
      // SkeletonUtils, tous les exemplaires partagent le meme squelette et
      // bougent donc exactement ensemble.
      const brut = gltf ? clonerSquelette(modele) : modele.clone(true);
      const corps = normaliser(brut, hauteur * (0.8 + hasard() * 0.45));
      const ancre = new THREE.Vector3(
        point.x + (hasard() - 0.5) * portee,
        0,
        point.z + (hasard() - 0.5) * portee,
      );

      // DEUX OBJETS, PAS UN.
      //
      // Le pivot porte la position et le CAP ; le corps porte le tangage et le
      // roulis. Tout mettre sur le meme objet donnait des lapins couches sur le
      // flanc : les angles d'Euler s'appliquent dans le repere global, donc des
      // qu'une bete tournait vers l'est, son tangage la basculait sur le cote.
      const pivot = new THREE.Group();
      pivot.position.copy(ancre);
      pivot.add(corps);
      corps.traverse((n) => { if (n.isMesh) { n.castShadow = true; n.frustumCulled = false; } });
      scene.add(pivot);

      let mixeur = null;
      const actions = {};
      if (gltf && gltf.animations && gltf.animations.length) {
        mixeur = new THREE.AnimationMixer(corps);
        for (const clip of gltf.animations) {
          const nom = clip.name.split('|').pop();
          if (!actions[nom]) actions[nom] = mixeur.clipAction(clip);
        }
        const depart = actions.Idle || Object.values(actions)[0];
        depart.play();
        depart.time = hasard() * (depart.getClip().duration || 1);
      }

      habitants.push({
        objet: pivot,
        corps,
        mixeur,
        actions,
        actionCourante: 'Idle',
        largeur: corps.scale.x,
        ancre,
        style,
        portee,
        but: ancre.clone(),
        attente: hasard() * 4,
        vitesse: style === 'vol' ? 1.5 + hasard() * 1.1 : 0.5 + hasard() * 0.55,
        phase: hasard() * 10,
        hauteurVol: style === 'vol' ? 1.4 + hasard() * 2 : (style === 'volette' ? 0.55 + hasard() * 1.1 : 0),
      });
    }
  }

  function vivreHabitant(h, dt, t) {
    const o = h.objet;
    const dx = h.but.x - o.position.x;
    const dz = h.but.z - o.position.z;
    const reste = Math.hypot(dx, dz);

    if (reste < 0.35) {
      h.attente -= dt;
      if (h.attente <= 0) {
        // Un nouveau but, quelque part dans sa zone. Rien ne l'y oblige, rien
        // ne l'attend : c'est ce qui fait qu'il a l'air de vivre sa vie.
        h.but.set(
          h.ancre.x + (hasard() - 0.5) * h.portee,
          0,
          h.ancre.z + (hasard() - 0.5) * h.portee,
        );
        h.attente = h.style === 'volette' ? hasard() * 0.4
          : h.style === 'vol' ? 0.2 + hasard()
            : 1.5 + hasard() * 6;
      }
    } else {
      const cap = Math.atan2(dx, dz);
      // Il tourne avant d'avancer : pivoter d'un bloc fait patiner un jouet.
      let ecart = ((cap - o.rotation.y + Math.PI) % (Math.PI * 2)) - Math.PI;
      o.rotation.y += ecart * Math.min(1, dt * (h.style === 'volette' ? 9 : 4));
      const irregulier = h.style === 'volette'
        ? 0.45 + Math.abs(Math.sin(t * 5 + h.phase)) * 1.5
        : 1;
      const pas = Math.min(reste, h.vitesse * irregulier * dt);
      o.position.x += Math.sin(o.rotation.y) * pas;
      o.position.z += Math.cos(o.rotation.y) * pas;
    }

    const bouge = reste > 0.35;

    // Une bete qui porte ses propres clips les utilise : on bascule entre
    // marcher et attendre, avec un fondu court. Rien de procedural ici.
    if (h.mixeur) {
      h.mixeur.update(dt);
      const voulu = bouge ? (h.actions.Walk ? 'Walk' : 'Run') : 'Idle';
      if (voulu !== h.actionCourante && h.actions[voulu]) {
        const suivante = h.actions[voulu];
        suivante.reset().play();
        const avant = h.actions[h.actionCourante];
        if (avant && avant !== suivante) avant.crossFadeTo(suivante, 0.3, false);
        h.actionCourante = voulu;
      }
      return;
    }

    if (h.style === 'bond') {
      // Le lapin ne marche pas : il pousse, plane, retombe. La valeur absolue
      // d'un sinus donne exactement cette courbe-la.
      const saut = Math.abs(Math.sin(t * 4.5 + h.phase));
      o.position.y = bouge ? saut * 0.26 : 0;
      h.corps.rotation.x = bouge ? -saut * 0.2 : 0;
    } else if (h.style === 'trottine') {
      o.position.y = bouge ? Math.abs(Math.sin(t * 9 + h.phase)) * 0.04 : 0;
    } else if (h.style === 'vol') {
      // Meme ruse que le papillon : vu du dessus, des ailes qui battent sont
      // une envergure qui se resserre et s'ouvre. Plus lentement qu'un
      // papillon, avec des plane entre deux series de battements.
      const serie = 0.5 + 0.5 * Math.sin(t * 0.7 + h.phase);
      const battement = 1 - serie * 0.45 * Math.abs(Math.cos(t * 7 + h.phase));
      h.corps.scale.x = h.largeur * battement;
      o.position.y = h.hauteurVol + Math.sin(t * 1.7 + h.phase) * 0.45;
      h.corps.rotation.z = Math.sin(t * 2.3 + h.phase) * 0.22;
    } else if (h.style === 'volette') {
      // LE BATTEMENT, SANS SQUELETTE.
      //
      // Le modele est un seul maillage : ses ailes ne sont pas des objets
      // separes, on ne peut pas les faire pivoter. Mais vu de dessus - et la
      // camera est en plongee - un papillon qui bat des ailes ne fait qu'une
      // chose : son envergure se resserre et s'ouvre. Ecraser l'axe de
      // l'envergure donne donc exactement la bonne lecture, pour un cosinus.
      const battement = 0.28 + 0.72 * Math.abs(Math.cos(t * 11 + h.phase));
      h.corps.scale.x = h.largeur * battement;
      // Et il ne plane jamais : il monte, decroche, repart de travers.
      o.position.y = h.hauteurVol
        + Math.sin(t * 2.9 + h.phase) * 0.26
        + Math.sin(t * 6.7 + h.phase * 2) * 0.11
        + Math.sin(t * 13.3 + h.phase) * 0.035;
      h.corps.rotation.z = Math.sin(t * 3.4 + h.phase) * 0.42;
    }
  }

  poserPetit(papillon, 0.19, 0.4, 'volette', 5, 5);
  poserPetit(lapin, 0.36, 0.45, 'anime', 3, 5);

  // ---------------------------------------------------------------------
  // Le parcours. C'est ce qui separe un decor d'un produit : on AVANCE sur le
  // chemin avec le doigt, on s'arrete a chaque station, on valide, on repart.
  // ---------------------------------------------------------------------

  // On DEMARRE a la premiere station, on n'y glisse pas. Partir de l'entree du
  // jardin obligeait a regarder la camera avancer toute seule avant de pouvoir
  // agir : une animation d'intro qu'on subit, et le premier ecran de
  // l'application montrait un chemin vide plutot que le premier geste du soir.
  let cible = ancres.length ? ancres[0] : 0;
  let progres = cible; // 0 = entree du jardin, 1 = fin du sentier
  let stationCourante = -1;
  let saisie = null;

  const DEBUT = 0.02;

  // Sur les ARRETS, pas sur les ancres : le belvedere est un point d'arret a
  // part entiere, sinon le doigt glissait dessus et revenait a la derniere
  // station sans qu'on puisse s'y poser.
  function plusProche(p, liste = arrets) {
    let meilleur = 0;
    for (let i = 1; i < liste.length; i += 1) {
      if (Math.abs(liste[i] - p) < Math.abs(liste[meilleur] - p)) meilleur = i;
    }
    return meilleur;
  }

  function poser() {
    // Sans saisie en cours, on glisse vers l'ancre visee : le chemin se cale
    // toujours sur une station, jamais entre deux.
    cible = arrets.length ? arrets[plusProche(progres)] : DEBUT;
  }

  const surDebut = (e) => {
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    saisie = { y, x, depart: progres, quand: performance.now(), bouge: 0 };
    canvas.setPointerCapture?.(e.pointerId ?? 1);
  };

  // TOUCHER L'OBJET, PAS UN BOUTON.
  //
  // Le geste le plus naturel devant un flacon pose sur une pierre est de le
  // toucher. Il fallait viser un mot souligne en bas d'ecran. Un rayon tire
  // depuis le doigt suffit a savoir quelle station on vise ; et comme un objet
  // vu de quinze metres est petit, on accepte aussi un doigt pose a moins de
  // soixante pixels de son centre - on valide une intention, pas un pixel.
  const rayon = new THREE.Raycaster();
  const pointeur = new THREE.Vector2();
  const auMonde = new THREE.Vector3();

  function stationTouchee(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    pointeur.x = ((clientX - r.left) / r.width) * 2 - 1;
    pointeur.y = -((clientY - r.top) / r.height) * 2 + 1;
    rayon.setFromCamera(pointeur, camera);

    for (let i = 0; i < lampes.length; i += 1) {
      if (lampes[i].objet && rayon.intersectObject(lampes[i].objet, true).length) return i;
    }

    let meilleur = -1;
    let plusPres = 60;
    for (let i = 0; i < lampes.length; i += 1) {
      const o = lampes[i].objet;
      if (!o) continue;
      auMonde.copy(o.position);
      auMonde.y += 0.4;
      auMonde.project(camera);
      const ex = (auMonde.x * 0.5 + 0.5) * r.width;
      const ey = (-auMonde.y * 0.5 + 0.5) * r.height;
      const d = Math.hypot(ex - (clientX - r.left), ey - (clientY - r.top));
      if (d < plusPres) { plusPres = d; meilleur = i; }
    }
    return meilleur;
  }

  const surDeplacement = (e) => {
    if (!saisie) return;
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    saisie.bouge = Math.max(saisie.bouge, Math.hypot(x - saisie.x, y - saisie.y));
    // Glisser vers le HAUT fait avancer : le geste suit le chemin qui defile,
    // comme on pousserait le decor derriere soi.
    const delta = (saisie.y - y) / canvas.clientHeight;
    progres = Math.max(0, Math.min(0.97, saisie.depart + delta * 0.85));
    cible = progres;
    e.preventDefault();
  };

  const surFin = (e, vraiRelachement = false) => {
    if (!saisie) return;
    // Un appui court et immobile est un TAP, pas un glissement avorte.
    const bref = performance.now() - saisie.quand < 450 && saisie.bouge < 9;
    const px = e && (e.changedTouches ? e.changedTouches[0].clientX : e.clientX);
    const py = e && (e.changedTouches ? e.changedTouches[0].clientY : e.clientY);
    saisie = null;
    poser();
    if (!vraiRelachement || !bref) return;
    if (!Number.isFinite(px) || !Number.isFinite(py)) return;
    try {
      const i = stationTouchee(px, py);
      if (i >= 0) surTouche(i);
    } catch (err) {
      // Un doigt ne doit jamais pouvoir casser la scene.
      console.warn('station touchee :', err);
    }
  };

  canvas.style.touchAction = 'none';
  canvas.addEventListener('pointerdown', surDebut);
  canvas.addEventListener('pointermove', surDeplacement, { passive: false });
  canvas.addEventListener('pointerup', (e) => surFin(e, true));
  canvas.addEventListener('pointercancel', surFin);
  canvas.addEventListener('pointerleave', surFin);

  // Le halo suit la station regardee, et s'eteint des qu'elle est appliquee.
  function poserHalo(index) {
    const l = lampes[index];
    if (!l || !l.objet || l.validee) { halo.visible = false; return; }
    halo.position.set(l.objet.position.x, 0.05, l.objet.position.z);
    halo.visible = true;
  }

  // Aller a une station donnee, appele depuis l'interface.
  function allerA(index) {
    if (index < 0 || index >= ancres.length) return;
    cible = ancres[index];
  }

  let brut = null;
  // Le decalage de cadrage se rattrape en douceur : les stations alternent de
  // part et d'autre du sentier, et basculer d'un coup ferait un a-coup.
  let decal = (lampes.length ? lampes[0].sens : 1) * 1.15;
  let tPrecedent = 0;
  let derniereImage = 0;

  // MODE MESURE : ouvrir /?perf affiche la cadence reelle et le cout de la
  // scene, en haut a gauche. Sans telephone sous la main, c'est le seul moyen
  // de savoir ce qui se passe vraiment chez la personne qui trouve que « ca
  // bug » - un chiffre vaut mieux qu'une supposition.
  const mesure = /[?&]perf(=|&|$)/.test(window.location.search)
    ? document.createElement('div')
    : null;
  if (mesure) {
    mesure.style.cssText = 'position:fixed;top:8px;left:8px;z-index:99;'
      + 'font:11px/1.45 ui-monospace,monospace;background:rgba(0,0,0,.72);color:#7dff9b;'
      + 'padding:7px 9px;border-radius:7px;white-space:pre;pointer-events:none';
    document.body.appendChild(mesure);
    // En mode mesure seulement : de quoi inspecter la scene depuis la console.
    window.__scene = scene;
    window.__rendu = rendu;
  }
  let imagesMesurees = 0;
  let debutMesure = performance.now();
  const t0 = performance.now();

  function dimensionner() {
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    rendu.setSize(r.width, r.height, false);
    camera.aspect = r.width / r.height;
    camera.updateProjectionMatrix();
  }

  function image(maintenant) {
    brut = requestAnimationFrame(image);
    if (cadence && maintenant - derniereImage < cadence) return;
    derniereImage = maintenant;

    const t = (maintenant - t0) / 1000;
    // Le pas de temps se calcule ICI, avant tout ce qui s'en sert. Declare plus
    // bas, il etait dans sa zone morte temporelle au moment ou l'animation de
    // validation le lisait : cliquer sur une station levait donc une exception
    // qui arretait net la boucle de rendu - l'ecran se figeait.
    const dt = Math.min(0.05, t - tPrecedent);
    tPrecedent = t;

    // La camera SUIT le parcours : elle se pose un peu en arriere de la
    // position visee, assez pour que la station qu'on atteint reste devant
    // soi plutot que de defiler dans le dos.
    progres += (cible - progres) * 0.09;
    const ici = Math.max(0, Math.min(0.97, progres));

    // Le recul se mesure en UNITES DE MONDE, pas en fraction de parcours :
    // sinon le cadrage changeait avec le nombre d'etapes de la journee, et une
    // routine de trois produits n'etait pas photographiee comme une routine de
    // six. La camera se pose toujours a la meme distance derriere le point
    // regarde, quelle que soit la longueur du chemin.
    const pv = courbe.getPointAt(ici);
    const tan = courbe.getTangentAt(ici);
    const cote = new THREE.Vector3().crossVectors(tan, HAUT).normalize();

    // ON NE CADRE PAS SUR LE CHEMIN.
    //
    // Viser le sentier le placait pile au milieu de l'image, ou il la coupait
    // en deux dans la hauteur, pendant que la station - le vrai sujet - se
    // faisait rogner par le bord. On vise desormais le MILIEU entre le sentier
    // et l'objet du geste : le chemin tombe sur un tiers, l'objet sur l'autre.
    // C'est la regle de composition la plus vieille du monde, et elle vaut plus
    // ici que n'importe quel reglage de matiere.
    // Le relevement : nul sur tout le parcours, complet au belvedere.
    const depart = ancres.length ? ancres[ancres.length - 1] : 0.85;
    const brut01 = (ici - depart) / Math.max(0.001, BELVEDERE - depart);
    const o = Math.max(0, Math.min(1, brut01));
    const ouverture = o * o * (3 - 2 * o);

    const idx = plusProche(ici);
    const sensIci = lampes.length ? lampes[Math.min(idx, lampes.length - 1)].sens : 1;
    // Au belvedere on recentre : le cadrage decale sert a poser un objet dans
    // le tiers de l'image, et il n'y a plus d'objet a poser.
    decal += (sensIci * 1.15 * (1 - ouverture) - decal) * 0.055;
    const vise = pv.clone().addScaledVector(cote, decal);

    const hauteur = HAUTEUR + (2.4 - HAUTEUR) * ouverture;
    const recul = RECUL + (6 - RECUL) * ouverture;

    camera.position.set(
      vise.x - tan.x * recul + Math.sin(t * 0.13) * 0.1,
      hauteur + Math.sin(t * 0.21) * 0.05,
      vise.z - tan.z * recul,
    );
    // En plongee on vise le sol - c'est ce qui incline le regard vers le bas et
    // donne le plan de dessus adouci d'une nature morte. Au belvedere le point
    // regarde part loin devant et remonte : l'horizon entre dans le cadre.
    camera.lookAt(
      vise.x + tan.x * 34 * ouverture,
      0.45 + 2.9 * ouverture,
      vise.z + tan.z * 34 * ouverture,
    );
    poserSoleil(vise);

    // Prevenir l'interface quand on arrive vraiment sur un arret. L'index egal
    // au nombre de stations est le belvedere : l'interface le recoit comme -1 et
    // retire sa legende, parce qu'il n'y a plus de produit a appliquer.
    if (arrets.length) {
      const proche = plusProche(ici);
      if (proche !== stationCourante && Math.abs(arrets[proche] - ici) < 0.02) {
        stationCourante = proche;
        const quelle = proche >= ancres.length ? -1 : proche;
        if (quelle >= 0) poserHalo(quelle); else halo.visible = false;
        surStation(quelle);
      }
    }

    // Les lanternes vacillent, chacune a son rythme. Une station validee monte
    // progressivement vers une lumiere trois fois plus forte : la montee est
    // lente (une seconde et demie) parce qu'un evenement instantane ne se
    // ressent pas - on doit VOIR le jardin s'allumer.
    for (const l of lampes) {
      if (l.validee && l.montee < 1) l.montee = Math.min(1, l.montee + 0.011);

      // Le halo se pose sur la station en cours, tant qu'elle n'est pas faite.
      if (halo.visible) {
        halo.material.opacity = 0.1 + Math.abs(Math.sin(t * 1.25)) * 0.16;
      }

      if (l.fete >= 0 && l.fete < 1) {
        l.fete = Math.min(1, l.fete + dt * 0.85);
        // Une cloche : l'objet monte vite, marque le sommet, redescend.
        const cloche = Math.sin(Math.min(1, l.fete * 1.5) * Math.PI);
        if (l.objet) l.objet.position.y = l.hauteurBase + cloche * 0.26;
        if (l.onde) {
          const k = 1 + l.fete * 5.5;
          l.onde.scale.set(k, k, 1);
          l.onde.material.opacity = 0.55 * (1 - l.fete);
          if (l.fete >= 1) {
            scene.remove(l.onde);
            l.onde.geometry.dispose();
            l.onde.material.dispose();
            l.onde = null;
          }
        }
      }
      const vacille = 0.86 + Math.sin(t * 2.4 + l.phase) * 0.07
        + Math.sin(t * 5.7 + l.phase * 2) * 0.05;
      // Une station validee s'allume, mais dans un monde clair il suffit de
      // peu : tripler la lumiere brulait la pierre et redonnait a l'instant
      // l'allure d'une recompense de jeu.
      l.feu.intensity = A.puissanceLanterne * vacille * (1 + l.montee * 1.1);
      if (l.montee > 0 && l.objet) {
        // L'objet lui-meme se met a rendre la lumiere qu'il recoit.
        l.objet.traverse((o) => {
          if (o.material && o.material.emissive) {
            o.material.emissive.setHex(A.lanterne);
            o.material.emissiveIntensity = l.montee * 0.32;
          }
        });
      }
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
      lucioles.material.opacity = 0.34 + Math.sin(t * 1.6) * 0.12;
    }

    // Les betes vivent leur vie.
    for (const b of betes) b.vivre(dt);

    for (const h of habitants) vivreHabitant(h, dt, t);

    rendu.render(scene, camera);

    if (mesure) {
      imagesMesurees += 1;
      const ecoule = maintenant - debutMesure;
      if (ecoule > 1000) {
        const i = rendu.info;
        mesure.textContent = [
          `${Math.round((imagesMesurees * 1000) / ecoule)} i/s`,
          `${i.render.calls} dessins`,
          `${(i.render.triangles / 1000).toFixed(0)}k triangles`,
          `x${rendu.getPixelRatio()} px`,
          `${window.innerWidth}x${window.innerHeight}`,
        ].join(String.fromCharCode(10));
        imagesMesurees = 0;
        debutMesure = maintenant;
      }
    }
  }

  // La premiere station est annoncee DES le montage. Attendre que la camera
  // ait fini de converger vers elle laissait une seconde d'ecran muet, ou l'on
  // voit un jardin sans savoir ce qu'on est cense y faire - et sur un telephone
  // qui charge lentement, bien plus d'une seconde.
  if (ancres.length) {
    stationCourante = 0;
    poserHalo(0);
    surStation(0);
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

  if (calme) {
    // Meme sans animation, il faut UNE passe complete : `rendu.render` seul
    // laissait la camera a l'origine, donc une image vide. Qui demande moins de
    // mouvement demande une image fixe, pas une image absente.
    image(t0);
    if (brut) cancelAnimationFrame(brut);
    brut = null;
  } else {
    brut = requestAnimationFrame(image);
  }

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

  // Allumer une station, et emmener le parcours a la suivante : le geste
  // « appliqué » doit faire AVANCER, sinon on reste devant ce qu'on vient de
  // finir et rien ne dit que le chemin progresse.
  demonter.valider = (index, celebrer = true) => {
    const l = lampes[index];
    if (!l || l.validee) return;
    l.validee = true;
    halo.visible = false;

    // LA RECOMPENSE, SANS ETOILE NI SCORE.
    //
    // L'objet se souleve d'un souffle et retombe, et une onde part de son pied.
    // C'est tout. Une gerbe d'etincelles ou un « +1 » ramenerait l'ecran au jeu
    // de progression qu'on a passe la journee a en sortir - ici, ce qu'on veut
    // dire est « c'est fait », pas « bravo ».
    if (celebrer && l.objet) {
      l.fete = 0;
      l.hauteurBase = l.objet.position.y;
      const onde = new THREE.Mesh(
        new THREE.RingGeometry(0.55, 0.68, 44),
        new THREE.MeshBasicMaterial({
          color: A.lanterne,
          transparent: true,
          opacity: 0.6,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
      onde.rotation.x = -Math.PI / 2;
      onde.position.set(l.objet.position.x, 0.06, l.objet.position.z);
      scene.add(onde);
      l.onde = onde;
    }

    // Assez de temps pour voir l'objet retomber avant que la camera reparte.
    if (index + 1 < ancres.length) setTimeout(() => allerA(index + 1), celebrer ? 1500 : 700);
  };

  demonter.toutesValidees = () => lampes.length > 0 && lampes.every((l) => l.validee);

  return demonter;
}
