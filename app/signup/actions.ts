'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export async function registerMember(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const fullName = formData.get('fullName') as string
  const handicap = parseFloat(formData.get('handicap') as string) || 0

  // 1. Create the auth user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
  })

  if (authError) {
    console.error(authError)
    return redirect('/signup?error=Registration failed. Please try again.')
  }

  // 2. Create the user profile with handicap
  if (authData.user) {
    const { error: profileError } = await supabase
      .from('profiles')
      .insert([
        {
          id: authData.user.id,
          full_name: fullName,
          handicap_index: handicap,
        },
      ])

    if (profileError) {
      console.error('Profile creation error:', profileError)
    }
  }

  revalidatePath('/', 'layout')
  redirect('/')
}
