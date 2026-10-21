-- Rodar no Supabase (SQL Editor → New query → colar tudo → Run). Pode rodar mais de uma vez: não apaga nada.
-- Garante a tabela dos links públicos (briefing e dados para contrato) e as duas funções que a página do cliente usa.

--     Quem responde só lê aquele briefing (pelo código do link) e manda as respostas uma vez.
create table if not exists public.briefing_links (
  id          uuid primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  payload     jsonb not null,
  answers     jsonb,
  answered_at timestamptz,
  created_at  timestamptz not null default now()
);
alter table public.briefing_links enable row level security;
drop policy if exists "briefing: dono" on public.briefing_links;
create policy "briefing: dono" on public.briefing_links for all
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.pode_editar());

create or replace function public.briefing_publico(p_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('payload', b.payload, 'respondido', b.answered_at is not null)
    from public.briefing_links b where b.id = p_id;
$$;
create or replace function public.responder_briefing(p_id uuid, p_answers jsonb) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if jsonb_typeof(p_answers) <> 'object' or pg_column_size(p_answers) > 200000 then return false; end if;
  update public.briefing_links set answers = p_answers, answered_at = now()
   where id = p_id and answered_at is null;
  return found;
end;
$$;
revoke execute on function public.briefing_publico(uuid), public.responder_briefing(uuid, jsonb) from public;
grant execute on function public.briefing_publico(uuid), public.responder_briefing(uuid, jsonb) to anon, authenticated;
-- publicado pela automação em 2026-10-20
-- (2ª tentativa)
-- (3ª)
