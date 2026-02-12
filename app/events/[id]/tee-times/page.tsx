import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Clock, Trash2, Plus, Lock, Unlock, Edit, Calendar, MapPin, User, ArrowLeft } from 'lucide-react'
import CourseSetup from './CourseSetup'
import SlotAssignment from './SlotAssignment'
import { createTeeTime, deleteTeeTime, toggleRoundLock } from './actions'

// Helper to format dates nicely (e.g., "Fri, May 16")
const formatDate = (dateStr: string) => {
  if (!dateStr) return 'TBD'
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  })
}

export default async function TeeTimesPage({ 
  params, 
  searchParams 
}: { 
  params: Promise<{ id: string }>,
  searchParams: Promise<{ roundId?: string }> 
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { id } = await params
  
  const queryParams = await searchParams
  const selectedRoundId = queryParams?.roundId

  if (!user) redirect('/login')

  // 1. Fetch Event with ALL Rounds
  const { data: event } = await supabase
    .from('events')
    .select(`
      *, 
      rounds (
        *, 
        tee_times (
          *, 
          pairings (
            *, 
            profiles (*)
          )
        )
      )
    `)
    .eq('id', id)
    .single()

  if (!event) return <div>Event not found</div>

  const isOrganizer = event.created_by === user.id

  // 2. Sort Rounds
  const rounds = event.rounds?.sort((a: any, b: any) => a.date.localeCompare(b.date)) || []
  
  // 3. Determine Active Round
  const activeRound = selectedRoundId 
    ? rounds.find((r: any) => r.id === selectedRoundId) 
    : rounds[0]

  if (!activeRound) return <div className="p-8 text-center text-gray-500">No rounds setup for this event yet.</div>

  // 4. Fetch Players (including full_name)
  const { data: players } = await supabase
    .from('event_players')
    .select('profiles(id, email, handicap, full_name)')
    .eq('event_id', id)

  // 5. Logic for Active Round
  const teeTimes = activeRound.tee_times || []
  const sortedTimes = teeTimes.sort((a: any, b: any) => a.time.localeCompare(b.time))
  const firstTeeTime = sortedTimes.length > 0 ? sortedTimes[0].time : null

  // Calculate WHO IS PLAYING
  const assignedPlayerIds = new Set()
  teeTimes.forEach((tt: any) => {
    tt.pairings.forEach((p: any) => {
      if (p.player_id) assignedPlayerIds.add(p.player_id)
    })
  })

  // Check Scoring Status
  let isStarted = false
  if (firstTeeTime) {
      const roundDateStr = activeRound.date 
      const firstTeeDateTime = new Date(`${roundDateStr}T${firstTeeTime}`)
      const now = new Date()
      firstTeeDateTime.setMinutes(firstTeeDateTime.getMinutes() - 30)
      isStarted = now >= firstTeeDateTime
  }

  const isLockedByOrganizer = activeRound.scoring_locked
  const isScoreEntryAllowed = isStarted && !isLockedByOrganizer
  const canEnterScores = isScoreEntryAllowed || isOrganizer

  return (
    <div className="space-y-6">
      
      {/* HEADER WITH TABS */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        
        {/* Back to Dashboard Link */}
        <div className="bg-gray-50/50 px-6 py-3 border-b border-gray-100 flex items-center">
            <Link 
                href={`/events/${id}/dashboard`} 
                className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-club-gold transition-colors"
            >
                <ArrowLeft size={12} /> Back to Dashboard
            </Link>
        </div>

        {/* Main Title Area */}
        <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="font-serif text-3xl text-club-navy font-bold">{event.name}</h1>
            <div className="flex items-center gap-2 mt-1 text-gray-400 text-sm">
               <Calendar size={14} /> 
               <span>{rounds.length} Rounds Scheduled</span>
            </div>
          </div>
        </div>

        {/* Round Tabs */}
        <div className="flex overflow-x-auto bg-gray-50/50 border-b border-gray-100">
          {rounds.map((round: any) => {
            const isActive = round.id === activeRound.id
            return (
              <Link 
                key={round.id} 
                href={`/events/${id}/tee-times?roundId=${round.id}`}
                className={`
                  flex-shrink-0 px-6 py-4 text-sm font-bold uppercase tracking-wider border-b-2 transition-colors hover:bg-gray-50
                  ${isActive 
                    ? 'border-club-gold text-club-navy bg-white' 
                    : 'border-transparent text-gray-400 hover:text-gray-600'
                  }
                `}
              >
                {formatDate(round.date)}
              </Link>
            )
          })}
        </div>

        {/* Active Round Details Bar */}
        <div className="px-6 py-4 bg-gray-50 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2 text-club-navy font-bold">
                <MapPin size={16} className="text-club-gold" />
                {activeRound.course_name || 'Course Not Set'}
            </div>

            <div className="flex gap-3 items-center">
                {isOrganizer && (
                    <>
                        <CourseSetup 
                            eventId={id} 
                            roundId={activeRound.id} 
                            initialData={activeRound.course_data} 
                            initialName={activeRound.course_name} 
                        />
                        
                        <form action={async () => {
                            'use server'
                            await toggleRoundLock(activeRound.id, !isLockedByOrganizer)
                        }}>
                            <input type="hidden" name="roundId" value={activeRound.id} />
                            <button className={`
                                flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all
                                ${isLockedByOrganizer ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-green-100 text-green-600 hover:bg-green-200'}
                            `}>
                                {isLockedByOrganizer ? <Lock size={14} /> : <Unlock size={14} />}
                                {isLockedByOrganizer ? 'Locked' : 'Open'}
                            </button>
                        </form>
                    </>
                )}
            </div>
        </div>
      </div>

      {/* ACTION BAR */}
      <div className="bg-club-navy p-6 rounded-xl text-white flex flex-col md:flex-row justify-between items-center gap-4 shadow-lg">
        <div>
            <h2 className="font-serif text-xl font-bold text-club-gold">
                Ready to play on {formatDate(activeRound.date)}?
            </h2>
            <p className="text-white/60 text-sm">
                {!isStarted 
                    ? `Scoring opens 30 mins before first tee time (${firstTeeTime || 'TBD'})` 
                    : 'Enter your scores hole-by-hole.'}
            </p>
        </div>
        
        {canEnterScores ? (
             <Link 
                href={`/events/${id}/scorecard?roundId=${activeRound.id}`}
                className="bg-club-gold text-club-navy px-8 py-3 rounded-lg font-bold uppercase tracking-widest hover:bg-white hover:text-club-navy transition shadow-md flex items-center gap-2"
             >
                <Edit size={18} /> Enter Scores
             </Link>
        ) : (
            <button disabled className="bg-white/10 text-white/40 px-8 py-3 rounded-lg font-bold uppercase tracking-widest cursor-not-allowed flex items-center gap-2">
                {isLockedByOrganizer ? <Lock size={18} /> : <Clock size={18} />}
                {isLockedByOrganizer ? 'Scoring Locked' : 'Wait for Tee Off'}
            </button>
        )}
      </div>

      {/* TEE SHEET GRID */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {sortedTimes.map((tt: any) => (
          <div key={tt.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
            
            {/* TIME HEADER */}
            <div className="bg-gray-50 p-4 border-b border-gray-100 flex justify-between items-center">
              <div className="flex items-center gap-2 text-club-navy font-bold font-serif text-xl">
                <Clock size={18} className="text-club-gold" />
                {tt.time}
              </div>
              {isOrganizer && (
                <form action={deleteTeeTime}>
                    <input type="hidden" name="teeTimeId" value={tt.id} />
                    <button className="text-gray-300 hover:text-red-500 transition-colors p-1"><Trash2 size={16} /></button>
                </form>
              )}
            </div>

            {/* PLAYER LIST */}
            <div className="p-4 flex-1 space-y-2">
              {[0, 1, 2, 3].map((slotIndex) => {
                const pairing = tt.pairings.find((p: any) => p.slot_number === slotIndex + 1)
                const player = pairing?.profiles

                return (
                  <div key={slotIndex} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 border border-transparent hover:border-club-gold/30 transition-colors group relative">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${player ? 'bg-club-navy text-white' : 'bg-gray-200 text-gray-400'}`}>
                        {player 
                            ? (player.full_name ? player.full_name[0].toUpperCase() : player.email[0].toUpperCase()) 
                            : <User size={14} />
                        }
                      </div>
                      <div className="flex flex-col">
                        <span className={`text-sm font-bold ${player ? 'text-gray-900' : 'text-gray-400'}`}>
                          {player 
                            ? (player.full_name || player.email.split('@')[0]) 
                            : 'Open Slot'
                          }
                        </span>
                        {player && <span className="text-[10px] text-club-gold font-bold uppercase tracking-wider">HCP {player.handicap}</span>}
                      </div>
                    </div>

                    {isOrganizer && (
                      <SlotAssignment
                        teeTimeId={tt.id}
                        slotIndex={slotIndex}
                        player={player}
                        players={players || []}
                        takenIds={Array.from(assignedPlayerIds) as string[]}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {/* ADD TIME CARD */}
        {isOrganizer && (
            <div className="bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center p-8 text-gray-400 hover:border-club-gold hover:text-club-gold transition cursor-pointer group">
                <form action={createTeeTime} className="flex flex-col items-center w-full">
                    <input type="hidden" name="roundId" value={activeRound.id} />
                    <input type="time" name="time" required className="bg-transparent text-2xl font-bold text-center mb-2 outline-none text-club-navy placeholder-gray-300 group-hover:placeholder-club-gold/50" />
                    <button className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
                        <Plus size={16} /> Add Tee Time
                    </button>
                </form>
            </div>
        )}
      </div>
    </div>
  )
}