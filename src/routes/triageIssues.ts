import { createRoute, type OpenAPIHono } from "@hono/zod-openapi";
import type { Config } from "../config/env.js";
import type { AppDeps } from "../appDeps.js";
import type { IssueDraft } from "../schemas/triage.js";
import {
  CreateIssueRequest,
  CreateIssueResponse,
  ErrorResponse,
} from "../schemas/triage.js";
import { createOpenAiProvider } from "../services/ai/provider.js";
import { generateDraft } from "../services/ai/draftGenerator.js";
import { createGithubIssue } from "../services/github/issueService.js";
import { logger } from "../lib/logger.js";

/**
 * README 4·5장. POST /triage/issues.
 * draft 가 함께 오면 AI 없이 그 초안으로 Issue 를 생성한다(5장 직접 생성).
 */
const route = createRoute({
  method: "post",
  path: "/triage/issues",
  summary: "GitHub Issue 생성",
  description: "제보로부터(또는 전달된 draft로) GitHub Issue를 생성한다.",
  security: [{ CarolSecret: [] }],
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: CreateIssueRequest } },
    },
  },
  responses: {
    200: {
      description: "생성된 Issue",
      content: { "application/json": { schema: CreateIssueResponse } },
    },
    400: {
      description: "요청 검증 실패",
      content: { "application/json": { schema: ErrorResponse } },
    },
    401: {
      description: "인증 실패",
      content: { "application/json": { schema: ErrorResponse } },
    },
    502: {
      description: "AI/GitHub 오류",
      content: { "application/json": { schema: ErrorResponse } },
    },
  },
});

export function registerTriageIssues(app: OpenAPIHono, config: Config, deps: AppDeps): void {
  app.openapi(route, async (c) => {
    const body = c.req.valid("json");

    let draft: IssueDraft | undefined = body.draft;
    let aiGenerated = false;
    if (!draft) {
      const provider = deps.aiProvider ?? createOpenAiProvider(config);
      draft = await generateDraft(body, provider);
      aiGenerated = true;
    }

    const result = await createGithubIssue({
      draft,
      context: body,
      config,
      client: deps.githubClient,
      aiGenerated,
    });

    logger.info("issue created", { issueNumber: result.issueNumber, aiGenerated });
    return c.json(result, 200);
  });
}
