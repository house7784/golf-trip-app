'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function saveScoringConfig(formData: FormData): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const roundId = formData.get('roundId') as string
  const eventId = formData.get('eventId') as string
  if (!roundId || !eventId) return

  const { data: participant } = await supabase
    .from('event_participants')
    .select('role')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (participant?.role !== 'organizer') return

  const { data: round } = await supabase
    .from('rounds')
    .select('course_data')
    .eq('id', roundId)
    .single()

  const existingCourseData = (round?.course_data as Record<string, any>) || {}
  const updatedCourseData: Record<string, any> = {
    ...existingCourseData,
  }

  // Parse all position_* fields dynamically so large trips (e.g., 50 positions) are supported.
  const positionPoints: Record<string, number> = {}
  formData.forEach((value, key) => {
    if (!key.startsWith('position_')) return
    const position = key.replace('position_', '')
    const numeric = Number(value)
    if (position && Number.isFinite(numeric) && numeric >= 0) {
      positionPoints[position] = numeric
    }
  })
  updatedCourseData.position_points = positionPoints

  const matchWinnerRaw = formData.get('match_winner_points')
  const matchTieRaw = formData.get('match_tie_points')
  if (matchWinnerRaw !== null && matchWinnerRaw !== '') {
    updatedCourseData.match_winner_points = Math.max(0, Number(matchWinnerRaw) || 0)
  }
  if (matchTieRaw !== null && matchTieRaw !== '') {
    updatedCourseData.match_tie_points = Math.max(0, Number(matchTieRaw) || 0)
  }

  await supabase
    .from('rounds')
    .update({ course_data: updatedCourseData })
    .eq('id', roundId)

  revalidatePath(`/events/${eventId}/scoring`)
  revalidatePath(`/events/${eventId}/dashboard`)
}