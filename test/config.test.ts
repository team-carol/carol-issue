import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config/env.js";

const base: NodeJS.ProcessEnv = {
  PORT: "3000",
  BASE_URL: "http://localhost:3000",
  GITHUB_APP_ID: "123",
  GITHUB_INSTALLATION_ID: "456",
  GITHUB_REPOSITORY: "team-carol/carol",
  GITHUB_PRIVATE_KEY: "-----BEGIN KEY-----\\nabc\\n-----END KEY-----",
  AI_PROVIDER: "openai",
  AI_API_KEY: "sk-test",
  AI_MODEL: "gpt-4o-mini",
  CAROL_SHARED_SECRET: "shared-secret-value",
};

describe("loadConfig", () => {
  it("parses a valid environment", () => {
    const cfg = loadConfig(base);
    expect(cfg.port).toBe(3000);
    expect(cfg.github.repository).toBe("team-carol/carol");
    expect(cfg.github.owner).toBe("team-carol");
    expect(cfg.github.repo).toBe("carol");
    expect(cfg.ai.model).toBe("gpt-4o-mini");
    expect(cfg.auth.sharedSecret).toBe("shared-secret-value");
  });

  it("restores \\n in inline private key", () => {
    const cfg = loadConfig(base);
    expect(cfg.github.privateKey).toContain("\n");
    expect(cfg.github.privateKey).not.toContain("\\n");
  });

  it("throws listing the missing required variable", () => {
    const { CAROL_SHARED_SECRET, ...withoutSecret } = base;
    void CAROL_SHARED_SECRET;
    expect(() => loadConfig(withoutSecret)).toThrow(/CAROL_SHARED_SECRET/);
  });

  it("falls back to GITHUB_OWNER/GITHUB_REPO", () => {
    const { GITHUB_REPOSITORY, ...rest } = base;
    void GITHUB_REPOSITORY;
    const cfg = loadConfig({ ...rest, GITHUB_OWNER: "team-carol", GITHUB_REPO: "carol" });
    expect(cfg.github.repository).toBe("team-carol/carol");
  });

  it("rejects malformed GITHUB_REPOSITORY", () => {
    expect(() => loadConfig({ ...base, GITHUB_REPOSITORY: "not-a-repo" })).toThrow(/owner\/repo/);
  });

  it("requires a private key", () => {
    const { GITHUB_PRIVATE_KEY, ...rest } = base;
    void GITHUB_PRIVATE_KEY;
    expect(() => loadConfig(rest)).toThrow(/GITHUB_PRIVATE_KEY/);
  });

  it("splits allowed id lists", () => {
    const cfg = loadConfig({
      ...base,
      CAROL_ALLOWED_CLIENT_IDS: "a, b ,c",
      CAROL_ALLOWED_GUILD_IDS: "g1,g2",
    });
    expect(cfg.auth.allowedClientIds).toEqual(["a", "b", "c"]);
    expect(cfg.auth.allowedGuildIds).toEqual(["g1", "g2"]);
  });
});
