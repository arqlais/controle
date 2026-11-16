-- Sistema da RDL Engenharia (useplane.com.br/rdl): área restrita, separada das contas da planê.
-- Pode rodar mais de uma vez.
--  · rdl_workspace: uma linha só com todos os dados da RDL (clientes, orçamentos, contratos, ARTs…).
--  · Quem entra: a dona da planê (tabela admins) e o Rogério (e-mail abaixo). Mais ninguém.
--  · Arquivos públicos da RDL (contrato para assinar, proposta, painel do cliente) ficam na pasta da RDL
--    no bucket "agenda", que só essas duas contas gravam.

create table if not exists public.rdl_workspace (
  id         uuid primary key,
  data       jsonb       not null,
  updated_at timestamptz not null default now()
);
alter table public.rdl_workspace enable row level security;

-- 'dona' (Laís), 'membro' (Rogério) ou nulo (sem acesso)
create or replace function public.rdl_acesso() returns text
language sql stable security definer set search_path = public as $$
  select case
    when exists (select 1 from public.admins where user_id = auth.uid()) then 'dona'
    when lower(coalesce(auth.jwt() ->> 'email', '')) = 'roger.rdl76@yahoo.com.br' then 'membro'
    else null
  end;
$$;
grant execute on function public.rdl_acesso() to authenticated;

drop policy if exists "rdl: lê" on public.rdl_workspace;
drop policy if exists "rdl: cria" on public.rdl_workspace;
drop policy if exists "rdl: altera" on public.rdl_workspace;
create policy "rdl: lê" on public.rdl_workspace for select to authenticated using (public.rdl_acesso() is not null);
create policy "rdl: cria" on public.rdl_workspace for insert to authenticated with check (public.rdl_acesso() is not null and id = '7d1e0000-0000-4000-8000-00000000d1d1');
create policy "rdl: altera" on public.rdl_workspace for update to authenticated using (public.rdl_acesso() is not null) with check (public.rdl_acesso() is not null and id = '7d1e0000-0000-4000-8000-00000000d1d1');

drop policy if exists "rdl: pasta vê" on storage.objects;
drop policy if exists "rdl: pasta cria" on storage.objects;
drop policy if exists "rdl: pasta altera" on storage.objects;
drop policy if exists "rdl: pasta apaga" on storage.objects;
create policy "rdl: pasta vê" on storage.objects for select to authenticated using (bucket_id = 'agenda' and (storage.foldername(name))[1] = '7d1e0000-0000-4000-8000-00000000d1d1' and public.rdl_acesso() is not null);
create policy "rdl: pasta cria" on storage.objects for insert to authenticated with check (bucket_id = 'agenda' and (storage.foldername(name))[1] = '7d1e0000-0000-4000-8000-00000000d1d1' and public.rdl_acesso() is not null);
create policy "rdl: pasta altera" on storage.objects for update to authenticated using (bucket_id = 'agenda' and (storage.foldername(name))[1] = '7d1e0000-0000-4000-8000-00000000d1d1' and public.rdl_acesso() is not null) with check (bucket_id = 'agenda' and (storage.foldername(name))[1] = '7d1e0000-0000-4000-8000-00000000d1d1' and public.rdl_acesso() is not null);
create policy "rdl: pasta apaga" on storage.objects for delete to authenticated using (bucket_id = 'agenda' and (storage.foldername(name))[1] = '7d1e0000-0000-4000-8000-00000000d1d1' and public.rdl_acesso() is not null);
