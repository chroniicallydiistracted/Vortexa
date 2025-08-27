#!/usr/bin/env node
// wmts_pick.js - Extract GOES/GIBS TileMatrixSet info from NASA WMTS GetCapabilities
import { XMLParser } from 'fast-xml-parser';

const WMTS_URL =
  process.env.WMTS_URL ||
  'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/wmts.cgi?SERVICE=WMTS&REQUEST=GetCapabilities';

const wantedTitle = process.argv.slice(2).join(' '); // pass exact ows:Title or leave empty to list all

async function main() {
  try {
    console.log(`Fetching WMTS GetCapabilities from: ${WMTS_URL}`);
    const res = await fetch(WMTS_URL);
    if (!res.ok) throw new Error(`Fetch failed ${res.status}`);
    const xml = await res.text();

    const parser = new XMLParser({
      ignoreAttributes: false,
      removeNSPrefix: true, // strip ows:/wmts: prefixes
    });
    const json = parser.parse(xml);

    // Layers live under Capabilities -> Contents -> Layer (array)
    const layers = (json?.Capabilities?.Contents?.Layer ?? []);
    const layerArray = Array.isArray(layers) ? layers : [layers];

    function summarize(layer) {
      const title = layer?.Title ?? '';
      const identifier = layer?.Identifier ?? '';
      const links = Array.isArray(layer?.TileMatrixSetLink)
        ? layer.TileMatrixSetLink
        : (layer?.TileMatrixSetLink ? [layer.TileMatrixSetLink] : []);
      const tms = links.map((l) => l?.TileMatrixSet).filter(Boolean);
      const levels = [...new Set(tms.map(s => {
        const m = /GoogleMapsCompatible_Level(\d+)/.exec(s);
        return m ? Number(m[1]) : null;
      }).filter((x) => x !== null))].sort((a, b) => a - b);
      return { title, identifier, tileMatrixSets: tms, levels };
    }

    const summaries = layerArray.map(summarize);

    if (!wantedTitle) {
      console.log('\n=== ALL LAYERS ===');
      summaries.forEach(L => {
        const lev = L.levels.length ? L.levels.join(', ') : 'n/a';
        const tms = L.tileMatrixSets.length ? L.tileMatrixSets.join(', ') : 'n/a';
        console.log(`${L.title} | ${L.identifier} | TMS=${tms} | GMaps levels=${lev}`);
      });
      
      console.log(`\nTotal layers found: ${summaries.length}`);
      
      // Show GOES layers specifically
      const goesLayers = summaries.filter(L => /GOES/i.test(L.identifier));
      if (goesLayers.length > 0) {
        console.log('\n=== GOES LAYERS ===');
        goesLayers.forEach(L => {
          const lev = L.levels.length ? L.levels.join(', ') : 'n/a';
          const tms = L.tileMatrixSets.length ? L.tileMatrixSets.join(', ') : 'n/a';
          console.log(`${L.title} | ${L.identifier} | TMS=${tms} | GMaps levels=${lev}`);
        });
      }
    } else {
      // Look for exact match first, then partial match
      let match = summaries.find(L => L.title === wantedTitle || L.identifier === wantedTitle);
      if (!match) {
        // Try partial match
        const partialMatches = summaries.filter(L => 
          L.title.includes(wantedTitle) || L.identifier.includes(wantedTitle)
        );
        if (partialMatches.length === 1) {
          match = partialMatches[0];
        } else if (partialMatches.length > 1) {
          console.log(`Multiple matches for "${wantedTitle}":`);
          partialMatches.forEach(L => {
            console.log(`  - ${L.title} (${L.identifier})`);
          });
          return;
        }
      }
      
      if (!match) {
        console.error(`No layer with ows:Title or ows:Identifier matching "${wantedTitle}"`);
        process.exit(1);
      }
      
      console.log(`\n=== LAYER INFO ===`);
      console.log(`Title: ${match.title}`);
      console.log(`Identifier: ${match.identifier}`);
      console.log(`TileMatrixSet(s): ${match.tileMatrixSets.join(', ') || 'n/a'}`);
      console.log(`GoogleMapsCompatible Level(s): ${match.levels.join(', ') || 'n/a'}`);
      
      if (match.levels.length > 0) {
        console.log(`\n=== URL TEMPLATES ===`);
        match.levels.forEach(level => {
          console.log(`Level ${level}: https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${match.identifier}/default/{time}/GoogleMapsCompatible_Level${level}/{z}/{y}/{x}.png`);
        });
      }
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
