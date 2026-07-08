import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import type { AiProvider } from "../src/services/ai/provider.js";
import type { GithubClient } from "../src/services/github/issueService.js";
import { makeTestConfig, validDraft, validReportBody } from "./helpers.js";

function jsonPost(body: unknown, withAuth = true): RequestInit {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (withAuth) headers.authorization = "Bearer the-secret";
  return { method: "POST", headers, body: JSON.stringify(body) };
}

function fakeAiProvider(text = JSON.stringify(validDraft)): {
  provider: AiProvider;
  calls: () => number;
} {
  let count = 0;
  return {
    provider: {
      complete: async () => {
        count += 1;
        return text;
      },
    },
    calls: () => count,
  };
}

function fakeGithubClient(): GithubClient & { lastCreateArgs?: { labels: string[] } } {
  const client: GithubClient & { lastCreateArgs?: { labels: string[] } } = {
    listRepoLabels: async () => ["bug", "triage", "enhancement"],
    createIssue: async (args) => {
      client.lastCreateArgs = { labels: args.labels };
      return { number: 12, html_url: "https://github.com/team-carol/carol/issues/12" };
    },
  };
  return client;
}

describe("POST /triage/draft", () => {
  it("rejects unauthenticated requests with 401", async () => {
    const app = createApp(makeTestConfig(), { aiProvider: fakeAiProvider().provider });
    const res = await app.request("/triage/draft", jsonPost(validReportBody, false));
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("UNAUTHORIZED");
  });

  it("returns a validated draft for a valid report", async () => {
    const app = createApp(makeTestConfig(), { aiProvider: fakeAiProvider().provider });
    const res = await app.request("/triage/draft", jsonPost(validReportBody));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.draft.title).toBe(validDraft.title);
    expect(json.draft.type).toBe("bug");
  });

  it("returns 400 VALIDATION_ERROR on an invalid body", async () => {
    const app = createApp(makeTestConfig(), { aiProvider: fakeAiProvider().provider });
    const res = await app.request(
      "/triage/draft",
      jsonPost({ ...validReportBody, content: "" }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("VALIDATION_ERROR");
  });
});

describe("POST /triage/issues", () => {
  it("creates an issue via the AI path", async () => {
    const ai = fakeAiProvider();
    const app = createApp(makeTestConfig(), {
      aiProvider: ai.provider,
      githubClient: fakeGithubClient(),
    });
    const res = await app.request("/triage/issues", jsonPost(validReportBody));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      issueNumber: 12,
      issueUrl: "https://github.com/team-carol/carol/issues/12",
    });
    expect(ai.calls()).toBe(1);
  });

  it("uses a client-provided draft without calling AI (README 5장)", async () => {
    const ai = fakeAiProvider();
    const gh = fakeGithubClient();
    const app = createApp(makeTestConfig(), { aiProvider: ai.provider, githubClient: gh });
    const res = await app.request(
      "/triage/issues",
      jsonPost({ ...validReportBody, draft: validDraft }),
    );
    expect(res.status).toBe(200);
    expect(ai.calls()).toBe(0);
    // 존재하지 않는 label 은 없고 triage 는 항상 포함
    expect(gh.lastCreateArgs?.labels).toContain("triage");
  });

  it("returns 401 without authorization", async () => {
    const app = createApp(makeTestConfig(), {
      aiProvider: fakeAiProvider().provider,
      githubClient: fakeGithubClient(),
    });
    const res = await app.request("/triage/issues", jsonPost(validReportBody, false));
    expect(res.status).toBe(401);
  });
});
