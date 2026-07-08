import { describe, expect, it } from "vitest";
import { buildIssueBody } from "../src/services/template/issueBody.js";
import type { IssueDraft, ReportContext } from "../src/schemas/triage.js";

const draft: IssueDraft = {
  title: "프로필 동기화 실패",
  summary: "동기화 버튼이 응답하지 않음",
  reproduction: "프로필 동기화 버튼 클릭",
  expected: "프로필이 동기화된다",
  actual: "아무 반응이 없고 500 에러",
  labels: ["bug", "triage"],
  type: "bug",
  priority: "medium",
  needsMoreInfo: false,
};

const context: ReportContext = {
  content: "버그 있어요",
  reporterId: "123456789012345678",
  reporterName: "tester",
  guildId: "111111111111111111",
  channelId: "222222222222222222",
  messageUrl:
    "https://discord.com/channels/111111111111111111/222222222222222222/333333333333333333",
  attachments: [],
};

const REQUIRED_HEADERS = [
  "## Summary",
  "## Details",
  "## Steps to Reproduce",
  "## Expected Behavior",
  "## Actual Behavior",
  "## Discord Context",
  "## Original Report",
  "## Attachments",
];

describe("buildIssueBody", () => {
  it("includes every required section header in order", () => {
    const body = buildIssueBody(draft, context);
    let lastIndex = -1;
    for (const header of REQUIRED_HEADERS) {
      const index = body.indexOf(header);
      expect(index).toBeGreaterThan(lastIndex);
      lastIndex = index;
    }
  });

  it("renders reporter name and message link but hides raw ids", () => {
    const body = buildIssueBody(draft, context);
    expect(body).toContain(context.reporterName);
    expect(body).toContain(context.messageUrl);
    // 숫자 reporter id / Guild ID / Channel ID 라벨은 노출하지 않는다
    expect(body).not.toContain(context.reporterId);
    expect(body).not.toContain("Guild ID:");
    expect(body).not.toContain("Channel ID:");
  });

  it("includes the raw original report content", () => {
    const body = buildIssueBody(draft, context);
    expect(body).toContain(context.content);
  });

  it("maps structured draft fields into their sections", () => {
    const body = buildIssueBody(draft, context);
    expect(body).toContain(`## Summary\n\n${draft.summary}`);
    expect(body).toContain(draft.reproduction!);
    expect(body).toContain(draft.expected!);
    expect(body).toContain(draft.actual!);
  });

  it("falls back to the original report when details/steps are omitted", () => {
    const minimal: IssueDraft = {
      title: "t",
      summary: "s",
      labels: [],
      type: "question",
      priority: "low",
      needsMoreInfo: false,
    };
    const body = buildIssueBody(minimal, context);
    // details 미제공 → Details 섹션에 원문 대체
    expect(body).toContain(`## Details\n\n${context.content}`);
    expect(body).toContain("제공된 재현 절차 없음");
  });

  it("treats empty-string optional fields as absent (AI returned \"\")", () => {
    const withEmpties: IssueDraft = {
      ...draft,
      details: "",
      expected: "   ",
      reproduction: "",
    };
    const body = buildIssueBody(withEmpties, context);
    expect(body).toContain(`## Details\n\n${context.content}`);
    expect(body).toContain("제공된 재현 절차 없음");
    expect(body).toContain("트리아지 시 보완");
  });

  it("prepends a warning banner when needsMoreInfo is set (Layer 3)", () => {
    const body = buildIssueBody({ ...draft, needsMoreInfo: true }, context);
    expect(body).toContain("⚠️");
    expect(body).toContain("추가 정보가 필요합니다");
    expect(body.indexOf("⚠️")).toBeLessThan(body.indexOf("## Summary"));
  });

  it('renders "없음" for empty attachments', () => {
    const body = buildIssueBody(draft, context);
    expect(body).toContain("없음");
  });

  it("renders image attachments inline (ignoring querystring in extension detection)", () => {
    const url =
      "https://cdn.discordapp.com/ephemeral-attachments/1524/148.png?ex=6a4fa636&is=6a4e54b6&hm=3f53&";
    const body = buildIssueBody(draft, { ...context, attachments: [url] });
    expect(body).toContain(`![148.png](<${url}>)`);
  });

  it("renders video attachments as a link, not an inline image", () => {
    const url = "https://cdn.discordapp.com/attachments/1524/clip.mp4?ex=1&is=2&hm=3&";
    const body = buildIssueBody(draft, { ...context, attachments: [url] });
    expect(body).toContain(`[clip.mp4](<${url}>)`);
    expect(body).not.toContain(`![clip.mp4]`);
  });

  it("renders other file types as a link", () => {
    const url = "https://example.com/report.pdf";
    const body = buildIssueBody(draft, { ...context, attachments: [url] });
    expect(body).toContain(`- [report.pdf](<${url}>)`);
  });

  it("renders multiple image attachments each inline", () => {
    const a = "https://example.com/a.png";
    const b = "https://example.com/b.jpg";
    const body = buildIssueBody(draft, { ...context, attachments: [a, b] });
    expect(body).toContain(`![a.png](<${a}>)`);
    expect(body).toContain(`![b.jpg](<${b}>)`);
  });

  it("escapes bracket chars in filenames so the image link isn't broken (F1)", () => {
    const url = "https://cdn.discordapp.com/attachments/1/photo%20%5B1%5D.png";
    const body = buildIssueBody(draft, { ...context, attachments: [url] });
    // 원본 URL이 온전히 포함되고, alt 텍스트의 대괄호는 escape 됨
    expect(body).toContain(`(<${url}>)`);
    expect(body).toContain("\\[");
    expect(body).toContain("\\]");
  });

  it("does not let a crafted filename inject raw markdown (F1)", () => {
    // 디코딩하면 "x](https://evil.com) ![y.png" 가 되는 파일명
    const url =
      "https://cdn.discordapp.com/attachments/1/x%5D(https%3A%2F%2Fevil.com)%20!%5By.png";
    const body = buildIssueBody(draft, { ...context, attachments: [url] });
    expect(body).not.toContain("](https://evil.com)");
  });

  it("keeps the link intact when the URL contains parens (F1)", () => {
    const url = "https://example.com/a(1).png";
    const body = buildIssueBody(draft, { ...context, attachments: [url] });
    expect(body).toContain(`(<${url}>)`);
  });

  it("does not treat a path-less URL as an image and hides the full URL (F2)", () => {
    const url = "https://cdn.example.com/?token=a.png";
    const body = buildIssueBody(draft, { ...context, attachments: [url] });
    expect(body).not.toContain("![");
    expect(body).toContain("attachment");
    expect(body).not.toContain("token=a.png](");
  });

  it("decodes percent-encoding for the display name", () => {
    const url = "https://example.com/my%20photo.png";
    const body = buildIssueBody(draft, { ...context, attachments: [url] });
    expect(body).toContain("my photo.png");
  });

  it("omits the AI marker by default", () => {
    const body = buildIssueBody(draft, context);
    expect(body).not.toContain("AI 생성 초안");
  });

  it("includes the AI marker only when aiGenerated is true", () => {
    const body = buildIssueBody(draft, context, { aiGenerated: true });
    expect(body).toContain("AI 생성 초안");
  });
});
