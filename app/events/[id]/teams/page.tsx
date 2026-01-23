// app/events/[id]/teams/page.tsx
import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import { ChevronLeft, User, Crown } from 'lucide-react'
import { updateTeamStructure, assignPlayer, setCaptain } from './actions'

export default async function TeamsPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { id } = await params

  // 1. Fetch Event & Teams
  const { data: teams } = await supabase
    .from('teams')
    .select('*')
    .eq('event_id', id)
    .order('name', { ascending: true })

  // 2. Fetch Participants
  const { data: participants } = await supabase
    .from('event_participants')
    .select('*, profiles:user_id(full_name, id)')
    .eq('event_id', id)
    .order('created_at', { ascending: true })

  const teamCount = teams?.length || 0

  // 3. Helper Component: The Player Row
  // We use 'id' from the parent scope inside the server actions below
  const PlayerRow = ({ p, currentTeamId, isCaptain }: { p: any, currentTeamId: string | null, isCaptain: boolean }) => (
    <div className={`p-3 rounded-sm border mb-2 flex flex-col gap-3 ${isCaptain ? 'bg-club-gold/10 border-club-gold' : 'bg-white border-gray-200'}`}>
        
        {/* Top Row: Captain Toggle + Name */}
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
                {/* CAPTAIN TOGGLE BUTTON */}
                {currentTeamId && (
                    <form action={async () => {
                        'use server'
                        // PASS 'id' HERE
                        await setCaptain(currentTeamId, p.profiles.id, id)
                    }}>
                        <button 
                            className={`p-1 rounded transition-all ${isCaptain ? 'text-club-gold hover:bg-club-gold/20' : 'text-gray-200 hover:text-club-gold hover:bg-gray-50'}`}
                            title={isCaptain ? "Current Captain" : "Make Captain"}
                        >
                            <Crown size={20} fill={isCaptain ? "currentColor" : "none"} />
                        </button>
                    </form>
                )}
                
                <span className={`font-serif text-sm ${isCaptain ? 'font-bold text-club-navy' : 'text-club-navy'}`}>
                    {p.profiles?.full_name || 'Unknown'}
                </span>
            </div>
        </div>

        {/* Bottom Row: Move Dropdown + GO Button */}
        <form action={async (formData) => {
            'use server'
            const val = formData.get('teamId') as string
            const newTeam = val === 'unassigned' ? null : val
            // PASS 'id' HERE
            await assignPlayer(p.id, newTeam, id)
        }} className="flex gap-2">
            <select 
                name="teamId" 
                defaultValue={currentTeamId || 'unassigned'} 
                className="flex-1 text-xs p-2 border border-gray-300 rounded bg-white text-club-navy"
            >
                <option value="unassigned">Unassigned</option>
                {teams?.map((t: any) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                ))}
            </select>
            <button className="bg-club-navy text-white text-xs font-bold px-3 py-2 rounded shadow-sm hover:bg-opacity-90">
                GO
            </button>
        </form>
    </div>
  )

  return (
    <main className="min-h-screen bg-club-cream text-club-navy p-6 pb-20">
      
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-8 flex items-center gap-4">
        <Link href={`/events/${id}/dashboard`} className="bg-white p-2 rounded-sm border border-club-navy/10 shadow-sm">
          <ChevronLeft size={20} />
        </Link>
        <div>
          <h1 className="font-serif text-2xl text-club-navy">Team Management</h1>
          <p className="text-xs text-club-text/60">Organize your roster</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* STRUCTURE CONFIG */}
        <div className="bg-club-paper p-6 rounded-sm shadow-md border-t-4 border-club-gold">
            <div className="flex flex-col md:flex-row md:items-end gap-4 justify-between">
                <div>
                    <h2 className="font-serif text-lg">Event Structure</h2>
                    <p className="text-xs text-club-text/60">Select how many teams will compete.</p>
                </div>
                <form action={async (formData) => {
                    'use server'
                    const count = parseInt(formData.get('count') as string)
                    await updateTeamStructure(id, count)
                }} className="flex gap-2 items-center bg-white p-2 rounded border border-gray-200">
                    <select 
                        name="count" 
                        defaultValue={teamCount}
                        className="bg-transparent font-serif text-club-navy text-sm outline-none cursor-pointer"
                    >
                        <option value="0">Individual (No Teams)</option>
                        <option value="2">2 Teams</option>
                        <option value="3">3 Teams</option>
                        <option value="4">4 Teams</option>
                        <option value="5">5 Teams</option>
                    </select>
                    <div className="w-[1px] h-6 bg-gray-200 mx-1"></div>
                    <button className="text-club-gold font-bold uppercase text-xs tracking-wider hover:text-club-navy transition-colors">
                        Update Mode
                    </button>
                </form>
            </div>
        </div>

        {/* ROSTER GRID */}
        {teamCount > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                
                {/* 1. UNASSIGNED POOL */}
                <div className="bg-white/50 border border-club-navy/10 p-4 rounded-sm">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-club-text/50 mb-4 flex items-center gap-2">
                        <User size={14} />
                        Unassigned
                    </h3>
                    {participants?.filter((p: any) => !p.team_id).map((p: any) => (
                        <PlayerRow key={p.id} p={p} currentTeamId={null} isCaptain={false} />
                    ))}
                    {participants?.filter((p: any) => !p.team_id).length === 0 && (
                         <div className="text-center py-8 opacity-40 text-xs italic">Pool empty</div>
                    )}
                </div>

                {/* 2. TEAM LISTS */}
                {teams?.map((team: any) => (
                    <div key={team.id} className="bg-white border-t-4 border-club-navy p-4 rounded-sm shadow-md h-fit">
                        <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-2">
                            <h3 className="font-serif text-lg font-bold text-club-navy">{team.name}</h3>
                            {team.captain_id && <Crown size={16} className="text-club-gold fill-club-gold" />}
                        </div>

                        {/* Team Members */}
                        {participants?.filter((p: any) => p.team_id === team.id).map((p: any) => (
                            <PlayerRow 
                                key={p.id} 
                                p={p} 
                                currentTeamId={team.id} 
                                isCaptain={team.captain_id === p.profiles.id} 
                            />
                        ))}
                        
                        {participants?.filter((p: any) => p.team_id === team.id).length === 0 && (
                            <p className="text-xs text-gray-300 italic text-center py-4">No players yet</p>
                        )}
                    </div>
                ))}

            </div>
        ) : (
            <div className="text-center p-12 opacity-50 border-2 border-dashed border-club-navy/10 rounded">
                <User size={48} className="mx-auto mb-4 text-club-navy" />
                <p>Individual Competition Mode</p>
                <p className="text-xs mt-2">Use the "Event Structure" box above to create teams.</p>
            </div>
        )}

      </div>
    </main>
  )
}