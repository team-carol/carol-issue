import { OpenAPIHono } from "@hono/zod-openapi";
import type { Config } from "./config/env.js";
import type { AppDeps } from "./appDeps.js";
import { health } from "./routes/health.js";
import { AppError, toAppError } from "./errors.js";
import { logger } from "./lib/logger.js";
import { createAuthMiddleware } from "./middleware/auth.js";
import { registerTriageDraft } from "./routes/triageDraft.js";
import { registerTriageIssues } from "./routes/triageIssues.js";

/**
 * carol-issue triage 서버의 Hono 앱을 조립한다.
 * @param config  검증된 서비스 설정
 * @param deps    테스트용 주입 의존성(미지정 시 실제 provider/client 생성)
 */
export function createApp(config: Config, deps: AppDeps = {}): OpenAPIHono {
  const app = new OpenAPIHono({
    // README 10·11장: zod 검증 실패를 통일된 VALIDATION_ERROR 로 매핑
    defaultHook: (result) => {
      if (!result.success) {
        const issue = result.error.issues[0];
        const message = issue
          ? `${issue.path.join(".") || "body"}: ${issue.message}`
          : "Invalid request body";
        throw new AppError("VALIDATION_ERROR", message);
      }
    },
  });

  // README 11장: 모든 에러를 통일된 JSON 형식으로 반환
  app.onError((err, c) => {
    const appErr = toAppError(err);
    if (appErr.httpStatus >= 500) {
      logger.error(`unhandled error: ${appErr.code}`, {
        code: appErr.code,
        message: appErr.message,
        cause: appErr.cause instanceof Error ? appErr.cause.stack : appErr.cause,
      });
    } else {
      logger.warn(`request rejected: ${appErr.code}`, { message: appErr.message });
    }
    return c.json(appErr.toBody(), appErr.httpStatus as 400);
  });

  // README 2장: triage API 만 인증 (/health·/docs·/openapi.json 은 예외)
  app.use("/triage/*", createAuthMiddleware(config));

  app.route("/", health);
  registerTriageDraft(app, config, deps);
  registerTriageIssues(app, config, deps);

  return app;
}
