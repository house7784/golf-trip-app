import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/utils/supabase/server'
import { allocateStrokesByHole, calculateNetTotal, floorNetHoleScore, type CourseHole, type HandicapApplicationMode } from '@/lib/handicap'
import {
  calculateStableford666HoleSummary,
  calculateStableford666TotalPoints,
  getStableford666Allocations,
  getStableford666Data,
  getStableford666SegmentLabel,
} from '@/lib/stableford_666'

function getDisplayName(profile?: { full_name?: string | null; email?: string | null } | null) {
  return profile?.full_name || 'Golfer'
}

function normalizeProfile<T>(profile: T | T[] | null | undefined): T | null {
  if (!profile) return null
  return Array.isArray(profile) ? (profile[0] || null) : profile
}

function totalScore(holeScores: Record<string, number> | null | undefined) {
  if (!holeScores) return 0
  return Object.values(holeScores).reduce((sum, value) => sum + (Number(value) || 0), 0)
}

function holeValue(holeScores: Record<string, any> | null | undefined, holeNumber: number) {
  if (!holeScores) return null
  const value = Number(holeScores[String(holeNumber)] ?? holeScores[holeNumber])
  return Number.isFinite(value) ? value : null
}

function samePair(slotA: number, slotB: number) {
  return (slotA <= 2 && slotB <= 2) || (slotA >= 3 && slotB >= 3)
}

function numericHoleScore(holeScores: Record<string, any> | null | undefined, holeNumber: number) {
  const value = Number(holeScores?.[String(holeNumber)] ?? holeScores?.[holeNumber])
  return Number.isFinite(value) ? value : null
}

function strokeDots(strokes: number) {
  return strokes > 0 ? '•'.repeat(Math.min(strokes, 6)) : '—'
}

function scoreMarkerClass(score: number | null, par: number) {
  if (score === null) return null
  const delta = score - par
  if (delta === -1) return 'inline-flex min-w-7 h-7 items-center justify-center rounded-full border-2 border-club-navy px-1 leading-none'
  if (delta <= -2) return 'inline-flex min-w-7 h-7 items-center justify-center rounded-full border-2 border-club-navy ring-1 ring-club-navy/70 ring-offset-1 px-1 leading-none'
  if (delta === 1) return 'inline-flex min-w-7 h-7 items-center justify-center rounded-sm border-2 border-club-navy px-1 leading-none'
  if (delta >= 2) return 'inline-flex min-w-7 h-7 items-center justify-center rounded-sm border-2 border-club-navy ring-1 ring-club-navy/70 ring-offset-1 px-1 leading-none'
  return null
}

function renderMarkedScore(score: number | null, par: number) {
  if (score === null) return '--'
  const markerClass = scoreMarkerClass(score, par)
  if (!markerClass) return score
  return <span className={markerClass}>{score}</span>
}

function renderClassicScorecard(
  holes: CourseHole[],
  holeScores: Record<string, any> | null | undefined,
  allocations?: Map<number, number>
) {
  const sections = [
    { label: 'OUT', holes: holes.filter((hole) => hole.number <= 9) },
    { label: 'IN', holes: holes.filter((hole) => hole.number >= 10) },
  ]

  return (
    <div className="space-y-3">
      {sections.map((section) => {
        if (section.holes.length === 0) return null

        const parTotal = section.holes.reduce((sum, hole) => sum + (Number(hole.par) || 0), 0)
        const grossTotal = section.holes.reduce((sum, hole) => {
          const gross = numericHoleScore(holeScores, hole.number)
          return sum + (gross ?? 0)
        }, 0)
        const netTotal = section.holes.reduce((sum, hole) => {
          const gross = numericHoleScore(holeScores, hole.number)
          if (gross === null) return sum
          return sum + floorNetHoleScore(gross, allocations?.get(hole.number) || 0)
        }, 0)

        return (
          <div key={section.label} className="rounded-lg border border-gray-200 overflow-hidden">
            <div className="grid" style={{ gridTemplateColumns: `repeat(${section.holes.length}, minmax(0, 1fr)) 60px` }}>
              {section.holes.map((hole) => (
                <div key={`${section.label}-hole-${hole.number}`} className="px-1 py-2 text-center text-gray-500 text-xs border-r border-gray-100">
                  {hole.number}
                </div>
              ))}
              <div className="px-1 py-2 text-center text-gray-500 text-xs font-bold">{section.label}</div>

              {section.holes.map((hole) => (
                <div key={`${section.label}-par-${hole.number}`} className="px-1 py-2 text-center text-sm border-t border-r border-gray-100 text-club-navy">
                  {hole.par}
                </div>
              ))}
              <div className="px-1 py-2 text-center text-sm border-t text-club-navy font-bold">{parTotal}</div>

              {section.holes.map((hole) => {
                const gross = numericHoleScore(holeScores, hole.number)
                return (
                  <div key={`${section.label}-gross-${hole.number}`} className="px-1 py-2 text-center text-lg border-t border-r border-gray-100 text-club-navy font-semibold">
                    {renderMarkedScore(gross, Number(hole.par) || 0)}
                  </div>
                )
              })}
              <div className="px-1 py-2 text-center text-lg border-t text-club-navy font-bold">{grossTotal || '--'}</div>

              {section.holes.map((hole) => {
                const strokes = allocations?.get(hole.number) || 0
                return (
                  <div key={`${section.label}-dots-${hole.number}`} className="px-1 py-1 text-center text-xs border-t border-r border-gray-100 text-club-navy/80">
                    {strokeDots(strokes)}
                  </div>
                )
              })}
              <div className="px-1 py-1 text-center text-xs border-t text-club-navy/80">Strokes</div>

              {section.holes.map((hole) => {
                const gross = numericHoleScore(holeScores, hole.number)
                const net = gross === null ? null : floorNetHoleScore(gross, allocations?.get(hole.number) || 0)
                return (
                  <div key={`${section.label}-net-${hole.number}`} className="px-1 py-2 text-center text-sm border-t border-r border-gray-100 text-club-navy">
                    {renderMarkedScore(net, Number(hole.par) || 0)}
                  </div>
                )
              })}
              <div className="px-1 py-2 text-center text-sm border-t text-club-navy font-bold">{netTotal || '--'}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default async function PlayerScorecardsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ userId?: string }>
}) {
  const supabase = await createClient()
  const { id } = await params
  const query = await searchParams
  const playerId = query?.userId || ''

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return (
      <main className="min-h-screen bg-club-cream text-club-navy p-6">
        <div className="max-w-md mx-auto bg-white rounded-lg border border-gray-200 p-6 text-center">
          <p className="font-serif text-xl mb-2">Sign in required</p>
          <p className="text-sm text-gray-500 mb-4">Please sign in to view scorecards.</p>
          <Link href="/login" className="text-club-navy underline">Go to login</Link>
        </div>
      </main>
    )
  }

  const { data: viewerParticipant } = await supabase
    .from('event_participants')
    .select('id')
    .eq('event_id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!viewerParticipant) {
    return (
      <main className="min-h-screen bg-club-cream text-club-navy p-6">
        <div className="max-w-md mx-auto bg-white rounded-lg border border-gray-200 p-6 text-center">
          <p className="font-serif text-xl mb-2">Access unavailable</p>
          <p className="text-sm text-gray-500 mb-4">You need to be part of this event to view scorecards.</p>
          <Link href="/events" className="text-club-navy underline">Back to events</Link>
        </div>
      </main>
    )
  }

  if (!playerId) {
    return (
      <main className="min-h-screen bg-club-cream text-club-navy p-6">
        <div className="max-w-md mx-auto bg-white rounded-lg border border-gray-200 p-6 text-center">
          <p className="font-serif text-xl mb-2">No player selected</p>
          <p className="text-sm text-gray-500 mb-4">Go back to Teams and tap a player.</p>
          <Link href={`/events/${id}/teams`} className="text-club-navy underline">Back to teams</Link>
        </div>
      </main>
    )
  }

  const { data: playerParticipant } = await supabase
    .from('event_participants')
    .select('user_id, event_handicap, profiles:user_id(full_name, email, handicap_index)')
    .eq('event_id', id)
    .eq('user_id', playerId)
    .maybeSingle()

  if (!playerParticipant) {
    return (
      <main className="min-h-screen bg-club-cream text-club-navy p-6">
        <div className="max-w-md mx-auto bg-white rounded-lg border border-gray-200 p-6 text-center">
          <p className="font-serif text-xl mb-2">Player not found</p>
          <p className="text-sm text-gray-500 mb-4">This player is not in the event.</p>
          <Link href={`/events/${id}/teams`} className="text-club-navy underline">Back to teams</Link>
        </div>
      </main>
    )
  }

  const { data: eventSettings } = await supabase
    .from('events')
    .select('handicap_application')
    .eq('id', id)
    .maybeSingle()

  const handicapApplication: HandicapApplicationMode =
    eventSettings?.handicap_application === 'par3_one_then_next_hardest'
      ? 'par3_one_then_next_hardest'
      : 'standard'

  const { data: roundsData } = await supabase
    .from('rounds')
    .select('id, date, mode_key, course_name, course_data')
    .eq('event_id', id)
    .order('date')

  const rounds = roundsData || []
  const roundIds = rounds.map((round: any) => round.id)

  const { data: participantRows } = await supabase
    .from('event_participants')
    .select('user_id, event_handicap, profiles:user_id(full_name, email, handicap_index)')
    .eq('event_id', id)

  const participants = participantRows || []
  const allUserIds = participants.map((entry: any) => entry.user_id)

  const profileByUserId = new Map<string, { full_name?: string | null; email?: string | null }>()
  participants.forEach((entry: any) => {
    profileByUserId.set(entry.user_id, normalizeProfile(entry.profiles) || {})
  })

  const { data: scoreRows } = await supabase
    .from('scores')
    .select('round_id, user_id, hole_scores')
    .in('round_id', roundIds.length > 0 ? roundIds : [''])
    .in('user_id', allUserIds.length > 0 ? allUserIds : [''])

  const scoreByRoundUser = new Map<string, Record<string, any> | null>()
  ;(scoreRows || []).forEach((row: any) => {
    scoreByRoundUser.set(`${row.round_id}:${row.user_id}`, row.hole_scores || {})
  })

  const { data: pairingRows } = await supabase
    .from('pairings')
    .select('player_id, slot_number, tee_time_id, tee_times!inner(round_id)')
    .in('tee_times.round_id', roundIds.length > 0 ? roundIds : [''])

  const pairingsByRoundId = new Map<string, any[]>()
  ;(pairingRows || []).forEach((row: any) => {
    const roundId = row.tee_times?.round_id
    if (!roundId) return
    const rows = pairingsByRoundId.get(roundId) || []
    rows.push(row)
    pairingsByRoundId.set(roundId, rows)
  })

  const handicapByPlayerId = Object.fromEntries(
    participants.map((entry: any) => [
      entry.user_id,
      Number(entry.event_handicap ?? normalizeProfile(entry.profiles)?.handicap_index ?? 0),
    ])
  )

  const playerName = getDisplayName(normalizeProfile(playerParticipant.profiles))
  const selectedPlayerHandicap = Number(
    playerParticipant.event_handicap ?? normalizeProfile(playerParticipant.profiles)?.handicap_index ?? 0
  )

  return (
    <main className="min-h-screen bg-club-cream text-club-navy p-6 pb-24">
      <div className="max-w-5xl mx-auto mb-6 flex items-center gap-4 sticky top-0 bg-club-cream py-4 z-10 border-b border-club-gold/10">
        <Link href={`/events/${id}/teams`} className="bg-white text-club-navy p-2 rounded-sm border border-club-navy/10 shadow-sm">
          <ChevronLeft size={20} />
        </Link>
        <div>
          <h1 className="font-serif text-2xl text-club-navy">{playerName} Scorecards</h1>
          <p className="text-xs text-club-text/60">
            Handicap {selectedPlayerHandicap.toFixed(1)} • All rounds for this event, including 666 bonus/drink details
          </p>
        </div>
      </div>

      {rounds.length === 0 ? (
        <div className="max-w-md mx-auto bg-white rounded-lg border border-gray-200 p-6 text-center">
          <p className="font-serif text-xl mb-2">No rounds available</p>
          <p className="text-sm text-gray-500">The organizer has not configured rounds yet.</p>
        </div>
      ) : (
        <div className="max-w-5xl mx-auto space-y-6">
          {rounds.map((round: any) => {
            const holes = Array.isArray(round.course_data?.holes) ? round.course_data.holes : []
            const playerScores = scoreByRoundUser.get(`${round.id}:${playerId}`) || {}
            const hasScore = Object.keys(playerScores || {}).length > 0

            const roundPairings = (pairingsByRoundId.get(round.id) || []) as any[]
            const playerPairing = roundPairings.find((entry) => entry.player_id === playerId)
            const sameTeeTime = playerPairing
              ? roundPairings.filter((entry) => entry.tee_time_id === playerPairing.tee_time_id)
              : []
            const pairIds = playerPairing
              ? sameTeeTime
                  .filter((entry) => samePair(entry.slot_number, playerPairing.slot_number))
                  .map((entry) => entry.player_id)
              : [playerId]
            const partnerIds = pairIds.filter((value) => value !== playerId)
            const partnerId = partnerIds[0] || null
            const partnerName = partnerId ? getDisplayName(profileByUserId.get(partnerId)) : 'Partner'
            const playerHandicap = Number(handicapByPlayerId[playerId] ?? 0)
            const playerAllocations = allocateStrokesByHole(holes as CourseHole[], playerHandicap, handicapApplication)
            const playerNetTotal = calculateNetTotal(playerScores, holes as CourseHole[], playerHandicap, handicapApplication)

            if (round.mode_key === 'scramble') {
              const sharedHolderId = pairIds.find((memberId) => scoreByRoundUser.get(`${round.id}:${memberId}`)) || playerId
              const sharedScores = scoreByRoundUser.get(`${round.id}:${sharedHolderId}`) || {}
              const sharedTotal = totalScore(sharedScores)

              return (
                <section key={round.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <h2 className="font-serif text-lg text-club-navy">{round.course_name || 'Round'}</h2>
                        <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">Shared</span>
                      </div>
                      <p className="text-xs text-club-text/60">Scramble • Shared with {partnerId ? partnerName : 'teammates'} • {new Date(`${round.date}T00:00:00`).toLocaleDateString()}</p>
                    </div>
                    <span className="text-sm font-bold text-club-navy">Team Total: {hasScore ? sharedTotal : '--'}</span>
                  </div>

                  {holes.length > 0 ? (
                    <div className="p-4">
                      {renderClassicScorecard(holes as CourseHole[], sharedScores)}
                    </div>
                  ) : (
                    <div className="p-4 text-sm text-gray-500">No hole setup found for this round.</div>
                  )}
                </section>
              )
            }

            if (round.mode_key === 'best_ball') {
              const partnerScores = partnerId ? scoreByRoundUser.get(`${round.id}:${partnerId}`) || {} : {}
              const partnerHandicap = Number(handicapByPlayerId[partnerId || ''] ?? 0)
              const partnerAllocations = allocateStrokesByHole(holes as CourseHole[], partnerHandicap, handicapApplication)
              const individualTotal = totalScore(playerScores)
              const pairTotal = holes.reduce((sum: number, hole: any) => {
                const myValue = holeValue(playerScores, hole.number)
                const partnerValue = holeValue(partnerScores, hole.number)
                if (myValue === null && partnerValue === null) return sum
                const myNet = myValue === null ? null : floorNetHoleScore(myValue, playerAllocations.get(hole.number) || 0)
                const partnerNet = partnerValue === null ? null : floorNetHoleScore(partnerValue, partnerAllocations.get(hole.number) || 0)
                if (myNet === null) return sum + (partnerNet || 0)
                if (partnerNet === null) return sum + myNet
                return sum + Math.min(myNet, partnerNet)
              }, 0)

              return (
                <section key={round.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="p-4 border-b border-gray-100">
                    <h2 className="font-serif text-lg text-club-navy">{round.course_name || 'Round'}</h2>
                    <p className="text-xs text-club-text/60">Best Ball • {new Date(`${round.date}T00:00:00`).toLocaleDateString()}</p>
                  </div>

                  <div className="p-4 border-b border-gray-100">
                    <div className="flex items-center gap-2 mb-2">
                      <p className="text-xs uppercase tracking-wide text-gray-500">Individual Card</p>
                      <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">Individual</span>
                    </div>
                    <div className="flex items-center justify-between text-sm font-semibold text-club-navy mb-2">
                      <span>{playerName}</span>
                      <span>Gross: {hasScore ? individualTotal : '--'} • Net: {hasScore ? playerNetTotal : '--'}</span>
                    </div>
                    {renderClassicScorecard(holes as CourseHole[], playerScores, playerAllocations)}
                  </div>

                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <p className="text-xs uppercase tracking-wide text-gray-500">Paired Final Card ({playerName} + {partnerName})</p>
                      <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-orange-100 text-orange-800">Pair Final</span>
                    </div>
                    <div className="flex items-center justify-between text-sm font-semibold text-club-navy mb-2">
                      <span>Best Ball by Hole</span>
                      <span>Pair Net Total: {partnerId ? pairTotal : '--'}</span>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {holes.map((hole: any) => {
                        const myValue = holeValue(playerScores, hole.number)
                        const partnerValue = holeValue(partnerScores, hole.number)
                        const myNet = myValue === null ? null : floorNetHoleScore(myValue, playerAllocations.get(hole.number) || 0)
                        const partnerNet = partnerValue === null ? null : floorNetHoleScore(partnerValue, partnerAllocations.get(hole.number) || 0)
                        const bestValue =
                          myNet === null && partnerNet === null
                            ? '--'
                            : myNet === null
                              ? partnerNet
                              : partnerNet === null
                                ? myNet
                                : Math.min(myNet, partnerNet)

                        return (
                          <div key={`pair-${hole.number}`} className="px-1 py-2 text-sm">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <span className="font-bold text-club-navy">{hole.number}</span>
                                <span className="text-gray-500 text-xs uppercase">Par {hole.par}</span>
                              </div>
                              <span className="font-semibold text-club-gold">Best Net: {bestValue}</span>
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {playerName}: {myValue ?? '--'} ({myNet ?? '--'}) • {partnerName}: {partnerValue ?? '--'} ({partnerNet ?? '--'})
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </section>
              )
            }

            if (round.mode_key === 'stableford') {
              const data = getStableford666Data(playerScores)
              const totalPoints = calculateStableford666TotalPoints(playerScores, holes, handicapByPlayerId)
              const stablefordAllocations = getStableford666Allocations(holes as CourseHole[], handicapByPlayerId)
              const sharedHoles = holes.filter((hole: any) => hole.number <= 12)
              const bestBallHoles = holes.filter((hole: any) => hole.number > 12)

              return (
                <section key={round.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                    <div>
                      <h2 className="font-serif text-lg text-club-navy">{round.course_name || 'Round'}</h2>
                      <p className="text-xs text-club-text/60">666 Drinking Stableford • {new Date(`${round.date}T00:00:00`).toLocaleDateString()}</p>
                    </div>
                    <span className="text-sm font-bold text-club-navy">Points: {hasScore ? totalPoints : '--'}</span>
                  </div>

                  <div className="p-4 border-b border-gray-100">
                    <div className="flex items-center gap-2 mb-2">
                      <p className="text-xs uppercase tracking-wide text-gray-500">Shared Team Card (Scramble + Modified Alt Shot)</p>
                      <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">Shared</span>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {sharedHoles.map((hole: any) => {
                        const holeData = data.holes[String(hole.number)] || {}
                        const summary = calculateStableford666HoleSummary(hole, holeData, handicapByPlayerId, holes)
                        const segmentLabel = getStableford666SegmentLabel(hole.number)
                        return (
                          <div key={`shared-${hole.number}`} className="px-1 py-2 text-sm">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <span className="font-bold text-club-navy">{hole.number}</span>
                                <span className="text-gray-500 text-xs uppercase">Par {hole.par}</span>
                                <span className="text-gray-400 text-xs">{segmentLabel}</span>
                              </div>
                              <span className="font-semibold text-club-gold">Pts {summary.totalPoints}</span>
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              Team Score: {holeData.teamScore ?? '--'} • Drinks B/C/S: {holeData.beers || 0}/{holeData.cocktails || 0}/{holeData.shots || 0} • Bonuses: {holeData.fairwayHit ? 'FWY ' : ''}{holeData.gir ? 'GIR ' : ''}{holeData.onePutt ? '1Putt ' : ''}{holeData.chipIn ? 'ChipIn' : ''}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <p className="text-xs uppercase tracking-wide text-gray-500">Best Ball Segment (Holes 13-18)</p>
                      <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">Individual</span>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {bestBallHoles.map((hole: any) => {
                        const holeData = data.holes[String(hole.number)] || {}
                        const summary = calculateStableford666HoleSummary(hole, holeData, handicapByPlayerId, holes)
                        const myScore = holeData?.playerScores?.[playerId]
                        const partnerScore = partnerId ? holeData?.playerScores?.[partnerId] : null
                        const myNet = Number.isFinite(Number(myScore))
                          ? floorNetHoleScore(Number(myScore), stablefordAllocations.get(playerId)?.get(hole.number) || 0)
                          : null
                        const partnerNet = partnerId && Number.isFinite(Number(partnerScore))
                          ? floorNetHoleScore(Number(partnerScore), stablefordAllocations.get(partnerId)?.get(hole.number) || 0)
                          : null
                        const bestNet = myNet === null && partnerNet === null
                          ? '--'
                          : myNet === null
                            ? partnerNet
                            : partnerNet === null
                              ? myNet
                              : Math.min(myNet, partnerNet)
                        return (
                          <div key={`bb-${hole.number}`} className="px-1 py-2 text-sm">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <span className="font-bold text-club-navy">{hole.number}</span>
                                <span className="text-gray-500 text-xs uppercase">Par {hole.par}</span>
                              </div>
                              <span className="font-semibold text-club-gold">Pts {summary.totalPoints} • Best Net {bestNet}</span>
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {playerName}: {myScore ?? '--'} ({myNet ?? '--'}) • {partnerName}: {partnerScore ?? '--'} ({partnerNet ?? '--'}) • Drinks B/C/S: {holeData.beers || 0}/{holeData.cocktails || 0}/{holeData.shots || 0} • Bonuses: {holeData.fairwayHit ? 'FWY ' : ''}{holeData.gir ? 'GIR ' : ''}{holeData.onePutt ? '1Putt ' : ''}{holeData.chipIn ? 'ChipIn' : ''}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </section>
              )
            }

            const total = totalScore(playerScores)
            return (
              <section key={round.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <h2 className="font-serif text-lg text-club-navy">{round.course_name || 'Round'}</h2>
                    <p className="text-xs text-club-text/60">{round.mode_key || 'standard'} • {new Date(`${round.date}T00:00:00`).toLocaleDateString()}</p>
                  </div>
                  <span className="text-sm font-bold text-club-navy">Gross: {hasScore ? total : '--'} • Net: {hasScore ? playerNetTotal : '--'}</span>
                </div>

                {holes.length > 0 ? (
                  <div className="p-4">
                    {renderClassicScorecard(holes as CourseHole[], playerScores, playerAllocations)}
                  </div>
                ) : (
                  <div className="p-4 text-sm text-gray-500">No hole setup found for this round.</div>
                )}
              </section>
            )
          })}
        </div>
      )}
    </main>
  )
}
