'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { MessageCircle, X, Send } from 'lucide-react'
import { createClient } from '../../../../utils/supabase/client'
import { sendMessage } from './actions'

type MessageRow = {
  id: string | number
  content: string
  created_at: string
  user_id: string
  profiles?: {
    full_name?: string | null
    email?: string | null
  } | null
}

type TrashTalkProps = {
  eventId: string
  currentUser: {
    id: string
    email?: string | null
  }
  variant?: 'floating' | 'tile'
  icon?: ReactNode
}

export default function TrashTalk({ eventId, currentUser, variant = 'floating', icon }: TrashTalkProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<MessageRow[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [sendError, setSendError] = useState<string | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const seenMessageIdsRef = useRef<Set<string>>(new Set())
  const [supabase] = useState(() => createClient())

  useEffect(() => {
    let isActive = true

    const loadMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('id, content, created_at, user_id, profiles:user_id(full_name, email)')
        .eq('event_id', eventId)
        .order('created_at', { ascending: true })

      if (!data || !isActive) return

      const normalized = data as MessageRow[]
      const knownIds = seenMessageIdsRef.current
      const incomingCount = normalized.filter(
        (message) =>
          !knownIds.has(String(message.id)) &&
          message.user_id !== currentUser.id
      ).length

      normalized.forEach((message) => {
        knownIds.add(String(message.id))
      })

      setMessages(normalized)

      if (!isOpen && incomingCount > 0) {
        setUnreadCount((prev) => prev + incomingCount)
      }
    }

    loadMessages()

    const channel = supabase
      .channel(`trash_talk:${eventId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `event_id=eq.${eventId}` },
        () => { loadMessages() }
      )
      .subscribe()

    let pollInterval: ReturnType<typeof setInterval> | undefined
    if (isOpen) {
      pollInterval = setInterval(() => { loadMessages() }, 2500)
    }

    return () => {
      isActive = false
      if (pollInterval) clearInterval(pollInterval)
      supabase.removeChannel(channel)
    }
  }, [currentUser.id, eventId, isOpen, supabase])

  useEffect(() => {
    if (!isOpen) return
    const frame = requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'instant' })
    })
    return () => cancelAnimationFrame(frame)
  }, [messages, isOpen])

  const handleOpen = () => {
    setIsOpen(true)
    setUnreadCount(0)
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim()) return
    setSendError(null)

    const tempId = `temp-${Date.now()}`
    const tempMsg = {
      id: tempId,
      content: newMessage,
      user_id: currentUser.id,
      created_at: new Date().toISOString(),
      profiles: { email: currentUser.email }
    }
    setMessages((prev) => [...prev, tempMsg])
    const msgToSend = newMessage
    setNewMessage('')

    const result = await sendMessage(eventId, msgToSend)
    if (result?.error) {
      setMessages((prev) => prev.filter((message) => message.id !== tempId))
      setSendError(`Message failed: ${result.error}`)
      return
    }

    // Pull fresh rows to replace the optimistic temp message.
    const { data, error } = await supabase
      .from('messages')
      .select('id, content, created_at, user_id, profiles:user_id(full_name, email)')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('[chat] Failed to reload messages after send:', error)
      setSendError(`Failed to reload: ${error.message}`)
      // Keep the optimistic message visible even if reload fails
      return
    }

    if (data) {
      setMessages(data as MessageRow[])
    }
  }

  const getName = (profile?: { full_name?: string | null; email?: string | null } | null) => {
    return profile?.full_name || 'Golfer'
  }

  const formatTime = (value: string) => {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  }

  const trigger =
    variant === 'tile' ? (
      <button
        type="button"
        onClick={handleOpen}
        className="relative bg-white text-club-navy p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-2 h-32 active:bg-gray-50 transition"
      >
        {icon || <MessageCircle size={28} className="text-club-gold" />}
        <span className="font-bold text-xs uppercase tracking-wider">Trash Talk</span>
        {unreadCount > 0 && (
          <div className="absolute top-3 right-3 bg-red-600 text-white text-[10px] font-bold min-w-6 h-6 px-1 flex items-center justify-center rounded-full border-2 border-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </div>
        )}
      </button>
    ) : (
      <button
        onClick={handleOpen}
        className="fixed bottom-6 right-6 bg-club-gold text-club-navy p-4 rounded-full shadow-2xl hover:scale-110 transition-transform z-40 border-4 border-club-navy group relative"
      >
        <MessageCircle size={32} strokeWidth={2.5} />
        {unreadCount > 0 && (
          <div className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-bold w-6 h-6 flex items-center justify-center rounded-full border-2 border-club-navy animate-bounce">
            {unreadCount > 9 ? '9+' : unreadCount}
          </div>
        )}
      </button>
    )

  return (
    <>
      {trigger}

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-navy h-full shadow-2xl flex flex-col animate-slide-in-right border-l-4 border-club-gold"
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
                const senderLabel = isMe ? 'You' : getName(msg.profiles)
                const sentAt = formatTime(msg.created_at)
                return (
                  <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                      <div className={`text-[10px] leading-tight ${isMe ? 'text-right' : 'text-left'} text-club-navy/70`}>
                        <p className="font-bold uppercase tracking-wider">{senderLabel}</p>
                        {sentAt && <p>{sentAt}</p>}
                      </div>
                      <div className={`
                        max-w-[80%] rounded-2xl p-4 shadow-sm text-sm font-medium
                        ${isMe
                          ? 'bg-club-navy text-black rounded-br-none'
                          : 'bg-black text-club-navy border border-gray-200 rounded-bl-none'
                        }
                      `}>
                        <p className={`leading-relaxed ${isMe ? 'text-black' : 'text-club-navy'}`}>{msg.content}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
              <div ref={bottomRef} />
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
            {sendError && (
              <div className="px-4 pb-4 text-xs font-semibold text-red-600 bg-white">
                {sendError}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}