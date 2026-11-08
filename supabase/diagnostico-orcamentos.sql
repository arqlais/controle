-- planê.apê: conferência só de leitura (contagens, sem nomes nem dados pessoais) dos orçamentos do San Levi.
select jsonb_build_object(
  'orcamentos_total', (select count(*) from public.ape_orcamentos),
  'visiveis_moradores', (select count(*) from public.ape_orcamentos where not oculto and not exemplo),
  'ocultos', (select count(*) from public.ape_orcamentos where oculto),
  'exemplos', (select count(*) from public.ape_orcamentos where exemplo),
  'sem_morador', (select count(*) from public.ape_orcamentos where morador is null),
  'de_morador_apagado', (select count(*) from public.ape_orcamentos o where o.morador is not null and not exists (select 1 from public.ape_moradores m where m.id = o.morador)),
  'envios_total', (select count(*) from public.ape_envios),
  'envios_com_arquivo', (select count(*) from public.ape_envios where jsonb_array_length(coalesce(arquivos, '[]'::jsonb)) > 0),
  'moradores_total', (select count(*) from public.ape_moradores),
  'moradores_aprovados_sl', (select count(*) from public.ape_moradores where aprovado and coalesce(condominio, 'San Levi') = 'San Levi'),
  'ultimo_orcamento', (select max(criado) from public.ape_orcamentos)
) as conferencia;
