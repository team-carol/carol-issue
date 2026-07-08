import type { IssueDraft, ReportContext } from "../../schemas/triage.js";

/**
 * README 8장. 생성되는 Issue body는 일정한 형식(Summary/Details/Steps to
 * Reproduce/Expected/Actual/Discord Context/Original Report/Attachments)을
 * 가져야 하며, AI가 생성한 draft인 경우 그 사실을 표시한다.
 */

export interface BuildIssueBodyOptions {
  /** true이면 AI가 생성한 draft라는 표시를 본문 끝에 남긴다. */
  aiGenerated?: boolean;
}

function formatAttachments(attachments: string[]): string {
  if (attachments.length === 0) return "없음";
  return attachments.map((url) => `- [${url}](${url})`).join("\n");
}

export function buildIssueBody(
  draft: IssueDraft,
  context: ReportContext,
  opts: BuildIssueBodyOptions = {},
): string {
  const sections = [
    `## Summary\n\n${draft.summary}`,
    `## Details\n\n${draft.details ?? context.content}`,
    `## Steps to Reproduce\n\n${draft.reproduction ?? context.conversationLog ?? "제공된 재현 절차 없음"}`,
    `## Expected Behavior\n\n${draft.expected ?? "(제보 내용을 바탕으로 트리아지 시 보완)"}`,
    `## Actual Behavior\n\n${draft.actual ?? "(제보 내용을 바탕으로 트리아지 시 보완)"}`,
    [
      "## Discord Context",
      "",
      `- Reporter: ${context.reporterName} (${context.reporterId})`,
      `- Guild ID: ${context.guildId}`,
      `- Channel ID: ${context.channelId}`,
      `- Message: [${context.messageUrl}](${context.messageUrl})`,
    ].join("\n"),
    `## Original Report\n\n> ${context.content.replace(/\n/g, "\n> ")}`,
    `## Attachments\n\n${formatAttachments(context.attachments)}`,
  ];

  if (opts.aiGenerated) {
    sections.push("> 🤖 AI 생성 초안");
  }

  return sections.join("\n\n");
}
