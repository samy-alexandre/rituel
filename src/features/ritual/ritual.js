// Domaine « Rituel » — LE cœur de l'app : écran rituel, sélection/aperçu des rituels,
// hub par créneau, cartes parcours, et surtout le CHEMIN immersif (openRituelChemin) avec
// son décor peint, ses stations produits, le panneau de la fleur, les gestes et animations.
// Extrait de app.legacy.js (Phase B), déplacé OCTET POUR OCTET (bloc contigu unique, 119
// fonctions + toutes les constantes CM_* + VY_POLY). État partagé chDraft/rpSlotView/
// currentPeriod/currentRoutineView promu dans core/state.js : les écritures en identifiant nu
// depuis ce module strict s'y résolvent (vérifié). CM_PAINT et VY_POLY restent exposées sur
// window (lues par le module voyage) ; loadRituels reste exposée (lue par reminders).
// Dépendances externes en identifiant nu (via l'objet global) : CATS/CAT_RANK/catLabel
// (hérités), sb, currentUser, showToast, escapeHtml, cmAsk, signedPhoto, home/produits/chat.

// ===== Écran Rituel (choix matin/soir/les deux + aperçu) =====
async function loadRitual() {
  if (!currentUser) return;
  // On ne peuple JAMAIS la liste derrière : le chemin s'ouvre directement (cmEnterRitual a
  // déjà affiché le créneau si les données sont en cache). La liste "Mes rituels" n'est
  // rendue qu'à la demande, via cmBackToList — impossible de l'apercevoir en entrant.
  if (window.__allRituels) return;
  await loadRituels();
  // Premier chargement : on remplace le fondu d'attente par le chemin du créneau courant.
  const slot = rpSlotView === 'hebdo' ? 'matin' : rpSlotView || 'matin';
  const active = pickActive(window.__allRituels || [])[slot];
  if (active) openRituelChemin(active.id, slot, 'view');
  else openRituelChemin(null, slot, 'edit'); // pas de rituel pour ce créneau : on ouvre direct la création
}
// Plus de page « Mes rituels » : toute la navigation entre rituels se fait depuis le panneau
// de la fleur. On reste donc dans le chemin immersif et on ré-affiche le rituel actif de la
// période courante (données rechargées), au lieu d'ouvrir un hub séparé.
async function cmBackToList() {
  if (typeof cmClosePanel === 'function') cmClosePanel();
  const mo = (chDraft && chDraft.moment) || rpSlotView || 'matin';
  window.__allRituels = null;
  if (typeof loadRituels === 'function') await loadRituels();
  if (!window.__cmProds && typeof cmLoadProducts === 'function') await cmLoadProducts();
  rpSlotView = mo;
  if (typeof cmShowSlot === 'function') cmShowSlot(mo);
}

async function recomputeRituelType() {
  if (!currentUser) return;
  const { data } = await sb.from('rituels').select('moment').eq('user_id', currentUser.id);
  const rits = data || [];
  const hasM = rits.some((r) => r.moment === 'matin' || r.moment === 'both');
  const hasS = rits.some((r) => r.moment === 'soir' || r.moment === 'both');
  const t = hasM && hasS ? 'both' : hasM ? 'matin' : hasS ? 'soir' : 'both';
  state.rituelType = t;
  try {
    await sb.from('profiles').update({ rituel_type: t }).eq('id', currentUser.id);
  } catch (e) {}
}

// ===== Routines préfaites =====
const PRESETS = {
  grasse: {
    nom: 'Peau grasse · débutant',
    steps: [
      ['Nettoyant gel doux', 'nettoyant', '🫧'],
      ['Lotion purifiante', 'toner', '💦'],
      ['Sérum niacinamide', 'serum', '✨'],
      ['Crème hydratante légère', 'creme', '🧴'],
      ['Protection SPF (le matin)', 'spf', '☀️'],
    ],
  },
  acne: {
    nom: 'Acné légère',
    steps: [
      ['Nettoyant doux', 'nettoyant', '🫧'],
      ['Soin ciblé imperfections', 'cible', '🩹'],
      ['Crème non comédogène', 'creme', '🧴'],
      ['Protection SPF (le matin)', 'spf', '☀️'],
    ],
  },
  seche: {
    nom: 'Peau sèche',
    steps: [
      ['Nettoyant crème', 'nettoyant', '🫧'],
      ['Sérum hydratant', 'serum', '✨'],
      ['Crème riche', 'creme', '🧴'],
      ['Protection SPF (le matin)', 'spf', '☀️'],
    ],
  },
  rougeurs: {
    nom: 'Rougeurs',
    steps: [
      ['Nettoyant très doux', 'nettoyant', '🫧'],
      ['Sérum apaisant', 'serum', '✨'],
      ['Crème apaisante', 'creme', '🧴'],
      ['SPF minérale (le matin)', 'spf', '☀️'],
    ],
  },
  sensible: {
    nom: 'Peau sensible',
    steps: [
      ['Nettoyant sans parfum', 'nettoyant', '🫧'],
      ['Crème barrière réparatrice', 'creme', '🧴'],
      ['Protection SPF douce (le matin)', 'spf', '☀️'],
    ],
  },
  simple: {
    nom: 'Ultra-simple · 3 étapes',
    steps: [
      ['Nettoyant doux', 'nettoyant', '🫧'],
      ['Crème hydratante', 'creme', '🧴'],
      ['Protection SPF (le matin)', 'spf', '☀️'],
    ],
  },
};
let __presetBusy = false;
async function applyPreset(key) {
  const P = PRESETS[key];
  if (!P || !currentUser || __presetBusy) return;
  __presetBusy = true;
  showToast('Création de ton rituel… 🌱');
  try {
    const { data: mine } = await sb.from('products').select('id,nom').eq('user_id', currentUser.id);
    const byNom = {};
    (mine || []).forEach((p) => (byNom[(p.nom || '').toLowerCase()] = p.id));
    const ids = [];
    for (const [nom, cat, emo] of P.steps) {
      const lk = nom.toLowerCase();
      if (byNom[lk]) {
        ids.push(byNom[lk]);
        continue;
      }
      const { data: ins, error } = await sb
        .from('products')
        .insert({
          user_id: currentUser.id,
          nom,
          categorie: cat,
          emoji: emo,
          in_matin: true,
          in_soir: true,
        })
        .select('id');
      if (error || !ins || !ins[0]) throw error || new Error('insert');
      ids.push(ins[0].id);
      byNom[lk] = ins[0].id;
    }
    const { data: oth } = await sb
      .from('rituels')
      .select('id')
      .eq('user_id', currentUser.id)
      .eq('actif', true);
    const off = (oth || []).map((r) => r.id);
    if (off.length) await sb.from('rituels').update({ actif: false }).in('id', off);
    const { count } = await sb
      .from('rituels')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', currentUser.id);
    await sb.from('rituels').insert({
      user_id: currentUser.id,
      nom: P.nom,
      moment: 'matin',
      produits: ids,
      position: count || 0,
      actif: true,
    });
    window.__allRituels = null;
    showToast('Rituel créé et activé ✨');
    loadRituels();
    if (typeof loadProducts === 'function') loadProducts();
    loadHomeRoutine();
  } catch (e) {
    showToast('Oups, réessaie dans un instant 🌿');
  }
  __presetBusy = false;
}

// ===== Rituel actif (sélection + exclusivité par moment) =====
function pickActive(rituels) {
  const daily = (rituels || []).filter((r) => r.actif && r.moment !== 'hebdo');
  const m = [...daily].reverse().find((r) => r.moment === 'matin' || r.moment === 'both') || null;
  const s = [...daily].reverse().find((r) => r.moment === 'soir' || r.moment === 'both') || null;
  return { matin: m, soir: s };
}
function ensureActiveRituels(rituels) {
  // Un rituel actif maximum PAR créneau (matin / soir). Un "both" occupe les deux. Les hebdo ne comptent pas.
  const daily = rituels.filter((r) => r.moment !== 'hebdo');
  const acts = daily.filter((r) => r.actif);
  const off = [];
  let mT = false,
    sT = false;
  [...acts].reverse().forEach((r) => {
    const wM = r.moment === 'matin' || r.moment === 'both',
      wS = r.moment === 'soir' || r.moment === 'both';
    if ((wM && mT) || (wS && sT)) {
      r.actif = false;
      off.push(r.id);
    } else {
      if (wM) mT = true;
      if (wS) sT = true;
    }
  });
  if (off.length) {
    try {
      sb.from('rituels')
        .update({ actif: false })
        .in('id', off)
        .then(function () {});
    } catch (e) {}
  }
  return rituels;
}
function momentBadge(m) {
  return m === 'matin' ? '☀️ Matin' : m === 'soir' ? '🌙 Soir' : '☀️🌙 Matin & soir';
}
async function openRituelSelect() {
  let rits = window.__allRituels;
  if (!rits) {
    const { data } = await sb
      .from('rituels')
      .select('id,nom,moment,actif')
      .eq('user_id', currentUser.id)
      .order('position', { ascending: true })
      .order('created_at', { ascending: true });
    rits = data || [];
    window.__allRituels = rits;
  }
  const host = document.getElementById('rituel-select-list');
  rits = rits.filter((r) => r.moment !== 'hebdo');
  host.innerHTML = rits
    .map(
      (r) =>
        `<button class="btn-soft" style="display:flex;align-items:center;gap:10px;width:100%;text-align:left;margin-bottom:8px;padding:12px 14px;border-radius:14px;${r.actif ? 'border-color:var(--accent);' : ''}" onclick="selectRituel('${r.id}')"><span style="flex:1;min-width:0;"><span style="display:block;font-size:11px;color:var(--muted);">${momentBadge(r.moment)}</span>${escapeHtml(r.nom || 'Mon rituel')}</span>${r.actif ? '<span style="color:var(--accent);font-weight:700;">✓</span>' : ''}</button>`
    )
    .join('');
  document.getElementById('rituel-select-sheet').classList.add('open');
}
function closeRituelSelect() {
  document.getElementById('rituel-select-sheet').classList.remove('open');
}
async function selectRituel(id) {
  const all = window.__allRituels || [];
  const t = all.find((r) => String(r.id) === String(id));
  if (!t) return;
  const on = [t.id];
  const tM = t.moment === 'matin' || t.moment === 'both',
    tS = t.moment === 'soir' || t.moment === 'both';
  const off = all
    .filter(
      (r) =>
        r.actif &&
        r.id !== t.id &&
        r.moment !== 'hebdo' &&
        t.moment !== 'hebdo' &&
        ((tM && (r.moment === 'matin' || r.moment === 'both')) ||
          (tS && (r.moment === 'soir' || r.moment === 'both')))
    )
    .map((r) => r.id);
  try {
    if (off.length) await sb.from('rituels').update({ actif: false }).in('id', off);
    await sb.from('rituels').update({ actif: true }).in('id', on);
  } catch (e) {
    showToast('Oups, réessaie 🌿');
    return;
  }
  window.__allRituels = null;
  closeRituelSelect();
  showToast('Rituel sélectionné ✨');
  loadHomeRoutine();
  loadRituels();
}

// ===== Coût estimé par mois de la routine en cours =====
// ===== Affichage adaptatif : carte "ton rituel actuel" en haut =====
async function toggleRituelActif(id) {
  const all = window.__allRituels || [];
  const t = all.find((r) => r.id === id);
  if (!t) return;
  const turnOn = !t.actif;
  try {
    if (turnOn && t.moment !== 'hebdo') {
      const tM = t.moment === 'matin' || t.moment === 'both',
        tS = t.moment === 'soir' || t.moment === 'both';
      const off = all
        .filter(
          (r) =>
            r.actif &&
            r.id !== t.id &&
            r.moment !== 'hebdo' &&
            ((tM && (r.moment === 'matin' || r.moment === 'both')) ||
              (tS && (r.moment === 'soir' || r.moment === 'both')))
        )
        .map((r) => r.id);
      if (off.length) await sb.from('rituels').update({ actif: false }).in('id', off);
    }
    await sb.from('rituels').update({ actif: turnOn }).eq('id', id);
  } catch (e) {}
  loadRituels();
}

// On ne peut pas composer une routine sans avoir de produits
async function hasAnyProduct() {
  if (!currentUser) return false;
  try {
    const { count } = await sb
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', currentUser.id);
    return (count || 0) > 0;
  } catch (e) {
    return true;
  } // en cas de souci réseau, on ne bloque pas
}
function noProductSheet() {
  showToast("Ajoute d'abord tes produits 🧴");
  setTimeout(() => navTo('routine'), 700);
}

// Reprendre la routine d'un créneau pour l'autre (souvent identiques matin/soir)
async function copierRituel(depuis, vers) {
  const rits = window.__allRituels || [];
  const src = rits.find((r) => r.moment === depuis);
  await copierRituelVers(src, vers);
}

// ═══ Menu d'actions d'un rituel (⋯) ═══
let ractId = null;

function openRituelActions(id) {
  ractId = id;
  const rits = window.__allRituels || [];
  const r = rits.find((x) => String(x.id) === String(id));
  if (!r) return;

  const titre = document.getElementById('ract-title');
  if (titre) titre.textContent = r.nom || 'Mon rituel';

  const n = Array.isArray(r.produits) ? r.produits.length : 0;
  let html =
    '<button type="button" class="ract-opt" onclick="ractModifier()">' +
    '<span class="ico">✏️</span><span class="txt">Modifier</span></button>';

  // Copier vers l'autre créneau : toujours proposé (matin ⇄ soir)
  if ((r.moment === 'matin' || r.moment === 'soir') && n) {
    const vers = r.moment === 'matin' ? 'soir' : 'matin';
    const e = vers === 'soir' ? '🌙' : '☀️';
    html +=
      '<button type="button" class="ract-opt" onclick="ractCopier(\'' +
      vers +
      '\')">' +
      '<span class="ico">' +
      e +
      '</span>' +
      '<span class="txt">Copier vers le ' +
      vers +
      '<small>' +
      n +
      ' étape' +
      (n > 1 ? 's' : '') +
      ' · une copie, sans rien effacer</small>' +
      '</span></button>';
  }

  html +=
    '<button type="button" class="ract-opt danger" onclick="ractSupprimer()">' +
    '<span class="ico">🗑️</span><span class="txt">Supprimer</span></button>';

  document.getElementById('ract-list').innerHTML = html;
  document.getElementById('ract-sheet').classList.add('open');
}

function closeRituelActions() {
  document.getElementById('ract-sheet').classList.remove('open');
}

function ractModifier() {
  const id = ractId;
  closeRituelActions();
  setTimeout(() => openRituelEditor(id), 180);
}

async function ractCopier(vers) {
  const rits = window.__allRituels || [];
  const src = rits.find((x) => String(x.id) === String(ractId));
  closeRituelActions();
  if (!src) return;
  await copierRituelVers(src, vers);
}

async function ractSupprimer() {
  const id = ractId;
  closeRituelActions();
  if (
    !(await cmAsk({
      titre: 'Supprimer ce rituel ?',
      texte: 'Le rituel et son parcours seront effacés. Tes produits, eux, ne bougent pas.',
      ok: 'Supprimer',
      annuler: 'Annuler',
      danger: true,
    }))
  )
    return;
  try {
    await sb.from('rituels').delete().eq('id', id);
    window.__allRituels = null;
    await loadRituels();
    showToast('Rituel supprimé 🌸');
  } catch (e) {
    showToast('Oups : ' + (e.message || 'réessaie'));
  }
}

// Copie les étapes d'un rituel vers l'autre créneau
async function copierRituelVers(src, vers) {
  if (!currentUser || !src) return;
  const prods = Array.isArray(src.produits) ? src.produits : [];
  if (!prods.length) {
    showToast('Rien à copier 🌸');
    return;
  }

  const rits = window.__allRituels || [];
  const nom = vers === 'matin' ? 'Rituel du matin' : 'Rituel du soir';

  try {
    // On AJOUTE une copie : rien n'est supprimé ni écrasé.
    const { data: nouvelle, error } = await sb
      .from('rituels')
      .insert({
        user_id: currentUser.id,
        nom: nom,
        moment: vers,
        produits: prods.slice(),
        actif: true,
        position: rits.length,
      })
      .select()
      .single();
    if (error) throw error;

    // Une seule routine active par créneau : les autres passent en réserve (sans être perdues)
    const aDesactiver = rits
      .filter(
        (r) => r.actif && r.moment === vers && String(r.id) !== String(nouvelle && nouvelle.id)
      )
      .map((r) => r.id);
    if (aDesactiver.length) {
      await sb.from('rituels').update({ actif: false }).in('id', aDesactiver);
    }

    showToast('Copié vers le ' + vers + ' · ajuste-la comme tu veux 🌸');
    window.__allRituels = null;
    await loadRituels();
    rpTabGo(vers);
  } catch (e) {
    showToast('Oups : ' + (e.message || 'réessaie'));
  }
}

// Onglets Matin / Soir / Hebdo : tout est accessible en un geste
function rpTabGo(m) {
  rpSlotView = m;
  document.querySelectorAll('.rt-tab').forEach((b) => b.classList.toggle('sel', b.dataset.m === m));
  renderRituelActuel(window.__allRituels || []);
  updateFab('ritual');
}

// À l'ouverture : on propose le créneau du moment (soir dès midi)
function rpAutoTab() {
  const h = new Date().getHours();
  rpTabGo(h >= 12 ? 'soir' : 'matin');
}

async function openRituelQuick(m) {
  if (!(await hasAnyProduct())) {
    noProductSheet();
    return;
  }
  // Le fond affiche la sous-vue du créneau concerné (que le matin quand on crée du matin, etc.)
  rpSlotView = m;
  rpForceWelcome = false;
  renderRituelActuel(window.__allRituels || []);
  await openRituelEditor();
  rdSetMoment(m);
  const t = document.getElementById('rd-title');
  if (t) t.textContent = 'Nouveau rituel';
  const nomEl = document.getElementById('rd-nom');
  if (nomEl)
    nomEl.placeholder =
      m === 'matin'
        ? 'Rituel du matin'
        : m === 'soir'
          ? 'Rituel du soir'
          : m === 'hebdo'
            ? 'Soin de la semaine'
            : 'Mon rituel';
}

async function renderRituelActuel(rits) {
  const card = document.getElementById('rituel-actuel-card');
  const presets = document.getElementById('rituel-presets-section');
  if (!card) return;
  rits = rits || [];
  updateFab();
  const daily = rits.filter((r) => r.moment !== 'hebdo');
  const hebdos = rits.filter((r) => r.moment === 'hebdo');
  if (presets) presets.style.display = isPremium && !daily.length ? '' : 'none';

  // ── Sous-vue d'un créneau ──
  if (rpSlotView) {
    const mv = rpSlotView;
    const items =
      mv === 'hebdo' ? hebdos : daily.filter((r) => r.moment === mv || r.moment === 'both');
    if (!items.length) {
      const INFO = {
        matin: {
          e: '☀️',
          t: 'Ton rituel du matin',
          d: 'Nettoyer, protéger, préparer ta peau<br>pour la journée qui commence.',
        },
        soir: {
          e: '🌙',
          t: 'Ton rituel du soir',
          d: 'Démaquiller, réparer, laisser ta peau<br>travailler pendant la nuit.',
        },
        hebdo: {
          e: '🧖‍♀️',
          t: 'Ton soin de la semaine',
          d: 'Masque, gommage, sérum intensif…<br>Un rendez-vous, une fois par semaine.',
        },
      };
      const info = INFO[mv] || INFO.matin;

      // Si l'autre créneau a déjà une routine, on propose de la copier
      let copie = '';
      if (mv === 'matin' || mv === 'soir') {
        const autre = mv === 'matin' ? 'soir' : 'matin';
        const src = daily.find((r) => r.moment === autre);
        if (src && Array.isArray(src.produits) && src.produits.length) {
          const eAutre = autre === 'matin' ? '☀️' : '🌙';
          copie =
            '<button class="rt-copy-btn" onclick="copierRituel(\'' +
            autre +
            "','" +
            mv +
            '\')">' +
            eAutre +
            ' Reprendre mon rituel du ' +
            autre +
            '<span class="rt-copy-sub">' +
            src.produits.length +
            " étapes · tu pourras l'ajuster</span>" +
            '</button>';
        }
      }

      card.innerHTML =
        '<div class="rt-empty">' +
        '<div class="rt-empty-ico">' +
        info.e +
        '</div>' +
        '<div class="rt-empty-title">' +
        info.t +
        '</div>' +
        '<div class="rt-empty-sub">' +
        info.d +
        '</div>' +
        '<button class="rt-empty-btn" onclick="openRituelQuick(\'' +
        mv +
        '\')">Créer ce rituel</button>' +
        copie +
        '</div>';
      card.style.display = 'block';
      return;
    }
    const allIds = [
      ...new Set(items.flatMap((r) => (Array.isArray(r.produits) ? r.produits : []))),
    ];
    let pmap = {};
    if (allIds.length) {
      const { data } = await sb.from('products').select('id,nom,emoji').in('id', allIds);
      (data || []).forEach((p) => (pmap[p.id] = p));
    }
    const DAYS_FR = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    function freqLabel(r) {
      const rap = r.rappels;
      if (rap && rap.on && Array.isArray(rap.days) && rap.days.length) {
        return rap.days.length === 7 ? 'Tous les jours' : rap.days.length + ' j/semaine';
      }
      return '';
    }
    function swHtml(r) {
      return (
        '<label class="rp-sw" onclick="event.stopPropagation()"><input type="checkbox" ' +
        (r.actif ? 'checked' : '') +
        ' onchange="toggleRituelActif(\'' +
        r.id +
        '\')"><span class="k"></span></label>'
      );
    }
    function badges(moment) {
      if (moment === 'both')
        return '<span class="rp-badges"><span class="rp-badge-ico matin">☀️</span><span class="rp-badge-ico soir">🌙</span></span>';
      const cls = moment === 'matin' ? 'matin' : 'soir';
      const e = moment === 'matin' ? '☀️' : '🌙';
      return '<span class="rp-badge-ico ' + cls + '">' + e + '</span>';
    }
    function stepRow(p, idx) {
      const parts = (p.nom || '').split(' · ');
      return (
        '<div class="rp-step">' +
        '<div class="rp-thumb"><span class="n">' +
        (idx + 1) +
        '</span>' +
        (p.emoji || '🧴') +
        '</div>' +
        '<div style="flex:1;min-width:0;"><div class="rp-pname">' +
        (parts[0] || '') +
        '</div>' +
        (parts[1] ? '<div class="rp-pbrand">' + parts[1] + '</div>' : '') +
        '</div></div>'
      );
    }
    function dailyCard(r) {
      const label =
        r.moment === 'matin'
          ? 'Rituel du matin'
          : r.moment === 'soir'
            ? 'Rituel du soir'
            : 'Matin & soir';
      const prods = (Array.isArray(r.produits) ? r.produits : [])
        .map((id) => pmap[id])
        .filter(Boolean);
      const n = prods.length;
      const freq = freqLabel(r);
      const sub = n + ' étape' + (n > 1 ? 's' : '') + (freq ? ' · ' + freq : '');
      const steps = r.actif
        ? '<div class="rp-steps">' +
          (n
            ? prods.map(stepRow).join('')
            : '<div style="padding:10px 0 12px;color:var(--muted);font-size:12.5px;">Aucun produit pour l\'instant 🌸</div>') +
          '</div>'
        : '';
      return (
        '<div class="rp-card' +
        (r.actif ? '' : ' off') +
        '">' +
        '<div class="rp-card-head">' +
        '<div class="rp-card-title">' +
        badges(r.moment) +
        '<div style="min-width:0;flex:1;"><span class="rp-card-name">' +
        (r.nom || label) +
        '</span><div class="rp-card-sub">' +
        sub +
        '</div></div></div>' +
        swHtml(r) +
        '<button class="rp-dots" onclick="event.stopPropagation();openRituelActions(\'' +
        r.id +
        '\')" aria-label="Actions">⋯</button>' +
        '</div>' +
        steps +
        '</div>'
      );
    }
    function hebdoRow(r) {
      const day =
        r.rappels && typeof r.rappels.hebdoDay === 'number'
          ? DAYS_FR[r.rappels.hebdoDay]
          : 'dimanche';
      const n = Array.isArray(r.produits) ? r.produits.length : 0;
      return (
        '<div class="rp-hebdo' +
        (r.actif ? '' : ' off') +
        '" onclick="openRituelEditor(\'' +
        r.id +
        '\')" style="cursor:pointer;">' +
        '<span class="av">🧖‍♀️</span>' +
        '<span style="flex:1;min-width:0;"><span class="hb-name" style="display:block;font-size:14.5px;font-weight:600;color:var(--ink);">' +
        (r.nom || 'Soins de la semaine') +
        '</span>' +
        '<span class="hb-sub" style="display:block;font-size:11.5px;color:var(--muted);margin-top:2px;"><span class="day">Le ' +
        day +
        '</span> · ' +
        n +
        ' étape' +
        (n > 1 ? 's' : '') +
        '</span></span>' +
        swHtml(r) +
        '</div>'
      );
    }
    const sortActive = (arr) => [...arr].sort((a, b) => (b.actif ? 1 : 0) - (a.actif ? 1 : 0));
    const lbl =
      mv === 'matin' ? 'Rituel du matin' : mv === 'soir' ? 'Rituel du soir' : 'Soins hebdomadaires';
    let sh = '';
    sh += sortActive(items)
      .map(mv === 'hebdo' ? hebdoRow : dailyCard)
      .join('');
    card.innerHTML = sh;
    card.style.display = 'block';
    return;
  }
}

async function renderRituelCout() {
  if (!currentUser) return;
  const card = document.getElementById('rituel-cout-card');
  const val = document.getElementById('rituel-cout-val');
  const note = document.getElementById('rituel-cout-note');
  if (!card || !val) return;
  const { data } = await sb
    .from('products')
    .select('prix,date_ouverture,date_debut,in_matin,in_soir')
    .eq('user_id', currentUser.id);
  const arr = data || [];
  let total = 0,
    comptes = 0,
    sansDuree = 0,
    utilises = 0;
  arr.forEach(function (p) {
    // Seulement les produits réellement utilisés (matin OU soir)
    if (!(p.in_matin || p.in_soir)) return;
    utilises++;
    const prix = parseFloat(p.prix);
    if (isNaN(prix) || prix <= 0) return;
    // Récupérer la durée de conservation mémorisée (stockée dans date_debut "0001-01-0M")
    let mois = null;
    if (p.date_debut) {
      var mm = parseInt(String(p.date_debut).slice(-2), 10);
      if ([3, 6, 9, 12].indexOf(mm) >= 0) mois = mm;
    }
    if (mois) {
      total += prix / mois; // coût mensuel de ce produit
      comptes++;
    } else {
      sansDuree++;
    }
  });
  if (utilises === 0) {
    card.style.display = 'none';
    return;
  }
  card.style.display = 'block';
  if (comptes === 0) {
    val.textContent = '—';
    note.textContent =
      'Ajoute une durée de conservation à tes produits pour estimer le coût mensuel 🌸';
  } else {
    val.textContent = '~' + Math.round(total) + '€';
    let txt =
      'Basé sur ' + comptes + ' produit' + (comptes > 1 ? 's' : '') + ' avec durée de conservation';
    if (sansDuree > 0) {
      txt += ' · ' + sansDuree + ' sans durée (non compté' + (sansDuree > 1 ? 's' : '') + ')';
    }
    note.textContent = txt;
  }
}

// ===== Parcours beauté : phases + rendu =====
const PC_PHASES = [
  {
    key: 'nettoyer',
    cats: ['nettoyant', 'demaquillant'],
    emoji: '🫧',
    nom: 'Nettoyer',
    moment: 'both',
    optionnel: false,
    why: "On repart d'une peau nette, matin et soir — sans jamais la décaper. Le soir, si tu portes du SPF ou du maquillage, une huile ou un baume d'abord : l'eau seule ne les dissout pas.",
    lea: "Le matin, un nettoyage tout doux suffit. Le soir, masse l'huile à sec 30 secondes avant d'ajouter l'eau, puis enchaîne avec ton nettoyant 🌸",
  },
  {
    key: 'traiter',
    cats: ['toner', 'serum', 'cible', 'yeux', 'masque'],
    emoji: '🎯',
    nom: 'Traiter',
    moment: 'both',
    optionnel: false,
    why: 'Le cœur du soin : les actifs qui répondent à <b>tes besoins spécifiques</b> — lotions, sérums, soins ciblés, contour des yeux et masques.',
    lea: "C'est ici que se joue le travail de fond. Une nouveauté à la fois, et la régularité compte plus que la quantité 🌸",
  },
  {
    key: 'hydrater',
    cats: ['creme'],
    emoji: '💧',
    nom: 'Hydrater',
    moment: 'both',
    optionnel: false,
    why: "On scelle l'hydratation et on renforce la barrière protectrice de la peau.",
    lea: "Même les peaux grasses ont besoin d'hydratation — sinon elles produisent plus de sébum pour compenser.",
  },
  {
    key: 'proteger',
    cats: ['spf'],
    emoji: '☀️',
    nom: 'Protéger',
    moment: 'matin',
    optionnel: false,
    why: "L'étape anti-âge n°1. Le matin, toujours — même quand il fait gris. Le soir, pas de soleil : on saute cette étape.",
    lea: "Le SPF, c'est LE geste qui change tout sur le long terme. Renouvelle-le si tu restes longtemps dehors ☀️",
  },
];

function pcMomentBadge(m) {
  if (m === 'both') return '☀️ 🌙';
  if (m === 'matin') return '☀️ matin';
  if (m === 'soir') return '🌙 soir';
  if (m === 'hebdo') return '🧖‍♀️ hebdo';
  return '';
}
function pcProdChip(p) {
  const parts = (p.nom || '').split(' · ');
  const brand = parts[1] ? ' <span class="pc-prod-b">· ' + parts[1] + '</span>' : '';
  return (
    '<div class="pc-prod"><span class="pc-prod-e">' +
    (p.emoji || '🧴') +
    '</span><span class="pc-prod-n">' +
    (parts[0] || 'Produit') +
    brand +
    '</span></div>'
  );
}
function togglePcLea(el) {
  el.classList.toggle('open');
  const b = el.nextElementSibling;
  if (b) b.style.maxHeight = el.classList.contains('open') ? b.scrollHeight + 'px' : '0';
}

function pcGoalHtml() {
  const g = state.goal;
  let title = 'Une peau plus équilibrée',
    sub = 'Comprise, respectée et chouchoutée, jour après jour.';
  if (g === 'constance') {
    title = 'Tenir ton rituel';
    sub = "La régularité, c'est ce qui transforme vraiment la peau. Un petit geste chaque jour 🌸";
  } else if (g === 'comprendre') {
    title = 'Comprendre ta peau';
    sub =
      "Repérer ce qui lui fait du bien, ce qui l'aggrave, et voir ton évolution au fil du temps.";
  } else if (g === 'deux') {
    title = 'Une peau équilibrée & comprise';
    sub = 'Tenir ton rituel tout en apprenant ce qui fait vraiment du bien à ta peau.';
  }
  return (
    '<div class="pc-goal"><div class="pc-rail"><div class="pc-goal-node">✨</div></div>' +
    '<div class="pc-goal-card"><div class="pc-goal-eyebrow">Ton objectif</div>' +
    '<div class="pc-goal-title">' +
    title +
    '</div><div class="pc-goal-sub">' +
    sub +
    '</div></div></div>'
  );
}

function pcEmptyHtml() {
  const presets = [
    ['grasse', '🫧', 'Peau grasse'],
    ['acne', '🌋', 'Acné légère'],
    ['seche', '🏜️', 'Peau sèche'],
    ['rougeurs', '🍓', 'Rougeurs'],
    ['sensible', '🌸', 'Peau sensible'],
    ['simple', '🌿', 'Ultra-simple'],
  ];
  const btns = presets
    .map(function (a) {
      return (
        '<button class="btn-soft" style="display:flex;align-items:center;gap:11px;width:100%;text-align:left;padding:13px 15px;border-radius:14px;" onclick="applyPreset(\'' +
        a[0] +
        '\')"><span style="font-size:20px;">' +
        a[1] +
        '</span><span style="flex:1;">' +
        a[2] +
        '</span><span style="color:var(--muted);">›</span></button>'
      );
    })
    .join('');
  return (
    '<div class="pc-hero"><div class="pc-hero-title">Ton parcours <em>beauté</em> 🌸</div>' +
    '<div class="pc-hero-sub">Ta peau mérite un chemin clair. Choisis un point de départ — on crée tes produits et ton parcours, tu ajustes ensuite.</div></div>' +
    '<div class="pc-empty">' +
    btns +
    '</div>'
  );
}

async function renderParcours() {
  const root = document.getElementById('parcours-root');
  if (!root || !currentUser) return;
  let prods = [];
  try {
    const { data } = await sb
      .from('products')
      .select('id,nom,emoji,categorie,in_matin,in_soir')
      .eq('user_id', currentUser.id);
    prods = data || [];
  } catch (e) {
    prods = [];
  }
  if (!prods.length) {
    root.innerHTML = pcEmptyHtml();
    return;
  }

  const byCat = {};
  prods.forEach(function (p) {
    const c = p.categorie || 'autre';
    (byCat[c] = byCat[c] || []).push(p);
  });
  const concerns = (state.concerns || []).map(function (c) {
    return CONCERN_LABELS[c] || c;
  });

  let filled = 0;
  const total = PC_PHASES.length;
  let steps = '';
  PC_PHASES.forEach(function (ph) {
    let items = [];
    ph.cats.forEach(function (c) {
      items = items.concat(byCat[c] || []);
    });
    const has = items.length > 0;
    if (has) filled++;

    let moment = ph.moment;
    if (has && ph.moment === 'both') {
      const m = items.some(function (p) {
        return p.in_matin;
      });
      const s = items.some(function (p) {
        return p.in_soir;
      });
      moment = m && s ? 'both' : m ? 'matin' : s ? 'soir' : 'both';
    }

    let why = ph.why;
    if (ph.key === 'traiter' && concerns.length) {
      why =
        'Le cœur du soin : les actifs qui ciblent <b>' +
        concerns.join(', ').toLowerCase() +
        '</b>.';
    }

    if (has) {
      steps +=
        '<div class="pc-step"><div class="pc-rail"><div class="pc-node">' +
        ph.emoji +
        '</div></div>' +
        '<div class="pc-card"><div class="pc-card-top"><div class="pc-phase">' +
        ph.nom +
        '</div><span class="pc-moment">' +
        pcMomentBadge(moment) +
        '</span></div>' +
        '<div class="pc-why">' +
        why +
        '</div>' +
        '<div class="pc-prods">' +
        items.map(pcProdChip).join('') +
        '</div>' +
        '<button class="pc-lea" onclick="togglePcLea(this)"><span class="pc-lea-av">L</span><span class="pc-lea-lbl">Le conseil de Léa</span><span class="pc-chev">▾</span></button>' +
        '<div class="pc-lea-body"><div>' +
        ph.lea +
        '</div></div>' +
        '</div></div>';
    } else {
      steps +=
        '<div class="pc-step"><div class="pc-rail"><div class="pc-node ghost">' +
        ph.emoji +
        '</div></div>' +
        '<div class="pc-card ghost"><div class="pc-card-top"><div class="pc-phase">' +
        ph.nom +
        '</div>' +
        (ph.optionnel ? '<span class="pc-opt">facultatif</span>' : '') +
        '</div>' +
        '<div class="pc-why">' +
        ph.why +
        '</div>' +
        '<button class="pc-add" onclick="navTo(\'routine\')">+ Ajouter un produit à cette étape</button>' +
        '</div></div>';
    }
  });

  const pct = Math.round((filled / total) * 100);
  const hero =
    '<div class="pc-hero"><div class="pc-hero-title">Ton parcours <em>beauté</em> 🌸</div>' +
    '<div class="pc-hero-sub">Le chemin de ta peau, étape par étape. Comprends le rôle de chaque geste — et vois où tu en es.</div>' +
    '<div class="pc-progress"><div class="pc-progress-bar"><div class="pc-progress-fill" style="width:' +
    pct +
    '%"></div></div>' +
    '<span class="pc-progress-txt">' +
    filled +
    '/' +
    total +
    ' étapes</span></div></div>';

  root.innerHTML = hero + '<div class="pc-track">' + steps + pcGoalHtml() + '</div>';
}

// ===== Hub des rituels : regroupé par moment =====
const RH_MOMENTS = [
  ['matin', '☀️', 'Matin'],
  ['soir', '🌙', 'Soir'],
  ['hebdo', '🧖‍♀️', 'Hebdo'],
];
let rhActiveTab = new Date().getHours() >= 18 ? 'soir' : 'matin';
function rhNewRituel() {
  openRituelChemin(null, (typeof rhActiveTab !== 'undefined' && rhActiveTab) || 'matin');
}
function rhGoTab(m) {
  rhActiveTab = m;
  RH_MOMENTS.forEach(function (mo) {
    const p = document.getElementById('rh-pane-' + mo[0]);
    if (p) p.style.display = mo[0] === m ? 'block' : 'none';
  });
  document.querySelectorAll('.rh-tab').forEach(function (t, i) {
    if (RH_MOMENTS[i]) t.classList.toggle('on', RH_MOMENTS[i][0] === m);
  });
}

function rhTrail(r, pmap) {
  const ids = Array.isArray(r.produits) ? r.produits : [];
  if (!ids.length) return '<div class="rh-empty">Aucun produit · appuie pour en ajouter</div>';
  let html = '';
  const max = 6;
  ids.slice(0, max).forEach(function (id, i) {
    const p = pmap[id];
    const ph = (window.__rhPhotos || {})[id];
    const inner = ph ? '<img src="' + ph + '" alt="">' : p ? p.emoji || '🧴' : '🧴';
    if (i > 0) html += '<span class="rh-link"></span>';
    html += '<span class="rh-node">' + inner + '</span>';
  });
  if (ids.length > max) {
    html +=
      '<span class="rh-link"></span><span class="rh-node" style="font-size:12px;font-weight:700;color:var(--muted);">+' +
      (ids.length - max) +
      '</span>';
  }
  return '<div class="rh-trail">' + html + '</div>';
}

// Un seul rituel actif par créneau : activer celui-ci met les concurrents en pause.
function rhSyncActif(all) {
  (all || []).forEach(function (r) {
    const b = document.querySelector('.rh-actif[data-rid="' + r.id + '"]');
    if (b) {
      b.classList.toggle('on', !!r.actif);
      const t = b.querySelector('.rh-actif-t');
      if (t) t.textContent = r.actif ? 'Actif' : 'En pause';
    }
    document.querySelectorAll('.rh-card[data-card="' + r.id + '"]').forEach(function (c) {
      c.classList.toggle('rh-off', !r.actif);
    });
  });
}
async function rhToggleActif(ev, id) {
  ev.stopPropagation();
  ev.preventDefault();
  const all = window.__rhRituels || window.__allRituels || [];
  const t = all.find(function (r) {
    return String(r.id) === String(id);
  });
  if (!t) return;
  const turnOn = !t.actif;
  if (navigator.vibrate) navigator.vibrate(8);
  let off = [];
  if (turnOn && t.moment !== 'hebdo') {
    const tM = t.moment === 'matin' || t.moment === 'both',
      tS = t.moment === 'soir' || t.moment === 'both';
    off = all
      .filter(function (r) {
        return (
          r.actif &&
          String(r.id) !== String(t.id) &&
          r.moment !== 'hebdo' &&
          ((tM && (r.moment === 'matin' || r.moment === 'both')) ||
            (tS && (r.moment === 'soir' || r.moment === 'both')))
        );
      })
      .map(function (r) {
        return r.id;
      });
    off.forEach(function (oid) {
      const o = all.find(function (r) {
        return r.id === oid;
      });
      if (o) o.actif = false;
    });
  }
  t.actif = turnOn;
  rhSyncActif(all);
  try {
    if (off.length) await sb.from('rituels').update({ actif: false }).in('id', off);
    await sb.from('rituels').update({ actif: turnOn }).eq('id', id);
  } catch (e) {
    if (typeof showToast === 'function') showToast('Oups, réessaie 🌿');
  }
  window.__allRituels = null;
  if (typeof loadHomeRoutine === 'function') loadHomeRoutine();
  if (typeof showToast === 'function')
    showToast(turnOn ? 'Rituel activé ✨' : 'Rituel mis en pause 🌙');
}

function rhCard(r, pmap) {
  const nb = Array.isArray(r.produits) ? r.produits.length : 0;
  const _on = !!(r.rappels && r.rappels.on);
  const bell =
    '<button class="rh-bellbtn' +
    (_on ? ' on' : '') +
    '" aria-label="Rappel" onclick="rhOpenRappel(event,\'' +
    r.id +
    '\')">' +
    (_on ? '🔔' : '🔕') +
    '</button>';
  const tag = r.moment === 'both' ? '<span class="rh-tag">Matin & soir</span>' : '';
  const act =
    '<button class="rh-actif' +
    (r.actif ? ' on' : '') +
    '" data-rid="' +
    r.id +
    '" onclick="rhToggleActif(event,\'' +
    r.id +
    '\')">' +
    '<span class="rh-actif-dot"></span><span class="rh-actif-t">' +
    (r.actif ? 'Actif' : 'En pause') +
    '</span></button>';
  return (
    '<div class="rh-card' +
    (r.actif ? '' : ' rh-off') +
    '" data-card="' +
    r.id +
    '" onclick="openRituelChemin(\'' +
    r.id +
    '\')">' +
    '<div class="rh-card-head"><div class="rh-name">' +
    escapeHtml(r.nom || 'Mon rituel') +
    '</div>' +
    tag +
    bell +
    '</div>' +
    rhTrail(r, pmap) +
    '<div class="rh-foot"><span>' +
    nb +
    ' étape' +
    (nb > 1 ? 's' : '') +
    '</span>' +
    act +
    '</div>' +
    '</div>'
  );
}

async function renderRituelsHub() {
  const root = document.getElementById('parcours-root');
  if (!root || !currentUser) return;
  let rits = [],
    prods = [];
  try {
    const r1 = await sb
      .from('rituels')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('position', { ascending: true })
      .order('created_at', { ascending: true });
    rits = r1.data || [];
    const r2 = await sb
      .from('products')
      .select('id,nom,emoji,categorie,photo_path')
      .eq('user_id', currentUser.id);
    prods = r2.data || [];
    window.__rhPhotos = {};
    for (const _p of prods) {
      if (_p.photo_path) {
        try {
          const _u = await signedPhoto(_p.photo_path);
          if (_u) window.__rhPhotos[_p.id] = _u;
        } catch (e) {}
      }
    }
  } catch (e) {
    // Ne jamais laisser le message "Chargement…" bloqué à l'écran.
    root.innerHTML =
      '<div class="rh-hero"><div class="rh-hero-t">Mes <em>rituels</em> 🌸</div><div class="rh-hero-s">Oups, on n\'arrive pas à charger tes rituels.</div></div>' +
      '<div class="rh-newwrap"><button class="rh-new" onclick="renderRituelsHub()">Réessayer</button></div>';
    return;
  }
  const pmap = {};
  prods.forEach(function (p) {
    pmap[p.id] = p;
  });
  window.__rhRituels = rits;
  try {
    const groups = { matin: [], soir: [], hebdo: [] };
    rits.forEach(function (r) {
      const m = r.moment || 'matin';
      if (m === 'both') {
        groups.matin.push(r);
        groups.soir.push(r);
      } else if (groups[m]) groups[m].push(r);
      else groups.matin.push(r);
    });
    if (!window.__rhAutoTab) {
      window.__rhAutoTab = true;
      if (!(groups[rhActiveTab] && groups[rhActiveTab].length)) {
        const _ff = RH_MOMENTS.find(function (mo) {
          return groups[mo[0]] && groups[mo[0]].length;
        });
        if (_ff) rhActiveTab = _ff[0];
      }
    }

    let html = '<div class="rh-hero"><div class="rh-hero-t">Mes <em>rituels</em> 🌸</div></div>';

    if (!rits.length) {
      const presets = [
        ['grasse', '🫧', 'Peau grasse'],
        ['seche', '🏜️', 'Peau sèche'],
        ['sensible', '🌸', 'Sensible'],
        ['simple', '🌿', 'Ultra-simple'],
      ];
      html +=
        '<div class="rh-quickstart"><div class="rh-quickstart-t">Pas d\'idée ? Pars d\'un rituel tout fait :</div><div class="rh-preset-row">' +
        presets
          .map(function (a) {
            return (
              '<button class="rh-preset" onclick="applyPreset(\'' +
              a[0] +
              '\')">' +
              a[1] +
              ' ' +
              a[2] +
              '</button>'
            );
          })
          .join('') +
        '</div></div>';
    }

    let tabs = '<div class="rh-tabs">';
    RH_MOMENTS.forEach(function (mo) {
      const c = groups[mo[0]].length;
      tabs +=
        '<button class="rh-tab' +
        (mo[0] === rhActiveTab ? ' on' : '') +
        '" onclick="rhGoTab(\'' +
        mo[0] +
        '\')">' +
        mo[1] +
        ' ' +
        mo[2] +
        (c ? '<span class="rh-tab-n">' + c + '</span>' : '') +
        '</button>';
    });
    tabs += '</div>';
    let panes = '';
    RH_MOMENTS.forEach(function (mo) {
      // Le rituel actif d'abord : c'est celui qu'on ouvre le plus souvent.
      // Tri stable, l'ordre choisi par l'utilisateur est conservé à l'intérieur
      // de chaque groupe.
      const list = groups[mo[0]]
        .map(function (r, i) {
          return { r: r, i: i };
        })
        .sort(function (a, b) {
          const d = (b.r.actif ? 1 : 0) - (a.r.actif ? 1 : 0);
          return d !== 0 ? d : a.i - b.i;
        })
        .map(function (x) {
          return x.r;
        });
      let inner = '';
      list.forEach(function (r) {
        inner += rhCard(r, pmap);
      });

      panes +=
        '<div class="rh-tabpane" id="rh-pane-' +
        mo[0] +
        '" style="display:' +
        (mo[0] === rhActiveTab ? 'block' : 'none') +
        ';">' +
        inner +
        '</div>';
    });
    root.innerHTML =
      html +
      tabs +
      '<div class="rh-newwrap"><button class="rh-new" onclick="rhNewRituel()">＋ Nouveau rituel</button></div>' +
      '<div class="rh-panes">' +
      panes +
      '</div>';
  } catch (e) {
    root.innerHTML =
      '<div class="rh-hero"><div class="rh-hero-t">Mes <em>rituels</em> 🌸</div><div class="rh-hero-s">Un souci est survenu.</div></div>' +
      '<div class="rh-newwrap"><button class="rh-new" onclick="renderRituelsHub()">Réessayer</button></div>';
  }
}

// ===== Chemin d'un rituel : carte sinueuse de ses étapes =====
// ===== Carte de construction d'un rituel =====
const CM_PHASES = {
  nettoyer: { emoji: '🫧', nom: 'Nettoyer', cat: 'nettoyant' },
  traiter: { emoji: '🎯', nom: 'Traiter', cat: 'serum' },
  hydrater: { emoji: '💧', nom: 'Hydrater', cat: 'creme' },
  proteger: { emoji: '☀️', nom: 'Protéger', cat: 'spf' },
  masque: { emoji: '🧖‍♀️', nom: 'Masque / soin', cat: 'masque' },
};
const CM_SETS = {
  matin: ['nettoyer', 'traiter', 'hydrater', 'proteger'],
  soir: ['nettoyer', 'traiter', 'hydrater'],
  both: ['nettoyer', 'traiter', 'hydrater', 'proteger'],
  hebdo: ['nettoyer', 'masque', 'hydrater'],
};
// Catégories rangées dans chaque station. « Traiter » regroupe lotion, sérum,
// soin ciblé, contour des yeux et masque. La station « masque » ne sert qu'à
// la scène peinte du rendez-vous hebdo.
const CM_PHASE_CATS = {
  nettoyer: ['demaquillant', 'nettoyant'],
  traiter: ['toner', 'serum', 'cible', 'yeux', 'masque'],
  hydrater: ['creme'],
  proteger: ['spf'],
  masque: ['masque'],
};
// Station d'accueil d'une catégorie pour un créneau donné (selon les stations
// réellement présentes). « autre » n'a pas de station fixe : dispo partout.
function cmCat2Phase(cat, moment) {
  const set = CM_SETS[moment] || CM_SETS.matin;
  for (let i = 0; i < set.length; i++) {
    const cats = CM_PHASE_CATS[set[i]];
    if (cats && cats.indexOf(cat) >= 0) return set[i];
  }
  return null;
}
// chDraft : état partagé global (voir src/core/state.js).

const CM_IMG_W = 760,
  CM_IMG_H = 1460;
const CM_BLD = {
  depart: { w: 126.2, h: 74, op: 0.634, oc: 0.463 },
  nettoyer: { w: 91.8, h: 80 },
  equilibrer: { w: 79.7, h: 96 },
  traiter: { w: 88.7, h: 86 },
  yeux: { w: 62.7, h: 104 },
  hydrater: { w: 103.5, h: 88 },
  proteger: { w: 66.9, h: 110 },
  masque: { w: 114.9, h: 88 },
  arrivee: { w: 122.7, h: 94 },
};
const CM_BLD_SCALE = 0.66;
function cmBldK(yFrac) {
  return CM_BLD_SCALE * (0.78 + Math.max(0, Math.min(1, yFrac)) * 0.5);
}
// Variante clairière : aucune image, juste la zone sensible, le médaillon et le parchemin.
function cmPaintHtml(key, cls, medal, lbl, attr) {
  // Panneau posé sur le support du décor (fontaine, ardoise, enseigne…) : le nom est écrit
  // dessus, un numéro discret + une miniature du produit s'y intègrent, halo et coche gérés
  // par les états. Activé via la classe 'cm-usepanel' (chemin des scènes peintes).
  if (/cm-usepanel/.test(cls)) {
    // Un seul composant centré sur la pancarte : numéro + nom + icône (+ coche) dans le flux.
    return (
      '<div class="cm-node cm-paint cm-panel ' +
      cls +
      '" data-bld="' +
      key +
      '" ' +
      (attr || '') +
      '>' +
      '<span class="cm-panel-halo"></span>' +
      '<span class="cm-panel-num"></span>' +
      '<div class="cm-panel-in">' +
      '<span class="cm-panel-name">' +
      lbl +
      '</span>' +
      (medal ? '<span class="cm-panel-thumb">' + medal + '</span>' : '') +
      '<span class="cm-panel-check">✓</span>' +
      '</div></div>'
    );
  }
  return (
    '<div class="cm-node cm-paint ' +
    cls +
    '" data-bld="' +
    key +
    '" ' +
    (attr || '') +
    '>' +
    (medal ? '<span class="cm-medal">' + medal + '</span>' : '') +
    '<div class="cm-tag"><div class="cm-lbl">' +
    lbl +
    '</div></div></div>'
  );
}

function cmNodeHtml(key, cls, medal, lbl, sub, attr, extra) {
  return (
    '<div class="cm-node ' +
    cls +
    '" data-bld="' +
    key +
    '" ' +
    (attr || '') +
    '>' +
    '<div class="cm-bld"><img src="img/bld/' +
    key +
    '.webp" alt="" draggable="false">' +
    (medal ? '<span class="cm-medal">' + medal + '</span>' : '') +
    (extra || '') +
    '</div>' +
    '<div class="cm-tag"><div class="cm-lbl">' +
    lbl +
    '</div>' +
    (sub ? '<div class="cm-sub">' + sub + '</div>' : '') +
    '</div></div>'
  );
}
// Demi-largeur peinte du chemin à une profondeur donnée (0 = haut, 1 = bas).
function cmPathHalf(yFrac, sw) {
  return sw * (0.03 + 0.155 * Math.max(0, Math.min(1, yFrac)));
}

// Ruban du chemin échantillonné : sert à tester si un bâtiment mord dessus.
function cmRibbon(f, poly) {
  const out = [];
  for (let i = 1; i < poly.length; i++) {
    const a = [f.offX + (poly[i - 1][0] / 100) * f.rw, f.offY + (poly[i - 1][1] / 100) * f.rh];
    const b = [f.offX + (poly[i][0] / 100) * f.rw, f.offY + (poly[i][1] / 100) * f.rh];
    for (let s = 0; s < 1; s += 0.25) {
      const x = a[0] + (b[0] - a[0]) * s,
        y = a[1] + (b[1] - a[1]) * s;
      out.push([x, y, cmPathHalf((y - f.offY) / f.rh, f.sw)]);
    }
  }
  return out;
}
function cmBoxCost(box, rib) {
  let c = 0;
  for (let i = 0; i < rib.length; i++) {
    const x = rib[i][0],
      y = rib[i][1],
      hw = rib[i][2];
    if (y < box.y0 - hw || y > box.y1 + hw) continue;
    const dx = Math.max(box.x0 - x, 0, x - box.x1),
      dy = Math.max(box.y0 - y, 0, y - box.y1);
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < hw) c += hw - d;
  }
  return c;
}
// distance bord à bord entre deux rectangles (0 s'ils se touchent)
function cmBoxGap(a, b) {
  const dx = Math.max(0, Math.max(a.x0, b.x0) - Math.min(a.x1, b.x1));
  const dy = Math.max(0, Math.max(a.y0, b.y0) - Math.min(a.y1, b.y1));
  return Math.sqrt(dx * dx + dy * dy);
}
function cmBoxOverlap(a, b) {
  return (
    Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) *
    Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0))
  );
}

// Place tous les bâtiments : à côté du chemin, sans se marcher dessus, sans sortir du cadre.
// Cadrage de la clairière : on couvre la scène, et on zoome juste ce qu'il faut
// pour que le bâtiment le plus haut passe sous le titre.
function cmFitPaint(scene, def, tpMin) {
  const sw = scene.clientWidth,
    sh = scene.clientHeight;
  if (!sw || !sh) return null;
  const CW = def.w,
    CH = def.h,
    yT = def.top / 100;
  // Une clairière est un lieu : mieux vaut un peu de vide en bas, absorbé par le fondu,
  // que rogner les bâtiments latéraux. On ne perd jamais plus de 12% de la largeur.
  const k = Math.min(Math.max(sw / CW, sh / CH), (1.14 * sw) / CW);
  const rw = CW * k,
    rh = CH * k;
  let offY;
  if (rh >= sh) {
    offY = (sh - rh) / 2;
    if (offY + yT * rh < tpMin) offY = tpMin - yT * rh;
    offY = Math.max(sh - rh, Math.min(0, offY));
  } else {
    offY = Math.min(Math.max(0, tpMin - yT * rh), sh - rh);
  }
  return { rw: rw, rh: rh, offX: (sw - rw) / 2, offY: offY, sw: sw, sh: sh };
}

// En lecture, le tap ne fait rien : c'est un aperçu. Mais un appui long
// ouvre le conseil de l'étape, sans quitter la carte.
function cmBindLongPress(scene) {
  if (scene.__lp) return;
  scene.__lp = true;
  let timer = null,
    bouge = false;
  const start = function (e) {
    const cible = e.target && e.target.closest && e.target.closest('.cm-node.cm-fige');
    if (!cible) return;
    const key = cible.dataset.bld;
    if (!key || !CM_PHASES[key] || !CM_TIPS[key]) return;
    bouge = false;
    timer = setTimeout(function () {
      timer = null;
      if (bouge) return;
      if (navigator.vibrate) {
        try {
          navigator.vibrate(12);
        } catch (_e) {}
      }
      cmInfo(key, parseInt(cible.dataset.i || '0', 10));
    }, 480);
  };
  const stop = function () {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };
  scene.addEventListener('touchstart', start, { passive: true });
  scene.addEventListener(
    'touchmove',
    function () {
      bouge = true;
      stop();
    },
    { passive: true }
  );
  scene.addEventListener('touchend', stop);
  scene.addEventListener('touchcancel', stop);
  scene.addEventListener('mousedown', start);
  scene.addEventListener('mouseup', stop);
  scene.addEventListener('mouseleave', stop);
}

// ===== Mode calage (dev) : ajoute #calib à l'URL, puis touche un point de la scène.
// Affiche les coordonnées image (x%, y%) du tap → pour caler cx,cy de chaque station.
let cmCalibOn = /calib/i.test(location.hash);
window.addEventListener('hashchange', function () {
  cmCalibOn = /calib/i.test(location.hash);
});
function cmBindCalib(scene) {
  if (!cmCalibOn || scene.__calib) return;
  scene.__calib = true;
  scene.addEventListener(
    'click',
    function (e) {
      const f = scene.__cmf;
      if (!f) return;
      const r = scene.getBoundingClientRect();
      const x = ((e.clientX - r.left - f.offX) / f.rw) * 100;
      const y = ((e.clientY - r.top - f.offY) / f.rh) * 100;
      let box = document.getElementById('cm-calib');
      if (!box) {
        box = document.createElement('div');
        box.id = 'cm-calib';
        box.style.cssText =
          'position:fixed;left:8px;bottom:76px;z-index:99999;background:rgba(0,0,0,0.82);color:#fff;font:600 13px/1.4 monospace;padding:9px 12px;border-radius:9px;max-width:92vw;white-space:pre;pointer-events:none;';
        document.body.appendChild(box);
      }
      box.textContent =
        'CALAGE — dernier tap :\ncx:' +
        x.toFixed(1) +
        '  cy:' +
        y.toFixed(1) +
        '\n(dis-moi : station + ces valeurs)';
    },
    true
  );
}

function cmPlacePaint(scene, def, f, topLimit) {
  scene.__cmf = f; // mémorise le calage (rw,rh,offX,offY) pour le mode calage
  scene.style.backgroundImage = "url('" + def.img + "')";
  scene.style.backgroundSize = f.rw + 'px ' + f.rh + 'px';
  scene.style.backgroundPosition = f.offX + 'px ' + f.offY + 'px';
  const nodes = scene.querySelectorAll('.cm-node');
  for (let i = 0; i < nodes.length; i++) {
    const nd = nodes[i],
      st = def.pos[nd.dataset.bld];
    if (!st) {
      nd.style.display = 'none';
      continue;
    }
    if (nd.classList.contains('cm-panel')) {
      cmPlacePanel(nd, st, f);
      continue;
    } // panneau posé sur le support
    const h = (st.h / 100) * f.rh,
      w = Math.max(h * st.r, 54);
    const cx = f.offX + (st.x / 100) * f.rw,
      by = f.offY + (st.y / 100) * f.rh;
    nd.style.display = '';
    nd.style.width = Math.round(w) + 'px';
    nd.style.height = Math.round(Math.max(h, 42)) + 'px';
    nd.style.left = Math.round(cx) + 'px';
    nd.style.top = Math.round(by) + 'px';
    nd.style.zIndex = 6 + Math.round((by / Math.max(1, f.sh)) * 60);
    nd.classList.toggle('tag-down', by - h - 34 < topLimit);
    const tg = nd.querySelector('.cm-tag');
    if (tg) {
      tg.style.transform = 'translateX(-50%)';
      const tw = tg.offsetWidth || 0,
        l = cx - tw / 2,
        r = cx + tw / 2;
      let dx = 0;
      if (l < 5) dx = 5 - l;
      else if (r > f.sw - 5) dx = f.sw - 5 - r;
      if (dx) tg.style.transform = 'translateX(calc(-50% + ' + Math.round(dx) + 'px))';
    }
    // Le médaillon déborde du bord de l'écran quand la station est latérale :
    // on le repousse vers l'intérieur au lieu de le laisser sortir du cadre.
    const md = nd.querySelector('.cm-medal');
    if (md) {
      md.style.right = '';
      md.style.left = '';
      const mw = md.offsetWidth || 44;
      const bordD = cx + w / 2 + 8,
        bordG = bordD - mw;
      let off = -8;
      if (bordD > f.sw - 6) off += bordD - (f.sw - 6);
      else if (bordG < 6) off -= 6 - bordG;
      md.style.right = Math.round(off) + 'px';
    }
  }
}

// Place un panneau au CENTRE de son support (rect calibré cx,cy,pw,ph + légère rotation).
function cmPlacePanel(nd, st, f) {
  const cx = f.offX + (st.cx / 100) * f.rw,
    cy = f.offY + (st.cy / 100) * f.rh;
  const w = (st.pw / 100) * f.rw,
    h = (st.ph / 100) * f.rh;
  nd.style.display = '';
  nd.style.width = Math.round(w) + 'px';
  nd.style.height = Math.round(h) + 'px';
  nd.style.left = Math.round(cx) + 'px';
  nd.style.top = Math.round(cy) + 'px';
  nd.style.setProperty('--rot', (st.rot || 0) + 'deg');
  nd.style.zIndex = 6 + Math.round((cy / Math.max(1, f.sh)) * 60);
  const ne = nd.querySelector('.cm-panel-num');
  if (ne) ne.textContent = nd.dataset.i || '';
  cmFitPanelText(nd);
}
// Réduit la police du nom jusqu'à ce que le contenu de la pancarte (nom + icône ; le numéro
// est désormais AU-DESSUS, hors de la boîte) tienne en hauteur comme en largeur. Le mot
// n'est jamais coupé : on rapetisse. Le nom occupe davantage la pancarte qu'avant.
function cmFitPanelText(nd) {
  const box = nd.querySelector('.cm-panel-in'),
    t = nd.querySelector('.cm-panel-name');
  if (!box || !t) return;
  const bw = box.clientWidth,
    bh = box.clientHeight;
  if (bw <= 0 || bh <= 0) return;
  let fs = Math.max(8, Math.min(20, Math.round(bh * 0.44)));
  t.style.fontSize = fs + 'px';
  let guard = 24;
  while (guard-- > 0 && (box.scrollHeight > bh + 1 || box.scrollWidth > bw + 1) && fs > 6) {
    fs -= 1;
    t.style.fontSize = fs + 'px';
  }
}

function cmPlaceNodes(scene, f, pts, poly, topLim) {
  const rib = cmRibbon(f, poly),
    sw = f.sw,
    placed = [],
    links = [];
  // aucun bâtiment ne doit passer sous le bloc titre
  const topLimit = topLim || 96;
  scene.querySelectorAll('.cm-node').forEach(function (nd, i) {
    const p = pts[i] || { x: sw / 2, y: f.sh / 2 };
    const b = CM_BLD[nd.dataset.bld] || CM_BLD.nettoyer;
    const yF = (p.y - f.offY) / f.rh,
      kB = cmBldK(yF),
      onPath = nd.dataset.center === '1';
    let best = null;
    let scales;
    if (onPath) {
      // Le portail enjambe le chemin : c'est son entre-poteaux, pas son bord, qui doit
      // couvrir la largeur du chemin. b.op = ouverture, b.oc = centre de l'ouverture.
      const hw = cmPathHalf(yF, sw),
        op = b.op || 1;
      let kw = (2 * hw * 1.06) / (b.w * op);
      kw = Math.min(kw, (0.21 * f.sh) / b.h, (0.72 * sw) / b.w);
      kw = Math.max(kw, kB);
      scales = [kw, kw * 0.9, kB];
    } else {
      scales = [kB, kB * 0.88, kB * 0.78, kB * 0.68, kB * 0.58, kB * 0.48];
    }
    for (let si = 0; si < scales.length; si++) {
      const k = scales[si],
        w = b.w * k,
        h = b.h * k;
      const cands = [];
      if (onPath) {
        cands.push([p.x - ((b.oc || 0.5) - 0.5) * w, 0]);
      } else {
        const hw = cmPathHalf(yF, sw),
          s0 = i % 2 ? 1 : -1;
        [s0, -s0].forEach(function (sg) {
          [0, 10, 22, 38, 58].forEach(function (ex) {
            [0, 10, 22].forEach(function (dy) {
              cands.push([p.x + sg * (hw + w / 2 + 5 + ex), dy]);
            });
          });
        });
      }
      for (let ci = 0; ci < cands.length; ci++) {
        const cx = Math.max(w / 2 + 3, Math.min(sw - w / 2 - 3, cands[ci][0])),
          by = p.y + cands[ci][1] * k;
        if (cands[ci][1] > 0 && by > f.sh - 6) continue; // ne jamais écarter la position de base
        const box = {
          x0: cx - w / 2 + w * 0.07,
          x1: cx + w / 2 - w * 0.07,
          y0: by - h + h * 0.05,
          y1: by - h * 0.05,
        };
        const obox = { x0: box.x0 - 5, x1: box.x1 + 5, y0: box.y0 - 32, y1: box.y1 };
        let cost = onPath ? 0 : cmBoxCost(box, rib) * 2.2;
        if (by - h - 32 < topLimit) cost += (topLimit - (by - h - 32)) * 40;
        for (let q = 0; q < placed.length; q++) {
          cost += cmBoxOverlap(obox, placed[q]) * 0.08;
          cost += Math.max(0, 30 - cmBoxGap(box, placed[q])) * 1.8; // les stations ne doivent pas se frôler
        }
        cost +=
          Math.abs(cx - cands[ci][0]) * 0.6 +
          si * 55 +
          Math.abs(cands[ci][0] - p.x) * 0.48 +
          cands[ci][1] * 1.2;
        if (!best || cost < best.cost)
          best = { cost: cost, cx: cx, by: by, k: k, w: w, h: h, box: obox };
      }
    }
    if (!best)
      best = {
        cx: p.x,
        by: p.y,
        k: kB,
        w: b.w * kB,
        h: b.h * kB,
        box: { x0: p.x, x1: p.x, y0: p.y, y1: p.y },
      };
    nd.classList.toggle('tag-down', best.by - best.h - 34 < topLimit);
    const tg = nd.querySelector('.cm-tag');
    if (tg) {
      tg.style.transform = 'translateX(-50%)';
      const tw = tg.offsetWidth || 0,
        l = best.cx - tw / 2,
        r = best.cx + tw / 2;
      let dx = 0;
      if (l < 5) dx = 5 - l;
      else if (r > sw - 5) dx = sw - 5 - r;
      if (dx) tg.style.transform = 'translateX(calc(-50% + ' + Math.round(dx) + 'px))';
    }
    const el = nd.querySelector('.cm-bld');
    if (el) {
      el.style.width = best.w + 'px';
      el.style.height = best.h + 'px';
    }
    nd.style.setProperty('--k', best.k.toFixed(3));
    nd.style.zIndex = 6 + Math.round((best.by / Math.max(1, f.sh)) * 60);
    nd.style.left = best.cx + 'px';
    nd.style.top = (best.by != null ? best.by : p.y) + 'px';
    placed.push(best.box);
    if (!onPath) {
      const near = cmNearest(rib, best.cx, best.by);
      if (near) {
        const vx = best.cx - near[0],
          vy = best.by - near[1],
          L = Math.hypot(vx, vy) || 1;
        const sx = near[0] + (vx / L) * near[2] * 0.92,
          sy = near[1] + (vy / L) * near[2] * 0.92;
        const ex = best.cx,
          ey = best.by - 2;
        const mx = (sx + ex) / 2 + (sy - ey) * 0.1,
          my = (sy + ey) / 2 + (ex - sx) * 0.1;
        links.push(
          'M' +
            sx.toFixed(1) +
            ' ' +
            sy.toFixed(1) +
            'Q' +
            mx.toFixed(1) +
            ' ' +
            my.toFixed(1) +
            ' ' +
            ex.toFixed(1) +
            ' ' +
            ey.toFixed(1)
        );
      }
    }
  });
  const svg = scene.querySelector('.cm-links');
  if (svg) {
    svg.setAttribute('viewBox', '0 0 ' + f.sw + ' ' + f.sh);
    svg.setAttribute('width', f.sw);
    svg.setAttribute('height', f.sh);
    const d = links.join(' ');
    svg.innerHTML =
      '<path class="lk-base" stroke-width="11" d="' +
      d +
      '"></path><path class="lk-top" stroke-width="5" d="' +
      d +
      '"></path>';
  }
}

// point du ruban le plus proche d'un bâtiment : [x, y, demi-largeur]
function cmNearest(rib, x, y) {
  let best = null,
    bd = 1e12;
  for (let i = 0; i < rib.length; i++) {
    const dx = rib[i][0] - x,
      dy = rib[i][1] - y,
      d = dx * dx + dy * dy;
    if (d < bd) {
      bd = d;
      best = rib[i];
    }
  }
  return best;
}
const CM_ANCHORS = {
  matin: [
    [37.63, 95.45],
    [43.04, 76],
    [66.2, 63],
    [31.38, 50],
    [41.19, 37],
    [57.25, 20],
  ],
  soir: [
    [27.12, 95.45],
    [54.26, 76],
    [46.16, 65],
    [54.97, 54],
    [39.77, 43],
    [58.1, 32],
    [45.88, 20],
  ],
  hebdo: [
    [59.1, 95.45],
    [44.17, 74],
    [64.78, 57],
    [63.93, 40],
    [56.11, 20],
  ],
};

const CM_THEME = {
  matin: {
    img: 'img/chemin-matin.jpg',
    ink: '#3A2418',
    scrim: 'rgba(255,244,228,0.88)',
    glow: 'rgba(255,246,228,0.95)',
  },
  soir: {
    img: 'img/jardin-soir.webp',
    ink: '#FCEDDC',
    scrim: 'rgba(48,28,58,0.62)',
    glow: 'rgba(48,28,58,0.9)',
  },
  hebdo: {
    img: 'img/chemin-hebdo.jpg',
    ink: '#33402F',
    scrim: 'rgba(246,246,234,0.9)',
    glow: 'rgba(246,246,234,0.95)',
  },
};
function cmTheme(m) {
  return CM_THEME[m] || CM_THEME.matin;
}

function cmAnchors(m) {
  return CM_ANCHORS[m] || CM_ANCHORS.matin;
}
function cmMomentMeta(m) {
  if (m === 'soir') return { k: 'Ton rituel · Soir', ph: 'Rituel du soir', start: '🌙' };
  if (m === 'hebdo') return { k: 'Ton rituel · Semaine', ph: 'Soins de la semaine', start: '🧖‍♀️' };
  return { k: 'Ton rituel · Matin', ph: 'Rituel du matin', start: '🌱' };
}
// Icône du header, propre à chaque moment. Soir : croissant de lune + étoile, ton ivoire
// chaud (l'instant où l'on clôt sa journée). Matin/hebdo : soleil levant doré (nouveau départ).
function cmMomentIcon(moment) {
  if (moment === 'soir') {
    return (
      '<div class="cm-sun" aria-hidden="true"><svg viewBox="0 0 44 26" fill="none">' +
      '<path d="M23 4.4a9.6 9.6 0 1 0 0 17.2 7.5 7.5 0 0 1 0-17.2z" fill="#F3E4C4"/>' +
      '<path d="M32 4.6l.8 2.1 2.1.8-2.1.8-.8 2.1-.8-2.1-2.1-.8 2.1-.8z" fill="#F7EDD6"/>' +
      '</svg></div>'
    );
  }
  if (moment === 'hebdo') {
    // Fleur de lotus : soin profond, spa, moment pour soi — l'esprit du rituel hebdo.
    return '<div class="cm-sun cm-sun-emoji" aria-hidden="true">🪷</div>';
  }
  return (
    '<div class="cm-sun" aria-hidden="true"><svg viewBox="0 0 44 26" fill="none">' +
    '<g stroke="#F4C95D" stroke-width="1.8" stroke-linecap="round">' +
    '<path d="M22 3.2v3.4"/><path d="M11.4 7.4l2.1 2.1"/><path d="M32.6 7.4l-2.1 2.1"/><path d="M4.4 17h3.1"/><path d="M36.5 17h3.1"/>' +
    '</g>' +
    '<path d="M13 17.6a9 9 0 0 1 18 0z" fill="#F4C95D"/>' +
    '<path d="M6.5 17.6h31" stroke="#F4C95D" stroke-width="1.8" stroke-linecap="round"/>' +
    '</svg></div>'
  );
}
// Pourquoi cette étape + le mot de Léa, affichés dans la fiche de station.
const CM_TIPS = {
  nettoyer: {
    q: "Le nettoyant retire le sébum et les résidus sans décaper ta barrière cutanée. Le soir, si tu portes du SPF ou du maquillage, passe d'abord une huile ou un baume : l'eau seule ne les dissout pas.",
    t: "Masse l'huile à sec 30 secondes avant d'ajouter l'eau, puis enchaîne avec ton nettoyant. Eau tiède, jamais chaude, 30 secondes suffisent.",
  },
  equilibrer: {
    q: 'La lotion réhydrate juste après le nettoyage et prépare la peau à absorber la suite.',
    t: "Applique-la sur peau encore humide, à la main : elle retient l'eau au lieu de l'évaporer.",
  },
  traiter: {
    q: 'Le sérum est la formule la plus concentrée du rituel, celle qui cible vraiment ton besoin.',
    t: 'Une seule nouveauté à la fois, pendant deux semaines. Sinon tu ne sauras jamais ce qui marche.',
  },
  yeux: {
    q: 'La peau du contour est très fine et bouge en permanence : elle marque avant le reste du visage.',
    t: "Tapote avec l'annulaire, sur l'os autour de l'œil, jamais au ras des cils.",
  },
  hydrater: {
    q: "La crème scelle tout ce que tu viens d'appliquer et limite la perte en eau pendant la nuit.",
    t: "Couche fine mais partout, cou compris. C'est souvent lui qu'on oublie.",
  },
  proteger: {
    q: 'Le SPF est le geste anti-âge le plus efficace du rituel, même quand le ciel est couvert.',
    t: 'Deux doigts de produit pour le visage et le cou. On renouvelle si tu restes dehors longtemps.',
  },
  masque: {
    q: 'Le masque est un coup de pouce ponctuel, pas un soin quotidien : il agit fort et vite.',
    t: 'Une à deux fois par semaine maximum, et jamais sur une peau irritée ou qui pèle.',
  },
};
function cmTipHtml(key) {
  const t = CM_TIPS[key];
  if (!t) return '';
  return (
    '<div class="cm-tip"><div class="cm-tip-q">' +
    t.q +
    '</div>' +
    '<div class="cm-tip-l"><span>🌸</span><div><b>Léa</b> — ' +
    t.t +
    '</div></div></div>'
  );
}

function cmProductsForPhase(key) {
  const cats = CM_PHASE_CATS[key] || [];
  return (window.__cmProds || []).filter(function (p) {
    return cats.indexOf(p.categorie) >= 0 || p.categorie === 'autre';
  });
}

// Charge les produits de l'utilisateur en mémoire (__cmProds + photos signées).
// INDISPENSABLE avant cmComputeFilled : sans ça, aucune station ne retrouve son produit.
async function cmLoadProducts() {
  if (!currentUser) {
    window.__cmProds = window.__cmProds || [];
    return;
  }
  let prods = [];
  try {
    const r = await sb
      .from('products')
      .select('id,nom,emoji,categorie,photo_path,effets,prix')
      .eq('user_id', currentUser.id);
    prods = r.data || [];
  } catch (e) {}
  window.__cmPhotos = window.__cmPhotos || {};
  for (const _p of prods) {
    if (_p.photo_path && !window.__cmPhotos[_p.id]) {
      try {
        const _u = await signedPhoto(_p.photo_path);
        if (_u) window.__cmPhotos[_p.id] = _u;
      } catch (e) {}
    }
  }
  window.__cmProds = prods;
  window.__allProducts = prods;
}

async function openRituelChemin(id, presetMoment, mode) {
  try {
    const el = document.getElementById('rituel-chemin');
    if (!el) throw new Error('conteneur #rituel-chemin absent');
    if (!currentUser) throw new Error('pas connecte (currentUser null)');
    await cmLoadProducts();
    let r = null;
    if (id) {
      try {
        const rr = await sb.from('rituels').select('*').eq('id', id);
        r = (rr.data && rr.data[0]) || null;
      } catch (e) {}
    }
    const moment = r ? r.moment || 'matin' : presetMoment || 'matin';
    try {
      new Image().src = cmTheme(moment).img;
    } catch (e) {}
    chDraft = {
      id: r ? r.id : null,
      nom: r ? r.nom || '' : '',
      moment: moment,
      rappels: r ? r.rappels : null,
      filled: cmComputeFilled(r, moment),
      mode: mode || (r ? 'view' : 'edit'),
    };
    window.__cmFireflyPlayed = false; // nouvelle ouverture d'édition → la luciole peut reguider
    cmRender();
    el.scrollTop = 0;
    el.classList.add('show');
    document.body.style.overflow = 'hidden';
    cmNavTuck(false);
    cmNavGlass(true);
  } catch (_e) {
    if (window.console) console.error('carte rituel:', _e);
    if (typeof showToast === 'function') showToast("Oups, la carte n'a pas pu s'ouvrir");
  }
}

// Calcule quel produit occupe chaque étape du chemin, à partir des données déjà en mémoire
// (pmap = window.__cmProds) : réutilisé pour l'ouverture initiale et pour le swipe instantané.
function cmComputeFilled(r, moment) {
  const pmap = {};
  (window.__cmProds || []).forEach(function (p) {
    pmap[p.id] = p;
  });
  const set = CM_SETS[moment] || CM_SETS.matin;
  const filled = {};
  if (r && Array.isArray(r.produits)) {
    r.produits.forEach(function (pid) {
      const p = pmap[pid];
      if (!p) return;
      let ph = cmCat2Phase(p.categorie, moment);
      if (!ph || filled[ph]) {
        ph = set.find(function (k) {
          return !filled[k];
        });
      }
      if (ph && set.indexOf(ph) >= 0 && !filled[ph]) filled[ph] = pid;
    });
  }
  return filled;
}

// Construit un "draft" de rituel pour un créneau à partir du cache mémoire (aucune requête réseau).
// Si aucun rituel actif pour la période, on retombe sur le premier rituel existant de cette
// période (même en pause) : le panneau et le décor montrent toujours un rituel réel plutôt
// qu'un écran vide. Seul un créneau sans aucun rituel ouvre le mode création.
function cmDraftFor(moment) {
  const rits = window.__allRituels || [];
  let r =
    moment === 'hebdo'
      ? rits.find(function (x) {
          return x.moment === 'hebdo' && x.actif;
        }) || null
      : pickActive(rits)[moment];
  if (!r) {
    const g = cmGroups();
    r = (g[moment] && g[moment][0]) || null;
  }
  return {
    id: r ? r.id : null,
    nom: r ? r.nom || '' : '',
    moment: moment,
    rappels: r ? r.rappels : null,
    filled: cmComputeFilled(r, moment),
    mode: r ? 'view' : 'edit',
  };
}
// Affiche un rituel/créneau instantanément depuis le cache mémoire (aucune requête réseau).
// Utilisé à l'entrée dans l'onglet Rituel (si déjà chargé cette session) et pendant le swipe.
function cmShowSlot(moment) {
  chDraft = cmDraftFor(moment);
  cmRender();
}

// Ouvre l'overlay du rituel sans délai perceptible : contenu en cache = instantané,
// sinon un léger fondu (déjà géré par .cm-overlay) le temps du premier chargement.
function cmEnterRitual() {
  const el = document.getElementById('rituel-chemin');
  if (!el) return;
  el.classList.add('show');
  document.body.style.overflow = 'hidden';
  cmNavTuck(false);
  cmNavGlass(true); // footer en verre dépoli, posé sur le décor
  // On n'affiche le chemin que lorsque rituels ET produits sont en mémoire, sinon
  // cmComputeFilled renverrait des stations vides (produits pas chargés).
  if (window.__allRituels && window.__cmProds) {
    cmShowSlot(rpSlotView);
    return;
  }
  el.innerHTML = '<div class="cm-loading"><span>🌸</span></div>';
  (async function () {
    if (!window.__allRituels && typeof loadRituels === 'function') await loadRituels();
    if (!window.__cmProds) await cmLoadProducts();
    if (el.classList.contains('show')) cmShowSlot(rpSlotView);
  })();
}

// Construit le HTML complet d'un volet (scène + stations + tête). Utilisé pour le volet
// central (interactif) et pour les volets voisins (prev/next), collés dessus pendant le swipe.
function cmSceneHtml(d) {
  const moment = d.moment,
    meta = cmMomentMeta(moment),
    th = cmTheme(moment);
  const set = CM_SETS[moment] || CM_SETS.matin;
  const pmap = {};
  (window.__cmProds || []).forEach(function (p) {
    pmap[p.id] = p;
  });
  const isEdit = d.mode === 'edit';

  const paint = !!CM_PAINT[moment];
  // Scènes peintes avec supports calibrés (panels:true) → les stations sont des panneaux
  // posés sur le décor, plus des médaillons flottants.
  const pcls = CM_PAINT[moment] && CM_PAINT[moment].panels ? ' cm-usepanel' : '';
  let nodes = paint ? '' : cmNodeHtml('depart', 'cm-muted', '', 'Départ', '', 'data-center="1"');
  set.forEach(function (key, i) {
    const ph = CM_PHASES[key],
      idx = i + 1,
      pid = d.filled[key],
      p = pid ? pmap[pid] : null;
    if (p) {
      const url = (window.__cmPhotos || {})[pid];
      const medal = url ? '<img src="' + url + '" alt="">' : p.emoji || '🧴';
      // La station porte toujours son nom (Nettoyer, Traiter…). En édition, le
      // tap ouvre le carrousel ; en aperçu, il ouvre la fiche du produit rangé.
      const act =
        'data-i="' +
        idx +
        '"' +
        (isEdit
          ? ' onclick="cmOpenCarousel(\'' + key + "'," + idx + ')"'
          : ' onclick="cmShowStation(\'' + key + "','" + pid + '\')"');
      const lbl = ph.nom;
      nodes += paint
        ? cmPaintHtml(key, (isEdit ? '' : 'cm-fige') + pcls, medal, lbl, act)
        : cmNodeHtml(key, isEdit ? '' : 'cm-fige', medal, lbl, '', act);
    } else if (isEdit) {
      nodes += paint
        ? cmPaintHtml(
            key,
            'cm-empty' + pcls,
            '+',
            ph.nom,
            'data-i="' + idx + '" onclick="cmOpenCarousel(\'' + key + "'," + idx + ')"'
          )
        : cmNodeHtml(
            key,
            'cm-empty',
            '+',
            ph.nom,
            '',
            'data-i="' + idx + '" onclick="cmOpenCarousel(\'' + key + "'," + idx + ')"'
          );
    } else {
      // Aperçu, station vide : le tap ouvre quand même une carte (fiche de l'étape en lecture seule).
      nodes += paint
        ? cmPaintHtml(
            key,
            'cm-empty cm-fige' + pcls,
            ph.emoji,
            ph.nom,
            'data-i="' + idx + '" onclick="cmInfo(\'' + key + "'," + idx + ')"'
          )
        : cmNodeHtml(
            key,
            'cm-empty cm-fige',
            ph.emoji,
            ph.nom,
            '',
            'data-i="' + idx + '" onclick="cmInfo(\'' + key + "'," + idx + ')"'
          );
    }
  });
  if (!paint) nodes += cmNodeHtml('arrivee', 'cm-muted', '', 'Objectif', '');

  const title = escapeHtml(d.nom || meta.ph);
  const nOk = set.filter(function (k) {
    return d.filled[k];
  }).length;
  const count =
    '<div class="cm-count">' +
    nOk +
    ' étape' +
    (nOk > 1 ? 's' : '') +
    ' sur ' +
    set.length +
    '</div>';
  const tools =
    '<button class="cm-tool cm-tool-flower" title="Rituels" aria-label="Ouvrir mes rituels" onclick="cmTogglePanel()">' +
    '<svg class="cm-flower" viewBox="0 0 40 40" fill="none" aria-hidden="true">' +
    '<g class="cm-flower-petals" fill="rgba(255,255,255,0.95)">' +
    '<ellipse cx="20" cy="9.4" rx="4.6" ry="8.5"/>' +
    '<ellipse cx="20" cy="9.4" rx="4.6" ry="8.5" transform="rotate(72 20 20)"/>' +
    '<ellipse cx="20" cy="9.4" rx="4.6" ry="8.5" transform="rotate(144 20 20)"/>' +
    '<ellipse cx="20" cy="9.4" rx="4.6" ry="8.5" transform="rotate(216 20 20)"/>' +
    '<ellipse cx="20" cy="9.4" rx="4.6" ry="8.5" transform="rotate(288 20 20)"/>' +
    '</g>' +
    '<circle class="cm-flower-core" cx="20" cy="20" r="4" fill="#F6DFA0"/>' +
    '</svg></button>';
  // Icône du moment : soleil levant (matin/hebdo) ou croissant de lune (soir).
  const sun = cmMomentIcon(moment);
  // Un seul titre = le nom du rituel (modifiable). Aucun sous-titre ni texte en double.
  const head = isEdit
    ? '<div class="cm-head">' +
      sun +
      '<div class="cm-title" onclick="cmRename()">' +
      title +
      '<span class="cm-title-pen">✎</span></div>' +
      count +
      '</div>'
    : '<div class="cm-head">' + sun + '<div class="cm-title">' + title + '</div></div>';

  // Édition : plus de flèche « ‹ » (ambiguë) — un vrai bouton « Enregistrer » qui termine l'édition.
  const saveBtn = isEdit
    ? '<button class="cm-save" onclick="cmFinishEdit()">✓ Enregistrer mon rituel</button>'
    : '';
  // Aide de découverte : visible tant qu'aucun produit n'est posé (et jamais écartée).
  const hint = cmGuideActive(d)
    ? '<div class="cm-hint"><span class="cm-hint-ic">👆</span>Touchez une pancarte pour ajouter un produit</div>'
    : '';
  return (
    '<div class="cm-scene' +
    (moment === 'soir' ? ' cm-soir' : '') +
    '" data-moment="' +
    moment +
    '" style="background-image:url(\'' +
    th.img +
    "');--cm-scrim:" +
    th.scrim +
    ';--cm-ink:' +
    th.ink +
    ';--cm-glow:' +
    th.glow +
    ';">' +
    '<div class="cm-tools">' +
    tools +
    '</div>' +
    head +
    '<div class="cm-build">' +
    CM_BUILD +
    '</div>' +
    '<svg class="cm-links" preserveAspectRatio="none"></svg>' +
    nodes +
    hint +
    saveBtn +
    '</div>'
  );
}

// Trois calques superposés : le courant au centre, ses deux voisins hors champ.
// Le swipe (cmBindSwipe) les anime en fondu + parallaxe pour une transition continue.
function cmRender() {
  const el = document.getElementById('rituel-chemin');
  if (!el || !chDraft) return;
  const i = CM_ORDER.indexOf(chDraft.moment);
  const prevD = cmDraftFor(CM_ORDER[(i + CM_ORDER.length - 1) % CM_ORDER.length]);
  const nextD = cmDraftFor(CM_ORDER[(i + 1) % CM_ORDER.length]);
  el.innerHTML =
    '<div class="cm-wrap"><div class="cm-stage" id="cm-stage">' +
    '<div class="cm-layer cm-side" data-role="prev">' +
    cmSceneHtml(prevD) +
    '</div>' +
    '<div class="cm-layer cm-cur" data-role="cur">' +
    cmSceneHtml(chDraft) +
    '</div>' +
    '<div class="cm-layer cm-side" data-role="next">' +
    cmSceneHtml(nextD) +
    '</div>' +
    '</div></div>';
  cmLayout();
}

// Cale l'illustration dans la zone dispo et renvoie la géométrie de rendu.
function cmFitScene(scene, yTopPct, yBotPct, tpMin) {
  const sw = scene.clientWidth,
    sh = scene.clientHeight;
  if (!sw || !sh) return null;
  const stretch = sw / sh / (CM_IMG_W / CM_IMG_H);
  const yTopFull = (Math.min(yTopPct, yBotPct) / 100) * sh;
  let rw, rh, offX, offY;
  if (stretch >= 0.87 && stretch <= 1.14 && yTopFull >= (tpMin || 0) * 0.92) {
    rw = sw;
    rh = sh;
    offX = 0;
    offY = 0;
    scene.classList.toggle('cm-compact', sh < 780);
    scene.style.backgroundSize = '100% 100%';
  } else {
    let k = Math.max(sw / CM_IMG_W, sh / CM_IMG_H);
    // Sans jeu vertical on ne peut pas descendre le chemin sous le titre : on zoome juste ce qu'il faut.
    const yTf = Math.min(yTopPct, yBotPct) / 100;
    if (tpMin && yTf > 0.02) {
      const kNeed = tpMin / yTf / CM_IMG_H;
      k = Math.min(Math.max(k, kNeed), (1.6 * sw) / CM_IMG_W);
    }
    rw = CM_IMG_W * k;
    rh = CM_IMG_H * k;
    offX = (sw - rw) / 2;
    const yT = (Math.min(yTopPct, yBotPct) / 100) * rh,
      yB = (Math.max(yTopPct, yBotPct) / 100) * rh;
    const compact = yB - yT + 196 > sh || sh < 780;
    scene.classList.toggle('cm-compact', compact);
    const tp = Math.max(compact ? 96 : 142, tpMin || 0),
      bp = compact ? 42 : 58;
    if (yB - yT + tp + bp <= sh) {
      offY = (sh - rh) / 2;
      if (offY + yT < tp) offY = tp - yT;
      if (offY + yB > sh - bp) offY = sh - bp - yB;
    } else {
      offY = tp - yT;
    } // place trop juste : on protège le titre, le bas déborde un peu
    offY = Math.max(sh - rh, Math.min(0, offY));
    scene.style.backgroundSize = rw + 'px ' + rh + 'px';
  }
  scene.style.backgroundPosition = offX + 'px ' + offY + 'px';
  return { rw: rw, rh: rh, offX: offX, offY: offY, sw: sw, sh: sh };
}

function cmHeadBottom(scene) {
  const h = scene.querySelector('.cm-head');
  return (h ? h.offsetTop + h.offsetHeight : 76) + 10;
}

// Positionne les stations d'un volet donné (utilisé pour les 3 volets de la piste).
function cmLayoutScene(scene, moment) {
  const sw = scene.clientWidth,
    sh = scene.clientHeight;
  if (!sw || !sh) return;
  const tl = cmHeadBottom(scene);
  const def = CM_PAINT[moment];
  if (def) {
    const fp = cmFitPaint(scene, def, tl + 58);
    if (fp) cmPlacePaint(scene, def, fp, tl);
    return;
  }
  const A = cmAnchors(moment);
  const f = cmFitScene(scene, A[0][1], A[A.length - 1][1], tl + 58);
  if (!f) return;
  const rw = f.rw,
    rh = f.rh,
    offX = f.offX,
    offY = f.offY;
  cmPlaceNodes(
    scene,
    f,
    A.map(function (a) {
      return { x: offX + (a[0] / 100) * rw, y: offY + (a[1] / 100) * rh };
    }),
    VY_POLY[moment] || VY_POLY.matin,
    tl
  );
}
function cmLayout() {
  const stage = document.getElementById('cm-stage');
  if (!stage || !chDraft) return;
  cmBindSwipe(stage);
  stage.querySelectorAll('.cm-layer').forEach(function (layer) {
    const scene = layer.querySelector('.cm-scene');
    if (scene) cmLayoutScene(scene, scene.dataset.moment);
  });
  const cur = stage.querySelector('.cm-cur .cm-scene');
  if (cur) {
    cmBindLongPress(cur);
    cmBindCalib(cur);
  } // seul le calque courant réagit à l'appui long
  cmMaybeGuide();
}

// ===== Guidage discret à la création : luciole qui vole vers la 1re pancarte vide =====
function cmDraftHasProduct(d) {
  if (!d || !d.filled) return false;
  const set = CM_SETS[d.moment] || CM_SETS.matin;
  return set.some(function (k) {
    return d.filled[k];
  });
}
// Vrai si on doit guider : on édite un rituel encore vide (aucun produit posé). Le guidage
// (aide + luciole) réapparaît donc à chaque nouvelle création vide, et disparaît dès le 1er
// produit. La luciole, elle, ne se lance qu'une fois par ouverture d'édition (flag réinitialisé
// dans openRituelChemin / cmSetMode).
function cmGuideActive(d) {
  return !!(d && d.mode === 'edit' && !cmDraftHasProduct(d));
}
// Lâche une luciole (une fois par ouverture d'édition) qui rejoint la 1re pancarte vide.
function cmMaybeGuide() {
  if (window.__cmFireflyPlayed) return;
  if (!cmGuideActive(chDraft)) return;
  // La luciole repose sur offset-path (motion path). Sans support, on s'abstient plutôt que de
  // poser un point figé : l'aide texte + les cibles « + » animées guident déjà.
  const okPath = !!(
    window.CSS &&
    CSS.supports &&
    (CSS.supports('offset-path', "path('M0,0 L1,1')") ||
      CSS.supports('-webkit-offset-path', "path('M0,0 L1,1')"))
  );
  if (!okPath) {
    window.__cmFireflyPlayed = true;
    return;
  }
  const scene = document.querySelector('#rituel-chemin .cm-cur .cm-scene');
  if (!scene) return;
  if (scene.querySelector('.cm-firefly')) return;
  const empty = scene.querySelector('.cm-node.cm-empty');
  if (!empty) return;
  const sr = scene.getBoundingClientRect(),
    er = empty.getBoundingClientRect();
  if (!sr.width || !er.width) return; // pas encore mesurable : on réessaiera au prochain layout
  const ex = er.left - sr.left + er.width / 2,
    ey = er.top - sr.top + er.height / 2;
  const sw = scene.clientWidth || sr.width,
    sh = scene.clientHeight || sr.height;
  // Départ près du chemin (bas-centre) → courbe de Bézier douce qui s'élève, rejoint la pancarte,
  // en fait tranquillement le tour, puis se pose au centre. Le tout parcouru d'un seul tenant.
  const sx = sw * 0.5,
    sy = sh * 0.85,
    dx = ex - sx,
    dy = ey - sy;
  const entryX = ex + 40,
    entryY = ey + 34; // on arrive par le bas-droite de la pancarte
  const ac1x = sx - 30,
    ac1y = sy - Math.min(170, sh * 0.24); // décollage vers le haut
  const ac2x = sx + dx * 0.55,
    ac2y = sy + dy * 0.35 - 30; // grand balayage vers la pancarte
  const r = 34;
  const f = function (n) {
    return Math.round(n * 10) / 10;
  };
  const d =
    'M ' +
    f(sx) +
    ' ' +
    f(sy) +
    ' C ' +
    f(ac1x) +
    ' ' +
    f(ac1y) +
    ', ' +
    f(ac2x) +
    ' ' +
    f(ac2y) +
    ', ' +
    f(entryX) +
    ' ' +
    f(entryY) +
    ' C ' +
    f(ex + r + 6) +
    ' ' +
    f(ey + 10) +
    ', ' +
    f(ex + r - 2) +
    ' ' +
    f(ey - r + 4) +
    ', ' +
    f(ex) +
    ' ' +
    f(ey - r) + // tour : entrée → haut
    ' C ' +
    f(ex - r) +
    ' ' +
    f(ey - r + 6) +
    ', ' +
    f(ex - r - 2) +
    ' ' +
    f(ey + r - 10) +
    ', ' +
    f(ex - r * 0.4) +
    ' ' +
    f(ey + r * 0.6) + // haut → bas-gauche
    ' C ' +
    f(ex + r * 0.2) +
    ' ' +
    f(ey + r * 0.9) +
    ', ' +
    f(ex + 8) +
    ' ' +
    f(ey + 6) +
    ', ' +
    f(ex) +
    ' ' +
    f(ey); // spirale → centre
  const fly = document.createElement('div');
  fly.className = 'cm-firefly';
  fly.style.offsetPath = "path('" + d + "')";
  fly.style.webkitOffsetPath = "path('" + d + "')";
  fly.innerHTML = '<span class="cm-firefly-dot"></span>';
  fly.addEventListener('animationend', function (e) {
    if (e.animationName === 'cmFireflyMove') fly.remove();
  });
  scene.appendChild(fly);
  window.__cmFireflyPlayed = true; // une luciole par ouverture d'édition ; le texte d'aide, lui, reste tant que vide
}

// ===================== VOYAGE DU JOUR =====================
// Scènes peintes : les bâtiments font partie du décor, le code ne pose que
// les zones sensibles. Positions relevées au calibrage, en % de l'image.
// x = centre, y = base au sol, h = hauteur, r = largeur / hauteur.
const CM_BUILD = 'b31';

const CM_PAINT = {
  matin: {
    img: 'img/jardin-matin.webp',
    w: 853,
    h: 1844,
    top: 22,
    panels: true,
    pos: {
      // x,y,h,r = médaillon (utilisé par le Voyage) ; cx,cy,pw,ph,rot = panneau posé sur le support (Chemin).
      depart: { x: 40, y: 93, h: 21.78, r: 1.3 },
      nettoyer: { x: 20, y: 64, h: 13.85, r: 1.5, cx: 15.4, cy: 43.0, pw: 15, ph: 5.2, rot: 0 }, // 1 → Nettoyer
      traiter: { x: 73, y: 65, h: 18.31, r: 1.4, cx: 87.7, cy: 64.6, pw: 12.5, ph: 7.5, rot: 0 }, // 2 → Traiter
      hydrater: { x: 30, y: 35, h: 11.97, r: 1.5, cx: 28.7, cy: 30.3, pw: 13.5, ph: 4.6, rot: 0 }, // 3 → Hydrater
      proteger: { x: 72, y: 37, h: 12.87, r: 1.6, cx: 77.3, cy: 22.8, pw: 17, ph: 5, rot: 0 }, // 4 → Protéger
      arrivee: { x: 52, y: 22, h: 3.17, r: 1.6 },
    },
  },
  soir: {
    img: 'img/jardin-soir.webp',
    w: 853,
    h: 1844,
    top: 22,
    panels: true,
    pos: {
      // Même jardin (de nuit) que le matin → mêmes emplacements produits.
      nettoyer: { x: 20, y: 64, h: 13.85, r: 1.5, cx: 15.4, cy: 43.0, pw: 15, ph: 5.2, rot: 0 }, // 1 → Nettoyer
      traiter: { x: 73, y: 65, h: 18.31, r: 1.4, cx: 87.7, cy: 64.6, pw: 12.5, ph: 7.5, rot: 0 }, // 2 → Traiter
      hydrater: { x: 30, y: 35, h: 11.97, r: 1.5, cx: 28.7, cy: 30.3, pw: 13.5, ph: 4.6, rot: 0 }, // 3 → Hydrater
    },
  },
  hebdo: {
    img: 'img/clairiere.webp',
    w: 853,
    h: 1844,
    top: 22,
    panels: true,
    pos: {
      // cx,cy = centre du médaillon produit (calibré). pw/ph = zone cliquable.
      nettoyer: { x: 12, y: 72, h: 13, r: 1.4, cx: 13.3, cy: 72.8, pw: 15, ph: 8, rot: 0 }, // 1 → Nettoyer
      masque: { x: 80, y: 70, h: 13, r: 1.4, cx: 82.3, cy: 69.7, pw: 15, ph: 8, rot: 0 }, // 2 → Masque & Soins
      hydrater: { x: 51, y: 52, h: 13, r: 1.4, cx: 54.8, cy: 50.4, pw: 14, ph: 8, rot: 0 }, // 3 → Hydrater
    },
  },
};

// CM_PAINT et VY_POLY : partagées avec le module Voyage (src/features/voyage/), exposées sur
// window pour que ses lectures en identifiant nu se résolvent depuis un module strict.
window.CM_PAINT = CM_PAINT;
const VY_POLY = {
  matin: [
    [47.4, 95.5],
    [49.0, 93.4],
    [50.4, 91.3],
    [50.4, 89.2],
    [49.8, 87.1],
    [48.5, 85.0],
    [47.9, 82.9],
    [48.7, 80.8],
    [49.3, 78.7],
    [50.2, 76.6],
    [50.7, 74.5],
    [48.5, 72.4],
    [48.6, 70.3],
    [53.7, 68.2],
    [54.5, 66.1],
    [49.7, 64.0],
    [45.9, 61.9],
    [45.0, 59.8],
    [46.7, 57.7],
    [50.0, 55.6],
    [53.2, 53.5],
    [53.9, 51.4],
    [52.0, 49.3],
    [49.6, 47.2],
    [47.2, 45.1],
    [45.6, 43.0],
    [46.6, 40.9],
    [50.1, 38.8],
    [54.2, 36.7],
    [55.9, 34.6],
    [54.3, 32.5],
    [53.2, 30.4],
    [54.2, 28.3],
    [56.4, 26.2],
  ],
  soir: [
    [26.7, 95.5],
    [31.4, 93.2],
    [31.5, 90.9],
    [31.4, 88.6],
    [33.2, 86.3],
    [35.1, 84.0],
    [38.5, 81.7],
    [47.6, 79.5],
    [57.1, 77.2],
    [62.0, 74.9],
    [65.5, 72.6],
    [65.7, 70.3],
    [60.1, 68.0],
    [52.1, 65.7],
    [44.1, 63.4],
    [36.4, 61.2],
    [32.7, 58.9],
    [40.2, 56.6],
    [54.8, 54.3],
    [64.2, 52.0],
    [62.5, 49.7],
    [51.4, 47.4],
    [41.4, 45.1],
    [42.4, 42.9],
    [51.4, 40.6],
    [54.5, 38.3],
    [48.2, 36.0],
    [46.7, 33.7],
    [51.5, 31.4],
    [53.4, 29.1],
    [53.8, 26.9],
    [54.7, 24.6],
    [52.7, 22.3],
    [45.9, 20.0],
  ],
  hebdo: [
    [59.2, 95.5],
    [56.9, 93.2],
    [52.4, 90.9],
    [50.4, 88.6],
    [47.0, 86.3],
    [41.4, 84.0],
    [39.2, 81.7],
    [39.3, 79.5],
    [40.7, 77.2],
    [45.4, 74.9],
    [52.4, 72.6],
    [59.0, 70.3],
    [64.4, 68.0],
    [68.3, 65.7],
    [69.0, 63.4],
    [66.8, 61.2],
    [64.1, 58.9],
    [59.9, 56.6],
    [50.3, 54.3],
    [39.1, 52.0],
    [33.0, 49.7],
    [33.6, 47.4],
    [38.7, 45.1],
    [47.7, 42.9],
    [60.2, 40.6],
    [70.5, 38.3],
    [69.8, 36.0],
    [57.7, 33.7],
    [43.4, 31.4],
    [38.7, 29.1],
    [45.9, 26.9],
    [52.8, 24.6],
    [53.6, 22.3],
    [56.1, 20.0],
  ],
};
window.VY_POLY = VY_POLY; // partagée avec le module Voyage (lecture via window)

// ===== Voyage du jour → extrait dans src/features/voyage/voyage.js (Phase B). =====

// --- carte d'accroche sur l'accueil ---
function renderHomeVoyage() {
  const hero = document.getElementById('vy-hero');
  if (!hero) return;
  const m = typeof currentPeriod !== 'undefined' && currentPeriod ? currentPeriod : 'matin';
  const items = (window.__homeRoutine || {})[m] || [];
  if (!items.length) {
    hero.style.display = 'none';
    return;
  }
  const list = document.getElementById('routine-' + m);
  const done = list
    ? [].slice.call(list.querySelectorAll('.routine-item.done')).map(function (x) {
        return x.dataset.pid;
      })
    : [];
  const n = items.length,
    nOk = items.filter(function (p) {
      return done.indexOf(p.id) >= 0;
    }).length;
  let last = -1;
  items.forEach(function (p, i) {
    if (done.indexOf(p.id) >= 0) last = i;
  });
  const allDone = nOk === n;
  const t = allDone ? 1 : last < 0 ? 0 : (last + 1) / (n + 1);
  const P = VY_POLY[m] || VY_POLY.matin;
  // position de la plante sur la bande visible de la carte (fenêtre 30%→80% de l'image)
  const q = P[Math.round(t * (P.length - 1))];
  const vx = q[0],
    vy = Math.max(6, Math.min(94, ((q[1] - 30) / 50) * 100));
  const meta = cmMomentMeta(m);
  const sub = allDone
    ? 'Voyage termin\u00e9 \u00b7 bravo \ud83c\udf38'
    : nOk
      ? nOk + ' \u00e9tape' + (nOk > 1 ? 's' : '') + ' sur ' + n + ' \u00b7 continue'
      : "Ta plante t'attend au d\u00e9part";
  hero.style.display = 'block';
  hero.innerHTML =
    '<div class="vy-hero-img" style="background-image:url(\'' +
    cmTheme(m).img +
    '\');">' +
    '<div class="vy-hero-plant" style="left:' +
    vx +
    '%;top:' +
    vy +
    '%;">' +
    (allDone ? '\ud83c\udf3f' : '\ud83c\udf31') +
    '</div></div>' +
    '<div class="vy-hero-body"><div class="vy-hero-txt"><div class="vy-hero-t">' +
    escapeHtml(meta.ph) +
    '</div>' +
    '<div class="vy-hero-s">' +
    sub +
    '</div></div>' +
    '<span class="vy-hero-cta">' +
    (allDone ? 'Revoir' : nOk ? 'Continuer' : 'Commencer') +
    '</span></div>' +
    '<div class="vy-hero-bar"><div class="vy-hero-fill" style="width:' +
    Math.round((nOk / n) * 100) +
    '%;"></div></div>';
}
function toggleHrList() {
  const l = document.getElementById('hr-lists'),
    b = document.getElementById('hr-listtoggle');
  if (!l || !b) return;
  const open = l.style.display !== 'none';
  l.style.display = open ? 'none' : 'block';
  b.textContent = open ? 'Voir en liste' : 'Masquer la liste';
}
window.addEventListener('resize', function () {
  if (vyState) vyLayout();
});

window.addEventListener('resize', function () {
  cmLayout();
});
window.addEventListener('orientationchange', function () {
  setTimeout(cmLayout, 180);
});

function cmInfo(key, idx) {
  cmOpenCarousel(key, idx, true);
}
// En-tête de la fiche : un gros plan du lieu, découpé dans la scène peinte
// grâce aux coordonnées du calibrage. Aucune image supplémentaire à charger.
function cmSheetHead(key, ph) {
  const def = chDraft && CM_PAINT[chDraft.moment];
  if (!def || !def.pos[key]) return '';
  return (
    '<div class="cm-sheet-img" id="cm-sheet-img">' +
    '<div class="cm-pop-grip"></div>' +
    '<button class="cm-pop-x" onclick="cmClosePop()" aria-label="Fermer">\u00d7</button>' +
    '<div class="cm-sheet-t">' +
    ph.nom +
    '</div></div>'
  );
}
function cmSheetZoom(pop, key) {
  const el = pop.querySelector('#cm-sheet-img');
  if (!el) return;
  const def = CM_PAINT[chDraft.moment],
    st = def.pos[key];
  const W = el.offsetWidth || 300,
    H = el.offsetHeight || 158;
  const largeurVue = Math.max(st.h * st.r * 2.2, 22); // largeur du cadrage, en % de l'image
  const iw = W / (largeurVue / 100),
    ih = (iw * def.h) / def.w;
  el.style.backgroundImage = "url('" + def.img + "')";
  el.style.backgroundSize = Math.round(iw) + 'px ' + Math.round(ih) + 'px';
  el.style.backgroundPosition =
    Math.round(W / 2 - (st.x / 100) * iw) +
    'px ' +
    Math.round(H / 2 - ((st.y - st.h * 0.52) / 100) * ih) +
    'px';
}

function cmOpenCarousel(key, idx, infoOnly) {
  const scroll = document.getElementById('rituel-chemin');
  const scene = scroll.querySelector('.cm-scene');
  if (!scene) return;
  if (!document.getElementById('cm-pop')) {
    const d = document.createElement('div');
    d.id = 'cm-pop';
    d.className = 'cm-pop';
    scroll.appendChild(d);
  }
  const ph = CM_PHASES[key],
    list = cmProductsForPhase(key),
    cur = chDraft.filled[key];
  let cards;
  if (infoOnly) {
    cards = '';
  } else if (list.length) {
    cards = list
      .map(function (p) {
        const parts = (p.nom || '').split(' · ');
        const u = (window.__cmPhotos || {})[p.id];
        const e = u
          ? '<img src="' +
            u +
            '" alt="" style="width:38px;height:38px;border-radius:50%;object-fit:cover;">'
          : p.emoji || '🧴';
        return (
          '<div class="cm-pcard' +
          (cur === p.id ? ' sel' : '') +
          '" onclick="cmPick(\'' +
          key +
          "','" +
          p.id +
          '\')"><div class="cm-pcard-e">' +
          e +
          '</div><div class="cm-pcard-n">' +
          escapeHtml(parts[0] || '') +
          '</div><div class="cm-pcard-b">' +
          escapeHtml(parts[1] || '') +
          '</div></div>'
        );
      })
      .join('');
  } else {
    cards =
      '<div class="cm-pop-none">Aucun produit dans cette catégorie.<br>Ajoute-en un depuis l\'onglet Produits.</div>';
  }
  const removeBtn =
    cur && !infoOnly
      ? '<button class="cm-pop-remove" onclick="cmClear(\'' +
        key +
        '\')">Retirer de cette étape</button>'
      : '';
  const pop = document.getElementById('cm-pop');
  const head = cmSheetHead(key, ph);
  pop.innerHTML =
    head +
    (head
      ? ''
      : '<div class="cm-pop-grip"></div><div class="cm-pop-h"><div class="cm-pop-t">' +
        ph.emoji +
        '  ' +
        ph.nom +
        '</div><button class="cm-pop-x" onclick="cmClosePop()">\u00d7</button></div>') +
    cmTipHtml(key) +
    (cards ? '<div class="cm-car">' + cards + '</div>' : '') +
    removeBtn +
    '<button class="cm-pop-skip" onclick="cmClosePop()">Fermer</button>';

  let veil = document.getElementById('cm-veil');
  if (!veil) {
    veil = document.createElement('div');
    veil.id = 'cm-veil';
    veil.className = 'cm-pop-veil';
    veil.onclick = cmClosePop;
    scroll.appendChild(veil);
  }
  cmSheetZoom(pop, key);
  cmNavTuck(true);
  requestAnimationFrame(function () {
    pop.classList.add('show');
    const v = document.getElementById('cm-veil');
    if (v) v.classList.add('show');
  });
}
function cmClosePop() {
  const p = document.getElementById('cm-pop');
  if (p) p.classList.remove('show');
  const v = document.getElementById('cm-veil');
  if (v) v.classList.remove('show');
  cmNavTuck(false);
}

// ===== Panneau des rituels : la fleur en est la poignée =====
// La fleur n'ouvre plus un menu : elle déploie un panneau en verre dépoli chaud qui devient
// la porte d'entrée de TOUS les rituels. Onglets Matin/Soir/Hebdo, carte du rituel courant
// mise en avant, carrousel des autres rituels de la période. Plus de page « Mes rituels ».
// Contrainte : le décor est UNE image — on n'anime jamais que le panneau et l'UI.

// Regroupe les rituels par période (un « both » compte matin ET soir).
function cmGroups() {
  const rits = window.__allRituels || [];
  const g = { matin: [], soir: [], hebdo: [] };
  rits.forEach(function (r) {
    const m = r.moment || 'matin';
    if (m === 'both') {
      g.matin.push(r);
      g.soir.push(r);
    } else if (g[m]) g[m].push(r);
    else g.matin.push(r);
  });
  return g;
}
// Le rituel actuellement à l'écran (celui du draft), s'il existe encore en mémoire.
function cmCurrentRitual() {
  if (!chDraft || !chDraft.id) return null;
  return (
    (window.__allRituels || []).find(function (r) {
      return String(r.id) === String(chDraft.id);
    }) || null
  );
}

function cmTogglePanel() {
  const ov = document.getElementById('rituel-chemin');
  if (ov && ov.classList.contains('cm-panel-open')) cmClosePanel();
  else cmOpenPanel();
}
function cmOpenPanel() {
  const ov = document.getElementById('rituel-chemin');
  if (!ov) return;
  // Panneau & voile sur <body> : ils survivent aux re-render de cmRender (qui remplace
  // l'innerHTML du chemin lors d'un changement d'onglet ou de rituel).
  let veil = document.getElementById('cm-panel-veil');
  if (!veil) {
    veil = document.createElement('div');
    veil.id = 'cm-panel-veil';
    veil.className = 'cm-panel-veil';
    veil.onclick = cmClosePanel;
    document.body.appendChild(veil);
  }
  let panel = document.getElementById('cm-panel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'cm-panel';
    panel.className = 'cm-rpanel';
    document.body.appendChild(panel);
  }
  cmPanelRender();
  ov.classList.add('cm-panel-open');
  if (navigator.vibrate) navigator.vibrate(6);
  requestAnimationFrame(function () {
    veil.classList.add('show');
    panel.classList.add('show');
  });
}
function cmClosePanel() {
  const ov = document.getElementById('rituel-chemin');
  if (ov) ov.classList.remove('cm-panel-open');
  const p = document.getElementById('cm-panel');
  if (p) p.classList.remove('show');
  const v = document.getElementById('cm-panel-veil');
  if (v) v.classList.remove('show');
}
// Alias conservés pour les appels existants (fin d'édition, fermeture du chemin).
function cmCloseMenu() {
  cmClosePanel();
}

// Construit l'aperçu des 3 premières étapes du rituel courant.
function cmPanelSteps() {
  const moment = (chDraft && chDraft.moment) || 'matin';
  const set = CM_SETS[moment] || CM_SETS.matin;
  const pmap = {};
  (window.__cmProds || []).forEach(function (p) {
    pmap[p.id] = p;
  });
  const photos = window.__cmPhotos || {};
  const steps = [];
  set.forEach(function (k) {
    const pid = chDraft && chDraft.filled ? chDraft.filled[k] : null;
    if (!pid) return;
    const p = pmap[pid];
    const ph = CM_PHASES[k];
    const ic = photos[pid]
      ? '<img src="' + photos[pid] + '" alt="">'
      : (p && p.emoji) || (ph && ph.emoji) || '🧴';
    steps.push({ ic: ic, ph: ph ? ph.nom : '', sub: p ? escapeHtml(p.nom || '') : '' });
  });
  return steps;
}

function cmPanelRender() {
  const panel = document.getElementById('cm-panel');
  if (!panel) return;
  const moment = (chDraft && chDraft.moment) || rpSlotView || 'matin';
  const groups = cmGroups();
  const cur = cmCurrentRitual();
  const pmap = {};
  (window.__cmProds || []).forEach(function (p) {
    pmap[p.id] = p;
  });
  const photos = window.__cmPhotos || {};

  // Onglets Matin / Soir / Hebdo
  const TABS = [
    ['matin', '☀️', 'Matin'],
    ['soir', '🌙', 'Soir'],
    ['hebdo', '🌿', 'Hebdo'],
  ];
  let tabs = '<div class="cm-panel-tabs">';
  TABS.forEach(function (t) {
    tabs +=
      '<button class="cm-ptab' +
      (t[0] === moment ? ' on' : '') +
      '" onclick="cmPanelGoTab(\'' +
      t[0] +
      '\')">' +
      '<span class="cm-ptab-e">' +
      t[1] +
      '</span>' +
      t[2] +
      '</button>';
  });
  tabs += '</div>';

  // Carte du rituel courant (mise en avant)
  let card;
  if (cur) {
    const steps = cmPanelSteps();
    const shown = steps.slice(0, 3);
    let stepsHtml;
    if (shown.length) {
      stepsHtml =
        '<div class="cm-rsteps">' +
        shown
          .map(function (s) {
            return (
              '<div class="cm-rstep"><span class="cm-rstep-ic">' +
              s.ic +
              '</span>' +
              '<span class="cm-rstep-tx"><div class="cm-rstep-ph">' +
              s.ph +
              '</div>' +
              (s.sub ? '<div class="cm-rstep-sub">' + s.sub + '</div>' : '') +
              '</span></div>'
            );
          })
          .join('') +
        '</div>';
      if (steps.length > 3)
        stepsHtml +=
          '<div class="cm-rstep-more">+ ' +
          (steps.length - 3) +
          ' autre' +
          (steps.length - 3 > 1 ? 's' : '') +
          '</div>';
    } else {
      stepsHtml =
        '<div class="cm-rempty">Aucune étape pour l\'instant. Ouvre « Modifier » pour composer ton chemin 🌿</div>';
    }
    const toggle =
      '<button class="cm-rcard-actif' +
      (cur.actif ? ' on' : '') +
      '" onclick="cmPanelToggleActif()" title="' +
      (cur.actif ? 'Mettre en pause' : 'Activer ce rituel') +
      '">' +
      '<span class="cm-rcard-dot"></span>' +
      (cur.actif ? 'Actif' : 'En pause') +
      '</button>';
    const hasRem = !!(cur.rappels && cur.rappels.on);
    const bell =
      '<button class="cm-rbell' +
      (hasRem ? ' on' : '') +
      '" onclick="cmPanelRappel()" title="Rappels" aria-label="Régler les rappels">' +
      (hasRem ? '🔔' : '🔕') +
      '</button>';
    card =
      '<div class="cm-rcard">' +
      '<div class="cm-rcard-top"><div class="cm-rcard-name">' +
      escapeHtml(cur.nom || cmMomentMeta(moment).ph) +
      '</div>' +
      bell +
      toggle +
      '</div>' +
      stepsHtml +
      '<div class="cm-ractions">' +
      '<button class="cm-ract primary" onclick="cmPanelEdit()"><span class="cm-ract-e">✏️</span>Modifier</button>' +
      '<button class="cm-ract" onclick="cmPanelDuplicate()"><span class="cm-ract-e">📄</span>Dupliquer</button>' +
      '<button class="cm-ract danger" onclick="cmPanelDelete()"><span class="cm-ract-e">🗑️</span>Supprimer</button>' +
      '</div></div>';
  } else {
    card =
      '<div class="cm-rcard"><div class="cm-rempty" style="padding:6px 2px 14px;">Aucun rituel ' +
      (moment === 'soir' ? 'du soir' : moment === 'hebdo' ? 'hebdo' : 'du matin') +
      " pour l'instant.</div>" +
      '<div class="cm-ractions"><button class="cm-ract primary" style="flex:none;padding:9px 16px;" onclick="cmPanelNew()"><span class="cm-ract-e">＋</span>Créer ce rituel</button></div></div>';
  }

  // Carrousel : les autres rituels de la période (hors rituel courant)
  const others = (groups[moment] || []).filter(function (r) {
    return !cur || String(r.id) !== String(cur.id);
  });
  let caro = '';
  if (others.length) {
    caro =
      '<div class="cm-rcaro-lbl">Autres rituels</div><div class="cm-rcaro">' +
      others
        .map(function (r) {
          const ids = Array.isArray(r.produits) ? r.produits : [];
          let dots = ids
            .slice(0, 3)
            .map(function (id) {
              const p = pmap[id];
              const inner = photos[id]
                ? '<img src="' + photos[id] + '" alt="">'
                : (p && p.emoji) || '🧴';
              return '<span class="cm-rmini-dot">' + inner + '</span>';
            })
            .join('');
          if (ids.length > 3) dots += '<span class="cm-rmini-n">+' + (ids.length - 3) + '</span>';
          if (!ids.length) dots = '<span class="cm-rmini-n">Vide</span>';
          return (
            '<button class="cm-rmini" onclick="cmPanelSelect(\'' +
            r.id +
            '\')">' +
            '<div class="cm-rmini-name">' +
            escapeHtml(r.nom || cmMomentMeta(moment).ph) +
            '</div>' +
            '<div class="cm-rmini-dots">' +
            dots +
            '</div></button>'
          );
        })
        .join('') +
      '</div>';
  }

  panel.innerHTML =
    '<div class="cm-panel-hd">Rituels</div>' +
    tabs +
    '<div class="cm-panel-body">' +
    card +
    caro +
    '<button class="cm-rnew" onclick="cmPanelNew()">＋ Nouveau rituel</button></div>';
}

// Changer d'onglet : affiche le rituel actif de cette période (ou vide si aucun),
// sans quitter le panneau. Le décor défile via cmShowSlot ; le panneau se recompose.
function cmPanelGoTab(m) {
  if (!m) return;
  cmSaveIfEditing(); // ne pas perdre une édition en cours en changeant d'onglet
  rpSlotView = m;
  cmShowSlot(m);
  cmPanelRender();
}
// Un clic sur une carte du carrousel charge immédiatement ce rituel (il devient l'actif
// de sa période), met à jour le décor et recompose le panneau. Persistance en arrière-plan.
async function cmPanelSelect(id) {
  const all = window.__allRituels || [];
  const t = all.find(function (r) {
    return String(r.id) === String(id);
  });
  if (!t) return;
  cmSaveIfEditing(); // ne pas perdre une édition en cours en chargeant un autre rituel
  if (navigator.vibrate) navigator.vibrate(6);
  const tM = t.moment === 'matin' || t.moment === 'both',
    tS = t.moment === 'soir' || t.moment === 'both';
  let off = [];
  if (t.moment === 'hebdo') {
    off = all
      .filter(function (r) {
        return r.actif && r.moment === 'hebdo' && String(r.id) !== String(t.id);
      })
      .map(function (r) {
        return r.id;
      });
  } else {
    off = all
      .filter(function (r) {
        return (
          r.actif &&
          String(r.id) !== String(t.id) &&
          r.moment !== 'hebdo' &&
          ((tM && (r.moment === 'matin' || r.moment === 'both')) ||
            (tS && (r.moment === 'soir' || r.moment === 'both')))
        );
      })
      .map(function (r) {
        return r.id;
      });
  }
  off.forEach(function (oid) {
    const o = all.find(function (r) {
      return r.id === oid;
    });
    if (o) o.actif = false;
  });
  t.actif = true;
  chDraft = cmDraftFor(t.moment);
  cmRender();
  cmPanelRender();
  try {
    if (off.length) await sb.from('rituels').update({ actif: false }).in('id', off);
    await sb.from('rituels').update({ actif: true }).eq('id', id);
  } catch (e) {}
  // On NE vide PAS window.__allRituels (le panneau en dépend) : loadRituels le rafraîchit.
  if (typeof loadRituels === 'function') loadRituels();
  if (typeof loadHomeRoutine === 'function') loadHomeRoutine();
}
// Active ou met en pause le rituel courant, directement depuis la carte. Un seul rituel
// actif par créneau (matin/soir/hebdo) : activer celui-ci met les concurrents en pause.
async function cmPanelToggleActif() {
  const cur = cmCurrentRitual();
  if (!cur) return;
  const all = window.__allRituels || [];
  if (navigator.vibrate) navigator.vibrate(6);
  const turnOn = !cur.actif;
  let off = [];
  if (turnOn) {
    if (cur.moment === 'hebdo') {
      off = all
        .filter(function (r) {
          return r.actif && r.moment === 'hebdo' && String(r.id) !== String(cur.id);
        })
        .map(function (r) {
          return r.id;
        });
    } else {
      const tM = cur.moment === 'matin' || cur.moment === 'both',
        tS = cur.moment === 'soir' || cur.moment === 'both';
      off = all
        .filter(function (r) {
          return (
            r.actif &&
            String(r.id) !== String(cur.id) &&
            r.moment !== 'hebdo' &&
            ((tM && (r.moment === 'matin' || r.moment === 'both')) ||
              (tS && (r.moment === 'soir' || r.moment === 'both')))
          );
        })
        .map(function (r) {
          return r.id;
        });
    }
    off.forEach(function (oid) {
      const o = all.find(function (r) {
        return r.id === oid;
      });
      if (o) o.actif = false;
    });
  }
  cur.actif = turnOn;
  cmPanelRender();
  try {
    if (off.length) await sb.from('rituels').update({ actif: false }).in('id', off);
    await sb.from('rituels').update({ actif: turnOn }).eq('id', cur.id);
  } catch (e) {
    if (typeof showToast === 'function') showToast('Oups, réessaie 🌿');
  }
  if (typeof loadRituels === 'function') loadRituels();
  if (typeof loadHomeRoutine === 'function') loadHomeRoutine();
  if (typeof showToast === 'function')
    showToast(turnOn ? 'Rituel activé ✨' : 'Rituel mis en pause 🌙');
}
// Ouvre le réglage des rappels (semainier + heure) pour le rituel courant. L'overlay des
// rappels (module src/features/reminders/) se superpose au panneau ; à la fermeture, on
// recompose la carte pour rafraîchir l'état de la cloche.
function cmPanelRappel() {
  const cur = cmCurrentRitual();
  if (!cur || !cur.id) return;
  if (typeof window.rhOpenRappel === 'function') window.rhOpenRappel(null, cur.id);
}
// Modifier le rituel courant : on referme le panneau et on bascule le chemin en édition.
function cmPanelEdit() {
  const cur = cmCurrentRitual();
  if (!cur) return;
  cmClosePanel();
  cmSetMode('edit');
}
// Nouveau rituel pour la période affichée : referme le panneau et ouvre un chemin vierge.
function cmPanelNew() {
  const moment = (chDraft && chDraft.moment) || rpSlotView || 'matin';
  cmSaveIfEditing(); // ne pas perdre une édition en cours avant d'ouvrir un rituel vierge
  cmClosePanel();
  if (typeof openRituelChemin === 'function') openRituelChemin(null, moment);
}
// Duplique le rituel courant : la copie reste en pause, apparaît dans le carrousel.
async function cmPanelDuplicate() {
  const cur = cmCurrentRitual();
  if (!cur || !cur.id) return;
  const moment = (chDraft && chDraft.moment) || 'matin';
  if (navigator.vibrate) navigator.vibrate(6);
  const nom = ((cur.nom || cmMomentMeta(moment).ph) + ' (copie)').slice(0, 40);
  try {
    const { data } = await sb
      .from('rituels')
      .insert({
        user_id: currentUser.id,
        nom: nom,
        moment: cur.moment,
        produits: Array.isArray(cur.produits) ? cur.produits.slice() : [],
        position: 0,
        actif: false,
        rappels: cur.rappels || { on: false, days: [], hebdoDay: 1 },
      })
      .select('*')
      .maybeSingle();
    if (data && window.__allRituels) window.__allRituels.push(data);
  } catch (e) {
    if (typeof showToast === 'function') showToast('Oups, réessaie 🌿');
    return;
  }
  cmPanelRender();
  if (typeof showToast === 'function') showToast('Rituel dupliqué 🌿');
  if (typeof loadRituels === 'function') loadRituels();
}
// Supprime le rituel courant, puis bascule sur le rituel suivant de la même période
// (ou l'état vide), sans quitter le panneau.
async function cmPanelDelete() {
  const cur = cmCurrentRitual();
  if (!cur || !cur.id) {
    return;
  }
  const moment = (chDraft && chDraft.moment) || 'matin';
  if (
    !(await cmAsk({
      titre: 'Supprimer ce rituel ?',
      texte: 'Le rituel et son parcours seront effacés. Tes produits, eux, ne bougent pas.',
      ok: 'Supprimer',
      annuler: 'Annuler',
      danger: true,
    }))
  )
    return;
  try {
    await sb.from('rituels').delete().eq('id', cur.id);
  } catch (e) {}
  const all = window.__allRituels || [];
  const idx = all.findIndex(function (r) {
    return String(r.id) === String(cur.id);
  });
  if (idx >= 0) all.splice(idx, 1);
  if (typeof showToast === 'function') showToast('Rituel supprimé');
  // Bascule sur un rituel restant de la période (activé) sinon état vide.
  const next = (cmGroups()[moment] || [])[0] || null;
  if (next && !next.actif) {
    next.actif = true;
    try {
      await sb.from('rituels').update({ actif: true }).eq('id', next.id);
    } catch (e) {}
  }
  chDraft = cmDraftFor(moment);
  cmRender();
  cmPanelRender();
  if (typeof loadRituels === 'function') loadRituels();
  if (typeof loadHomeRoutine === 'function') loadHomeRoutine();
}

// ===== Swipe horizontal matin ↔ soir ↔ hebdo =====
// Transition en calques : le voisin arrive par-dessus le courant en fondu (crossfade),
// le courant recule légèrement et s'estompe (parallaxe). Deux plans qui se fondent → une
// sensation d'univers continu plutôt qu'un changement de page. Le calque courant couvre
// toujours l'écran, donc aucun vide, à n'importe quelle vitesse de geste.
const CM_ORDER = ['matin', 'soir', 'hebdo'];
let cmAnim = false; // vrai pendant l'animation de fin de geste : bloque un nouveau geste tant qu'on n'a pas fini (anti-désync du swipe rapide)

function cmSwipeMoment(dir) {
  if (!chDraft) return;
  const i = CM_ORDER.indexOf(chDraft.moment);
  const next = CM_ORDER[(i + dir + CM_ORDER.length) % CM_ORDER.length];
  rpSlotView = next;
  chDraft = cmDraftFor(next);
  cmRender(); // le nouveau courant reprend exactement là où le voisin venait de se poser → raccord invisible
  cmAnim = false;
}
// Exécute cb une fois la transition de `el` terminée (avec filet de sécurité si l'événement ne part pas).
function cmAfter(el, cb) {
  let done = false;
  const fin = function (e) {
    if (e && e.target !== el) return;
    if (done) return;
    done = true;
    el.removeEventListener('transitionend', fin);
    cb();
  };
  el.addEventListener('transitionend', fin);
  setTimeout(fin, 460);
}

function cmBindSwipe(stage) {
  if (stage.__sw) return;
  stage.__sw = true;
  const cur = stage.querySelector('[data-role="cur"]');
  const prev = stage.querySelector('[data-role="prev"]');
  const next = stage.querySelector('[data-role="next"]');
  let x0 = 0,
    y0 = 0,
    dx = 0,
    axis = null,
    vx = 0,
    lastX = 0,
    lastT = 0,
    w = 0;

  const TR = 'transform .32s cubic-bezier(.22,.61,.36,1),opacity .32s ease';
  function setTr(on) {
    [prev, next].forEach(function (l) {
      if (l) l.style.transition = on ? TR : 'none';
    });
  }
  function rest(l, side) {
    if (!l) return;
    l.style.transform = 'translateX(' + (side < 0 ? '-100%' : '100%') + ')';
    l.style.opacity = 0;
  }
  // Le calque courant reste TOUJOURS plein écran et opaque : impossible de voir le fond
  // de l'appli. Seul le voisin visé glisse par-dessus en se révélant en fondu (crossfade)
  // → les deux paysages se fondent l'un dans l'autre, sans aucune coupure blanche.
  function paint(dxv) {
    const p = Math.min(Math.abs(dxv) / w, 1);
    if (dxv > 0) {
      prev.style.transform = 'translateX(' + (dxv - w) + 'px)';
      prev.style.opacity = p.toFixed(3);
      rest(next, 1);
    } else if (dxv < 0) {
      next.style.transform = 'translateX(' + (w + dxv) + 'px)';
      next.style.opacity = p.toFixed(3);
      rest(prev, -1);
    } else {
      rest(prev, -1);
      rest(next, 1);
    }
  }

  stage.addEventListener(
    'touchstart',
    function (e) {
      if (cmAnim || e.touches.length !== 1) return;
      const t = e.touches[0];
      x0 = lastX = t.clientX;
      y0 = t.clientY;
      lastT = Date.now();
      dx = 0;
      axis = null;
      vx = 0;
      w = stage.clientWidth || window.innerWidth;
      setTr(false);
    },
    { passive: true }
  );
  stage.addEventListener(
    'touchmove',
    function (e) {
      if (cmAnim || e.touches.length !== 1 || (axis && axis !== 'x')) return;
      const t = e.touches[0];
      const ddx = t.clientX - x0,
        ddy = t.clientY - y0;
      if (!axis) {
        // Seuil relevé (12px) + exigence d'un mouvement franchement horizontal pour verrouiller
        // un swipe : un simple tap (même un peu tremblant) n'est plus avalé comme un geste.
        if (Math.abs(ddx) < 12 && Math.abs(ddy) < 12) return;
        axis = Math.abs(ddx) > Math.abs(ddy) * 1.25 ? 'x' : 'y';
        if (axis !== 'x') return;
      }
      e.preventDefault();
      dx = ddx;
      const now = Date.now();
      if (now > lastT) vx = (t.clientX - lastX) / (now - lastT);
      lastX = t.clientX;
      lastT = now;
      paint(dx);
    },
    { passive: false }
  );
  stage.addEventListener('touchend', function () {
    if (axis !== 'x') {
      axis = null;
      return;
    }
    axis = null;
    const p = Math.abs(dx) / w;
    const commit = dx !== 0 && (p > 0.3 || Math.abs(vx) > 0.4);
    const rev = dx < 0 ? next : prev;
    setTr(true);
    if (commit) {
      const dir = dx < 0 ? 1 : -1;
      cmAnim = true;
      rev.style.transform = 'translateX(0)';
      rev.style.opacity = 1; // le voisin recouvre complètement, par-dessus le courant intact
      cmAfter(rev, function () {
        cmSwipeMoment(dir);
      });
    } else {
      cmAnim = true;
      rest(prev, -1);
      rest(next, 1); // le voisin repart en douceur, le courant n'a jamais bougé
      cmAfter(rev, function () {
        cmAnim = false;
        setTr(false);
      });
    }
  });
  stage.addEventListener('touchcancel', function () {
    if (axis === 'x') {
      const rev = dx < 0 ? next : prev;
      setTr(true);
      rest(prev, -1);
      rest(next, 1);
      cmAnim = true;
      cmAfter(rev, function () {
        cmAnim = false;
        setTr(false);
      });
    }
    axis = null;
  });
}
function cmPick(key, pid) {
  chDraft.filled[key] = pid;
  // 1er produit posé → le rituel n'est plus vide : l'aide et la luciole disparaissent d'elles-mêmes
  // (cmGuideActive devient faux) au re-render ci-dessous.
  cmClosePop();
  cmRender();
  cmAutoSave();
  // La station se réveille : brève pulsation du médaillon.
  requestAnimationFrame(function () {
    const nd = document.querySelector('#rituel-chemin .cm-cur .cm-node[data-bld="' + key + '"]');
    if (!nd) return;
    nd.classList.add('cm-pose');
    setTimeout(function () {
      nd.classList.remove('cm-pose');
    }, 560);
  });
}
function cmClear(key) {
  delete chDraft.filled[key];
  cmClosePop();
  cmRender();
  cmAutoSave();
}
function cmSetMode(m) {
  if (!chDraft) return;
  chDraft.mode = m;
  if (m === 'edit') window.__cmFireflyPlayed = false;
  cmRender();
}
// Boîte de dialogue maison : les fenêtres du navigateur cassent l'ambiance.
// cmAsk : extrait dans src/ui/dialog.js.

async function cmRename() {
  const n = await cmAsk({
    titre: 'Nom du rituel',
    champ: true,
    valeur: chDraft.nom || '',
    placeholder: 'Rituel du matin',
    ok: 'Enregistrer',
  });
  if (n !== null) {
    chDraft.nom = n;
    cmRender();
    cmAutoSave();
  }
}

function cmWow() {
  const spk = ['✦', '✧', '🌟', '⭐', '💫', '🌸'];
  for (let i = 0; i < 20; i++) {
    const s = document.createElement('div');
    s.className = 'cm-spark';
    s.textContent = spk[i % spk.length];
    s.style.left = '50%';
    s.style.top = '55%';
    const ang = Math.random() * Math.PI * 2,
      dist = 90 + Math.random() * 180;
    s.style.setProperty('--dx', Math.cos(ang) * dist + 'px');
    s.style.setProperty('--dy', Math.sin(ang) * dist - 60 + 'px');
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
  const meta = cmMomentMeta(chDraft.moment);
  w.innerHTML =
    '<div class="cm-wow-card"><div class="cm-wow-badge">🌿</div><div class="cm-wow-t">Ton rituel est prêt !</div><div class="cm-wow-s">Ton chemin est tracé. Retrouve-le chaque jour dans "Aujourd\'hui" 🌸</div><button class="cm-wow-btn" onclick="cmWowClose()">Voir mon rituel 🌸</button></div>';
  setTimeout(function () {
    w.classList.add('show');
  }, 240);
}
function cmWowClose() {
  const w = document.getElementById('cm-wow');
  if (w) w.classList.remove('show');
  cmBackToList();
}

// Enregistre le rituel courant (création ou mise à jour). Silencieux : aucune célébration,
// aucun changement de mode. C'est la brique de l'enregistrement automatique.
async function cmPersist() {
  if (!chDraft) return;
  // GARDE-FOU : si les produits ne sont pas chargés, chDraft.filled n'est pas fiable
  // (il serait vide) → on refuse de sauvegarder pour ne JAMAIS écraser les produits du rituel.
  if (!window.__cmProds) {
    return;
  }
  const set = CM_SETS[chDraft.moment] || CM_SETS.matin;
  const produits = set
    .map(function (k) {
      return chDraft.filled[k];
    })
    .filter(Boolean);
  const meta = cmMomentMeta(chDraft.moment);
  const nom = (chDraft.nom || '').trim() || meta.ph;
  try {
    if (chDraft.id) {
      await sb
        .from('rituels')
        .update({ nom: nom, moment: chDraft.moment, produits: produits, actif: true })
        .eq('id', chDraft.id);
    } else {
      const { data } = await sb
        .from('rituels')
        .insert({
          user_id: currentUser.id,
          nom: nom,
          moment: chDraft.moment,
          produits: produits,
          position: 0,
          actif: true,
          rappels: chDraft.rappels || { on: false, days: [], hebdoDay: 1 },
        })
        .select('id')
        .maybeSingle();
      if (data) {
        chDraft.id = data.id;
        chDraft._created = true;
      }
    }
  } catch (e) {}
  // On NE vide PLUS window.__allRituels (le panneau et le décor en dépendent — le vider faisait
  // disparaître tous les rituels pendant l'auto-save). On synchronise le cache en mémoire :
  // la création/màj apparaît instantanément, puis loadRituels rafraîchit depuis la base.
  if (!Array.isArray(window.__allRituels)) window.__allRituels = [];
  if (chDraft.id) {
    const snap = { nom: nom, moment: chDraft.moment, produits: produits, actif: true };
    const ex = window.__allRituels.find(function (r) {
      return String(r.id) === String(chDraft.id);
    });
    if (ex) Object.assign(ex, snap);
    else
      window.__allRituels.push(
        Object.assign(
          {
            id: chDraft.id,
            user_id: currentUser && currentUser.id,
            rappels: chDraft.rappels || { on: false, days: [], hebdoDay: 1 },
          },
          snap
        )
      );
  }
  if (typeof loadRituels === 'function') loadRituels();
  if (typeof loadHomeRoutine === 'function') loadHomeRoutine();
}

// Enregistrement automatique DÉSACTIVÉ : la sauvegarde se fait au bouton « Enregistrer »
// (cmFinishEdit). Les modifications restent en mémoire (chDraft) pendant l'édition ; un filet
// de sécurité silencieux dans closeRituelChemin les enregistre si on quitte sans valider, pour
// ne jamais perdre le travail. cmAutoSave devient un no-op (les appels existants ne font rien).
let cmSaveTimer = null;
function cmAutoSave() {
  /* no-op : plus d'enregistrement automatique pendant l'édition */
}
// Filet de sécurité silencieux : enregistre le brouillon courant s'il est en cours d'édition,
// avant qu'une action (changement d'onglet / de rituel) ne le remplace → aucune perte de travail.
function cmSaveIfEditing() {
  if (!chDraft || chDraft.mode !== 'edit') return;
  const set = CM_SETS[chDraft.moment] || CM_SETS.matin;
  const has = set.some(function (k) {
    return chDraft.filled[k];
  });
  if (chDraft.id || has) cmPersist();
}

// Sortie du mode édition (flèche ‹) : on enregistre puis on revient à la consultation du
// même rituel. Un rituel neuf resté vide est abandonné ; une toute 1re création est fêtée.
async function cmFinishEdit() {
  clearTimeout(cmSaveTimer);
  if (!chDraft) {
    cmBackToList();
    return;
  }
  cmCloseMenu();
  const set = CM_SETS[chDraft.moment] || CM_SETS.matin;
  const has = set.some(function (k) {
    return chDraft.filled[k];
  });
  if (!chDraft.id && !has) {
    cmBackToList();
    return;
  } // rituel neuf resté vide → on abandonne
  await cmPersist();
  const created = chDraft._created;
  chDraft._created = false;
  chDraft.mode = 'view';
  chDraft._bak = null;
  if (created) {
    cmWow();
    return;
  } // toute 1re création (fût-elle déjà auto-enregistrée) : petit moment de joie, puis retour au hub
  cmRender();
}

// Flèche ‹ : en édition → termine l'édition (auto-save) ; en consultation → liste « Mes rituels ».
function cmBack() {
  if (chDraft && chDraft.mode === 'edit') {
    cmFinishEdit();
    return;
  }
  cmBackToList();
}

async function cmDelete() {
  if (!chDraft) return;
  if (!chDraft.id) {
    cmBackToList();
    return;
  }
  if (
    !(await cmAsk({
      titre: 'Supprimer ce rituel ?',
      texte: 'Le rituel et son parcours seront effacés. Tes produits, eux, ne bougent pas.',
      ok: 'Supprimer',
      annuler: 'Annuler',
      danger: true,
    }))
  )
    return;
  try {
    await sb.from('rituels').delete().eq('id', chDraft.id);
  } catch (e) {}
  if (typeof showToast === 'function') showToast('Rituel supprimé');
  window.__allRituels = null;
  if (typeof loadRituels === 'function') loadRituels();
  if (typeof loadHomeRoutine === 'function') loadHomeRoutine();
  cmBackToList();
}
function closeRituelChemin() {
  clearTimeout(cmSaveTimer);
  // Filet de sécurité : si on quitte le chemin en pleine édition, on enregistre avant de fermer.
  if (chDraft && chDraft.mode === 'edit') {
    const set = CM_SETS[chDraft.moment] || CM_SETS.matin;
    const has = set.some(function (k) {
      return chDraft.filled[k];
    });
    if (chDraft.id || has) cmPersist();
  }
  const el = document.getElementById('rituel-chemin');
  if (el) el.classList.remove('show');
  document.body.style.overflow = '';
  const p = document.getElementById('cm-pop');
  if (p) p.classList.remove('show');
  cmCloseMenu();
  cmNavTuck(false);
  cmNavGlass(false);
}
// Escamote la barre pendant les feuilles plein écran du rituel (sinon elle passerait au-dessus).
function cmNavTuck(on) {
  const n = document.getElementById('nav');
  if (n) n.classList.toggle('nav-tucked', !!on);
}
// Passe le footer en verre dépoli — réservé au chemin du Rituel (ailleurs : footer d'origine).
function cmNavGlass(on) {
  const n = document.getElementById('nav');
  if (n) n.classList.toggle('nav-glass', !!on);
}
// Depuis l'aperçu d'un rituel : ouvrir la fiche produit en mode minimal
// (catégorie, nom, marque, effets). __allProducts est déjà chargé (avec effets).
function cmShowProduct(pid) {
  if (pid) openProductBook(pid, true);
}

// Fiche d'une station en consultation : même carte que l'édition, mais en lecture seule
// (image, nom, catégorie, effets/bénéfices + conseil de Léa). Aucune action d'édition.
function cmShowStation(key, pid) {
  const scroll = document.getElementById('rituel-chemin');
  if (!scroll) return;
  const p = (window.__cmProds || []).find(function (x) {
    return String(x.id) === String(pid);
  });
  if (!p) {
    cmShowProduct(pid);
    return;
  } // repli : fiche produit classique
  if (!document.getElementById('cm-pop')) {
    const d = document.createElement('div');
    d.id = 'cm-pop';
    d.className = 'cm-pop';
    scroll.appendChild(d);
  }
  const pop = document.getElementById('cm-pop');
  const ph = CM_PHASES[key] || { emoji: '🧴', nom: '' };
  const parts = (p.nom || '').split(' · ');
  const name = escapeHtml(parts[0] || '');
  const brand = parts.length > 1 ? escapeHtml(parts.slice(1).join(' · ')) : '';
  const catL = (CATS.find(function (x) {
    return x[0] === (p.categorie || 'autre');
  }) || ['', '', 'Soin'])[2];
  const url = (window.__cmPhotos || {})[pid];
  const visual = url
    ? '<img src="' + url + '" alt="">'
    : '<span class="cm-fiche-emo">' + (p.emoji || '🧴') + '</span>';
  const effList = (p.effets || '')
    .split('·')
    .map(function (s) {
      return s.trim();
    })
    .filter(Boolean);
  const effHtml = effList.length
    ? '<div class="cm-fiche-lbl">Effets & bénéfices</div><div class="cm-fiche-effs">' +
      effList
        .map(function (e) {
          return '<span class="cm-fiche-eff">' + escapeHtml(e) + '</span>';
        })
        .join('') +
      '</div>'
    : '';
  const head = cmSheetHead(key, ph);
  pop.innerHTML =
    head +
    (head
      ? ''
      : '<div class="cm-pop-grip"></div><div class="cm-pop-h"><div class="cm-pop-t">' +
        ph.emoji +
        '  ' +
        ph.nom +
        '</div><button class="cm-pop-x" onclick="cmClosePop()">×</button></div>') +
    '<div class="cm-fiche"><div class="cm-fiche-top">' +
    '<div class="cm-fiche-img">' +
    visual +
    '</div>' +
    '<div class="cm-fiche-info"><div class="cm-fiche-cat">' +
    catL +
    '</div>' +
    '<div class="cm-fiche-name">' +
    name +
    '</div>' +
    (brand ? '<div class="cm-fiche-brand">' + brand + '</div>' : '') +
    '</div></div>' +
    effHtml +
    '</div>' +
    cmTipHtml(key) +
    '<button class="cm-pop-skip" onclick="cmClosePop()">Fermer</button>';
  let veil = document.getElementById('cm-veil');
  if (!veil) {
    veil = document.createElement('div');
    veil.id = 'cm-veil';
    veil.className = 'cm-pop-veil';
    veil.onclick = cmClosePop;
    scroll.appendChild(veil);
  }
  cmSheetZoom(pop, key);
  cmNavTuck(true);
  requestAnimationFrame(function () {
    pop.classList.add('show');
    const v = document.getElementById('cm-veil');
    if (v) v.classList.add('show');
  });
}

async function loadRituels() {
  renderRituelCout();
  if (!currentUser) return;
  // IMPORTANT : on repeuple TOUJOURS le cache mémoire window.__allRituels — le panneau de la
  // fleur et le décor du chemin en dépendent. (L'ancienne liste DOM "rituels-list" a été retirée
  // de l'UI ; auparavant on sortait ici si elle manquait, ce qui laissait le cache vide → tous
  // les rituels disparaissaient après un enregistrement automatique.)
  const { data } = await sb
    .from('rituels')
    .select('*,rappels')
    .eq('user_id', currentUser.id)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });
  const rits = data || [];
  window.__allRituels = rits;
  try {
    renderRituelActuel(rits);
  } catch (e) {}
  const host = document.getElementById('rituels-list');
  if (host) host.innerHTML = '';
  const tb = document.getElementById('rituel-choose-btn-tab');
  if (tb) tb.style.display = rits.length > 1 ? 'block' : 'none';
}
// Pont transitoire : le module extrait src/features/reminders/ appelle loadRituels (garde typeof)
// après enregistrement d'un rappel pour rafraîchir la liste. Exposé sur window pour cette lecture.
window.loadRituels = loadRituels;

// Pont transitoire : les 119 fonctions du cœur rituel exposées sur window (onclick inline,
// code hérité, et autres modules : ritual-editor délègue à openRituelChemin, reminders lit
// loadRituels…).
Object.assign(window, {
  applyPreset,
  closeRituelActions,
  closeRituelChemin,
  closeRituelSelect,
  cmAfter,
  cmAnchors,
  cmAutoSave,
  cmBack,
  cmBackToList,
  cmBindCalib,
  cmBindLongPress,
  cmBindSwipe,
  cmBldK,
  cmBoxCost,
  cmBoxGap,
  cmBoxOverlap,
  cmCat2Phase,
  cmClear,
  cmCloseMenu,
  cmClosePanel,
  cmClosePop,
  cmComputeFilled,
  cmCurrentRitual,
  cmDelete,
  cmDraftFor,
  cmDraftHasProduct,
  cmEnterRitual,
  cmFinishEdit,
  cmFitPaint,
  cmFitPanelText,
  cmFitScene,
  cmGroups,
  cmGuideActive,
  cmHeadBottom,
  cmInfo,
  cmLayout,
  cmLayoutScene,
  cmLoadProducts,
  cmMaybeGuide,
  cmMomentIcon,
  cmMomentMeta,
  cmNavGlass,
  cmNavTuck,
  cmNearest,
  cmNodeHtml,
  cmOpenCarousel,
  cmOpenPanel,
  cmPaintHtml,
  cmPanelDelete,
  cmPanelDuplicate,
  cmPanelEdit,
  cmPanelGoTab,
  cmPanelNew,
  cmPanelRappel,
  cmPanelRender,
  cmPanelSelect,
  cmPanelSteps,
  cmPanelToggleActif,
  cmPathHalf,
  cmPersist,
  cmPick,
  cmPlaceNodes,
  cmPlacePaint,
  cmPlacePanel,
  cmProductsForPhase,
  cmRename,
  cmRender,
  cmRibbon,
  cmSaveIfEditing,
  cmSceneHtml,
  cmSetMode,
  cmSheetHead,
  cmSheetZoom,
  cmShowProduct,
  cmShowSlot,
  cmShowStation,
  cmSwipeMoment,
  cmTheme,
  cmTipHtml,
  cmTogglePanel,
  cmWow,
  cmWowClose,
  copierRituel,
  copierRituelVers,
  ensureActiveRituels,
  hasAnyProduct,
  loadRitual,
  loadRituels,
  momentBadge,
  noProductSheet,
  openRituelActions,
  openRituelChemin,
  openRituelQuick,
  openRituelSelect,
  pcEmptyHtml,
  pcGoalHtml,
  pcMomentBadge,
  pcProdChip,
  pickActive,
  ractCopier,
  ractModifier,
  ractSupprimer,
  recomputeRituelType,
  renderHomeVoyage,
  renderParcours,
  renderRituelActuel,
  renderRituelCout,
  renderRituelsHub,
  rhCard,
  rhGoTab,
  rhNewRituel,
  rhSyncActif,
  rhToggleActif,
  rhTrail,
  rpAutoTab,
  rpTabGo,
  selectRituel,
  toggleHrList,
  togglePcLea,
});
