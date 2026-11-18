-- RDL: valores que cada reserva fechou (só leitura, sem dados pessoais: só as iniciais), para comparar com a tabela nova.
select upper(left(id::text, 8)) as reserva,
       regexp_replace(initcap(dados->>'nome'), '([A-Za-zÀ-ú])[A-Za-zÀ-ú]*\s*', '\1.', 'g') as iniciais,
       cancelada,
       dados->'servicos' as servicos,
       dados->'revistoria' as revistoria,
       dados->'reformaItens' as itens,
       dados->'reformaEstimativa' as estimativa,
       status->'reforma'->'valor' as art_valor,
       status->'reforma'->'itens' as art_itens,
       status->>'sinal' as sinal,
       status->>'valorPago' as pago,
       status->>'cortesia' as cortesia
  from public.rdl_reservas
 order by criado;
