'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Bell, CheckCircle2, Eye, X, XCircle } from 'lucide-react'
import { createClient } from '../../../utils/supabase/client'
import { markCompleted, respondToChallenge, witnessApprove } from './challenges/actions'

type ChallengeRow = {
  id: string
  challenger_id: string
  challenged_id: string
  witness_id?: string | null
  description: string
  status: string
  stakes: string
  winner_id?: string | null
  witness_approved?: boolean | null
  loser_completed?: boolean | null
}

type NotificationItem = {
  key: string
  type: 'respond' | 'witness' | 'settle'
  challenge: ChallengeRow
  title: string
  body: string
  dismissPolicy: 'short' | 'daily'
}

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

export default function ChallengeNotificationCenter({
  eventId,
  currentUserId,
}: {
  eventId: string
  currentUserId: string
}) {
  const [items, setItems] = useState<NotificationItem[]>([])
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [profileNameById, setProfileNameById] = useState<Record<string, string>>({})
  const [supabase] = useState(() => createClient())

  const loadNotifications = async () => {
    const { data } = await supabase
      .from('challenges')
      .select(
        'id, challenger_id, challenged_id, witness_id, description, status, stakes, winner_id, witness_approved, loser_completed'
      )
      .eq('event_id', eventId)
      .in('status', ['pending', 'awaiting_witness', 'result_set'])
      .order('created_at', { ascending: false })

    const rows = (data || []) as ChallengeRow[]

    const userIds = Array.from(
      new Set(
        rows
          .flatMap((ch) => [ch.challenger_id, ch.challenged_id, ch.witness_id])
          .filter((value): value is string => Boolean(value))
      )
    )

    let resolvedNameById = profileNameById
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds)

      const nextMap: Record<string, string> = {}
      ;(profiles || []).forEach((profile: { id: string; full_name?: string | null }) => {
        nextMap[profile.id] = profile.full_name || 'Golfer'
      })
      resolvedNameById = nextMap
      setProfileNameById(nextMap)
    }

    const nextItems: NotificationItem[] = []

    rows.forEach((ch) => {
      if (ch.status === 'pending' && ch.challenged_id === currentUserId) {
        nextItems.push({
          key: `respond:${ch.id}`,
          type: 'respond',
          challenge: ch,
          title: 'Challenge received',
          body: `${resolvedNameById[ch.challenger_id] || 'A golfer'} challenged you: ${ch.description}`,
          dismissPolicy: 'short',
        })
      }

      if (ch.status === 'awaiting_witness' && ch.witness_id === currentUserId && !ch.witness_approved) {
        nextItems.push({
          key: `witness:${ch.id}`,
          type: 'witness',
          challenge: ch,
          title: 'Witness approval needed',
          body: `Please confirm the result for: ${ch.description}`,
          dismissPolicy: 'short',
        })
      }

      if (ch.status === 'result_set' && !ch.loser_completed) {
        const isParticipant = ch.challenger_id === currentUserId || ch.challenged_id === currentUserId
        if (isParticipant) {
          nextItems.push({
            key: `settle:${ch.id}`,
            type: 'settle',
            challenge: ch,
            title: 'Challenge needs settlement',
            body: `${ch.description} - ${ch.stakes}`,
            dismissPolicy: 'daily',
          })
        }
      }
    })

    setItems(nextItems)
  }

  useEffect(() => {
    loadNotifications()

    const interval = setInterval(() => {
      loadNotifications()
    }, 60_000)

    return () => clearInterval(interval)
  }, [eventId, currentUserId])

  const isSuppressed = (item: NotificationItem) => {
    if (typeof window === 'undefined') return false
    const key = `challenge-notif:${currentUserId}:${item.key}`
    const value = window.localStorage.getItem(key)
    if (!value) return false

    if (item.dismissPolicy === 'daily') {
      return value === todayKey()
    }

    const parsed = Number(value)
    if (!Number.isFinite(parsed)) return false
    return Date.now() - parsed < 60_000
  }

  const dismiss = (item: NotificationItem) => {
    if (typeof window === 'undefined') return
    const key = `challenge-notif:${currentUserId}:${item.key}`
    if (item.dismissPolicy === 'daily') {
      window.localStorage.setItem(key, todayKey())
    } else {
      window.localStorage.setItem(key, String(Date.now()))
    }
    setItems((prev) => prev.filter((entry) => entry.key !== item.key))
  }

  const visibleItems = useMemo(
    () => items.filter((item) => !isSuppressed(item)),
    [items]
  )

  const activeItem = visibleItems[0]

  if (!activeItem) return null

  const challenge = activeItem.challenge
  const loserId = challenge.winner_id
    ? challenge.winner_id === challenge.challenger_id
      ? challenge.challenged_id
      : challenge.challenger_id
    : null

  const canMarkSettled = activeItem.type === 'settle' && loserId === currentUserId

  const runAction = async (actionId: string, fn: () => Promise<unknown>) => {
    setBusyAction(actionId)
    try {
      await fn()
      await loadNotifications()
    } finally {
      setBusyAction(null)
    }
  }

  return (
    <div className="fixed right-4 top-20 z-[1300] w-[min(92vw,26rem)]">
      <div className="rounded-2xl border border-club-gold/30 bg-white p-4 shadow-2xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-club-gold">
              <Bell size={14} /> Challenge Alert
            </p>
            <h3 className="mt-1 text-sm font-bold text-club-navy">{activeItem.title}</h3>
          </div>
          <button
            type="button"
            onClick={() => dismiss(activeItem)}
            className="rounded-full p-1 text-gray-500 transition hover:bg-gray-100 hover:text-club-navy"
            aria-label="Dismiss challenge notification"
          >
            <X size={16} />
          </button>
        </div>

        <p className="mb-3 text-sm text-gray-700">{activeItem.body}</p>

        <div className="mb-3 rounded-lg bg-club-paper px-3 py-2 text-xs font-semibold text-club-navy">
          Stakes: {challenge.stakes}
        </div>

        <div className="flex flex-wrap gap-2">
          {activeItem.type === 'respond' && (
            <>
              <button
                type="button"
                onClick={() => runAction(`accept:${challenge.id}`, () => respondToChallenge(challenge.id, 'accepted'))}
                disabled={busyAction !== null}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold uppercase tracking-wide text-white transition hover:bg-emerald-700 disabled:opacity-50"
              >
                <CheckCircle2 size={14} /> Accept
              </button>
              <button
                type="button"
                onClick={() => runAction(`decline:${challenge.id}`, () => respondToChallenge(challenge.id, 'declined'))}
                disabled={busyAction !== null}
                className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-3 py-2 text-xs font-bold uppercase tracking-wide text-white transition hover:bg-rose-700 disabled:opacity-50"
              >
                <XCircle size={14} /> Reject
              </button>
            </>
          )}

          {activeItem.type === 'witness' && (
            <button
              type="button"
              onClick={() => runAction(`witness:${challenge.id}`, () => witnessApprove(challenge.id))}
              disabled={busyAction !== null}
              className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold uppercase tracking-wide text-white transition hover:bg-blue-700 disabled:opacity-50"
            >
              <Eye size={14} /> Mark Witnessed
            </button>
          )}

          {canMarkSettled && (
            <button
              type="button"
              onClick={() => runAction(`settled:${challenge.id}`, () => markCompleted(challenge.id))}
              disabled={busyAction !== null}
              className="inline-flex items-center gap-1 rounded-lg bg-orange-600 px-3 py-2 text-xs font-bold uppercase tracking-wide text-white transition hover:bg-orange-700 disabled:opacity-50"
            >
              <CheckCircle2 size={14} /> Mark Settled
            </button>
          )}

          <Link
            href={`/events/${eventId}/challenges`}
            className="inline-flex items-center rounded-lg border border-club-navy/20 px-3 py-2 text-xs font-bold uppercase tracking-wide text-club-navy transition hover:bg-club-paper"
          >
            Open Challenges
          </Link>
        </div>
      </div>
    </div>
  )
}
