-- planê.apê v8: sair da lista de interesse do grupo (o check pode ser desmarcado)
create or replace function public.ape_sair_grupo(p_orcamento text, p_morador uuid) returns int
language plpgsql security definer set search_path = public as $$
begin
  delete from public.ape_interesses where orcamento = p_orcamento and morador = p_morador;
  return (select count(*) from public.ape_interesses where orcamento = p_orcamento);
end $$;
revoke execute on function public.ape_sair_grupo(text, uuid) from public;
grant execute on function public.ape_sair_grupo(text, uuid) to anon, authenticated;
