type EmailPayload = {
  to: string
  subject: string
  html: string
}

export async function sendEmail({ to, subject, html }: EmailPayload) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY not set — skipping email to', to)
    return
  }

  const from = process.env.EMAIL_FROM ?? 'Golf Trip <noreply@example.com>'

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ from, to, subject, html }),
  })

  if (!res.ok) {
    console.error('[email] Failed to send:', await res.text())
  }
}
