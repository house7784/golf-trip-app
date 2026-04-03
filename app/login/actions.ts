'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export async function login(formData: FormData) {
  const supabase = await createClient()

  // 1. Get the data from the form
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  // 2. Sign in with Supabase
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    console.error(error)
    return redirect('/login?error=Could not authenticate user')
  }

  revalidatePath('/', 'layout')
  revalidatePath('/events', 'layout')
  
  redirect('/')
}

export async function signup(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const fullName = ((formData.get('fullName') as string) || '').trim()

  // 1. Create the user
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
    return redirect('/login?error=Registration failed')
  }

  // 2. Create the user profile if account creation worked
  if (authData.user) {
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert(
        {
          id: authData.user.id, 
          full_name: fullName || null,
          handicap_index: null 
        },
        { onConflict: 'id' }
      )
      
      if (profileError) {
        console.error('Profile creation error:', profileError)
      }
  }

  revalidatePath('/', 'layout')
  revalidatePath('/events', 'layout')
  redirect('/')
}

export async function forgotPassword(formData: FormData) {
  const supabase = await createClient()

  const email = (formData.get('email') as string | null)?.trim() || ''
  if (!email) {
    redirect('/login?error=Enter your email first')
  }

  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL
  const fallbackSiteUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000'
  const siteUrl = configuredSiteUrl || fallbackSiteUrl

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/auth/confirm?next=/login/reset-password`,
  })

  if (error) {
    console.error(error)
    redirect('/login?error=Could not send reset email')
  }

  redirect('/login?success=Password reset link sent')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  
  revalidatePath('/', 'layout')
  redirect('/')
}