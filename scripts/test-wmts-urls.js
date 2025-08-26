#!/usr/bin/env node

/**
 * Test script to verify WMTS URL construction and connectivity
 * Run with: node scripts/test-wmts-urls.js
 */

const { buildTileUrl, pickTms } = require('../services/proxy/src/lib/gibs/capabilities.js');

console.log('Testing WMTS URL construction...\n');

// Test cases based on your XML
const testCases = [
  {
    layerId: 'GOES-East_ABI_GeoColor',
    z: 6,
    y: 5,
    x: 10,
    time: '2025-08-26T14:50:00Z',
    ext: 'png'
  },
  {
    layerId: 'GOES-West_ABI_GeoColor',
    z: 5,
    y: 7,
    x: 9,
    time: '2025-08-26T14:40:00Z',
    ext: 'png'
  },
  {
    layerId: 'Graticule_15m',
    z: 8,
    y: 4,
    x: 12,
    time: '2025-08-26T14:50:00Z',
    ext: 'png'
  }
];

console.log('TileMatrixSet Selection:');
testCases.forEach(tc => {
  const tms = pickTms(tc.layerId);
  console.log(`  ${tc.layerId}: ${tms}`);
});

console.log('\nURL Construction:');
testCases.forEach(tc => {
  const url = buildTileUrl(tc);
  console.log(`\n${tc.layerId}:`);
  console.log(`  Input: z=${tc.z}, y=${tc.y}, x=${tc.x}, time=${tc.time}`);
  console.log(`  Output: ${url}`);
  
  // Validate URL structure
  const expectedPattern = new RegExp(
    `https://gibs\\.earthdata\\.nasa\\.gov/wmts/epsg3857/best/${tc.layerId}/default/${tc.time.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/[^/]+/${tc.z}/${tc.y}/${tc.x}\\.${tc.ext}`
  );
  
  if (expectedPattern.test(url)) {
    console.log('  ✅ URL structure is correct');
  } else {
    console.log('  ❌ URL structure is incorrect');
  }
});

console.log('\nTesting connectivity...');

// Test the health endpoint if running locally
const testHealth = async () => {
  try {
    const response = await fetch('http://localhost:3000/api/gibs/health?layer=GOES-East_ABI_GeoColor');
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Health check passed:');
      console.log(`  Status: ${data.status}`);
      console.log(`  Layer: ${data.layer}`);
      console.log(`  Timestamps: ${data.timestampCount}`);
      console.log(`  Latest: ${data.latest}`);
    } else {
      console.log(`❌ Health check failed: ${response.status}`);
    }
  } catch (error) {
    console.log('❌ Health check error:', error.message);
    console.log('  Make sure the proxy service is running on port 3000');
  }
};

testHealth();