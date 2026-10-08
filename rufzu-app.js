'use strict';
const OFFICIAL_PRICE_URL='https://pa2.kaerntner-linien.at/preisauskunft';
const ZONE_PLAN_URL='https://www.kaerntner-linien.at/wp-content/uploads/tarifzonenplan-05-2026.pdf';
let selected={from:null,to:null};
let routeLine=null;

function esc(s){return String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function fmtEuro(v){return Number(v).toFixed(2).replace('.',',')+' €'}
function stopCode(s){const m=String(s?.name||'').match(/^([A-Z]{2}\d{3})\s*-/i);return m?m[1].toUpperCase():''}

function getSelectedPair(){return selected.from && selected.to ? {from:selected.from,to:selected.to} : null;}

const colorMap={'Maria Saal':'#f1d400','St.Veit':'#e59b00','Liebenfels':'#d64b27','Frauenstein':'#2877d1','St.Georgen am Längsee':'#18a566'};
const map=L.map('map').setView([46.76,14.37],10);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);
stops.forEach((s,i)=>{const c=colorMap[s.group]||'#666';const marker=L.circleMarker([s.lat,s.lon],{radius:5,weight:1,fillOpacity:.85,color:c,fillColor:c}).addTo(map);marker.bindTooltip(s.name,{direction:'top',offset:[0,-4]});marker.on('click',()=>{if(!selected.from)pick('from',i);else if(!selected.to)pick('to',i);else pick('from',i)})});

function setupField(id){const input=document.getElementById(id),box=document.getElementById(id+'Sug');input.addEventListener('input',()=>{selected[id]=null;renderSuggestions(id)});input.addEventListener('focus',()=>renderSuggestions(id));input.addEventListener('keydown',e=>{if(e.key==='Escape')box.hidden=true})}
function renderSuggestions(id){const q=document.getElementById(id).value.trim().toLowerCase(),box=document.getElementById(id+'Sug');if(!q){box.hidden=true;return}const matches=stops.filter(s=>s.name.toLowerCase().includes(q)).slice(0,30);box.innerHTML=matches.length?matches.map(s=>`<div class="sug" data-index="${stops.indexOf(s)}"><b>${esc(s.name)}</b><span>${esc(s.group||'')}</span></div>`).join(''):'<div class="sug"><span>Keine passende Haltestelle gefunden</span></div>';box.querySelectorAll('[data-index]').forEach(el=>el.addEventListener('click',()=>pick(id,Number(el.dataset.index))));box.hidden=false}
function pick(id,i){const s=stops[i];if(!s)return;selected[id]=s;document.getElementById(id).value=s.name;document.getElementById(id+'Sug').hidden=true;map.setView([s.lat,s.lon],15)}
function clearField(id){selected[id]=null;document.getElementById(id).value='';document.getElementById(id+'Sug').hidden=true;document.getElementById(id).focus()}

document.addEventListener('click',e=>{if(!e.target.closest('.field')){document.getElementById('fromSug').hidden=true;document.getElementById('toSug').hidden=true}});
setupField('from');setupField('to');

const clearFromEl=document.getElementById('clearFrom');
if(clearFromEl)clearFromEl.addEventListener('click',()=>clearField('from'));
const clearToEl=document.getElementById('clearTo');
if(clearToEl)clearToEl.addEventListener('click',()=>clearField('to'));

async function getRoute(a,b){const q=`${a.lon},${a.lat};${b.lon},${b.lat}`;const urls=[`https://router.project-osrm.org/route/v1/driving/${q}?overview=full&geometries=geojson&alternatives=false&steps=false`,`https://routing.openstreetmap.de/routed-car/route/v1/driving/${q}?overview=full&geometries=geojson&alternatives=false&steps=false`];let last='';for(const u of urls){try{const r=await fetch(u,{cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);const j=await r.json();if(!j.routes?.length)throw new Error('Keine Straßenroute gefunden');return j.routes[0]}catch(e){last=e.message}}throw new Error(last||'Routenserver nicht erreichbar')}

function fareBoxForZone(z){
  const n=TARIF_2026.normal[z-1],s=TARIF_2026.senior[z-1],sp=TARIF_2026.spar[z-1],f=TARIF_2026.family[z-1];
  if(n==null)return `<div class="warn">Für ${z} Zonen ist kein aktueller Einzelkartentarif hinterlegt.</div>`;
  const rows=[['Normal',n],['Senioren',s],['Sparpreis',sp],['Familien',f]];
  return `<div class="faregrid">${rows.map(([label,base])=>`<div class="fareitem"><b>${label}</b><div class="fareline"><span>Kärntner Linien</span><strong>${fmtEuro(base)}</strong></div><div class="fareline"><span>Ruf:Zu Komfort</span><strong>${fmtEuro(COMFORT_SURCHARGE)}</strong></div><div class="fareline total"><span>Ruf:Zu gesamt</span><strong>${fmtEuro(base+COMFORT_SURCHARGE)}</strong></div></div>`).join('')}</div>
  <div class="muted" style="margin-top:9px">Tarifbasis: Kärntner Linien, gültig ab 01.07.2026. Ruf:Zu berechnet zusätzlich 2,00 € Komfortzuschlag. Bei gültiger Verbund-Zeitkarte fällt laut Ruf:Zu-Information nur der Komfortzuschlag an.</div>
  <div class="klimaticket-info"><b>🎫 Klimaticket-Vorteil:</b> Inhaber eines KlimaTickets Österreich, eines Kärnten Tickets oder einer Kärnten-Gästekarte zahlen nur den Komfortzuschlag von 2,00 €.</div>`;
}

function renderZones(seq, label, verified){
  const chips=seq.map(z=>`<span class="zonechip">${esc(String(z))}</span>`).join('');
  const names=seq.map(z=>ZONE_NAMES[z]||z).join(' → ');
  document.getElementById('zoneText').innerHTML=`<b>${seq.length} Zonen</b>`;
  document.getElementById('zonePath').innerHTML=`<div class="routeZones">${esc(label)}</div><div style="font-size:12px;margin-top:4px;opacity:.9">${esc(names)}</div><div class="zonechips">${chips}</div>`;
  document.getElementById('fareBox').innerHTML=fareBoxForZone(seq.length);
  document.getElementById('zoneMessage').innerHTML=verified
    ? '<div class="good">✓ Verifizierte Tarifstrecke. Zonen stammen aus der geprüften Zuordnung.</div>'
    : '<div class="good">✓ Tarifzonen aus der hinterlegten Zonenzuordnung (Tarifzonenplan 05/2026).</div>';
}

async function calculateTrip(){
  const pair=getSelectedPair();
  if(!pair){alert('Bitte Von und Nach auswählen.');return;}
  const a=pair.from,b=pair.to;
  if(stopCode(a)===stopCode(b)){alert('Von und Nach dürfen nicht identisch sein.');return;}
  document.getElementById('result').style.display='block';
  document.getElementById('routeText').innerHTML='<b>Von:</b> '+esc(a.name)+'<br><b>Nach:</b> '+esc(b.name);
  const nav=`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(a.lat+','+a.lon)}&destination=${encodeURIComponent(b.lat+','+b.lon)}&travelmode=driving&dir_action=navigate`;
  document.getElementById('nav').href=nav;
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
    routeLine=L.geoJSON(route.geometry,{style:{weight:5,opacity:.8,color:'#f7941e'}}).addTo(map);
    map.fitBounds(routeLine.getBounds(),{padding:[20,20]});
  }catch(e){
    document.getElementById('distanceText').textContent='nicht verfügbar';
    document.getElementById('distanceNote').textContent='Straßenroute nicht erreichbar. Zonen werden aus der Haltestellenzuordnung berechnet.';
  }
  const res=getRouteZoneSequence(a,b,routeGeom);
  if(!res||!res.sequence||!res.sequence.length){
    document.getElementById('zoneText').innerHTML='<b>nicht verfügbar</b>';
    document.getElementById('zonePath').innerHTML='<div class="warn">Für diese Kombination konnte keine Zonensequenz ermittelt werden.</div>';
    document.getElementById('fareBox').innerHTML='';
    document.getElementById('zoneMessage').innerHTML='';
    return;
  }
  renderZones(res.sequence, res.verified?'Verifizierte Tarifstrecke':'Tarifzonen-Zuordnung', !!res.verified);
}

document.getElementById('calcBtn').addEventListener('click',calculateTrip);

async function copyTrip(){const a=selected.from,b=selected.to;if(!a||!b){alert('Bitte zuerst Von und Nach auswählen.');return}const text=`Von: ${a.name}\nNach: ${b.name}`;try{await navigator.clipboard.writeText(text);alert('Von/Nach wurde kopiert.')}catch(e){prompt('Bitte diesen Text kopieren:',text)}}
function openOfficial(){const a=selected.from,b=selected.to;const text=a&&b?`Von: ${a.name}\nNach: ${b.name}`:'';if(text)navigator.clipboard?.writeText(text).catch(()=>{});window.open(OFFICIAL_PRICE_URL,'_blank','noopener')}

// ============ OCR: Fahrplan-Scanner + Ticket-Scanner ============
const scanBtn=document.getElementById('scanBtn'),scanInput=document.getElementById('scanInput'),ocrStatus=document.getElementById('ocrStatus');
const ticketBtn=document.getElementById('ticketScanBtn'),ticketInput=document.getElementById('ticketScanInput'),ticketStatus=document.getElementById('ticketOcrStatus'),ticketResult=document.getElementById('ticketResult');

if(scanBtn)scanBtn.addEventListener('click',()=>scanInput.click());
scanInput.addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;await scanTimetable(file);scanInput.value=''});
if(ticketBtn)ticketBtn.addEventListener('click',()=>ticketInput.click());
ticketInput.addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;await scanTicket(file);ticketInput.value=''});

function norm(s){return String(s||'').toUpperCase().replace(/[–—−]/g,'-').replace(/\s+/g,' ').trim()}
function codeDistance(a,b){a=String(a||'');b=String(b||'');const d=Array.from({length:a.length+1},()=>Array(b.length+1).fill(0));for(let i=0;i<=a.length;i++)d[i][0]=i;for(let j=0;j<=b.length;j++)d[0][j]=j;for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++)d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1));return d[a.length][b.length];}
function resolveOcrCode(raw){const r=norm(raw).replace(/[^A-Z0-9]/g,'');if(!/^[A-Z]{2}[0-9A-Z]{3}$/.test(r))return null;const candidates=stops.map(s=>stopCode(s)).filter(Boolean);let best=null,bd=99;for(const c of candidates){let x=r;if(x.length===5)x=x.slice(0,2)+x.slice(2).replace(/[OQD]/g,'0').replace(/[IL]/g,'1').replace(/S/g,'5').replace(/B/g,'8');const d=codeDistance(x,c);if(d<bd){bd=d;best=c}}return bd<=1?best:null;}
function extractOcrCodes(text){const t=norm(text);const raw=[...t.matchAll(/\b[A-Z]{2}[0-9A-Z]{3}\b/g)].map(m=>m[0]);const out=[];for(const r of raw){const c=resolveOcrCode(r);if(c&&!out.includes(c))out.push(c)}return out;}
function findStopByCode(code){return code?stops.find(s=>stopCode(s)===code)||null:null}
function nameScore(text,stop){const t=norm(text),n=norm(stop.name),code=stopCode(stop);if(code&&t.includes(code))return 1000;if(t.includes(n))return 900;const plain=n.replace(/^[A-Z]{2}\d{3}\s*-\s*/,'');if(plain.length>=5&&t.includes(plain))return 800;const words=plain.split(/[^A-ZÄÖÜ0-9]+/).filter(w=>w.length>=4);let score=0,maxWord=0;for(const w of words){if(t.includes(w)){score+=w.length;if(w.length>maxWord)maxWord=w.length}}if(maxWord<6&&score<10)return 0;return score;}
function findStopInText(text,codeHint){if(codeHint){const hit=findStopByCode(codeHint);if(hit)return hit}let best=null,score=0;for(const s of stops){const sc=nameScore(text,s);if(sc>score){score=sc;best=s}}return score>=18?best:null;}

// ---------- Fahrplan-Scanner ----------
function resizeImage(file,maxSide){return new Promise((resolve,reject)=>{const img=new Image();const url=URL.createObjectURL(file);img.onload=()=>{try{URL.revokeObjectURL(url);let{width:w,height:h}=img;if(Math.max(w,h)<=maxSide){resolve(file);return}const scale=maxSide/Math.max(w,h);w=Math.round(w*scale);h=Math.round(h*scale);const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;canvas.getContext('2d').drawImage(img,0,0,w,h);resolve(canvas)}catch(e){reject(e)}};img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Bild nicht lesbar'))};img.src=url})}
function levenshtein(a,b){if(!a.length)return b.length;if(!b.length)return a.length;const m=Array.from({length:b.length+1},()=>new Array(a.length+1).fill(0));for(let j=0;j<=a.length;j++)m[0][j]=j;for(let i=1;i<=b.length;i++){m[i][0]=i;for(let j=1;j<=a.length;j++){m[i][j]=Math.min(m[i-1][j]+1,m[i][j-1]+1,m[i-1][j-1]+(b[i-1]===a[j-1]?0:1))}}return m[b.length][a.length];}

async function scanTimetable(file){
  const rawBox=document.getElementById('ocrRaw');
  if(rawBox){rawBox.style.display='none';rawBox.innerHTML='';}
  if(!window.Tesseract){ocrStatus.innerHTML='⚠ OCR-Bibliothek nicht geladen. Internetverbindung prüfen.';ocrStatus.className='ocrstatus warn';return}
  ocrStatus.innerHTML='📷 Foto wird vorbereitet …';ocrStatus.className='ocrstatus';
  try{
    let source=file;
    try{source=await resizeImage(file,1600)}catch(e){console.warn(e)}
    ocrStatus.innerHTML='⚙ OCR-Engine lädt (kann beim 1. Mal 10–30 Sek dauern) …';
    const result=await Tesseract.recognize(source,'deu',{logger:m=>{
      if(m.status==='loading tesseract core')ocrStatus.innerHTML='⚙ OCR-Engine lädt …';
      else if(m.status==='loading language traineddata')ocrStatus.innerHTML='⚙ Sprachdaten laden …';
      else if(m.status==='initializing api')ocrStatus.innerHTML='⚙ OCR startet …';
      else if(m.status==='recognizing text')ocrStatus.innerHTML=`🔍 Text wird erkannt … ${Math.round((m.progress||0)*100)} %`;
    }});
    const text=(result.data&&result.data.text||'').trim();
    console.log('OCR-ROHTEXT:',text);
    if(rawBox){rawBox.style.display='block';rawBox.innerHTML=`<b>OCR-Text:</b><pre style="white-space:pre-wrap;font-family:monospace;font-size:11px;margin:6px 0 0;max-height:200px;overflow:auto;background:#f7f8f9;padding:8px;border-radius:8px">${esc(text)||'(leer)'}</pre>`;}
    if(!text){ocrStatus.innerHTML='⚠ Kein Text erkannt. Bitte näher, scharf, gute Beleuchtung.';ocrStatus.className='ocrstatus warn';return}
    const codes=extractOcrCodes(text);
    let from=codes[0]?findStopByCode(codes[0]):null;
    let to=codes[1]?findStopByCode(codes[1]):null;
    if(!from||!to){
      const lines=text.split(/\r?\n/).map(l=>l.trim()).filter(l=>l.length>=4);
      const hits=[];
      for(const line of lines){const hit=findStopInText(line,null);if(hit&&!hits.some(h=>stopCode(h)===stopCode(hit)))hits.push(hit)}
      if(!from&&hits[0])from=hits[0];
      if(!to&&hits[1])to=hits[1];
    }
    if(!from||!to){
      const upper=norm(text);
      const words=upper.split(/[^A-ZÄÖÜ0-9]+/).filter(w=>w.length>=5);
      const matches=[];
      for(const s of stops){
        const namePart=norm(s.name).replace(/^[A-Z]{2}\d{3}\s*-\s*/,'');
        const nameWords=namePart.split(/[^A-ZÄÖÜ0-9]+/).filter(w=>w.length>=5);
        let score=0;
        for(const nw of nameWords){for(const w of words){if(w===nw)score+=10;else if(w.includes(nw)||nw.includes(w))score+=5;else if(levenshtein(w,nw)<=2)score+=3}}
        if(score>=8)matches.push({stop:s,score});
      }
      matches.sort((a,b)=>b.score-a.score);
      if(!from&&matches[0])from=matches[0].stop;
      if(!to&&matches[1]&&stopCode(matches[1].stop)!==stopCode(from||{}))to=matches[1].stop;
    }
    let filled=0;
    if(from){selected.from=from;document.getElementById('from').value=from.name;document.getElementById('fromSug').hidden=true;filled++}
    if(to&&(!from||stopCode(to)!==stopCode(from))){selected.to=to;document.getElementById('to').value=to.name;document.getElementById('toSug').hidden=true;filled++}
    if(filled===2){ocrStatus.innerHTML=`✓ Erkannt: <b>${esc(from.name)}</b> → <b>${esc(to.name)}</b>. Berechnung startet …`;ocrStatus.className='ocrstatus good';setTimeout(()=>{try{calculateTrip()}catch(e){console.error(e)}},300)}
    else if(filled===1){const got=from?.name||to?.name;ocrStatus.innerHTML=`✓ Eine Haltestelle erkannt: <b>${esc(got)}</b>. Andere bitte händisch auswählen.`;ocrStatus.className='ocrstatus warn'}
    else{ocrStatus.innerHTML='⚠ Keine Haltestelle erkannt. Siehe OCR-Text unten.';ocrStatus.className='ocrstatus warn'}
  }catch(e){console.error('OCR-Fehler:',e);ocrStatus.innerHTML='⚠ OCR-Fehler: '+esc(e.message||'Unbekannt');ocrStatus.className='ocrstatus warn'}
}

// ---------- Ticket-Scanner ----------
function extractTicketZones(text){const t=norm(text).replace(/[^A-Z0-9 ]/g,' ');const zones=[];const knownIds=TARIFF_ZONES.map(z=>z.id);const matches=[...t.matchAll(/\b(\d{4,6})\b/g)].map(m=>m[1]);for(const m of matches){if(knownIds.includes(m)&&!zones.includes(m)){zones.push(m);continue}const fixed=m.replace(/[OQD]/g,'0').replace(/[IL]/g,'1').replace(/S/g,'5').replace(/B/g,'8');if(knownIds.includes(fixed)&&!zones.includes(fixed))zones.push(fixed)}return zones}
function extractTicketCategory(text){const t=norm(text);if(/SENIOR|SENIOREN/.test(t))return 'Senioren';if(/SPAR/.test(t))return 'Sparpreis';if(/FAMILIE|FAMILIEN|FAMILY/.test(t))return 'Familien';if(/NORMAL|ERWACHSEN|VOLL/.test(t))return 'Normal';return null}
async function scanTicket(file){
  if(!window.Tesseract){ticketStatus.style.display='block';ticketStatus.textContent='OCR-Bibliothek nicht geladen.';ticketStatus.className='ocrstatus warn';return}
  ticketStatus.style.display='block';ticketStatus.textContent='🎫 Ticket wird gelesen …';ticketStatus.className='ocrstatus';
  ticketResult.className='ticketresult';ticketResult.innerHTML='';
  try{
    const {data}=await Tesseract.recognize(file,'deu+eng',{logger:m=>{if(m.status==='recognizing text'&&m.progress)ticketStatus.textContent=`OCR liest das Ticket … ${Math.round(m.progress*100)} %`}});
    const text=data.text||'';console.log('Ticket-OCR:',text);
    const zones=extractTicketZones(text);const cat=extractTicketCategory(text);const stopCodes=extractOcrCodes(text);
    let html='';
    if(zones.length){html+=`<b>Erkannte Zone${zones.length>1?'n':''}:</b><br>`;html+=zones.map(z=>`<span class="zonetag">${esc(z)}${ZONE_NAMES[z]?' – '+esc(ZONE_NAMES[z]):''}</span>`).join(' ');html+=`<br><span class="muted">${zones.length} Zone${zones.length>1?'n':''} aus dem Ticket gelesen.</span>`}
    else if(stopCodes.length){html+=`<b>Erkannte Haltestellen:</b> ${stopCodes.map(esc).join(', ')}`;html+=`<br><span class="muted">Keine Zonennummer im Ticket gefunden – nur Haltestellencodes erkannt.</span>`}
    else{html+=`<b>Kein Ticketinhalt erkannt.</b><br><span class="muted">Bitte näher/schärfer fotografieren.</span>`;ticketResult.className='ticketresult show miss';ticketResult.innerHTML=html;ticketStatus.textContent='';return}
    if(cat)html+=`<br><b>Tarifart im Ticket:</b> ${esc(cat)}`;
    if(zones.length&&selected.from&&selected.to){const trip=getRouteZoneSequence(selected.from,selected.to,null);const tripIds=trip.sequence||[];const uncovered=tripIds.filter(z=>!zones.includes(z));if(uncovered.length===0){html+=`<br><br><b style="color:#16865a">✓ Ticket deckt die aktuell gewählte Fahrt ab.</b>`;ticketResult.className='ticketresult show match'}else{html+=`<br><br><b style="color:#8a5b00">⚠ Ticket deckt ${uncovered.length} Zone${uncovered.length>1?'n':''} der gewählten Fahrt nicht ab:</b> `;html+=uncovered.map(z=>`<span class="zonetag">${esc(z)}${ZONE_NAMES[z]?' – '+esc(ZONE_NAMES[z]):''}</span>`).join(' ');ticketResult.className='ticketresult show miss'}}else if(zones.length){html+=`<br><br><span class="muted">Wähle zuerst Von und Nach, um das Ticket mit der Fahrt zu vergleichen.</span>`;ticketResult.className='ticketresult show'}
    ticketResult.innerHTML=html;ticketStatus.textContent='✓ Ticket gelesen. Bitte prüfen.';ticketStatus.className='ocrstatus good';
  }catch(e){console.error(e);ticketStatus.textContent='Ticket konnte nicht gelesen werden.';ticketStatus.className='ocrstatus warn'}
}

document.getElementById('officialBtn').addEventListener('click',openOfficial);
document.getElementById('copyBtn').addEventListener('click',copyTrip);

if(stops.length!==536)console.warn('Haltestellen-Datensatz: erwartet 536, gefunden',stops.length);

// ============ NEU: Standort + Android Auto (nichts bestehendes kaputt) ============
let currentGpsRaw = null;
let currentLocationMarker = null;
let useGpsAs = {from: false, to: false};

function haversine(a,b){ const R=6371, toRad=x=>x*Math.PI/180; const dLat=toRad(b.lat-a.lat), dLon=toRad(b.lon-a.lon); const lat1=toRad(a.lat), lat2=toRad(b.lat); const h=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2; return 2*R*Math.asin(Math.sqrt(h)); }

function findNearestStop(pos, maxKm=2.5){
  let best=null, bestD=Infinity;
  for(const s of stops){ const d=haversine(pos,s); if(d<bestD){bestD=d; best=s;} }
  if(best && bestD<=maxKm) return {stop:best, dist:bestD};
  return null;
}

async function useLocationAs(target){
  const statusEl = document.getElementById(target==='from'?'locFromStatus':'locToStatus');
  const btn = document.getElementById(target==='from'?'locFrom':'locTo');
  if(!navigator.geolocation){ statusEl.textContent='Geolocation nicht unterstützt'; statusEl.className='locstatus show warn'; statusEl.style.display='block'; return; }
  statusEl.textContent='📡 Standort wird ermittelt...'; statusEl.className='locstatus show'; statusEl.style.display='block';
  if(btn) btn.disabled=true;
  try{
    const pos = await new Promise((res,rej)=>navigator.geolocation.getCurrentPosition(res,rej,{enableHighAccuracy:true,timeout:15000,maximumAge:0}));
    const gps = {lat: pos.coords.latitude, lon: pos.coords.longitude};
    currentGpsRaw = gps;
    if(currentLocationMarker) map.removeLayer(currentLocationMarker);
    currentLocationMarker = L.marker([gps.lat, gps.lon], {icon: L.divIcon({html:'<div style="background:#16865a;color:white;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:14px;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.3)">📍</div>', className:'', iconSize:[28,28]})}).addTo(map).bindPopup('Du bist hier').openPopup();
    map.setView([gps.lat, gps.lon], 14);

    const nearest = findNearestStop(gps, 2.5);
    if(nearest){
      selected[target] = nearest.stop;
      document.getElementById(target).value = nearest.stop.name;
      document.getElementById(target+'Sug').hidden=true;
      useGpsAs[target]=false;
      statusEl.innerHTML = `✓ Nächste Haltestelle: <b>${esc(nearest.stop.name)}</b> (${nearest.dist.toFixed(2).replace('.',',')} km) – GPS für Navigation gespeichert`;
      statusEl.className='locstatus show';
      if(target==='from'){ useGpsAs.from = true; currentGpsRaw.from = gps; }
    } else {
      const pseudo = {name: `Aktueller Standort (${gps.lat.toFixed(5)}, ${gps.lon.toFixed(5)})`, lat: gps.lat, lon: gps.lon, isGps:true, group:'GPS'};
      selected[target]=pseudo;
      document.getElementById(target).value = pseudo.name;
      useGpsAs[target]=true;
      currentGpsRaw[target]=gps;
      statusEl.innerHTML = `✓ <b>GPS als ${target==='from'?'Start':'Ziel'}</b> gesetzt`;
      statusEl.className='locstatus show';
    }
  } catch(e){
    statusEl.textContent='⚠ Standort fehlgeschlagen: '+(e.message||'Erlaubnis verweigert');
    statusEl.className='locstatus show warn';
  } finally {
    if(btn) btn.disabled=false;
  }
}

function getNavOriginDestination(){
  const a = selected.from, b = selected.to;
  if(!a||!b) return null;
  let originLat = a.lat, originLon = a.lon;
  let destLat = b.lat, destLon = b.lon;
  if(useGpsAs.from && currentGpsRaw && currentGpsRaw.from){ originLat=currentGpsRaw.from.lat; originLon=currentGpsRaw.from.lon; }
  else if(useGpsAs.from && currentGpsRaw && currentGpsRaw.lat && a.isGps){ originLat=currentGpsRaw.lat; originLon=currentGpsRaw.lon; }
  if(useGpsAs.to && currentGpsRaw && currentGpsRaw.to){ destLat=currentGpsRaw.to.lat; destLon=currentGpsRaw.to.lon; }
  return {origin:{lat:originLat,lon:originLon}, dest:{lat:destLat,lon:destLon}};
}

function startAndroidAutoNav(){
  const pair = getSelectedPair();
  if(!pair){ alert('Bitte zuerst Von und Nach auswählen (oder Standort nutzen).'); return; }
  
  // Beide Haltestellen für Android Auto
  const from = selected.from;
  const to = selected.to;
  if(!from || !to){ alert('Keine Route gewählt'); return; }

  let origin, destination, waypoints = [];
  
  // Fall 1: Standort als Von aktiv -> Route: GPS -> Haltestelle 1 -> Haltestelle 2 (alle zwei)
  if(useGpsAs.from && currentGpsRaw && (currentGpsRaw.from || currentGpsRaw.lat)){
    const gps = currentGpsRaw.from || currentGpsRaw;
    origin = `${gps.lat},${gps.lon}`;
    // Wenn Von eine echte Haltestelle ist (nicht nur GPS pseudo), dann als Zwischenstopp
    if(from && !from.isGps){
      waypoints.push(`${from.lat},${from.lon}`);
    }
    destination = `${to.lat},${to.lon}`;
  } 
  // Fall 2: Kein GPS, aber 2 fotografierte Haltestellen -> Origin = Haltestelle 1, Destination = Haltestelle 2
  // Wenn Standort separat gespeichert ist, füge ihn als Origin hinzu und beide als Waypoints/Destination
  else if(currentGpsRaw && currentGpsRaw.lat && !useGpsAs.from){
    // GPS vorhanden aber nicht als Von gewählt -> trotzdem beide Haltestellen zeigen: GPS -> Von -> Nach
    const gps = currentGpsRaw;
    origin = `${gps.lat},${gps.lon}`;
    waypoints.push(`${from.lat},${from.lon}`);
    destination = `${to.lat},${to.lon}`;
  }
  else {
    // Standard: Von -> Nach (beide Haltestellen)
    origin = `${from.lat},${from.lon}`;
    destination = `${to.lat},${to.lon}`;
    waypoints = [];
  }

  // Google Maps Directions URL mit Waypoints - wird von Android Auto voll unterstützt
  let gmapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=driving`;
  if(waypoints.length > 0){
    gmapsUrl += `&waypoints=${encodeURIComponent(waypoints.join('|'))}`;
  }

  // Für Android Auto: erst versuchen direkt zu navigieren, dann fallback mit kompletter Route
  const hasWaypoints = waypoints.length > 0;
  
  if(hasWaypoints){
    // Bei Route mit Zwischenstopp: direkt die komplette Google Maps Route öffnen - Android Auto zeigt alle Stopps
    // Hinweis für Fahrer
    const msg = `Route mit ${waypoints.length+1} Stopps:\n1. ${from ? from.name : 'Start'}\n2. ${to ? to.name : 'Ziel'}\n\nWird in Google Maps geöffnet und erscheint auf Android Auto mit allen Haltestellen.`;
    if(confirm(msg + '\n\nIn Android Auto starten?')){
      window.open(gmapsUrl, '_blank', 'noopener');
    }
  } else {
    // Ohne Zwischenstopp: klassisch Von -> Nach (beide Haltestellen)
    const intentUrl = `google.navigation:q=${to.lat},${to.lon}&mode=d`;
    try{
      window.location.href = intentUrl;
      setTimeout(()=>{ window.open(gmapsUrl, '_blank', 'noopener'); }, 800);
    }catch(e){
      window.open(gmapsUrl, '_blank', 'noopener');
    }
  }
}

document.getElementById('locFrom')?.addEventListener('click', ()=>useLocationAs('from'));
document.getElementById('locTo')?.addEventListener('click', ()=>useLocationAs('to'));
document.getElementById('androidAutoBtn')?.addEventListener('click', startAndroidAutoNav);

const originalCalculateTrip = calculateTrip;
calculateTrip = async function(){
  await originalCalculateTrip();
  const navData = getNavOriginDestination();
  if(navData){
    const navUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(navData.origin.lat+','+navData.origin.lon)}&destination=${encodeURIComponent(navData.dest.lat+','+navData.dest.lon)}&travelmode=driving&dir_action=navigate`;
    const navEl = document.getElementById('nav');
    if(navEl) navEl.href = navUrl;
    const abtn = document.getElementById('androidAutoBtn');
    if(abtn){ abtn.disabled=false; if(selected.from && selected.to){ abtn.textContent = `🚗 Beide Haltestellen in Android Auto: ${esc(selected.from.name.split(' - ').pop() || selected.from.name)} → ${esc(selected.to.name.split(' - ').pop() || selected.to.name)}`; } }
  }
};

const originalScanTimetable = scanTimetable;
scanTimetable = async function(file){
  await originalScanTimetable(file);
  if(selected.from && selected.to){
    const btn = document.getElementById('androidAutoBtn');
    if(btn){ btn.style.boxShadow='0 0 0 4px rgba(15,157,88,.25), 0 8px 20px rgba(15,157,88,.35)'; btn.textContent='🚗 2 Adressen erkannt – In Android Auto navigieren'; }
  }
};
