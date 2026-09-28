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
  trial_ends  timestamptz not null default now() + interval '7 days',
  blocked     boolean not null default false,
  test_mode   boolean not null default true,
  created_at  timestamptz not null default now(),
  last_seen   timestamptz not null default now(),
  canceled_at timestamptz
);
alter table public.subscriptions add column if not exists requested_plan text check (requested_plan in ('essencial', 'completo'));
alter table public.subscriptions add column if not exists requested_at timestamptz;
alter table public.subscriptions add column if not exists requested_cycle text check (requested_cycle in ('mensal', 'anual'));
alter table public.subscriptions alter column trial_ends set default now() + interval '7 days';
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
  insert into public.subscriptions (user_id, email, name, studio, plan, trial_ends)
  select u.id, coalesce(u.email, ''), coalesce(u.raw_user_meta_data ->> 'name', ''), coalesce(u.raw_user_meta_data ->> 'studio', ''),
         'completo', -- o teste grátis é sempre do plano Completo (o parâmetro fica só por compatibilidade)
         -- dias de teste: os escolhidos no painel (planos), ou 7; entre 1 e 365
         now() + make_interval(days => least(365, greatest(1, coalesce((select (s.data ->> 'trialDays')::int from public.platform_settings s where s.id = 1), 7))))
  from auth.users u where u.id = auth.uid()
  on conflict (user_id) do nothing;
  return query select * from public.subscriptions where user_id = auth.uid();
end $$;

-- Último acesso (aparece no painel da dona).
create or replace function public.marcar_acesso() returns void
language sql security definer set search_path = public as $$
  update public.subscriptions set last_seen = now() where user_id = auth.uid();
$$;

-- Durante o teste grátis o cliente pode trocar o plano que está testando. NÃO ativa nada.
drop function if exists public.escolher_plano(text, boolean);
create or replace function public.escolher_plano(plano text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if plano not in ('essencial', 'completo') then raise exception 'plano inválido'; end if;
  update public.subscriptions set plan = plano
   where user_id = auth.uid() and status = 'trial' and not blocked and trial_ends > now();
end $$;

-- Assinar = PEDIR (depois de preencher os dados de cobrança). Só a dona ativa, depois de confirmar o pagamento;
-- na Fase 2, o pagamento ativa sozinho.
drop function if exists public.pedir_assinatura(text);
create or replace function public.pedir_assinatura(plano text, ciclo text default 'mensal') returns void
language plpgsql security definer set search_path = public as $$
begin
  if plano not in ('essencial', 'completo') then raise exception 'plano inválido'; end if;
  if ciclo not in ('mensal', 'anual') then raise exception 'período inválido'; end if;
  update public.subscriptions set requested_plan = plano, requested_cycle = ciclo, requested_at = now() where user_id = auth.uid();
  insert into public.support_messages (client_id, from_owner, body)
  values (auth.uid(), false, 'quero assinar o plano ' || case when plano = 'completo' then 'Completo' else 'Essencial' end || ' (' || ciclo || ') ✨');
end $$;

-- Dados de cobrança preenchidos na assinatura (nome, CPF/CNPJ, endereço, forma de pagamento).
-- Cada cliente vê e altera só os dele; a dona vê todos. Nunca guarda número de cartão.
create table if not exists public.billing_info (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null default '{}'::jsonb check (pg_column_size(data) < 20000),
  updated_at timestamptz not null default now()
);
alter table public.billing_info enable row level security;
drop policy if exists "cobrança: cliente vê a sua" on public.billing_info;
drop policy if exists "cobrança: cliente cria a sua" on public.billing_info;
drop policy if exists "cobrança: cliente altera a sua" on public.billing_info;
drop policy if exists "cobrança: dona vê todas" on public.billing_info;
create policy "cobrança: cliente vê a sua" on public.billing_info for select using (auth.uid() = user_id);
create policy "cobrança: cliente cria a sua" on public.billing_info for insert with check (auth.uid() = user_id);
create policy "cobrança: cliente altera a sua" on public.billing_info for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "cobrança: dona vê todas" on public.billing_info for select using (public.sou_dona());

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
-- a página de vendas (sem login) lê a seção "quem criou", os contatos e os termos daqui
create policy "ajustes: todos leem" on public.platform_settings for select using (true);
create policy "ajustes: dona cria" on public.platform_settings for insert with check (public.sou_dona());
create policy "ajustes: dona altera" on public.platform_settings for update using (public.sou_dona()) with check (public.sou_dona());

-- 4b) Sugestões de melhoria: cada pessoa vê as dela; a dona vê todas, muda a situação e responde.
create table if not exists public.suggestions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category   text not null default 'outro' check (category in ('nova', 'melhoria', 'problema', 'outro')),
  title      text not null check (length(title) between 1 and 140),
  body       text not null default '' check (length(body) <= 4000),
  status     text not null default 'recebida' check (status in ('recebida', 'analisando', 'planejada', 'feita', 'nao_agora')),
  reply      text not null default '' check (length(reply) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.suggestions enable row level security;
drop policy if exists "sugestões: vê as suas" on public.suggestions;
drop policy if exists "sugestões: envia" on public.suggestions;
drop policy if exists "sugestões: dona vê todas" on public.suggestions;
drop policy if exists "sugestões: dona responde" on public.suggestions;
create policy "sugestões: vê as suas" on public.suggestions for select using (auth.uid() = user_id);
create policy "sugestões: envia" on public.suggestions for insert with check (auth.uid() = user_id and status = 'recebida' and reply = '');
create policy "sugestões: dona vê todas" on public.suggestions for select using (public.sou_dona());
create policy "sugestões: dona responde" on public.suggestions for update using (public.sou_dona()) with check (public.sou_dona());

-- 4c) Depoimentos: quem usa avalia; a dona escolhe quais aparecem na página de vendas.
--     Só aparecem os que a pessoa autorizou. A página de vendas lê por uma função que devolve
--     apenas nome, profissão, texto e estrelas (nunca e-mail ou id).
create table if not exists public.feedbacks (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name          text not null default '' check (length(name) <= 80),
  role          text not null default '' check (length(role) <= 80),
  text          text not null check (length(text) between 1 and 600),
  stars         int  not null default 5 check (stars between 1 and 5),
  allow_publish boolean not null default false,
  published     boolean not null default false,
  created_at    timestamptz not null default now()
);
alter table public.feedbacks enable row level security;
drop policy if exists "depoimentos: vê os seus" on public.feedbacks;
drop policy if exists "depoimentos: envia" on public.feedbacks;
drop policy if exists "depoimentos: apaga os seus" on public.feedbacks;
drop policy if exists "depoimentos: dona vê todos" on public.feedbacks;
drop policy if exists "depoimentos: dona publica" on public.feedbacks;
drop policy if exists "depoimentos: dona apaga" on public.feedbacks;
create policy "depoimentos: vê os seus" on public.feedbacks for select using (auth.uid() = user_id);
create policy "depoimentos: envia" on public.feedbacks for insert with check (auth.uid() = user_id and published = false);
create policy "depoimentos: apaga os seus" on public.feedbacks for delete using (auth.uid() = user_id);
create policy "depoimentos: dona vê todos" on public.feedbacks for select using (public.sou_dona());
create policy "depoimentos: dona publica" on public.feedbacks for update using (public.sou_dona()) with check (public.sou_dona() and (not published or allow_publish));
create policy "depoimentos: dona apaga" on public.feedbacks for delete using (public.sou_dona());

create or replace function public.depoimentos_publicados()
returns table (name text, role text, text text, stars int)
language sql stable security definer set search_path = public as $$
  select f.name, f.role, f.text, f.stars from public.feedbacks f
   where f.published and f.allow_publish
   order by f.created_at desc limit 12;
$$;
revoke execute on function public.depoimentos_publicados() from public;
grant execute on function public.depoimentos_publicados() to anon, authenticated;

-- 5) Trava no próprio banco: conta bloqueada, cancelada ou com teste vencido
--    continua VENDO os dados (e pode baixar tudo), mas não consegue salvar alterações.
create or replace function public.pode_editar() returns boolean
language sql stable security definer set search_path = public as $$
  select public.sou_dona() or exists (
    select 1 from public.subscriptions s
     where s.user_id = auth.uid() and not s.blocked
       and (s.status in ('ativa', 'atrasada') or (s.status = 'trial' and s.trial_ends > now()))
  );
$$;
drop policy if exists "dona cria"    on public.workspace;
drop policy if exists "dona altera"  on public.workspace;
create policy "dona cria"   on public.workspace for insert with check (auth.uid() = user_id and public.pode_editar());
create policy "dona altera" on public.workspace for update using (auth.uid() = user_id) with check (auth.uid() = user_id and public.pode_editar());

-- 6) Funções só para quem está logado (visitantes sem login não chamam nada).
revoke execute on function public.sou_dona(), public.garantir_assinatura(text), public.marcar_acesso(), public.escolher_plano(text), public.pedir_assinatura(text, text), public.marcar_lidas(uuid), public.pode_editar() from public, anon;
grant execute on function public.sou_dona(), public.garantir_assinatura(text), public.marcar_acesso(), public.escolher_plano(text), public.pedir_assinatura(text, text), public.marcar_lidas(uuid), public.pode_editar() to authenticated;

-- Conferência: deve mostrar 1 linha com o seu e-mail.
select u.email as dona from public.admins a join auth.users u on u.id = a.user_id;
