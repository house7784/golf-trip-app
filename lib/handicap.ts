export type HandicapApplicationMode = 'standard' | 'par3_one_then_next_hardest'

export type CourseHole = {
  number: number
  par: number
  hcp: number
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
  const strokes = Math.max(0, Math.floor(handicap))
  const allocation = new Map<number, number>()
  holes.forEach((hole) => allocation.set(hole.number, 0))

  if (strokes === 0 || holes.length === 0) return allocation

  if (mode === 'par3_one_then_next_hardest') {
    let remaining = strokes
    const par3 = sortedByHcp(holes.filter((hole) => hole.par === 3))

    for (const hole of par3) {
      if (remaining <= 0) break
      allocation.set(hole.number, (allocation.get(hole.number) || 0) + 1)
      remaining -= 1
    }

    const nonPar3 = sortedByHcp(holes.filter((hole) => hole.par !== 3))
    let idx = 0
    while (remaining > 0 && nonPar3.length > 0) {
      const hole = nonPar3[idx % nonPar3.length]
      allocation.set(hole.number, (allocation.get(hole.number) || 0) + 1)
      remaining -= 1
      idx += 1
    }

    return allocation
  }

  const byHcp = sortedByHcp(holes)
  let remaining = strokes
  let idx = 0
  while (remaining > 0) {
    const hole = byHcp[idx % byHcp.length]
    allocation.set(hole.number, (allocation.get(hole.number) || 0) + 1)
    remaining -= 1
    idx += 1
  }

  return allocation
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
    const gross = Number(score) || 0
    const holeNumber = Number(holeKey)
    const stroke = allocation.get(holeNumber) || 0
    return sum + (gross - stroke)
  }, 0)
}
