// app/events/[id]/tee-times/page.tsx
import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import { ChevronLeft, Clock, Trash2, Plus } from 'lucide-react'
import { createTeeTime, deleteTeeTime, assignToPairing, removeFromPairing } from './actions'

export default async function TeeTimesPage({ params, searchParams }: { params: { id: string }, searchParams: { date?: string } }) {
  const supabase = await createClient()
  const { id } = await params
  
  // 1. Fetch Event & Teams
  const { data: teams } = await supabase.from('teams').select('*').eq('event_id', id).order('name')
  
  // 2. Handle Dates (Rounds)
  const { data: rounds } = await supabase.from('rounds').select('*').eq('event_id', id).order('date')
  
  // Default to first round if not selected
  const selectedDate = (await searchParams).date || rounds?.[0]?.date
  const selectedRound = rounds?.find((r: any) => r.date === selectedDate)

  // 3. Fetch Data for Selected Round
  let pairings: any[] = []
  let roundParticipants: any[] = []

  if (selectedRound) {
    // Get Pairings & Members
    const { data: pData } = await supabase
      .from('pairings')
      .select(`
        *,
        pairing_members (
            participant_id
        )
      `)
      .eq('round_id', selectedRound.id)
      .order('tee_time')
    pairings = pData || []

    // Get All Participants (to show unassigned pool)
    const { data: allParts } = await supabase
        .from('event_participants')
        .select('id, team_id, profiles(full_name)')
        .eq('event_id', id)
    roundParticipants = allParts || []
  }

  // 4. Helper: Find which players are already assigned to a pairing THIS ROUND
  const assignedIds = new Set<string>()
  pairings.forEach((p: any) => {
      p.pairing_members.forEach((pm: any) => assignedIds.add(pm.participant_id))
  })

  // 5. Organize Teams (Assuming 2 Teams for now)
  const team1 = teams?.[0]
  const team2 = teams?.[1]

  return (
    <main className="min-h-screen bg-club-cream text-club-navy p-6 pb-20">
      
      {/* Header */}
      <div className="max-w-5xl mx-auto mb-8 flex items-center gap-4">
        <Link href={`/events/${id}/dashboard`} className="bg-white p-2 rounded-sm border border-club-navy/10 shadow-sm">
          <ChevronLeft size={20} />
        </Link>
        <div>
          <h1 className="font-serif text-2xl text-club-navy">Tee Sheet</h1>
          <p className="text-xs text-club-text/60">Manage pairings and times</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* DATE SELECTOR TABS */}
        <div className="flex gap-2 overflow-x-auto pb-2">
            {rounds?.map((r: any) => {
                const isActive = r.date === selectedDate
                return (
                    <Link 
                        key={r.id} 
                        href={`/events/${id}/tee-times?date=${r.date}`}
                        className={`px-4 py-2 rounded-sm text-sm font-bold uppercase tracking-wider whitespace-nowrap border transition-all ${
                            isActive 
                            ? 'bg-club-navy text-white border-club-navy' 
                            : 'bg-white text-club-text border-club-gold/20 hover:border-club-gold'
                        }`}
                    >
                        {new Date(r.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric'})}
                    </Link>
                )
            })}
             {!rounds?.length && (
                <div className="text-sm text-red-500 bg-red-50 p-2 rounded">
                    No rounds found. Please go to "Game Modes" to initialize dates first.
                </div>
            )}
        </div>

        {selectedRound && (
            <>
                {/* 1. ADD TEE TIME FORM */}
                <div className="bg-club-paper p-4 rounded-sm border border-club-gold/20 flex justify-between items-center shadow-sm">
                    <h3 className="font-serif text-lg">Add Tee Time</h3>
                    <form action={async (formData) => {
                        'use server'
                        await createTeeTime(id, selectedRound.id, formData.get('time') as string)
                    }} className="flex gap-2">
                        <input 
                            type="time" 
                            name="time" 
                            required
                            className="bg-white border border-club-gold/40 p-2 rounded-sm text-club-navy text-sm"
                        />
                        <button className="bg-club-navy text-white p-2 rounded-sm hover:bg-opacity-90">
                            <Plus size={20} />
                        </button>
                    </form>
                </div>

                {/* 2. PAIRINGS LIST */}
                <div className="space-y-4">
                    {pairings.map((pairing: any) => {
                        // Filter members in this pairing
                        const members = pairing.pairing_members.map((pm: any) => pm.participant_id)
                        
                        // Count how many from each team are currently in this group
                        const team1Count = roundParticipants.filter(p => members.includes(p.id) && p.team_id === team1?.id).length
                        const team2Count = roundParticipants.filter(p => members.includes(p.id) && p.team_id === team2?.id).length

                        return (
                            <div key={pairing.id} className="bg-white border-l-4 border-club-gold rounded-sm shadow-md overflow-hidden">
                                
                                {/* Time Header */}
                                <div className="bg-gray-50 p-3 border-b border-gray-100 flex justify-between items-center">
                                    <div className="flex items-center gap-2 text-club-navy">
                                        <Clock size={16} />
                                        <span className="font-bold font-serif text-lg">
                                            {new Date(`1970-01-01T${pairing.tee_time}`).toLocaleTimeString([], {hour: 'numeric', minute:'2-digit'})}
                                        </span>
                                    </div>
                                    <form action={async () => {
                                        'use server'
                                        await deleteTeeTime(id, pairing.id)
                                    }}>
                                        <button className="text-gray-300 hover:text-red-500 transition">
                                            <Trash2 size={16} />
                                        </button>
                                    </form>
                                </div>

                                {/* Matchup Grid */}
                                <div className="grid grid-cols-2 divide-x divide-gray-100">
                                    
                                    {/* TEAM 1 SLOTS */}
                                    <div className="p-3">
                                        <p className="text-[10px] uppercase font-bold text-club-text/40 mb-2">{team1?.name || 'Team 1'}</p>
                                        <div className="space-y-2">
                                            {/* Render Existing Players */}
                                            {roundParticipants.filter(p => members.includes(p.id) && p.team_id === team1?.id).map((p: any) => (
                                                <div key={p.id} className="flex justify-between items-center text-sm bg-club-navy/5 p-2 rounded border border-club-navy/10">
                                                    <span>{p.profiles.full_name}</span>
                                                    <form action={async () => {
                                                        'use server'
                                                        await removeFromPairing(id, pairing.id, p.id)
                                                    }}>
                                                        <button className="text-red-300 hover:text-red-500">&times;</button>
                                                    </form>
                                                </div>
                                            ))}
                                            {/* Render Empty Slots (Max 2) */}
                                            {[...Array(Math.max(0, 2 - team1Count))].map((_, i) => (
                                                 <form key={i} action={async (formData) => {
                                                    'use server'
                                                    await assignToPairing(id, pairing.id, formData.get('playerId') as string)
                                                 }} className="flex gap-1">
                                                    <select name="playerId" className="w-full text-xs p-2 bg-white border border-dashed border-gray-300 rounded text-gray-500">
                                                        <option value="">+ Add {team1?.name} Player</option>
                                                        {roundParticipants
                                                            .filter(p => p.team_id === team1?.id && !assignedIds.has(p.id))
                                                            .map((p: any) => (
                                                                <option key={p.id} value={p.id}>{p.profiles.full_name}</option>
                                                            ))
                                                        }
                                                    </select>
                                                    <button className="text-club-navy hover:text-club-gold">
                                                        <Plus size={16} />
                                                    </button>
                                                 </form>
                                            ))}
                                        </div>
                                    </div>

                                    {/* TEAM 2 SLOTS */}
                                    <div className="p-3">
                                        <p className="text-[10px] uppercase font-bold text-club-text/40 mb-2">{team2?.name || 'Team 2'}</p>
                                        <div className="space-y-2">
                                             {/* Render Existing Players */}
                                             {roundParticipants.filter(p => members.includes(p.id) && p.team_id === team2?.id).map((p: any) => (
                                                <div key={p.id} className="flex justify-between items-center text-sm bg-club-navy/5 p-2 rounded border border-club-navy/10">
                                                    <span>{p.profiles.full_name}</span>
                                                    <form action={async () => {
                                                        'use server'
                                                        await removeFromPairing(id, pairing.id, p.id)
                                                    }}>
                                                        <button className="text-red-300 hover:text-red-500">&times;</button>
                                                    </form>
                                                </div>
                                            ))}
                                            {/* Render Empty Slots (Max 2) */}
                                            {[...Array(Math.max(0, 2 - team2Count))].map((_, i) => (
                                                 <form key={i} action={async (formData) => {
                                                    'use server'
                                                    await assignToPairing(id, pairing.id, formData.get('playerId') as string)
                                                 }} className="flex gap-1">
                                                    <select name="playerId" className="w-full text-xs p-2 bg-white border border-dashed border-gray-300 rounded text-gray-500">
                                                        <option value="">+ Add {team2?.name} Player</option>
                                                        {roundParticipants
                                                            .filter(p => p.team_id === team2?.id && !assignedIds.has(p.id))
                                                            .map((p: any) => (
                                                                <option key={p.id} value={p.id}>{p.profiles.full_name}</option>
                                                            ))
                                                        }
                                                    </select>
                                                    <button className="text-club-navy hover:text-club-gold">
                                                        <Plus size={16} />
                                                    </button>
                                                 </form>
                                            ))}
                                        </div>
                                    </div>

                                </div>
                            </div>
                        )
                    })}
                </div>
            </>
        )}
      </div>
    </main>
  )
}