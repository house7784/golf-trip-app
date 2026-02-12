import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import TrashTalk from './chat/TrashTalk' 

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

  // We pass the user to the chat so it knows who "You" are
  const currentUser = { id: user.id, email: user.email }

  // Await params to avoid Next.js sync errors
  const { id } = await params

  return (
    <div className="min-h-screen bg-club-paper">
      {/* Navigation Bar */}
      <nav className="bg-club-navy text-white p-4 sticky top-0 z-30 shadow-md">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
            <Link href="/events" className="font-serif font-bold text-xl tracking-wide text-club-gold">
              GOLF TRIP
            </Link>
            <div className="space-x-6 text-sm font-bold uppercase tracking-widest">
                <Link href={`/events/${id}/tee-times`} className="hover:text-club-gold transition">Tee Times</Link>
                <Link href={`/events/${id}/leaderboard`} className="hover:text-club-gold transition text-gray-500 cursor-not-allowed" title="Coming Soon">Leaderboard</Link>
            </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto p-4 pb-24">
        {children}
      </main>

      {/* THE TRASH TALK BUTTON */}
      <TrashTalk eventId={id} currentUser={currentUser} />
      
    </div>
  )
}