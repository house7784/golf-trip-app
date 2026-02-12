import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/utils/supabase/server'

function getDisplayName(profile?: { full_name?: string | null; email?: string | null } | null) {
  return profile?.full_name || profile?.email?.split('@')[0] || 'Golfer'
}

function totalScore(holeScores: Record<string, number> | null | undefined) {
  if (!holeScores) return 0
  return Object.values(holeScores).reduce((sum, value) => sum + (Number(value) || 0), 0)
}

export default async function PairScorecardsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ roundId?: string; players?: string }>
}) {
  const supabase = await createClient()
  const { id } = await params
  const query = await searchParams

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return (
      <main className="min-h-screen bg-club-cream text-club-navy p-6">
        <div className="max-w-md mx-auto bg-white rounded-lg border border-gray-200 p-6 text-center">
          <p className="font-serif text-xl mb-2">Sign in required</p>
          <p className="text-sm text-gray-500 mb-4">Please sign in to view scorecards.</p>
          <Link href="/login" className="text-club-navy underline">Go to login</Link>
        </div>
      </main>
    )
  }

  const { data: viewerParticipant } = await supabase
    .from('event_participants')
    .select('id')
    .eq('event_id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!viewerParticipant) {
    return (
      <main className="min-h-screen bg-club-cream text-club-navy p-6">
        <div className="max-w-md mx-auto bg-white rounded-lg border border-gray-200 p-6 text-center">
          <p className="font-serif text-xl mb-2">Access unavailable</p>
          <p className="text-sm text-gray-500 mb-4">You need to be part of this event to view scorecards.</p>
          <Link href="/events" className="text-club-navy underline">Back to events</Link>
        </div>
      </main>
    )
  }

  const requestedPlayerIds = (query?.players || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)

  const playerIds = Array.from(new Set(requestedPlayerIds)).slice(0, 2)

  const { data: roundsData } = await supabase
    .from('rounds')
    .select('id, date, course_name, course_data')
    .eq('event_id', id)
    .not('course_data', 'is', null)
    .order('date')

  const rounds = roundsData || []
  const today = new Date().toISOString().split('T')[0]

  const activeRound = query?.roundId
    ? rounds.find((round: any) => round.id === query.roundId) || rounds[0]
    : rounds.find((round: any) => round.date === today) || rounds[0]

  if (!activeRound) {
    return (
      <main className="min-h-screen bg-club-cream text-club-navy p-6">
        <div className="max-w-md mx-auto bg-white rounded-lg border border-gray-200 p-6 text-center">
          <p className="font-serif text-xl mb-2">No scorecards available</p>
          <p className="text-sm text-gray-500 mb-4">The organizer has not configured a playable round yet.</p>
          <Link href={`/events/${id}/dashboard`} className="text-club-navy underline">Back to dashboard</Link>
        </div>
      </main>
    )
  }

  const { data: participantRows } = await supabase
    .from('event_participants')
    .select('user_id, profiles:user_id(full_name, email)')
    .eq('event_id', id)
    .in('user_id', playerIds.length > 0 ? playerIds : [''])

  const participants = participantRows || []
  const validPlayerIds = participants.map((entry: any) => entry.user_id)

  const { data: scoreRows } = await supabase
    .from('scores')
    .select('user_id, hole_scores')
    .eq('round_id', activeRound.id)
    .in('user_id', validPlayerIds.length > 0 ? validPlayerIds : [''])

  const scoreByUserId = new Map<string, Record<string, number> | null>()
  ;(scoreRows || []).forEach((row: any) => {
    scoreByUserId.set(row.user_id, row.hole_scores || {})
  })

  const holes = Array.isArray(activeRound.course_data?.holes) ? activeRound.course_data.holes : []

  return (
    <main className="min-h-screen bg-club-cream text-club-navy p-6 pb-24">
      <div className="max-w-4xl mx-auto mb-6 flex items-center gap-4 sticky top-0 bg-club-cream py-4 z-10 border-b border-club-gold/10">
        <Link href={`/events/${id}/dashboard#leaderboards`} className="bg-white text-club-navy p-2 rounded-sm border border-club-navy/10 shadow-sm">
          <ChevronLeft size={20} />
        </Link>
        <div>
          <h1 className="font-serif text-2xl text-club-navy">Pair Scorecards</h1>
          <p className="text-xs text-club-text/60">
            {activeRound.course_name || 'Round'} • {new Date(`${activeRound.date}T00:00:00`).toLocaleDateString()}
          </p>
        </div>
      </div>

      {participants.length === 0 ? (
        <div className="max-w-md mx-auto bg-white rounded-lg border border-gray-200 p-6 text-center">
          <p className="font-serif text-xl mb-2">No pair selected</p>
          <p className="text-sm text-gray-500">Pick a pair from the Current Day Leaderboard to view scorecards.</p>
        </div>
      ) : (
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4">
          {participants.map((participant: any) => {
            const playerName = getDisplayName(participant.profiles)
            const scores = scoreByUserId.get(participant.user_id) || {}
            const total = totalScore(scores)

            return (
              <section key={participant.user_id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                  <h2 className="font-serif text-lg text-club-navy truncate">{playerName}</h2>
                  <span className="text-sm font-bold text-club-navy">Total: {total || '--'}</span>
                </div>

                {holes.length > 0 ? (
                  <div className="divide-y divide-gray-100">
                    {holes.map((hole: any) => (
                      <div key={hole.number} className="px-4 py-2 flex items-center justify-between text-sm">
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-club-navy">{hole.number}</span>
                          <span className="text-gray-500 text-xs uppercase">Par {hole.par}</span>
                        </div>
                        <span className="font-semibold text-club-navy">{scores?.[hole.number] ?? '--'}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-sm text-gray-500">No hole setup found for this round.</div>
                )}
              </section>
            )
          })}
        </div>
      )}
    </main>
  )
}
