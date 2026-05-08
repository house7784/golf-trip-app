'use client'

import { useState } from 'react'
import { Mail, Send, CheckCircle2, AlertCircle, Loader2, X } from 'lucide-react'
import { sendCustomEmail } from './actions'

type Result = Awaited<ReturnType<typeof sendCustomEmail>>

export default function CustomEmailButton({ eventId }: { eventId: string }) {
  const [open, setOpen] = useState(false)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Result | null>(null)

  const handleSend = async () => {
    if (busy || !subject.trim() || !body.trim()) return
    setBusy(true)
    setResult(null)
    try {
      const fd = new FormData()
      fd.set('eventId', eventId)
      fd.set('subject', subject)
      fd.set('html', `<p>${body.split('\n').join('</p><p>')}</p>`)
      const res = await sendCustomEmail(fd)
      setResult(res)
      if (res.failed === 0) {
        setSubject('')
        setBody('')
      }
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

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 bg-club-navy text-white py-2 px-3 rounded-sm uppercase tracking-wide text-xs font-bold hover:bg-club-gold hover:text-club-navy transition-all"
      >
        <Mail size={14} /> Send Custom Email
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-[1300] bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-club-navy">Send Custom Email to All</h2>
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              setResult(null)
            }}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-bold text-club-navy mb-2">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject line"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-club-gold"
              disabled={busy}
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-club-navy mb-2">Message</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Type your message here... (plain text)"
              rows={8}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:border-club-gold"
              disabled={busy}
            />
          </div>

          {result && (
            <div
              className={`rounded-lg border p-3 text-xs ${
                result.noRecipients
                  ? 'border-amber-300 bg-amber-50 text-amber-800'
                  : result.failed === 0
                  ? 'border-green-300 bg-green-50 text-green-800'
                  : 'border-red-300 bg-red-50 text-red-800'
              }`}
            >
              {result.noRecipients ? (
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

          <div className="flex gap-2 justify-end pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                setResult(null)
              }}
              disabled={busy}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50 transition disabled:opacity-50"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={busy || !subject.trim() || !body.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-club-navy text-white px-4 py-2 text-sm font-bold hover:bg-club-gold hover:text-club-navy transition disabled:opacity-50"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              {busy ? 'Sending…' : 'Send to All'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
