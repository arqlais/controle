-- Diagnóstico da leitura automática (não mostra nenhuma chave, só se ela existe).
select 'admins' as item, count(*)::text as valor from public.admins
union all
select 'admin ' || left(a.user_id::text, 8) || ' tem chave do Gemini no planê',
       case when coalesce(w.data->'settings'->>'aiKey', '') = '' then 'não'
            else 'sim (' || length(w.data->'settings'->>'aiKey') || ' caracteres, começa com ' || left(w.data->'settings'->>'aiKey', 4) || ')' end
from public.admins a left join public.workspace w on w.user_id = a.user_id
union all
select 'leituras nas últimas 48 h', count(*)::text from public.ape_leituras where criado > now() - interval '48 hours'
union all
select 'orçamentos enviados por moradores', count(*)::text from public.ape_orcamentos where morador is not null;
