# Handoff — Rituel, 2026-09-08

Session consacree a l'ecran « Aujourd'hui » : sa composition, sa 3D, et sa
tenue sur telephone. Tout est pousse sur `main` (Vercel deploie tout seul).

---

## 1. Ce que Sam a dit, dans ses mots

> « c'est eclate » · « c'est encore de la merde » · « tellement fade, y'a pas de
> vie » · « ca bug de fou » · « faut pas oublier le rituel c'est le truc
> principal, c'est pas la scene 3D »

Le dernier compte plus que les autres : **la 3D a mange toute la session, et le
produit est le moteur de decision, pas le jardin.**

---

## 2. Ce qui a change

**La composition.** L'ecran etait une vignette 3D dans une carte, une liste
1-2-3-4-5, un scroll. C'est desormais le monde en plein ecran, une station a la
fois, deux legendes posees dessus. Les raisons vivent dans un panneau tire par
le bas. Verdict de ChatGPT sur l'ancien ecran : « detruire, pas corriger ».

**Le rendu.** Camera haute au champ serre (plongee au teleobjectif, pas grand
angle a hauteur d'homme), brume qui delave vers le CLAIR, plus une trace
d'orange, vraies matieres mesurees (Poly Haven, CC0), HDRI reel, scans
photogrammetriques. Les dalles ont ete **supprimees** plutot qu'ameliorees.

**La vie.** Biche, renard, cerf animes qui enchainent des occupations tirees au
sort ; lapin a quatorze animations ; papillons ; fleurs gardees vives.

**Deux gestes.** Le *belvedere* (idee de Sam) : au bout du chemin la camera se
releve et l'horizon entre dans le cadre, une seule fois. Et l'objet de la
station se **touche** pour valider - halo qui respire, l'objet se souleve, une
onde part de son pied.

---

## 3. La performance, mesuree

| | avant | apres |
|---|---|---|
| draw calls | 3 965 | ~195 |
| triangles / image | 3,46 M puis 23,6 M | 1,56 M (desktop) / ~700 k (mobile) |
| assets | 22 Mo | ~5 Mo |

**Ouvrir `/?perf`** affiche images/s, dessins, triangles, ratio de pixels et
taille d'ecran. C'est ce qui a permis de trouver chaque cause en trois secondes.
**A garder.**

Derniere mesure de Sam : **20 i/s pour 700 k triangles**. A ce rapport-la le
goulot n'est pas la geometrie mais le REMPLISSAGE. D'ou, sur petit ecran :
ratio de pixels a 1, sol sans carte de normales ni de rugosite, **ombres
coupees**, densite a 36 %. **Pas encore reverifie sur le telephone de Sam.**

---

## 4. Pieges payes dans cette session

- `gltf-transform optimize` **fusionne les maillages** : les 17 touffes du
  fichier d'herbe sont devenues un bloc de 24 730 triangles, et chaque touffe
  posee les dessinait toutes les dix-sept. C'est ce qui a fait 23,6 M.
- Un fichier de vegetation contient **plusieurs plantes** ; un fichier de fleur
  contient **les morceaux d'une seule**. Deux traitements differents.
- `Death` contient `eat` : choisir un clip d'animation par sous-chaine faisait
  jouer leur mort aux animaux en boucle.
- Les angles d'Euler s'appliquent dans le repere **global** : cap et tangage sur
  le meme objet couchaient les lapins sur le flanc. Il faut un pivot.
- `map` est un **multiplicateur** de `color` : teinter les deux eleve la couleur
  au carre.
- `scene.environment` remplace l'eclairage indirect : cumule avec une hemisphere
  forte, tout part en blanc et **les ombres disparaissent**.
- Un HDRI equirectangulaire **en fond** montre ce qu'il y avait autour de
  l'appareil, pas un ciel (le jardin chinois donnait un ciel vert).
- Un `const` declare apres la boucle qui s'en sert : zone morte temporelle, donc
  exception dans la boucle de rendu et ecran fige. C'etait le crash au clic.
- `charger()` avalait les erreurs : deux fichiers renommes ont vide toute la
  vegetation **sans un mot** dans la console.
- `document.hidden` fige `requestAnimationFrame` : toute mesure de FPS dans un
  onglet en arriere-plan vaut zero, et le screenshot ne montre que la premiere
  image. Parade dans `feedback_onglet_arriere_plan_fige_raf`.

---

## 5. Ce qui vient ensuite, par ordre

1. **Reverifier la perf sur le telephone de Sam** (`/?perf`). Si c'est encore
   sous 30 i/s, le suspect suivant est le nombre de feuilles transparentes qui
   se superposent, puis l'IBL du HDRI.
2. **Les onglets Historique et Stats.** Sam les reclame et **le code existe
   deja** dans `src/features/` : `datepicker`, `journal`, `habits`, `cycle`,
   `monthly-letter` pour l'historique ; `insights`, `eclat`, `eclat-graph`,
   `bilan5`, `badges` pour les stats. Ils tournent encore sur `classique.html`,
   ils ne sont juste pas branches sur la v2.
3. **Lea.** Elle n'a toujours ni corps ni place. La 3D a ete essayee et
   **retiree** : le seul personnage humain en CC0 est du low-poly de jeu, et
   desature il devient une figurine de cire. Sam : « je veux pas du low poly ».
   Une illustration 2D (le registre de Duolingo, Finch, Headspace) vaudra mieux
   que n'importe quel modele gratuit.
4. **Couper le rendu quand rien ne bouge** - gratuit, et regle la chauffe.
5. **Le paywall serveur** reste contournable depuis la console. C'est toujours
   ce qui bloque les 1500 EUR.

---

## 6. Rappels qui n'ont pas change

- Lea tourne sur Engy, modele **`deepseek-v4-flash-0731`** - le nom exact compte.
- `index.html` **est** la v2 ; `classique.html` garde l'ancienne app.
- Le moteur decide, Lea explique. `npm test` : 17 tests, tous verts.
