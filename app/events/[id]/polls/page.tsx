import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import PollsClient from './PollsClient'
import type { Participant, Poll, PollResponse } from './PollsClient'

export default async function PollsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: event }, { data: myParticipant }] = await Promise.all([
    supabase.from('events').select('id, name').eq('id', id).single(),
    supabase
      .from('event_participants')
      .select('role')
      .eq('event_id', id)
      .eq('user_id', user.id)
      .maybeSingle(),
  ])

  if (!event) {
    return <div className="p-6 text-sm text-gray-500">Event not found.</div>
  }

  const isOrganizer = myParticipant?.role === 'organizer'
  if (!isOrganizer) {
    redirect(`/events/${id}/dashboard`)
  }

  const [{ data: pollsData }, { data: responsesData }, { data: participantsData }] = await Promise.all([
    supabase
      .from('event_polls')
      .select('*')
      .eq('event_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('event_poll_responses')
      .select('*')
      .eq('event_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('event_participants')
      .select('user_id, profiles:user_id(full_name, email)')
      .eq('event_id', id),
  ])

  return (
    <PollsClient
      eventId={id}
      eventName={event.name}
      polls={(pollsData || []) as Poll[]}
      responses={(responsesData || []) as PollResponse[]}
      participants={(participantsData || []) as Participant[]}
    />
  )
}
