-- RDL Engenharia: reserva de cortesia (família): não paga, não conta no grupo de 10 e não é cancelada por falta de sinal.
-- Pode rodar mais de uma vez.

-- a reserva da Laís (filha do Rogério) vira cortesia
update public.rdl_reservas
   set status = status || jsonb_build_object('cortesia', 'sim')
 where dados ->> 'nome' ~* '^la[ií]s\M.*\mvieira$' and coalesce(status ->> 'cortesia', '') = '';

create or replace function public.rdl_expirar() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update public.rdl_reservas
     set cancelada = true, status = status || jsonb_build_object('expirada', now())
   where not cancelada and coalesce(status ->> 'sinal', '') = '' and coalesce(status ->> 'cortesia', '') = '' and criado < now() - interval '7 days';
  get diagnostics n = row_count;
  return n;
end;
$$;
grant execute on function public.rdl_expirar() to anon, authenticated;

-- grupo de 10: só quem contratou a vistoria e paga (cortesia fica de fora)
create or replace function public.rdl_contagem() returns int
language plpgsql security definer set search_path = public as $$
begin
  perform public.rdl_expirar();
  return (select count(*)::int from public.rdl_reservas
           where not cancelada and coalesce((dados -> 'servicos' ->> 'vistoria')::boolean, true) and coalesce(status ->> 'cortesia', '') = '');
end;
$$;
grant execute on function public.rdl_contagem() to anon, authenticated;

select dados ->> 'nome' as nome, status ->> 'cortesia' as cortesia from public.rdl_reservas where coalesce(status ->> 'cortesia', '') <> '';
