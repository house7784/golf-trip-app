'use server'

import { createClient } from '@/utils/supabase/server'

export async function sendMessage(eventId: string, content: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase.from('messages').insert({
    event_id: eventId,
    user_id: user.id,
    content: content
  })
}