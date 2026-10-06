'use strict';
const OFFICIAL_PRICE_URL='https://pa2.kaerntner-linien.at/preisauskunft';
const ZONE_PLAN_URL='https://www.kaerntner-linien.at/wp-content/uploads/tarifzonenplan-05-2026.pdf';

let selected={from:null,to:null};
let routeLine=null;

function esc(s){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function fmtEuro(v){return Number(v).toFixed(2).replace('.',',')+' €'}
function getSelectedPair(){return selected.from&&selected.to?{from:selected.from,to:selected.to}:null}

const ZONE_ANCHORS={1:[[46.7703,14.3662],[46.7600,14.3500],[46.7800,14.3450]],2:[[46.7382,14.2897],[46.7480,14.2700],[46.7500,14.2600]],3:[[46.7900,14.2000],[46.7700,14.2200],[46.7800,14.2350]],4:[[46.7832,14.3776],[46.7554,14.4477],[46.7505,14.4494],[46.7900,14.4200]],5:[[46.8066,14.2845],[46.7900,14.3200],[46.6844,14.3423],[46.7595,14.2578]],6:[[46.8116,14.4247],[46.8005,14.3983],[46.8000,14.4700]],7:[[46.7110,14.2600],[46.7000,14.3400],[46.7200,14.2900]],8:[[46.8400,14.2000],[46.8300,14.2700],[46.8200,14.3200]]};
const ZONE_GRAPH={1:[2,4,5,7],2:[1,3,5,7],3:[2,5,8],4:[1,5,6,3],5:[1,2,3,4,6,7,8],6:[4,5,8],7:[1,2,5,8],8:[3,5,6,7]};
function zoneDistance(a,b){const la=(a[0]+b[0])/2,dx=(a[1]-b[1])*Math.cos(la*Math.PI/180),dy=a[0]-b[0];return Math.sqrt(dx*dx+dy*dy)}
function nearestMapZone(stop){if(!stop)return null;const c=stopCode(stop);if(c==='SV104')return 1;if(/^LF0(4[0-9]|5[0-9]|6[0-1])$/.test(c))return 5;if(/^MS/.test(c))return 5;if(/^FS03[0-9]|^FS07[0-9]|^FS08[0-9]/.test(c))return 4;let z=null,bd=Infinity;for(const [k,pts] of Object.entries(ZONE_ANCHORS))for(const p of pts){const q=zoneDistance([stop.lat,stop.lon],p);if(q<bd){bd=q;z=+k}}return z}
function shortestZonePath(a,b){if(a==null||b==null)return[];if(a===b)return[a];const q=[[a]],seen=new Set([a]);while(q.length){const p=q.shift(),c=p[p.length-1];for(const n of(ZONE_GRAPH[c]||[])){if(seen.has(n))continue;const np=p.concat(n);if(n===b)return np;seen.add(n);q.push(np)}}return[a,b]}
function tariffSequence(a,b){const ac=stopCode(a),bc=stopCode(b),za=nearestMapZone(a),zb=nearestMapZone(b);if(ac==='SV104'&&bc==='LF061')return[1,2,3,5];if(ac==='LF061'&&bc==='SV104')return[5,3,2,1];if(ac==='SV104'&&bc==='GL081')return[1,4];if(ac==='GL081'&&bc==='SV104')return[4,1];if(za==null||zb==null)return[];if(za===1&&zb===5&&(/^LF/.test(ac)||/^LF/.test(bc)))return[1,2,3,5];if(za===5&&zb===1&&(/^LF/.test(ac)||/^LF/.test(bc)))return[5,3,2,1];return shortestZonePath(za,zb)}

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
function swapStops(){if(!selected.from||!selected.to){alert('Bitte zuerst Von und Nach auswählen.');return}const a=selected.from,b=selected.to;selected.from=b;selected.to=a;document.getElementById('from').value=b.name;document.getElementById('to').value=a.name;map.setView([b.lat,b.lon],15);}

document.addEventListener('click',e=>{if(!e.target.closest('.field')){const box=document.getElementById('toSug');if(box)box.hidden=true}});
setupField('from');
setupField('to');
document.getElementById('clearFrom').addEventListener('click',()=>clearField('from'));
document.getElementById('clearTo').addEventListener('click',()=>clearField('to'));
document.getElementById('swapBtn')?.addEventListener('click',swapStops);


function norm(s){return String(s||'').toUpperCase().replace(/[–—−]/g,'-').replace(/\s+/g,' ').trim()}
function compact(s){return norm(s).replace(/[^A-Z0-9ÄÖÜ]/g,'')}
function codeDistance(a,b){a=String(a||'');b=String(b||'');const d=Array.from({length:a.length+1},()=>Array(b.length+1).fill(0));for(let i=0;i<=a.length;i++)d[i][0]=i;for(let j=0;j<=b.length;j++)d[0][j]=j;for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++)d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1));return d[a.length][b.length]}
const OCR_CODES=stops.map(s=>({code:stopCode(s),stop:s})).filter(x=>x.code);
function resolveOcrCode(raw){let r=String(raw||'').toUpperCase().replace(/[^A-Z0-9]/g,'');if(r.length!==5)return null;r=r.slice(0,2)+r.slice(2).replace(/[OQD]/g,'0').replace(/[IL]/g,'1').replace(/S/g,'5').replace(/B/g,'8');let best=null,bd=99;for(const x of OCR_CODES){let q=codeDistance(r,x.code);if(r.slice(0,2)===x.code.slice(0,2))q=Math.max(0,q-1);if(q<bd){bd=q;best=x.stop}}return bd<=1?best:null}
function extractOcrStops(text){const t=norm(text),ct=compact(t),found=[];for(const raw of [...t.matchAll(/\b[A-Z0-9]{2}\s*[-.:]?\s*[A-Z0-9]{3}\b/g)].map(m=>m[0])){const h=resolveOcrCode(raw);if(h&&!found.some(s=>stopCode(s)===stopCode(h)))found.push(h)}if(found.length<2){const a=[];for(const x of OCR_CODES){let q=ct.includes(x.code)?0:99;for(let i=0;i<=ct.length-5&&q>0;i++)q=Math.min(q,codeDistance(ct.slice(i,i+5),x.code));if(q<=1)a.push({stop:x.stop,score:100-q})}a.sort((x,y)=>y.score-x.score);for(const x of a){if(!found.some(s=>stopCode(s)===stopCode(x.stop)))found.push(x.stop);if(found.length>=2)break}}return found.slice(0,2)}
async function scanScheduleImage(file){const status=document.getElementById('ocrStatus');if(!window.Tesseract){status.textContent='OCR-Bibliothek konnte nicht geladen werden. Bitte händisch eingeben.';status.className='ocrstatus warn';return}status.textContent='📷 Foto wird gelesen …';status.className='ocrstatus';try{const {data}=await Tesseract.recognize(file,'deu+eng',{logger:m=>{if(m.status==='recognizing text'&&m.progress)status.textContent=`OCR liest das Foto … ${Math.round(m.progress*100)} %`}});let hits=extractOcrStops(data.text||'');for(const line of (data.text||'').split(/\r?\n/).map(norm).filter(Boolean)){const h=extractOcrStops(line)[0];if(h&&!hits.some(s=>stopCode(s)===stopCode(h)))hits.push(h);if(hits.length>=2)break}const from=hits[0]||null,to=hits.find(x=>!from||stopCode(x)!==stopCode(from))||null;if(from)pick('from',stops.indexOf(from));if(to)pick('to',stops.indexOf(to));const n=(from?1:0)+(to?1:0);status.textContent=n===2?`✓ Erkannt: ${from.name} → ${to.name}. Bitte kontrollieren und danach berechnen.`:n===1?'✓ Eine Haltestelle erkannt. Das zweite Feld bitte kurz auswählen.':'Foto gelesen, aber keine Haltestellen sicher erkannt. Bitte nochmals fotografieren.';status.className=n===2?'ocrstatus good':'ocrstatus warn'}catch(e){status.textContent='OCR konnte das Foto nicht lesen. Bitte Felder händisch eingeben.';status.className='ocrstatus warn'}}
document.getElementById('scanBtn')?.addEventListener('click',()=>document.getElementById('scanInput')?.click());document.getElementById('scanInput')?.addEventListener('change',e=>{const f=e.target.files?.[0];if(f)scanScheduleImage(f);e.target.value=''})


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
  const sequence=tariffSequence(a,b);
  if(sequence.length){renderZoneResult(sequence,a,b,'Tarifzonenfolge');}
  else{document.getElementById('zoneText').innerHTML='<b>nicht verfügbar</b>';document.getElementById('zonePath').textContent='Für diese Kombination ist noch keine Tarifzonen-Zuordnung hinterlegt.';document.getElementById('zoneMessage').innerHTML='<div class="warn">Keine Tarifzonen-Zuordnung vorhanden – es wird kein Wert aus Kilometern oder Luftlinie erfunden.</div>';document.getElementById('fareBox').innerHTML='';}
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
document.getElementById('calcBtn')?.addEventListener('click',calculateTrip);

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
document.getElementById('copyBtn')?.addEventListener('click',copyTrip);
document.getElementById('officialBtn')?.addEventListener('click',openOfficial);

// Sicherheitsprüfungen beim Laden.
if(stops.length!==536)console.error('Haltestellen-Datensatz beschädigt: erwartet 536, gefunden',stops.length);
if(TARIFF_ZONES.length<25)console.error('Tarifzonenbasis unvollständig');

(function(){const b=document.getElementById('ticketScanBtn'),m=document.getElementById('ticketModal'),r=document.getElementById('ticketReader'),st=document.getElementById('ticketStatus'),d=document.getElementById('ticketData'),c=document.getElementById('ticketClose'),h=document.getElementById('ticketHide'),a=document.getElementById('ticketRestart');if(!b||!m||!r)return;let q=null,on=false,last='';const set=(t,k='')=>{st.textContent=t;st.className='ticketStatus'+(k?' '+k:'')};const show=(t,f)=>{d.classList.remove('hidden');d.innerHTML='<b>Code erkannt</b><br><span class="muted">Format: '+esc(f||'unbekannt')+'</span><div class="code" style="margin-top:8px">'+esc(t)+'</div><div class="warn" style="margin-top:10px">Code gelesen. Eine offizielle Ticketgültigkeit wird hier nicht bestätigt.</div>'};async function stop(){if(q&&on)try{await q.stop()}catch(e){}if(q)try{q.clear()}catch(e){}q=null;on=false}async function start(){await stop();last='';d.classList.add('hidden');if(typeof Html5Qrcode==='undefined'){set('Scanner-Bibliothek fehlt. Seite neu laden.','warn');return}try{q=new Html5Qrcode('ticketReader');set('Kamera wird gestartet …');const F=window.Html5QrcodeSupportedFormats||{},fs=['QR_CODE','AZTEC','DATA_MATRIX','CODE_128','CODE_39','CODE_93','CODABAR','EAN_13','EAN_8','ITF','PDF_417','UPC_A','UPC_E'].map(x=>F[x]).filter(x=>x!==undefined),cfg={fps:10,qrbox:{width:280,height:190},disableFlip:false};if(fs.length)cfg.formatsToSupport=fs;await q.start({facingMode:'environment'},cfg,(txt,res)=>{if(!txt||txt===last)return;last=txt;show(txt,res?.result?.format?.formatName||'Barcode/QR');set('✓ Code erkannt.','good');stop()},()=>{});on=true;set('Kamera aktiv – Code in den Rahmen halten.')}catch(e){set('Kamera konnte nicht gestartet werden. Kamerazugriff erlauben und HTTPS verwenden.','warn')}}async function open(){m.classList.add('open');await start()}async function close(){await stop();m.classList.remove('open')}b.addEventListener('click',open);c?.addEventListener('click',close);h?.addEventListener('click',close);a?.addEventListener('click',start);m.addEventListener('click',e=>{if(e.target===m)close()})})();
