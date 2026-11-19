export const SCRIPT_LOOP_MAX_ROUNDS = 3

export type ScriptRole = 'outline' | 'draft' | 'review'

export type StopReason = 'passed' | 'maxRounds' | 'unreadable'

export type ScriptDecision =
  | { kind: 'dispatch'; role: ScriptRole; round: number; note: string }
  | { kind: 'stop'; reason: StopReason }

export type ParsedReview = {
  verdict: 'pass' | 'limited' | 'redo'
  target: 'outline' | 'draft'
}

const VERDICT_LINE = /结论\s*[：:]\s*(通过|限项修改|退回重做)/
const TARGET_LINE = /回给谁改\s*[：:]\s*(骨架|落笔)/

export type ReviewLines = {
  verdict: string | null
  target: string | null
}

/** Keep the exact conclusion lines the record shows to a reviewer. */
export function extractReviewLines(text: string): ReviewLines {
  const verdictMatch = text.match(VERDICT_LINE)
  const targetMatch = text.match(TARGET_LINE)
  return {
    verdict: verdictMatch ? `结论：${verdictMatch[1]}` : null,
    target: targetMatch ? `回给谁改：${targetMatch[1]}` : null
  }
}

/** Read the verdict the scheduler acts on. A pass does not need a rewrite target. */
export function parseReview(text: string): ParsedReview | null {
  const verdictMatch = text.match(VERDICT_LINE)
  if (!verdictMatch) return null
  if (verdictMatch[1] === '通过') return { verdict: 'pass', target: 'draft' }
  const targetMatch = text.match(TARGET_LINE)
  if (!targetMatch) return null
  return {
    verdict: verdictMatch[1] === '限项修改' ? 'limited' : 'redo',
    target: targetMatch[1] === '骨架' ? 'outline' : 'draft'
  }
}

export function decideAfterTurn(input: {
  role: ScriptRole
  round: number
  parseFailures: number
  text: string
}): { decision: ScriptDecision; parseFailures: number } {
  if (input.role === 'outline') {
    return {
      parseFailures: input.parseFailures,
      decision: {
        kind: 'dispatch',
        role: 'draft',
        round: input.round,
        note: '骨架已交稿。按这份大纲写指定的一集正文。不要调用其他智能体，下一跳由编排器决定。'
      }
    }
  }

  if (input.role === 'draft') {
    return {
      parseFailures: input.parseFailures,
      decision: {
        kind: 'dispatch',
        role: 'review',
        round: input.round,
        note: '落笔已交稿。只审这一稿。结论必须写成「结论：通过」「结论：限项修改」或「结论：退回重做」。需要返工时再写「回给谁改：落笔」或「回给谁改：骨架」。不要调用其他智能体，下一跳由编排器决定。'
      }
    }
  }

  const parsed = parseReview(input.text)
  if (!parsed) {
    if (input.parseFailures < 1) {
      return {
        parseFailures: input.parseFailures + 1,
        decision: {
          kind: 'dispatch',
          role: 'review',
          round: input.round,
          note: '上一份结论无法识别。请只重写结论，使用「结论：通过」「结论：限项修改」或「结论：退回重做」。返工时写「回给谁改：落笔」或「回给谁改：骨架」。不要调用其他智能体。'
        }
      }
    }
    return { parseFailures: input.parseFailures + 1, decision: { kind: 'stop', reason: 'unreadable' } }
  }

  if (parsed.verdict === 'pass') {
    return { parseFailures: 0, decision: { kind: 'stop', reason: 'passed' } }
  }

  if (input.round >= SCRIPT_LOOP_MAX_ROUNDS) {
    return { parseFailures: 0, decision: { kind: 'stop', reason: 'maxRounds' } }
  }

  const nextRound = input.round + 1
  if (parsed.target === 'outline') {
    return {
      parseFailures: 0,
      decision: {
        kind: 'dispatch',
        role: 'outline',
        round: nextRound,
        note: `第 ${input.round} 轮审稿退回骨架。只改审稿点名的结构问题。不要调用其他智能体，下一跳由编排器决定。`
      }
    }
  }

  return {
    parseFailures: 0,
    decision: {
      kind: 'dispatch',
      role: 'draft',
      round: nextRound,
      note: `第 ${input.round} 轮审稿退回落笔。只改审稿点名的正文问题。不要调用其他智能体，下一跳由编排器决定。`
    }
  }
}
