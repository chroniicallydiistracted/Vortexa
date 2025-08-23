import React, { useState, useEffect } from 'react';
// Legacy components (MapView, Panel) retained elsewhere; using new catalog-based components here
import CatalogPanel from '../components/Panel';
import CatalogMap from '../components/Map';
import { parseHash, decodeLayers } from '../util/permalink';
import { useStore } from '../util/store';
export default function App(){
  const tileEnv = (import.meta as any).env?.VITE_TILE_BASE;
  const [hideBanner, setHideBanner] = useState(false);
  const showBanner = !tileEnv && !hideBanner;
  const { setTime, replaceLayers, setView } = useStore();
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
  const [catalogData, setCatalogData] = useState<any>(null);
  useEffect(()=>{ fetch('/catalog.json').then(r=> r.json()).then(setCatalogData).catch(()=>{}); },[]);
  return <div style={{display:'grid',gridTemplateRows: showBanner? '40px 1fr':'1fr', height:'100vh'}}>
    {showBanner && <div style={{background:'#ffecb3',padding:'6px 12px',display:'flex',alignItems:'center',gap:12,fontSize:14}}>
      <div style={{flex:1}}>Tile proxy base (VITE_TILE_BASE) is not configured; using http://localhost:4000/tiles</div>
      <button onClick={()=> setHideBanner(true)}>Dismiss</button>
    </div>}
    <div style={{display:'grid',gridTemplateColumns:'1fr 360px',height:'100%'}}>
      <div style={{position:'relative'}}>
        <CatalogMap activeLayerSlug={activeLayerSlug} catalog={catalogData} />
        <div style={{position:'absolute',left:8,top:8,background:'rgba(0,0,0,.4)',padding:'4px 8px',borderRadius:4,fontSize:12}}>Catalog Demo</div>
      </div>
      <CatalogPanel onSelect={setActiveLayerSlug} activeLayerSlug={activeLayerSlug} />
    </div>
  </div>;
}