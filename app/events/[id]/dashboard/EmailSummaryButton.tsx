'use client'

import { useState } from 'react'
import { Mail, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { emailDailySummary } from './actions'

type Result = Awaited<ReturnType<typeof emailDailySummary>>

export default function EmailSummaryButton({
  eventId,
  roundId,
}: {
  eventId: string
  roundId: string
}) {
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Result | null>(null)

  const handleClick = async () => {
    if (busy) return
    setBusy(true)
    setResult(null)
    try {
      const fd = new FormData()
      fd.set('eventId', eventId)
      fd.set('roundId', roundId)
      const res = await emailDailySummary(fd)
      setResult(res)
    } catch (err: unknown) {
      setResult({
        sent: 0,
        failed: 1,
        errors: [err instanceof Error ? err.message : String(err)],
        testMode: false,
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className="inline-flex items-center gap-2 bg-club-gold text-club-navy py-2 px-3 rounded-sm uppercase tracking-wide text-xs font-bold hover:bg-club-navy hover:text-white transition-all disabled:opacity-50"
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
        {busy ? 'Sending…' : 'Email Daily Summary'}
      </button>

      {result && (
        <div
          className={`rounded-lg border p-3 text-xs ${
            result.noRound
              ? 'border-amber-300 bg-amber-50 text-amber-800'
              : result.noRecipients
              ? 'border-amber-300 bg-amber-50 text-amber-800'
              : result.failed === 0
              ? 'border-green-300 bg-green-50 text-green-800'
              : 'border-red-300 bg-red-50 text-red-800'
          }`}
        >
          {result.noRound ? (
            <p className="flex items-center gap-1 font-semibold">
              <AlertCircle size={13} /> No round found for today — nothing sent.
            </p>
          ) : result.noRecipients ? (
            <p className="flex items-center gap-1 font-semibold">
              <AlertCircle size={13} /> No participants with email addresses found.
            </p>
          ) : (
            <>
              <p className="flex items-center gap-1 font-semibold">
                {result.failed === 0 ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                {result.sent} sent
                {result.failed > 0 ? `, ${result.failed} failed` : ''}
                {result.testMode ? ' (TEST MODE — sent to your address only)' : ''}
              </p>
              {result.errors.length > 0 && (
                <ul className="mt-2 space-y-1 font-mono">
                  {result.errors.map((e, i) => (
                    <li key={i} className="text-[10px] break-all">
                      {e}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
