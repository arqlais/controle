-- RDL: o morador assina o laudo pelo link (#/vistoria/laudo-<id>.<código>), antes de mandar para a construtora.
-- Só depois que o laudo foi publicado. Grava quem, quando, aparelho, código do documento e o IP. Pode rodar mais de uma vez.
create or replace function public.rdl_assinar_laudo(p_id uuid, p_token text, p_ass jsonb) returns boolean
language plpgsql security definer set search_path = public as $$
declare r public.rdl_reservas;
begin
  select * into r from public.rdl_reservas where id = p_id and token = p_token and not cancelada;
  if r.id is null or coalesce(r.status ->> 'laudo', '') = '' then return false; end if;
  if length(coalesce(p_ass ->> 'nome', '')) < 3 or (coalesce(p_ass ->> 'desenho', '') = '' and coalesce(p_ass ->> 'fonte', '') = '') then return false; end if;
  if length(p_ass::text) > 40000 then return false; end if;
  update public.rdl_reservas
     set status = status || jsonb_build_object('laudoAssinado', p_ass || jsonb_build_object(
       'recebido', now(),
       'ip', split_part(coalesce(nullif(current_setting('request.headers', true), '')::json ->> 'x-forwarded-for', ''), ',', 1)))
   where id = p_id;
  return true;
end;
$$;
grant execute on function public.rdl_assinar_laudo(uuid, text, jsonb) to anon, authenticated;
