import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState, useMemo } from 'react';
import { validateCatalog } from '../lib/validateCatalog';
import { useStore } from '../util/store';
import { Accordion, Group, Stack, Checkbox, Button, Text, Badge, Paper, NativeSelect, ActionIcon, Tooltip, Divider, } from '@mantine/core';
import { IconInfoCircle, IconPlayerPlay, IconPlayerPause, IconChevronLeft, IconChevronRight, IconArrowsMaximize, IconArrowsMinimize, } from '@tabler/icons-react';
export default function Panel({ onSelect, activeLayerSlug }) {
    const mode = useStore((s) => s.mode);
    const gibsOn = useStore((s) => s.gibsGeocolor3d);
    const gibsTimestamps = useStore((s) => s.gibsTimestamps);
    const setGibsTimestamps = useStore((s) => s.setGibsTimestamps);
    const gibsSelectedTime = useStore((s) => s.gibsSelectedTime);
    const setGibsSelectedTime = useStore((s) => s.setGibsSelectedTime);
    const gibsPlaying = useStore((s) => s.gibsPlaying);
    const toggleGibsPlaying = useStore((s) => s.toggleGibsPlaying);
    const stepGibsTime = useStore((s) => s.stepGibsTime);
    const gibsPlaybackSpeedMs = useStore((s) => s.gibsPlaybackSpeedMs);
    const setGibsPlaybackSpeed = useStore((s) => s.setGibsPlaybackSpeed);
    const showFirms3d = useStore((s) => s.showFirms3d);
    const toggleFirms3d = useStore((s) => s.toggleFirms3d);
    const showOwmTemp3d = useStore((s) => s.showOwmTemp3d);
    const toggleOwmTemp3d = useStore((s) => s.toggleOwmTemp3d);
    const [palette, setPalette] = useState(null);
    useEffect(() => {
        fetch('/catalog.json')
            .then(async (r) => {
            try {
                const raw = await r.json();
                try {
                    const validated = validateCatalog(Array.isArray(raw) ? raw : raw.layers || raw);
                    // Map generic validated layers into CatalogEntry, deriving category/label heuristically
                    const mapped = validated.map((l) => {
                        const record = l;
                        return {
                            slug: l.slug,
                            category: typeof record.category === 'string' ? record.category : 'General',
                            suggested_label: typeof record.suggested_label === 'string'
                                ? record.suggested_label
                                : typeof record.name === 'string'
                                    ? record.name
                                    : l.slug,
                            source_type: typeof record.type === 'string' ? record.type : undefined,
                            notes: typeof record.notes === 'string' ? record.notes : undefined,
                            attribution: typeof record.attribution === 'string' ? record.attribution : undefined,
                        };
                    });
                    return mapped;
                }
                catch (e) {
                    console.warn('Catalog validation failed (panel)', e);
                    return raw;
                }
            }
            catch {
                return null;
            }
        })
            .then((data) => {
            if (!data)
                return;
            if (Array.isArray(data))
                setPalette(data);
            else if (data && Array.isArray(data.layers))
                setPalette(data.layers);
        })
            .catch(() => { });
    }, []);
    // Group entries by category
    const grouped = useMemo(() => {
        if (!palette)
            return {};
        return palette.reduce((acc, e) => {
            const key = e.category || 'Other';
            (acc[key] = acc[key] || []).push(e);
            return acc;
        }, {});
    }, [palette]);
    // Categories list (stable ordering)
    const allCats = useMemo(() => Object.keys(grouped).sort(), [grouped]);
    // Controlled accordion open state (default: first 3 or all if <=3)
    const [openedCats, setOpenedCats] = useState(() => allCats.slice(0, 3));
    // Keep openedCats in sync if categories change
    useEffect(() => {
        setOpenedCats((prev) => {
            if (prev.length === 0)
                return prev; // respect fully collapsed state
            // Remove categories that disappeared
            const filtered = prev.filter((c) => allCats.includes(c));
            if (filtered.length === prev.length)
                return prev; // unchanged
            return filtered;
        });
    }, [allCats.join(',')]);
    const expandAll = () => setOpenedCats(allCats);
    const collapseAll = () => setOpenedCats([]);
    // Fetch GIBS timestamps when 3D + gibs active and none loaded yet
    useEffect(() => {
        if (mode !== '3d' || !gibsOn)
            return;
        if (gibsTimestamps.length > 0)
            return;
        fetch('/api/gibs/timestamps')
            .then((r) => r.json())
            .then((arr) => {
            if (Array.isArray(arr)) {
                setGibsTimestamps(arr);
                if (arr.length > 0)
                    setGibsSelectedTime(arr[arr.length - 1]); // latest
            }
        })
            .catch(() => { });
    }, [mode, gibsOn, gibsTimestamps.length]);
    return (_jsxs(Stack, { gap: "sm", p: 0, style: { fontSize: 13 }, children: [_jsxs(Group, { gap: "xs", wrap: "nowrap", justify: "space-between", children: [_jsxs(Group, { gap: "xs", wrap: "nowrap", children: [_jsx(Text, { fw: 600, children: "Layers" }), _jsx(Button, { size: "xs", variant: "outline", color: "storm", onClick: () => onSelect(''), children: "Clear" })] }), allCats.length > 0 && (_jsxs(Group, { gap: 4, wrap: "nowrap", children: [_jsx(Tooltip, { label: "Expand all", children: _jsx(ActionIcon, { size: "sm", variant: "light", "aria-label": "Expand all sections", onClick: expandAll, disabled: openedCats.length === allCats.length, children: _jsx(IconArrowsMaximize, { size: 16 }) }) }), _jsx(Tooltip, { label: "Collapse all", children: _jsx(ActionIcon, { size: "sm", variant: "light", "aria-label": "Collapse all sections", onClick: collapseAll, disabled: openedCats.length === 0, children: _jsx(IconArrowsMinimize, { size: 16 }) }) })] }))] }), !palette && (_jsx(Text, { size: "xs", c: "dimmed", children: "Loading palette\u2026" })), palette && (_jsx(Accordion, { multiple: true, chevronPosition: "left", variant: "contained", value: openedCats, onChange: (val) => setOpenedCats(Array.isArray(val) ? val : []), children: allCats.map((cat) => {
                    const list = grouped[cat];
                    return (_jsxs(Accordion.Item, { value: cat, children: [_jsx(Accordion.Control, { children: _jsxs(Group, { justify: "space-between", wrap: "nowrap", children: [_jsx(Text, { size: "sm", fw: 600, children: cat }), _jsx(Badge, { size: "xs", variant: "light", color: "storm", children: list.length })] }) }), _jsx(Accordion.Panel, { children: _jsx(Stack, { gap: 4, children: list.map((entry) => {
                                        const slug = entry.slug;
                                        const label = entry.suggested_label;
                                        const active = slug === activeLayerSlug;
                                        return (_jsx(Paper, { withBorder: true, p: 6, radius: "sm", shadow: active ? 'sm' : undefined, style: { cursor: 'pointer' }, onClick: () => onSelect(active ? '' : slug), children: _jsxs(Group, { justify: "space-between", gap: 6, wrap: "nowrap", children: [_jsxs(Group, { gap: 6, wrap: "nowrap", children: [_jsx(Checkbox, { "aria-label": `Toggle ${label}`, checked: active, onChange: () => onSelect(active ? '' : slug) }), _jsx(Text, { size: "xs", style: { maxWidth: 160 }, lineClamp: 1, children: label })] }), (entry.notes || entry.attribution) && (_jsx(Tooltip, { label: (entry.notes || '') +
                                                            (entry.attribution ? ` | ${entry.attribution}` : ''), children: _jsx(ActionIcon, { variant: "subtle", "aria-label": "Layer info", children: _jsx(IconInfoCircle, { size: 14 }) }) }))] }) }, slug));
                                    }) }) })] }, cat));
                }) })), mode === '3d' && gibsOn && (_jsxs(Stack, { gap: 6, mt: "sm", children: [_jsx(Divider, { label: _jsx(Text, { size: "xs", fw: 600, children: "GIBS Time" }), labelPosition: "left" }), gibsTimestamps.length === 0 && (_jsx(Text, { size: "xs", c: "dimmed", children: "Loading timestamps\u2026" })), gibsTimestamps.length > 0 && (_jsx(NativeSelect, { size: "xs", value: gibsSelectedTime || '', onChange: (e) => setGibsSelectedTime(e.currentTarget.value || null), data: gibsTimestamps.map((t) => ({ value: t, label: t })) })), gibsTimestamps.length > 0 && (_jsxs(Group, { gap: 4, children: [_jsx(ActionIcon, { variant: "light", onClick: () => stepGibsTime(-1), "aria-label": "Previous timestamp", disabled: !gibsTimestamps.length, children: _jsx(IconChevronLeft, { size: 16 }) }), _jsx(ActionIcon, { variant: "filled", color: "storm", onClick: toggleGibsPlaying, "aria-label": gibsPlaying ? 'Pause' : 'Play', children: gibsPlaying ? _jsx(IconPlayerPause, { size: 16 }) : _jsx(IconPlayerPlay, { size: 16 }) }), _jsx(ActionIcon, { variant: "light", onClick: () => stepGibsTime(1), "aria-label": "Next timestamp", disabled: !gibsTimestamps.length, children: _jsx(IconChevronRight, { size: 16 }) }), _jsx(NativeSelect, { size: "xs", value: String(gibsPlaybackSpeedMs), onChange: (e) => setGibsPlaybackSpeed(Number(e.currentTarget.value)), data: [
                                    { value: '2000', label: '0.5x' },
                                    { value: '1500', label: '1x' },
                                    { value: '800', label: '2x' },
                                    { value: '400', label: '4x' },
                                ], style: { width: 90 } })] })), gibsPlaying && _jsx(GibsPlaybackAdvance, {})] })), mode === '3d' && (_jsxs(Stack, { gap: 4, mt: "sm", children: [_jsx(Divider, { label: _jsx(Text, { size: "xs", fw: 600, children: "3D Data Layers" }), labelPosition: "left" }), _jsx(Checkbox, { size: "xs", label: "FIRMS Fire Detections", checked: showFirms3d, onChange: toggleFirms3d }), _jsx(Checkbox, { size: "xs", label: "OWM Temperature Overlay", checked: showOwmTemp3d, onChange: toggleOwmTemp3d })] }))] }));
}
// Component to advance playback using setInterval while mounted
function GibsPlaybackAdvance() {
    const gibsPlaying = useStore((s) => s.gibsPlaying);
    const gibsPlaybackSpeedMs = useStore((s) => s.gibsPlaybackSpeedMs);
    const step = useStore((s) => s.stepGibsTime);
    useEffect(() => {
        if (!gibsPlaying)
            return;
        const id = setInterval(() => step(1), gibsPlaybackSpeedMs);
        return () => clearInterval(id);
    }, [gibsPlaying, gibsPlaybackSpeedMs]);
    return null;
}
