-- planê.apê v11: a conta da Laís (dona) volta a ser moradora e cliente com tudo liberado,
-- usando o cadastro de morador que ela deixou (torre 2, apê 1204), e ganha a plataforma do apê que faltava.
do $$
declare
  v_email text := 'lala.av03@gmail.com';
  v_cli uuid;
  v_mor uuid;
  v_ped uuid;
begin
  select id, morador into v_cli, v_mor from public.ape_clientes where email = v_email;
  -- o cadastro antigo foi apagado: usa o morador que ficou no apê dela (o mais recente), ou cria um
  if v_mor is null or not exists (select 1 from public.ape_moradores where id = v_mor) then
    select id into v_mor from public.ape_moradores
      where coalesce(condominio, 'San Levi') = 'San Levi' and trim(torre) = '2' and trim(ap) = '1204'
      order by criado desc limit 1;
  end if;
  if v_mor is null then
    insert into public.ape_moradores (nome, torre, ap, tel, condominio, aprovado, pessoas)
    values ('Laís', '2', '1204', '11969288192', 'San Levi', true, 2) returning id into v_mor;
  else
    update public.ape_moradores set aprovado = true, condominio = 'San Levi', pessoas = coalesce(pessoas, 2) where id = v_mor;
  end if;
  if v_cli is null then
    insert into public.ape_clientes (email, nome, tel, morador) values (v_email, 'Laís', '11969288192', v_mor);
  else
    update public.ape_clientes set morador = v_mor where id = v_cli;
  end if;

  -- pedido de teste com tudo (kit completo + plataforma)
  select id into v_ped from public.ape_pedidos where email = v_email and obs = 'teste da dona' and status = 'pago' order by criado limit 1;
  if v_ped is null then
    insert into public.ape_pedidos (nome, email, cpf, tel, itens, subtotal, desconto, total, status, forma, cortesia, pago_em, obs)
    values ('Laís', v_email, '', '11969288192',
      '[{"id":"kit-completo","nome":"Kit completo","preco":0,"cat":"combos"},{"id":"plataforma","nome":"Plataforma do apê","preco":0,"cat":"plataforma"}]'::jsonb,
      0, 0, 0, 'pago', 'cortesia', true, now() - interval '8 days', 'teste da dona') returning id into v_ped;
  end if;
  -- a plataforma do apê desse pedido (não tinha sido criada), sem vencimento
  if not exists (select 1 from public.ape_plataforma where pedido = v_ped) then
    insert into public.ape_plataforma (nome, email, tel, pedido, validade, cortesia) values ('Laís', v_email, '11969288192', v_ped, '2099-12-31', true);
  else
    update public.ape_plataforma set validade = '2099-12-31' where pedido = v_ped;
  end if;
end $$;
