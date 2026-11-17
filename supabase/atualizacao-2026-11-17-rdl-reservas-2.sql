-- RDL Engenharia: reservas da vistoria, parte 2. Pode rodar mais de uma vez.
--  · prazo do sinal: reserva sem sinal confirmado em 7 dias é cancelada sozinha (status.expirada);
--    roda sempre que alguém abre a página de reserva, o painel ou o sistema (e no aviso diário).
--  · o morador muda pelo painel só o que é dele: a planta, o pedido e a aprovação da ART de reforma.

create or replace function public.rdl_expirar() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update public.rdl_reservas
     set cancelada = true, status = status || jsonb_build_object('expirada', now())
   where not cancelada and coalesce(status ->> 'sinal', '') = '' and criado < now() - interval '7 days';
  get diagnostics n = row_count;
  return n;
end;
$$;
grant execute on function public.rdl_expirar() to anon, authenticated;

create or replace function public.rdl_contagem() returns int
language plpgsql security definer set search_path = public as $$
begin
  perform public.rdl_expirar();
  return (select count(*)::int from public.rdl_reservas where not cancelada);
end;
$$;
grant execute on function public.rdl_contagem() to anon, authenticated;

drop function if exists public.rdl_minha_reserva(uuid, text);
create or replace function public.rdl_minha_reserva(p_id uuid, p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.rdl_reservas;
begin
  perform public.rdl_expirar();
  select * into r from public.rdl_reservas where id = p_id and token = p_token;
  if r.id is null then return null; end if;
  return jsonb_build_object(
    'id', r.id, 'criado', r.criado, 'dados', r.dados, 'contrato', r.contrato, 'status', r.status - 'obs' - 'cliente', 'cancelada', r.cancelada,
    'ordem', (select count(*) from public.rdl_reservas x where not x.cancelada and x.criado <= r.criado),
    'grupo', (select count(*) from public.rdl_reservas x where not x.cancelada)
  );
end;
$$;
grant execute on function public.rdl_minha_reserva(uuid, text) to anon, authenticated;

create or replace function public.rdl_morador(p_id uuid, p_token text, p_acao text, p_valor text) returns boolean
language plpgsql security definer set search_path = public as $$
declare r public.rdl_reservas; ref jsonb;
begin
  select * into r from public.rdl_reservas where id = p_id and token = p_token and not cancelada;
  if r.id is null then return false; end if;
  ref := coalesce(r.status -> 'reforma', '{}'::jsonb);
  if p_acao = 'planta' then
    update public.rdl_reservas set dados = dados || jsonb_build_object('planta', left(coalesce(p_valor, ''), 80)) where id = p_id;
  elsif p_acao = 'reforma-pedido' then
    if length(trim(coalesce(p_valor, ''))) < 3 then return false; end if;
    update public.rdl_reservas set status = status || jsonb_build_object('reforma', ref || jsonb_build_object('pedido', left(p_valor, 1000), 'pedidoEm', now())) where id = p_id;
  elsif p_acao = 'reforma-aprovar' then
    if coalesce(ref ->> 'valor', '') = '' then return false; end if;
    update public.rdl_reservas set status = status || jsonb_build_object('reforma', ref || jsonb_build_object('aprovadoEm', now())) where id = p_id;
  else
    return false;
  end if;
  return true;
end;
$$;
grant execute on function public.rdl_morador(uuid, text, text, text) to anon, authenticated;
