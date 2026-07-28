// Domaine « Thèmes de couleur » — palettes accent (terracotta, rose, sauge…) appliquées via
// variables CSS + persistées en localStorage, avec sync de la barre système (theme-color).
// Extrait de app.legacy.js (Phase B), déplacé VERBATIM. Le thème est appliqué au chargement
// du module (applyTheme(currentTheme())). Seule dépendance : showToast (globale).

// ===== Thèmes de couleur =====
  const THEMES = {
    terracotta: { name:'Terracotta', vars:{ '--accent':'#C95A3F','--accent-deep':'#8E3C26','--accent-soft':'#EBCDC0','--blush':'#E8A6A0','--blush-soft':'#F6E0DC' }, swatch:['#C95A3F','#E8A6A0','#F6E0DC'] },
    rose:       { name:'Rose poudré', vars:{ '--accent':'#D2638A','--accent-deep':'#A8456A','--accent-soft':'#F0CBD9','--blush':'#E89BB4','--blush-soft':'#FBE4EC' }, swatch:['#D2638A','#E89BB4','#FBE4EC'] },
    sauge:      { name:'Sauge', vars:{ '--accent':'#7A9468','--accent-deep':'#5C7650','--accent-soft':'#CEDCC2','--blush':'#A7C291','--blush-soft':'#E9F0E2' }, swatch:['#7A9468','#A7C291','#E9F0E2'] },
    lavande:    { name:'Lavande', vars:{ '--accent':'#8B7CC4','--accent-deep':'#6B5CA6','--accent-soft':'#D9D0EE','--blush':'#B3A4E0','--blush-soft':'#EDE7F7' }, swatch:['#8B7CC4','#B3A4E0','#EDE7F7'] },
    bleu:       { name:'Bleu doux', vars:{ '--accent':'#5B89BE','--accent-deep':'#426A9C','--accent-soft':'#C7DAEE','--blush':'#9BBEE0','--blush-soft':'#E5EEF8' }, swatch:['#5B89BE','#9BBEE0','#E5EEF8'] }
  };
  function currentTheme(){ try{ return localStorage.getItem('rituel_theme') || 'terracotta'; }catch(e){ return 'terracotta'; } }
  function applyTheme(key){
    const t = THEMES[key] || THEMES.terracotta;
    Object.entries(t.vars).forEach(([k,v])=>document.documentElement.style.setProperty(k,v));
    // Synchroniser la barre système (theme-color) avec le thème choisi
    try{
      let meta=document.querySelector('meta[name="theme-color"]');
      if(meta) meta.setAttribute('content', t.vars['--blush-soft'] || '#F7F1EA');
    }catch(e){}
    try{ localStorage.setItem('rituel_theme', key); }catch(e){}
  }
  function openThemeSheet(){
    const cur=currentTheme();
    document.getElementById('theme-list').innerHTML = Object.entries(THEMES).map(([k,t])=>`<button class="theme-opt${k===cur?' selected':''}" onclick="pickTheme('${k}')"><div class="theme-swatch">${t.swatch.map(c=>`<span style="background:${c};"></span>`).join('')}</div><div class="theme-name">${t.name}</div><div class="theme-check"></div></button>`).join('');
    document.getElementById('theme-sheet').classList.add('open');
  }
  function pickTheme(k){ applyTheme(k); openThemeSheet(); showToast('Thème appliqué 🌸'); }
  function closeThemeSheet(){ document.getElementById('theme-sheet').classList.remove('open'); }
  applyTheme(currentTheme());

// Pont transitoire : onclick inline (feuille thèmes) + accès hérité éventuel. Résolution window.
Object.assign(window, { currentTheme, applyTheme, openThemeSheet, pickTheme, closeThemeSheet });
