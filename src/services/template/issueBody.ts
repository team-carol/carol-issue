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

const IMAGE_EXT = new Set(["png", "jpg", "jpeg", "gif", "webp"]);
const VIDEO_EXT = new Set(["mp4", "mov", "webm"]);

/** 마크다운 링크/이미지 문법을 깨거나 주입에 쓰일 수 있는 문자를 백슬래시 escape. */
function escapeMarkdownText(text: string): string {
  return text.replace(/[\\`*_{}[\]()<>!#|]/g, "\\$&");
}

/**
 * URL의 pathname 마지막 세그먼트에서 파일명과 확장자를 뽑는다(쿼리스트링 제거).
 * path 세그먼트가 없거나 URL 파싱 실패 시 확장자 없는 "attachment" 로 처리해
 * 전체 URL이 파일명으로 새거나 이미지로 오판되는 것을 막는다.
 */
function parseAttachment(rawUrl: string): { filename: string; ext: string } {
  let segment: string | undefined;
  try {
    segment = new URL(rawUrl).pathname.split("/").filter(Boolean).pop();
  } catch {
    segment = undefined;
  }
  if (!segment) return { filename: "attachment", ext: "" };

  let filename = segment;
  try {
    filename = decodeURIComponent(segment);
  } catch {
    // 잘못된 % 시퀀스는 원문 유지
  }
  const dot = filename.lastIndexOf(".");
  const ext = dot > 0 ? filename.slice(dot + 1).toLowerCase() : "";
  return { filename, ext };
}

/**
 * 첨부를 확장자에 따라 렌더한다.
 * - 이미지: 본문에서 바로 보이도록 인라인(`![]()`)
 * - 영상/그 외: 링크(영상 인라인 재생은 GitHub 제약상 재호스팅 필요 → 후속)
 * 파일명은 escape, URL은 `<...>` 로 감싸 마크다운 깨짐/주입을 방지한다.
 */
function formatAttachments(attachments: string[]): string {
  if (attachments.length === 0) return "없음";
  return attachments
    .map((url) => {
      const { filename, ext } = parseAttachment(url);
      const name = escapeMarkdownText(filename);
      if (IMAGE_EXT.has(ext)) return `![${name}](<${url}>)`;
      if (VIDEO_EXT.has(ext)) return `- 🎬 [${name}](<${url}>)`;
      return `- [${name}](<${url}>)`;
    })
    .join("\n\n");
}

/** 빈/공백 문자열을 undefined 로 취급한다(AI가 "" 를 반환해도 fallback 이 걸리도록). */
function present(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function buildIssueBody(
  draft: IssueDraft,
  context: ReportContext,
  opts: BuildIssueBodyOptions = {},
): string {
  const sections = [
    `## Summary\n\n${draft.summary}`,
    `## Details\n\n${present(draft.details) ?? context.content}`,
    `## Steps to Reproduce\n\n${present(draft.reproduction) ?? present(context.conversationLog) ?? "제공된 재현 절차 없음"}`,
    `## Expected Behavior\n\n${present(draft.expected) ?? "(제보 내용을 바탕으로 트리아지 시 보완)"}`,
    `## Actual Behavior\n\n${present(draft.actual) ?? "(제보 내용을 바탕으로 트리아지 시 보완)"}`,
    [
      "## Discord Context",
      "",
      `- Reporter: ${context.reporterName}`,
      `- Message: [${context.messageUrl}](${context.messageUrl})`,
    ].join("\n"),
    `## Original Report\n\n> ${context.content.replace(/\n/g, "\n> ")}`,
    `## Attachments\n\n${formatAttachments(context.attachments)}`,
  ];

  // 희소 제보 배너를 최상단에 (Layer 3)
  if (draft.needsMoreInfo) {
    sections.unshift(
      "> ⚠️ 제보 내용이 짧아 세부 내용(재현 절차·기대/실제 동작)을 자동 생성하지 않았습니다. 정확한 트리아지를 위해 추가 정보가 필요합니다.",
    );
  }

  if (opts.aiGenerated) {
    sections.push("> 🤖 AI 생성 초안");
  }

  return sections.join("\n\n");
}
