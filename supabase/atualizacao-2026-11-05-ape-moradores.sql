-- planê.apê: orçamentos só para os moradores do San Levi, "vou fechar com este" e leitura automática dos anexos.
-- Pode rodar de novo sem problema.

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
