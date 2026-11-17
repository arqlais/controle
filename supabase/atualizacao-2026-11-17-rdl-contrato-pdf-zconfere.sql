-- RDL: confere o envio do contrato em PDF (só leitura). Roda depois do pedido de envio.
select pg_sleep(25);
select id, status_code, left(content::text, 400) as resposta, created
  from net._http_response
 where created > now() - interval '10 minutes'
 order by id desc
 limit 3;
