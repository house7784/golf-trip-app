'use client'

import { Trash2, UserPlus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { assignToPairing } from './actions'
import { useTransition } from 'react'

interface SlotAssignmentProps {
  teeTimeId: string
  slotIndex: number
  player: any
  players: any[]
  takenIds: string[]
}

export default function SlotAssignment({ teeTimeId, slotIndex, player, players, takenIds }: SlotAssignmentProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const availablePlayers = players.filter(p => !takenIds.includes(p.profiles.id))

  const handleAssignment = async (formData: FormData) => {
    await assignToPairing(formData)
    startTransition(() => {
      router.refresh()
    })
  }

  return (
    <div className="relative z-10 w-8 h-8 flex items-center justify-center">
      <form action={handleAssignment}>
        <input type="hidden" name="teeTimeId" value={teeTimeId} />
        <input type="hidden" name="slotIndex" value={slotIndex} />

        {player ? (
          <button
            name="playerId"
            value="remove"
            disabled={isPending}
            className={`text-gray-300 hover:text-red-500 transition-colors p-1 ${isPending ? 'opacity-50' : ''}`}
            title="Remove Player"
          >
            <Trash2 size={16} />
          </button>
        ) : (
          <>
            <select
              name="playerId"
              onChange={(e) => e.target.form?.requestSubmit()}
              disabled={isPending}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-wait"
              defaultValue=""
            >
              <option value="" disabled>Select Golfer</option>
              {availablePlayers.length > 0 ? (
                  availablePlayers.map((p: any) => (
                  <option key={p.profiles.id} value={p.profiles.id}>
                      {/* SHOW NAME HERE */}
                      {p.profiles.full_name || p.profiles.email.split('@')[0]} (HCP: {p.profiles.handicap})
                  </option>
                  ))
              ) : (
                  <option disabled>No Players Available</option>
              )}
            </select>
            
            <UserPlus 
              size={18} 
              className={`text-gray-300 group-hover:text-club-gold pointer-events-none transition-colors ${isPending ? 'animate-pulse text-club-gold' : ''}`} 
            />
          </>
        )}
      </form>
    </div>
  )
}