-- RDL: o morador corrige o endereço atual pelo link do e-mail (#/vistoria/endereco-<id>.<código>).
-- Não aceita o endereço do próprio San Levi. Pode rodar mais de uma vez.
create or replace function public.rdl_endereco(p_id uuid, p_token text, p_dados jsonb) returns boolean
language plpgsql security definer set search_path = public as $$
declare novo jsonb;
begin
  novo := jsonb_build_object(
    'cep', left(coalesce(p_dados ->> 'cep', ''), 12), 'rua', left(coalesce(p_dados ->> 'rua', ''), 160),
    'numero', left(coalesce(p_dados ->> 'numero', ''), 20), 'complemento', left(coalesce(p_dados ->> 'complemento', ''), 80),
    'bairro', left(coalesce(p_dados ->> 'bairro', ''), 80), 'cidade', left(coalesce(p_dados ->> 'cidade', ''), 80),
    'uf', left(coalesce(p_dados ->> 'uf', ''), 2), 'endereco', left(coalesce(p_dados ->> 'endereco', ''), 400));
  if length(novo ->> 'rua') < 3 or (novo ->> 'numero') = '' or length(novo ->> 'endereco') < 10 then return false; end if;
  if public.rdl_endereco_san_levi(novo) then return false; end if;
  update public.rdl_reservas set dados = dados || novo where id = p_id and token = p_token and not cancelada;
  return found;
end;
$$;
grant execute on function public.rdl_endereco(uuid, text, jsonb) to anon, authenticated;
