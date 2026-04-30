import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { User } from 'lucide-react'

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
    <div className="min-h-screen bg-club-paper">
      {/* Navigation Bar */}
      <nav className="bg-club-navy text-white px-4 py-3 sticky top-0 z-30 shadow-md">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
            <Link href={`/events/${id}/dashboard`} className="font-serif font-bold text-xl tracking-wide text-club-gold">
              GOLF TRIP
            </Link>
            <div className="flex items-center gap-4 sm:gap-6 text-xs sm:text-sm font-bold uppercase tracking-widest">
              <Link href={`/events/${id}/dashboard`} className="hover:text-club-gold transition hidden sm:block">Dashboard</Link>
              <Link href={`/events/${id}/tee-times`} className="hover:text-club-gold transition">Tee Times</Link>
              <Link href="/profile" className="text-white/70 hover:text-white transition-colors" title="Profile">
                <User size={18} />
              </Link>
            </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto p-4 pb-24">
        {children}
      </main>
      
    </div>
  )
}