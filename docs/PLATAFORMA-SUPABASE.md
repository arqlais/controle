# Plataforma — o que fazer no Supabase (passo a passo)

Nada disso mexe no seu sistema de hoje: o `main` não usa essas tabelas. Pode fazer com calma.

## 1. Criar as tabelas da plataforma (uma vez)

1. Entre em [supabase.com](https://supabase.com) → seu projeto.
2. Menu da esquerda: **SQL Editor** → **New query**.
3. Abra o arquivo [`supabase/plataforma.sql`](../supabase/plataforma.sql), copie tudo e cole.
4. Confira a linha com o seu e-mail (`arq.laisav@gmail.com`). Se a sua conta de login usa outro e-mail, troque ali.
5. Clique em **Run**. No fim aparece uma tabelinha com o seu e-mail na coluna **dona** — isso quer dizer que o sistema já sabe que você é a dona.
   - Se a tabelinha vier **vazia**, o e-mail não bateu: corrija e rode de novo.

O que esse SQL cria:

| Tabela | Para quê | Quem vê |
| --- | --- | --- |
| `admins` | marca a sua conta como dona | só você |
| `subscriptions` | plano, teste grátis, situação e bloqueio de cada cliente | cada cliente vê só a dele; você vê todas e é a única que altera |
| `support_messages` | o chat dos clientes com você | cada cliente vê só a conversa dele; você vê todas |
| `platform_settings` | seus horários online | todos leem; só você altera |

## 2. Ligar o chat em tempo real

O SQL já liga. Para conferir: **Database → Publications → supabase_realtime** → a tabela `support_messages` deve estar marcada.

## 3. Abrir os cadastros (só quando for testar com outras pessoas)

Hoje os cadastros estão fechados (só você entra). Para clientes conseguirem criar conta:

1. **Authentication → Sign In / Providers** → ligue **Allow new users to sign up**.
2. **Authentication → Sign In / Providers → Email**: deixe **Confirm email** ligado (a pessoa confirma o e-mail antes de entrar).
3. **Authentication → URL Configuration**: em *Redirect URLs* adicione o endereço onde a plataforma estiver publicada.

> Importante: rode o passo 1 **antes** de abrir os cadastros.

## Segurança (o que já está garantido)

- No site vai só a chave **publishable** (pública por natureza). A chave secreta (`service_role` / `sb_secret_...`) **nunca** vai para o site.
- Quem é dona é decidido pela tabela `admins`, que nenhum cliente consegue alterar.
- O cliente não consegue mudar a própria situação para "ativa" nem se desbloquear direto na tabela; só pelas funções, com regras.
- Os dados de cada estúdio (clientes, orçamentos, preços, cores, modelos) continuam na tabela `workspace`, uma linha por conta: mudar num cliente nunca muda nos outros nem no seu.

## Fase 2 (cobrança de verdade)

A função `escolher_plano` hoje ativa a assinatura sem cobrar (modo teste). Na Fase 2 ela é trocada pelo pagamento (Asaas, Mercado Pago ou Stripe) com uma Edge Function; os segredos do pagamento ficam no painel do Supabase, nunca no site.
