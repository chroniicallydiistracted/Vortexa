import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useStore, LAYER_PRESETS } from '../util/store';
import { ensureGibsTimestamps } from '../util/gibs';
import { buildHash } from '../util/permalink';
import type { Catalog } from '@westfam/shared';

export default function Panel(){
  const { addLayer, removeLayer, setOpacity, layers, time, setTime, togglePlaying, playing, gibsTimestamps, gibsSelectedTime, setGibsSelectedTime, toggleGibsPlaying, gibsPlaying, stepGibsTime, gibsFps, setGibsFps, gibsLoadError } = useStore() as any;
  const { data } = useQuery<Catalog>({
    queryKey:['catalog'],
    queryFn: async ()=>{
      const res = await fetch('/catalog.json');
      if(!res.ok) return { entries: [] } as any;
      const ct = res.headers.get('content-type')||'';
      if(!ct.includes('application/json')) return { entries: [] } as any;
      try {
        return await res.json() as Catalog;
      } catch {
        return { entries: [] } as any;
      }
    }
  });
  const tileBase = (import.meta as any).env?.VITE_TILE_BASE || 'http://localhost:4000/tiles';
  return <div style={{padding:12, overflow:'auto'}}>
    <h3>Time & Playback</h3>
    <div style={{marginBottom:16}}>
      <label>
        <div style={{fontSize:12,opacity:.7}}>Time (YYYY-MM-DD)</div>
        <input type="date" value={time} onChange={e=> setTime(e.currentTarget.value)} />
      </label>
      <div style={{marginTop:8}}>
        <button onClick={()=> togglePlaying()}>{playing? 'Pause':'Play'} (daily)</button>
        <button onClick={()=> setTime(new Date().toISOString().slice(0,10))} style={{marginLeft:8}}>Today</button>
      </div>
    </div>
    <h3>GIBS Animation</h3>
    <div style={{marginBottom:12}}>
      <button onClick={async ()=> { try { await ensureGibsTimestamps('GOES-East_ABI_GeoColor'); } catch { /* noop */ } }}>Load Timestamps</button>
      <button disabled={gibsTimestamps.length<2 || !!gibsLoadError} style={{marginLeft:8}} onClick={()=> toggleGibsPlaying()}>{gibsPlaying? 'Pause':'Play'}</button>
      <button disabled={!gibsTimestamps.length} style={{marginLeft:8}} onClick={()=> stepGibsTime(-1)}>Prev</button>
      <button disabled={!gibsTimestamps.length} style={{marginLeft:4}} onClick={()=> stepGibsTime(1)}>Next</button>
      <div style={{marginTop:6,fontSize:12}}>
        {gibsLoadError? <span style={{color:'crimson'}}>Load failed</span> : gibsSelectedTime? `Selected: ${gibsSelectedTime}`: gibsTimestamps.length? 'Loaded timestamps':''}
      </div>
      <div style={{marginTop:6}}>
        <label style={{fontSize:12}}>FPS (2-8): <input type="number" min={2} max={8} value={gibsFps} onChange={e=> setGibsFps(Number(e.currentTarget.value||4))} style={{width:60}} /></label>
      </div>
      {gibsTimestamps.length>0 && <div style={{maxHeight:120,overflow:'auto',marginTop:6,border:'1px solid #ddd',padding:4}}>
        {gibsTimestamps.slice(-50).map((t: string)=> <div key={t} style={{cursor:'pointer',color: t===gibsSelectedTime? '#1976d2':'#333'}} onClick={()=> setGibsSelectedTime(t)}>{t}</div>)}
      </div>}
    </div>
    <h3>Presets</h3>
    <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:12}}>
      {LAYER_PRESETS.map(p=> <button key={p.key} onClick={()=>{
        const tileBase = (import.meta as any).env?.VITE_TILE_BASE || 'http://localhost:4000/tiles';
        const realized = p.layers.map(l=> ({ ...l, templateRaw: l.templateRaw.replace('{TILE_BASE}', tileBase) }));
        realized.forEach(addLayer);
      }}>{p.name}</button>)}
    </div>
    <h3>Layers</h3>
    <div style={{marginBottom:12}}>
      <button onClick={()=>{
        const id = 'gibs-geocolor';
        const layer = 'GOES-East_ABI_GeoColor';
        const base = 'https://gibs.earthdata.nasa.gov/wmts';
        const templateRaw = `${tileBase}/wmts?base=${encodeURIComponent(base)}&layer=${encodeURIComponent(layer)}&format=jpg&time={time}&z={z}&x={x}&y={y}`;
        addLayer({ id, templateRaw, opacity: 1 });
      }}>Add Demo: NASA GIBS GeoColor</button>
    </div>
    {!data ? 'Loading...' : data.entries.slice(0,20).map((e, i)=>{
      const id = `${e.provider}-${e.layer}`.toLowerCase().replace(/[^a-z0-9]+/g,'-');
      return <div key={i} style={{marginBottom:8, borderBottom:'1px solid #eee',paddingBottom:8}}>
        <div><strong>{e.layer}</strong> <small>({e.provider})</small></div>
        <div><small>{e.access} • {e.coverage}</small></div>
        <button onClick={()=>{
          const templateRaw = `${tileBase}/wmts?base=${encodeURIComponent(e.base_url)}&layer=${encodeURIComponent(e.layer)}&time={time}&z={z}&x={x}&y={y}`;
          addLayer({ id, templateRaw });
        }}>Add</button>
      </div>;
    })}
    <h3 style={{marginTop:16}}>Active</h3>
  {layers.length===0? <div style={{opacity:.6}}>No layers</div> : layers.map((l: any)=>
      <div key={l.id} style={{display:'flex',alignItems:'center',gap:8, margin:'6px 0'}}>
        <div style={{flex:1}}>{l.id}</div>
        <input title="opacity" type="range" min={0} max={1} step={0.05} value={l.opacity ?? 1} onChange={e=> setOpacity(l.id, Number(e.currentTarget.value))} />
        <button onClick={()=> removeLayer(l.id)}>Remove</button>
      </div>
    )}
    <div style={{marginTop:12}}>
      <button onClick={()=> {
        const link = location.origin + location.pathname + buildHash({ time, view: useStore.getState().view, layers });
        navigator.clipboard.writeText(link).catch(()=>{});
        alert('Permalink copied to clipboard');
      }}>Copy Permalink</button>
    </div>
  </div>;
}
