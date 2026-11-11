-- planê.apê v22: suporte ao vivo (conversa entre quem visita e a dona). Quem visita só fala pelo servidor (com o
-- código secreto da conversa guardado no aparelho); a dona lê e responde pelo painel.
create table if not exists public.ape_conversas (
  id         uuid primary key default gen_random_uuid(),
  token      text not null unique,
  nome       text not null default '',
  contato    text not null default '',
  origem     text not null default 'visitante',
  assunto    text not null default 'duvida',
  pagina     text not null default '',
  nao_lidas  int not null default 0,
  resolvida  boolean not null default false,
  criado     timestamptz not null default now(),
  atualizado timestamptz not null default now()
);
create table if not exists public.ape_chat (
  id       uuid primary key default gen_random_uuid(),
  conversa uuid not null references public.ape_conversas(id) on delete cascade,
  de       text not null check (de in ('cliente', 'dona')),
  texto    text not null,
  criado   timestamptz not null default now()
);
create index if not exists ape_chat_conversa_idx on public.ape_chat (conversa, criado);
create index if not exists ape_conversas_atualizado_idx on public.ape_conversas (atualizado desc);
alter table public.ape_conversas enable row level security;
alter table public.ape_chat enable row level security;
drop policy if exists "apê conversas: dona" on public.ape_conversas;
create policy "apê conversas: dona" on public.ape_conversas for all using (public.sou_dona()) with check (public.sou_dona());
drop policy if exists "apê chat: dona" on public.ape_chat;
create policy "apê chat: dona" on public.ape_chat for all using (public.sou_dona()) with check (public.sou_dona());
