import { expect } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';

expect.extend(matchers);

// ResizeObserver polyfill for Mantine in jsdom
class RO { observe(){} unobserve(){} disconnect(){} }
// @ts-ignore
globalThis.ResizeObserver = globalThis.ResizeObserver || RO;

// matchMedia polyfill required by Mantine color scheme logic
if (typeof window !== 'undefined' && !window.matchMedia) {
	// @ts-ignore
	window.matchMedia = (query) => ({
		matches: false,
		media: query,
		onchange: null,
		addListener: () => {}, // deprecated
		removeListener: () => {}, // deprecated
		addEventListener: () => {},
		removeEventListener: () => {},
		dispatchEvent: () => false,
	});
}
