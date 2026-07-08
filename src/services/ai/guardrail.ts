import type { IssueDraft, ReportContext } from "../../schemas/triage.js";

/**
 * 할루시네이션 가드레일 (Layer 3, 결정론적 백스톱).
 *
 * 제보가 희소하면 AI가 재현 절차·기대/실제 동작 같은 세부를 지어낼 위험이 있다.
 * 이 모듈은 입력 희소도를 코드로 판정하고, 희소하거나 AI가 needsMoreInfo 를
 * 신고하면 "투기적 필드"를 강제로 제거해 지어낸 정보가 구조적으로 못 들어가게 한다.
 * 원문(context.content)은 항상 템플릿의 Original Report 로 보존된다(Layer 4).
 */

/** 이 값 미만이면 희소한 제보로 본다(대화로그/첨부가 없을 때). */
export const SPARSE_MIN_CHARS = 40;
/** 단어 수가 이 값 미만이면 무조건 희소로 본다. */
export const SPARSE_MIN_WORDS = 4;

/** 제보가 세부 내용을 근거 있게 뒷받침하기엔 너무 얇은지 판정한다. */
export function isSparseReport(context: ReportContext): boolean {
  const text = context.content.trim();
  const hasExtraContext =
    Boolean(context.conversationLog?.trim()) || context.attachments.length > 0;
  if (hasExtraContext) return false;

  const wordCount = text.split(/\s+/).filter(Boolean).length;
  return text.length < SPARSE_MIN_CHARS || wordCount < SPARSE_MIN_WORDS;
}

/**
 * 근거 없는 세부 필드를 제거한다. 희소 제보이거나 AI가 needsMoreInfo 를 신고하면
 * details/reproduction/expected/actual 을 비우고 needsMoreInfo=true 로 표시한다.
 * title/summary/labels/type/priority 는 유지한다(summary 는 원문 충실 요약).
 */
export function enforceGroundingGuardrail(
  draft: IssueDraft,
  context: ReportContext,
): IssueDraft {
  const needsInfo = draft.needsMoreInfo || isSparseReport(context);
  if (!needsInfo) return draft;

  return {
    ...draft,
    details: undefined,
    reproduction: undefined,
    expected: undefined,
    actual: undefined,
    needsMoreInfo: true,
  };
}
