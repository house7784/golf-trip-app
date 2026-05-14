'use client'

import { useState } from 'react'
import { Trophy, ChevronDown, ChevronUp } from 'lucide-react'
import Link from 'next/link'

function formatPoints(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return '--'
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

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

export type OverallContributionRow = {
  roundId: string
  roundDate: string | null
  formatLabel: string
  groupLabel: string
  memberNames: string[]
  points: number
  note?: string
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
  overallContributions: Record<string, OverallContributionRow[]>
  currentRoundId: string | null
}

export default function CollapsibleLeaderboard({
  eventId,
  dailyRounds,
  overallRows,
  overallContributions,
  currentRoundId,
}: Props) {
  const [open, setOpen] = useState(false)
  const [expandedOverallKey, setExpandedOverallKey] = useState<string | null>(null)
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
                        {row.score === null ? '--' : `${formatPoints(row.score)} (${formatPoints(row.placePoints ?? 0)})`}
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
                {overallRows.map((row, index) => {
                  const isExpanded = expandedOverallKey === row.key
                  const contributions = (overallContributions[row.key] || []).filter((item) => item.points > 0)
                  const roundSubtotalMap = new Map<string, {
                    roundId: string
                    roundDate: string | null
                    formatLabel: string
                    points: number
                  }>()

                  contributions.forEach((item) => {
                    const key = `${item.roundId}:${item.formatLabel}`
                    const existing = roundSubtotalMap.get(key)
                    if (existing) {
                      existing.points += item.points
                    } else {
                      roundSubtotalMap.set(key, {
                        roundId: item.roundId,
                        roundDate: item.roundDate,
                        formatLabel: item.formatLabel,
                        points: item.points,
                      })
                    }
                  })

                  const roundSubtotals = Array.from(roundSubtotalMap.values()).sort((a, b) => {
                    const aDate = a.roundDate || ''
                    const bDate = b.roundDate || ''
                    return aDate.localeCompare(bDate)
                  })

                  return (
                    <div
                      key={row.key}
                      className="rounded-lg border border-gray-100 overflow-hidden"
                    >
                      <button
                        type="button"
                        onClick={() => setExpandedOverallKey((value) => (value === row.key ? null : row.key))}
                        className="w-full flex items-center justify-between p-2 text-left hover:bg-club-paper/40 transition-colors"
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
                        <div className="flex items-center gap-3 shrink-0">
                          <p className="font-serif font-bold text-club-navy text-lg">{formatPoints(row.points)}</p>
                          {isExpanded ? (
                            <ChevronUp size={16} className="text-club-navy/60" />
                          ) : (
                            <ChevronDown size={16} className="text-club-navy/60" />
                          )}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="border-t border-gray-100 bg-club-paper/20 px-3 py-2">
                          <p className="text-[10px] uppercase tracking-wider text-club-navy/60 font-bold mb-2">
                            Point Breakdown
                          </p>
                          {roundSubtotals.length > 0 ? (
                            <div className="mb-2 rounded border border-gray-100 bg-white p-2">
                              <p className="text-[10px] uppercase tracking-wider text-club-navy/60 font-bold mb-1.5">
                                Round Subtotals
                              </p>
                              <div className="space-y-1">
                                {roundSubtotals.map((subtotal) => (
                                  <div
                                    key={`${row.key}-subtotal-${subtotal.roundId}-${subtotal.formatLabel}`}
                                    className="flex items-center justify-between gap-3 text-xs"
                                  >
                                    <p className="text-club-text/70 truncate">
                                      {subtotal.roundDate
                                        ? new Date(`${subtotal.roundDate}T00:00:00`).toLocaleDateString()
                                        : 'Round'}{' '}
                                      • {subtotal.formatLabel}
                                    </p>
                                    <p className="font-bold text-club-navy shrink-0">{formatPoints(subtotal.points)}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}
                          {contributions.length > 0 ? (
                            <div className="space-y-1.5">
                              {contributions.map((item, idx) => (
                                <div
                                  key={`${row.key}-${item.roundId}-${item.groupLabel}-${idx}`}
                                  className="flex items-start justify-between gap-3 rounded border border-gray-100 bg-white px-2 py-1.5"
                                >
                                  <div className="min-w-0">
                                    <p className="text-xs font-semibold text-club-navy truncate">
                                      {item.roundDate
                                        ? new Date(`${item.roundDate}T00:00:00`).toLocaleDateString()
                                        : 'Round'}{' '}
                                      • {item.formatLabel}
                                    </p>
                                    <p className="text-xs text-club-text/70 truncate">
                                      {item.groupLabel}: {item.memberNames.join(' & ')}
                                    </p>
                                    {item.note ? (
                                      <p className="text-[10px] text-club-text/50 truncate">{item.note}</p>
                                    ) : null}
                                  </div>
                                  <p className="text-xs font-bold text-club-green shrink-0">+{formatPoints(item.points)}</p>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-gray-400 italic">No point contributions recorded yet.</p>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
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
