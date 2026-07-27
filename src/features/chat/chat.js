// Domaine Chat (« Léa ») — coeur : file de messages, appel backend /api/lea, quota gratuit.
// Extrait de app.legacy.js (Phase B). État privé (leaHistory, leaBusy) inclus. Dépend uniquement
// de globales window (sb, currentUser, isPremium, showToast, escapeHtml…) et de ses propres fns.

// ===== Limite IA bêta : message doux + bandeau =====
function leaLimitMsg() {
  return "Je dois faire une petite pause pour aujourd'hui 🌸\n\nLéa est offerte à raison de 5 échanges par jour. Avec Rituel+, elle devient illimitée 🌸";
}
function showLimitToast() {
  if (isPremium) {
    showToast('Oups, réessaie dans un instant 🌸');
    return;
  }
  showToast('Tes 5 échanges du jour sont utilisés 🌸');
  setTimeout(() => openPlusSheet('Léa illimitée avec Rituel+ 💬'), 900);
}

// ===== Chat · vraie Léa via le backend sécurisé (/api/lea) =====
function formatMessage(text) {
  let t = escapeHtml((text || '').trim());
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>'); // **gras**
  t = t.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>'); // *italique*
  t = t.replace(/^\s*[\-•]\s+/gm, '• '); // puces propres
  t = t.replace(/\n{2,}/g, '<br><br>').replace(/\n/g, '<br>'); // sauts de ligne
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

// Rassemble le contexte (données perso) envoyé à Léa pour des conseils personnalisés
async function buildLeaContext() {
  const GOAL_GUIDE = {
    constance:
      "L'utilisateur veut surtout TENIR SA ROUTINE. Encourage la régularité, les petites victoires quotidiennes, et aide à ancrer l'habitude. Valorise la constance plus que la performance.",
    comprendre:
      "L'utilisateur veut surtout COMPRENDRE SA PEAU. Aide à identifier ce qui marche et ce qui aggrave, fais des liens entre ses habitudes (sommeil, produits, contexte) et l'état de sa peau.",
    deux: "L'utilisateur veut À LA FOIS tenir sa routine ET comprendre sa peau. Encourage la régularité au quotidien, tout en l'aidant à identifier ce qui marche et à faire des liens entre ses habitudes et l'état de sa peau.",
    resultats:
      "L'utilisateur veut surtout VOIR DES RÉSULTATS. Aide à repérer l'évolution dans le temps, encourage le suivi photo, et donne un retour honnête sur ce qui semble fonctionner ou non au fil des jours.",
  };
  const ctx = {
    name: state.name || '',
    goal: state.goal && GOAL_GUIDE[state.goal] ? GOAL_GUIDE[state.goal] : null,
    skin: SKIN_LABELS[state.skinType] || 'non précisé',
    concern:
      (state.concerns || []).map((c) => CONCERN_LABELS[c] || c).join(', ') ||
      'aucune en particulier',
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
      sb
        .from('entries')
        .select('*')
        .eq('user_id', currentUser.id)
        .eq('date', todayStr())
        .order('created_at', { ascending: true })
        .limit(1),
      sb
        .from('entries')
        .select('sommeil,hydratation,alimentation,routine_matin,routine_soir')
        .eq('user_id', currentUser.id)
        .gte('date', sinceStr),
      sb
        .from('products')
        .select('nom,moment,position')
        .eq('user_id', currentUser.id)
        .order('position', { ascending: true }),
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

// Conseil du jour de Léa sur l'accueil · vrai conseil personnalisé, mis en cache 1×/jour
async function loadLeaTip() {
  const body = document.getElementById('lea-tip-body');
  if (!body) return;
  if (!currentUser) {
    body.textContent = 'Ajoute tes infos et je te donnerai des conseils rien que pour toi 🌸';
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
  const hasData =
    (ctx.skin && ctx.skin !== 'non précisé') ||
    (ctx.concern && ctx.concern !== 'aucune en particulier') ||
    ctx.today ||
    ctx.routine ||
    ctx.streak > 0;
  if (!hasData) {
    body.textContent =
      'Ajoute tes infos du jour (peau, sommeil, routine) et je te donnerai des conseils rien que pour toi 🌸';
    return;
  }
  body.textContent = 'Ton conseil du jour arrive… 🌸';
  try {
    const res = await fetch('/api/lea', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          {
            role: 'user',
            content:
              "(Message automatique de l'app, ce n'est pas une vraie question de la personne.) Donne UN seul conseil du jour : court (1 à 2 phrases maximum), chaleureux et personnalisé d'après mes données. Commence directement par le conseil, sans salutation et sans poser de question à la fin.",
          },
        ],
        profile: ctx,
        user_id: currentUser ? currentUser.id : null,
      }),
    });
    const data = await res.json();
    if (data && data.limited) {
      body.textContent = "Léa fait une pause aujourd'hui 🌸 (limite bêta atteinte)";
      return;
    }
    if (data && data.reply) {
      const tip = data.reply.trim();
      try {
        localStorage.setItem(key, tip);
      } catch (e) {}
      body.innerHTML = formatMessage(tip);
    } else {
      body.textContent = 'Pose-moi ta question quand tu veux, je suis là 🌸';
    }
  } catch (e) {
    body.textContent = 'Pose-moi ta question quand tu veux, je suis là 🌸';
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
      body: JSON.stringify({
        messages: leaHistory,
        profile: ctx,
        user_id: currentUser ? currentUser.id : null,
      }),
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
      e.textContent = "Désolée, je n'arrive pas à répondre là 🌿 Réessayez dans un instant.";
      feed.appendChild(e);
    }
  } catch (err) {
    const tp = document.getElementById('typing');
    if (tp) tp.remove();
    const e = document.createElement('div');
    e.className = 'msg msg-ai';
    e.textContent =
      "Connexion à Léa impossible pour l'instant 🌿 (Le service IA n'est peut-être pas encore activé.)";
    feed.appendChild(e);
  } finally {
    leaBusy = false;
    feed.scrollTop = feed.scrollHeight;
  }
}
// ===== Verrou de la barre de chat quand la limite IA est atteinte =====
// Information neutre : combien d'échanges il reste aujourd'hui (offre gratuite)
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
  } // le bandeau prend le relais
  el.textContent =
    reste +
    ' échange' +
    (reste > 1 ? 's' : '') +
    ' offert' +
    (reste > 1 ? 's' : '') +
    " aujourd'hui sur " +
    LEA_FREE_PER_DAY +
    ' 🌸';
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
    if (locked)
      localStorage.setItem('rituel_ailock_' + (currentUser ? currentUser.id : 'x'), todayStr());
  } catch (e) {}
}
function refreshChatLock() {
  // grise si le serveur nous a déjà dit "limited" aujourd'hui
  let locked = false;
  try {
    locked =
      localStorage.getItem('rituel_ailock_' + (currentUser ? currentUser.id : 'x')) === todayStr();
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

// Pont transitoire : fonctions référencées en onclick inline et par le reste du legacy.
Object.assign(window, {
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
