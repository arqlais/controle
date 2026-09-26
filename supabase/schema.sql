-- Rode uma vez no Supabase: SQL Editor → New query → cole tudo → Run.
-- Guarda todos os dados do sistema numa linha por usuária.
-- RLS garante que só quem está logada lê e altera os próprios dados.

create table if not exists public.workspace (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb       not null,
  updated_at timestamptz not null default now()
);

alter table public.workspace enable row level security;

drop policy if exists "dona lê"      on public.workspace;
drop policy if exists "dona cria"    on public.workspace;
drop policy if exists "dona altera"  on public.workspace;

create policy "dona lê"     on public.workspace for select using (auth.uid() = user_id);
create policy "dona cria"   on public.workspace for insert with check (auth.uid() = user_id);
create policy "dona altera" on public.workspace for update using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- Agenda do celular: o sistema publica um arquivo .ics por usuária no Storage (bucket "agenda").
-- O endereço tem uma chave secreta; cada usuária só grava na própria pasta.
insert into storage.buckets (id, name, public) values ('agenda', 'agenda', true) on conflict (id) do update set public = true;
drop policy if exists "agenda: dona vê" on storage.objects;
drop policy if exists "agenda: dona cria" on storage.objects;
drop policy if exists "agenda: dona altera" on storage.objects;
drop policy if exists "agenda: dona apaga" on storage.objects;
create policy "agenda: dona vê" on storage.objects for select to authenticated using (bucket_id = 'agenda' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "agenda: dona cria" on storage.objects for insert to authenticated with check (bucket_id = 'agenda' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "agenda: dona altera" on storage.objects for update to authenticated using (bucket_id = 'agenda' and (storage.foldername(name))[1] = auth.uid()::text) with check (bucket_id = 'agenda' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "agenda: dona apaga" on storage.objects for delete to authenticated using (bucket_id = 'agenda' and (storage.foldername(name))[1] = auth.uid()::text);
