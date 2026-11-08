-- planê.apê v12: no cadastro, quem vai morar (pessoas e pets, com símbolos)
alter table public.ape_moradores add column if not exists familia jsonb;
