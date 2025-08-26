import { expect } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';

// Provide matchMedia early (Mantine reads it at mount); define only if missing or not a function
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
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

// Minimal ResizeObserver shim (polyfill only when missing)
class RO { observe(){} unobserve(){} disconnect(){} }
declare global { interface Window {} }
if (!('ResizeObserver' in globalThis)) {
	(globalThis as any).ResizeObserver = RO;
}
