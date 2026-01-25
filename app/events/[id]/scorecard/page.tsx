// app/events/[id]/scorecard/page.tsx
import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import { ChevronLeft, Save } from 'lucide-react'
import { submitScore } from './actions'

export default async function ScorecardPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { id } = await params
  const { data: { user } } = await supabase.auth.getUser()

  // 1. Get Today's Round (We'll assume the most recent or active one for simplicity)
  // Ideally, you'd select the round, but for now, let's grab the first one that has course data
  const { data: rounds } = await supabase
    .from('rounds')
    .select('*')
    .eq('event_id', id)
    .not('course_data', 'is', null)
    .order('date')

  const activeRound = rounds?.[0]

  if (!activeRound) {
    return (
        <div className="min-h-screen bg-club-cream p-6 flex flex-col items-center justify-center text-center">
            <p className="font-serif text-xl mb-2">No Course Data Found</p>
            <p className="text-sm text-gray-500 mb-6">The organizer hasn't set up the course yet.</p>
            <Link href={`/events/${id}/dashboard`} className="text-club-navy underline">Back to Dashboard</Link>
        </div>
    )
  }

  const course = activeRound.course_data
  
  // 2. Get Existing Scores for this user
  const { data: existingScore } = await supabase
    .from('scores')
    .select('hole_scores')
    .eq('round_id', activeRound.id)
    .eq('user_id', user?.id)
    .single()

  const scores = existingScore?.hole_scores || {}

  return (
    <main className="min-h-screen bg-club-cream text-club-navy p-6 pb-24">
      {/* Header */}
      <div className="max-w-md mx-auto mb-6 flex items-center gap-4 sticky top-0 bg-club-cream py-4 z-10 border-b border-club-gold/10">
        <Link href={`/events/${id}/dashboard`} className="bg-white p-2 rounded-sm border border-club-navy/10 shadow-sm">
          <ChevronLeft size={20} />
        </Link>
        <div>
          <h1 className="font-serif text-2xl text-club-navy">Enter Scores</h1>
          <p className="text-xs text-club-text/60">{activeRound.course_name}</p>
        </div>
      </div>

      {/* SCORECARD FORM */}
      <div className="max-w-md mx-auto">
        <form action={async (formData) => {
            'use server'
            const newScores: any = {}
            // Extract scores from form
            for (let i = 1; i <= 18; i++) {
                const val = formData.get(`hole_${i}`)
                if (val) newScores[i] = parseInt(val as string)
            }
            await submitScore(id, activeRound.id, user!.id, newScores)
        }}>
            
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                {course.holes.map((hole: any) => {
                    const currentVal = scores[hole.number]
                    
                    // Style logic for score (Birdie, Bogey, etc)
                    let scoreColor = 'text-club-navy'
                    if (currentVal) {
                        if (currentVal < hole.par) scoreColor = 'text-red-500 font-bold' // Birdie
                        if (currentVal > hole.par) scoreColor = 'text-blue-500' // Bogey
                    }

                    return (
                        <div key={hole.number} className="flex items-center border-b border-gray-100 last:border-0 p-3">
                            {/* Hole Info */}
                            <div className="w-16 flex flex-col items-center justify-center border-r border-gray-100 pr-3">
                                <span className="font-serif text-xl font-bold">{hole.number}</span>
                                <span className="text-[10px] text-gray-400 uppercase">Par {hole.par}</span>
                            </div>

                            {/* Input Area */}
                            <div className="flex-1 flex items-center justify-center">
                                <input 
                                    name={`hole_${hole.number}`}
                                    type="number" 
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    defaultValue={currentVal}
                                    placeholder="-"
                                    className={`w-full text-center text-2xl outline-none bg-transparent ${scoreColor}`}
                                />
                            </div>

                            {/* HCP Helper */}
                            <div className="w-12 text-center text-[10px] text-gray-300">
                                HCP<br/>{hole.hcp}
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Floating Save Button */}
            <div className="fixed bottom-6 left-0 right-0 px-6 max-w-md mx-auto">
                <button className="w-full bg-club-navy text-white py-4 rounded-lg shadow-xl font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-club-gold transition-colors">
                    <Save size={18} />
                    Save Card
                </button>
            </div>

        </form>
      </div>
    </main>
  )
}