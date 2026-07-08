import { timingSafeEqual } from "node:crypto";
import type { MiddlewareHandler } from "hono";
import type { Config } from "../config/env.js";
import { AppError } from "../errors.js";

/**
 * README 2장. 모든 triage API 요청 인증.
 *
 * 계약(carol 봇이 보낸다):
 *   Authorization: Bearer <CAROL_SHARED_SECRET>
 *   X-Carol-Client-Id: <discord application/client id>
 *   X-Carol-Guild-Id:  <discord guild id>
 *   X-Carol-Timestamp: <unix seconds>   (CAROL_SIGNATURE_TTL_SECONDS 설정 시 검증)
 *
 * /health, /openapi.json, /docs 는 이 미들웨어를 마운트하지 않으므로 자동 예외.
 */

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

function extractBearer(header: string | undefined): string | undefined {
  if (!header) return undefined;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1];
}

export function createAuthMiddleware(config: Config): MiddlewareHandler {
  const { sharedSecret, allowedClientIds, allowedGuildIds, signatureTtlSeconds } = config.auth;

  return async (c, next) => {
    // 1) 공유 secret
    const token = extractBearer(c.req.header("authorization"));
    if (!token || !safeEqual(token, sharedSecret)) {
      throw new AppError("UNAUTHORIZED", "Missing or invalid authorization");
    }

    // 2) 허용 client ID (allowlist 가 비어있으면 통과)
    if (allowedClientIds.length > 0) {
      const clientId = c.req.header("x-carol-client-id");
      if (!clientId || !allowedClientIds.includes(clientId)) {
        throw new AppError("FORBIDDEN_CLIENT", "Client id is not allowed");
      }
    }

    // 3) 허용 guild ID (allowlist 가 비어있으면 통과)
    if (allowedGuildIds.length > 0) {
      const guildId = c.req.header("x-carol-guild-id");
      if (!guildId || !allowedGuildIds.includes(guildId)) {
        throw new AppError("FORBIDDEN_GUILD", "Guild id is not allowed");
      }
    }

    // 4) 서명 TTL (설정된 경우에만)
    if (signatureTtlSeconds !== undefined) {
      const raw = c.req.header("x-carol-timestamp");
      const ts = raw ? Number(raw) : NaN;
      const now = Math.floor(Date.now() / 1000);
      if (!Number.isFinite(ts) || Math.abs(now - ts) > signatureTtlSeconds) {
        throw new AppError("UNAUTHORIZED", "Request timestamp is missing or expired");
      }
    }

    await next();
  };
}
