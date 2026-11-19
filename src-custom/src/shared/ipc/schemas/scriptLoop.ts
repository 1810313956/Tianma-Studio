import * as z from 'zod'

import { defineRoute } from '../define'

const ScriptLoopHopSchema = z.strictObject({
  role: z.enum(['outline', 'draft', 'review', 'compare']),
  sessionId: z.string(),
  round: z.number().int()
})

const ScriptLoopReviewSchema = z.strictObject({
  round: z.number().int(),
  verdict: z.string().nullable(),
  target: z.string().nullable()
})

const ScriptLoopViewSchema = z.strictObject({
  id: z.string(),
  status: z.enum(['running', 'stopped']),
  round: z.number().int(),
  stopReason: z.enum(['passed', 'maxRounds', 'unreadable', 'dispatchFailed']).nullable(),
  hops: z.array(ScriptLoopHopSchema),
  reviews: z.array(ScriptLoopReviewSchema),
  comparisonText: z.string().nullable()
})

export const scriptLoopRequestSchemas = {
  'scriptLoop.start': defineRoute({
    input: z.strictObject({
      senderAgentId: z.string().min(1).max(200),
      senderSessionId: z.string().min(1).max(200)
    }),
    output: ScriptLoopViewSchema
  }),
  'scriptLoop.current': defineRoute({
    input: z.void(),
    output: ScriptLoopViewSchema.nullable()
  })
}
