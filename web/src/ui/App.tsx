import React, { useState, useEffect } from 'react';
import { ModeSwitch } from '../map/ModeSwitch';
import { CesiumGlobe } from '../map/cesium/CesiumGlobe';
import { getRuntimeFlags } from '../util/featureFlags';
// Legacy components (MapView, Panel) retained elsewhere; using new catalog-based components here
import CatalogPanel from '../components/Panel';
import CatalogMap from '../components/Map';
import Timeline from '../components/Timeline';
import { parseHash, decodeLayers } from '../util/permalink';
import { useStore } from '../util/store';
export default function App(){
  const tileEnv = (import.meta as any).env?.VITE_TILE_BASE;
  const [hideBanner, setHideBanner] = useState(false);
  const showBanner = !tileEnv && !hideBanner;
  const { setTime, replaceLayers, setView, mode, setMode, gibsGeocolor3d, toggleGibsGeocolor3d } = useStore();
  const [flags, setFlags] = useState<{enable3d:boolean}>({ enable3d:false });
  useEffect(()=> { getRuntimeFlags().then(setFlags); },[]);
  const envEnable = ((import.meta as any).env?.VITE_ENABLE_3D) === '1';
  const params = new URLSearchParams(location.search);
  const requested3d = params.get('mode') === '3d';
  const canUse3D = envEnable && flags.enable3d;
  // Coerce mode based on gating (do not allow 3D if flags off)
  useEffect(()=> {
    if(requested3d && !canUse3D && mode==='3d') {
      setMode('2d');
    } else if(requested3d && canUse3D && mode!=='3d') {
      setMode('3d');
    }
    if(!requested3d && mode==='3d' && !canUse3D) setMode('2d');
  }, [requested3d, canUse3D]);
  // Persist (only if valid)
  useEffect(()=> {
    const p = new URLSearchParams(location.search);
    if(mode==='3d' && canUse3D) p.set('mode','3d'); else p.delete('mode');
    const newUrl = `${location.pathname}?${p.toString()}${location.hash}`.replace(/\?$/,'');
    window.history.replaceState({},'',newUrl);
  }, [mode, canUse3D]);
  // On initial mount, parse permalink hash
  useEffect(()=>{
    if(location.hash){
      const p = parseHash(location.hash);
      if(p.t) setTime(p.t);
      if(p.lat!=null && p.lon!=null) setView({ lat:p.lat, lon:p.lon });
      if(p.z!=null) setView({ zoom:p.z });
      if(p.l){
        const base = (import.meta as any).env?.VITE_TILE_BASE || 'http://localhost:4000/tiles';
        const ls = decodeLayers(p.l).map(l=>{
          // heuristic map id to known template if preset; fallback noop layer placeholder
          if(l.id==='gibs-geocolor') return { id:l.id, templateRaw: `${base}/wmts?base=https%3A%2F%2Fgibs.earthdata.nasa.gov%2Fwmts&layer=GOES-East_ABI_GeoColor&format=jpg&time={time}&z={z}&x={x}&y={y}`, opacity:l.opacity };
          return { id:l.id, templateRaw: `${base}/wmts?base=https%3A%2F%2Fgibs.earthdata.nasa.gov%2Fwmts&layer=${encodeURIComponent(l.id)}&time={time}&z={z}&x={x}&y={y}`, opacity:l.opacity };
        });
        replaceLayers(ls);
      }
    }
  },[]);
  const [activeLayerSlug, setActiveLayerSlug] = useState<string|null>(null);
  const [catalogData, setCatalogData] = useState<any>(null); // now array
  useEffect(()=>{ fetch('/catalog.json').then(r=> r.json()).then(setCatalogData).catch(()=>{}); },[]);
  // Time & playback state
  const hourMs = 3600_000;
  const [baseStart] = useState(()=> {
    const d = new Date(); d.setMinutes(0,0,0); // truncate to hour
    return d.getTime() - 24 * hourMs; // start 24h ago
  });
  const [currentTime, setCurrentTime] = useState(()=> baseStart + 24 * hourMs); // now (end of window)
  const [isPlaying, setIsPlaying] = useState(false);
  const [isUserScrubbing, setIsUserScrubbing] = useState(false);
  const hoursSpan = 48; // show 48h window
  // Search state
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [mapInstance, setMapInstance] = useState<any>(null);
  useEffect(()=>{
    if(!search){ setResults([]); return; }
    const handle = setTimeout(()=>{
      setSearchLoading(true);
      fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(search)}`)
        .then(r=> r.json())
        .then(data=> { setResults(data||[]); })
        .catch(()=> setResults([]))
        .finally(()=> setSearchLoading(false));
    },300);
    return ()=> clearTimeout(handle);
  },[search]);
  const flyToResult = (r:any)=>{
    if(!mapInstance) return;
    const lat = parseFloat(r.lat);
    const lon = parseFloat(r.lon);
    if(Number.isFinite(lat) && Number.isFinite(lon)){
      mapInstance.flyTo({ center:[lon, lat], zoom: 8 });
    }
  };
  return <div style={{display:'grid',gridTemplateRows: showBanner? '40px 1fr':'1fr', height:'100vh'}}>
    {showBanner && <div style={{background:'#ffecb3',padding:'6px 12px',display:'flex',alignItems:'center',gap:12,fontSize:14}}>
      <div style={{flex:1}}>Tile proxy base (VITE_TILE_BASE) is not configured; using http://localhost:4000/tiles</div>
      <button onClick={()=> setHideBanner(true)}>Dismiss</button>
    </div>}
    <div style={{display:'grid',gridTemplateColumns:'1fr 360px',height:'100%'}}>
      <div style={{position:'relative'}}>
  {mode==='2d' && <CatalogMap activeLayerSlug={activeLayerSlug} catalog={catalogData} onMapReady={setMapInstance} currentTime={currentTime} />}
  {mode==='3d' && canUse3D && <CesiumGlobe />}
        <ModeSwitch mode={mode} setMode={setMode} canUse3D={canUse3D} />
        {mode==='3d' && canUse3D && <div style={{position:'absolute', top:40, right:8, zIndex:20, background:'rgba(15,25,35,0.85)', color:'#e6f2fa', padding:'6px 8px', borderRadius:6, fontSize:12}}>
          <label style={{display:'flex',alignItems:'center',gap:6}}>
            <input type="checkbox" checked={gibsGeocolor3d} onChange={toggleGibsGeocolor3d} /> GIBS GeoColor
          </label>
        </div>}
        <div style={{position:'absolute',left:8,top:8,background:'rgba(0,0,0,.4)',padding:'4px 8px',borderRadius:4,fontSize:12}}>Catalog Demo</div>
        <div style={searchContainerStyle}>
          <input
            type="text"
            placeholder="Search location..."
            value={search}
            onChange={e=> setSearch(e.target.value)}
            style={searchInputStyle}
          />
          {searchLoading && <div style={{fontSize:11, padding:'4px 6px'}}>Searching…</div>}
          {(!searchLoading && results.length>0) && <div style={resultsBoxStyle}>
            {results.slice(0,8).map(r=> <div key={r.place_id}
              onClick={()=> flyToResult(r)}
              style={resultItemStyle}
              title={r.display_name}
            >{r.display_name}</div>)}
          </div>}
        </div>
        <Timeline
          playing={isPlaying}
          onToggle={()=> setIsPlaying(p=> !p)}
          currentTime={currentTime}
          setCurrentTime={(t)=> setCurrentTime(typeof t === 'function' ? (t as any)(currentTime): t)}
          baseStart={baseStart}
          hoursSpan={hoursSpan}
          isUserScrubbing={isUserScrubbing}
          setIsUserScrubbing={setIsUserScrubbing}
        />
      </div>
      <CatalogPanel onSelect={setActiveLayerSlug} activeLayerSlug={activeLayerSlug} />
    </div>
  </div>;
}

const searchContainerStyle: React.CSSProperties = {
  position:'absolute',
  top: 8,
  left: '50%',
  transform:'translateX(-50%)',
  display:'flex',
  flexDirection:'column',
  width:'min(480px,80%)',
  zIndex:10,
  gap:4
};
const searchInputStyle: React.CSSProperties = {
  width:'100%',
  padding:'8px 10px',
  borderRadius:6,
  border:'1px solid #284155',
  background:'rgba(15,25,35,0.85)',
  color:'#e6f2fa',
  fontSize:14
};
const resultsBoxStyle: React.CSSProperties = {
  background:'rgba(10,20,30,0.9)',
  border:'1px solid #2d465a',
  borderRadius:6,
  maxHeight:220,
  overflowY:'auto'
};
const resultItemStyle: React.CSSProperties = {
  padding:'6px 8px',
  cursor:'pointer',
  fontSize:12,
  borderBottom:'1px solid rgba(255,255,255,0.05)'
};