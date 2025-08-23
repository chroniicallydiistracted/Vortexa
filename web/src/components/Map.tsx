import React, { useEffect, useRef } from 'react';
import maplibregl, { Map as MLMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

// New catalog structure: { layers: [...] }
interface CatalogEntry { slug: string; category: string; suggested_label: string; source_type: string; tile_url_template?: string; time_format?: string; api_endpoint?: string; attribution?: string; notes?: string }
type Catalog = CatalogEntry[];

interface MapProps { activeLayerSlug: string | null; catalog: any; onMapReady?: (map: MLMap)=> void; currentTime?: number }

export default function Map({ activeLayerSlug, catalog, onMapReady, currentTime }: MapProps){
  const mapRef = useRef<MLMap|null>(null);
  const containerRef = useRef<HTMLDivElement|null>(null);
  // init
  useEffect(()=>{
    const map = new maplibregl.Map({
      container: containerRef.current!,
      style: 'https://demotiles.maplibre.org/style.json',
      center: [-112.074, 33.448],
      zoom: 3
    });
    map.addControl(new maplibregl.NavigationControl());
    mapRef.current = map;
    onMapReady && onMapReady(map);
    return ()=> map.remove();
  },[]);

  // helper: format time per format token
  function formatTime(fmt: string | undefined, ms: number): string {
    if(!fmt) return new Date(ms).toISOString().slice(0,10);
    const d = new Date(ms);
    if(fmt === 'unix_timestamp') return Math.floor(ms/1000).toString();
    if(fmt === 'YYYY-MM-DD') return d.toISOString().slice(0,10);
    if(fmt === 'YYYY-MM-DDTHH:mm:ssZ') return d.toISOString().replace(/\.\d{3}Z$/,'Z');
    if(fmt === 'YYYY-MM-DDTHHmmZ') {
      const iso = d.toISOString();
      return iso.slice(0,13) + iso.slice(14,16) + 'Z'; // YYYY-MM-DDTHH + mm + Z
    }
    if(fmt === 'ISO8601_HOUR') return d.toISOString().slice(0,13)+':00:00Z';
    return d.toISOString();
  }

  // layer changes
  useEffect(()=>{
    const map = mapRef.current;
    if(!map) return;
    // remove previous generic weather layers
    if(map.getLayer('active-raster')) map.removeLayer('active-raster');
    if(map.getSource('active-raster')) map.removeSource('active-raster');
    if(map.getLayer('active-vector-fill')) map.removeLayer('active-vector-fill');
    if(map.getLayer('active-vector-line')) map.removeLayer('active-vector-line');
    if(map.getLayer('active-vector-circle')) map.removeLayer('active-vector-circle');
    if(map.getSource('active-vector')) map.removeSource('active-vector');

    if(!activeLayerSlug) return;

    const entries: Catalog = Array.isArray(catalog)? catalog : (catalog?.layers || []);
    const entry = entries.find(e=> e.slug === activeLayerSlug);
    if(!entry) return;

    const nowMs = currentTime || Date.now();

    if(entry.source_type === 'raster' && entry.tile_url_template) {
      const timeToken = formatTime(entry.time_format, nowMs);
      const url = entry.tile_url_template.includes('{time}') ? entry.tile_url_template.replace('{time}', timeToken) : entry.tile_url_template;
      map.addSource('active-raster', { type:'raster', tiles:[url], tileSize: 256 } as any);
      map.addLayer({ id:'active-raster', type:'raster', source:'active-raster' });
    } else if(entry.source_type === 'vector' && entry.api_endpoint) {
      // Fetch vector GeoJSON
      fetch(entry.api_endpoint).then(r=> r.json()).then(data=> {
        if(map.getSource('active-vector')) return; // guard if quick reselect
        map.addSource('active-vector', { type:'geojson', data } as any);
        // Heuristic styling depending on feature geometry type
        map.addLayer({ id:'active-vector-line', type:'line', source:'active-vector', paint:{ 'line-color':'#ff9800', 'line-width':2 }, filter:['==','$type','LineString'] });
        map.addLayer({ id:'active-vector-fill', type:'fill', source:'active-vector', paint:{ 'fill-color':'rgba(255,152,0,0.25)', 'fill-outline-color':'#ff9800' }, filter:['==','$type','Polygon'] });
        map.addLayer({ id:'active-vector-circle', type:'circle', source:'active-vector', paint:{ 'circle-radius':4, 'circle-color':'#ff5722', 'circle-stroke-color':'#fff', 'circle-stroke-width':1 }, filter:['==','$type','Point'] });
      }).catch(()=>{});
    }
  },[activeLayerSlug, catalog, currentTime]);

  // static alerts overlay preserved (optional redundancy with official-weather-alerts layer)
  useEffect(()=>{
    const map = mapRef.current; if(!map) return; let aborted=false;
    fetch('/api/alerts').then(r=> r.json()).then(fc=>{ if(aborted) return; if(!fc?.features) return; if(map.getSource('alerts-static')) return; map.addSource('alerts-static',{ type:'geojson', data:fc } as any); map.addLayer({ id:'alerts-static-fill', type:'fill', source:'alerts-static', paint:{ 'fill-color':'rgba(255,0,0,0.2)','fill-outline-color':'rgba(255,0,0,0.6)'}});});
    return ()=> { aborted=true; };
  },[]);

  return <div ref={containerRef} style={{width:'100%',height:'100%'}} />;
}
