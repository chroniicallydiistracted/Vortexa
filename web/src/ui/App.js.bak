import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import React, { useState, useEffect } from 'react';
import { AppShell, ScrollArea, Paper, TextInput, Loader, Group, Text, Checkbox, Button as MantineButton, } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import { validateCatalog } from '../lib/validateCatalog';
import { ModeSwitch } from '../map/ModeSwitch';
import Globe3DLoader from '../features/globe/Globe3DLoader';
import { getRuntimeFlags } from '../util/featureFlags';
// Legacy MapView/Panel removed; using modern catalog-based components
import CatalogPanel from '../components/components-Panel';
import Map from '../components/Map';
// TimeBar (Mantine) replaces legacy Timeline component
import { TimeBar } from '../components/TimeBar';
import { parseHash, decodeLayers } from '../util/permalink';
import { useStore } from '../state/state-store';
import { is3DEnabled } from '../lib/lib-env';
import { notifications } from '@mantine/notifications';
import { useDebouncedCallback } from 'use-debounce';
// URL mode initialization now handled inside store at module load.
export default function App() {
    const { setTime, replaceLayers, setView, mode, setMode, updateModeFromLocation, gibsGeocolor3d, toggleGibsGeocolor3d, playbackCurrentTimeMs, } = useStore();
    const [flags, setFlags] = useState({
        enable3d: false,
    });
    const [flagsReady, setFlagsReady] = useState(false);
    useEffect(() => {
        getRuntimeFlags()
            .then((f) => setFlags(f))
            .finally(() => setFlagsReady(true));
    }, []);
    const envEnable = is3DEnabled();
    // Support ?mode=3d and fallback #mode=3d (hash) for backward compatibility
    const searchParams = new URLSearchParams(location.search);
    let requestedMode = searchParams.get('mode');
    if (!requestedMode && window.location.hash) {
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        requestedMode = hashParams.get('mode');
    }
    const requested3d = requestedMode === '3d';
    // Until runtime flags are fetched, assume enabled to avoid premature downgrades in SSR/tests
    const canUse3D = envEnable && (flagsReady ? flags.enable3d : true);
    // debug: mode and 3d availability (removed verbose logging for production)
    // Update mode from location on mount to handle hash changes after store initialization
    useEffect(() => {
        updateModeFromLocation();
    }, [updateModeFromLocation]);
    useEffect(() => {
        const current = useStore.getState().mode;
        if (current === '3d' && mode === '3d')
            return; // don't downgrade
        if (requested3d && !canUse3D && mode === '3d')
            setMode('2d');
        if (requested3d && canUse3D && mode !== '3d')
            setMode('3d');
        if (!requested3d && mode === '3d' && !canUse3D)
            setMode('2d');
    }, [requested3d, canUse3D, mode, setMode]);
    // Persist (only if valid)
    useEffect(() => {
        const p = new URLSearchParams(location.search);
        if (mode === '3d' && canUse3D)
            p.set('mode', '3d');
        else
            p.delete('mode');
        const newUrl = `${location.pathname}?${p.toString()}${location.hash}`.replace(/\?$/, '');
        window.history.replaceState({}, '', newUrl);
    }, [mode, canUse3D]);
    // On initial mount, parse permalink hash
    useEffect(() => {
        if (location.hash) {
            const p = parseHash(location.hash);
            if (p.t)
                setTime(p.t);
            if (p.lat != null && p.lon != null)
                setView({ lat: p.lat, lon: p.lon });
            if (p.z != null)
                setView({ zoom: p.z });
            if (p.l) {
                const base = import.meta.env.VITE_TILE_BASE || 'http://localhost:4000/tiles';
                const ls = decodeLayers(p.l).map((l) => {
                    // heuristic map id to known template if preset; fallback noop layer placeholder
                    if (l.id === 'gibs-geocolor')
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
    const [activeLayerSlug, setActiveLayerSlug] = useState(null);
    const [catalogData, setCatalogData] = useState(null);
    const mappedCatalog = React.useMemo(() => {
        if (!catalogData)
            return null;
        const arr = Array.isArray(catalogData)
            ? catalogData
            : Array.isArray(catalogData.layers)
                ? catalogData.layers
                : [];
        return arr.map((l) => ({
            slug: l.slug,
            category: l.category ?? 'General',
            suggested_label: l.suggested_label ?? l.name ?? l.slug,
            source_type: l.type ?? 'raster',
            tile_url_template: l.template,
            api_endpoint: l.url,
            time_format: undefined,
            attribution: l.attribution,
            notes: l.notes,
        }));
    }, [catalogData]);
    useEffect(() => {
        fetch('/catalog.json')
            .then(async (r) => {
            try {
                const raw = await r.json();
                try {
                    return validateCatalog(raw);
                }
                catch (e) {
                    console.warn('Catalog validation failed', e);
                    return raw; // fallback to raw for non-breaking behavior
                }
            }
            catch {
                return null;
            }
        })
            .then(setCatalogData)
            .catch(() => { });
    }, []);
    // Centralized playback state from store
    const { playbackBaseStartMs: baseStart, playbackHoursSpan: hoursSpan, playbackCurrentTimeMs: currentTime, playbackSpeed: speed, setPlaybackCurrentTimeMs, setPlaybackSpeed, } = useStore();
    const [isPlaying, setIsPlaying] = useState(false); // keep play/pause locally for now
    // Search state
    const [search, setSearch] = useState('');
    const [results, setResults] = useState([]);
    const [searchLoading, setSearchLoading] = useState(false);
    // One-time tile proxy fallback notification (persist across mounts)
    // @ts-ignore - attach to module scope variable
    let _tileProxyWarned = globalThis.__TILE_PROXY_WARNED__ || false;
    const tileBase = import.meta.env.VITE_TILE_BASE || 'http://localhost:4000/tiles';
    useEffect(() => {
        if (!_tileProxyWarned && (!import.meta.env.VITE_TILE_BASE || tileBase.includes('localhost'))) {
            globalThis.__TILE_PROXY_WARNED__ = true;
            _tileProxyWarned = true;
            notifications.show({
                color: 'yellow',
                title: 'Using default tile proxy',
                message: `Falling back to ${tileBase}. Set VITE_TILE_BASE in web/.env.local to remove this message.`,
            });
        }
    }, [tileBase, _tileProxyWarned]);
    const [mapInstance, setMapInstance] = useState(null);
    useEffect(() => {
        if (!search) {
            setResults([]);
            return;
        }
        const handle = setTimeout(() => {
            setSearchLoading(true);
            fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(search)}`)
                .then((r) => r.json())
                .then((data) => {
                setResults(data || []);
            })
                .catch(() => setResults([]))
                .finally(() => setSearchLoading(false));
        }, 300);
        return () => clearTimeout(handle);
    }, [search]);
    const flyToResult = (r) => {
        if (!mapInstance)
            return;
        const lat = parseFloat(r.lat);
        const lon = parseFloat(r.lon);
        if (Number.isFinite(lat) && Number.isFinite(lon)) {
            mapInstance.flyTo({ center: [lon, lat], zoom: 8 });
        }
    };
    // Debounced permalink update for time changes (hash only for now)
    const debouncedHashUpdate = useDebouncedCallback(() => {
        const dt = new Date(playbackCurrentTimeMs);
        // encode date hour in ISO minute precision
        const iso = dt.toISOString().slice(0, 16).replace(/[-:T]/g, '').toLowerCase();
        const existing = parseHash(location.hash);
        existing.t = iso; // reuse t key (already used for date-only earlier)
        const params = [];
        if (existing.t)
            params.push(`t=${existing.t}`);
        if (existing.lat != null && existing.lon != null)
            params.push(`lat=${existing.lat}&lon=${existing.lon}`);
        if (existing.z != null)
            params.push(`z=${existing.z}`);
        if (existing.l)
            params.push(`l=${existing.l}`);
        const newHash = params.length ? `#${params.join('&')}` : '';
        if (newHash !== location.hash) {
            history.replaceState({}, '', `${location.pathname}${location.search}${newHash}`);
        }
    }, 400);
    useEffect(() => {
        debouncedHashUpdate();
    }, [playbackCurrentTimeMs]);
    return (_jsxs(AppShell, { header: { height: 0 }, navbar: { width: 360, breakpoint: 'sm', collapsed: { mobile: false } }, padding: 0, children: [_jsx(AppShell.Navbar, { p: "xs", children: _jsx(ScrollArea, { style: { height: '100%' }, children: _jsx(CatalogPanel, { onSelect: setActiveLayerSlug, activeLayerSlug: activeLayerSlug }) }) }), _jsxs(AppShell.Main, { style: { position: 'relative' }, children: [mode === '2d' && (_jsx(_Fragment, { children: _jsx(Map, { activeLayerSlug: activeLayerSlug, catalog: mappedCatalog, onMapReady: setMapInstance, currentTime: currentTime }) })), mode === '3d' && canUse3D && _jsx(Globe3DLoader, {}), _jsx(ModeSwitch, { mode: mode, setMode: setMode, canUse3D: canUse3D }), mode === '3d' && canUse3D && (_jsx(Paper, { withBorder: true, shadow: "sm", p: "xs", style: { position: 'absolute', top: 70, right: 8, zIndex: 20 }, children: _jsx(Checkbox, { size: "xs", label: "GIBS GeoColor", checked: gibsGeocolor3d, onChange: () => toggleGibsGeocolor3d() }) })), _jsx(Paper, { withBorder: true, shadow: "sm", p: "xs", style: { position: 'absolute', left: 8, top: 8, zIndex: 15 }, children: _jsxs(Group, { gap: 6, align: "center", children: [_jsx(Text, { size: "xs", c: "dimmed", children: "Catalog Demo" }), _jsx(MantineButton, { size: "xs", variant: "light", color: "storm", children: "Mantine" })] }) }), _jsxs(Paper, { withBorder: true, shadow: "sm", p: "xs", style: {
                            position: 'absolute',
                            top: 8,
                            left: '50%',
                            transform: 'translateX(-50%)',
                            zIndex: 20,
                            width: 'min(480px,80%)',
                        }, children: [_jsx(TextInput, { placeholder: "Search location\u2026", leftSection: _jsx(IconSearch, { size: 16 }), value: search, onChange: (e) => setSearch(e.currentTarget.value), size: "xs" }), searchLoading && (_jsxs(Group, { gap: 4, mt: 4, children: [_jsx(Loader, { size: "xs" }), _jsx(Text, { size: "xs", c: "dimmed", children: "Searching\u2026" })] })), !searchLoading && results.length > 0 && (_jsx(Paper, { withBorder: true, mt: 6, p: 4, radius: "sm", style: { maxHeight: 220, overflowY: 'auto' }, children: results.slice(0, 8).map((r) => (_jsx(Text, { size: "xs", style: { cursor: 'pointer' }, onClick: () => flyToResult(r), title: r.display_name, children: r.display_name }, r.place_id))) }))] }), _jsx(TimeBar, { playing: isPlaying, togglePlay: () => setIsPlaying((p) => !p), baseStart: baseStart, hoursSpan: hoursSpan, currentTime: currentTime, setCurrentTime: (t) => {
                            const resolve = (m, a) => typeof m === 'function' ? m(a) : m;
                            setPlaybackCurrentTimeMs(resolve(t, currentTime));
                        }, currentDate: new Date(currentTime), setCurrentDate: (d) => {
                            // keep hour index
                            const hourMs = 3600_000;
                            const base = new Date(d.getTime());
                            base.setUTCHours(0, 0, 0, 0);
                            const hourOffset = Math.round((currentTime - baseStart) / hourMs) % hoursSpan;
                            const newTime = base.getTime() + hourOffset * hourMs;
                            setPlaybackCurrentTimeMs(newTime);
                        }, hourValue: Math.round((currentTime - baseStart) / 3600_000), setHourValue: (n) => setPlaybackCurrentTimeMs(baseStart + n * 3600_000), speed: speed, setSpeed: (label) => {
                            if (label)
                                setPlaybackSpeed(label);
                        } })] })] }));
}
