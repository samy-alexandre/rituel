// ===== RGPD : export et suppression des données personnelles =====
// Module extrait de public/app.legacy.js (domaine Données personnelles).
// Ponctue d'un pont window.* transitoire : les handlers onclick inline continuent
// d'appeler exportData / deleteAccount tant que le HTML les référence.

async function exportData(){
  if(!currentUser){ showToast('Connecte-toi d\'abord'); return; }
  showToast('Préparation de l\'export…');
  const profile = await loadProfile();
  const { data: entries } = await sb.from('entries').select('*').eq('user_id', currentUser.id);
  const payload = { compte:{ email: currentUser.email }, profil: profile, journal: entries||[], exporte_le: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type:'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'mes-donnees-rituel.json';
  a.click();
  showToast('Vos données ont été exportées ✓');
}

async function deleteAccount(){
  if(!currentUser){ showToast('Connecte-toi d\'abord'); return; }
  if(!await cmAsk({titre:'Supprimer ton compte ?',texte:'Tes photos, ton journal, ton profil et ton compte seront définitivement effacés. Cette action est irréversible.',ok:'Supprimer mon compte',annuler:'Annuler',danger:true})) return;
  showToast('Suppression en cours…');
  try{
    const { data:{ session } } = await sb.auth.getSession();
    const token = session ? session.access_token : '';
    const res = await fetch('/api/delete-account', {
      method:'POST',
      headers:{ 'Content-Type':'application/json', 'Authorization':'Bearer '+token }
    });
    const data = await res.json();
    if(data && data.success){
      try{ localStorage.removeItem('rituel_profile_'+currentUser.id); }catch (e) { console.error("catch silencieux (app.legacy.js):", e); }
      await sb.auth.signOut();
      alert('Ton compte et toutes tes données ont été définitivement supprimés.');
      location.reload();
    } else {
      showToast('Erreur : '+((data && data.error) || 'suppression impossible'));
    }
  }catch(e){
    showToast('Erreur lors de la suppression : '+e.message);
  }
}

// Pont transitoire : expose sur window pour le HTML inline et le shell legacy (comme auth/navigation/home/profil/journal/premium/sheet).
window.exportData = exportData;
window.deleteAccount = deleteAccount;
