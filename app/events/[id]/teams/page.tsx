import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import { ChevronLeft, Crown, Users } from 'lucide-react'
import { updateTeamStructure, assignPlayer, setCaptain } from './actions'

type ParticipantRow = {
  id: string
  user_id: string
  team_id: string | null
  profiles?: { id?: string; full_name?: string | null } | { id?: string; full_name?: string | null }[] | null
}

function profileOf(participant: ParticipantRow) {
  return Array.isArray(participant.profiles) ? participant.profiles[0] : participant.profiles
}

function participantName(participant: ParticipantRow) {
  return profileOf(participant)?.full_name || 'Golfer'
}

function sortCaptainFirst(members: ParticipantRow[], captainId: string | null | undefined) {
  return [...members].sort((a, b) => {
    const aIsCaptain = captainId && a.user_id === captainId
    const bIsCaptain = captainId && b.user_id === captainId
    if (aIsCaptain && !bIsCaptain) return -1
    if (!aIsCaptain && bIsCaptain) return 1
    return participantName(a).localeCompare(participantName(b))
  })
}

export default async function TeamsPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { id } = await params

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return (
      <main className="min-h-screen bg-club-cream text-club-navy p-6">
        <div className="max-w-md mx-auto bg-white rounded-lg border border-gray-200 p-6 text-center">
          <p className="font-serif text-xl mb-2">Sign in required</p>
          <p className="text-sm text-gray-500 mb-4">Please sign in to view teams.</p>
          <Link href="/login" className="text-club-navy underline">Go to login</Link>
        </div>
      </main>
    )
  }

  const [{ data: event }, { data: participantRole }] = await Promise.all([
    supabase.from('events').select('id, name, created_by').eq('id', id).single(),
    supabase.from('event_participants').select('role').eq('event_id', id).eq('user_id', user.id).maybeSingle(),
  ])

  const isOrganizer = participantRole?.role === 'organizer' || event?.created_by === user.id

  const { data: teamsData } = await supabase
    .from('teams')
    .select('*')
    .eq('event_id', id)
    .order('name', { ascending: true })

  const { data: participantsData } = await supabase
    .from('event_participants')
    .select('id, user_id, team_id, profiles:user_id(id, full_name)')
    .eq('event_id', id)
    .order('created_at', { ascending: true })

  const teams = teamsData || []
  const participants = (participantsData || []) as ParticipantRow[]
  const teamCount = teams.length

  const unassigned = participants
    .filter((p) => !p.team_id)
    .sort((a, b) => participantName(a).localeCompare(participantName(b)))

  const PlayerManagementRow = ({
    participant,
    currentTeamId,
    isCaptain,
  }: {
    participant: ParticipantRow
    currentTeamId: string | null
    isCaptain: boolean
  }) => (
    <div className={`p-3 rounded-sm border mb-2 flex flex-col gap-3 ${isCaptain ? 'bg-club-gold/10 border-club-gold' : 'bg-white border-gray-200'}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {currentTeamId && (
            <form action={async () => {
              'use server'
              await setCaptain(currentTeamId, participant.user_id, id)
            }}>
              <button
                className={`p-1 rounded transition-all ${isCaptain ? 'text-club-gold hover:bg-club-gold/20' : 'text-gray-500 hover:text-club-gold hover:bg-gray-50'}`}
                title={isCaptain ? 'Current Captain' : 'Make Captain'}
              >
                <Crown size={18} fill={isCaptain ? 'currentColor' : 'none'} />
              </button>
            </form>
          )}
          <Link
            href={`/events/${id}/scorecards/player?userId=${participant.user_id}`}
            className="font-serif text-sm text-club-navy hover:underline truncate"
          >
            {participantName(participant)}
          </Link>
        </div>
      </div>

      <form action={async (formData) => {
        'use server'
        const val = formData.get('teamId') as string
        const newTeam = val === 'unassigned' ? null : val
        await assignPlayer(participant.id, newTeam, id)
      }} className="flex gap-2">
        <select
          name="teamId"
          defaultValue={currentTeamId || 'unassigned'}
          className="flex-1 text-xs p-2 border border-gray-300 rounded bg-white text-club-navy"
        >
          <option value="unassigned">Unassigned</option>
          {teams.map((team: any) => (
            <option key={team.id} value={team.id}>{team.name}</option>
          ))}
        </select>
        <button className="bg-club-navy text-white text-xs font-bold px-3 py-2 rounded shadow-sm hover:bg-opacity-90">
          GO
        </button>
      </form>
    </div>
  )

  return (
    <main className="min-h-screen bg-club-cream text-club-navy p-6 pb-20">
      <div className="max-w-6xl mx-auto mb-8 flex items-center gap-4">
        <Link href={`/events/${id}/dashboard`} className="bg-white text-club-navy p-2 rounded-sm border border-club-navy/10 shadow-sm">
          <ChevronLeft size={20} />
        </Link>
        <div>
          <h1 className="font-serif text-2xl text-club-navy">Teams</h1>
          <p className="text-xs text-club-text/60">{event?.name || 'Event'} roster</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto space-y-8">
        <section className="bg-white p-5 rounded-sm shadow-sm border border-gray-200">
          <h2 className="font-serif text-lg mb-1">Team Rosters</h2>
          <p className="text-xs text-club-text/60 mb-4">Captain appears first. Tap any player to view scorecards from every day.</p>

          {teamCount > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {teams.map((team: any) => {
                const members = sortCaptainFirst(
                  participants.filter((participant) => participant.team_id === team.id),
                  team.captain_id
                )

                return (
                  <div key={team.id} className="border border-gray-200 rounded-sm p-4 bg-club-paper">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-serif text-lg text-club-navy">{team.name}</h3>
                      <Users size={16} className="text-club-gold" />
                    </div>

                    {members.length > 0 ? (
                      <div className="space-y-2">
                        {members.map((member) => {
                          const captain = team.captain_id === member.user_id
                          return (
                            <Link
                              key={member.id}
                              href={`/events/${id}/scorecards/player?userId=${member.user_id}`}
                              className="flex items-center justify-between rounded border border-gray-200 bg-white px-3 py-2 text-sm hover:border-club-gold"
                            >
                              <span className="truncate">{participantName(member)}</span>
                              {captain ? <Crown size={14} className="text-club-gold fill-club-gold" /> : null}
                            </Link>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 italic">No players yet</p>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="space-y-2">
              {participants.length > 0 ? participants
                .slice()
                .sort((a, b) => participantName(a).localeCompare(participantName(b)))
                .map((participant) => (
                  <Link
                    key={participant.id}
                    href={`/events/${id}/scorecards/player?userId=${participant.user_id}`}
                    className="flex items-center justify-between rounded border border-gray-200 bg-white px-3 py-2 text-sm hover:border-club-gold"
                  >
                    <span>{participantName(participant)}</span>
                    <span className="text-[10px] text-gray-400 uppercase">Individual</span>
                  </Link>
                )) : <p className="text-sm text-gray-500">No participants found.</p>}
            </div>
          )}
        </section>

        {isOrganizer && (
          <section className="space-y-6">
            <div className="bg-club-paper p-6 rounded-sm shadow-md border-t-4 border-club-gold">
              <div className="flex flex-col md:flex-row md:items-end gap-4 justify-between">
                <div>
                  <h2 className="font-serif text-lg">Organizer Controls</h2>
                  <p className="text-xs text-club-text/60">Manage team count, assignments, and captains.</p>
                </div>
                <form action={async (formData) => {
                  'use server'
                  const count = parseInt(formData.get('count') as string)
                  await updateTeamStructure(id, count)
                }} className="flex gap-2 items-center bg-white p-2 rounded border border-gray-200">
                  <select
                    name="count"
                    defaultValue={teamCount}
                    className="bg-transparent font-serif text-club-navy text-sm outline-none cursor-pointer"
                  >
                    <option value="0">Individual (No Teams)</option>
                    <option value="2">2 Teams</option>
                    <option value="3">3 Teams</option>
                    <option value="4">4 Teams</option>
                    <option value="5">5 Teams</option>
                  </select>
                  <div className="w-[1px] h-6 bg-gray-200 mx-1"></div>
                  <button className="text-club-gold font-bold uppercase text-xs tracking-wider hover:text-club-navy transition-colors">
                    Update Mode
                  </button>
                </form>
              </div>
            </div>

            {teamCount > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-white/50 border border-club-navy/10 p-4 rounded-sm">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-club-text/50 mb-4">Unassigned</h3>
                  {unassigned.map((participant) => (
                    <PlayerManagementRow key={participant.id} participant={participant} currentTeamId={null} isCaptain={false} />
                  ))}
                  {unassigned.length === 0 && (
                    <div className="text-center py-8 opacity-40 text-xs italic">Pool empty</div>
                  )}
                </div>

                {teams.map((team: any) => {
                  const members = sortCaptainFirst(
                    participants.filter((participant) => participant.team_id === team.id),
                    team.captain_id
                  )

                  return (
                    <div key={team.id} className="bg-white border-t-4 border-club-navy p-4 rounded-sm shadow-md h-fit">
                      <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-2">
                        <h3 className="font-serif text-lg font-bold text-club-navy">{team.name}</h3>
                        {team.captain_id ? <Crown size={16} className="text-club-gold fill-club-gold" /> : null}
                      </div>

                      {members.map((participant) => (
                        <PlayerManagementRow
                          key={participant.id}
                          participant={participant}
                          currentTeamId={team.id}
                          isCaptain={team.captain_id === participant.user_id}
                        />
                      ))}

                      {members.length === 0 && (
                        <p className="text-xs text-gray-300 italic text-center py-4">No players yet</p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  )
}
