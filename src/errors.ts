/**
 * README 11장. 모든 에러는 일정한 JSON 형식으로 반환한다.
 *
 *   { "error": { "code": "VALIDATION_ERROR", "message": "..." } }
 */

export const ERROR_CODES = [
  "UNAUTHORIZED",
  "FORBIDDEN_CLIENT",
  "FORBIDDEN_GUILD",
  "VALIDATION_ERROR",
  "AI_PROVIDER_ERROR",
  "AI_INVALID_OUTPUT",
  "GITHUB_AUTH_ERROR",
  "GITHUB_CREATE_ISSUE_ERROR",
  "INTERNAL_ERROR",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

const HTTP_STATUS: Record<ErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN_CLIENT: 403,
  FORBIDDEN_GUILD: 403,
  VALIDATION_ERROR: 400,
  AI_PROVIDER_ERROR: 502,
  AI_INVALID_OUTPUT: 502,
  GITHUB_AUTH_ERROR: 502,
  GITHUB_CREATE_ISSUE_ERROR: 502,
  INTERNAL_ERROR: 500,
};

export interface ErrorBody {
  error: {
    code: ErrorCode;
    message: string;
  };
}

/**
 * 서비스 전역에서 던지는 에러. code 하나로 HTTP status와 응답 코드가 정해진다.
 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly httpStatus: number;
  /** 원인 에러(로그용). 응답 본문에는 포함하지 않는다. */
  override readonly cause?: unknown;

  constructor(code: ErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.httpStatus = HTTP_STATUS[code];
    this.cause = cause;
  }

  toBody(): ErrorBody {
    return { error: { code: this.code, message: this.message } };
  }
}

/** 알 수 없는 예외를 INTERNAL_ERROR AppError로 정규화한다. */
export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  const message = err instanceof Error ? err.message : "Internal server error";
  return new AppError("INTERNAL_ERROR", message, err);
}

export function httpStatusFor(code: ErrorCode): number {
  return HTTP_STATUS[code];
}
