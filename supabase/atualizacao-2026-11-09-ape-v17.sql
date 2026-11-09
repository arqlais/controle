-- planê.apê v17: pasta própria para aquecedor. Move para ela os orçamentos de aquecedor que já existem
-- (só muda a pasta; nenhum outro dado é tocado). Pode rodar mais de uma vez.
update public.ape_orcamentos
set data = jsonb_set(data, '{nicho}', '"aquecedor"')
where coalesce(data->>'nicho', '') in ('hidraulica', 'outros', '')
  and (coalesce(data->>'servico', '') || ' ' || coalesce(data->>'fornecedor', '') || ' ' || coalesce(data->>'resumo', '')) ~* 'aquecedor|boiler';
update public.ape_envios
set nicho = 'aquecedor'
where coalesce(nicho, '') in ('hidraulica', 'outros', '')
  and coalesce(fornecedor, '') ~* 'aquecedor|boiler';
