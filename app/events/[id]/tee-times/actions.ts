'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

function sameSideSlots(slotNumber: number) {
  return slotNumber <= 2 ? [1, 2] : [3, 4]
}

function oppositeSideSlots(slotNumber: number) {
  return slotNumber <= 2 ? [3, 4] : [1, 2]
}

export async function createTeeTime(formData: FormData) {
  const supabase = await createClient()
  const roundId = formData.get('roundId') as string
  const time = formData.get('time') as string

  if (!roundId || !time) return

  const { data: teeTime, error } = await supabase
    .from('tee_times')
    .insert({ round_id: roundId, time })
    .select()
    .single()

  if (error) {
    console.error('Error creating tee time:', error)
    return
  }

  // Create 4 Empty Pairing Slots for this time
  const slots = Array(4).fill(null).map((_, i) => ({
    tee_time_id: teeTime.id,
    player_id: null,
    slot_number: i + 1
  }))

  await supabase.from('pairings').insert(slots)
  revalidatePath('/events')
}

export async function deleteTeeTime(formData: FormData) {
  const supabase = await createClient()
  const teeTimeId = formData.get('teeTimeId') as string
  
  if (!teeTimeId) return

  await supabase.from('tee_times').delete().eq('id', teeTimeId)
  revalidatePath('/events')
}

export async function assignToPairing(formData: FormData) {
  const supabase = await createClient()
  
  const teeTimeId = formData.get('teeTimeId') as string
  const slotIndex = formData.get('slotIndex')
  const playerId = formData.get('playerId') as string

  if (!teeTimeId || slotIndex === null) return

  const slotNumber = parseInt(slotIndex as string) + 1
  const finalPlayerId = playerId === 'remove' ? null : playerId

  if (finalPlayerId) {
    const { data: teeTime } = await supabase
      .from('tee_times')
      .select('round_id')
      .eq('id', teeTimeId)
      .single()

    if (!teeTime?.round_id) return

    const { data: round } = await supabase
      .from('rounds')
      .select('event_id')
      .eq('id', teeTime.round_id)
      .single()

    if (!round?.event_id) return

    const { data: teams } = await supabase
      .from('teams')
      .select('id')
      .eq('event_id', round.event_id)

    const enforceTeamPairing = (teams?.length || 0) >= 2

    if (enforceTeamPairing) {
      const { data: pairings } = await supabase
        .from('pairings')
        .select('slot_number, player_id')
        .eq('tee_time_id', teeTimeId)

      const proposedBySlot = new Map<number, string | null>()
      ;(pairings || []).forEach((pairing: any) => {
        proposedBySlot.set(pairing.slot_number, pairing.player_id)
      })
      proposedBySlot.set(slotNumber, finalPlayerId)

      const involvedIds = Array.from(proposedBySlot.values()).filter(Boolean) as string[]
      const uniqueIds = Array.from(new Set(involvedIds))

      const { data: participants } = await supabase
        .from('event_participants')
        .select('user_id, team_id')
        .eq('event_id', round.event_id)
        .in('user_id', uniqueIds)

      const teamByUser = new Map<string, string | null>()
      ;(participants || []).forEach((participant: any) => {
        teamByUser.set(participant.user_id, participant.team_id)
      })

      const candidateTeam = teamByUser.get(finalPlayerId)
      if (!candidateTeam) {
        console.error('Assign blocked: selected player has no team for this event')
        return
      }

      const sideTeams = Array.from(
        new Set(
          sameSideSlots(slotNumber)
            .filter((slot) => slot !== slotNumber)
            .map((slot) => proposedBySlot.get(slot))
            .filter(Boolean)
            .map((userId) => teamByUser.get(userId as string))
            .filter(Boolean)
        )
      ) as string[]

      const oppositeTeams = Array.from(
        new Set(
          oppositeSideSlots(slotNumber)
            .map((slot) => proposedBySlot.get(slot))
            .filter(Boolean)
            .map((userId) => teamByUser.get(userId as string))
            .filter(Boolean)
        )
      ) as string[]

      if (sideTeams.length > 1) {
        console.error('Assign blocked: side pairing already contains mixed teams')
        return
      }

      if (sideTeams.length === 1 && sideTeams[0] !== candidateTeam) {
        console.error('Assign blocked: pairings must be same-team on each side')
        return
      }

      if (sideTeams.length === 0 && oppositeTeams.length === 1 && oppositeTeams[0] === candidateTeam) {
        console.error('Assign blocked: each tee time should contain one pairing from each team')
        return
      }
    }
  }

  // --- NEW LOGIC: UPSERT (No "Slot Missing" check needed) ---
  const { error } = await supabase
    .from('pairings')
    .upsert(
      { 
        tee_time_id: teeTimeId, 
        slot_number: slotNumber, 
        player_id: finalPlayerId 
      },
      { onConflict: 'tee_time_id, slot_number' }
    )

  if (error) {
    console.error("Assign Error:", error)
  }

  revalidatePath('/events')
}

export async function toggleRoundLock(roundId: string, isLocked: boolean) {
    const supabase = await createClient()
    await supabase
      .from('rounds')
      .update({ scoring_locked: isLocked })
      .eq('id', roundId)
    
    revalidatePath('/events')
}