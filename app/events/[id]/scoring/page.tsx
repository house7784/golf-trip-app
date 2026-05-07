import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import { ChevronLeft, Trophy } from 'lucide-react'
import { saveScoringConfig } from './actions'
import { GAME_MODES, type GameModeKey, getDefaultLeaderboardGroupSize, normalizeLeaderboardGroupSize } from '@/lib/game_modes'

function formatDate(dateStr: string) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function modeLabel(modeKey: string | null | undefined) {
  if (!modeKey) return 'Standard'
  const mode = GAME_MODES[modeKey as GameModeKey]
  return mode?.name || modeKey
}

export default async function ScoringPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { id } = await params

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return (
      <main className="min-h-screen bg-club-cream text-club-navy p-6">
        <div className="max-w-md mx-auto bg-white rounded-lg border border-gray-200 p-6 text-center">
          <p className="font-serif text-xl mb-2">Sign in required</p>
          <Link href="/login" className="text-club-navy underline">Go to login</Link>
        </div>
      </main>
    )
  }

  const { data: participant } = await supabase
    .from('event_participants')
    .select('role')
    .eq('event_id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!participant) {
    return (
      <main className="min-h-screen bg-club-cream text-club-navy p-6">
        <div className="max-w-md mx-auto bg-white rounded-lg border border-gray-200 p-6 text-center">
          <p className="font-serif text-xl mb-2">Access unavailable</p>
          <p className="text-sm text-gray-500 mb-4">You need to be part of this event to view scoring.</p>
          <Link href={`/events/${id}/dashboard`} className="text-club-navy underline">Back to dashboard</Link>
        </div>
      </main>
    )
  }

  const canEdit = participant.role === 'organizer'

  const { data: roundsData } = await supabase
    .from('rounds')
    .select('id, date, mode_key, course_name, course_data')
    .eq('event_id', id)
    .order('date')

  const rounds = roundsData || []

  const { data: participantsData } = await supabase
    .from('event_participants')
    .select('user_id')
    .eq('event_id', id)

  const participantCount = (participantsData || []).length

  // Count pairs/teams per round to know how many position slots to show
  const roundIds = rounds.map((r: any) => r.id)
  const { data: teeTimesData } = await supabase
    .from('tee_times')
    .select('id, round_id, pairings(slot_number, player_id)')
    .in('round_id', roundIds.length > 0 ? roundIds : ['__none__'])

  // Build: roundId → number of leaderboard entries
  function countEntries(roundId: string, groupSize: number): number {
    const teeTimes = (teeTimesData || []).filter((tt: any) => tt.round_id === roundId)
    if (groupSize === 4) {
      return teeTimes.filter((tt: any) =>
        (tt.pairings || []).some((p: any) => p.player_id)
      ).length
    }
    if (groupSize === 2) {
      let count = 0
      teeTimes.forEach((tt: any) => {
        const pairings = (tt.pairings || []) as any[]
        const sideA = pairings.filter((p: any) => p.player_id && (p.slot_number === 1 || p.slot_number === 2))
        const sideB = pairings.filter((p: any) => p.player_id && (p.slot_number === 3 || p.slot_number === 4))
        if (sideA.length > 0) count++
        if (sideB.length > 0) count++
      })
      return count
    }
    // groupSize === 1: individual
    const allPlayerIds = new Set<string>()
    teeTimes.forEach((tt: any) => {
      ;(tt.pairings || []).forEach((p: any) => {
        if (p.player_id) allPlayerIds.add(p.player_id)
      })
    })
    return allPlayerIds.size
  }

  function expectedEntryCount(groupSize: number): number {
    if (participantCount <= 0) return 0
    const normalizedSize = Math.max(1, groupSize)
    return Math.ceil(participantCount / normalizedSize)
  }

  return (
    <main className="min-h-screen bg-club-cream text-club-navy p-6 pb-24">
      {/* Header */}
      <div className="max-w-lg mx-auto mb-6 flex items-center gap-4 sticky top-0 bg-club-cream py-4 z-10 border-b border-club-gold/10">
        <Link
          href={`/events/${id}/dashboard`}
          className="bg-white text-club-navy p-2 rounded-sm border border-club-navy/10 shadow-sm"
        >
          <ChevronLeft size={20} />
        </Link>
        <div>
          <h1 className="font-serif text-2xl text-club-navy">Scoring System</h1>
          <p className="text-xs text-club-text/60">Set trip points awarded per finishing position each day</p>
        </div>
      </div>

      {rounds.length === 0 ? (
        <div className="max-w-lg mx-auto bg-white rounded-lg border border-gray-200 p-6 text-center">
          <p className="font-serif text-xl mb-2">No rounds yet</p>
          <p className="text-sm text-gray-500 mb-4">Configure game modes first.</p>
          <Link href={`/events/${id}/modes`} className="text-club-navy underline">Go to Modes</Link>
        </div>
      ) : (
        <div className="max-w-lg mx-auto space-y-6">
          {/* Explainer card */}
          <div className="bg-club-navy/5 border border-club-navy/10 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Trophy size={20} className="text-club-gold shrink-0 mt-0.5" />
              <div className="text-sm text-club-text/80 space-y-1">
                <p><strong>How it works:</strong> After each day&apos;s round the leaderboard is ranked. Players/pairs earn the trip points you set here for their finishing position.</p>
                <p>Points accumulate across all days to form the overall trip standings. Leave a position blank (or 0) to award no points for that place.</p>
              </div>
            </div>
          </div>

          {!canEdit && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-800">
              View-only mode: Only organizers can edit scoring settings.
            </div>
          )}

          {rounds.map((round: any) => {
            const courseData = (round.course_data || {}) as Record<string, any>
            const savedPositionPoints = (courseData.position_points || {}) as Record<string, number>
            const savedMatchWinner = courseData.match_winner_points ?? ''
            const savedMatchTie = courseData.match_tie_points ?? ''
            const isMatchPlay = round.mode_key === 'best_ball' && Boolean(courseData.best_ball_matchplay)
            const isPoints = round.mode_key === 'stableford'

            const groupSize = round.mode_key === 'stableford'
              ? 2
              : normalizeLeaderboardGroupSize(
                  Number(courseData.leaderboard_group_size) || getDefaultLeaderboardGroupSize(round.mode_key)
                )

            const assignedEntryCount = countEntries(round.id, groupSize)
            const plannedEntryCount = expectedEntryCount(groupSize)
            const entryCount = Math.max(assignedEntryCount, plannedEntryCount)
            const positionCount = Math.max(1, entryCount)

            return (
              <section key={round.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {/* Round header */}
                <div className="p-4 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="font-serif text-lg text-club-navy">{round.course_name || 'Round'}</h2>
                      <p className="text-xs text-club-text/60">
                        {formatDate(round.date)} &bull; {modeLabel(round.mode_key)}
                        {isMatchPlay ? ' (Match Play)' : ''}
                        {isPoints ? ' (Points)' : ''}
                      </p>
                    </div>
                    {Object.keys(savedPositionPoints).length > 0 || savedMatchWinner !== '' || savedMatchTie !== '' ? (
                      <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        Configured
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                        Default
                      </span>
                    )}
                  </div>
                </div>

                <form action={canEdit ? saveScoringConfig : undefined} className="p-4 space-y-4">
                  <input type="hidden" name="roundId" value={round.id} />
                  <input type="hidden" name="eventId" value={id} />

                  {isMatchPlay ? (
                    /* Match play: winner/tie trip points */
                    <div className="space-y-3">
                      <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
                        Trip points for overall match result
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <label className="block">
                          <span className="text-xs text-gray-500 mb-1 block">Match Winner</span>
                          <input
                            type="number"
                            name="match_winner_points"
                            min="0"
                            step="1"
                            defaultValue={savedMatchWinner !== '' ? String(savedMatchWinner) : ''}
                            placeholder="e.g. 20"
                            disabled={!canEdit}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-club-gold"
                          />
                        </label>
                        <label className="block">
                          <span className="text-xs text-gray-500 mb-1 block">Match Tied / Halved</span>
                          <input
                            type="number"
                            name="match_tie_points"
                            min="0"
                            step="1"
                            defaultValue={savedMatchTie !== '' ? String(savedMatchTie) : ''}
                            placeholder="e.g. 10"
                            disabled={!canEdit}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-club-gold"
                          />
                        </label>
                      </div>
                      <p className="text-xs text-gray-400">Per-hole match scoring stays fixed at 1 point win / 0.5 tie. This only sets trip leaderboard points for the final match winner or tie.</p>
                    </div>
                  ) : (
                    /* Position-based points */
                    <div className="space-y-3">
                      <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
                        Trip points per finishing position
                        {entryCount > 0 ? ` · ${entryCount} ${groupSize === 1 ? 'players' : 'pairs/groups'} this round` : ''}
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {Array.from({ length: positionCount }, (_, i) => i + 1).map((pos) => (
                          <label key={pos} className="flex items-center gap-2">
                            <span className="text-sm font-bold text-club-navy w-16 shrink-0">
                              {pos === 1 ? '🥇 1st' : pos === 2 ? '🥈 2nd' : pos === 3 ? '🥉 3rd' : `${pos}th`}
                            </span>
                            <input
                              type="number"
                              name={`position_${pos}`}
                              min="0"
                              step="1"
                              defaultValue={savedPositionPoints[String(pos)] !== undefined ? String(savedPositionPoints[String(pos)]) : ''}
                              placeholder="0"
                              disabled={!canEdit}
                              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-club-gold"
                            />
                          </label>
                        ))}
                      </div>
                      <p className="text-xs text-gray-400">Tied positions share the higher value&apos;s points</p>
                    </div>
                  )}

                  {canEdit ? (
                    <button
                      type="submit"
                      className="w-full bg-club-navy text-white py-2.5 rounded-lg font-bold text-sm uppercase tracking-wide hover:bg-club-gold hover:text-club-navy transition-colors"
                    >
                      Save Points
                    </button>
                  ) : null}
                </form>
              </section>
            )
          })}
        </div>
      )}
    </main>
  )
}
