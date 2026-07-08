import type { AiProvider } from "./services/ai/provider.js";
import type { GithubClient } from "./services/github/issueService.js";

/**
 * createApp 에 주입할 수 있는 의존성.
 * 테스트에서 네트워크를 타지 않도록 fake 를 주입한다.
 * 미지정 시 config 로부터 실제 provider/client 를 생성한다.
 */
export interface AppDeps {
  aiProvider?: AiProvider;
  githubClient?: GithubClient;
}
