# Controle · Lais 3D

Sistema de gestão para freelancer de visualização arquitetônica: clientes, demandas, prazos, urgência, orçamentos, financeiro e agenda — com a sua identidade visual.

## O que tem

| Área | Recursos |
| --- | --- |
| **Início** | **Para fazer**: parcelas vencidas (cobrar no WhatsApp), entregas de hoje/amanhã, orçamentos sem resposta, revisões extras, cronômetro ligado. |
| **Painel** | Saudação, alertas de atraso, recebido × meta do mês, total a receber, lucro, valor/hora médio, *prioridades agora* (ordenadas por urgência + prazo), próximos 7 dias, gráfico de 6 meses e receita **profissionais × estudantes** |
| **Demandas** | Quadro Kanban (arrastar e soltar) ou lista ordenável; status (briefing → produção → revisão → aguardando cliente → entregue, pausado, cancelado); prioridade + **urgência automática** (vira urgente quando faltam ≤ 2 dias ou atrasou) |
| **Projeto** | Parcelas editáveis (50/50, 30/70, à vista, 3x), marcar pago, **recibo em PDF** com valor por extenso, botão **Cobrar no WhatsApp** com Pix, etapas (checklist), contador de revisões inclusas × usadas, **cronômetro** e lançamento de horas com **R$/hora real**, duplicar demanda, briefing, link dos arquivos, compromissos |
| **Clientes** | Tipos: arquiteto, designer de interiores, escritório, construtora, incorporadora, estudante; filtro profissionais/estudantes; faturado, em aberto, ticket médio, origem (indicação, Instagram…), **histórico de conversas com data**, último projeto, favoritos, arquivar, atalhos WhatsApp/e-mail/Instagram |
| **Orçamentos** | Itens da sua tabela de preços (preço **profissional** e **estudante** automáticos), taxa de urgência, desconto, prazo, revisões, validade; **PDF da proposta**, texto pronto para WhatsApp, taxa de aprovação, **lembrete para cobrar resposta** após 3 dias, busca e filtro por cliente, duplicar proposta; **aprovado → vira projeto** com parcelas e etapas |
| **Financeiro** | Mês a mês: recebido, previsto, despesas, lucro e margem; parcelas vencidas; despesas únicas ou **mensais** (licenças, DAS/MEI…); 12 meses em gráfico; relatórios por serviço, tipo de cliente, melhores clientes, origem e categoria de despesa; exportação **CSV** para contador, **limite anual do MEI** com projeção |
| **Agenda** | Calendário mensal com prazos, pagamentos e compromissos (reuniões, **faculdade/TCC**, pessoal), compromissos semanais repetidos e **assinatura no calendário do celular** (iPhone / Google) com lembretes |
| **Configurações** | **Identidade visual** (logo, cores, fontes, cantos, caixa alta, tema escuro), seus dados para recibos (CPF/CNPJ, Pix), meta mensal, meta de valor/hora, taxa de urgência, tabela de preços; **backup/restauração** em JSON |

Também: busca global (`Ctrl K`), botão **Novo** em qualquer tela, layout para celular com menu inferior, e instalável como app (PWA).

## Como usar

```bash
npm install
npm run dev      # desenvolvimento em http://localhost:5173
npm run build    # gera a pasta dist/ para publicar
```

### Publicar grátis (GitHub Pages)
O workflow `.github/workflows/deploy.yml` publica a cada push na `main`.
No GitHub: **Settings → Pages → Source: GitHub Actions**. O endereço fica `https://<usuario>.github.io/controle/`.
(Também funciona arrastando a pasta `dist/` para Netlify ou Vercel — dá para usar um subdomínio como `controle.lais3d.com.br`.)

## Login e dados na nuvem (Supabase, grátis)

Com a nuvem ligada, o sistema pede **e-mail e senha**, os dados ficam iguais em qualquer aparelho e nada se perde ao fechar o navegador.

1. Crie uma conta em [supabase.com](https://supabase.com) → **New project** (região São Paulo).
2. **SQL Editor → New query**: cole o conteúdo de [`supabase/schema.sql`](supabase/schema.sql) e clique em **Run**.
3. **Authentication → Users → Add user → Create new user**: seu e-mail + senha, marcando *Auto Confirm User*.
4. **Authentication → Sign In / Providers**: desligue **Allow new users to sign up** (ninguém mais consegue criar conta).
5. **Authentication → URL Configuration**: em *Site URL* coloque `https://arqlais.github.io/controle/` (usado no "esqueci minha senha").
6. **Project Settings → API**: copie a *Project URL* e a chave *anon public*.
7. No GitHub: **Settings → Secrets and variables → Actions → aba Variables** → crie `SUPABASE_URL` e `SUPABASE_ANON_KEY` com esses valores.
8. Rode o deploy de novo (Actions → *Publicar no GitHub Pages* → *Run workflow*).

### Agenda no celular (sincroniza sozinha)

9. No Supabase: **Edge Functions → Deploy a new function → Via Editor**, nome **`agenda`**. Cole o conteúdo de [`supabase/functions/agenda/index.ts`](supabase/functions/agenda/index.ts) e clique em **Deploy**.
10. Nos detalhes da função, **desligue "Verify JWT"** (apps de calendário não fazem login; o link é protegido por uma chave secreta).
11. No sistema: **Agenda → Conectar ao celular → gerar meu link** e siga as instruções para iPhone ou Google Agenda.

Entregas, parcelas a receber e compromissos aparecem no calendário do celular, com lembrete na véspera (ou 30 min antes, quando tem horário).

A chave *anon* é pública por natureza; quem protege os dados são as regras de acesso (RLS) do `schema.sql`: só a usuária logada lê e altera os próprios dados.
Sem essas variáveis, o sistema funciona só no navegador (localStorage) — use o backup em Configurações.

## Identidade visual

Segue o site www.lais3d.com.br: **Poppins** + **The Seasons Italic** (embutida em `src/fonts`, recorte com os caracteres do português), areia `#F5F1EE`, grafite `#3E4B57`, rosé `#D6B3AB` e rosé terroso `#A88A80`. Tudo ajustável em **Configurações → Identidade visual**. Recibos e propostas usam o mesmo visual.

## Stack

React + TypeScript + Vite, sem dependências de UI ou gráficos (tudo em CSS/SVG próprio).
