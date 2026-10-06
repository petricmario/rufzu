'use strict';

const OFFICIAL_PRICE_URL='https://pa2.kaerntner-linien.at/preisauskunft';
const ZONE_PLAN_URL='https://www.kaerntner-linien.at/wp-content/uploads/tarifzonenplan-05-2026.pdf';
let selected={from:null,to:null};
let routeLine=null;

function esc(s){return String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function fmtEuro(v){return Number(v).toFixed(2).replace('.',',')+' €'}
function stopCode(s){const m=String(s?.name||'').match(/^([A-Z]{2}\d{3})\s*-/i);return m?m[1].toUpperCase():''}
function hav(a,b){const R=6371,p=Math.PI/180,dLat=(b.lat-a.lat)*p,dLon=(b.lon-a.lon)*p;const x=Math.sin(dLat/2)**2+Math.cos(a.lat*p)*Math.cos(b.lat*p)*Math.sin(dLon/2)**2;return 2*R*Math.asin(Math.sqrt(x))}

/*
  Tarifzonen sind bewusst NICHT an den Straßenrouter gekoppelt.
  Die vorhandene Zonenbasis aus rufzu-daten.js bleibt die einzige Datenquelle.
  Bekannte Kontrollfälle werden zuerst verwendet. Für andere Haltestellen wird
  die Zone über feste Zonen-Anker bestimmt und anschließend über das hinterlegte
  Zonennetz gezählt. Die Straßenroute dient ausschließlich als km-/Navigationsinfo.
*/
const ZONE_ANCHORS=[
  {z:1,lat:46.77030,lon:14.36620},{z:2,lat:46.73820,lon:14.28970},
  {z:3,lat:46.79000,lon:14.20000},{z:4,lat:46.75500,lon:14.45300},
  {z:5,lat:46.80500,lon:14.28683},{z:5,lat:46.68440,lon:14.34228},
  {z:6,lat:46.83000,lon:14.43000},{z:7,lat:46.71280,lon:14.26460},
  {z:8,lat:46.80000,lon:14.08000}
];
const ZONE_GRAPH={1:[2,4,5],2:[1,3,5,7],3:[2,5,8],4:[1,5,6],5:[1,2,3,4,6,7],6:[4,5,8],7:[2,5],8:[3,6]};
const VERIFIED_ROUTES=new Map([
 ['SV104|LF061',{zones:4,sequence:[1,2,3,4]}],
 ['LF061|SV104',{zones:4,sequence:[4,3,2,1]}],
 ['SV104|GL081',{zones:2,sequence:[1,4]}],
 ['GL081|SV104',{zones:2,sequence:[4,1]}]
]);

function nearestZone(stop){
  const code=stopCode(stop),name=String(stop?.name||'').toLowerCase();
  const manual={
    SV104:1,LF061:3,GL081:4
  };
  if(manual[code])return manual[code];
  // Region-specific hints reduce errors where a zone has multiple separated map areas.
  if(/simonhöhe|st\. urban|steinberg/.test(name))return 3;
  if(/hochosterwitz|klaggenberg|cittmanach|lassendorf/.test(name))return 4;
  if(/mettersdorf|passering/.test(name))return 6;
  if(/st\. margarethen|wettelsberg|goggolai|goggoloi|präm|zammelsberg/.test(name))return 8;
  if(/zweikirchen|grossbuch|ponfeld|klagenfurt/.test(name))return 7;
  if(stop?.group==='Maria Saal')return 5;
  if(stop?.group==='Liebenfels')return 2;
  if(stop?.group==='St.Veit')return 1;
  let best=ZONE_ANCHORS[0],d=Infinity;
  for(const a of ZONE_ANCHORS){const x=hav(stop,a);if(x<d){d=x;best=a}}
  return best.z;
}
function shortestZonePath(start,end){
  if(start===end)return [start];
  const q=[[start]],seen=new Set([start]);
  while(q.length){const path=q.shift(),u=path[path.length-1];for(const v of (ZONE_GRAPH[u]||[])){if(seen.has(v))continue;const np=path.concat(v);if(v===end)return np;seen.add(v);q.push(np)}}
  return [start,end];
}
function tariffSequence(a,b){
  const key=stopCode(a)+'|'+stopCode(b);
  const verified=VERIFIED_ROUTES.get(key);if(verified)return verified.sequence.slice();
  const sa=nearestZone(a),sb=nearestZone(b);return shortestZonePath(sa,sb);
}

const colorMap={'Maria Saal':'#f1d400','St.Veit':'#e59b00','Liebenfels':'#d64b27','Frauenstein':'#2877d1','St.Georgen am Längsee':'#18a566'};
const map=L.map('map').setView([46.76,14.37],10);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);
stops.forEach((s,i)=>{const c=colorMap[s.group]||'#666';const marker=L.circleMarker([s.lat,s.lon],{radius:5,weight:1,fillOpacity:.85,color:c,fillColor:c}).addTo(map);marker.bindTooltip(s.name,{direction:'top',offset:[0,-4]});marker.on('click',()=>{if(!selected.from)pick('from',i);else if(!selected.to)pick('to',i);else pick('from',i)})});

function setupField(id){const input=document.getElementById(id),box=document.getElementById(id+'Sug');input.addEventListener('input',()=>{selected[id]=null;renderSuggestions(id)});input.addEventListener('focus',()=>renderSuggestions(id));input.addEventListener('keydown',e=>{if(e.key==='Escape')box.hidden=true})}
function renderSuggestions(id){const q=document.getElementById(id).value.trim().toLowerCase(),box=document.getElementById(id+'Sug');if(!q){box.hidden=true;return}const matches=stops.filter(s=>s.name.toLowerCase().includes(q)).slice(0,30);box.innerHTML=matches.length?matches.map(s=>`<div class="sug" data-index="${stops.indexOf(s)}"><b>${esc(s.name)}</b><span>${esc(s.group||'')}</span></div>`).join(''):'<div class="sug"><span>Keine passende Haltestelle gefunden</span></div>';box.querySelectorAll('[data-index]').forEach(el=>el.addEventListener('click',()=>pick(id,Number(el.dataset.index))));box.hidden=false}
function pick(id,i){const s=stops[i];if(!s)return;selected[id]=s;document.getElementById(id).value=s.name;document.getElementById(id+'Sug').hidden=true;map.setView([s.lat,s.lon],15)}
function clearField(id){selected[id]=null;document.getElementById(id).value='';document.getElementById(id+'Sug').hidden=true;document.getElementById(id).focus()}
function swapStops(){const a=selected.from,b=selected.to;selected.from=b;selected.to=a;document.getElementById('from').value=b?.name||'';document.getElementById('to').value=a?.name||''}

document.addEventListener('click',e=>{if(!e.target.closest('.field')){document.getElementById('fromSug').hidden=true;document.getElementById('toSug').hidden=true}});
setupField('from');setupField('to');
document.getElementById('clearFrom').addEventListener('click',()=>clearField('from'));document.getElementById('clearTo').addEventListener('click',()=>clearField('to'));document.getElementById('swapBtn').addEventListener('click',swapStops);

async function getRoute(a,b){const q=`${a.lon},${a.lat};${b.lon},${b.lat}`;const urls=[`https://router.project-osrm.org/route/v1/driving/${q}?overview=full&geometries=geojson&alternatives=false&steps=false`,`https://routing.openstreetmap.de/routed-car/route/v1/driving/${q}?overview=full&geometries=geojson&alternatives=false&steps=false`];let last='';for(const u of urls){try{const r=await fetch(u,{cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);const j=await r.json();if(!j.routes?.length)throw new Error('Keine Straßenroute gefunden');return j.routes[0]}catch(e){last=e.message}}throw new Error(last||'Routenserver nicht erreichbar')}
function fareBoxForZone(z){const n=TARIF_2026.normal[z-1],s=TARIF_2026.senior[z-1],sp=TARIF_2026.spar[z-1],f=TARIF_2026.family[z-1];if(n==null)return `<div class="warn">Für ${z} Zonen ist kein aktueller Einzelkartentarif hinterlegt.</div>`;const rows=[['Normal',n],['Senioren',s],['Sparpreis',sp],['Familien',f]];return `<div class="faregrid">${rows.map(([label,base])=>`<div class="fareitem"><b>${label}</b><div class="fareline"><span>Kärntner Linien</span><strong>${fmtEuro(base)}</strong></div><div class="fareline"><span>Ruf:Zu Komfort</span><strong>${fmtEuro(COMFORT_SURCHARGE)}</strong></div><div class="fareline total"><span>Ruf:Zu gesamt</span><strong>${fmtEuro(base+COMFORT_SURCHARGE)}</strong></div></div>`).join('')}</div><div class="muted" style="margin-top:9px">Tarifbasis: Kärntner Linien, gültig ab 01.07.2026. Ruf:Zu berechnet zusätzlich 2,00 € Komfortzuschlag. Bei gültiger Verbund-Zeitkarte fällt laut Ruf:Zu-Information nur der Komfortzuschlag an.</div>`}
function renderZones(seq,label){const chips=seq.map(z=>`<span class="zonechip">Zone ${z}</span>`).join('');document.getElementById('zoneText').innerHTML=`<b>${seq.length} Zonen</b>`;document.getElementById('zonePath').innerHTML=`<div class="routeZones">${esc(label)}</div><div class="zonechips">${chips}</div>`;document.getElementById('fareBox').innerHTML=fareBoxForZone(seq.length);document.getElementById('zoneMessage').innerHTML='<div class="good">✓ Tarifzonen werden unabhängig von Straßenkilometern berechnet. Die Straßenroute wird nur für Entfernung und Navigation verwendet.</div>'}

async function calculateTrip(){
  const a=selected.from,b=selected.to;if(!a||!b){alert('Bitte Von und Nach auswählen.');return}if(stopCode(a)===stopCode(b)){alert('Von und Nach dürfen nicht identisch sein.');return}
  document.getElementById('result').style.display='block';document.getElementById('routeText').innerHTML=`<b>Von:</b> ${esc(a.name)}<br><b>Nach:</b> ${esc(b.name)}`;
  const nav=`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(a.lat+','+a.lon)}&destination=${encodeURIComponent(b.lat+','+b.lon)}&travelmode=driving`;document.getElementById('nav').href=nav;
  // Zonen sofort berechnen – unabhängig davon, ob der Straßenrouter erreichbar ist.
  const seq=tariffSequence(a,b);renderZones(seq,`Zonenfolge: ${seq.join(' → ')}`);
  document.getElementById('distanceText').textContent='Berechne …';document.getElementById('distanceNote').textContent='Straßenroute ist nur ein Informationswert.';
  try{const route=await getRoute(a,b),km=route.distance/1000;document.getElementById('distanceText').textContent=km.toFixed(1).replace('.',',')+' km';document.getElementById('distanceNote').textContent='Nur Informationswert – bestimmt NICHT die Tarifzonen.';if(routeLine)map.removeLayer(routeLine);routeLine=L.geoJSON(route.geometry,{style:{weight:5,opacity:.8}}).addTo(map);map.fitBounds(routeLine.getBounds(),{padding:[20,20]})}
  catch(e){document.getElementById('distanceText').textContent='nicht verfügbar';document.getElementById('distanceNote').textContent='Straßenroute derzeit nicht erreichbar. Tarifzonen bleiben trotzdem angezeigt.'}
}
document.getElementById('calcBtn').addEventListener('click',calculateTrip);

async function copyTrip(){const a=selected.from,b=selected.to;if(!a||!b){alert('Bitte zuerst Von und Nach auswählen.');return}const text=`Von: ${a.name}\nNach: ${b.name}`;try{await navigator.clipboard.writeText(text);alert('Von/Nach wurde kopiert.')}catch(e){prompt('Bitte diesen Text kopieren:',text)}}
function openOfficial(){const a=selected.from,b=selected.to;const text=a&&b?`Von: ${a.name}\nNach: ${b.name}`:'';if(text)navigator.clipboard?.writeText(text).catch(()=>{});window.open(OFFICIAL_PRICE_URL,'_blank','noopener')}
// OCR
const scanBtn=document.getElementById('scanBtn'),scanInput=document.getElementById('scanInput'),ocrStatus=document.getElementById('ocrStatus');
document.getElementById('manualBtn').addEventListener('click',()=>document.getElementById('from').focus());scanBtn.addEventListener('click',()=>scanInput.click());scanInput.addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;await scanTimetable(file);scanInput.value=''})
function norm(s){return String(s||'').toUpperCase().replace(/[–—−]/g,'-').replace(/\s+/g,' ').trim()}
function findStopInText(text,codeHint){const t=norm(text);if(codeHint){const hit=stops.find(s=>stopCode(s)===codeHint);if(hit)return hit}let best=null,score=0;for(const s of stops){const n=norm(s.name);const code=stopCode(s);let sc=0;if(code&&t.includes(code))sc+=100;if(t.includes(n))sc+=80;const words=n.replace(/^[A-Z]{2}\d{3}\s*-\s*/,'').split(/[^A-ZÄÖÜ0-9]+/).filter(w=>w.length>=4);for(const w of words)if(t.includes(w))sc+=Math.min(8,w.length);if(sc>score){score=sc;best=s}}return score>=15?best:null}
function parseTimes(text){const m=norm(text).match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\s*(?:[-–—>]\s*|BIS\s+)([01]?\d|2[0-3])[:.]([0-5]\d)\b/);if(!m)return null;return [`${m[1].padStart(2,'0')}:${m[2]}`,`${m[3].padStart(2,'0')}:${m[4]}`]}
async function scanTimetable(file){if(!window.Tesseract){ocrStatus.textContent='OCR-Bibliothek konnte nicht geladen werden. Bitte händisch eingeben.';ocrStatus.className='ocrstatus warn';return}ocrStatus.textContent='📷 Foto wird gelesen …';ocrStatus.className='ocrstatus';try{const {data}=await Tesseract.recognize(file,'deu+eng',{logger:m=>{if(m.status==='recognizing text'&&m.progress)ocrStatus.textContent=`OCR liest das Foto … ${Math.round(m.progress*100)} %`}});const text=data.text||'';const times=parseTimes(text);if(times){document.getElementById('departTime').value=times[0];document.getElementById('arriveTime').value=times[1]}const codeMatches=[...norm(text).matchAll(/\b([A-Z]{2}\d{3})\b/g)].map(m=>m[1]);const from=findStopInText(text,codeMatches[0]);const to=findStopInText(text,codeMatches[1]||codeMatches[0]);if(from){selected.from=from;document.getElementById('from').value=from.name}if(to&&(!from||stopCode(to)!==stopCode(from))){selected.to=to;document.getElementById('to').value=to.name}const bm=norm(text).match(/(?:EINSTIEG|BOARDING|EINSTEIGEN)[^0-9]{0,10}(\d+)/);const am=norm(text).match(/(?:AUSSTIEG|ALIGHTING|AUSSTEIGEN)[^0-9]{0,10}(\d+)/);if(bm)document.getElementById('boardCount').value=bm[1];if(am)document.getElementById('alightCount').value=am[1];ocrStatus.textContent='✓ Foto ausgelesen. Bitte die Felder kontrollieren und danach berechnen.';ocrStatus.className='ocrstatus good'}catch(e){console.error(e);ocrStatus.textContent='OCR konnte das Foto nicht zuverlässig lesen. Bitte Felder händisch prüfen/eingeben.';ocrStatus.className='ocrstatus warn'}}
document.getElementById('officialBtn').addEventListener('click',openOfficial);

if(stops.length!==536)console.warn('Haltestellen-Datensatz: erwartet 536, gefunden',stops.length);
if(!stops.some(s=>stopCode(s)==='SV104'))console.warn('SV104 fehlt');
if(!stops.some(s=>stopCode(s)==='LF061'))console.warn('LF061 fehlt');
