// gibs_layer_info.ts
// Usage:
//   pnpm add -D fast-xml-parser
//   npx tsx gibs_layer_info.ts "GOES-East_ABI_GeoColor"
//   npx tsx gibs_layer_info.ts "VIIRS_SNPP_CorrectedReflectance_TrueColor"

import { XMLParser } from 'fast-xml-parser';

const WMTS_URL =
  process.env.WMTS_URL ??
  'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/WMTSCapabilities.xml';

const wantedTitle = process.argv.slice(2).join(' ').trim();
if (!wantedTitle) {
  console.error(
    'Provide an ows:Title. Example: npx tsx gibs_layer_info.ts "GOES-East_ABI_GeoColor"',
  );
  process.exit(1);
}

const DEFAULT_TIME = 'default';

type ResourceURL = {
  resourceType?: string;
  format?: string;
  template?: string;
};

type TmsLink = { TileMatrixSet?: string };

function toArray<T>(x: T | T[] | undefined): T[] {
  if (!x) return [];
  return Array.isArray(x) ? x : [x];
}

function extractPlaceholders(template: string): string[] {
  const out = new Set<string>();
  const re = /\{([^}])\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(template))) out.add(m[1]);
  return [...out];
}

function replaceStatic(template: string, subs: Record<string, string>) {
  return Object.keys(subs).reduce(
    (acc, k) => acc.replace(new RegExp(`\\{${k}\\}`, 'g'), subs[k]),
    template,
  );
}

function chooseTms(tmsNames: string[]): { chosen?: string; level?: number } {
  for (const name of tmsNames) {
    const m = /GoogleMapsCompatible_Level(\d)/.exec(name);
    if (m) return { chosen: name, level: Number(m[1]) };
  }
  return { chosen: tmsNames[0] }; // fallback: first available
}

(async () => {
  const res = await fetch(WMTS_URL);
  if (!res.ok) {
    console.error(`Fetch failed: ${res.status} ${res.statusText}`);
    process.exit(1);
  }
  const xml = await res.text();

  const parser = new XMLParser({
    ignoreAttributes: false,
    removeNSPrefix: true, // strip ows:/wmts: prefixes
    attributeNamePrefix: '', // attrs like format, template on ResourceURL
  });
  const json = parser.parse(xml);

  const layers = toArray<any>(json?.Capabilities?.Contents?.Layer);
  if (layers.length === 0) {
    console.error('No layers found in WMTS capabilities');
    process.exit(1);
  }

  // Exact Title match first; fallback to case-insensitive Title, then Identifier
  let layer =
    layers.find((L) => L?.Title === wantedTitle) ??
    layers.find((L) => String(L?.Title ?? '').toLowerCase() === wantedTitle.toLowerCase()) ??
    layers.find((L) => L?.Identifier === wantedTitle);

  if (!layer) {
    console.error(`No layer with ows:Title or Identifier == "${wantedTitle}"`);
    // Show a few suggestions
    const suggestions = layers
      .slice(0, 10)
      .map((L) => `${L?.Title ?? ''} | ${L?.Identifier ?? ''}`)
      .join('\n');
    console.error('Here are a few layer titles/ids:\n', suggestions);
    process.exit(1);
  }

  const title: string = String(layer.Title ?? '');
  const identifier: string = String(layer.Identifier ?? '');

  const resourceUrls = toArray<ResourceURL>(layer.ResourceURL).filter(
    (r) => r.resourceType === 'tile' && typeof r.template === 'string',
  );

  // Prefer PNG tile ResourceURL, else take the first
  const preferredRU = resourceUrls.find((r) => (r.format ?? '').includes('png')) ?? resourceUrls[0];

  if (!preferredRU?.template) {
    console.error('Layer has no tile ResourceURL template; cannot proceed safely.');
    process.exit(1);
  }

  // Gather TileMatrixSet options from links
  const tmsLinks = toArray<TmsLink>(layer.TileMatrixSetLink);
  const tmsNames = tmsLinks.map((l) => l.TileMatrixSet).filter(Boolean) as string[];
  const { chosen: chosenTms, level } = chooseTms(tmsNames);

  // Build lists
  const placeholders = extractPlaceholders(preferredRU.template);
  const staticSubs: Record<string, string> = {};

  // Normalize common placeholder casings
  const has = (name: string) => placeholders.includes(name);

  if (has('Layer')) staticSubs['Layer'] = identifier;
  if (has('layer')) staticSubs['layer'] = identifier; // some templates use lowercase
  if (has('Time')) staticSubs['Time'] = DEFAULT_TIME;
  if (has('time')) staticSubs['time'] = DEFAULT_TIME;
  if (has('TileMatrixSet') && chosenTms) staticSubs['TileMatrixSet'] = chosenTms;

  const resolvedBase = replaceStatic(preferredRU.template, staticSubs);

  // Split placeholders into static vs dynamic after substitution
  const remaining = extractPlaceholders(resolvedBase);
  const dynamic = remaining.filter(
    (p) => !['Layer', 'layer', 'Time', 'time', 'TileMatrixSet'].includes(p),
  );

  // A friendly example URL (fill a trivial zoom/tile; users should replace)
  const exampleUrl = resolvedBase
    .replace('{TileMatrix}', '0')
    .replace('{TileRow}', '0')
    .replace('{TileCol}', '0');

  // Pretty print
  console.log('— GIBS WMTS (EPSG:3857) layer —');
  console.log(`Title       : ${title}`);
  console.log(`Identifier  : ${identifier}`);
  console.log(`ResourceURL : ${preferredRU.template}`);
  console.log(`Format      : ${preferredRU.format ?? 'unknown'}`);
  console.log(`TMS options : ${tmsNames.join(', ') || 'n/a'}`);
  if (chosenTms)
    console.log(
      `Recommended : ${chosenTms}${level !== undefined ? `  (GoogleMapsCompatible Level ${level})` : ''}`,
    );
  console.log('Placeholders: ', placeholders.join(', '));
  console.log(
    'Static subs : ',
    Object.entries(staticSubs)
      .map(([k, v]) => `${k}=${v}`)
      .join(', '),
  );
  console.log('Dynamic     : ', dynamic.join(', ') || '—');
  console.log('Resolved base (static applied):');
  console.log('  ', resolvedBase);
  console.log('Example tile (0/0/0):');
  console.log('  ', exampleUrl);

  // Also emit JSON for programmatic use
  // JSON output is now opt-in
  if (wantJson) {
    const out = {
      title,
      identifier,
      resourceURL: {
        template: preferredRU.template,
        format: preferredRU.format ?? null,
      },
      placeholders,
      static: staticSubs,
      dynamic,
      tileMatrixSets: tmsNames,
      recommendedTileMatrixSet: chosenTms ?? null,
      googleMapsLevel: level ?? null,
      resolvedBase,
      exampleUrl,
    };
    console.log('\nJSON:\n' + JSON.stringify(out, null, 2));
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
