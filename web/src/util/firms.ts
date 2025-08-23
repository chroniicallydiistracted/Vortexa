// Parse FIRMS CSV (area/world) into GeoJSON FeatureCollection
// CSV columns (sample): latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,confidence,version,bright_ti5,frp,daynight
export interface FirmsPointProps { brightness?: number; confidence?: string; frp?: number; acq_datetime?: string; satellite?: string; daynight?: string }

export function firmsCsvToGeoJSON(csv: string) {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return { type: 'FeatureCollection', features: [] };
  const header = lines[0].split(',').map(h=> h.trim().toLowerCase());
  const latIdx = header.indexOf('latitude');
  const lonIdx = header.indexOf('longitude');
  const acqDateIdx = header.indexOf('acq_date');
  const acqTimeIdx = header.indexOf('acq_time');
  const brightIdx = header.indexOf('bright_ti4');
  const confIdx = header.indexOf('confidence');
  const frpIdx = header.indexOf('frp');
  const satIdx = header.indexOf('satellite');
  const dnIdx = header.indexOf('daynight');
  const feats = [] as any[];
  for (let i=1;i<lines.length;i++) {
    const row = lines[i].split(',');
    if (row.length !== header.length) continue;
    const lat = parseFloat(row[latIdx]);
    const lon = parseFloat(row[lonIdx]);
    if (isNaN(lat)||isNaN(lon)) continue;
    const date = row[acqDateIdx];
    const time = row[acqTimeIdx];
    const dt = date && time ? `${date}T${time.padStart(4,'0').slice(0,2)}:${time.padStart(4,'0').slice(2,4)}:00Z` : undefined;
    feats.push({ type:'Feature', geometry:{ type:'Point', coordinates:[lon,lat] }, properties:{ brightness: brightIdx>=0? Number(row[brightIdx]):undefined, confidence: confIdx>=0? row[confIdx]:undefined, frp: frpIdx>=0? Number(row[frpIdx]):undefined, acq_datetime: dt, satellite: satIdx>=0? row[satIdx]:undefined, daynight: dnIdx>=0? row[dnIdx]:undefined } as FirmsPointProps });
  }
  return { type:'FeatureCollection', features:feats };
}
