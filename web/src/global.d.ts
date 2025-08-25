/// <reference types="vite/client" />
// Minimal env extension
interface ImportMetaEnv {
  readonly VITE_ENABLE_3D?: string;
  readonly VITE_TILE_BASE?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Cesium module stub (types included with package, but ensure TS finds it)
declare module "cesium";
