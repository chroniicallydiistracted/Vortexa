import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "./index";

const BASES = [
  "https://gibs.earthdata.nasa.gov",
  "https://gibs.earthdata.nasa.gov/",
  "https://gibs.earthdata.nasa.gov/wmts",
  "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best",
  "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/wmts.cgi",
];

describe("/tiles/wmts normalization", () => {
  const app = createApp({ allowHosts: ["gibs.earthdata.nasa.gov"] });
  it("normalizes various base forms to a proxy redirect", async () => {
    for (const base of BASES) {
      const r = await request(app)
        .get("/tiles/wmts")
        .query({
          base,
          layer: "LAYER",
          x: 1,
          y: 2,
          z: 3,
          format: "png",
          time: "2025-01-01",
        });
      expect(r.status).toBe(307);
      expect(r.headers.location).toContain("/proxy?url=");
      const decoded = decodeURIComponent(r.headers.location.split("url=")[1]);
      expect(decoded).toMatch(
        /\/wmts\/epsg3857\/best\/LAYER\/default\/current\/GoogleMapsCompatible/,
      );
    }
  });
});
