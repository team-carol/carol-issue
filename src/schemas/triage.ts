import { z } from "@hono/zod-openapi";

/**
 * README 10장(요청 검증) + 3·4·5장의 입출력 스키마.
 * zod 스키마 하나로 요청 검증 + OpenAPI 문서 + 타입을 동기화한다.
 */

/** Discord snowflake ID (17~20자리 숫자). */
const snowflake = z
  .string()
  .regex(/^\d{17,20}$/, "must be a Discord snowflake id");

/** Discord 메시지 URL. */
const discordMessageUrl = z
  .string()
  .url()
  .regex(
    /^https:\/\/(?:\w+\.)?discord(?:app)?\.com\/channels\/\d+\/\d+\/\d+$/,
    "must be a Discord message URL",
  );

export const IssueType = z.enum(["bug", "feature", "question", "task", "other"]);
export const IssuePriority = z.enum(["low", "medium", "high", "critical"]);

/** 제보자/Discord 컨텍스트 — draft 생성과 issue 생성 요청이 공유. */
export const ReportContext = z
  .object({
    content: z.string().trim().min(1, "content must not be empty").max(10_000),
    reporterId: snowflake,
    reporterName: z.string().trim().min(1).max(100),
    guildId: snowflake,
    channelId: snowflake,
    messageUrl: discordMessageUrl,
    conversationLog: z.string().max(50_000).optional(),
    attachments: z.array(z.string().url()).max(50).default([]),
  })
  .openapi("ReportContext");

/**
 * AI 또는 클라이언트가 만든 Issue 초안.
 *
 * 고정 스캐폴딩·Discord 메타데이터·원문은 issueBody 템플릿이 코드로 조립하므로,
 * 여기에는 "판단이 필요한 의미 필드"만 담는다(토큰 절감 + README 8장 구조 보장).
 */
export const IssueDraft = z
  .object({
    title: z.string().trim().min(1).max(256),
    /** 1~2문장 요약 (README 8장 Summary). */
    summary: z.string().trim().min(1).max(2_000),
    /** 상세 설명 (Details). 없으면 템플릿이 원문으로 대체. */
    details: z.string().trim().max(20_000).optional(),
    /** 재현 방법 (Steps to Reproduce). */
    reproduction: z.string().trim().max(10_000).optional(),
    /** 기대 동작 (Expected Behavior). */
    expected: z.string().trim().max(10_000).optional(),
    /** 실제 동작 (Actual Behavior). */
    actual: z.string().trim().max(10_000).optional(),
    labels: z.array(z.string().trim().min(1)).max(20).default([]),
    type: IssueType,
    priority: IssuePriority,
    /**
     * 제보가 짧거나 애매해 근거 있는 세부 내용을 채울 수 없을 때 true.
     * AI가 자기신고하며, 코드의 희소성 게이트도 이 값을 켠다(Layer 2·3).
     */
    needsMoreInfo: z.boolean().default(false),
  })
  .openapi("IssueDraft");

/** POST /triage/draft 요청 (README 3장). */
export const TriageDraftRequest = ReportContext.openapi("TriageDraftRequest");

/** POST /triage/draft 응답. */
export const TriageDraftResponse = z
  .object({ draft: IssueDraft })
  .openapi("TriageDraftResponse");

/**
 * POST /triage/issues 요청 (README 4·5장).
 * draft 를 함께 주면 AI 없이 그 초안으로 Issue 를 생성한다(5장 직접 생성).
 */
export const CreateIssueRequest = ReportContext.extend({
  draft: IssueDraft.optional(),
}).openapi("CreateIssueRequest");

/** POST /triage/issues 응답 (README 4장). */
export const CreateIssueResponse = z
  .object({
    issueNumber: z.number().int().positive(),
    issueUrl: z.string().url(),
  })
  .openapi("CreateIssueResponse");

/** 통일된 에러 응답 (README 11장). */
export const ErrorResponse = z
  .object({
    error: z.object({
      code: z.string(),
      message: z.string(),
    }),
  })
  .openapi("ErrorResponse");

export type ReportContext = z.infer<typeof ReportContext>;
export type IssueDraft = z.infer<typeof IssueDraft>;
export type TriageDraftRequest = z.infer<typeof TriageDraftRequest>;
export type CreateIssueRequest = z.infer<typeof CreateIssueRequest>;
export type CreateIssueResponse = z.infer<typeof CreateIssueResponse>;
export type IssueType = z.infer<typeof IssueType>;
export type IssuePriority = z.infer<typeof IssuePriority>;
