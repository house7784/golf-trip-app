// app/events/[id]/dashboard/page.tsx
import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import { 
  Calendar, 
  Trophy, 
  Megaphone, 
    Send,
  Edit, 
  Swords, 
  ClipboardList, 
  Users, 
    Settings,
    Gauge
} from 'lucide-react'
import CopyInviteButton from './CopyInviteButton'
import { activateLeaderboard, deactivateLeaderboard, postAnnouncement } from './actions'
import { calculateNetTotal, clampHandicap, type CourseHole, type HandicapApplicationMode } from '@/lib/handicap'

const LEADERBOARD_ACTIVATION_MESSAGE = '__SYSTEM__:LEADERBOARD_ACTIVE'

type ParticipantRow = {
    user_id: string
    team_id: string | null
    event_handicap?: number | null
    handicap_locked_at?: string | null
    profiles?: {
        full_name?: string | null
        email?: string | null
        handicap_index?: number | null
    } | null
}

type TeamRow = {
    id: string
    name: string
}

type RoundRow = {
    id: string
    date: string
    course_data?: { holes?: CourseHole[] } | null
}

type ScoreRow = {
    round_id: string
    user_id: string
    hole_scores: Record<string, number> | null
}

type PairingRow = {
    slot_number: number
    player_id: string | null
    profiles?: {
        full_name?: string | null
        email?: string | null
    } | null
}

type TeeTimeRow = {
    id: string
    pairings: PairingRow[]
}

function getDisplayName(profile?: { full_name?: string | null; email?: string | null } | null) {
    return profile?.full_name || profile?.email?.split('@')[0] || 'Golfer'
}

function totalScore(holeScores: Record<string, number> | null | undefined) {
    if (!holeScores) return 0
    return Object.values(holeScores).reduce((sum, value) => sum + (Number(value) || 0), 0)
}

function isSystemAnnouncement(row: any) {
    return row?.message === LEADERBOARD_ACTIVATION_MESSAGE || row?.content === LEADERBOARD_ACTIVATION_MESSAGE || row?.title === LEADERBOARD_ACTIVATION_MESSAGE
}

function isLockWindowActive(startDate: string | null | undefined) {
    if (!startDate) return false
    const now = new Date()
    const lockStart = new Date(`${startDate}T00:00:00`)
    lockStart.setDate(lockStart.getDate() - 7)
    return now >= lockStart
}

export default async function EventDashboard({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { id } = await params

  // 1. Fetch Event Details
  const { data: event } = await supabase.from('events').select('*').eq('id', id).single()

  // 2. Fetch User Role (Are they an organizer?)
  const { data: { user } } = await supabase.auth.getUser()
  const { data: participant } = await supabase
    .from('event_participants')
    .select('role')
    .eq('event_id', id)
    .eq('user_id', user?.id)
    .single()
    
  const isOrganizer = participant?.role === 'organizer'

  // 3. Fetch Announcements
    const { data: announcementRows } = await supabase
    .from('announcements')
    .select('*')
    .eq('event_id', id)
    .order('created_at', { ascending: false })

    const allAnnouncements = announcementRows || []
    const leaderboardActive = allAnnouncements.some(isSystemAnnouncement)
    const announcements = allAnnouncements.filter((item: any) => !isSystemAnnouncement(item)).slice(0, 3)

    const { data: roundsData } = await supabase
        .from('rounds')
        .select('id, date, course_data')
        .eq('event_id', id)

    const rounds: RoundRow[] = (roundsData as RoundRow[] | null) || []
    const sortedRounds = [...rounds].sort((a, b) => (a.date || '').localeCompare(b.date || ''))
    const today = new Date().toISOString().split('T')[0]
    const currentRound =
        sortedRounds.find((round) => round.date === today) ||
        [...sortedRounds].reverse().find((round) => round.date <= today) ||
        sortedRounds[0] ||
        null

    const { data: participantsData } = await supabase
        .from('event_participants')
                .select('id, user_id, team_id, event_handicap, handicap_locked_at, profiles:user_id(full_name, email, handicap_index)')
        .eq('event_id', id)

    const participants: ParticipantRow[] = (participantsData as ParticipantRow[] | null) || []

        const handicapCap = event?.handicap_cap ?? null
        const handicapApplication: HandicapApplicationMode =
            event?.handicap_application === 'par3_one_then_next_hardest'
                ? 'par3_one_then_next_hardest'
                : 'standard'
        const lockWindowActive = isLockWindowActive(event?.start_date)

        if (lockWindowActive) {
            const participantsToLock = participants.filter((entry) => entry.event_handicap === null || entry.event_handicap === undefined)

            if (participantsToLock.length > 0) {
                await Promise.all(
                    participantsToLock.map(async (entry) => {
                        const lockedValue = clampHandicap(Number(entry?.profiles?.handicap_index || 0), handicapCap)

                        await supabase
                            .from('event_participants')
                            .update({
                                event_handicap: lockedValue,
                                handicap_locked_at: new Date().toISOString(),
                            })
                            .eq('event_id', id)
                            .eq('user_id', entry.user_id)

                        entry.event_handicap = lockedValue
                        entry.handicap_locked_at = new Date().toISOString()
                    })
                )
            }
        }

        const effectiveHandicapByUserId = new Map<string, number>()
        participants.forEach((entry) => {
            const profileHandicap = Number(entry?.profiles?.handicap_index || 0)
            const cappedProfile = clampHandicap(profileHandicap, handicapCap)
            const effective = entry.event_handicap === null || entry.event_handicap === undefined
                ? cappedProfile
                : Number(entry.event_handicap)

            effectiveHandicapByUserId.set(entry.user_id, Math.max(0, effective || 0))
        })

    const { data: teamsData } = await supabase
        .from('teams')
        .select('id, name, captain_id')
        .eq('event_id', id)

    const teams: TeamRow[] = (teamsData as TeamRow[] | null) || []
    const isCaptain = teams.some((team: any) => team.captain_id === user?.id)

    let scores: ScoreRow[] = []
    if (sortedRounds.length > 0) {
        const roundIds = sortedRounds.map((round) => round.id)
        const { data: scoresData } = await supabase
            .from('scores')
            .select('round_id, user_id, hole_scores')
            .in('round_id', roundIds)

        scores = (scoresData as ScoreRow[] | null) || []
    }

    const roundById = new Map<string, RoundRow>()
    sortedRounds.forEach((round) => roundById.set(round.id, round))

    const scoreMap = new Map<string, number>()
    scores.forEach((row) => {
        const round = roundById.get(row.round_id)
        const holes = (round?.course_data?.holes || []) as CourseHole[]
        const handicap = effectiveHandicapByUserId.get(row.user_id) || 0

        const netTotal = holes.length > 0
          ? calculateNetTotal(row.hole_scores, holes, handicap, handicapApplication)
          : totalScore(row.hole_scores)

        scoreMap.set(`${row.round_id}:${row.user_id}`, netTotal)
    })

    const hasTeams = teams.length > 0

    const entries = hasTeams
        ? [
                ...teams.map((team) => {
                    const members = participants.filter((participant) => participant.team_id === team.id)
                    return {
                        key: team.id,
                        label: team.name,
                        memberNames: members.map((member) => getDisplayName(member.profiles)),
                        memberIds: members.map((member) => member.user_id),
                    }
                }),
                ...participants
                    .filter((participant) => !participant.team_id)
                    .map((participant) => ({
                        key: `solo-${participant.user_id}`,
                        label: getDisplayName(participant.profiles),
                        memberNames: [getDisplayName(participant.profiles)],
                        memberIds: [participant.user_id],
                    })),
            ]
        : participants.map((participant) => ({
                key: `solo-${participant.user_id}`,
                label: getDisplayName(participant.profiles),
                memberNames: [getDisplayName(participant.profiles)],
                memberIds: [participant.user_id],
            }))

    const buildRoundStandings = (roundId: string) => {
        const rows = entries.map((entry) => {
            let total = 0
            let scoredPlayers = 0

            entry.memberIds.forEach((memberId) => {
                const value = scoreMap.get(`${roundId}:${memberId}`)
                if (value !== undefined) {
                    total += value
                    scoredPlayers += 1
                }
            })

            return {
                key: entry.key,
                label: entry.label,
                memberNames: entry.memberNames,
                memberIds: entry.memberIds,
                score: scoredPlayers > 0 ? total : null,
            }
        })

        return rows.sort((a, b) => {
            if (a.score === null && b.score === null) return a.label.localeCompare(b.label)
            if (a.score === null) return 1
            if (b.score === null) return -1
            if (a.score !== b.score) return a.score - b.score
            return a.label.localeCompare(b.label)
        })
    }

    const currentDayLeaderboard = currentRound ? buildRoundStandings(currentRound.id) : []

        let currentDayLeaderboardRows = currentDayLeaderboard
        if (leaderboardActive && currentRound) {
            const { data: teeTimesData } = await supabase
                .from('tee_times')
                .select('id, pairings(slot_number, player_id, profiles:player_id(full_name, email))')
                .eq('round_id', currentRound.id)

            const teeTimes = (teeTimesData as TeeTimeRow[] | null) || []
            const pairEntries: Array<{ key: string; label: string; memberNames: string[]; memberIds: string[] }> = []
            let pairNumber = 1

            teeTimes.forEach((teeTime) => {
                const sortedPairings = [...(teeTime.pairings || [])].sort((a, b) => a.slot_number - b.slot_number)
                const groups = [
                    sortedPairings.filter((pairing) => pairing.slot_number === 1 || pairing.slot_number === 2),
                    sortedPairings.filter((pairing) => pairing.slot_number === 3 || pairing.slot_number === 4),
                ]

                groups.forEach((group, groupIndex) => {
                    const players = group.filter((entry) => entry.player_id)
                    if (players.length === 0) return

                    pairEntries.push({
                        key: `${teeTime.id}-pair-${groupIndex + 1}`,
                        label: `Pair ${pairNumber++}`,
                        memberNames: players.map((player) => getDisplayName(player.profiles)),
                        memberIds: players.map((player) => player.player_id as string),
                    })
                })
            })

            if (pairEntries.length > 0) {
                const rows = pairEntries.map((entry) => {
                    let total = 0
                    let scoredPlayers = 0

                    entry.memberIds.forEach((memberId) => {
                        const value = scoreMap.get(`${currentRound.id}:${memberId}`)
                        if (value !== undefined) {
                            total += value
                            scoredPlayers += 1
                        }
                    })

                    return {
                        key: entry.key,
                        label: entry.label,
                        memberNames: entry.memberNames,
                        memberIds: entry.memberIds,
                        score: scoredPlayers > 0 ? total : null,
                    }
                })

                currentDayLeaderboardRows = rows.sort((a, b) => {
                    if (a.score === null && b.score === null) return a.label.localeCompare(b.label)
                    if (a.score === null) return 1
                    if (b.score === null) return -1
                    if (a.score !== b.score) return a.score - b.score
                    return a.label.localeCompare(b.label)
                })
            }
        }

    const overallPoints = new Map<string, number>()
    entries.forEach((entry) => overallPoints.set(entry.key, 0))

    sortedRounds.forEach((round) => {
        const standings = buildRoundStandings(round.id).filter((row) => row.score !== null)
        const teamCount = standings.length
        if (teamCount === 0) return

        let rank = 0
        let previousScore: number | null = null

        standings.forEach((row, index) => {
            if (row.score !== previousScore) {
                rank = index + 1
                previousScore = row.score
            }

            const roundPoints = teamCount - rank + 1
            overallPoints.set(row.key, (overallPoints.get(row.key) || 0) + roundPoints)
        })
    })

    const overallLeaderboard = entries
        .map((entry) => ({
            key: entry.key,
            label: entry.label,
            memberNames: entry.memberNames,
            points: overallPoints.get(entry.key) || 0,
        }))
        .sort((a, b) => {
            if (a.points !== b.points) return b.points - a.points
            return a.label.localeCompare(b.label)
        })

  return (
    <main className="min-h-screen bg-club-cream text-club-navy pb-20">
      
      {/* HERO SECTION */}
      <div className="bg-club-navy text-white p-6 pt-12 rounded-b-3xl shadow-lg relative overflow-hidden">
        <div className="relative z-10">
            <h1 className="font-serif text-3xl mb-1">{event?.name}</h1>
            <p className="text-club-gold text-sm font-bold uppercase tracking-wider">{event?.location}</p>
        </div>
        {/* Background Pattern */}
        <div className="absolute top-0 right-0 opacity-10 transform translate-x-10 -translate-y-10">
            <Trophy size={150} />
        </div>
      </div>

      <div className="p-6 space-y-6 -mt-4 relative z-20">

                {/* 1. LEADERBOARDS */}
                <div id="leaderboards" className="space-y-4">
                    <div className="bg-white p-4 rounded-xl shadow-md border-b-4 border-club-gold">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="text-xs font-bold uppercase text-gray-400 tracking-widest">Current Day Leaderboard</h3>
                            <span className="text-[10px] uppercase tracking-wider text-club-navy/60 font-bold">
                                {currentRound ? new Date(`${currentRound.date}T00:00:00`).toLocaleDateString() : 'No Round Set'}
                            </span>
                        </div>

                                                {!leaderboardActive && (
                                                    <div className="mb-3 bg-club-paper p-3 rounded border border-club-gold/20">
                                                        <p className="text-xs text-club-text/70">
                                                            Leaderboard names are hidden until the organizer activates scoring visibility from Organizer Tools.
                                                        </p>
                                                    </div>
                                                )}

                                                {currentDayLeaderboardRows.length > 0 ? (
                            <div className="space-y-2">
                                                                {currentDayLeaderboardRows.map((row, index) => {
                                    const canOpenScorecards = leaderboardActive && currentRound && row.memberIds.length > 0
                                    const rowHref = canOpenScorecards
                                        ? `/events/${id}/scorecards?roundId=${currentRound.id}&players=${encodeURIComponent(row.memberIds.join(','))}`
                                        : null

                                    const rowContent = (
                                        <>
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="bg-club-navy text-white w-8 h-8 rounded-full flex items-center justify-center font-serif text-sm font-bold shrink-0">
                                                    {index + 1}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-bold text-sm text-club-navy truncate">{leaderboardActive ? row.label : `Position ${index + 1}`}</p>
                                                    {leaderboardActive ? (
                                                        <p className="text-xs text-gray-400 truncate">{row.memberNames.join(' & ')}</p>
                                                    ) : (
                                                        <p className="text-xs text-gray-400 truncate">Names hidden</p>
                                                    )}
                                                </div>
                                            </div>
                                            <p className="font-serif font-bold text-club-navy text-lg">
                                                {row.score === null ? '--' : row.score}
                                            </p>
                                        </>
                                    )

                                    if (rowHref) {
                                        return (
                                            <Link
                                                key={row.key}
                                                href={rowHref}
                                                className="flex items-center justify-between p-2 rounded-lg border border-gray-100 hover:border-club-gold/50 hover:bg-club-paper/40 transition-colors"
                                            >
                                                {rowContent}
                                            </Link>
                                        )
                                    }

                                    return (
                                        <div key={row.key} className="flex items-center justify-between p-2 rounded-lg border border-gray-100">
                                            {rowContent}
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

                    <div className="bg-white p-4 rounded-xl shadow-md border-b-4 border-club-navy">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="text-xs font-bold uppercase text-gray-400 tracking-widest">Overall Team Leaderboard</h3>
                            <span className="text-[10px] uppercase tracking-wider text-club-navy/60 font-bold">Total Points</span>
                        </div>

                        {overallLeaderboard.length > 0 ? (
                            <div className="space-y-2">
                                {overallLeaderboard.map((row, index) => (
                                    <div key={row.key} className="flex items-center justify-between p-2 rounded-lg border border-gray-100">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="bg-club-gold text-club-navy w-8 h-8 rounded-full flex items-center justify-center font-serif text-sm font-bold shrink-0">
                                                {index + 1}
                                            </div>
                                            <div className="min-w-0">
                                                                                                <p className="font-bold text-sm text-club-navy truncate">{leaderboardActive ? row.label : `Position ${index + 1}`}</p>
                                                                                                {leaderboardActive ? (
                                                                                                    <p className="text-xs text-gray-400 truncate">{row.memberNames.join(' & ')}</p>
                                                                                                ) : (
                                                                                                    <p className="text-xs text-gray-400 truncate">Names hidden</p>
                                                                                                )}
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

        {/* 2. ANNOUNCEMENTS */}
        <div>
            <div className="flex justify-between items-end mb-2 px-1">
                <h3 className="font-serif text-lg">Announcements</h3>
                <Link href={`/events/${id}/announcements`} className="text-xs text-club-navy underline">
                    View All
                </Link>
            </div>

            {isOrganizer && (
              <form action={postAnnouncement} className="bg-white p-3 rounded-lg shadow-sm border border-gray-100 mb-3 flex gap-2">
                <input type="hidden" name="eventId" value={id} />
                <input
                  type="text"
                  name="message"
                  placeholder="Post an announcement..."
                  required
                  className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-club-gold"
                />
                                <button className="bg-club-gold text-club-navy border border-club-navy/20 px-4 py-2 rounded-lg hover:bg-club-navy hover:text-white transition-colors">
                  <Send size={16} />
                </button>
              </form>
            )}
            
            {announcements && announcements.length > 0 ? (
                <div className="space-y-3">
                    {announcements.map((item: any) => (
                        <Link key={item.id} href={`/events/${id}/announcements`} className="block bg-white p-4 rounded-lg shadow-sm border border-gray-100 hover:border-club-gold/40 transition-colors">
                            <div className="flex items-start gap-3">
                                <Megaphone className="text-club-gold shrink-0 mt-1" size={16} />
                                <div>
                                    <p className="text-sm text-club-text mt-1">{item.message || item.content || item.title}</p>
                                    <p className="text-[10px] text-gray-300 mt-2">
                                        {new Date(item.created_at).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            ) : (
                <div className="bg-white/50 p-6 rounded-lg border border-dashed border-gray-300 text-center">
                    <p className="text-sm text-gray-400 italic">No news is good news.</p>
                </div>
            )}
        </div>

        {/* 3. PLAYER ACTIONS GRID */}
        <h3 className="font-serif text-lg px-1">Menu</h3>
        <div className="grid grid-cols-2 gap-4">
            {/* Scorecard */}
            <Link href={`/events/${id}/scorecard`} className="bg-club-green text-white p-4 rounded-xl shadow-md flex flex-col items-center justify-center gap-2 h-32 active:bg-opacity-90 transition">
                <Edit size={32} />
                <span className="font-bold text-sm">Enter Scores</span>
            </Link>

                        {(isCaptain || isOrganizer) && (
                            <Link href={`/events/${id}/scorecard?scope=team`} className="bg-club-gold text-club-navy p-4 rounded-xl shadow-md flex flex-col items-center justify-center gap-2 h-32 active:bg-opacity-90 transition">
                                <Edit size={28} />
                                <span className="font-bold text-xs uppercase tracking-wider">Manage Team Scores</span>
                            </Link>
                        )}

            {/* Tee Times */}
            <Link href={`/events/${id}/tee-times`} className="bg-white text-club-navy p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-2 h-32 active:bg-gray-50 transition">
                <Calendar size={28} className="text-club-gold" />
                <span className="font-bold text-xs uppercase tracking-wider">Tee Times</span>
            </Link>

            {/* Challenges */}
            <Link href={`/events/${id}/challenges`} className="bg-white text-club-navy p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-2 h-32 active:bg-gray-50 transition">
                <Swords size={28} className="text-club-gold" />
                <span className="font-bold text-xs uppercase tracking-wider">Challenges</span>
            </Link>

            {/* Full Leaderboard */}
            <Link href={`/events/${id}/dashboard#leaderboards`} className="bg-white text-club-navy p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-2 h-32 active:bg-gray-50 transition">
                <ClipboardList size={28} className="text-club-gold" />
                <span className="font-bold text-xs uppercase tracking-wider">Standings</span>
            </Link>
        </div>

        {/* 4. ORGANIZER TOOLS (Conditional) */}
        {isOrganizer && (
            <div className="mt-8 pt-8 border-t border-club-navy/10">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs font-bold uppercase text-gray-400 tracking-widest">Organizer Tools</h3>
                                        <div className="flex items-center gap-2">
                                            {leaderboardActive ? (
                                                <form action={deactivateLeaderboard}>
                                                    <input type="hidden" name="eventId" value={id} />
                                                    <button className="bg-red-100 text-red-700 py-2 px-3 rounded-sm uppercase tracking-wide text-xs font-bold hover:bg-red-200 transition-all">
                                                        Lock Leaderboard
                                                    </button>
                                                </form>
                                            ) : (
                                                <form action={activateLeaderboard}>
                                                    <input type="hidden" name="eventId" value={id} />
                                                    <button className="bg-club-navy text-white py-2 px-3 rounded-sm uppercase tracking-wide text-xs font-bold hover:bg-club-gold hover:text-club-navy transition-all">
                                                        Activate Leaderboard
                                                    </button>
                                                </form>
                                            )}
                                            <CopyInviteButton eventId={id} />
                                        </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                    <Link href={`/events/${id}/teams`} className="bg-gray-200 p-3 rounded text-center">
                        <Users className="mx-auto mb-1 text-gray-600" size={20} />
                        <span className="text-[10px] font-bold text-gray-600">Teams</span>
                    </Link>
                    <Link href={`/events/${id}/modes`} className="bg-gray-200 p-3 rounded text-center">
                        <Settings className="mx-auto mb-1 text-gray-600" size={20} />
                        <span className="text-[10px] font-bold text-gray-600">Modes</span>
                    </Link>
                    <Link href={`/events/${id}/handicaps`} className="bg-gray-200 p-3 rounded text-center">
                        <Gauge className="mx-auto mb-1 text-gray-600" size={20} />
                        <span className="text-[10px] font-bold text-gray-600">Handicaps</span>
                    </Link>
                    {/* Add more admin tools here later */}
                </div>
            </div>
        )}

      </div>
    </main>
  )
}