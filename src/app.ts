import { OpenAPIHono } from "@hono/zod-openapi";
import { health } from "./routes/health.js";

/**
 * carol-issue triage 서버의 Hono 앱을 조립한다.
 *
 * 라우트/미들웨어/문서는 각 feature 브랜치에서 여기 결선된다.
 * 현재는 scaffold 단계로 GET /health 만 마운트한다.
 */
export function createApp(): OpenAPIHono {
  const app = new OpenAPIHono();

  app.route("/", health);

  return app;
}
