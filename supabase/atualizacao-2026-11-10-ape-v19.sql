-- planê.apê v19: pasta "Vistoria de entrega". Move para ela orçamentos de vistoria que caíram em outra pasta (só muda a pasta).
update public.ape_orcamentos
set data = jsonb_set(data, '{nicho}', '"vistoria"')
where coalesce(data->>'nicho', '') <> 'vistoria'
  and (coalesce(data->>'servico', '') || ' ' || coalesce(data->>'fornecedor', '') || ' ' || coalesce(data->>'resumo', '')) ~* 'vistoria|laudo';
