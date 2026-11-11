-- planê.apê v21: mensagens do balão "fale comigo" (dúvida, problema no site, depoimento, sugestão) ficam em ape_feedback
alter table public.ape_feedback drop constraint if exists ape_feedback_tipo_check;
alter table public.ape_feedback add constraint ape_feedback_tipo_check check (tipo in ('sugestao', 'depoimento', 'duvida', 'problema', 'mensagem'));
alter table public.ape_feedback add column if not exists contato text not null default '';
alter table public.ape_feedback add column if not exists pagina text not null default '';
alter table public.ape_feedback add column if not exists lido boolean not null default false;
