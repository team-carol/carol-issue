import { describe, expect, it } from "vitest";
import { generateDraft } from "../src/services/ai/draftGenerator.js";
import type { AiProvider } from "../src/services/ai/provider.js";
import { AppError } from "../src/errors.js";
import type { ReportContext } from "../src/schemas/triage.js";

const validContext: ReportContext = {
  content: "버그 있어요",
  reporterId: "123456789012345678",
  reporterName: "tester",
  guildId: "111111111111111111",
  channelId: "222222222222222222",
  messageUrl:
    "https://discord.com/channels/111111111111111111/222222222222222222/333333333333333333",
  attachments: [],
};

const validDraftJson = JSON.stringify({
  title: "버그 리포트",
  body: "사용자가 버그를 발견했습니다.",
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
      body: "사용자가 버그를 발견했습니다.",
      labels: ["bug"],
      type: "bug",
      priority: "medium",
    });
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
