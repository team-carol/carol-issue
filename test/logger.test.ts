import { afterEach, describe, expect, it } from "vitest";
import { __resetSecrets, redact, registerSecret } from "../src/lib/logger.js";

afterEach(() => __resetSecrets());

describe("redact", () => {
  it("masks sensitive keys by name", () => {
    const out = redact({
      authorization: "Bearer abc",
      apiKey: "sk-123",
      github_private_key: "PEM",
      installationToken: "tok",
      nested: { secret: "s", ok: "visible" },
    }) as Record<string, unknown>;

    expect(out.authorization).toBe("***REDACTED***");
    expect(out.apiKey).toBe("***REDACTED***");
    expect(out.github_private_key).toBe("***REDACTED***");
    expect(out.installationToken).toBe("***REDACTED***");
    expect((out.nested as Record<string, unknown>).secret).toBe("***REDACTED***");
    expect((out.nested as Record<string, unknown>).ok).toBe("visible");
  });

  it("masks registered secret literals inside arbitrary strings", () => {
    registerSecret("super-shared-secret");
    const out = redact({ note: "value is super-shared-secret here" }) as Record<string, unknown>;
    expect(out.note).not.toContain("super-shared-secret");
    expect(out.note).toContain("***REDACTED***");
  });

  it("leaves non-sensitive values untouched", () => {
    const out = redact({ count: 3, name: "carol" }) as Record<string, unknown>;
    expect(out.count).toBe(3);
    expect(out.name).toBe("carol");
  });

  it("handles circular references", () => {
    const obj: Record<string, unknown> = { a: 1 };
    obj.self = obj;
    expect(() => redact(obj)).not.toThrow();
  });
});
