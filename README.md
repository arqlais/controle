# Controle · Lais 3D

Sistema de gestão para freelancer de visualização arquitetônica: clientes, demandas, prazos, urgência, orçamentos, financeiro e agenda — com a sua identidade visual.

## O que tem

| Área | Recursos |
| --- | --- |
| **Início** | Saudação, alertas de atraso, recebido × meta do mês, total a receber, lucro, valor/hora médio, *prioridades agora* (ordenadas por urgência + prazo), próximos 7 dias, gráfico de 6 meses e receita **profissionais × estudantes** |
| **Demandas** | Quadro Kanban (arrastar e soltar) ou lista ordenável; status (briefing → produção → revisão → aguardando cliente → entregue, pausado, cancelado); prioridade + **urgência automática** (vira urgente quando faltam ≤ 2 dias ou atrasou) |
| **Projeto** | Parcelas editáveis (50/50, 30/70, à vista, 3x), marcar pago, **recibo em PDF** com valor por extenso, botão **Cobrar no WhatsApp** com Pix, etapas (checklist), contador de revisões inclusas × usadas, lançamento de horas com **R$/hora real**, briefing, link dos arquivos, compromissos |
| **Clientes** | Tipos: arquiteto, designer de interiores, escritório, construtora, incorporadora, estudante; filtro profissionais/estudantes; faturado, em aberto, ticket médio, origem (indicação, Instagram…), favoritos, arquivar, atalhos WhatsApp/e-mail/Instagram |
| **Orçamentos** | Itens da sua tabela de preços (preço **profissional** e **estudante** automáticos), taxa de urgência, desconto, prazo, revisões, validade; **PDF da proposta**, texto pronto para WhatsApp, taxa de aprovação; **aprovado → vira projeto** com parcelas e etapas |
| **Financeiro** | Mês a mês: recebido, previsto, despesas, lucro e margem; parcelas vencidas; despesas únicas ou **mensais** (licenças, DAS/MEI…); 12 meses em gráfico; relatórios por serviço, tipo de cliente, melhores clientes, origem e categoria de despesa; exportação **CSV** para contador |
| **Agenda** | Calendário mensal com prazos, pagamentos e compromissos (reuniões, **faculdade/TCC**, pessoal); exportação **.ics** para Google Agenda / Apple / Outlook |
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

## Seus dados

Tudo fica salvo **no navegador** (localStorage) — nada vai para servidor. Por isso:
- Faça **backup** em Configurações → *Baixar backup* com frequência e guarde no Drive.
- Para usar em outro aparelho, *Restaurar backup* nele.

## Identidade visual

Ajuste em **Configurações → Identidade visual**: envie o logo (PNG/SVG), coloque os códigos hex das cores do site e escolha as fontes. Recibos e propostas usam o mesmo visual.

## Stack

React + TypeScript + Vite, sem dependências de UI ou gráficos (tudo em CSS/SVG próprio).
