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
  pairings: any[]
  enforceTeamPairing: boolean
  teamNameById: Record<string, string>
}

function getSideSlots(slotNumber: number) {
  return slotNumber <= 2 ? [1, 2] : [3, 4]
}

function getOppositeSideSlots(slotNumber: number) {
  return slotNumber <= 2 ? [3, 4] : [1, 2]
}

export default function SlotAssignment({ teeTimeId, slotIndex, player, players, takenIds, pairings, enforceTeamPairing, teamNameById }: SlotAssignmentProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const slotNumber = slotIndex + 1
  const sideSlots = getSideSlots(slotNumber)
  const oppositeSlots = getOppositeSideSlots(slotNumber)

  const pairingBySlot = new Map<number, any>()
  pairings.forEach((pairing) => {
    pairingBySlot.set(pairing.slot_number, pairing)
  })

  const sidePlayers = sideSlots
    .filter((slot) => slot !== slotNumber)
    .map((slot) => pairingBySlot.get(slot)?.player_id)
    .filter(Boolean) as string[]

  const oppositePlayers = oppositeSlots
    .map((slot) => pairingBySlot.get(slot)?.player_id)
    .filter(Boolean) as string[]

  const playerMap = new Map<string, any>()
  players.forEach((entry) => {
    if (entry?.profiles?.id) {
      playerMap.set(entry.profiles.id, entry)
    }
  })

  const sideTeams = Array.from(
    new Set(
      sidePlayers
        .map((id) => playerMap.get(id)?.team_id)
        .filter(Boolean)
    )
  ) as string[]

  const oppositeTeams = Array.from(
    new Set(
      oppositePlayers
        .map((id) => playerMap.get(id)?.team_id)
        .filter(Boolean)
    )
  ) as string[]

  const availablePlayers = players.filter((entry) => {
    const candidateId = entry?.profiles?.id
    if (!candidateId) return false
    if (takenIds.includes(candidateId)) return false

    if (!enforceTeamPairing) return true

    const candidateTeamId = entry?.team_id
    if (!candidateTeamId) return false

    if (sideTeams.length > 0 && !sideTeams.includes(candidateTeamId)) return false
    if (sideTeams.length === 0 && oppositeTeams.length === 1 && oppositeTeams[0] === candidateTeamId) return false

    return true
  })

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
                    {p.profiles.full_name || p.profiles.email.split('@')[0]} • {teamNameById[p.team_id] || 'No Team'}
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