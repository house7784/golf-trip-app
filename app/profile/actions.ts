'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export async function updateProfileDetails(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return redirect('/login')

  const fullName = ((formData.get('fullName') as string) || '').trim()
  const handicapIndex = parseFloat((formData.get('handicapIndex') as string) || '0')

  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: fullName || null,
      handicap_index: Number.isFinite(handicapIndex) ? Math.max(0, handicapIndex) : 0,
    })
    .eq('id', user.id)

  if (error) {
    console.error('Update profile failed:', error)
    return redirect('/profile?status=profile_error')
  }

  revalidatePath('/')
  revalidatePath('/events')
  revalidatePath('/profile')
  redirect('/profile?status=profile_saved')
}

export async function updatePassword(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return redirect('/login')

  const newPassword = (formData.get('newPassword') as string) || ''
  const confirmPassword = (formData.get('confirmPassword') as string) || ''

  if (!newPassword || newPassword.length < 8) {
    return redirect('/profile?status=password_too_short')
  }

  if (newPassword !== confirmPassword) {
    return redirect('/profile?status=password_mismatch')
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) {
    console.error('Update password failed:', error)
    return redirect('/profile?status=password_error')
  }

  redirect('/profile?status=password_saved')
}
