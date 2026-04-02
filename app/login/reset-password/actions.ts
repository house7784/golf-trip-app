'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export async function updatePassword(formData: FormData) {
  const supabase = await createClient()

  const newPassword = (formData.get('password') as string | null)?.trim() || ''
  const confirmPassword = (formData.get('confirmPassword') as string | null)?.trim() || ''

  if (newPassword.length < 8) {
    redirect('/login/reset-password?error=Password must be at least 8 characters')
  }

  if (newPassword !== confirmPassword) {
    redirect('/login/reset-password?error=Passwords do not match')
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?error=Open reset link from your email first')
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword })

  if (error) {
    console.error(error)
    redirect('/login/reset-password?error=Could not update password')
  }

  redirect('/login?success=Password updated. Please sign in.')
}
