// app/events/[id]/dashboard/page.tsx
import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import { 
  Calendar, 
  Trophy, 
  Megaphone, 
  Edit, 
  Swords, 
  ClipboardList, 
  Users, 
  Settings 
} from 'lucide-react'
import CopyInviteButton from './CopyInviteButton'

export default async function EventDashboard({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { id } = await params

  // 1. Fetch Event Details
  const { data: event } = await supabase.from('events').select('*').eq('id', id).single()

  // 2. Fetch User Role (Are they an organizer?)
  const { data: { user } } = await supabase.auth.getUser()
  const { data: participant } = await supabase
    .from('event_participants')
    .select('role')
    .eq('event_id', id)
    .eq('user_id', user?.id)
    .single()
    
  const isOrganizer = participant?.role === 'organizer'

  // 3. Fetch Announcements
  const { data: announcements } = await supabase
    .from('announcements')
    .select('*')
    .eq('event_id', id)
    .order('created_at', { ascending: false })
    .limit(3)

  return (
    <main className="min-h-screen bg-club-cream text-club-navy pb-20">
      
      {/* HERO SECTION */}
      <div className="bg-club-navy text-white p-6 pt-12 rounded-b-3xl shadow-lg relative overflow-hidden">
        <div className="relative z-10">
            <h1 className="font-serif text-3xl mb-1">{event?.name}</h1>
            <p className="text-club-gold text-sm font-bold uppercase tracking-wider">{event?.location}</p>
        </div>
        {/* Background Pattern */}
        <div className="absolute top-0 right-0 opacity-10 transform translate-x-10 -translate-y-10">
            <Trophy size={150} />
        </div>
      </div>

      <div className="p-6 space-y-6 -mt-4 relative z-20">

        {/* 1. LEADERBOARD PREVIEW CARD */}
        <Link href={`/events/${id}/leaderboard`} className="block bg-white p-4 rounded-xl shadow-md border-b-4 border-club-gold active:scale-95 transition-transform">
            <div className="flex justify-between items-center mb-2">
                <h3 className="text-xs font-bold uppercase text-gray-400 tracking-widest">Current Leader</h3>
                <span className="text-xs text-club-gold font-bold">View Full &rarr;</span>
            </div>
            <div className="flex items-center gap-4">
                <div className="bg-club-navy text-white w-12 h-12 rounded-full flex items-center justify-center font-serif text-xl font-bold">
                    1
                </div>
                <div>
                    <p className="font-serif text-lg leading-none">Tiger Woods</p>
                    <p className="text-sm text-green-600 font-bold">-4 (Thru 9)</p>
                </div>
            </div>
        </Link>

        {/* 2. ANNOUNCEMENTS */}
        <div>
            <div className="flex justify-between items-end mb-2 px-1">
                <h3 className="font-serif text-lg">Announcements</h3>
                {isOrganizer && (
                    <Link href={`/events/${id}/announcements/new`} className="text-xs text-club-navy underline">
                        + Post
                    </Link>
                )}
            </div>
            
            {announcements && announcements.length > 0 ? (
                <div className="space-y-3">
                    {announcements.map((item: any) => (
                        <div key={item.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                            <div className="flex items-start gap-3">
                                <Megaphone className="text-club-gold shrink-0 mt-1" size={16} />
                                <div>
                                    <h4 className="font-bold text-sm text-club-navy">{item.title}</h4>
                                    <p className="text-sm text-club-text mt-1">{item.content}</p>
                                    <p className="text-[10px] text-gray-300 mt-2">
                                        {new Date(item.created_at).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="bg-white/50 p-6 rounded-lg border border-dashed border-gray-300 text-center">
                    <p className="text-sm text-gray-400 italic">No news is good news.</p>
                </div>
            )}
        </div>

        {/* 3. PLAYER ACTIONS GRID */}
        <h3 className="font-serif text-lg px-1">Menu</h3>
        <div className="grid grid-cols-2 gap-4">
            {/* Scorecard */}
            <Link href={`/events/${id}/scorecard`} className="bg-club-green text-white p-4 rounded-xl shadow-md flex flex-col items-center justify-center gap-2 h-32 active:bg-opacity-90 transition">
                <Edit size={32} />
                <span className="font-bold text-sm">Enter Scores</span>
            </Link>

            {/* Tee Times */}
            <Link href={`/events/${id}/tee-times`} className="bg-white text-club-navy p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-2 h-32 active:bg-gray-50 transition">
                <Calendar size={28} className="text-club-gold" />
                <span className="font-bold text-xs uppercase tracking-wider">Tee Times</span>
            </Link>

            {/* Challenges */}
            <Link href={`/events/${id}/challenges`} className="bg-white text-club-navy p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-2 h-32 active:bg-gray-50 transition">
                <Swords size={28} className="text-club-gold" />
                <span className="font-bold text-xs uppercase tracking-wider">Challenges</span>
            </Link>

            {/* Full Leaderboard */}
            <Link href={`/events/${id}/leaderboard`} className="bg-white text-club-navy p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-2 h-32 active:bg-gray-50 transition">
                <ClipboardList size={28} className="text-club-gold" />
                <span className="font-bold text-xs uppercase tracking-wider">Standings</span>
            </Link>
        </div>

        {/* 4. ORGANIZER TOOLS (Conditional) */}
        {isOrganizer && (
            <div className="mt-8 pt-8 border-t border-club-navy/10">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs font-bold uppercase text-gray-400 tracking-widest">Organizer Tools</h3>
                    <CopyInviteButton eventId={id} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                    <Link href={`/events/${id}/teams`} className="bg-gray-200 p-3 rounded text-center">
                        <Users className="mx-auto mb-1 text-gray-600" size={20} />
                        <span className="text-[10px] font-bold text-gray-600">Teams</span>
                    </Link>
                    <Link href={`/events/${id}/modes`} className="bg-gray-200 p-3 rounded text-center">
                        <Settings className="mx-auto mb-1 text-gray-600" size={20} />
                        <span className="text-[10px] font-bold text-gray-600">Modes</span>
                    </Link>
                    {/* Add more admin tools here later */}
                </div>
            </div>
        )}

      </div>
    </main>
  )
}