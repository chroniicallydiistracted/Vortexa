import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { MantineProvider } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import { Notifications } from '@mantine/notifications';
import { render } from '@testing-library/react';
import { vortexaTheme } from '../theme';
export function renderWithMantine(ui) {
    // Ensure matchMedia available (some test runners may load this file before vitest.setup executes fully)
    if (typeof window !== 'undefined' && !('matchMedia' in window)) {
        window.matchMedia = (query) => ({
            matches: false,
            media: query,
            onchange: null,
            addListener() { },
            removeListener() { },
            addEventListener() { },
            removeEventListener() { },
            dispatchEvent() {
                return false;
            },
        });
    }
    return render(_jsx(MantineProvider, { theme: vortexaTheme, children: _jsxs(ModalsProvider, { children: [_jsx(Notifications, {}), ui] }) }));
}
