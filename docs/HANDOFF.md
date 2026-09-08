# Handoff — Rituel, 2026-09-07

Ecrit en fin de session, credits epuises. Tout ce qu'il faut pour reprendre
sans relire la conversation.

---

## 1. Ce que Sam veut, dans ses mots

> « 1500 €/mois en ligne, sans contact client, sans travail quotidien, sans
> montrer mon visage » — pour voyager et aider sa famille.

150 abonnes a 9,99 €/mois = 1500 €. C'est le seul chiffre qui compte.

Sur Rituel precisement :

- « quand je te dis refonte c'est vrai refonte »
- « le plus gros chantier sera bien les chemins ! vraiment ! c'est ca le coeur
  du produit faut un sentiment de reussite »
- « Lea, un agent qui t'aide, c'est l'interet principal de l'app, je veux la
  voir partout »
- Dernier verdict en date : « l'appli est fini a 30% c'est encore nul »

**Sam ne veut pas qu'on lui demande la permission.** Il veut qu'on fasse.
Voir `feedback_rituel_autonomous_execution` en memoire.

---

## 2. Etat reel du produit

En production sur **monrituel.app** (Vercel + Supabase).

| Brique | Etat | Ou |
|---|---|---|
| Moteur de decision | **Solide**, pur, 17 tests (`npm test`) | `src/features/decision/decision.js` |
| App v2 | Vivante, ~900 lignes | `src/v2/main.js` |
| Jardin 3D | Vivant, monte/demonte proprement | `src/v2/jardin3d.js` |
| Lea (chat) | **Repond vraiment** via Engy | `api/lea.js` + `src/v2/lea.js` |
| Memoire serveur | `historique_actifs` en prod, RLS + GRANT verifies | `docs/migration-historique.sql` |
| Rappels push | Code pret, demande apres 1er chemin fini | `src/v2/rappels.js` |
| Paywall | **Client seulement — contournable depuis la console** | — |

Point d'entree : `index.html` **est** la v2. `classique.html` est l'ancienne
app a 44 modules, gardee comme reference. (Piege deja paye : pendant des heures
la refonte vivait sur `refonte.html` que le manifest PWA n'atteignait pas.
`git mv` a corrige.)

Lea tourne sur Engy, modele **`deepseek-v4-flash-0731`** — le nom exact compte,
`deepseek-v4-flash` rend 404 et Lea bascule **silencieusement** sur Anthropic,
dont le credit est a sec. Verifier le nom sur `/v1/models` avant de le changer.

---

## 3. Le chantier suivant : le langage visuel du chemin

C'est la ou la session s'est arretee. Sam a demande d'aller consulter ChatGPT ;
la reponse est le fil **« Evaluer Rituel ou pivoter »** :
`https://chatgpt.com/c/6a9e963d-258c-83ed-870e-e41b25435f20`

### Le test, en une phrase

> Montrez une capture **sans aucune UI**. Si la premiere reaction est « ca
> ressemble a un jeu » → echec. Si « on dirait une pub Dior/Aesop/Le Labo dans
> laquelle je peux me deplacer » → bonne direction.

C'est exactement le mot de Sam sur le chemin actuel : « il est eclatax ».
Le probleme n'est pas l'ambition, **c'est que le langage visuel raconte « jeu »
alors que le produit doit raconter « rituel de beaute premium ».**

### Ce que ChatGPT dit de garder

**Ne surtout pas supprimer la 3D.** Le moteur de decision est deja rationnel et
teste ; la 3D est la couche emotionnelle qui le transforme en produit desirable.

### Les regles concretes lues dans le fil

**Matiere et composition** — surface d'eau parfaitement calme, presque miroir.
Elements vegetaux avec une **vraie variation** de taille et d'orientation. Le
cerveau doit lire « architecture / cosmetique / spa », pas « asset pack 3D ».
(La regularite est ce qui trahit le jeu : des objets identiques poses sur une
grille.)

**Lumiere (point 6)** — surtout **pas** orange + coucher de soleil + lens flare :
« ca devient immediatement jeu mobile ». A la place : matin tres doux, grand
soleil diffus, ombres longues mais extremement douces, AO discret.

**L'information vit dans le monde, pas dans une carte** — un titre grave dans la
scene, « Serum — matin », en typographie tres elegante ; sous-ligne discrete
« 2–3 gouttes · visage legerement humide ». Pas une enorme carte UI posee
par-dessus.

**Typographie (point 11) — « la typographie doit tuer l'esthetique jeu »** :
- a bannir : Inter Bold partout, gros chiffres, boutons massifs, badges, cartes
  avec ombre ;
- a la place : **serif elegante pour les titres, sans-serif tres legere pour les
  informations**.

C'est le changement le moins cher et le plus rentable des quatre : il ne touche
pas la 3D et il retire a lui seul la moitie du signal « jeu ». **Commencer par
la.**

### Honnetete sur cette lecture

J'ai lu les points 5, 6, 10 et 11, plus la conclusion. **Les points 1 a 4, 7 a 9
et ce qui suit le 11, je ne les ai pas lus** — le navigateur s'est deconnecte
avant. Rouvrir le fil et lire le reste avant de coder : il y a probablement la
un ou deux points qui changent l'ordre des travaux.

---

## 4. Pieges deja payes — ne pas les repayer

**3D / Three.js**
- `MeshPhysicalMaterial.transmission` **fige le navigateur** : c'est un rendu
  multi-passe par objet. Remplace par un standard translucide.
- Le montage 3D est asynchrone : changer d'onglet pendant le chargement laissait
  des boucles d'animation orphelines qui s'empilaient. Corrige par un jeton
  `generation` — **le garder** dans toute nouvelle scene.
- Scene plus haute que le viewport → la carte sort de l'ecran. `max-height: 54vh`.

**CSS / DOM**
- `display: flex` ecrase `hidden`. Il faut `[hidden] { display: none; }` explicite.
- `surClic('[data-moment]')` matchait aussi le conteneur `.app` : l'evenement
  remontait et reecrivait l'etat avec la valeur courante. Toujours cibler
  `button[data-moment]`.
- `user-select` sur la carte faisait selectionner du texte au lieu de bouger la
  scene.

**Supabase**
- Les policies RLS decident **quelles lignes**, `GRANT` decide l'acces **a la
  table**. Il faut les deux. Sans le GRANT : `42501 permission denied`, et
  aucune policy ne le rattrape. Verifie en interrogeant vraiment l'API REST.

**Methode**
- Ne pas conclure a partir d'une observation ambigue : j'ai diagnostique un
  chemin bloque alors que Sam interagissait avec pendant mon test (« c moi qui
  est touche dsl »).
- Sam demande le travail **a Claude**, pas a Genesis : « nan mais demande pas a
  genesis mdr ».

---

## 5. Reste a faire, par ordre d'importance

1. **Le langage visuel du chemin** (section 3). Typographie d'abord, puis
   lumiere, puis matiere/variation, puis l'info dans le monde.
2. **Sentiment de reussite** — c'est la demande explicite de Sam sur le chemin :
   « j'ai fait quelque chose aujourd'hui ». Rien de tout ca n'existe encore
   vraiment (serie, progression visible, recompense a la fin du chemin).
3. **Paywall serveur.** Aujourd'hui contournable depuis la console. Le champ
   existe deja : `profiles.is_premium` dans Supabase. Sans ca, l'abonnement ne
   se vend pas — c'est le point qui bloque les 1500 €.
4. **Lea qui agit.** Sam veut qu'elle declenche de vraies actions in-app
   (tool-calling), pas seulement qu'elle parle. Rappel : DeepSeek V4 Flash
   honore `tool_choice` force, Qwen3.6 non (voir `project_engy_capacites_reelles`).
5. **Ambiance du matin jamais vue en 3D** — seul le soir a ete regarde.
6. **Editer un produit** : on ne peut aujourd'hui qu'ajouter ou supprimer.
7. **Vision photo** : pas de Qwen vision sur le compte Engy (7 modeles). Il faut
   un autre fournisseur.
8. **4 avertissements lint** (code mort : `STATION`, `vueSeuil`, `estInvite`,
   plus un preexistant dans `src/ui/sheet.js`).

En parallele, hors Rituel : les **mandalas SVG** sont prets (60 fichiers) mais il
manque les formats DXF/PNG, les visuels de fiche Etsy — et surtout Sam doit
ouvrir la boutique.

---

## 6. Manipulation des secrets — pattern a conserver

Sam a demande d'ajouter la cle Engy a Vercel moi-meme. Methode utilisee, **a
reprendre telle quelle** pour tout secret :

1. lire la valeur depuis `D:\Genesis\.env` ;
2. la transferer par le presse-papier systeme (PowerShell `Set-Clipboard` →
   `Ctrl+V` dans le navigateur) — le secret n'apparait **jamais** en clair dans
   la conversation ni dans une capture d'ecran ;
3. la stocker en type « Secret » cote Vercel ;
4. **vider le presse-papier** ensuite.

---

## 7. Principes qui ont tenu et qu'il faut garder

- **Le moteur decide, Lea explique.** Elle ne recalcule jamais la routine. Un
  conseil de soin qu'on ne peut pas verifier n'a rien a faire dans une appli
  payante.
- **Outil vs LLM** : jamais un modele si un outil deterministe suffit.
- Le mythe vitamine C + niacinamide est **volontairement exclu** du moteur :
  il est demonte, et une affirmation fausse coute plus cher que pas
  d'affirmation du tout.
- Elle ne parle que quand elle a quelque chose a dire. Une presence qui commente
  tout devient une banniere qu'on apprend a ignorer en trois jours.
