-- RDL: quem já fechou fica com o valor da época. Guarda na reserva o preço da vistoria (R$ 280, do grupo) e, na ART de
-- reforma, o valor que já estava aprovado. A tabela nova vale só para quem fechar depois. Pode rodar mais de uma vez.
update public.rdl_reservas
   set dados = dados || jsonb_build_object('precoVistoria', 280)
 where coalesce((dados -> 'servicos' ->> 'vistoria')::boolean, true)
   and not (dados ? 'precoVistoria');
update public.rdl_reservas
   set dados = dados || jsonb_build_object('reformaEstimativa', (status -> 'reforma' ->> 'valor')::numeric)
 where status -> 'reforma' ->> 'valor' is not null
   and coalesce((dados ->> 'reformaEstimativa')::numeric, -1) <> (status -> 'reforma' ->> 'valor')::numeric;
select upper(left(id::text, 8)) as reserva, dados -> 'precoVistoria' as vistoria, dados -> 'reformaEstimativa' as art from public.rdl_reservas order by criado;
