// Domaine « Rituel du jour » — parcours en 4 étapes (photo → peau → contexte → produits)
// puis récompense. Extrait de app.legacy.js (Phase B), déplacé VERBATIM.
// État privé au module : rjStep, rjEntry, rjPeriod, rjData, RJ_TAGS.
// Dépendances héritées (sb, currentUser, showToast, todayStr : globales window ; coachName,
// catLabel, getTodayEntryId, applyRoutineState, bustStreak, renderStreak, loadHomeData, navTo :
// déclarations de fonction de niveau supérieur, déjà globales) — appels en identifiant nu
// résolus via l'objet global. Les items du rituel transitent par window.__rjItems / __rjHasAny.

// ===== Rituel du jour (parcours 4 étapes + récompense) =====
let rjStep = 0,
  rjEntry = null,
  rjPeriod = 'matin';
const rjData = { tags: new Set(), mood: null, sommeil: null, eau: null, checked: new Set() };
const RJ_TAGS = [
  ['nette', '✨ Nette'],
  ['boutons', '🫧 Boutons'],
  ['rougeurs', '🌹 Rougeurs'],
  ['seche', '🏜️ Sèche'],
  ['grasse', '💧 Grasse'],
  ['terne', '🌫️ Terne'],
  ['sensible', '🪶 Sensible'],
];
async function rjLoadItems(period) {
  try {
    const { data: rits } = await sb
      .from('rituels')
      .select('moment,produits,position')
      .eq('user_id', currentUser.id)
      .order('position', { ascending: true });
    const all = rits || [];
    window.__rjHasAny = all.length > 0;
    const mine = all.filter((r) => r.moment === period || r.moment === 'both');
    const ids = [];
    mine.forEach((r) => (r.produits || []).forEach((id) => ids.push(id)));
    if (!ids.length) return [];
    const { data: prods } = await sb
      .from('products')
      .select('id,nom,emoji,effets,categorie')
      .in('id', ids);
    const pmap = {};
    (prods || []).forEach((p) => (pmap[p.id] = p));
    return ids.map((id) => pmap[id]).filter(Boolean);
  } catch (e) {
    return (window.__homeRoutine && window.__homeRoutine[period]) || [];
  }
}
async function openRituelJour() {
  if (!currentUser) {
    showToast('Connecte-toi d\'abord 🌸');
    return;
  }
  const h = new Date().getHours();
  rjPeriod = h < 17 ? 'matin' : 'soir';
  rjStep = 0;
  rjData.tags.clear();
  rjData.checked.clear();
  rjData.mood = null;
  rjData.sommeil = null;
  rjData.eau = null;
  rjEntry = null;
  try {
    const { data } = await sb
      .from('entries')
      .select('*')
      .eq('user_id', currentUser.id)
      .eq('date', todayStr())
      .limit(1);
    rjEntry = (data && data[0]) || null;
  } catch (e) {}
  window.__rjItems = await rjLoadItems(rjPeriod);
  document.getElementById('rj-sheet').style.display = 'flex';
  rjRender();
}
function closeRituelJour() {
  document.getElementById('rj-sheet').style.display = 'none';
}
function rjProgress() {
  document.getElementById('rj-count').textContent =
    'ÉTAPE ' + (rjStep + 1) + '/4 · ' + (rjPeriod === 'soir' ? 'SOIR 🌙' : 'MATIN ☀️');
  document.getElementById('rj-progress').innerHTML = [0, 1, 2, 3]
    .map((i) => '<div class="onb-dot' + (i < rjStep ? ' done' : i === rjStep ? ' active' : '') + '"></div>')
    .join('');
}
function rjRefreshPhoto() {
  if (document.getElementById('rj-sheet').style.display !== 'none' && rjStep === 0) {
    if (!rjEntry) rjEntry = {};
    rjEntry.photo_path = 'ok';
    rjRender();
  }
}
function rjToggleTag(el, t) {
  if (rjData.tags.has(t)) {
    rjData.tags.delete(t);
    el.classList.remove('selected');
  } else {
    rjData.tags.add(t);
    el.classList.add('selected');
  }
}
function rjPick(el, key, val) {
  rjData[key] = val;
  el.parentElement.querySelectorAll('.rj-chip').forEach((b) => b.classList.remove('selected'));
  el.classList.add('selected');
}
function rjToggleItem(el, i) {
  if (rjData.checked.has(i)) {
    rjData.checked.delete(i);
    el.classList.remove('done');
  } else {
    rjData.checked.add(i);
    el.classList.add('done');
  }
}
function rjCheckAll() {
  document.querySelectorAll('#rj-body .rj-item').forEach((el, i) => {
    rjData.checked.add(i);
    el.classList.add('done');
  });
}
function rjRender() {
  rjProgress();
  const b = document.getElementById('rj-body');
  const next = document.getElementById('rj-next'),
    skip = document.getElementById('rj-skip');
  document.getElementById('rj-footer').style.display = 'block';
  if (rjStep === 0) {
    const has = rjEntry && rjEntry.photo_path;
    b.innerHTML =
      '<div style="text-align:center;margin-top:8px;"><div class="serif" style="font-size:26px;">Ta photo du <em style="font-style:italic;color:var(--accent);">jour</em></div><p style="color:var(--muted);font-size:13px;line-height:1.5;margin:8px 0 20px;">Lumière naturelle, même angle chaque jour si tu peux 🌤️</p>' +
      (has
        ? '<div style="font-size:54px;margin:6px 0;">📷✓</div><p style="color:var(--accent-deep);font-size:13.5px;font-weight:600;">Photo du jour déjà prise ✨</p><button class="btn-outline-sm" style="margin-top:10px;" onclick="camOpen()">Reprendre</button>'
        : '<button class="btn btn-accent" style="margin-bottom:10px;" onclick="camOpen()">📷 Prendre ma photo</button><button class="btn" style="background:var(--surface-warm);color:var(--ink);" onclick="document.getElementById(\'photo-input\').click()">🖼️ Choisir dans la galerie</button>') +
      '</div>';
    next.textContent = 'Continuer';
    skip.style.display = has ? 'none' : 'block';
  }
  if (rjStep === 1) {
    b.innerHTML =
      '<div class="serif" style="font-size:24px;text-align:center;margin-top:8px;">Comment est ta <em style="font-style:italic;color:var(--accent);">peau</em> aujourd\'hui ?</div><p style="color:var(--muted);font-size:12.5px;text-align:center;margin:6px 0 18px;">Choisis tout ce qui te parle</p><div style="display:flex;flex-wrap:wrap;gap:9px;justify-content:center;">' +
      RJ_TAGS.map(
        (t) =>
          '<button class="rj-chip' +
          (rjData.tags.has(t[0]) ? ' selected' : '') +
          '" onclick="rjToggleTag(this,\'' +
          t[0] +
          '\')">' +
          t[1] +
          '</button>'
      ).join('') +
      '</div>';
    next.textContent = 'Continuer';
    skip.style.display = 'block';
  }
  if (rjStep === 2) {
    const moods = ['😣', '😕', '😐', '🙂', '✨'];
    b.innerHTML =
      '<div class="serif" style="font-size:24px;text-align:center;margin-top:8px;">Ton <em style="font-style:italic;color:var(--accent);">contexte</em></div><p style="color:var(--muted);font-size:12.5px;text-align:center;margin:6px 0 16px;">30 secondes · c\'est ce qui rend ' +
      coachName() +
      ' vraiment utile</p>' +
      '<div style="font-size:12px;font-weight:600;color:var(--ink-soft);margin:6px 0 8px;">Humeur</div><div style="display:flex;gap:8px;justify-content:center;">' +
      moods
        .map(
          (m, i) =>
            '<button class="rj-chip' +
            (rjData.mood === i + 1 ? ' selected' : '') +
            '" style="font-size:19px;padding:9px 12px;" onclick="rjPick(this,\'mood\',' +
            (i + 1) +
            ')">' +
            m +
            '</button>'
        )
        .join('') +
      '</div>' +
      '<div style="font-size:12px;font-weight:600;color:var(--ink-soft);margin:16px 0 8px;">Sommeil</div><div style="display:flex;gap:8px;justify-content:center;"><button class="rj-chip" onclick="rjPick(this,\'sommeil\',5)">😴 Mauvais</button><button class="rj-chip" onclick="rjPick(this,\'sommeil\',7)">Moyen</button><button class="rj-chip" onclick="rjPick(this,\'sommeil\',8)">Bon ✨</button></div>' +
      '<div style="font-size:12px;font-weight:600;color:var(--ink-soft);margin:16px 0 8px;">Eau aujourd\'hui</div><div style="display:flex;gap:8px;justify-content:center;"><button class="rj-chip" onclick="rjPick(this,\'eau\',2)">Peu</button><button class="rj-chip" onclick="rjPick(this,\'eau\',5)">Normal</button><button class="rj-chip" onclick="rjPick(this,\'eau\',8)">Beaucoup 💧</button></div>';
    next.textContent = 'Continuer';
    skip.style.display = 'block';
  }
  if (rjStep === 3) {
    const items = window.__rjItems || [];
    b.innerHTML =
      '<div class="serif" style="font-size:24px;text-align:center;margin-top:8px;">Ton rituel du <em style="font-style:italic;color:var(--accent);">' +
      rjPeriod +
      '</em></div>' +
      (items.length
        ? '<p style="color:var(--muted);font-size:12.5px;text-align:center;margin:6px 0 14px;">Coche ce que tu as utilisé · <button class="btn-soft" style="padding:7px 14px;font-size:11.5px;margin-top:8px;" onclick="rjCheckAll()">tout cocher</button></p>' +
          items
            .map(
              (p, i) =>
                '<div class="rj-item' +
                (rjData.checked.has(i) ? ' done' : '') +
                '" onclick="rjToggleItem(this,' +
                i +
                ')"><div class="rj-check">✓</div><div style="flex:1;"><div style="font-size:14px;font-weight:600;">' +
                (p.emoji || '🧴') +
                ' ' +
                (p.nom || '') +
                '</div>' +
                (p.categorie
                  ? '<div style="font-size:10.5px;color:var(--muted);margin-top:2px;">' +
                    catLabel(p.categorie) +
                    '</div>'
                  : '') +
                (p.effets
                  ? '<div style="font-size:11.5px;color:var(--muted);">' + p.effets + '</div>'
                  : '') +
                '</div></div>'
            )
            .join('')
        : '<p style="color:var(--muted);font-size:13px;text-align:center;line-height:1.6;margin:24px 0;">' +
          (window.__rjHasAny
            ? 'Pas de rituel pour le ' + rjPeriod + ' pour le moment 🌱'
            : 'Tu n\'as pas encore créé de rituel 🌱<br>Tu pourras le faire dans l\'onglet Rituel') +
          '<br>Valide quand même ta journée, elle compte ✨</p>') +
      '';
    next.textContent = 'Valider mon rituel ✨';
    skip.style.display = 'none';
  }
}
async function rjNext(skipped) {
  if (rjStep < 3) {
    rjStep++;
    rjRender();
    window.scrollTo(0, 0);
    return;
  }
  await rjFinish();
}
async function rjFinish() {
  document.getElementById('rj-footer').style.display = 'none';
  const b = document.getElementById('rj-body');
  b.innerHTML =
    '<div style="text-align:center;margin-top:30px;color:var(--muted);font-size:13px;">Un instant… 🌸</div>';
  const fields = {};
  fields[rjPeriod === 'soir' ? 'routine_soir' : 'routine_matin'] = true;
  if (rjData.tags.size) fields.peau_jour = [...rjData.tags];
  if (rjData.mood != null) fields.humeur = rjData.mood;
  if (rjData.sommeil != null) fields.sommeil = rjData.sommeil;
  if (rjData.eau != null) fields.hydratation = rjData.eau;
  try {
    const id = await getTodayEntryId();
    if (id) {
      let { error } = await sb.from('entries').update(fields).eq('id', id);
      if (error && fields.peau_jour) {
        delete fields.peau_jour;
        await sb.from('entries').update(fields).eq('id', id);
      }
    }
  } catch (e) {}
  applyRoutineState(rjPeriod, true);
  bustStreak();
  renderStreak();
  loadHomeData();
  document.getElementById('rj-count').textContent = 'RITUEL TERMINÉ';
  document.getElementById('rj-progress').innerHTML = [0, 1, 2, 3]
    .map(() => '<div class="onb-dot done"></div>')
    .join('');
  b.innerHTML =
    '<div style="flex:1;display:flex;flex-direction:column;justify-content:center;text-align:center;">' +
    '<div style="font-size:64px;">🌱</div>' +
    '<div class="serif" style="font-size:28px;margin:10px 0 4px;">Rituel <em style="font-style:italic;color:var(--accent);">terminé</em></div>' +
    '<p style="color:var(--accent-deep);font-size:13.5px;font-weight:600;">Ta plante a grandi 🌿</p>' +
    '<div class="msg-card" style="margin:18px 0 0;max-width:100%;text-align:left;"><div class="eyebrow">' +
    coachName().toUpperCase() +
    '</div><div style="font-size:13.5px;color:var(--ink-soft);line-height:1.6;margin-top:6px;">' +
    rjSummary() +
    '</div></div>' +
    '<button class="btn btn-accent" style="margin-top:20px;" onclick="closeRituelJour();navTo(\'journal\')">Voir mon évolution</button>' +
    '<button class="btn btn-ghost" style="margin-top:6px;" onclick="closeRituelJour()">À demain 🌙</button>' +
    '</div>';
}
function rjSummary() {
  const t = rjData.tags;
  const out = [];
  if (t.has('rougeurs') || t.has('sensible'))
    out.push(
      'Ta peau semble un peu sensible aujourd\'hui · garde un rituel tout doux, sans nouvel actif.'
    );
  else if (t.has('seche') || t.has('terne'))
    out.push('Ta peau réclame de l\'hydratation · une couche généreuse ce soir lui fera du bien 💧');
  else if (t.has('grasse') || t.has('boutons'))
    out.push('Côté brillance ou petits boutons : nettoyage doux et constance, jamais d\'agressivité.');
  else if (t.has('nette')) out.push('Ta peau a l\'air en forme · continue exactement comme ça ✨');
  if (rjData.sommeil != null && rjData.sommeil <= 5)
    out.push('Avec une nuit courte, mise sur la simplicité aujourd\'hui.');
  if (rjData.eau != null && rjData.eau <= 3)
    out.push('Et pense à boire un peu plus d\'eau au fil de la journée.');
  if (!out.length) out.push('Jour après jour, c\'est ta régularité qui fait toute la différence.');
  out.push('Le plus important, c\'est la régularité, pas la perfection 🌸');
  return out.slice(0, 3).join(' ');
}

// Pont transitoire : invoquées par des handlers onclick inline (index.html + chaînes générées),
// et rjRefreshPhoto est appelée par le module caméra. Résolution contre window à l'appel.
Object.assign(window, {
  rjLoadItems,
  openRituelJour,
  closeRituelJour,
  rjProgress,
  rjRefreshPhoto,
  rjToggleTag,
  rjPick,
  rjToggleItem,
  rjCheckAll,
  rjRender,
  rjNext,
  rjFinish,
  rjSummary,
});
