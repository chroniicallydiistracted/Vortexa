#!/usr/bin/env ts-node
import fs from 'node:fs';
import path from 'node:path';

type Layer = {
  slug?: string;
  id?: string;
  tile_url_template?: string;
  time_format?: string;
};

const p = path.resolve('web/public/catalog.json');
let raw: unknown;
try {
  raw = JSON.parse(fs.readFileSync(p, 'utf8'));
} catch (e) {
  console.error('ERROR parsing catalog.json', { path: p, error: (e as Error).message });
  process.exit(1);
}
function isLayerArray(v: unknown): v is Layer[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'object' && x !== null);
}
function hasLayersField(v: unknown): v is { layers: unknown } {
  return typeof v === 'object' && v !== null && 'layers' in v;
}

let layers: Layer[];
if (isLayerArray(raw)) {
  layers = raw;
} else if (hasLayersField(raw) && isLayerArray((raw as { layers: unknown }).layers)) {
  layers = (raw as { layers: Layer[] }).layers;
} else {
  console.error('ERROR: catalog.json is not an array or { layers: [] } shape');
  process.exit(1);
}

let errors = 0;
const byTemplate = new Map<string, string[]>();

for (const L of layers) {
  const id = L.slug || L.id || 'UNKNOWN';
  const t = (L.tile_url_template || '').trim();
  if (t.includes('{TileMatrixSet}')) {
    console.error(`ERROR [${id}] unresolved {TileMatrixSet}`);
    errors++;
  }
  if (t.includes('{time}') && !L.time_format) {
    console.error(`ERROR [${id}] {time} present but time_format missing`);
    errors++;
  }
  const isGOES = /GOES|ABI/i.test(id) || /GOES|ABI/i.test(t);
  const expected = isGOES ? 'GoogleMapsCompatible_Level8' : 'GoogleMapsCompatible_Level9';
  if (/GoogleMapsCompatible_Level(8|9)/.test(t) && !t.includes(expected)) {
    console.warn(`WARN  [${id}] TMS might be wrong (expected ${expected})`);
  }
  const key = t.replace(/\{time\}/g, '{time}');
  if (key) {
    if (!byTemplate.has(key)) byTemplate.set(key, []);
    byTemplate.get(key)!.push(id);
  }
}
for (const [_template, ids] of byTemplate) {
  if (ids.length > 1) console.warn(`WARN  duplicate template used by: ${ids.join(', ')}`);
}
if (errors) {
  console.error(`Failed with ${errors} error(s).`);
  process.exit(1);
} else {
  console.log('catalog.json validation passed with no errors.');
}
