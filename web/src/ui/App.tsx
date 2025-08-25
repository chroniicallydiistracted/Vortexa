import React, { useState, useEffect } from "react";
import { AppShell, ScrollArea, Paper, TextInput, Loader, Group, Text, Checkbox, Button as MantineButton } from "@mantine/core";
import { IconSearch } from "@tabler/icons-react";
import { validateCatalog } from "../lib/validateCatalog";
import { Button } from "@mantine/core";
import { ModeSwitch } from "../map/ModeSwitch";
import Globe3DLoader from "../features/globe/Globe3DLoader";
import { getRuntimeFlags } from "../util/featureFlags";
// Legacy components (MapView, Panel) retained elsewhere; using new catalog-based components here
import CatalogPanel from "../components/Panel";
import CatalogMap from "../components/Map";
import Timeline from "../components/Timeline";
import { parseHash, decodeLayers } from "../util/permalink";
import { useStore } from "../util/store";
export default function App() {
  const tileEnv = (import.meta as any).env?.VITE_TILE_BASE;
  const [hideBanner, setHideBanner] = useState(false);
  const showBanner = !tileEnv && !hideBanner;
  const {
    setTime,
    replaceLayers,
    setView,
    mode,
    setMode,
    gibsGeocolor3d,
    toggleGibsGeocolor3d,
  } = useStore();
  const [flags, setFlags] = useState<{ enable3d: boolean }>({
    enable3d: false,
  });
  useEffect(() => {
    getRuntimeFlags().then(setFlags);
  }, []);
  const envEnable = (import.meta as any).env?.VITE_ENABLE_3D === "1";
  const params = new URLSearchParams(location.search);
  const requested3d = params.get("mode") === "3d";
  const canUse3D = envEnable && flags.enable3d;
  // Coerce mode based on gating (do not allow 3D if flags off)
  useEffect(() => {
    if (requested3d && !canUse3D && mode === "3d") {
      setMode("2d");
    } else if (requested3d && canUse3D && mode !== "3d") {
      setMode("3d");
    }
    if (!requested3d && mode === "3d" && !canUse3D) setMode("2d");
  }, [requested3d, canUse3D]);
  // Persist (only if valid)
  useEffect(() => {
    const p = new URLSearchParams(location.search);
    if (mode === "3d" && canUse3D) p.set("mode", "3d");
    else p.delete("mode");
    const newUrl =
      `${location.pathname}?${p.toString()}${location.hash}`.replace(/\?$/, "");
    window.history.replaceState({}, "", newUrl);
  }, [mode, canUse3D]);
  // On initial mount, parse permalink hash
  useEffect(() => {
    if (location.hash) {
      const p = parseHash(location.hash);
      if (p.t) setTime(p.t);
      if (p.lat != null && p.lon != null) setView({ lat: p.lat, lon: p.lon });
      if (p.z != null) setView({ zoom: p.z });
      if (p.l) {
        const base =
          (import.meta as any).env?.VITE_TILE_BASE ||
          "http://localhost:4000/tiles";
        const ls = decodeLayers(p.l).map((l) => {
          // heuristic map id to known template if preset; fallback noop layer placeholder
          if (l.id === "gibs-geocolor")
            return {
              id: l.id,
              templateRaw: `${base}/wmts?base=https%3A%2F%2Fgibs.earthdata.nasa.gov%2Fwmts&layer=GOES-East_ABI_GeoColor&format=jpg&time={time}&z={z}&x={x}&y={y}`,
              opacity: l.opacity,
            };
          return {
            id: l.id,
            templateRaw: `${base}/wmts?base=https%3A%2F%2Fgibs.earthdata.nasa.gov%2Fwmts&layer=${encodeURIComponent(l.id)}&time={time}&z={z}&x={x}&y={y}`,
            opacity: l.opacity,
          };
        });
        replaceLayers(ls);
      }
    }
  }, []);
  const [activeLayerSlug, setActiveLayerSlug] = useState<string | null>(null);
  const [catalogData, setCatalogData] = useState<any>(null); // now array
  useEffect(() => {
    fetch("/catalog.json")
      .then(async (r) => {
        try {
          const raw = await r.json();
          try {
            return validateCatalog(raw);
          } catch (e) {
            console.warn("Catalog validation failed", e);
            return raw; // fallback to raw for non-breaking behavior
          }
        } catch {
          return null;
        }
      })
      .then(setCatalogData)
      .catch(() => {});
  }, []);
  // Time & playback state
  const hourMs = 3600_000;
  const [baseStart] = useState(() => {
    const d = new Date();
    d.setMinutes(0, 0, 0); // truncate to hour
    return d.getTime() - 24 * hourMs; // start 24h ago
  });
  const [currentTime, setCurrentTime] = useState(() => baseStart + 24 * hourMs); // now (end of window)
  const [isPlaying, setIsPlaying] = useState(false);
  const [isUserScrubbing, setIsUserScrubbing] = useState(false);
  const hoursSpan = 48; // show 48h window
  // Search state
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [mapInstance, setMapInstance] = useState<any>(null);
  useEffect(() => {
    if (!search) {
      setResults([]);
      return;
    }
    const handle = setTimeout(() => {
      setSearchLoading(true);
      fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(search)}`,
      )
        .then((r) => r.json())
        .then((data) => {
          setResults(data || []);
        })
        .catch(() => setResults([]))
        .finally(() => setSearchLoading(false));
    }, 300);
    return () => clearTimeout(handle);
  }, [search]);
  const flyToResult = (r: any) => {
    if (!mapInstance) return;
    const lat = parseFloat(r.lat);
    const lon = parseFloat(r.lon);
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      mapInstance.flyTo({ center: [lon, lat], zoom: 8 });
    }
  };
  return (
    <AppShell
      header={{ height: 0 }}
      navbar={{ width: 360, breakpoint: "sm", collapsed: { mobile: false } }}
      padding={0}
   >
      <AppShell.Navbar p="xs">
        <ScrollArea style={{ height: "100%" }}>
          <CatalogPanel
            onSelect={setActiveLayerSlug}
            activeLayerSlug={activeLayerSlug}
          />
        </ScrollArea>
      </AppShell.Navbar>
      <AppShell.Main style={{ position: "relative" }}>
        {mode === "2d" && (
          <CatalogMap
            activeLayerSlug={activeLayerSlug}
            catalog={catalogData}
            onMapReady={setMapInstance}
            currentTime={currentTime}
          />
        )}
        {mode === "3d" && canUse3D && <Globe3DLoader />}
        <ModeSwitch mode={mode} setMode={setMode} canUse3D={canUse3D} />
        {mode === "3d" && canUse3D && (
          <Paper withBorder shadow="sm" p="xs" style={{ position: "absolute", top: 70, right: 8, zIndex: 20 }}>
            <Checkbox
              size="xs"
              label="GIBS GeoColor"
              checked={gibsGeocolor3d}
              onChange={() => toggleGibsGeocolor3d()}
            />
          </Paper>
        )}
        <Paper withBorder shadow="sm" p="xs" style={{ position: "absolute", left: 8, top: 8, zIndex: 15 }}>
          <Group gap={6} align="center">
            <Text size="xs" c="dimmed">
              Catalog Demo
            </Text>
            <MantineButton size="xs" variant="light" color="storm">
              Mantine
            </MantineButton>
          </Group>
        </Paper>
        <Paper
          withBorder
          shadow="sm"
          p="xs"
          style={{ position: "absolute", top: 8, left: "50%", transform: "translateX(-50%)", zIndex: 20, width: "min(480px,80%)" }}
        >
          <TextInput
            placeholder="Search location…"
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            size="xs"
          />
          {searchLoading && (
            <Group gap={4} mt={4}>
              <Loader size="xs" />
              <Text size="xs" c="dimmed">
                Searching…
              </Text>
            </Group>
          )}
          {!searchLoading && results.length > 0 && (
            <Paper withBorder mt={6} p={4} radius="sm" style={{ maxHeight: 220, overflowY: "auto" }}>
              {results.slice(0, 8).map((r) => (
                <Text
                  key={r.place_id}
                  size="xs"
                  style={{ cursor: "pointer" }}
                  onClick={() => flyToResult(r)}
                  title={r.display_name}
                >
                  {r.display_name}
                </Text>
              ))}
            </Paper>
          )}
        </Paper>
        <Timeline
          playing={isPlaying}
          onToggle={() => setIsPlaying((p) => !p)}
          currentTime={currentTime}
          setCurrentTime={(t) =>
            setCurrentTime(typeof t === "function" ? (t as any)(currentTime) : t)
          }
          baseStart={baseStart}
          hoursSpan={hoursSpan}
          isUserScrubbing={isUserScrubbing}
          setIsUserScrubbing={setIsUserScrubbing}
        />
      </AppShell.Main>
    </AppShell>
  );
}

// Removed legacy inline style objects (replaced by Mantine components)
