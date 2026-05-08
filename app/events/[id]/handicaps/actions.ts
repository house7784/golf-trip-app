'use server'

import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

async function isEventOrganizer(eventId: string, userId: string) {
  const supabase = await createClient()

  const { data: participant } = await supabase
    .from('event_participants')
    .select('role')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .maybeSingle()

  const { data: event } = await supabase
    .from('events')
    .select('created_by')
    .eq('id', eventId)
    .maybeSingle()

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
  if (!(await isEventOrganizer(eventId, user.id))) {
    redirect(`/events/${eventId}/handicaps?status=error&message=${encodeURIComponent('Not authorized to update handicap rules.')}`)
  }

  const parsedCap = capInput.trim() === '' ? null : Number(capInput)
  const handicapCap = parsedCap === null ? null : Math.max(0, parsedCap)
  if (parsedCap !== null && !Number.isFinite(parsedCap)) {
    redirect(`/events/${eventId}/handicaps?status=error&message=${encodeURIComponent('Handicap cap must be a valid number.')}`)
  }
  const mode = applicationMode === 'par3_one_then_next_hardest' ? 'par3_one_then_next_hardest' : 'standard'

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    redirect(`/events/${eventId}/handicaps?status=error&message=${encodeURIComponent('Missing Supabase service-role configuration.')}`)
  }

  const adminSupabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  const { data: updatedRows, error } = await adminSupabase
    .from('events')
    .update({
      handicap_cap: handicapCap,
      handicap_application: mode,
    })
    .eq('id', eventId)
    .select('id')

  if (error) {
    console.error('Update handicap settings failed:', error)
    redirect(`/events/${eventId}/handicaps?status=error&message=${encodeURIComponent(error.message || 'Failed to save handicap rules.')}`)
  }

  if (!updatedRows || updatedRows.length === 0) {
    redirect(
      `/events/${eventId}/handicaps?status=error&message=${encodeURIComponent(
        'No rows were updated. Check event update permissions (RLS policy).'
      )}`
    )
  }

  revalidatePath(`/events/${eventId}/dashboard`)
  revalidatePath(`/events/${eventId}/handicaps`)

  redirect(`/events/${eventId}/handicaps?status=saved`)
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
