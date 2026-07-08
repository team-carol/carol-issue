import { describe, expect, it } from "vitest";
import { buildIssueBody } from "../src/services/template/issueBody.js";
import type { IssueDraft, ReportContext } from "../src/schemas/triage.js";

const draft: IssueDraft = {
  title: "프로필 동기화 실패",
  body: "동기화 안됨",
  labels: ["bug", "triage"],
  type: "bug",
  priority: "medium",
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

  it("renders Discord context details and message link", () => {
    const body = buildIssueBody(draft, context);
    expect(body).toContain(context.reporterName);
    expect(body).toContain(context.reporterId);
    expect(body).toContain(context.guildId);
    expect(body).toContain(context.channelId);
    expect(body).toContain(context.messageUrl);
  });

  it("includes the raw original report content", () => {
    const body = buildIssueBody(draft, context);
    expect(body).toContain(context.content);
  });

  it('renders "없음" for empty attachments', () => {
    const body = buildIssueBody(draft, context);
    expect(body).toContain("없음");
  });

  it("renders attachments as markdown links when present", () => {
    const withAttachments: ReportContext = {
      ...context,
      attachments: ["https://example.com/file.png"],
    };
    const body = buildIssueBody(draft, withAttachments);
    expect(body).toContain("[https://example.com/file.png](https://example.com/file.png)");
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
