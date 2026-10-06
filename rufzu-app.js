'use strict';
const OFFICIAL_PRICE_URL='https://pa2.kaerntner-linien.at/preisauskunft';
const ZONE_PLAN_URL='https://www.kaerntner-linien.at/wp-content/uploads/tarifzonenplan-05-2026.pdf';

let selected={from:null,to:null};
let routeLine=null;

function esc(s){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function fmtEuro(v){return Number(v).toFixed(2).replace('.',',')+' €'}
function getSelectedPair(){return selected.from&&selected.to?{from:selected.from,to:selected.to}:null}

const colorMap={'Maria Saal':'#f1d400','St.Veit':'#e59b00','Liebenfels':'#d64b27','Frauenstein':'#2877d1','St.Georgen am Längsee':'#18a566'};
const map=L.map('map').setView([46.76,14.37],10);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);
stops.forEach(s=>{
  const c=colorMap[s.group]||'#666';
  const marker=L.circleMarker([s.lat,s.lon],{radius:5,weight:1,fillOpacity:.85,color:c,fillColor:c}).addTo(map);
  marker.bindTooltip(s.name,{direction:'top',offset:[0,-4]});
  marker.on('click',()=>{if(!selected.from)pick('from',stops.indexOf(s));else if(!selected.to)pick('to',stops.indexOf(s));});
});

function setupField(id){
  const input=document.getElementById(id),box=document.getElementById(id+'Sug');
  input.addEventListener('input',()=>{selected[id]=null;renderSuggestions(id)});
  input.addEventListener('focus',()=>renderSuggestions(id));
  input.addEventListener('keydown',e=>{if(e.key==='Escape')box.hidden=true});
}
function renderSuggestions(id){
  const q=document.getElementById(id).value.trim().toLowerCase(),box=document.getElementById(id+'Sug');
  if(!q){box.hidden=true;return}
  const matches=stops.filter(s=>s.name.toLowerCase().includes(q)).slice(0,30);
  box.innerHTML=matches.length?matches.map(s=>`<div class="sug" data-index="${stops.indexOf(s)}"><b>${esc(s.name)}</b><span>${esc(s.group)}</span></div>`).join(''):'<div class="sug"><span>Keine passende Haltestelle gefunden</span></div>';
  box.querySelectorAll('[data-index]').forEach(el=>el.addEventListener('click',()=>pick(id,Number(el.dataset.index))));
  box.hidden=false;
}
function pick(id,i){
  const s=stops[i]; if(!s)return;
  selected[id]=s;document.getElementById(id).value=s.name;document.getElementById(id+'Sug').hidden=true;
  map.setView([s.lat,s.lon],15);
}
function clearField(id){selected[id]=null;document.getElementById(id).value='';document.getElementById(id+'Sug').hidden=true;document.getElementById(id).focus()}
function swapStops(){if(!selected.from||!selected.to){alert('Bitte zuerst Von und Nach auswählen.');return}const a=selected.from,b=selected.to;selected.from=b;selected.to=a;document.getElementById('from').value=a?b.name:'';document.getElementById('to').value=b?a.name:'';map.setView([b.lat,b.lon],15);}

document.addEventListener('click',e=>{if(!e.target.closest('.field')){const box=document.getElementById('toSug');if(box)box.hidden=true}});
setupField('from');
setupField('to');
document.getElementById('clearFrom').addEventListener('click',()=>clearField('from'));
document.getElementById('clearTo').addEventListener('click',()=>clearField('to'));
document.getElementById('swapBtn')?.addEventListener('click',swapStops);


function normalizeText(s){
  return String(s||'').toUpperCase()
    .replace(/Ä/g,'AE').replace(/Ö/g,'OE').replace(/Ü/g,'UE').replace(/ß/g,'SS')
    .replace(/[^A-Z0-9\s-]/g,' ')
    .replace(/\s+/g,' ').trim();
}
function compactText(s){return normalizeText(s).replace(/[^A-Z0-9]/g,'');}
function editDistance(a,b){
  a=String(a||'');b=String(b||'');
  const prev=Array.from({length:b.length+1},(_,i)=>i);
  for(let i=1;i<=a.length;i++){
    const cur=[i];
    for(let j=1;j<=b.length;j++)cur[j]=Math.min(cur[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));
    for(let j=0;j<cur.length;j++)prev[j]=cur[j];
  }
  return prev[b.length];
}
const OCR_CODES=stops.map(s=>({code:stopCode(s),stop:s})).filter(x=>/^[A-Z]{2}\d{3}$/.test(x.code));
const OCR_CONFUSIONS={O:'0',Q:'0',D:'0',I:'1',L:'1',Z:'2',S:'5',G:'6',T:'7',B:'8',P:'9'};
function normalizeOcrCode(raw){
  let r=compactText(raw);
  if(r.length<4||r.length>7)return null;
  // OCR kann Leerzeichen/Trennzeichen verlieren oder ein Zeichen verschlucken.
  if(r.length===4)r=r.slice(0,2)+'0'+r.slice(2);
  if(r.length>5)r=r.slice(0,5);
  const a=r.split('');
  if(a.length<5)return null;
  for(let i=2;i<5;i++)a[i]=OCR_CONFUSIONS[a[i]]||a[i];
  return /^[A-Z]{2}\d{3}$/.test(a.join(''))?a.join(''):null;
}
function ocrCodeScore(raw,known){
  const r=normalizeOcrCode(raw);if(!r)return 0;
  let d=editDistance(r,known);
  if(r.slice(0,2)===known.slice(0,2))d=Math.max(0,d-1);
  return d<=2?100-d*35:0;
}
function findStopByOcrCode(raw){
  let best=null,bestScore=0;
  for(const item of OCR_CODES){const score=ocrCodeScore(raw,item.code);if(score>bestScore){bestScore=score;best=item.stop;}}
  return bestScore>=65?best:null;
}
function tokenSimilarity(a,b){
  a=compactText(a);b=compactText(b);if(!a||!b)return 0;
  const d=editDistance(a,b);return 1-d/Math.max(a.length,b.length);
}
function stopNameScore(line,stop){
  const t=compactText(line),code=stopCode(stop);let score=0;
  if(code&&t.includes(code))score+=1000;
  const name=normalizeText(stop.name).replace(/^[A-Z]{2}\d{3}\s*[-.:]?\s*/,'');
  const words=name.split(/[^A-Z0-9]+/).filter(w=>w.length>=3);
  const tokens=t.match(/[A-Z0-9]{3,}/g)||[];
  for(const w of words){
    const cw=compactText(w);if(!cw)continue;
    if(t.includes(cw)){score+=Math.min(180,cw.length*18);continue;}
    let best=0;for(const x of tokens)best=Math.max(best,tokenSimilarity(x,cw));
    if(best>=0.65)score+=Math.round(best*70);
  }
  return score;
}
function findStopFromOCR(text){
  const lines=String(text||'').split(/\r?\n/).map(normalizeText).filter(Boolean);
  const found=new Map();
  const codeRx=/[A-Z0-9]{1,3}\s*[-.:]?\s*[A-Z0-9]{2,4}/g;
  for(const line of lines){
    for(const raw of line.match(codeRx)||[]){
      const hit=findStopByOcrCode(raw);if(hit){const c=stopCode(hit);found.set(c,{stop:hit,score:Math.max(found.get(c)?.score||0,500)});}
    }
    for(const item of OCR_CODES){
      const score=stopNameScore(line,item.stop);
      if(score>=45){const c=stopCode(item.stop),old=found.get(c);if(!old||score>old.score)found.set(c,{stop:item.stop,score});}
    }
  }
  return [...found.values()].sort((a,b)=>b.score-a.score).map(x=>x.stop);
}
function findTimes(text){return [...String(text||'').matchAll(/\b([01]?\d|2[0-3])\s*[:.]\s*([0-5]\d)\b/g)].map(m=>`${String(m[1]).padStart(2,'0')}:${m[2]}`);}
function findPassengerNumbers(text){
  const t=String(text||''),up=t.toUpperCase();
  const nums=[...t.matchAll(/\b(\d{1,2})\b/g)].map(m=>Number(m[1])).filter(n=>n<=99);
  let board=null,alight=null;
  const bm=up.match(/(?:EINSTEIG|EINSTIEG|ZUSTIEG|ABHOL|↑)\D{0,12}(\d{1,2})/i);
  const am=up.match(/(?:AUSSTEIG|AUSSTIEG|ABGANG|↓)\D{0,12}(\d{1,2})/i);
  if(bm)board=Number(bm[1]);if(am)alight=Number(am[1]);
  if(board===null&&nums.length>=2)board=nums[0];if(alight===null&&nums.length>=2)alight=nums[1];
  return {board,alight};
}
function preprocessOcrImage(file,mode){
  return new Promise((resolve,reject)=>{
    const img=new Image();
    img.onload=()=>{
      const maxWidth=2600;
      const scale=Math.min(3,Math.max(1,maxWidth/img.naturalWidth));
      const w=Math.max(1,Math.round(img.naturalWidth*scale)),h=Math.max(1,Math.round(img.naturalHeight*scale));
      const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
      const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0,w,h);
      const data=ctx.getImageData(0,0,w,h),p=data.data;
      for(let i=0;i<p.length;i+=4){
        let g=.299*p[i]+.587*p[i+1]+.114*p[i+2];
        if(mode==='threshold')g=g>165?255:0;else g=Math.max(0,Math.min(255,(g-128)*1.5+128));
        p[i]=p[i+1]=p[i+2]=g;
      }
      ctx.putImageData(data,0,0);resolve(canvas);URL.revokeObjectURL(img.src);
    };
    img.onerror=()=>reject(new Error('Bild konnte nicht verarbeitet werden'));
    img.src=URL.createObjectURL(file);
  });
}
async function recognizeOcr(image,psm,status){
  return Tesseract.recognize(image,'deu+eng',{logger:m=>{
    if(m.status==='recognizing text'&&m.progress)status.textContent='⏳ Text wird erkannt … '+Math.round(m.progress*100)+' %';
  },config:{tessedit_pageseg_mode:String(psm),preserve_interword_spaces:'1'}});
}
function showOcrCandidates(candidates){
  const status=document.getElementById('ocrStatus');if(!status)return;
  const unique=[];for(const c of candidates||[]){if(c&&!unique.some(x=>stopCode(x)===stopCode(c)))unique.push(c);if(unique.length>=6)break;}
  if(!unique.length){status.className='ocrstatus warn';status.textContent='Keine Haltestelle sicher erkannt. Bitte Foto näher/gerader aufnehmen oder händisch auswählen.';return;}
  status.className='ocrstatus warn';
  status.innerHTML='<b>Mögliche Haltestellen:</b><div class="ocrchoices"></div><div style="margin-top:6px">Bitte die richtige Haltestelle antippen. Danach ggf. das Foto nochmals für die zweite Haltestelle scannen.</div>';
  const box=status.querySelector('.ocrchoices');
  unique.forEach(stop=>{
    const b=document.createElement('button');b.type='button';b.className='smallbtn';b.style.margin='4px 4px 0 0';b.textContent=stop.name;
    b.addEventListener('click',()=>{
      const fromEmpty=!selected.from;
      pick(fromEmpty?'from':'to',stops.indexOf(stop));
      status.className='ocrstatus good';status.textContent='✓ Haltestelle übernommen. Bitte zweite Haltestelle auswählen oder nochmals scannen.';
    });
    box.appendChild(b);
  });
}
async function scanScheduleImage(file){
  const status=document.getElementById('ocrStatus');
  if(!status)return;
  status.className='ocrstatus';status.textContent='⏳ Foto wird vorbereitet …';
  try{
    if(!window.Tesseract)throw new Error('OCR-Modul konnte nicht geladen werden.');
    const variants=[await preprocessOcrImage(file,'contrast'),await preprocessOcrImage(file,'threshold')];
    let allText='',candidates=[];
    for(let i=0;i<variants.length;i++){
      const result=await recognizeOcr(variants[i],i===0?6:11,status);
      const text=result?.data?.text||'';allText+='\n'+text;
      candidates=findStopFromOCR(allText);
      if(candidates.length>=2)break;
    }
    console.log('Ruf:Zu OCR-Text:',allText);
    const from=candidates[0]||null;
    const to=candidates.find(s=>!from||stopCode(s)!==stopCode(from))||null;
    if(from)pick('from',stops.indexOf(from));
    if(to)pick('to',stops.indexOf(to));
    const dt=document.getElementById('departTime'),at=document.getElementById('arriveTime');
    const times=findTimes(allText);if(dt&&times[0])dt.value=times[0];if(at&&times[1])at.value=times[1];
    const board=document.getElementById('boardCount'),alight=document.getElementById('alightCount');
    const pc=findPassengerNumbers(allText);if(board&&pc.board!==null)board.value=pc.board;if(alight&&pc.alight!==null)alight.value=pc.alight;
    const found=[];if(from)found.push('Von');if(to)found.push('Nach');if(times.length)found.push('Zeiten');if(pc.board!==null||pc.alight!==null)found.push('Ein-/Ausstieg');
    if(found.length){
      status.className='ocrstatus good';status.textContent='✓ Erkannt: '+found.join(', ')+'. Bitte kurz kontrollieren und danach berechnen.';
    }else{
      showOcrCandidates(candidates);
    }
  }catch(e){
    console.error('Ruf:Zu OCR-Fehler',e);
    status.className='ocrstatus warn';status.textContent='Foto konnte nicht automatisch gelesen werden. Bitte Foto näher/gerader aufnehmen oder händisch auswählen.';
  }
}
document.getElementById('scanBtn')?.addEventListener('click',()=>document.getElementById('scanInput')?.click());
document.getElementById('scanInput')?.addEventListener('change',e=>{const f=e.target.files?.[0];if(f)scanScheduleImage(f);e.target.value='';});


function hav(a,b){
 const R=6371,p=Math.PI/180,dLat=(b.lat-a.lat)*p,dLon=(b.lon-a.lon)*p;
 const x=Math.sin(dLat/2)**2+Math.cos(a.lat*p)*Math.cos(b.lat*p)*Math.sin(dLon/2)**2;
 return 2*R*Math.asin(Math.sqrt(x));
}
async function getRoute(a,b){
 const q=`${a.lon},${a.lat};${b.lon},${b.lat}`;
 const urls=[
  `https://router.project-osrm.org/route/v1/driving/${q}?overview=full&geometries=geojson&alternatives=true&steps=false`,
  `https://routing.openstreetmap.de/routed-car/route/v1/driving/${q}?overview=full&geometries=geojson&alternatives=false&steps=false`
 ];
 let lastError=null;
 for(const u of urls){
  try{
   const r=await fetch(u,{cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);
   const j=await r.json();if(!j.routes?.length)throw new Error('Keine Straßenroute gefunden');
   return j.routes.slice().sort((x,y)=>x.distance-y.distance)[0];
  }catch(e){lastError=e;}
 }
 throw new Error('Routenserver nicht erreichbar: '+(lastError?.message||''));
}
function fareBoxForZone(z){
 const n=TARIF_2026.normal[z-1],s=TARIF_2026.senior[z-1],sp=TARIF_2026.spar[z-1],f=TARIF_2026.family[z-1];
 if(n==null)return '<div class="warn">Für '+z+' Zonen ist kein aktueller Einzelkartentarif hinterlegt.</div>';
 const rows=[['Normal',n],['Senioren',s],['Sparpreis',sp],['Familien',f]];
 return `<div class="faregrid">${rows.map(([label,base])=>`<div class="fareitem"><b>${label}</b><div class="fareline"><span>Kärntner Linien</span><strong>${fmtEuro(base)}</strong></div><div class="fareline"><span>Ruf:Zu Komfort</span><strong>${fmtEuro(COMFORT_SURCHARGE)}</strong></div><div class="fareline total"><span>Ruf:Zu gesamt</span><strong>${fmtEuro(base+COMFORT_SURCHARGE)}</strong></div></div>`).join('')}</div><div class="muted" style="margin-top:9px">Tarifbasis: Kärntner Linien, gültig ab 01.07.2026. Ruf:Zu berechnet zusätzlich 2,00 € Komfortzuschlag. Bei gültiger Verbund-Zeitkarte fällt laut Ruf:Zu-Information nur der Komfortzuschlag an.</div>`;
}
function renderZoneResult(sequence,a,b,sourceLabel='Routenberechnung'){
 const ids=sequence.map(z=>typeof z==='string'?z:z.id);
 const zones=ids.length;
 document.getElementById('zoneText').innerHTML=`<b>${zones} Zonen</b> – ${esc(sourceLabel)}`;
 document.getElementById('zonePath').innerHTML=`<div class="routeZones">${ids.join(' → ')}</div>`;
 document.getElementById('zoneMessage').innerHTML='<div class="good">✓ Tarifzonen werden aus dem Routenverlauf und dem Tarifzonenplan ermittelt – nicht aus Kilometern.</div>';
 document.getElementById('fareBox').innerHTML=fareBoxForZone(zones);
 return zones;
}
async function calculateTrip(){
 const pair=getSelectedPair();
 if(!pair){alert('Bitte Von und Nach auswählen.');return}
 const a=pair.from,b=pair.to;
 document.getElementById('result').style.display='block';
 document.getElementById('routeText').innerHTML='<b>Von:</b> '+esc(a.name)+'<br><b>Nach:</b> '+esc(b.name);
 const dt=document.getElementById('departTime')?.value,at=document.getElementById('arriveTime')?.value;
 if(dt||at)document.getElementById('routeText').innerHTML+=`<br><b>Fahrt:</b> ${esc(dt||'–')} → ${esc(at||'–')}`;
 const nav=`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(a.lat+','+a.lon)}&destination=${encodeURIComponent(b.lat+','+b.lon)}&travelmode=driving&dir_action=navigate`;
 document.getElementById('nav').href=nav;
 const key=stopCode(a)+'|'+stopCode(b);
 const verified=VERIFIED_ROUTES.get(key);
 // Tarifanzeige ist bewusst unabhängig vom Straßenrouting.
 if(verified){
   renderZoneResult(verified.sequence,a,b,'verifizierte Tarifstrecke');
 }else{
   document.getElementById('zoneText').innerHTML='<b>Für diese Strecke noch nicht automatisch verifiziert</b>';
   document.getElementById('zonePath').textContent='Kein Schätzwert aus Kilometern oder Luftlinie.';
   document.getElementById('zoneMessage').innerHTML='<div class="warn">Die Tarifzonenzahl wird nicht vom Routingserver übernommen. Für diese konkrete Strecke ist in der verifizierten Zonenbasis noch kein Wert hinterlegt.</div>';
   document.getElementById('fareBox').innerHTML='';
 }
 document.getElementById('distanceText').textContent='Berechne …';
 document.getElementById('distanceNote').textContent='Straßenroute wird nur zur Orientierung ermittelt.';
 try{
   const route=await getRoute(a,b),km=route.distance/1000;
   document.getElementById('distanceText').textContent=km.toFixed(1).replace('.',',')+' km';
   document.getElementById('distanceNote').textContent='Nur Informationswert. Straßenkilometer bestimmen NICHT die Tarifzonen.';
   if(routeLine)map.removeLayer(routeLine);
   routeLine=L.geoJSON(route.geometry,{style:{weight:5,opacity:.8}}).addTo(map);
   map.fitBounds(routeLine.getBounds(),{padding:[20,20]});
 }catch(e){
   document.getElementById('distanceText').textContent='nicht verfügbar';
   document.getElementById('distanceNote').textContent='Straßenroute derzeit nicht erreichbar. Die Tarifzonenanzeige bleibt davon unabhängig.';
 }
}
document.getElementById('calcBtn').addEventListener('click',calculateTrip);

async function copyTrip(){
 const pair=getSelectedPair();if(!pair){alert('Bitte zuerst Von und Nach auswählen.');return}
 const text=`Von: ${pair.from.name}\nNach: ${pair.to.name}`;
 try{await navigator.clipboard.writeText(text);alert('Von/Nach wurde kopiert. In der offiziellen Preisauskunft einfach einfügen.')}
 catch(e){prompt('Bitte diesen Text kopieren:',text)}
}
function openOfficial(){
 const pair=getSelectedPair();
 if(!pair){window.open(OFFICIAL_PRICE_URL,'_blank','noopener');return}
 const text=`Von: ${pair.from.name}\nNach: ${pair.to.name}`;
 navigator.clipboard?.writeText(text).catch(()=>{});
 window.open(OFFICIAL_PRICE_URL,'_blank','noopener');
}
document.getElementById('copyBtn').addEventListener('click',copyTrip);
document.getElementById('officialBtn').addEventListener('click',openOfficial);

// Sicherheitsprüfungen beim Laden.
if(stops.length!==536)console.error('Haltestellen-Datensatz beschädigt: erwartet 536, gefunden',stops.length);
if(TARIFF_ZONES.length<25)console.error('Tarifzonenbasis unvollständig');
