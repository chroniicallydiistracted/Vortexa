// web/src/lib/env.ts
// Runtime env helper: prefer process.env (works with vi.stubEnv), fallback to import.meta.env in production.

export function is3DEnabled(): boolean {
  const fromProcess =
    typeof process !== 'undefined' && (process as any).env
      ? (process as any).env.VITE_ENABLE_3D
      : undefined;
  let fromVite: string | undefined;
  try {
    // @ts-ignore - Vite injects import.meta.env
    fromVite = (import.meta as any)?.env?.VITE_ENABLE_3D;
  } catch {
    fromVite = undefined;
  }
  const v = fromProcess ?? fromVite;
  return v === '1';
}
