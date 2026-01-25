'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

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