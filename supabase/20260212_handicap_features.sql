-- Event-level handicap settings on events
alter table public.events
  add column if not exists handicap_cap numeric;

alter table public.events
  add column if not exists handicap_application text not null default 'standard';

-- Locked/snapshotted handicap per participant per event
alter table public.event_participants
  add column if not exists event_handicap numeric;

alter table public.event_participants
  add column if not exists handicap_locked_at timestamptz;

-- Guard application mode values
alter table public.events
  drop constraint if exists events_handicap_application_check;

alter table public.events
  add constraint events_handicap_application_check
  check (handicap_application in ('standard', 'par3_one_then_next_hardest'));

-- Helpful index for event participant lookups
create index if not exists idx_event_participants_event_user
  on public.event_participants(event_id, user_id);
