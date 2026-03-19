'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export async function createEvent(formData: FormData) {
  const supabase = await createClient()

  const name = formData.get('name') as string
  const location = formData.get('location') as string
  const startDate = formData.get('start_date') as string
  const endDate = formData.get('end_date') as string
  
  // 1. Generate a random 6-character code
  const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase()

  // 2. Insert Event with the Code
  const { data: event, error } = await supabase
    .from('events')
    .insert({
      name,
      location,
      start_date: startDate,
      end_date: endDate,
      invite_code: inviteCode // <--- ADD THIS
    })
    .select()
    .single()

  if (error) {
    console.error(error)
    return
  }

  // 3. Add Creator as Organizer
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    await supabase.from('event_participants').insert({
      event_id: event.id,
      user_id: user.id,
      role: 'organizer'
    })
  }

  redirect(`/events/${event.id}/dashboard`)
}