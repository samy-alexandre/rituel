// Domaine « Voyage du jour » — scène peinte du jardin où l'on marche le long d'un chemin,
// médaillons produits cliquables, célébration finale. Extrait de app.legacy.js (Phase B),
// déplacé VERBATIM (octets identiques ; indentation héritée conservée).
// État privé au module : vyState.
// Dépendances héritées lues en identifiant nu, résolues via l'objet global :
//  - CM_PAINT et VY_POLY : constantes PARTAGÉES avec le domaine rituel (cm), laissées dans
//    app.legacy.js et exposées sur window (window.CM_PAINT / window.VY_POLY) ;
//  - currentPeriod : état partagé du moment courant, initialisé dans core/state.js et
//    mis en miroir sur window à chaque changement (switchPeriod) ;
//  - fonctions héritées (signedPhoto, showToast, updateTodayEntry, applyRoutineState, …)
//    déclarées au niveau supérieur, déjà globales.

// ===================== VOYAGE DU JOUR =====================
let vyState = null;

// Polyligne du chemin en pixels écran + longueurs cumulées (pour marcher dessus)
function vyGeom(f, moment) {
  const raw = VY_POLY[moment] || VY_POLY.matin;
  const pts = raw.map(function (q) {
    return [f.offX + (q[0] / 100) * f.rw, f.offY + (q[1] / 100) * f.rh];
  });
  const cum = [0];
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i][0] - pts[i - 1][0],
      dy = pts[i][1] - pts[i - 1][1];
    cum.push(cum[i - 1] + Math.sqrt(dx * dx + dy * dy));
  }
  return { pts: pts, cum: cum, total: cum[cum.length - 1] };
}
function vyAt(g, t) {
  const d = Math.max(0, Math.min(1, t)) * g.total;
  let i = 1;
  while (i < g.cum.length - 1 && g.cum[i] < d) i++;
  const seg = g.cum[i] - g.cum[i - 1] || 1,
    r = (d - g.cum[i - 1]) / seg;
  return [
    g.pts[i - 1][0] + (g.pts[i][0] - g.pts[i - 1][0]) * r,
    g.pts[i - 1][1] + (g.pts[i][1] - g.pts[i - 1][1]) * r,
  ];
}
function vyDoneIds() {
  const list = document.getElementById('routine-' + (vyState ? vyState.moment : 'matin'));
  if (!list) return [];
  return [].slice
    .call(list.querySelectorAll('.routine-item.done'))
    .map(function (x) {
      return x.dataset.pid;
    })
    .filter(Boolean);
}
function vyT(i, n) {
  return (i + 1) / (n + 1);
}

// Sur une scène peinte, une station n'est pas répartie le long de l'allée :
// elle est à sa place calibrée. On cherche le point de l'allée le plus proche.
function vyTPaint(def, poly, key) {
  const st = def.pos[key];
  if (!st) return null;
  // On compare la HAUTEUR seule : un lieu éloigné de l'allée ne doit pas
  // se raccrocher à un point situé bien plus haut.
  let bi = 0,
    bd = 1e9;
  for (let i = 0; i < poly.length; i++) {
    const d = Math.abs(poly[i][1] - st.y);
    if (d < bd) {
      bd = d;
      bi = i;
    }
  }
  return bi / (poly.length - 1);
}

// Le parcours doit toujours avancer, même si deux lieux sont peints
// à la même hauteur : on impose un écart minimal dans l'ordre du rituel.
function vyTList(def, poly, items) {
  let prev = 0.06;
  return items.map(function (p) {
    const t = vyTPaint(def, poly, cmCat2Phase(p.categorie, vyState ? vyState.moment : 'matin'));
    const v = Math.max(t == null ? prev + 0.12 : t, prev + 0.05);
    prev = v;
    return Math.min(v, 0.94);
  });
}

function openVoyage(moment) {
  const m = moment || (typeof currentPeriod !== 'undefined' ? currentPeriod : 'matin');
  const items = (window.__homeRoutine || {})[m] || [];
  if (!items.length) {
    if (typeof showToast === 'function') showToast('Aucune étape pour ce créneau');
    return;
  }
  vyState = { moment: m, items: items };
  try {
    new Image().src = cmTheme(m).img;
  } catch (e) {}
  vyRender();
  const el = document.getElementById('voyage');
  el.classList.add('show');
  document.body.style.overflow = 'hidden';
  vyPhotos();
}
function closeVoyage() {
  const el = document.getElementById('voyage');
  if (el) el.classList.remove('show');
  document.body.style.overflow = '';
  vyState = null;
  if (typeof renderHomeVoyage === 'function') renderHomeVoyage();
}

// Charge les photos produits en tâche de fond puis rafraîchit les pastilles
async function vyPhotos() {
  if (!vyState) return;
  window.__cmPhotos = window.__cmPhotos || {};
  let changed = false;
  for (const p of vyState.items) {
    if (!p.photo_path || window.__cmPhotos[p.id]) continue;
    try {
      const u = await signedPhoto(p.photo_path);
      if (u) {
        window.__cmPhotos[p.id] = u;
        changed = true;
      }
    } catch (e) {}
  }
  if (changed && vyState) vyRender();
}

function vyRender() {
  const el = document.getElementById('voyage');
  if (!el || !vyState) return;
  const m = vyState.moment,
    th = cmTheme(m),
    meta = cmMomentMeta(m),
    items = vyState.items;
  const done = vyDoneIds(),
    n = items.length;
  const nOk = items.filter(function (p) {
    return done.indexOf(p.id) >= 0;
  }).length;
  const nextIdx = items.findIndex(function (p) {
    return done.indexOf(p.id) < 0;
  });

  const vpaint = !!CM_PAINT[m];
  let nodes = vpaint
    ? ''
    : cmNodeHtml('depart', 'cm-muted', '', 'Départ', '', 'data-t="0" data-center="1"', '');
  items.forEach(function (p, i) {
    const isDone = done.indexOf(p.id) >= 0;
    const nm = (p.nom || '').split(' \u00b7 ');
    const url = (window.__cmPhotos || {})[p.id];
    const medal = url ? '<img src="' + url + '" alt="">' : p.emoji || '\ud83e\uddf4';
    const key = cmCat2Phase(p.categorie, m) || (m === 'hebdo' ? 'masque' : 'traiter');
    const cls = (isDone ? 'vy-done ' : '') + (i === nextIdx ? 'vy-next' : '');
    const at =
      'data-t="' + vyT(i, n) + '" data-pid="' + p.id + '" onclick="vyTap(\'' + p.id + '\')"';
    const ck = isDone ? '<span class="vy-check">\u2713</span>' : '';
    nodes += vpaint
      ? cmPaintHtml(key, cls, medal + ck, escapeHtml(nm[0] || ''), at)
      : cmNodeHtml(key, cls, medal, escapeHtml(nm[0] || ''), '', at, ck);
  });
  nodes += vpaint
    ? cmPaintHtml(
        'arrivee',
        'cm-muted',
        '',
        nOk === n ? 'Voyage termin\u00e9 !' : 'Arriv\u00e9e',
        'data-t="1"'
      )
    : cmNodeHtml(
        'arrivee',
        'cm-muted',
        '',
        nOk === n ? 'Voyage termin\u00e9 !' : 'Arriv\u00e9e',
        '',
        'data-t="1"',
        ''
      );

  el.innerHTML =
    '<div class="cm-wrap">' +
    '<div class="cm-scene' +
    (m === 'soir' ? ' cm-soir' : '') +
    '" style="background-image:url(\'' +
    th.img +
    "');--cm-scrim:" +
    th.scrim +
    ';--cm-ink:' +
    th.ink +
    ';--cm-glow:' +
    th.glow +
    ';">' +
    '<button class="cm-back" onclick="closeVoyage()">\u2039</button>' +
    '<div class="cm-head"><div class="cm-title">' +
    escapeHtml(meta.ph) +
    '</div>' +
    '<div class="cm-count">' +
    nOk +
    ' \u00e9tape' +
    (nOk > 1 ? 's' : '') +
    ' sur ' +
    n +
    '</div></div>' +
    '<svg class="vy-trail" preserveAspectRatio="none"><path class="vy-glow" stroke-width="13"></path><path class="vy-core" stroke-width="5"></path></svg>' +
    '<svg class="cm-links" preserveAspectRatio="none"></svg>' +
    '<div class="vy-walker" id="vy-walker">\ud83c\udf31</div>' +
    nodes +
    '</div></div>';
  vyLayout();
}

function vyLayout() {
  const scene = document.querySelector('#voyage .cm-scene');
  if (!scene || !vyState) return;
  const P = VY_POLY[vyState.moment] || VY_POLY.matin;
  const tl = cmHeadBottom(scene);
  const vdef = CM_PAINT[vyState.moment];
  const f = vdef
    ? cmFitPaint(scene, vdef, tl + 58)
    : cmFitScene(scene, P[0][1], P[P.length - 1][1], tl + 58);
  if (!f) return;
  const g = vyGeom(f, vyState.moment);
  const done = vyDoneIds(),
    items = vyState.items,
    n = items.length;
  let last = -1;
  items.forEach(function (p, i) {
    if (done.indexOf(p.id) >= 0) last = i;
  });
  const allDone = last === n - 1 && n > 0;
  let tCur;
  if (allDone) tCur = 1;
  else if (last < 0) tCur = 0;
  else if (vdef) {
    tCur = vyTList(vdef, P, items)[last];
  } else tCur = vyT(last, n);

  const svg = scene.querySelector('.vy-trail');
  svg.setAttribute('viewBox', '0 0 ' + f.sw + ' ' + f.sh);
  svg.setAttribute('width', f.sw);
  svg.setAttribute('height', f.sh);
  const d = g.pts
    .map(function (q, i) {
      return (i ? 'L' : 'M') + q[0].toFixed(1) + ' ' + q[1].toFixed(1);
    })
    .join(' ');
  scene.querySelectorAll('.vy-trail path').forEach(function (pa) {
    pa.setAttribute('d', d);
    pa.style.strokeDasharray = g.total;
    pa.style.strokeDashoffset = g.total * (1 - tCur);
  });

  const pl = [];
  scene.querySelectorAll('.cm-node').forEach(function (nd) {
    const pt = vyAt(g, parseFloat(nd.dataset.t));
    pl.push({ x: pt[0], y: pt[1] });
  });
  if (vdef) cmPlacePaint(scene, vdef, f, tl);
  else cmPlaceNodes(scene, f, pl, P, tl);

  const w = document.getElementById('vy-walker');
  if (w) {
    const pt = vyAt(g, tCur);
    w.style.left = pt[0] + 'px';
    w.style.top = pt[1] + 'px';
  }
}

async function vyTap(pid) {
  if (!vyState) return;
  const list = document.getElementById('routine-' + vyState.moment);
  const item = list ? list.querySelector('.routine-item[data-pid="' + pid + '"]') : null;
  if (!item) return;
  const wasDone = item.classList.contains('done');
  const node = document.querySelector('#voyage .cm-node[data-pid="' + pid + '"]');
  if (node) {
    node.classList.toggle('vy-done', !wasDone);
    const bld = node.querySelector('.cm-bld');
    if (bld) {
      const c = bld.querySelector('.vy-check');
      if (!wasDone && !c) {
        const q = document.createElement('span');
        q.className = 'vy-check';
        q.textContent = '\u2713';
        bld.appendChild(q);
      } else if (wasDone && c) {
        c.remove();
      }
    }
  }
  const w = document.getElementById('vy-walker');
  if (w && !wasDone) {
    w.classList.remove('hop');
    void w.offsetWidth;
    w.classList.add('hop');
  }
  vyLayout();
  if (!wasDone) vyPetals(6);
  const items = vyState.items;
  await toggleRoutine(item);
  vyRender();
  const done = vyDoneIds();
  if (
    !wasDone &&
    items.length &&
    items.every(function (p) {
      return done.indexOf(p.id) >= 0;
    })
  )
    vyCelebrate();
}

function vyPetals(n) {
  const spk = ['\ud83c\udf38', '\u2728', '\ud83c\udf3f'];
  for (let i = 0; i < n; i++) {
    const s = document.createElement('div');
    s.className = 'vy-petal';
    s.textContent = spk[i % spk.length];
    s.style.left = 12 + Math.random() * 76 + '%';
    s.style.top = 12 + Math.random() * 20 + '%';
    s.style.animationDelay = Math.random() * 0.35 + 's';
    document.body.appendChild(s);
    setTimeout(function () {
      s.remove();
    }, 3000);
  }
}
function vyCelebrate() {
  if (navigator.vibrate) navigator.vibrate([14, 60, 24]);
  vyPetals(14);
  const spk = ['\u2726', '\u2727', '\ud83c\udf1f', '\ud83d\udcab'];
  for (let i = 0; i < 14; i++) {
    const s = document.createElement('div');
    s.className = 'cm-spark';
    s.textContent = spk[i % spk.length];
    s.style.left = '50%';
    s.style.top = '62%';
    const a = Math.random() * Math.PI * 2,
      dd = 80 + Math.random() * 160;
    s.style.setProperty('--dx', Math.cos(a) * dd + 'px');
    s.style.setProperty('--dy', Math.sin(a) * dd - 50 + 'px');
    document.body.appendChild(s);
    setTimeout(function () {
      s.remove();
    }, 1200);
  }
  let w = document.getElementById('cm-wow');
  if (!w) {
    w = document.createElement('div');
    w.id = 'cm-wow';
    w.className = 'cm-wow';
    document.body.appendChild(w);
  }
  const meta = cmMomentMeta(vyState ? vyState.moment : 'matin');
  w.innerHTML =
    '<div class="cm-wow-card"><div class="cm-wow-badge">\ud83c\udf3f</div><div class="cm-wow-t">Tu es arriv\u00e9e au bout \u2728</div>' +
    '<div class="cm-wow-s">' +
    escapeHtml(meta.ph) +
    ' termin\u00e9. Ta plante a fait tout le chemin avec toi \ud83c\udf38</div>' +
    '<button class="cm-wow-btn" onclick="vyWowClose()">Parfait</button></div>';
  setTimeout(function () {
    w.classList.add('show');
  }, 260);
}
function vyWowClose() {
  const w = document.getElementById('cm-wow');
  if (w) w.classList.remove('show');
  closeVoyage();
}

// Pont transitoire : invoquées par des handlers onclick inline (index.html + chaînes
// générées côté hérité) ; résolution contre window au moment de l'appel.
Object.assign(window, {
  vyGeom,
  vyAt,
  vyDoneIds,
  vyT,
  vyTPaint,
  vyTList,
  openVoyage,
  closeVoyage,
  vyPhotos,
  vyRender,
  vyLayout,
  vyTap,
  vyPetals,
  vyCelebrate,
  vyWowClose,
});
