-- traço · atualizações de 30/09, 01/10 e 02/10/2026 juntas. Cole tudo no SQL Editor do Supabase e clique em Run. Pode rodar mais de uma vez: não apaga nada.

-- ============================================================
-- Atualização de 30/09/2026 (traço)
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

-- ============================================================
-- Atualização de 01/10/2026 (traço)
-- Cole TUDO no SQL Editor do Supabase e clique em Run. Pode rodar mais de uma vez: não apaga nada.
-- Traz: plano Estúdio liberado no cadastro, todo mundo que está em teste passa a testar o Estúdio
--       e quem criar conta daqui para frente já começa testando o Estúdio.
-- ============================================================

-- 1) O plano Estúdio é aceito na assinatura e no pedido
alter table public.subscriptions drop constraint if exists subscriptions_plan_check;
alter table public.subscriptions add constraint subscriptions_plan_check check (plan in ('essencial', 'completo', 'estudio'));
alter table public.subscriptions drop constraint if exists subscriptions_requested_plan_check;
alter table public.subscriptions add constraint subscriptions_requested_plan_check check (requested_plan in ('essencial', 'completo', 'estudio'));

-- 2) Quem está no teste grátis agora passa a testar o Estúdio (só muda o plano testado; dias de teste e dados continuam iguais)
update public.subscriptions set plan = 'estudio' where status = 'trial' and plan <> 'estudio';

-- 3) Contas novas começam testando o Estúdio
create or replace function public.garantir_assinatura(plano text) returns setof public.subscriptions
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  insert into public.subscriptions (user_id, email, name, studio, plan, trial_ends)
  select u.id, coalesce(u.email, ''), coalesce(u.raw_user_meta_data ->> 'name', ''), coalesce(u.raw_user_meta_data ->> 'studio', ''),
         'estudio', -- o teste grátis é do plano Estúdio (o parâmetro fica só por compatibilidade)
         now() + make_interval(days => least(365, greatest(1, coalesce((select (s.data ->> 'trialDays')::int from public.platform_settings s where s.id = 1), 7))))
  from auth.users u where u.id = auth.uid()
  on conflict (user_id) do nothing;
  return query select * from public.subscriptions where user_id = auth.uid();
end $$;

-- Conferência: quantas pessoas estão testando cada plano
select plan, count(*) from public.subscriptions where status = 'trial' group by plan;

-- ============================================================
-- Atualização de 02/10/2026 (traço)
-- Cole TUDO no SQL Editor do Supabase e clique em Run. Pode rodar mais de uma vez: não apaga nada.
-- Traz: registro de acessos de cada conta (data, hora, aparelho e IP), para o comprovante do assinante
--       (prova de uso em caso de contestação de pagamento). Só a dona vê.
-- ============================================================

create table if not exists public.access_log (
  id bigserial primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  at timestamptz not null default now(),
  ip text,
  ua text
);
create index if not exists access_log_user_at on public.access_log (user_id, at desc);
alter table public.access_log enable row level security;
drop policy if exists "acessos: dona vê todos" on public.access_log;
create policy "acessos: dona vê todos" on public.access_log for select to authenticated using (public.sou_dona());

-- marcar_acesso passa a guardar também o registro (no máximo um a cada 30 minutos por conta)
create or replace function public.marcar_acesso() returns void
language plpgsql security definer set search_path = public as $$
declare h json;
begin
  update public.subscriptions set last_seen = now() where user_id = auth.uid();
  if auth.uid() is null then return; end if;
  if exists (select 1 from public.access_log where user_id = auth.uid() and at > now() - interval '30 minutes') then return; end if;
  begin
    h := current_setting('request.headers', true)::json;
  exception when others then h := null;
  end;
  insert into public.access_log (user_id, ip, ua)
  values (auth.uid(), split_part(coalesce(h->>'x-forwarded-for', h->>'x-real-ip', ''), ',', 1), left(coalesce(h->>'user-agent', ''), 300));
end $$;
revoke execute on function public.marcar_acesso() from public, anon;
grant execute on function public.marcar_acesso() to authenticated;
