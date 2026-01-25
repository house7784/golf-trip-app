import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Calendar, ArrowRight, Trophy } from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Fetch events the user is part of (or created)
  const { data: events } = await supabase
    .from('events')
    .select('*')
    .order('start_date', { ascending: true })

  return (
    <main className="min-h-screen bg-gray-50 p-4 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex items-center justify-between">
            <div>
                <h1 className="font-serif text-3xl text-club-navy font-bold">My Events</h1>
                <p className="text-gray-500">Welcome back, Golfer.</p>
            </div>
            <Link 
                href="/create-event" // This page doesn't exist yet, but we'll add it later
                className="bg-club-navy text-white px-4 py-2 rounded-lg text-sm font-bold uppercase tracking-wider hover:bg-club-gold hover:text-club-navy transition"
            >
                + New Trip
            </Link>
        </div>

        {/* Events List */}
        <div className="grid gap-4">
            {events && events.length > 0 ? (
                events.map((event) => (
                    <Link key={event.id} href={`/events/${event.id}/tee-times`}>
                        <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-club-gold hover:shadow-md transition-all group cursor-pointer flex justify-between items-center">
                            <div>
                                <h2 className="font-serif text-xl text-club-navy group-hover:text-club-gold transition-colors">
                                    {event.name}
                                </h2>
                                <div className="flex items-center gap-4 mt-2 text-sm text-gray-400 font-medium uppercase tracking-wider">
                                    <span className="flex items-center gap-1"><Calendar size={14}/> {new Date(event.start_date).toLocaleDateString()}</span>
                                    <span className="flex items-center gap-1"><Trophy size={14}/> {event.location}</span>
                                </div>
                            </div>
                            <ArrowRight className="text-gray-300 group-hover:text-club-navy transition-colors" />
                        </div>
                    </Link>
                ))
            ) : (
                <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
                    <p className="text-gray-400">You don't have any trips yet.</p>
                    <Link href="/" className="text-club-gold font-bold underline mt-2 inline-block">Create one now</Link>
                </div>
            )}
        </div>

      </div>
    </main>
  )
}