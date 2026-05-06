import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
dotenv.config()

function requiredEnv(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`)
  }
  return value
}

function isoDateOffset(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function buildHoles() {
  const pars = [4, 4, 3, 5, 4, 3, 4, 5, 4, 4, 3, 5, 4, 4, 3, 5, 4, 4]
  return pars.map((par, idx) => ({
    number: idx + 1,
    par,
    hcp: idx + 1,
  }))
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

    const finishing = scoringValue === null
      ? 0
      : stablefordFinishingPoints(scoringValue - hole.par, holeInOne)
    const hitting = (holeData.fairwayHit ? 1 : 0) + (holeData.gir ? 1 : 0) + (holeData.onePutt ? 1 : 0) + (holeData.chipIn ? 4 : 0)
    const drinks = (Number(holeData.beers) || 0) * 2 + (Number(holeData.cocktails) || 0) * 3 + (Number(holeData.shots) || 0) * 4

    total += finishing + hitting + drinks
  }

  return total
}

function makeStablefordPayload(pairUserIds, holes, delta) {
  const [u1, u2] = pairUserIds
  const holesData = {}
  const payload = { _stableford666: { holes: holesData } }

  const customTeamScenarios = {
    1: { teamScore: 3, beers: 1, cocktails: 0, shots: 0, fairwayHit: true, gir: true, onePutt: true, chipIn: false },
    2: { teamScore: 2, beers: 0, cocktails: 1, shots: 0, fairwayHit: true, gir: true, onePutt: false, chipIn: false },
    3: { teamScore: 1, beers: 0, cocktails: 0, shots: 1, fairwayHit: false, gir: true, onePutt: true, chipIn: false },
    4: { teamScore: 4, beers: 1, cocktails: 1, shots: 0, fairwayHit: true, gir: false, onePutt: false, chipIn: true },
    5: { teamScore: 2, beers: 1, cocktails: 0, shots: 1, fairwayHit: true, gir: true, onePutt: false, chipIn: false },
    6: { teamScore: 3, beers: 0, cocktails: 1, shots: 1, fairwayHit: true, gir: false, onePutt: true, chipIn: false },
    7: { teamScore: 4, beers: 1, cocktails: 1, shots: 1, fairwayHit: true, gir: true, onePutt: true, chipIn: true },
    8: { teamScore: 3, beers: 0, cocktails: 0, shots: 0, fairwayHit: false, gir: false, onePutt: false, chipIn: false },
    9: { teamScore: 4, beers: 1, cocktails: 0, shots: 0, fairwayHit: true, gir: true, onePutt: false, chipIn: false },
    10: { teamScore: 3, beers: 0, cocktails: 1, shots: 0, fairwayHit: true, gir: true, onePutt: true, chipIn: false },
    11: { teamScore: 4, beers: 0, cocktails: 0, shots: 1, fairwayHit: true, gir: false, onePutt: false, chipIn: false },
    12: { teamScore: 3, beers: 1, cocktails: 1, shots: 1, fairwayHit: true, gir: true, onePutt: true, chipIn: false },
  }

  const customBestBallScenarios = {
    13: { p1: 3, p2: 3, beers: 1, cocktails: 0, shots: 0, fairwayHit: true, gir: true, onePutt: true, chipIn: false },
    14: { p1: 2, p2: 4, beers: 0, cocktails: 1, shots: 0, fairwayHit: true, gir: true, onePutt: false, chipIn: false },
    15: { p1: 1, p2: 1, beers: 0, cocktails: 0, shots: 1, fairwayHit: false, gir: true, onePutt: true, chipIn: false },
    16: { p1: 4, p2: 3, beers: 1, cocktails: 0, shots: 0, fairwayHit: true, gir: true, onePutt: true, chipIn: false },
    17: { p1: 2, p2: 3, beers: 0, cocktails: 1, shots: 0, fairwayHit: true, gir: true, onePutt: false, chipIn: true },
    18: { p1: 3, p2: 2, beers: 1, cocktails: 1, shots: 1, fairwayHit: true, gir: true, onePutt: true, chipIn: false },
  }

  for (const hole of holes) {
    if (hole.number <= 12) {
      const teamScenario = customTeamScenarios[hole.number]
      const fallbackTeamScore = Math.max(1, hole.par - 1 + ((hole.number + delta) % 2))
      const teamScore = teamScenario?.teamScore ?? fallbackTeamScore
      holesData[String(hole.number)] = {
        teamScore,
        beers: teamScenario?.beers ?? (hole.number % 6 === 0 ? 1 : 0),
        cocktails: teamScenario?.cocktails ?? (hole.number % 9 === 0 ? 1 : 0),
        shots: teamScenario?.shots ?? 0,
        fairwayHit: teamScenario?.fairwayHit ?? (hole.par >= 4),
        gir: teamScenario?.gir ?? (hole.number % 2 === 0),
        onePutt: teamScenario?.onePutt ?? (hole.number % 3 === 0),
        chipIn: teamScenario?.chipIn ?? false,
      }
      payload[String(hole.number)] = teamScore
    } else {
      const bestBallScenario = customBestBallScenarios[hole.number]
      const p1 = bestBallScenario?.p1 ?? Math.max(1, hole.par + ((hole.number + delta) % 2) - 1)
      const p2 = bestBallScenario?.p2 ?? Math.max(1, hole.par + (((hole.number + delta + 1) % 2) - 1))
      holesData[String(hole.number)] = {
        playerScores: {
          [u1]: p1,
          [u2]: p2,
        },
        beers: bestBallScenario?.beers ?? 0,
        cocktails: bestBallScenario?.cocktails ?? 0,
        shots: bestBallScenario?.shots ?? (hole.number === 18 ? 1 : 0),
        fairwayHit: bestBallScenario?.fairwayHit ?? (hole.par >= 4),
        gir: bestBallScenario?.gir ?? true,
        onePutt: bestBallScenario?.onePutt ?? (hole.number % 2 === 1),
        chipIn: bestBallScenario?.chipIn ?? (hole.number === 17),
      }
      payload[String(hole.number)] = Math.min(p1, p2)
    }
  }

  return payload
}

function inspectStablefordPayload(payload, holes) {
  const data = payload?._stableford666?.holes || {}
  const holesByNumber = new Map(holes.map((h) => [h.number, h]))

  const counts = {
    beerHoles: 0,
    cocktailHoles: 0,
    shotHoles: 0,
    doubleAceBestBallHoles: 0,
    bothBirdieBestBallHoles: 0,
    fairwayAndEagleHoles: 0,
  }

  for (const [holeKey, holeData] of Object.entries(data)) {
    const holeNumber = Number(holeKey)
    const hole = holesByNumber.get(holeNumber)
    if (!hole) continue

    if ((Number(holeData.beers) || 0) > 0) counts.beerHoles += 1
    if ((Number(holeData.cocktails) || 0) > 0) counts.cocktailHoles += 1
    if ((Number(holeData.shots) || 0) > 0) counts.shotHoles += 1

    const playerScores = holeData.playerScores || {}
    const numericScores = Object.values(playerScores)
      .map((v) => Number(v))
      .filter((v) => Number.isFinite(v))

    if (numericScores.length >= 2 && numericScores.every((s) => s === 1)) {
      counts.doubleAceBestBallHoles += 1
    }

    if (numericScores.length >= 2 && numericScores.every((s) => s === hole.par - 1)) {
      counts.bothBirdieBestBallHoles += 1
    }

    const bestScore = numericScores.length > 0 ? Math.min(...numericScores) : null
    if (holeData.fairwayHit && bestScore !== null && bestScore <= hole.par - 2) {
      counts.fairwayAndEagleHoles += 1
    }
  }

  return counts
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

function teeTimeLabel(index) {
  const baseMinutes = 8 * 60
  const minutes = baseMinutes + index * 10
  const hh = String(Math.floor(minutes / 60)).padStart(2, '0')
  const mm = String(minutes % 60).padStart(2, '0')
  return `${hh}:${mm}:00`
}

function chunk(list, size) {
  const result = []
  for (let i = 0; i < list.length; i += size) {
    result.push(list.slice(i, i + size))
  }
  return result
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

  const createdUserIds = []
  const createdProfileIds = []
  const createdRoundIds = []
  const createdTeeTimeIds = []
  const insertedChallengeIds = []
  let insertedChatCount = 0
  let eventId = null

  async function createDummyUser(label, handicapIndex) {
    const email = `smoke+${runId}-${label}@example.com`
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password: 'SmokePass123!'
      ,email_confirm: true,
      user_metadata: { full_name: `Smoke ${label}` },
    })
    if (error) throw new Error(`Failed to create auth user ${label}: ${error.message}`)

    const userId = data.user?.id
    if (!userId) throw new Error(`No user id returned for ${label}`)

    createdUserIds.push(userId)

    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        full_name: `Smoke ${label}`,
        email,
        handicap_index: handicapIndex,
      })

    if (profileError) throw new Error(`Failed to upsert profile ${label}: ${profileError.message}`)

    createdProfileIds.push(userId)

    return { userId, email, name: `Smoke ${label}` }
  }

  async function resolveExternalOrganizerId() {
    if (organizerUserIdArg) {
      return organizerUserIdArg
    }

    if (organizerEmailArg) {
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', organizerEmailArg)
        .maybeSingle()

      if (error) throw new Error(`Failed to resolve organizer by email: ${error.message}`)
      return data?.id || null
    }

    return null
  }

  try {
    const players = []
    for (let i = 0; i < 16; i++) {
      const label = i === 0 ? 'Organizer' : `Player${String(i + 1).padStart(2, '0')}`
      const handicapIndex = Math.min(24, 4 + i)
      players.push(await createDummyUser(label, handicapIndex))
    }

    const externalOrganizerId = await resolveExternalOrganizerId()
    const organizerId = externalOrganizerId || players[0].userId

    const { data: event, error: eventError } = await supabase
      .from('events')
      .insert({
        name: `Smoke Test Event ${runId}`,
        start_date: isoDateOffset(0),
        end_date: isoDateOffset(2),
        created_by: organizerId,
      })
      .select('id')
      .single()

    if (eventError) throw new Error(`Failed to create event: ${eventError.message}`)
    eventId = event.id

    const participants = players.map((player, index) => ({
      event_id: eventId,
      user_id: player.userId,
      role: index === 0 ? 'organizer' : 'player',
      event_handicap: Math.min(24, 4 + index),
    }))

    if (externalOrganizerId && !participants.some((row) => row.user_id === externalOrganizerId)) {
      participants.push({
        event_id: eventId,
        user_id: externalOrganizerId,
        role: 'organizer',
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
        date: isoDateOffset(1),
        mode_key: 'scramble',
        course_name: 'Smoke Course Day 1',
        course_data: { holes, leaderboard_group_size: 4 },
      },
      {
        event_id: eventId,
        date: isoDateOffset(2),
        mode_key: 'best_ball',
        course_name: 'Smoke Course Day 2',
        course_data: { holes, leaderboard_group_size: 2 },
      },
      {
        event_id: eventId,
        date: isoDateOffset(0),
        mode_key: 'stableford',
        course_name: 'Smoke Course Day 3',
        course_data: { holes, leaderboard_group_size: 2 },
      },
    ]

    const { data: rounds, error: roundsError } = await supabase
      .from('rounds')
      .insert(roundRows)
      .select('id, mode_key, date')

    if (roundsError) throw new Error(`Failed to create rounds: ${roundsError.message}`)
    rounds.forEach((r) => createdRoundIds.push(r.id))

    const playerGroups = chunk(players, 4)
    const roundGroups = new Map()

    for (const round of rounds) {
      const teeTimeGroupRows = []
      for (let groupIndex = 0; groupIndex < playerGroups.length; groupIndex++) {
        const { data: teeTime, error: teeError } = await supabase
          .from('tee_times')
          .insert({ round_id: round.id, time: teeTimeLabel(groupIndex) })
          .select('id')
          .single()

        if (teeError) throw new Error(`Failed to create tee time for ${round.mode_key}: ${teeError.message}`)
        createdTeeTimeIds.push(teeTime.id)

        const groupPlayers = playerGroups[groupIndex]
        teeTimeGroupRows.push({ teeTimeId: teeTime.id, players: groupPlayers })

        const pairingRows = groupPlayers.map((player, idx) => ({
          tee_time_id: teeTime.id,
          slot_number: idx + 1,
          player_id: player.userId,
        }))

        const { error: pairingError } = await supabase.from('pairings').insert(pairingRows)
        if (pairingError) throw new Error(`Failed to create pairings for ${round.mode_key}: ${pairingError.message}`)
      }
      roundGroups.set(round.id, teeTimeGroupRows)
    }

    const scrambleRound = rounds.find((r) => r.mode_key === 'scramble')
    const bestBallRound = rounds.find((r) => r.mode_key === 'best_ball')
    const stablefordRound = rounds.find((r) => r.mode_key === 'stableford')

    if (!scrambleRound || !bestBallRound || !stablefordRound) {
      throw new Error('Missing one or more required rounds')
    }

    const scrambleRows = []
    const scrambleGroups = roundGroups.get(scrambleRound.id) || []
    scrambleGroups.forEach((group, groupIndex) => {
      const groupScore = makeScrambleHoleScores(holes, groupIndex)
      group.players.forEach((player) => {
        scrambleRows.push({
          round_id: scrambleRound.id,
          user_id: player.userId,
          hole_scores: groupScore,
        })
      })
    })

    const { error: scrambleInsertError } = await supabase.from('scores').insert(scrambleRows)
    if (scrambleInsertError) throw new Error(`Failed to insert scramble scores: ${scrambleInsertError.message}`)

    const bestBallScoresByUser = new Map()
    players.forEach((player, idx) => {
      bestBallScoresByUser.set(player.userId, makeBestBallPlayerScores(holes, idx))
    })

    const bestBallRows = players.map((p) => ({
      round_id: bestBallRound.id,
      user_id: p.userId,
      hole_scores: bestBallScoresByUser.get(p.userId),
    }))

    const { error: bestBallInsertError } = await supabase.from('scores').insert(bestBallRows)
    if (bestBallInsertError) throw new Error(`Failed to insert best ball scores: ${bestBallInsertError.message}`)

    const stablefordRows = []
    const stablefordPairs = []
    const stablefordGroups = roundGroups.get(stablefordRound.id) || []
    stablefordGroups.forEach((group, groupIndex) => {
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
    if (stablefordInsertError) throw new Error(`Failed to insert stableford scores: ${stablefordInsertError.message}`)

    const challengeRows = [
      {
        event_id: eventId,
        challenger_id: players[0].userId,
        challenged_id: players[1].userId,
        witness_id: players[2].userId,
        description: 'Closest-to-the-pin on all par 3s',
        stakes: 'Buys post-round drinks',
        status: 'pending',
        witness_approved: false,
        loser_completed: false,
      },
      {
        event_id: eventId,
        challenger_id: players[1].userId,
        challenged_id: players[0].userId,
        witness_id: players[3].userId,
        description: 'Most fairways hit in round 3',
        stakes: 'Buys airport beers',
        status: 'pending',
        witness_approved: false,
        loser_completed: false,
      },
      {
        event_id: eventId,
        challenger_id: players[3].userId,
        challenged_id: players[4].userId,
        description: 'Lowest net on back 9',
        stakes: '$20',
        status: 'accepted',
        accepted_at: new Date().toISOString(),
        witness_approved: false,
        loser_completed: false,
      },
      {
        event_id: eventId,
        challenger_id: players[4].userId,
        challenged_id: players[5].userId,
        witness_id: players[6].userId,
        description: 'Lowest total on par 5s only',
        stakes: 'Winner chooses music tonight',
        status: 'accepted',
        accepted_at: new Date().toISOString(),
        witness_approved: false,
        loser_completed: false,
      },
      {
        event_id: eventId,
        challenger_id: players[5].userId,
        challenged_id: players[6].userId,
        witness_id: players[7].userId,
        description: 'Fewest putts in round 1',
        stakes: 'Loser carries winner bag for 3 holes',
        status: 'result_set',
        accepted_at: new Date().toISOString(),
        winner_id: players[5].userId,
        result_set_at: new Date().toISOString(),
        witness_approved: true,
        loser_completed: false,
      },
      {
        event_id: eventId,
        challenger_id: players[6].userId,
        challenged_id: players[7].userId,
        witness_id: players[8].userId,
        description: 'Most net birdies in round 2',
        stakes: '$15',
        status: 'result_set',
        accepted_at: new Date().toISOString(),
        winner_id: players[7].userId,
        result_set_at: new Date().toISOString(),
        witness_approved: false,
        loser_completed: false,
      },
      {
        event_id: eventId,
        challenger_id: players[8].userId,
        challenged_id: players[9].userId,
        description: 'Better gross over holes 13-18',
        stakes: 'Dinner tab',
        status: 'completed',
        accepted_at: new Date().toISOString(),
        winner_id: players[9].userId,
        result_set_at: new Date().toISOString(),
        witness_approved: true,
        loser_completed: true,
        completed_at: new Date().toISOString(),
      },
      {
        event_id: eventId,
        challenger_id: players[9].userId,
        challenged_id: players[10].userId,
        witness_id: players[11].userId,
        description: 'Least putts in final round',
        stakes: 'Loser buys hats in pro shop',
        status: 'completed',
        accepted_at: new Date().toISOString(),
        winner_id: players[10].userId,
        result_set_at: new Date().toISOString(),
        witness_approved: true,
        loser_completed: true,
        completed_at: new Date().toISOString(),
      },
      {
        event_id: eventId,
        challenger_id: players[10].userId,
        challenged_id: players[11].userId,
        description: 'Longest drive on 18',
        stakes: 'One sleeve of Pro V1s',
        status: 'declined',
        witness_approved: false,
        loser_completed: false,
      },
      {
        event_id: eventId,
        challenger_id: players[11].userId,
        challenged_id: players[12].userId,
        witness_id: players[13].userId,
        description: 'Closest to the pin on hole 15',
        stakes: 'Bottle of bourbon',
        status: 'declined',
        witness_approved: false,
        loser_completed: false,
      },
    ]

    const { data: insertedChallenges, error: challengeInsertError } = await supabase
      .from('challenges')
      .insert(challengeRows)
      .select('id')

    if (challengeInsertError) throw new Error(`Failed to insert challenges: ${challengeInsertError.message}`)
    insertedChallengeIds.push(...(insertedChallenges || []).map((row) => row.id))

    const chatRows = []
    for (let i = 0; i < 18; i++) {
      const player = players[i % players.length]
      chatRows.push({
        event_id: eventId,
        user_id: player.userId,
        content: `Smoke chat ${i + 1}: day ${Math.floor(i / 6) + 1} check-in and banter.`,
      })
    }

    const { error: chatInsertError } = await supabase.from('chat_messages').insert(chatRows)
    if (chatInsertError) throw new Error(`Failed to insert chat messages: ${chatInsertError.message}`)
    insertedChatCount = chatRows.length

    const { data: verificationScores, error: verifyError } = await supabase
      .from('scores')
      .select('round_id, user_id, hole_scores')
      .in('round_id', [scrambleRound.id, bestBallRound.id, stablefordRound.id])

    if (verifyError) throw new Error(`Failed to verify scores: ${verifyError.message}`)

    const scrambleRowsFromDb = verificationScores.filter((row) => row.round_id === scrambleRound.id)
    if (scrambleRowsFromDb.length !== players.length) {
      throw new Error(`Expected ${players.length} scramble score rows, got ${scrambleRowsFromDb.length}`)
    }

    for (const group of scrambleGroups) {
      const totals = group.players.map((player) => {
        const row = scrambleRowsFromDb.find((r) => r.user_id === player.userId)
        return sumNumericHoleScores(row?.hole_scores)
      })
      if (!totals.every((value) => value === totals[0])) {
        throw new Error('Scramble group totals are not identical within a foursome')
      }
    }

    const bestBallRowsFromDb = verificationScores.filter((row) => row.round_id === bestBallRound.id)
    const bestBallPairs = []
    const bestBallGroups = roundGroups.get(bestBallRound.id) || []
    bestBallGroups.forEach((group) => {
      bestBallPairs.push([group.players[0].userId, group.players[1].userId])
      bestBallPairs.push([group.players[2].userId, group.players[3].userId])
    })

    const bestBallTotals = bestBallPairs.map((pairIds) => calculateBestBallPairTotal(pairIds, bestBallRowsFromDb, holes))

    if (!bestBallTotals.every((value) => Number.isFinite(value) && value > 0)) {
      throw new Error('Best ball pair totals failed to compute')
    }

    const stablefordRowsFromDb = verificationScores.filter((row) => row.round_id === stablefordRound.id)
    const stablefordPairPoints = []
    const stablefordSummary = {
      beerHoles: 0,
      cocktailHoles: 0,
      shotHoles: 0,
      doubleAceBestBallHoles: 0,
      bothBirdieBestBallHoles: 0,
      fairwayAndEagleHoles: 0,
    }
    stablefordPairs.forEach((pair) => {
      const payload = stablefordRowsFromDb.find((row) => row.user_id === pair[0])?.hole_scores
      if (!payload) {
        throw new Error('Missing stableford payloads in verification data')
      }
      stablefordPairPoints.push(calculateStablefordPayloadPoints(payload, holes))
      const counts = inspectStablefordPayload(payload, holes)
      Object.keys(stablefordSummary).forEach((key) => {
        stablefordSummary[key] += counts[key] || 0
      })
    })

    if (!stablefordPairPoints.every((value) => Number.isFinite(value) && value > 0)) {
      throw new Error('Stableford points did not compute as expected')
    }

    if (stablefordSummary.beerHoles === 0 || stablefordSummary.cocktailHoles === 0 || stablefordSummary.shotHoles === 0) {
      throw new Error('Stableford payload is missing one or more drink types (beer/cocktail/shot)')
    }

    if (stablefordSummary.doubleAceBestBallHoles === 0) {
      throw new Error('Stableford payload missing scenario where both partners make a hole-in-one')
    }

    if (stablefordSummary.bothBirdieBestBallHoles === 0) {
      throw new Error('Stableford payload missing scenario where both partners make birdie')
    }

    if (stablefordSummary.fairwayAndEagleHoles === 0) {
      throw new Error('Stableford payload missing fairway + eagle scenario')
    }

    const challengeStateCounts = challengeRows.reduce((acc, row) => {
      const status = row.status || 'unknown'
      acc[status] = (acc[status] || 0) + 1
      return acc
    }, {})

    ;['pending', 'accepted', 'result_set', 'completed', 'declined'].forEach((status) => {
      if ((challengeStateCounts[status] || 0) < 2) {
        throw new Error(`Expected at least 2 challenges in status '${status}', found ${challengeStateCounts[status] || 0}`)
      }
    })

    const { count: challengeCount, error: challengeVerifyError } = await supabase
      .from('challenges')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId)

    if (challengeVerifyError) throw new Error(`Failed to verify challenges: ${challengeVerifyError.message}`)
    if (challengeCount !== challengeRows.length) {
      throw new Error(`Expected ${challengeRows.length} challenges, found ${challengeCount}`)
    }

    const { count: chatCount, error: chatVerifyError } = await supabase
      .from('chat_messages')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId)

    if (chatVerifyError) throw new Error(`Failed to verify chat messages: ${chatVerifyError.message}`)
    if (chatCount !== insertedChatCount) {
      throw new Error(`Expected ${insertedChatCount} chat messages, found ${chatCount}`)
    }

    console.log('Smoke suite passed')
    console.log(`Event ID: ${eventId}`)
    console.log(`Players seeded: ${players.length}`)
    console.log(`Rounds seeded: ${rounds.length}`)
    console.log(`Scramble groups: ${scrambleGroups.length} foursomes`)
    console.log(`Best Ball pair totals (sample): ${bestBallTotals.slice(0, 4).join(', ')}`)
    console.log(`666 Stableford points (sample): ${stablefordPairPoints.slice(0, 4).join(', ')}`)
    console.log(
      `Smoke summary: challenges[pending=${challengeStateCounts.pending || 0}, accepted=${challengeStateCounts.accepted || 0}, result_set=${challengeStateCounts.result_set || 0}, completed=${challengeStateCounts.completed || 0}, declined=${challengeStateCounts.declined || 0}]`
    )
    console.log(
      `Smoke summary: 666 combos[beerHoles=${stablefordSummary.beerHoles}, cocktailHoles=${stablefordSummary.cocktailHoles}, shotHoles=${stablefordSummary.shotHoles}, bothAce=${stablefordSummary.doubleAceBestBallHoles}, bothBirdie=${stablefordSummary.bothBirdieBestBallHoles}, fairwayPlusEagle=${stablefordSummary.fairwayAndEagleHoles}]`
    )
    console.log(`Challenges seeded: ${challengeRows.length}`)
    console.log(`Trash talk messages seeded: ${insertedChatCount}`)
    console.log(`Login password for all smoke users: SmokePass123!`)
    console.log(`Organizer login: ${players[0].email}`)
    if (organizerUserIdArg || organizerEmailArg) {
      console.log(`External organizer included: ${organizerUserIdArg || organizerEmailArg}`)
    }
    console.log(keepData ? 'Keeping seeded data (--keep enabled).' : 'Seeded data will be cleaned up.')
  } finally {
    if (!keepData) {
      if (eventId) {
        await supabase.from('chat_messages').delete().eq('event_id', eventId)
        await supabase.from('challenges').delete().eq('event_id', eventId)
      }

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
