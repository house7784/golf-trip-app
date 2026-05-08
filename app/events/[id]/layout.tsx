import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Home, User } from 'lucide-react'
import ChallengeNotificationCenter from './ChallengeNotificationCenter'
import PollNotificationCenter from './PollNotificationCenter'

export default async function EventLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('handicap_index')
    .eq('id', user.id)
    .single()

  if (profile?.handicap_index === null || profile?.handicap_index === undefined) {
    redirect('/onboarding')
  }

  // Await params to avoid Next.js sync errors
  const { id } = await params

  return (
    <div className="h-screen overflow-hidden bg-club-paper">
      {/* Navigation Bar */}
      <nav
        className="z-[999] h-16 border-b border-white/5 bg-club-navy/95 px-4 text-white shadow-md backdrop-blur"
        style={{ position: 'fixed', top: 0, left: 0, right: 0 }}
      >
        <div className="mx-auto flex h-full max-w-6xl items-center justify-between gap-4">
            <Link href={`/events/${id}/dashboard`} className="font-serif text-2xl font-bold tracking-wide text-club-gold">
              GOLF TRIP
            </Link>
            <div className="flex items-center gap-3 sm:gap-6 text-[11px] sm:text-xs font-bold uppercase tracking-[0.18em]">
              <Link href="/events" className="transition hover:text-club-gold">Home</Link>
              <Link href={`/events/${id}/dashboard`} className="hidden transition hover:text-club-gold lg:block">Dashboard</Link>
              <Link href={`/events/${id}/tee-times`} className="transition hover:text-club-gold">Tee Times</Link>
              <Link href="/events" className="rounded-full p-2 text-white/70 transition-colors hover:bg-white/5 hover:text-white" title="Events Home">
                <Home size={18} />
              </Link>
              <Link href="/profile" className="rounded-full p-2 text-white/70 transition-colors hover:bg-white/5 hover:text-white" title="Profile">
                <User size={18} />
              </Link>
            </div>
        </div>
      </nav>

      <div aria-hidden="true" className="h-16" />

      <ChallengeNotificationCenter eventId={id} currentUserId={user.id} />
      <PollNotificationCenter eventId={id} currentUserId={user.id} />

      <main className="max-w-6xl mx-auto h-[calc(100vh-4rem)] overflow-y-auto p-4 pb-24">
        {children}
      </main>
      
    </div>
  )
}