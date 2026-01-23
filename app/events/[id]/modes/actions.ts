// app/events/[id]/modes/actions.ts
'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateRoundMode(eventId: string, date: string, modeKey: string) {
  const supabase = await createClient()

  // We use "upsert" - if a round exists for this date, update it. If not, create it.
  const { error } = await supabase
    .from('rounds')
    .upsert(
      { event_id: eventId, date, mode_key: modeKey },
      { onConflict: 'event_id, date' }
    )

  if (error) {
    console.error('Error updating round:', error)
    throw new Error('Failed to update round')
  }

  revalidatePath(`/events/${eventId}/modes`)
}