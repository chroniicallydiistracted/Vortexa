import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { Paper, Group, ActionIcon, Slider, Select, Text } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { IconPlayerPlay, IconPlayerPause } from '@tabler/icons-react';
const speedMap = {
    '0.5x': 2000,
    '1x': 1000,
    '2x': 500,
    '4x': 250,
};
export function TimeBar({ playing, togglePlay, baseStart, hoursSpan, currentTime, setCurrentTime, currentDate, setCurrentDate, hourValue, setHourValue, speed, setSpeed, onTempChange, onCommit, testEventBridge = false, }) {
    const hourMs = 3600_000;
    // Local optimistic slider value to avoid excessive store writes while dragging
    const [tempVal, setTempVal] = useState(hourValue);
    const draggingRef = useRef(false);
    const sliderBridgeRef = useRef(null);
    useEffect(() => {
        if (!draggingRef.current)
            setTempVal(hourValue);
    }, [hourValue]);
    // Test event bridge: allow unit tests to dispatch CustomEvents instead of low-level pointer simulation
    useEffect(() => {
        if (!testEventBridge || !sliderBridgeRef.current)
            return;
        const el = sliderBridgeRef.current;
        const tempHandler = (e) => {
            const ce = e;
            const v = ce.detail?.value ?? 0;
            draggingRef.current = true;
            setTempVal(v);
            onTempChange?.(v);
        };
        const commitHandler = (e) => {
            const ce = e;
            const v = ce.detail?.value ?? 0;
            draggingRef.current = false;
            setTempVal(v);
            setHourValue(v);
            setCurrentTime(baseStart + v * 3600_000);
            onCommit?.(v);
        };
        el.addEventListener('temp-change', tempHandler);
        el.addEventListener('commit-change', commitHandler);
        return () => {
            el.removeEventListener('temp-change', tempHandler);
            el.removeEventListener('commit-change', commitHandler);
        };
    }, [testEventBridge, baseStart, setHourValue, setCurrentTime, onTempChange, onCommit]);
    // Playback loop using selected speed
    useEffect(() => {
        if (!playing)
            return;
        const interval = speedMap[speed] ?? 1000;
        const id = setInterval(() => {
            const cap = baseStart + hoursSpan * hourMs;
            const next = currentTime + hourMs;
            const looped = next > cap ? baseStart : next;
            const newIndex = Math.round((looped - baseStart) / hourMs);
            setHourValue(newIndex);
            setCurrentTime(looped);
        }, interval);
        return () => clearInterval(id);
    }, [playing, speed, currentTime, baseStart, hoursSpan, setCurrentTime, setHourValue]);
    const isoLabel = new Date(currentTime).toISOString().replace('T', ' ').substring(0, 16) + 'Z';
    return (_jsx(Paper, { withBorder: true, shadow: "sm", p: "xs", style: {
            position: 'absolute',
            left: '50%',
            bottom: 12,
            transform: 'translateX(-50%)',
            zIndex: 20,
            width: 'min(720px,92%)',
        }, children: _jsxs(Group, { gap: "xs", wrap: "nowrap", align: "center", children: [_jsx(ActionIcon, { variant: "filled", color: "storm", onClick: togglePlay, "aria-label": playing ? 'Pause' : 'Play', children: playing ? _jsx(IconPlayerPause, { size: 16 }) : _jsx(IconPlayerPlay, { size: 16 }) }), _jsx("div", { ref: sliderBridgeRef, "data-testid": "timebar-slider", style: { flex: 1 }, children: _jsx(Slider, { value: tempVal, min: 0, max: hoursSpan, step: 1, style: { width: '100%' }, onChange: (v) => {
                            draggingRef.current = true;
                            setTempVal(v);
                            onTempChange?.(v);
                        }, onChangeEnd: (v) => {
                            draggingRef.current = false;
                            setHourValue(v);
                            setCurrentTime(baseStart + v * hourMs);
                            onCommit?.(v);
                        }, marks: [{ value: 0 }, { value: Math.floor(hoursSpan / 2) }, { value: hoursSpan }] }) }), _jsx(DateInput, { value: currentDate, onChange: (val) => {
                        if (!val)
                            return;
                        const raw = val;
                        const d = raw instanceof Date ? raw : new Date(raw);
                        if (Number.isNaN(d.getTime()))
                            return;
                        setCurrentDate(d);
                        const newTime = new Date(d.getTime());
                        newTime.setUTCHours(0, 0, 0, 0);
                        const offsetMs = (tempVal || 0) * hourMs;
                        setCurrentTime(newTime.getTime() + offsetMs);
                    }, size: "xs", valueFormat: "YYYY-MM-DD", "aria-label": "Date" }), _jsx(Select, { size: "xs", "aria-label": "Playback speed", data: ['0.5x', '1x', '2x', '4x'], value: speed, onChange: (v) => v && setSpeed(v), w: 80 }), _jsx(Text, { size: "xs", ff: "monospace", c: "dimmed", style: { minWidth: 130, textAlign: 'right' }, children: isoLabel })] }) }));
}
