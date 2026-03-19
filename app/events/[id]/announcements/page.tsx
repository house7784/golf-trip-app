import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Megaphone, Send, Trash2 } from 'lucide-react'
import { postAnnouncement, deleteAnnouncement } from '../dashboard/actions'

const LEADERBOARD_ACTIVATION_MESSAGE = '__SYSTEM__:LEADERBOARD_ACTIVE'

function isSystemAnnouncement(row: any) {
  return row?.message === LEADERBOARD_ACTIVATION_MESSAGE || row?.content === LEADERBOARD_ACTIVATION_MESSAGE || row?.title === LEADERBOARD_ACTIVATION_MESSAGE
}

export default async function AnnouncementsPage({
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
    .eq('user_id', user?.id)
    .single()

  const isOrganizer = participant?.role === 'organizer'

  const { data: announcements } = await supabase
    .from('announcements')
    .select('*')
    .eq('event_id', id)
    .order('created_at', { ascending: false })

  const visibleAnnouncements = (announcements || []).filter((note: any) => !isSystemAnnouncement(note))

  return (
    <main className="min-h-screen bg-club-cream text-club-navy p-6 pb-20">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link href={`/events/${id}/dashboard`} className="bg-white p-2 rounded-sm border border-club-navy/10 shadow-sm">
            <ChevronLeft size={20} />
          </Link>
          <div>
            <h1 className="font-serif text-2xl text-club-navy">All Announcements</h1>
            <p className="text-xs text-club-text/60">Event updates from your organizer</p>
          </div>
        </div>

        {isOrganizer && (
          <form action={postAnnouncement} className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex gap-2">
            <input type="hidden" name="eventId" value={id} />
            <input
              type="text"
              name="message"
              placeholder="Post an announcement..."
              required
              className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-club-gold"
            />
            <button className="bg-club-gold text-club-navy border border-club-navy/20 px-4 py-2 rounded-lg hover:bg-club-navy hover:text-white transition-colors">
              <Send size={16} />
            </button>
          </form>
        )}

        {visibleAnnouncements.length > 0 ? (
          <div className="space-y-3">
            {visibleAnnouncements.map((note: any) => (
              <div key={note.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                <div className="flex items-start gap-3">
                  <Megaphone className="text-club-gold shrink-0 mt-1" size={16} />
                  <div className="flex-1">
                    <p className="text-sm text-club-text">{note.message || note.content || note.title}</p>
                    <p className="text-[10px] text-gray-300 mt-2">
                      {new Date(note.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  {isOrganizer && (
                    <form action={deleteAnnouncement}>
                      <input type="hidden" name="id" value={note.id} />
                      <input type="hidden" name="eventId" value={id} />
                      <button className="text-gray-200 hover:text-red-500 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </form>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white/50 p-6 rounded-lg border border-dashed border-gray-300 text-center">
            <p className="text-sm text-gray-400 italic">No announcements yet.</p>
          </div>
        )}
      </div>
    </main>
  )
}
