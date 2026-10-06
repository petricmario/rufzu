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


function normalizeText(s){return String(s||'').toUpperCase().replace(/Ä/g,'AE').replace(/Ö/g,'OE').replace(/Ü/g,'UE').replace(/ß/g,'SS').replace(/[^A-Z0-9]/g,'');}
function findStopFromOCR(text){
 const upper=String(text||'').toUpperCase();
 const codes=[...upper.matchAll(/\b([A-Z]{2}\s*\d{3})\b/g)].map(m=>m[1].replace(/\s+/g,''));
 for(const code of codes){const hit=stops.find(s=>stopCode(s)===code);if(hit)return hit;}
 const norm=normalizeText(upper);
 let best=null,bestScore=0;
 for(const st of stops){
   const name=normalizeText(st.name.replace(/^[A-Z]{2}\d{3}\s*-?\s*/i,''));
   if(name.length<5)continue;
   const tokens=name.match(/[A-Z0-9]{4,}/g)||[];
   const score=tokens.reduce((n,t)=>n+(norm.includes(t)?t.length:0),0);
   if(score>bestScore){bestScore=score;best=st;}
 }
 return bestScore>=6?best:null;
}
function findTimes(text){return [...String(text||'').matchAll(/\b([01]?\d|2[0-3])\s*[:.]\s*([0-5]\d)\b/g)].map(m=>`${String(m[1]).padStart(2,'0')}:${m[2]}`);}
function findPassengerNumbers(text){
 const t=String(text||'');
 const up=t.toUpperCase();
 const nums=[...t.matchAll(/\b(\d{1,2})\b/g)].map(m=>Number(m[1])).filter(n=>n<=99);
 let board=null,alight=null;
 const bm=up.match(/(?:EINSTEIG|EINSTIEG|ZUSTIEG|ABHOL|↑)\D{0,8}(\d{1,2})/i); if(bm)board=Number(bm[1]);
 const am=up.match(/(?:AUSSTEIG|AUSSTIEG|ABGANG|↓)\D{0,8}(\d{1,2})/i); if(am)alight=Number(am[1]);
 if(board===null&&nums.length>=2)board=nums[0];
 if(alight===null&&nums.length>=2)alight=nums[1];
 return {board,alight};
}
async function scanScheduleImage(file){
 const status=document.getElementById('ocrStatus');
 status.className='ocrstatus';status.textContent='⏳ Foto wird gelesen …';
 try{
   if(!window.Tesseract)throw new Error('OCR-Modul konnte nicht geladen werden.');
   const result=await Tesseract.recognize(file,'deu+eng',{logger:m=>{if(m.status==='recognizing text'&&m.progress)status.textContent=`⏳ Text wird erkannt … ${Math.round(m.progress*100)} %`;}});
   const text=result?.data?.text||'';
   const from=findStopFromOCR(text);
   // Für die zweite Haltestelle versuchen wir zunächst Codes/Zeilen nach dem ersten Treffer.
   const codes=[...text.toUpperCase().matchAll(/\b([A-Z]{2}\s*\d{3})\b/g)].map(m=>m[1].replace(/\s+/g,''));
   const unique=[];for(const c of codes){if(!unique.includes(c))unique.push(c)}
   let to=null;
   if(unique.length>1)to=stops.find(st=>stopCode(st)===unique[1])||null;
   if(!to){
     const lines=text.split(/\n+/).map(x=>x.trim()).filter(Boolean);
     const candidates=lines.map(findStopFromOCR).filter(Boolean);
     for(const c of candidates){if(!from||c.id!==from.id){to=c;break;}}
   }
   if(from)pick('from',stops.indexOf(from));
   if(to)pick('to',stops.indexOf(to));
   const times=findTimes(text);if(times[0])document.getElementById('departTime').value=times[0];if(times[1])document.getElementById('arriveTime').value=times[1];
   const pc=findPassengerNumbers(text);if(pc.board!==null)document.getElementById('boardCount').value=pc.board;if(pc.alight!==null)document.getElementById('alightCount').value=pc.alight;
   const found=[];if(from)found.push('Von');if(to)found.push('Nach');if(times.length)found.push('Zeiten');if(pc.board!==null||pc.alight!==null)found.push('Ein-/Ausstieg');
   if(found.length){status.className='ocrstatus good';status.textContent='✓ Erkannt: '+found.join(', ')+'. Bitte kurz kontrollieren und danach berechnen.';}else{status.className='ocrstatus warn';status.textContent='Keine verwertbaren Fahrplandaten erkannt. Bitte manuell eingeben.';}
 }catch(e){status.className='ocrstatus warn';status.textContent='Foto konnte nicht automatisch gelesen werden. Bitte Daten manuell eingeben.';}
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
