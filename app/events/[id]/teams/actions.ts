// app/events/[id]/teams/actions.ts
'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

// 1. UPDATE TEAM STRUCTURE
export async function updateTeamStructure(eventId: string, count: number) {
  const supabase = await createClient()

  const { data: existingTeams } = await supabase.from('teams').select('id').eq('event_id', eventId)
  const currentCount = existingTeams?.length || 0

  if (count === 0) {
    await supabase.from('teams').delete().eq('event_id', eventId)
  } 
  else if (count > currentCount) {
    const newTeamsNeeded = count - currentCount
    const teamsToCreate = Array.from({ length: newTeamsNeeded }).map((_, i) => ({
      event_id: eventId,
      name: `Team ${currentCount + i + 1}`
    }))
    await supabase.from('teams').insert(teamsToCreate)
  }
  else if (count < currentCount) {
    const { data: teamsToDelete } = await supabase
      .from('teams')
      .select('id')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
      .limit(currentCount - count)

    if (teamsToDelete && teamsToDelete.length > 0) {
        const ids = teamsToDelete.map(t => t.id)
        await supabase.from('teams').delete().in('id', ids)
    }
  }

  revalidatePath(`/events/${eventId}/teams`)
}

// 2. ASSIGN PLAYER (Now accepts eventId)
export async function assignPlayer(participantId: string, teamId: string | null, eventId: string) {
  const supabase = await createClient()
  
  await supabase
    .from('event_participants')
    .update({ team_id: teamId })
    .eq('id', participantId)

  // Now we can safely use eventId!
  revalidatePath(`/events/${eventId}/teams`)
}

// 3. SET CAPTAIN (Now accepts eventId)
export async function setCaptain(teamId: string, userId: string, eventId: string) {
  const supabase = await createClient()
  
  await supabase.from('teams').update({ captain_id: userId }).eq('id', teamId)
  
  revalidatePath(`/events/${eventId}/teams`)
}