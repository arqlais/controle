-- RDL: manda agora, uma vez, o e-mail pedindo o endereço atual certo para quem reservou com o endereço do
-- próprio San Levi (com cópia só para a Laís). Usa a mesma chamada da rotina diária dos avisos, só trocando o tipo.
-- A função não repete: cada reserva recebe o pedido uma vez só (avisos 'endereco').
do $$
declare cmd text;
begin
  select command into cmd from cron.job where command ilike '%functions/v1/avisos%' and command ilike '%diario%' order by jobid limit 1;
  if cmd is null then
    raise notice 'rotina diária dos avisos não encontrada: nada enviado';
    return;
  end if;
  execute replace(cmd, '"diario"', '"rdl-endereco"');
  raise notice 'pedido de envio do e-mail do endereço feito';
end $$;
