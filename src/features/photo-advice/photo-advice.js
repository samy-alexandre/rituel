// Domaine « Avis de Léa sur la photo » (vision IA, non médical) — envoie la photo du jour à
// /api/analyze-photo et affiche le retour bienveillant de Léa, avec consentement explicite.
// Extrait de app.legacy.js (Phase B), déplacé VERBATIM. Deps héritées (currentUser, sb,
// signedPhoto, showToast, coachName) : globales window. Aucune const partagée.

// ===== Avis de Léa sur la photo (vision IA, non médical) =====
async function getTodayPhotoB64() {
  const { data } = await sb
    .from('entries')
    .select('photo_path')
    .eq('user_id', currentUser.id)
    .eq('date', todayStr())
    .not('photo_path', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1);
  if (!data || !data.length || !data[0].photo_path) return null;
  const url = await signedPhoto(data[0].photo_path);
  if (!url) return null;
  try {
    const resp = await fetch(url);
    const blob = await resp.blob();
    const b64 = await new Promise((r) => {
      const fr = new FileReader();
      fr.onloadend = () => r(String(fr.result).split(',')[1]);
      fr.readAsDataURL(blob);
    });
    return { b64, type: blob.type || 'image/jpeg' };
  } catch (e) {
    return null;
  }
}
function acceptPhotoConsent() {
  try {
    localStorage.setItem('rituel_photo_consent_' + currentUser.id, 'oui');
  } catch (e) {}
  askLeaPhoto();
}
async function askLeaPhoto() {
  if (!requirePlus("Léa analyse ta photo et te dit ce qu'elle observe sur ta peau 📸")) return;
  if (!currentUser) {
    showToast("Connecte-toi d'abord");
    return;
  }
  const box = document.getElementById('lea-photo-result');
  if (!box) return;
  box.style.display = 'block';
  if (localStorage.getItem('rituel_photo_consent_' + currentUser.id) !== 'oui') {
    box.innerHTML =
      '<div style="background:var(--surface-warm);border-radius:14px;padding:14px;font-size:12.5px;color:var(--ink-soft);line-height:1.55;">Pour te donner son avis, ' +
      coachName() +
      ' envoie ta photo de manière sécurisée à notre partenaire d\'analyse (Anthropic). Elle n\'est ni publiée, ni utilisée pour entraîner des modèles, et tu peux supprimer tes données à tout moment.<div style="display:flex;gap:8px;margin-top:12px;"><button class="btn btn-accent" style="padding:10px;font-size:13px;" onclick="acceptPhotoConsent()">D\'accord ✨</button><button class="btn" style="padding:10px;font-size:13px;background:var(--surface);color:var(--muted);" onclick="this.closest(\'#lea-photo-result\').style.display=\'none\'">Pas maintenant</button></div></div>';
    return;
  }
  box.innerHTML =
    '<div style="padding:14px;color:var(--muted);font-size:13px;">' +
    coachName() +
    ' regarde ta photo… 🌸</div>';
  const photo = await getTodayPhotoB64();
  if (!photo) {
    box.style.display = 'none';
    box.innerHTML = '';
    showToast("Prends d'abord ta photo du jour 🌸");
    return;
  }
  try {
    const ctx = await buildLeaContext();
    const r = await fetch('/api/analyze-photo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: photo.b64,
        media_type: photo.type,
        profile: ctx,
        user_id: currentUser ? currentUser.id : null,
      }),
    });
    if (!r.ok) {
      const msg =
        r.status === 404
          ? "L'analyse photo n'est pas encore activée sur le serveur 🌿 (fichier api/analyze-photo.js à déployer)"
          : 'Oups, réessaie un peu plus tard 🌿';
      box.innerHTML =
        '<div style="padding:14px;color:var(--muted);font-size:13px;line-height:1.5;">' +
        msg +
        '</div>';
      return;
    }
    const d = await r.json();
    if (d && d.limited) {
      showLimitToast();
      const b = document.getElementById('lea-photo-result');
      if (b) {
        b.style.display = 'block';
        b.innerHTML =
          '<div style="color:var(--muted);font-size:13px;text-align:center;padding:10px 0;">' +
          leaLimitMsg().split('\n')[0] +
          '</div>';
      }
      return;
    }
    if (d.error) {
      box.innerHTML =
        '<div style="padding:14px;color:var(--muted);font-size:13px;">Oups, réessaie un peu plus tard 🌿</div>';
      return;
    }
    const eclat = typeof d.eclat === 'number' ? d.eclat : null;
    let html = '<div class="msg-card" style="margin:0;max-width:100%;">';
    html +=
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;"><div style="width:24px;height:24px;border-radius:50%;background:linear-gradient(135deg,var(--blush),var(--accent));display:flex;align-items:center;justify-content:center;color:white;font-family:var(--serif);font-style:italic;font-size:13px;">' +
      coachName()[0] +
      '</div><div class="eyebrow">' +
      coachName() +
      ' regarde ta peau</div></div>';
    if (eclat != null)
      html +=
        '<div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;"><div style="font-family:var(--serif);font-style:italic;font-size:32px;color:var(--accent);line-height:1;">' +
        eclat +
        '</div><div><div style="font-family:var(--serif);font-size:14px;">Éclat du jour</div><div style="font-size:11px;color:var(--muted);">un petit repère, pas une note 🌸</div></div></div>';
    html += '<div class="msg-card-body">' + escapeHtml(d.observation || '') + '</div>';
    if (d.conseil)
      html +=
        '<div style="margin-top:8px;font-size:13px;color:var(--ink-soft);line-height:1.5;">💡 ' +
        escapeHtml(d.conseil) +
        '</div>';
    html +=
      '<div style="margin-top:10px;font-size:11px;color:var(--muted);">Ce n\'est pas un avis médical.</div>';
    html += '</div>';
    box.innerHTML = html;
    if (eclat != null) {
      try {
        await updateTodayEntry({ score_peau: eclat });
      } catch (e) {}
    }
    try {
      if (d.observation) localStorage.setItem('rituel_last_obs', String(d.observation));
    } catch (e) {}
  } catch (e) {
    box.innerHTML =
      '<div style="padding:14px;color:var(--muted);font-size:13px;">Oups, réessaie 🌿</div>';
  }
}

// Pont transitoire : onclick inline (bouton « demander l'avis de Léa » + consentement).
Object.assign(window, { getTodayPhotoB64, acceptPhotoConsent, askLeaPhoto });
