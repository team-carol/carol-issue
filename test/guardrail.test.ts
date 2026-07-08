import { describe, expect, it } from "vitest";
import {
  enforceGroundingGuardrail,
  isSparseReport,
} from "../src/services/ai/guardrail.js";
import type { IssueDraft, ReportContext } from "../src/schemas/triage.js";

const baseContext: ReportContext = {
  content:
    "프로필 동기화 버튼을 눌러도 아무 반응이 없고 콘솔에 500 에러가 발생합니다. 새로고침해도 동일합니다.",
  reporterId: "123456789012345678",
  reporterName: "tester",
  guildId: "111111111111111111",
  channelId: "222222222222222222",
  messageUrl:
    "https://discord.com/channels/111111111111111111/222222222222222222/333333333333333333",
  attachments: [],
};

const richDraft: IssueDraft = {
  title: "프로필 동기화 실패",
  summary: "동기화 버튼 무응답",
  details: "자세한 설명",
  reproduction: "1. 버튼 클릭",
  expected: "동기화됨",
  actual: "500 에러",
  labels: ["bug"],
  type: "bug",
  priority: "high",
  needsMoreInfo: false,
};

describe("isSparseReport", () => {
  it("treats a long, detailed report as not sparse", () => {
    expect(isSparseReport(baseContext)).toBe(false);
  });

  it("treats a one-liner as sparse", () => {
    expect(isSparseReport({ ...baseContext, content: "안돼요" })).toBe(true);
  });

  it("treats a short few-word report as sparse", () => {
    expect(isSparseReport({ ...baseContext, content: "프로필 안 나옴" })).toBe(true);
  });

  it("is not sparse when attachments provide extra context", () => {
    expect(
      isSparseReport({
        ...baseContext,
        content: "안돼요",
        attachments: ["https://example.com/log.txt"],
      }),
    ).toBe(false);
  });

  it("is not sparse when a conversation log is present", () => {
    expect(
      isSparseReport({ ...baseContext, content: "안돼요", conversationLog: "긴 대화 로그..." }),
    ).toBe(false);
  });
});

describe("enforceGroundingGuardrail", () => {
  it("keeps all fields for a rich report", () => {
    const out = enforceGroundingGuardrail(richDraft, baseContext);
    expect(out).toEqual(richDraft);
  });

  it("strips speculative fields for a sparse report", () => {
    const out = enforceGroundingGuardrail(richDraft, { ...baseContext, content: "안돼요" });
    expect(out.needsMoreInfo).toBe(true);
    expect(out.details).toBeUndefined();
    expect(out.reproduction).toBeUndefined();
    expect(out.expected).toBeUndefined();
    expect(out.actual).toBeUndefined();
    expect(out.title).toBe(richDraft.title);
    expect(out.summary).toBe(richDraft.summary);
    expect(out.labels).toEqual(richDraft.labels);
  });

  it("strips fields when the model self-reports needsMoreInfo even if input is rich", () => {
    const out = enforceGroundingGuardrail(
      { ...richDraft, needsMoreInfo: true },
      baseContext,
    );
    expect(out.reproduction).toBeUndefined();
    expect(out.needsMoreInfo).toBe(true);
  });
});
