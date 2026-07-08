/**
 * README 6장. AI provider 추상화.
 *
 * 실제 LLM 호출을 인터페이스 뒤로 감춰서, draft 생성 로직이 특정 SDK/제공자에
 * 묶이지 않고 테스트에서는 fake provider 로 대체할 수 있게 한다.
 */

import OpenAI from "openai";
import { AppError } from "../../errors.js";
import type { Config } from "../../config/env.js";

export interface AiProvider {
  complete(system: string, user: string): Promise<string>;
}

/** config.ai 설정으로 OpenAI 호환 클라이언트를 만드는 AiProvider 구현체. */
export function createOpenAiProvider(config: Config): AiProvider {
  const client = new OpenAI({
    apiKey: config.ai.apiKey,
    ...(config.ai.baseUrl ? { baseURL: config.ai.baseUrl } : {}),
  });

  return {
    async complete(system: string, user: string): Promise<string> {
      try {
        const response = await client.chat.completions.create({
          model: config.ai.model,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          response_format: { type: "json_object" },
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new AppError("AI_PROVIDER_ERROR", "AI provider returned an empty response");
        }
        return content;
      } catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError(
          "AI_PROVIDER_ERROR",
          `AI provider request failed: ${err instanceof Error ? err.message : String(err)}`,
          err,
        );
      }
    },
  };
}
