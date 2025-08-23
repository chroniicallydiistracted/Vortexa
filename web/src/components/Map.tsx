import React, { useEffect, useRef } from 'react';
import maplibregl, { Map as MLMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

// For now the palette is just an array of entries; only slug is used to find tile template (future integration)
type CatalogEntry = { slug: string; suggested_label?: string; };
type Catalog = CatalogEntry[];

interface MapProps { activeLayerSlug: string | null; catalog: Catalog | null; onMapReady?: (map: MLMap)=> void; currentTime?: number }

export default function Map({ activeLayerSlug, catalog, onMapReady, currentTime }: MapProps){
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
  onMapReady && onMapReady(map);
    return ()=> map.remove();
  },[]);
  // layer changes
  useEffect(()=>{
    const map = mapRef.current;
    if(!map) return;
    // remove previous
    if(map.getLayer('weather-layer')){ map.removeLayer('weather-layer'); }
    if(map.getSource('weather-source')){ map.removeSource('weather-source'); }
    // If selection cleared, do nothing further
    if(!activeLayerSlug || activeLayerSlug === '') return;
    // Temporary: only one known working layer (satellite) mapped to existing template
    let tileTemplate: string | null = null;
    let tileSize = 256;
    if(activeLayerSlug === 'satellite-imagery'){
      // Use {time} placeholder date segment
      tileTemplate = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/GOES-East_Full_Disk_GeoColor_ENHANCED/default/{time}/{z}/{y}/{x}.jpg';
    }
    if(!tileTemplate) return; // others not yet implemented (expected 404 avoidance)
    const dateStr = currentTime ? new Date(currentTime).toISOString().slice(0,10) : new Date().toISOString().slice(0,10);
    const tiles = [tileTemplate.replace('{time}', dateStr)];
    map.addSource('weather-source', { type: 'raster', tiles, tileSize } as any);
    map.addLayer({ id:'weather-layer', type:'raster', source:'weather-source' });
  },[activeLayerSlug, catalog, currentTime]);
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
