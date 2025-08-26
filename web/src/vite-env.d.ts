/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TILE_BASE?: string;
  readonly VITE_ENABLE_3D?: '0' | '1';
  readonly VITE_BASEMAP_TILE_URL?: string;
  readonly VITE_GIBS_WMTS_TILE_URL?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
