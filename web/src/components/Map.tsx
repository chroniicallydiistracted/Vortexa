import React, { useEffect, useRef } from 'react';
import maplibregl, { Map as MLMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

type CatalogEntry = { slug?: string; layer: string; tile_url_template?: string; tile_size?: number; source_type?: string };
type Catalog = { entries: CatalogEntry[] };

interface MapProps {
  activeLayerSlug: string | null;
  catalog: Catalog | null;
}

export default function Map({ activeLayerSlug, catalog }: MapProps){
  const mapRef = useRef<MLMap|null>(null);
  const containerRef = useRef<HTMLDivElement|null>(null);
  // init
  useEffect(()=>{
    const map = new maplibregl.Map({
      container: containerRef.current!,
      style: 'https://demotiles.maplibre.org/style.json',
      center: [-112.074, 33.448],
      zoom: 5
    });
    map.addControl(new maplibregl.NavigationControl());
    mapRef.current = map;
    return ()=> map.remove();
  },[]);
  // layer changes
  useEffect(()=>{
    const map = mapRef.current;
    if(!map) return;
    // remove previous
    if(map.getLayer('weather-layer')){ map.removeLayer('weather-layer'); }
    if(map.getSource('weather-source')){ map.removeSource('weather-source'); }
    if(!activeLayerSlug || !catalog) return;
    const entry = catalog.entries.find(e => (e.slug || e.layer.toLowerCase().replace(/[^a-z0-9]+/g,'-')) === activeLayerSlug);
    if(!entry || !entry.tile_url_template) return;
    const tiles = [entry.tile_url_template.replace('{time}', new Date().toISOString().slice(0,10))];
    map.addSource('weather-source', {
      type: 'raster',
      tiles,
      tileSize: entry.tile_size || 256
    } as any);
    map.addLayer({ id:'weather-layer', type:'raster', source:'weather-source' });
  },[activeLayerSlug, catalog]);
  // alerts overlay once
  useEffect(()=>{
    const map = mapRef.current;
    if(!map) return;
    let aborted = false;
    fetch('/api/alerts').then(r=> r.json()).then(fc=>{
      if(aborted) return;
      if(!fc || !fc.features) return;
      if(map.getSource('alerts-source')) return; // already added
      map.addSource('alerts-source', { type:'geojson', data: fc } as any);
      map.addLayer({ id:'alerts-layer-fill', type:'fill', source:'alerts-source', paint:{ 'fill-color':'rgba(255,0,0,0.3)', 'fill-outline-color':'rgba(255,0,0,0.7)' }});
      map.addLayer({ id:'alerts-layer-outline', type:'line', source:'alerts-source', paint:{ 'line-color':'rgba(255,0,0,0.7)', 'line-width':1.5 }});
      map.on('click','alerts-layer-fill', (e:any)=>{
        const f = e.features?.[0];
        if(!f) return;
        new maplibregl.Popup({ closeButton:true })
          .setLngLat(e.lngLat)
          .setHTML(`<strong>${f.properties?.event || 'Alert'}</strong><br/>${f.properties?.headline || ''}`)
          .addTo(map);
      });
      map.on('mouseenter','alerts-layer-fill', ()=> map.getCanvas().style.cursor='pointer');
      map.on('mouseleave','alerts-layer-fill', ()=> map.getCanvas().style.cursor='');
    }).catch(()=>{});
    return ()=> { aborted = true; };
  },[]);
  return <div ref={containerRef} style={{width:'100%',height:'100%'}} />;
}
