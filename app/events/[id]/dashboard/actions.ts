'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

const LEADERBOARD_ACTIVATION_MESSAGE = '__SYSTEM__:LEADERBOARD_ACTIVE'

function isSystemAnnouncement(row: any) {
  return row?.message === LEADERBOARD_ACTIVATION_MESSAGE || row?.content === LEADERBOARD_ACTIVATION_MESSAGE || row?.title === LEADERBOARD_ACTIVATION_MESSAGE
}

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

  const { data: event } = await supabase
    .from('events')
    .select('created_by')
    .eq('id', eventId)
    .single()

  const isOrganizer = participant?.role === 'organizer' || event?.created_by === user.id
  if (!isOrganizer) return

  const { error: messageInsertError } = await supabase
    .from('announcements')
    .insert({ event_id: eventId, message })

  if (messageInsertError) {
    const { error: contentInsertError } = await supabase
      .from('announcements')
      .insert({ event_id: eventId, title: 'Announcement', content: message })

    if (contentInsertError) {
      console.error('Announcement post failed:', { messageInsertError, contentInsertError })
      return
    }
  }

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

  const { data: event } = await supabase
    .from('events')
    .select('created_by')
    .eq('id', eventId)
    .single()

  const isOrganizer = participant?.role === 'organizer' || event?.created_by === user.id
  if (!isOrganizer) return

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

  const { data: event } = await supabase
    .from('events')
    .select('created_by')
    .eq('id', eventId)
    .single()

  const isOrganizer = participant?.role === 'organizer' || event?.created_by === user.id
  if (!isOrganizer) return

  const { data: announcementRows } = await supabase
    .from('announcements')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })

  const existing = (announcementRows || []).find(isSystemAnnouncement)

  if (!existing) {
    const { error: messageInsertError } = await supabase
      .from('announcements')
      .insert({ event_id: eventId, message: LEADERBOARD_ACTIVATION_MESSAGE })

    if (messageInsertError) {
      const { error: contentInsertError } = await supabase
        .from('announcements')
        .insert({ event_id: eventId, title: LEADERBOARD_ACTIVATION_MESSAGE, content: LEADERBOARD_ACTIVATION_MESSAGE })

      if (contentInsertError) {
        console.error('Activate leaderboard failed:', { messageInsertError, contentInsertError })
        return
      }
    }
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

  const { data: event } = await supabase
    .from('events')
    .select('created_by')
    .eq('id', eventId)
    .single()

  const isOrganizer = participant?.role === 'organizer' || event?.created_by === user.id
  if (!isOrganizer) return

  const { data: rows } = await supabase
    .from('announcements')
    .select('id, message, content, title')
    .eq('event_id', eventId)

  const idsToDelete = (rows || [])
    .filter(isSystemAnnouncement)
    .map((row: any) => row.id)

  if (idsToDelete.length > 0) {
    await supabase
      .from('announcements')
      .delete()
      .in('id', idsToDelete)
  }

  revalidatePath(`/events/${eventId}/dashboard`)
  revalidatePath(`/events/${eventId}/announcements`)
}