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
  const fullName = formData.get('fullName') as string

  // 1. Create the user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
  })

  if (authError) {
    console.error(authError)
    return redirect('/login?error=Registration failed')
  }

  // 2. Create the user profile if account creation worked
  if (authData.user) {
    const { error: profileError } = await supabase
      .from('profiles')
      .insert([
        { 
          id: authData.user.id, 
          full_name: fullName,
          handicap_index: null 
        }
      ])
      
      if (profileError) {
        console.error('Profile creation error:', profileError)
      }
  }

  revalidatePath('/', 'layout')
  revalidatePath('/events', 'layout')
  redirect('/')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  
  revalidatePath('/', 'layout')
  redirect('/')
}