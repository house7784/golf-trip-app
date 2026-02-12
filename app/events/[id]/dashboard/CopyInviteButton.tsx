'use client'

import { useState } from 'react'
import { Link as LinkIcon, Check } from 'lucide-react'

export default function CopyInviteButton({ eventId }: { eventId: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    const inviteLink = `${window.location.origin}/events/${eventId}`

    try {
      await navigator.clipboard.writeText(inviteLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="bg-club-navy text-white px-4 py-2 rounded-sm text-xs font-bold uppercase tracking-wider hover:bg-club-gold hover:text-club-navy transition flex items-center gap-2"
      title="Copy join link"
    >
      {copied ? <Check size={14} /> : <LinkIcon size={14} />}
      {copied ? 'Copied' : 'Copy Invite Link'}
    </button>
  )
}
