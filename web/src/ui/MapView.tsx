import React, { useEffect, useRef } from 'react';
import maplibregl, { Map } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useStore } from '../util/store';
import { buildHash } from '../util/permalink';

export default function MapView(){
  const mapRef = useRef<Map|null>(null);
  const containerRef = useRef<HTMLDivElement|null>(null);
  const { layers, time, view, setView, playing, stepTime } = useStore();
  useEffect(()=>{
    const map = new maplibregl.Map({
      container: containerRef.current!,
      style: 'https://demotiles.maplibre.org/style.json',
      center: [view.lon, view.lat], zoom: view.zoom
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl());
    map.on('load', ()=>{
      // Example: add WMTS layer proxied through backend
      // Real layers are chosen from the Panel
    });
    map.on('moveend', ()=>{
      const c = map.getCenter();
      setView({ lat: c.lat, lon: c.lng, zoom: map.getZoom() });
    });
    return ()=> map.remove();
  },[]);
  // Playback timer (advance one day for now every 1s while playing)
  useEffect(()=>{
    if(!playing) return;
    const id = setInterval(()=> stepTime(1), 1000);
    return ()=> clearInterval(id);
  },[playing, stepTime]);
  // Permalink hash update
  const storeSnapshot = useStore();
  useEffect(()=>{
    const h = buildHash({ time: storeSnapshot.time, view: storeSnapshot.view, layers: storeSnapshot.layers });
    if(location.hash !== h) history.replaceState(null,'',h);
  },[storeSnapshot.time, storeSnapshot.view.lat, storeSnapshot.view.lon, storeSnapshot.view.zoom, storeSnapshot.layers]);
  useEffect(()=>{
    const map = mapRef.current;
    if(!map) return;
    // Remove missing layers
    const existing = new Set(layers.map(l=> `raster-${l.id}`));
    map.getStyle().layers?.forEach(l=>{
      if(l.type==='raster' && l.id.startsWith('raster-') && !existing.has(l.id)){
        map.removeLayer(l.id);
        const src = map.getSource(l.id) as any;
        if(src) map.removeSource(l.id);
      }
    });
    // Add/update layers
    layers.forEach(layer=>{
      const id = `raster-${layer.id}`;
      const template = layer.templateRaw
        .replaceAll('{time}', encodeURIComponent(time))
        .replaceAll('{z}','{z}')
        .replaceAll('{x}','{x}')
        .replaceAll('{y}','{y}');
      if(!map.getSource(id)){
        map.addSource(id, { type: 'raster', tiles: [template], tileSize: 256 } as any);
        map.addLayer({ id, type: 'raster', source: id, paint: { 'raster-opacity': layer.opacity ?? 1 } });
      } else {
        const src = map.getSource(id) as any;
        if(src?.setTiles) src.setTiles([template]);
        map.setPaintProperty(id, 'raster-opacity', layer.opacity ?? 1);
      }
    });
  },[layers, time]);
  return <div ref={containerRef} style={{width:'100%',height:'100%'}} />;
}
