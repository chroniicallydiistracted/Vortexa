import React from 'react';
import { CesiumGlobe } from '../../map/cesium/CesiumGlobe';

// Thin component so the loader can lazy import a stable module name
export default function Globe3D() {
  return <CesiumGlobe />;
}
