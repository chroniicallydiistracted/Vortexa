export function envEnable3d(): boolean {
  return import.meta.env.VITE_ENABLE_3D === '1';
}
