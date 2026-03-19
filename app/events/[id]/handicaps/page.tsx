import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { updateEventHandicapSettings, updateParticipantEventHandicap } from './actions'

export default async function EventHandicapsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const supabase = await createClient()
  const { id } = await params

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: participant } = await supabase
    .from('event_participants')
    .select('role')
    .eq('event_id', id)
    .eq('user_id', user.id)
    .single()

  const { data: event } = await supabase
    .from('events')
    .select('id, name, start_date, created_by, handicap_cap, handicap_application')
    .eq('id', id)
    .single()

  const isOrganizer = participant?.role === 'organizer' || event?.created_by === user.id
  if (!isOrganizer) redirect(`/events/${id}/dashboard`)

  const { data: participants } = await supabase
    .from('event_participants')
    .select('id, user_id, role, event_handicap, handicap_locked_at, profiles:user_id(full_name, email, handicap_index)')
    .eq('event_id', id)
    .order('created_at', { ascending: true })

  return (
    <main className="min-h-screen bg-club-cream text-club-navy p-6 pb-20">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link href={`/events/${id}/dashboard`} className="bg-white p-2 rounded-sm border border-club-navy/10 shadow-sm">
            <ChevronLeft size={20} />
          </Link>
          <div>
            <h1 className="font-serif text-2xl text-club-navy">Event Handicaps</h1>
            <p className="text-xs text-club-text/60">{event?.name}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
          <h2 className="font-serif text-lg mb-3">Handicap Rules</h2>
          <form action={updateEventHandicapSettings} className="grid gap-4 md:grid-cols-2">
            <input type="hidden" name="eventId" value={id} />

            <div>
              <label className="block text-xs uppercase tracking-wider font-bold text-club-text/60 mb-1">Event Handicap Cap</label>
              <input
                type="number"
                min="0"
                step="0.1"
                name="handicapCap"
                defaultValue={event?.handicap_cap ?? ''}
                placeholder="No cap"
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider font-bold text-club-text/60 mb-1">Application Mode</label>
              <select
                name="handicapApplication"
                defaultValue={event?.handicap_application || 'standard'}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm"
              >
                <option value="standard">Standard Stroke Allocation</option>
                <option value="par3_one_then_next_hardest">Par 3 One Stroke Then Hardest Par 4/5</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <button className="bg-club-navy text-white px-4 py-2 rounded-sm text-xs font-bold uppercase tracking-wider hover:bg-club-gold hover:text-club-navy transition-colors">
                Save Handicap Rules
              </button>
            </div>
          </form>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
          <h2 className="font-serif text-lg mb-3">Per-Player Event Handicap</h2>
          <p className="text-xs text-club-text/60 mb-4">
            One week before event start, handicap snapshots lock into the event. You can override them here any time.
          </p>

          <div className="space-y-3">
            {(participants || []).map((row: any) => {
              const displayName = row.profiles?.full_name || row.profiles?.email?.split('@')[0] || 'Golfer'
              return (
                <form key={row.id} action={updateParticipantEventHandicap} className="p-3 rounded-lg border border-gray-100 bg-gray-50 flex flex-col md:flex-row md:items-center gap-3">
                  <input type="hidden" name="eventId" value={id} />
                  <input type="hidden" name="participantId" value={row.id} />

                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-club-navy truncate">{displayName}</p>
                    <p className="text-xs text-club-text/60">
                      Profile: {row.profiles?.handicap_index ?? 0} • Event: {row.event_handicap ?? 'Auto'}
                      {row.handicap_locked_at ? ` • Locked ${new Date(row.handicap_locked_at).toLocaleDateString()}` : ''}
                    </p>
                  </div>

                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    name="eventHandicap"
                    defaultValue={row.event_handicap ?? ''}
                    placeholder="Auto"
                    className="w-full md:w-32 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  />

                  <button className="bg-club-gold text-club-navy px-4 py-2 rounded-sm text-xs font-bold uppercase tracking-wider hover:bg-club-navy hover:text-white transition-colors">
                    Save
                  </button>
                </form>
              )
            })}
          </div>
        </div>
      </div>
    </main>
  )
}
