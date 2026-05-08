'use client'

import { useEffect, useState } from 'react'
import { Bell, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react'
import { createClient } from '../../../utils/supabase/client'
import { submitPollResponse } from './polls/actions'

type PollRow = {
  id: string
  event_id: string
  question: string
  description?: string | null
  options?: string[] | null
  closes_at?: string | null
  require_response: boolean
  is_enabled: boolean
  created_at: string
}

type ResponseRow = {
  poll_id: string
}

export default function PollNotificationCenter({
  eventId,
  currentUserId,
}: {
  eventId: string
  currentUserId: string
}) {
  const [supabase] = useState(() => createClient())
  const [polls, setPolls] = useState<PollRow[]>([])
  const [expanded, setExpanded] = useState(false)
  const [selectedOption, setSelectedOption] = useState('')
  const [responseText, setResponseText] = useState('')
  const [busy, setBusy] = useState(false)

  const loadPendingPolls = async () => {
    const { data: pollRows } = await supabase
      .from('event_polls')
      .select('id, event_id, question, description, options, closes_at, require_response, is_enabled, created_at')
      .eq('event_id', eventId)
      .eq('is_enabled', true)
      .eq('require_response', true)
      .order('created_at', { ascending: true })

    const now = Date.now()
    const activePolls = ((pollRows || []) as PollRow[]).filter((poll) => {
      if (!poll.closes_at) return true
      return new Date(poll.closes_at).getTime() > now
    })
    if (activePolls.length === 0) {
      setPolls([])
      return
    }

    const pollIds = activePolls.map((poll) => poll.id)

    const { data: responses } = await supabase
      .from('event_poll_responses')
      .select('poll_id')
      .eq('event_id', eventId)
      .eq('user_id', currentUserId)
      .in('poll_id', pollIds)

    const answered = new Set(((responses || []) as ResponseRow[]).map((row) => row.poll_id))
    const pending = activePolls.filter((poll) => !answered.has(poll.id))

    setPolls(pending)
  }

  useEffect(() => {
    loadPendingPolls()
    const interval = setInterval(loadPendingPolls, 60_000)
    return () => clearInterval(interval)
  }, [eventId, currentUserId])

  const activePoll = polls[0]

  useEffect(() => {
    setSelectedOption('')
    setResponseText('')
  }, [activePoll?.id])

  if (!activePoll) return null

  const options = Array.isArray(activePoll.options) ? activePoll.options : []

  const submit = async () => {
    if (busy) return
    const optionValue = selectedOption.trim()
    const textValue = responseText.trim()
    if (!optionValue && !textValue) return

    setBusy(true)
    try {
      const result = await submitPollResponse(eventId, activePoll.id, optionValue || null, textValue || null)
      if (result?.error) {
        window.alert(result.error)
        return
      }
      setExpanded(false)
      await loadPendingPolls()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed bottom-4 left-1/2 z-[1290] w-[min(92vw,28rem)] -translate-x-1/2">
      {/* Collapsed badge — always visible */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-xl bg-red-600 px-4 py-3 shadow-lg transition hover:bg-red-700"
      >
        <span className="flex items-center gap-2 text-sm font-bold text-white">
          <Bell size={15} />
          {polls.length === 1
            ? 'Poll needs your response'
            : `${polls.length} polls need your response`}
        </span>
        {expanded ? <ChevronDown size={16} className="text-white" /> : <ChevronUp size={16} className="text-white" />}
      </button>

      {/* Expanded panel */}
      {expanded && (
        <div className="mt-1 rounded-xl border border-red-200 bg-white p-4 shadow-xl">
          {polls.length > 1 && (
            <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-red-500">
              {polls.length} unanswered — showing 1 of {polls.length}
            </p>
          )}
          <h3 className="mb-1 text-sm font-bold text-club-navy">{activePoll.question}</h3>
          {activePoll.description ? (
            <p className="mb-3 text-sm text-gray-600">{activePoll.description}</p>
          ) : null}

          {options.length > 0 ? (
            <div className="mb-3 space-y-2">
              {options.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setSelectedOption(option)}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                    selectedOption === option
                      ? 'border-red-500 bg-red-50 font-semibold text-red-700'
                      : 'border-gray-200 text-club-text hover:border-red-300'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          ) : (
            <div className="mb-3">
              <textarea
                value={responseText}
                onChange={(e) => setResponseText(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder="Type your answer"
              />
            </div>
          )}

          {options.length > 0 && (
            <div className="mb-3">
              <input
                value={responseText}
                onChange={(e) => setResponseText(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder="Optional note"
              />
            </div>
          )}

          <button
            type="button"
            onClick={submit}
            disabled={busy || (!selectedOption.trim() && !responseText.trim())}
            className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white transition hover:bg-red-700 disabled:bg-red-200"
          >
            <CheckCircle2 size={14} /> Submit
          </button>
        </div>
      )}
    </div>
  )
}
