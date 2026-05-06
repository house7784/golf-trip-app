import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import ChallengesClient from './ChallengesClient'

export default async function ChallengesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: participantsData }, { data: challengesData }, { data: event }, { data: myParticipant }] = await Promise.all([
    supabase
      .from('event_participants')
      .select('id, user_id, profiles:user_id(id, full_name, email)')
      .eq('event_id', id),
    supabase
      .from('challenges')
      .select('*')
      .eq('event_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('events')
      .select('id, name, created_by')
      .eq('id', id)
      .single(),
    supabase
      .from('event_participants')
      .select('role')
      .eq('event_id', id)
      .eq('user_id', user.id)
      .maybeSingle(),
  ])

  const isOrganizer = myParticipant?.role === 'organizer' || event?.created_by === user.id

  return (
    <ChallengesClient
      eventId={id}
      eventName={event?.name ?? 'Event'}
      currentUserId={user.id}
      participants={(participantsData ?? []) as any[]}
      challenges={(challengesData ?? []) as any[]}
      isOrganizer={isOrganizer}
    />
  )
}
