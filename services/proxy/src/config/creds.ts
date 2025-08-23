// Centralized credential & header access (env‑driven). Node 18+ runtime assumed (global fetch).
export const FIRMS_MAP_KEY = process.env.FIRMS_MAP_KEY || process.env.MAP_KEY || "";
export const OWM_API_KEY   = process.env.OWM_API_KEY   || process.env.OPENWEATHERMAP_API_KEY || "";
export const NWS_USER_AGENT = process.env.NWS_USER_AGENT || "";

export function requireEnv(name: string, value: string) {
  if (!value) throw new Error(`Missing required env var: ${name}`);
}
