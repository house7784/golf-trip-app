-- Sanity check script for event poll RLS policies.
-- This script is non-destructive (ends with ROLLBACK).
-- Replace only the event_id placeholder in _rls_input before running.

BEGIN;

SET LOCAL row_security = on;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

CREATE TEMP TABLE _rls_ctx (
  event_id uuid,
  organizer_user_id uuid,
  player_user_id uuid,
  other_user_id uuid
) ON COMMIT DROP;

CREATE TEMP TABLE _rls_input (
  event_id uuid
) ON COMMIT DROP;

INSERT INTO _rls_input (event_id)
VALUES ('00000000-0000-0000-0000-000000000000');

INSERT INTO _rls_ctx (event_id, organizer_user_id, player_user_id, other_user_id)
SELECT
  i.event_id,
  organizer_pick.user_id,
  players.player_user_id,
  players.other_user_id
FROM _rls_input i
LEFT JOIN LATERAL (
  SELECT ep.user_id
  FROM public.event_participants ep
  WHERE ep.event_id = i.event_id
    AND ep.role = 'organizer'
  ORDER BY ep.user_id
  LIMIT 1
) organizer_pick ON true
LEFT JOIN LATERAL (
  SELECT
    (
      SELECT ep.user_id
      FROM public.event_participants ep
      WHERE ep.event_id = i.event_id
        AND ep.user_id <> organizer_pick.user_id
      ORDER BY ep.user_id
      LIMIT 1 OFFSET 0
    ) AS player_user_id,
    (
      SELECT ep.user_id
      FROM public.event_participants ep
      WHERE ep.event_id = i.event_id
        AND ep.user_id <> organizer_pick.user_id
      ORDER BY ep.user_id
      LIMIT 1 OFFSET 1
    ) AS other_user_id
  FROM (SELECT 1) pick
) players ON true;

DO $$
DECLARE
  c record;
BEGIN
  SELECT * INTO c FROM _rls_ctx;
  IF c.event_id = '00000000-0000-0000-0000-000000000000'::uuid THEN
    RAISE EXCEPTION 'Replace event_id placeholder in _rls_input before running this script';
  END IF;

  IF c.organizer_user_id IS NULL THEN
    RAISE EXCEPTION 'No organizer found in event_participants for event %', c.event_id;
  END IF;

  IF c.player_user_id IS NULL OR c.other_user_id IS NULL THEN
    RAISE EXCEPTION 'Need at least 2 non-organizer participants for event %', c.event_id;
  END IF;
END $$;

CREATE TEMP TABLE _rls_test_ids (
  poll_id uuid
) ON COMMIT DROP;

-- 1) Organizer can create a poll
SELECT set_config('request.jwt.claim.sub', (SELECT organizer_user_id::text FROM _rls_ctx), true);

INSERT INTO public.event_polls (
  event_id,
  question,
  description,
  options,
  require_response,
  is_enabled,
  created_by,
  closes_at
)
SELECT
  c.event_id,
  'RLS sanity check poll',
  'Temporary poll for policy validation',
  ARRAY['Yes', 'No']::text[],
  true,
  true,
  c.organizer_user_id,
  now() + interval '2 hours'
FROM _rls_ctx c
RETURNING id;

INSERT INTO _rls_test_ids (poll_id)
SELECT id
FROM public.event_polls
WHERE question = 'RLS sanity check poll'
ORDER BY created_at DESC
LIMIT 1;

DO $$
DECLARE
  n int;
BEGIN
  SELECT COUNT(*) INTO n FROM _rls_test_ids;
  IF n <> 1 THEN
    RAISE EXCEPTION 'FAIL: organizer poll creation did not produce a test poll';
  END IF;
  RAISE NOTICE 'PASS: organizer created poll';
END $$;

-- 2) Non-organizer cannot create a poll
SELECT set_config('request.jwt.claim.sub', (SELECT player_user_id::text FROM _rls_ctx), true);

DO $$
DECLARE
  blocked boolean := false;
BEGIN
  BEGIN
    INSERT INTO public.event_polls (
      event_id,
      question,
      options,
      require_response,
      is_enabled,
      created_by
    )
    SELECT
      c.event_id,
      'Should fail - player create',
      ARRAY['A', 'B']::text[],
      true,
      true,
      c.player_user_id
    FROM _rls_ctx c;
  EXCEPTION WHEN OTHERS THEN
    blocked := true;
    RAISE NOTICE 'PASS: player create poll blocked (%).', SQLERRM;
  END;

  IF NOT blocked THEN
    RAISE EXCEPTION 'FAIL: player was able to create a poll';
  END IF;
END $$;

-- 3) Player can read poll definitions for their event (for popup)
DO $$
DECLARE
  cnt int;
BEGIN
  SELECT COUNT(*) INTO cnt
  FROM public.event_polls p
  WHERE p.event_id = (SELECT event_id FROM _rls_ctx);

  IF cnt < 1 THEN
    RAISE EXCEPTION 'FAIL: player could not read polls for event';
  END IF;

  RAISE NOTICE 'PASS: player can read poll definitions';
END $$;

-- 4) Player can insert own response
INSERT INTO public.event_poll_responses (
  poll_id,
  event_id,
  user_id,
  selected_option,
  response_text
)
SELECT
  t.poll_id,
  c.event_id,
  c.player_user_id,
  'Yes',
  'Player response'
FROM _rls_test_ids t
CROSS JOIN _rls_ctx c;

DO $$
BEGIN
  RAISE NOTICE 'PASS: player inserted own response';
END $$;

-- 5) Another participant inserts their own response
SELECT set_config('request.jwt.claim.sub', (SELECT other_user_id::text FROM _rls_ctx), true);

INSERT INTO public.event_poll_responses (
  poll_id,
  event_id,
  user_id,
  selected_option,
  response_text
)
SELECT
  t.poll_id,
  c.event_id,
  c.other_user_id,
  'No',
  'Other response'
FROM _rls_test_ids t
CROSS JOIN _rls_ctx c;

DO $$
BEGIN
  RAISE NOTICE 'PASS: other participant inserted own response';
END $$;

-- 6) Player cannot read other users' responses (should only see 1 row)
SELECT set_config('request.jwt.claim.sub', (SELECT player_user_id::text FROM _rls_ctx), true);

DO $$
DECLARE
  cnt int;
BEGIN
  SELECT COUNT(*) INTO cnt
  FROM public.event_poll_responses r
  WHERE r.poll_id = (SELECT poll_id FROM _rls_test_ids LIMIT 1);

  IF cnt <> 1 THEN
    RAISE EXCEPTION 'FAIL: player can see % responses (expected 1 own response)', cnt;
  END IF;

  RAISE NOTICE 'PASS: player sees only own response';
END $$;

-- 7) Organizer can read all responses (should see >= 2 rows)
SELECT set_config('request.jwt.claim.sub', (SELECT organizer_user_id::text FROM _rls_ctx), true);

DO $$
DECLARE
  cnt int;
BEGIN
  SELECT COUNT(*) INTO cnt
  FROM public.event_poll_responses r
  WHERE r.poll_id = (SELECT poll_id FROM _rls_test_ids LIMIT 1);

  IF cnt < 2 THEN
    RAISE EXCEPTION 'FAIL: organizer cannot see all responses (saw %)', cnt;
  END IF;

  RAISE NOTICE 'PASS: organizer sees all responses';
END $$;

-- 8) Player cannot update poll
SELECT set_config('request.jwt.claim.sub', (SELECT player_user_id::text FROM _rls_ctx), true);

DO $$
DECLARE
  blocked boolean := false;
BEGIN
  BEGIN
    UPDATE public.event_polls
    SET question = 'Should fail - player update'
    WHERE id = (SELECT poll_id FROM _rls_test_ids LIMIT 1);
  EXCEPTION WHEN OTHERS THEN
    blocked := true;
    RAISE NOTICE 'PASS: player update poll blocked (%).', SQLERRM;
  END;

  IF NOT blocked THEN
    RAISE EXCEPTION 'FAIL: player was able to update poll';
  END IF;
END $$;

ROLLBACK;
