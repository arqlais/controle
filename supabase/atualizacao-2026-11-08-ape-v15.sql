-- planê.apê v15: números de verdade para a loja (só contagens, nenhum dado pessoal). A loja só mostra quando já são muitos.
create or replace function public.ape_numeros() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'moradores', (select count(*) from public.ape_moradores where aprovado and coalesce(condominio, 'San Levi') = 'San Levi'),
    'compras', (select count(*) from public.ape_pedidos where status = 'pago' and not coalesce(cortesia, false))
  )
$$;
revoke execute on function public.ape_numeros() from public;
grant execute on function public.ape_numeros() to anon, authenticated;
