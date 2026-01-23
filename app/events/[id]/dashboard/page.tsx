// app/events/[id]/dashboard/page.tsx
import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import { Settings, Users, Calendar, Trophy, Share2, ChevronLeft } from 'lucide-react'

export default async function EventDashboard({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { id } = await params 

  // Fetch Event Details
  const { data: event } = await supabase
    .from('events')
    .select('*')
    .eq('id', id)
    .single()

  if (!event) return <div>Event not found</div>

  // Create the Invite Link
  const inviteLink = `${process.env.NEXT_PUBLIC_SITE_URL || 'localhost:3000'}/join/${event.invite_code}`

  return (
    <main className="min-h-screen bg-club-cream text-club-text pb-20">
      
      {/* Organizer Header */}
      <div className="bg-club-navy text-white p-6 pb-12 rounded-b-3xl shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <Settings size={120} />
        </div>
        
        <Link href="/" className="inline-block bg-white/10 p-2 rounded-full mb-4 hover:bg-white/20 transition">
           <ChevronLeft size={20} />
        </Link>

        <p className="text-club-gold uppercase tracking-widest text-xs font-bold mb-2">Organizer Dashboard</p>
        <h1 className="font-serif text-3xl leading-tight">{event.name}</h1>
        <div className="flex items-center gap-2 mt-2 text-white/60 text-sm">
          <Calendar size={14} />
          <span>{event.start_date} — {event.end_date}</span>
        </div>
      </div>

      <div className="max-w-md mx-auto px-6 -mt-8 space-y-6">

        {/* INVITE CARD */}
        <div className="bg-white p-6 rounded-sm shadow-md border-l-4 border-club-gold">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-serif text-xl text-club-navy">Invite Players</h3>
              <p className="text-xs text-club-text/60 mt-1">Share this link to let others join.</p>
            </div>
            <div className="bg-club-cream p-2 rounded-full text-club-navy">
              <Share2 size={20} />
            </div>
          </div>
          
          <div className="bg-club-cream p-3 rounded border border-dashed border-club-navy/20 text-center font-mono text-sm break-all select-all">
            {inviteLink}
          </div>
        </div>

        {/* GOD MODE CONTROLS */}
        <div className="grid grid-cols-2 gap-4">
          
          {/* LINK: This is the button that was broken! */}
          <Link href={`/events/${id}/modes`} className="bg-club-paper p-4 rounded-sm shadow-sm border border-club-gold/20 flex flex-col items-center justify-center gap-2 hover:bg-white transition h-32">
            <Trophy className="text-club-navy h-8 w-8" />
            <span className="text-xs uppercase font-bold text-club-navy tracking-wider">Game Modes</span>
          </Link>
          
          {/* Placeholder buttons for later */}
          <Link href={`/events/${id}/teams`} className="bg-club-paper p-4 rounded-sm shadow-sm border border-club-gold/20 flex flex-col items-center justify-center gap-2 hover:bg-white transition h-32">
            <Users className="text-club-navy h-8 w-8" />
            <span className="text-xs uppercase font-bold text-club-navy tracking-wider">Set Teams</span>
          </Link>

           <Link href={`/events/${id}/tee-times`} className="bg-club-paper p-4 rounded-sm shadow-sm border border-club-gold/20 flex flex-col items-center justify-center gap-2 hover:bg-white transition h-32">
              <Calendar className="text-club-navy h-8 w-8" />
              <span className="text-xs uppercase font-bold text-club-navy tracking-wider">Tee Times</span>
            </Link>

           <button className="bg-club-paper p-4 rounded-sm shadow-sm border border-club-gold/20 flex flex-col items-center justify-center gap-2 hover:bg-white transition h-32 opacity-50 cursor-not-allowed">
            <Settings className="text-club-navy h-8 w-8" />
            <span className="text-xs uppercase font-bold text-club-navy tracking-wider">Settings</span>
          </button>
        </div>

      </div>
    </main>
  )
}