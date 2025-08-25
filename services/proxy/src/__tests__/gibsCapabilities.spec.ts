// Test: capabilities helpers
import { describe, it, expect, beforeEach } from "vitest";
import {
  getTimestamps,
  getLatestTimestamp,
  buildTileUrl,
  pickTms,
  __internals,
} from "../lib/gibs/capabilities.js";

// Minimal capabilities XML fixture with two layers
const CAPS = `<?xml version="1.0"?>
<Capabilities>
  <Contents>
    <Layer>
      <Title>GOES-East_ABI_GeoColor</Title>
      <Dimension name="time"><Value>2025-08-24T18:00:00Z 2025-08-24T19:00:00Z</Value></Dimension>
    </Layer>
    <Layer>
      <Title>MODIS_Terra_CorrectedReflectance_TrueColor</Title>
      <Dimension name="time"><Value>2025-08-22T00:00:00Z,2025-08-23T00:00:00Z,2025-08-24T00:00:00Z</Value></Dimension>
    </Layer>
  </Contents>
</Capabilities>`;

// Inject fetch mock
function installFetch(xml: string) {
  (global as any).fetch = async () => ({ ok: true, text: async () => xml });
  // clear caches
  __internals.capsCache.clear();
  __internals.tsCache.clear();
}

describe("gibs capabilities helpers", () => {
  beforeEach(() => installFetch(CAPS));

  it("pickTms heuristic", () => {
    expect(pickTms("GOES-East_ABI_GeoColor")).toBe(
      "GoogleMapsCompatible_Level8",
    );
    expect(pickTms("MODIS_Terra_CorrectedReflectance_TrueColor")).toBe(
      "GoogleMapsCompatible_Level9",
    );
  });

  it("getTimestamps + getLatestTimestamp for GOES", async () => {
    const ts = await getTimestamps("GOES-East_ABI_GeoColor");
    expect(ts).toEqual(["2025-08-24T18:00:00Z", "2025-08-24T19:00:00Z"]);
    expect(await getLatestTimestamp("GOES-East_ABI_GeoColor")).toBe(
      "2025-08-24T19:00:00Z",
    );
  });

  it("getTimestamps for MODIS daily", async () => {
    const ts = await getTimestamps(
      "MODIS_Terra_CorrectedReflectance_TrueColor",
    );
    expect(ts.length).toBe(3);
    expect(ts[0]).toBe("2025-08-22T00:00:00Z");
    expect(
      await getLatestTimestamp("MODIS_Terra_CorrectedReflectance_TrueColor"),
    ).toBe("2025-08-24T00:00:00Z");
  });

  it("buildTileUrl forms proper path", () => {
    const url = buildTileUrl({
      layerId: "GOES-East_ABI_GeoColor",
      z: 2,
      y: 1,
      x: 0,
      time: "2025-08-24T19:00:00Z",
    });
    expect(url).toMatch(
      /GOES-East_ABI_GeoColor\/default\/2025-08-24T19%3A00%3A00Z\/GoogleMapsCompatible_Level8\/2\/1\/0\.png$/,
    );
  });
});
