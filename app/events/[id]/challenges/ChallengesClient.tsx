'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Swords, X, UserCheck, Trophy, CheckCircle2, XCircle } from 'lucide-react'
import {
  createChallenge,
  respondToChallenge,
  setResult,
  witnessApprove,
  markCompleted,
} from './actions'

type Profile = {
  id?: string
  full_name?: string | null
  email?: string | null
}

type Participant = {
  id: string
  user_id: string
  profiles?: Profile | null
}

type Challenge = {
  id: string
  event_id: string
  challenger_id: string
  challenged_id: string
  witness_id?: string | null
  description: string
  stakes: string
  status: string
  winner_id?: string | null
  witness_approved: boolean
  loser_completed: boolean
  created_at: string
  accepted_at?: string | null
  result_set_at?: string | null
  completed_at?: string | null
}

type Props = {
  eventId: string
  eventName: string
  currentUserId: string
  participants: Participant[]
  challenges: Challenge[]
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800' },
  accepted: { label: 'Active', color: 'bg-green-100 text-green-800' },
  declined: { label: 'Declined', color: 'bg-gray-100 text-gray-500' },
  awaiting_witness: { label: 'Awaiting Witness', color: 'bg-blue-100 text-blue-800' },
  result_set: { label: 'Settling Up', color: 'bg-orange-100 text-orange-800' },
  completed: { label: 'Settled ✓', color: 'bg-emerald-100 text-emerald-800' },
}

function ChallengeRow({
  challenge: ch,
  getName,
}: {
  challenge: Challenge
  getName: (id: string) => string
}) {
  const cfg = STATUS_CONFIG[ch.status] ?? { label: ch.status, color: 'bg-gray-100 text-gray-600' }
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-bold text-club-navy truncate">{getName(ch.challenger_id)}</span>
          <Swords size={12} className="text-club-gold flex-shrink-0" />
          <span className="text-sm font-bold text-club-navy truncate">{getName(ch.challenged_id)}</span>
        </div>
        <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 ${cfg.color}`}>
          {cfg.label}
        </span>
      </div>
      <p className="text-xs text-gray-500 line-clamp-1">{ch.description}</p>
      <p className="text-xs font-semibold text-club-navy">{ch.stakes}</p>
      {ch.winner_id && (
        <p className="text-xs text-emerald-600 font-bold flex items-center gap-1">
          <Trophy size={11} /> {getName(ch.winner_id)} won
        </p>
      )}
    </div>
  )
}

export default function ChallengesClient({ eventId, eventName, currentUserId, participants, challenges }: Props) {
  const router = useRouter()

  const profileMap: Record<string, Profile> = {}
  for (const p of participants) {
    if (p.profiles) profileMap[p.user_id] = p.profiles
  }
  const getName = (userId: string) => profileMap[userId]?.full_name ?? 'Golfer'
  const otherParticipants = participants.filter((p) => p.user_id !== currentUserId)

  const [createOpen, setCreateOpen] = useState(false)
  const [selectedGolfer, setSelectedGolfer] = useState<Participant | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailChallenge, setDetailChallenge] = useState<Challenge | null>(null)

  const [description, setDescription] = useState('')
  const [stakes, setStakes] = useState('')
  const [witnessId, setWitnessId] = useState('')

  const [isPending, startTransition] = useTransition()

  const openCreate = (p: Participant) => {
    setSelectedGolfer(p)
    setDescription('')
    setStakes('')
    setWitnessId('')
    setCreateOpen(true)
  }

  const openDetail = (ch: Challenge) => {
    setDetailChallenge(ch)
    setDetailOpen(true)
  }

  const handleCreate = () => {
    if (!selectedGolfer || !description.trim() || !stakes.trim()) return
    const fd = new FormData()
    fd.append('event_id', eventId)
    fd.append('challenged_id', selectedGolfer.user_id)
    fd.append('description', description)
    fd.append('stakes', stakes)
    if (witnessId) fd.append('witness_id', witnessId)
    startTransition(async () => {
      await createChallenge(fd)
      setCreateOpen(false)
      router.refresh()
    })
  }

  const handleRespond = (challengeId: string, response: 'accepted' | 'declined') => {
    startTransition(async () => {
      await respondToChallenge(challengeId, response)
      setDetailOpen(false)
      router.refresh()
    })
  }

  const handleSetResult = (challengeId: string, winnerId: string) => {
    startTransition(async () => {
      await setResult(challengeId, winnerId)
      setDetailOpen(false)
      router.refresh()
    })
  }

  const handleWitnessApprove = (challengeId: string) => {
    startTransition(async () => {
      await witnessApprove(challengeId)
      setDetailOpen(false)
      router.refresh()
    })
  }

  const handleMarkCompleted = (challengeId: string) => {
    startTransition(async () => {
      await markCompleted(challengeId)
      setDetailOpen(false)
      router.refresh()
    })
  }

  const pendingReceived = challenges.filter((c) => c.status === 'pending' && c.challenged_id === currentUserId)
  const pendingSent = challenges.filter((c) => c.status === 'pending' && c.challenger_id === currentUserId)
  const activeChallenges = challenges.filter((c) =>
    ['accepted', 'awaiting_witness', 'result_set'].includes(c.status)
  )
  const settledChallenges = challenges.filter((c) => ['completed', 'declined'].includes(c.status))

  const c = detailChallenge
  const amChallenged = c?.challenged_id === currentUserId
  const amChallenger = c?.challenger_id === currentUserId
  const amWitness = c?.witness_id === currentUserId
  const loserId = c?.winner_id
    ? c.winner_id === c.challenger_id
      ? c.challenged_id
      : c.challenger_id
    : null
  const amLoser = loserId === currentUserId

  const witnessOptions = participants.filter(
    (p) => p.user_id !== currentUserId && p.user_id !== selectedGolfer?.user_id
  )

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="bg-club-navy text-white rounded-2xl p-6">
        <Link
          href={`/events/${eventId}/dashboard`}
          className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-club-gold hover:text-white transition mb-4"
        >
          <ArrowLeft size={14} /> Back to Event
        </Link>
        <div className="flex items-center gap-3">
          <Swords size={28} className="text-club-gold" />
          <div>
            <h1 className="font-serif text-2xl font-bold">Challenges</h1>
            <p className="text-xs text-club-gold uppercase tracking-widest font-bold">{eventName}</p>
          </div>
        </div>
      </div>

      {/* Pending received — action required */}
      {pendingReceived.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400">⚔️ Action Required</h2>
          {pendingReceived.map((ch) => (
            <button
              key={ch.id}
              onClick={() => openDetail(ch)}
              className="w-full bg-yellow-50 border-2 border-yellow-400 rounded-xl p-4 text-left hover:bg-yellow-100 transition"
            >
              <p className="text-[10px] font-bold uppercase tracking-widest text-yellow-700 mb-2">You've been challenged</p>
              <ChallengeRow challenge={ch} getName={getName} />
            </button>
          ))}
        </section>
      )}

      {/* Issue a Challenge */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400">Issue a Challenge</h2>
        {otherParticipants.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No other golfers in this event yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {otherParticipants.map((p) => (
              <button
                key={p.user_id}
                onClick={() => openCreate(p)}
                className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm flex flex-col items-center gap-2 h-28 hover:border-club-navy hover:shadow-md transition active:bg-gray-50"
              >
                <div className="w-10 h-10 rounded-full bg-club-navy flex items-center justify-center text-white font-bold text-sm">
                  {(p.profiles?.full_name ?? 'G')[0].toUpperCase()}
                </div>
                <span className="text-xs font-bold text-club-navy text-center leading-tight line-clamp-2">
                  {p.profiles?.full_name ?? 'Golfer'}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Active challenges */}
      {activeChallenges.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400">Active Challenges</h2>
          {activeChallenges.map((ch) => (
            <button
              key={ch.id}
              onClick={() => openDetail(ch)}
              className="w-full bg-white border border-gray-100 rounded-xl p-4 text-left shadow-sm hover:shadow-md transition"
            >
              <ChallengeRow challenge={ch} getName={getName} />
            </button>
          ))}
        </section>
      )}

      {/* Pending sent */}
      {pendingSent.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400">Sent — Awaiting Response</h2>
          {pendingSent.map((ch) => (
            <button
              key={ch.id}
              onClick={() => openDetail(ch)}
              className="w-full bg-white border border-gray-100 rounded-xl p-4 text-left shadow-sm hover:shadow-md transition opacity-70"
            >
              <ChallengeRow challenge={ch} getName={getName} />
            </button>
          ))}
        </section>
      )}

      {/* History */}
      {settledChallenges.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400">History</h2>
          {settledChallenges.map((ch) => (
            <button
              key={ch.id}
              onClick={() => openDetail(ch)}
              className="w-full bg-white border border-gray-100 rounded-xl p-4 text-left shadow-sm hover:shadow-md transition opacity-50"
            >
              <ChallengeRow challenge={ch} getName={getName} />
            </button>
          ))}
        </section>
      )}

      {/* ── CREATE CHALLENGE MODAL ── */}
      {createOpen && selectedGolfer && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setCreateOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="bg-club-navy p-4 flex justify-between items-center">
              <div>
                <h2 className="font-serif text-lg font-bold text-white">Issue Challenge</h2>
                <p className="text-xs text-club-gold font-bold uppercase tracking-wider">
                  vs. {selectedGolfer.profiles?.full_name ?? 'Golfer'}
                </p>
              </div>
              <button
                onClick={() => setCreateOpen(false)}
                className="text-club-gold hover:bg-white/10 p-2 rounded-full transition"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 block mb-1.5">
                  The Challenge
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the challenge in detail..."
                  rows={3}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-club-navy focus:ring-1 focus:ring-club-navy text-club-navy resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 block mb-1.5">
                  Stakes / Punishment
                </label>
                <input
                  value={stakes}
                  onChange={(e) => setStakes(e.target.value)}
                  placeholder="e.g. $20, buys the round, wears a silly hat..."
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-club-navy focus:ring-1 focus:ring-club-navy text-club-navy"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 block mb-1.5">
                  Witness{' '}
                  <span className="text-gray-400 font-normal normal-case tracking-normal">(optional)</span>
                </label>
                <select
                  value={witnessId}
                  onChange={(e) => setWitnessId(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-club-navy focus:ring-1 focus:ring-club-navy text-club-navy bg-white"
                >
                  <option value="">No witness</option>
                  {witnessOptions.map((p) => (
                    <option key={p.user_id} value={p.user_id}>
                      {p.profiles?.full_name ?? 'Golfer'}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleCreate}
                disabled={!description.trim() || !stakes.trim() || isPending}
                className="w-full bg-club-navy text-white font-bold py-4 rounded-xl hover:bg-club-gold hover:text-club-navy transition disabled:opacity-50 uppercase tracking-wider text-sm"
              >
                {isPending ? 'Sending...' : '⚔️ Send Challenge'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CHALLENGE DETAIL MODAL ── */}
      {detailOpen && c && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setDetailOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="bg-club-navy p-4 flex justify-between items-center">
              <div className="space-y-1">
                <h2 className="font-serif text-lg font-bold text-white">Challenge</h2>
                <span
                  className={`inline-block text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${(STATUS_CONFIG[c.status] ?? { color: 'bg-gray-100 text-gray-600' }).color}`}
                >
                  {(STATUS_CONFIG[c.status] ?? { label: c.status }).label}
                </span>
              </div>
              <button
                onClick={() => setDetailOpen(false)}
                className="text-club-gold hover:bg-white/10 p-2 rounded-full transition"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Matchup */}
              <div className="flex items-center justify-center gap-3 font-bold text-club-navy">
                <span>{getName(c.challenger_id)}</span>
                <Swords size={18} className="text-club-gold flex-shrink-0" />
                <span>{getName(c.challenged_id)}</span>
              </div>

              {/* Detail card */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-3 text-sm">
                <p className="text-club-navy leading-relaxed">{c.description}</p>

                <div className="border-t border-gray-200 pt-3">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Stakes</p>
                  <p className="font-bold text-club-navy">{c.stakes}</p>
                </div>

                {c.witness_id && (
                  <div className="border-t border-gray-200 pt-3">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Witness</p>
                    <p className="font-semibold text-club-navy flex items-center gap-1.5">
                      <UserCheck size={14} />
                      {getName(c.witness_id)}
                      {c.witness_approved && (
                        <span className="text-emerald-600 text-xs font-bold">✓ Approved</span>
                      )}
                    </p>
                  </div>
                )}

                {c.winner_id && (
                  <div className="border-t border-gray-200 pt-3">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Winner</p>
                    <p className="font-bold text-emerald-600 flex items-center gap-1.5">
                      <Trophy size={14} />
                      {getName(c.winner_id)}
                    </p>
                  </div>
                )}
              </div>

              {/* Context-aware actions */}

              {/* Challenged person: accept or decline */}
              {c.status === 'pending' && amChallenged && (
                <div className="flex gap-3">
                  <button
                    onClick={() => handleRespond(c.id, 'declined')}
                    disabled={isPending}
                    className="flex-1 border-2 border-gray-200 text-gray-600 font-bold py-3 rounded-xl hover:bg-gray-50 transition disabled:opacity-50 flex items-center justify-center gap-2 text-sm uppercase tracking-wide"
                  >
                    <XCircle size={16} /> Decline
                  </button>
                  <button
                    onClick={() => handleRespond(c.id, 'accepted')}
                    disabled={isPending}
                    className="flex-1 bg-club-navy text-white font-bold py-3 rounded-xl hover:bg-club-gold hover:text-club-navy transition disabled:opacity-50 flex items-center justify-center gap-2 text-sm uppercase tracking-wide"
                  >
                    <CheckCircle2 size={16} /> Accept
                  </button>
                </div>
              )}

              {/* Either party records result */}
              {c.status === 'accepted' && (amChallenger || amChallenged) && (
                <div className="space-y-2">
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest text-center">
                    Record Result — Who Won?
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleSetResult(c.id, c.challenger_id)}
                      disabled={isPending}
                      className="flex-1 bg-emerald-600 text-white font-bold py-3 rounded-xl hover:bg-emerald-700 transition disabled:opacity-50 text-sm"
                    >
                      {getName(c.challenger_id)}
                    </button>
                    <button
                      onClick={() => handleSetResult(c.id, c.challenged_id)}
                      disabled={isPending}
                      className="flex-1 bg-emerald-600 text-white font-bold py-3 rounded-xl hover:bg-emerald-700 transition disabled:opacity-50 text-sm"
                    >
                      {getName(c.challenged_id)}
                    </button>
                  </div>
                </div>
              )}

              {/* Witness approves result */}
              {c.status === 'awaiting_witness' && amWitness && (
                <button
                  onClick={() => handleWitnessApprove(c.id)}
                  disabled={isPending}
                  className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-2 uppercase tracking-wider text-sm"
                >
                  <UserCheck size={18} /> Approve Result as Witness
                </button>
              )}

              {/* Loser marks settled */}
              {c.status === 'result_set' && amLoser && (
                <button
                  onClick={() => handleMarkCompleted(c.id)}
                  disabled={isPending}
                  className="w-full bg-club-navy text-white font-bold py-4 rounded-xl hover:bg-club-gold hover:text-club-navy transition disabled:opacity-50 flex items-center justify-center gap-2 uppercase tracking-wider text-sm"
                >
                  <CheckCircle2 size={18} /> Mark as Settled
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
