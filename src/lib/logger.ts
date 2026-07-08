/**
 * README 14장. 서비스 동작 로그를 남기되, 다음 시크릿은 절대 남기지 않는다:
 * Authorization 헤더, GitHub private key, installation token, AI API key, CAROL_SHARED_SECRET.
 *
 * 두 겹으로 방어한다:
 *  1) 키 이름 기반 마스킹 (authorization / token / secret / api key / private key)
 *  2) 등록된 시크릿 리터럴 값 마스킹 (config 로드 시 registerSecret 로 등록)
 */

const MASK = "***REDACTED***";
const SENSITIVE_KEY = /(authorization|api[_-]?key|private[_-]?key|secret|token|password)/i;

const registeredSecrets = new Set<string>();

/** config 로드 시 실제 시크릿 값들을 등록해두면, 이후 어떤 로그 문자열에서도 마스킹된다. */
export function registerSecret(value: string | undefined | null): void {
  if (value && value.length >= 4) registeredSecrets.add(value);
}

/** 테스트용: 등록된 시크릿 초기화. */
export function __resetSecrets(): void {
  registeredSecrets.clear();
}

function maskRegisteredSecrets(text: string): string {
  let out = text;
  for (const secret of registeredSecrets) {
    if (out.includes(secret)) out = out.split(secret).join(MASK);
  }
  return out;
}

/** 로그 메타데이터를 재귀적으로 마스킹한다. */
export function redact(value: unknown, seen = new WeakSet<object>()): unknown {
  if (typeof value === "string") return maskRegisteredSecrets(value);
  if (value === null || typeof value !== "object") return value;

  if (seen.has(value as object)) return "[Circular]";
  seen.add(value as object);

  if (Array.isArray(value)) return value.map((v) => redact(v, seen));

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = SENSITIVE_KEY.test(k) ? MASK : redact(v, seen);
  }
  return out;
}

type Level = "info" | "warn" | "error";

function emit(level: Level, message: string, meta?: unknown): void {
  const line: Record<string, unknown> = {
    level,
    message: maskRegisteredSecrets(message),
  };
  if (meta !== undefined) line.meta = redact(meta);
  const text = JSON.stringify(line);
  if (level === "error") console.error(text);
  else console.log(text);
}

export const logger = {
  info: (message: string, meta?: unknown) => emit("info", message, meta),
  warn: (message: string, meta?: unknown) => emit("warn", message, meta),
  error: (message: string, meta?: unknown) => emit("error", message, meta),
};
