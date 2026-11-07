-- planê.apê: quantas pessoas vão morar no apê (opcional no cadastro). Pode rodar de novo.
alter table public.ape_moradores add column if not exists pessoas int;
