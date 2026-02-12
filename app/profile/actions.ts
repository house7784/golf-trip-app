'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export async function updateProfileHandicap(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return redirect('/login')

  const handicapIndex = parseFloat((formData.get('handicapIndex') as string) || '0')

  const { error } = await supabase
    .from('profiles')
    .update({ handicap_index: Number.isFinite(handicapIndex) ? Math.max(0, handicapIndex) : 0 })
    .eq('id', user.id)

  if (error) {
    console.error('Update profile handicap failed:', error)
    return redirect('/profile?status=error')
  }

  revalidatePath('/')
  revalidatePath('/events')
  revalidatePath('/profile')
  redirect('/profile?status=saved')
}
