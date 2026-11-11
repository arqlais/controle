# planê apzinho

> A loja é aberta para todo mundo (divulgada no Instagram @apzinho_1204). **Os orçamentos são só dos moradores do San Levi**: quem marca "outro lugar" no cadastro vê a loja, mas não os orçamentos (a tabela não é mais pública; o morador lê pela função `ape_orcamentos_morador`). Cada morador marca **"vou fechar com este"** (um por serviço) e todos veem quantos vizinhos escolheram cada fornecedor; a compra em grupo continua como opção. Ao **anexar** um orçamento, a página sobe o arquivo e a IA (Gemini, com a chave da dona no planê ou o segredo `GEMINI_API_KEY`) já preenche fornecedor e serviço. O San Levi é uma opção no cadastro (com torre e apê); quem é de outro lugar informa só nome, WhatsApp e, se quiser, o condomínio. Os textos deixam claro que a página só organiza o que as pessoas mandam: a responsabilidade pelos orçamentos é de quem envia e do fornecedor (aviso na lista e no rodapé).

Orçamentos dos futuros moradores do San Levi, dentro do planê: mesmo código, mesmo Supabase, mesmo domínio e o mesmo design (Poppins + The Seasons, símbolo do planê, pílulas, menu de baixo no celular), com as cores do apê 1204 e público próprio.

## Endereços

- **Loja (divulgar no Instagram):** `useplane.com.br/ape` abre a página de vendas, aberta a todos, sem cadastro.
- **Moradores do San Levi:** `useplane.com.br/ape/sanlevi` abre os orçamentos (pede cadastro; quem não é do San Levi vê só a loja).
- **Mesmo apê:** no cadastro, se a torre e o apê já têm outra pessoa, aparece "Este apê já tem cadastro: Maria S. Você mora junto?" (só primeiro nome e inicial). No painel → cadastros, a dona vê tudo de cada pessoa (orçamentos, escolhas, grupos, compras) e quem divide o mesmo apê.

- **Moradores:** `useplane.com.br/#/ape` (abas `#/ape/enviar` e `#/ape/loja`). Sem login nem senha: na primeira vez a pessoa informa nome completo, torre, apê e telefone, e fica guardado no aparelho. Para usar em outro aparelho: tocar no próprio nome → "usar em outro aparelho" (copia um link pessoal).
- **A dona** vê os orçamentos sem cadastro; para enviar orçamento como moradora, a página pede o cadastro (agora com a tela, antes dava só o aviso).
- **Dona:** no planê, menu **plataforma → planê apzinho** (`#/ape-admin`). Logada no planê, a dona também vê os exemplos e os ocultos na página dos moradores.

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

Seções: **o que você precisa?** (diferença entre arquivos, kits e plataforma), **arquivos e planilhas** (para quem vai comprar e para quem já comprou), **kits**, **plataforma do apê**, **projetos e reformas** (serviço à parte), 7 dias para desistir, dúvidas e **minhas compras**. Os detalhes mostram mockups (capa nítida, páginas de dentro desfocadas, com a arte do próprio arquivo no fundo).

**Preços (sem prejuízo em nenhuma venda):** o único desconto é o **Pix (5%)**; cartão à vista, **sem parcelamento**. Kits têm o desconto no preço, que sai sozinho: soma dos arquivos menos o % do kit, arredondado para baixo até terminar em ,90 (`comPrecos` em `src/ape/model.ts`, a mesma conta no servidor). O kit completo dá **1 mês** de plataforma. O painel mostra quanto sobra de cada venda depois da taxa do Asaas (padrão: Pix R$ 1,99; cartão 2,99% + R$ 0,49; confira no seu plano). Menor sobra: R$ 10,27 (arquivo de R$ 12,90 no Pix).

| | preço | no Pix |
| --- | --- | --- |
| guia de compra do imóvel · planilha de custos da compra · checklist de vistoria | R$ 19,90 | R$ 18,90 |
| planilha de obra e compras | R$ 24,90 | R$ 23,65 |
| planner de decoração | R$ 17,90 | R$ 17,00 |
| guia do financiamento e dos seguros · guia de medidas | R$ 16,90 | R$ 16,05 |
| guia de orçamentos · planilha do enxoval | R$ 14,90 | R$ 14,15 |
| checklist da visita · checklist de entregas · lista da mudança | R$ 12,90 | R$ 12,25 |
| kit vou comprar (4 arquivos, −35%) | R$ 44,90 | R$ 42,65 |
| kit chaves na mão (3, −23%) | R$ 34,90 | R$ 33,15 |
| kit obra sem susto (3, −29%) | R$ 39,90 | R$ 37,90 |
| kit completo (12, −56%, + 1 mês de plataforma) | R$ 89,90 | R$ 85,40 |
| plataforma do apê (12 meses) | R$ 79,00 | R$ 75,05 |

"Monte seu kit" com desconto por quantidade saiu: os kits prontos já cobrem as etapas e o carrinho sugere trocar arquivos soltos pelo kit quando sai mais barato (ou quase).

**Checkout** (`#/ape/checkout`): 1 confira os itens · 2 seus dados (nome completo, CPF validado, e-mail e celular, todos obrigatórios) · 3 forma de pagamento (Pix −5% ou cartão à vista) · 4 termos de uso (resumo + termos completos: licença pessoal, Lei 9.610/98, identificação nos PDFs, art. 49 do CDC, bônus que não condiciona a desistência, LGPD, foro). Quem vende (nome e CPF/CNPJ) aparece nos termos e no rodapé da loja: preencha em painel → produtos e preços (exigência do Decreto 7.962/2013).

**Pagamento:** a função `pagamentos` cria o cliente e a cobrança no Asaas. Pix: o QR Code e o copia e cola aparecem na própria página do pedido, que confere o pagamento sozinha. Cartão: abre a página segura do Asaas e volta para o pedido.

**Depois de pagar** (`useplane.com.br/ape/#pedido:...`): botões de baixar (cada PDF sai com nome, parte do CPF e número do pedido no rodapé de todas as páginas, feito uma vez e guardado), o link da plataforma (se comprou) e o **bônus** (calendário de manutenção e garantias do 1º ano), liberado no 8º dia. Em outro aparelho: "minhas compras" com CPF + e-mail.

**Plataforma do apê** (`#/ape/minha:<token>`): área de quem comprou, sem senha (o link é a chave, fica guardado no aparelho). Resumo, gastos por cômodo, parcelas dos próximos 12 meses, etapas da compra e da obra, vistoria com fotos e resumo para imprimir, contatos. Salva sozinha na nuvem. Demonstração com dados de exemplo em `#/ape/minha:demo` (não salva nada). Vencido o prazo, fica só para consulta.

**Projetos e reformas:** seção separada dos produtos digitais. A Laís (estudante de Arquitetura e Urbanismo) trabalha em parceria com o pai, engenheiro civil: serviços com responsabilidade técnica (ART) são assinados por ele; valores e condições sempre numa proposta escrita antes de começar. Botão "pedir proposta no WhatsApp".

**Painel → aba por aba:** enviados pelos moradores · adicionar · orçamentos · cadastros · compras em grupo · **produtos e preços** (desconto do Pix, taxas, quem vende, preço, % dos kits e quanto sobra) · **vendas** (busca, link do pedido, WhatsApp, reembolso pelo Asaas, cancelar pendentes) · **clientes** (por CPF, compras, acesso à plataforma, +30 dias, cortesias) · **arquivos** (um por produto + bônus; "enviar vários de uma vez" pelo nome do arquivo: `checklist.pdf`, `planilha-compra.xlsx`, `bonus.pdf`…) · **testar como cliente** (cria o seu acesso de teste: pedido de cortesia com os arquivos e a plataforma, e abre a página do pedido como cliente).

**Reembolso:** em vendas → reembolsar. O valor volta pelo Asaas, os downloads e a plataforma daquele pedido param.

**Para a venda funcionar (uma vez):**
1. Supabase → Edge Functions → Secrets: `ASAAS_API_KEY` e `ASAAS_WEBHOOK_TOKEN` (os mesmos das assinaturas). Webhook do Asaas apontando para a função `pagamentos`.
2. Asaas → Minha conta → Informações comerciais: site `useplane.com.br` (para voltar à página do pedido depois do cartão).
3. planê apzinho → **arquivos**: envie os arquivos (dá para mandar todos de uma vez, com os nomes que vieram).
4. planê apzinho → **produtos e preços**: preencha "quem vende" e toque em "salvar loja".

**Os arquivos pagos não ficam no site nem no GitHub** (o repositório é público): ficam na pasta privada `ape-arquivos` do Supabase. No site ficam só os mockups em `public/ape/amostras`.

## Comparador de orçamentos

Em **enviar**, o morador anexa um ou mais PDFs/prints (ou cola o texto). **Cada arquivo vira um orçamento**, lido sozinho: a IA (Gemini 2.5 Flash, no servidor) puxa fornecedor, serviço, valores, itens com quantidades, materiais, prazo, garantia, pagamento e contatos; sem IA (ou se ela falhar), regras simples leem o texto do PDF (e-mail, telefone, CNPJ, valores, prazo). A pessoa só completa o que faltou (fornecedor, serviço ou valor) e publica **direto na comparação** (sem esperar a dona); depois pode corrigir ou apagar em "seus orçamentos". A dona pode ocultar ou editar no painel.

Por que IA: orçamento de obra não tem padrão (cada fornecedor manda de um jeito, muitos são fotos), e as regras sozinhas não separam itens nem escopo. O custo é baixo (um arquivo por chamada, limite de 40 leituras por dia por morador) e as regras servem de reserva.

Na lista, cada serviço com 2 ou mais orçamentos tem **"comparar lado a lado"**: destaques (menor preço por m² ou à vista, mais completo, maior garantia, menor prazo), preço e pagamento, prazos, materiais, **o que está incluso** em cada um (inclui / não inclui / não fala) conforme o serviço, itens e quantidades, **diferenças** (áreas, espessuras, só material, quantidades, garantia faltando) e, por fornecedor, o que os outros incluem e ele não fala, o que pode custar a mais e o que falta informar, com botão para perguntar ao fornecedor no WhatsApp. Serviços: pisos, revestimentos, marcenaria, pedras, box, gesso, elétrica, hidráulica, impermeabilização, serralheria, ar, pintura, cortinas, telas, vidros, iluminação, móveis, eletros e mão de obra.

## Segurança

- Moradores só gravam pelas funções `ape_cadastro`, `ape_enviar` e `ape_quero_grupo`, que conferem os dados e limitam envios. Ninguém sem ser a dona lê cadastros, envios ou quem entrou nos grupos.
- Os arquivos vão para a pasta privada `ape-envios` do Storage: o morador só envia; só a dona abre.
- Orçamentos de exemplo e ocultos não saem do banco para quem não é a dona.

## Cores

Ficam só no topo de `src/ape/ape.css` (variáveis `--a-*`), tiradas do projeto do apê 1204, na ordem que a Laís escolheu: **azul predominante** (marcenaria `#889AA5`, usado escurecido, `#4E6472`, em botões, "mais compensa", abas e selos), **bege** de base (fundo `#F5F1EB` e caixas `#F0EAE3`) e **terracota** nos detalhes (`#9B593F`: preço à vista, itálicos dos títulos, ".apê" do logo). A madeira (`#8A6038`) fica para grupo e atenção. Os tons escurecidos são para o texto ler bem sobre o fundo claro. A regra de "só azul e rosa" do `CLAUDE.md` vale para o planê; o planê apzinho tem paleta própria, mas segue a mesma ideia: sem verde, amarelo ou vermelho vivos.

## Arquivos

- `src/ape/model.ts`: nome, serviços, cálculo do "mais compensa", mensagens, exemplos, texto da IA
- `src/ape/api.ts`: Supabase (e o navegador, na prévia)
- `src/ape/ApePublic.tsx`: página dos moradores · `src/ape/ApeAdmin.tsx`: painel da dona
- `src/ape/ape.css`, `src/ape/ApeIcon.tsx`: visual e ícones
- `supabase/ape.sql`: tabelas, regras de acesso e funções
