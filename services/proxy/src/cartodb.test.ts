// Test file: mocks axios.
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

describe("cartodb proxy route", () => {
  beforeEach(() => vi.restoreAllMocks());
  it("serves a tile with correct headers", async () => {
    // Mock axios via dynamic import caching (simpler: intercept global fetch not used here)
    const mockPng = Buffer.from([137, 80, 78, 71]);
    // Monkey patch axios.get used in route
    const axiosMod = await import("axios");
    (axiosMod as any).default.get = vi.fn(async () => ({ data: mockPng }));
    const { createApp } = await import("./index.js");
    const app = createApp();
    const r = await request(app).get("/api/cartodb/positron/2/1/1.png");
    expect(r.status).toBe(200);
    expect(r.headers["content-type"]).toBe("image/png");
    expect(r.headers["cache-control"]).toContain("max-age=86400");
  });
  it("rejects invalid coords", async () => {
    const { createApp } = await import("./index.js");
    const app = createApp();
    const r = await request(app).get("/api/cartodb/positron/x/y/z.png");
    expect(r.status).toBe(400);
  });
});
