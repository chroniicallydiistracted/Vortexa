import { jsx as _jsx } from "react/jsx-runtime";
import { lazy, Suspense } from 'react';
// Lazy wrapper for Cesium 3D globe; splits Cesium into a separate chunk
const Globe3D = lazy(() => import('./Globe3D'));
export default function Globe3DLoader() {
    return (_jsx(Suspense, { fallback: null, children: _jsx(Globe3D, {}) }));
}
