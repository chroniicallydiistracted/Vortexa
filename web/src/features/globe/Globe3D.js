import { jsx as _jsx } from "react/jsx-runtime";
import { CesiumGlobe } from '../../map/cesium/CesiumGlobe';
// Thin component so the loader can lazy import a stable module name
export default function Globe3D() {
    return _jsx(CesiumGlobe, {});
}
