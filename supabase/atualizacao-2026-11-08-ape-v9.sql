-- planê.apê v9: conta oficial da Laís (moradora do San Levi, torre 2, apê 1204, 2 pessoas) com tudo liberado.
-- Sem senha aqui: ela cria a senha em "minha conta" → primeiro acesso (o código chega no e-mail).
do $$
declare
  v_email text := 'lala.av03@gmail.com';
  v_cli uuid;
  v_mor uuid;
begin
  select id, morador into v_cli, v_mor from public.ape_clientes where email = v_email;
  if v_mor is null then
    insert into public.ape_moradores (nome, torre, ap, tel, condominio, aprovado, pessoas)
    values ('Laís', '2', '1204', '11969288192', 'San Levi', true, 2) returning id into v_mor;
  else
    update public.ape_moradores set torre = '2', ap = '1204', condominio = 'San Levi', aprovado = true, pessoas = 2 where id = v_mor;
  end if;
  if v_cli is null then
    insert into public.ape_clientes (email, nome, tel, morador) values (v_email, 'Laís', '11969288192', v_mor);
  else
    update public.ape_clientes set morador = v_mor where id = v_cli;
  end if;
  if not exists (select 1 from public.ape_pedidos where email = v_email and obs = 'teste da dona' and status = 'pago') then
    insert into public.ape_pedidos (nome, email, cpf, tel, itens, subtotal, desconto, total, status, forma, cortesia, pago_em, obs)
    values ('Laís', v_email, '', '11969288192',
      '[{"id":"kit-completo","nome":"Kit completo","preco":0,"cat":"combos"},{"id":"plataforma","nome":"Plataforma do apê","preco":0,"cat":"plataforma"}]'::jsonb,
      0, 0, 0, 'pago', 'cortesia', true, now() - interval '8 days', 'teste da dona');
  end if;
  -- acessos de teste da dona não vencem
  update public.ape_plataforma p set validade = '2099-12-31'
    from public.ape_pedidos d where p.pedido = d.id and d.obs = 'teste da dona';
end $$;

-- fechar em grupo sem depender da dona: quem marcou interesse (ou mandou o orçamento) registra a condição que conseguiu
create or replace function public.ape_grupo_condicao(p_morador uuid, p_orcamento text, p_pct numeric, p_desc text, p_ate text) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_m public.ape_moradores;
begin
  select * into v_m from public.ape_moradores where id = p_morador;
  if v_m.id is null or not coalesce(v_m.aprovado, false) then raise exception 'só moradores aprovados'; end if;
  if not exists (select 1 from public.ape_interesses where orcamento = p_orcamento and morador = p_morador)
     and not exists (select 1 from public.ape_orcamentos where id = p_orcamento and data->>'morador' = p_morador::text) then
    raise exception 'marque interesse no grupo primeiro';
  end if;
  update public.ape_orcamentos
     set data = data || jsonb_build_object('grupo_pct', p_pct, 'grupo_desc', left(coalesce(p_desc, ''), 120), 'grupo_ate', nullif(p_ate, ''), 'grupo_por', 'T' || v_m.torre || ' · ' || v_m.ap),
         atualizado = now()
   where id = p_orcamento;
  return found;
end $$;
revoke execute on function public.ape_grupo_condicao(uuid, text, numeric, text, text) from public;
grant execute on function public.ape_grupo_condicao(uuid, text, numeric, text, text) to anon, authenticated;

-- "vou fechar com este": dá para escolher mais de um orçamento no mesmo serviço (ex.: pedra da cozinha e do banheiro)
alter table public.ape_escolhas drop constraint if exists ape_escolhas_pkey;
alter table public.ape_escolhas add primary key (morador, orcamento);
create or replace function public.ape_escolher(p_orcamento text, p_morador uuid) returns text
language plpgsql security definer set search_path = public as $$
declare v_nicho text;
begin
  if not exists (select 1 from public.ape_moradores where id = p_morador and coalesce(condominio, 'San Levi') = 'San Levi') then raise exception 'só para moradores do San Levi'; end if;
  select data->>'nicho' into v_nicho from public.ape_orcamentos where id = p_orcamento and not oculto;
  if v_nicho is null then raise exception 'orçamento não encontrado'; end if;
  if exists (select 1 from public.ape_escolhas where morador = p_morador and orcamento = p_orcamento) then
    delete from public.ape_escolhas where morador = p_morador and orcamento = p_orcamento;
    return '';
  end if;
  insert into public.ape_escolhas (morador, nicho, orcamento) values (p_morador, v_nicho, p_orcamento) on conflict do nothing;
  return p_orcamento;
end $$;
