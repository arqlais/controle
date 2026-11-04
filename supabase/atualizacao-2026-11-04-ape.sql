-- planê.apê: o morador vê a situação dos orçamentos que ELE mandou (recebido, publicado).
-- Só com o id secreto do próprio cadastro (fica no aparelho dele). Pode rodar de novo sem problema.
create or replace function public.ape_meus_envios(p_morador uuid) returns table (id uuid, fornecedor text, nicho text, status text, criado timestamptz)
language sql stable security definer set search_path = public as $$
  select e.id, e.fornecedor, e.nicho, e.status, e.criado from public.ape_envios e
  where p_morador is not null and e.morador = p_morador
  order by e.criado desc limit 30
$$;
revoke execute on function public.ape_meus_envios(uuid) from public;
grant execute on function public.ape_meus_envios(uuid) to anon, authenticated;
