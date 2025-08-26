import { expect } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';

expect.extend(matchers);

// Typed ResizeObserver shim
class RO implements ResizeObserver {
	observe(): void {}
	unobserve(): void {}
	disconnect(): void {}
	// Support callback signature though unused
	constructor(_cb?: ResizeObserverCallback) {}
	static toString() { return 'ResizeObserverShim'; }
}
declare global {
	interface Window {
		ResizeObserver: typeof RO;
		matchMedia: (query: string) => MediaQueryList;
	}
}
if (!('ResizeObserver' in globalThis)) {
	(globalThis as unknown as { ResizeObserver: typeof RO }).ResizeObserver = RO;
}

// matchMedia shim
if (typeof window !== 'undefined' && !window.matchMedia) {
	(window as unknown as { matchMedia: (q: string) => MediaQueryList }).matchMedia = (query: string) => ({
		matches: false,
		media: query,
		onchange: null,
		addListener() {}, // deprecated
		removeListener() {}, // deprecated
		addEventListener() {},
		removeEventListener() {},
		dispatchEvent() { return false; },
	}) as MediaQueryList;
}
