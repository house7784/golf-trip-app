// app/scorecard/page.tsx
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Calendar, MapPin } from 'lucide-react'

export default async function ScorecardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <main className="min-h-screen bg-club-cream text-club-navy p-6">
      {/* Header */}
      <div className="max-w-md mx-auto mb-6 flex items-center gap-4">
        <Link href="/" className="bg-white p-2 rounded-sm border border-club-navy/10 shadow-sm">
          <ChevronLeft size={20} />
        </Link>
        <h1 className="font-serif text-2xl text-club-navy">Post Score</h1>
      </div>

      <div className="max-w-md mx-auto bg-club-paper p-6 rounded-sm shadow-md border-t-4 border-club-gold">
        
        <form className="space-y-6">
          
          {/* Date Picker */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs uppercase tracking-wider font-bold text-club-text/60">
              <Calendar size={14} /> Date
            </label>
            <input 
              type="date" 
              name="date"
              className="w-full bg-white border border-club-gold/40 p-3 rounded-sm font-serif text-lg"
              defaultValue={new Date().toISOString().split('T')[0]}
            />
          </div>

          {/* Course Select */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs uppercase tracking-wider font-bold text-club-text/60">
              <MapPin size={14} /> Course
            </label>
            <select name="course" className="w-full bg-white border border-club-gold/40 p-3 rounded-sm font-serif text-lg">
              <option value="Dunes Club">The Dunes Club</option>
              <option value="Caledonia">Caledonia</option>
              <option value="True Blue">True Blue</option>
            </select>
          </div>

          {/* Score Input */}
          <div className="space-y-2">
            <label className="block text-xs uppercase tracking-wider font-bold text-club-text/60">
              Total Score (Gross)
            </label>
            <input 
              name="score"
              type="number" 
              placeholder="72" 
              className="w-full bg-white border border-club-gold/40 p-3 rounded-sm font-serif text-4xl text-center tracking-widest text-club-navy"
            />
          </div>

          <button className="w-full bg-club-navy text-white py-4 rounded-sm hover:bg-opacity-90 uppercase tracking-wide text-sm font-bold shadow-lg mt-4">
            Post Score
          </button>

        </form>
      </div>
    </main>
  )
}