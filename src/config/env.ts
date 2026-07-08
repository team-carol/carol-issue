import { readFileSync } from "node:fs";
import { z } from "zod";
import { registerSecret } from "../lib/logger.js";

/**
 * README 13장. 환경 변수 기반 서비스 설정.
 * 필수 값이 없으면 명확한 메시지와 함께 시작을 실패시킨다.
 */

const nonEmpty = z.string().trim().min(1);

const RawEnvSchema = z.object({
  // 서버
  PORT: z.coerce.number().int().positive().default(3000),
  BASE_URL: nonEmpty,

  // GitHub App (필수)
  GITHUB_APP_ID: nonEmpty,
  GITHUB_INSTALLATION_ID: nonEmpty,

  // repository: GITHUB_REPOSITORY(owner/repo) 우선, 없으면 OWNER/REPO 하위호환
  GITHUB_REPOSITORY: z.string().trim().optional(),
  GITHUB_OWNER: z.string().trim().optional(),
  GITHUB_REPO: z.string().trim().optional(),

  // private key (둘 중 하나)
  GITHUB_PRIVATE_KEY: z.string().optional(),
  GITHUB_PRIVATE_KEY_FILE: z.string().trim().optional(),

  // AI provider (필수)
  AI_PROVIDER: nonEmpty,
  AI_API_KEY: nonEmpty,
  AI_MODEL: nonEmpty,
  AI_BASE_URL: z.string().trim().url().optional(),

  // carol 봇 연동 인증
  CAROL_SHARED_SECRET: nonEmpty,
  CAROL_ALLOWED_CLIENT_IDS: z.string().optional(),
  CAROL_ALLOWED_GUILD_IDS: z.string().optional(),
  CAROL_SIGNATURE_TTL_SECONDS: z.coerce.number().int().positive().optional(),
});

export interface Config {
  port: number;
  baseUrl: string;
  github: {
    appId: string;
    installationId: string;
    owner: string;
    repo: string;
    /** "owner/repo" */
    repository: string;
    privateKey: string;
  };
  ai: {
    provider: string;
    apiKey: string;
    model: string;
    baseUrl?: string;
  };
  auth: {
    sharedSecret: string;
    allowedClientIds: string[];
    allowedGuildIds: string[];
    signatureTtlSeconds?: number;
  };
}

function splitList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** GITHUB_REPOSITORY 또는 OWNER/REPO 로부터 owner/repo 를 해석한다. */
function resolveRepository(env: z.infer<typeof RawEnvSchema>): { owner: string; repo: string } {
  if (env.GITHUB_REPOSITORY) {
    const parts = env.GITHUB_REPOSITORY.split("/");
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      throw new Error('GITHUB_REPOSITORY must be in "owner/repo" format');
    }
    return { owner: parts[0], repo: parts[1] };
  }
  if (env.GITHUB_OWNER && env.GITHUB_REPO) {
    return { owner: env.GITHUB_OWNER, repo: env.GITHUB_REPO };
  }
  throw new Error("GITHUB_REPOSITORY (or GITHUB_OWNER + GITHUB_REPO) is required");
}

/** inline PEM 또는 파일 경로에서 private key 를 로드한다. */
function resolvePrivateKey(env: z.infer<typeof RawEnvSchema>): string {
  const inline = env.GITHUB_PRIVATE_KEY?.trim();
  if (inline) {
    // .env 에 한 줄로 넣은 경우 \n 을 실제 개행으로 복원
    return inline.includes("\\n") ? inline.replace(/\\n/g, "\n") : inline;
  }
  if (env.GITHUB_PRIVATE_KEY_FILE) {
    try {
      return readFileSync(env.GITHUB_PRIVATE_KEY_FILE, "utf8");
    } catch (err) {
      throw new Error(
        `Failed to read GITHUB_PRIVATE_KEY_FILE (${env.GITHUB_PRIVATE_KEY_FILE}): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
  throw new Error("GITHUB_PRIVATE_KEY or GITHUB_PRIVATE_KEY_FILE is required");
}

/**
 * 환경 변수를 검증하고 타입 있는 Config 를 만든다.
 * 실패 시 어떤 변수가 문제인지 포함한 Error 를 던진다.
 */
export function loadConfig(source: NodeJS.ProcessEnv = process.env): Config {
  const parsed = RawEnvSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  const env = parsed.data;

  const { owner, repo } = resolveRepository(env);
  const privateKey = resolvePrivateKey(env);

  const config: Config = {
    port: env.PORT,
    baseUrl: env.BASE_URL,
    github: {
      appId: env.GITHUB_APP_ID,
      installationId: env.GITHUB_INSTALLATION_ID,
      owner,
      repo,
      repository: `${owner}/${repo}`,
      privateKey,
    },
    ai: {
      provider: env.AI_PROVIDER,
      apiKey: env.AI_API_KEY,
      model: env.AI_MODEL,
      baseUrl: env.AI_BASE_URL,
    },
    auth: {
      sharedSecret: env.CAROL_SHARED_SECRET,
      allowedClientIds: splitList(env.CAROL_ALLOWED_CLIENT_IDS),
      allowedGuildIds: splitList(env.CAROL_ALLOWED_GUILD_IDS),
      signatureTtlSeconds: env.CAROL_SIGNATURE_TTL_SECONDS,
    },
  };

  // 로그 마스킹을 위해 시크릿 값 등록 (README 14장)
  registerSecret(config.auth.sharedSecret);
  registerSecret(config.ai.apiKey);
  registerSecret(config.github.privateKey);

  return config;
}
