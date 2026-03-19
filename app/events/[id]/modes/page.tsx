// app/events/[id]/modes/page.tsx
import { createClient } from '@/utils/supabase/server'
import { GAME_MODES, GameModeKey } from '@/lib/game_modes'
import { updateRoundMode } from './actions'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

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
          const modeInfo = currentModeKey ? GAME_MODES[currentModeKey] : null

          return (
            <div key={date} className="bg-club-paper p-6 rounded-sm shadow-md border-t-4 border-club-navy relative">
              
              {/* Date Header */}
              <div className="flex items-center gap-2 mb-4">
                <div className="bg-club-gold text-club-navy font-bold text-xs px-2 py-1 rounded uppercase tracking-wider">
                  Round {index + 1}
                </div>
                <h2 className="font-serif text-xl">
                  {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                </h2>
              </div>

              {/* Description Box (If selected) */}
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

              {/* Selection Form */}
              <form action={async (formData) => {
                'use server'
                await updateRoundMode(id, date, formData.get('mode') as string)
              }}>
                <select 
                  name="mode" 
                  // In a real app we'd auto-submit with JS, but the save button is safer for now
                  defaultValue={currentModeKey || ""}
                  className="w-full bg-white border border-club-gold/40 p-3 rounded-sm font-serif text-club-navy mb-2"
                >
                  <option value="" disabled>-- Select Format --</option>
                  {Object.entries(GAME_MODES).map(([key, info]) => (
                    <option key={key} value={key}>{info.name}</option>
                  ))}
                </select>
                
                <button className="w-full bg-club-navy text-white py-2 rounded-sm text-xs font-bold uppercase tracking-widest hover:bg-opacity-90">
                  Save Format
                </button>
              </form>

            </div>
          )
        })}

      </div>
    </main>
  )
}