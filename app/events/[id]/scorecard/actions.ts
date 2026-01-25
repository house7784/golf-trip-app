// app/events/[id]/scorecard/actions.ts
'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

// 1. ORGANIZER: Save Course Data (Pars & Handicaps)
export async function saveCourseData(eventId: string, roundId: string, courseName: string, holes: any[]) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('rounds')
    .update({ 
      course_name: courseName,
      course_data: { holes } // Store the array of 18 holes
    })
    .eq('id', roundId)

  if (error) throw new Error('Failed to save course')
  
  revalidatePath(`/events/${eventId}/tee-times`)
  revalidatePath(`/events/${eventId}/scorecard`)
}

// 2. PLAYER: Submit Score
export async function submitScore(eventId: string, roundId: string, userId: string, holeScores: any) {
  const supabase = await createClient()

  // Upsert (Insert or Update if exists)
  const { error } = await supabase
    .from('scores')
    .upsert({ 
      round_id: roundId, 
      user_id: userId,
      hole_scores: holeScores
    }, { onConflict: 'round_id, user_id' })

  if (error) throw new Error('Failed to submit score')

  revalidatePath(`/events/${eventId}/scorecard`)
  revalidatePath(`/events/${eventId}/leaderboard`)
}