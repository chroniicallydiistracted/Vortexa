import fs from 'node:fs';
import path from 'node:path';

const catalogPath = path.join(process.cwd(), 'web', 'public', 'catalog.json');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
let updated = 0;

for (const layer of catalog.layers || []) {
  const slug = layer.slug || layer.id;
  if (slug && slug.startsWith('GOES-')) {
  layer.tile_url_template = `/api/gibs/tile/${slug}/{z}/{y}/{x}.png`;
    delete layer.time_format;
    if (layer.format && !/^png$/i.test(layer.format)) {
      layer.format = 'png';
    }
    updated++;
  }
}

fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2) + '\n');
console.log(`Updated ${updated} GOES entries`);
