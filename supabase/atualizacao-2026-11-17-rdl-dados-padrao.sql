-- RDL Engenharia: dados das reservas no mesmo padrão (nome com iniciais maiúsculas, e-mail minúsculo,
-- telefone (11) 99999-9999, CPF 000.000.000-00, torre e apto sem zero à esquerda). O contrato assinado não muda.
-- Pode rodar mais de uma vez.
create or replace function public.rdl_nome(t text) returns text language sql immutable as $$
  select trim(replace(replace(replace(replace(replace(replace(
    ' ' || initcap(lower(trim(regexp_replace(coalesce(t, ''), '\s+', ' ', 'g')))) || ' ',
    ' Da ', ' da '), ' De ', ' de '), ' Do ', ' do '), ' Das ', ' das '), ' Dos ', ' dos '), ' E ', ' e '))
$$;
create or replace function public.rdl_tel(t text) returns text language plpgsql immutable as $$
declare d text := regexp_replace(coalesce(t, ''), '\D', '', 'g');
begin
  if length(d) >= 12 and left(d, 2) = '55' then d := substr(d, 3); end if;
  if length(d) = 11 then return '(' || left(d, 2) || ') ' || substr(d, 3, 5) || '-' || right(d, 4); end if;
  if length(d) = 10 then return '(' || left(d, 2) || ') ' || substr(d, 3, 4) || '-' || right(d, 4); end if;
  return trim(coalesce(t, ''));
end $$;

update public.rdl_reservas r set dados = r.dados || jsonb_strip_nulls(jsonb_build_object(
    'nome', public.rdl_nome(r.dados ->> 'nome'),
    'email', lower(regexp_replace(coalesce(r.dados ->> 'email', ''), '\s', '', 'g')),
    'tel', public.rdl_tel(r.dados ->> 'tel'),
    'cpf', case when length(regexp_replace(coalesce(r.dados ->> 'cpf', ''), '\D', '', 'g')) = 11 then regexp_replace(regexp_replace(r.dados ->> 'cpf', '\D', '', 'g'), '^(\d{3})(\d{3})(\d{3})(\d{2})$', '\1.\2.\3-\4') else r.dados ->> 'cpf' end,
    'torre', nullif(regexp_replace(coalesce(r.dados ->> 'torre', ''), '^0+(?=\d)', ''), ''),
    'apto', nullif(regexp_replace(coalesce(r.dados ->> 'apto', ''), '^0+(?=\d)', ''), '')
  ));

-- as pessoas que começaram e não assinaram também
update public.rdl_leads l set dados = l.dados || jsonb_strip_nulls(jsonb_build_object(
    'nome', case when coalesce(l.dados ->> 'nome', '') <> '' then public.rdl_nome(l.dados ->> 'nome') end,
    'tel', case when coalesce(l.dados ->> 'tel', '') <> '' then public.rdl_tel(l.dados ->> 'tel') end,
    'email', case when coalesce(l.dados ->> 'email', '') <> '' then lower(trim(l.dados ->> 'email')) end
  ));

select dados ->> 'nome' as nome, dados ->> 'tel' as tel, dados ->> 'torre' as torre, dados ->> 'apto' as apto from public.rdl_reservas order by criado;
