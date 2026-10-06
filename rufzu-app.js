'use strict';
const OFFICIAL_PRICE_URL='https://pa2.kaerntner-linien.at/preisauskunft';
const ZONE_PLAN_URL='https://www.kaerntner-linien.at/wp-content/uploads/tarifzonenplan-05-2026.pdf';

let selected={from:null,to:null};
let routeLine=null;

function esc(s){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function fmtEuro(v){return Number(v).toFixed(2).replace('.',',')+' €'}
function getSelectedPair(){return selected.to?{from:FIXED_ORIGIN,to:selected.to}:null}

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
function swapStops(){alert('Der Startpunkt ist für die Zonenkalkulation fest auf SV104 – St.Veit/Glan Bahnhof gesetzt.');}

document.addEventListener('click',e=>{if(!e.target.closest('.field')){const box=document.getElementById('toSug');if(box)box.hidden=true}});
setupField('to');
document.getElementById('clearTo').addEventListener('click',()=>clearField('to'));


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
 document.getElementById('routeText').innerHTML='<b>Von:</b> '+esc(FIXED_ORIGIN.name)+'<br><b>Nach:</b> '+esc(b.name);
 const nav=`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(a.lat+','+a.lon)}&destination=${encodeURIComponent(b.lat+','+b.lon)}&travelmode=driving`;
 document.getElementById('nav').href=nav;
 const key=stopCode(a)+'|'+stopCode(b);
 const verified=VERIFIED_ROUTES.get(key);
 document.getElementById('distanceText').textContent='Berechne …';
 document.getElementById('distanceNote').textContent='Straßenroute und Tarifzonen werden berechnet …';
 if(verified)renderZoneResult(verified.sequence,a,b,'verifizierter Kontrollfall');
 try{
   const route=await getRoute(a,b),km=route.distance/1000;
   document.getElementById('distanceText').textContent=km.toFixed(1).replace('.',',')+' km';
   document.getElementById('distanceNote').textContent='Nur Informationswert. Straßenkilometer bestimmen NICHT die Tarifzonen.';
   if(routeLine)map.removeLayer(routeLine);
   routeLine=L.geoJSON(route.geometry,{style:{weight:5,opacity:.8}}).addTo(map);
   map.fitBounds(routeLine.getBounds(),{padding:[20,20]});
   if(!verified){
     let seq=routeZoneSequence(route.geometry.coordinates);
     const destZone=destinationZoneFor(b);
     if(destZone && seq.at(-1)?.id!==destZone.id) seq.push(destZone);
     if(!seq.length)throw new Error('Keine Tarifzone ermittelt');
     const cached={zones:seq.length,sequence:seq.map(z=>z.id),updated:new Date().toISOString()};
     zoneCache[key]=cached;try{localStorage.setItem(ZONE_CACHE_KEY,JSON.stringify(zoneCache))}catch(e){}
     renderZoneResult(seq,a,b,'automatische Routenprüfung');
   }else{
     document.getElementById('zoneMessage').innerHTML='<div class="good">✓ Kontrollfall: SV104 → LF061 = 4 Zonen. Die Route wurde zusätzlich technisch geprüft.</div>';
   }
 }catch(e){
   if(!verified){
     const cached=zoneCache[key];
     if(cached?.sequence?.length)renderZoneResult(cached.sequence,a,b,'gespeicherte Routenprüfung');
     else{
       document.getElementById('zoneText').innerHTML='<b>Tarifzonen derzeit nicht berechenbar</b>';
       document.getElementById('zonePath').textContent='Die Straßenroute konnte nicht ermittelt werden. Es wird bewusst keine Zone geraten.';
       document.getElementById('zoneMessage').innerHTML='<div class="warn">Bitte Internetverbindung prüfen oder die offizielle Kärntner-Linien-Preisauskunft verwenden.</div>';
       document.getElementById('fareBox').innerHTML='';
     }
   }
   document.getElementById('distanceText').textContent='nicht verfügbar';
   document.getElementById('distanceNote').textContent='Straßenroute derzeit nicht erreichbar.';
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

selected.from=FIXED_ORIGIN;document.getElementById('from').value=FIXED_ORIGIN?.name||'';

// Sicherheitsprüfungen beim Laden.
if(stops.length!==536)console.error('Haltestellen-Datensatz beschädigt: erwartet 536, gefunden',stops.length);
if(!stops.some(s=>s.name.startsWith('SV104 - ')))console.error('SV104 fehlt');
if(!stops.some(s=>s.name.startsWith('LF061 - ')))console.error('LF061 fehlt');
if(!FIXED_ORIGIN)console.error('FIXED_ORIGIN SV104 fehlt');
if(TARIFF_ZONES.length<25)console.error('Tarifzonenbasis unvollständig');

// --- Ticket-/KlimaTicket-Scanner ---
(function initTicketScanner(){
  const btn=document.getElementById('ticketScanBtn');
  const modal=document.getElementById('ticketModal');
  const readerEl=document.getElementById('ticketReader');
  const status=document.getElementById('ticketStatus');
  const data=document.getElementById('ticketData');
  const close=document.getElementById('ticketClose');
  const restart=document.getElementById('ticketRestart');
  if(!btn||!modal||!readerEl)return;

  let scanner=null;
  let running=false;
  let lastText='';

  function setStatus(t,cls=''){
    status.textContent=t;
    status.className='ticketStatus'+(cls?' '+cls:'');
  }
  function showResult(text,format){
    data.classList.remove('hidden');
    data.innerHTML='<b>Code erkannt</b><br><span class="muted">Format: '+esc(format||'unbekannt')+'</span><div class="code" style="margin-top:8px">'+esc(text)+'</div><div class="warn" style="margin-top:10px">NICHT VERIFIZIERBAR – der Barcode wurde erfolgreich gelesen, aber die aktuelle Ticketgültigkeit kann von dieser App nicht offiziell bestätigt werden.</div>';
  }
  async function stop(){
    if(scanner && running){
      try{await scanner.stop()}catch(e){}
    }
    if(scanner){try{scanner.clear()}catch(e){}}
    scanner=null;running=false;
  }
  async function start(){
    await stop();
    data.classList.add('hidden');
    data.textContent='';
    lastText='';
    if(typeof Html5Qrcode==='undefined'){
      setStatus('Scanner-Bibliothek konnte nicht geladen werden. Internetverbindung prüfen.','warn');
      return;
    }
    try{
      setStatus('Kamera wird gestartet …');
      scanner=new Html5Qrcode('ticketReader');
      const formats=[];
      const F=window.Html5QrcodeSupportedFormats||{};
      ['QR_CODE','AZTEC','DATA_MATRIX','CODE_128','CODE_39','CODE_93','CODABAR','EAN_13','EAN_8','ITF','PDF_417','UPC_A','UPC_E'].forEach(k=>{if(F[k]!==undefined)formats.push(F[k])});
      const config={fps:10,qrbox:{width:280,height:190},aspectRatio:1.5,disableFlip:false};
      if(formats.length)config.formatsToSupport=formats;
      await scanner.start({facingMode:'environment'},config,(decodedText,decodedResult)=>{
        if(!decodedText || decodedText===lastText)return;
        lastText=decodedText;
        const format=decodedResult?.result?.format?.formatName||decodedResult?.result?.format?.toString()||'Barcode';
        setStatus('✓ Code erkannt. Kamera wird beendet …','good');
        showResult(decodedText,format);
        stop();
      },()=>{});
      running=true;
      setStatus('Kamera aktiv – Barcode/QR-Code in den Rahmen halten.');
    }catch(e){
      running=false;
      setStatus('Kamera konnte nicht gestartet werden. Bitte Kamerazugriff erlauben und die Seite über HTTPS öffnen.','warn');
    }
  }
  async function show(){
    modal.classList.add('open');
    modal.setAttribute('aria-hidden','false');
    await start();
  }
  async function hide(){
    await stop();
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden','true');
  }
  btn.addEventListener('click',show);
  close.addEventListener('click',hide);
  restart.addEventListener('click',start);
  modal.addEventListener('click',e=>{if(e.target===modal)hide()});
})();
