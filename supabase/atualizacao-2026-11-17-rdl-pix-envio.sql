-- RDL Engenharia: manda agora, uma vez, a chave Pix por e-mail para quem assinou e ainda não pagou
-- (com cópia para a dona). Usa a mesma chamada da rotina diária dos avisos, só trocando o tipo.
-- A própria função não repete: cada reserva recebe a chave uma vez só (avisos 'pix-chave').
do $$
declare cmd text;
begin
  select command into cmd from cron.job where command ilike '%functions/v1/avisos%' and command ilike '%diario%' order by jobid limit 1;
  if cmd is null then
    raise notice 'rotina diária dos avisos não encontrada: nada enviado';
    return;
  end if;
  execute replace(cmd, '"diario"', '"rdl-pix"');
  raise notice 'pedido de envio da chave Pix feito';
end $$;
