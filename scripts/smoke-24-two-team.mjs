import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
dotenv.config()

function requiredEnv(name) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing environment variable: ${name}`)
  return value
}

function isoDateOffset(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function buildHoles() {
  const pars = [4, 4, 3, 5, 4, 3, 4, 5, 4, 4, 3, 5, 4, 4, 3, 5, 4, 4]
  return pars.map((par, idx) => ({ number: idx + 1, par, hcp: idx + 1 }))
}

function chunk(list, size) {
  const result = []
  for (let i = 0; i < list.length; i += size) {
    result.push(list.slice(i, i + size))
  }
  return result
}

function teeTimeLabel(index) {
  const baseMinutes = 8 * 60
  const minutes = baseMinutes + index * 10
  const hh = String(Math.floor(minutes / 60)).padStart(2, '0')
  const mm = String(minutes % 60).padStart(2, '0')
  return `${hh}:${mm}:00`
}

function makeScrambleHoleScores(holes, groupIndex) {
  const scores = {}
  for (const hole of holes) {
    scores[String(hole.number)] = Math.max(1, hole.par + ((hole.number + groupIndex) % 2 === 0 ? 0 : 1))
  }
  return scores
}

function makeBestBallPlayerScores(holes, playerIndex) {
  const scores = {}
  for (const hole of holes) {
    const wave = (hole.number + playerIndex) % 4
    const delta = wave === 0 ? -1 : wave === 1 ? 0 : 1
    scores[String(hole.number)] = Math.max(1, hole.par + delta)
  }
  return scores
}

function makeStablefordPayload(pairUserIds, holes, delta) {
  const [u1, u2] = pairUserIds
  const holesData = {}
  const payload = { _stableford666: { holes: holesData } }

  for (const hole of holes) {
    if (hole.number <= 12) {
      const teamScore = Math.max(1, hole.par - 1 + ((hole.number + delta) % 2))
      holesData[String(hole.number)] = {
        teamScore,
        beers: hole.number % 6 === 0 ? 1 : 0,
        cocktails: hole.number % 9 === 0 ? 1 : 0,
        shots: hole.number === 12 ? 1 : 0,
        fairwayHit: hole.par >= 4,
        gir: hole.number % 2 === 0,
        onePutt: hole.number % 3 === 0,
        chipIn: hole.number === 4,
      }
      payload[String(hole.number)] = teamScore
    } else {
      const p1 = Math.max(1, hole.par + ((hole.number + delta) % 2) - 1)
      const p2 = Math.max(1, hole.par + (((hole.number + delta + 1) % 2) - 1))
      holesData[String(hole.number)] = {
        playerScores: {
          [u1]: p1,
          [u2]: p2,
        },
        beers: hole.number === 18 ? 1 : 0,
        cocktails: hole.number === 17 ? 1 : 0,
        shots: hole.number === 15 ? 1 : 0,
        fairwayHit: hole.par >= 4,
        gir: true,
        onePutt: hole.number % 2 === 1,
        chipIn: hole.number === 16,
      }
      payload[String(hole.number)] = Math.min(p1, p2)
    }
  }

  return payload
}

function stablefordFinishingPoints(scoreToPar, holeInOne) {
  if (holeInOne) return 32
  if (scoreToPar <= -3) return 16
  if (scoreToPar === -2) return 8
  if (scoreToPar === -1) return 4
  if (scoreToPar === 0) return 2
  return 0
}

function calculateStablefordPayloadPoints(payload, holes) {
  const data = payload?._stableford666?.holes || {}
  let total = 0

  for (const hole of holes) {
    const holeData = data[String(hole.number)] || {}
    let scoringValue = null
    let holeInOne = false

    if (hole.number <= 12) {
      const teamScore = Number(holeData.teamScore)
      if (Number.isFinite(teamScore)) {
        scoringValue = teamScore
        holeInOne = teamScore === 1
      }
    } else {
      const playerScores = holeData.playerScores || {}
      for (const value of Object.values(playerScores)) {
        const score = Number(value)
        if (!Number.isFinite(score)) continue
        if (scoringValue === null || score < scoringValue) scoringValue = score
        if (score === 1) holeInOne = true
      }
    }

    const finishing = scoringValue === null ? 0 : stablefordFinishingPoints(scoringValue - hole.par, holeInOne)
    const hitting = (holeData.fairwayHit ? 1 : 0) + (holeData.gir ? 1 : 0) + (holeData.onePutt ? 1 : 0) + (holeData.chipIn ? 4 : 0)
    const drinks = (Number(holeData.beers) || 0) * 2 + (Number(holeData.cocktails) || 0) * 3 + (Number(holeData.shots) || 0) * 4

    total += finishing + hitting + drinks
  }

  return total
}

function rankWithPlacePoints(rows, positionPoints, higherIsBetter = false) {
  const sorted = [...rows].sort((a, b) => {
    if (a.score === null && b.score === null) return a.key.localeCompare(b.key)
    if (a.score === null) return 1
    if (b.score === null) return -1
    if (a.score !== b.score) return higherIsBetter ? b.score - a.score : a.score - b.score
    return a.key.localeCompare(b.key)
  })

  let rank = 0
  let prevScore = null
  return sorted.map((row, index) => {
    if (row.score !== prevScore) {
      rank = index + 1
      prevScore = row.score
    }
    const placePoints = row.score === null ? null : Number(positionPoints[String(rank)] ?? 0)
    return { ...row, rank, placePoints }
  })
}

function sumNumericHoleScores(holeScores) {
  let sum = 0
  for (const value of Object.values(holeScores || {})) {
    const n = Number(value)
    if (Number.isFinite(n)) sum += n
  }
  return sum
}

function calculateBestBallPairTotal(pairUserIds, scoreRows, holes) {
  const byUser = new Map(scoreRows.map((r) => [r.user_id, r.hole_scores || {}]))
  let total = 0
  for (const hole of holes) {
    let best = null
    for (const userId of pairUserIds) {
      const score = Number(byUser.get(userId)?.[String(hole.number)] ?? byUser.get(userId)?.[hole.number])
      if (!Number.isFinite(score)) continue
      if (best === null || score < best) best = score
    }
    if (best !== null) total += best
  }
  return total
}

async function main() {
  const keepData = process.argv.includes('--keep')
  const organizerUserIdArg =
    process.argv.find((arg) => arg.startsWith('--organizer-user-id='))?.split('=')[1] ||
    process.env.SMOKE_ORGANIZER_USER_ID ||
    null
  const organizerEmailArg =
    process.argv.find((arg) => arg.startsWith('--organizer-email='))?.split('=')[1] ||
    process.env.SMOKE_ORGANIZER_EMAIL ||
    null

  const url = requiredEnv('NEXT_PUBLIC_SUPABASE_URL')
  const serviceRole = requiredEnv('SUPABASE_SERVICE_ROLE_KEY')
  const supabase = createClient(url, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const runId = Date.now().toString(36)
  const holes = buildHoles()
  const positionPoints = {
    '1': 20,
    '2': 16,
    '3': 14,
    '4': 12,
    '5': 10,
    '6': 9,
    '7': 8,
    '8': 7,
    '9': 6,
    '10': 5,
    '11': 3,
    '12': 0,
  }

  const createdUserIds = []
  const createdProfileIds = []
  const createdRoundIds = []
  const createdTeeTimeIds = []
  const createdTeamIds = []
  let eventId = null

  async function createDummyUser(label, handicapIndex) {
    const email = `smoke24+${runId}-${label}@example.com`
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password: 'SmokePass123!',
      email_confirm: true,
      user_metadata: { full_name: `Smoke24 ${label}` },
    })
    if (error) throw new Error(`Failed to create auth user ${label}: ${error.message}`)

    const userId = data.user?.id
    if (!userId) throw new Error(`No user id returned for ${label}`)
    createdUserIds.push(userId)

    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        full_name: `Smoke24 ${label}`,
        email,
        handicap_index: handicapIndex,
      })

    if (profileError) throw new Error(`Failed to upsert profile ${label}: ${profileError.message}`)
    createdProfileIds.push(userId)

    return { userId, email, name: `Smoke24 ${label}` }
  }

  async function resolveExternalOrganizerId() {
    if (organizerUserIdArg) return organizerUserIdArg
    if (!organizerEmailArg) return null

    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', organizerEmailArg)
      .maybeSingle()

    if (error) throw new Error(`Failed to resolve organizer by email: ${error.message}`)
    return data?.id || null
  }

  try {
    const players = []
    for (let i = 0; i < 24; i++) {
      const label = i === 0 ? 'Organizer' : `Player${String(i + 1).padStart(2, '0')}`
      const handicapIndex = Math.min(24, 4 + i)
      players.push(await createDummyUser(label, handicapIndex))
    }

    const externalOrganizerId = await resolveExternalOrganizerId()
    const organizerId = externalOrganizerId || players[0].userId

    const { data: event, error: eventError } = await supabase
      .from('events')
      .insert({
        name: `Smoke 24P 2T Event ${runId}`,
        start_date: isoDateOffset(0),
        end_date: isoDateOffset(2),
        created_by: organizerId,
      })
      .select('id')
      .single()

    if (eventError) throw new Error(`Failed to create event: ${eventError.message}`)
    eventId = event.id

    const { data: teams, error: teamError } = await supabase
      .from('teams')
      .insert([
        { event_id: eventId, name: 'Smoke Team A', captain_id: players[0].userId },
        { event_id: eventId, name: 'Smoke Team B', captain_id: players[12].userId },
      ])
      .select('id, name')

    if (teamError) throw new Error(`Failed to create teams: ${teamError.message}`)
    if (!teams || teams.length !== 2) throw new Error('Expected exactly 2 teams to be created')

    createdTeamIds.push(...teams.map((t) => t.id))
    const teamAId = teams[0].id
    const teamBId = teams[1].id

    const participants = players.map((player, index) => ({
      event_id: eventId,
      user_id: player.userId,
      role: index === 0 ? 'organizer' : 'player',
      team_id: index < 12 ? teamAId : teamBId,
      event_handicap: Math.min(24, 4 + index),
    }))

    if (externalOrganizerId && !participants.some((row) => row.user_id === externalOrganizerId)) {
      participants.push({
        event_id: eventId,
        user_id: externalOrganizerId,
        role: 'organizer',
        team_id: teamAId,
        event_handicap: 0,
      })
    }

    const { error: participantError } = await supabase
      .from('event_participants')
      .insert(participants)
    if (participantError) throw new Error(`Failed to create participants: ${participantError.message}`)

    const roundRows = [
      {
        event_id: eventId,
        date: isoDateOffset(0),
        mode_key: 'best_ball',
        course_name: 'Smoke 24 Course Best Ball',
        course_data: { holes, leaderboard_group_size: 2, position_points: positionPoints },
      },
      {
        event_id: eventId,
        date: isoDateOffset(1),
        mode_key: 'stableford',
        course_name: 'Smoke 24 Course 666',
        course_data: { holes, leaderboard_group_size: 2, position_points: positionPoints },
      },
      {
        event_id: eventId,
        date: isoDateOffset(2),
        mode_key: 'scramble',
        course_name: 'Smoke 24 Course Scramble',
        course_data: { holes, leaderboard_group_size: 2, position_points: positionPoints },
      },
    ]

    const { data: rounds, error: roundsError } = await supabase
      .from('rounds')
      .insert(roundRows)
      .select('id, mode_key')

    if (roundsError) throw new Error(`Failed to create rounds: ${roundsError.message}`)
    createdRoundIds.push(...rounds.map((r) => r.id))

    const playersByFoursome = chunk(players, 4)
    const roundGroups = new Map()

    for (const round of rounds) {
      const groupRows = []
      for (let groupIndex = 0; groupIndex < playersByFoursome.length; groupIndex++) {
        const { data: teeTime, error: teeError } = await supabase
          .from('tee_times')
          .insert({ round_id: round.id, time: teeTimeLabel(groupIndex) })
          .select('id')
          .single()

        if (teeError) throw new Error(`Failed to create tee time for ${round.mode_key}: ${teeError.message}`)
        createdTeeTimeIds.push(teeTime.id)

        const groupPlayers = playersByFoursome[groupIndex]
        groupRows.push({ teeTimeId: teeTime.id, players: groupPlayers })

        const pairings = groupPlayers.map((player, idx) => ({
          tee_time_id: teeTime.id,
          slot_number: idx + 1,
          player_id: player.userId,
        }))

        const { error: pairingError } = await supabase.from('pairings').insert(pairings)
        if (pairingError) throw new Error(`Failed to create pairings for ${round.mode_key}: ${pairingError.message}`)
      }
      roundGroups.set(round.id, groupRows)
    }

    const bestBallRound = rounds.find((r) => r.mode_key === 'best_ball')
    const stablefordRound = rounds.find((r) => r.mode_key === 'stableford')
    const scrambleRound = rounds.find((r) => r.mode_key === 'scramble')
    if (!bestBallRound || !stablefordRound || !scrambleRound) {
      throw new Error('Missing one or more required rounds (best_ball, stableford, scramble)')
    }

    const bestBallRows = players.map((player, idx) => ({
      round_id: bestBallRound.id,
      user_id: player.userId,
      hole_scores: makeBestBallPlayerScores(holes, idx),
    }))
    const { error: bestBallInsertError } = await supabase.from('scores').insert(bestBallRows)
    if (bestBallInsertError) throw new Error(`Failed to insert best ball scores: ${bestBallInsertError.message}`)

    const stablefordRows = []
    const stablefordPairs = []
    ;(roundGroups.get(stablefordRound.id) || []).forEach((group, groupIndex) => {
      const firstPair = [group.players[0].userId, group.players[1].userId]
      const secondPair = [group.players[2].userId, group.players[3].userId]
      stablefordPairs.push(firstPair, secondPair)

      const firstPayload = makeStablefordPayload(firstPair, holes, groupIndex * 2)
      const secondPayload = makeStablefordPayload(secondPair, holes, groupIndex * 2 + 1)

      stablefordRows.push(
        { round_id: stablefordRound.id, user_id: firstPair[0], hole_scores: firstPayload },
        { round_id: stablefordRound.id, user_id: firstPair[1], hole_scores: firstPayload },
        { round_id: stablefordRound.id, user_id: secondPair[0], hole_scores: secondPayload },
        { round_id: stablefordRound.id, user_id: secondPair[1], hole_scores: secondPayload }
      )
    })

    const { error: stablefordInsertError } = await supabase.from('scores').insert(stablefordRows)
    if (stablefordInsertError) throw new Error(`Failed to insert 666 scores: ${stablefordInsertError.message}`)

    const scrambleRows = []
    ;(roundGroups.get(scrambleRound.id) || []).forEach((group, groupIndex) => {
      const sharedScores = makeScrambleHoleScores(holes, groupIndex)
      group.players.forEach((player) => {
        scrambleRows.push({
          round_id: scrambleRound.id,
          user_id: player.userId,
          hole_scores: sharedScores,
        })
      })
    })

    const { error: scrambleInsertError } = await supabase.from('scores').insert(scrambleRows)
    if (scrambleInsertError) throw new Error(`Failed to insert scramble scores: ${scrambleInsertError.message}`)

    const { data: participantCheck, error: participantCheckError } = await supabase
      .from('event_participants')
      .select('user_id, team_id')
      .eq('event_id', eventId)

    if (participantCheckError) throw new Error(`Failed to verify participants: ${participantCheckError.message}`)

    const createdPlayerIds = new Set(players.map((p) => p.userId))
    const createdPlayersInParticipants = (participantCheck || []).filter((row) => createdPlayerIds.has(row.user_id))
    if (createdPlayersInParticipants.length !== 24) {
      throw new Error(`Expected 24 created players in participants, found ${createdPlayersInParticipants.length}`)
    }

    const teamCounts = createdPlayersInParticipants.reduce((acc, row) => {
      const key = row.team_id || 'none'
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {})

    if ((teamCounts[teamAId] || 0) !== 12 || (teamCounts[teamBId] || 0) !== 12) {
      throw new Error(`Expected 12/12 team split, got ${teamCounts[teamAId] || 0}/${teamCounts[teamBId] || 0}`)
    }

    const { data: scoreRows, error: scoreVerifyError } = await supabase
      .from('scores')
      .select('round_id, user_id, hole_scores')
      .in('round_id', [bestBallRound.id, stablefordRound.id, scrambleRound.id])

    if (scoreVerifyError) throw new Error(`Failed to verify scores: ${scoreVerifyError.message}`)

    const bestBallRowsFromDb = scoreRows.filter((row) => row.round_id === bestBallRound.id)
    const stablefordRowsFromDb = scoreRows.filter((row) => row.round_id === stablefordRound.id)
    const scrambleRowsFromDb = scoreRows.filter((row) => row.round_id === scrambleRound.id)

    if (bestBallRowsFromDb.length !== 24) throw new Error(`Expected 24 best ball rows, got ${bestBallRowsFromDb.length}`)
    if (stablefordRowsFromDb.length !== 24) throw new Error(`Expected 24 666 rows, got ${stablefordRowsFromDb.length}`)
    if (scrambleRowsFromDb.length !== 24) throw new Error(`Expected 24 scramble rows, got ${scrambleRowsFromDb.length}`)

    for (const group of roundGroups.get(scrambleRound.id) || []) {
      const totals = group.players.map((player) => {
        const row = scrambleRowsFromDb.find((r) => r.user_id === player.userId)
        return sumNumericHoleScores(row?.hole_scores)
      })
      if (!totals.every((value) => value === totals[0])) {
        throw new Error('Scramble totals mismatch inside a foursome')
      }
    }

    const bestBallPairs = []
    ;(roundGroups.get(bestBallRound.id) || []).forEach((group) => {
      bestBallPairs.push([group.players[0].userId, group.players[1].userId])
      bestBallPairs.push([group.players[2].userId, group.players[3].userId])
    })

    const bestBallPairTotals = bestBallPairs.map((pairIds) => calculateBestBallPairTotal(pairIds, bestBallRowsFromDb, holes))
    if (!bestBallPairTotals.every((value) => Number.isFinite(value) && value > 0)) {
      throw new Error('Best ball pair totals did not compute')
    }

    const stablefordPayloadCount = stablefordRowsFromDb.filter(
      (row) => row.hole_scores && row.hole_scores._stableford666 && row.hole_scores._stableford666.holes
    ).length

    if (stablefordPayloadCount !== 24) {
      throw new Error(`Expected 24 valid 666 payload rows, found ${stablefordPayloadCount}`)
    }

    const teamByUserId = new Map()
    players.forEach((player, index) => {
      teamByUserId.set(player.userId, index < 12 ? teamAId : teamBId)
    })

    const teamTotalsFromPairPlacings = new Map([
      [teamAId, 0],
      [teamBId, 0],
    ])

    const firstPlaceContributionByTeam = new Map([
      [teamAId, 0],
      [teamBId, 0],
    ])

    function applyPairPlacings(rankedRows, firstPlaceValue) {
      rankedRows.forEach((row) => {
        if (row.placePoints === null) return
        const uniqueTeamIds = new Set(row.pairUserIds.map((userId) => teamByUserId.get(userId)).filter(Boolean))
        uniqueTeamIds.forEach((teamId) => {
          teamTotalsFromPairPlacings.set(teamId, (teamTotalsFromPairPlacings.get(teamId) || 0) + row.placePoints)
          if (row.rank === 1 && row.placePoints === firstPlaceValue) {
            firstPlaceContributionByTeam.set(teamId, (firstPlaceContributionByTeam.get(teamId) || 0) + row.placePoints)
          }
        })
      })
    }

    const scramblePairs = []
    ;(roundGroups.get(scrambleRound.id) || []).forEach((group, groupIndex) => {
      scramblePairs.push(
        {
          key: `scr-${groupIndex + 1}-a`,
          pairUserIds: [group.players[0].userId, group.players[1].userId],
          score: calculateBestBallPairTotal([group.players[0].userId, group.players[1].userId], scrambleRowsFromDb, holes),
        },
        {
          key: `scr-${groupIndex + 1}-b`,
          pairUserIds: [group.players[2].userId, group.players[3].userId],
          score: calculateBestBallPairTotal([group.players[2].userId, group.players[3].userId], scrambleRowsFromDb, holes),
        }
      )
    })

    const bestBallPairsForRanking = []
    ;(roundGroups.get(bestBallRound.id) || []).forEach((group, groupIndex) => {
      bestBallPairsForRanking.push(
        {
          key: `bb-${groupIndex + 1}-a`,
          pairUserIds: [group.players[0].userId, group.players[1].userId],
          score: calculateBestBallPairTotal([group.players[0].userId, group.players[1].userId], bestBallRowsFromDb, holes),
        },
        {
          key: `bb-${groupIndex + 1}-b`,
          pairUserIds: [group.players[2].userId, group.players[3].userId],
          score: calculateBestBallPairTotal([group.players[2].userId, group.players[3].userId], bestBallRowsFromDb, holes),
        }
      )
    })

    const stablefordPairsForRanking = []
    ;(roundGroups.get(stablefordRound.id) || []).forEach((group, groupIndex) => {
      const pairs = [
        [group.players[0].userId, group.players[1].userId],
        [group.players[2].userId, group.players[3].userId],
      ]

      pairs.forEach((pair, pairIndex) => {
        const payload = stablefordRowsFromDb.find((row) => row.user_id === pair[0])?.hole_scores
        stablefordPairsForRanking.push({
          key: `sf-${groupIndex + 1}-${pairIndex + 1}`,
          pairUserIds: pair,
          score: payload ? calculateStablefordPayloadPoints(payload, holes) : null,
        })
      })
    })

    const bestBallPlacings = rankWithPlacePoints(bestBallPairsForRanking, positionPoints, false)
    const stablefordPlacings = rankWithPlacePoints(stablefordPairsForRanking, positionPoints, true)
    const scramblePlacings = rankWithPlacePoints(scramblePairs, positionPoints, false)

    applyPairPlacings(bestBallPlacings, Number(positionPoints['1']))
    applyPairPlacings(stablefordPlacings, Number(positionPoints['1']))
    applyPairPlacings(scramblePlacings, Number(positionPoints['1']))

    const firstPlaceTotalApplied = (firstPlaceContributionByTeam.get(teamAId) || 0) + (firstPlaceContributionByTeam.get(teamBId) || 0)
    if (firstPlaceTotalApplied < Number(positionPoints['1'])) {
      throw new Error('Expected first-place pair points to be applied into team totals')
    }

    if ((teamTotalsFromPairPlacings.get(teamAId) || 0) <= 0 || (teamTotalsFromPairPlacings.get(teamBId) || 0) <= 0) {
      throw new Error('Expected both teams to receive points from pair placings')
    }

    console.log('Smoke 24-player two-team suite passed')
    console.log(`Event ID: ${eventId}`)
    console.log('Players seeded: 24')
    console.log('Teams seeded: 2 (12 players each)')
    console.log('Rounds seeded: best_ball, stableford(666), scramble')
    console.log(`Foursomes per round: ${playersByFoursome.length}`)
    console.log(`Best ball pair totals (sample): ${bestBallPairTotals.slice(0, 6).join(', ')}`)
    console.log(`666 payload rows validated: ${stablefordPayloadCount}`)
    console.log(`Team points from pair placings: TeamA=${teamTotalsFromPairPlacings.get(teamAId) || 0}, TeamB=${teamTotalsFromPairPlacings.get(teamBId) || 0}`)
    console.log(`First-place points applied to teams: ${firstPlaceTotalApplied}`)
    console.log(`Login password for all smoke users: SmokePass123!`)
    console.log(`Organizer login: ${players[0].email}`)
    if (organizerUserIdArg || organizerEmailArg) {
      console.log(`External organizer included: ${organizerUserIdArg || organizerEmailArg}`)
    }
    console.log(keepData ? 'Keeping seeded data (--keep enabled).' : 'Seeded data will be cleaned up.')
  } finally {
    if (!keepData) {
      if (createdTeeTimeIds.length > 0) {
        await supabase.from('pairings').delete().in('tee_time_id', createdTeeTimeIds)
        await supabase.from('tee_times').delete().in('id', createdTeeTimeIds)
      }

      if (createdRoundIds.length > 0) {
        await supabase.from('scores').delete().in('round_id', createdRoundIds)
        await supabase.from('rounds').delete().in('id', createdRoundIds)
      }

      if (eventId) {
        await supabase.from('event_participants').delete().eq('event_id', eventId)
        await supabase.from('teams').delete().eq('event_id', eventId)
        await supabase.from('events').delete().eq('id', eventId)
      }

      if (createdProfileIds.length > 0) {
        await supabase.from('profiles').delete().in('id', createdProfileIds)
      }

      for (const userId of createdUserIds) {
        await supabase.auth.admin.deleteUser(userId)
      }
    }
  }
}

main().catch((error) => {
  console.error('Smoke suite failed:', error.message)
  process.exit(1)
})
