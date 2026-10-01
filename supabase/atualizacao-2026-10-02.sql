-- ============================================================
-- Atualização de 02/10/2026 (traço)
-- Cole TUDO no SQL Editor do Supabase e clique em Run. Pode rodar mais de uma vez: não apaga nada.
-- Traz: registro de acessos de cada conta (data, hora, aparelho e IP), para o comprovante do assinante
--       (prova de uso em caso de contestação de pagamento). Só a dona vê.
-- ============================================================

create table if not exists public.access_log (
  id bigserial primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  at timestamptz not null default now(),
  ip text,
  ua text
);
create index if not exists access_log_user_at on public.access_log (user_id, at desc);
alter table public.access_log enable row level security;
drop policy if exists "acessos: dona vê todos" on public.access_log;
create policy "acessos: dona vê todos" on public.access_log for select to authenticated using (public.sou_dona());

-- marcar_acesso passa a guardar também o registro (no máximo um a cada 30 minutos por conta)
create or replace function public.marcar_acesso() returns void
language plpgsql security definer set search_path = public as $$
declare h json;
begin
  update public.subscriptions set last_seen = now() where user_id = auth.uid();
  if auth.uid() is null then return; end if;
  if exists (select 1 from public.access_log where user_id = auth.uid() and at > now() - interval '30 minutes') then return; end if;
  begin
    h := current_setting('request.headers', true)::json;
  exception when others then h := null;
  end;
  insert into public.access_log (user_id, ip, ua)
  values (auth.uid(), split_part(coalesce(h->>'x-forwarded-for', h->>'x-real-ip', ''), ',', 1), left(coalesce(h->>'user-agent', ''), 300));
end $$;
revoke execute on function public.marcar_acesso() from public, anon;
grant execute on function public.marcar_acesso() to authenticated;
