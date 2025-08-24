// Approximate conversions between 2D WebMercator zoom levels and Cesium camera altitude (meters).
// This is a heuristic for initial synchronization; we can refine with empirical sampling later.

const EARTH_CIRC = 40075016; // meters

export function zoomToHeight(zoom: number): number {
  const denom = Math.pow(2, zoom);
  const groundResolution = EARTH_CIRC / (256 * denom); // m per pixel at equator
  // Assume viewport ~ 800px tall and vertical FOV scaling constant ~1.2
  return groundResolution * 960; // 800 * 1.2
}

export function heightToZoom(height: number): number {
  const groundRes = height / 960;
  const denom = EARTH_CIRC / (256 * groundRes);
  return Math.log2(denom);
}
