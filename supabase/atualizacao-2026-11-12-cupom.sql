-- cupom de desconto usado no pedido (planê.arquivos, planê.arq e planê.apê). Pode rodar mais de uma vez.
alter table public.ape_pedidos add column if not exists cupom text;
