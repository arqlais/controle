-- RDL Engenharia: vistoria e ART de reforma como serviços separados, contrato que se assina de novo pelo painel
-- e acessos da página (para o painel de estatísticas da RDL). Pode rodar mais de uma vez.

-- reserva nova: se a ART de reforma veio contratada junto, ela já entra aprovada (com o termo aceito no contrato)
create or replace function public.rdl_reservar(p_dados jsonb, p_contrato jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.rdl_reservas; st jsonb := '{}'::jsonb; ip text;
begin
  if length(coalesce(p_dados ->> 'nome', '')) < 5 or length(regexp_replace(coalesce(p_dados ->> 'cpf', ''), '\D', '', 'g')) <> 11
     or coalesce(p_dados ->> 'apto', '') = '' or coalesce(p_contrato ->> 'texto', '') = '' or coalesce(p_contrato ->> 'assinatura', '') = '' then
    raise exception 'dados incompletos';
  end if;
  if length(p_dados::text) > 8000 or length(p_contrato::text) > 80000 then raise exception 'grande demais'; end if;
  if exists (select 1 from public.rdl_reservas where not cancelada and dados ->> 'cpf' = p_dados ->> 'cpf' and dados ->> 'apto' = p_dados ->> 'apto' and dados ->> 'torre' = p_dados ->> 'torre' and criado > now() - interval '1 minute') then
    raise exception 'reserva repetida';
  end if;
  ip := split_part(coalesce(nullif(current_setting('request.headers', true), '')::json ->> 'x-forwarded-for', ''), ',', 1);
  if coalesce((p_dados -> 'servicos' ->> 'reforma')::boolean, false) then
    st := jsonb_build_object('reforma', jsonb_build_object(
      'pedido', left(coalesce(p_dados ->> 'reforma', ''), 1000),
      'itens', coalesce(p_dados -> 'reformaItens', '[]'::jsonb),
      'estimativa', greatest(coalesce((p_dados ->> 'reformaEstimativa')::numeric, 250), 250),
      'valor', greatest(coalesce((p_dados ->> 'reformaEstimativa')::numeric, 250), 250),
      'escopo', 'ART da reforma e plano de reforma para o condomínio (NBR 16280), conforme o contrato.',
      'prestador', left(coalesce(p_dados ->> 'prestador', ''), 160),
      'pedidoEm', now(), 'enviadoEm', now(), 'aprovadoEm', now(), 'termoAceito', now(), 'ip', ip));
  end if;
  insert into public.rdl_reservas (dados, contrato, status) values (p_dados, p_contrato || jsonb_build_object('recebido', now(), 'ip', ip), st) returning * into r;
  return jsonb_build_object('id', r.id, 'token', r.token);
end;
$$;
grant execute on function public.rdl_reservar(jsonb, jsonb) to anon, authenticated;

-- assinar de novo pelo painel (contrato atualizado ou serviço incluído): guarda a versão anterior junto
create or replace function public.rdl_reassinar(p_id uuid, p_token text, p_dados jsonb, p_contrato jsonb) returns boolean
language plpgsql security definer set search_path = public as $$
declare r public.rdl_reservas; st jsonb; ip text;
begin
  select * into r from public.rdl_reservas where id = p_id and token = p_token and not cancelada;
  if r.id is null or coalesce(p_contrato ->> 'texto', '') = '' or coalesce(p_contrato ->> 'assinatura', '') = '' then return false; end if;
  if length(p_dados::text) > 8000 or length(p_contrato::text) > 80000 then return false; end if;
  ip := split_part(coalesce(nullif(current_setting('request.headers', true), '')::json ->> 'x-forwarded-for', ''), ',', 1);
  st := r.status;
  if coalesce((p_dados -> 'servicos' ->> 'reforma')::boolean, false) and coalesce(st -> 'reforma' ->> 'aprovadoEm', '') = '' then
    st := st || jsonb_build_object('reforma', coalesce(st -> 'reforma', '{}'::jsonb) || jsonb_build_object(
      'pedido', left(coalesce(p_dados ->> 'reforma', ''), 1000),
      'itens', coalesce(p_dados -> 'reformaItens', '[]'::jsonb),
      'estimativa', greatest(coalesce((p_dados ->> 'reformaEstimativa')::numeric, 250), 250),
      'valor', greatest(coalesce((p_dados ->> 'reformaEstimativa')::numeric, 250), 250),
      'escopo', 'ART da reforma e plano de reforma para o condomínio (NBR 16280), conforme o contrato.',
      'prestador', left(coalesce(p_dados ->> 'prestador', ''), 160),
      'pedidoEm', coalesce(st -> 'reforma' ->> 'pedidoEm', now()::text), 'enviadoEm', now(), 'aprovadoEm', now(), 'termoAceito', now(), 'ip', ip));
  end if;
  update public.rdl_reservas
     set dados = r.dados || (p_dados - 'cpf' - 'nome'),
         contrato = p_contrato || jsonb_build_object('recebido', now(), 'ip', ip, 'anterior', r.contrato - 'anterior'),
         status = st
   where id = p_id;
  return true;
end;
$$;
grant execute on function public.rdl_reassinar(uuid, text, jsonb, jsonb) to anon, authenticated;

-- grupo de 10: só conta quem contratou a vistoria
create or replace function public.rdl_contagem() returns int
language plpgsql security definer set search_path = public as $$
begin
  perform public.rdl_expirar();
  return (select count(*)::int from public.rdl_reservas where not cancelada and coalesce((dados -> 'servicos' ->> 'vistoria')::boolean, true));
end;
$$;
grant execute on function public.rdl_contagem() to anon, authenticated;

-- acessos da página de reserva e do painel (sem dado pessoal: um código aleatório por aparelho)
create table if not exists public.rdl_eventos (
  id      bigint generated always as identity primary key,
  sessao  text        not null,
  evento  text        not null,
  dados   jsonb       not null default '{}'::jsonb,
  criado  timestamptz not null default now()
);
create index if not exists rdl_eventos_criado on public.rdl_eventos (criado);
alter table public.rdl_eventos enable row level security;
drop policy if exists "rdl eventos: lê" on public.rdl_eventos;
create policy "rdl eventos: lê" on public.rdl_eventos for select to authenticated using (public.rdl_acesso() is not null);

create or replace function public.rdl_evento(p_sessao text, p_evento text, p_dados jsonb default '{}'::jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if length(coalesce(p_sessao, '')) < 8 or length(p_sessao) > 64 or length(coalesce(p_evento, '')) < 2 or length(p_evento) > 40 or length(coalesce(p_dados, '{}'::jsonb)::text) > 1500 then return; end if;
  -- trava contra enxurrada: no máximo 300 eventos por aparelho por dia
  if (select count(*) from public.rdl_eventos where sessao = p_sessao and criado > now() - interval '1 day') >= 300 then return; end if;
  insert into public.rdl_eventos (sessao, evento, dados) values (p_sessao, p_evento, coalesce(p_dados, '{}'::jsonb));
end;
$$;
grant execute on function public.rdl_evento(text, text, jsonb) to anon, authenticated;
