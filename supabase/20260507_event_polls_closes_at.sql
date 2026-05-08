alter table public.event_polls
  add column if not exists closes_at timestamptz;

create index if not exists idx_event_polls_event_enabled_closes
  on public.event_polls(event_id, is_enabled, closes_at);
