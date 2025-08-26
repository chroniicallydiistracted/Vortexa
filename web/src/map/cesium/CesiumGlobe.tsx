import React, { useEffect, useRef, useState } from 'react';
import { useMantineTheme } from '@mantine/core';
import { useStore } from '../../state/state-store';
import { zoomToHeight } from '../../util/zoomHeight';
// Direct Cesium imports (avoid dynamic + structural any patterns)
import {
  Viewer,
  EllipsoidTerrainProvider,
  Cartesian3,
  UrlTemplateImageryProvider,
  PointPrimitiveCollection,
  Color,

} from 'cesium';

// Narrowing helpers for accessing private (underscore) arrays without using `as any`.
interface CreditLike {
  _credit?: { html?: string };
}

type ImageryLayerInstance = InstanceType<typeof Viewer>['imageryLayers']['_layers'][number] &
  CreditLike; // access underbar via indexed type

export function CesiumGlobe() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const theme = useMantineTheme();
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const setMode = useStore((s) => s.setMode);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    try {
      const viewer = new Viewer(containerRef.current!, {
        animation: false,
        timeline: false,
        baseLayerPicker: false,
        geocoder: false,
        homeButton: false,
        navigationHelpButton: false,
        sceneModePicker: false,
        terrainProvider: new EllipsoidTerrainProvider(),
      });
      const baseTemplate =
        import.meta.env.VITE_BASEMAP_TILE_URL || '/api/cartodb/positron/{z}/{x}/{y}.png';
      try {
        const provider = new UrlTemplateImageryProvider({
          url: baseTemplate,
          credit: 'Tiles © CartoDB, Data © OpenStreetMap contributors',
          minimumLevel: 0,
          maximumLevel: 18,
        });
        const layer0 = viewer.imageryLayers.get(0); // first layer
        if (layer0) viewer.imageryLayers.remove(layer0, true);
        viewer.imageryLayers.addImageryProvider(provider, 0);
      } catch (e) {
        console.warn('CesiumGlobe: operation failed', (e as Error).message);
      }
      const height = zoomToHeight(view.zoom);
      viewer.camera.setView({
        destination: Cartesian3.fromDegrees(view.lon, view.lat, height),
      });
      // Basic camera sync (debounced)
      let timer: ReturnType<typeof setTimeout> | null = null;
      viewer.camera.changed.addEventListener(() => {
        if (timer) return;
        timer = setTimeout(() => {
          timer = null;
        }, 400);
        const c = viewer.camera.positionCartographic;
        setView({
          lat: (c.latitude * 180) / Math.PI,
          lon: (c.longitude * 180) / Math.PI,
        });
      });
      if (!cancelled) setReady(true);
      viewerRef.current = viewer;
    } catch (e) {
      console.error('Cesium init failed; reverting to 2D', e);
      setMode('2d');
    }
    return () => {
      cancelled = true;
    };
  }, []);

  // Reactive GIBS layer (simple check each render; could optimize w/ ref)
  const viewerRef = useRef<InstanceType<typeof Viewer> | null>(null);
  // Keep direct references to primitives we add (avoid spelunking private fields)
  // Using `any` here avoids the Cesium type namespace limitation in this build context; we only store/remove the instance.
  const firmsRef = useRef<any>(null);
  const gibsOn = useStore((s) => s.gibsGeocolor3d);
  const gibsSelectedTime = useStore((s) => s.gibsSelectedTime);
  const gibsTimestamps = useStore((s) => s.gibsTimestamps);
  const showFirms = useStore((s) => s.showFirms3d);
  const showOwmTemp = useStore((s) => s.showOwmTemp3d);
  useEffect(() => {
    (async () => {
      if (!ready) return;
      const viewer = viewerRef.current;
      if (!viewer) return; // not yet initialized
      const layers = viewer.imageryLayers;
      const existing = (layers as unknown as { _layers: ImageryLayerInstance[] })._layers.find(
        (l) => {
          const credit = (l as CreditLike)._credit;
          return credit && /GOES-East GeoColor/i.test(credit.html || '');
        },
      );
      if (gibsOn) {
        // Determine time parameter (selected or latest available)
        const timeIso =
          gibsSelectedTime ||
          gibsTimestamps[gibsTimestamps.length - 1] ||
          new Date().toISOString().slice(0, 19) + 'Z';
        const template =
          import.meta.env.VITE_GIBS_WMTS_TILE_URL ||
          '/api/gibs/tile/GOES-East_ABI_GeoColor/{z}/{y}/{x}.jpg?time={time}';
        if (!existing) {
          // For Cesium, we use a template that will be filled by the tile provider
          // The {z}, {y}, {x} placeholders are handled by Cesium internally
          const provider = new UrlTemplateImageryProvider({
            url: template,
            credit: 'GOES-East GeoColor (NASA GIBS)',
          });
          layers.addImageryProvider(provider, 1);
        } else {
          // Recreate layer with new time (simpler than mutating template)
          layers.remove(existing, true);
          const provider = new UrlTemplateImageryProvider({
            url: template,
            credit: 'GOES-East GeoColor (NASA GIBS)',
          });
          layers.addImageryProvider(provider, 1);
        }
      } else if (!gibsOn && existing) {
        layers.remove(existing, true);
      }
    })();
  }, [gibsOn, ready, gibsSelectedTime, gibsTimestamps]);

  // FIRMS layer (points) using PointPrimitives for performance
  useEffect(() => {
    (async () => {
      if (!ready) return;
      const viewer = viewerRef.current;
      if (!viewer) return;
      // Remove existing collection if toggled off
      if (!showFirms) {
        if (firmsRef.current) {
          try {
            viewer.scene.primitives.remove(firmsRef.current);
          } catch (e) {
            console.warn('CesiumGlobe: operation failed', (e as Error).message);
          }
          firmsRef.current = null;
        }
        return;
      }
      if (firmsRef.current) return; // already added
      try {
        const r = await fetch('/api/firms/VIIRS_NOAA20_NRT/1');
        if (!r.ok) return;
        const csv = await r.text();
        const { firmsCsvToGeoJSON } = await import('../../util/util-firms');
        const gj = firmsCsvToGeoJSON(csv);
        const collection = new PointPrimitiveCollection();
        firmsRef.current = collection; // store reference
        const color = Color.ORANGERED.withAlpha(0.85);
        for (const f of gj.features) {
          const [lon, lat] = f.geometry.coordinates;
          collection.add({ position: Cartesian3.fromDegrees(lon, lat, 0), color, pixelSize: 6 });
        }
        viewer.scene.primitives.add(collection);
      } catch {
        /* ignore */
      }
    })();
  }, [showFirms, ready]);

  // OWM temperature overlay (simple raster using existing tile endpoint if available; fallback skip)
  useEffect(() => {
    (async () => {
      if (!ready) return;
      const viewer = viewerRef.current;
      if (!viewer) return;
      const layers = viewer.imageryLayers;
      const existing = (layers as unknown as { _layers: ImageryLayerInstance[] })._layers.find(
        (l) => {
          const credit = (l as CreditLike)._credit;
          return credit && /OWM Temperature/i.test(credit.html || '');
        },
      );
      if (!showOwmTemp && existing) {
        layers.remove(existing, true);
        return;
      }
      if (showOwmTemp && !existing) {
        // Use 'temp_new' layer name; adjust if environment variable provided
        const template = '/api/owm/tiles/temp_new/{z}/{x}/{y}.png';
        const provider = new UrlTemplateImageryProvider({
          url: template,
          credit: 'OWM Temperature (OpenWeatherMap)',
        });
        layers.addImageryProvider(provider, 2);
      }
    })();
  }, [showOwmTemp, ready]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        inset: 0,
        background: theme.colors.dark?.[9] || theme.black,
        visibility: ready ? 'visible' : 'hidden',
      }}
    />
  );
}
