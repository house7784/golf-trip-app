// app/events/[id]/tee-times/actions.ts
'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

// 1. CREATE A NEW TEE TIME
export async function createTeeTime(eventId: string, roundId: string, time: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('pairings')
    .insert({ round_id: roundId, tee_time: time })

  if (error) throw new Error('Failed to create tee time')

  revalidatePath(`/events/${eventId}/tee-times`)
}

// 2. DELETE TEE TIME
export async function deleteTeeTime(eventId: string, pairingId: string) {
  const supabase = await createClient()

  await supabase.from('pairings').delete().eq('id', pairingId)
  
  revalidatePath(`/events/${eventId}/tee-times`)
}

// 3. ASSIGN PLAYER TO PAIRING
export async function assignToPairing(eventId: string, pairingId: string, participantId: string) {
  const supabase = await createClient()

  // A. Get the Round ID for this pairing so we can check other times on the same day
  const { data: pairing } = await supabase.from('pairings').select('round_id').eq('id', pairingId).single()
  
  if (pairing) {
    // B. Find all other pairings for this specific round
    const { data: roundPairings } = await supabase.from('pairings').select('id').eq('round_id', pairing.round_id)
    const roundPairingIds = roundPairings?.map(p => p.id) || []

    // C. Remove this player from ANY pairing on this day (prevent duplicates)
    if (roundPairingIds.length > 0) {
      await supabase
        .from('pairing_members')
        .delete()
        .in('pairing_id', roundPairingIds)
        .eq('participant_id', participantId)
    }
  }

  // D. Add to the new pairing
  const { error } = await supabase
    .from('pairing_members')
    .insert({ pairing_id: pairingId, participant_id: participantId })

  if (error) console.error(error)

  revalidatePath(`/events/${eventId}/tee-times`)
}

// 4. REMOVE PLAYER FROM PAIRING
export async function removeFromPairing(eventId: string, pairingId: string, participantId: string) {
  const supabase = await createClient()

  await supabase
    .from('pairing_members')
    .delete()
    .eq('pairing_id', pairingId)
    .eq('participant_id', participantId)

  revalidatePath(`/events/${eventId}/tee-times`)
}