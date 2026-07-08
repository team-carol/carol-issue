import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

const HealthResponse = z
  .object({
    status: z.literal("ok"),
  })
  .openapi("HealthResponse");

const healthRoute = createRoute({
  method: "get",
  path: "/health",
  summary: "Health Check",
  description: "서비스가 정상 실행 중인지 확인한다. 배포 환경 헬스체크 용도.",
  responses: {
    200: {
      description: "서버 정상 실행 중",
      content: {
        "application/json": {
          schema: HealthResponse,
        },
      },
    },
  },
});

export const health = new OpenAPIHono();

health.openapi(healthRoute, (c) => {
  return c.json({ status: "ok" as const }, 200);
});
