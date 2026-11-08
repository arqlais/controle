-- planê.apê v10: e-mails automáticos (lembrete do Pix não pago e aviso do bônus) e parcelas guardadas no pedido.
alter table public.ape_pedidos add column if not exists parcelas int not null default 1;
alter table public.ape_pedidos add column if not exists lembrete_em timestamptz;
alter table public.ape_pedidos add column if not exists bonus_email boolean not null default false;
-- pedidos antigos: o bônus já abriu antes deste aviso existir, não manda e-mail atrasado
update public.ape_pedidos set bonus_email = true where status in ('pago', 'reembolsado') and pago_em < now() - interval '7 days';
