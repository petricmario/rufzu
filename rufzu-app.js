'use strict';
const OFFICIAL_PRICE_URL='https://pa2.kaerntner-linien.at/preisauskunft';
const ZONE_PLAN_URL='https://www.kaerntner-linien.at/wp-content/uploads/tarifzonenplan-05-2026.pdf';

let selected={from:null,to:null};
let routeLine=null;

function esc(s){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function fmtEuro(v){return Number(v).toFixed(2).replace('.',',')+' €'}
function getSelectedPair(){return selected.from&&selected.to?{from:selected.from,to:selected.to}:null}

const colorMap={'Maria Saal':'#f1d400','St.Veit':'#e59b00','Liebenfels':'#d64b27','Frauenstein':'#2877d1','St.Georgen am Längsee':'#18a566'};
const map=window.L?L.map('map').setView([46.76,14.37],10):null;
if(map)L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);
if(map)stops.forEach(s=>{const c=colorMap[s.group]||'#666';const marker=L.circleMarker([s.lat,s.lon],{radius:5,weight:1,fillOpacity:.85,color:c,fillColor:c}).addTo(map);marker.bindTooltip(s.name,{direction:'top',offset:[0,-4]});marker.on('click',()=>{if(!selected.from)pick('from',stops.indexOf(s));else if(!selected.to)pick('to',stops.indexOf(s));});});
function setupField(id){const input=document.getElementById(id),box=document.getElementById(id+'Sug');input.addEventListener('input',()=>{selected[id]=null;renderSuggestions(id)});input.addEventListener('focus',()=>renderSuggestions(id));input.addEventListener('keydown',e=>{if(e.key==='Escape')box.hidden=true});}
function renderSuggestions(id){const q=document.getElementById(id).value.trim().toLowerCase(),box=document.getElementById(id+'Sug');if(!q){box.hidden=true;return}const matches=stops.filter(s=>s.name.toLowerCase().includes(q)).slice(0,30);box.innerHTML=matches.length?matches.map(s=>`<div class="sug" data-index="${stops.indexOf(s)}"><b>${esc(s.name)}</b><span>${esc(s.group)}</span></div>`).join(''):'<div class="sug"><span>Keine passende Haltestelle gefunden</span></div>';box.querySelectorAll('[data-index]').forEach(el=>el.addEventListener('click',()=>pick(id,Number(el.dataset.index))));box.hidden=false;}
function pick(id,i){const s=stops[i];if(!s)return;selected[id]=s;document.getElementById(id).value=s.name;document.getElementById(id+'Sug').hidden=true;if(map)map.setView([s.lat,s.lon],15);}
function clearField(id){selected[id]=null;document.getElementById(id).value='';document.getElementById(id+'Sug').hidden=true;document.getElementById(id).focus();}
function swapStops(){const a=selected.from,b=selected.to;selected.from=b;selected.to=a;document.getElementById('from').value=b?.name||'';document.getElementById('to').value=a?.name||'';}
document.addEventListener('click',e=>{['from','to'].forEach(id=>{const box=document.getElementById(id+'Sug');if(box&&!e.target.closest('.field'))box.hidden=true;});});
setupField('from');setupField('to');
document.getElementById('clearFrom').addEventListener('click',()=>clearField('from'));
document.getElementById('clearTo').addEventListener('click',()=>clearField('to'));
document.getElementById('gpsBtn').addEventListener('click',()=>{if(!navigator.geolocation){alert('GPS wird von diesem Browser nicht unterstützt.');return}const b=document.getElementById('gpsBtn');b.textContent='📍 Standort wird ermittelt …';navigator.geolocation.getCurrentPosition(pos=>{selected.from={name:'Mein aktueller Standort',lat:pos.coords.latitude,lon:pos.coords.longitude,group:'GPS'};document.getElementById('from').value='📍 Mein aktueller Standort';b.textContent='✓ Aktuellen Standort verwenden';if(map)map.setView([pos.coords.latitude,pos.coords.longitude],14)},()=>{b.textContent='📍 Aktuellen Standort verwenden';alert('Standort konnte nicht ermittelt werden.')},{enableHighAccuracy:true,timeout:12000,maximumAge:30000});});
if(map){
  // Map is optional; tariff calculation must work even when Leaflet is unavailable.
}


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
function routeZoneSequence(coords){
 const seq=[];let last=null;
 for(let i=0;i<coords.length;i+=Math.max(1,Math.floor(coords.length/120))){
   const [lon,lat]=coords[i];const z=nearestTariffZone({lat,lon});if(z&&z.id!==last){seq.push(z);last=z.id;}
 }
 return seq;
}
function destinationZoneFor(stop){return nearestTariffZone(stop);}

async function calculateTrip(){
 const pair=getSelectedPair();
 if(!pair){alert('Bitte Von und Nach auswählen.');return}
 const a=pair.from,b=pair.to;
 document.getElementById('result').style.display='block';
 document.getElementById('routeText').innerHTML='<b>Von:</b> '+esc(a.name)+'<br><b>Nach:</b> '+esc(b.name);
 document.getElementById('distanceText').textContent='Berechne …';
 document.getElementById('distanceNote').textContent='Straßenroute wird nur zusätzlich zur Information ermittelt.';
 const nav=`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(a.lat+','+a.lon)}&destination=${encodeURIComponent(b.lat+','+b.lon)}&travelmode=driving`;
 document.getElementById('nav').href=nav;
 // TARIF VOR ROUTING: bekannte/verifizierte PDF-Zonen werden sofort angezeigt.
 const key=stopCode(a)+'|'+stopCode(b);
 const verified=VERIFIED_ROUTES.get(key);
 if(verified){
   renderZoneResult(verified.sequence,a,b,'Tarifzonen aus der PDF-Zonenbasis');
 }else{
   const za=nearestTariffZone(a),zb=nearestTariffZone(b);
   if(za&&zb&&za.id===zb.id){
     renderZoneResult([za.id],a,b,'1 Zone – gleiche Tarifzone');
   }else{
     const cached=zoneCache[key];
     if(cached?.sequence?.length) renderZoneResult(cached.sequence,a,b,'gespeicherte PDF-Zonenprüfung');
     else{
       document.getElementById('zoneText').innerHTML='<b>Tarifzone ermittelt</b>';
       document.getElementById('zonePath').textContent=(za?.id||'–')+' → '+(zb?.id||'–');
       document.getElementById('zoneMessage').innerHTML='<div class="warn">Die Straßenroute ist für die Tarifanzeige nicht erforderlich. Für diese konkrete Strecke ist aber noch keine verifizierte Zonenfolge hinterlegt; es wird kein Zonenwert aus Kilometern geschätzt.</div>';
       document.getElementById('fareBox').innerHTML='';
     }
   }
 }
 try{
   const route=await getRoute(a,b),km=route.distance/1000;
   document.getElementById('distanceText').textContent=km.toFixed(1).replace('.',',')+' km';
   document.getElementById('distanceNote').textContent='Nur Informationswert. Straßenkilometer bestimmen NICHT die Tarifzonen.';
   if(map&&routeLine)map.removeLayer(routeLine);
   if(map){routeLine=L.geoJSON(route.geometry,{style:{weight:5,opacity:.8}}).addTo(map);map.fitBounds(routeLine.getBounds(),{padding:[20,20]});}
   // Routing darf die bereits angezeigte Tarifinformation nicht überschreiben.
   if(!verified && !(zoneCache[key]?.sequence?.length)){
     const seq=routeZoneSequence(route.geometry.coordinates);
     if(seq.length){const cached={zones:seq.length,sequence:seq.map(z=>z.id),updated:new Date().toISOString()};zoneCache[key]=cached;try{localStorage.setItem(ZONE_CACHE_KEY,JSON.stringify(zoneCache))}catch(e){}renderZoneResult(seq,a,b,'PDF-Zonenbasis + Straßenroute');}
   }
 }catch(e){
   document.getElementById('distanceText').textContent='nicht verfügbar';
   document.getElementById('distanceNote').textContent='Straßenroute derzeit nicht erreichbar. Tarifanzeige bleibt davon unabhängig bestehen.';
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
if(!stops.some(s=>s.name.startsWith('SV104 - ')))console.error('SV104 fehlt');
if(!stops.some(s=>s.name.startsWith('LF061 - ')))console.error('LF061 fehlt');
if(TARIFF_ZONES.length<25)console.error('Tarifzonenbasis unvollständig');
