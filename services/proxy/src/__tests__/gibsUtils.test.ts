import { describe, it, expect } from 'vitest';
import { __gibsUtils } from '../routes/gibs.js';

const sampleXml = `<?xml version="1.0"?>\n<Capabilities>\n<Layer><Title>GOES-East_ABI_GeoColor</Title><Dimension name="time">2025-08-22T15:00:00Z 2025-08-22T16:00:00Z,2025-08-22T17:00:00Z</Dimension></Layer>\n<Layer><Title>MODIS_Terra_CorrectedReflectance_TrueColor</Title><Dimension name="time">2025-08-22T10:00:00Z 2025-08-22T11:00:00Z</Dimension></Layer>\n</Capabilities>`;

describe('gibs fetchCapabilities', () => {
  it('extracts times for specified layer', async () => {
    const fetchMock: any = async () => ({ ok:true, text: async ()=> sampleXml });
    const { times } = await __gibsUtils.fetchCapabilities(fetchMock, 'GOES-East_ABI_GeoColor');
    expect(times).toEqual(['2025-08-22T15:00:00Z','2025-08-22T16:00:00Z','2025-08-22T17:00:00Z']);
  });
  it('returns empty when layer missing', async () => {
    const fetchMock: any = async () => ({ ok:true, text: async ()=> sampleXml });
    const { times } = await __gibsUtils.fetchCapabilities(fetchMock, 'UNKNOWN_LAYER');
    expect(times).toEqual([]);
  });
});