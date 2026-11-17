-- RDL: confere o resultado do envio da chave Pix (respostas recentes da função de avisos). Só leitura.
select id, status_code, left(content::text, 300) as resposta, created
  from net._http_response
 where created > now() - interval '30 minutes'
 order by id desc
 limit 5;
