import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { makeTestConfig } from "./helpers.js";

describe("GET /health", () => {
  it("returns 200 with status ok", async () => {
    const app = createApp(makeTestConfig());
    const res = await app.request("/health");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });

  it("is reachable without authorization", async () => {
    const app = createApp(makeTestConfig({ allowedClientIds: ["x"] }));
    const res = await app.request("/health");
    expect(res.status).toBe(200);
  });
});
