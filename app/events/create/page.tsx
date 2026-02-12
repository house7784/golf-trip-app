// app/events/create/page.tsx
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Calendar, Flag } from 'lucide-react'
import { createEvent } from '@/app/events/actions'

export default async function CreateEventPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <main className="min-h-screen bg-club-cream text-club-navy p-6">
      <div className="max-w-md mx-auto mb-6 flex items-center gap-4">
        <Link href="/" className="bg-white text-club-navy p-2 rounded-sm border border-club-navy/10 shadow-sm">
          <ChevronLeft size={20} />
        </Link>
        <h1 className="font-serif text-2xl text-club-navy">New Event</h1>
      </div>

      <div className="max-w-md mx-auto bg-club-paper p-8 rounded-sm shadow-xl border-t-4 border-club-gold">
        <form action={createEvent as any} className="space-y-6">
          
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs uppercase tracking-wider font-bold text-club-text/60">
              <Flag size={14} /> Event Name
            </label>
            <input 
              name="name" 
              type="text" 
              placeholder="The Drunken Invitational 2026"
              required
              className="w-full bg-white border border-club-gold/40 p-3 rounded-sm font-serif text-lg placeholder:text-club-text/30"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs uppercase tracking-wider font-bold text-club-text/60">
                <Calendar size={14} /> Start Date
              </label>
              <input 
                name="startDate" 
                type="date" 
                required
                className="w-full bg-white border border-club-gold/40 p-3 rounded-sm font-serif"
              />
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs uppercase tracking-wider font-bold text-club-text/60">
                End Date
              </label>
              <input 
                name="endDate" 
                type="date" 
                required
                className="w-full bg-white border border-club-gold/40 p-3 rounded-sm font-serif"
              />
            </div>
          </div>

          <button className="w-full bg-club-navy text-white py-4 rounded-sm hover:bg-opacity-90 uppercase tracking-wide text-sm font-bold shadow-lg">
            Create Event & Enter God Mode
          </button>
        </form>
      </div>
    </main>
  )
}