-- Polls: organizers create/manage, participants can read active poll definitions
alter table public.event_polls enable row level security;
alter table public.event_poll_responses enable row level security;

-- Clean up for re-runs
DROP POLICY IF EXISTS "event_polls_select_event_participants" ON public.event_polls;
DROP POLICY IF EXISTS "event_polls_insert_organizers" ON public.event_polls;
DROP POLICY IF EXISTS "event_polls_update_organizers" ON public.event_polls;
DROP POLICY IF EXISTS "event_polls_delete_organizers" ON public.event_polls;
DROP POLICY IF EXISTS "event_poll_responses_select_owner_or_organizer" ON public.event_poll_responses;
DROP POLICY IF EXISTS "event_poll_responses_insert_owner" ON public.event_poll_responses;
DROP POLICY IF EXISTS "event_poll_responses_update_owner" ON public.event_poll_responses;
DROP POLICY IF EXISTS "event_poll_responses_delete_organizer" ON public.event_poll_responses;

-- Anyone in event can read poll prompt/options (needed for required popup)
CREATE POLICY "event_polls_select_event_participants"
ON public.event_polls
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.event_participants ep
    WHERE ep.event_id = event_polls.event_id
      AND ep.user_id = auth.uid()
  )
);

-- Organizer-only create
CREATE POLICY "event_polls_insert_organizers"
ON public.event_polls
FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.event_participants ep
    WHERE ep.event_id = event_polls.event_id
      AND ep.user_id = auth.uid()
      AND ep.role = 'organizer'
  )
);

-- Organizer-only update (enable/disable, edit, close time)
CREATE POLICY "event_polls_update_organizers"
ON public.event_polls
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.event_participants ep
    WHERE ep.event_id = event_polls.event_id
      AND ep.user_id = auth.uid()
      AND ep.role = 'organizer'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.event_participants ep
    WHERE ep.event_id = event_polls.event_id
      AND ep.user_id = auth.uid()
      AND ep.role = 'organizer'
  )
);

-- Organizer-only delete
CREATE POLICY "event_polls_delete_organizers"
ON public.event_polls
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.event_participants ep
    WHERE ep.event_id = event_polls.event_id
      AND ep.user_id = auth.uid()
      AND ep.role = 'organizer'
  )
);

-- Poll responses: participants can read only their own response;
-- organizers can read all responses for event.
CREATE POLICY "event_poll_responses_select_owner_or_organizer"
ON public.event_poll_responses
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.event_participants ep
    WHERE ep.event_id = event_poll_responses.event_id
      AND ep.user_id = auth.uid()
      AND ep.role = 'organizer'
  )
);

-- Participants can insert only their own response
CREATE POLICY "event_poll_responses_insert_owner"
ON public.event_poll_responses
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.event_participants ep
    WHERE ep.event_id = event_poll_responses.event_id
      AND ep.user_id = auth.uid()
  )
);

-- Participants can update only their own response
CREATE POLICY "event_poll_responses_update_owner"
ON public.event_poll_responses
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
)
WITH CHECK (
  user_id = auth.uid()
);

-- Optional: organizer can delete bad response rows if needed
CREATE POLICY "event_poll_responses_delete_organizer"
ON public.event_poll_responses
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.event_participants ep
    WHERE ep.event_id = event_poll_responses.event_id
      AND ep.user_id = auth.uid()
      AND ep.role = 'organizer'
  )
);
