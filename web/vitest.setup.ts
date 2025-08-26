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
class RO { observe(){} unobserve(){} disconnect(){} }
declare global { interface Window {} }
(globalThis as any).ResizeObserver ||= RO;
