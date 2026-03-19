// app/events/[id]/scorecard/actions.ts
'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

function samePair(slotA: number, slotB: number) {
  return (slotA <= 2 && slotB <= 2) || (slotA >= 3 && slotB >= 3)
}

async function canEditScore(
  supabase: Awaited<ReturnType<typeof createClient>>,
  eventId: string,
  roundId: string,
  actorUserId: string,
  targetUserId: string
) {
  const { data: round } = await supabase
    .from('rounds')
    .select('id, event_id, scoring_locked')
    .eq('id', roundId)
    .single()

  if (!round || round.event_id !== eventId) return false

  const { data: event } = await supabase
    .from('events')
    .select('created_by')
    .eq('id', eventId)
    .single()

  const { data: actorParticipant } = await supabase
    .from('event_participants')
    .select('role, team_id')
    .eq('event_id', eventId)
    .eq('user_id', actorUserId)
    .single()

  const { data: targetParticipant } = await supabase
    .from('event_participants')
    .select('team_id')
    .eq('event_id', eventId)
    .eq('user_id', targetUserId)
    .single()

  if (!actorParticipant || !targetParticipant) return false

  const isOrganizer = actorParticipant.role === 'organizer' || event?.created_by === actorUserId

  if (round.scoring_locked && !isOrganizer) {
    return false
  }

  if (isOrganizer) return true
  if (actorUserId === targetUserId) return true

  const { data: captainTeam } = await supabase
    .from('teams')
    .select('id')
    .eq('event_id', eventId)
    .eq('captain_id', actorUserId)
    .maybeSingle()

  if (captainTeam?.id && targetParticipant.team_id === captainTeam.id) {
    return true
  }

  const { data: pairings } = await supabase
    .from('pairings')
    .select('tee_time_id, slot_number, player_id, tee_times!inner(round_id)')
    .eq('tee_times.round_id', roundId)

  const actorPair = (pairings || []).find((entry: any) => entry.player_id === actorUserId)
  const targetPair = (pairings || []).find((entry: any) => entry.player_id === targetUserId)

  if (!actorPair || !targetPair) return false

  return actorPair.tee_time_id === targetPair.tee_time_id && samePair(actorPair.slot_number, targetPair.slot_number)
}

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

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const allowed = await canEditScore(supabase, eventId, roundId, user.id, userId)
  if (!allowed) throw new Error('Not allowed to edit this scorecard')

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
  revalidatePath(`/events/${eventId}/dashboard`)
}