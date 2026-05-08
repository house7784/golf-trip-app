'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle2, MessageSquare, ToggleLeft, ToggleRight, Vote } from 'lucide-react'
import { createPoll, deletePoll, togglePollEnabled } from './actions'

type Poll = {
  id: string
  event_id: string
  question: string
  description?: string | null
  options?: string[] | null
  closes_at?: string | null
  require_response: boolean
  is_enabled: boolean
  created_at: string
  disabled_at?: string | null
}

type PollResponse = {
  id: string
  poll_id: string
  user_id: string
  selected_option?: string | null
  response_text?: string | null
  created_at: string
  updated_at: string
}

type Participant = {
  user_id: string
  profiles?: {
    full_name?: string | null
    email?: string | null
  } | null
}

type Props = {
  eventId: string
  eventName: string
  polls: Poll[]
  responses: PollResponse[]
  participants: Participant[]
}

export default function PollsClient({ eventId, eventName, polls, responses, participants }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [question, setQuestion] = useState('')
  const [description, setDescription] = useState('')
  const [optionsRaw, setOptionsRaw] = useState('')
  const [closesAtLocal, setClosesAtLocal] = useState('')
  const [selectedPollId, setSelectedPollId] = useState<string>(polls[0]?.id || '')

  const nameByUserId = useMemo(() => {
    const map: Record<string, string> = {}
    participants.forEach((entry) => {
      map[entry.user_id] = entry.profiles?.full_name || entry.profiles?.email || 'Golfer'
    })
    return map
  }, [participants])

  const participantCount = participants.length

  const responseByPollUser = useMemo(() => {
    const map = new Map<string, PollResponse>()
    responses.forEach((response) => {
      map.set(`${response.poll_id}:${response.user_id}`, response)
    })
    return map
  }, [responses])

  const selectedPoll = polls.find((poll) => poll.id === selectedPollId) || polls[0] || null

  const createNewPoll = () => {
    startTransition(async () => {
      const result = await createPoll(eventId, question, description, optionsRaw, closesAtLocal || null)
      if (result?.error) {
        window.alert(result.error)
        return
      }

      setQuestion('')
      setDescription('')
      setOptionsRaw('')
      setClosesAtLocal('')
      router.refresh()
    })
  }

  const setPollState = (pollId: string, isEnabled: boolean) => {
    startTransition(async () => {
      const result = await togglePollEnabled(eventId, pollId, isEnabled)
      if (result?.error) {
        window.alert(result.error)
        return
      }
      router.refresh()
    })
  }

  const removePoll = (pollId: string) => {
    if (!window.confirm('Delete this poll and all responses? This cannot be undone.')) return
    startTransition(async () => {
      const result = await deletePoll(eventId, pollId)
      if (result?.error) {
        window.alert(result.error)
        return
      }
      if (selectedPollId === pollId) {
        setSelectedPollId('')
      }
      router.refresh()
    })
  }

  return (
    <div className="space-y-6 pb-14">
      <div className="bg-club-navy text-Black rounded-2xl p-6">
        <Link
          href={`/events/${eventId}/dashboard`}
          className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-club-gold hover:text-Black transition mb-4"
        >
          <ArrowLeft size={14} /> Back to Event
        </Link>
        <div className="flex items-center gap-3">
          <Vote size={28} className="text-club-gold" />
          <div>
            <h1 className="font-serif text-2xl font-bold">Polls</h1>
            <p className="text-xs text-club-gold uppercase tracking-widest font-bold">{eventName}</p>
          </div>
        </div>
      </div>

      <section className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400">Create Poll</h2>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Question</label>
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="What time should we tee off on Day 2?"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Details (optional)</label>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={2}
            placeholder="Any extra context for the group"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none"
          />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Options (optional)</label>
          <textarea
            value={optionsRaw}
            onChange={(event) => setOptionsRaw(event.target.value)}
            rows={3}
            placeholder={'One option per line, or comma-separated\n7:30 AM\n8:00 AM\n8:30 AM'}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none"
          />
          <p className="mt-1 text-[11px] text-gray-400">Leave blank for free-text responses.</p>
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Auto-close time (optional)</label>
          <input
            type="datetime-local"
            value={closesAtLocal}
            onChange={(event) => setClosesAtLocal(event.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <p className="mt-1 text-[11px] text-gray-400">After this time, users will no longer be prompted and cannot submit responses.</p>
        </div>
        <button
          type="button"
          onClick={createNewPoll}
          disabled={!question.trim() || isPending}
          className="mt-2 w-full rounded-lg border border-slate-900 bg-slate-900 py-3 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-slate-700 disabled:border-slate-300 disabled:bg-slate-300 disabled:text-white"
        >
          {isPending ? 'Submitting...' : 'Submit Poll'}
        </button>
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400">Polls</h2>

        {polls.length === 0 ? (
          <div className="bg-white border border-dashed border-gray-300 rounded-xl p-6 text-center text-sm text-gray-400">
            No polls yet.
          </div>
        ) : (
          <div className="space-y-2">
            {polls.map((poll) => {
              const answeredCount = participants.reduce((count, participant) => {
                return responseByPollUser.has(`${poll.id}:${participant.user_id}`) ? count + 1 : count
              }, 0)
              const isSelected = selectedPoll?.id === poll.id
              const isExpired = Boolean(poll.closes_at) && new Date(poll.closes_at as string).getTime() <= Date.now()
              const statusLabel = !poll.is_enabled
                ? 'Disabled'
                : isExpired
                  ? 'Expired'
                  : 'Enabled'
              const statusClass = !poll.is_enabled
                ? 'bg-gray-200 text-gray-600'
                : isExpired
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-emerald-100 text-emerald-700'

              return (
                <div
                  key={poll.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedPollId(poll.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      setSelectedPollId(poll.id)
                    }
                  }}
                  className={`w-full text-left rounded-xl border p-3 transition ${
                    isSelected ? 'border-club-gold bg-club-paper/50' : 'border-gray-100 bg-white hover:border-club-gold/40'
                  } cursor-pointer focus:outline-none focus:ring-2 focus:ring-club-gold/60`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-club-navy truncate">{poll.question}</p>
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{poll.description || 'Required poll response from all participants.'}</p>
                      <div className="mt-2 flex items-center gap-2 text-[11px] text-gray-500">
                        <span className="inline-flex items-center gap-1"><CheckCircle2 size={12} /> {answeredCount}/{participantCount} answered</span>
                        <span className={`rounded-full px-2 py-0.5 font-bold uppercase tracking-wide ${statusClass}`}>
                          {statusLabel}
                        </span>
                        {poll.closes_at ? (
                          <span className="text-[10px] text-gray-400">
                            Closes {new Date(poll.closes_at).toLocaleString()}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          setPollState(poll.id, !poll.is_enabled)
                        }}
                        disabled={isPending || isExpired}
                        className="rounded-lg border border-gray-200 px-2 py-1 text-xs font-bold uppercase tracking-wide text-club-navy hover:bg-gray-50"
                      >
                        <span className="inline-flex items-center gap-1">
                          {poll.is_enabled ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                          {poll.is_enabled ? 'Disable' : 'Enable'}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          removePoll(poll.id)
                        }}
                        disabled={isPending}
                        className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs font-bold uppercase tracking-wide text-red-700 hover:bg-red-100"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {selectedPoll && (
        <section className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Responses</h2>
          <p className="text-sm font-bold text-club-navy mb-4">{selectedPoll.question}</p>

          <div className="space-y-2">
            {participants.map((participant) => {
              const response = responseByPollUser.get(`${selectedPoll.id}:${participant.user_id}`)
              const answer = response?.selected_option || response?.response_text || null
              const displayName = nameByUserId[participant.user_id] || 'Golfer'

              return (
                <div key={participant.user_id} className="rounded-lg border border-gray-100 px-3 py-2 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-club-navy truncate">{displayName}</p>
                  {answer ? (
                    <div className="text-right min-w-0">
                      <p className="text-sm text-club-text truncate">{answer}</p>
                      <p className="text-[10px] text-gray-400">
                        {new Date(response?.updated_at || response?.created_at || '').toLocaleString()}
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs font-bold uppercase tracking-wide text-orange-600 inline-flex items-center gap-1">
                      <MessageSquare size={12} /> Pending
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
