import { describe, it, expect } from "vitest";
import type { Catalog, DataSource } from "./types";

describe("shared types", () => {
  it("Catalog shape compiles", () => {
    const ds: DataSource = {
      area: "US",
      layer: "Layer",
      provider: "NOAA",
      access: "public",
      base_url: "https://example.com",
    };
    const cat: Catalog = {
      generated_at: new Date().toISOString(),
      entries: [ds],
    };
    expect(cat.entries[0].provider).toBe("NOAA");
  });
});
