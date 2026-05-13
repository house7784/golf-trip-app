import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import {
	Calendar,
	Trophy,
	Megaphone,
	Send,
	Edit,
	Swords,
	Vote,
	MessageCircle,
	Users,
	Settings,
	Gauge,
	BarChart3
} from 'lucide-react'
import CopyInviteButton from './CopyInviteButton'
import EmailSummaryButton from './EmailSummaryButton'
import CustomEmailButton from './CustomEmailButton'
import TrashTalk from '../chat/TrashTalk'
import CollapsibleLeaderboard from './CollapsibleLeaderboard'
import { activateLeaderboard, deactivateLeaderboard, postAnnouncement } from './actions'
import { allocateStrokesByHole, calculateNetTotal, clampHandicap, floorNetHoleScore, type CourseHole, type HandicapApplicationMode } from '@/lib/handicap'
import { getDefaultLeaderboardGroupSize, normalizeLeaderboardGroupSize } from '@/lib/game_modes'
import { calculateStableford666TotalPoints, getStableford666Name } from '@/lib/stableford_666'

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
	mode_key?: string | null
	course_data?: { holes?: CourseHole[]; leaderboard_group_size?: number; best_ball_matchplay?: boolean } | null
}

type ScoreRow = {
	round_id: string
	user_id: string
	hole_scores: Record<string, any> | null
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

type GroupEntry = {
	key: string
	label: string
	memberNames: string[]
	memberIds: string[]
	teeTimeId?: string
}

type OverallContribution = {
	roundId: string
	roundDate: string | null
	formatLabel: string
	groupLabel: string
	memberNames: string[]
	points: number
	note?: string
}

function getDisplayName(profile?: { full_name?: string | null; email?: string | null } | null) {
	return profile?.full_name || 'Golfer'
}

function totalScore(holeScores: Record<string, number> | null | undefined) {
	if (!holeScores) return 0
	return Object.values(holeScores).reduce((sum, value) => sum + (Number(value) || 0), 0)
}

function isSystemAnnouncement(row: any) {
	return (
		row?.message === LEADERBOARD_ACTIVATION_MESSAGE ||
		row?.content === LEADERBOARD_ACTIVATION_MESSAGE ||
		row?.title === LEADERBOARD_ACTIVATION_MESSAGE
	)
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

	const { data: event } = await supabase
		.from('events')
		.select('*, invite_code')
		.eq('id', id)
		.single()

	const { data: { user } } = await supabase.auth.getUser()
	const currentUser = { id: user?.id || '', email: user?.email || '' }
	const { data: participant } = await supabase
		.from('event_participants')
		.select('role')
		.eq('event_id', id)
		.eq('user_id', user?.id)
		.single()

	const isOrganizer = participant?.role === 'organizer'

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
		.select('id, date, mode_key, course_data')
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
		const participantsToLock = participants.filter(
			(entry) => entry.event_handicap === null || entry.event_handicap === undefined
		)
		if (participantsToLock.length > 0) {
			await Promise.all(
				participantsToLock.map(async (entry) => {
					const lockedValue = clampHandicap(Number(entry?.profiles?.handicap_index || 0), handicapCap)
					await supabase
						.from('event_participants')
						.update({ event_handicap: lockedValue, handicap_locked_at: new Date().toISOString() })
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
		const effective =
			entry.event_handicap === null || entry.event_handicap === undefined
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
	const holeScoresByRoundUser = new Map<string, Record<string, any> | null>()
	scores.forEach((row) => {
		holeScoresByRoundUser.set(`${row.round_id}:${row.user_id}`, row.hole_scores)
	})
	const strokeAllocationByRoundUser = new Map<string, Map<number, number>>()

	const scoreMap = new Map<string, number>()
	scores.forEach((row) => {
		const round = roundById.get(row.round_id)
		const holes = (round?.course_data?.holes || []) as CourseHole[]
		const handicap = effectiveHandicapByUserId.get(row.user_id) || 0
		const netTotal =
			holes.length > 0
				? calculateNetTotal(row.hole_scores, holes, handicap, handicapApplication)
				: totalScore(row.hole_scores)
		scoreMap.set(`${row.round_id}:${row.user_id}`, netTotal)
	})

	const hasTeams = teams.length > 0

	const entries = hasTeams
		? [
				...teams.map((team) => {
					const members = participants.filter((p) => p.team_id === team.id)
					return {
						key: team.id,
						label: team.name,
						memberNames: members.map((m) => getDisplayName(m.profiles)),
						memberIds: members.map((m) => m.user_id),
					}
				}),
				...participants
					.filter((p) => !p.team_id)
					.map((p) => ({
						key: `solo-${p.user_id}`,
						label: getDisplayName(p.profiles),
						memberNames: [getDisplayName(p.profiles)],
						memberIds: [p.user_id],
					})),
			]
		: participants.map((p) => ({
				key: `solo-${p.user_id}`,
				label: getDisplayName(p.profiles),
				memberNames: [getDisplayName(p.profiles)],
				memberIds: [p.user_id],
			}))

	const teamEntries = teams
		.map((team) => {
			const members = participants.filter((p) => p.team_id === team.id)
			return {
				key: team.id,
				label: team.name,
				memberNames: members.map((m) => getDisplayName(m.profiles)),
				memberIds: members.map((m) => m.user_id),
			}
		})

	const overallEntries = hasTeams ? teamEntries : entries
	const userIdToOverallEntryKey = new Map<string, string>()
	overallEntries.forEach((entry) => {
		entry.memberIds.forEach((memberId) => userIdToOverallEntryKey.set(memberId, entry.key))
	})

	const buildPairingEntries = async (roundId: string, groupSize: number) => {
		if (groupSize === 1) return entries
		const { data: teeTimesData } = await supabase
			.from('tee_times')
			.select('id, pairings(slot_number, player_id, profiles:player_id(full_name, email))')
			.eq('round_id', roundId)

		const teeTimes = (teeTimesData as TeeTimeRow[] | null) || []
		const groupedEntries: GroupEntry[] = []
		let groupNumber = 1

		teeTimes.forEach((teeTime) => {
			const sortedPairings = [...(teeTime.pairings || [])].sort((a, b) => a.slot_number - b.slot_number)
			const players = sortedPairings.filter((p) => p.player_id)

			if (groupSize === 4) {
				if (players.length > 0) {
					groupedEntries.push({
						key: `${teeTime.id}-group-1`,
						label: `Group ${groupNumber++}`,
						memberNames: players.map((p) => getDisplayName(p.profiles)),
						memberIds: players.map((p) => p.player_id as string),
						teeTimeId: teeTime.id,
					})
				}
				return
			}

			const pairGroups = [
				players.filter((p) => p.slot_number === 1 || p.slot_number === 2),
				players.filter((p) => p.slot_number === 3 || p.slot_number === 4),
			]

			pairGroups.forEach((group) => {
				if (group.length === 0) return
				groupedEntries.push({
					key: `${teeTime.id}-group-${groupNumber}`,
					label: `Group ${groupNumber++}`,
					memberNames: group.map((p) => getDisplayName(p.profiles)),
					memberIds: group.map((p) => p.player_id as string),
					teeTimeId: teeTime.id,
				})
			})
		})

		return groupedEntries.length > 0 ? groupedEntries : entries
	}

	const getNetHoleScore = (roundId: string, userId: string, holeNumber: number) => {
		const holeScores = holeScoresByRoundUser.get(`${roundId}:${userId}`)
		if (!holeScores) return null
		const rawScore = Number(holeScores[String(holeNumber)])
		if (!Number.isFinite(rawScore)) return null

		const round = roundById.get(roundId)
		const holes = (round?.course_data?.holes || []) as CourseHole[]
		if (holes.length === 0) return rawScore

		const cacheKey = `${roundId}:${userId}`
		let allocation = strokeAllocationByRoundUser.get(cacheKey)
		if (!allocation) {
			const handicap = effectiveHandicapByUserId.get(userId) || 0
			allocation = allocateStrokesByHole(holes, handicap, handicapApplication)
			strokeAllocationByRoundUser.set(cacheKey, allocation)
		}

		return floorNetHoleScore(rawScore, allocation.get(holeNumber) || 0)
	}

	const getBestBallHoleScore = (roundId: string, memberIds: string[], holeNumber: number) => {
		let bestScore: number | null = null
		memberIds.forEach((memberId) => {
			const value = getNetHoleScore(roundId, memberId, holeNumber)
			if (value === null) return
			if (bestScore === null || value < bestScore) bestScore = value
		})
		return bestScore
	}

	const buildScrambleStrokeRows = (roundId: string, groupEntries: GroupEntry[]) =>
		groupEntries
			.map((entry) => {
				let score: number | null = null
				entry.memberIds.forEach((memberId) => {
					const value = scoreMap.get(`${roundId}:${memberId}`)
					if (value === undefined) return
					if (score === null || value < score) score = value
				})
				return {
					key: entry.key,
					label: entry.label,
					memberNames: entry.memberNames,
					memberIds: entry.memberIds,
					score,
				}
			})
			.sort((a, b) => {
				if (a.score === null && b.score === null) return a.label.localeCompare(b.label)
				if (a.score === null) return 1
				if (b.score === null) return -1
				if (a.score !== b.score) return a.score - b.score
				return a.label.localeCompare(b.label)
			})

	const buildBestBallStrokeRows = (round: RoundRow, groupEntries: GroupEntry[]) => {
		const holes = (round.course_data?.holes || []) as CourseHole[]
		return groupEntries
			.map((entry) => {
				if (holes.length === 0) {
					return {
						key: entry.key,
						label: entry.label,
						memberNames: entry.memberNames,
						memberIds: entry.memberIds,
						score: null,
					}
				}

				let total = 0
				let playedHoleCount = 0
				holes.forEach((hole) => {
					const holeScore = getBestBallHoleScore(round.id, entry.memberIds, hole.number)
					if (holeScore === null) return
					total += holeScore
					playedHoleCount += 1
				})

				return {
					key: entry.key,
					label: entry.label,
					memberNames: entry.memberNames,
					memberIds: entry.memberIds,
					score: playedHoleCount > 0 ? total : null,
				}
			})
			.sort((a, b) => {
				if (a.score === null && b.score === null) return a.label.localeCompare(b.label)
				if (a.score === null) return 1
				if (b.score === null) return -1
				if (a.score !== b.score) return a.score - b.score
				return a.label.localeCompare(b.label)
			})
	}

	const buildBestBallMatchPlayRows = (round: RoundRow, groupEntries: GroupEntry[]) => {
		const holes = (round.course_data?.holes || []) as CourseHole[]
		const pointsByKey = new Map<string, number>()
		groupEntries.forEach((entry) => pointsByKey.set(entry.key, 0))

		const groupsByTeeTime = new Map<string, GroupEntry[]>()
		groupEntries.forEach((entry) => {
			if (!entry.teeTimeId) return
			const teeTimeGroups = groupsByTeeTime.get(entry.teeTimeId) || []
			teeTimeGroups.push(entry)
			groupsByTeeTime.set(entry.teeTimeId, teeTimeGroups)
		})

		groupsByTeeTime.forEach((teeTimeGroups) => {
			if (teeTimeGroups.length < 2) return
			const [groupA, groupB] = teeTimeGroups

			holes.forEach((hole) => {
				const scoreA = getBestBallHoleScore(round.id, groupA.memberIds, hole.number)
				const scoreB = getBestBallHoleScore(round.id, groupB.memberIds, hole.number)
				if (scoreA === null || scoreB === null) return

				if (scoreA < scoreB) {
					pointsByKey.set(groupA.key, (pointsByKey.get(groupA.key) || 0) + 1)
				} else if (scoreB < scoreA) {
					pointsByKey.set(groupB.key, (pointsByKey.get(groupB.key) || 0) + 1)
				} else {
					pointsByKey.set(groupA.key, (pointsByKey.get(groupA.key) || 0) + 0.5)
					pointsByKey.set(groupB.key, (pointsByKey.get(groupB.key) || 0) + 0.5)
				}
			})
		})

		return groupEntries
			.map((entry) => ({
				key: entry.key,
				label: entry.label,
				memberNames: entry.memberNames,
				memberIds: entry.memberIds,
				score: pointsByKey.get(entry.key) || 0,
			}))
			.sort((a, b) => {
				if (a.score !== b.score) return b.score - a.score
				return a.label.localeCompare(b.label)
			})
	}

	const buildStableford666Rows = (round: RoundRow, groupEntries: GroupEntry[]) => {
		const holes = (round.course_data?.holes || []) as CourseHole[]
		return groupEntries
			.map((entry) => {
				const payload = entry.memberIds
					.map((memberId) => holeScoresByRoundUser.get(`${round.id}:${memberId}`))
					.find(Boolean) || null
				const handicapByPlayerId = Object.fromEntries(
					entry.memberIds.map((memberId) => [memberId, effectiveHandicapByUserId.get(memberId) || 0])
				)
				return {
					key: entry.key,
					label: entry.label,
					memberNames: entry.memberNames,
					memberIds: entry.memberIds,
					score: payload ? calculateStableford666TotalPoints(payload, holes, handicapByPlayerId, handicapApplication) : null,
				}
			})
			.sort((a, b) => {
				if (a.score === null && b.score === null) return a.label.localeCompare(b.label)
				if (a.score === null) return 1
				if (b.score === null) return -1
				if (a.score !== b.score) return b.score - a.score
				return a.label.localeCompare(b.label)
			})
	}

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

	const getRoundGroupSize = (round: RoundRow) =>
		round.mode_key === 'stableford'
			? 2
			: normalizeLeaderboardGroupSize(
				Number(round.course_data?.leaderboard_group_size) ||
					getDefaultLeaderboardGroupSize(round.mode_key)
			)

	const getRoundFormatLabel = (round: RoundRow, groupSize: number) =>
		round.mode_key === 'stableford'
			? getStableford666Name()
			: round.mode_key === 'best_ball' && round.course_data?.best_ball_matchplay && groupSize === 2
				? '2-Person Match Play'
				: groupSize === 4
					? '4-Person Teams'
					: groupSize === 2
						? '2-Person Teams'
						: 'Individual'

	const buildRoundLeaderboardRows = async (round: RoundRow) => {
		const groupSize = getRoundGroupSize(round)
		const roundEntries = await buildPairingEntries(round.id, groupSize)

		if (round.mode_key === 'stableford') {
			return {
				groupSize,
				rows: buildStableford666Rows(round, roundEntries),
			}
		}

		if (round.mode_key === 'best_ball') {
			const bestBallMatchplay = Boolean(round.course_data?.best_ball_matchplay) && groupSize === 2
			return {
				groupSize,
				rows: bestBallMatchplay
					? buildBestBallMatchPlayRows(round, roundEntries)
					: buildBestBallStrokeRows(round, roundEntries),
			}
		}

		if (round.mode_key === 'scramble') {
			return {
				groupSize,
				rows: buildScrambleStrokeRows(round.id, roundEntries),
			}
		}

		return {
			groupSize,
			rows: roundEntries
				.map((entry) => {
					let total = 0
					let scoredPlayers = 0
					entry.memberIds.forEach((memberId) => {
						const value = scoreMap.get(`${round.id}:${memberId}`)
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
				.sort((a, b) => {
					if (a.score === null && b.score === null) return a.label.localeCompare(b.label)
					if (a.score === null) return 1
					if (b.score === null) return -1
					if (a.score !== b.score) return a.score - b.score
					return a.label.localeCompare(b.label)
				}),
		}
	}

	const appendPlacePoints = (
		round: RoundRow,
		rows: Array<{
			key: string
			label: string
			memberNames: string[]
			memberIds: string[]
			score: number | null
		}>
	) => {
		const courseData = (round.course_data || {}) as Record<string, any>
		const positionPoints = (courseData.position_points || {}) as Record<string, number>
		const hasConfiguredPoints = Object.keys(positionPoints).length > 0
		const scoredRows = rows.filter((row) => row.score !== null)
		const placePointsByKey = new Map<string, number>()

		let rank = 0
		let previousScore: number | null = null
		scoredRows.forEach((row, index) => {
			if (row.score !== previousScore) {
				rank = index + 1
				previousScore = row.score
			}

			const tripPts = hasConfiguredPoints
				? (positionPoints[String(rank)] ?? 0)
				: (scoredRows.length - rank + 1)
			placePointsByKey.set(row.key, tripPts)
		})

		return rows.map((row) => ({
			...row,
			placePoints: row.score === null ? null : (placePointsByKey.get(row.key) ?? 0),
		}))
	}

	const appendMatchPlayPoints = (
		round: RoundRow,
		rows: Array<{
			key: string
			label: string
			memberNames: string[]
			memberIds: string[]
			score: number | null
		}>
	) => {
		const courseData = (round.course_data || {}) as Record<string, any>
		const winnerPoints = Math.max(0, Number(courseData.match_winner_points ?? 0) || 0)
		const tiePoints = Math.max(0, Number(courseData.match_tie_points ?? 0) || 0)
		const placePointsByKey = new Map<string, number>()

		const matchGroups = new Map<string, typeof rows>()
		rows.forEach((row) => {
			const teeTimeId = row.key.split('-group-')[0]
			const existing = matchGroups.get(teeTimeId) || []
			existing.push(row)
			matchGroups.set(teeTimeId, existing)
		})

		matchGroups.forEach((matchRows) => {
			if (matchRows.length < 2) {
				matchRows.forEach((row) => placePointsByKey.set(row.key, 0))
				return
			}

			const [rowA, rowB] = matchRows
			if (rowA.score === null || rowB.score === null) {
				placePointsByKey.set(rowA.key, 0)
				placePointsByKey.set(rowB.key, 0)
				return
			}

			if (rowA.score > rowB.score) {
				placePointsByKey.set(rowA.key, winnerPoints)
				placePointsByKey.set(rowB.key, 0)
			} else if (rowB.score > rowA.score) {
				placePointsByKey.set(rowA.key, 0)
				placePointsByKey.set(rowB.key, winnerPoints)
			} else {
				placePointsByKey.set(rowA.key, tiePoints)
				placePointsByKey.set(rowB.key, tiePoints)
			}
		})

		return rows.map((row) => ({
			...row,
			placePoints: row.score === null ? null : (placePointsByKey.get(row.key) ?? 0),
		}))
	}

	const dailyRoundLeaderboards = [] as Array<{
		roundId: string
		roundDate: string | null
		formatLabel: string
		rows: Array<{
			key: string
			label: string
			memberNames: string[]
			memberIds: string[]
			score: number | null
		}>
	}>

	for (const round of sortedRounds) {
		const { groupSize, rows } = await buildRoundLeaderboardRows(round)
		const isMatchPlayRound = round.mode_key === 'best_ball' && Boolean(round.course_data?.best_ball_matchplay) && groupSize === 2
		const rowsWithPoints = isMatchPlayRound
			? appendMatchPlayPoints(round, rows)
			: appendPlacePoints(round, rows)
		dailyRoundLeaderboards.push({
			roundId: round.id,
			roundDate: round.date || null,
			formatLabel: getRoundFormatLabel(round, groupSize),
			rows: rowsWithPoints,
		})
	}

	const overallPoints = new Map<string, number>()
	const overallContributions = new Map<string, OverallContribution[]>()
	overallEntries.forEach((entry) => {
		overallPoints.set(entry.key, 0)
		overallContributions.set(entry.key, [])
	})

	const recordOverallContribution = (
		targetKeys: Set<string>,
		round: RoundRow,
		formatLabel: string,
		groupLabel: string,
		memberNames: string[],
		points: number,
		note?: string
	) => {
		if (points <= 0) return
		targetKeys.forEach((key) => {
			const existing = overallContributions.get(key) || []
			existing.push({
				roundId: round.id,
				roundDate: round.date || null,
				formatLabel,
				groupLabel,
				memberNames,
				points,
				note,
			})
			overallContributions.set(key, existing)
		})
	}

	for (const round of sortedRounds) {
		const teamCount = overallEntries.length
		if (teamCount === 0) continue

		const courseData = (round.course_data || {}) as Record<string, any>
		const groupSize = round.mode_key === 'stableford'
			? 2
			: normalizeLeaderboardGroupSize(
				Number(courseData.leaderboard_group_size) || getDefaultLeaderboardGroupSize(round.mode_key)
			)
		const formatLabel = getRoundFormatLabel(round, groupSize)
		const roundEntries = await buildPairingEntries(round.id, groupSize)

		if (round.mode_key === 'best_ball' && Boolean(courseData.best_ball_matchplay) && groupSize === 2) {
			const matchRows = buildBestBallMatchPlayRows(round, roundEntries)
			const matchGroups = new Map<string, typeof matchRows>()
			matchRows.forEach((row) => {
				const teeTimeId = row.key.split('-group-')[0]
				const rows = matchGroups.get(teeTimeId) || []
				rows.push(row)
				matchGroups.set(teeTimeId, rows)
			})

			const winnerPoints = Math.max(0, Number(courseData.match_winner_points ?? 0) || 0)
			const tiePoints = Math.max(0, Number(courseData.match_tie_points ?? 0) || 0)

			matchGroups.forEach((rows) => {
				if (rows.length < 2) return
				const [rowA, rowB] = rows
				if (rowA.score === null || rowB.score === null) return

				const targetsA = new Set(rowA.memberIds.map((memberId) => userIdToOverallEntryKey.get(memberId)).filter(Boolean) as string[])
				const targetsB = new Set(rowB.memberIds.map((memberId) => userIdToOverallEntryKey.get(memberId)).filter(Boolean) as string[])

				if (rowA.score > rowB.score) {
					targetsA.forEach((key) => overallPoints.set(key, (overallPoints.get(key) || 0) + winnerPoints))
					recordOverallContribution(targetsA, round, formatLabel, rowA.label, rowA.memberNames, winnerPoints, `Win vs ${rowB.label}`)
				} else if (rowB.score > rowA.score) {
					targetsB.forEach((key) => overallPoints.set(key, (overallPoints.get(key) || 0) + winnerPoints))
					recordOverallContribution(targetsB, round, formatLabel, rowB.label, rowB.memberNames, winnerPoints, `Win vs ${rowA.label}`)
				} else {
					targetsA.forEach((key) => overallPoints.set(key, (overallPoints.get(key) || 0) + tiePoints))
					targetsB.forEach((key) => overallPoints.set(key, (overallPoints.get(key) || 0) + tiePoints))
					recordOverallContribution(targetsA, round, formatLabel, rowA.label, rowA.memberNames, tiePoints, `Halved vs ${rowB.label}`)
					recordOverallContribution(targetsB, round, formatLabel, rowB.label, rowB.memberNames, tiePoints, `Halved vs ${rowA.label}`)
				}
			})
			continue
		}

		const roundRows = round.mode_key === 'stableford'
			? buildStableford666Rows(round, roundEntries)
			: round.mode_key === 'best_ball'
				? buildBestBallStrokeRows(round, roundEntries)
				: round.mode_key === 'scramble'
					? buildScrambleStrokeRows(round.id, roundEntries)
					: buildRoundStandings(round.id)

		const standings = roundRows.filter((row) => row.score !== null)
		const positionPoints = (courseData.position_points || {}) as Record<string, number>
		const hasConfiguredPoints = Object.keys(positionPoints).length > 0

		let rank = 0
		let previousScore: number | null = null
		standings.forEach((row, index) => {
			if (row.score !== previousScore) {
				rank = index + 1
				previousScore = row.score
			}
			const tripPts = hasConfiguredPoints
				? (positionPoints[String(rank)] ?? 0)
				: (teamCount - rank + 1)
			const targetKeys = new Set(
				row.memberIds
					.map((memberId) => userIdToOverallEntryKey.get(memberId))
					.filter(Boolean) as string[]
			)
			targetKeys.forEach((key) => overallPoints.set(key, (overallPoints.get(key) || 0) + tripPts))
			recordOverallContribution(targetKeys, round, formatLabel, row.label, row.memberNames, tripPts, `Finished #${rank}`)
		})
	}

	const overallContributionRows = Object.fromEntries(
		Array.from(overallContributions.entries()).map(([key, items]) => [
			key,
			items.sort((a, b) => {
				const aDate = a.roundDate || ''
				const bDate = b.roundDate || ''
				if (aDate !== bDate) return aDate.localeCompare(bDate)
				if (a.points !== b.points) return b.points - a.points
				return a.groupLabel.localeCompare(b.groupLabel)
			}),
		])
	)

	const overallLeaderboard = overallEntries
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
					<div className="flex items-center gap-3">
						<p className="text-club-gold text-sm font-bold uppercase tracking-wider">{event?.location}</p>
					</div>
				</div>
				<div className="absolute top-0 right-0 opacity-10 transform translate-x-10 -translate-y-10">
					<Trophy size={150} />
				</div>
			</div>

			<div className="p-6 space-y-6 -mt-4 relative z-20">

				{/* 1. ANNOUNCEMENTS */}
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
								<Link
									key={item.id}
									href={`/events/${id}/announcements`}
									className="block bg-white p-4 rounded-lg shadow-sm border border-gray-100 hover:border-club-gold/40 transition-colors"
								>
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
					<Link
						href={`/events/${id}/scorecard`}
						className="bg-white text-club-navy p-4 rounded-xl border-2 border-club-green/40 ring-1 ring-club-green/20 shadow-lg hover:-translate-y-0.5 hover:shadow-xl hover:border-club-green/70 active:translate-y-0 active:scale-[0.99] transition flex flex-col items-center justify-center gap-2 h-32"
					>
						<Edit size={32} className="text-club-green drop-shadow-sm" />
						<span className="font-bold text-sm">Enter Scores</span>
					</Link>

					{(isCaptain || isOrganizer) && (
						<Link
							href={`/events/${id}/scorecard?scope=team`}
							className="bg-white text-club-navy p-4 rounded-xl border-2 border-club-gold/60 ring-1 ring-club-gold/20 shadow-lg hover:-translate-y-0.5 hover:shadow-xl hover:border-club-gold active:translate-y-0 active:scale-[0.99] transition flex flex-col items-center justify-center gap-2 h-32"
						>
							<Edit size={28} className="text-club-gold drop-shadow-sm" />
							<span className="font-bold text-xs uppercase tracking-wider">Manage Team Scores</span>
						</Link>
					)}

					<Link
						href={`/events/${id}/tee-times`}
						className="bg-white text-club-navy p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-2 h-32 active:bg-gray-50 transition"
					>
						<Calendar size={28} className="text-club-gold" />
						<span className="font-bold text-xs uppercase tracking-wider">Tee Times</span>
					</Link>

					<Link
						href={`/events/${id}/teams`}
						className="bg-white text-club-navy p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-2 h-32 active:bg-gray-50 transition"
					>
						<Users size={28} className="text-club-gold" />
						<span className="font-bold text-xs uppercase tracking-wider">Teams</span>
					</Link>

					<Link
						href={`/events/${id}/challenges`}
						className="bg-white text-club-navy p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-2 h-32 active:bg-gray-50 transition"
					>
						<Swords size={28} className="text-club-gold" />
						<span className="font-bold text-xs uppercase tracking-wider">Challenges</span>
					</Link>

					<Link
						href={`/events/${id}/scoring`}
						className="bg-white text-club-navy p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-2 h-32 active:bg-gray-50 transition"
					>
						<BarChart3 size={28} className="text-club-gold" />
						<span className="font-bold text-xs uppercase tracking-wider">Scoring</span>
					</Link>

					{isOrganizer && (
						<Link
							href={`/events/${id}/polls`}
							className="bg-white text-club-navy p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-2 h-32 active:bg-gray-50 transition"
						>
							<Vote size={28} className="text-club-gold" />
							<span className="font-bold text-xs uppercase tracking-wider">Polls</span>
						</Link>
					)}

					<TrashTalk
						eventId={id}
						currentUser={currentUser}
						variant="tile"
						icon={<MessageCircle size={28} className="text-club-gold" />}
					/>
				</div>

				{/* 4. ORGANIZER TOOLS */}
				{isOrganizer && (
					<details className="group mt-8 pt-8 border-t border-club-navy/10" open>
						<summary className="mb-4 list-none cursor-pointer select-none">
							<div className="flex items-center justify-between">
								<h3 className="text-xs font-bold uppercase text-gray-400 tracking-widest">Organizer Tools</h3>
								<div className="flex items-center gap-2">
									<span className="text-[10px] font-bold uppercase tracking-wider text-club-navy/60">Hide/Show</span>
									<span className="relative inline-flex h-6 w-11 items-center rounded-full bg-club-navy/25 transition group-open:bg-club-green">
										<span className="inline-block h-5 w-5 transform rounded-full bg-white transition translate-x-1 group-open:translate-x-5" />
									</span>
								</div>
							</div>
						</summary>

						<div className="flex items-center justify-between mb-4">
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
                                                                <EmailSummaryButton eventId={id} roundId={currentRound?.id || ''} />
                                                                <CustomEmailButton eventId={id} />
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
							<Link href={`/events/${id}/scoring`} className="bg-gray-200 p-3 rounded text-center">
								<BarChart3 className="mx-auto mb-1 text-gray-600" size={20} />
								<span className="text-[10px] font-bold text-gray-600">Scoring</span>
							</Link>
							<Link href={`/events/${id}/polls`} className="bg-gray-200 p-3 rounded text-center">
								<Vote className="mx-auto mb-1 text-gray-600" size={20} />
								<span className="text-[10px] font-bold text-gray-600">Polls</span>
							</Link>
						</div>
					</details>
				)}

				{/* 4. LEADERBOARD (collapsible, at bottom) */}
				<CollapsibleLeaderboard
					eventId={id}
					dailyRounds={dailyRoundLeaderboards}
					overallRows={overallLeaderboard}
					overallContributions={overallContributionRows}
					currentRoundId={currentRound?.id ?? null}
				/>

			</div>
		</main>
	)
}
