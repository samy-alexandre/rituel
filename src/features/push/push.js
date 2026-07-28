// Domaine « Notifications push » — enregistrement du service worker + abonnement/désabonnement
// Web Push via /api/push. Extrait de app.legacy.js (Phase B), déplacé VERBATIM. L'enregistrement
// du service worker s'exécute au chargement du module. Deps héritées (showToast, currentUser)
// globales. Aucun état, aucune const partagée.

// ===== Notifications push (service worker + abonnement) =====
  if('serviceWorker' in navigator){ navigator.serviceWorker.register('/sw.js').catch(function(){}); }
  function urlB64ToU8(s){ const pad='='.repeat((4-s.length%4)%4); const b=(s+pad).replace(/-/g,'+').replace(/_/g,'/'); const raw=atob(b); const a=new Uint8Array(raw.length); for(let i=0;i<raw.length;i++) a[i]=raw.charCodeAt(i); return a; }
  async function refreshPushBtn(){
    const b=document.getElementById('push-btn'), st=document.getElementById('push-status'); if(!b) return;
    if(!('serviceWorker' in navigator) || !('PushManager' in window)){ b.style.display='none'; if(st) st.textContent='Non supporté sur ce navigateur (sur iPhone : installe d\'abord l\'app sur l\'écran d\'accueil).'; return; }
    try{
      const reg=await navigator.serviceWorker.ready;
      const s=await reg.pushManager.getSubscription();
      b.textContent = s ? 'Désactiver les notifications' : 'Activer les notifications';
      if(st) st.textContent = s ? 'Activées ✓ · aux jours et heures de tes rituels 🌸' : '';
    }catch(e){}
  }
  async function togglePush(){
    try{
      if(!('serviceWorker' in navigator) || !('PushManager' in window)){ showToast('Non supporté ici 🌿'); return; }
      const reg=await navigator.serviceWorker.ready;
      let sub=await reg.pushManager.getSubscription();
      if(sub){
        try{ await fetch('/api/push',{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ action:'unsubscribe', endpoint:sub.endpoint }) }); }catch(e){}
        await sub.unsubscribe();
        showToast('Notifications désactivées'); refreshPushBtn(); return;
      }
      const perm=await Notification.requestPermission();
      if(perm!=='granted'){ showToast('Autorise les notifications pour continuer 🌸'); return; }
      const r=await fetch('/api/push'); const d=await r.json();
      if(!d || !d.publicKey){ showToast('Push pas encore configuré côté serveur 🔧'); return; }
      sub=await reg.pushManager.subscribe({ userVisibleOnly:true, applicationServerKey:urlB64ToU8(d.publicKey) });
      const j=sub.toJSON();
      await fetch('/api/push',{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ action:'subscribe', endpoint:j.endpoint, p256dh:j.keys.p256dh, auth:j.keys.auth, user_id: currentUser?currentUser.id:null, tz: (Intl.DateTimeFormat().resolvedOptions().timeZone || null) }) });
      showToast('Notifications activées 🔔'); refreshPushBtn();
    }catch(e){ showToast('Oups : '+(e.message||'réessaie')); }
  }

// Pont transitoire : onclick inline (bouton push) + appel hérité (refreshPushBtn à l'ouverture
// des réglages). Résolution contre window au moment de l'appel.
Object.assign(window, { urlB64ToU8, refreshPushBtn, togglePush });
