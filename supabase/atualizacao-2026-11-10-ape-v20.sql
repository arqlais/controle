-- planê.apê v20: o arquivo anexado nunca some do orçamento.
-- 1) corrigir/ler depois não apaga a lista de arquivos nem o texto colado (se não vierem, ficam os que já estavam)
create or replace function public.ape_meu_orcamento(p_morador uuid, p_id text, p_dados jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_dados is null then
    delete from public.ape_orcamentos where id = p_id and morador = p_morador;
  else
    if pg_column_size(p_dados) > 200000 then raise exception 'orçamento grande demais'; end if;
    update public.ape_orcamentos o set data =
      jsonb_strip_nulls(jsonb_build_object(
        'arquivos', case when coalesce(case when jsonb_typeof(p_dados->'arquivos') = 'array' then jsonb_array_length(p_dados->'arquivos') end, 0) > 0 then null else o.data->'arquivos' end,
        'texto_original', case when coalesce(p_dados->>'texto_original', '') <> '' then null else o.data->'texto_original' end,
        'criado', case when p_dados ? 'criado' then null else o.data->'criado' end
      ))
      || (p_dados - 'exemplo' - 'oculto')
      || jsonb_build_object('id', p_id, 'enviado', true),
      atualizado = now()
    where o.id = p_id and o.morador = p_morador;
  end if;
end $$;
revoke execute on function public.ape_meu_orcamento(uuid, text, jsonb) from public;
grant execute on function public.ape_meu_orcamento(uuid, text, jsonb) to anon, authenticated;

-- 2) devolve a lista de arquivos aos orçamentos que perderam (o arquivo continua guardado no envio)
update public.ape_orcamentos o
set data = o.data || jsonb_build_object('arquivos', (
  select coalesce(jsonb_agg(jsonb_build_object('nome', coalesce(a->>'nome', ''), 'tipo', coalesce(a->>'tipo', ''))), '[]'::jsonb)
  from public.ape_envios e, jsonb_array_elements(case when jsonb_typeof(e.arquivos) = 'array' then e.arquivos else '[]'::jsonb end) a
  where e.orcamento = o.id
))
where coalesce(case when jsonb_typeof(o.data->'arquivos') = 'array' then jsonb_array_length(o.data->'arquivos') end, 0) = 0
  and exists (select 1 from public.ape_envios e where e.orcamento = o.id and coalesce(case when jsonb_typeof(e.arquivos) = 'array' then jsonb_array_length(e.arquivos) end, 0) > 0);
