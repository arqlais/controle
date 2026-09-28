# Plataforma para vender — plano

Objetivo: transformar o sistema da Laís ("controle", React + Vite + Supabase, publicado em https://arqlais.github.io/controle/) numa plataforma por assinatura para outros profissionais (arquitetos, designers, visualização 3D), **sem mexer no sistema de trabalho dela** até ela aprovar a prévia.

## Decisões

- **Mesmo código**, com o que muda entre contas controlado por **plano** (feature flags). Uma melhoria vale para todos; nada de duas cópias.
- **Desenvolver no branch `plataforma`**. O `main` (sistema da Laís, GitHub Pages) só recebe quando ela aprovar.
- **Prévia** publicada como Artifact (build `VITE_ARTIFACT=1`, mesmo processo já usado) e, se possível, numa pasta separada do Pages (ex.: `/controle/previa/`), para ela ver no celular.
- Cada conta já é isolada no Supabase (tabela `workspace`, uma linha por usuária, RLS). Os dados e personalizações de cada cliente (preços, textos, cores, modelos) continuam por conta: mudar num cliente nunca muda nos outros nem no dela.
- A conta da Laís é a **dona**: plano com tudo + o painel da plataforma. Identificar pela conta (ex.: e-mail dela / `user_id` numa tabela `admins`), nunca por algo que o cliente possa editar.
- Segurança: a chave `service_role` / `sb_secret_...` **nunca** vai para o site. Só a publishable. O que precisar de privilégio (cobrança, webhooks) vai para Supabase Edge Functions — a Laís configura os segredos no painel do Supabase, guiada passo a passo.
- Nada de dados de clientes reais no repositório.

## Provisórios (para a prévia; ela troca depois)

- Nome da plataforma: **a definir** (usar um nome provisório bem visível, fácil de trocar num lugar só).
- Planos: **Essencial** (R$ 39/mês) e **Completo** (R$ 69/mês), com 7 dias de teste grátis. Valores só de exemplo.
- O modelo de proposta da Laís ("Proposta #001", Canva) fica **exclusivo dela**; clientes escolhem entre modelos novos.

## Fase 1 — prévia completa (sem cobrança real)

1. **Página de vendas** (rota pública, sem login): apresentação, o que o sistema faz, telas de exemplo (usar os dados de exemplo que já existem), para quem é, planos e preços, perguntas frequentes, depoimentos (marcados como exemplo), botão "testar grátis". Mesma identidade visual (Poppins + The Seasons, areia/grafite/rosé), ótima no celular.
2. **Cadastro com teste grátis**: escolher plano → criar conta (Supabase Auth) → entra no sistema com os dados de exemplo opcionais. Assinatura em **modo teste** (tabela `subscriptions`: plano, status `trial|ativa|atrasada|cancelada`, fim do teste).
3. **Planos / feature flags** (um arquivo só, ex.: `src/plans.ts`):
   - dona: tudo (inclusive assistente de IA e o modelo exclusivo dela);
   - clientes: **sem o assistente de IA** (não gasta créditos dela) → no lugar, **chat com a dona**;
   - Essencial × Completo: definir o que cada um tem (ex.: contratos e modelos extras só no Completo).
4. **Chat com a dona** (suporte): tabela de mensagens por cliente, tempo real (Supabase Realtime). Mostra os **horários em que ela está online** (configuráveis) e, fora deles, "respondo assim que possível". Do lado dela: caixa de entrada com todas as conversas e aviso de mensagem nova.
5. **Modelos de proposta**: 3–4 modelos novos para o cliente escolher (e personalizar cores/textos só para ele) ou **desligar o PDF** (envia só o resumo no WhatsApp).
6. **Contratos**: modelos editáveis com variáveis ({cliente}, {cpf/cnpj}, {valor}, {prazo}, {pagamento}, {serviços}…) preenchidas a partir do orçamento/demanda; gerar PDF; opção de desligar para quem não usa. Deixar claro que é modelo e que cada profissional deve revisar juridicamente.
7. **Painel da dona** (só para a conta dela): assinantes (plano, status, desde quando, último acesso), liberar/bloquear/trocar plano, vendas do mês (MRR, testes, cancelamentos), conversas do chat.

## Fase 2 — vender de verdade

- Cobrança recorrente com Pix e cartão: **Asaas**, **Mercado Pago** ou **Stripe** (ela escolhe; precisa de conta).
- Edge Functions: criar assinatura, receber webhooks (pagou / atrasou / cancelou) e atualizar `subscriptions`; bloquear só a edição (nunca apagar dados) quando atrasar.
- E-mails: boas-vindas, fim do teste, cobrança, pagamento recebido.

## Fase 3 — formalizar

- Termos de uso, política de privacidade (LGPD), página de contato.
- Nome e domínio próprio.
- Nota fiscal / CNPJ (orientar a Laís a ver com contador).

## Como a Laís acessa

Mesmo endereço e mesmo login de hoje. Na conta dela aparece o item **painel da plataforma** no menu. Clientes entram pela página de vendas → "entrar".

## Jeito de trabalhar (manter o que já é regra no projeto)

- Tudo em português, tom leve, textos em minúsculas onde o site já usa.
- Testar sempre em celular (360/390), tablet (820) e computador (1280–1920): nada saindo da tela, nada desalinhado.
- `npm run test:smoke` antes de cada envio; publicar a prévia como Artifact; explicar para a Laís em linguagem simples, sem termos técnicos.

## Andamento

**Fase 1 feita no branch `plataforma`** (prévia, sem cobrança):

- página de vendas (`src/pages/Landing.tsx`) com telas de exemplo usando os componentes reais;
- cadastro com teste grátis (`src/components/Signup.tsx`) e assinatura em modo teste (`src/pages/Subscription.tsx`);
- nome, preços e o que cada plano libera num lugar só: `src/plans.ts`; acesso da conta em `src/access.tsx`;
- chat com a dona com horários online (`src/components/OwnerChat.tsx`, `src/chat.ts`);
- modelos de proposta (`src/proposalTemplates.ts` + `.tpl-…` em `src/platform.css`) e opção de desligar o PDF;
- contratos com modelos editáveis e variáveis do orçamento (`src/contracts.ts`, `src/pages/Contracts.tsx`);
- painel da dona (`src/pages/Admin.tsx`);
- SQL do Supabase em `supabase/plataforma.sql`, passo a passo em `docs/PLATAFORMA-SUPABASE.md`.

Enquanto o SQL da plataforma não for rodado, a conta da Laís continua exatamente como hoje (tudo liberado).
Na prévia (Artifact), o botão "prévia · ver como" troca entre página de vendas, cliente e dona; assinantes e conversas são fictícios.
