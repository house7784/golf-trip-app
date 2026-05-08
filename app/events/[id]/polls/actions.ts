'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

async function getEventAccess(eventId: string, userId: string) {
  const supabase = await createClient()
  const { data: participant } = await supabase
    .from('event_participants')
    .select('role')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .maybeSingle()

  const isParticipant = Boolean(participant)
  const isOrganizer = participant?.role === 'organizer'

  return { isParticipant, isOrganizer }
}

function parseOptions(raw: string) {
  return Array.from(
    new Set(
      raw
        .split(/\r?\n|,/) 
        .map((value) => value.trim())
        .filter(Boolean)
    )
  )
}

function parseCloseTime(raw: string | null | undefined) {
  const value = (raw || '').trim()
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString()
}

export async function createPoll(
  eventId: string,
  question: string,
  description: string,
  optionsRaw: string,
  closeAtRaw?: string | null
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const { isOrganizer } = await getEventAccess(eventId, user.id)
  if (!isOrganizer) return { error: 'Only organizers can create polls' }

  const trimmedQuestion = question.trim()
  if (!trimmedQuestion) return { error: 'Question is required' }

  const options = parseOptions(optionsRaw)
  const closesAt = parseCloseTime(closeAtRaw)

  if (closeAtRaw && !closesAt) {
    return { error: 'Invalid close time' }
  }

  const { error } = await supabase.from('event_polls').insert({
    event_id: eventId,
    question: trimmedQuestion,
    description: description.trim() || null,
    options,
    closes_at: closesAt,
    require_response: true,
    is_enabled: true,
    created_by: user.id,
  })

  if (error) return { error: error.message }

  revalidatePath(`/events/${eventId}/polls`)
  revalidatePath(`/events/${eventId}/dashboard`)
  revalidatePath(`/events/${eventId}`)
  return { success: true }
}

export async function togglePollEnabled(eventId: string, pollId: string, isEnabled: boolean) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const { isOrganizer } = await getEventAccess(eventId, user.id)
  if (!isOrganizer) return { error: 'Only organizers can update polls' }

  const { error } = await supabase
    .from('event_polls')
    .update({
      is_enabled: isEnabled,
      disabled_at: isEnabled ? null : new Date().toISOString(),
    })
    .eq('id', pollId)
    .eq('event_id', eventId)

  if (error) return { error: error.message }

  revalidatePath(`/events/${eventId}/polls`)
  revalidatePath(`/events/${eventId}/dashboard`)
  revalidatePath(`/events/${eventId}`)
  return { success: true }
}

export async function deletePoll(eventId: string, pollId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const { isOrganizer } = await getEventAccess(eventId, user.id)
  if (!isOrganizer) return { error: 'Only organizers can delete polls' }

  const { error } = await supabase
    .from('event_polls')
    .delete()
    .eq('id', pollId)
    .eq('event_id', eventId)

  if (error) return { error: error.message }

  revalidatePath(`/events/${eventId}/polls`)
  revalidatePath(`/events/${eventId}/dashboard`)
  revalidatePath(`/events/${eventId}`)
  return { success: true }
}

export async function submitPollResponse(eventId: string, pollId: string, selectedOption?: string | null, responseText?: string | null) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const { isParticipant } = await getEventAccess(eventId, user.id)
  if (!isParticipant) return { error: 'Not part of this event' }

  const { data: poll } = await supabase
    .from('event_polls')
    .select('id, event_id, options, is_enabled, require_response, closes_at')
    .eq('id', pollId)
    .eq('event_id', eventId)
    .maybeSingle()

  if (!poll) return { error: 'Poll not found' }
  if (!poll.is_enabled) return { error: 'This poll is no longer active' }
  if (poll.closes_at && new Date(poll.closes_at).getTime() <= Date.now()) {
    return { error: 'This poll has expired' }
  }

  const option = (selectedOption || '').trim()
  const text = (responseText || '').trim()

  if (!option && !text) return { error: 'Answer is required' }

  const pollOptions = Array.isArray(poll.options) ? poll.options.map((value) => String(value)) : []
  if (option && pollOptions.length > 0 && !pollOptions.includes(option)) {
    return { error: 'Invalid option selected' }
  }

  const { error } = await supabase
    .from('event_poll_responses')
    .upsert(
      {
        poll_id: pollId,
        event_id: eventId,
        user_id: user.id,
        selected_option: option || null,
        response_text: text || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'poll_id, user_id' }
    )

  if (error) return { error: error.message }

  revalidatePath(`/events/${eventId}/polls`)
  revalidatePath(`/events/${eventId}/dashboard`)
  revalidatePath(`/events/${eventId}`)
  return { success: true }
}
