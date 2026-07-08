import type { Config } from "../src/config/env.js";

/** 테스트용 Config 팩토리. */
export function makeTestConfig(overrides: Partial<Config["auth"]> = {}): Config {
  return {
    port: 3000,
    baseUrl: "http://localhost:3000",
    github: {
      appId: "1",
      installationId: "2",
      owner: "team-carol",
      repo: "carol",
      repository: "team-carol/carol",
      privateKey: "KEY",
    },
    ai: { provider: "openai", apiKey: "sk-test", model: "gpt-4o-mini" },
    auth: {
      sharedSecret: "the-secret",
      allowedClientIds: [],
      allowedGuildIds: [],
      ...overrides,
    },
  };
}

export const validReportBody = {
  content: "프로필 동기화가 안돼요",
  reporterId: "123456789012345678",
  reporterName: "홍길동",
  guildId: "111111111111111111",
  channelId: "222222222222222222",
  messageUrl:
    "https://discord.com/channels/111111111111111111/222222222222222222/333333333333333333",
  attachments: [],
};

export const validDraft = {
  title: "프로필 동기화 실패",
  summary: "동기화 버튼을 눌러도 반응이 없음",
  actual: "버튼 클릭 시 500 에러",
  labels: ["bug", "triage"],
  type: "bug" as const,
  priority: "medium" as const,
};
