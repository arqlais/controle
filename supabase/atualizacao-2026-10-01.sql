-- ============================================================
-- Atualização de 01/10/2026 (traço)
-- Cole TUDO no SQL Editor do Supabase e clique em Run. Pode rodar mais de uma vez: não apaga nada.
-- Traz: plano Estúdio liberado no cadastro, todo mundo que está em teste passa a testar o Estúdio
--       e quem criar conta daqui para frente já começa testando o Estúdio.
-- ============================================================

-- 1) O plano Estúdio é aceito na assinatura e no pedido
alter table public.subscriptions drop constraint if exists subscriptions_plan_check;
alter table public.subscriptions add constraint subscriptions_plan_check check (plan in ('essencial', 'completo', 'estudio'));
alter table public.subscriptions drop constraint if exists subscriptions_requested_plan_check;
alter table public.subscriptions add constraint subscriptions_requested_plan_check check (requested_plan in ('essencial', 'completo', 'estudio'));

-- 2) Quem está no teste grátis agora passa a testar o Estúdio (só muda o plano testado; dias de teste e dados continuam iguais)
update public.subscriptions set plan = 'estudio' where status = 'trial' and plan <> 'estudio';

-- 3) Contas novas começam testando o Estúdio
create or replace function public.garantir_assinatura(plano text) returns setof public.subscriptions
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  insert into public.subscriptions (user_id, email, name, studio, plan, trial_ends)
  select u.id, coalesce(u.email, ''), coalesce(u.raw_user_meta_data ->> 'name', ''), coalesce(u.raw_user_meta_data ->> 'studio', ''),
         'estudio', -- o teste grátis é do plano Estúdio (o parâmetro fica só por compatibilidade)
         now() + make_interval(days => least(365, greatest(1, coalesce((select (s.data ->> 'trialDays')::int from public.platform_settings s where s.id = 1), 7))))
  from auth.users u where u.id = auth.uid()
  on conflict (user_id) do nothing;
  return query select * from public.subscriptions where user_id = auth.uid();
end $$;

-- Conferência: quantas pessoas estão testando cada plano
select plan, count(*) from public.subscriptions where status = 'trial' group by plan;
