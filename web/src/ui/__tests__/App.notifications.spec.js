import { jsx as _jsx } from "react/jsx-runtime";
import { describe, it, expect, vi, beforeEach } from 'vitest';
// Define mocks BEFORE importing App
vi.mock('@mantine/notifications', () => ({
    Notifications: () => null,
    notifications: { show: vi.fn() },
}));
vi.mock('../../components/Map', () => ({
    __esModule: true,
    default: () => _jsx("div", { "data-testid": "mock-map" }),
}));
import { renderWithMantine } from '../../test-utils/renderWithMantine';
import App from '../App';
import { notifications } from '@mantine/notifications';
describe('App notifications one-shot', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    it('shows tile proxy warning only once across multiple mounts', () => {
        renderWithMantine(_jsx(App, {}));
        renderWithMantine(_jsx(App, {}));
        expect(notifications.show).toHaveBeenCalledTimes(1);
    });
});
