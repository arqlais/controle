-- planê.apê: morador entra com e-mail e senha (a mesma conta da loja), fotos públicas da loja (trocadas pelo painel)
-- e orçamentos com os arquivos originais para os moradores verem. Pode rodar de novo.

alter table public.ape_clientes add column if not exists morador uuid references public.ape_moradores(id) on delete set null;
create index if not exists ape_clientes_morador on public.ape_clientes (morador);

-- fotos da loja que a dona troca pelo painel (ex.: a imagem de projetos). Pública para ler; só a dona envia.
insert into storage.buckets (id, name, public, file_size_limit)
values ('ape-publico', 'ape-publico', true, 10485760)
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit;
drop policy if exists "apê público: todos veem" on storage.objects;
drop policy if exists "apê público: dona envia" on storage.objects;
drop policy if exists "apê público: dona troca" on storage.objects;
drop policy if exists "apê público: dona apaga" on storage.objects;
create policy "apê público: todos veem" on storage.objects for select using (bucket_id = 'ape-publico');
create policy "apê público: dona envia" on storage.objects for insert to authenticated with check (bucket_id = 'ape-publico' and public.sou_dona());
create policy "apê público: dona troca" on storage.objects for update to authenticated using (bucket_id = 'ape-publico' and public.sou_dona()) with check (bucket_id = 'ape-publico' and public.sou_dona());
create policy "apê público: dona apaga" on storage.objects for delete to authenticated using (bucket_id = 'ape-publico' and public.sou_dona());
