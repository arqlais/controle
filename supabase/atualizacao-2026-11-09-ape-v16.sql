-- planê.apê v16: contador de visitas do site (sem dado pessoal: código aleatório do aparelho, página, origem e tipo de aparelho).
create table if not exists public.ape_visitas (
  id       bigint generated always as identity primary key,
  criado   timestamptz not null default now(),
  sessao   text not null,
  pagina   text not null,
  origem   text not null default 'direto',
  aparelho text not null default ''
);
create index if not exists ape_visitas_criado on public.ape_visitas (criado desc);
alter table public.ape_visitas enable row level security;
drop policy if exists "apê visitas: dona lê" on public.ape_visitas;
create policy "apê visitas: dona lê" on public.ape_visitas for select using (public.sou_dona());
drop policy if exists "apê visitas: dona apaga" on public.ape_visitas;
create policy "apê visitas: dona apaga" on public.ape_visitas for delete using (public.sou_dona());

-- registra a visita (a mesma página do mesmo aparelho conta uma vez a cada 30 minutos)
create or replace function public.ape_visita(p_sessao text, p_pagina text, p_origem text, p_aparelho text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(p_sessao, '') !~ '^[a-z0-9]{8,40}$' then return; end if;
  if exists (select 1 from public.ape_visitas where sessao = p_sessao and pagina = left(coalesce(p_pagina, ''), 40) and criado > now() - interval '30 minutes') then return; end if;
  insert into public.ape_visitas (sessao, pagina, origem, aparelho)
  values (p_sessao, left(coalesce(p_pagina, 'loja'), 40), left(coalesce(nullif(p_origem, ''), 'direto'), 40), left(coalesce(p_aparelho, ''), 20));
end $$;
revoke execute on function public.ape_visita(text, text, text, text) from public;
grant execute on function public.ape_visita(text, text, text, text) to anon, authenticated;
