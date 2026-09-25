-- Rode uma vez no Supabase: SQL Editor → New query → cole tudo → Run.
-- Guarda todos os dados do sistema numa linha por usuária.
-- RLS garante que só quem está logada lê e altera os próprios dados.

create table if not exists public.workspace (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb       not null,
  updated_at timestamptz not null default now()
);

alter table public.workspace enable row level security;

drop policy if exists "dona lê"      on public.workspace;
drop policy if exists "dona cria"    on public.workspace;
drop policy if exists "dona altera"  on public.workspace;

create policy "dona lê"     on public.workspace for select using (auth.uid() = user_id);
create policy "dona cria"   on public.workspace for insert with check (auth.uid() = user_id);
create policy "dona altera" on public.workspace for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
