# planê.apê

> A loja é aberta para todo mundo (divulgada no Instagram @apzinho_1204). **Os orçamentos são só dos moradores do San Levi**: quem marca "outro lugar" no cadastro vê a loja, mas não os orçamentos (a tabela não é mais pública; o morador lê pela função `ape_orcamentos_morador`). Cada morador marca **"vou fechar com este"** (um por serviço) e todos veem quantos vizinhos escolheram cada fornecedor; a compra em grupo continua como opção. Ao **anexar** um orçamento, a página sobe o arquivo e a IA (Gemini, com a chave da dona no planê ou o segredo `GEMINI_API_KEY`) já preenche fornecedor e serviço. O San Levi é uma opção no cadastro (com torre e apê); quem é de outro lugar informa só nome, WhatsApp e, se quiser, o condomínio. Os textos deixam claro que a página só organiza o que as pessoas mandam: a responsabilidade pelos orçamentos é de quem envia e do fornecedor (aviso na lista e no rodapé).

Orçamentos dos futuros moradores do San Levi (MRV), dentro do planê: mesmo código, mesmo Supabase, mesmo domínio e o mesmo design (Poppins + The Seasons, símbolo do planê, pílulas, menu de baixo no celular), com as cores do apê 1204 e público próprio.

## Endereços

- **Link para divulgar:** `useplane.com.br/ape` (abre direto a página dos moradores, com prévia própria no WhatsApp; não passa pelo site do planê). Para instalar no celular, o ícone também abre direto nos orçamentos.
- **Moradores:** `useplane.com.br/#/ape` (abas `#/ape/enviar` e `#/ape/loja`). Sem login: na primeira vez a pessoa informa nome completo, torre, apê e telefone.
- **Dona:** no planê, menu **plataforma → planê.apê** (`#/ape-admin`). Logada no planê, a dona também vê os exemplos e os ocultos na página dos moradores.

## O que cada lado faz

| Moradores | Dona (painel) |
| --- | --- |
| Comparam os orçamentos por serviço, com o "mais compensa" no topo | **Recebidos**: orçamentos que os moradores mandaram, com quem mandou e os arquivos |
| Mandam orçamento com PDF/prints (até 8 arquivos de 15 MB) ou texto | **Ler com IA** (Gemini, a mesma chave de configurações → assistente) → confere → publica |
| Entram na compra em grupo com um toque (a contagem aparece para todos) | **Orçamentos**: editar, ocultar, remover, apagar ou colocar exemplos |
| Falam com o fornecedor no WhatsApp com a mensagem pronta | **Moradores**: lista com torre, apê e telefone, copiar para planilha, WhatsApp |
| Pedem os produtos da loja pelo WhatsApp da Laís | **Compras em grupo**: quantos e quem quer cada uma · **Loja**: produtos, preços, WhatsApp |

A diferença em relação à página antiga (Artifact): agora os moradores **gravam** de verdade (cadastro, envio com arquivo, grupo), então nada depende de a Laís copiar dados do WhatsApp.

## Para ligar (uma vez)

1. Supabase → **SQL Editor → New query**: cole `supabase/ape.sql` e clique em **Run** (depois do `plataforma.sql`, que já está rodado).
2. Publique (push para `main` e `plataforma`).
3. Abra o painel → **Orçamentos** → "Colocar 3 exemplos" se quiser ver a página cheia antes dos reais.

## Loja do apê

Seções: **arquivos úteis**, **kits**, **plataforma do apê** e **projeto do seu apê**. Os detalhes mostram só mockups (capa nítida, páginas de dentro borradas) e "o que tem dentro" em números; o conteúdo não aparece antes da compra.

**Carrinho:** arquivos e kits vão para o carrinho. Quanto mais arquivos avulsos, maior o desconto (padrão 2 = 10%, 3 = 15%, 4 = 20%, 6+ = 25%; muda em planê.apê → loja). Os kits têm preço fixo; um arquivo que já está num kit do carrinho sai sozinho. O carrinho sugere arquivos que faltam para o próximo desconto e a troca pelo kit completo quando compensa. Plataforma e projeto continuam pelo WhatsApp.

**Checkout:** página própria (`#/ape/checkout`), no mesmo formato do checkout do planê: 1 seus itens · 2 seus dados · 3 forma de pagamento (Pix ou cartão em até 3x sem juros: 2x a partir de R$ 30, 3x a partir de R$ 60) · 4 confirmar (termos da compra e 7 dias de arrependimento), com o resumo do pedido ao lado.

**Pagamento:** Pix ou cartão pelo Asaas (mesma conta das assinaturas do planê, função `pagamentos`). O preço é calculado no servidor com a loja salva. Pagou → a página do pedido (`useplane.com.br/ape/#pedido:...`) mostra os botões de baixar (links de 24 h, refeitos a cada visita). Sem Asaas ligado, o carrinho oferece "finalizar pelo WhatsApp".

Preços sugeridos (editáveis): checklist de vistoria R$ 19,90 · planilha de obra R$ 24,90 · planner de decoração R$ 17,90 · guia de medidas R$ 16,90 · guia de orçamentos R$ 14,90 · planilha do enxoval R$ 14,90 · checklist de entregas R$ 12,90 · lista da mudança R$ 12,90 · kit chaves na mão R$ 34,90 · kit obra sem susto R$ 39,90 · kit apê novo completo (8 arquivos) R$ 69,90 · plataforma R$ 79/ano · consultoria R$ 149 · layout R$ 390 · projeto com 3D R$ 1.290.

**Para a venda funcionar (uma vez):**
1. Supabase → Edge Functions → Secrets: `ASAAS_API_KEY` e `ASAAS_WEBHOOK_TOKEN` (os mesmos das assinaturas; se já existem, nada a fazer). Webhook do Asaas apontando para a função `pagamentos` (ver o topo de `supabase/functions/pagamentos/index.ts`).
2. Asaas → Minha conta → Informações comerciais: site `useplane.com.br` (para o Asaas voltar para a página do pedido depois do pagamento).
3. planê.apê → **arquivos para entregar**: envie o arquivo de cada produto. Sem arquivo, quem comprar vê "fale no WhatsApp".
4. planê.apê → **loja** → "salvar loja" uma vez (assim o servidor usa os seus preços).

**Os arquivos pagos não ficam no site nem no GitHub** (o repositório é público): ficam na pasta privada `ape-arquivos` do Supabase. No site ficam só os mockups em `public/ape/amostras`.

## Segurança

- Moradores só gravam pelas funções `ape_cadastro`, `ape_enviar` e `ape_quero_grupo`, que conferem os dados e limitam envios. Ninguém sem ser a dona lê cadastros, envios ou quem entrou nos grupos.
- Os arquivos vão para a pasta privada `ape-envios` do Storage: o morador só envia; só a dona abre.
- Orçamentos de exemplo e ocultos não saem do banco para quem não é a dona.

## Cores

Ficam só no topo de `src/ape/ape.css` (variáveis `--a-*`), tiradas do projeto do apê 1204, na ordem que a Laís escolheu: **azul predominante** (marcenaria `#889AA5`, usado escurecido, `#4E6472`, em botões, "mais compensa", abas e selos), **bege** de base (fundo `#F5F1EB` e caixas `#F0EAE3`) e **terracota** nos detalhes (`#9B593F`: preço à vista, itálicos dos títulos, ".apê" do logo). A madeira (`#8A6038`) fica para grupo e atenção. Os tons escurecidos são para o texto ler bem sobre o fundo claro. A regra de "só azul e rosa" do `CLAUDE.md` vale para o planê; o planê.apê tem paleta própria, mas segue a mesma ideia: sem verde, amarelo ou vermelho vivos.

## Arquivos

- `src/ape/model.ts`: nome, serviços, cálculo do "mais compensa", mensagens, exemplos, texto da IA
- `src/ape/api.ts`: Supabase (e o navegador, na prévia)
- `src/ape/ApePublic.tsx`: página dos moradores · `src/ape/ApeAdmin.tsx`: painel da dona
- `src/ape/ape.css`, `src/ape/ApeIcon.tsx`: visual e ícones
- `supabase/ape.sql`: tabelas, regras de acesso e funções
