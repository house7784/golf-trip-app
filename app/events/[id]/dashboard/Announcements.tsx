import { createClient } from '@/utils/supabase/server'
import { Megaphone, Send, Trash2 } from 'lucide-react'
import { postAnnouncement, deleteAnnouncement } from './actions'

export default async function Announcements({ eventId, isOrganizer }: { eventId: string, isOrganizer: boolean }) {
  const supabase = await createClient()

  // Fetch latest messages
  const { data: announcements } = await supabase
    .from('announcements')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6">
      <div className="bg-gray-50 p-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-bold text-club-navy flex items-center gap-2">
              <Megaphone size={18} className="text-club-gold" /> Announcements
          </h3>
      </div>
      
      <div className="p-6 space-y-6">
          {/* Post Form (Organizer Only) */}
          {isOrganizer && (
              <form action={postAnnouncement} className="flex gap-2">
                  <input type="hidden" name="eventId" value={eventId} />
                  <input 
                      type="text" 
                      name="message" 
                      placeholder="Post an update..." 
                      required
                      className="flex-1 bg-gray-50 border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-club-gold"
                  />
                  <button className="bg-club-navy text-white px-4 py-2 rounded-lg hover:bg-club-gold hover:text-club-navy transition-colors">
                      <Send size={16} />
                  </button>
              </form>
          )}

          {/* Message List */}
          <div className="space-y-4">
              {announcements && announcements.length > 0 ? (
                  announcements.map((note: any) => (
                      <div key={note.id} className="flex gap-3 group border-b border-gray-50 pb-2 last:border-0 last:pb-0">
                          <div className="mt-1.5 w-2 h-2 rounded-full bg-club-gold flex-shrink-0" />
                          <div className="flex-1">
                              <p className="text-gray-800 text-sm leading-relaxed">{note.message}</p>
                              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                                  {new Date(note.created_at).toLocaleDateString()}
                              </span>
                          </div>
                          {isOrganizer && (
                              <form action={deleteAnnouncement}>
                                  <input type="hidden" name="id" value={note.id} />
                                  <input type="hidden" name="eventId" value={eventId} />
                                  <button className="text-gray-200 hover:text-red-500 transition-colors">
                                      <Trash2 size={14} />
                                  </button>
                              </form>
                          )}
                      </div>
                  ))
              ) : (
                  <p className="text-gray-400 italic text-sm">No announcements yet.</p>
              )}
          </div>
      </div>
    </div>
  )
}