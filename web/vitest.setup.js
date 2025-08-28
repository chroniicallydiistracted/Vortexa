import { expect, vi } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
// vitest-axe provides a matcher factory; require dynamically to avoid TS type issues
let axeMatchers = {};
try {
  // Attempt to load vitest-axe (optional in some environments)
  // It exports "toHaveNoViolations" in its default export object shape
  // Using require to bypass ESM named export typing mismatch
  const vaxe = require('vitest-axe');
  axeMatchers = { toHaveNoViolations: vaxe.toHaveNoViolations };
} catch {}
// Provide matchMedia early (Mantine reads it at mount); define only if missing or not a function
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {}, // deprecated
    removeListener() {}, // deprecated
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return false;
    },
  });
  globalThis.matchMedia = window.matchMedia;
}
// maplibre-gl worker helper stub (jsdom lacks createObjectURL)
if (typeof URL !== 'undefined' && typeof URL.createObjectURL !== 'function') {
  URL.createObjectURL = () => 'blob:mock';
}
// Extend expect with DOM & a11y matchers
expect.extend(matchers);
if (axeMatchers.toHaveNoViolations) {
  expect.extend(axeMatchers);
}
// Minimal ResizeObserver shim (polyfill only when missing)
class RO {
  observe() {}
  unobserve() {}
  disconnect() {}
}
// remove empty Window redeclaration; not needed here
if (!('ResizeObserver' in globalThis)) {
  globalThis.ResizeObserver = RO;
}
// Lightweight maplibre-gl mock to avoid WebGL/canvas in jsdom tests.
// Provides only the surface used by our Map component. Real integration is exercised in browser/e2e.
vi.mock('maplibre-gl', () => {
  const Map = vi.fn().mockImplementation(() => {
    return {
      addControl: vi.fn(),
      remove: vi.fn(),
      getCanvas: () => ({ addEventListener: vi.fn(), removeEventListener: vi.fn() }),
      addSource: vi.fn(),
      addLayer: vi.fn(),
      getSource: vi.fn(),
      getLayer: vi.fn(),
    };
  });
  const NavigationControl = vi.fn();
  return { __esModule: true, default: { Map, NavigationControl }, Map, NavigationControl };
});
