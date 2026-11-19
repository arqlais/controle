-- RDL: confere se o pedido de endereço foi enviado (avisos.endereco) e a resposta da função.
select upper(left(id::text, 8)) as reserva, dados ->> 'nome' as nome, avisos ->> 'endereco' as pedido_enviado_em
  from public.rdl_reservas where not cancelada and public.rdl_endereco_san_levi(dados)
union all
select 'resposta', left(coalesce(content::text, ''), 300), status_code::text
  from (select content, status_code from net._http_response order by created desc limit 1) x;
