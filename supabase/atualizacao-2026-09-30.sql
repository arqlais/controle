-- ============================================================
-- Atualização de 30/09/2026 (planê)
-- Cole TUDO no SQL Editor do Supabase e clique em Run. Pode rodar mais de uma vez: não apaga nada.
-- Traz: plano semestral no pedido de assinatura, testar o Estúdio no teste grátis,
--       avisos dos clientes finais e o termômetro de uso do painel.
-- (Precisa que o supabase/plataforma.sql já tenha sido rodado alguma vez antes.)
-- ============================================================

-- 1) Pedido de assinatura aceita o ciclo semestral
alter table public.subscriptions add column if not exists requested_cycle text;
alter table public.subscriptions drop constraint if exists subscriptions_requested_cycle_check;
alter table public.subscriptions add constraint subscriptions_requested_cycle_check check (requested_cycle in ('mensal', 'semestral', 'anual'));

drop function if exists public.pedir_assinatura(text);
create or replace function public.pedir_assinatura(plano text, ciclo text default 'mensal') returns void
language plpgsql security definer set search_path = public as $$
begin
  if plano not in ('essencial', 'completo', 'estudio') then raise exception 'plano inválido'; end if;
  if ciclo not in ('mensal', 'semestral', 'anual') then raise exception 'período inválido'; end if;
  update public.subscriptions set requested_plan = plano, requested_cycle = ciclo, requested_at = now() where user_id = auth.uid();
  insert into public.support_messages (client_id, from_owner, body)
  values (auth.uid(), false, 'quero assinar o plano ' || case plano when 'completo' then 'Completo' when 'estudio' then 'Estúdio' else 'Essencial' end || ' (' || ciclo || ')');
end $$;

-- 2) No teste grátis dá para testar qualquer um dos 3 planos
create or replace function public.escolher_plano(plano text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if plano not in ('essencial', 'completo', 'estudio') then raise exception 'plano inválido'; end if;
  update public.subscriptions set plan = plano
   where user_id = auth.uid() and status = 'trial' and not blocked and trial_ends > now();
end $$;

revoke execute on function public.pedir_assinatura(text, text), public.escolher_plano(text) from public, anon;
grant execute on function public.pedir_assinatura(text, text), public.escolher_plano(text) to authenticated;

-- 3)  Avisos dos clientes finais (assinatura de contrato, recado pelo painel): quem grava é a função
--     "avisos" (com a chave de serviço). O profissional só lê e marca como visto os avisos dele.
create table if not exists public.client_events (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  kind       text not null,
  ref        text not null,
  payload    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  seen_at    timestamptz,
  unique (user_id, kind, ref)
);
alter table public.client_events enable row level security;
drop policy if exists "avisos do cliente: dono vê" on public.client_events;
drop policy if exists "avisos do cliente: dono marca" on public.client_events;
create policy "avisos do cliente: dono vê" on public.client_events for select to authenticated using (user_id = auth.uid());
create policy "avisos do cliente: dono marca" on public.client_events for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());


-- 4)  Termômetro de uso: só CONTAGENS (quantos orçamentos, clientes, contratos…), nunca o conteúdo.
--     Cada conta grava a sua; a dona vê de todos para saber quem está usando de verdade.
create table if not exists public.usage_stats (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  quotes         int not null default 0,
  clients        int not null default 0,
  projects       int not null default 0,
  contracts      int not null default 0,
  docs           int not null default 0,
  briefings      int not null default 0,
  last_quote_at  date,
  updated_at     timestamptz not null default now()
);
alter table public.usage_stats enable row level security;
drop policy if exists "uso: conta grava a sua" on public.usage_stats;
drop policy if exists "uso: conta atualiza a sua" on public.usage_stats;
drop policy if exists "uso: conta vê a sua" on public.usage_stats;
drop policy if exists "uso: dona vê todos" on public.usage_stats;
create policy "uso: conta grava a sua" on public.usage_stats for insert to authenticated with check (user_id = auth.uid());
create policy "uso: conta atualiza a sua" on public.usage_stats for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "uso: conta vê a sua" on public.usage_stats for select to authenticated using (user_id = auth.uid());
create policy "uso: dona vê todos" on public.usage_stats for select to authenticated using (public.sou_dona());


-- Conferência: deve mostrar as duas tabelas novas.
select table_name from information_schema.tables where table_schema = 'public' and table_name in ('client_events', 'usage_stats');
