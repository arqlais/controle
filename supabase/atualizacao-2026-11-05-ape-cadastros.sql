-- planê.apê: mesmo apê com nomes diferentes (moram juntos) e visão completa da dona. Pode rodar de novo.
alter table public.ape_moradores add column if not exists mora_junto boolean not null default false;

-- quem já tem cadastro nesta torre e apê (só primeiro nome + inicial; nada de telefone)
create or replace function public.ape_mesmo_ap(p_torre text, p_ap text, p_id uuid) returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(distinct split_part(trim(nome), ' ', 1) || case when position(' ' in trim(nome)) > 0 then ' ' || left(split_part(trim(nome), ' ', array_length(string_to_array(trim(nome), ' '), 1)), 1) || '.' else '' end), '{}')
  from public.ape_moradores
  where coalesce(condominio, 'San Levi') = 'San Levi'
    and lower(trim(torre)) = lower(trim(coalesce(p_torre, ''))) and lower(trim(ap)) = lower(trim(coalesce(p_ap, '')))
    and trim(coalesce(p_torre, '')) <> '' and trim(coalesce(p_ap, '')) <> ''
    and (p_id is null or id <> p_id)
$$;

create or replace function public.ape_cadastro3(p_id uuid, p_nome text, p_condominio text, p_torre text, p_ap text, p_tel text, p_junto boolean) returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  v := public.ape_cadastro2(p_id, p_nome, p_condominio, p_torre, p_ap, p_tel);
  update public.ape_moradores set mora_junto = coalesce(p_junto, false) where id = v;
  return v;
end $$;

revoke execute on function public.ape_mesmo_ap(text, text, uuid), public.ape_cadastro3(uuid, text, text, text, text, text, boolean) from public;
grant execute on function public.ape_mesmo_ap(text, text, uuid), public.ape_cadastro3(uuid, text, text, text, text, text, boolean) to anon, authenticated;
