-- FocusFlow tasks table
-- Run this in the Supabase SQL editor (or: supabase db push with the CLI).

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  notes text not null default '',
  kind text not null check (kind in ('work', 'personal')) default 'work',
  section text not null check (section in ('today', 'later')) default 'today',
  tags text[] not null default '{}',
  done boolean not null default false,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists tasks_user_id_created_at_idx
  on public.tasks (user_id, created_at);

-- Row Level Security: a signed-in user can only touch their OWN rows.
alter table public.tasks enable row level security;

create policy "Users can view their own tasks"
  on public.tasks for select
  using (auth.uid() = user_id);

create policy "Users can insert their own tasks"
  on public.tasks for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own tasks"
  on public.tasks for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own tasks"
  on public.tasks for delete
  using (auth.uid() = user_id);
