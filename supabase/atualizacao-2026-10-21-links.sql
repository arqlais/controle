-- Atualização de 21/10/2026: página de acompanhamento do cliente, fotos de obra e fotos do briefing (faltavam no banco). Pode rodar mais de uma vez.
-- 5d) Página de acompanhamento do projeto (plano Estúdio): o cliente abre pelo link, sem login,
--     e vê só o resumo que o escritório publicou (etapas, prazos, pagamentos, visitas).
create table if not exists public.portal_links (
  id         uuid primary key,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  payload    jsonb not null check (pg_column_size(payload) < 400000),
  updated_at timestamptz not null default now()
);
alter table public.portal_links enable row level security;
drop policy if exists "portal: dono" on public.portal_links;
create policy "portal: dono" on public.portal_links for all
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.pode_editar());
create or replace function public.portal_publico(p_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select p.payload from public.portal_links p where p.id = p_id;
$$;
revoke execute on function public.portal_publico(uuid) from public;
grant execute on function public.portal_publico(uuid) to anon, authenticated;

-- 5e) Fotos de obra (plano Estúdio): cada conta só vê e mexe na própria pasta.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('obra', 'obra', false, 6291456, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
drop policy if exists "obra: dono vê" on storage.objects;
drop policy if exists "obra: dono envia" on storage.objects;
drop policy if exists "obra: dono apaga" on storage.objects;
create policy "obra: dono vê" on storage.objects for select to authenticated
  using (bucket_id = 'obra' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "obra: dono envia" on storage.objects for insert to authenticated
  with check (bucket_id = 'obra' and (storage.foldername(name))[1] = auth.uid()::text and public.pode_editar());
create policy "obra: dono apaga" on storage.objects for delete to authenticated
  using (bucket_id = 'obra' and (storage.foldername(name))[1] = auth.uid()::text);

-- 5f) Fotos que o cliente anexa no briefing: quem responde (sem login) só consegue ENVIAR,
--     e só para um briefing que existe e ainda não foi respondido. Só quem mandou o briefing vê.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('briefing-anexos', 'briefing-anexos', false, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
drop policy if exists "anexos: quem responde envia" on storage.objects;
drop policy if exists "anexos: dono vê" on storage.objects;
drop policy if exists "anexos: dono apaga" on storage.objects;
-- (quem responde não enxerga a tabela de briefings: esta função confere por ele)
create or replace function public.briefing_aberto(pasta text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.briefing_links b where b.id::text = pasta and b.answered_at is null);
$$;
revoke execute on function public.briefing_aberto(text) from public;
grant execute on function public.briefing_aberto(text) to anon, authenticated;
create policy "anexos: quem responde envia" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'briefing-anexos' and public.briefing_aberto((storage.foldername(name))[1]));
create policy "anexos: dono vê" on storage.objects for select to authenticated
  using (bucket_id = 'briefing-anexos' and exists (
    select 1 from public.briefing_links b where b.id::text = (storage.foldername(name))[1] and b.user_id = auth.uid()));
create policy "anexos: dono apaga" on storage.objects for delete to authenticated
  using (bucket_id = 'briefing-anexos' and exists (
    select 1 from public.briefing_links b where b.id::text = (storage.foldername(name))[1] and b.user_id = auth.uid()));

select (select jsonb_agg(id) from storage.buckets) as buckets, to_regclass('public.portal_links') is not null as portal;
