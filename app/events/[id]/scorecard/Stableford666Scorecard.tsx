'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Minus, Plus, Save } from 'lucide-react'
import type { CourseHole, HandicapApplicationMode } from '@/lib/handicap'
import {
  buildStableford666Payload,
  getStableford666Allocations,
  calculateStableford666HoleSummary,
  calculateStableford666TotalPoints,
  getStableford666Data,
  getStableford666Name,
  getStableford666SegmentLabel,
  type Stableford666Data,
} from '@/lib/stableford_666'
import { submitStableford666Score } from './actions'

type Player = {
  id: string
  name: string
  handicap: number
}

type Props = {
  eventId: string
  roundId: string
  anchorPlayerId: string
  canEdit: boolean
  holes: CourseHole[]
  players: Player[]
  handicapApplication: HandicapApplicationMode
  initialPayload: Record<string, any> | null | undefined
}

function parseNumber(value: string) {
  if (value.trim() === '') return null
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue : null
}

export default function Stableford666Scorecard({
  eventId,
  roundId,
  anchorPlayerId,
  canEdit,
  holes,
  players,
  handicapApplication,
  initialPayload,
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [data, setData] = useState<Stableford666Data>(() => getStableford666Data(initialPayload))

  const handicapByPlayerId = useMemo(
    () => Object.fromEntries(players.map((player) => [player.id, player.handicap || 0])),
    [players]
  )

  const totalPoints = useMemo(
    () => calculateStableford666TotalPoints({ _stableford666: data }, holes, handicapByPlayerId, handicapApplication),
    [data, holes, handicapByPlayerId, handicapApplication]
  )

  const allocationsByPlayer = useMemo(
    () => getStableford666Allocations(holes, handicapByPlayerId, handicapApplication),
    [holes, handicapByPlayerId, handicapApplication]
  )

  const updateHole = (holeNumber: number, patch: Record<string, any>) => {
    setSaved(false)
    setData((current) => ({
      holes: {
        ...current.holes,
        [String(holeNumber)]: {
          ...(current.holes[String(holeNumber)] || {}),
          ...patch,
        },
      },
    }))
  }

  const updatePlayerScore = (holeNumber: number, playerId: string, value: string) => {
    setSaved(false)
    setData((current) => {
      const holeData = current.holes[String(holeNumber)] || {}
      const playerScores = { ...(holeData.playerScores || {}) }
      playerScores[playerId] = parseNumber(value)

      return {
        holes: {
          ...current.holes,
          [String(holeNumber)]: {
            ...holeData,
            playerScores,
          },
        },
      }
    })
  }

  const changeDrinkCount = (holeNumber: number, key: 'beers' | 'cocktails' | 'shots', delta: number) => {
    const currentValue = Number(data.holes[String(holeNumber)]?.[key]) || 0
    updateHole(holeNumber, { [key]: Math.max(0, currentValue + delta) })
  }

  const handleSave = () => {
    if (!canEdit || pending) return
    setError(null)
    setSaved(false)

    startTransition(async () => {
      try {
        const payload = buildStableford666Payload(data, holes, handicapByPlayerId, handicapApplication)
        await submitStableford666Score(
          eventId,
          roundId,
          anchorPlayerId,
          players.map((player) => player.id),
          payload
        )
        setSaved(true)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save scorecard')
      }
    })
  }

  return (
    <div>
      <div className="mb-3 bg-club-paper border border-club-gold/30 rounded-lg px-3 py-2">
        <p className="text-xs uppercase tracking-wider font-bold text-club-text/60">{getStableford666Name()}</p>
        <p className="text-base font-serif font-bold text-club-navy">{players.map((player) => player.name).join(' · ')}</p>
        <p className="text-[11px] text-club-text/50 mt-0.5">Only one team result counts per golf and hitting category. Drinks stack for the pair.</p>
      </div>

      <div className="mb-4 rounded-lg border border-club-gold/30 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wider font-bold text-club-text/60">Round Points</p>
            <p className="font-serif text-2xl text-club-navy">{totalPoints}</p>
          </div>
          <div className="text-right text-[11px] text-club-text/60 leading-relaxed">
            <p>1-6: Scramble</p>
            <p>7-12: Modified Alt Shot</p>
            <p>13-18: Best Ball</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {holes.map((hole) => {
          const holeData = data.holes[String(hole.number)] || {}
          const summary = calculateStableford666HoleSummary(hole, holeData, handicapByPlayerId, holes)
          const isBestBallHole = hole.number >= 13

          return (
            <div key={hole.number} className="border-b border-gray-100 last:border-0 p-3 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-serif text-xl font-bold text-club-navy">Hole {hole.number}</span>
                    <span className="rounded-full bg-club-navy/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-club-navy">
                      {getStableford666SegmentLabel(hole.number)}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400 uppercase mt-1">Par {hole.par} • HCP {hole.hcp}</p>
                </div>

                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-club-text/60">Hole Points</p>
                  <p className="font-serif text-2xl text-club-navy">{summary.totalPoints}</p>
                </div>
              </div>

              {isBestBallHole ? (
                <div className="grid grid-cols-2 gap-2">
                  {players.map((player) => {
                    const strokes = allocationsByPlayer.get(player.id)?.get(hole.number) || 0
                    return (
                      <label key={`${player.id}-${hole.number}`} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <span className="block text-[11px] font-bold uppercase tracking-wider text-club-text/60 truncate flex-1">
                            {player.name}
                          </span>
                          {strokes > 0 && (
                            <span className="inline-block rounded-full bg-club-gold text-club-navy px-2 py-0.5 text-[10px] font-bold whitespace-nowrap">
                              +{strokes} stroke{strokes !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                        <span className="block text-[10px] text-gray-400 mb-1">
                          Handicap / 3: {(player.handicap / 3).toFixed(1)}
                        </span>
                        <input
                          type="number"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={holeData.playerScores?.[player.id] ?? ''}
                          onChange={(event) => updatePlayerScore(hole.number, player.id, event.target.value)}
                          disabled={!canEdit || pending}
                          className="w-full bg-transparent text-center text-2xl outline-none text-club-navy"
                          placeholder="-"
                        />
                      </label>
                    )
                  })}
                </div>
              ) : (
                <label className="block rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                  <span className="block text-[11px] font-bold uppercase tracking-wider text-club-text/60">Team Score</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={holeData.teamScore ?? ''}
                    onChange={(event) => updateHole(hole.number, { teamScore: parseNumber(event.target.value) })}
                    disabled={!canEdit || pending}
                    className="mt-1 w-full bg-transparent text-center text-2xl outline-none text-club-navy"
                    placeholder="-"
                  />
                </label>
              )}

              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-club-text/60">Hitting Points</p>
                  <button
                    type="button"
                    onClick={() => updateHole(hole.number, { fairwayHit: false, gir: false, onePutt: false, chipIn: false })}
                    disabled={!canEdit || pending || summary.hittingPoints === 0}
                    className="rounded-md border border-gray-300 bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#1f1845] disabled:opacity-40"
                  >
                    Clear Hitting
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ['fairwayHit', 'Fairway Hit +1'],
                    ['gir', 'GIR +1'],
                    ['onePutt', '1 Putt +1'],
                    ['chipIn', 'Chip In +4'],
                  ].map(([key, label]) => {
                    const active = Boolean(holeData[key as keyof typeof holeData])
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => updateHole(hole.number, { [key]: !active })}
                        disabled={!canEdit || pending}
                        className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                          active
                            ? 'border-[#1f1845] bg-[#1f1845] text-white shadow-sm'
                            : 'border-gray-300 bg-gray-50 text-[#1f1845]'
                        }`}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-club-text/60">Drinking Points</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    ['beers', 'Beers', 2],
                    ['cocktails', 'Cocktails', 3],
                    ['shots', 'Shots', 4],
                  ].map(([key, label, points]) => {
                    const count = Number(holeData[key as keyof typeof holeData]) || 0
                    return (
                      <div key={key} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-club-text/60">{label}</p>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => changeDrinkCount(hole.number, key as 'beers' | 'cocktails' | 'shots', -1)}
                            disabled={!canEdit || pending || count <= 0}
                            className="rounded-md border border-gray-200 p-1 text-club-navy disabled:opacity-40"
                          >
                            <Minus size={14} />
                          </button>
                          <div className="text-center">
                            <p className="font-serif text-xl text-club-navy">{count}</p>
                            <p className="text-[10px] text-gray-400">{points} pts each</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => changeDrinkCount(hole.number, key as 'beers' | 'cocktails' | 'shots', 1)}
                            disabled={!canEdit || pending}
                            className="rounded-md border border-gray-200 p-1 text-club-navy disabled:opacity-40"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 rounded-lg bg-club-paper px-3 py-2 text-center text-sm text-club-navy">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-club-text/60">Finishing</p>
                  <p className="font-bold">{summary.finishingPoints}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-club-text/60">Hitting</p>
                  <p className="font-bold">{summary.hittingPoints}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-club-text/60">Drinks</p>
                  <p className="font-bold">{summary.drinksPoints}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="fixed bottom-6 left-0 right-0 px-6 max-w-md mx-auto z-20">
        <div className="space-y-2 rounded-xl border border-club-gold/20 bg-white/95 p-2 shadow-xl backdrop-blur supports-[backdrop-filter]:bg-white/85">
          <button
            type="button"
            onClick={handleSave}
            disabled={!canEdit || pending}
            className="w-full bg-[#1f1845] text-white py-4 rounded-lg shadow-xl font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-[#c3b58d] hover:text-[#1f1845] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Save size={18} />
            {pending ? 'Saving...' : 'Save Card'}
          </button>
          <div className="flex justify-center min-h-5">
            {saved ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-700 border border-emerald-200">
                <Check size={12} />
                Saved Scores
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
