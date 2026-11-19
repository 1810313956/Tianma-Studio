import { describe, expect, it } from 'vitest'

import { decideAfterTurn, extractReviewLines, parseReview } from '../decide'

describe('script loop verdict routing', () => {
  it('routes an outline delivery to the draft writer in the same round', () => {
    const result = decideAfterTurn({ role: 'outline', round: 1, parseFailures: 0, text: '大纲' })
    expect(result.decision).toMatchObject({ kind: 'dispatch', role: 'draft', round: 1 })
  })

  it('routes a draft delivery to review in the same round', () => {
    const result = decideAfterTurn({ role: 'draft', round: 2, parseFailures: 0, text: '正文' })
    expect(result.decision).toMatchObject({ kind: 'dispatch', role: 'review', round: 2 })
  })

  it('stops when the verdict is pass, even without a rewrite target', () => {
    expect(parseReview('总评\n结论：通过')).toEqual({ verdict: 'pass', target: 'draft' })
    const result = decideAfterTurn({ role: 'review', round: 1, parseFailures: 0, text: '结论：通过' })
    expect(result.decision).toEqual({ kind: 'stop', reason: 'passed' })
  })

  it('sends a limited rewrite back to the named writer and advances the round', () => {
    const result = decideAfterTurn({
      role: 'review',
      round: 1,
      parseFailures: 0,
      text: '结论：限项修改\n回给谁改：落笔'
    })
    expect(result.decision).toMatchObject({ kind: 'dispatch', role: 'draft', round: 2 })
    expect(result.parseFailures).toBe(0)
  })

  it('sends a structural redo back to the outline writer', () => {
    const result = decideAfterTurn({
      role: 'review',
      round: 1,
      parseFailures: 0,
      text: '结论：退回重做\n回给谁改：骨架'
    })
    expect(result.decision).toMatchObject({ kind: 'dispatch', role: 'outline', round: 2 })
  })

  it('stops a rejection once round 3 has already been reviewed', () => {
    const result = decideAfterTurn({
      role: 'review',
      round: 3,
      parseFailures: 0,
      text: '结论：退回重做\n回给谁改：落笔'
    })
    expect(result.decision).toEqual({ kind: 'stop', reason: 'maxRounds' })
  })

  it('asks review to restate an unreadable verdict once, then stops', () => {
    const first = decideAfterTurn({ role: 'review', round: 1, parseFailures: 0, text: '看起来还行' })
    expect(first.decision).toMatchObject({ kind: 'dispatch', role: 'review', round: 1 })
    expect(first.parseFailures).toBe(1)

    const second = decideAfterTurn({ role: 'review', round: 1, parseFailures: first.parseFailures, text: '仍然没有结论' })
    expect(second.decision).toEqual({ kind: 'stop', reason: 'unreadable' })
  })

  it('treats a rewrite verdict without a target as unreadable', () => {
    expect(parseReview('结论：限项修改')).toBeNull()
  })

  it('keeps the verdict line and the rewrite target for the run record', () => {
    expect(extractReviewLines('总评\n结论：退回重做\n回给谁改：骨架')).toEqual({
      verdict: '结论：退回重做',
      target: '回给谁改：骨架'
    })
    expect(extractReviewLines('结论：通过')).toEqual({ verdict: '结论：通过', target: null })
    expect(extractReviewLines('没有结论')).toEqual({ verdict: null, target: null })
  })
})
