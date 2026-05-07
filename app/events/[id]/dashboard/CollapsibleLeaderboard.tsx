'use client'

import { useState } from 'react'
import { Trophy, ChevronDown, ChevronUp } from 'lucide-react'
import Link from 'next/link'

export type LeaderboardRow = {
  key: string
  label: string
  memberNames: string[]
  memberIds: string[]
  score: number | null
  placePoints?: number | null
}

export type OverallRow = {
  key: string
  label: string
  memberNames: string[]
  points: number
}

type Props = {
  eventId: string
  dailyRounds: Array<{
    roundId: string
    roundDate: string | null
    formatLabel: string
    rows: LeaderboardRow[]
  }>
  overallRows: OverallRow[]
  currentRoundId: string | null
}

export default function CollapsibleLeaderboard({
  eventId,
  dailyRounds,
  overallRows,
  currentRoundId,
}: Props) {
  const [open, setOpen] = useState(false)
  const initialRoundIndex = Math.max(
    0,
    dailyRounds.findIndex((round) => round.roundId === currentRoundId)
  )
  const [roundIndex, setRoundIndex] = useState(initialRoundIndex)
  const selectedRound = dailyRounds[roundIndex] || null

  return (
    <div id="leaderboards" className="mt-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between bg-club-navy text-white px-5 py-4 rounded-xl shadow-md active:opacity-90 transition"
      >
        <div className="flex items-center gap-3">
          <Trophy size={20} className="text-club-gold shrink-0" />
          <span className="font-serif text-lg font-bold tracking-wide">Leaderboard</span>
        </div>
        {open ? (
          <ChevronUp size={22} className="text-club-gold" />
        ) : (
          <ChevronDown size={22} className="text-club-gold" />
        )}
      </button>

      {open && (
        <div className="space-y-4 mt-4">
          {/* Daily Leaderboard */}
          <div className="bg-white p-4 rounded-xl shadow-md border-b-4 border-club-gold">
            <div className="flex justify-between items-center mb-3">
              <div>
                <h3 className="text-xs font-bold uppercase text-gray-400 tracking-widest">
                  Daily Results
                </h3>
                <p className="mt-1 inline-flex items-center rounded-full bg-club-paper px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-club-navy">
                  Format: {selectedRound?.formatLabel || 'No Round Set'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setRoundIndex((value) => Math.max(0, value - 1))}
                  disabled={roundIndex <= 0}
                  className="text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded border border-gray-200 text-club-navy disabled:opacity-40"
                >
                  Prev
                </button>
                <span className="text-[10px] uppercase tracking-wider text-club-navy/60 font-bold">
                  {selectedRound?.roundDate
                    ? new Date(`${selectedRound.roundDate}T00:00:00`).toLocaleDateString()
                    : 'No Round Set'}
                </span>
                <button
                  type="button"
                  onClick={() => setRoundIndex((value) => Math.min(dailyRounds.length - 1, value + 1))}
                  disabled={roundIndex >= dailyRounds.length - 1}
                  className="text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded border border-gray-200 text-club-navy disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>

            {selectedRound?.rows?.length ? (
              <div className="space-y-2">
                {selectedRound.rows.map((row, index) => {
                  const canLink = selectedRound.roundId && row.memberIds.length > 0
                  const href = canLink
                    ? `/events/${eventId}/scorecards?roundId=${selectedRound.roundId}&players=${encodeURIComponent(row.memberIds.join(','))}`
                    : null

                  const inner = (
                    <>
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="bg-club-navy text-white w-8 h-8 rounded-full flex items-center justify-center font-serif text-sm font-bold shrink-0">
                          {index + 1}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-club-navy truncate">
                            {row.label}
                          </p>
                          <p className="text-xs text-gray-400 truncate">
                            {row.memberNames.join(' & ')}
                          </p>
                        </div>
                      </div>
                      <p className="font-serif font-bold text-club-navy text-lg">
                        {row.score === null ? '--' : `${row.score} (${row.placePoints ?? 0})`}
                      </p>
                    </>
                  )

                  return href ? (
                    <Link
                      key={row.key}
                      href={href}
                      className="flex items-center justify-between p-2 rounded-lg border border-gray-100 hover:border-club-gold/50 hover:bg-club-paper/40 transition-colors"
                    >
                      {inner}
                    </Link>
                  ) : (
                    <div
                      key={row.key}
                      className="flex items-center justify-between p-2 rounded-lg border border-gray-100"
                    >
                      {inner}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="bg-white/50 p-4 rounded-lg border border-dashed border-gray-300 text-center">
                <p className="text-sm text-gray-400 italic">No scores posted for today yet.</p>
              </div>
            )}
          </div>

          {/* Overall Team Leaderboard */}
          <div className="bg-white p-4 rounded-xl shadow-md border-b-4 border-club-navy">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-xs font-bold uppercase text-gray-400 tracking-widest">
                Overall
              </h3>
              <span className="text-[10px] uppercase tracking-wider text-club-navy/60 font-bold">
                Total Points
              </span>
            </div>

            {overallRows.length > 0 ? (
              <div className="space-y-2">
                {overallRows.map((row, index) => (
                  <div
                    key={row.key}
                    className="flex items-center justify-between p-2 rounded-lg border border-gray-100"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="bg-club-gold text-club-navy w-8 h-8 rounded-full flex items-center justify-center font-serif text-sm font-bold shrink-0">
                        {index + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-club-navy truncate">
                          {row.label}
                        </p>
                        <p className="text-xs text-gray-400 truncate">
                          {row.memberNames.join(' & ')}
                        </p>
                      </div>
                    </div>
                    <p className="font-serif font-bold text-club-navy text-lg">{row.points}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white/50 p-4 rounded-lg border border-dashed border-gray-300 text-center">
                <p className="text-sm text-gray-400 italic">No teams or scores available yet.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
