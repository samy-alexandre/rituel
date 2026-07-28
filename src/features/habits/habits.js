// Domaine « Habitudes » (trackers perso) — CRUD d'habitudes + validation quotidienne + séries.
// Extrait de app.legacy.js (Phase B), déplacé VERBATIM (octets identiques). État privé au
// module : HABIT_EMOJIS, editingHabitId, hfEmoji. Dépendances héritées (currentUser, sb,
// todayStr, escapeHtml, showToast) : globales window.

// ===== Habitudes (trackers perso) =====
  const HABIT_EMOJIS = ['💧','🏃','🧘','🧖','💊','🥗','😴','📖','🚶','🧴','☀️','🦷','💪','🌙','🍎','✍️','🚭','🧹'];
  let editingHabitId = null;
  let hfEmoji = '💧';
  function streakFromSet(set){
    let s=0; const d=new Date();
    if(!set.has(d.toISOString().slice(0,10))) d.setDate(d.getDate()-1);
    for(let i=0;i<400;i++){ const ds=d.toISOString().slice(0,10); if(set.has(ds)){ s++; d.setDate(d.getDate()-1); } else break; }
    return s;
  }
  async function loadHabits(){
    if(!currentUser) return;
    const list=document.getElementById('habits-list'); if(!list) return;
    const { data: habits } = await sb.from('habits').select('*').eq('user_id', currentUser.id).order('position',{ascending:true});
    const hs = habits || [];
    if(!hs.length){ list.innerHTML = `<div style="text-align:center;color:var(--muted);font-size:13px;padding:14px;line-height:1.5;">Aucune habitude pour l'instant.<br>Suis ce que tu veux : eau, sport, masque… 🌸</div>`; return; }
    const since=new Date(); since.setDate(since.getDate()-400);
    const { data: logs } = await sb.from('habit_logs').select('habit_id,date').eq('user_id', currentUser.id).gte('date', since.toISOString().slice(0,10));
    const byHabit={}; (logs||[]).forEach(l=>{ (byHabit[l.habit_id] = byHabit[l.habit_id] || new Set()).add(l.date); });
    const today=todayStr();
    let html='';
    hs.forEach(h=>{
      const set=byHabit[h.id] || new Set();
      const streak=streakFromSet(set);
      const done=set.has(today);
      html += `<div class="habit-card">
        <div class="habit-emoji" onclick="openHabitForm('${h.id}')">${h.emoji||'✨'}</div>
        <div class="habit-info" onclick="openHabitForm('${h.id}')"><div class="habit-name">${escapeHtml(h.nom||'')}</div><div class="habit-streak">${streak>0?('🔥 '+streak+' jour'+(streak>1?'s':'')):'Pas encore de série'}</div></div>
        <button class="habit-toggle${done?' done':''}" onclick="toggleHabitToday('${h.id}',${done?'true':'false'})">${done?'✓':''}</button>
      </div>`;
    });
    list.innerHTML = html;
  }
  async function toggleHabitToday(id, done){
    if(!currentUser) return;
    const today=todayStr();
    if(done){ await sb.from('habit_logs').delete().eq('user_id', currentUser.id).eq('habit_id', id).eq('date', today); }
    else { await sb.from('habit_logs').insert({ user_id: currentUser.id, habit_id: id, date: today }); }
    loadHabits();
  }
  function renderHabitEmoji(){
    document.getElementById('habit-emoji-picker').innerHTML = HABIT_EMOJIS.map(e=>`<button type="button" class="emoji-opt${e===hfEmoji?' selected':''}" onclick="pickHabitEmoji('${e}')">${e}</button>`).join('');
  }
  function pickHabitEmoji(e){ hfEmoji=e; renderHabitEmoji(); }
  function closeHabitSheet(){ document.getElementById('habit-sheet').classList.remove('open'); }
  async function openHabitForm(id){
    editingHabitId = id || null;
    hfEmoji = '💧';
    document.getElementById('hf-error').textContent='';
    document.getElementById('hf-nom').value='';
    document.getElementById('hf-delete').style.display = id ? 'block' : 'none';
    document.getElementById('habit-sheet-title').textContent = id ? "Modifier l'habitude" : 'Nouvelle habitude';
    renderHabitEmoji();
    document.getElementById('habit-sheet').classList.add('open');
    if(id){
      const { data: h } = await sb.from('habits').select('*').eq('id', id).maybeSingle();
      if(h){ document.getElementById('hf-nom').value=h.nom||''; hfEmoji=h.emoji||'💧'; renderHabitEmoji(); }
    }
  }
  async function saveHabit(){
    if(!currentUser) return;
    const nom=document.getElementById('hf-nom').value.trim();
    if(!nom){ document.getElementById('hf-error').textContent='Donne un nom à ton habitude.'; return; }
    showToast('Enregistrement…');
    if(editingHabitId){
      await sb.from('habits').update({ nom, emoji: hfEmoji }).eq('id', editingHabitId);
    } else {
      const { data: existing } = await sb.from('habits').select('id').eq('user_id', currentUser.id);
      await sb.from('habits').insert({ user_id: currentUser.id, nom, emoji: hfEmoji, position: existing ? existing.length : 0 });
    }
    closeHabitSheet();
    showToast('Habitude enregistrée ✓');
    loadHabits();
  }
  async function deleteHabit(){
    if(!editingHabitId) return;
    if(!await cmAsk({titre:'Supprimer cette habitude ?',texte:'Son historique complet sera effacé.',ok:'Supprimer',annuler:'Annuler',danger:true})) return;
    await sb.from('habits').delete().eq('id', editingHabitId);
    closeHabitSheet();
    showToast('Habitude supprimée');
    loadHabits();
  }
  // Habitudes dans la fiche d'un jour du calendrier
  async function renderDayHabits(ds){
    const host=document.getElementById('dd-habits'); if(!host || !currentUser) return;
    const { data: habits } = await sb.from('habits').select('*').eq('user_id', currentUser.id).order('position',{ascending:true});
    const hs=habits||[];
    if(!hs.length){ host.innerHTML='<div style="color:var(--muted);font-size:13px;">Aucune habitude. Crée-en sur l\'accueil 🌸</div>'; return; }
    const { data: logs } = await sb.from('habit_logs').select('habit_id').eq('user_id', currentUser.id).eq('date', ds);
    const doneSet=new Set((logs||[]).map(l=>l.habit_id));
    host.innerHTML = hs.map(h=>`<div class="rem-row" style="padding:10px 0;"><div class="rem-label">${h.emoji||'✨'} ${escapeHtml(h.nom||'')}</div><button class="habit-toggle${doneSet.has(h.id)?' done':''}" onclick="toggleHabitDate('${h.id}','${ds}',this)">${doneSet.has(h.id)?'✓':''}</button></div>`).join('');
  }
  async function toggleHabitDate(id, ds, btn){
    if(!currentUser) return;
    const isDone=btn.classList.contains('done');
    if(isDone){ await sb.from('habit_logs').delete().eq('user_id', currentUser.id).eq('habit_id', id).eq('date', ds); btn.classList.remove('done'); btn.textContent=''; }
    else { await sb.from('habit_logs').insert({ user_id: currentUser.id, habit_id: id, date: ds }); btn.classList.add('done'); btn.textContent='✓'; }
  }

// Pont transitoire : onclick inline (index.html) + appels hérités (loadHabits à l'accueil,
// renderDayHabits dans le détail du jour). Résolution contre window au moment de l'appel.
Object.assign(window, {
  streakFromSet, loadHabits, toggleHabitToday, renderHabitEmoji, pickHabitEmoji,
  closeHabitSheet, openHabitForm, saveHabit, deleteHabit, renderDayHabits, toggleHabitDate,
});
