import React, { useEffect, useState, useMemo } from 'react';

// New palette is a flat array of objects (layers + overlays) without wrapper.
type PaletteEntry = {
  type: string; // 'layer' | 'overlay'
  category: string;
  original_label: string;
  suggested_label: string;
  slug: string;
  notes?: string;
  specificity?: string;
};

interface PanelProps {
  onSelect: (slug: string)=> void;
  activeLayerSlug: string | null;
}

export default function Panel({ onSelect, activeLayerSlug }: PanelProps){
  const [palette, setPalette] = useState<PaletteEntry[]| null>(null);
  useEffect(()=>{
    fetch('/catalog.json').then(r=> r.json()).then(setPalette).catch(()=>{});
  },[]);
  // Group entries by category
  const grouped = useMemo(()=>{
    if(!palette) return {} as Record<string, PaletteEntry[]>;
    return palette.reduce((acc, e)=>{
      const key = e.category || 'Other';
      (acc[key] = acc[key] || []).push(e);
      return acc;
    }, {} as Record<string, PaletteEntry[]>);
  },[palette]);
  // Track which categories are collapsed
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggleCat = (c: string)=> setCollapsed(s=> ({...s, [c]: !s[c]}));
  const allCats = useMemo(()=> Object.keys(grouped).sort(), [grouped]);
  const collapseAll = ()=> setCollapsed(Object.fromEntries(allCats.map(c=> [c, true])));
  const expandAll = ()=> setCollapsed(Object.fromEntries(allCats.map(c=> [c, false])));
  return <div style={{padding:12, overflow:'auto', fontSize:13, lineHeight:1.3}}>
    <div style={{display:'flex',alignItems:'center',gap:8, marginBottom:8}}>
      <h3 style={{margin:'0 8px 0 0'}}>Layers</h3>
      <button onClick={collapseAll} style={btnStyle}>Collapse All</button>
      <button onClick={expandAll} style={btnStyle}>Expand All</button>
      <button onClick={()=> onSelect('')} style={btnStyle}>Clear</button>
    </div>
    {!palette && <div>Loading palette…</div>}
    {palette && allCats.map(cat=>{
      const list = grouped[cat];
      const isCollapsed = collapsed[cat];
      return <div key={cat} style={{marginBottom:12}}>
        <div style={{display:'flex',alignItems:'center',cursor:'pointer',userSelect:'none'}} onClick={()=> toggleCat(cat)}>
          <div style={{fontWeight:600, flex:1}}>{cat}</div>
          <div style={{fontSize:11,opacity:.7, marginRight:6}}>{list.length}</div>
          <div style={{transform: isCollapsed? 'rotate(-90deg)':'rotate(0deg)', transition:'transform .15s'}}>&#9656;</div>
        </div>
        {!isCollapsed && <div style={{display:'flex', flexWrap:'wrap', gap:6, marginTop:4}}>
          {list.map(entry=>{
            const slug = entry.slug;
            const label = entry.suggested_label || entry.original_label;
            const active = slug === activeLayerSlug;
            return <button
              key={slug}
              onClick={()=> onSelect(active? '': slug)}
              style={{
                padding:'4px 8px',
                borderRadius:6,
                border: active? '2px solid #69b2ff':'1px solid #333',
                background: active? '#132235':'#1a2633',
                color:'#e8eef6', cursor:'pointer',
                fontSize:12,
                maxWidth: '140px',
                textOverflow:'ellipsis',
                overflow:'hidden',
                whiteSpace:'nowrap'
              }}
              title={entry.original_label + (entry.notes? ` – ${entry.notes}`:'')}
            >{label}</button>;
          })}
        </div>}
      </div>;
    })}
  </div>;
}

const btnStyle: React.CSSProperties = {
  background:'#223244',
  border:'1px solid #35506d',
  color:'#e0e8f0',
  padding:'3px 6px',
  fontSize:11,
  borderRadius:4,
  cursor:'pointer'
};
