import { describe, expect, it } from "vitest";
import { generateDraft } from "../src/services/ai/draftGenerator.js";
import type { AiProvider } from "../src/services/ai/provider.js";
import { AppError } from "../src/errors.js";
import type { ReportContext } from "../src/schemas/triage.js";

const validContext: ReportContext = {
  content:
    "프로필 동기화 버튼을 눌러도 아무 반응이 없고 콘솔에 500 에러가 발생합니다. 새로고침해도 동일하게 재현됩니다.",
  reporterId: "123456789012345678",
  reporterName: "tester",
  guildId: "111111111111111111",
  channelId: "222222222222222222",
  messageUrl:
    "https://discord.com/channels/111111111111111111/222222222222222222/333333333333333333",
  attachments: [],
};

const sparseContext: ReportContext = { ...validContext, content: "안돼요" };

const validDraftJson = JSON.stringify({
  title: "버그 리포트",
  summary: "사용자가 버그를 발견했습니다.",
  labels: ["bug"],
  type: "bug",
  priority: "medium",
});

function fakeProvider(complete: AiProvider["complete"]): AiProvider {
  return { complete };
}

describe("generateDraft", () => {
  it("resolves to a validated IssueDraft when provider returns valid JSON", async () => {
    const provider = fakeProvider(async () => validDraftJson);

    const draft = await generateDraft(validContext, provider);

    expect(draft).toEqual({
      title: "버그 리포트",
      summary: "사용자가 버그를 발견했습니다.",
      labels: ["bug"],
      type: "bug",
      priority: "medium",
      needsMoreInfo: false,
    });
  });

  it("strips fabricated detail fields for a sparse report (guardrail)", async () => {
    // 모델이 없는 재현/기대/실제를 지어내도, 희소 제보면 코드가 제거해야 한다.
    const provider = fakeProvider(async () =>
      JSON.stringify({
        title: "버그",
        summary: "안돼요",
        reproduction: "1. 로그인 2. 프로필 열기 3. 500 에러 (지어낸 절차)",
        expected: "정상 표시되어야 함 (지어냄)",
        actual: "에러 발생 (지어냄)",
        labels: ["bug"],
        type: "bug",
        priority: "high",
      }),
    );

    const draft = await generateDraft(sparseContext, provider);

    expect(draft.needsMoreInfo).toBe(true);
    expect(draft.reproduction).toBeUndefined();
    expect(draft.expected).toBeUndefined();
    expect(draft.actual).toBeUndefined();
    expect(draft.details).toBeUndefined();
    // 요약/분류는 유지
    expect(draft.title).toBe("버그");
    expect(draft.summary).toBe("안돼요");
  });

  it("rejects with AI_INVALID_OUTPUT when provider returns invalid JSON", async () => {
    const provider = fakeProvider(async () => "not json");

    await expect(generateDraft(validContext, provider)).rejects.toMatchObject({
      code: "AI_INVALID_OUTPUT",
    });
  });

  it("rejects with AI_INVALID_OUTPUT when JSON is missing/invalid fields", async () => {
    const provider = fakeProvider(async () =>
      JSON.stringify({ title: "제목만 있음" }),
    );

    await expect(generateDraft(validContext, provider)).rejects.toMatchObject({
      code: "AI_INVALID_OUTPUT",
    });
  });

  it("propagates AppError(AI_PROVIDER_ERROR) thrown by the provider", async () => {
    const provider = fakeProvider(async () => {
      throw new AppError("AI_PROVIDER_ERROR", "provider unreachable");
    });

    await expect(generateDraft(validContext, provider)).rejects.toMatchObject({
      code: "AI_PROVIDER_ERROR",
    });
  });
});
