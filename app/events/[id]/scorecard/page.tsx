// app/events/[id]/scorecard/page.tsx
import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import { ChevronLeft, Save } from 'lucide-react'
import { submitBestBallScores, submitScore, submitScrambleScore } from './actions'
import Stableford666Scorecard from './Stableford666Scorecard'
import { allocateStrokesByHole, clampHandicap, type HandicapApplicationMode } from '@/lib/handicap'

function samePair(slotA: number, slotB: number) {
  return (slotA <= 2 && slotB <= 2) || (slotA >= 3 && slotB >= 3)
}

function strokeDots(strokes: number) {
  return strokes > 0 ? '•'.repeat(Math.min(strokes, 6)) : '—'
}

export default async function ScorecardPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ roundId?: string; playerId?: string; scope?: string }>
}) {
  const supabase = await createClient()
  const { id } = await params
  const query = await searchParams
  const { data: { user } } = await supabase.auth.getUser()

  // 1. Get Today's Round (We'll assume the most recent or active one for simplicity)
  // Ideally, you'd select the round, but for now, let's grab the first one that has course data
  const { data: rounds } = await supabase
    .from('rounds')
    .select('*')
    .eq('event_id', id)
    .not('course_data', 'is', null)
    .order('date')

  const activeRound = query?.roundId
    ? rounds?.find((round: any) => round.id === query.roundId) || rounds?.[0]
    : rounds?.[0]

  if (!activeRound) {
    return (
        <div className="min-h-screen bg-club-cream p-6 flex flex-col items-center justify-center text-center">
            <p className="font-serif text-xl mb-2">No Course Data Found</p>
            <p className="text-sm text-gray-500 mb-6">The organizer hasn't set up the course yet.</p>
            <Link href={`/events/${id}/dashboard`} className="text-club-navy underline">Back to Dashboard</Link>
        </div>
    )
  }

  const course = activeRound.course_data

  const { data: event } = await supabase
    .from('events')
    .select('created_by, handicap_cap, handicap_application')
    .eq('id', id)
    .single()

  const handicapCap = event?.handicap_cap ?? null

  const handicapApplication: HandicapApplicationMode =
    event?.handicap_application === 'par3_one_then_next_hardest'
      ? 'par3_one_then_next_hardest'
      : 'standard'

  const { data: participant } = await supabase
    .from('event_participants')
    .select('role')
    .eq('event_id', id)
    .eq('user_id', user?.id)
    .single()

  const isOrganizer = participant?.role === 'organizer' || event?.created_by === user?.id

  const { data: captainTeam } = await supabase
    .from('teams')
    .select('id')
    .eq('event_id', id)
    .eq('captain_id', user?.id)
    .maybeSingle()

  const isCaptain = Boolean(captainTeam?.id)
  const isTeamManageMode = query?.scope === 'team' && (isCaptain || isOrganizer)

  const { data: roundData } = await supabase
    .from('rounds')
    .select('scoring_locked')
    .eq('id', activeRound.id)
    .single()

  const scoringLocked = Boolean(roundData?.scoring_locked)

  const { data: participants } = await supabase
    .from('event_participants')
    .select('user_id, team_id, event_handicap, profiles:user_id(full_name, handicap_index)')
    .eq('event_id', id)

  const participantById = new Map<string, any>()
  ;(participants || []).forEach((entry: any) => participantById.set(entry.user_id, entry))

  const { data: pairings } = await supabase
    .from('pairings')
    .select('tee_time_id, slot_number, player_id, tee_times!inner(round_id)')
    .eq('tee_times.round_id', activeRound.id)

  const actorPair = (pairings || []).find((entry: any) => entry.player_id === user?.id)

  // ── Grouped mode detection ───────────────────────────────────────────────
  const isScramble = activeRound.mode_key === 'scramble'
  const isBestBall = activeRound.mode_key === 'best_ball'
  const isStableford666 = activeRound.mode_key === 'stableford'
  const isGroupedMode = isScramble || isBestBall || isStableford666
  const groupedModeSize: number = (() => {
    const raw = (activeRound as any).course_data?.leaderboard_group_size
    if (raw === 2 || raw === 4) return raw
    if (isScramble) return 4
    if (isBestBall || isStableford666) return 2
    return 1
  })()

  let groupedModeIds: string[] = []
  let groupedModeNames: string[] = []
  // ─────────────────────────────────────────────────────────────────────────

  const editableUserIds = new Set<string>()
  if (user?.id) editableUserIds.add(user.id)

  const partnerEditableUserIds = new Set<string>()
  if (user?.id) partnerEditableUserIds.add(user.id)

  if (actorPair) {
    ;(pairings || []).forEach((entry: any) => {
      if (!entry.player_id) return
      if (entry.tee_time_id === actorPair.tee_time_id && samePair(entry.slot_number, actorPair.slot_number)) {
        editableUserIds.add(entry.player_id)
        partnerEditableUserIds.add(entry.player_id)
      }
    })
  }

  if (isCaptain && captainTeam?.id) {
    ;(participants || []).forEach((entry: any) => {
      if (entry.team_id === captainTeam.id) editableUserIds.add(entry.user_id)
    })
  }

  if (isOrganizer) {
    ;(participants || []).forEach((entry: any) => editableUserIds.add(entry.user_id))
  }

  const selectableUserIds = isTeamManageMode ? editableUserIds : partnerEditableUserIds

  const editablePlayers = Array.from(selectableUserIds)
    .map((playerId) => ({
      id: playerId,
      name:
        participantById.get(playerId)?.profiles?.full_name ||
        'Golfer',
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const selectedPlayerId =
    query?.playerId && selectableUserIds.has(query.playerId)
      ? query.playerId
      : user?.id || ''

  const selectedPlayerName =
    editablePlayers.find((entry) => entry.id === selectedPlayerId)?.name ||
    participantById.get(selectedPlayerId)?.profiles?.full_name ||
    'Golfer'

  const canEditSelected = isOrganizer || !scoringLocked

  // Resolve grouped-mode team now that selectedPlayerId is known
  if (isGroupedMode) {
    const anchorPairing = (pairings || []).find((p: any) => p.player_id === selectedPlayerId)
    if (anchorPairing) {
      const sameTeeTime = (pairings || []).filter((p: any) => p.tee_time_id === anchorPairing.tee_time_id && p.player_id)
      const inGroup = groupedModeSize === 4
        ? sameTeeTime
        : sameTeeTime.filter((p: any) => samePair(p.slot_number, anchorPairing.slot_number))
      groupedModeIds = inGroup.map((p: any) => p.player_id as string)
      groupedModeNames = groupedModeIds.map(
        (pid) => participantById.get(pid)?.profiles?.full_name || 'Golfer'
      )
    }
    if (groupedModeIds.length === 0 && selectedPlayerId) {
      groupedModeIds = [selectedPlayerId]
      groupedModeNames = [selectedPlayerName]
    }
  }
  
  const scoreIdsToLoad = isBestBall || isStableford666 ? groupedModeIds : [selectedPlayerId]
  const { data: existingScores } = await supabase
    .from('scores')
    .select('user_id, hole_scores')
    .eq('round_id', activeRound.id)
    .in('user_id', scoreIdsToLoad)

  const scoresByPlayerId = new Map<string, Record<string, any>>()
  ;(existingScores || []).forEach((row: any) => {
    scoresByPlayerId.set(row.user_id, row.hole_scores || {})
  })

  const scores = scoresByPlayerId.get(selectedPlayerId) || {}
  const scoreHoles = (course.holes || []) as any[]
  const strokeAllocationByPlayerId = new Map<string, Map<number, number>>()
  ;(participants || []).forEach((entry: any) => {
    const handicap = clampHandicap(Number(entry.event_handicap ?? entry.profiles?.handicap_index ?? 0), handicapCap)
    strokeAllocationByPlayerId.set(
      entry.user_id,
      allocateStrokesByHole(scoreHoles, handicap, handicapApplication)
    )
  })
  const stablefordPlayers = groupedModeIds.map((playerId) => ({
    id: playerId,
    name: participantById.get(playerId)?.profiles?.full_name || 'Golfer',
    handicap: clampHandicap(Number(
      participantById.get(playerId)?.event_handicap ?? participantById.get(playerId)?.profiles?.handicap_index ?? 0
    ), handicapCap),
  }))

  return (
    <main className="min-h-screen bg-club-cream text-club-navy p-6 pb-24">
      {/* Header */}
      <div className="max-w-md mx-auto mb-6 flex items-center gap-4 sticky top-0 bg-club-cream py-4 z-10 border-b border-club-gold/10">
        <Link href={`/events/${id}/dashboard`} className="bg-white text-club-navy p-2 rounded-sm border border-club-navy/10 shadow-sm">
          <ChevronLeft size={20} />
        </Link>
        <div>
          <h1 className="font-serif text-2xl text-club-navy">Enter Scores</h1>
          <p className="text-xs text-club-text/60">{activeRound.course_name}</p>
        </div>
      </div>

      {!isTeamManageMode && editablePlayers.length > 0 && (!isGroupedMode || isOrganizer) && (
        <div className="max-w-md mx-auto mb-4">
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <label className="block text-xs uppercase tracking-wider font-bold text-club-text/60 mb-2">
              Scoring For (You + Partner)
            </label>
            <div className="grid grid-cols-2 gap-2">
              {editablePlayers.map((entry) => {
                const isActive = entry.id === selectedPlayerId
                if (isActive) {
                  return (
                    <Link
                      key={entry.id}
                      href={`/events/${id}/scorecard?roundId=${activeRound.id}&playerId=${entry.id}`}
                      className="text-center px-3 py-2 rounded-lg text-sm font-bold tracking-wide border border-gray-300 bg-gray-50 !text-club-navy transition-colors"
                    >
                      <span className="inline-flex items-center gap-2">
                        <span>{entry.name}</span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-bold bg-club-navy text-white">
                          Selected
                        </span>
                      </span>
                    </Link>
                  )
                }

                return (
                  <Link
                    key={entry.id}
                    href={`/events/${id}/scorecard?roundId=${activeRound.id}&playerId=${entry.id}`}
                    className="text-center px-3 py-2 rounded-lg text-sm font-semibold tracking-wide border border-gray-300 bg-white !text-club-navy hover:border-club-gold hover:bg-club-paper/50 transition-colors"
                  >
                    {entry.name}
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {isTeamManageMode && editablePlayers.length > 1 && (
        <div className="max-w-md mx-auto mb-4">
          <form method="get" className="bg-white rounded-lg border border-gray-200 p-3">
            <input type="hidden" name="roundId" value={activeRound.id} />
            <input type="hidden" name="scope" value="team" />
            <label className="block text-xs uppercase tracking-wider font-bold text-club-text/60 mb-2">
              Manage Team Scores
            </label>
            <div className="flex items-center gap-2">
              <select
                name="playerId"
                defaultValue={selectedPlayerId}
                className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm"
              >
                {editablePlayers.map((entry) => (
                  <option key={entry.id} value={entry.id}>{entry.name}</option>
                ))}
              </select>
              <button className="bg-club-navy text-white px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-club-gold hover:text-club-navy transition-colors">
                Load
              </button>
            </div>
          </form>
        </div>
      )}

      {scoringLocked && !isOrganizer && (
        <div className="max-w-md mx-auto mb-4 bg-white border border-red-200 p-3 rounded-sm text-sm text-red-700">
          Scores are locked by the organizer for this round.
        </div>
      )}

      {/* SCORECARD FORM */}
      <div className="max-w-md mx-auto">
        {isStableford666 ? (
          <Stableford666Scorecard
            eventId={id}
            roundId={activeRound.id}
            anchorPlayerId={selectedPlayerId}
            canEdit={canEditSelected}
            holes={course.holes || []}
            players={stablefordPlayers}
            handicapApplication={handicapApplication}
            initialPayload={scoresByPlayerId.get(groupedModeIds[0]) || scores}
          />
        ) : (
          <>
            {isScramble ? (
              <div className="mb-3 bg-club-paper border border-club-gold/30 rounded-lg px-3 py-2">
                <p className="text-xs uppercase tracking-wider font-bold text-club-text/60">Scramble Group</p>
                <p className="text-base font-serif font-bold text-club-navy">{groupedModeNames.join(' · ')}</p>
                <p className="text-[11px] text-club-text/50 mt-0.5">One score is shared across the whole group</p>
              </div>
            ) : isBestBall ? (
              <div className="mb-3 bg-club-paper border border-club-gold/30 rounded-lg px-3 py-2">
                <p className="text-xs uppercase tracking-wider font-bold text-club-text/60">Best Ball Team</p>
                <p className="text-base font-serif font-bold text-club-navy">{groupedModeNames.join(' · ')}</p>
                <p className="text-[11px] text-club-text/50 mt-0.5">Each player enters their own gross score. The best net ball counts on each hole.</p>
              </div>
            ) : (
              <div className="mb-3 bg-club-paper border border-club-gold/30 rounded-lg px-3 py-2">
                <p className="text-xs uppercase tracking-wider font-bold text-club-text/60">Entering Scores For</p>
                <p className="text-base font-serif font-bold text-club-navy">{selectedPlayerName}</p>
              </div>
            )}

            <form key={`${activeRound.id}:${selectedPlayerId}`} action={async (formData) => {
                'use server'
                const newScores: Record<string, number> = {}
                for (let i = 1; i <= 18; i++) {
                    const val = formData.get(`hole_${i}`)
                    if (val) newScores[i] = parseInt(val as string)
                }
                if (formData.get('scramble') === '1') {
                  const groupIds = formData.getAll('groupPlayerId') as string[]
                  const anchor = formData.get('playerId') as string
                  await submitScrambleScore(id, activeRound.id, anchor, groupIds, newScores)
                } else if (formData.get('bestBall') === '1') {
                  const groupIds = formData.getAll('groupPlayerId') as string[]
                  const anchor = formData.get('playerId') as string
                  const playerScores: Record<string, Record<string, number>> = {}
                  groupIds.forEach((groupId) => {
                  const groupHoleScores: Record<string, number> = {}
                  for (let i = 1; i <= 18; i++) {
                    const val = formData.get(`player_${groupId}_hole_${i}`)
                    if (val) groupHoleScores[i] = parseInt(val as string)
                  }
                  playerScores[groupId] = groupHoleScores
                  })
                  await submitBestBallScores(id, activeRound.id, anchor, playerScores)
                } else {
                  await submitScore(id, activeRound.id, formData.get('playerId') as string, newScores)
                }
            }}>
                <input type="hidden" name="playerId" value={selectedPlayerId} />
                {isScramble && (
                  <>
                    <input type="hidden" name="scramble" value="1" />
                  {groupedModeIds.map((gid) => (
                    <input key={gid} type="hidden" name="groupPlayerId" value={gid} />
                  ))}
                  </>
                )}
                {isBestBall && (
                  <>
                  <input type="hidden" name="bestBall" value="1" />
                  {groupedModeIds.map((gid) => (
                      <input key={gid} type="hidden" name="groupPlayerId" value={gid} />
                    ))}
                  </>
                )}
                
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                  {isBestBall ? course.holes.map((hole: any) => (
                    <div key={hole.number} className="border-b border-gray-100 last:border-0 p-3">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <span className="font-serif text-xl font-bold">Hole {hole.number}</span>
                          <span className="ml-2 text-[10px] text-gray-400 uppercase">Par {hole.par}</span>
                        </div>
                        <div className="text-center text-[10px] text-gray-300">
                          HCP {hole.hcp}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        {groupedModeIds.map((groupPlayerId) => {
                          const playerName = participantById.get(groupPlayerId)?.profiles?.full_name || 'Golfer'
                          const currentVal = scoresByPlayerId.get(groupPlayerId)?.[hole.number]
                          let scoreColor = 'text-club-navy'
                          if (currentVal) {
                            if (currentVal < hole.par) scoreColor = 'text-red-500 font-bold'
                            if (currentVal > hole.par) scoreColor = 'text-blue-500'
                          }

                          return (
                            <label key={`${groupPlayerId}-${hole.number}`} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                              <span className="block text-[11px] font-bold uppercase tracking-wider text-club-text/60 truncate">
                                {playerName}
                              </span>
                              <span className="block text-[10px] text-gray-400 mb-1">
                                Strokes on hole: {strokeAllocationByPlayerId.get(groupPlayerId)?.get(hole.number) || 0} ({strokeDots(strokeAllocationByPlayerId.get(groupPlayerId)?.get(hole.number) || 0)})
                              </span>
                              <input
                                name={`player_${groupPlayerId}_hole_${hole.number}`}
                                type="number"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                defaultValue={currentVal}
                                placeholder="-"
                                disabled={!canEditSelected}
                                className={`mt-1 w-full bg-transparent text-center text-2xl outline-none ${scoreColor}`}
                              />
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  )) : course.holes.map((hole: any) => {
                    const currentVal = scores[hole.number]
                        
                    let scoreColor = 'text-club-navy'
                    if (currentVal) {
                      if (currentVal < hole.par) scoreColor = 'text-red-500 font-bold'
                      if (currentVal > hole.par) scoreColor = 'text-blue-500'
                    }

                    return (
                      <div key={hole.number} className="flex items-center border-b border-gray-100 last:border-0 p-3">
                        <div className="w-16 flex flex-col items-center justify-center border-r border-gray-100 pr-3">
                          <span className="font-serif text-xl font-bold">{hole.number}</span>
                          <span className="text-[10px] text-gray-400 uppercase">Par {hole.par}</span>
                        </div>

                        <div className="flex-1 flex items-center justify-center">
                          <div className="w-full">
                            <input 
                              name={`hole_${hole.number}`}
                              type="number" 
                              inputMode="numeric"
                              pattern="[0-9]*"
                              defaultValue={currentVal}
                              placeholder="-"
                              disabled={!canEditSelected}
                              className={`w-full text-center text-2xl outline-none bg-transparent ${scoreColor}`}
                            />
                            <p className="text-center text-[10px] text-gray-400 mt-1">
                              Strokes: {strokeAllocationByPlayerId.get(selectedPlayerId)?.get(hole.number) || 0} ({strokeDots(strokeAllocationByPlayerId.get(selectedPlayerId)?.get(hole.number) || 0)})
                            </p>
                          </div>
                        </div>

                        <div className="w-12 text-center text-[10px] text-gray-300">
                          HCP<br/>{hole.hcp}
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="fixed bottom-6 left-0 right-0 px-6 max-w-md mx-auto">
                  <button disabled={!canEditSelected} className="w-full bg-club-navy text-white py-4 rounded-lg shadow-xl font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-club-gold transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                        <Save size={18} />
                        Save Card
                    </button>
                </div>

            </form>
          </>
        )}
      </div>
    </main>
  )
}