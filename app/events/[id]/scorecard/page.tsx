// app/events/[id]/scorecard/page.tsx
import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft, Save } from 'lucide-react'
import { submitBestBallScores, submitScore, submitScrambleScore } from './actions'
import Stableford666Scorecard from './Stableford666Scorecard'
import { allocateStrokesByHole, clampHandicap, floorNetHoleScore, type CourseHole, type HandicapApplicationMode } from '@/lib/handicap'

type ProfileRow = {
  full_name?: string | null
  handicap_index?: number | null
}

type EventParticipantRow = {
  user_id: string
  team_id?: string | null
  event_handicap?: number | null
  profiles?: ProfileRow | null
}

type PairingRow = {
  tee_time_id: string
  slot_number: number
  player_id: string
}

type ScoreRow = {
  user_id: string
  hole_scores?: Record<string, unknown> | null
}

type RoundCourseData = {
  holes?: CourseHole[]
  leaderboard_group_size?: number
  best_ball_matchplay?: boolean
}

type RoundRow = {
  id: string
  mode_key?: string | null
  course_name?: string | null
  date?: string | null
  course_data?: RoundCourseData | null
}

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
  searchParams?: Promise<{ roundId?: string; playerId?: string; scope?: string; saved?: string; error?: string }>
}) {
  const supabase = await createClient()
  const { id } = await params
  const query = await searchParams
  const { data: { user } } = await supabase.auth.getUser()

  // 1. Get Today's Round (We'll assume the most recent or active one for simplicity)
  // Ideally, you'd select the round, but for now, let's grab the first one that has course data
  const { data: roundsData } = await supabase
    .from('rounds')
    .select('*')
    .eq('event_id', id)
    .not('course_data', 'is', null)
    .order('date')

  const rounds = (roundsData as RoundRow[] | null) || []
  const { data: event } = await supabase
    .from('events')
    .select('created_by, handicap_cap, handicap_application')
    .eq('id', id)
    .single()
  const today = new Date().toISOString().split('T')[0]

  const activeRound = query?.roundId
    ? rounds.find((round) => round.id === query.roundId) || rounds[0]
    : rounds.find((round) => round.date === today)
      || [...rounds].reverse().find((round) => (round.date || '') <= today)
      || rounds[0]
  const justSaved = query?.saved === '1'
  const saveError = typeof query?.error === 'string' ? query.error : null
  const buildRoundHref = (roundId: string) => {
    const params = new URLSearchParams()
    params.set('roundId', roundId)
    if (query?.playerId) params.set('playerId', query.playerId)
    if (query?.scope) params.set('scope', query.scope)
    return `/events/${id}/scorecard?${params.toString()}`
  }

  if (!activeRound) {
    return (
        <div className="min-h-screen bg-club-cream p-6 flex flex-col items-center justify-center text-center">
            <p className="font-serif text-xl mb-2">No Course Data Found</p>
            <p className="text-sm text-gray-500 mb-6">The organizer has not set up the course yet.</p>
            <Link href={`/events/${id}/dashboard`} className="text-club-navy underline">Back to Dashboard</Link>
        </div>
    )
  }

  const course = activeRound.course_data || {}

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

  const participantsRows = (participants as EventParticipantRow[] | null) || []
  const participantById = new Map<string, EventParticipantRow>()
  participantsRows.forEach((entry) => participantById.set(entry.user_id, entry))

  const { data: pairings } = await supabase
    .from('pairings')
    .select('tee_time_id, slot_number, player_id, tee_times!inner(round_id)')
    .eq('tee_times.round_id', activeRound.id)

  const pairingRows = ((pairings || []) as PairingRow[])
  const actorPair = pairingRows.find((entry) => entry.player_id === user?.id)

  // ── Grouped mode detection ───────────────────────────────────────────────
  const isScramble = activeRound.mode_key === 'scramble'
  const isBestBall = activeRound.mode_key === 'best_ball'
  const isStableford666 = activeRound.mode_key === 'stableford'
  const isGroupedMode = isScramble || isBestBall || isStableford666
  const groupedModeSize: number = (() => {
    const raw = activeRound.course_data?.leaderboard_group_size
    if (raw === 2 || raw === 4) return raw
    if (isScramble) return 4
    if (isBestBall || isStableford666) return 2
    return 1
  })()
  const isBestBallMatchPlay =
    isBestBall && Boolean(activeRound.course_data?.best_ball_matchplay) && groupedModeSize === 2

  let groupedModeIds: string[] = []
  let groupedModeNames: string[] = []
  let opposingModeIds: string[] = []
  let opposingModeNames: string[] = []
  // ─────────────────────────────────────────────────────────────────────────

  const editableUserIds = new Set<string>()
  if (user?.id) editableUserIds.add(user.id)

  const partnerEditableUserIds = new Set<string>()
  if (user?.id) partnerEditableUserIds.add(user.id)

  if (actorPair) {
    pairingRows.forEach((entry) => {
      if (!entry.player_id) return
      if (entry.tee_time_id === actorPair.tee_time_id && samePair(entry.slot_number, actorPair.slot_number)) {
        editableUserIds.add(entry.player_id)
        partnerEditableUserIds.add(entry.player_id)
      }
    })
  }

  if (isCaptain && captainTeam?.id) {
    participantsRows.forEach((entry) => {
      if (entry.team_id === captainTeam.id) editableUserIds.add(entry.user_id)
    })
  }

  if (isOrganizer) {
    participantsRows.forEach((entry) => editableUserIds.add(entry.user_id))
  }

  const selectableUserIds = isTeamManageMode
    ? editableUserIds
    : isGroupedMode
      ? partnerEditableUserIds
      : new Set(user?.id ? [user.id] : [])

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
    const anchorPairing = pairingRows.find((p) => p.player_id === selectedPlayerId)
    if (anchorPairing) {
      const sameTeeTime = pairingRows.filter((p) => p.tee_time_id === anchorPairing.tee_time_id && p.player_id)
      const inGroup = groupedModeSize === 4
        ? sameTeeTime
        : sameTeeTime.filter((p) => samePair(p.slot_number, anchorPairing.slot_number))
      groupedModeIds = inGroup.map((p) => p.player_id)
      groupedModeNames = groupedModeIds.map(
        (pid) => participantById.get(pid)?.profiles?.full_name || 'Golfer'
      )

      if (isBestBallMatchPlay) {
        const opponents = sameTeeTime.filter((p) => !samePair(p.slot_number, anchorPairing.slot_number))
        opposingModeIds = opponents.map((p) => p.player_id)
        opposingModeNames = opposingModeIds.map(
          (pid) => participantById.get(pid)?.profiles?.full_name || 'Golfer'
        )
      }
    }
    if (groupedModeIds.length === 0 && selectedPlayerId) {
      groupedModeIds = [selectedPlayerId]
      groupedModeNames = [selectedPlayerName]
    }
  }
  
  const scoreIdsToLoad = isBestBall || isStableford666
    ? Array.from(new Set([...groupedModeIds, ...(isBestBallMatchPlay ? opposingModeIds : [])]))
    : [selectedPlayerId]
  const { data: existingScores } = await supabase
    .from('scores')
    .select('user_id, hole_scores')
    .eq('round_id', activeRound.id)
    .in('user_id', scoreIdsToLoad)

  const scoresByPlayerId = new Map<string, Record<string, unknown>>()
  ;((existingScores || []) as ScoreRow[]).forEach((row) => {
    scoresByPlayerId.set(row.user_id, row.hole_scores || {})
  })

  const scores = scoresByPlayerId.get(selectedPlayerId) || {}
  const scoreHoles = (course.holes || []) as CourseHole[]
  const strokeAllocationByPlayerId = new Map<string, Map<number, number>>()
  participantsRows.forEach((entry) => {
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

  const matchPlaySummary = isBestBallMatchPlay
    ? (() => {
        let teamHolesWon = 0
        let opponentHolesWon = 0
        let decidedHoles = 0

        for (const hole of scoreHoles) {
          const teamBestNet = groupedModeIds.reduce<number | null>((best, playerId) => {
            const gross = Number(scoresByPlayerId.get(playerId)?.[hole.number])
            if (!Number.isFinite(gross)) return best
            const net = floorNetHoleScore(gross, strokeAllocationByPlayerId.get(playerId)?.get(hole.number) || 0)
            return best === null ? net : Math.min(best, net)
          }, null)

          const opponentBestNet = opposingModeIds.reduce<number | null>((best, playerId) => {
            const gross = Number(scoresByPlayerId.get(playerId)?.[hole.number])
            if (!Number.isFinite(gross)) return best
            const net = floorNetHoleScore(gross, strokeAllocationByPlayerId.get(playerId)?.get(hole.number) || 0)
            return best === null ? net : Math.min(best, net)
          }, null)

          if (teamBestNet === null || opponentBestNet === null) continue
          decidedHoles += 1
          if (teamBestNet < opponentBestNet) teamHolesWon += 1
          if (opponentBestNet < teamBestNet) opponentHolesWon += 1
        }

        const holesUp = teamHolesWon - opponentHolesWon
        const teamLabel = groupedModeNames.join(' & ')
        const oppLabel = opposingModeNames.join(' & ')
        const statusText = decidedHoles === 0
          ? 'No holes decided yet.'
          : holesUp === 0
            ? `All square through ${decidedHoles}.`
            : holesUp > 0
              ? `${teamLabel} up ${holesUp} over ${oppLabel} (through ${decidedHoles}).`
              : `${oppLabel} up ${Math.abs(holesUp)} over ${teamLabel} (through ${decidedHoles}).`

        return {
          teamHolesWon,
          opponentHolesWon,
          decidedHoles,
          statusText,
        }
      })()
    : null

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

      {justSaved && (
        <div className="max-w-md mx-auto mb-4">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700 flex items-center gap-2">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white">✓</span>
            Saved Scores
          </div>
        </div>
      )}

      {saveError && (
        <div className="max-w-md mx-auto mb-4">
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
            {saveError}
          </div>
        </div>
      )}

      {rounds.length > 1 && (
        <div className="max-w-md mx-auto mb-4">
          <div className="bg-white rounded-lg border border-club-gold/20 p-3 shadow-sm">
            <p className="text-xs uppercase tracking-wider font-bold text-club-text/60 mb-2">Trip Rounds</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {rounds.map((round) => {
                const isActive = round.id === activeRound.id
                return (
                  <Link
                    key={round.id}
                    href={buildRoundHref(round.id)}
                    className={`flex-shrink-0 rounded-full px-3 py-2 text-[11px] font-bold uppercase tracking-wider border transition-colors ${
                      isActive
                        ? 'bg-club-navy text-white border-club-navy'
                        : 'bg-club-paper text-club-navy border-club-gold/20 hover:border-club-gold'
                    }`}
                  >
                    {round.date || 'Round'}
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      )}

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
                {isBestBallMatchPlay && opposingModeNames.length > 0 ? (
                  <>
                    <p className="text-[11px] text-club-text/70 mt-1">Opponents: <span className="font-semibold text-club-navy">{opposingModeNames.join(' · ')}</span></p>
                    {matchPlaySummary ? (
                      <p className="text-[11px] text-club-text/70 mt-1">Match Status: <span className="font-semibold text-club-navy">{matchPlaySummary.statusText}</span></p>
                    ) : null}
                  </>
                ) : null}
              </div>
            ) : (
              <div className="mb-3 bg-club-paper border border-club-gold/30 rounded-lg px-3 py-2">
                <p className="text-xs uppercase tracking-wider font-bold text-club-text/60">Entering Scores For</p>
                <p className="text-base font-serif font-bold text-club-navy">{selectedPlayerName}</p>
              </div>
            )}

            <form key={`${activeRound.id}:${selectedPlayerId}`} action={async (formData) => {
                'use server'
                try {
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
                  const savedParams = new URLSearchParams()
                  savedParams.set('roundId', activeRound.id)
                  savedParams.set('saved', '1')
                  if (selectedPlayerId) savedParams.set('playerId', selectedPlayerId)
                  if (query?.scope) savedParams.set('scope', query.scope)
                  redirect(`/events/${id}/scorecard?${savedParams.toString()}`)
                } catch (error) {
                  const message = error instanceof Error ? error.message : 'Failed to save scores.'
                  const errorParams = new URLSearchParams()
                  errorParams.set('roundId', activeRound.id)
                  errorParams.set('error', message)
                  if (selectedPlayerId) errorParams.set('playerId', selectedPlayerId)
                  if (query?.scope) errorParams.set('scope', query.scope)
                  redirect(`/events/${id}/scorecard?${errorParams.toString()}`)
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

                {rounds.length > 1 && (
                  <div className="max-w-md mx-auto mb-4">
                    <div className="bg-white rounded-lg border border-club-gold/20 p-3 shadow-sm">
                      <p className="text-xs uppercase tracking-wider font-bold text-club-text/60 mb-2">Trip Rounds</p>
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {rounds.map((round) => {
                          const isActive = round.id === activeRound.id
                          return (
                            <Link
                              key={round.id}
                              href={buildRoundHref(round.id)}
                              className={`flex-shrink-0 rounded-full px-3 py-2 text-[11px] font-bold uppercase tracking-wider border transition-colors ${
                                isActive
                                  ? 'bg-club-navy text-white border-club-navy'
                                  : 'bg-club-paper text-club-navy border-club-gold/20 hover:border-club-gold'
                              }`}
                            >
                              {round.date || 'Round'}
                            </Link>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                  {isBestBall ? (course.holes || []).map((hole: CourseHole) => (
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
                          const rawCurrentVal = Number(scoresByPlayerId.get(groupPlayerId)?.[hole.number])
                          const currentVal = Number.isFinite(rawCurrentVal) ? rawCurrentVal : undefined
                          let scoreColor = 'text-club-navy'
                          if (currentVal !== undefined) {
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

                      {isBestBallMatchPlay && opposingModeIds.length > 0 && (
                        <>
                          <div className="mt-3 pt-3 border-t border-gray-200">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-club-text/60 mb-2">Opponents</p>
                            <div className="grid grid-cols-2 gap-2">
                              {opposingModeIds.map((opponentId) => {
                                const opponentName = participantById.get(opponentId)?.profiles?.full_name || 'Golfer'
                                const opponentGross = Number(scoresByPlayerId.get(opponentId)?.[hole.number])
                                const opponentStrokes = strokeAllocationByPlayerId.get(opponentId)?.get(hole.number) || 0
                                const opponentNet = Number.isFinite(opponentGross)
                                  ? floorNetHoleScore(opponentGross, opponentStrokes)
                                  : null

                                return (
                                  <div key={`${opponentId}-${hole.number}`} className="rounded-lg border border-gray-200 bg-white px-3 py-2">
                                    <span className="block text-[11px] font-bold uppercase tracking-wider text-club-text/60 truncate">
                                      {opponentName}
                                    </span>
                                    <span className="block text-[10px] text-gray-400 mt-0.5">
                                      Strokes on hole: {opponentStrokes} ({strokeDots(opponentStrokes)})
                                    </span>
                                    <span className="block text-[10px] text-gray-400 mt-0.5">
                                      Gross {Number.isFinite(opponentGross) ? opponentGross : '--'} • Net {opponentNet ?? '--'}
                                    </span>
                                  </div>
                                )
                              })}
                            </div>
                          </div>

                          <div className="mt-2 text-[11px]">
                            {(() => {
                              const teamBestNet = groupedModeIds.reduce<number | null>((best, playerId) => {
                                const gross = Number(scoresByPlayerId.get(playerId)?.[hole.number])
                                if (!Number.isFinite(gross)) return best
                                const net = floorNetHoleScore(gross, strokeAllocationByPlayerId.get(playerId)?.get(hole.number) || 0)
                                return best === null ? net : Math.min(best, net)
                              }, null)

                              const opponentBestNet = opposingModeIds.reduce<number | null>((best, playerId) => {
                                const gross = Number(scoresByPlayerId.get(playerId)?.[hole.number])
                                if (!Number.isFinite(gross)) return best
                                const net = floorNetHoleScore(gross, strokeAllocationByPlayerId.get(playerId)?.get(hole.number) || 0)
                                return best === null ? net : Math.min(best, net)
                              }, null)

                              if (teamBestNet === null || opponentBestNet === null) {
                                return <p className="text-gray-500">Hole winner: waiting on both teams.</p>
                              }
                              if (teamBestNet < opponentBestNet) {
                                return <p className="text-emerald-700 font-semibold">Hole winner: Your team ({teamBestNet} vs {opponentBestNet})</p>
                              }
                              if (opponentBestNet < teamBestNet) {
                                return <p className="text-red-700 font-semibold">Hole winner: Opponents ({opponentBestNet} vs {teamBestNet})</p>
                              }
                              return <p className="text-club-navy font-semibold">Hole winner: Halved ({teamBestNet} vs {opponentBestNet})</p>
                            })()}
                          </div>
                        </>
                      )}
                    </div>
                  )) : (course.holes || []).map((hole: CourseHole) => {
                    const rawCurrentVal = Number(scores[hole.number])
                    const currentVal = Number.isFinite(rawCurrentVal) ? rawCurrentVal : undefined
                        
                    let scoreColor = 'text-club-navy'
                    if (currentVal !== undefined) {
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

                <div className="fixed bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-club-cream via-club-cream/95 to-transparent px-6 pb-6 pt-10">
                  <div className="max-w-md mx-auto rounded-2xl border border-club-navy/10 bg-white/92 p-3 shadow-lg backdrop-blur-sm">
                    <button disabled={!canEditSelected} className="w-full bg-club-navy text-white py-4 rounded-lg shadow-xl font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-club-gold transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                      <Save size={18} />
                      Save Card
                    </button>
                  </div>
                </div>

            </form>
          </>
        )}
      </div>
    </main>
  )
}