import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "./index";

describe("proxy basic endpoints", () => {
  const app = createApp({ allowHosts: ["example.com"] });
  it("/health returns ok", async () => {
    const r = await request(app).get("/health");
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ ok: true });
  });
  it("/healthz returns status ok", async () => {
    const r = await request(app).get("/healthz");
    expect(r.status).toBe(200);
    expect(r.body.status).toBe("ok");
    expect(Array.isArray(r.body.upstreams)).toBe(true);
  });
  it("/version returns version", async () => {
    const r = await request(app).get("/version");
    expect(r.status).toBe(200);
    expect(r.body.version).toBeDefined();
  });
});
