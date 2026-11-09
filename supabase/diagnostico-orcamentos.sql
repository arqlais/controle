-- planê.apê: conferência só de leitura (sem nomes nem dados pessoais) dos orçamentos recentes e dos anexos.
select jsonb_agg(x order by x->>'criado' desc) as recentes from (
  select jsonb_build_object(
    'criado', o.criado,
    'nicho', o.data->>'nicho',
    'anexos_no_orcamento', jsonb_array_length(coalesce(o.data->'arquivos', '[]'::jsonb)),
    'envios_ligados', (select count(*) from public.ape_envios e where e.orcamento = o.id),
    'anexos_nos_envios', (select coalesce(sum(jsonb_array_length(coalesce(e.arquivos, '[]'::jsonb))), 0) from public.ape_envios e where e.orcamento = o.id),
    'tipos', (select jsonb_agg(distinct a->>'tipo') from public.ape_envios e, jsonb_array_elements(coalesce(e.arquivos, '[]'::jsonb)) a where e.orcamento = o.id),
    'tem_caminho', (select bool_and(coalesce(a->>'path', '') like 'envios/%') from public.ape_envios e, jsonb_array_elements(coalesce(e.arquivos, '[]'::jsonb)) a where e.orcamento = o.id)
  ) x
  from public.ape_orcamentos o
  where o.criado > now() - interval '3 days'
) t;
