import { jsx as _jsx } from "react/jsx-runtime";
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithMantine } from '../../test-utils/renderWithMantine';
import App from '../App';
import { act } from '@testing-library/react';
import { useStore } from '../../util/store';
// Mock heavy map
vi.mock('../../components/Map', () => ({
    __esModule: true,
    default: () => _jsx("div", { "data-testid": "mock-map" }),
}));
describe('App permalink debounce', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.clearAllMocks();
    });
    afterEach(() => {
        vi.useRealTimers();
    });
    it('debounces hash updates to <=1 per 400ms burst and uses last value', async () => {
        const spy = vi.spyOn(window.history, 'replaceState');
        renderWithMantine(_jsx(App, {}));
        // Initial mount may call replaceState for mode sync; ignore those
        spy.mockClear();
        const base = useStore.getState().playbackCurrentTimeMs;
        for (let i = 1; i <= 5; i++) {
            act(() => {
                useStore.getState().setPlaybackCurrentTimeMs(base + i * 3600_000);
            });
        }
        expect(spy).toHaveBeenCalledTimes(0);
        await vi.advanceTimersByTimeAsync(399);
        expect(spy).toHaveBeenCalledTimes(0);
        await vi.advanceTimersByTimeAsync(2);
        expect(spy).toHaveBeenCalledTimes(1);
        const urlArg = spy.mock.calls.at(-1)?.[2];
        expect(urlArg).toContain('t=');
        const finalHour = new Date(base + 5 * 3600_000).toISOString().slice(11, 13);
        const match = urlArg.match(/t=([0-9]{10})/i); // yyyymmddHHmm truncated pattern
        if (match) {
            const hourInHash = match[1].slice(8, 10);
            expect(hourInHash).toBe(finalHour);
        }
        else {
            throw new Error('Hash format mismatch');
        }
    });
});
