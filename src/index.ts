import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { loadConfig } from "./config/env.js";
import { logger } from "./lib/logger.js";

/**
 * 엔트리 포인트. 필수 env 검증 → 실패 시 즉시 종료(README 13장).
 */
function main(): void {
  let config;
  try {
    config = loadConfig();
  } catch (err) {
    logger.error("startup failed: invalid configuration", {
      message: err instanceof Error ? err.message : String(err),
    });
    process.exit(1);
  }

  const app = createApp();

  serve({ fetch: app.fetch, port: config.port }, (info) => {
    logger.info(`carol-issue listening on ${config.baseUrl}`, { port: info.port });
  });
}

main();
