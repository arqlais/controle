-- planê.apê: área do San Levi fechada. Só vê e manda orçamentos quem digitou o código do condomínio
-- (a Laís passa no grupo dos moradores) ou foi aprovado por ela no painel. Pode rodar de novo.

alter table public.ape_moradores add column if not exists aprovado boolean not null default false;
-- quem já tinha cadastro continua entrando (a Laís pode tirar no painel)
do $$ begin
  if not exists (select 1 from public.ape_segredos where id = 'aprovados-iniciais') then
    update public.ape_moradores set aprovado = true where coalesce(condominio, 'San Levi') = 'San Levi';
    insert into public.ape_segredos (id, dados) values ('aprovados-iniciais', '{}'::jsonb);
  end if;
end $$;

-- o código do condomínio fica guardado só aqui (a página pública não lê); a dona troca pelo painel
drop policy if exists "apê segredos: dona grava o código" on public.ape_segredos;
create policy "apê segredos: dona grava o código" on public.ape_segredos for all using (public.sou_dona() and id = 'codigo-sl') with check (public.sou_dona() and id = 'codigo-sl');

create or replace function public.ape_codigo_sl(p_morador uuid, p_codigo text) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_cod text;
begin
  select dados->>'codigo' into v_cod from public.ape_segredos where id = 'codigo-sl';
  if v_cod is null or v_cod = '' then return false; end if;
  if lower(trim(p_codigo)) <> lower(trim(v_cod)) then return false; end if;
  update public.ape_moradores set aprovado = true where id = p_morador and coalesce(condominio, 'San Levi') = 'San Levi';
  return found;
end $$;
revoke execute on function public.ape_codigo_sl(uuid, text) from public;
grant execute on function public.ape_codigo_sl(uuid, text) to anon, authenticated;

drop function if exists public.ape_orcamentos_morador(uuid);
create or replace function public.ape_orcamentos_morador(p_morador uuid)
returns table (id text, data jsonb, oculto boolean, exemplo boolean, criado timestamptz, atualizado timestamptz, meu boolean)
language sql stable security definer set search_path = public as $$
  select o.id, o.data, o.oculto, o.exemplo, o.criado, o.atualizado, (o.morador is not null and o.morador = p_morador)
  from public.ape_orcamentos o
  where not o.oculto and not o.exemplo
    and exists (select 1 from public.ape_moradores m where m.id = p_morador and coalesce(m.condominio, 'San Levi') = 'San Levi' and m.aprovado)
$$;
revoke execute on function public.ape_orcamentos_morador(uuid) from public;
grant execute on function public.ape_orcamentos_morador(uuid) to anon, authenticated;

create or replace function public.ape_publicar(p_morador uuid, p_dados jsonb, p_arquivos jsonb) returns text
language plpgsql security definer set search_path = public as $$
declare v_id text := 'm' || replace(gen_random_uuid()::text, '-', '');
declare v_hoje int;
begin
  if not exists (select 1 from public.ape_moradores where id = p_morador and coalesce(condominio, 'San Levi') = 'San Levi' and aprovado) then
    raise exception 'a área do San Levi precisa do código do condomínio ou da aprovação da Laís';
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

create or replace function public.ape_eu(p_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', id, 'nome', nome, 'condominio', condominio, 'torre', torre, 'ap', ap, 'tel', tel, 'mora_junto', mora_junto, 'criado', criado, 'aprovado', aprovado)
  from public.ape_moradores where id = p_id
$$;
