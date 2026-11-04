-- planê.apê aberto para todo mundo: quem não é do San Levi informa só o condomínio (torre e apê ficam opcionais).
-- Pode rodar de novo sem problema.
alter table public.ape_moradores add column if not exists condominio text not null default 'San Levi';

create or replace function public.ape_cadastro2(p_id uuid, p_nome text, p_condominio text, p_torre text, p_ap text, p_tel text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  p_nome := left(trim(coalesce(p_nome, '')), 120);
  p_condominio := left(trim(coalesce(p_condominio, '')), 80);
  p_torre := left(trim(coalesce(p_torre, '')), 10);
  p_ap := left(trim(coalesce(p_ap, '')), 10);
  p_tel := left(regexp_replace(coalesce(p_tel, ''), '\D', '', 'g'), 13);
  if length(p_nome) < 3 or length(p_tel) < 10 then raise exception 'dados incompletos'; end if;
  if p_condominio = '' then p_condominio := 'não informado'; end if;
  if p_id is not null then
    update public.ape_moradores set nome = p_nome, condominio = p_condominio, torre = p_torre, ap = p_ap, tel = p_tel, atualizado = now() where id = p_id returning id into v;
    if v is not null then return v; end if;
  end if;
  -- mesmo telefone: é a mesma pessoa em outro aparelho
  select id into v from public.ape_moradores where tel = p_tel limit 1;
  if v is not null then
    update public.ape_moradores set nome = p_nome, condominio = p_condominio, torre = p_torre, ap = p_ap, atualizado = now() where id = v;
    return v;
  end if;
  if (select count(*) from public.ape_moradores where criado > now() - interval '1 hour') > 300 then raise exception 'muitos cadastros agora'; end if;
  insert into public.ape_moradores (nome, condominio, torre, ap, tel) values (p_nome, p_condominio, p_torre, p_ap, p_tel) returning id into v;
  return v;
end $$;
revoke execute on function public.ape_cadastro2(uuid, text, text, text, text, text) from public;
grant execute on function public.ape_cadastro2(uuid, text, text, text, text, text) to anon, authenticated;
