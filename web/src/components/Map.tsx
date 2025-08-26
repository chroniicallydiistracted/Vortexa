import React, { useEffect, useRef } from 'react';
import { useMantineTheme } from '@mantine/core';
import maplibregl, { Map as MLMap } from 'maplibre-gl';
import type {
  StyleSpecification,
  RasterSourceSpecification,
  GeoJSONSourceSpecification,
  MapOptions,
  Map as MapLibreMap,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

// New catalog structure: { layers: [...] }
export interface CatalogEntry {
  slug: string;
  category: string;
  suggested_label: string;
  source_type: string;
  tile_url_template?: string;
  time_format?: string;
  api_endpoint?: string;
  attribution?: string;
  notes?: string;
}
// Detect FIRMS layer by slug or attribution reference. CSV is exposed via our proxy: /api/firms/... returning text/csv
import { firmsCsvToGeoJSON } from '../util/firms';
type Catalog = CatalogEntry[];

interface MapProps {
  activeLayerSlug: string | null;
  catalog: CatalogEntry[] | { layers?: CatalogEntry[] } | null;
  onMapReady?: (map: MLMap) => void;
  currentTime?: number;
}

export default function Map({ activeLayerSlug, catalog, onMapReady, currentTime }: MapProps) {
  const theme = useMantineTheme();
  const mapRef = useRef<MLMap | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  console.log('[Map] Map component rendered with props:', {
    activeLayerSlug,
    catalog: catalog ? 'loaded' : 'null',
    currentTime,
  });
  // init
  useEffect(() => {
    if (!containerRef.current) {
      console.log('[Map] Container ref not ready, skipping map initialization');
      return;
    }

    console.log(
      '[Map] Initializing map with basemap template:',
      import.meta.env.VITE_BASEMAP_TILE_URL || '/api/cartodb/positron/{z}/{x}/{y}.png',
    );
    const baseTemplate =
      import.meta.env.VITE_BASEMAP_TILE_URL || '/api/cartodb/positron/{z}/{x}/{y}.png';
    const style: StyleSpecification = {
      version: 8,
      sources: {
        basemap: {
          type: 'raster',
          tiles: [baseTemplate],
          tileSize: 256,
        } as RasterSourceSpecification,
      },
      layers: [{ id: 'basemap', type: 'raster', source: 'basemap' }],
    };
    const options: MapOptions = {
      container: containerRef.current as HTMLElement,
      style,
      center: [-112.074, 33.448],
      zoom: 3,
    };
    console.log('[Map] Creating map with container:', containerRef.current);
    const map: MapLibreMap = new maplibregl.Map(options);
    map.addControl(new maplibregl.NavigationControl());
    // Defensive: log (once) if WebGL context lost (can trigger DOMExceptions otherwise)
    const canvas = map.getCanvas();
    const onContextLost = (e: Event) => {
      e.preventDefault();
      console.warn('[Map] WebGL context lost');
    };
    canvas.addEventListener('webglcontextlost', onContextLost, { once: true });
    mapRef.current = map;
    console.log('[Map] Map created successfully');
    if (onMapReady) onMapReady(map);
    return () => {
      try {
        canvas.removeEventListener('webglcontextlost', onContextLost);
      } catch (e) {
        console.debug('Map: cleanup failed', (e as Error).message);
      }
      try {
        map.remove();
      } catch (e) {
        console.debug('Map: cleanup failed', (e as Error).message);
      }
      // Null out ref so async effects know map is gone
      mapRef.current = null;
    };
  }, [containerRef.current]);

  // helper: format time per format token
  function formatTime(fmt: string | undefined, ms: number): string {
    if (!fmt) return new Date(ms).toISOString().slice(0, 10);
    const d = new Date(ms);
    if (fmt === 'unix_timestamp') return Math.floor(ms / 1000).toString();
    if (fmt === 'YYYY-MM-DD') return d.toISOString().slice(0, 10);
    if (fmt === 'YYYY-MM-DDTHH:mm:ssZ') return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
    if (fmt === 'YYYY-MM-DDTHHmmZ') {
      const iso = d.toISOString();
      return iso.slice(0, 13) + iso.slice(14, 16) + 'Z'; // YYYY-MM-DDTHH + mm + Z
    }
    if (fmt === 'ISO8601_HOUR') return d.toISOString().slice(0, 13) + ':00:00Z';
    return d.toISOString();
  }

  // layer changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let cancelled = false;

    // remove previous dynamic layers/sources (defensive try/catch to avoid DOMExceptions if already removed)
    const safeRemoveLayer = (id: string) => {
      try {
        if (map.getLayer(id)) map.removeLayer(id);
      } catch {}
    };
    const safeRemoveSource = (id: string) => {
      try {
        if (map.getSource(id)) map.removeSource(id);
      } catch {}
    };
    ['active-raster', 'active-vector-fill', 'active-vector-line', 'active-vector-circle'].forEach(
      safeRemoveLayer,
    );
    ['active-raster', 'active-vector'].forEach(safeRemoveSource);

    if (!activeLayerSlug) {
      cancelled = true;
      return () => {
        /* cleanup handled below */
      };
    }

    const entries: Catalog = Array.isArray(catalog)
      ? catalog
      : catalog && Array.isArray((catalog as { layers?: CatalogEntry[] }).layers)
        ? (catalog as { layers: CatalogEntry[] }).layers
        : [];
    const entry = entries.find((e) => e.slug === activeLayerSlug);
    if (!entry) {
      cancelled = true;
      return () => {
        /* cleanup handled below */
      };
    }

    const nowMs = currentTime || Date.now();
    const stillValid = () => !!mapRef.current && mapRef.current === map && !cancelled;

    if (entry.source_type === 'raster' && entry.tile_url_template) {
      try {
        const timeToken = formatTime(entry.time_format, nowMs);
        const url = entry.tile_url_template.includes('{time}')
          ? entry.tile_url_template.replace('{time}', timeToken)
          : entry.tile_url_template;
        if (stillValid()) {
          map.addSource('active-raster', {
            type: 'raster',
            tiles: [url],
            tileSize: 256,
          } as RasterSourceSpecification);
          map.addLayer({
            id: 'active-raster',
            type: 'raster',
            source: 'active-raster',
          });
        }
      } catch (e) {
        console.warn('[Map] Failed to add raster layer', e);
      }
    } else if (entry.source_type === 'vector' && entry.api_endpoint) {
      const isFirmsCsv =
        /\/api\/firms\//.test(entry.api_endpoint) || /firms/i.test(entry.attribution || '');
      fetch(entry.api_endpoint)
        .then(async (r) => {
          if (!r.ok) throw new Error(`fetch ${entry.api_endpoint} ${r.status}`);
          const ct = r.headers.get('content-type') || '';
          if (isFirmsCsv || ct.includes('text/csv')) {
            const text = await r.text();
            return firmsCsvToGeoJSON(text);
          }
          // Safe JSON parse
          return r.json();
        })
        .then((data) => {
          if (!stillValid()) return;
          if (map.getSource('active-vector')) return;
          map.addSource('active-vector', {
            type: 'geojson',
            data,
          } satisfies GeoJSONSourceSpecification);
          try {
            map.addLayer({
              id: 'active-vector-line',
              type: 'line',
              source: 'active-vector',
              paint: {
                'line-color': theme.colors.storm?.[6] || theme.primaryColor,
                'line-width': 2,
              },
              filter: ['==', '$type', 'LineString'],
            });
          } catch {}
          try {
            map.addLayer({
              id: 'active-vector-fill',
              type: 'fill',
              source: 'active-vector',
              paint: {
                'fill-color': `${theme.colors.storm?.[6] ?? theme.primaryColor}40`, // 25% alpha
                'fill-outline-color': theme.colors.storm?.[6] ?? theme.primaryColor,
              },
              filter: ['==', '$type', 'Polygon'],
            });
          } catch {}
          try {
            map.addLayer({
              id: 'active-vector-circle',
              type: 'circle',
              source: 'active-vector',
              paint: {
                'circle-radius': 4,
                'circle-color': theme.colors.storm?.[7] || theme.colors.blue[6],
                'circle-stroke-color': theme.white,
                'circle-stroke-width': 1,
              },
              filter: ['==', '$type', 'Point'],
            });
          } catch {}
        })
        .catch((err) => {
          if (!cancelled) console.warn('[Map] vector fetch failed', err.message || err);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [activeLayerSlug, catalog, currentTime]);

  // static alerts overlay preserved (optional redundancy with official-weather-alerts layer)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let aborted = false;
    fetch('/api/alerts')
      .then((r) => r.json())
      .then((fc) => {
        if (aborted) return;
        if (!fc?.features) return;
        if (map.getSource('alerts-static')) return;
        map.addSource('alerts-static', {
          type: 'geojson',
          data: fc,
        } satisfies GeoJSONSourceSpecification);
        map.addLayer({
          id: 'alerts-static-fill',
          type: 'fill',
          source: 'alerts-static',
          paint: {
            'fill-color': `${theme.colors.red?.[6] ?? theme.colors.pink?.[6] ?? theme.primaryColor}33`, // ~20% alpha
            'fill-outline-color': `${theme.colors.red?.[6] ?? theme.colors.pink?.[6] ?? theme.primaryColor}99`, // ~60% alpha
          },
        });
      });
    return () => {
      aborted = true;
    };
  }, []);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}
