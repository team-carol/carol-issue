import { createRoute, type OpenAPIHono } from "@hono/zod-openapi";
import type { Config } from "../config/env.js";
import type { AppDeps } from "../appDeps.js";
import {
  ErrorResponse,
  TriageDraftRequest,
  TriageDraftResponse,
} from "../schemas/triage.js";
import { createOpenAiProvider } from "../services/ai/provider.js";
import { generateDraft } from "../services/ai/draftGenerator.js";
import { logger } from "../lib/logger.js";

/** README 3장. POST /triage/draft — 제보로부터 AI Issue 초안 생성. */
const route = createRoute({
  method: "post",
  path: "/triage/draft",
  summary: "Issue Draft 생성",
  description: "Discord 제보 내용을 받아 AI로 GitHub Issue 초안을 생성한다.",
  security: [{ CarolSecret: [] }],
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: TriageDraftRequest } },
    },
  },
  responses: {
    200: {
      description: "생성된 draft",
      content: { "application/json": { schema: TriageDraftResponse } },
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
      description: "AI provider 오류 또는 잘못된 AI 출력",
      content: { "application/json": { schema: ErrorResponse } },
    },
  },
});

export function registerTriageDraft(app: OpenAPIHono, config: Config, deps: AppDeps): void {
  app.openapi(route, async (c) => {
    const body = c.req.valid("json");
    const provider = deps.aiProvider ?? createOpenAiProvider(config);
    const draft = await generateDraft(body, provider);
    logger.info("draft created", { reporterId: body.reporterId });
    return c.json({ draft }, 200);
  });
}
