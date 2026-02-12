// app/events/actions.ts
'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

function extractEventIdFromInvite(input: string) {
  const value = input.trim()
  if (!value) return null

  const pathMatch = value.match(/\/events\/([^/?#]+)/i)
  if (pathMatch?.[1]) return pathMatch[1]

  const uuidLike = value.match(/[0-9a-fA-F-]{36}/)
  if (uuidLike?.[0]) return uuidLike[0]

  if (!value.includes('/')) return value

  return null
}

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

export async function joinEventByLink(formData: FormData) {
  const supabase = await createClient()

  const returnToInput = (formData.get('returnTo') as string) || '/events'
  const returnTo = returnToInput.startsWith('/') ? returnToInput : '/events'

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return redirect('/login')

  const inviteLink = (formData.get('inviteLink') as string) || ''
  const eventId = extractEventIdFromInvite(inviteLink)

  if (!eventId) {
    return redirect(`${returnTo}?join=invalid_link`)
  }

  const { data: event } = await supabase
    .from('events')
    .select('id')
    .eq('id', eventId)
    .single()

  if (!event) {
    return redirect(`${returnTo}?join=event_not_found`)
  }

  const { data: existingParticipant } = await supabase
    .from('event_participants')
    .select('id')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existingParticipant) {
    return redirect(`/events/${eventId}/dashboard?join=already`)
  }

  const { error: joinError } = await supabase
    .from('event_participants')
    .insert({
      event_id: eventId,
      user_id: user.id,
      role: 'player'
    })

  if (joinError) {
    console.error('Join event failed:', joinError)
    return redirect(`${returnTo}?join=failed`)
  }

  redirect(`/events/${eventId}/dashboard?join=success`)
}