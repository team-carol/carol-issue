import { serve } from "@hono/node-server";
import { createApp } from "./app.js";

/**
 * 엔트리 포인트. env 로드/검증은 feature/config-and-errors 에서 추가된다.
 * scaffold 단계에서는 PORT 환경변수(기본 3000)로 서버를 띄운다.
 */
const port = Number(process.env.PORT ?? 3000);
const app = createApp();

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`carol-issue listening on http://localhost:${info.port}`);
});
