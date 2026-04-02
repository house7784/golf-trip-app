'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { sendEmail } from '../../../../lib/email'

export async function createChallenge(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const eventId = formData.get('event_id') as string
  const challengedId = formData.get('challenged_id') as string
  const description = formData.get('description') as string
  const stakes = formData.get('stakes') as string
  const witnessId = (formData.get('witness_id') as string) || null

  const { error } = await supabase.from('challenges').insert({
    event_id: eventId,
    challenger_id: user.id,
    challenged_id: challengedId,
    description,
    stakes,
    witness_id: witnessId || null,
    status: 'pending',
  })

  if (error) return { error: error.message }

  const [{ data: challenged }, { data: challenger }] = await Promise.all([
    supabase.from('profiles').select('email, full_name').eq('id', challengedId).single(),
    supabase.from('profiles').select('full_name').eq('id', user.id).single(),
  ])

  if (challenged?.email) {
    await sendEmail({
      to: challenged.email,
      subject: `${challenger?.full_name ?? 'A fellow golfer'} has challenged you!`,
      html: `
        <h2>You've been challenged! ⚔️</h2>
        <p><strong>${challenger?.full_name ?? 'A fellow golfer'}</strong> has issued you a challenge:</p>
        <blockquote style="border-left:3px solid #ccc;padding-left:12px;margin:16px 0;color:#333;">${description}</blockquote>
        <p><strong>Stakes:</strong> ${stakes}</p>
        <p>Log in to the app to accept or decline.</p>
      `,
    })
  }

  revalidatePath(`/events/${eventId}/challenges`)
  return { success: true }
}

export async function respondToChallenge(challengeId: string, response: 'accepted' | 'declined') {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: challenge } = await supabase
    .from('challenges')
    .select('event_id, challenger_id, description, stakes')
    .eq('id', challengeId)
    .eq('challenged_id', user.id)
    .single()

  if (!challenge) return { error: 'Challenge not found' }

  await supabase
    .from('challenges')
    .update({
      status: response,
      accepted_at: response === 'accepted' ? new Date().toISOString() : null,
    })
    .eq('id', challengeId)

  if (response === 'accepted') {
    const [{ data: responder }, { data: challenger }] = await Promise.all([
      supabase.from('profiles').select('full_name').eq('id', user.id).single(),
      supabase.from('profiles').select('email, full_name').eq('id', challenge.challenger_id).single(),
    ])

    if (challenger?.email) {
      await sendEmail({
        to: challenger.email,
        subject: `${responder?.full_name ?? 'Your opponent'} accepted your challenge!`,
        html: `
          <h2>Challenge Accepted! ⚔️</h2>
          <p><strong>${responder?.full_name ?? 'Your opponent'}</strong> is in. Game on!</p>
          <blockquote style="border-left:3px solid #ccc;padding-left:12px;margin:16px 0;color:#333;">${challenge.description}</blockquote>
          <p><strong>Stakes:</strong> ${challenge.stakes}</p>
        `,
      })
    }
  }

  revalidatePath(`/events/${challenge.event_id}/challenges`)
  return { success: true }
}

export async function setResult(challengeId: string, winnerId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: challenge } = await supabase
    .from('challenges')
    .select('event_id, challenger_id, challenged_id, witness_id, stakes, description')
    .eq('id', challengeId)
    .single()

  if (!challenge) return { error: 'Challenge not found' }

  const hasWitness = !!challenge.witness_id
  const loserId = winnerId === challenge.challenger_id
    ? challenge.challenged_id
    : challenge.challenger_id

  await supabase
    .from('challenges')
    .update({
      winner_id: winnerId,
      status: hasWitness ? 'awaiting_witness' : 'result_set',
      result_set_at: new Date().toISOString(),
      witness_approved: !hasWitness,
    })
    .eq('id', challengeId)

  if (hasWitness) {
    const { data: witness } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', challenge.witness_id)
      .single()

    if (witness?.email) {
      await sendEmail({
        to: witness.email,
        subject: 'A challenge you witnessed needs your sign-off',
        html: `
          <h2>Witness Sign-Off Required 👀</h2>
          <p>A challenge you witnessed has had its result recorded and needs your approval.</p>
          <blockquote style="border-left:3px solid #ccc;padding-left:12px;margin:16px 0;color:#333;">${challenge.description}</blockquote>
          <p><strong>Stakes:</strong> ${challenge.stakes}</p>
          <p>Log in to the app to approve the result.</p>
        `,
      })
    }
  } else {
    const { data: loser } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', loserId)
      .single()

    if (loser?.email) {
      await sendEmail({
        to: loser.email,
        subject: 'Challenge concluded — time to settle up',
        html: `
          <h2>You lost the challenge 😬</h2>
          <blockquote style="border-left:3px solid #ccc;padding-left:12px;margin:16px 0;color:#333;">${challenge.description}</blockquote>
          <p><strong>Your obligation:</strong> ${challenge.stakes}</p>
          <p>Once you've settled up, log in and mark it complete. You'll receive hourly reminders until then.</p>
        `,
      })
    }
  }

  revalidatePath(`/events/${challenge.event_id}/challenges`)
  return { success: true }
}

export async function witnessApprove(challengeId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: challenge } = await supabase
    .from('challenges')
    .select('event_id, challenger_id, challenged_id, winner_id, stakes, description')
    .eq('id', challengeId)
    .eq('witness_id', user.id)
    .single()

  if (!challenge) return { error: 'Challenge not found or you are not the witness' }

  await supabase
    .from('challenges')
    .update({ witness_approved: true, status: 'result_set' })
    .eq('id', challengeId)

  const loserId = challenge.winner_id === challenge.challenger_id
    ? challenge.challenged_id
    : challenge.challenger_id

  const { data: loser } = await supabase
    .from('profiles')
    .select('email, full_name')
    .eq('id', loserId)
    .single()

  if (loser?.email) {
    await sendEmail({
      to: loser.email,
      subject: 'Result confirmed by witness — time to settle up',
      html: `
        <h2>Witness Approved ✅</h2>
        <blockquote style="border-left:3px solid #ccc;padding-left:12px;margin:16px 0;color:#333;">${challenge.description}</blockquote>
        <p><strong>Your obligation:</strong> ${challenge.stakes}</p>
        <p>Once you've settled up, log in and mark it complete. You'll receive hourly reminders until then.</p>
      `,
    })
  }

  revalidatePath(`/events/${challenge.event_id}/challenges`)
  return { success: true }
}

export async function markCompleted(challengeId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: challenge } = await supabase
    .from('challenges')
    .select('event_id, winner_id, challenger_id, challenged_id')
    .eq('id', challengeId)
    .single()

  if (!challenge) return { error: 'Challenge not found' }

  const loserId = challenge.winner_id === challenge.challenger_id
    ? challenge.challenged_id
    : challenge.challenger_id

  if (user.id !== loserId) return { error: 'Only the loser can mark as settled' }

  await supabase
    .from('challenges')
    .update({
      loser_completed: true,
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', challengeId)

  revalidatePath(`/events/${challenge.event_id}/challenges`)
  return { success: true }
}
