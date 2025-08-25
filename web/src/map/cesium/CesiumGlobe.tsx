import React, { useEffect, useRef, useState } from "react";
import { useMantineTheme } from '@mantine/core';
import { useStore } from "../../util/store";
import { zoomToHeight } from "../../util/zoomHeight";

export function CesiumGlobe() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const theme = useMantineTheme();
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const setMode = useStore((s) => s.setMode);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const Cesium = await import("cesium");
  // CESIUM_BASE_URL removed: no external /cesium asset requests observed, assets bundled.
        const {
          Viewer,
          EllipsoidTerrainProvider,
          Cartesian3,
          UrlTemplateImageryProvider,
          WebMapTileServiceImageryProvider,
        } = Cesium as any;
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
          (import.meta as any).env?.VITE_BASEMAP_TILE_URL ||
          "/api/cartodb/positron/{z}/{x}/{y}.png";
        try {
          const provider = new UrlTemplateImageryProvider({
            url: baseTemplate,
            credit: "Tiles © CartoDB, Data © OpenStreetMap contributors",
            minimumLevel: 0,
            maximumLevel: 18,
          });
          const layer0 = viewer.imageryLayers.get(0);
          if (layer0) viewer.imageryLayers.remove(layer0, true);
          viewer.imageryLayers.addImageryProvider(provider, 0);
        } catch {}
        const height = zoomToHeight(view.zoom);
        viewer.camera.setView({
          destination: Cartesian3.fromDegrees(view.lon, view.lat, height),
        });
        // Basic camera sync (debounced)
        let timer: any = null;
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
      } catch (e) {
        console.error("Cesium init failed; reverting to 2D", e);
        setMode("2d");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Reactive GIBS layer (simple check each render; could optimize w/ ref)
  const gibsOn = useStore((s) => s.gibsGeocolor3d);
  const gibsSelectedTime = useStore((s) => s.gibsSelectedTime);
  const gibsTimestamps = useStore((s) => s.gibsTimestamps);
  const showFirms = useStore((s) => s.showFirms3d);
  const showOwmTemp = useStore((s) => s.showOwmTemp3d);
  useEffect(() => {
    (async () => {
      if (!ready) return;
      const Cesium = await import("cesium");
      const viewer =
        (Cesium as any).Viewer?.instances?.[0] ||
        (document.querySelector("canvas.cesium-widget") as any)?._cesiumWidget
          ?.viewer; // fallback heuristic
      if (!viewer) return;
      const layers = viewer.imageryLayers;
      const existing = layers._layers.find(
        (l: any) =>
          l._credit && /GOES-East GeoColor/i.test(l._credit?.html || ""),
      );
      if (gibsOn) {
        // Determine time parameter (selected or latest available)
        const timeIso =
          gibsSelectedTime ||
          gibsTimestamps[gibsTimestamps.length - 1] ||
          new Date().toISOString().slice(0, 19) + "Z";
        const template =
          (import.meta as any).env?.VITE_GIBS_WMTS_TILE_URL ||
          "/api/gibs/geocolor/{z}/{x}/{y}.jpg?time={time}";
        if (!existing) {
          const url = template
            .replace("{TileMatrix}", "{z}")
            .replace("{TileRow}", "{y}")
            .replace("{TileCol}", "{x}")
            .replace("{time}", encodeURIComponent(timeIso));
          const provider = new (Cesium as any).UrlTemplateImageryProvider({
            url,
            credit: "GOES-East GeoColor (NASA GIBS)",
          });
          layers.addImageryProvider(provider, 1);
        } else {
          // Recreate layer with new time (simpler than mutating template)
          layers.remove(existing, true);
          const url = template
            .replace("{TileMatrix}", "{z}")
            .replace("{TileRow}", "{y}")
            .replace("{TileCol}", "{x}")
            .replace("{time}", encodeURIComponent(timeIso));
          const provider = new (Cesium as any).UrlTemplateImageryProvider({
            url,
            credit: "GOES-East GeoColor (NASA GIBS)",
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
      const Cesium = await import("cesium");
      const viewer =
        (Cesium as any).Viewer?.instances?.[0] ||
        (document.querySelector("canvas.cesium-widget") as any)?._cesiumWidget
          ?.viewer;
      if (!viewer) return;
      // Remove existing collection if toggled off
      if (!showFirms) {
        const existing = (viewer.scene.primitives as any)._primitives.find(
          (p: any) => p._westfamTag === "firms",
        );
        if (existing) viewer.scene.primitives.remove(existing);
        return;
      }
      // If already present do nothing
      const exists = (viewer.scene.primitives as any)._primitives.find(
        (p: any) => p._westfamTag === "firms",
      );
      if (exists) return;
      try {
        const r = await fetch("/api/firms/VIIRS_NOAA20_NRT/1");
        if (!r.ok) return;
        const csv = await r.text();
        const { firmsCsvToGeoJSON } = await import("../../util/firms");
        const gj = firmsCsvToGeoJSON(csv);
        const collection = new (Cesium as any).PointPrimitiveCollection();
        (collection as any)._westfamTag = "firms";
        const color = (Cesium as any).Color.ORANGERED.withAlpha(0.85);
        for (const f of gj.features) {
          const [lon, lat] = f.geometry.coordinates;
          collection.add({
            position: (Cesium as any).Cartesian3.fromDegrees(lon, lat),
            color,
            pixelSize: 6,
          });
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
      const Cesium = await import("cesium");
      const viewer =
        (Cesium as any).Viewer?.instances?.[0] ||
        (document.querySelector("canvas.cesium-widget") as any)?._cesiumWidget
          ?.viewer;
      if (!viewer) return;
      const layers = viewer.imageryLayers;
      const existing = layers._layers.find(
        (l: any) => l._credit && /OWM Temperature/i.test(l._credit?.html || ""),
      );
      if (!showOwmTemp && existing) {
        layers.remove(existing, true);
        return;
      }
      if (showOwmTemp && !existing) {
        // Use 'temp_new' layer name; adjust if environment variable provided
        const template = "/api/owm/tiles/temp_new/{z}/{x}/{y}.png";
        const provider = new (Cesium as any).UrlTemplateImageryProvider({
          url: template,
          credit: "OWM Temperature (OpenWeatherMap)",
        });
        layers.addImageryProvider(provider, 2);
      }
    })();
  }, [showOwmTemp, ready]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        inset: 0,
  background: theme.colors.dark?.[9] || theme.black,
        visibility: ready ? "visible" : "hidden",
      }}
    />
  );
}
