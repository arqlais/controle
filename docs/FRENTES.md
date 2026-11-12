# planê em três frentes — plano

> Decidido com a Laís em 11/11/2026 (nomes finais em 12/11): **planê.arquivos**, **planê.arq** e **planê.apê**. Domínio: só `useplane.com.br` (sem domínio novo). A raiz vira a página de apresentação da planê.

## 1. Arquitetura dentro do useplane.com.br

**Caminhos (`/arquivos`), não subdomínios.** Motivos:

- O site está no GitHub Pages: um repositório publica um domínio só. Subdomínio (`arq.useplane.com.br`) pediria outro repositório/deploy e mais manutenção.
- Login, sessão e o que fica guardado no aparelho são por endereço: se a gestão mudasse para um subdomínio, todo assinante teria de entrar de novo e o cache local (`lais3d-controle-v1`) ficaria para trás.
- Os links já enviados (propostas, contratos, briefings em `useplane.com.br/#/...`) continuam funcionando sem redirecionamento.
- Já é o padrão que funciona hoje com `/ape` (uma pasta em `public/` que abre a rota certa).

| endereço | o que abre | para quem |
| --- | --- | --- |
| `useplane.com.br` | **hub da planê**: o que é, as três frentes em três cards, "entrar" no canto | quem chega pelo Instagram, por indicação ou por engano |
| `useplane.com.br/arquivos` | loja planê.arquivos (vitrines por nicho: `/arquivos/beleza`, `/arquivos/freelancer`…) | profissionais autônomos |
| `useplane.com.br/arq` | planê.arq: página de vendas da gestão + arquivos de arquitetura | estudantes, recém-formados, escritórios de 1 a 3 pessoas |
| `useplane.com.br/ape` | planê.apê (loja + plataforma do apê); `/apzinho` também abre | quem compra apê na planta ou pronto |
| `useplane.com.br/ape/sanlevi` | orçamentos dos moradores | moradores do San Levi |

**Quem já é assinante não vê o hub:** com sessão aberta, a raiz vai direto para o sistema. Links com `#/` também. O hub só aparece para visitante sem login.

**Como uma frente leva à outra (sem poluir):**

- Rodapé único nas três: `planê · arquivos · arq · apê` + Instagram da frente.
- Depois da compra (página do pedido): um card só, da frente vizinha. Ex.: comprou o contrato de arquitetura → "organize esse cliente no planê.arq, 14 dias grátis"; comprou o kit do apê → "precisa de projeto? planê.arq indica".
- Checkout, "minhas compras" e painel são **os mesmos** para as três (um CPF vê tudo que comprou em qualquer frente).

## 2. Papel, público e diferencial

| frente | papel | público | diferencial |
| --- | --- | --- | --- |
| **planê.arquivos** | gerar caixa rápido e constante, com sazonalidade | autônomos que atendem cliente final: beleza primeiro, depois freelancers criativos e pequenos negócios | **"pronto para mandar hoje"**: cada arquivo vem com o texto da mensagem e o passo a passo em 3 linhas; calendário de datas (fim de ano, volta às aulas, Dia das Mães) define o que lança; visual limpo que não parece "template de internet" |
| **planê.arq** | renda recorrente + autoridade | quem está **começando** em arquitetura e interiores: estudante que já pega projeto, recém-formado, escritório de uma pessoa | **"do primeiro cliente ao primeiro escritório"**: não compete com ERP grande; cobre só proposta → contrato → cobrança → entrega, e os arquivos vendidos avulsos são os mesmos modelos que a gestão usa (comprou o arquivo, já abre no sistema) |
| **planê.apê** | produto de nicho com história real | quem comprou ou vai comprar apê (na planta ou pronto), começando pelo ABC | **orçamentos reais comparados por condomínio** e compra em grupo entre vizinhos (já funciona no San Levi); dá para abrir para outros prédios novos da região. Ninguém vende arquivo de apê com isso junto |

## 3. Instagram

| perfil hoje | vira | uso |
| --- | --- | --- |
| @amvi.packs | **@plane.arquivos** | loja (já é de arquivos, aproveita os seguidores) |
| @sou.plane | **@sou.plane** (fica) | marca-mãe: as três frentes e a gestão (é onde os assinantes já estão; o @ já está no sistema) |
| @apzinho_1204 | **@plane.ape** | planê.apê; "apzinho" e o "apê 1204" viram série fixa de conteúdo (bastidores da compra) |
| @amvi.arq | **@plane.arq** | planê.arq: conteúdo para quem projeta e os modelos à venda |
| design parado | reservar como **@plane.beleza** se o nicho crescer; até lá, parado | — |
| @laisamaraldesigner · @arq.lais | ficam pessoais | portfólio; link na bio para o hub |

**@ da loja: @plane.arquivos**, não plane.packs: é o mesmo nome do endereço (`/arquivos`), se explica sozinho e "packs" no Brasil tem duplo sentido. Se estiver ocupado: @planearquivos.

Renomear mantém seguidores e posts. O @ antigo fica livre por uns dias: avise nos stories antes.

## 4. Onde e como vender

**Usar a loja que já existe no planê.apê** e transformá-la em loja de todas as frentes. Ela já faz tudo o que um checkout pago faria, de graça (só a taxa do Asaas):

- Pix com QR na página e cartão pela página do Asaas, cobrança criada pela função `pagamentos`;
- entrega automática: link de download liberado quando o Asaas confirma;
- cada PDF sai com nome, parte do CPF e número do pedido no rodapé (inibe repasse);
- termos, 7 dias, reembolso, "minhas compras", e-mail automático de Pix pendente;
- painel de produtos, preços, kits e quanto sobra de cada venda.

O que falta (trabalho de código, eu faço): a loja passar a ter **vitrines** (`arquivos`, `arq`, `ape`) com nicho e cores do planê, em vez de ser só do apê.

**Canva editável:** entrega como PDF com o **link de modelo** do Canva (a pessoa abre e faz uma cópia). Use só elementos gratuitos ou seus no modelo (elemento Pro do Canva não pode ser revendido). O PDF de entrega leva a marca d'água do pedido.

**Canal extra, opcional:** Kiwify ou Hotmart (grátis para abrir, cobram por venda) só se quiser **afiliados** vendendo o nicho de beleza por você. A loja principal continua sendo a sua.

**Conta no CPF:** funciona. Quando as vendas ficarem constantes, vale abrir MEI (atividade de design/edição) e trocar a conta do Asaas para o CNPJ, por imposto e limite.

## 5. Primeiros produtos

Marcado ● = já dá para vender com o que você tem.

**planê.arquivos — beleza (lançar já: fim de ano é agora)**
- ● kit avisos de fim de ano e agenda (o PDF que já existe) + mensagens prontas para WhatsApp
- tabela de preços editável (Canva)
- fichas de anamnese: sobrancelha/cílios, unhas, estética (PDF preenchível)
- termo de consentimento e autorização de uso de imagem
- cartão fidelidade e vale-presente de Natal (Canva)
- planilha de agenda e caixa do mês
- kit "abrir 2027": metas, preços, avisos de reajuste

**planê.arquivos — freelancers criativos (segundo nicho)**
- ● modelos de proposta, contrato, briefing e recibo (já existem dentro da gestão: é só exportar como arquivo)
- tabela de cálculo de preço/hora (planilha)
- apresentação de portfólio (Canva)

**planê.arq**
- ● modelo de proposta de projeto de interiores e de contrato (do próprio sistema; contrato com aviso para revisão jurídica)
- ● briefing de projeto residencial
- checklist de levantamento/medição e cronograma de obra (planilha)
- calculadora de honorários (planilha)
- "manual do cliente": o que esperar de cada etapa (Canva, para o profissional mandar ao cliente)
- kit "primeiro cliente" (proposta + contrato + briefing + manual) com 1 mês de gestão

**planê.apê**
- ● os 12 arquivos e 4 kits que já estão na loja, a plataforma do apê e o bônus
- próximo: "orçamentos do meu condomínio" para outros prédios novos do ABC (mesma página do San Levi)

## 6. Lançamento em etapas

1. **Esta semana (sem código):** renomear os Instagrams; agendar 2 semanas de posts no Meta Business Suite (grátis, publica sozinho no Instagram e no Facebook); vender o kit de fim de ano pelo WhatsApp/direct enquanto a vitrine não sai.
2. **Loja com vitrines:** adaptar a loja do apê para `/arquivos` e `/arq`, com o kit de fim de ano como primeiro produto. Redirecionar `/ape`.
3. **Hub na raiz:** página curta com três cards e "entrar". Assinante logado não vê.
4. **planê.arq:** exportar os modelos da gestão como arquivos avulsos; trial de 14 dias como bônus de quem compra.
5. **Mais nichos e sazonais:** um lançamento por data (Natal → volta às aulas → Carnaval → Dia da Mulher → Dia das Mães), sempre do nicho que mais vendeu.
6. **planê.apê para outros condomínios.**

**Automático, sem você abrir site:**
- produtos, preços e arquivos: pelo painel (já é assim no apê);
- e-mails de pagamento, entrega e bônus: rotina que já roda sozinha (GitHub Actions);
- posts: Meta Business Suite com agendamento de um mês por vez;
- novidades para assinantes: `src/news.ts` a cada publicação.

## 7. planê.arq sem depender só de assinatura

- **Arquivos avulsos** como porta de entrada (quem não quer assinar ainda compra o modelo).
- **Plano anual com pagamento único** em destaque (menos cancelamento que o mensal).
- **Kits com meses de gestão inclusos** (como o kit completo do apê dá 1 mês de plataforma).
- **Serviço de implantação**: você configura o planê com a marca, os modelos e os clientes do escritório (cobrança única).
- **Indicação**: assinante que indica ganha mês grátis.
- **Pacote para turmas/estágio**: preço para estudantes e grupos de formandos (conversa com a sua fase).

## O que já está no ar (11/11/2026)

- **Página principal** (`src/frentes/Hub.tsx`): aparece em `useplane.com.br` para quem nunca entrou no sistema neste aparelho; sempre em `#/plane`. Duas composições para escolher: cards (padrão) e lista (`useplane.com.br/?v=lista`).
- **Vitrines** (`src/frentes/Vitrine.tsx`): `useplane.com.br/arquivos` e `useplane.com.br/arq`. Usam o mesmo catálogo, carrinho (um por frente), checkout, pedido, minha conta, Asaas e entrega da loja do apê. Produto sem arquivo fica em "em breve" com o botão "me avise" (WhatsApp); desde 12/11 todos têm arquivo e estão à venda.
- **Nomes finais (12/11):** planê.apê, planê.arq e planê.arquivos, em todo o site, e-mails e PDFs. `/apzinho` também abre a loja do apê.
- **Servidor** (`supabase/functions/pagamentos`): cada pedido sabe a frente pelos itens. O nome na cobrança do Asaas, o link de volta, o nome do arquivo baixado, o rodapé do PDF e os e-mails saem com a marca certa. O bônus surpresa é só do apê.

### Para pôr um produto à venda

1. Painel do apê → **arquivos**: envie o arquivo com o id do produto no nome (ex.: `beleza-fim-de-ano.pdf`).
2. Painel → **produtos e preços**: ligue o produto (ele mostra "planê.arquivos · em breve" ou "planê.arq · em breve") e salve a loja.
3. Pronto: sai do "em breve" e entra na vitrine com o botão de comprar.

### O que a Laís faz fora do site

- Renomear os Instagrams: @amvi.packs → @plane.arquivos, @apzinho_1204 → @plane.ape, @amvi.arq → @plane.arq (perfil da planê.arq). Se algum @ estiver ocupado, troque em `src/frentes/frentes.ts`.
- Agendar os posts no Meta Business Suite.

## Arquivos dos produtos (12/11/2026)

Feitos para todos os produtos das duas vitrines, na identidade da planê (bege, azul e rosé; Poppins e Cormorant Garamond itálico, que são gratuitas e existem no Canva):

| produto | o que vai no pedido |
| --- | --- |
| Kit avisos de fim de ano | 6 artes de stories e 6 de feed (PowerPoint), mensagens prontas (Word e PDF), prévia em PDF |
| Tabela de preços | feed e stories (PowerPoint) e PDF para o balcão |
| Fichas de anamnese | 3 fichas (Word e PDF) |
| Termo de consentimento e uso de imagem | Word e PDF |
| Vale-presente e cartão fidelidade | PowerPoint e PDF com 8 por folha |
| Planilha de agenda e caixa | Excel |
| Proposta, contrato e briefing (freelancer) | Word e PDF |
| Calculadora de preço por hora | Excel |
| Proposta, contrato, briefing e levantamento (arq) | Word e PDF |
| Calculadora de honorários | Excel |
| Manual do cliente | PowerPoint e PDF |

Os arquivos não ficam no repositório (ele é público): sobem criptografados em `ape-import/` e o servidor guarda na pasta privada (workflow "planê.apê · arquivos da loja", etapa importar). As capas das vitrines ficam em `public/ape/amostras/f-*.jpg`.

## Cupons e kits (12/11/2026)

- Painel do apê → **produtos e preços → cupons de desconto**: código, %, data final e para quais lojas vale. Sem nenhum salvo, vale o `LANCAMENTO` (15% em planê.arquivos e planê.arq até 31/12/2026).
- O desconto do cupom vale sobre os itens das lojas marcadas; o desconto do Pix vem depois. O pedido guarda o cupom (coluna `cupom` em `ape_pedidos`).
- Kits: planê.arq tem o **Kit primeiro cliente** (30%); planê.arquivos tem o **Kit atendimento completo** (30%).
