import { joinEventByLink } from '@/app/events/actions'

type JoinStatus = 'invalid_link' | 'event_not_found' | 'failed' | string | undefined

export default function JoinEventPanel({
  joinStatus,
  returnTo,
}: {
  joinStatus?: JoinStatus
  returnTo: string
}) {
  return (
    <div className="space-y-3">
      {joinStatus && (
        <div className="bg-white border border-club-gold/40 p-4 rounded-sm shadow-sm">
          <p className="text-xs uppercase tracking-wider font-bold text-club-text/60 mb-1">Join Event</p>
          <p className="text-sm text-club-navy">
            {joinStatus === 'invalid_link' && 'That invite link is invalid. Paste the full event link from the organizer.'}
            {joinStatus === 'event_not_found' && 'That event could not be found. Double-check the invite link and try again.'}
            {joinStatus === 'failed' && 'Could not join this event right now. Please try again.'}
          </p>
        </div>
      )}

      <form action={joinEventByLink as any} className="bg-white border border-club-navy/20 text-club-navy p-4 rounded-sm space-y-3">
        <input type="hidden" name="returnTo" value={returnTo} />
        <label className="block font-bold uppercase tracking-wider text-xs">Join Event</label>
        <input
          name="inviteLink"
          type="text"
          required
          placeholder="Paste organizer invite link"
          className="w-full bg-club-paper border border-club-gold/40 p-3 rounded-sm text-sm"
        />
        <button className="w-full bg-club-gold text-club-navy py-2 rounded-sm uppercase tracking-wide text-xs font-bold hover:bg-club-navy hover:text-white transition-all">
          Join Event
        </button>
      </form>
    </div>
  )
}
