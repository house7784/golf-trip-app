create table if not exists public.event_polls (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  question text not null,
  description text,
  options text[] not null default '{}',
  require_response boolean not null default true,
  is_enabled boolean not null default true,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  disabled_at timestamptz
);

create index if not exists idx_event_polls_event_enabled_created
  on public.event_polls(event_id, is_enabled, created_at desc);

create table if not exists public.event_poll_responses (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.event_polls(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  selected_option text,
  response_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_poll_responses_poll_user_unique unique (poll_id, user_id),
  constraint event_poll_responses_has_answer check (
    coalesce(nullif(trim(selected_option), ''), nullif(trim(response_text), '')) is not null
  )
);

create index if not exists idx_event_poll_responses_poll
  on public.event_poll_responses(poll_id);

create index if not exists idx_event_poll_responses_event_user
  on public.event_poll_responses(event_id, user_id);
