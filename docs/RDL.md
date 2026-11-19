# Sistema da RDL Engenharia

Área restrita da RDL Engenharia e Representações (empresa do Rogério, pai da Laís), **separada da planê**: outra identidade, outros dados, só duas pessoas entram.

## Como entrar

- **Rogério:** `useplane.com.br/rdl` → login próprio da RDL ("primeiro acesso" cria a senha com o e-mail liberado). O aparelho dele fica na RDL.
- **Laís:** na planê, menu **plataforma → RDL Engenharia** (abre a RDL naquela aba) e, dentro da RDL, **voltar para a planê**.
- Mais ninguém: o Supabase só deixa ler e gravar quem a função `rdl_acesso()` libera (a dona da planê, pela tabela `admins`, e o e-mail roger.rdl76@yahoo.com.br).

## O que é separado

- **Dados:** tabela `rdl_workspace` (uma linha, id fixo `RDL_ID` em `src/rdl.ts`), que os dois dividem. Nada vai para a tabela `workspace` das contas da planê.
- **Arquivos públicos** (contrato para assinar, proposta, painel do cliente): pasta `RDL_ID` do bucket `agenda`.
- **Identidade:** logo da RDL (`src/rdlLogo.ts`), azul-marinho `#012C60` e laranja, Poppins. Sem marca da planê no menu, no login e nos links que os clientes abrem.
- **Sem plataforma:** sem assinatura, chat com a dona, novidades, indique e ganhe ou contagem de uso.

## O que só existe na RDL

- Contrato de vistoria de entrega de chaves (`VISTORIA_CONTRACT`), primeiro da lista de modelos.
- Checklist de vistoria (o mesmo da planê.apê, `src/vistoriaChecklist.ts`) e laudo de vistoria, em documentos de obra.
- Controle de ARTs/RRTs (documentos → ARTs, `src/pages/Arts.tsx`).
- Serviços prontos: vistoria (R$ 297) e revistoria (R$ 150).
- Paletas "marinho & laranja" e "marinho".

O modo RDL é decidido por `rdlMode()` (aba → aparelho). Tudo o que é da RDL checa esse modo, para não aparecer na planê.

## Banco

`supabase/atualizacao-2026-11-16-rdl.sql` (roda sozinho no envio para o main; se não rodar, cole no SQL Editor do Supabase e clique em Run).

## Reserva da vistoria pelo link

- Link público: `useplane.com.br/vistoria/` (abre `#/vistoria`). O morador preenche nome, CPF, contato, endereço, torre e apto, lê o contrato `rdl-vistoria` já preenchido e assina (nome digitado ou desenho). Componente `src/components/RdlReservaPublic.tsx`, lógica em `src/rdlReserva.ts`.
- Painel do morador: `#/vistoria/<id>.<código>` (contrato, sinal com Pix, data, laudo, revistoria). Nasce sozinho na assinatura; aparece em "painel do cliente" como "painéis da vistoria · automáticos". O e-mail do pagamento apresenta o painel.
- Recibos (`src/rdlRecibo.ts`, mesmo visual): do sinal (reserva), de quitação da vistoria (depois de "vistoria feita e saldo pago", nº com -Q) e da ART de reforma paga à parte (marcar "ART de reforma paga" na ficha, nº com -A; status.reformaPago também dá baixa na parcela). Cada um com mensagem pronta para o WhatsApp (`msgConfirmacao`, `msgFinal`, `msgReforma`). A mensagem final pede a avaliação.
- Avaliação: `#/vistoria/avaliar-<id>.<código>` (estrelas de 1 a 5 + comentário, função `rdl_avaliar`, fica em status.avaliacao e aparece na ficha). Com 4 ou 5 estrelas aparece o botão do Google, se o link estiver em vistorias → valores e Pix. Prévia: `#/vistoria/avaliar-teste`.
- Contratos na RDL: só "vistoria de entrega de chaves (RDL)" e "ART de reforma (RDL)" (`ART_REFORMA_CONTRACT`) e os que a RDL anexar; os modelos da planê saem da lista e somem os textos da planê.
- Painel das vistorias: cada coluna tem altura limite e rola por dentro, com degradê desfocado embaixo enquanto tiver mais (`ColunaRola`).
- Documentos (menu documentos, só na RDL): checklist, contrato, laudo e recibo, nas versões da RDL, para um morador escolhido ou em branco. Tudo abre editável (`openRdlDoc(html, { editar: true })`: clica no texto, muda e imprime ou salva em PDF; não salva). O contrato em branco usa o modelo "rdl-vistoria" de contratos.
- Laudo: montado em vistorias → reserva → "montar o laudo com fotos" (`src/pages/RdlLaudo.tsx`, dados em `status.laudoDados`, fotos na pasta da RDL em `laudo/<reserva>/`). Publicado em `#/vistoria/laudo-<id>.<código>` (`src/rdlLaudo.ts`, documento em `src/rdlDocs.ts`). Fotos horizontais 2 por linha e verticais 3 por linha, inteiras. Capas: `public/rdl/capa-laudo.svg` e `capa-checklist.svg` (ilustrações nas cores da RDL). As fotos do laudo entram uma a uma (uma que falhar não derruba as outras).
- Banco: tabela `rdl_reservas` + funções `rdl_reservar`, `rdl_minha_reserva`, `rdl_contagem` (`supabase/atualizacao-2026-11-17-rdl-reservas.sql`). Só a RDL lê e altera; o morador vê só a própria reserva pelo código.
- Valores, previsão, chave Pix e "reservas abertas": arquivo público `reserva-vistoria.json` na pasta da RDL, editado em vistorias → valores e Pix.
- No sistema: menu "vistorias" (`src/pages/Reservas.tsx`). Cada reserva vira cliente; sinal confirmado registra o aceite da RDL e cria a ART "a emitir"; a data entra na agenda.
- Na RDL o cliente é um só (sem parceiro/cliente final), há um modelo de documento só (`faixa`, nas cores da RDL) e os orçamentos começam no 100.

### Reserva, parte 2
- Grupo: "X de 10 reservados" na página e no painel (conta só quem contratou a vistoria e não é cortesia; `rdl_grupo()` devolve reservas e sinais pagos). Com 10 reservas ativas com sinal, vale R$ 280; senão vale R$ 297 e a diferença entra no saldo (cláusula 4.3). Valores e mínimo em vistorias → valores e Pix.
- Grupo fechado (10 sinais pagos): o card vira só "Grupo fechado" (passou de 10, o morador não vê mais quantos são, nem no e-mail nem no texto do WhatsApp); quem reservar depois também paga R$ 280. Cada morador do grupo recebe uma vez o e-mail "grupo fechado" garantindo o valor (`rdlGrupoFechado` na função avisos, disparado ao confirmar um sinal e no aviso diário; marca `avisos["grupo-fechado"]`). A RDL recebe um aviso junto. Na prévia local, `sessionStorage["rdl-grupo-demo"]` simula o grupo.
- Endereço atual: não aceita o endereço do próprio San Levi (Estrada Cata Preta, 1098, ou "San Levi"): aviso no formulário (`enderecoSanLevi`) e trava no banco (`rdl_reservar`, `supabase/atualizacao-2026-11-19-rdl-grupo.sql`, que também lista quem já reservou com esse endereço).
- Sinal em até 7 dias (cláusula 5.1). Sem sinal, `rdl_expirar()` cancela sozinha (roda ao abrir a página, o painel e no aviso diário); lembrete automático por e-mail no 5º dia.
- Planta: canto (finais 01, 02, 11, 12) ou corredor (03 a 10), marcada pelo número do apto; imagens em `public/rdl/planta-*.jpg` (book do San Levi).
- ART de reforma: o morador pede (na reserva ou no painel), a RDL manda escopo, valor e prazo em vistorias, ele aprova no painel (cláusula 10.2). Função `rdl_morador`.
- Painel: "o que fazer agora", etapas, documentos (contrato, ART da vistoria, laudo, ART de reforma), planta, reforma e ajuda.
- Modo teste: `#/vistoria/teste` e `#/vistoria/teste-painel` (nada é salvo nem enviado); botão "testar como morador" em vistorias.

## Tudo ligado (src/rdlSync.ts)
O sistema da RDL é uma gestão própria de engenharia (foco: vistoria de entrega de chaves e ART de reforma). `useRdlSync()` roda no App inteiro da RDL (a cada 5 min e ao abrir vistorias) e, para cada reserva, só grava o que mudou:
- **cliente** com os dados no padrão;
- **serviço** em "serviços" (`rdl-<reserva>`), com etapa (aguardando sinal → sinal pago · sem data → agendada → fazer laudo/ART → entregue) e **parcelas**: sinal (valor conferido no extrato ou o Pix pedido), saldo da vistoria (no dia; paga ao marcar "vistoria feita e saldo pago") e ART de reforma. Isso alimenta financeiro, início e ficha do cliente. Parcela marcada como paga à mão no financeiro continua paga. Cortesia: valor zero, sem parcelas;
- **ART a emitir** (`art-<reserva>-vistoria` quando o sinal entra; `art-<reserva>-reforma` quando o morador aprova a ART de reforma);
- **agenda**: compromisso `vistoria-<reserva>` com data, horário e duração.
Menu da RDL: "serviços" no lugar de "demandas", sem etapas de trabalho, instagram e briefings. Tabela de preços só com engenharia (vistoria, revistoria, ART de reforma + plano), migrada uma vez (`rdlServicosV2`).

## Ver todas as telas da gestão sem login
`VITE_ARTIFACT=1 npx vite build --outDir /tmp/rdl-dist`, servir a pasta na porta 8799 e rodar `node scripts/rdl-telas.cjs /tmp/rdl-telas`: tira fotos de todas as telas da RDL (celular, iPad deitado e computador), com reservas fictícias (`reservasDemo` em `src/rdlReserva.ts`, só aparece na prévia local, nunca no site).
