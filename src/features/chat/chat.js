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
