-- planê.apê — orçamentos dos futuros moradores do San Levi.
-- Rode DEPOIS do plataforma.sql (usa a função sou_dona). Pode rodar de novo sem problema.
--
-- Quem vê o quê:
--   · todo mundo (sem login): orçamentos publicados, loja e a contagem de interessados;
--   · moradores (sem login): só GRAVAM (cadastro, orçamento enviado, "quero entrar no grupo"), nunca leem o dos outros;
--   · a dona: lê e altera tudo (moradores, envios, arquivos, interessados).

-- 1) Orçamentos publicados (exemplos e ocultos só a dona vê)
create table if not exists public.ape_orcamentos (
  id         text primary key,
  data       jsonb not null,
  oculto     boolean not null default false,
  exemplo    boolean not null default false,
  criado     timestamptz not null default now(),
  atualizado timestamptz not null default now()
);
alter table public.ape_orcamentos enable row level security;
drop policy if exists "apê orçamentos: todos leem os publicados" on public.ape_orcamentos;
drop policy if exists "apê orçamentos: dona faz tudo" on public.ape_orcamentos;
create policy "apê orçamentos: todos leem os publicados" on public.ape_orcamentos for select using ((not oculto and not exemplo) or public.sou_dona());
create policy "apê orçamentos: dona faz tudo" on public.ape_orcamentos for all using (public.sou_dona()) with check (public.sou_dona());

-- 2) Ajustes da página (loja e WhatsApp). Todos leem; só a dona altera.
create table if not exists public.ape_ajustes (
  id   int primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb
);
alter table public.ape_ajustes enable row level security;
drop policy if exists "apê ajustes: todos leem" on public.ape_ajustes;
drop policy if exists "apê ajustes: dona altera" on public.ape_ajustes;
create policy "apê ajustes: todos leem" on public.ape_ajustes for select using (true);
create policy "apê ajustes: dona altera" on public.ape_ajustes for all using (public.sou_dona()) with check (public.sou_dona());

-- 3) Moradores cadastrados (nome, torre, apê, telefone): só a dona lê
create table if not exists public.ape_moradores (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  torre      text not null,
  ap         text not null,
  tel        text not null,
  criado     timestamptz not null default now(),
  atualizado timestamptz not null default now()
);
alter table public.ape_moradores enable row level security;
drop policy if exists "apê moradores: dona" on public.ape_moradores;
create policy "apê moradores: dona" on public.ape_moradores for all using (public.sou_dona()) with check (public.sou_dona());

-- 4) Orçamentos que os moradores mandam (texto + arquivos): só a dona lê
create table if not exists public.ape_envios (
  id         uuid primary key default gen_random_uuid(),
  morador    uuid references public.ape_moradores(id) on delete set null,
  nicho      text not null default '',
  fornecedor text not null default '',
  texto      text not null default '',
  arquivos   jsonb not null default '[]'::jsonb,
  status     text not null default 'novo' check (status in ('novo', 'publicado', 'descartado')),
  orcamento  text,
  criado     timestamptz not null default now()
);
alter table public.ape_envios enable row level security;
drop policy if exists "apê envios: dona" on public.ape_envios;
create policy "apê envios: dona" on public.ape_envios for all using (public.sou_dona()) with check (public.sou_dona());

-- 5) Quem quer entrar na compra em grupo: só a dona vê quem; todos veem quantos
create table if not exists public.ape_interesses (
  orcamento text not null,
  morador   uuid not null references public.ape_moradores(id) on delete cascade,
  criado    timestamptz not null default now(),
  primary key (orcamento, morador)
);
alter table public.ape_interesses enable row level security;
drop policy if exists "apê interesses: dona" on public.ape_interesses;
create policy "apê interesses: dona" on public.ape_interesses for all using (public.sou_dona()) with check (public.sou_dona());

-- ===== funções públicas (a página chama sem login; cada uma confere o que recebe) =====

-- cadastro (ou atualização, quando o aparelho já tem o id do morador)
create or replace function public.ape_cadastro(p_id uuid, p_nome text, p_torre text, p_ap text, p_tel text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  p_nome := left(trim(coalesce(p_nome, '')), 120);
  p_torre := left(trim(coalesce(p_torre, '')), 10);
  p_ap := left(trim(coalesce(p_ap, '')), 10);
  p_tel := left(regexp_replace(coalesce(p_tel, ''), '\D', '', 'g'), 13);
  if length(p_nome) < 3 or p_torre = '' or p_ap = '' or length(p_tel) < 10 then raise exception 'dados incompletos'; end if;
  if p_id is not null then
    update public.ape_moradores set nome = p_nome, torre = p_torre, ap = p_ap, tel = p_tel, atualizado = now() where id = p_id returning id into v;
    if v is not null then return v; end if;
  end if;
  -- mesmo telefone no mesmo apê: é a mesma pessoa em outro aparelho
  select id into v from public.ape_moradores where tel = p_tel and torre = p_torre and ap = p_ap limit 1;
  if v is not null then
    update public.ape_moradores set nome = p_nome, atualizado = now() where id = v;
    return v;
  end if;
  if (select count(*) from public.ape_moradores where criado > now() - interval '1 hour') > 200 then raise exception 'muitos cadastros agora'; end if;
  insert into public.ape_moradores (nome, torre, ap, tel) values (p_nome, p_torre, p_ap, p_tel) returning id into v;
  return v;
end $$;

-- orçamento enviado por um morador
create or replace function public.ape_enviar(p_morador uuid, p_nicho text, p_fornecedor text, p_texto text, p_arquivos jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  if not exists (select 1 from public.ape_moradores where id = p_morador) then raise exception 'faça o cadastro de novo'; end if;
  if (select count(*) from public.ape_envios where morador = p_morador and criado > now() - interval '1 day') >= 15 then raise exception 'limite de envios por hoje'; end if;
  if jsonb_typeof(coalesce(p_arquivos, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_arquivos, '[]'::jsonb)) > 8 then raise exception 'arquivos demais'; end if;
  if trim(coalesce(p_texto, '')) = '' and jsonb_array_length(coalesce(p_arquivos, '[]'::jsonb)) = 0 then raise exception 'mande o texto ou um arquivo'; end if;
  insert into public.ape_envios (morador, nicho, fornecedor, texto, arquivos)
  values (p_morador, left(coalesce(p_nicho, ''), 40), left(coalesce(p_fornecedor, ''), 160), left(coalesce(p_texto, ''), 20000), coalesce(p_arquivos, '[]'::jsonb))
  returning id into v;
  return v;
end $$;

-- "quero entrar no grupo": devolve quantos apês já querem
create or replace function public.ape_quero_grupo(p_orcamento text, p_morador uuid) returns int
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.ape_moradores where id = p_morador) then raise exception 'faça o cadastro de novo'; end if;
  if not exists (select 1 from public.ape_orcamentos where id = p_orcamento and not oculto) then raise exception 'orçamento não encontrado'; end if;
  insert into public.ape_interesses (orcamento, morador) values (p_orcamento, p_morador) on conflict do nothing;
  return (select count(*) from public.ape_interesses where orcamento = p_orcamento);
end $$;

-- quantos apês querem cada compra em grupo (sem dizer quem)
create or replace function public.ape_contagens() returns table (orcamento text, n int)
language sql stable security definer set search_path = public as $$
  select orcamento, count(*)::int from public.ape_interesses group by orcamento
$$;

revoke execute on function public.ape_cadastro(uuid, text, text, text, text), public.ape_enviar(uuid, text, text, text, jsonb), public.ape_quero_grupo(text, uuid), public.ape_contagens() from public;
grant execute on function public.ape_cadastro(uuid, text, text, text, text), public.ape_enviar(uuid, text, text, text, jsonb), public.ape_quero_grupo(text, uuid), public.ape_contagens() to anon, authenticated;

-- o morador vê a situação dos orçamentos que ele mandou
create or replace function public.ape_meus_envios(p_morador uuid) returns table (id uuid, fornecedor text, nicho text, status text, criado timestamptz)
language sql stable security definer set search_path = public as $$
  select e.id, e.fornecedor, e.nicho, e.status, e.criado from public.ape_envios e
  where p_morador is not null and e.morador = p_morador
  order by e.criado desc limit 30
$$;
revoke execute on function public.ape_meus_envios(uuid) from public;
grant execute on function public.ape_meus_envios(uuid) to anon, authenticated;

-- cadastro aberto a quem não é do San Levi
alter table public.ape_moradores add column if not exists condominio text not null default 'San Levi';

create or replace function public.ape_cadastro2(p_id uuid, p_nome text, p_condominio text, p_torre text, p_ap text, p_tel text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  p_nome := left(trim(coalesce(p_nome, '')), 120);
  p_condominio := left(trim(coalesce(p_condominio, '')), 80);
  p_torre := left(trim(coalesce(p_torre, '')), 10);
  p_ap := left(trim(coalesce(p_ap, '')), 10);
  p_tel := left(regexp_replace(coalesce(p_tel, ''), '\D', '', 'g'), 13);
  if length(p_nome) < 3 or length(p_tel) < 10 then raise exception 'dados incompletos'; end if;
  if p_condominio = '' then p_condominio := 'não informado'; end if;
  if p_id is not null then
    update public.ape_moradores set nome = p_nome, condominio = p_condominio, torre = p_torre, ap = p_ap, tel = p_tel, atualizado = now() where id = p_id returning id into v;
    if v is not null then return v; end if;
  end if;
  -- mesmo telefone: é a mesma pessoa em outro aparelho
  select id into v from public.ape_moradores where tel = p_tel limit 1;
  if v is not null then
    update public.ape_moradores set nome = p_nome, condominio = p_condominio, torre = p_torre, ap = p_ap, atualizado = now() where id = v;
    return v;
  end if;
  if (select count(*) from public.ape_moradores where criado > now() - interval '1 hour') > 300 then raise exception 'muitos cadastros agora'; end if;
  insert into public.ape_moradores (nome, condominio, torre, ap, tel) values (p_nome, p_condominio, p_torre, p_ap, p_tel) returning id into v;
  return v;
end $$;
revoke execute on function public.ape_cadastro2(uuid, text, text, text, text, text) from public;
grant execute on function public.ape_cadastro2(uuid, text, text, text, text, text) to anon, authenticated;

-- ===== arquivos (PDF e prints dos orçamentos) =====
-- pasta privada: o morador só consegue ENVIAR; só a dona abre.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ape-envios', 'ape-envios', false, 15728640, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "apê arquivos: moradores enviam" on storage.objects;
drop policy if exists "apê arquivos: dona abre" on storage.objects;
drop policy if exists "apê arquivos: dona apaga" on storage.objects;
create policy "apê arquivos: moradores enviam" on storage.objects for insert to anon, authenticated with check (bucket_id = 'ape-envios' and (storage.foldername(name))[1] = 'envios');
create policy "apê arquivos: dona abre" on storage.objects for select to authenticated using (bucket_id = 'ape-envios' and public.sou_dona());
create policy "apê arquivos: dona apaga" on storage.objects for delete to authenticated using (bucket_id = 'ape-envios' and public.sou_dona());

-- ===== loja: pedidos e arquivos entregues =====
-- pedidos: criados pela função "pagamentos" (o preço é calculado lá, nunca no navegador). Só a dona lê.
create table if not exists public.ape_pedidos (
  id         uuid primary key default gen_random_uuid(),
  token      uuid not null unique default gen_random_uuid(), -- endereço secreto da página do pedido (para baixar)
  morador    uuid references public.ape_moradores(id) on delete set null,
  nome       text not null default '',
  tel        text not null default '',
  email      text not null default '',
  itens      jsonb not null default '[]'::jsonb, -- [{id, nome, preco}]
  subtotal   numeric(10,2) not null default 0,
  desconto   numeric(10,2) not null default 0,
  total      numeric(10,2) not null default 0,
  status     text not null default 'pendente' check (status in ('pendente', 'pago', 'cancelado')),
  forma      text not null default '',
  asaas_link text,
  asaas_pagamento text,
  criado     timestamptz not null default now(),
  pago_em    timestamptz,
  baixados   int not null default 0
);
create index if not exists ape_pedidos_link on public.ape_pedidos (asaas_link);
alter table public.ape_pedidos enable row level security;
drop policy if exists "apê pedidos: dona" on public.ape_pedidos;
create policy "apê pedidos: dona" on public.ape_pedidos for all using (public.sou_dona()) with check (public.sou_dona());

-- arquivos que a loja entrega (uma pasta por produto: <id-do-produto>/arquivo.pdf). Privado: só a dona envia e vê;
-- quem comprou baixa por um link temporário que a função "pagamentos" gera depois de conferir o pagamento.
insert into storage.buckets (id, name, public, file_size_limit)
values ('ape-arquivos', 'ape-arquivos', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;
drop policy if exists "apê entregas: dona envia" on storage.objects;
drop policy if exists "apê entregas: dona vê" on storage.objects;
drop policy if exists "apê entregas: dona apaga" on storage.objects;
drop policy if exists "apê entregas: dona troca" on storage.objects;
create policy "apê entregas: dona envia" on storage.objects for insert to authenticated with check (bucket_id = 'ape-arquivos' and public.sou_dona());
create policy "apê entregas: dona vê" on storage.objects for select to authenticated using (bucket_id = 'ape-arquivos' and public.sou_dona());
create policy "apê entregas: dona apaga" on storage.objects for delete to authenticated using (bucket_id = 'ape-arquivos' and public.sou_dona());
create policy "apê entregas: dona troca" on storage.objects for update to authenticated using (bucket_id = 'ape-arquivos' and public.sou_dona()) with check (bucket_id = 'ape-arquivos' and public.sou_dona());

-- ===== só moradores do San Levi, escolhas e leitura automática =====
-- 1) os orçamentos deixam de ser públicos: só a dona lê a tabela; morador do San Levi lê pela função abaixo
drop policy if exists "apê orçamentos: todos leem os publicados" on public.ape_orcamentos;

create or replace function public.ape_orcamentos_morador(p_morador uuid) returns setof public.ape_orcamentos
language sql stable security definer set search_path = public as $$
  select o.* from public.ape_orcamentos o
  where not o.oculto and not o.exemplo
    and exists (select 1 from public.ape_moradores m where m.id = p_morador and coalesce(m.condominio, 'San Levi') = 'San Levi')
$$;

-- 2) escolhas: cada morador marca com qual orçamento vai fechar (um por serviço)
create table if not exists public.ape_escolhas (
  morador   uuid not null references public.ape_moradores(id) on delete cascade,
  nicho     text not null,
  orcamento text not null,
  criado    timestamptz not null default now(),
  primary key (morador, nicho)
);
alter table public.ape_escolhas enable row level security;
drop policy if exists "apê escolhas: dona" on public.ape_escolhas;
create policy "apê escolhas: dona" on public.ape_escolhas for all using (public.sou_dona()) with check (public.sou_dona());

create or replace function public.ape_escolher(p_orcamento text, p_morador uuid) returns text
language plpgsql security definer set search_path = public as $$
declare v_nicho text;
begin
  if not exists (select 1 from public.ape_moradores where id = p_morador and coalesce(condominio, 'San Levi') = 'San Levi') then raise exception 'só para moradores do San Levi'; end if;
  select data->>'nicho' into v_nicho from public.ape_orcamentos where id = p_orcamento and not oculto;
  if v_nicho is null then raise exception 'orçamento não encontrado'; end if;
  -- tocar de novo no mesmo orçamento desmarca
  if exists (select 1 from public.ape_escolhas where morador = p_morador and nicho = v_nicho and orcamento = p_orcamento) then
    delete from public.ape_escolhas where morador = p_morador and nicho = v_nicho;
    return '';
  end if;
  insert into public.ape_escolhas (morador, nicho, orcamento) values (p_morador, v_nicho, p_orcamento)
  on conflict (morador, nicho) do update set orcamento = excluded.orcamento, criado = now();
  return p_orcamento;
end $$;

-- contagens públicas (sem dizer quem): grupo e escolhas por orçamento, e as escolhas do próprio morador
create or replace function public.ape_contagens2(p_morador uuid) returns table (orcamento text, grupo int, escolhas int, minha boolean)
language sql stable security definer set search_path = public as $$
  with g as (select orcamento, count(*)::int n from public.ape_interesses group by orcamento),
       e as (select orcamento, count(*)::int n from public.ape_escolhas group by orcamento),
       ids as (select orcamento from g union select orcamento from e)
  select ids.orcamento, coalesce(g.n, 0), coalesce(e.n, 0),
         exists (select 1 from public.ape_escolhas x where x.morador = p_morador and x.orcamento = ids.orcamento)
  from ids left join g using (orcamento) left join e using (orcamento)
$$;

-- 3) envio, grupo e cadastro: San Levi com torre e apê
create or replace function public.ape_quero_grupo(p_orcamento text, p_morador uuid) returns int
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.ape_moradores where id = p_morador and coalesce(condominio, 'San Levi') = 'San Levi') then raise exception 'só para moradores do San Levi'; end if;
  if not exists (select 1 from public.ape_orcamentos where id = p_orcamento and not oculto) then raise exception 'orçamento não encontrado'; end if;
  insert into public.ape_interesses (orcamento, morador) values (p_orcamento, p_morador) on conflict do nothing;
  return (select count(*) from public.ape_interesses where orcamento = p_orcamento);
end $$;

-- leitura automática dos anexos (limite por morador, para não gastar à toa)
create table if not exists public.ape_leituras (
  id      bigserial primary key,
  morador uuid not null,
  criado  timestamptz not null default now()
);
alter table public.ape_leituras enable row level security;
drop policy if exists "apê leituras: dona" on public.ape_leituras;
create policy "apê leituras: dona" on public.ape_leituras for all using (public.sou_dona()) with check (public.sou_dona());

revoke execute on function public.ape_orcamentos_morador(uuid), public.ape_escolher(text, uuid), public.ape_contagens2(uuid) from public;
grant execute on function public.ape_orcamentos_morador(uuid), public.ape_escolher(text, uuid), public.ape_contagens2(uuid) to anon, authenticated;
