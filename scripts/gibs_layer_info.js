#!/usr/bin/env node
// scripts/gibs_layer_info.js
// Extract layer identifiers and titles from GIBS WMTS GetCapabilities
// Automatically writes output to logs/gibs_layer_info.log

import { XMLParser } from 'fast-xml-parser';
import fs from 'fs'; // Import the file system module
import path from 'path'; // Import the path module

const WMTS_URL =
  process.env.WMTS_URL ||
  'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/wmts.cgi?SERVICE=WMTS&REQUEST=GetCapabilities';

// Define the log file path
const logDir = './logs';
const logFilePath = path.join(logDir, 'gibs_layer_info.log');

// Ensure the log directory exists
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

// Create a write stream to the log file
const logStream = fs.createWriteStream(logFilePath, { flags: 'w' });

// Redirect console.log to the log file only
const originalConsoleLog = console.log; // Keep a reference to the original console.log if needed elsewhere
console.log = (...args) => {
    logStream.write(args.join(' ') + '\n'); // Only write to log file
};

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
function pickLayerInfo(layer) {
  return {
    identifier: textOf(layer?.Identifier),
    title: textOf(layer?.Title)
  };
}

// Fetch + parse
async function fetchAndLogLayers() {
    try {
        const res = await fetch(WMTS_URL);
        if (!res.ok) {
            console.error(`Fetch failed: ${res.status} ${res.statusText}`);
            process.exit(1);
        }
        const xml = await res.text();

        const parser = new XMLParser({
            ignoreAttributes: false,
            removeNSPrefix: true,
            attributeNamePrefix: '',
        });
        const cap = parser.parse(xml);

        const layers = toArray(cap?.Capabilities?.Contents?.Layer);

        console.log(`--- GIBS Layer Information (${new Date().toISOString()}) ---`);
        for (const L of layers) {
            const info = pickLayerInfo(L);
            console.log(`${info.identifier} --- ${info.title}`);
        }
        console.log(`--- End of GIBS Layer Information ---`);
    } catch (error) {
        // Ensure errors still go to the console
        originalConsoleLog(`An error occurred: ${error.message}`);
        process.exit(1);
    } finally {
        logStream.end(); // Close the log file stream
    }
}

fetchAndLogLayers();