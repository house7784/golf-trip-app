'use server'

import { createClient } from '@/utils/supabase/server'

export async function sendMessage(eventId: string, content: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' as const }

  const { error } = await supabase.from('chat_messages').insert({
    event_id: eventId,
    user_id: user.id,
    content: content.trim()
  })

  if (error) {
    return { error: error.message }
  }

  return { success: true as const }
}