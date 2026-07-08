import { Octokit } from "octokit";
import { createAppAuth } from "@octokit/auth-app";
import type { IssueDraft, ReportContext } from "../../schemas/triage.js";
import type { Config } from "../../config/env.js";
import { AppError } from "../../errors.js";
import { logger } from "../../lib/logger.js";
import { buildIssueBody } from "../template/issueBody.js";

/** README 9장. Issue에 항상 붙는 기본 label. */
const DEFAULT_LABEL = "triage";

/**
 * GithubClient가 필요로 하는 최소 인터페이스.
 * 실제 구현은 Octokit을 감싸고, 테스트는 fake를 주입해 네트워크를 타지 않는다.
 */
export interface GithubClient {
  listRepoLabels(owner: string, repo: string): Promise<string[]>;
  createIssue(args: {
    owner: string;
    repo: string;
    title: string;
    body: string;
    labels: string[];
  }): Promise<{ number: number; html_url: string }>;
}

/** README 7장. GitHub App installation 인증으로 Octokit 클라이언트를 만든다. */
export function createOctokitClient(config: Config): GithubClient {
  let octokit: Octokit;
  try {
    octokit = new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId: config.github.appId,
        privateKey: config.github.privateKey,
        installationId: config.github.installationId,
      },
    });
  } catch (err) {
    throw new AppError("GITHUB_AUTH_ERROR", "Failed to initialize GitHub App client", err);
  }

  return {
    async listRepoLabels(owner: string, repo: string): Promise<string[]> {
      try {
        const { data } = await octokit.rest.issues.listLabelsForRepo({ owner, repo });
        return data.map((label) => label.name);
      } catch (err) {
        throw new AppError("GITHUB_AUTH_ERROR", "Failed to list GitHub repo labels", err);
      }
    },
    async createIssue(args): Promise<{ number: number; html_url: string }> {
      try {
        const { data } = await octokit.rest.issues.create({
          owner: args.owner,
          repo: args.repo,
          title: args.title,
          body: args.body,
          labels: args.labels,
        });
        return { number: data.number, html_url: data.html_url };
      } catch (err) {
        throw new AppError("GITHUB_CREATE_ISSUE_ERROR", "Failed to create GitHub issue", err);
      }
    },
  };
}

/** 존재하는 repo label로만 필터링하고, 기본 label(triage)을 항상 포함시킨다. */
function resolveLabels(requested: string[], existing: string[]): string[] {
  const existingSet = new Set(existing);
  const filtered = requested.filter((label) => existingSet.has(label));
  const withDefault = filtered.includes(DEFAULT_LABEL)
    ? filtered
    : [...filtered, DEFAULT_LABEL];
  return withDefault.length > 0 ? withDefault : [DEFAULT_LABEL];
}

export interface CreateGithubIssueParams {
  draft: IssueDraft;
  context: ReportContext;
  config: Config;
  /** 테스트/DI용. 없으면 실제 Octokit 클라이언트를 생성한다. */
  client?: GithubClient;
  /** true이면 body에 AI 생성 표시를 남긴다. */
  aiGenerated?: boolean;
}

/** README 4·7·9장. draft로부터 GitHub Issue를 생성한다. */
export async function createGithubIssue(
  params: CreateGithubIssueParams,
): Promise<{ issueNumber: number; issueUrl: string }> {
  const { draft, context, config, aiGenerated } = params;
  const client = params.client ?? createOctokitClient(config);
  const { owner, repo } = config.github;

  const body = buildIssueBody(draft, context, { aiGenerated });

  const existingLabels = await client.listRepoLabels(owner, repo);
  const labels = resolveLabels(draft.labels, existingLabels);

  try {
    const issue = await client.createIssue({
      owner,
      repo,
      title: draft.title,
      body,
      labels,
    });
    return { issueNumber: issue.number, issueUrl: issue.html_url };
  } catch (err) {
    if (err instanceof AppError) throw err;
    logger.error("Failed to create GitHub issue", { owner, repo, title: draft.title });
    throw new AppError("GITHUB_CREATE_ISSUE_ERROR", "Failed to create GitHub issue", err);
  }
}
