import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { makeTestConfig } from "./helpers.js";

describe("API docs (README 12장)", () => {
  it("serves a valid OpenAPI document with triage paths", async () => {
    const app = createApp(makeTestConfig());
    const res = await app.request("/openapi.json");
    expect(res.status).toBe(200);

    const doc = await res.json();
    expect(doc.openapi).toMatch(/^3\./);
    expect(doc.info.title).toBe("carol-issue");
    expect(doc.paths["/triage/draft"]).toBeDefined();
    expect(doc.paths["/triage/issues"]).toBeDefined();
    expect(doc.paths["/health"]).toBeDefined();
    expect(doc.components.schemas.IssueDraft).toBeDefined();
    expect(doc.components.securitySchemes.CarolSecret).toBeDefined();
  });

  it("serves the Scalar docs UI", async () => {
    const app = createApp(makeTestConfig());
    const res = await app.request("/docs");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
  });

  it("exposes docs endpoints without authentication", async () => {
    const app = createApp(makeTestConfig({ allowedClientIds: ["x"] }));
    expect((await app.request("/openapi.json")).status).toBe(200);
    expect((await app.request("/docs")).status).toBe(200);
  });
});
