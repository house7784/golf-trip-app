'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export async function completeProfile(formData: FormData) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return redirect('/login')

  const handicap = formData.get('handicap')

  const { error } = await supabase
    .from('profiles')
    .update({ 
      handicap: parseFloat(handicap as string) || 0
    })
    .eq('id', user.id)

  if (error) {
    console.error('Profile Update Error:', error)
    throw new Error('Failed to save profile') // Throwing satisfies the type requirement
  }

  // Success! Send them to the dashboard
  redirect('/events')
}