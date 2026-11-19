-- RDL: grupo da vistoria e endereço atual. Pode rodar mais de uma vez.
--  · O grupo conta só quem contratou a vistoria e não é cortesia (igual ao sistema e aos e-mails).
--  · rdl_grupo(): quantos reservaram e quantos já pagaram o sinal. O valor de grupo fica garantido
--    quando o mínimo tem sinal pago (cláusula 4.3); depois disso o grupo continua contando e quem
--    reservar depois também paga o valor de grupo.
--  · rdl_reservar(): não aceita o endereço do próprio San Levi como endereço atual (o prédio nem foi entregue).

create or replace function public.rdl_no_grupo(r public.rdl_reservas) returns boolean
language sql immutable as $$
  select not r.cancelada
     and coalesce(r.status ->> 'cortesia', '') = ''
     and coalesce((r.dados -> 'servicos' ->> 'vistoria')::boolean, true);
$$;

create or replace function public.rdl_grupo() returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public.rdl_expirar();
  return (
    select jsonb_build_object(
      'reservas', count(*) filter (where public.rdl_no_grupo(r)),
      'sinal', count(*) filter (where public.rdl_no_grupo(r) and coalesce(r.status ->> 'sinal', '') <> '')
    )
    from public.rdl_reservas r
  );
end;
$$;
grant execute on function public.rdl_grupo() to anon, authenticated;

-- a contagem antiga continua existindo (versões abertas da página), agora sem cortesias
create or replace function public.rdl_contagem() returns int
language plpgsql security definer set search_path = public as $$
begin
  perform public.rdl_expirar();
  return (select count(*)::int from public.rdl_reservas r where public.rdl_no_grupo(r));
end;
$$;
grant execute on function public.rdl_contagem() to anon, authenticated;

-- endereço do próprio San Levi (Estrada Cata Preta, 1098)
create or replace function public.rdl_endereco_san_levi(d jsonb) returns boolean
language sql immutable as $$
  select (coalesce(d ->> 'rua', '') ~* 'cata\s*preta' and regexp_replace(coalesce(d ->> 'numero', ''), '\D', '', 'g') = '1098')
      or coalesce(d ->> 'endereco', '') ~* 'cata\s*preta\D{0,6}1098'
      or (coalesce(d ->> 'rua', '') || ' ' || coalesce(d ->> 'complemento', '') || ' ' || coalesce(d ->> 'endereco', '')) ~* 'san\s*levi';
$$;

create or replace function public.rdl_reservar(p_dados jsonb, p_contrato jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.rdl_reservas;
begin
  if length(coalesce(p_dados ->> 'nome', '')) < 5 or length(regexp_replace(coalesce(p_dados ->> 'cpf', ''), '\D', '', 'g')) <> 11
     or coalesce(p_dados ->> 'apto', '') = '' or coalesce(p_contrato ->> 'texto', '') = '' or coalesce(p_contrato ->> 'assinatura', '') = '' then
    raise exception 'dados incompletos';
  end if;
  if public.rdl_endereco_san_levi(p_dados) then raise exception 'endereco do san levi'; end if;
  if length(p_dados::text) > 6000 or length(p_contrato::text) > 60000 then raise exception 'grande demais'; end if;
  -- trava contra repetição: o mesmo CPF não reserva o mesmo apto duas vezes em 1 minuto
  if exists (select 1 from public.rdl_reservas where not cancelada and dados ->> 'cpf' = p_dados ->> 'cpf' and dados ->> 'apto' = p_dados ->> 'apto' and dados ->> 'torre' = p_dados ->> 'torre' and criado > now() - interval '1 minute') then
    raise exception 'reserva repetida';
  end if;
  insert into public.rdl_reservas (dados, contrato) values (p_dados, p_contrato || jsonb_build_object(
    'recebido', now(),
    -- IP de quem assinou (prova da assinatura eletrônica)
    'ip', split_part(coalesce(nullif(current_setting('request.headers', true), '')::json ->> 'x-forwarded-for', ''), ',', 1)
  )) returning * into r;
  return jsonb_build_object('id', r.id, 'token', r.token);
end;
$$;
grant execute on function public.rdl_reservar(jsonb, jsonb) to anon, authenticated;

-- quem já reservou com o endereço do San Levi (para a RDL pedir o endereço certo)
select upper(left(id::text, 8)) as reserva, dados ->> 'nome' as nome, dados ->> 'endereco' as endereco
  from public.rdl_reservas r
 where not cancelada and public.rdl_endereco_san_levi(dados);
