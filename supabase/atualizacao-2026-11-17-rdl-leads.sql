-- RDL Engenharia: quem preencheu os dados da reserva e não assinou (para o lembrete por e-mail e para a RDL chamar). Pode rodar mais de uma vez.
create table if not exists public.rdl_leads (
  sessao     text primary key,
  dados      jsonb       not null,
  criado     timestamptz not null default now(),
  atualizado timestamptz not null default now(),
  avisado    timestamptz
);
alter table public.rdl_leads enable row level security;
drop policy if exists "rdl leads: lê" on public.rdl_leads;
drop policy if exists "rdl leads: apaga" on public.rdl_leads;
create policy "rdl leads: lê" on public.rdl_leads for select to authenticated using (public.rdl_acesso() is not null);
create policy "rdl leads: apaga" on public.rdl_leads for delete to authenticated using (public.rdl_acesso() is not null);

create or replace function public.rdl_lead(p_sessao text, p_dados jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if length(coalesce(p_sessao, '')) < 8 or length(p_sessao) > 64 or length(coalesce(p_dados, '{}'::jsonb)::text) > 2000 then return; end if;
  insert into public.rdl_leads (sessao, dados) values (p_sessao, p_dados)
  on conflict (sessao) do update set dados = excluded.dados, atualizado = now();
end;
$$;
grant execute on function public.rdl_lead(text, jsonb) to anon, authenticated;
