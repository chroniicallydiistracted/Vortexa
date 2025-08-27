#!/usr/bin/env node
// scripts/gibs_layer_ids.js
// Extract layer identifiers from GIBS WMTS GetCapabilities

import { XMLParser } from 'fast-xml-parser';

const WMTS_URL =
  process.env.WMTS_URL ||
  'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/wmts.cgi?SERVICE=WMTS&REQUEST=GetCapabilities';

// Helpers
const toArray = x => (Array.isArray(x) ? x : x ? [x] : []);
function textOf(v) {
  if (typeof v === 'string') return v;
  if (v && typeof v === 'object' && '#text' in v) {
    const t = v['#text'];
    return typeof t === 'string' ? t : String(t ?? '');
  }
  return String(v ?? '');
}
function pickIdentifier(layer) {
  return textOf(layer?.Identifier);
}

// Fetch + parse
const res = await fetch(WMTS_URL);
if (!res.ok) {
  console.error(`Fetch failed: ${res.status} ${res.statusText}`);
  process.exit(1);
}
const xml = await res.text();

const parser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: true,   // ows:Title -> Title
  attributeNamePrefix: '',// attributes become plain keys
});
const cap = parser.parse(xml);

// Collections
const layers = toArray(cap?.Capabilities?.Contents?.Layer);

// Output
for (const L of layers) {
  console.log(pickIdentifier(L));
}
