// web/src/lib/env.ts
// Runtime env helper: prefer process.env (works with vi.stubEnv), fallback to import.meta.env in production.

export function is3DEnabled(): boolean {
  const fromProcess =
    typeof process !== 'undefined' && typeof process.env !== 'undefined'
      ? process.env.VITE_ENABLE_3D
      : undefined;
  const fromVite = (() => {
    try {
      return import.meta.env.VITE_ENABLE_3D as string | undefined;
    } catch {
      return undefined;
    }
  })();
  const v = fromProcess ?? fromVite;
  return v === '1';
}
