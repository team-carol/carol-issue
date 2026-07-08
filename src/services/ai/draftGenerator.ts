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
import { enforceGroundingGuardrail } from "./guardrail.js";

const SYSTEM_PROMPT = `You are a triage assistant that turns a Discord bug/feature report into a structured GitHub issue draft.
Respond with ONLY a single JSON object (no markdown, no code fences, no extra text) with these fields:
- "title": short, clear issue title (string, required)
- "summary": 1-2 sentence summary of the problem (string, required)
- "details": fuller description if useful (string, optional — omit if it would just repeat the summary or the original report)
- "reproduction": steps to reproduce (string, optional — include only if inferable)
- "expected": expected behavior (string, optional)
- "actual": actual behavior (string, optional)
- "labels": array of relevant short label strings (string[])
- "type": one of "bug", "feature", "question", "task", "other"
- "priority": one of "low", "medium", "high", "critical"
- "needsMoreInfo": boolean — set true when the report is too short/vague to be actionable

Rules:
- Ground EVERY field ONLY in facts explicitly stated in the report. NEVER invent reproduction steps, error messages, numbers, stack traces, or expected/actual behavior that are not stated. Fabrication is worse than omission.
- Omit any optional field (details/reproduction/expected/actual) you cannot ground in the report. It is correct to omit them for a short report.
- If the report is too sparse to be actionable, set "needsMoreInfo": true, keep "summary" a faithful paraphrase of the report, and do NOT fabricate any details.
- Do NOT restate metadata (reporter name/id, guild id, channel id, message URL, attachments, the raw original report). A template adds those automatically.
- Keep each field concise. Write text fields in the SAME language as the report content (Korean report -> Korean text). Keep "type" and "priority" as the exact English enum values above.
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

  // Layer 3: 희소 제보면 투기적 필드를 강제 제거(할루시네이션 백스톱)
  const guarded = enforceGroundingGuardrail(result.data, context);

  logger.info("draft generated", { needsMoreInfo: guarded.needsMoreInfo });

  return guarded;
}
