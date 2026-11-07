-- planê.apê: conta do cliente (e-mail e senha), pedido de cancelamento com aprovação, sugestões e depoimentos.
-- Tudo passa pela função "pagamentos" (chave de serviço); só a dona lê as tabelas pelo painel. Pode rodar de novo.

create table if not exists public.ape_clientes (
  id         uuid primary key default gen_random_uuid(),
  email      text not null unique,
  nome       text not null default '',
  cpf        text not null default '',
  tel        text not null default '',
  foto       text not null default '',          -- imagem pequena (data URL)
  senha      text not null default '',          -- PBKDF2: iterações$sal$hash
  criado     timestamptz not null default now(),
  atualizado timestamptz not null default now()
);
alter table public.ape_clientes enable row level security;
drop policy if exists "apê clientes: dona" on public.ape_clientes;
create policy "apê clientes: dona" on public.ape_clientes for select using (public.sou_dona());

create table if not exists public.ape_sessoes (
  token   uuid primary key default gen_random_uuid(),
  cliente uuid not null references public.ape_clientes(id) on delete cascade,
  criado  timestamptz not null default now(),
  expira  timestamptz not null default (now() + interval '90 days')
);
alter table public.ape_sessoes enable row level security;

create table if not exists public.ape_codigos (
  email     text primary key,
  codigo    text not null,                      -- hash do código de 6 números
  tentativas int not null default 0,
  expira    timestamptz not null
);
alter table public.ape_codigos enable row level security;

alter table public.ape_pedidos add column if not exists cancelamento jsonb; -- {status: pedido|aprovado|negado, motivo, em, resposta, decidido_em}

create table if not exists public.ape_feedback (
  id        uuid primary key default gen_random_uuid(),
  cliente   uuid references public.ape_clientes(id) on delete set null,
  tipo      text not null check (tipo in ('sugestao', 'depoimento')),
  texto     text not null,
  nota      int,
  nome      text not null default '',
  publicado boolean not null default false,
  criado    timestamptz not null default now()
);
alter table public.ape_feedback enable row level security;
drop policy if exists "apê feedback: dona" on public.ape_feedback;
create policy "apê feedback: dona" on public.ape_feedback for all using (public.sou_dona()) with check (public.sou_dona());
drop policy if exists "apê feedback: depoimentos publicados" on public.ape_feedback;
create policy "apê feedback: depoimentos publicados" on public.ape_feedback for select using (tipo = 'depoimento' and publicado);
alter table public.ape_pedidos add column if not exists email_enviado boolean not null default false;
