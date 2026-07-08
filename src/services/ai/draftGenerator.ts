/**
 * README 6장(3장). Discord 제보 컨텍스트를 AI provider 에 넘겨 IssueDraft 를 생성한다.
 *
 * 모델 출력은 절대 그대로 신뢰하지 않는다: JSON.parse 와 IssueDraft.safeParse 를
 * 모두 통과한 값만 반환한다.
 */

import { IssueDraft } from "../../schemas/triage.js";
import type { ReportContext } from "../../schemas/triage.js";
import { AppError } from "../../errors.js";
import { logger } from "../../lib/logger.js";
import type { AiProvider } from "./provider.js";

const SYSTEM_PROMPT = `You are an assistant that converts a Discord bug/feature report into a GitHub issue draft.
Read the report context provided by the user and respond with ONLY a single JSON object (no markdown, no code fences, no extra text) with exactly these fields:
- "title": a short, clear issue title (string)
- "body": a detailed issue body written in Markdown, summarizing the report (string)
- "labels": an array of relevant short label strings (string[])
- "type": one of "bug", "feature", "question", "task", "other"
- "priority": one of "low", "medium", "high", "critical"

Write "title" and "body" in the SAME language as the report content (e.g. if the report is in Korean, write them in Korean). Keep "type" and "priority" as the exact English enum values above.
Respond with the JSON object only.`;

function buildUserPrompt(context: ReportContext): string {
  const lines: string[] = [
    `Content: ${context.content}`,
    `Reporter: ${context.reporterName} (id: ${context.reporterId})`,
    `Guild id: ${context.guildId}`,
    `Channel id: ${context.channelId}`,
    `Message URL: ${context.messageUrl}`,
  ];

  if (context.conversationLog) {
    lines.push(`Conversation log:\n${context.conversationLog}`);
  }

  if (context.attachments.length > 0) {
    lines.push(`Attachments:\n${context.attachments.join("\n")}`);
  }

  return lines.join("\n");
}

/** 제보 컨텍스트로부터 검증된 IssueDraft 를 생성한다. */
export async function generateDraft(
  context: ReportContext,
  provider: AiProvider,
): Promise<IssueDraft> {
  const raw = await provider.complete(SYSTEM_PROMPT, buildUserPrompt(context));

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch (err) {
    throw new AppError(
      "AI_INVALID_OUTPUT",
      `AI provider returned invalid JSON: ${err instanceof Error ? err.message : String(err)}`,
      err,
    );
  }

  const result = IssueDraft.safeParse(parsedJson);
  if (!result.success) {
    throw new AppError(
      "AI_INVALID_OUTPUT",
      `AI provider output does not match IssueDraft schema: ${result.error.message}`,
      result.error,
    );
  }

  logger.info("draft generated");

  return result.data;
}
