import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email'

export async function GET(request: Request) {
  // If CRON_SECRET is unset, reminders are disabled.
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ disabled: true, reason: 'CRON_SECRET not set' }, { status: 200 })
  }

  // Verify this was called by the cron runner.
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Use service role to bypass RLS
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

  const { data: challenges } = await supabase
    .from('challenges')
    .select('id, description, stakes, winner_id, challenger_id, challenged_id')
    .eq('status', 'result_set')
    .eq('loser_completed', false)
    .or(`last_reminder_at.is.null,last_reminder_at.lt.${oneHourAgo}`)

  let sent = 0

  for (const ch of challenges ?? []) {
    const loserId =
      ch.winner_id === ch.challenger_id ? ch.challenged_id : ch.challenger_id

    const { data: loser } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', loserId)
      .single()

    if (loser?.email) {
      await sendEmail({
        to: loser.email,
        subject: '⏰ Reminder: You have an unsettled golf challenge',
        html: `
          <h2>Friendly Reminder</h2>
          <p>You still have an unsettled challenge obligation:</p>
          <blockquote style="border-left:3px solid #ccc;padding-left:12px;margin:16px 0;color:#333;">${ch.description}</blockquote>
          <p><strong>Your obligation:</strong> ${ch.stakes}</p>
          <p>Log in to the app and mark it as settled once you've paid up. Reminders will stop when you do.</p>
        `,
      })
      sent++
    }

    await supabase
      .from('challenges')
      .update({ last_reminder_at: new Date().toISOString() })
      .eq('id', ch.id)
  }

  return NextResponse.json({ sent })
}
