import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithMantine } from '../../test-utils/renderWithMantine';

vi.mock('../../components/Map', () => ({ default: () => null }));
vi.mock('../../map/cesium/CesiumGlobe', () => ({ default: () => null }));

describe('App mode permalink + env gating', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    window.history.replaceState(null, '', '/');
  });

  it('restores 3D mode from ?mode=3d when VITE_ENABLE_3D=1', async () => {
    process.env.VITE_ENABLE_3D = '1';
    vi.stubEnv('VITE_ENABLE_3D', '1');
    window.history.replaceState(null, '', '/?mode=3d');

  const { useStore } = await import('../../state/store');
  const { default: App } = await import('../App');
  renderWithMantine(<App />);
  expect(useStore.getState().mode).toBe('3d');
  });

  it('coerces to 2D when VITE_ENABLE_3D=0 even if ?mode=3d present', async () => {
    process.env.VITE_ENABLE_3D = '0';
    vi.stubEnv('VITE_ENABLE_3D', '0');
    window.history.replaceState(null, '', '/?mode=3d');

  const { useStore } = await import('../../state/store');
  const { default: App } = await import('../App');
  renderWithMantine(<App />);
  expect(useStore.getState().mode).toBe('2d');
  });

  it('accepts #mode=3d (hash fallback) when enabled', async () => {
    process.env.VITE_ENABLE_3D = '1';
    vi.stubEnv('VITE_ENABLE_3D', '1');
    window.history.replaceState(null, '', '/#mode=3d');

  const { useStore } = await import('../../state/store');
  const { default: App } = await import('../App');
  renderWithMantine(<App />);
  expect(useStore.getState().mode).toBe('3d');
  });
});
