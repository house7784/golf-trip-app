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

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return redirect('/login')

  // Ensure a profile row exists for FK/RLS policies that depend on profiles.id.
  const metadataFullName =
    typeof user.user_metadata?.full_name === 'string'
      ? user.user_metadata.full_name.trim()
      : null
  const { error: profileEnsureError } = await supabase
    .from('profiles')
    .upsert(
      {
        id: user.id,
        full_name: metadataFullName || null,
      },
      { onConflict: 'id' }
    )

  if (profileEnsureError) {
    console.error(profileEnsureError)
    return redirect('/events/create?error=Could not prepare profile for event creation.')
  }

  const name = ((formData.get('name') as string) || '').trim()
  const location = ((formData.get('location') as string) || '').trim()
  const startDate = ((formData.get('start_date') as string) || (formData.get('startDate') as string) || '').trim()
  const endDate = ((formData.get('end_date') as string) || (formData.get('endDate') as string) || '').trim()

  if (!name || !location || !startDate || !endDate) {
    return redirect('/events/create?error=Please fill in all event fields.')
  }
  
  // 1. Generate a random 6-character code
  const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase()

  // 2. Insert Event with the Code
  // Some deployments may not have events.location yet.
  let event: any = null

  const insertWithLocation = await supabase
    .from('events')
    .insert({
      name,
      location,
      start_date: startDate,
      end_date: endDate,
      invite_code: inviteCode,
      created_by: user.id,
    })
    .select()
    .single()

  if (insertWithLocation.error?.message?.includes("Could not find the 'location' column")) {
    const fallbackInsert = await supabase
      .from('events')
      .insert({
        name,
        start_date: startDate,
        end_date: endDate,
        invite_code: inviteCode,
        created_by: user.id,
      })
      .select()
      .single()

    event = fallbackInsert.data

    if (fallbackInsert.error) {
      console.error(fallbackInsert.error)
      const details = encodeURIComponent(fallbackInsert.error.message || 'Unknown error')
      return redirect(`/events/create?error=Could not create event: ${details}`)
    }
  } else {
    event = insertWithLocation.data
    if (insertWithLocation.error) {
      console.error(insertWithLocation.error)
      const details = encodeURIComponent(insertWithLocation.error.message || 'Unknown error')
      return redirect(`/events/create?error=Could not create event: ${details}`)
    }
  }

  // 3. Add Creator as Organizer
  const { error: participantError } = await supabase.from('event_participants').insert({
    event_id: event.id,
    user_id: user.id,
    role: 'organizer'
  })

  if (participantError) {
    console.error(participantError)
    return redirect('/events/create?error=Event created, but organizer setup failed. Please retry.')
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