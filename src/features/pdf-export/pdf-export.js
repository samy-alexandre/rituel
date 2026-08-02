// Domaine « Export PDF » — génère « Mon carnet de peau » (jsPDF chargé à la demande) : profil,
// photos avant/après, historique. Extrait de app.legacy.js (Phase B), déplacé VERBATIM.
// Deps héritées lues en identifiant nu (via l'objet global) : signedPhoto, loadScript,
// currentUser, sb, fmtDateLong, et SKIN_LABELS/CONCERN_LABELS (exposées sur window côté hérité).

// ===== Export PDF · « Mon carnet de peau » =====
async function photoToDataURL(path) {
  try {
    const url = await signedPhoto(path);
    if (!url) return null;
    const resp = await fetch(url);
    const blob = await resp.blob();
    return await new Promise((r) => {
      const fr = new FileReader();
      fr.onloadend = () => r(String(fr.result));
      fr.readAsDataURL(blob);
    });
  } catch (e) {
    return null;
  }
}
async function exportCarnetPDF() {
  if (!requirePlus('Ton carnet de peau, tout beau, à garder ou imprimer 📄')) return;
  if (!currentUser) {
    showToast("Connecte-toi d'abord");
    return;
  }
  showToast('Préparation de ton carnet…');
  try {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
    const jsPDF = window.jspdf && window.jspdf.jsPDF ? window.jspdf.jsPDF : window.jsPDF || null;
    if (!jsPDF) {
      showToast('Export indisponible');
      return;
    }
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const W = 210,
      M = 18;
    let y = 24;
    const terr = [193, 90, 63],
      ink = [46, 33, 28],
      muted = [150, 128, 118],
      line = [232, 222, 212];
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(terr[0], terr[1], terr[2]);
    doc.setFontSize(11);
    doc.text('RITUEL', M, y);
    doc.setTextColor(ink[0], ink[1], ink[2]);
    doc.setFontSize(26);
    doc.text('Mon carnet de peau', M, y + 12);
    doc.setTextColor(muted[0], muted[1], muted[2]);
    doc.setFontSize(10);
    doc.text(fmtDateLong(todayStr()), M, y + 20);
    y += 33;
    doc.setDrawColor(line[0], line[1], line[2]);
    doc.line(M, y, W - M, y);
    y += 11;
    const name = state.name || '…';
    const skin = SKIN_LABELS[state.skinType] || 'non précisé';
    const concerns = (state.concerns || []).map((c) => CONCERN_LABELS[c] || c).join(', ') || '…';
    doc.setTextColor(ink[0], ink[1], ink[2]);
    doc.setFontSize(14);
    doc.text(name, M, y);
    y += 8;
    doc.setTextColor(muted[0], muted[1], muted[2]);
    doc.setFontSize(11);
    doc.text('Type de peau : ' + skin, M, y);
    y += 6;
    const concLines = doc.splitTextToSize('Préoccupations : ' + concerns, W - 2 * M);
    doc.text(concLines, M, y);
    y += 6 * concLines.length + 8;
    let streak = 0,
      best = 0;
    try {
      streak = await computeStreak();
    } catch (e) {}
    try {
      best = await bestStreak();
    } catch (e) {}
    let eclatTxt = '…';
    try {
      const { data } = await sb
        .from('entries')
        .select('score_peau')
        .eq('user_id', currentUser.id)
        .not('score_peau', 'is', null)
        .order('date', { ascending: false })
        .limit(1);
      if (data && data.length) eclatTxt = data[0].score_peau + '/100';
    } catch (e) {}
    doc.setTextColor(terr[0], terr[1], terr[2]);
    doc.setFontSize(20);
    doc.text(String(streak), M, y);
    doc.text(String(best), M + 62, y);
    doc.text(eclatTxt, M + 124, y);
    doc.setTextColor(muted[0], muted[1], muted[2]);
    doc.setFontSize(9);
    doc.text('Série actuelle (jours)', M, y + 6);
    doc.text('Record (jours)', M + 62, y + 6);
    doc.text('Éclat récent', M + 124, y + 6);
    y += 16;
    doc.setDrawColor(line[0], line[1], line[2]);
    doc.line(M, y, W - M, y);
    y += 11;
    doc.setTextColor(ink[0], ink[1], ink[2]);
    doc.setFontSize(14);
    doc.text('Mes produits', M, y);
    y += 8;
    let prods = [];
    try {
      const { data } = await sb
        .from('products')
        .select('nom,effets,prix')
        .eq('user_id', currentUser.id)
        .order('position', { ascending: true });
      prods = data || [];
    } catch (e) {}
    doc.setFontSize(11);
    if (!prods.length) {
      doc.setTextColor(muted[0], muted[1], muted[2]);
      doc.text("Aucun produit pour l'instant.", M, y);
      y += 8;
    }
    prods.forEach((p) => {
      if (y > 272) {
        doc.addPage();
        y = 24;
      }
      doc.setTextColor(ink[0], ink[1], ink[2]);
      doc.setFontSize(11);
      doc.text('• ' + (p.nom || ''), M, y);
      const extra = [p.effets || '', p.prix != null && p.prix !== '' ? p.prix + ' €' : '']
        .filter(Boolean)
        .join('  ·  ');
      if (extra) {
        y += 4.8;
        doc.setTextColor(muted[0], muted[1], muted[2]);
        doc.setFontSize(9.5);
        const ex = doc.splitTextToSize(extra, W - 2 * M - 4);
        doc.text(ex, M + 4, y);
        y += 4.8 * ex.length + 3.5;
      } else {
        y += 7.5;
      }
    });
    let ph = [];
    try {
      const { data } = await sb
        .from('entries')
        .select('date,photo_path')
        .eq('user_id', currentUser.id)
        .not('photo_path', 'is', null)
        .order('date', { ascending: true });
      ph = (data || []).filter((x) => x.photo_path);
    } catch (e) {}
    if (ph.length >= 1) {
      if (y > 165) {
        doc.addPage();
        y = 24;
      }
      y += 4;
      doc.setDrawColor(line[0], line[1], line[2]);
      doc.line(M, y, W - M, y);
      y += 11;
      doc.setTextColor(ink[0], ink[1], ink[2]);
      doc.setFontSize(14);
      doc.text('Avant / après', M, y);
      y += 8;
      const iw = 72,
        ih = 96;
      const first = await photoToDataURL(ph[0].photo_path);
      const last = ph.length > 1 ? await photoToDataURL(ph[ph.length - 1].photo_path) : null;
      if (first) {
        try {
          doc.addImage(first, first.includes('image/png') ? 'PNG' : 'JPEG', M, y, iw, ih);
          doc.setTextColor(muted[0], muted[1], muted[2]);
          doc.setFontSize(9);
          doc.text(fmtDateLong(ph[0].date), M, y + ih + 5);
        } catch (e) {}
      }
      if (last) {
        try {
          doc.addImage(last, last.includes('image/png') ? 'PNG' : 'JPEG', M + iw + 12, y, iw, ih);
          doc.setTextColor(muted[0], muted[1], muted[2]);
          doc.setFontSize(9);
          doc.text(fmtDateLong(ph[ph.length - 1].date), M + iw + 12, y + ih + 5);
        } catch (e) {}
      }
      y += ih + 12;
    }
    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setTextColor(muted[0], muted[1], muted[2]);
      doc.setFontSize(9);
      doc.text('monrituel.app', M, 289);
      doc.text('· ton carnet de peau ·', W - M, 289, { align: 'right' });
    }
    doc.save('mon-carnet-rituel.pdf');
    showToast('Carnet PDF prêt ✨');
  } catch (e) {
    showToast('Oups, export PDF impossible');
  }
}

// Pont transitoire : onclick inline (bouton export). Résolution contre window au moment du clic.
Object.assign(window, { photoToDataURL, exportCarnetPDF });
