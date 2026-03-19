'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export async function registerMember(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const fullName = ((formData.get('fullName') as string) || '').trim()
  const handicap = parseFloat(formData.get('handicap') as string) || 0

  // 1. Create the auth user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
    },
  })

  if (authError) {
    console.error(authError)
    return redirect('/signup?error=Registration failed. Please try again.')
  }

  // 2. Create or update the user profile with handicap + full name
  if (authData.user) {
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert(
        {
          id: authData.user.id,
          full_name: fullName || null,
          handicap_index: handicap,
        },
        { onConflict: 'id' }
      )

    if (profileError) {
      console.error('Profile creation error:', profileError)
    }
  }

  revalidatePath('/', 'layout')
  redirect('/')
}
