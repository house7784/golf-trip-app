alter table if exists public.events
  add column if not exists focused_round_id uuid references public.rounds(id) on delete set null;
