-- planê.apê: loja com carrinho e pagamento pelo Asaas, com entrega automática dos arquivos.
-- Pode rodar de novo sem problema.

-- pedidos: criados pela função "pagamentos" (o preço é calculado lá, nunca no navegador). Só a dona lê.
create table if not exists public.ape_pedidos (
  id         uuid primary key default gen_random_uuid(),
  token      uuid not null unique default gen_random_uuid(), -- endereço secreto da página do pedido (para baixar)
  morador    uuid references public.ape_moradores(id) on delete set null,
  nome       text not null default '',
  tel        text not null default '',
  email      text not null default '',
  itens      jsonb not null default '[]'::jsonb, -- [{id, nome, preco}]
  subtotal   numeric(10,2) not null default 0,
  desconto   numeric(10,2) not null default 0,
  total      numeric(10,2) not null default 0,
  status     text not null default 'pendente' check (status in ('pendente', 'pago', 'cancelado')),
  forma      text not null default '',
  asaas_link text,
  asaas_pagamento text,
  criado     timestamptz not null default now(),
  pago_em    timestamptz,
  baixados   int not null default 0
);
create index if not exists ape_pedidos_link on public.ape_pedidos (asaas_link);
alter table public.ape_pedidos enable row level security;
drop policy if exists "apê pedidos: dona" on public.ape_pedidos;
create policy "apê pedidos: dona" on public.ape_pedidos for all using (public.sou_dona()) with check (public.sou_dona());

-- arquivos que a loja entrega (uma pasta por produto: <id-do-produto>/arquivo.pdf). Privado: só a dona envia e vê;
-- quem comprou baixa por um link temporário que a função "pagamentos" gera depois de conferir o pagamento.
insert into storage.buckets (id, name, public, file_size_limit)
values ('ape-arquivos', 'ape-arquivos', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;
drop policy if exists "apê entregas: dona envia" on storage.objects;
drop policy if exists "apê entregas: dona vê" on storage.objects;
drop policy if exists "apê entregas: dona apaga" on storage.objects;
drop policy if exists "apê entregas: dona troca" on storage.objects;
create policy "apê entregas: dona envia" on storage.objects for insert to authenticated with check (bucket_id = 'ape-arquivos' and public.sou_dona());
create policy "apê entregas: dona vê" on storage.objects for select to authenticated using (bucket_id = 'ape-arquivos' and public.sou_dona());
create policy "apê entregas: dona apaga" on storage.objects for delete to authenticated using (bucket_id = 'ape-arquivos' and public.sou_dona());
create policy "apê entregas: dona troca" on storage.objects for update to authenticated using (bucket_id = 'ape-arquivos' and public.sou_dona()) with check (bucket_id = 'ape-arquivos' and public.sou_dona());
