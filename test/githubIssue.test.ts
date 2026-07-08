import { describe, expect, it, vi } from "vitest";
import {
  createGithubIssue,
  type GithubClient,
} from "../src/services/github/issueService.js";
import { AppError } from "../src/errors.js";
import type { Config } from "../src/config/env.js";
import type { IssueDraft, ReportContext } from "../src/schemas/triage.js";

const draft: IssueDraft = {
  title: "프로필 동기화 실패",
  summary: "동기화 안됨",
  labels: ["bug", "triage"],
  type: "bug",
  priority: "medium",
  needsMoreInfo: false,
};

const context: ReportContext = {
  content: "버그 있어요",
  reporterId: "123456789012345678",
  reporterName: "tester",
  guildId: "111111111111111111",
  channelId: "222222222222222222",
  messageUrl:
    "https://discord.com/channels/111111111111111111/222222222222222222/333333333333333333",
  attachments: [],
};

const config: Config = {
  port: 3000,
  baseUrl: "http://localhost:3000",
  github: {
    appId: "app-id",
    installationId: "install-id",
    owner: "team-carol",
    repo: "carol",
    repository: "team-carol/carol",
    privateKey: "fake-key",
  },
  ai: {
    provider: "openai",
    apiKey: "fake-api-key",
    model: "gpt-4",
  },
  auth: {
    sharedSecret: "shared-secret",
    allowedClientIds: [],
    allowedGuildIds: [],
  },
};

function makeFakeClient(overrides: Partial<GithubClient> = {}): GithubClient {
  return {
    listRepoLabels: vi.fn().mockResolvedValue(["bug", "triage", "enhancement"]),
    createIssue: vi.fn().mockResolvedValue({
      number: 12,
      html_url: "https://github.com/team-carol/carol/issues/12",
    }),
    ...overrides,
  };
}

describe("createGithubIssue", () => {
  it("creates an issue and returns its number and url", async () => {
    const client = makeFakeClient();

    const result = await createGithubIssue({ draft, context, config, client });

    expect(result).toEqual({
      issueNumber: 12,
      issueUrl: "https://github.com/team-carol/carol/issues/12",
    });
  });

  it("filters out labels that don't exist on the repo and always keeps triage", async () => {
    const createIssue = vi.fn().mockResolvedValue({
      number: 12,
      html_url: "https://github.com/team-carol/carol/issues/12",
    });
    const client = makeFakeClient({
      listRepoLabels: vi.fn().mockResolvedValue(["bug", "triage", "enhancement"]),
      createIssue,
    });

    await createGithubIssue({
      draft: { ...draft, labels: ["bug", "nonexistent"] },
      context,
      config,
      client,
    });

    expect(createIssue).toHaveBeenCalledTimes(1);
    const args = createIssue.mock.calls[0]?.[0];
    expect(args.labels).toContain("bug");
    expect(args.labels).toContain("triage");
    expect(args.labels).not.toContain("nonexistent");
  });

  it("adds the needs-info system label when needsMoreInfo is set", async () => {
    const createIssue = vi.fn().mockResolvedValue({
      number: 12,
      html_url: "https://github.com/team-carol/carol/issues/12",
    });
    const client = makeFakeClient({ createIssue });

    await createGithubIssue({
      draft: { ...draft, needsMoreInfo: true },
      context,
      config,
      client,
    });

    const args = createIssue.mock.calls[0]?.[0];
    expect(args.labels).toContain("triage");
    expect(args.labels).toContain("needs-info");
  });

  it("wraps issue creation failures in an AppError with GITHUB_CREATE_ISSUE_ERROR", async () => {
    const client = makeFakeClient({
      createIssue: vi.fn().mockRejectedValue(new Error("network down")),
    });

    await expect(createGithubIssue({ draft, context, config, client })).rejects.toMatchObject({
      code: "GITHUB_CREATE_ISSUE_ERROR",
    });

    await expect(
      createGithubIssue({ draft, context, config, client }),
    ).rejects.toBeInstanceOf(AppError);
  });
});
