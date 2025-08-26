import { expect } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';

// Provide matchMedia BEFORE extending matchers so Mantine can access it during component mounting
// Provide / override matchMedia BEFORE extending matchers so Mantine can access it during component mounting
if (typeof window !== 'undefined') {
	(window as any).matchMedia = (query: string) => ({
		matches: false,
		media: query,
		onchange: null,
		addListener() {}, // deprecated
		removeListener() {}, // deprecated
		addEventListener() {},
		removeEventListener() {},
		dispatchEvent() { return false; },
	});
	(globalThis as any).matchMedia = (window as any).matchMedia;
}

expect.extend(matchers);

// Minimal ResizeObserver shim (jsdom doesn't provide it)
class RO {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// Only polyfill if missing in jsdom
if (!('ResizeObserver' in globalThis)) {
  (globalThis as any).ResizeObserver = RO;
}

// (optional) keep your matchMedia shim here as-is or in the same style:
if (!('matchMedia' in window)) {
  (window as any).matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {}, removeListener() {},
    addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; },
  });
}
