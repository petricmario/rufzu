
// RufZu App FINAL - Komplett - VersaTiles colorful + 533 stops + 430 Zonen + Fahnen + Popups + Bottom Info + alle Buttons
const colorMap={'MS':'#f1d400','SV':'#e59b00','LF':'#d64b27','FS':'#2877d1','GL':'#18a566'};
const map = new maplibregl.Map({container:'map', style:'https://tiles.versatiles.org/assets/styles/colorful/style.json', center:[14.37,46.76], zoom:11});
map.addControl(new maplibregl.NavigationControl(), 'top-right');

let zonesAdded=false;
function addZonesBorders(){
  try{
    if(map.getSource('zones')){
      try{map.removeLayer('zones-line');}catch(e){}
      try{map.removeLayer('zones-fill');}catch(e){}
      try{map.removeSource('zones');}catch(e){}
    }
    console.log('Versuche 430 Zonengrenzen hinzuzufügen...', TARIFF_ZONES_FULL.features.length);
    map.addSource('zones', {type:'geojson', data: TARIFF_ZONES_FULL});
    map.addLayer({id:'zones-fill', type:'fill', source:'zones', paint:{'fill-color':'#ff6a00','fill-opacity':0.05}});
    map.addLayer({id:'zones-line', type:'line', source:'zones', paint:{'line-color':'#ff6a00','line-width':2,'line-opacity':0.9}});
    zonesAdded=true;
    console.log('✅ 430 Zonengrenzen hinzugefügt');
    const infoEl=document.getElementById('mapInfo');
    if(infoEl){infoEl.textContent='430 Grenzen orange sichtbar ✓';}
  }catch(e){
    console.error('Zonen Fehler', e);
  }
}
map.on('load', ()=>{console.log('Map loaded'); setTimeout(addZonesBorders, 800);});
setTimeout(addZonesBorders, 2000);
map.on('styledata', ()=>{ if(!zonesAdded){setTimeout(addZonesBorders, 1000);} });

function zoneFor(lon,lat, geojson){ 
  function pip(lon,lat,poly){let inside=false; const ring=poly[0]; let j=ring.length-1; for(let i=0;i<ring.length;i++){const xi=ring[i][0], yi=ring[i][1]; const xj=ring[j][0], yj=ring[j][1]; if(((yi>lat)!=(yj>lat)) && (lon < (xj-xi)*(lat-yi)/(yj-yi+1e-12)+xi)) inside=!inside; j=i;} return inside;}
  for(const feat of geojson.features){ const g=feat.geometry; if(g.type==='MultiPolygon'){for(const poly of g.coordinates) if(pip(lon,lat,poly)) return feat.properties.zone_id;} else if(g.type==='Polygon'){if(pip(lon,lat,g.coordinates)) return feat.properties.zone_id;} }
  return null;
}

let selected={from:null,to:null}, startMarker=null, endMarker=null;
let bottomInfoEl=null;
function updateBottomInfo(text){
  if(!bottomInfoEl){
    bottomInfoEl=document.createElement('div');
    bottomInfoEl.style.cssText='position:absolute;bottom:0;left:0;right:0;background:rgba(255,255,255,.96);backdrop-filter:blur(8px);padding:10px 14px;font-size:12px;font-weight:600;border-top:1px solid #e6e8eb;display:flex;justify-content:space-between;align-items:center;z-index:5;box-shadow:0 -2px 12px rgba(0,0,0,.08)';
    bottomInfoEl.innerHTML='<span id="bottomStop" style="color:#1c2024">Klicke auf Haltestelle in Karte</span><span id="bottomCount" style="color:#6a737b;font-size:11px"></span>';
    const mapEl=document.getElementById('map');
    mapEl.style.position='relative';
    mapEl.appendChild(bottomInfoEl);
  }
  const stopEl=bottomInfoEl.querySelector('#bottomStop');
  const countEl=bottomInfoEl.querySelector('#bottomCount');
  if(text){stopEl.textContent=text;}
  if(countEl){countEl.textContent=stops.length+' Haltestellen · '+Object.keys(ZONE_NAMES).length+' Zonen';}
}

// Markers mit Popup
stops.forEach(s=>{
  const pref=(s.code||'').replace(/[^A-Z]/g,'').slice(0,2);
  const c=colorMap[pref]||'#666';
  const el=document.createElement('div'); el.className='marker-dot'; el.style.background=c; el.title=s.name; el.style.cursor='pointer';
  const marker=new maplibregl.Marker({element:el}).setLngLat([s.lon,s.lat]).addTo(map);
  const zoneName=ZONE_NAMES[zoneFor(s.lon,s.lat,TARIFF_ZONES_FULL)]||zoneFor(s.lon,s.lat,TARIFF_ZONES_FULL)||'?';
  const popup=new maplibregl.Popup({offset:14, closeButton:true}).setHTML(`<div style="font-weight:700;font-size:13px;line-height:1.2">${s.name}</div><div style="font-size:11px;color:#666;margin-top:4px">${s.code} · ${zoneName}</div><div style="margin-top:8px;display:flex;gap:6px"><button onclick="window.setFromStop('${s.code}')" style="padding:6px 10px;background:#f7941e;color:#fff;border:0;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer">Als Von</button><button onclick="window.setToStop('${s.code}')" style="padding:6px 10px;background:#1c2024;color:#fff;border:0;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer">Als Nach</button></div>`);
  el.addEventListener('click', ()=>{marker.setPopup(popup).togglePopup(); updateBottomInfo(s.name+' ('+s.code+') · '+zoneName);});
  el.addEventListener('mouseenter', ()=>{updateBottomInfo(s.name+' ('+s.code+')');});
});

updateBottomInfo('Bereit – klicke auf Haltestelle oder suche oben');

window.setFromStop = function(code){
  const s=stops.find(x=>x.code===code);
  if(s){selected.from=s; document.getElementById('from').value=s.name; document.getElementById('fromSug').hidden=true; updateBottomInfo('Von: '+s.name); try{map.flyTo({center:[s.lon,s.lat], zoom:14});}catch(e){}}
};
window.setToStop = function(code){
  const s=stops.find(x=>x.code===code);
  if(s){selected.to=s; document.getElementById('to').value=s.name; document.getElementById('toSug').hidden=true; updateBottomInfo('Nach: '+s.name); try{map.flyTo({center:[s.lon,s.lat], zoom:14});}catch(e){}}
};

function setup(id){
  const inp=document.getElementById(id), box=document.getElementById(id+'Sug');
  if(!inp || !box) return;
  inp.addEventListener('input', ()=>{
    selected[id]=null;
    const q=inp.value.toLowerCase().trim();
    if(!q){box.innerHTML=''; box.hidden=true; return;}
    const m=stops.filter(s=>s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q)).slice(0,20);
    if(m.length===0){box.innerHTML='<div class="sug">Keine Treffer</div>'; box.hidden=false; return;}
    box.innerHTML=m.map(s=>`<div class="sug" data-i="${stops.indexOf(s)}"><b>${s.name}</b><br><small>${s.code} · ${ZONE_NAMES[zoneFor(s.lon,s.lat,TARIFF_ZONES_FULL)]||''}</small></div>`).join('');
    box.hidden=false;
    box.querySelectorAll('.sug').forEach(d=>d.onclick=()=>{
      const i=Number(d.dataset.i);
      selected[id]=stops[i];
      inp.value=stops[i].name;
      box.innerHTML=''; box.hidden=true;
      updateBottomInfo((id==='from'?'Von: ':'Nach: ')+stops[i].name);
      try{map.flyTo({center:[stops[i].lon,stops[i].lat], zoom:14});}catch(e){}
    });
  });
  inp.addEventListener('focus', ()=>{if(inp.value.trim().length>0){inp.dispatchEvent(new Event('input'));}});
  inp.addEventListener('blur', ()=>{setTimeout(()=>{const val=inp.value.trim(); if(!val || selected[id]) return; const exact=stops.find(s=>s.code.toLowerCase()===val.toLowerCase() || s.name.toLowerCase()===val.toLowerCase()); if(exact){selected[id]=exact;}},300);});
}
setup('from'); setup('to');

document.getElementById('clearFrom')?.addEventListener('click', ()=>{selected.from=null; document.getElementById('from').value=''; document.getElementById('fromSug').hidden=true; updateBottomInfo('Von gelöscht');});
document.getElementById('clearTo')?.addEventListener('click', ()=>{selected.to=null; document.getElementById('to').value=''; document.getElementById('toSug').hidden=true; updateBottomInfo('Nach gelöscht');});

async function getRoute(a,b){const q=`${a.lon},${a.lat};${b.lon},${b.lat}`; const r=await fetch(`https://router.project-osrm.org/route/v1/driving/${q}?overview=full&geometries=geojson`); const j=await r.json(); return j.routes[0];}

document.getElementById('calcBtn').onclick=async()=>{
  const a=selected.from, b=selected.to;
  if(!a||!b){alert('Bitte Von und Nach wählen (aus Liste anklicken oder Karte)');return;}
  const resEl=document.getElementById('result');
  resEl.classList.add('show'); resEl.style.display='block';
  document.getElementById('routeText').innerHTML=`<b>Von:</b> ${a.name}<br><b>Nach:</b> ${b.name}<br><small>🟢 START grün / 🔴 ZIEL rot</small>`;
  document.getElementById('zoneText').textContent='Berechne...';
  document.getElementById('zonePath').textContent='PKW-Route via OSRM + 430 Zonen-Polygone';
  document.getElementById('fareBox').innerHTML='...';

  if(startMarker) startMarker.remove();
  if(endMarker) endMarker.remove();
  if(map.getSource('route')){try{map.removeLayer('route-line');map.removeSource('route');}catch(e){}}

  const elS=document.createElement('div'); elS.style.cssText='display:flex;flex-direction:column;align-items:center';
  elS.innerHTML=`<div class="flag-start">🚩</div><div class="flag-label" style="background:#00c853">START<br>${a.code}</div>`;
  startMarker=new maplibregl.Marker({element:elS, anchor:'bottom'}).setLngLat([a.lon,a.lat]).addTo(map);

  const elE=document.createElement('div'); elE.style.cssText='display:flex;flex-direction:column;align-items:center';
  elE.innerHTML=`<div class="flag-end">🏁</div><div class="flag-label" style="background:#d32f2f">ZIEL<br>${b.code}</div>`;
  endMarker=new maplibregl.Marker({element:elE, anchor:'bottom'}).setLngLat([b.lon,b.lat]).addTo(map);

  try{
    const route=await getRoute(a,b);
    const seq=[];
    const step=Math.max(1, Math.floor(route.geometry.coordinates.length/150));
    for(let i=0;i<route.geometry.coordinates.length;i+=step){
      const [lon,lat]=route.geometry.coordinates[i];
      const z=zoneFor(lon,lat,TARIFF_ZONES_FULL);
      if(z && (seq.length===0||seq[seq.length-1]!==z)) seq.push(z);
    }
    const sZone=zoneFor(a.lon,a.lat,TARIFF_ZONES_FULL);
    const eZone=zoneFor(b.lon,b.lat,TARIFF_ZONES_FULL);
    if(sZone && seq[0]!==sZone && !seq.includes(sZone)) seq.unshift(sZone);
    if(eZone && seq[seq.length-1]!==eZone && !seq.includes(eZone)) seq.push(eZone);

    const names=seq.map(z=>ZONE_NAMES[z]||z).join(' → ');
    document.getElementById('zoneText').textContent=seq.length+' Zonen';
    document.getElementById('zonePath').innerHTML=names+`<br><small style="opacity:.8">${seq.join(' → ')}</small>`;
    document.getElementById('distanceText').textContent=(route.distance/1000).toFixed(1)+' km';
    document.getElementById('distanceNote').textContent=seq.length+' Zonen via PKW';
    const price=TARIF_2026.normal[seq.length-1];
    const total=price!=null? (price+COMFORT).toFixed(2).replace('.',',')+'€' : 'k.A.';
    const senior=TARIF_2026.senior[seq.length-1];
    document.getElementById('fareBox').innerHTML=`<div class="faregrid"><div class="fareitem"><b>Normal</b><div class="price">${price!=null?price.toFixed(2).replace('.',',')+'€':''} + 2€ = ${total}</div><small>Standardtarif</small></div><div class="fareitem"><b>Senior</b><div class="price">${senior!=null?senior.toFixed(2).replace('.',',')+'€':''} + 2€</div><small>Ermäßigt</small></div></div><div style="margin-top:10px;font-size:11px;color:#666">430 Polygone via OSRM · VersaTiles colorful · Grenzen orange · Fachau inkl.</div>`;
    document.getElementById('nav').href=`https://www.google.com/maps/dir/?api=1&origin=${a.lat},${a.lon}&destination=${b.lat},${b.lon}&travelmode=driving`;

    map.addSource('route',{type:'geojson', data: route.geometry});
    map.addLayer({id:'route-line', type:'line', source:'route', paint:{'line-color':'#0055ff','line-width':5}});
    const bounds=new maplibregl.LngLatBounds();
    route.geometry.coordinates.forEach(c=>bounds.extend(c));
    bounds.extend([a.lon,a.lat]); bounds.extend([b.lon,b.lat]);
    map.fitBounds(bounds,{padding:60});
    updateBottomInfo(`Route: ${seq.length} Zonen · ${(route.distance/1000).toFixed(1)} km · ${names}`);
  }catch(e){
    document.getElementById('zoneText').textContent='Fehler';
    document.getElementById('zonePath').textContent=e.message;
    console.error(e);
  }
};

document.getElementById('copyBtn')?.addEventListener('click', ()=>{
  const a=selected.from,b=selected.to; if(!a||!b){alert('Bitte zuerst Von/Nach wählen');return;}
  const t=`Von: ${a.name} (${a.code})\nNach: ${b.name} (${b.code})`;
  navigator.clipboard.writeText(t).then(()=>alert('Kopiert: '+t));
});
document.getElementById('officialBtn')?.addEventListener('click', ()=>{window.open('https://pa2.kaerntner-linien.at/preisauskunft','_blank');});
document.getElementById('nav')?.addEventListener('click', (e)=>{const a=selected.from,b=selected.to; if(!a||!b){e.preventDefault(); alert('Bitte zuerst Route berechnen');}});
document.getElementById('androidAutoBtn')?.addEventListener('click', ()=>{
  const a=selected.from,b=selected.to; if(!a||!b){alert('Bitte zuerst Route berechnen');return;}
  const url=`https://www.google.com/maps/dir/?api=1&origin=${a.lat},${a.lon}&destination=${b.lat},${b.lon}&travelmode=driving`;
  window.open(url,'_blank');
});

document.getElementById('scanTicketBtn')?.addEventListener('click', ()=>{
  const input=document.createElement('input'); input.type='file'; input.accept='image/*';
  input.onchange=(e)=>{
    const file=e.target.files[0]; if(!file) return;
    const statusEl=document.getElementById('ocrStatus'); const resultEl=document.getElementById('ticketResult');
    if(statusEl){statusEl.textContent='📸 Bild wird analysiert...'; statusEl.className='ocrstatus';}
    if(resultEl){resultEl.className='ticketresult show'; resultEl.innerHTML='<b>Bild:</b> '+file.name+'<br><small>Voll-OCR in nächster Version – bitte manuell wählen</small>';}
    const img=document.createElement('img'); img.style.cssText='max-width:100%;max-height:200px;border-radius:8px;margin-top:8px'; img.src=URL.createObjectURL(file); if(resultEl) resultEl.appendChild(img);
    if(statusEl){statusEl.textContent='✅ Bild erhalten – manuelle Eingabe empfohlen'; statusEl.className='ocrstatus good';}
  }; input.click();
});
document.getElementById('scanLocationBtn')?.addEventListener('click', ()=>{
  const input=document.createElement('input'); input.type='file'; input.accept='image/*';
  input.onchange=(e)=>{
    const file=e.target.files[0]; if(!file) return;
    const statusEl=document.getElementById('ocrStatus'); const resultEl=document.getElementById('ticketResult');
    if(statusEl){statusEl.textContent='📍 Ort wird erkannt...';}
    if(resultEl){resultEl.className='ticketresult show'; resultEl.innerHTML='<b>Ortsbild:</b> '+file.name;}
    const img=document.createElement('img'); img.style.cssText='max-width:100%;max-height:200px;border-radius:8px;margin-top:8px'; img.src=URL.createObjectURL(file); if(resultEl) resultEl.appendChild(img);
  }; input.click();
});

document.getElementById('locFrom')?.addEventListener('click', async ()=>{
  const statusEl=document.getElementById('locFromStatus');
  if(!navigator.geolocation){statusEl.textContent='Geolocation nicht unterstützt'; return;}
  statusEl.textContent='📍 Standort wird ermittelt...'; statusEl.className='locstatus show';
  try{
    const pos=await new Promise((res,rej)=>navigator.geolocation.getCurrentPosition(res,rej,{enableHighAccuracy:true, timeout:10000}));
    const lat=pos.coords.latitude, lon=pos.coords.longitude;
    let best=null, bd=Infinity; for(const s of stops){const d=Math.sqrt((s.lat-lat)**2 + (s.lon-lon)**2); if(d<bd){bd=d; best=s;}}
    if(best){selected.from=best; document.getElementById('from').value=best.name; statusEl.textContent='✅ Nächste: '+best.name; updateBottomInfo('Von: '+best.name); map.flyTo({center:[best.lon,best.lat], zoom:14});}
  }catch(e){statusEl.textContent='❌ '+e.message; statusEl.className='locstatus show warn';}
});
document.getElementById('locTo')?.addEventListener('click', async ()=>{
  const statusEl=document.getElementById('locToStatus');
  if(!navigator.geolocation){statusEl.textContent='Geolocation nicht unterstützt'; return;}
  statusEl.textContent='📍 Standort wird ermittelt...'; statusEl.className='locstatus show';
  try{
    const pos=await new Promise((res,rej)=>navigator.geolocation.getCurrentPosition(res,rej,{enableHighAccuracy:true, timeout:10000}));
    const lat=pos.coords.latitude, lon=pos.coords.longitude;
    let best=null, bd=Infinity; for(const s of stops){const d=Math.sqrt((s.lat-lat)**2 + (s.lon-lon)**2); if(d<bd){bd=d; best=s;}}
    if(best){selected.to=best; document.getElementById('to').value=best.name; statusEl.textContent='✅ Nächste: '+best.name; updateBottomInfo('Nach: '+best.name); map.flyTo({center:[best.lon,best.lat], zoom:14});}
  }catch(e){statusEl.textContent='❌ '+e.message; statusEl.className='locstatus show warn';}
});

console.log('✅ RufZu App geladen – 533 Haltestellen, 430 Zonen, Fahnen, Grenzen, Popups, Bottom Info');
