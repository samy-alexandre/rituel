// Domaine Chat (« Lea ») — coeur : file de messages, appel backend /api/lea, quota gratuit.
// Extrait de app.legacy.js (Phase B). Etat prive (leaHistory, leaBusy) inclus. Depend uniquement
// de globales window (sb, currentUser, isPremium, showToast, escapeHtml...) et de ses propres fns.

// ===== Léa dans la messagerie (badge + message du jour) =====
function leaSeenKey(){ return 'rituel_leaseen_'+(currentUser?currentUser.id:'x')+'_'+todayStr(); }
function bellTap(){
  let seen=false; try{ seen=!!localStorage.getItem(leaSeenKey()); }catch (e) {
  console.error("catch silencieux (app.legacy.js):", e);
}
  if(currentUser && !seen){ navTo('chat'); } else { openReminderSheet(); }
}
function updateChatBadge(){
  const b=document.getElementById('chat-badge'); if(!b) return;
  let seen=false; try{ seen=!!localStorage.getItem(leaSeenKey()); }catch (e) {
  console.error("catch silencieux (app.legacy.js):", e);
}
  b.style.display = (currentUser && !seen) ? 'inline-block' : 'none';
}
let __leaTries=0;
function leaInjectDaily(){
  if(!currentUser) return;
  const feed=document.getElementById('chat-feed'); if(!feed) return;
  if(feed.querySelector('[data-lea-daily="'+todayStr()+'"]')) { markLeaSeen(); return; }
  const pro=(document.getElementById('lea-proactive-line')||{}).textContent||'';
  let tip=''; try{ tip=localStorage.getItem('rituel_tip_'+currentUser.id+'_'+todayStr())||''; }catch (e) {
  console.error("catch silencieux (app.legacy.js):", e);
}
  if(!tip){ const tb=document.getElementById('lea-tip-body'); tip=tb?tb.textContent:''; if(tip==='Ton conseil du jour arrive… 🌸') tip=''; }
  const full=[pro, tip].filter(Boolean).join('\n\n');
  if(!full){ if(__leaTries<5){ __leaTries++; setTimeout(leaInjectDaily, 1500); } return; }
  const st=document.getElementById('chat-starter'); if(st) st.remove();
  const dv=document.createElement('div'); dv.className='msg msg-ai'; dv.setAttribute('data-lea-daily', todayStr());
  dv.innerHTML=formatMessage(full);
  feed.insertBefore(dv, feed.children[1]||null);
  feed.scrollTop=0;
  markLeaSeen();
}
function markLeaSeen(){
  try{ localStorage.setItem(leaSeenKey(),'1'); }catch (e) {
  console.error("catch silencieux (app.legacy.js):", e);
}
  updateChatBadge();
}

// ===== Limite IA beta : message doux + bandeau =====
function leaLimitMsg() {
  return "Je dois faire une petite pause pour aujourd'hui \ud83c\udf38\n\nLea est offerte a raison de 5 echanges par jour. Avec Rituel+, elle devient illimitee \ud83c\udf38";
}
function showLimitToast() {
  if (isPremium) {
    showToast('Oups, reessaie dans un instant \ud83c\udf38');
    return;
  }
  showToast('Tes 5 echanges du jour sont utilises \ud83c\udf38');
  setTimeout(() => openPlusSheet('Lea illimitee avec Rituel+ \ud83d\udcac'), 900);
}

// ===== Chat . vraie Lea via le backend securise (/api/lea) =====
function formatMessage(text) {
  let t = escapeHtml((text || '').trim());
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  t = t.replace(/^\s*[\-\u2022]\s+/gm, '\u2022 ');
  t = t.replace(/\n{2,}/g, '<br><br>').replace(/\n/g, '<br>');
  return t;
}
let leaHistory = [];
let leaBusy = false;
function typingBubble() {
  const t = document.createElement('div');
  t.className = 'typing';
  t.id = 'typing';
  t.innerHTML = '<span></span><span></span><span></span>';
  return t;
}
function leaQuick(text) {
  const s = document.getElementById('chat-starter');
  if (s) s.remove();
  sendMsg(text);
}

async function buildLeaContext() {
  const GOAL_GUIDE = {
    constance: "L'utilisateur veut surtout TENIR SA ROUTINE. Encourage la regularite, les petites victoires quotidiennes, et aide a ancrer l'habitude. Valorise la constance plus que la performance.",
    comprendre: "L'utilisateur veut surtout COMPRENDRE SA PEAU. Aide a identifier ce qui marche et ce qui aggrave, fais des liens entre ses habitudes (sommeil, produits, contexte) et l'etat de sa peau.",
    deux: "L'utilisateur veut A LA FOIS tenir sa routine ET comprendre sa peau. Encourage la regularite au quotidien, tout en l'aidant a identifier ce qui marche et a faire des liens entre ses habitudes et l'etat de sa peau.",
    resultats: "L'utilisateur veut surtout VOIR DES RESULTATS. Aide a reperer l'evolution dans le temps, encourage le suivi photo, et donne un retour honnete sur ce qui semble fonctionner ou non au fil des jours.",
  };
  const ctx = {
    name: state.name || '',
    goal: state.goal && GOAL_GUIDE[state.goal] ? GOAL_GUIDE[state.goal] : null,
    skin: SKIN_LABELS[state.skinType] || 'non precise',
    concern: (state.concerns || []).map((c) => CONCERN_LABELS[c] || c).join(', ') || 'aucune en particulier',
    coach: 'femme',
    coachName: coachName(),
    userGenre: state.genre || null,
  };
  if (!currentUser) return ctx;
  try {
    const since = new Date();
    since.setDate(since.getDate() - 7);
    const sinceStr = since.toISOString().slice(0, 10);
    const [streak, tdRes, weekRes, prodRes] = await Promise.all([
      computeStreak(),
      sb.from('entries').select('*').eq('user_id', currentUser.id).eq('date', todayStr()).order('created_at', { ascending: true }).limit(1),
      sb.from('entries').select('sommeil,hydratation,alimentation,routine_matin,routine_soir').eq('user_id', currentUser.id).gte('date', sinceStr),
      sb.from('products').select('nom,moment,position').eq('user_id', currentUser.id).order('position', { ascending: true }),
    ]);
    ctx.streak = streak;
    const e = tdRes.data && tdRes.data.length ? tdRes.data[0] : null;
    if (e) {
      const MOOD = ['', 'difficile', 'moyenne', 'bien', 'top', 'sublime'];
      ctx.today = {
        humeur: e.humeur ? MOOD[e.humeur] : null,
        humeur_intensite: e.humeur_intensite,
        sommeil: e.sommeil,
        hydratation: e.hydratation,
        alimentation: e.alimentation != null ? ALIM_LABELS[e.alimentation] : null,
        routine_matin: !!e.routine_matin,
        routine_soir: !!e.routine_soir,
      };
    }
    if (e && e.score_peau != null) ctx.eclat_photo = e.score_peau;
    try {
      const ci = cyclePhaseInfo();
      if (ci) ctx.cycle = { jour: ci.day, phase: ci.phase };
    } catch (_e) {}
    try {
      const obs = localStorage.getItem('rituel_last_obs');
      if (obs) ctx.derniere_observation_photo = obs;
    } catch (_e) {}
    const week = weekRes.data || [];
    if (week.length) {
      const avg = (arr) => {
        const v = arr.filter((x) => x != null).map(parseFloat);
        return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
      };
      ctx.semaine = {
        sommeil_moyen: avg(week.map((w) => w.sommeil)),
        hydratation_moyenne: avg(week.map((w) => w.hydratation)),
        jours_routine_complete: week.filter((w) => w.routine_matin && w.routine_soir).length,
        jours_notes: week.length,
      };
    }
    const prods = prodRes.data || [];
    if (prods.length) {
      ctx.routine = {
        matin: prods.filter((p) => p.moment === 'matin').map((p) => p.nom),
        soir: prods.filter((p) => p.moment === 'soir').map((p) => p.nom),
      };
    }
  } catch (e) {
    /* en cas d'erreur, on envoie au moins le profil de base */
  }
  return ctx;
}

async function loadLeaTip() {
  const body = document.getElementById('lea-tip-body');
  if (!body) return;
  if (!currentUser) {
    body.textContent = 'Ajoute tes infos et je te donnerai des conseils rien que pour toi \ud83c\udf38';
    return;
  }
  const key = 'rituel_tip_' + currentUser.id + '_' + todayStr();
  try {
    const cached = localStorage.getItem(key);
    if (cached) {
      body.innerHTML = formatMessage(cached);
      return;
    }
  } catch (e) {}
  const ctx = await buildLeaContext();
  const hasData = (ctx.skin && ctx.skin !== 'non precise') || (ctx.concern && ctx.concern !== 'aucune en particulier') || ctx.today || ctx.routine || ctx.streak > 0;
  if (!hasData) {
    body.textContent = 'Ajoute tes infos du jour (peau, sommeil, routine) et je te donnerai des conseils rien que pour toi \ud83c\udf38';
    return;
  }
  body.textContent = 'Ton conseil du jour arrive... \ud83c\udf38';
  try {
    const res = await fetch('/api/lea', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: "(Message automatique de l'app, ce n'est pas une vraie question de la personne.) Donne UN seul conseil du jour : court (1 a 2 phrases maximum), chaleureux et personnalise d'apres mes donnees. Commence directement par le conseil, sans salutation et sans poser de question a la fin." }],
        profile: ctx,
        user_id: currentUser ? currentUser.id : null,
      }),
    });
    const data = await res.json();
    if (data && data.limited) {
      body.textContent = "Lea fait une pause aujourd'hui \ud83c\udf38 (limite beta atteinte)";
      return;
    }
    if (data && data.reply) {
      const tip = data.reply.trim();
      try {
        localStorage.setItem(key, tip);
      } catch (e) {}
      body.innerHTML = formatMessage(tip);
    } else {
      body.textContent = 'Pose-moi ta question quand tu veux, je suis la \ud83c\udf38';
    }
  } catch (e) {
    body.textContent = 'Pose-moi ta question quand tu veux, je suis la \ud83c\udf38';
  }
}

async function sendMsg(text) {
  if (leaBusy) return;
  const feed = document.getElementById('chat-feed');
  const starter = document.getElementById('chat-starter');
  if (starter) starter.remove();
  const u = document.createElement('div');
  u.className = 'msg msg-user';
  u.textContent = text;
  feed.appendChild(u);
  feed.scrollTop = feed.scrollHeight;
  leaHistory.push({ role: 'user', content: text });
  feed.appendChild(typingBubble());
  feed.scrollTop = feed.scrollHeight;
  leaBusy = true;
  try {
    const ctx = await buildLeaContext();
    const res = await fetch('/api/lea', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: leaHistory, profile: ctx, user_id: currentUser ? currentUser.id : null }),
    });
    const data = await res.json();
    const tp = document.getElementById('typing');
    if (tp) tp.remove();
    if (data && data.limited) {
      const lim = document.createElement('div');
      lim.className = 'msg msg-ai';
      lim.innerHTML = formatMessage(leaLimitMsg());
      feed.appendChild(lim);
      feed.scrollTop = feed.scrollHeight;
      setChatLocked(true);
      leaBusy = false;
      return;
    }
    if (data && data.reply) {
      leaHistory.push({ role: 'assistant', content: data.reply });
      const a = document.createElement('div');
      a.className = 'msg msg-ai';
      a.innerHTML = formatMessage(data.reply);
      feed.appendChild(a);
    } else {
      const e = document.createElement('div');
      e.className = 'msg msg-ai';
      e.textContent = "Desolee, je n'arrive pas a repondre la \ud83c\udf3f Reessayez dans un instant.";
      feed.appendChild(e);
    }
  } catch (err) {
    const tp = document.getElementById('typing');
    if (tp) tp.remove();
    const e = document.createElement('div');
    e.className = 'msg msg-ai';
    e.textContent = "Connexion a Lea impossible pour l'instant \ud83c\udf3f (Le service IA n'est peut-etre pas encore active.)";
    feed.appendChild(e);
  } finally {
    leaBusy = false;
    feed.scrollTop = feed.scrollHeight;
  }
}
const LEA_FREE_PER_DAY = 5;
function leaUsedToday() {
  try {
    const k = 'rituel_lea_' + (currentUser ? currentUser.id : 'x') + '_' + todayStr();
    return parseInt(localStorage.getItem(k) || '0', 10) || 0;
  } catch (e) {
    return 0;
  }
}
function leaBumpUsed() {
  try {
    const k = 'rituel_lea_' + (currentUser ? currentUser.id : 'x') + '_' + todayStr();
    localStorage.setItem(k, String(leaUsedToday() + 1));
  } catch (e) {}
  refreshChatQuota();
}
function refreshChatQuota() {
  const el = document.getElementById('chat-quota');
  if (!el) return;
  if (isPremium) {
    el.style.display = 'none';
    return;
  }
  const reste = Math.max(0, LEA_FREE_PER_DAY - leaUsedToday());
  if (reste <= 0) {
    el.style.display = 'none';
    return;
  }
  el.textContent = reste + ' echange' + (reste > 1 ? 's' : '') + ' offert' + (reste > 1 ? 's' : '') + " aujourd'hui sur " + LEA_FREE_PER_DAY + ' \ud83c\udf38';
  el.style.display = 'block';
}

function setChatLocked(locked) {
  refreshChatQuota();
  const bar = document.querySelector('.chat-input-bar');
  const note = document.getElementById('chat-locked-note');
  const inp = document.getElementById('chat-input');
  if (bar) bar.classList.toggle('locked', !!locked);
  if (note) note.classList.toggle('show', !!locked);
  if (inp) {
    inp.disabled = !!locked;
    if (locked) {
      inp.blur();
    }
  }
  try {
    if (locked) localStorage.setItem('rituel_ailock_' + (currentUser ? currentUser.id : 'x'), todayStr());
  } catch (e) {}
}
function refreshChatLock() {
  let locked = false;
  try {
    locked = localStorage.getItem('rituel_ailock_' + (currentUser ? currentUser.id : 'x')) === todayStr();
  } catch (e) {}
  setChatLocked(locked);
}

function sendUserMsg() {
  const i = document.getElementById('chat-input');
  const t = i.value.trim();
  if (!t) return;
  i.value = '';
  i.style.height = '44px';
  if (!isPremium) leaBumpUsed();
  sendMsg(t);
}
function resizeChat(el) {
  el.style.height = '44px';
  el.style.height = Math.min(el.scrollHeight, 100) + 'px';
}

// Pont transitoire : fonctions referencees en onclick inline et par le reste du legacy.
Object.assign(window, {
  leaSeenKey,
  bellTap,
  updateChatBadge,
  leaInjectDaily,
  markLeaSeen,
  leaLimitMsg,
  showLimitToast,
  formatMessage,
  typingBubble,
  leaQuick,
  buildLeaContext,
  loadLeaTip,
  sendMsg,
  leaUsedToday,
  leaBumpUsed,
  refreshChatQuota,
  setChatLocked,
  refreshChatLock,
  sendUserMsg,
  resizeChat,
});
