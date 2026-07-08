import { OpenAPIHono } from "@hono/zod-openapi";
import { health } from "./routes/health.js";
import { toAppError } from "./errors.js";
import { logger } from "./lib/logger.js";

/**
 * carol-issue triage 서버의 Hono 앱을 조립한다.
 *
 * 라우트/미들웨어/문서는 각 feature 브랜치에서 여기 결선된다.
 */
export function createApp(): OpenAPIHono {
  const app = new OpenAPIHono();

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

  app.route("/", health);

  return app;
}
