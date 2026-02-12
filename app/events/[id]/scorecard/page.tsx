// app/events/[id]/scorecard/page.tsx
import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import { ChevronLeft, Save } from 'lucide-react'
import { submitScore } from './actions'

function samePair(slotA: number, slotB: number) {
  return (slotA <= 2 && slotB <= 2) || (slotA >= 3 && slotB >= 3)
}

export default async function ScorecardPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ roundId?: string; playerId?: string; scope?: string }>
}) {
  const supabase = await createClient()
  const { id } = await params
  const query = await searchParams
  const { data: { user } } = await supabase.auth.getUser()

  // 1. Get Today's Round (We'll assume the most recent or active one for simplicity)
  // Ideally, you'd select the round, but for now, let's grab the first one that has course data
  const { data: rounds } = await supabase
    .from('rounds')
    .select('*')
    .eq('event_id', id)
    .not('course_data', 'is', null)
    .order('date')

  const activeRound = query?.roundId
    ? rounds?.find((round: any) => round.id === query.roundId) || rounds?.[0]
    : rounds?.[0]

  if (!activeRound) {
    return (
        <div className="min-h-screen bg-club-cream p-6 flex flex-col items-center justify-center text-center">
            <p className="font-serif text-xl mb-2">No Course Data Found</p>
            <p className="text-sm text-gray-500 mb-6">The organizer hasn't set up the course yet.</p>
            <Link href={`/events/${id}/dashboard`} className="text-club-navy underline">Back to Dashboard</Link>
        </div>
    )
  }

  const course = activeRound.course_data

  const { data: event } = await supabase
    .from('events')
    .select('created_by')
    .eq('id', id)
    .single()

  const { data: participant } = await supabase
    .from('event_participants')
    .select('role')
    .eq('event_id', id)
    .eq('user_id', user?.id)
    .single()

  const isOrganizer = participant?.role === 'organizer' || event?.created_by === user?.id

  const { data: captainTeam } = await supabase
    .from('teams')
    .select('id')
    .eq('event_id', id)
    .eq('captain_id', user?.id)
    .maybeSingle()

  const isCaptain = Boolean(captainTeam?.id)
  const isTeamManageMode = query?.scope === 'team' && (isCaptain || isOrganizer)

  const { data: roundData } = await supabase
    .from('rounds')
    .select('scoring_locked')
    .eq('id', activeRound.id)
    .single()

  const scoringLocked = Boolean(roundData?.scoring_locked)

  const { data: participants } = await supabase
    .from('event_participants')
    .select('user_id, team_id, profiles:user_id(full_name, email)')
    .eq('event_id', id)

  const participantById = new Map<string, any>()
  ;(participants || []).forEach((entry: any) => participantById.set(entry.user_id, entry))

  const { data: pairings } = await supabase
    .from('pairings')
    .select('tee_time_id, slot_number, player_id, tee_times!inner(round_id)')
    .eq('tee_times.round_id', activeRound.id)

  const actorPair = (pairings || []).find((entry: any) => entry.player_id === user?.id)

  const editableUserIds = new Set<string>()
  if (user?.id) editableUserIds.add(user.id)

  const partnerEditableUserIds = new Set<string>()
  if (user?.id) partnerEditableUserIds.add(user.id)

  if (actorPair) {
    ;(pairings || []).forEach((entry: any) => {
      if (!entry.player_id) return
      if (entry.tee_time_id === actorPair.tee_time_id && samePair(entry.slot_number, actorPair.slot_number)) {
        editableUserIds.add(entry.player_id)
        partnerEditableUserIds.add(entry.player_id)
      }
    })
  }

  if (isCaptain && captainTeam?.id) {
    ;(participants || []).forEach((entry: any) => {
      if (entry.team_id === captainTeam.id) editableUserIds.add(entry.user_id)
    })
  }

  if (isOrganizer) {
    ;(participants || []).forEach((entry: any) => editableUserIds.add(entry.user_id))
  }

  const selectableUserIds = isTeamManageMode ? editableUserIds : partnerEditableUserIds

  const editablePlayers = Array.from(selectableUserIds)
    .map((playerId) => ({
      id: playerId,
      name:
        participantById.get(playerId)?.profiles?.full_name ||
        participantById.get(playerId)?.profiles?.email?.split('@')[0] ||
        'Golfer',
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const selectedPlayerId =
    query?.playerId && selectableUserIds.has(query.playerId)
      ? query.playerId
      : user?.id || ''

  const canEditSelected = isOrganizer || !scoringLocked
  
  // 2. Get Existing Scores for this user
  const { data: existingScore } = await supabase
    .from('scores')
    .select('hole_scores')
    .eq('round_id', activeRound.id)
    .eq('user_id', selectedPlayerId)
    .single()

  const scores = existingScore?.hole_scores || {}

  return (
    <main className="min-h-screen bg-club-cream text-club-navy p-6 pb-24">
      {/* Header */}
      <div className="max-w-md mx-auto mb-6 flex items-center gap-4 sticky top-0 bg-club-cream py-4 z-10 border-b border-club-gold/10">
        <Link href={`/events/${id}/dashboard`} className="bg-white text-club-navy p-2 rounded-sm border border-club-navy/10 shadow-sm">
          <ChevronLeft size={20} />
        </Link>
        <div>
          <h1 className="font-serif text-2xl text-club-navy">Enter Scores</h1>
          <p className="text-xs text-club-text/60">{activeRound.course_name}</p>
        </div>
      </div>

      {!isTeamManageMode && editablePlayers.length > 0 && (
        <div className="max-w-md mx-auto mb-4">
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <label className="block text-xs uppercase tracking-wider font-bold text-club-text/60 mb-2">
              Scoring For (You + Partner)
            </label>
            <div className="grid grid-cols-2 gap-2">
              {editablePlayers.map((entry) => {
                const isActive = entry.id === selectedPlayerId
                if (isActive) {
                  return (
                    <Link
                      key={entry.id}
                      href={`/events/${id}/scorecard?roundId=${activeRound.id}&playerId=${entry.id}`}
                      className="text-center px-3 py-2 rounded-lg text-sm font-bold tracking-wide border border-club-navy bg-club-navy text-white transition-colors"
                    >
                      {entry.name}
                    </Link>
                  )
                }

                return (
                  <Link
                    key={entry.id}
                    href={`/events/${id}/scorecard?roundId=${activeRound.id}&playerId=${entry.id}`}
                    className="text-center px-3 py-2 rounded-lg text-sm font-semibold tracking-wide border border-gray-300 bg-white text-club-navy hover:border-club-gold hover:bg-club-paper/50 transition-colors"
                  >
                    {entry.name}
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {isTeamManageMode && editablePlayers.length > 1 && (
        <div className="max-w-md mx-auto mb-4">
          <form method="get" className="bg-white rounded-lg border border-gray-200 p-3">
            <input type="hidden" name="roundId" value={activeRound.id} />
            <input type="hidden" name="scope" value="team" />
            <label className="block text-xs uppercase tracking-wider font-bold text-club-text/60 mb-2">
              Manage Team Scores
            </label>
            <div className="flex items-center gap-2">
              <select
                name="playerId"
                defaultValue={selectedPlayerId}
                className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm"
              >
                {editablePlayers.map((entry) => (
                  <option key={entry.id} value={entry.id}>{entry.name}</option>
                ))}
              </select>
              <button className="bg-club-navy text-white px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-club-gold hover:text-club-navy transition-colors">
                Load
              </button>
            </div>
          </form>
        </div>
      )}

      {scoringLocked && !isOrganizer && (
        <div className="max-w-md mx-auto mb-4 bg-white border border-red-200 p-3 rounded-sm text-sm text-red-700">
          Scores are locked by the organizer for this round.
        </div>
      )}

      {/* SCORECARD FORM */}
      <div className="max-w-md mx-auto">
        <form key={`${activeRound.id}:${selectedPlayerId}`} action={async (formData) => {
            'use server'
            const newScores: any = {}
            // Extract scores from form
            for (let i = 1; i <= 18; i++) {
                const val = formData.get(`hole_${i}`)
                if (val) newScores[i] = parseInt(val as string)
            }
            await submitScore(id, activeRound.id, formData.get('playerId') as string, newScores)
        }}>
            <input type="hidden" name="playerId" value={selectedPlayerId} />
            
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                {course.holes.map((hole: any) => {
                    const currentVal = scores[hole.number]
                    
                    // Style logic for score (Birdie, Bogey, etc)
                    let scoreColor = 'text-club-navy'
                    if (currentVal) {
                        if (currentVal < hole.par) scoreColor = 'text-red-500 font-bold' // Birdie
                        if (currentVal > hole.par) scoreColor = 'text-blue-500' // Bogey
                    }

                    return (
                        <div key={hole.number} className="flex items-center border-b border-gray-100 last:border-0 p-3">
                            {/* Hole Info */}
                            <div className="w-16 flex flex-col items-center justify-center border-r border-gray-100 pr-3">
                                <span className="font-serif text-xl font-bold">{hole.number}</span>
                                <span className="text-[10px] text-gray-400 uppercase">Par {hole.par}</span>
                            </div>

                            {/* Input Area */}
                            <div className="flex-1 flex items-center justify-center">
                                <input 
                                    name={`hole_${hole.number}`}
                                    type="number" 
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    defaultValue={currentVal}
                                    placeholder="-"
                                    disabled={!canEditSelected}
                                    className={`w-full text-center text-2xl outline-none bg-transparent ${scoreColor}`}
                                />
                            </div>

                            {/* HCP Helper */}
                            <div className="w-12 text-center text-[10px] text-gray-300">
                                HCP<br/>{hole.hcp}
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Floating Save Button */}
            <div className="fixed bottom-6 left-0 right-0 px-6 max-w-md mx-auto">
              <button disabled={!canEditSelected} className="w-full bg-club-navy text-white py-4 rounded-lg shadow-xl font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-club-gold transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    <Save size={18} />
                    Save Card
                </button>
            </div>

        </form>
      </div>
    </main>
  )
}