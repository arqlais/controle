-- planê.apê v18: orçamento entra na hora (a leitura dos valores vem depois), então o fornecedor pode chegar vazio enquanto 'lendo'.
create or replace function public.ape_publicar(p_morador uuid, p_dados jsonb, p_arquivos jsonb) returns text
language plpgsql security definer set search_path = public as $$
declare v_id text := 'm' || replace(gen_random_uuid()::text, '-', '');
declare v_hoje int;
begin
  if not exists (select 1 from public.ape_moradores where id = p_morador and coalesce(condominio, 'San Levi') = 'San Levi' and aprovado) then
    raise exception 'a área do San Levi precisa do código do condomínio ou da aprovação da Laís';
  end if;
  if p_dados is null or jsonb_typeof(p_dados) <> 'object' or (coalesce(p_dados->>'fornecedor', '') = '' and coalesce(p_dados->>'lendo', '') <> 'true') then raise exception 'falta o fornecedor'; end if;
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
