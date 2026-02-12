// app/page.tsx
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { Trophy, User, LogOut, Calendar, Activity, Crown, ArrowRight } from 'lucide-react'
import { signOut } from '@/app/login/actions'
import JoinEventPanel from '@/app/events/JoinEventPanel'
import Link from 'next/link'

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<{ join?: string }>
}) {
  const supabase = await createClient()
  const query = await searchParams
  const joinStatus = query?.join
  
  // 1. Check if the user is logged in
  const { data: { user } } = await supabase.auth.getUser()

  // 2. Fetch their profile
  let profile = null
  let managedEvents = []

  if (user) {
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    profile = data

    if (profile?.handicap_index === null || profile?.handicap_index === undefined) {
      redirect('/onboarding')
    }

    // 3. Fetch events they are ORGANIZING
    const { data: participation } = await supabase
      .from('event_participants')
      .select('event_id, events(id, name, start_date)')
      .eq('user_id', user.id)
      .eq('role', 'organizer')
    
    // Clean up the data structure
    managedEvents = participation?.map((p: any) => p.events) || []
  }

  // ----------------------------------------------------------------
  // VIEW A: The "Public" Landing Page (Not Logged In)
  // ----------------------------------------------------------------
  if (!user) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-club-cream">
        <div className="mb-8 border-b-4 border-double border-club-gold pb-4">
          <h1 className="font-serif text-5xl text-club-navy tracking-tight">The Invitational</h1>
          <p className="font-sans text-club-green uppercase tracking-widest mt-2 text-sm font-bold">
            Est. 2026 • Myrtle Beach
          </p>
        </div>

        <div className="bg-club-paper p-8 rounded-sm shadow-xl border border-club-gold/30 max-w-sm w-full">
          <div className="flex justify-center mb-6 text-club-gold">
            <Trophy size={48} strokeWidth={1.5} />
          </div>
          <p className="font-serif text-xl text-club-navy mb-6 italic">
            "Gentlemen, start your engines."
          </p>
          <a 
            href="/login" 
            className="block w-full bg-club-navy text-white text-center py-3 px-4 rounded-sm hover:bg-opacity-90 uppercase tracking-wide text-sm font-semibold transition-all"
          >
            Member Login
          </a>
        </div>
      </main>
    )
  }

  // ----------------------------------------------------------------
  // VIEW B: The "Member Dashboard" (Logged In)
  // ----------------------------------------------------------------
  return (
    <main className="min-h-screen bg-club-cream text-club-text">
      
      {/* Top Navigation Bar */}
      <nav className="bg-club-navy text-white p-4 sticky top-0 z-50 shadow-md">
        <div className="flex justify-between items-center max-w-md mx-auto">
          <h1 className="font-serif text-lg tracking-wide text-club-gold">The Invitational</h1>
          <form action={signOut}>
            <button className="text-white/60 hover:text-white transition-colors">
              <LogOut size={20} />
            </button>
          </form>
        </div>
      </nav>

      <div className="max-w-md mx-auto p-6 space-y-6">
        
        {/* Welcome Card */}
        <div className="bg-club-paper p-6 rounded-sm shadow-sm border-t-4 border-club-gold">
          <div className="flex items-center gap-4">
            <div className="bg-club-navy/10 p-3 rounded-full">
              <User className="text-club-navy h-8 w-8" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-club-text/60 font-bold">Welcome back</p>
              <h2 className="font-serif text-2xl text-club-navy">{profile?.full_name || 'Member'}</h2>
            </div>
          </div>
          
          <div className="mt-6 grid grid-cols-2 gap-4">
            <div className="bg-white p-3 border border-club-gold/20 text-center">
              <p className="text-xs uppercase text-club-text/50 font-bold">Handicap</p>
              <p className="text-2xl font-serif text-club-navy">{profile?.handicap_index ?? '--'}</p>
            </div>
            <div className="bg-white p-3 border border-club-gold/20 text-center">
              <p className="text-xs uppercase text-club-text/50 font-bold">Skin Bank</p>
              <p className="text-2xl font-serif text-club-green">$0.00</p>
            </div>
          </div>
        </div>

        {/* ORGANIZER CONSOLE (Visible only if you have events) */}
        {managedEvents.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-xs uppercase tracking-widest font-bold text-club-text/50 ml-1">Organizer Console</h3>
            {managedEvents.map((event: any) => (
              <Link 
                key={event.id}
                href={`/events/${event.id}/dashboard`}
                className="flex items-center justify-between bg-club-gold text-club-navy p-4 rounded-sm shadow-md hover:bg-opacity-90 transition-all border border-club-navy/10"
              >
                <div className="flex items-center gap-3">
                  <Crown size={20} />
                  <div>
                    <span className="font-bold uppercase tracking-wider text-sm block">{event.name}</span>
                    <span className="text-xs opacity-70 block">Manage Event</span>
                  </div>
                </div>
                <ArrowRight size={18} />
              </Link>
            ))}
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-1 gap-4">
          <JoinEventPanel joinStatus={joinStatus} returnTo="/" />

           {/* Link to Create NEW Event */}
          <Link href="/events/create" className="flex items-center justify-between bg-white border border-club-navy/20 text-club-navy p-4 rounded-sm hover:bg-club-paper transition-all">
            <span className="font-bold uppercase tracking-wider text-sm">Create New Event</span>
            <Trophy className="text-club-navy/50" />
          </Link>

          <Link href="/scorecard" className="flex items-center justify-between bg-club-navy text-white p-4 rounded-sm shadow-lg hover:bg-club-navy/90 transition-all">
            <span className="font-bold uppercase tracking-wider text-sm">Enter Score</span>
            <Activity className="text-club-gold" />
          </Link>

          <Link href="/profile" className="flex items-center justify-between bg-white border border-club-navy/20 text-club-navy p-4 rounded-sm hover:bg-club-paper transition-all">
            <span className="font-bold uppercase tracking-wider text-sm">Edit Profile</span>
            <User className="text-club-navy/50" />
          </Link>
          
          <button className="flex items-center justify-between bg-white border border-club-navy/20 text-club-navy p-4 rounded-sm hover:bg-club-paper transition-all">
            <span className="font-bold uppercase tracking-wider text-sm">View Schedule</span>
            <Calendar className="text-club-navy/50" />
          </button>
        </div>

      </div>
    </main>
  )
}