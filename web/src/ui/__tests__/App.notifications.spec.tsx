import { describe, it, expect, vi, beforeEach } from 'vitest';
// Define mocks BEFORE importing App
vi.mock('@mantine/notifications', () => ({
  Notifications: () => null,
  notifications: { show: vi.fn() },
}));
vi.mock('../../components/Map', () => ({
  __esModule: true,
  default: () => <div data-testid="mock-map" />,
}));
import { renderWithMantine } from '../../test-utils/renderWithMantine';
import App from '../App';
import { notifications } from '@mantine/notifications';

describe('App notifications one-shot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it('shows tile proxy warning only once across multiple mounts', () => {
    renderWithMantine(<App />);
    renderWithMantine(<App />);
    expect(notifications.show).toHaveBeenCalledTimes(1);
  });
});
