#!/usr/bin/env node
// scripts/wmts_pick.js
// Extract rich WMTS info from GIBS (including TileMatrixSet limits per zoom)
// Usage examples:
//  node scripts/wmts_pick.js "GOES-West_ABI_GeoColor"
//  node scripts/wmts_pick.js GOES GeoColor --any
//  node scripts/wmts_pick.js --regex="/^GOES-.*GeoColor$/i" --json
//  WMTS_URL=<alt> node scripts/wmts_pick.js "VIIRS_SNPP_CorrectedReflectance_TrueColor"

import { XMLParser } from 'fast-xml-parser';

const WMTS_URL =
  process.env.WMTS_URL ||
  'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/wmts.cgi?SERVICE=WMTS&REQUEST=GetCapabilities';

const argv = process.argv.slice(2);
const flags = new Set(argv.filter(a => a.startsWith('--')));
const argTerms = argv.filter(a => !a.startsWith('--'));
const query = argTerms.join(' ').trim();
const anyMode = flags.has('--any');
const jsonOut = flags.has('--json');
const showTimes = flags.has('--show-times');
const regexFlag = argv.find(a => a.startsWith('--regex='));
const rx = regexFlag
  ? (() => {
      const raw = regexFlag.split('=').slice(1).join('=');
      // supports --regex="/pattern/i"
      const m = raw.match(/^\/(.*)\/([gimsuy]*)$/);
      return m ? new RegExp(m[1], m[2]) : new RegExp(raw, 'i');
    })()
  : null;

// Helpers
const toArray = x => (Array.isArray(x) ? x : x ? [x] : []);
const num = v => (v == null ? undefined : Number(v));
function textOf(v) {
  if (typeof v === 'string') return v;
  if (v && typeof v === 'object' && '#text' in v) {
    const t = v['#text'];
    return typeof t === 'string' ? t : String(t ?? '');
  }
  return String(v ?? '');
}
function pickTitleId(layer) {
  return { title: textOf(layer?.Title), identifier: textOf(layer?.Identifier) };
}
function keywordMatch(hay, terms, any) {
  hay = hay.toLowerCase();
  const needles = terms.map(s => s.toLowerCase());
  return any ? needles.some(t => hay.includes(t)) : needles.every(t => hay.includes(t));
}
function extractResourceURLs(layer) {
  const rus = toArray(layer?.ResourceURL);
  const tiles = rus.filter(r => r?.resourceType === 'tile');
  const domains = rus.filter(r => r?.resourceType?.toLowerCase() === 'domains');
  return {
    tile: tiles.map(r => ({ template: r.template, format: r.format })),
    domains: domains.map(r => ({ template: r.template, format: r.format })),
  };
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
const tmsDefs = toArray(cap?.Capabilities?.Contents?.TileMatrixSet);

// Build map of global TileMatrixSet definitions
const tmsMap = new Map(
  tmsDefs.map(def => {
    const name = textOf(def?.Identifier);
    const tmsMatrices = toArray(def?.TileMatrix).map(tm => ({
      identifier: textOf(tm?.Identifier),            // usually "0", "1", ...
      scaleDenominator: num(tm?.ScaleDenominator),
      topLeftCorner: String(tm?.TopLeftCorner ?? ''),
      tileWidth: num(tm?.TileWidth),
      tileHeight: num(tm?.TileHeight),
      matrixWidth: num(tm?.MatrixWidth),
      matrixHeight: num(tm?.MatrixHeight),
    }));
    // min/max zoom inferred from identifiers if numeric
    const zooms = tmsMatrices
      .map(m => Number(m.identifier))
      .filter(n => Number.isFinite(n));
    const minZoom = zooms.length ? Math.min(...zooms) : undefined;
    const maxZoom = zooms.length ? Math.max(...zooms) : undefined;
    return [
      name,
      {
        identifier: name,
        supportedCRS: textOf(def?.SupportedCRS),
        tileMatrices: tmsMatrices,
        minZoom,
        maxZoom,
      },
    ];
  })
);

// Find matches
let matches = [];
if (!query && !rx) {
  // List all layers if no query
  matches = layers.slice();
} else {
  matches = layers.filter(L => {
    const { title, identifier } = pickTitleId(L);
    const hay = `${title} ${identifier}`;
    return rx ? rx.test(hay) : keywordMatch(hay, query.split(/\s+/).filter(Boolean), anyMode);
  });
}

if (matches.length === 0) {
  console.error('No layers matched.');
  process.exit(1);
}

function summarizeLayer(layer) {
  const { title, identifier } = pickTitleId(layer);
  const styles = toArray(layer?.Style).map(s => ({
    title: textOf(s?.Title),
    identifier: textOf(s?.Identifier),
    isDefault: String(s?.isDefault) === 'true',
  }));

  // Bounding boxes
  const wgs84 = layer?.WGS84BoundingBox
    ? {
        lower: textOf(layer.WGS84BoundingBox?.LowerCorner),
        upper: textOf(layer.WGS84BoundingBox?.UpperCorner),
        crs: layer.WGS84BoundingBox?.crs,
      }
    : null;
  const bbox3857 = layer?.BoundingBox
    ? {
        lower: textOf(layer.BoundingBox?.LowerCorner),
        upper: textOf(layer.BoundingBox?.UpperCorner),
        crs: layer.BoundingBox?.crs,
      }
    : null;

  // Time dimension (if present)
  const dimTime = toArray(layer?.Dimension).find(d => textOf(d?.Identifier) === 'Time');
  const timeInfo = dimTime
    ? {
        uom: textOf(dimTime?.UOM),
        default: textOf(dimTime?.Default),
        current: String(dimTime?.Current) === 'true',
        values: toArray(dimTime?.Value).map(textOf),
        count: toArray(dimTime?.Value).length,
      }
    : null;

  // ResourceURLs
  const rus = extractResourceURLs(layer);

  // TMS links + limits
  const links = toArray(layer?.TileMatrixSetLink).map(link => {
    const tmsName = textOf(link?.TileMatrixSet);
    const limits = toArray(link?.TileMatrixSetLimits?.TileMatrixLimits).map(l => ({
      tileMatrix: textOf(l?.TileMatrix),
      minRow: num(l?.MinTileRow),
      maxRow: num(l?.MaxTileRow),
      minCol: num(l?.MinTileCol),
      maxCol: num(l?.MaxTileCol),
    }));
    // fill with global grid if no limits were provided
    const def = tmsMap.get(tmsName);
    const mergedByZoom = new Map();
    if (def) {
      // seed with full grid
      for (const tm of def.tileMatrices) {
        const z = tm.identifier;
        mergedByZoom.set(z, {
          tileMatrix: z,
          minRow: 0,
          maxRow: (tm.matrixHeight ?? 0) - 1,
          minCol: 0,
          maxCol: (tm.matrixWidth ?? 0) - 1,
          source: 'tms-def',
        });
      }
    }
    for (const l of limits) {
      mergedByZoom.set(l.tileMatrix, { ...l, source: 'limits' });
    }
    const perZoom = [...mergedByZoom.values()].sort(
      (a, b) => Number(a.tileMatrix) - Number(b.tileMatrix)
    );

    // min/max zoom from defs or observed limits
    const zNumbers = perZoom
      .map(z => Number(z.tileMatrix))
      .filter(n => Number.isFinite(n));
    const minZoom = zNumbers.length ? Math.min(...zNumbers) : def?.minZoom;
    const maxZoom = zNumbers.length ? Math.max(...zNumbers) : def?.maxZoom;

    // try to read GoogleMapsCompatible_LevelX
    const m = /GoogleMapsCompatible_Level(\d+)/.exec(tmsName);
    const gmcLevel = m ? Number(m[1]) : undefined;

    return {
      tileMatrixSet: tmsName,
      googleMapsLevel: gmcLevel,
      supportedCRS: def?.supportedCRS || null,
      minZoom: minZoom ?? null,
      maxZoom: maxZoom ?? null,
      perZoom, // array of {tileMatrix, minRow,maxRow,minCol,maxCol, source}
    };
  });

  // Formats stated on the layer (some servers also list formats globally)
  const formats = toArray(layer?.Format).map(String);

  return {
    title,
    identifier,
    styles,
    wgs84BoundingBox: wgs84,
    mercatorBoundingBox: bbox3857,
    time: timeInfo,
    formats,
    resourceURLs: rus,
    tileMatrixSetLinks: links,
  };
}

// Output
if (!jsonOut) {
  for (const L of matches) {
    const S = summarizeLayer(L);

    console.log('\n=== LAYER ===');
    console.log(`Title        : ${S.title}`);
    console.log(`Identifier   : ${S.identifier}`);
    if (S.styles?.length) {
      const def = S.styles.find(s => s.isDefault)?.identifier || 'default';
      console.log(
        `Styles       : ${S.styles.map(s => `${s.identifier}${s.isDefault ? ' (default)' : ''}`).join(', ')}`
      );
      console.log(`Style (used) : ${def}`);
    }

    if (S.wgs84BoundingBox)
      console.log(`WGS84 BBox   : ${S.wgs84BoundingBox.lower}  →  ${S.wgs84BoundingBox.upper}`);
    if (S.mercatorBoundingBox)
      console.log(`EPSG:3857 BBox: ${S.mercatorBoundingBox.lower}  →  ${S.mercatorBoundingBox.upper}`);

    if (S.time) {
      console.log(`Time UOM     : ${S.time.uom}`);
      console.log(`Time default : ${S.time.default}`);
      console.log(`Time values  : ${S.time.count} entries`);
      if (showTimes && S.time.values.length) {
        const first = S.time.values.slice(0, 3);
        const last = S.time.values.slice(-3);
        console.log(`  sample     : ${first.join(' , ')}  ...  ${last.join(' , ')}`);
      }
    }

    if (S.formats?.length) console.log(`Formats      : ${S.formats.join(', ')}`);

    // ResourceURLs
    if (S.resourceURLs.tile.length || S.resourceURLs.domains.length) {
      console.log('\nResourceURL templates:');
      for (const r of S.resourceURLs.tile) {
        console.log(`  [tile ${r.format || ''}] ${r.template}`);
      }
      for (const r of S.resourceURLs.domains) {
        console.log(`  [domains ${r.format || ''}] ${r.template}`);
      }
    }

    // TMS links + limits
    if (S.tileMatrixSetLinks.length) {
      console.log('\nTileMatrixSets:');
      for (const link of S.tileMatrixSetLinks) {
        console.log(
          `  - ${link.tileMatrixSet}` +
            (link.googleMapsLevel != null ? ` (GoogleMapsCompatible Level ${link.googleMapsLevel})` : '') +
            (link.supportedCRS ? ` | CRS=${link.supportedCRS}` : '') +
            (link.minZoom != null && link.maxZoom != null ? ` | zooms=${link.minZoom}…${link.maxZoom}` : '')
        );
        if (link.perZoom?.length) {
          console.log('    Per-zoom limits (TileMatrix → rows, cols):');
          for (const z of link.perZoom) {
            const row = `${z.minRow}…${z.maxRow}`;
            const col = `${z.minCol}…${z.maxCol}`;
            console.log(`      z=${z.tileMatrix}  rows=${row}  cols=${col}  [${z.source}]`);
          }
        }
      }
    }
  }

  if (matches.length > 1) {
    console.log(`\nMatched ${matches.length} layers. Use quoted name or --regex to narrow, or add --json to export.`);
  }
} else {
  // JSON mode: emit array of summaries
  const out = matches.map(summarizeLayer);
  console.log(JSON.stringify({ url: WMTS_URL, count: out.length, layers: out }, null, 2));
}
