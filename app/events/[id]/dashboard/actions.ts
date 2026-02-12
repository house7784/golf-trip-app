'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export const LEADERBOARD_ACTIVATION_MESSAGE = '__SYSTEM__:LEADERBOARD_ACTIVE'

export async function postAnnouncement(formData: FormData) {
  const supabase = await createClient()
  
  const eventId = formData.get('eventId') as string
  const message = formData.get('message') as string

  if (!eventId || !message) return

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data: participant } = await supabase
    .from('event_participants')
    .select('role')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .single()

  if (participant?.role !== 'organizer') return

  await supabase.from('announcements').insert({ event_id: eventId, message })
  revalidatePath(`/events/${eventId}/dashboard`)
  revalidatePath(`/events/${eventId}/announcements`)
}

export async function deleteAnnouncement(formData: FormData) {
  const supabase = await createClient()
  const id = formData.get('id') as string
  const eventId = formData.get('eventId') as string

  if (!id || !eventId) return

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data: participant } = await supabase
    .from('event_participants')
    .select('role')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .single()

  if (participant?.role !== 'organizer') return

  await supabase.from('announcements').delete().eq('id', id)
  revalidatePath(`/events/${eventId}/dashboard`)
  revalidatePath(`/events/${eventId}/announcements`)
}

export async function activateLeaderboard(formData: FormData) {
  const supabase = await createClient()
  const eventId = formData.get('eventId') as string

  if (!eventId) return

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data: participant } = await supabase
    .from('event_participants')
    .select('role')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .single()

  if (participant?.role !== 'organizer') return

  const { data: existing } = await supabase
    .from('announcements')
    .select('id')
    .eq('event_id', eventId)
    .eq('message', LEADERBOARD_ACTIVATION_MESSAGE)
    .maybeSingle()

  if (!existing) {
    await supabase
      .from('announcements')
      .insert({ event_id: eventId, message: LEADERBOARD_ACTIVATION_MESSAGE })
  }

  revalidatePath(`/events/${eventId}/dashboard`)
  revalidatePath(`/events/${eventId}/announcements`)
}

export async function deactivateLeaderboard(formData: FormData) {
  const supabase = await createClient()
  const eventId = formData.get('eventId') as string

  if (!eventId) return

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data: participant } = await supabase
    .from('event_participants')
    .select('role')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .single()

  if (participant?.role !== 'organizer') return

  await supabase
    .from('announcements')
    .delete()
    .eq('event_id', eventId)
    .eq('message', LEADERBOARD_ACTIVATION_MESSAGE)

  revalidatePath(`/events/${eventId}/dashboard`)
  revalidatePath(`/events/${eventId}/announcements`)
}