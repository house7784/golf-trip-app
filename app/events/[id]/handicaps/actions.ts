'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

async function isEventOrganizer(eventId: string, userId: string) {
  const supabase = await createClient()

  const { data: participant } = await supabase
    .from('event_participants')
    .select('role')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .single()

  const { data: event } = await supabase
    .from('events')
    .select('created_by')
    .eq('id', eventId)
    .single()

  return participant?.role === 'organizer' || event?.created_by === userId
}

export async function updateEventHandicapSettings(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const eventId = (formData.get('eventId') as string) || ''
  const capInput = (formData.get('handicapCap') as string) || ''
  const applicationMode = (formData.get('handicapApplication') as string) || 'standard'

  if (!eventId) return
  if (!(await isEventOrganizer(eventId, user.id))) return

  const handicapCap = capInput === '' ? null : Math.max(0, Number(capInput))
  const mode = applicationMode === 'par3_one_then_next_hardest' ? 'par3_one_then_next_hardest' : 'standard'

  const { error } = await supabase
    .from('events')
    .update({
      handicap_cap: handicapCap,
      handicap_application: mode,
    })
    .eq('id', eventId)

  if (error) {
    console.error('Update handicap settings failed:', error)
  }

  revalidatePath(`/events/${eventId}/dashboard`)
  revalidatePath(`/events/${eventId}/handicaps`)
}

export async function updateParticipantEventHandicap(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const eventId = (formData.get('eventId') as string) || ''
  const participantId = (formData.get('participantId') as string) || ''
  const value = (formData.get('eventHandicap') as string) || ''

  if (!eventId || !participantId) return
  if (!(await isEventOrganizer(eventId, user.id))) return

  const parsed = value.trim() === '' ? null : Math.max(0, Number(value))

  const { error } = await supabase
    .from('event_participants')
    .update({
      event_handicap: parsed,
      handicap_locked_at: parsed === null ? null : new Date().toISOString(),
    })
    .eq('id', participantId)

  if (error) {
    console.error('Update participant event handicap failed:', error)
  }

  revalidatePath(`/events/${eventId}/dashboard`)
  revalidatePath(`/events/${eventId}/handicaps`)
}
