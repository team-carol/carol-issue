import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import type { Config } from "../src/config/env.js";
import { AppError } from "../src/errors.js";
import { createAuthMiddleware } from "../src/middleware/auth.js";

function makeConfig(overrides: Partial<Config["auth"]> = {}): Config {
  return {
    port: 3000,
    baseUrl: "http://localhost:3000",
    github: {
      appId: "1",
      installationId: "2",
      owner: "team-carol",
      repo: "carol",
      repository: "team-carol/carol",
      privateKey: "KEY",
    },
    ai: { provider: "openai", apiKey: "sk", model: "m" },
    auth: {
      sharedSecret: "the-secret",
      allowedClientIds: [],
      allowedGuildIds: [],
      ...overrides,
    },
  };
}

/** auth 미들웨어를 마운트한 최소 앱. onError로 AppError를 JSON 매핑. */
function appWith(config: Config): Hono {
  const app = new Hono();
  app.onError((err, c) => {
    if (err instanceof AppError) return c.json(err.toBody(), err.httpStatus as 401);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "x" } }, 500);
  });
  app.use("/triage/*", createAuthMiddleware(config));
  app.get("/triage/ping", (c) => c.json({ ok: true }));
  app.get("/health", (c) => c.json({ status: "ok" }));
  return app;
}

const auth = (secret: string) => ({ authorization: `Bearer ${secret}` });

describe("auth middleware", () => {
  it("rejects a missing Authorization header with UNAUTHORIZED", async () => {
    const res = await appWith(makeConfig()).request("/triage/ping");
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("UNAUTHORIZED");
  });

  it("rejects a wrong shared secret with UNAUTHORIZED", async () => {
    const res = await appWith(makeConfig()).request("/triage/ping", {
      headers: auth("wrong"),
    });
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("UNAUTHORIZED");
  });

  it("accepts a valid shared secret", async () => {
    const res = await appWith(makeConfig()).request("/triage/ping", {
      headers: auth("the-secret"),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("does not apply to exempt paths like /health", async () => {
    const res = await appWith(makeConfig()).request("/health");
    expect(res.status).toBe(200);
  });

  it("enforces the client id allowlist with FORBIDDEN_CLIENT", async () => {
    const config = makeConfig({ allowedClientIds: ["client-a"] });
    const denied = await appWith(config).request("/triage/ping", {
      headers: { ...auth("the-secret"), "x-carol-client-id": "client-b" },
    });
    expect(denied.status).toBe(403);
    expect((await denied.json()).error.code).toBe("FORBIDDEN_CLIENT");

    const ok = await appWith(config).request("/triage/ping", {
      headers: { ...auth("the-secret"), "x-carol-client-id": "client-a" },
    });
    expect(ok.status).toBe(200);
  });

  it("enforces the guild id allowlist with FORBIDDEN_GUILD", async () => {
    const config = makeConfig({ allowedGuildIds: ["guild-1"] });
    const res = await appWith(config).request("/triage/ping", {
      headers: { ...auth("the-secret"), "x-carol-guild-id": "guild-2" },
    });
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("FORBIDDEN_GUILD");
  });

  it("rejects an expired timestamp when signature TTL is configured", async () => {
    const config = makeConfig({ signatureTtlSeconds: 60 });
    const stale = String(Math.floor(Date.now() / 1000) - 120);
    const res = await appWith(config).request("/triage/ping", {
      headers: { ...auth("the-secret"), "x-carol-timestamp": stale },
    });
    expect(res.status).toBe(401);
  });
});
