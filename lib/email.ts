type EmailPayload = {
  to: string
  subject: string
  html: string
}

export type EmailResult = {
  ok: boolean
  to: string
  redirectedTo?: string
  statusCode?: number
  error?: string
}

/**
 * Set EMAIL_TEST_MODE_TO=your@email.com in .env.local to redirect ALL outgoing
 * emails to that address instead of the real recipients. Safe for testing.
 */
export async function sendEmail({ to, subject, html }: EmailPayload): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    const msg = 'RESEND_API_KEY is not set'
    console.warn('[email]', msg, '— skipping email to', to)
    return { ok: false, to, error: msg }
  }

  const testModeTo = process.env.EMAIL_TEST_MODE_TO?.trim()
  const actualTo = testModeTo || to
  if (testModeTo) {
    console.log(`[email] TEST MODE: redirecting email for <${to}> → <${testModeTo}>`)
    subject = `[TEST → ${to}] ${subject}`
  }

  const from = process.env.EMAIL_FROM ?? 'Golf Trip <noreply@example.com>'
  const replyTo = process.env.EMAIL_REPLY_TO?.trim()
  const text = html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const payload: Record<string, unknown> = { from, to: actualTo, subject, html, text }
  if (replyTo) {
    payload.reply_to = replyTo
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const body = await res.text()
    console.error(`[email] Failed to send to <${actualTo}> (status ${res.status}):`, body)
    return {
      ok: false,
      to,
      redirectedTo: testModeTo ? actualTo : undefined,
      statusCode: res.status,
      error: `HTTP ${res.status}: ${body}`,
    }
  }

  return {
    ok: true,
    to,
    redirectedTo: testModeTo ? actualTo : undefined,
  }
}
