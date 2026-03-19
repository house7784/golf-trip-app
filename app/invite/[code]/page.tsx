import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { UserPlus, ArrowRight } from 'lucide-react'
import Link from 'next/link'

export default async function InvitePage({ params }: { params: Promise<{ code: string }> }) {
  const supabase = await createClient()
  const { code } = await params

  // 1. Check if User is Logged In
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    // If not logged in, send them to login, then bounce them back here
    redirect(`/login?next=/invite/${code}`)
  }

  // 2. Find the Event by Code
  const { data: event } = await supabase
    .from('events')
    .select('id, name, start_date')
    .eq('invite_code', code)
    .single()

  if (!event) {
    return (
      <div className="min-h-screen bg-club-cream flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-2xl font-serif text-club-navy mb-2">Invalid Invite</h1>
        <p className="text-gray-600">This invite link is invalid or has expired.</p>
        <Link href="/" className="mt-6 text-club-gold font-bold uppercase text-sm tracking-wider">Return Home</Link>
      </div>
    )
  }

  // 3. Check if already a member
  const { data: existing } = await supabase
    .from('event_participants')
    .select('role')
    .eq('event_id', event.id)
    .eq('user_id', user.id)
    .single()

  if (existing) {
    redirect(`/events/${event.id}/dashboard`)
  }

  // 4. Server Action to Join
  const joinEvent = async () => {
    'use server'
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (user && event) {
      await supabase.from('event_participants').insert({
        event_id: event.id,
        user_id: user.id,
        role: 'player'
      })
      redirect(`/events/${event.id}/dashboard`)
    }
  }

  return (
    <main className="min-h-screen bg-club-cream flex flex-col items-center justify-center p-6">
      <div className="bg-white p-8 rounded-xl shadow-xl max-w-sm w-full text-center border-t-4 border-club-gold">
        <div className="bg-club-navy/5 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
          <UserPlus className="text-club-navy" size={32} />
        </div>
        
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">You've been invited to</p>
        <h1 className="font-serif text-3xl text-club-navy mb-6">{event.name}</h1>
        
        <form action={joinEvent}>
          <button 
            type="submit" 
            className="w-full bg-club-navy text-white py-4 rounded-lg font-bold uppercase tracking-wide hover:bg-club-gold hover:text-club-navy transition-all flex items-center justify-center gap-2"
          >
            Accept Invite <ArrowRight size={18} />
          </button>
        </form>
        
        <p className="mt-4 text-xs text-gray-400">
          Signed in as {user.email}
        </p>
      </div>
    </main>
  )
}