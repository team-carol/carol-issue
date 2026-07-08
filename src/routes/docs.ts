import type { OpenAPIHono } from "@hono/zod-openapi";
import { apiReference } from "@scalar/hono-api-reference";
import type { Config } from "../config/env.js";

/**
 * README 12장. OpenAPI JSON + Scalar 문서 UI.
 * 두 경로는 /triage/* 밖이라 인증 예외다.
 */
export function registerDocs(app: OpenAPIHono, config: Config): void {
  // carol 봇이 보내는 Bearer 공유 secret 인증 스킴
  app.openAPIRegistry.registerComponent("securitySchemes", "CarolSecret", {
    type: "http",
    scheme: "bearer",
    description: "CAROL_SHARED_SECRET 을 Bearer 토큰으로 전달",
  });

  app.doc("/openapi.json", {
    openapi: "3.0.0",
    info: {
      title: "carol-issue",
      version: "0.1.0",
      description: "carol의 문의하기 → GitHub Issue triage 서비스",
    },
    servers: [{ url: config.baseUrl }],
  });

  app.get(
    "/docs",
    apiReference({ spec: { url: "/openapi.json" }, pageTitle: "carol-issue API" }),
  );
}
