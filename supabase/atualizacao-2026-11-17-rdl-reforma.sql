-- RDL Engenharia: pedido de ART de reforma com os serviços marcados na calculadora (valor estimado). Pode rodar mais de uma vez.
create or replace function public.rdl_morador(p_id uuid, p_token text, p_acao text, p_valor text) returns boolean
language plpgsql security definer set search_path = public as $$
declare r public.rdl_reservas; ref jsonb; v jsonb;
begin
  select * into r from public.rdl_reservas where id = p_id and token = p_token and not cancelada;
  if r.id is null then return false; end if;
  ref := coalesce(r.status -> 'reforma', '{}'::jsonb);
  if p_acao = 'planta' then
    update public.rdl_reservas set dados = dados || jsonb_build_object('planta', left(coalesce(p_valor, ''), 80)) where id = p_id;
  elsif p_acao = 'reforma-pedido' then
    if left(trim(coalesce(p_valor, '')), 1) = '{' then
      v := p_valor::jsonb;
      if length(trim(coalesce(v ->> 'pedido', ''))) < 3 then return false; end if;
      update public.rdl_reservas set status = status || jsonb_build_object('reforma', (ref - 'valor' - 'escopo' - 'prazo' - 'enviadoEm' - 'aprovadoEm') || jsonb_build_object(
        'pedido', left(v ->> 'pedido', 1000),
        'itens', coalesce(v -> 'itens', '[]'::jsonb),
        'estimativa', least(greatest(coalesce((v ->> 'estimativa')::numeric, 250), 250), 5000),
        'pedidoEm', now())) where id = p_id;
    else
      if length(trim(coalesce(p_valor, ''))) < 3 then return false; end if;
      update public.rdl_reservas set status = status || jsonb_build_object('reforma', ref || jsonb_build_object('pedido', left(p_valor, 1000), 'pedidoEm', now())) where id = p_id;
    end if;
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
