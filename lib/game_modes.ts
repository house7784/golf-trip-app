// lib/game_modes.ts
import { Trophy, Users, Target, Zap, Crown } from 'lucide-react'

export type GameModeKey = 'scramble' | 'best_ball' | 'stableford' | 'bingo_bango_bongo' | 'skins'

export const GAME_MODES = {
  scramble: {
    name: 'Scramble',
    description: 'All players tee off, choose the best shot, and everyone plays their next shot from that spot. Repeat until the ball is holed.',
    icon: Users, // Teamwork focus
    scoringType: 'stroke',
  },
  best_ball: {
    name: 'Best Ball (Four-Ball)',
    description: 'Everyone plays their own ball. The team score for the hole is the lowest single score among the team members.',
    icon: Trophy,
    scoringType: 'stroke',
  },
  stableford: {
    name: 'Stableford',
    description: 'Points are awarded based on your score relative to par (e.g., Par = 2 pts, Birdie = 3 pts). The goal is to get the highest score.',
    icon: Target,
    scoringType: 'points',
  },
  bingo_bango_bongo: {
    name: 'Bingo Bango Bongo',
    description: 'Three points per hole: 1 for first on the green, 1 for closest to the pin (once all are on), 1 for first in the hole.',
    icon: Zap,
    scoringType: 'points',
  },
  skins: {
    name: 'Skins',
    description: 'Each hole is worth a "skin". The lowest score wins the skin. If there is a tie, the skin carries over to the next hole.',
    icon: Crown,
    scoringType: 'skins',
  }
}