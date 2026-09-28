-- ============================================================
-- Plataforma (Fase 1): dona, assinaturas, chat e horários online.
-- Rode UMA vez no Supabase: SQL Editor → New query → cole tudo → Run.
-- Pode rodar de novo sem problema (não apaga nada).
-- Antes, rode o schema.sql (tabela workspace), se ainda não rodou.
-- ============================================================

-- 1) Quem é a dona (a Laís). Só quem está aqui vê o painel e todas as conversas.
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);
alter table public.admins enable row level security;
drop policy if exists "admins: vê a si mesma" on public.admins;
create policy "admins: vê a si mesma" on public.admins for select using (auth.uid() = user_id);

-- >>> TROQUE o e-mail abaixo se a sua conta usar outro <<<
insert into public.admins (user_id)
select id from auth.users where lower(email) = lower('arq.laisav@gmail.com')
on conflict do nothing;

create or replace function public.sou_dona() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- 2) Assinaturas: uma linha por cliente. O cliente só LÊ a própria linha;
--    quem muda plano/situação/bloqueio é a dona (ou as funções abaixo, com regras).
create table if not exists public.subscriptions (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  email       text not null default '',
  name        text not null default '',
  studio      text not null default '',
  plan        text not null default 'essencial' check (plan in ('essencial', 'completo')),
  status      text not null default 'trial' check (status in ('trial', 'ativa', 'atrasada', 'cancelada')),
  trial_ends  timestamptz not null default now() + interval '14 days',
  blocked     boolean not null default false,
  test_mode   boolean not null default true,
  created_at  timestamptz not null default now(),
  last_seen   timestamptz not null default now(),
  canceled_at timestamptz
);
alter table public.subscriptions enable row level security;
drop policy if exists "assinatura: cliente vê a sua" on public.subscriptions;
drop policy if exists "assinatura: dona vê todas" on public.subscriptions;
drop policy if exists "assinatura: dona altera" on public.subscriptions;
create policy "assinatura: cliente vê a sua" on public.subscriptions for select using (auth.uid() = user_id);
create policy "assinatura: dona vê todas" on public.subscriptions for select using (public.sou_dona());
create policy "assinatura: dona altera" on public.subscriptions for update using (public.sou_dona()) with check (public.sou_dona());

-- Cria a assinatura em teste grátis na primeira entrada (o plano vem do cadastro).
create or replace function public.garantir_assinatura(plano text) returns setof public.subscriptions
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  insert into public.subscriptions (user_id, email, name, studio, plan)
  select u.id, coalesce(u.email, ''), coalesce(u.raw_user_meta_data ->> 'name', ''), coalesce(u.raw_user_meta_data ->> 'studio', ''),
         case when plano = 'completo' then 'completo' else 'essencial' end
  from auth.users u where u.id = auth.uid()
  on conflict (user_id) do nothing;
  return query select * from public.subscriptions where user_id = auth.uid();
end $$;

-- Último acesso (aparece no painel da dona).
create or replace function public.marcar_acesso() returns void
language sql security definer set search_path = public as $$
  update public.subscriptions set last_seen = now() where user_id = auth.uid();
$$;

-- Fase 1 (modo teste, SEM cobrança): o cliente troca de plano e pode "assinar".
-- Não desbloqueia conta bloqueada pela dona. Na Fase 2 isso passa a ser feito pelo pagamento.
create or replace function public.escolher_plano(plano text, assinar boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if plano not in ('essencial', 'completo') then raise exception 'plano inválido'; end if;
  update public.subscriptions
     set plan = plano,
         status = case when assinar then 'ativa' else status end,
         canceled_at = case when assinar then null else canceled_at end,
         test_mode = true
   where user_id = auth.uid();
end $$;

-- 3) Chat com a dona: mensagens por cliente.
create table if not exists public.support_messages (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references auth.users (id) on delete cascade,
  from_owner  boolean not null default false,
  body        text not null check (length(body) between 1 and 4000),
  created_at  timestamptz not null default now(),
  read_at     timestamptz
);
create index if not exists support_messages_client on public.support_messages (client_id, created_at);
alter table public.support_messages enable row level security;
drop policy if exists "chat: cliente vê as suas" on public.support_messages;
drop policy if exists "chat: cliente escreve" on public.support_messages;
drop policy if exists "chat: dona vê tudo" on public.support_messages;
drop policy if exists "chat: dona responde" on public.support_messages;
create policy "chat: cliente vê as suas" on public.support_messages for select using (auth.uid() = client_id);
create policy "chat: cliente escreve" on public.support_messages for insert with check (auth.uid() = client_id and from_owner = false);
create policy "chat: dona vê tudo" on public.support_messages for select using (public.sou_dona());
create policy "chat: dona responde" on public.support_messages for insert with check (public.sou_dona() and from_owner = true);

-- Marca como lidas as mensagens do outro lado da conversa.
create or replace function public.marcar_lidas(cliente uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.sou_dona() then
    update public.support_messages set read_at = now() where client_id = cliente and from_owner = false and read_at is null;
  elsif auth.uid() = cliente then
    update public.support_messages set read_at = now() where client_id = cliente and from_owner = true and read_at is null;
  end if;
end $$;

-- Tempo real: mensagens novas aparecem na hora (respeitando as regras acima).
do $$ begin
  alter publication supabase_realtime add table public.support_messages;
exception when duplicate_object then null; end $$;

-- 4) Ajustes da plataforma (horários online da dona). Todos leem; só a dona altera.
create table if not exists public.platform_settings (
  id   int primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb
);
alter table public.platform_settings enable row level security;
drop policy if exists "ajustes: todos leem" on public.platform_settings;
drop policy if exists "ajustes: dona cria" on public.platform_settings;
drop policy if exists "ajustes: dona altera" on public.platform_settings;
create policy "ajustes: todos leem" on public.platform_settings for select to authenticated using (true);
create policy "ajustes: dona cria" on public.platform_settings for insert with check (public.sou_dona());
create policy "ajustes: dona altera" on public.platform_settings for update using (public.sou_dona()) with check (public.sou_dona());

-- Conferência: deve mostrar 1 linha com o seu e-mail.
select u.email as dona from public.admins a join auth.users u on u.id = a.user_id;
