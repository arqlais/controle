-- planê.apê: chave do servidor para receber os arquivos da loja criptografados (só o servidor lê). Pode rodar de novo.
create table if not exists public.ape_segredos (
  id    text primary key,
  dados jsonb not null,
  criado timestamptz not null default now()
);
alter table public.ape_segredos enable row level security;
-- sem política de leitura: ninguém lê pela página; só a função do servidor (chave de serviço)
