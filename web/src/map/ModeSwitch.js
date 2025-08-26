import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { SegmentedControl, Paper, Text } from '@mantine/core';
export function ModeSwitch({ mode, setMode, canUse3D, }) {
    if (!canUse3D)
        return null;
    return (_jsxs(Paper, { withBorder: true, shadow: "sm", p: "xs", style: { position: 'absolute', top: 8, right: 8, zIndex: 20, width: 220 }, children: [_jsx(Text, { size: "xs", c: "dimmed", mb: 4, fw: 500, children: "Mode" }), _jsx(SegmentedControl, { fullWidth: true, size: "xs", value: mode, onChange: (v) => setMode(v), data: [
                    { label: '2D Map', value: '2d' },
                    { label: '3D Globe', value: '3d' },
                ] })] }));
}
