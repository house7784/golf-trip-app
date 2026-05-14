export type HandicapApplicationMode = 'standard' | 'par3_one_then_next_hardest'

export type CourseHole = {
  number: number
  par: number
  hcp: number
}

export function buildDefaultCourseHoles(holeCount: number) {
  return Array.from({ length: holeCount }).map((_, index) => ({
    number: index + 1,
    par: 4,
    hcp: index + 1,
  }))
}

export function normalizeHandicapForHoleCount(handicap: number, holeCount: number) {
  const safeHandicap = Math.max(0, Number(handicap || 0))
  return holeCount <= 9 ? safeHandicap / 2 : safeHandicap
}

export function clampHandicap(value: number | null | undefined, cap: number | null | undefined) {
  const base = Math.max(0, Number(value || 0))
  if (cap === null || cap === undefined || Number.isNaN(Number(cap))) return base
  return Math.min(base, Math.max(0, Number(cap)))
}

function sortedByHcp(holes: CourseHole[]) {
  return [...holes].sort((a, b) => a.hcp - b.hcp)
}

export function allocateStrokesByHole(
  holes: CourseHole[],
  handicap: number,
  mode: HandicapApplicationMode
) {
  const normalizedHandicap = normalizeHandicapForHoleCount(handicap, holes.length)
  const strokes = Math.max(0, Math.floor(normalizedHandicap))
  const allocation = new Map<number, number>()
  holes.forEach((hole) => allocation.set(hole.number, 0))

  if (strokes === 0 || holes.length === 0) return allocation

  const byHcp = sortedByHcp(holes)
  let remaining = strokes
  while (remaining > 0) {
    let allocatedInPass = false

    for (const hole of byHcp) {
      const current = allocation.get(hole.number) || 0
      const exceedsPar3Limit = mode === 'par3_one_then_next_hardest' && hole.par === 3 && current >= 1

      if (exceedsPar3Limit) continue

      allocation.set(hole.number, current + 1)
      remaining -= 1
      allocatedInPass = true

      if (remaining <= 0) break
    }

    if (!allocatedInPass) break
  }

  return allocation
}

export function floorNetHoleScore(gross: number, allocatedStrokes: number) {
  return Math.max(1, gross - Math.max(0, Number(allocatedStrokes || 0)))
}

export function calculateNetTotal(
  holeScores: Record<string, number> | null | undefined,
  holes: CourseHole[] | null | undefined,
  handicap: number,
  mode: HandicapApplicationMode
) {
  if (!holeScores) return 0
  const entries = Object.entries(holeScores)
  if (!holes || holes.length === 0) {
    return entries.reduce((sum, [, score]) => sum + (Number(score) || 0), 0)
  }

  const allocation = allocateStrokesByHole(holes, handicap, mode)

  return entries.reduce((sum, [holeKey, score]) => {
    const gross = Number(score)
    if (!Number.isFinite(gross)) return sum
    const holeNumber = Number(holeKey)
    const stroke = allocation.get(holeNumber) || 0
    return sum + floorNetHoleScore(gross, stroke)
  }, 0)
}
