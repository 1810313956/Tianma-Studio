import { Button } from '@cherrystudio/ui'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ipcApi } from '@renderer/ipc'

type ScriptLoopView = {
  id: string
  status: 'running' | 'stopped'
  round: number
  stopReason: 'passed' | 'maxRounds' | 'unreadable' | 'dispatchFailed' | null
  hops: { role: 'outline' | 'draft' | 'review' | 'compare'; sessionId: string; round: number }[]
  reviews: { round: number; verdict: string | null; target: string | null }[]
  comparisonText: string | null
} | null

export function ScriptLoopPanel({
  senderAgentId,
  senderSessionId
}: {
  senderAgentId?: string | null
  senderSessionId?: string | null
}) {
  const { t } = useTranslation()
  const [run, setRun] = useState<ScriptLoopView>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = () => {
      void ipcApi
        .request('scriptLoop.current')
        .then((next) => {
          if (!cancelled) setRun(next)
        })
        .catch(() => undefined)
    }
    load()
    const timer = window.setInterval(load, 2000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [])

  const start = () => {
    if (!senderAgentId || !senderSessionId) {
      setError(t('agent.scriptLoop.missingSession'))
      return
    }
    setPending(true)
    setError(null)
    void ipcApi
      .request('scriptLoop.start', { senderAgentId, senderSessionId })
      .then((next) => setRun(next))
      .catch((caught: unknown) => {
        const text = caught instanceof Error ? caught.message : ''
        if (text.includes('missing-agents')) setError(t('agent.scriptLoop.error.agents'))
        else if (text.includes('missing-brief')) setError(t('agent.scriptLoop.error.brief'))
        else if (text.includes('already-running')) setError(t('agent.scriptLoop.error.running'))
        else setError(t('agent.scriptLoop.error.failed'))
      })
      .finally(() => setPending(false))
  }

  const status = !run
    ? t('agent.scriptLoop.idle')
    : run.stopReason
      ? t(`agent.scriptLoop.reason.${run.stopReason}`)
      : t(`agent.scriptLoop.status.${run.status}`)

  return (
    <div className="flex shrink-0 flex-col border-b border-border text-sm">
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="font-medium">{t('agent.scriptLoop.title')}</span>
        <span className="text-muted-foreground">{status}</span>
        {run ? <span className="text-muted-foreground">{t('agent.scriptLoop.round', { round: run.round })}</span> : null}
        {run?.hops.map((hop) => (
          <span key={hop.sessionId} className="text-muted-foreground">
            {t(`agent.scriptLoop.hop.${hop.role}`)}
          </span>
        ))}
        {error ? <span className="text-destructive">{error}</span> : null}
        <Button
          className="ml-auto"
          size="sm"
          variant="outline"
          disabled={pending || run?.status === 'running'}
          onClick={start}>
          {t('agent.scriptLoop.start')}
        </Button>
      </div>
      {run && run.reviews.length > 0 ? (
        <div className="flex flex-col gap-1 px-3 pb-2 text-xs text-muted-foreground">
          <span>{t('agent.scriptLoop.verdictHeading')}</span>
          {run.reviews.map((review, index) => (
            <span key={`${review.round}-${index}`}>
              {t('agent.scriptLoop.round', { round: review.round })}
              {review.verdict ? ` ${review.verdict}` : ''}
              {review.target ? ` ${review.target}` : ''}
            </span>
          ))}
        </div>
      ) : null}
      {run?.comparisonText ? (
        <div className="flex flex-col gap-1 px-3 pb-2 text-xs text-muted-foreground">
          <span>{t('agent.scriptLoop.comparison')}</span>
          <pre className="max-h-40 overflow-auto whitespace-pre-wrap font-sans">{run.comparisonText}</pre>
        </div>
      ) : null}
    </div>
  )
}
