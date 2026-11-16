-- RDL Engenharia: reservas da vistoria de entrega de chaves pelo link (useplane.com.br/vistoria).
-- Pode rodar mais de uma vez.
--  · O morador preenche os dados, lê e assina o contrato no link: a reserva entra aqui, com o texto
--    exato que ele assinou. Ninguém de fora lê esta tabela: o morador só vê a própria reserva
--    (pelo código secreto do painel dele) e a RDL (Laís e Rogério) vê e atualiza todas.

create table if not exists public.rdl_reservas (
  id        uuid primary key default gen_random_uuid(),
  token     text        not null default replace(gen_random_uuid()::text, '-', ''),
  criado    timestamptz not null default now(),
  dados     jsonb       not null,               -- nome, cpf, email, tel, endereco, torre, apto, revistoria
  contrato  jsonb       not null,               -- texto assinado, código, quando, aparelho
  status    jsonb       not null default '{}'::jsonb, -- só a RDL altera: sinal, quitado, data, hora, laudo, obs
  cancelada boolean     not null default false
);
alter table public.rdl_reservas enable row level security;

drop policy if exists "rdl reservas: lê" on public.rdl_reservas;
drop policy if exists "rdl reservas: altera" on public.rdl_reservas;
drop policy if exists "rdl reservas: apaga" on public.rdl_reservas;
create policy "rdl reservas: lê" on public.rdl_reservas for select to authenticated using (public.rdl_acesso() is not null);
create policy "rdl reservas: altera" on public.rdl_reservas for update to authenticated using (public.rdl_acesso() is not null) with check (public.rdl_acesso() is not null);
create policy "rdl reservas: apaga" on public.rdl_reservas for delete to authenticated using (public.rdl_acesso() is not null);

-- reserva nova (link público): confere o básico e devolve o id e o código do painel
create or replace function public.rdl_reservar(p_dados jsonb, p_contrato jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.rdl_reservas;
begin
  if length(coalesce(p_dados ->> 'nome', '')) < 5 or length(regexp_replace(coalesce(p_dados ->> 'cpf', ''), '\D', '', 'g')) <> 11
     or coalesce(p_dados ->> 'apto', '') = '' or coalesce(p_contrato ->> 'texto', '') = '' or coalesce(p_contrato ->> 'assinatura', '') = '' then
    raise exception 'dados incompletos';
  end if;
  if length(p_dados::text) > 6000 or length(p_contrato::text) > 60000 then raise exception 'grande demais'; end if;
  -- trava contra repetição: o mesmo CPF não reserva o mesmo apto duas vezes em 1 minuto
  if exists (select 1 from public.rdl_reservas where not cancelada and dados ->> 'cpf' = p_dados ->> 'cpf' and dados ->> 'apto' = p_dados ->> 'apto' and dados ->> 'torre' = p_dados ->> 'torre' and criado > now() - interval '1 minute') then
    raise exception 'reserva repetida';
  end if;
  insert into public.rdl_reservas (dados, contrato) values (p_dados, p_contrato || jsonb_build_object(
    'recebido', now(),
    -- IP de quem assinou (prova da assinatura eletrônica)
    'ip', split_part(coalesce(nullif(current_setting('request.headers', true), '')::json ->> 'x-forwarded-for', ''), ',', 1)
  )) returning * into r;
  return jsonb_build_object('id', r.id, 'token', r.token);
end;
$$;
grant execute on function public.rdl_reservar(jsonb, jsonb) to anon, authenticated;

-- painel do morador: só com o id e o código secreto
create or replace function public.rdl_minha_reserva(p_id uuid, p_token text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', r.id, 'criado', r.criado, 'dados', r.dados, 'contrato', r.contrato, 'status', r.status, 'cancelada', r.cancelada,
    'ordem', (select count(*) from public.rdl_reservas x where not x.cancelada and x.criado <= r.criado)
  )
  from public.rdl_reservas r where r.id = p_id and r.token = p_token;
$$;
grant execute on function public.rdl_minha_reserva(uuid, text) to anon, authenticated;

-- quantos apartamentos já reservaram (aparece na página de reserva)
create or replace function public.rdl_contagem() returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.rdl_reservas where not cancelada;
$$;
grant execute on function public.rdl_contagem() to anon, authenticated;

-- e-mails já enviados de cada reserva (a função "avisos" grava aqui e não repete)
alter table public.rdl_reservas add column if not exists avisos jsonb not null default '{}'::jsonb;
