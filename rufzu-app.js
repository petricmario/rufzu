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
function nearestTariffId(stop){
  if(!stop)return null;
  let best=null,bd=Infinity;
  for(const z of TARIFF_ZONES){const d=hav(stop,z);if(d<bd){bd=d;best=z}}
  return best?.id||null;
}
function tariffSequence(a,b){
  const key=stopCode(a)+'|'+stopCode(b);
  const verified=VERIFIED_ROUTES?.get?.(key);
  if(verified)return verified.sequence.slice();
  const sa=nearestTariffId(a),sb=nearestTariffId(b);
  if(!sa||!sb)return [];
  if(sa===sb)return [sa];
  // For non-verified pairs we deliberately do NOT use the street router.
  // The endpoint tariff zones are shown as a tariff-data result; no km value
  // is used to calculate the tariff.
  return [sa,sb];
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
  const seq=tariffSequence(a,b);if(!seq.length){document.getElementById('zoneText').innerHTML='<b>nicht verfügbar</b>';document.getElementById('zonePath').innerHTML='<div class="warn">Für diese Kombination ist noch keine Tarifzonen-Zuordnung hinterlegt.</div>';document.getElementById('fareBox').innerHTML='';}else{renderZones(seq,`Tarifzonenfolge: ${seq.join(' → ')}`);}
  document.getElementById('distanceText').textContent='Berechne …';document.getElementById('distanceNote').textContent='Straßenroute ist nur ein Informationswert.';
  try{const route=await getRoute(a,b),km=route.distance/1000;document.getElementById('distanceText').textContent=km.toFixed(1).replace('.',',')+' km';document.getElementById('distanceNote').textContent='Nur Informationswert – bestimmt NICHT die Tarifzonen.';if(routeLine)map.removeLayer(routeLine);routeLine=L.geoJSON(route.geometry,{style:{weight:5,opacity:.8}}).addTo(map);map.fitBounds(routeLine.getBounds(),{padding:[20,20]})}
  catch(e){document.getElementById('distanceText').textContent='nicht verfügbar';document.getElementById('distanceNote').textContent='Straßenroute derzeit nicht erreichbar. Tarifzonen bleiben trotzdem angezeigt.'}
}
document.getElementById('calcBtn').addEventListener('click',calculateTrip);

async function copyTrip(){const a=selected.from,b=selected.to;if(!a||!b){alert('Bitte zuerst Von und Nach auswählen.');return}const text=`Von: ${a.name}\nNach: ${b.name}`;try{await navigator.clipboard.writeText(text);alert('Von/Nach wurde kopiert.')}catch(e){prompt('Bitte diesen Text kopieren:',text)}}
function openOfficial(){const a=selected.from,b=selected.to;const text=a&&b?`Von: ${a.name}\nNach: ${b.name}`:'';if(text)navigator.clipboard?.writeText(text).catch(()=>{});window.open(OFFICIAL_PRICE_URL,'_blank','noopener')}
// OCR: Das Foto wird nur für Von/Nach verwendet. Abfahrt, Ankunft,
// Einstieg und Ausstieg sind bewusst nicht Bestandteil der Eingabe.
const scanBtn=document.getElementById('scanBtn'),scanInput=document.getElementById('scanInput'),ocrStatus=document.getElementById('ocrStatus');
document.getElementById('manualBtn').addEventListener('click',()=>document.getElementById('from').focus());
scanBtn.addEventListener('click',()=>scanInput.click());
scanInput.addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;await scanTimetable(file);scanInput.value=''})
function norm(s){return String(s||'').toUpperCase().replace(/[–—−]/g,'-').replace(/[|]/g,'I').replace(/\s+/g,' ').trim()}
function codeFromOcr(raw){
  const m=String(raw||'').toUpperCase().replace(/[^A-Z0-9]/g,'').match(/^([A-Z]{2})([0-9I]{3})$/);
  if(!m)return '';
  return (m[1]+m[2].replace(/I/g,'1')).toUpperCase();
}
function findStopByCodeLoose(code){
  const c=codeFromOcr(code); if(!c)return null;
  return stops.find(s=>stopCode(s)===c)||null;
}
function extractStopCodes(text){
  const t=norm(text).replace(/\b([A-Z]{2})\s*[-.]?\s*([0-9I]{3})\b/g,'$1$2');
  const out=[];
  const re=/\b([A-Z]{2})([0-9I]{3})\b/g;
  let m;
  while((m=re.exec(t))){
    const code=codeFromOcr(m[1]+m[2]);
    if(code && !out.includes(code) && findStopByCodeLoose(code))out.push(code);
  }
  return out;
}
function findStopInText(text,codeHint){
  const hinted=findStopByCodeLoose(codeHint); if(hinted)return hinted;
  const t=norm(text);
  let best=null,score=0;
  for(const s of stops){
    const n=norm(s.name),code=stopCode(s);
    let sc=0;
    if(code&&t.includes(code))sc+=120;
    if(t.includes(n))sc+=100;
    const name=n.replace(/^[A-Z]{2}\d{3}\s*-\s*/,'');
    const words=name.split(/[^A-ZÄÖÜ0-9]+/).filter(w=>w.length>=4);
    for(const w of words)if(t.includes(w))sc+=Math.min(12,w.length);
    if(sc>score){score=sc;best=s}
  }
  return score>=18?best:null;
}
function preprocessImage(file){
  return new Promise((resolve,reject)=>{
    const img=new Image(),url=URL.createObjectURL(file);
    img.onload=()=>{
      const scale=Math.min(2.2,Math.max(1,1800/Math.max(img.width,img.height)));
      const canvas=document.createElement('canvas');
      canvas.width=Math.round(img.width*scale); canvas.height=Math.round(img.height*scale);
      const ctx=canvas.getContext('2d',{willReadFrequently:true});
      ctx.drawImage(img,0,0,canvas.width,canvas.height);
      const data=ctx.getImageData(0,0,canvas.width,canvas.height);
      for(let i=0;i<data.data.length;i+=4){
        const g=Math.round(data.data[i]*0.299+data.data[i+1]*0.587+data.data[i+2]*0.114);
        const v=g>185?255:g<90?0:g;
        data.data[i]=data.data[i+1]=data.data[i+2]=v;
      }
      ctx.putImageData(data,0,0); URL.revokeObjectURL(url);
      canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Bild konnte nicht vorbereitet werden')),'image/jpeg',0.92);
    };
    img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Bild konnte nicht geladen werden'))};
    img.src=url;
  });
}
async function scanTimetable(file){
  if(!window.Tesseract){ocrStatus.textContent='OCR-Bibliothek konnte nicht geladen werden. Bitte Von und Nach händisch eingeben.';ocrStatus.className='ocrstatus warn';return}
  ocrStatus.textContent='📷 Foto wird gelesen …';ocrStatus.className='ocrstatus';
  try{
    const image=await preprocessImage(file);
    const {data}=await Tesseract.recognize(image,'deu+eng',{logger:m=>{if(m.status==='recognizing text'&&m.progress)ocrStatus.textContent=`OCR liest das Foto … ${Math.round(m.progress*100)} %`}});
    const text=data.text||'';
    const codes=extractStopCodes(text);
    let from=findStopInText(text,codes[0]);
    let to=findStopInText(text,codes[1]);
    if(from&&to&&stopCode(from)===stopCode(to))to=null;
    if(!to){
      // Zweiter Versuch: Suche nach einem zweiten bekannten Haltestellencode im gesamten OCR-Text.
      const restCodes=codes.filter(c=>!from||c!==stopCode(from));
      to=restCodes.length?findStopByCodeLoose(restCodes[0]):null;
    }
    if(from){selected.from=from;document.getElementById('from').value=from.name;document.getElementById('fromSug').hidden=true}
    if(to){selected.to=to;document.getElementById('to').value=to.name;document.getElementById('toSug').hidden=true}
    if(from&&to){
      ocrStatus.textContent=`✓ Erkannt: Von ${from.name} → Nach ${to.name}. Bitte kurz kontrollieren und danach berechnen.`;
      ocrStatus.className='ocrstatus good';
    }else if(from||to){
      ocrStatus.textContent=`⚠ ${from?'Start erkannt: '+from.name+'. ':''}${to?'Ziel erkannt: '+to.name+'. ':''}Der zweite Punkt konnte nicht sicher erkannt werden – bitte ergänzen.`;
      ocrStatus.className='ocrstatus warn';
    }else{
      ocrStatus.textContent='⚠ Keine Haltestellen sicher erkannt. Bitte das Foto erneut, möglichst gerade und gut lesbar, aufnehmen oder Von/Nach händisch eingeben.';
      ocrStatus.className='ocrstatus warn';
    }
  }catch(e){
    console.error(e);
    ocrStatus.textContent='OCR konnte das Foto nicht zuverlässig lesen. Bitte Von und Nach händisch eingeben.';
    ocrStatus.className='ocrstatus warn';
  }
}
document.getElementById('officialBtn').addEventListener('click',openOfficial);

if(stops.length!==536)console.warn('Haltestellen-Datensatz: erwartet 536, gefunden',stops.length);
if(!stops.some(s=>stopCode(s)==='SV104'))console.warn('SV104 fehlt');
if(!stops.some(s=>stopCode(s)==='LF061'))console.warn('LF061 fehlt');
