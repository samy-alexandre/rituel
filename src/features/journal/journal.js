// src/features/journal/journal.js
// Domaine « Journal » : vue d'ensemble/évolution, calendrier, fiche d'un jour, grille photos.
// Extrait verbatim de public/app.legacy.js (Phase B), déplacé VERBATIM.
// Le pont transitoire window.* est conservé pour les handlers onclick inline du HTML.

// ===== Journal =====
function renderJournal(){
  const grid=document.getElementById('journal-grid'); if(!grid) return;
  grid.innerHTML = '<div class="jr-empty"><div class="jr-empty-ico">📷</div>'+
    '<div class="jr-empty-title">Ta première photo</div>'+
    '<div class="jr-empty-sub">Prends-la en lumière naturelle. Dans quelques semaines,<br>tu verras le chemin parcouru 🌸</div>'+
    '<button class="jr-empty-btn" onclick="openPhotoChoice()">Ajouter une photo</button></div>';
}
function openEntry(day){ showToast(`Entrée du ${day} · vue détaillée bientôt`); }

async function loadJournalFromDB(){
  const grid=document.getElementById('journal-grid'); if(!grid) return;
  loadSuiviAccroche();
  loadOverview();
  loadWeekRecap();
  loadMemory();
  loadInsights();
  loadBeforeAfter();
  loadEclatGraph();
  if(!currentUser){ renderJournal(); return; }
  const { data } = await sb.from('entries').select('*').eq('user_id', currentUser.id).order('date',{ascending:false}).limit(30);
  if(!data || !data.length){ renderJournal(); return; }
  // On ne montre QUE les vraies photos : pas de fausses vignettes de peau.
  let html='';
  let nbPhotos=0;
  for(const e of data){
    const url = await signedPhoto(e.photo_path);
    if(!url) continue;
    nbPhotos++;
    const day = e.date ? parseInt(e.date.slice(8,10),10) : '';
    const sc = e.score_peau||0;
    const dot = sc>=80?'var(--sage)':(sc>=70?'var(--gold)':'var(--accent)');
    html+=`<div class="journal-cell" onclick="openEntry('${e.date}')"><img src="${url}" alt="Photo du ${day}" style="width:100%;height:100%;object-fit:cover;"><div class="journal-cell-date">${day}</div><div class="journal-cell-dot" style="background:${dot};"></div></div>`;
  }

  if(!nbPhotos){
    // Aucune photo encore : une invitation douce, pas une grille vide
    grid.innerHTML = '<div class="jr-empty"><div class="jr-empty-ico">📷</div>'+
      '<div class="jr-empty-title">Ta première photo</div>'+
      '<div class="jr-empty-sub">Prends-la en lumière naturelle. Dans quelques semaines,<br>tu verras le chemin parcouru 🌸</div>'+
      '<button class="jr-empty-btn" onclick="openPhotoChoice()">Ajouter une photo</button></div>';
    return;
  }

  html += '<div class="journal-cell add" onclick="openPhotoChoice()"><span>+</span></div>';
  grid.innerHTML = html;
}

// ===== Récap de la semaine (7 derniers jours) =====
async function loadWeekRecap(){
  const sec=document.getElementById('week-recap'); if(!sec) return;
  if(!currentUser){ sec.style.display='none'; return; }
  try{
    const since=new Date(); since.setDate(since.getDate()-6); const sinceStr=since.toISOString().slice(0,10);
    const { data } = await sb.from('entries').select('*').eq('user_id',currentUser.id).gte('date',sinceStr);
    const es=data||[];
    const byDate={}; es.forEach(e=>{ byDate[e.date] = byDate[e.date] ? {...byDate[e.date], ...e} : e; });
    const days=Object.values(byDate);
    let rituelDays=0, sleepSum=0,sleepN=0, hydSum=0,hydN=0, eclatSum=0,eclatN=0; const moodCount={};
    days.forEach(e=>{
      if(dayComplete(e)) rituelDays++;
      if(e.sommeil!=null){ sleepSum+=Number(e.sommeil); sleepN++; }
      if(e.hydratation!=null){ hydSum+=Number(e.hydratation); hydN++; }
      if(e.score_peau!=null){ eclatSum+=Number(e.score_peau); eclatN++; }
      if(e.humeur){ moodCount[e.humeur]=(moodCount[e.humeur]||0)+1; }
    });
    const MOJI=['','😣','😕','😌','😊','✨'];
    let domMood=null,domN=0; Object.keys(moodCount).forEach(k=>{ if(moodCount[k]>domN){domN=moodCount[k];domMood=k;} });
    const tiles=[];
    tiles.push(['🔥', rituelDays+'/7', 'jours de rituel']);
    if(eclatN) tiles.push(['✨', Math.round(eclatSum/eclatN), 'éclat moyen']);
    if(sleepN) tiles.push(['😴', fmtSleep(sleepSum/sleepN), 'sommeil moyen']);
    if(hydN) tiles.push(['💧', Math.round(hydSum/hydN), 'verres / jour']);
    if(domMood) tiles.push([MOJI[domMood]||'🌸', '', 'humeur dominante']);
    document.getElementById('wr-tiles').innerHTML = tiles.map(t=>`<div style="background:var(--surface-warm);border-radius:14px;padding:12px;text-align:center;"><div style="font-size:22px;">${t[0]}</div>${t[1]!==''?`<div style="font-family:var(--serif);font-size:18px;margin-top:2px;">${t[1]}</div>`:'<div style="height:6px;"></div>'}<div style="font-size:11px;color:var(--muted);margin-top:2px;">${t[2]}</div></div>`).join('');
    let sum;
    if(!days.length) sum='Commence à noter tes journées pour voir ton récap 🌸';
    else if(rituelDays>=6) sum='Quelle régularité · '+rituelDays+' jours de rituel cette semaine ! Ta peau te dit merci 🌸';
    else if(rituelDays>=3) sum='Belle semaine : '+rituelDays+' jours de rituel. On continue en douceur 🌿';
    else if(rituelDays>=1) sum='Un début, c\'est déjà ça ('+rituelDays+' jour'+(rituelDays>1?'s':'')+'). Cette semaine est une nouvelle chance ✨';
    else sum='Rien de noté côté rituel cette semaine · sans culpabilité, on repart tout doucement 🌸';
    document.getElementById('wr-summary').textContent=sum;
    sec.style.display='block';
  }catch(e){ sec.style.display='none'; }
}

// ═══ Vue d'ensemble + Évolution de la peau (Journal) ═══
let evEntries = [];
let evMetric = 'score_peau';
let evPeriod = 7;   // 7 jours, 30 jours ou 365 jours

async function loadOverview(){
  const ovSec=document.getElementById('ov-section'), evSec=document.getElementById('ev-section');
  if(!ovSec) return;
  if(!currentUser){ ovSec.style.display='none'; if(evSec) evSec.style.display='none'; return; }
  const since=new Date(); since.setDate(since.getDate()-6);
  const sinceStr=since.toISOString().slice(0,10);
  let es=[];
  try{
    const { data } = await sb.from('entries').select('*').eq('user_id',currentUser.id).gte('date',sinceStr).order('date',{ascending:true});
    es=data||[];
  }catch(e){ es=[]; }
  // fusion par date
  const byDate={}; es.forEach(e=>{ byDate[e.date]=byDate[e.date]?{...byDate[e.date],...e}:e; });
  const days=Object.values(byDate);

  // ── 4 tuiles ──
  let rituelDays=0, photoN=0, scoreSum=0,scoreN=0; const moodCount={};
  days.forEach(e=>{
    if(dayComplete(e)) rituelDays++;
    if(e.photo_path) photoN++;
    if(e.score_peau!=null){ scoreSum+=Number(e.score_peau); scoreN++; }
    if(e.humeur){ moodCount[e.humeur]=(moodCount[e.humeur]||0)+1; }
  });
  const regularite = Math.round((rituelDays/7)*100);
  const MOODS={1:'Difficile',2:'Mitigée',3:'Correcte',4:'Bonne',5:'Rayonnante'};
  let domMood=null,domN=0; Object.keys(moodCount).forEach(k=>{ if(moodCount[k]>domN){domN=moodCount[k];domMood=k;} });
  const moodLabel = domMood ? (MOODS[domMood]||'—') : '—';

  const sparkScore = sparkline(days.map(e=>e.score_peau!=null?Number(e.score_peau):null));
  const sparkReg = sparkline(days.map(e=>dayComplete(e)?1:0), true);

  const tiles=[
    {ico:'🌿', val:rituelDays, sub:'Rituels réalisés<br>/ 7 jours', spark:sparkReg},
    {ico:'📊', val:regularite+'%', sub:'Régularité', spark:sparkScore},
    {ico:'📸', val:photoN, sub:'Photos ajoutées', spark:''},
    {ico:'🌸', val:moodLabel, sub:'Humeur<br>dominante', spark:'', small:true}
  ];
  document.getElementById('ov-tiles').innerHTML = tiles.map(t=>
    '<div class="ov-tile"><div class="top"><div class="ov-ico">'+t.ico+'</div>'+(t.spark||'')+'</div>'+
    '<div class="ov-val"'+(t.small?' style="font-size:19px;margin-top:12px;"':'')+'>'+t.val+'</div>'+
    '<div class="ov-lbl">'+t.sub+'</div></div>'
  ).join('');
  ovSec.style.display='block';

  // ── Évolution ──
  if(evSec){ evSec.style.display='block'; loadEvData(); }
}

function sparkline(vals, isBinary){
  const pts = vals.filter(v=>v!=null);
  if(pts.length<2) return '';
  const max = isBinary?1:Math.max(...pts), min=isBinary?0:Math.min(...pts);
  const range = (max-min)||1;
  const W=54,H=30;
  const step = W/(vals.length-1);
  let d='', started=false, x=0;
  vals.forEach((v,i)=>{
    x=i*step;
    if(v==null){ return; }
    const y = H-2 - ((v-min)/range)*(H-4);
    d += (started?'L':'M')+x.toFixed(1)+','+y.toFixed(1)+' ';
    started=true;
  });
  return '<svg class="ov-spark" viewBox="0 0 '+W+' '+H+'"><path d="'+d+'" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}

// Charge les données du graphe selon la période choisie (7 j, 1 mois, 1 an)
async function loadEvData(){
  if(!currentUser){ evEntries=[]; renderEvChart(); return; }
  const since=new Date(); since.setDate(since.getDate()-(evPeriod-1));
  try{
    const { data } = await sb.from('entries')
      .select('date,score_peau,hydratation,humeur')
      .eq('user_id',currentUser.id)
      .gte('date', since.toISOString().slice(0,10))
      .order('date',{ascending:true});
    // Une entrée par date (on fusionne les doublons)
    const byDate={};
    (data||[]).forEach(e=>{ byDate[e.date] = byDate[e.date] ? {...byDate[e.date], ...e} : e; });
    evEntries = Object.keys(byDate).sort().map(k=>byDate[k]);
  }catch(e){ evEntries=[]; }
  renderEvChart();
}

function evSetPeriod(p){
  evPeriod = p;
  document.querySelectorAll('.ev-p').forEach(b=>b.classList.toggle('sel', Number(b.dataset.p)===p));
  loadEvData();
}

// Prépare les points à tracer : jour par jour, ou moyenne par mois sur un an
function evPoints(){
  const MOIS=['J','F','M','A','M','J','J','A','S','O','N','D'];
  const val = e => {
    const v = e[evMetric];
    return (v!==null && v!==undefined && v!=='') ? Number(v) : null;
  };
  if(evPeriod <= 31){
    return evEntries.map(e=>({ label: String(parseInt(e.date.slice(8,10),10)), v: val(e) }));
  }
  // Un an : on moyenne par mois pour rester lisible
  const parMois={};
  evEntries.forEach(e=>{
    const v=val(e); if(v===null) return;
    const m=e.date.slice(0,7);
    if(!parMois[m]) parMois[m]={somme:0, n:0};
    parMois[m].somme+=v; parMois[m].n++;
  });
  return Object.keys(parMois).sort().map(m=>({
    label: MOIS[parseInt(m.slice(5,7),10)-1],
    v: Math.round((parMois[m].somme/parMois[m].n)*10)/10
  }));
}

function evSetMetric(m){
  evMetric=m;
  document.querySelectorAll('.ev-tab').forEach(b=>b.classList.toggle('sel', b.dataset.metric===m));
  renderEvChart();
}

function renderEvChart(){
  const host=document.getElementById('ev-card'); if(!host) return;
  const pts = evPoints();
  const avecValeur = pts.filter(p=>p.v!==null);

  if(avecValeur.length < 1){
    const quand = evPeriod===7 ? 'cette semaine' : (evPeriod===30 ? 'ce mois-ci' : 'cette année');
    host.innerHTML='<div style="text-align:center;color:var(--muted);font-size:12.5px;padding:26px 0;">Pas encore de données '+quand+' 🌸<br>Note l\'état de ta peau pour voir ta courbe apparaître.</div>';
    return;
  }

  const isMood = evMetric==='humeur';
  const max = isMood ? 5 : 100;
  const min = isMood ? 1 : 0;
  const W=300, H=126, padL=10, padR=10, padT=16, padB=24;
  const iw=W-padL-padR, ih=H-padT-padB;
  const n=pts.length;
  const xOf = i => padL + (n<=1 ? iw/2 : (i/(n-1))*iw);
  const yOf = v => padT + ih - ((v-min)/((max-min)||1))*ih;

  // Courbe + aire (on ne relie que les points renseignés)
  let line='';
  avecValeur.forEach((p,k)=>{
    const i = pts.indexOf(p);
    line += (k?'L':'M') + xOf(i).toFixed(1) + ',' + yOf(p.v).toFixed(1) + ' ';
  });
  const iPremier = pts.indexOf(avecValeur[0]);
  const iDernier = pts.indexOf(avecValeur[avecValeur.length-1]);
  const area = 'M'+xOf(iPremier).toFixed(1)+','+(padT+ih)+' '+line.replace(/^M/,'L')+' L'+xOf(iDernier).toFixed(1)+','+(padT+ih)+' Z';

  // Points : discrets si nombreux
  const gros = avecValeur.length <= 14;
  let dots='';
  avecValeur.forEach(p=>{
    const i=pts.indexOf(p);
    dots += '<circle cx="'+xOf(i).toFixed(1)+'" cy="'+yOf(p.v).toFixed(1)+'" r="'+(gros?3.5:2)+'" fill="var(--accent)"/>';
  });

  // Libellés de l'axe : on en saute si trop nombreux
  const pas = n<=8 ? 1 : Math.ceil(n/7);
  let labels='';
  pts.forEach((p,i)=>{
    if(i % pas !== 0 && i !== n-1) return;
    labels += '<text x="'+xOf(i).toFixed(1)+'" y="'+(H-7)+'" font-size="9" fill="var(--muted)" text-anchor="middle">'+p.label+'</text>';
  });

  const dernier = avecValeur[avecValeur.length-1];
  const valeurTxt = isMood
    ? ['','Difficile','Mitigée','Correcte','Bonne','Rayonnante'][Math.round(dernier.v)] || ''
    : dernier.v + '/100';
  const entete = '<text x="'+(W-padR)+'" y="11" font-size="11" fill="var(--accent)" text-anchor="end" font-weight="600">'+valeurTxt+'</text>';

  host.innerHTML =
    '<svg viewBox="0 0 '+W+' '+H+'" style="width:100%;height:auto;display:block;overflow:visible;">'+
      '<path d="'+area+'" fill="var(--blush-soft)" opacity="0.5"/>'+
      '<path d="'+line+'" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>'+
      dots + labels + entete +
    '</svg>';
}

async function loadSuiviAccroche(){
  const host=document.getElementById('suivi-accroche'); if(!host) return;
  if(!currentUser){ host.style.display='none'; return; }
  const since=new Date(); since.setDate(since.getDate()-13);
  let es=[];
  try{
    const { data } = await sb.from('entries').select('date,score_peau').eq('user_id',currentUser.id).gte('date',since.toISOString().slice(0,10)).order('date',{ascending:true});
    es=data||[];
  }catch(e){ es=[]; }
  const byDate={}; es.forEach(e=>{ if(e.score_peau!=null) byDate[e.date]=Number(e.score_peau); });
  const vals=Object.keys(byDate).sort().map(k=>byDate[k]);
  if(vals.length<2){ host.style.display='none'; return; }
  const first=vals[0], last=vals[vals.length-1], delta=last-first;
  let phrase, emoji;
  if(delta>=5){ phrase='Ta peau progresse joliment'; emoji='🌿'; }
  else if(delta>=0){ phrase='Ta peau reste stable, continue'; emoji='🌸'; }
  else { phrase='Chaque jour compte, garde le rythme'; emoji='💧'; }
  const max=Math.max(...vals), min=Math.min(...vals), range=(max-min)||1;
  const W=300,H=54, step=W/(vals.length-1);
  let d='';
  vals.forEach((v,i)=>{ const x=i*step, y=H-4-((v-min)/range)*(H-8); d+=(i?'L':'M')+x.toFixed(1)+','+y.toFixed(1)+' '; });
  const area='M0,'+H+' '+d.replace(/^M/,'L')+' L'+W+','+H+' Z';
  host.innerHTML =
    '<div style="background:linear-gradient(150deg,#FFFEFB,#FAF3EA);border-radius:20px;padding:16px 18px;box-shadow:0 12px 30px rgba(46,33,28,0.08);">'+
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">'+
        '<div style="display:flex;align-items:center;gap:9px;"><span style="font-size:22px;">'+emoji+'</span><span style="font-family:var(--serif);font-size:16px;color:var(--ink);">'+phrase+'</span></div>'+
        (delta!==0?'<span style="font-size:12px;font-weight:600;color:'+(delta>0?'#3E7A4E':'var(--accent)')+';">'+(delta>0?'+':'')+delta+'</span>':'')+
      '</div>'+
      '<svg viewBox="0 0 '+W+' '+H+'" style="width:100%;height:auto;display:block;overflow:visible;">'+
        '<path d="'+area+'" fill="var(--blush-soft)" opacity="0.5"/>'+
        '<path d="'+d+'" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>'+
        '<circle cx="'+((vals.length-1)*step).toFixed(1)+'" cy="'+(H-4-((last-min)/range)*(H-8)).toFixed(1)+'" r="4" fill="var(--accent)"/>'+
      '</svg>'+
    '</div>';
  host.style.display='block';
}

// ===== Calendrier du Journal =====
const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
let calRef = (function(){ const d=new Date(); d.setDate(1); return d; })();
function calMonth(delta){ calRef.setMonth(calRef.getMonth()+delta); renderCalendar(); }
async function renderCalendar(){
  const grid=document.getElementById('cal-grid'); if(!grid || !currentUser) return;
  const year=calRef.getFullYear(), month=calRef.getMonth();
  document.getElementById('cal-title').textContent = MONTHS_FR[month]+' '+year;
  const first=new Date(year, month, 1);
  const lastDay=new Date(year, month+1, 0).getDate();
  const startStr=year+'-'+pad2(month+1)+'-01';
  const endStr=year+'-'+pad2(month+1)+'-'+pad2(lastDay);
  const { data } = await sb.from('entries').select('date,photo_path,humeur,routine_matin,routine_soir,sommeil,hydratation,alimentation,note,repos').eq('user_id', currentUser.id).gte('date', startStr).lte('date', endStr);
  const map={}; (data||[]).forEach(e=>{ map[e.date]=e; });
  const { data: hlogs } = await sb.from('habit_logs').select('date').eq('user_id', currentUser.id).gte('date', startStr).lte('date', endStr);
  const habitDays=new Set((hlogs||[]).map(l=>l.date));
  let wd=first.getDay(); const offset=(wd===0)?6:(wd-1); // lundi en 1er
  const tStr=todayStr();
  let html='';
  for(let i=0;i<offset;i++) html+='<div class="cal-cell empty"></div>';
  for(let d=1; d<=lastDay; d++){
    const ds=year+'-'+pad2(month+1)+'-'+pad2(d);
    const e=map[ds];
    const isFuture=ds>tStr, isToday=ds===tStr;
    const complete = dayComplete(e);
    const hasEntry = (e && (e.photo_path || e.humeur || e.sommeil!=null || e.hydratation!=null || e.alimentation!=null || e.routine_matin || e.routine_soir || e.note)) || habitDays.has(ds);
    let cls='cal-cell';
    if(complete) cls+=' complete';
    if(isToday) cls+=' today';
    if(isFuture) cls+=' cal-future';
    const tappable = !isFuture;
    if(tappable) cls+=' has';
    const cam = (e && e.photo_path) ? '<span class="cal-cam">📷</span>' : '';
    const rest = (e && e.repos) ? '<span class="cal-rest">☁️</span>' : '';
    const dot = (hasEntry && !complete) ? '<span class="cal-dot"></span>' : '';
    const oc = tappable ? ` onclick="openDayDetail('${ds}')"` : '';
    html += `<div class="${cls}"${oc}>${cam}${rest}<span>${d}</span>${dot}</div>`;
  }
  grid.innerHTML=html;
}
// ===== Fiche d'un jour (modifiable) =====
let ddState = { date:null, mood:null, photoFile:null, photoPath:null, hadSom:false, hadHyd:false, hadAli:false, somTouched:false, hydTouched:false, aliTouched:false };
async function getEntryIdForDate(ds){
  if(!currentUser) return null;
  const { data } = await sb.from('entries').select('id').eq('user_id', currentUser.id).eq('date', ds).order('created_at',{ascending:true}).limit(1);
  if(data && data.length) return data[0].id;
  const { data: ins, error } = await sb.from('entries').insert({ user_id: currentUser.id, date: ds }).select('id').single();
  if(error){ console.warn('getEntryIdForDate:', error.message); return null; }
  return ins ? ins.id : null;
}
function ddTouch(k){ if(k==='som') ddState.somTouched=true; if(k==='hyd') ddState.hydTouched=true; if(k==='ali') ddState.aliTouched=true; }
function ddHydraLbl(v){ const n=parseInt(v,10); document.getElementById('dd-hydra-val').textContent = n+(n>1?' verres':' verre'); }
function ddPickMood(el,val){
  document.querySelectorAll('#dd-mood-row .mood-btn').forEach(b=>b.classList.remove('selected'));
  el.classList.add('selected');
  ddState.mood = val;
  document.getElementById('dd-intensity-box').classList.remove('hidden');
}
function ddPhotoPreview(input){
  const f=input.files[0]; if(!f) return;
  ddState.photoFile=f;
  const r=new FileReader(); r.onload=ev=>{ document.getElementById('dd-photo-wrap').innerHTML=`<img src="${ev.target.result}" style="width:100%;border-radius:16px;display:block;">`; }; r.readAsDataURL(f);
}
async function openDayDetail(ds){
  if(!currentUser) return;
  const { data } = await sb.from('entries').select('*').eq('user_id', currentUser.id).eq('date', ds).order('created_at',{ascending:true}).limit(1);
  const e=(data && data.length)?data[0]:null;
  const [y,m,d]=ds.split('-').map(Number);
  const dObj=new Date(y, m-1, d);
  const jours=['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
  document.getElementById('dd-title').textContent = jours[dObj.getDay()]+' '+d+' '+MONTHS_FR[m-1].toLowerCase();

  ddState = { date:ds, mood:(e&&e.humeur)||null, photoFile:null, photoPath:(e&&e.photo_path)||null,
    hadSom: !!(e && e.sommeil!=null), hadHyd: !!(e && e.hydratation!=null), hadAli: !!(e && e.alimentation!=null),
    somTouched:false, hydTouched:false, aliTouched:false };

  // photo
  const pw=document.getElementById('dd-photo-wrap');
  if(e && e.photo_path){ const url=await signedPhoto(e.photo_path); pw.innerHTML = url?`<img src="${url}" style="width:100%;border-radius:16px;display:block;">`:''; }
  else pw.innerHTML = `<div style="background:var(--surface-warm);border-radius:16px;padding:24px;text-align:center;color:var(--muted);font-size:13px;">Pas de photo ce jour</div>`;

  // humeur
  document.querySelectorAll('#dd-mood-row .mood-btn').forEach(b=>b.classList.remove('selected'));
  const ibox=document.getElementById('dd-intensity-box');
  if(e && e.humeur){
    const btns=document.querySelectorAll('#dd-mood-row .mood-btn'); if(btns[e.humeur-1]) btns[e.humeur-1].classList.add('selected');
    ibox.classList.remove('hidden');
    document.getElementById('dd-intensity').value = e.humeur_intensite!=null ? e.humeur_intensite : 50;
    document.getElementById('dd-intensity-val').textContent = (e.humeur_intensite!=null?e.humeur_intensite:50)+'%';
  } else { ibox.classList.add('hidden'); document.getElementById('dd-intensity').value=50; document.getElementById('dd-intensity-val').textContent='50%'; }

  // sommeil / hydra / alim
  const som = (e&&e.sommeil!=null)?e.sommeil:7; document.getElementById('dd-sommeil').value=som; document.getElementById('dd-sommeil-val').textContent=fmtSleep(som);
  const hyd = (e&&e.hydratation!=null)?e.hydratation:6; document.getElementById('dd-hydra').value=hyd; ddHydraLbl(hyd);
  const ali = (e&&e.alimentation!=null)?e.alimentation:3; document.getElementById('dd-alim').value=ali; document.getElementById('dd-alim-val').textContent=ALIM_LABELS[ali]||'…';

  // routines + note
  document.getElementById('dd-matin').checked = !!(e && e.routine_matin);
  document.getElementById('dd-soir').checked = !!(e && e.routine_soir);
  document.getElementById('dd-note').value = (e && e.note) ? e.note : '';
  await renderDayHabits(ds);

  document.getElementById('day-detail').classList.add('open');
}
async function saveDayDetail(){
  if(!currentUser || !ddState.date) return;
  showToast('Enregistrement…');
  const fields = {
    humeur: ddState.mood,
    humeur_intensite: ddState.mood ? parseInt(document.getElementById('dd-intensity').value,10) : null,
    routine_matin: document.getElementById('dd-matin').checked,
    routine_soir: document.getElementById('dd-soir').checked,
    note: document.getElementById('dd-note').value.trim()
  };
  if(ddState.hadSom || ddState.somTouched) fields.sommeil = parseFloat(document.getElementById('dd-sommeil').value);
  if(ddState.hadHyd || ddState.hydTouched) fields.hydratation = parseInt(document.getElementById('dd-hydra').value,10);
  if(ddState.hadAli || ddState.aliTouched) fields.alimentation = parseInt(document.getElementById('dd-alim').value,10);
  if(ddState.photoFile){
    const ext=(ddState.photoFile.name.split('.').pop()||'jpg').toLowerCase();
    const path=`${currentUser.id}/${Date.now()}.${ext}`;
    const { error: upErr } = await sb.storage.from('photos').upload(path, ddState.photoFile, { upsert:true });
    if(!upErr) fields.photo_path = path;
  }
  const id = await getEntryIdForDate(ddState.date);
  if(id) await sb.from('entries').update(fields).eq('id', id);
  closeDayDetail();
  showToast('Jour enregistré 🌸');
  bustStreak();
  renderCalendar();
  if(ddState.date===todayStr()){ loadHomeData(); loadJournalFromDB(); }
}
function closeDayDetail(){ document.getElementById('day-detail').classList.remove('open'); }

// Pont transitoire : ces fonctions sont appelées par les handlers onclick inline de index.html.
window.renderJournal = renderJournal;
window.openEntry = openEntry;
window.loadJournalFromDB = loadJournalFromDB;
window.loadWeekRecap = loadWeekRecap;
window.loadOverview = loadOverview;
window.sparkline = sparkline;
window.loadEvData = loadEvData;
window.evSetPeriod = evSetPeriod;
window.evPoints = evPoints;
window.evSetMetric = evSetMetric;
window.renderEvChart = renderEvChart;
window.loadSuiviAccroche = loadSuiviAccroche;
window.calMonth = calMonth;
window.renderCalendar = renderCalendar;
window.ddState = ddState;
window.getEntryIdForDate = getEntryIdForDate;
window.ddTouch = ddTouch;
window.ddHydraLbl = ddHydraLbl;
window.ddPickMood = ddPickMood;
window.ddPhotoPreview = ddPhotoPreview;
window.openDayDetail = openDayDetail;
window.saveDayDetail = saveDayDetail;
window.closeDayDetail = closeDayDetail;
