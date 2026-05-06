// app/events/[id]/modes/page.tsx
import { createClient } from '@/utils/supabase/server'
import { GAME_MODES, GameModeKey, getDefaultLeaderboardGroupSize, normalizeLeaderboardGroupSize } from '@/lib/game_modes'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import ModeCard from './ModeCard'

// Helper to generate list of dates between start and end
function getDatesInRange(startDate: string, endDate: string) {
  // Append 'T00:00:00' to prevent timezone shifts (e.g., showing the day before)
  const date = new Date(startDate + 'T00:00:00') 
  const end = new Date(endDate + 'T00:00:00')
  const dates = []

  while (date <= end) {
    dates.push(new Date(date).toISOString().split('T')[0])
    date.setDate(date.getDate() + 1)
  }
  return dates
}

export default async function GameModesPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { id } = await params // Next.js 15 requirement

  // 1. Fetch Event Info
  const { data: event } = await supabase.from('events').select('*').eq('id', id).single()
  
  // 2. Fetch Existing Rounds
  const { data: rounds } = await supabase.from('rounds').select('*').eq('event_id', id)

  // 3. Generate the timeline
  const tripDates = getDatesInRange(event.start_date, event.end_date)

  return (
    <main className="min-h-screen bg-club-cream text-club-navy p-6 pb-20">
      
      {/* Header */}
      <div className="max-w-md mx-auto mb-8 flex items-center gap-4">
        <Link href={`/events/${id}/dashboard`} className="bg-white text-club-navy p-2 rounded-sm border border-club-navy/10 shadow-sm">
          <ChevronLeft size={20} />
        </Link>
        <div>
          <h1 className="font-serif text-2xl text-club-navy">Game Modes</h1>
          <p className="text-xs text-club-text/60">Assign a format for each day</p>
        </div>
      </div>

      <div className="max-w-md mx-auto space-y-8">
        
        {tripDates.map((date, index) => {
          // Find if we already saved a mode for this date
          const savedRound = rounds?.find((r: any) => r.date === date)
          const currentModeKey = savedRound?.mode_key as GameModeKey
          const currentBestBallMatchplay = Boolean(savedRound?.course_data?.best_ball_matchplay)
          const currentLeaderboardGroupSize = currentModeKey === 'stableford'
            ? 2
            : normalizeLeaderboardGroupSize(
                Number(savedRound?.course_data?.leaderboard_group_size) || getDefaultLeaderboardGroupSize(currentModeKey)
              )

          return (
            <ModeCard
              key={date}
              eventId={id}
              date={date}
              index={index}
              currentModeKey={currentModeKey}
              currentLeaderboardGroupSize={currentLeaderboardGroupSize}
              currentBestBallMatchplay={currentBestBallMatchplay}
            />
          )
        })}

      </div>
    </main>
  )
}