-- RDL Engenharia: chat de dúvidas da vistoria (página de reserva e painel do morador). Pode rodar mais de uma vez.
--  · O morador abre uma conversa (nome + contato) e manda mensagens pelo link, com um código secreto.
--  · A RDL (Laís e Rogério) vê todas as conversas no sistema e responde ali. A função "avisos" manda e-mail
--    para a Laís a cada mensagem nova do morador (no máximo 1 a cada 10 minutos por conversa) e para o morador
--    quando a RDL responde.

create table if not exists public.rdl_conversas (
  id         uuid primary key default gen_random_uuid(),
  token      text        not null default replace(gen_random_uuid()::text, '-', ''),
  nome       text        not null default '',
  contato    text        not null default '',
  reserva    uuid,
  criado     timestamptz not null default now(),
  atualizado timestamptz not null default now(),
  lida_rdl   timestamptz,
  avisado    timestamptz
);
create table if not exists public.rdl_mensagens (
  id       bigint generated always as identity primary key,
  conversa uuid        not null references public.rdl_conversas (id) on delete cascade,
  autor    text        not null check (autor in ('morador', 'rdl')),
  texto    text        not null,
  criado   timestamptz not null default now()
);
create index if not exists rdl_mensagens_conversa on public.rdl_mensagens (conversa, criado);
alter table public.rdl_conversas enable row level security;
alter table public.rdl_mensagens enable row level security;

drop policy if exists "rdl conversas: lê" on public.rdl_conversas;
drop policy if exists "rdl conversas: altera" on public.rdl_conversas;
drop policy if exists "rdl conversas: apaga" on public.rdl_conversas;
create policy "rdl conversas: lê" on public.rdl_conversas for select to authenticated using (public.rdl_acesso() is not null);
create policy "rdl conversas: altera" on public.rdl_conversas for update to authenticated using (public.rdl_acesso() is not null) with check (public.rdl_acesso() is not null);
create policy "rdl conversas: apaga" on public.rdl_conversas for delete to authenticated using (public.rdl_acesso() is not null);
drop policy if exists "rdl mensagens: lê" on public.rdl_mensagens;
drop policy if exists "rdl mensagens: responde" on public.rdl_mensagens;
create policy "rdl mensagens: lê" on public.rdl_mensagens for select to authenticated using (public.rdl_acesso() is not null);
create policy "rdl mensagens: responde" on public.rdl_mensagens for insert to authenticated with check (public.rdl_acesso() is not null and autor = 'rdl');

-- abre a conversa (ou devolve a que já existe para a reserva do painel)
create or replace function public.rdl_chat_abrir(p_nome text, p_contato text, p_reserva uuid default null, p_token_reserva text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c public.rdl_conversas; res uuid;
begin
  if p_reserva is not null and exists (select 1 from public.rdl_reservas where id = p_reserva and token = p_token_reserva) then
    res := p_reserva;
    select * into c from public.rdl_conversas where reserva = res order by criado limit 1;
    if c.id is not null then return jsonb_build_object('id', c.id, 'token', c.token); end if;
  end if;
  if length(trim(coalesce(p_contato, ''))) < 5 then raise exception 'contato'; end if;
  insert into public.rdl_conversas (nome, contato, reserva) values (left(trim(coalesce(p_nome, '')), 100), left(trim(p_contato), 120), res) returning * into c;
  return jsonb_build_object('id', c.id, 'token', c.token);
end;
$$;
grant execute on function public.rdl_chat_abrir(text, text, uuid, text) to anon, authenticated;

create or replace function public.rdl_chat_enviar(p_conversa uuid, p_token text, p_texto text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if length(trim(coalesce(p_texto, ''))) < 1 or length(p_texto) > 2000 then return false; end if;
  if not exists (select 1 from public.rdl_conversas where id = p_conversa and token = p_token) then return false; end if;
  -- trava contra enxurrada: no máximo 20 mensagens por conversa a cada 10 minutos
  if (select count(*) from public.rdl_mensagens where conversa = p_conversa and autor = 'morador' and criado > now() - interval '10 minutes') >= 20 then return false; end if;
  insert into public.rdl_mensagens (conversa, autor, texto) values (p_conversa, 'morador', trim(p_texto));
  update public.rdl_conversas set atualizado = now(), lida_rdl = null where id = p_conversa;
  return true;
end;
$$;
grant execute on function public.rdl_chat_enviar(uuid, text, text) to anon, authenticated;

create or replace function public.rdl_chat_ler(p_conversa uuid, p_token text) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when exists (select 1 from public.rdl_conversas where id = p_conversa and token = p_token) then
    coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'autor', m.autor, 'texto', m.texto, 'criado', m.criado) order by m.criado) from public.rdl_mensagens m where m.conversa = p_conversa), '[]'::jsonb)
  else null end;
$$;
grant execute on function public.rdl_chat_ler(uuid, text) to anon, authenticated;
