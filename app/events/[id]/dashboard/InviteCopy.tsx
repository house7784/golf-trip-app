'use client'

import { useState } from 'react'
import { Link as LinkIcon, Check } from 'lucide-react'

export default function InviteCopy({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)

  const copyToClipboard = () => {
    const url = `${window.location.origin}/invite/${code}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button 
      onClick={copyToClipboard}
      className="flex items-center gap-2 px-3 py-1 bg-club-cream border border-club-navy/20 rounded text-[10px] font-bold uppercase tracking-wider text-club-navy hover:bg-white transition-colors cursor-pointer"
    >
      {copied ? <Check size={14} className="text-green-600" /> : <LinkIcon size={14} />}
      {copied ? 'Copied' : 'Copy Invite Link'}
    </button>
  )
}