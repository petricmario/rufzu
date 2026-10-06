'use strict';
const OFFICIAL_PRICE_URL='https://pa2.kaerntner-linien.at/preisauskunft';
const ZONE_PLAN_URL='https://www.kaerntner-linien.at/wp-content/uploads/tarifzonenplan-05-2026.pdf';
let selected={from:null,to:null};
let routeLine=null;

function esc(s){return String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function fmtEuro(v){return Number(v).toFixed(2).replace('.',',')+' €'}
function stopCode(s){const m=String(s?.name||'').match(/^([A-Z]{2}\d{3})\s*-/i);return m?m[1].toUpperCase():''}
function hav(a,b){const R=6371,p=Math.PI/180,dLat=(b.lat-a.lat)*p,dLon=(b.lon-a.lon)*p;const x=Math.sin(dLat/2)**2+Math.cos(a.lat*p)*Math.cos(b.lat*p)*Math.sin(dLon/2)**2;return 2*R*Math.asin(Math.sqrt(x))}

function getSelectedPair(){return selected.from && selected.to ? {from:selected.from,to:selected.to} : null;}

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

const clearFromEl = document.getElementById('clearFrom');
if (clearFromEl) clearFromEl.addEventListener('click', () => clearField('from'));
const clearToEl = document.getElementById('clearTo');
if (clearToEl) clearToEl.addEventListener('click', () => clearField('to'));

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
  const chips = seq.map(z => `<span class="zonechip">${esc(String(z))}</span>`).join('');
  document.getElementById('zoneText').innerHTML = `<b>${seq.length} Zonen</b>`;
  document.getElementById('zonePath').innerHTML = `<div class="routeZones">${esc(label)}</div><div class="zonechips">${chips}</div>`;
  document.getElementById('fareBox').innerHTML = fareBoxForZone(seq.length);
  document.getElementById('zoneMessage').innerHTML = verified
    ? '<div class="good">✓ Verifizierte Tarifstrecke. Zonen stammen aus der geprüften Zuordnung.</div>'
    : '<div class="warn">⚠ Automatische Zonenzuordnung anhand der hinterlegten Zonenanker. Bis die vollständige Tarifzonenbasis eingespielt ist, ist dieser Wert eine Näherung. Für den verbindlichen Preis bitte die offizielle Preisauskunft verwenden.</div>';
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
    document.getElementById('distanceNote').textContent='Straßenroute nicht erreichbar. Zonen werden direkt anhand der Standortkoordinaten berechnet.';
  }
  const res=getRouteZoneSequence(a,b,routeGeom);
  if(!res || !res.sequence || !res.sequence.length){
    document.getElementById('zoneText').innerHTML='<b>nicht verfügbar</b>';
    document.getElementById('zonePath').innerHTML='<div class="warn">Für diese Kombination konnte anhand der hinterlegten Tarifzonenbasis keine Zonensequenz ermittelt werden.</div>';
    document.getElementById('fareBox').innerHTML='';
    document.getElementById('zoneMessage').innerHTML='';
    return;
  }
  renderZones(res.sequence, res.verified ? 'Verifizierte Tarifstrecke' : 'Automatische Zuordnung (Näherung, ungeprüft)', !!res.verified);
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
function preprocessImage(file,maxSide=1800){return new Promise((resolve,reject)=>{const img=new Image();const url=URL.createObjectURL(file);img.onload=()=>{URL.revokeObjectURL(url);let{width:w,height:h}=img;const scale=Math.min(1,maxSide/Math.max(w,h));w=Math.round(w*scale);h=Math.round(h*scale);const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,w,h);const imgData=ctx.getImageData(0,0,w,h);const d=imgData.data;for(let i=0;i<d.length;i+=4){let g=0.299*d[i]+0.587*d[i+1]+0.114*d[i+2];g=(g-128)*1.6+128;g=g<0?0:g>255?255:g;d[i]=d[i+1]=d[i+2]=g}ctx.putImageData(imgData,0,0);resolve(canvas)};img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Bild konnte nicht geladen werden'))};img.src=url})}

async function scanTimetable(file){
  if(!window.Tesseract){ocrStatus.textContent='OCR-Bibliothek konnte nicht geladen werden. Bitte händisch eingeben.';ocrStatus.className='ocrstatus warn';return}
  ocrStatus.textContent='📷 Foto wird vorbereitet …';ocrStatus.className='ocrstatus';
  try{
    const canvas=await preprocessImage(file,1800);
    ocrStatus.textContent='OCR liest das Foto …';
    const {data}=await Tesseract.recognize(canvas,'deu+eng',{logger:m=>{if(m.status==='recognizing text'&&m.progress)ocrStatus.textContent=`OCR liest das Foto … ${Math.round(m.progress*100)} %`}});
    const text=data.text||'';console.log('Ruf:Zu Fahrplan-OCR:',text);
    const codes=extractOcrCodes(text);let from=findStopInText(text,codes[0]);let to=findStopInText(text,codes[1]);
    if(!from||!to){const lines=text.split(/\r?\n/).map(norm).filter(Boolean);const lineHits=[];for(const line of lines){const hit=findStopInText(line);if(hit&&!lineHits.some(s=>stopCode(s)===stopCode(hit)))lineHits.push(hit)}if(!from&&lineHits[0])from=lineHits[0];if(!to&&lineHits[1])to=lineHits[1]}
    if(!from||!to){const words=norm(text).split(/[^A-ZÄÖÜ0-9]+/).filter(w=>w.length>=4);const scored=[];for(const s of stops){const n=norm(s.name).replace(/^[A-Z]{2}\d{3}\s*-\s*/,'');const nameWords=n.split(/[^A-ZÄÖÜ0-9]+/).filter(w=>w.length>=4);let hitCount=0;for(const w of nameWords)if(words.includes(w))hitCount++;if(hitCount>=1)scored.push({stop:s,score:hitCount})}scored.sort((a,b)=>b.score-a.score);if(!from&&scored[0])from=scored[0].stop;if(!to&&scored[0]&&scored[1]&&stopCode(scored[1].stop)!==stopCode(from||{}))to=scored[1].stop}
    let filled=0;if(from){selected.from=from;document.getElementById('from').value=from.name;document.getElementById('fromSug').hidden=true;filled++}if(to&&(!from||stopCode(to)!==stopCode(from))){selected.to=to;document.getElementById('to').value=to.name;document.getElementById('toSug').hidden=true;filled++}
    const preview=esc(text.trim().slice(0,300))||'(leer)';
    if(filled===2){ocrStatus.innerHTML=`✓ Erkannt: <b>${esc(from.name)}</b> → <b>${esc(to.name)}</b>. Berechnung startet …`;ocrStatus.className='ocrstatus good';setTimeout(()=>{try{calculateTrip()}catch(err){console.error(err)}},250)}
    else if(filled===1){const got=from?.name||to?.name;ocrStatus.innerHTML=`✓ Ein Feld erkannt (<b>${esc(got)}</b>). Das andere bitte händisch auswählen.<br><small style="color:#8a5b00">Gelesen: ${preview}</small>`;ocrStatus.className='ocrstatus warn'}
    else{ocrStatus.innerHTML=`Foto gelesen, aber Von/Nach nicht sicher erkannt. Bitte näher/schärfer fotografieren.<br><small style="color:#8a5b00">Gelesen: ${preview}</small>`;ocrStatus.className='ocrstatus warn'}
  }catch(e){console.error(e);ocrStatus.textContent='OCR konnte das Foto nicht lesen. Bitte Felder händisch eingeben.';ocrStatus.className='ocrstatus warn'}
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
    const text=data.text||'';console.log('Ruf:Zu Ticket-OCR:',text);
    const zones=extractTicketZones(text);const cat=extractTicketCategory(text);const stopCodes=extractOcrCodes(text);
    let html='';
    if(zones.length){html+=`<b>Erkannte Zone${zones.length>1?'n':''}:</b><br>`;html+=zones.map(z=>`<span class="zonetag">${esc(z)}</span>`).join(' ');html+=`<br><span class="muted">${zones.length} Zone${zones.length>1?'n':''} aus dem Ticket gelesen.</span>`}
    else if(stopCodes.length){html+=`<b>Erkannte Haltestellen:</b> ${stopCodes.map(esc).join(', ')}`;html+=`<br><span class="muted">Keine Zonennummer im Ticket gefunden – nur Haltestellencodes erkannt.</span>`}
    else{html+=`<b>Kein Ticketinhalt erkannt.</b><br><span class="muted">Bitte näher/schärfer fotografieren, damit Zonen oder Haltestellencodes gelesen werden können.</span>`;ticketResult.className='ticketresult show miss';ticketResult.innerHTML=html;ticketStatus.textContent='';return}
    if(cat)html+=`<br><b>Tarifart im Ticket:</b> ${esc(cat)}`;
    if(zones.length&&selected.from&&selected.to){const trip=getRouteZoneSequence(selected.from,selected.to,null);const tripIds=trip.sequence||[];const overlap=zones.filter(z=>tripIds.includes(z));const uncovered=tripIds.filter(z=>!zones.includes(z));if(uncovered.length===0){html+=`<br><br><b style="color:#16865a">✓ Ticket deckt die aktuell gewählte Fahrt ab.</b>`;ticketResult.className='ticketresult show match'}else{html+=`<br><br><b style="color:#8a5b00">⚠ Ticket deckt ${uncovered.length} Zone${uncovered.length>1?'n':''} der gewählten Fahrt nicht ab:</b> `;html+=uncovered.map(z=>`<span class="zonetag">${esc(z)}</span>`).join(' ');ticketResult.className='ticketresult show miss'}}else if(zones.length){html+=`<br><br><span class="muted">Wähle zuerst Von und Nach, um das Ticket mit der Fahrt zu vergleichen.</span>`;ticketResult.className='ticketresult show'}
    ticketResult.innerHTML=html;ticketStatus.textContent='✓ Ticket gelesen. Bitte prüfen.';ticketStatus.className='ocrstatus good';
  }catch(e){console.error(e);ticketStatus.textContent='Ticket konnte nicht gelesen werden. Bitte erneut versuchen.';ticketStatus.className='ocrstatus warn'}
}

document.getElementById('officialBtn').addEventListener('click',openOfficial);
document.getElementById('copyBtn').addEventListener('click',copyTrip);

if(stops.length!==536)console.warn('Haltestellen-Datensatz: erwartet 536, gefunden',stops.length);
