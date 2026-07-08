import { describe, expect, it } from "vitest";
import {
  CreateIssueRequest,
  IssueDraft,
  TriageDraftRequest,
} from "../src/schemas/triage.js";

const validContext = {
  content: "프로필 동기화가 안돼요",
  reporterId: "123456789012345678",
  reporterName: "홍길동",
  guildId: "111111111111111111",
  channelId: "222222222222222222",
  messageUrl:
    "https://discord.com/channels/111111111111111111/222222222222222222/333333333333333333",
};

const validDraft = {
  title: "프로필 동기화 실패",
  summary: "동기화 버튼을 눌러도 반응이 없음",
  labels: ["bug", "triage"],
  type: "bug",
  priority: "medium",
};

describe("TriageDraftRequest", () => {
  it("accepts a valid report and defaults attachments to []", () => {
    const parsed = TriageDraftRequest.parse(validContext);
    expect(parsed.attachments).toEqual([]);
    expect(parsed.content).toBe("프로필 동기화가 안돼요");
  });

  it("rejects empty content", () => {
    expect(() => TriageDraftRequest.parse({ ...validContext, content: "   " })).toThrow();
  });

  it("rejects a malformed reporter id", () => {
    expect(() => TriageDraftRequest.parse({ ...validContext, reporterId: "abc" })).toThrow();
  });

  it("rejects a non-Discord message url", () => {
    expect(() =>
      TriageDraftRequest.parse({ ...validContext, messageUrl: "https://example.com/x" }),
    ).toThrow();
  });

  it("rejects non-url attachments", () => {
    expect(() =>
      TriageDraftRequest.parse({ ...validContext, attachments: ["not-a-url"] }),
    ).toThrow();
  });
});

describe("IssueDraft", () => {
  it("accepts a valid draft", () => {
    const parsed = IssueDraft.parse(validDraft);
    expect(parsed.type).toBe("bug");
    expect(parsed.priority).toBe("medium");
  });

  it("defaults labels to []", () => {
    const { labels, ...rest } = validDraft;
    void labels;
    expect(IssueDraft.parse(rest).labels).toEqual([]);
  });

  it("rejects an over-long title", () => {
    expect(() => IssueDraft.parse({ ...validDraft, title: "x".repeat(257) })).toThrow();
  });

  it("rejects an unknown type", () => {
    expect(() => IssueDraft.parse({ ...validDraft, type: "nope" })).toThrow();
  });
});

describe("CreateIssueRequest", () => {
  it("works without a draft (AI path)", () => {
    const parsed = CreateIssueRequest.parse(validContext);
    expect(parsed.draft).toBeUndefined();
  });

  it("works with an external draft (direct path, README 5장)", () => {
    const parsed = CreateIssueRequest.parse({ ...validContext, draft: validDraft });
    expect(parsed.draft?.title).toBe("프로필 동기화 실패");
  });
});
