import { randomUUID } from 'node:crypto'
import fs from 'node:fs'

import { application } from '@application'
import { agentService } from '@data/services/AgentService'
import { agentSessionMessageService } from '@data/services/AgentSessionMessageService'
import { agentSessionService } from '@data/services/AgentSessionService'
import { agentWorkspaceService } from '@data/services/AgentWorkspaceService'
import { loggerService } from '@logger'
import { BaseService, DependsOn, Injectable, Phase, ServicePhase } from '@main/core/lifecycle'
import type { AgentSessionWorkspaceSource } from '@shared/data/api/schemas/agentWorkspaces'

import { decideAfterTurn, extractReviewLines, type ScriptRole, type StopReason } from './decide'
import { messagePlainText } from './text'

const logger = loggerService.withContext('ScriptLoopService')

const ROLE_NAMES: Record<ScriptRole, readonly string[]> = {
  outline: ['剧匠·骨架', '骨架'],
  draft: ['剧匠·落笔', '落笔'],
  review: ['剧匠·审稿', '审稿']
}

const ROLE_LABEL: Record<ScriptRole | 'compare', string> = {
  outline: '骨架',
  draft: '落笔',
  review: '审稿',
  compare: '对照'
}

export type ScriptLoopHopRole = ScriptRole | 'compare'

export type ScriptLoopReview = {
  round: number
  verdict: string | null
  target: string | null
}

export type ScriptLoopView = {
  id: string
  status: 'running' | 'stopped'
  round: number
  stopReason: StopReason | 'dispatchFailed' | null
  hops: { role: ScriptLoopHopRole; sessionId: string; round: number }[]
  reviews: ScriptLoopReview[]
  comparisonText: string | null
}

type Binding = { runId: string; role: ScriptLoopHopRole; consumed: boolean }

type Run = {
  id: string
  brief: string
  round: number
  parseFailures: number
  status: 'running' | 'stopped'
  stopReason: ScriptLoopView['stopReason']
  workspace: AgentSessionWorkspaceSource
  agents: Record<ScriptRole, string>
  hops: ScriptLoopView['hops']
  reviews: ScriptLoopReview[]
  comparisonText: string | null
}

export class ScriptLoopError extends Error {
  constructor(readonly code: 'missing-agents' | 'missing-brief' | 'already-running') {
    super(code)
    this.name = 'ScriptLoopError'
  }
}

@Injectable('ScriptLoopService')
@ServicePhase(Phase.WhenReady)
@DependsOn(['AgentSessionRuntimeService', 'AgentSessionDeliveryService'])
export class ScriptLoopService extends BaseService {
  private readonly runs = new Map<string, Run>()
  private readonly bindings = new Map<string, Binding>()
  private latestRunId: string | null = null
  private restored: ScriptLoopView | null = null

  protected override onInit(): void {
    this.restored = this.readRecord()
    const runtime = application.get('AgentSessionRuntimeService')
    this.registerDisposable(
      runtime.onTurnTerminal((event) => {
        if (event.boundary === 'row-roll' || event.status !== 'success') return
        if (!this.bindings.has(event.sessionId)) return
        try {
          const message = agentSessionMessageService.getSessionMessage(event.sessionId, event.assistantMessageId)
          this.onAssistantFinished(event.sessionId, messagePlainText(message))
        } catch (error) {
          logger.warn('Script loop did not advance', { sessionId: event.sessionId, error })
        }
      })
    )
  }

  start(input: { senderAgentId: string; senderSessionId: string }): ScriptLoopView {
    const live = this.latestRunId ? this.runs.get(this.latestRunId) : undefined
    if (live?.status === 'running') throw new ScriptLoopError('already-running')

    const session = agentSessionService.getById(input.senderSessionId)
    const workspaceRecord = agentWorkspaceService.getById(session.workspaceId, { includeSystem: true })
    const workspace: AgentSessionWorkspaceSource =
      workspaceRecord.type === 'user' ? { type: 'user', workspaceId: workspaceRecord.id } : { type: 'system' }
    const brief = this.latestUserText(input.senderSessionId)
    if (!brief) throw new ScriptLoopError('missing-brief')

    const agents = this.resolveAgents()
    const run: Run = {
      id: randomUUID(),
      brief,
      round: 1,
      parseFailures: 0,
      status: 'running',
      stopReason: null,
      workspace,
      agents,
      hops: [],
      reviews: [],
      comparisonText: null
    }
    this.runs.set(run.id, run)
    this.latestRunId = run.id
    this.restored = null
    this.persist(run)

    this.dispatch(run, 'outline', brief, {
      agentId: input.senderAgentId,
      sessionId: input.senderSessionId
    })
    try {
      this.dispatch(
        run,
        'compare',
        `这是对照稿。只由落笔写指定的一集，不要进入审稿，也不要调用其他智能体。\n\n任务：\n${brief}`,
        { agentId: input.senderAgentId, sessionId: input.senderSessionId }
      )
    } catch (error) {
      logger.warn('Comparison lane was not started', { runId: run.id, error })
    }
    this.persist(run)
    return this.view(run)
  }

  current(): ScriptLoopView | null {
    if (!this.latestRunId) return this.restored
    const run = this.runs.get(this.latestRunId)
    return run ? this.view(run) : this.restored
  }

  private onAssistantFinished(sessionId: string, text: string): void {
    const binding = this.bindings.get(sessionId)
    if (!binding || binding.consumed) return
    binding.consumed = true
    const run = this.runs.get(binding.runId)
    if (!run || run.status !== 'running') return

    if (binding.role === 'compare') {
      run.comparisonText = text
      this.persist(run)
      return
    }

    if (binding.role === 'review') {
      const lines = extractReviewLines(text)
      run.reviews.push({ round: run.round, verdict: lines.verdict, target: lines.target })
    }

    const next = decideAfterTurn({
      role: binding.role,
      round: run.round,
      parseFailures: run.parseFailures,
      text
    })
    run.parseFailures = next.parseFailures
    if (next.decision.kind === 'stop') {
      run.status = 'stopped'
      run.stopReason = next.decision.reason
      this.persist(run)
      return
    }

    run.round = next.decision.round
    try {
      this.dispatch(
        run,
        next.decision.role,
        `${next.decision.note}\n\n任务：\n${run.brief}\n\n上一跳正文：\n${text || '（空）'}`,
        { agentId: run.agents[binding.role], sessionId }
      )
    } catch (error) {
      run.status = 'stopped'
      run.stopReason = 'dispatchFailed'
      logger.warn('Script loop dispatch failed', { runId: run.id, error })
    }
    this.persist(run)
  }

  private dispatch(
    run: Run,
    role: ScriptLoopHopRole,
    content: string,
    sender: { agentId: string; sessionId: string }
  ): void {
    const created = application.get('AgentSessionDeliveryService').acceptWithNewSession({
      senderAgentId: sender.agentId,
      senderSessionId: sender.sessionId,
      targetAgentId: role === 'compare' ? run.agents.draft : run.agents[role],
      sessionName: `剧本编排·${ROLE_LABEL[role]}·第${run.round}轮`,
      workspace: run.workspace,
      content
    })
    run.hops.push({ role, sessionId: created.session.id, round: run.round })
    this.bindings.set(created.session.id, { runId: run.id, role, consumed: false })
    this.persist(run)
  }

  private latestUserText(sessionId: string): string {
    const page = agentSessionMessageService.listSessionMessages(sessionId, { limit: 30 })
    const user = page.items.find((message) => message.role === 'user')
    return user ? messagePlainText(user) : ''
  }

  private resolveAgents(): Record<ScriptRole, string> {
    const { agents } = agentService.listAgents()
    const resolved = {} as Record<ScriptRole, string>
    for (const role of ['outline', 'draft', 'review'] as const) {
      const names = ROLE_NAMES[role]
      const agent =
        agents.find((item) => names.some((name) => name === item.name)) ??
        agents.find((item) => item.name.includes('剧匠') && item.name.includes(names[1]))
      if (!agent) throw new ScriptLoopError('missing-agents')
      resolved[role] = agent.id
    }
    return resolved
  }

  private view(run: Run): ScriptLoopView {
    return {
      id: run.id,
      status: run.status,
      round: run.round,
      stopReason: run.stopReason,
      hops: run.hops.map((hop) => ({ ...hop })),
      reviews: run.reviews.map((review) => ({ ...review })),
      comparisonText: run.comparisonText
    }
  }

  private recordPath(): string {
    return application.getPath('app.userdata.data', 'script-loop-record.json')
  }

  private persist(run: Run): void {
    const record = this.view(run)
    this.restored = record
    try {
      fs.writeFileSync(this.recordPath(), JSON.stringify(record))
    } catch (error) {
      logger.warn('Script loop record was not saved', { runId: run.id, error })
    }
  }

  private readRecord(): ScriptLoopView | null {
    try {
      const parsed: unknown = JSON.parse(fs.readFileSync(this.recordPath(), 'utf8'))
      if (!isScriptLoopView(parsed)) return null
      return parsed
    } catch {
      return null
    }
  }
}

function isScriptLoopView(value: unknown): value is ScriptLoopView {
  if (typeof value !== 'object' || value === null) return false
  const record = value as ScriptLoopView
  return (
    typeof record.id === 'string' &&
    (record.status === 'running' || record.status === 'stopped') &&
    typeof record.round === 'number' &&
    Array.isArray(record.hops) &&
    Array.isArray(record.reviews) &&
    (typeof record.comparisonText === 'string' || record.comparisonText === null)
  )
}
