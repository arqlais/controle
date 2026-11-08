-- planê.apê v14: as contagens do grupo (quantos apês e quantas escolhas por orçamento) também só para
-- moradores aprovados do San Levi e para a dona. Os orçamentos e os arquivos originais já eram trancados assim.
create or replace function public.ape_contagens2(p_morador uuid) returns table (orcamento text, grupo int, escolhas int, minha boolean)
language sql stable security definer set search_path = public as $$
  with g as (select orcamento, count(*)::int n from public.ape_interesses group by orcamento),
       e as (select orcamento, count(*)::int n from public.ape_escolhas group by orcamento),
       ids as (select orcamento from g union select orcamento from e)
  select ids.orcamento, coalesce(g.n, 0), coalesce(e.n, 0),
         exists (select 1 from public.ape_escolhas x where x.morador = p_morador and x.orcamento = ids.orcamento)
  from ids left join g using (orcamento) left join e using (orcamento)
  where public.sou_dona()
     or exists (select 1 from public.ape_moradores m where m.id = p_morador and coalesce(m.condominio, 'San Levi') = 'San Levi' and m.aprovado)
$$;
revoke execute on function public.ape_contagens2(uuid) from public;
grant execute on function public.ape_contagens2(uuid) to anon, authenticated;
