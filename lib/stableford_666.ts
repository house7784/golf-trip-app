import { allocateStrokesByHole, floorNetHoleScore, type CourseHole } from '@/lib/handicap'

export type Stableford666HoleData = {
  teamScore?: number | null
  playerScores?: Record<string, number | null>
  beers?: number
  cocktails?: number
  shots?: number
  fairwayHit?: boolean
  gir?: boolean
  onePutt?: boolean
  chipIn?: boolean
}

export type Stableford666Data = {
  holes: Record<string, Stableford666HoleData>
}

export const STABLEFORD_666_STORAGE_KEY = '_stableford666'

function isRecord(value: unknown): value is Record<string, any> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

export function getStableford666Name() {
  return '666 Drinking Stableford'
}

export function getStableford666Segment(holeNumber: number) {
  if (holeNumber <= 6) return 'scramble'
  if (holeNumber <= 12) return 'modified_alt_shot'
  return 'best_ball'
}

export function getStableford666SegmentLabel(holeNumber: number) {
  const segment = getStableford666Segment(holeNumber)
  if (segment === 'scramble') return 'Scramble'
  if (segment === 'modified_alt_shot') return 'Modified Alt Shot'
  return 'Best Ball'
}

export function getStableford666Data(payload: Record<string, any> | null | undefined): Stableford666Data {
  const raw = payload?.[STABLEFORD_666_STORAGE_KEY]
  if (!isRecord(raw) || !isRecord(raw.holes)) {
    return { holes: {} }
  }

  return {
    holes: Object.fromEntries(
      Object.entries(raw.holes).map(([holeKey, holeValue]) => [
        holeKey,
        isRecord(holeValue) ? holeValue : {},
      ])
    ),
  }
}

export function getStableford666ReducedHandicap(handicap: number | null | undefined) {
  return Math.max(0, Number(handicap || 0)) / 3
}

export function getStableford666Allocations(
  holes: CourseHole[],
  handicapByPlayerId: Record<string, number>
) {
  const lastSixHoles = holes.filter((hole) => hole.number >= 13)
  const allocations = new Map<string, Map<number, number>>()

  Object.entries(handicapByPlayerId).forEach(([playerId, handicap]) => {
    allocations.set(
      playerId,
      allocateStrokesByHole(lastSixHoles, getStableford666ReducedHandicap(handicap), 'standard')
    )
  })

  return allocations
}

function getStableford666FinishingPoints(scoreToPar: number | null, holeInOne: boolean) {
  if (holeInOne) return 32
  if (scoreToPar === null) return 0
  if (scoreToPar <= -3) return 16
  if (scoreToPar === -2) return 8
  if (scoreToPar === -1) return 4
  if (scoreToPar === 0) return 2
  return 0
}

export function calculateStableford666HoleSummary(
  hole: CourseHole,
  holeData: Stableford666HoleData,
  handicapByPlayerId: Record<string, number>,
  allHoles: CourseHole[]
) {
  const segment = getStableford666Segment(hole.number)
  const allocations = getStableford666Allocations(allHoles, handicapByPlayerId)

  let scoringValue: number | null = null
  let holeInOne = false

  if (segment === 'best_ball') {
    const playerScores = holeData.playerScores || {}
    Object.entries(playerScores).forEach(([playerId, score]) => {
      const gross = Number(score)
      if (!Number.isFinite(gross)) return
      const allocation = allocations.get(playerId)
      const net = floorNetHoleScore(gross, allocation?.get(hole.number) || 0)
      if (scoringValue === null || net < scoringValue) scoringValue = net
      if (gross === 1) holeInOne = true
    })
  } else {
    const teamScore = Number(holeData.teamScore)
    if (Number.isFinite(teamScore)) {
      scoringValue = teamScore
      holeInOne = teamScore === 1
    }
  }

  const finishingPoints = getStableford666FinishingPoints(
    scoringValue === null ? null : scoringValue - hole.par,
    holeInOne
  )
  const hittingPoints =
    (holeData.fairwayHit ? 1 : 0) +
    (holeData.gir ? 1 : 0) +
    (holeData.onePutt ? 1 : 0) +
    (holeData.chipIn ? 4 : 0)
  const drinksPoints =
    (Number(holeData.beers) || 0) * 2 +
    (Number(holeData.cocktails) || 0) * 3 +
    (Number(holeData.shots) || 0) * 4

  return {
    segment,
    scoringValue,
    finishingPoints,
    hittingPoints,
    drinksPoints,
    totalPoints: finishingPoints + hittingPoints + drinksPoints,
  }
}

export function calculateStableford666TotalPoints(
  payload: Record<string, any> | null | undefined,
  holes: CourseHole[],
  handicapByPlayerId: Record<string, number>
) {
  const data = getStableford666Data(payload)
  return holes.reduce((sum, hole) => {
    const holeData = data.holes[String(hole.number)] || {}
    return sum + calculateStableford666HoleSummary(hole, holeData, handicapByPlayerId, holes).totalPoints
  }, 0)
}

export function buildStableford666Payload(
  data: Stableford666Data,
  holes: CourseHole[],
  handicapByPlayerId: Record<string, number>
) {
  const payload: Record<string, any> = {
    [STABLEFORD_666_STORAGE_KEY]: data,
  }

  holes.forEach((hole) => {
    const holeData = data.holes[String(hole.number)] || {}
    const summary = calculateStableford666HoleSummary(hole, holeData, handicapByPlayerId, holes)
    if (summary.scoringValue !== null) {
      payload[String(hole.number)] = summary.scoringValue
    }
  })

  return payload
}
