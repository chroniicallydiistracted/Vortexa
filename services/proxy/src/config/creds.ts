// Centralized credential & header access (env‑driven). Node 18+ runtime assumed (global fetch).
export const FIRMS_MAP_KEY = process.env.FIRMS_MAP_KEY || process.env.MAP_KEY || '';
export const OWM_API_KEY = process.env.OWM_API_KEY || process.env.OPENWEATHERMAP_API_KEY || '';
export const NWS_USER_AGENT = process.env.NWS_USER_AGENT || '';

// Additional exported auth/config identifiers used across services
export const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID || '';
export const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY || '';
export const AWS_DEFAULT_REGION = process.env.AWS_DEFAULT_REGION || '';
export const CESIUM_ION_TOKEN = process.env.CESIUM_ION_TOKEN || '';
export const AIRNOW_API_KEY = process.env.AIRNOW_API_KEY || '';
export const OPENAQ_API_KEY = process.env.OPENAQ_API_KEY || '';
export const EARTHDATA_AUTH_KEY = process.env.EARTHDATA_AUTH_KEY || '';

export function requireEnv(name: string, value: string) {
  if (!value) throw new Error(`Missing required env var: ${name}`);
}
