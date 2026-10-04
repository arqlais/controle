-- ============================================================
-- Atualização de 03/10/2026 (planê)
-- Cole TUDO no SQL Editor do Supabase e clique em Run. Pode rodar mais de uma vez: não apaga nada.
-- Traz: histórico de versões de cada conta (backup automático, com "voltar como estava"),
--       apagar mensagem enviada no chat (fica "mensagem apagada"), indicação e teste grátis de 14 dias.
-- ============================================================

-- 1) Histórico de versões: antes de cada gravação, a versão anterior da conta fica guardada
--    (no máximo uma a cada 12 horas, e sempre que muita coisa some de uma vez). Ficam as 14 mais recentes.
create table if not exists public.workspace_history (
  id         bigserial primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  data       jsonb not null,
  reason     text not null default 'automática',
  created_at timestamptz not null default now()
);
create index if not exists workspace_history_user on public.workspace_history (user_id, created_at desc);
alter table public.workspace_history enable row level security;
drop policy if exists "historico: dono vê" on public.workspace_history;
create policy "historico: dono vê" on public.workspace_history for select using (auth.uid() = user_id);

create or replace function public.contar_itens(d jsonb) returns int
language sql immutable as $$
  select coalesce(case when jsonb_typeof(d -> 'clients') = 'array' then jsonb_array_length(d -> 'clients') end, 0)
       + coalesce(case when jsonb_typeof(d -> 'quotes') = 'array' then jsonb_array_length(d -> 'quotes') end, 0)
       + coalesce(case when jsonb_typeof(d -> 'projects') = 'array' then jsonb_array_length(d -> 'projects') end, 0)
$$;

create or replace function public.guardar_versao() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  ultima timestamptz;
  sumiu boolean;
begin
  if old.data is null or old.data = new.data then return new; end if;
  select max(created_at) into ultima from public.workspace_history where user_id = old.user_id;
  -- sumiu muita coisa de uma vez (mais da metade dos clientes, orçamentos e demandas): guarda na hora
  sumiu := public.contar_itens(old.data) >= 6 and public.contar_itens(new.data) * 2 < public.contar_itens(old.data);
  if ultima is null or ultima < now() - interval '12 hours' or sumiu then
    insert into public.workspace_history (user_id, data, reason)
    values (old.user_id, old.data, case when sumiu then 'antes de sumir muita coisa' else 'automática' end);
    delete from public.workspace_history
    where user_id = old.user_id
      and id not in (select h.id from public.workspace_history h where h.user_id = old.user_id order by h.created_at desc limit 14);
  end if;
  return new;
end $$;
drop trigger if exists workspace_versao on public.workspace;
create trigger workspace_versao before update on public.workspace for each row execute function public.guardar_versao();

-- lista das versões (só os números, sem baixar tudo)
create or replace function public.minhas_versoes()
returns table (id bigint, created_at timestamptz, reason text, clientes int, orcamentos int, demandas int, tamanho int)
language sql security definer set search_path = public as $$
  select h.id, h.created_at, h.reason,
         coalesce(case when jsonb_typeof(h.data -> 'clients') = 'array' then jsonb_array_length(h.data -> 'clients') end, 0),
         coalesce(case when jsonb_typeof(h.data -> 'quotes') = 'array' then jsonb_array_length(h.data -> 'quotes') end, 0),
         coalesce(case when jsonb_typeof(h.data -> 'projects') = 'array' then jsonb_array_length(h.data -> 'projects') end, 0),
         pg_column_size(h.data)
  from public.workspace_history h
  where h.user_id = auth.uid()
  order by h.created_at desc
$$;

-- voltar a conta para uma versão (a versão atual também fica guardada, dá para desfazer)
create or replace function public.restaurar_versao(versao bigint) returns void
language plpgsql security definer set search_path = public as $$
declare d jsonb;
begin
  select data into d from public.workspace_history where id = versao and user_id = auth.uid();
  if d is null then raise exception 'versão não encontrada'; end if;
  insert into public.workspace_history (user_id, data, reason)
  select user_id, data, 'antes de restaurar' from public.workspace where user_id = auth.uid();
  update public.workspace set data = d, updated_at = now() where user_id = auth.uid();
end $$;

revoke execute on function public.minhas_versoes(), public.restaurar_versao(bigint) from public, anon;
grant execute on function public.minhas_versoes(), public.restaurar_versao(bigint) to authenticated;

-- 2) Chat: apagar uma mensagem que a própria pessoa mandou. Ela não some: fica "mensagem apagada" para os dois lados.
alter table public.support_messages add column if not exists deleted_at timestamptz;
drop policy if exists "chat: dona apaga as dela" on public.support_messages;
create or replace function public.apagar_mensagem(msg uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.support_messages
  set deleted_at = now(), body = 'apagada'
  where id = msg and deleted_at is null
    and ((from_owner and public.sou_dona()) or (not from_owner and client_id = auth.uid()));
  if not found then raise exception 'mensagem não encontrada'; end if;
end $$;
revoke execute on function public.apagar_mensagem(uuid) from public, anon;
grant execute on function public.apagar_mensagem(uuid) to authenticated;

-- 3) Teste grátis: 14 dias para quem se cadastrar daqui para frente
insert into public.platform_settings (id, data) values (1, '{}'::jsonb) on conflict (id) do nothing;
update public.platform_settings
set data = jsonb_set(jsonb_set(coalesce(data, '{}'::jsonb), '{trialDays}', '14'::jsonb), '{trialV2}', 'true'::jsonb)
where id = 1 and coalesce((data ->> 'trialV2')::boolean, false) = false;

-- 4) Indicação: cada assinante tem um código; quem se cadastra pelo link fica ligado a quem indicou.
--    A dona vê tudo no painel (aba indicações) e libera o mês grátis de quem indicou.
alter table public.subscriptions add column if not exists ref_code text;
create unique index if not exists subscriptions_ref_code on public.subscriptions (ref_code) where ref_code is not null;
alter table public.subscriptions add column if not exists referred_by uuid;
alter table public.subscriptions add column if not exists ref_rewarded_at timestamptz; -- mês grátis de quem indicou já liberado
alter table public.subscriptions add column if not exists bonus_months int not null default 0; -- meses grátis a usar (quando já paga)

create or replace function public.gerar_codigo() returns text
language sql volatile as $$ select lower(substr(md5(gen_random_uuid()::text), 1, 7)) $$;

update public.subscriptions set ref_code = public.gerar_codigo() where ref_code is null;

create or replace function public.garantir_assinatura(plano text) returns setof public.subscriptions
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  insert into public.subscriptions (user_id, email, name, studio, plan, trial_ends, ref_code, referred_by)
  select u.id, coalesce(u.email, ''), coalesce(u.raw_user_meta_data ->> 'name', ''), coalesce(u.raw_user_meta_data ->> 'studio', ''),
         'estudio',
         now() + make_interval(days => least(365, greatest(1, coalesce((select (s.data ->> 'trialDays')::int from public.platform_settings s where s.id = 1), 14)))),
         public.gerar_codigo(),
         (select r.user_id from public.subscriptions r where r.ref_code = lower(nullif(u.raw_user_meta_data ->> 'ref', '')) and r.user_id <> u.id limit 1)
  from auth.users u where u.id = auth.uid()
  on conflict (user_id) do nothing;
  update public.subscriptions set ref_code = public.gerar_codigo() where user_id = auth.uid() and ref_code is null;
  return query select * from public.subscriptions where user_id = auth.uid();
end $$;

-- quem eu indiquei (só o primeiro nome e a situação)
create or replace function public.minhas_indicacoes()
returns table (nome text, situacao text, criado timestamptz, premiado boolean)
language sql security definer set search_path = public as $$
  select split_part(coalesce(nullif(s.name, ''), 'alguém'), ' ', 1),
         case when s.status = 'ativa' then 'assinou' when s.status = 'trial' then 'testando' else 'não continuou' end,
         s.created_at, s.ref_rewarded_at is not null
  from public.subscriptions s
  where s.referred_by = auth.uid()
  order by s.created_at desc
$$;
revoke execute on function public.minhas_indicacoes() from public, anon;
grant execute on function public.minhas_indicacoes() to authenticated;

-- Conferência
select (select count(*) from public.subscriptions where ref_code is not null) as codigos_de_indicacao,
       (select count(*) from public.workspace_history) as versoes_guardadas,
       (select data ->> 'trialDays' from public.platform_settings where id = 1) as dias_de_teste;
