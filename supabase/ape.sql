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
