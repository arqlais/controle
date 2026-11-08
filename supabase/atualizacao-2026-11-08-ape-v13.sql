-- planê.apê v13: a família da Laís (eu e Igor, noivo) no cadastro de moradora e na plataforma do apê dela.
do $$
declare
  v_email text := 'lala.av03@gmail.com';
  v_fam jsonb := '[{"tipo":"adulto","nome":"Laís","papel":"eu"},{"tipo":"adulto","nome":"Igor","papel":"noivo"}]'::jsonb;
  v_plat jsonb := '[{"id":"f1","tipo":"adulto","nome":"Laís","papel":"eu"},{"id":"f2","tipo":"adulto","nome":"Igor","papel":"noivo"}]'::jsonb;
begin
  update public.ape_moradores m set familia = v_fam, pessoas = 2
    from public.ape_clientes c where c.email = v_email and c.morador = m.id;
  update public.ape_plataforma p
     set dados = jsonb_set(coalesce(p.dados, '{}'::jsonb), '{imovel}',
                   coalesce(p.dados->'imovel', '{"tipo":"apê","fase":"planta","m2":null,"orcamento":null,"entrega":"","nome":"meu apê"}'::jsonb)
                   || jsonb_build_object('familia', v_plat, 'moradores', 'Laís, Igor', 'condominio', 'San Levi', 'torre', '2', 'ap', '1204'), true),
         atualizado = now()
   where p.email = v_email;
end $$;
