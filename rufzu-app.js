'use strict';

const OFFICIAL_PRICE_URL='https://pa2.kaerntner-linien.at/preisauskunft';
const ZONE_PLAN_URL='https://www.kaerntner-linien.at/wp-content/uploads/tarifzonenplan-05-2026.pdf';
let selected={from:null,to:null};
let routeLine=null;

function esc(s){return String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function fmtEuro(v){return Number(v).toFixed(2).replace('.',',')+' €'}
function stopCode(s){const m=String(s?.name||'').match(/^([A-Z]{2}\d{3})\s*-/i);return m?m[1].toUpperCase():''}
function hav(a,b){const R=6371,p=Math.PI/180,dLat=(b.lat-a.lat)*p,dLon=(b.lon-a.lon)*p;const x=Math.sin(dLat/2)**2+Math.cos(a.lat*p)*Math.cos(b.lat*p)*Math.sin(dLon/2)**2;return 2*R*Math.asin(Math.sqrt(x))}

function getSelectedPair(){
  return selected.from && selected.to ? {from:selected.from,to:selected.to} : null;
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
function renderZones(seq,label){
  const chips=seq.map(z=>`<span class="zonechip">${esc(String(z))}</span>`).join('');
  document.getElementById('zoneText').innerHTML=`<b>${seq.length} Zonen</b>`;
  document.getElementById('zonePath').innerHTML=`<div class="routeZones">${esc(label)}</div><div class="zonechips">${chips}</div>`;
  document.getElementById('fareBox').innerHTML=fareBoxForZone(seq.length);
  document.getElementById('zoneMessage').innerHTML='<div class="good">✓ Tarifzonen stammen aus der hinterlegten Tarifzonenbasis. Die Straßenroute wird nur für Entfernung und Navigation verwendet.</div>';
}


async function calculateTrip(){
  const pair=getSelectedPair();
  if(!pair){alert('Bitte Von und Nach auswählen.');return;}
  const a=pair.from,b=pair.to;
  if(stopCode(a)===stopCode(b)){alert('Von und Nach dürfen nicht identisch sein.');return;}

  document.getElementById('result').style.display='block';
  document.getElementById('routeText').innerHTML='<b>Von:</b> '+esc(a.name)+'<br><b>Nach:</b> '+esc(b.name);

  const dt=document.getElementById('departTime')?.value, at=document.getElementById('arriveTime')?.value;
  if(dt||at) document.getElementById('routeText').innerHTML += `<br><b>Fahrt:</b> ${esc(dt||'–')} → ${esc(at||'–')}`;

  const nav=`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(a.lat+','+a.lon)}&destination=${encodeURIComponent(b.lat+','+b.lon)}&travelmode=driving&dir_action=navigate`;
  document.getElementById('nav').href=nav;

  // Erst Straßenroute abrufen, damit ihre Geometrie für die Zonenermittlung genutzt werden kann.
  document.getElementById('distanceText').textContent='Berechne …';
  document.getElementById('distanceNote').textContent='Straßenroute wird ermittelt …';

  let routeGeom=null;
  try{
    const route=await getRoute(a,b);
    const km=route.distance/1000;
    routeGeom=route.geometry;
    document.getElementById('distanceText').textContent=km.toFixed(1).replace('.',',')+' km';
    document.getElementById('distanceNote').textContent='Nur Informationswert für die Straßenstrecke.';
    if(routeLine)map.removeLayer(routeLine);
    routeLine=L.geoJSON(route.geometry,{style:{weight:5,opacity:.8}}).addTo(map);
    map.fitBounds(routeLine.getBounds(),{padding:[20,20]});
  }catch(e){
    document.getElementById('distanceText').textContent='nicht verfügbar';
    document.getElementById('distanceNote').textContent='Straßenroute nicht erreichbar. Zonen werden direkt anhand der Standortkoordinaten berechnet.';
  }

  // Zonenberechnung: verifizierte Strecke ODER dynamisch aus der PDF-basierten Zonendatenbasis.
  const key=stopCode(a)+'|'+stopCode(b);
  const isVerified=VERIFIED_ROUTES.has(key);
  const res=getRouteZoneSequence(a,b,routeGeom);

  if(!res || !res.sequence || !res.sequence.length){
    document.getElementById('zoneText').innerHTML='<b>nicht verfügbar</b>';
    document.getElementById('zonePath').innerHTML='<div class="warn">Für diese Kombination konnte anhand der hinterlegten Tarifzonenbasis keine Zonensequenz ermittelt werden.</div>';
    document.getElementById('fareBox').innerHTML='';
    document.getElementById('zoneMessage').innerHTML='';
    return;
  }

  renderZones(res.sequence,isVerified?'Verifizierte Tarifstrecke':'Automatische Zonenermittlung');
}

document.getElementById('calcBtn').addEventListener('click',calculateTrip);

async function copyTrip(){const a=selected.from,b=selected.to;if(!a||!b){alert('Bitte zuerst Von und Nach auswählen.');return}const text=`Von: ${a.name}\nNach: ${b.name}`;try{await navigator.clipboard.writeText(text);alert('Von/Nach wurde kopiert.')}catch(e){prompt('Bitte diesen Text kopieren:',text)}}
function openOfficial(){const a=selected.from,b=selected.to;const text=a&&b?`Von: ${a.name}\nNach: ${b.name}`:'';if(text)navigator.clipboard?.writeText(text).catch(()=>{});window.open(OFFICIAL_PRICE_URL,'_blank','noopener')}
// OCR
const scanBtn=document.getElementById('scanBtn'),scanInput=document.getElementById('scanInput'),ocrStatus=document.getElementById('ocrStatus');
document.getElementById('manualBtn').addEventListener('click',()=>document.getElementById('from').focus());scanBtn.addEventListener('click',()=>scanInput.click());scanInput.addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;await scanTimetable(file);scanInput.value=''})
function norm(s){return String(s||'').toUpperCase().replace(/[–—−]/g,'-').replace(/\s+/g,' ').trim()}
function codeDistance(a,b){
  a=String(a||'');b=String(b||'');
  const d=Array.from({length:a.length+1},()=>Array(b.length+1).fill(0));
  for(let i=0;i<=a.length;i++)d[i][0]=i;
  for(let j=0;j<=b.length;j++)d[0][j]=j;
  for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++)d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1));
  return d[a.length][b.length];
}
function resolveOcrCode(raw){
  const r=norm(raw).replace(/[^A-Z0-9]/g,'');
  if(!/^[A-Z]{2}[0-9A-Z]{3}$/.test(r))return null;
  const candidates=stops.map(s=>stopCode(s)).filter(Boolean);
  let best=null,bd=99;
  for(const c of candidates){
    let x=r;
    // Typical OCR confusions in the three-digit part of a stop code.
    if(x.length===5)x=x.slice(0,2)+x.slice(2).replace(/[OQD]/g,'0').replace(/[IL]/g,'1').replace(/S/g,'5').replace(/B/g,'8');
    const d=codeDistance(x,c);
    if(d<bd){bd=d;best=c}
  }
  return bd<=1?best:null;
}
function extractOcrCodes(text){
  const t=norm(text);
  const raw=[...t.matchAll(/\b[A-Z]{2}[0-9A-Z]{3}\b/g)].map(m=>m[0]);
  const out=[];
  for(const r of raw){const c=resolveOcrCode(r);if(c&&!out.includes(c))out.push(c)}
  return out;
}
function findStopByCode(code){return code?stops.find(s=>stopCode(s)===code)||null:null}
function nameScore(text,stop){
  const t=norm(text), n=norm(stop.name), code=stopCode(stop);
  if(code&&t.includes(code))return 1000;
  if(t.includes(n))return 900;
  const plain=n.replace(/^[A-Z]{2}\d{3}\s*-\s*/,'');
  const words=plain.split(/[^A-ZÄÖÜ0-9]+/).filter(w=>w.length>=4);
  let score=0;
  for(const w of words)if(t.includes(w))score+=Math.min(20,w.length*2);
  return score;
}
function findStopInText(text,codeHint){
  if(codeHint){const hit=findStopByCode(codeHint);if(hit)return hit}
  let best=null,score=0;
  for(const s of stops){const sc=nameScore(text,s);if(sc>score){score=sc;best=s}}
  return score>=18?best:null;
}
async function scanTimetable(file){
  if(!window.Tesseract){ocrStatus.textContent='OCR-Bibliothek konnte nicht geladen werden. Bitte händisch eingeben.';ocrStatus.className='ocrstatus warn';return}
  ocrStatus.textContent='📷 Foto wird gelesen …';
  ocrStatus.className='ocrstatus';
  try{
    const {data}=await Tesseract.recognize(file,'deu+eng',{
      logger:m=>{if(m.status==='recognizing text'&&m.progress)ocrStatus.textContent=`OCR liest das Foto … ${Math.round(m.progress*100)} %`}
    });
    const text=data.text||'';
    console.log('Ruf:Zu OCR-Text:',text);

    // Nur die beiden benötigten Felder werden aus dem Foto übernommen.
    // Abfahrt/Ankunft sowie Einstieg/Ausstieg gehören bewusst NICHT mehr zur Eingabe.
    const codes=extractOcrCodes(text);
    let from=findStopInText(text,codes[0]);
    let to=findStopInText(text,codes[1]);

    // Wenn nur ein Code erkannt wurde, versuche Start/Ziel über die Zeilen des Fotos.
    if(!from||!to){
      const lines=text.split(/\r?\n/).map(norm).filter(Boolean);
      const lineHits=[];
      for(const line of lines){
        const hit=findStopInText(line);
        if(hit&&!lineHits.some(s=>stopCode(s)===stopCode(hit)))lineHits.push(hit);
      }
      if(!from&&lineHits[0])from=lineHits[0];
      if(!to&&lineHits[1])to=lineHits[1];
    }

    let filled=0;
    if(from){selected.from=from;document.getElementById('from').value=from.name;document.getElementById('fromSug').hidden=true;filled++}
    if(to&&(!from||stopCode(to)!==stopCode(from))){selected.to=to;document.getElementById('to').value=to.name;document.getElementById('toSug').hidden=true;filled++}

    if(filled===2){
      ocrStatus.textContent=`✓ Erkannt: ${from.name} → ${to.name}. Bitte kontrollieren und danach berechnen.`;
      ocrStatus.className='ocrstatus good';
    }else if(filled===1){
      ocrStatus.textContent=`✓ Ein Feld wurde erkannt (${from?.name||to?.name}). Das andere bitte kurz händisch auswählen.`;
      ocrStatus.className='ocrstatus warn';
    }else{
      ocrStatus.textContent='Das Foto wurde gelesen, aber Von/Nach konnten nicht sicher erkannt werden. Bitte das Foto näher und scharf aufnehmen oder händisch auswählen.';
      ocrStatus.className='ocrstatus warn';
    }
  }catch(e){
    console.error(e);
    ocrStatus.textContent='OCR konnte das Foto nicht lesen. Bitte Felder händisch eingeben.';
    ocrStatus.className='ocrstatus warn';
  }
}
document.getElementById('officialBtn').addEventListener('click',openOfficial);

if(stops.length!==536)console.warn('Haltestellen-Datensatz: erwartet 536, gefunden',stops.length);
if(!stops.some(s=>stopCode(s)==='SV104'))console.warn('SV104 fehlt');
if(!stops.some(s=>stopCode(s)==='LF061'))console.warn('LF061 fehlt');
