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