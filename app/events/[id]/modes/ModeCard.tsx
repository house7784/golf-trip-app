'use client'

import { useState } from 'react'
import { GAME_MODES, type GameModeKey } from '@/lib/game_modes'
import { updateRoundMode } from './actions'

type Props = {
  eventId: string
  date: string
  index: number
  currentModeKey?: GameModeKey | null
  currentLeaderboardGroupSize: number
  currentBestBallMatchplay: boolean
}

export default function ModeCard({
  eventId,
  date,
  index,
  currentModeKey,
  currentLeaderboardGroupSize,
  currentBestBallMatchplay,
}: Props) {
  const [selectedMode, setSelectedMode] = useState(currentModeKey || '')

  const modeInfo = selectedMode ? GAME_MODES[selectedMode as GameModeKey] : null
  const showBestBallMatchplay = selectedMode === 'best_ball'
  const isStableford666 = selectedMode === 'stableford'

  return (
    <div className="bg-club-paper p-6 rounded-sm shadow-md border-t-4 border-club-navy relative">
      <div className="flex items-center gap-2 mb-4">
        <div className="bg-club-gold text-club-navy font-bold text-xs px-2 py-1 rounded uppercase tracking-wider">
          Round {index + 1}
        </div>
        <h2 className="font-serif text-xl">
          {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
        </h2>
      </div>

      {modeInfo && (
        <div className="mb-4 bg-white/50 p-3 rounded border border-club-navy/10">
          <div className="flex items-center gap-2 mb-1 text-club-navy">
            {modeInfo.icon && <modeInfo.icon size={16} />}
            <span className="font-bold text-sm">{modeInfo.name}</span>
          </div>
          <p className="text-xs text-club-text/70 italic leading-relaxed">
            "{modeInfo.description}"
          </p>
        </div>
      )}

      <form
        action={async (formData) => {
          await updateRoundMode(
            eventId,
            date,
            formData.get('mode') as string,
            formData.get('leaderboardGroupSize') as string,
            formData.get('bestBallMatchplay') as string | null
          )
        }}
      >
        <select
          name="mode"
          defaultValue={currentModeKey || ''}
          onChange={(event) => setSelectedMode(event.target.value)}
          className="w-full bg-white border border-club-gold/40 p-3 rounded-sm font-serif text-club-navy mb-2"
        >
          <option value="" disabled>-- Select Format --</option>
          {Object.entries(GAME_MODES).map(([key, info]) => (
            <option key={key} value={key}>{info.name}</option>
          ))}
        </select>

        {isStableford666 ? (
          <div className="mb-3 rounded-sm border border-club-navy/10 bg-white px-3 py-3 text-sm text-club-navy">
            <input type="hidden" name="leaderboardGroupSize" value="2" />
            <span className="block font-bold uppercase tracking-wider text-xs">Current Day Leaderboard</span>
            <span className="block mt-1">2-Person Teams</span>
          </div>
        ) : (
          <select
            name="leaderboardGroupSize"
            defaultValue={String(currentLeaderboardGroupSize)}
            className="w-full bg-white border border-club-gold/40 p-3 rounded-sm font-serif text-club-navy mb-3"
          >
            <option value="1">Current Day Leaderboard: Individual</option>
            <option value="2">Current Day Leaderboard: 2-Person Teams</option>
            <option value="4">Current Day Leaderboard: 4-Person Teams</option>
          </select>
        )}

        {showBestBallMatchplay && (
          <label className="mb-4 flex items-start gap-3 rounded-sm border border-club-navy/10 bg-white px-3 py-3 text-sm text-club-navy">
            <input
              type="checkbox"
              name="bestBallMatchplay"
              defaultChecked={currentBestBallMatchplay}
              className="mt-1 h-4 w-4 rounded border-club-gold/40 text-club-navy"
            />
            <span>
              <span className="block font-bold uppercase tracking-wider text-xs">Best Ball Match Play</span>
              <span className="block text-xs text-club-text/70 mt-1">
                When enabled, 2-person pairings earn 1 point for a won hole, 0.5 each for ties, and 0 for a loss.
              </span>
            </span>
          </label>
        )}

        <button className="w-full bg-club-navy text-white py-2 rounded-sm text-xs font-bold uppercase tracking-widest hover:bg-opacity-90">
          Save Format
        </button>
      </form>
    </div>
  )
}