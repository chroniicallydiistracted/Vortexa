#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const p = path.resolve('web/public/catalog.json');
const raw = JSON.parse(fs.readFileSync(p,'utf8'));
const layers = Array.isArray(raw) ? raw : raw.layers || raw;
let errors = 0;
const byTemplate = new Map();
for (const L of layers) {
  const id = L.slug || L.id || 'UNKNOWN';
  const t = (L.tile_url_template||'').trim();
  if (t.includes('{TileMatrixSet}')) { console.error(`ERROR [${id}] unresolved {TileMatrixSet}`); errors++; }
  if (t.includes('{time}') && !L.time_format) { console.error(`ERROR [${id}] {time} present but time_format missing`); errors++; }
  const isGOES = /GOES|ABI/i.test(id) || /GOES|ABI/i.test(t);
  const expected = isGOES ? 'GoogleMapsCompatible_Level8' : 'GoogleMapsCompatible_Level9';
  if (/GoogleMapsCompatible_Level(8|9)/.test(t) && !t.includes(expected)) {
    console.warn(`WARN  [${id}] TMS might be wrong (expected ${expected})`);
  }
  const key = t.replace(/\{time\}/g,'{time}');
  if (key) {
    if (!byTemplate.has(key)) byTemplate.set(key, []);
    byTemplate.get(key).push(id);
  }
}
for (const [tmpl, ids] of byTemplate) {
  if (ids.length > 1) console.warn(`WARN  duplicate template used by: ${ids.join(', ')}`);
}
if (errors) { console.error(`Failed with ${errors} error(s).`); process.exit(1); } else { console.log('catalog.json validation passed with no errors.'); }
