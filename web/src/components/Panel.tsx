import React, { useEffect, useState, useMemo } from 'react';

type CatalogEntry = {
  area: string;
  layer: string;
  slug?: string;
  suggested_label?: string;
  source_type?: string;
  tile_url_template?: string;
  tile_size?: number;
  attribution?: string;
  projection?: string;
};

type Catalog = { generated_at: string; entries: CatalogEntry[] };

interface PanelProps {
  onSelect: (slug: string)=> void;
  activeLayerSlug: string | null;
}

export default function Panel({ onSelect, activeLayerSlug }: PanelProps){
  const [catalog, setCatalog] = useState<Catalog| null>(null);
  useEffect(()=>{
    fetch('/catalog.json').then(r=> r.json()).then(setCatalog).catch(()=>{});
  },[]);
  const grouped = useMemo(()=>{
    if(!catalog) return {} as Record<string, CatalogEntry[]>;
    const m: Record<string, CatalogEntry[]> = {};
    for(const e of catalog.entries){
      const key = e.area || 'Other';
      if(!m[key]) m[key] = [];
      m[key].push(e);
    }
    return m;
  },[catalog]);
  return <div style={{padding:12, overflow:'auto', fontSize:14}}>
    <h3 style={{marginTop:0}}>Layers</h3>
    {!catalog && <div>Loading catalog…</div>}
    {catalog && Object.entries(grouped).map(([area, list])=> (
      <div key={area} style={{marginBottom:16}}>
        <div style={{fontWeight:600, marginBottom:4}}>{area}</div>
        <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
          {list.map(entry=>{
            const slug = entry.slug || entry.layer.toLowerCase().replace(/[^a-z0-9]+/g,'-');
            const label = entry.suggested_label || entry.layer;
            const active = slug === activeLayerSlug;
            return <button
              key={slug}
              onClick={()=> onSelect(slug)}
              style={{
                padding:'4px 8px',
                borderRadius:6,
                border: active? '2px solid #69b2ff':'1px solid #333',
                background: active? '#132235':'#1a2633',
                color:'#e8eef6', cursor:'pointer'
              }}
              title={entry.attribution || label}
            >{label}</button>;
          })}
        </div>
      </div>
    ))}
  </div>;
}
