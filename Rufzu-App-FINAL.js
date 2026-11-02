
// RufZu App FINAL - VersaTiles colorful + 533 stops + 430 zones + Fahnen normal
const colorMap={'MS':'#f1d400','SV':'#e59b00','LF':'#d64b27','FS':'#2877d1','GL':'#18a566'};
const map = new maplibregl.Map({container:'map', style:'https://tiles.versatiles.org/assets/styles/colorful/style.json', center:[14.37,46.76], zoom:11});
map.addControl(new maplibregl.NavigationControl(), 'top-right');
map.on('load', ()=>{
  try{
    map.addSource('zones', {type:'geojson', data: TARIFF_ZONES_FULL});
    map.addLayer({id:'zones-fill', type:'fill', source:'zones', paint:{'fill-color':'#f7941e','fill-opacity':0.04}});
    map.addLayer({id:'zones-line', type:'line', source:'zones', paint:{'line-color':'#f7941e','line-width':1,'line-opacity':0.6,'line-dasharray':[3,2]}});
    map.addLayer({id:'zones-label', type:'symbol', source:'zones', layout:{'text-field':['get','zone_id'],'text-size':9,'text-allow-overlap':false}, paint:{'text-color':'#7a3d00','text-halo-color':'#fff','text-halo-width':1}});
  }catch(e){console.error(e);}
});
stops.forEach(s=>{
  const pref=(s.code||'').replace(/[^A-Z]/g,'').slice(0,2);
  const c=colorMap[pref]||'#666';
  const el=document.createElement('div'); el.className='marker-dot'; el.style.background=c; el.title=s.name;
  new maplibregl.Marker({element:el}).setLngLat([s.lon,s.lat]).addTo(map);
});
function zoneFor(lon,lat, geojson){ 
  function pip(lon,lat,poly){let inside=false; const ring=poly[0]; let j=ring.length-1; for(let i=0;i<ring.length;i++){const xi=ring[i][0], yi=ring[i][1]; const xj=ring[j][0], yj=ring[j][1]; if(((yi>lat)!=(yj>lat)) && (lon < (xj-xi)*(lat-yi)/(yj-yi+1e-12)+xi)) inside=!inside; j=i;} return inside;}
  for(const feat of geojson.features){ const g=feat.geometry; if(g.type==='MultiPolygon'){for(const poly of g.coordinates) if(pip(lon,lat,poly)) return feat.properties.zone_id;} else if(g.type==='Polygon'){if(pip(lon,lat,g.coordinates)) return feat.properties.zone_id;} }
  return null;
}
let selected={from:null,to:null}, startMarker=null, endMarker=null;
function setup(id){
  const inp=document.getElementById(id), box=document.getElementById(id+'Sug');
  inp.addEventListener('input', ()=>{
    selected[id]=null;
    const q=inp.value.toLowerCase();
    if(!q){box.innerHTML='';return;}
    const m=stops.filter(s=>s.name.toLowerCase().includes(q)).slice(0,15);
    box.innerHTML=m.map(s=>`<div class="sug" data-i="${stops.indexOf(s)}"><b>${s.name}</b><br><small>${s.code}</small></div>`).join('');
    box.querySelectorAll('.sug').forEach(d=>d.onclick=()=>{
      const i=Number(d.dataset.i);
      selected[id]=stops[i];
      inp.value=stops[i].name;
      box.innerHTML='';
      try{map.flyTo({center:[stops[i].lon,stops[i].lat], zoom:14});}catch(e){}
    });
  });
}
setup('from'); setup('to');

async function getRoute(a,b){const q=`${a.lon},${a.lat};${b.lon},${b.lat}`; const r=await fetch(`https://router.project-osrm.org/route/v1/driving/${q}?overview=full&geometries=geojson`); const j=await r.json(); return j.routes[0];}

document.getElementById('calcBtn').onclick=async()=>{
  const a=selected.from, b=selected.to;
  if(!a||!b){alert('Bitte Von und Nach wählen');return;}
  const resEl=document.getElementById('result');
  resEl.classList.add('show');
  document.getElementById('routeText').innerHTML=`<b>Von:</b> ${a.name}<br><b>Nach:</b> ${b.name}<br><small>🟢 START grün / 🔴 ZIEL rot</small>`;
  document.getElementById('zoneText').textContent='Berechne...';
  
  if(startMarker) startMarker.remove();
  if(endMarker) endMarker.remove();
  if(map.getSource('route')){try{map.removeLayer('route-line');map.removeSource('route');}catch(e){}}

  // START normal groß
  const elS=document.createElement('div'); elS.style.cssText='display:flex;flex-direction:column;align-items:center';
  elS.innerHTML=`<div class="flag-start">🚩</div><div class="flag-label" style="background:#00c853">START<br>${a.code}</div>`;
  startMarker=new maplibregl.Marker({element:elS, anchor:'bottom'}).setLngLat([a.lon,a.lat]).addTo(map);

  // ZIEL normal groß
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
    document.getElementById('zonePath').innerHTML=names+'<br><small style="opacity:.7">'+seq.join(' → ')+'</small>';
    const price=TARIF_2026.normal[seq.length-1];
    const total=price!=null? (price+COMFORT).toFixed(2).replace('.',',')+'€' : 'k.A.';
    document.getElementById('fareBox').innerHTML=`<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><div style="border:1px solid #ddd;border-radius:10px;padding:10px"><b>Normal</b><br>${price!=null?price.toFixed(2).replace('.',',')+'€':''} + 2€ = <b>${total}</b></div><div style="border:1px solid #ddd;border-radius:10px;padding:10px"><b>PKW</b><br>${(route.distance/1000).toFixed(1)} km</div></div><div style="margin-top:6px;font-size:11px;color:#666">430 Polygone via OSRM · VersaTiles colorful</div>`;

    map.addSource('route',{type:'geojson', data: route.geometry});
    map.addLayer({id:'route-line', type:'line', source:'route', paint:{'line-color':'#0055ff','line-width':5}});
    const bounds=new maplibregl.LngLatBounds();
    route.geometry.coordinates.forEach(c=>bounds.extend(c));
    bounds.extend([a.lon,a.lat]); bounds.extend([b.lon,b.lat]);
    map.fitBounds(bounds,{padding:60});
  }catch(e){
    document.getElementById('zoneText').textContent='Fehler';
    document.getElementById('zonePath').textContent=e.message;
  }
};

document.getElementById('copyBtn').onclick=()=>{
  const a=selected.from,b=selected.to; if(!a||!b)return;
  const t=`Von: ${a.name}\nNach: ${b.name}`;
  navigator.clipboard.writeText(t).then(()=>alert('Kopiert'));
};
