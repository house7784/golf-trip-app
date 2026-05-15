'use client'

import { useEffect, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Check, Save } from 'lucide-react'

type Props = {
  disabled?: boolean
}

export default function SaveCardButton({ disabled = false }: Props) {
  const { pending } = useFormStatus()
  const wasPendingRef = useRef(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (pending) {
      wasPendingRef.current = true
      setSaved(false)
      return
    }

    if (wasPendingRef.current) {
      setSaved(true)
      wasPendingRef.current = false
    }
  }, [pending])

  return (
    <div className="space-y-2">
      <button
        disabled={disabled || pending}
        className="w-full bg-club-navy text-black py-4 rounded-lg shadow-xl font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-club-gold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Save size={18} />
        {pending ? 'Saving...' : 'Save Card'}
      </button>
      <div className="flex justify-center min-h-5">
        {saved ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-700 border border-emerald-200">
            <Check size={12} />
            Saved Scores
          </span>
        ) : null}
      </div>
    </div>
  )
}
