'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { sendEmail } from '@/lib/email'
import { calculateStableford666TotalPoints, getStableford666Data } from '@/lib/stableford_666'

const LEADERBOARD_ACTIVATION_MESSAGE = '__SYSTEM__:LEADERBOARD_ACTIVE'

function isSystemAnnouncement(row: any) {
  return row?.message === LEADERBOARD_ACTIVATION_MESSAGE || row?.content === LEADERBOARD_ACTIVATION_MESSAGE || row?.title === LEADERBOARD_ACTIVATION_MESSAGE
}

function getDisplayName(profile?: { full_name?: string | null; email?: string | null } | null) {
  return profile?.full_name || profile?.email || 'Golfer'
}

function resolveAnnouncementText(row: any) {
  return row?.message || row?.content || row?.title || ''
}

async function requireOrganizer(eventId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: participant } = await supabase
    .from('event_participants')
    .select('role')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .single()

  const { data: event } = await supabase
    .from('events')
    .select('id, name, created_by')
    .eq('id', eventId)
    .single()

  const isOrganizer = participant?.role === 'organizer' || event?.created_by === user.id
  if (!isOrganizer || !event) return null

  return { supabase, user, event }
}

export async function postAnnouncement(formData: FormData) {
  const eventId = formData.get('eventId') as string
  const message = formData.get('message') as string

  if (!eventId || !message) return

  const auth = await requireOrganizer(eventId)
  if (!auth) return
  const { supabase, user, event } = auth

  const { error: messageInsertError } = await supabase
    .from('announcements')
    .insert({ event_id: eventId, message })

  if (messageInsertError) {
    const { error: contentInsertError } = await supabase
      .from('announcements')
      .insert({ event_id: eventId, title: 'Announcement', content: message })

    if (contentInsertError) {
      console.error('Announcement post failed:', { messageInsertError, contentInsertError })
      return
    }
  }

  const [{ data: organizerProfile }, { data: recipientRows }] = await Promise.all([
    supabase.from('profiles').select('full_name, email').eq('id', user.id).maybeSingle(),
    supabase
      .from('event_participants')
      .select('user_id, profiles:user_id(email, full_name)')
      .eq('event_id', eventId),
  ])

  const organizerName = getDisplayName(organizerProfile)
  const recipients = (recipientRows || [])
    .map((row: any) => Array.isArray(row.profiles) ? row.profiles[0] : row.profiles)
    .filter((profile: any) => profile?.email)

  await Promise.allSettled(
    recipients.map((profile: any) =>
      sendEmail({
        to: profile.email,
        subject: `[${event.name}] New announcement`,
        html: `
          <h2>New Announcement</h2>
          <p><strong>${organizerName}</strong> posted a message for your trip:</p>
          <blockquote style="border-left:3px solid #ccc;padding-left:12px;margin:16px 0;color:#333;">${message}</blockquote>
          <p>Open your dashboard to view details and respond.</p>
        `,
      })
    )
  )

  revalidatePath(`/events/${eventId}/dashboard`)
  revalidatePath(`/events/${eventId}/announcements`)
}

export async function deleteAnnouncement(formData: FormData) {
  const supabase = await createClient()
  const id = formData.get('id') as string
  const eventId = formData.get('eventId') as string

  if (!id || !eventId) return

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data: participant } = await supabase
    .from('event_participants')
    .select('role')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .single()

  const { data: event } = await supabase
    .from('events')
    .select('created_by')
    .eq('id', eventId)
    .single()

  const isOrganizer = participant?.role === 'organizer' || event?.created_by === user.id
  if (!isOrganizer) return

  await supabase.from('announcements').delete().eq('id', id)
  revalidatePath(`/events/${eventId}/dashboard`)
  revalidatePath(`/events/${eventId}/announcements`)
}

export async function activateLeaderboard(formData: FormData) {
  const supabase = await createClient()
  const eventId = formData.get('eventId') as string

  if (!eventId) return

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data: participant } = await supabase
    .from('event_participants')
    .select('role')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .single()

  const { data: event } = await supabase
    .from('events')
    .select('created_by')
    .eq('id', eventId)
    .single()

  const isOrganizer = participant?.role === 'organizer' || event?.created_by === user.id
  if (!isOrganizer) return

  const { data: announcementRows } = await supabase
    .from('announcements')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })

  const existing = (announcementRows || []).find(isSystemAnnouncement)

  if (!existing) {
    const { error: messageInsertError } = await supabase
      .from('announcements')
      .insert({ event_id: eventId, message: LEADERBOARD_ACTIVATION_MESSAGE })

    if (messageInsertError) {
      const { error: contentInsertError } = await supabase
        .from('announcements')
        .insert({ event_id: eventId, title: LEADERBOARD_ACTIVATION_MESSAGE, content: LEADERBOARD_ACTIVATION_MESSAGE })

      if (contentInsertError) {
        console.error('Activate leaderboard failed:', { messageInsertError, contentInsertError })
        return
      }
    }
  }

  revalidatePath(`/events/${eventId}/dashboard`)
  revalidatePath(`/events/${eventId}/announcements`)
}

export async function deactivateLeaderboard(formData: FormData) {
  const supabase = await createClient()
  const eventId = formData.get('eventId') as string

  if (!eventId) return

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data: participant } = await supabase
    .from('event_participants')
    .select('role')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .single()

  const { data: event } = await supabase
    .from('events')
    .select('created_by')
    .eq('id', eventId)
    .single()

  const isOrganizer = participant?.role === 'organizer' || event?.created_by === user.id
  if (!isOrganizer) return

  const { data: rows } = await supabase
    .from('announcements')
    .select('id, message, content, title')
    .eq('event_id', eventId)

  const idsToDelete = (rows || [])
    .filter(isSystemAnnouncement)
    .map((row: any) => row.id)

  if (idsToDelete.length > 0) {
    await supabase
      .from('announcements')
      .delete()
      .in('id', idsToDelete)
  }

  revalidatePath(`/events/${eventId}/dashboard`)
  revalidatePath(`/events/${eventId}/announcements`)
}

export async function emailDailySummary(formData: FormData): Promise<{
  sent: number
  failed: number
  errors: string[]
  testMode: boolean
  noRound?: boolean
  noRecipients?: boolean
}> {
  const eventId = formData.get('eventId') as string
  const explicitRoundId = formData.get('roundId') as string
  if (!eventId) return { sent: 0, failed: 0, errors: ['Missing eventId'], testMode: false }

  const auth = await requireOrganizer(eventId)
  if (!auth) return { sent: 0, failed: 0, errors: ['Not authorized'], testMode: false }
  const { supabase, event } = auth

  const { data: roundsData } = await supabase
    .from('rounds')
    .select('id, date, mode_key, course_name, course_data')
    .eq('event_id', eventId)

  const rounds = (roundsData || []).sort((a: any, b: any) => (a.date || '').localeCompare(b.date || ''))
  const today = new Date().toISOString().split('T')[0]
  const round = explicitRoundId
    ? rounds.find((item: any) => item.id === explicitRoundId)
    : rounds.find((item: any) => item.date === today) || [...rounds].reverse().find((item: any) => item.date <= today)

  if (!round) return { sent: 0, failed: 0, errors: [], testMode: false, noRound: true }

  const holes = Array.isArray(round.course_data?.holes) ? round.course_data.holes : []

  const [{ data: participantsData }, { data: scoresData }] = await Promise.all([
    supabase
      .from('event_participants')
      .select('user_id, event_handicap, profiles:user_id(full_name, email, handicap_index)')
      .eq('event_id', eventId),
    supabase
      .from('scores')
      .select('user_id, hole_scores')
      .eq('round_id', round.id),
  ])

  const participants = participantsData || []
  const scores = scoresData || []
  const profileById = new Map<string, any>()
  participants.forEach((row: any) => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
    profileById.set(row.user_id, profile || {})
  })

  const scoreByUserId = new Map<string, Record<string, any>>()
  scores.forEach((row: any) => scoreByUserId.set(row.user_id, row.hole_scores || {}))

  const participantsWithEmail = participants
    .map((row: any) => ({
      userId: row.user_id,
      profile: Array.isArray(row.profiles) ? row.profiles[0] : row.profiles,
    }))
    .filter((row: any) => row.profile?.email)

  let topRows: Array<{ label: string; score: number | null }> = []
  if (round.mode_key === 'stableford') {
    const { data: pairingsData } = await supabase
      .from('pairings')
      .select('slot_number, player_id, tee_time_id, tee_times!inner(round_id)')
      .eq('tee_times.round_id', round.id)

    const grouped = new Map<string, any[]>()
    ;(pairingsData || []).forEach((row: any) => {
      if (!row.player_id) return
      const rows = grouped.get(row.tee_time_id) || []
      rows.push(row)
      grouped.set(row.tee_time_id, rows)
    })

    grouped.forEach((rows) => {
      const pairA = rows.filter((row: any) => row.slot_number <= 2).map((row: any) => row.player_id)
      const pairB = rows.filter((row: any) => row.slot_number >= 3).map((row: any) => row.player_id)
      ;[pairA, pairB].forEach((pairIds) => {
        if (pairIds.length === 0) return
        const payload = pairIds.map((id: string) => scoreByUserId.get(id)).find(Boolean)
        if (!payload) return
        const handicapByPlayerId = Object.fromEntries(
          pairIds.map((id: string) => {
            const participant = participants.find((row: any) => row.user_id === id)
            const profile = profileById.get(id)
            return [id, Number(participant?.event_handicap ?? profile?.handicap_index ?? 0)]
          })
        )
        const score = calculateStableford666TotalPoints(payload, holes, handicapByPlayerId)
        const label = pairIds.map((id: string) => getDisplayName(profileById.get(id))).join(' & ')
        topRows.push({ label, score })
      })
    })

    topRows = topRows
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, 5)
  } else {
    topRows = participants
      .map((row: any) => {
        const holeScores = scoreByUserId.get(row.user_id) || {}
        const total = Object.values(holeScores).reduce((sum: number, value: any) => sum + (Number(value) || 0), 0)
        return {
          label: getDisplayName(Array.isArray(row.profiles) ? row.profiles[0] : row.profiles),
          score: Object.keys(holeScores).length > 0 ? total : null,
        }
      })
      .filter((row) => row.score !== null)
      .sort((a, b) => (a.score || 0) - (b.score || 0))
      .slice(0, 5)
  }

  let birdies = 0
  let eagles = 0
  let holeInOnes = 0
  const highestScores: Array<{ player: string; hole: number; score: number; par: number }> = []
  const stablefordTeamHoleSeen = new Set<string>()

  const holeByNumber = new Map<number, any>((holes || []).map((hole: any) => [hole.number, hole]))
  scores.forEach((row: any) => {
    const payload = row.hole_scores || {}
    if (round.mode_key === 'stableford') {
      const data = getStableford666Data(payload)
      const signature = JSON.stringify(data.holes || {})

      Object.entries(data.holes || {}).forEach(([holeKey, holeData]: [string, any]) => {
        const holeNumber = Number(holeKey)
        const hole = holeByNumber.get(holeNumber)
        if (!hole) return

        if (holeNumber <= 12) {
          const dedupeKey = `${signature}:${holeNumber}`
          if (stablefordTeamHoleSeen.has(dedupeKey)) return
          stablefordTeamHoleSeen.add(dedupeKey)

          const teamScore = Number(holeData?.teamScore)
          if (!Number.isFinite(teamScore)) return

          if (teamScore === 1) holeInOnes += 1
          if (teamScore === hole.par - 1) birdies += 1
          if (teamScore <= hole.par - 2 && teamScore !== 1) eagles += 1
          highestScores.push({
            player: 'Team',
            hole: holeNumber,
            score: teamScore,
            par: hole.par,
          })
          return
        }

        const myScore = Number(holeData?.playerScores?.[row.user_id])
        if (!Number.isFinite(myScore)) return

        if (myScore === 1) holeInOnes += 1
        if (myScore === hole.par - 1) birdies += 1
        if (myScore <= hole.par - 2 && myScore !== 1) eagles += 1
        highestScores.push({
          player: getDisplayName(profileById.get(row.user_id)),
          hole: holeNumber,
          score: myScore,
          par: hole.par,
        })
      })
      return
    }

    Object.entries(payload).forEach(([holeKey, rawScore]: [string, any]) => {
      const holeNumber = Number(holeKey)
      const hole = holeByNumber.get(holeNumber)
      if (!hole) return
      const score = Number(rawScore)
      if (!Number.isFinite(score)) return

      if (score === 1) holeInOnes += 1
      if (score === hole.par - 1) birdies += 1
      if (score <= hole.par - 2 && score !== 1) eagles += 1
      highestScores.push({
        player: getDisplayName(profileById.get(row.user_id)),
        hole: holeNumber,
        score,
        par: hole.par,
      })
    })
  })

  const worstFive = highestScores
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)

  const formattedDate = round.date
    ? new Date(`${round.date}T00:00:00`).toLocaleDateString()
    : 'Today'

  const resultsHtml = topRows.length > 0
    ? `<ol>${topRows.map((row) => `<li><strong>${row.label}</strong>: ${row.score}</li>`).join('')}</ol>`
    : '<p>No posted results yet.</p>'

  const worstHtml = worstFive.length > 0
    ? `<ul>${worstFive.map((item) => `<li>${item.player} — Hole ${item.hole}: ${item.score} (Par ${item.par})</li>`).join('')}</ul>`
    : '<p>No high-score outliers recorded.</p>'

  if (participantsWithEmail.length === 0) {
    return { sent: 0, failed: 0, errors: [], testMode: !!process.env.EMAIL_TEST_MODE_TO, noRecipients: true }
  }

  const testModeTo = process.env.EMAIL_TEST_MODE_TO?.trim()
  const emailBody = `
    <h2>${event.name} — Daily Summary</h2>
    <p><strong>Date:</strong> ${formattedDate}</p>
    <p><strong>Format:</strong> ${round.mode_key || 'round'}</p>

    <h3>Overall Results</h3>
    ${resultsHtml}

    <h3>Notable Shots</h3>
    <p><strong>Birdies:</strong> ${birdies} &nbsp;|&nbsp; <strong>Eagles or Better:</strong> ${eagles} &nbsp;|&nbsp; <strong>Hole in Ones:</strong> ${holeInOnes}</p>

    <h3>Highest Scores (Toughest Holes)</h3>
    ${worstHtml}

    <p>See the app dashboard for full card details.</p>
  `

  // In test mode: send just ONE email to your address with all intended recipients listed
  if (testModeTo) {
    const recipientList = participantsWithEmail.map((p: any) => p.profile.email).join(', ')
    const result = await sendEmail({
      to: testModeTo,
      subject: `[TEST ${participantsWithEmail.length} recipients] [${event.name}] Daily Summary — ${formattedDate}`,
      html: `<p><strong>TEST MODE.</strong> This would have been sent to: ${recipientList}</p><hr>${emailBody}`,
    })
    return {
      sent: result.ok ? 1 : 0,
      failed: result.ok ? 0 : 1,
      errors: result.ok ? [] : [`${testModeTo}: ${result.error ?? 'unknown error'}`],
      testMode: true,
    }
  }

  // Production: send one at a time with a 250ms gap to stay under 5 req/sec
  let sent = 0
  let failed = 0
  const errors: string[] = []

  for (const participant of participantsWithEmail) {
    const email = (participant as any).profile?.email ?? 'unknown'
    const result = await sendEmail({
      to: email,
      subject: `[${event.name}] Daily Summary — ${formattedDate}`,
      html: emailBody,
    })
    if (result.ok) {
      sent++
    } else {
      failed++
      errors.push(`${email}: ${result.error ?? 'unknown error'}`)
    }
    // 250ms between sends → max ~4/sec, well under Resend's 5/sec limit
    await new Promise((resolve) => setTimeout(resolve, 250))
  }

  return { sent, failed, errors, testMode: false }
}

export async function sendCustomEmail(formData: FormData): Promise<{
  sent: number
  failed: number
  errors: string[]
  testMode: boolean
  noRecipients?: boolean
}> {
  const eventId = formData.get('eventId') as string
  const subject = formData.get('subject') as string
  const html = formData.get('html') as string

  if (!eventId || !subject || !html) {
    return { sent: 0, failed: 0, errors: ['Missing required fields'], testMode: false }
  }

  const auth = await requireOrganizer(eventId)
  if (!auth) return { sent: 0, failed: 0, errors: ['Not authorized'], testMode: false }
  const { supabase } = auth

  const { data: participantsData } = await supabase
    .from('event_participants')
    .select('user_id, profiles:user_id(full_name, email)')
    .eq('event_id', eventId)

  const participants = participantsData || []
  const participantsWithEmail = participants
    .map((row: any) => ({
      userId: row.user_id,
      profile: Array.isArray(row.profiles) ? row.profiles[0] : row.profiles,
    }))
    .filter((row: any) => row.profile?.email)

  if (participantsWithEmail.length === 0) {
    return { sent: 0, failed: 0, errors: [], testMode: !!process.env.EMAIL_TEST_MODE_TO, noRecipients: true }
  }

  const testModeTo = process.env.EMAIL_TEST_MODE_TO?.trim()

  // In test mode: send just ONE email to your address with all intended recipients listed
  if (testModeTo) {
    const recipientList = participantsWithEmail.map((p: any) => p.profile.email).join(', ')
    const result = await sendEmail({
      to: testModeTo,
      subject: `[TEST ${participantsWithEmail.length} recipients] ${subject}`,
      html: `<p><strong>TEST MODE.</strong> This would have been sent to: ${recipientList}</p><hr>${html}`,
    })
    return {
      sent: result.ok ? 1 : 0,
      failed: result.ok ? 0 : 1,
      errors: result.ok ? [] : [`${testModeTo}: ${result.error ?? 'unknown error'}`],
      testMode: true,
    }
  }

  // Production: send one at a time with a 250ms gap to stay under 5 req/sec
  let sent = 0
  let failed = 0
  const errors: string[] = []

  for (const participant of participantsWithEmail) {
    const email = (participant as any).profile?.email ?? 'unknown'
    const result = await sendEmail({
      to: email,
      subject,
      html,
    })
    if (result.ok) {
      sent++
    } else {
      failed++
      errors.push(`${email}: ${result.error ?? 'unknown error'}`)
    }
    // 250ms between sends → max ~4/sec, well under Resend's 5/sec limit
    await new Promise((resolve) => setTimeout(resolve, 250))
  }

  return { sent, failed, errors, testMode: false }
}