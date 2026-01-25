'use client'

import { useState, useEffect, useRef } from 'react'
import { MessageCircle, X, Send } from 'lucide-react'
import { createClient } from '../../../../utils/supabase/client'
import { sendMessage } from './actions'

export default function TrashTalk({ eventId, currentUser }: any) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<any[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [unreadCount, setUnreadCount] = useState(0) // <--- NEW: Track unread messages
  const scrollRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  // 1. Load messages & Subscribe
  useEffect(() => {
    const fetchMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*, profiles(email, handicap)')
        .eq('event_id', eventId)
        .order('created_at', { ascending: true })
      
      if (data) setMessages(data)
    }

    fetchMessages()

    const channel = supabase
      .channel('trash_talk')
      .on(
        'postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `event_id=eq.${eventId}` }, 
        (payload) => {
          fetchMessages() // Always get the new data
          
          // NEW LOGIC: If chat is CLOSED and it wasn't me who sent it -> Add Red Dot
          if (!isOpen && payload.new.user_id !== currentUser.id) {
            setUnreadCount((prev) => prev + 1)
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [eventId, isOpen]) // <--- Added 'isOpen' dependency so the listener knows the current state

  // Scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isOpen])

  // Clear notifications when opening
  const handleOpen = () => {
    setIsOpen(true)
    setUnreadCount(0)
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim()) return
    
    // Optimistic UI
    const tempMsg = {
        id: Math.random(),
        content: newMessage,
        user_id: currentUser.id,
        created_at: new Date().toISOString(),
        profiles: { email: currentUser.email }
    }
    setMessages([...messages, tempMsg])
    const msgToSend = newMessage
    setNewMessage('')
    
    await sendMessage(eventId, msgToSend)
  }

  const getName = (email: string) => email ? email.split('@')[0] : 'Golfer'

  return (
    <>
      <button 
        onClick={handleOpen} // Changed to handleOpen
        className="fixed bottom-6 right-6 bg-club-gold text-club-navy p-4 rounded-full shadow-2xl hover:scale-110 transition-transform z-40 border-4 border-club-navy group relative"
      >
        <MessageCircle size={32} strokeWidth={2.5} />
        
        {/* --- THE RED DOT --- */}
        {unreadCount > 0 && (
            <div className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-bold w-6 h-6 flex items-center justify-center rounded-full border-2 border-club-navy animate-bounce">
                {unreadCount > 9 ? '9+' : unreadCount}
            </div>
        )}
      </button>

      {isOpen && (
        <div 
            className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-slide-in-right border-l-4 border-club-gold"
          >
            
            {/* Header */}
            <div className="bg-club-navy p-4 flex justify-between items-center text-white border-b border-white/10">
              <div>
                <h2 className="font-serif text-xl font-bold tracking-wide">Trash Talk</h2>
                <p className="text-xs text-club-gold font-bold uppercase tracking-wider">Live Chat</p>
              </div>
              <button onClick={() => setIsOpen(false)} className="hover:bg-white/10 p-2 rounded-full transition text-club-gold">
                <X size={24} />
              </button>
            </div>

            {/* Chat Area */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-100">
              {messages.map((msg) => {
                const isMe = msg.user_id === currentUser.id
                return (
                  <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`
                        max-w-[80%] rounded-2xl p-4 shadow-sm text-sm font-medium
                        ${isMe 
                            ? 'bg-club-navy text-white rounded-br-none' 
                            : 'bg-white text-club-navy border border-gray-200 rounded-bl-none'
                        }
                    `}>
                      {!isMe && (
                        <p className="text-[10px] font-bold text-club-gold uppercase mb-1 tracking-wider">
                          {getName(msg.profiles?.email)}
                        </p>
                      )}
                      <p className="leading-relaxed">{msg.content}</p>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Input Area */}
            <form onSubmit={handleSend} className="p-4 bg-white border-t border-gray-200 flex gap-2 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
              <input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Talk smack..."
                className="flex-1 bg-gray-100 border border-gray-300 rounded-full px-5 py-3 text-sm focus:outline-none focus:border-club-navy focus:ring-1 focus:ring-club-navy text-club-navy placeholder:text-gray-400"
                autoFocus
              />
              <button 
                type="submit" 
                disabled={!newMessage.trim()} 
                className="bg-club-navy text-white p-3 rounded-full hover:bg-club-gold hover:text-club-navy transition disabled:opacity-50 shadow-md"
              >
                <Send size={18} />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}