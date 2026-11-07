-- planê.apê: compra com CPF e termos, cortesias, plataforma do apê (área do cliente) e orçamento publicado direto na comparação.
-- Pode rodar de novo sem problema.

-- 1) pedidos: dados de quem compra, aceite dos termos, Pix na página, cortesia e reembolso
alter table public.ape_pedidos add column if not exists cpf text not null default '';
alter table public.ape_pedidos add column if not exists aceite jsonb; -- {versao, em, ip?}
alter table public.ape_pedidos add column if not exists asaas_cliente text;
alter table public.ape_pedidos add column if not exists pix jsonb; -- {img, copia, expira}
alter table public.ape_pedidos add column if not exists cortesia boolean not null default false;
alter table public.ape_pedidos add column if not exists obs text not null default '';
alter table public.ape_pedidos add column if not exists cancelado_em timestamptz;
alter table public.ape_pedidos drop constraint if exists ape_pedidos_status_check;
alter table public.ape_pedidos add constraint ape_pedidos_status_check check (status in ('pendente', 'pago', 'cancelado', 'reembolsado'));
create index if not exists ape_pedidos_cpf on public.ape_pedidos (cpf);
create index if not exists ape_pedidos_pagamento on public.ape_pedidos (asaas_pagamento);

-- 2) plataforma do apê: um acesso por pessoa, aberto por um link secreto (sem senha). Só a dona lê a tabela;
--    a pessoa lê e grava os próprios dados pelas funções abaixo, com o token do link.
create table if not exists public.ape_plataforma (
  id         uuid primary key default gen_random_uuid(),
  token      uuid not null unique default gen_random_uuid(),
  nome       text not null default '',
  email      text not null default '',
  cpf        text not null default '',
  tel        text not null default '',
  pedido     uuid references public.ape_pedidos(id) on delete set null,
  validade   date not null default (current_date + 365),
  cortesia   boolean not null default false,
  dados      jsonb not null default '{}'::jsonb,
  criado     timestamptz not null default now(),
  atualizado timestamptz not null default now()
);
create unique index if not exists ape_plataforma_pedido on public.ape_plataforma (pedido) where pedido is not null;
alter table public.ape_plataforma enable row level security;
drop policy if exists "apê plataforma: dona" on public.ape_plataforma;
create policy "apê plataforma: dona" on public.ape_plataforma for all using (public.sou_dona()) with check (public.sou_dona());

create or replace function public.ape_plat_abrir(p_token uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('nome', nome, 'validade', validade, 'ativo', validade >= current_date, 'cortesia', cortesia, 'dados', dados, 'atualizado', atualizado)
  from public.ape_plataforma where token = p_token
$$;

create or replace function public.ape_plat_salvar(p_token uuid, p_dados jsonb) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare v_quando timestamptz := now();
begin
  if p_dados is null or jsonb_typeof(p_dados) <> 'object' then raise exception 'dados inválidos'; end if;
  if pg_column_size(p_dados) > 6 * 1024 * 1024 then raise exception 'passou do limite de espaço (tire algumas fotos)'; end if;
  update public.ape_plataforma set dados = p_dados, atualizado = v_quando where token = p_token and validade >= current_date;
  if not found then raise exception 'acesso vencido ou não encontrado'; end if;
  return v_quando;
end $$;

revoke execute on function public.ape_plat_abrir(uuid), public.ape_plat_salvar(uuid, jsonb) from public;
grant execute on function public.ape_plat_abrir(uuid), public.ape_plat_salvar(uuid, jsonb) to anon, authenticated;

-- 3) orçamento do morador vai direto para a comparação (a dona pode ocultar ou editar depois no painel)
alter table public.ape_orcamentos add column if not exists morador uuid references public.ape_moradores(id) on delete set null;
create or replace function public.ape_publicar(p_morador uuid, p_dados jsonb, p_arquivos jsonb) returns text
language plpgsql security definer set search_path = public as $$
declare v_id text := 'm' || replace(gen_random_uuid()::text, '-', '');
declare v_hoje int;
begin
  if not exists (select 1 from public.ape_moradores where id = p_morador and coalesce(condominio, 'San Levi') = 'San Levi') then
    raise exception 'os orçamentos são só dos moradores do San Levi';
  end if;
  if p_dados is null or jsonb_typeof(p_dados) <> 'object' or coalesce(p_dados->>'fornecedor', '') = '' then raise exception 'falta o fornecedor'; end if;
  if pg_column_size(p_dados) > 200000 then raise exception 'orçamento grande demais'; end if;
  select count(*) into v_hoje from public.ape_orcamentos where morador = p_morador and criado > now() - interval '1 day';
  if v_hoje >= 20 then raise exception 'limite de orçamentos por hoje'; end if;
  insert into public.ape_orcamentos (id, data, morador)
  values (v_id, (p_dados - 'exemplo' - 'oculto') || jsonb_build_object('id', v_id, 'criado', now(), 'enviado', true), p_morador);
  insert into public.ape_envios (morador, nicho, fornecedor, texto, arquivos, status, orcamento)
  values (p_morador, left(coalesce(p_dados->>'nicho', ''), 40), left(coalesce(p_dados->>'fornecedor', ''), 160), '', coalesce(p_arquivos, '[]'::jsonb), 'publicado', v_id);
  return v_id;
end $$;
revoke execute on function public.ape_publicar(uuid, jsonb, jsonb) from public;
grant execute on function public.ape_publicar(uuid, jsonb, jsonb) to anon, authenticated;

-- 4) o morador corrige ou apaga o que ele mesmo mandou
create or replace function public.ape_meu_orcamento(p_morador uuid, p_id text, p_dados jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_dados is null then
    delete from public.ape_orcamentos where id = p_id and morador = p_morador;
  else
    if pg_column_size(p_dados) > 200000 then raise exception 'orçamento grande demais'; end if;
    update public.ape_orcamentos set data = (p_dados - 'exemplo' - 'oculto') || jsonb_build_object('id', p_id, 'enviado', true), atualizado = now()
    where id = p_id and morador = p_morador;
  end if;
end $$;
revoke execute on function public.ape_meu_orcamento(uuid, text, jsonb) from public;
grant execute on function public.ape_meu_orcamento(uuid, text, jsonb) to anon, authenticated;

-- 5) leitura automática: um registro por arquivo lido (limite diário por morador)
alter table public.ape_leituras add column if not exists arquivos int not null default 1;

-- 6) a lista dos moradores não mostra quem mandou cada orçamento (só marca "meu" para quem mandou)
drop function if exists public.ape_orcamentos_morador(uuid);
create or replace function public.ape_orcamentos_morador(p_morador uuid)
returns table (id text, data jsonb, oculto boolean, exemplo boolean, criado timestamptz, atualizado timestamptz, meu boolean)
language sql stable security definer set search_path = public as $$
  select o.id, o.data, o.oculto, o.exemplo, o.criado, o.atualizado, (o.morador is not null and o.morador = p_morador)
  from public.ape_orcamentos o
  where not o.oculto and not o.exemplo
    and exists (select 1 from public.ape_moradores m where m.id = p_morador and coalesce(m.condominio, 'San Levi') = 'San Levi')
$$;
revoke execute on function public.ape_orcamentos_morador(uuid) from public;
grant execute on function public.ape_orcamentos_morador(uuid) to anon, authenticated;

-- 7) "usar em outro aparelho": o morador abre o próprio cadastro pelo link secreto (o id dele)
create or replace function public.ape_eu(p_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', id, 'nome', nome, 'condominio', condominio, 'torre', torre, 'ap', ap, 'tel', tel, 'mora_junto', mora_junto, 'criado', criado)
  from public.ape_moradores where id = p_id
$$;
revoke execute on function public.ape_eu(uuid) from public;
grant execute on function public.ape_eu(uuid) to anon, authenticated;
