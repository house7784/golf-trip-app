// app/events/actions.ts
'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export async function createEvent(formData: FormData) {
  const supabase = await createClient()
  
  // 1. Get current user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return redirect('/login')

  const name = formData.get('name') as string
  const startDate = formData.get('startDate') as string
  const endDate = formData.get('endDate') as string

  // 2. Create the Event
  const { data: event, error: eventError } = await supabase
    .from('events')
    .insert({
      name,
      start_date: startDate,
      end_date: endDate,
      created_by: user.id
    })
    .select()
    .single()

  if (eventError) {
    console.error('Event creation failed:', eventError)
    return redirect('/?error=Event creation failed')
  }

  // 3. Add the Creator as the "Organizer"
  const { error: participantError } = await supabase
    .from('event_participants')
    .insert({
      event_id: event.id,
      user_id: user.id,
      role: 'organizer'
    })

  if (participantError) {
    console.error('Participant link failed:', participantError)
  }

  // 4. Redirect to the new "God Mode" Dashboard
  redirect(`/events/${event.id}/dashboard`)
}