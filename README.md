# Golf Trip App

Web app for running multi-day golf trips with event management, tee times, score entry, game modes, announcements, and live chat.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind CSS 4
- Supabase (Auth + Postgres + Realtime)
- Server Actions for writes/mutations
- OpenAI SDK for optional course scorecard assistance

## Quick Start

1. Install dependencies

```bash
npm install
```

2. Add environment variables in `.env.local`

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
OPENAI_API_KEY=...
```

3. Run locally

```bash
npm run dev
```

App runs at http://localhost:3000.

## Product Flow

1. User signs in/up.
2. User lands on member dashboard (`/`).
3. Organizer creates event and configures rounds/modes.
4. Organizer sets tee times, assigns players, sets course/par/hcp.
5. Players enter hole-by-hole scores.
6. Group uses announcements + live chat during play.

## Route Map (Current)

### Global

- `/` Home/member dashboard
- `/login` Auth screen (sign in/up)
- `/onboarding` Profile handicap setup
- `/events` Event list
- `/events/create` Create event
- `/scorecard` Legacy standalone score page (not main event flow)

### Event-scoped

- `/events/[id]/dashboard` Event hub
- `/events/[id]/tee-times` Tee sheet, round lock, course setup access
- `/events/[id]/scorecard` Hole-by-hole score entry
- `/events/[id]/modes` Round/game mode assignment by date
- `/events/[id]/teams` Team structure, roster assignment, captain setting
- Chat is injected by layout (`TrashTalk`) for all event pages

### Linked but not implemented yet

- `/events/[id]/leaderboard`
- `/events/[id]/challenges`
- `/events/[id]/announcements/new`

## Architecture

### Frontend

- Next.js App Router with mostly server components.
- Client components used where interactivity/realtime is needed:
	- `TrashTalk.tsx`
	- `CourseSetup.tsx`
	- `SlotAssignment.tsx`

### Backend/Data Access

- Supabase server client in server components/actions: `utils/supabase/server.ts`
- Supabase browser client for realtime chat: `utils/supabase/client.ts`
- Writes go through Server Actions in route-local `actions.ts` files.

### Authorization Model (Current)

- Authenticated guard on event layout/pages via `supabase.auth.getUser()`.
- Organizer logic is role/ownership driven:
	- Event creator/participant with organizer role gets admin controls.
- Access checks exist in UI layer; add/confirm RLS policies in Supabase for hard enforcement.

## Supabase Data Model Map

The app currently depends on the following logical tables and relationships.

### Identity & Profiles

- `auth.users` (Supabase-managed)
- `profiles`
	- `id` (PK, references `auth.users.id`)
	- profile fields used in app include name/email/handicap values

### Event Core

- `events`
	- `id` (PK)
	- `name`, `start_date`, `end_date`, `location`, `created_by`
- `event_participants`
	- joins users to events
	- role field used (`organizer`/player-like role)
	- optional `team_id` used by team assignment

### Teams & Rosters

- `teams`
	- `id`, `event_id`, `name`, `captain_id`

### Rounds / Formats / Course Setup

- `rounds`
	- `id`, `event_id`, `date`, `mode_key`
	- `course_name`, `course_data`, `scoring_locked`
- `course_data` is JSON currently modeled as:
	- `{ holes: [{ number, par, hcp }, ... x18] }`

### Tee Sheet

- `tee_times`
	- `id`, `round_id`, `time`
- `pairings`
	- `tee_time_id`, `slot_number` (1-4), `player_id`
	- unique slot expected per (`tee_time_id`, `slot_number`)

### Scoring

- `scores`
	- `round_id`, `user_id`, `hole_scores`
	- upsert conflict key used: (`round_id`, `user_id`)
- `hole_scores` JSON shape:
	- `{ "1": 4, "2": 5, ... }`

### Communication

- `announcements`
	- event-scoped updates
- `messages`
	- event chat rows; consumed with Supabase realtime

## Actions by Area

- Auth: `app/login/actions.ts`
- Event creation: `app/events/actions.ts`
- Dashboard announcements: `app/events/[id]/dashboard/actions.ts`
- Tee times & assignments: `app/events/[id]/tee-times/actions.ts`
- Round modes: `app/events/[id]/modes/actions.ts`
- Teams & captains: `app/events/[id]/teams/actions.ts`
- Score entry/course save: `app/events/[id]/scorecard/actions.ts`
- Chat send: `app/events/[id]/chat/actions.ts`

## Known Gaps / Cleanup Targets

- README previously boilerplate (now replaced).
- Some UI links route to pages not yet created (leaderboard/challenges/announcement composer).
- Field naming appears mixed in places (`handicap` vs `handicap_index`; announcement shape variants).
- Legacy `app/scorecard/page.tsx` overlaps conceptually with event scorecard flow.

## Suggested Next Engineering Steps

1. Create missing routes for leaderboard/challenges/announcement compose.
2. Standardize profile + announcement column names across all actions/pages.
3. Add/verify strict RLS policies for every table above.
4. Add a typed DB schema layer (generated Supabase types) to reduce runtime mismatches.
5. Add lightweight smoke tests for critical flows (auth, event creation, score submit).
