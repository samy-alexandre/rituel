// Domaine Caméra — capture HD de la photo du jour + envoi vers le stockage.
// Extrait de app.legacy.js (Phase B), déplacé VERBATIM. État privé : camStream, camFacing.
// Dépend de globales window (sb, currentUser, showToast) et de fonctions héritées encore dans
// app.legacy.js — toutes des déclarations de fonction de niveau supérieur, donc déjà exposées
// sur l'objet global (updateTodayEntry, loadTodayPhoto, loadJournalFromDB, rjRefreshPhoto) :
// leurs appels en identifiant nu se résolvent via l'objet global depuis ce module strict.

// ===== Caméra HD intégrée (photo du jour) =====
let camStream = null,
  camFacing = 'user';
function openPhotoChoice() {
  document.getElementById('photo-choice').classList.add('open');
}
function closePhotoChoice() {
  document.getElementById('photo-choice').classList.remove('open');
}
async function camOpen() {
  const sheet = document.getElementById('cam-sheet');
  try {
    camStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: camFacing, width: { ideal: 1920 }, height: { ideal: 1440 } },
      audio: false,
    });
    const v = document.getElementById('cam-video');
    v.srcObject = camStream;
    v.style.transform = camFacing === 'user' ? 'scaleX(-1)' : 'none';
    sheet.style.display = 'block';
  } catch (e) {
    showToast('Caméra indisponible · essaie la galerie 🖼️');
  }
}
function camStop() {
  if (camStream) {
    try {
      camStream.getTracks().forEach((t) => t.stop());
    } catch (e) {}
    camStream = null;
  }
}
function camClose() {
  camStop();
  document.getElementById('cam-sheet').style.display = 'none';
}
async function camFlip() {
  camFacing = camFacing === 'user' ? 'environment' : 'user';
  camStop();
  await camOpen();
}
function camCapture() {
  const v = document.getElementById('cam-video');
  if (!v || !v.videoWidth) {
    showToast('Un instant…');
    return;
  }
  const cv = document.createElement('canvas');
  cv.width = v.videoWidth;
  cv.height = v.videoHeight;
  const ctx = cv.getContext('2d');
  if (camFacing === 'user') {
    ctx.translate(cv.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(v, 0, 0);
  cv.toBlob(
    async (blob) => {
      camClose();
      if (!blob) {
        showToast('Oups, réessaie');
        return;
      }
      const img = document.getElementById('photo-img');
      if (img) {
        img.src = URL.createObjectURL(blob);
        document.getElementById('photo-empty').classList.add('hidden');
        document.getElementById('photo-display').classList.remove('hidden');
      }
      await uploadDayPhoto(blob, 'jpg');
    },
    'image/jpeg',
    0.92
  );
}
async function uploadDayPhoto(fileOrBlob, ext) {
  if (!currentUser) {
    showToast('Connecte-toi pour sauvegarder');
    return;
  }
  showToast('Envoi de la photo… 🌸');
  const path = `${currentUser.id}/${Date.now()}.${ext}`;
  const opts =
    fileOrBlob instanceof File ? { upsert: true } : { upsert: true, contentType: 'image/jpeg' };
  const { error: upErr } = await sb.storage.from('photos').upload(path, fileOrBlob, opts);
  if (upErr) {
    showToast('Erreur upload : ' + upErr.message);
    return;
  }
  await updateTodayEntry({ photo_path: path });
  showToast('Photo du jour enregistrée 🌸');
  loadTodayPhoto();
  loadJournalFromDB();
  try {
    rjRefreshPhoto();
  } catch (e) {}
}

// Pont transitoire : ces fonctions sont invoquées par des handlers onclick inline (index.html
// + chaînes générées côté hérité) et par quelques appels directs du code hérité ; elles se
// résolvent contre window au moment de l'appel.
Object.assign(window, {
  openPhotoChoice,
  closePhotoChoice,
  camOpen,
  camStop,
  camClose,
  camFlip,
  camCapture,
  uploadDayPhoto,
});
