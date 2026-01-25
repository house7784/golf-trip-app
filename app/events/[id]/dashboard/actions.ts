'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function postAnnouncement(formData: FormData) {
  const supabase = await createClient()
  
  const eventId = formData.get('eventId') as string
  const message = formData.get('message') as string

  if (!eventId || !message) return

  await supabase.from('announcements').insert({ event_id: eventId, message })
  revalidatePath(`/events/${eventId}/dashboard`)
}

export async function deleteAnnouncement(formData: FormData) {
  const supabase = await createClient()
  const id = formData.get('id') as string
  const eventId = formData.get('eventId') as string

  if (!id) return

  await supabase.from('announcements').delete().eq('id', id)
  revalidatePath(`/events/${eventId}/dashboard`)
}