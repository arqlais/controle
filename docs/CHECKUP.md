# Checkup geral · 12/11/2026

Testado em 9 tamanhos de tela (celular de 320, 360, 390 e 430 px, iPad em pé e deitado, notebook de 1280 e 1366 px, monitor de 1920 px) e em 10 páginas: principal (cards e lista), planê.arquivos, planê.arq, detalhe do produto, carrinho, checkout, minha conta, vendas da gestão e loja do apê. Em cada uma, o teste procurou rolagem para o lado, texto sobreposto, texto cortado, botão pequeno demais para o dedo, letra miúda e erro de JavaScript. O script fica em `/tmp` da sessão; para repetir, peça "rodar o checkup".

## Corrigido

| o quê | antes | depois |
| --- | --- | --- |
| peso da página principal | ~1,2 MB (carregava o sistema inteiro) | ~315 KB (entrada leve só para as páginas públicas) |
| vitrine | checkout, pedido e conta baixavam junto | só baixam quando a pessoa abre; o checkout pré-carrega enquanto ela escolhe |
| primeiro instante | tela branca | fundo bege desde o início e esqueleto dos cartões |
| título da planê.arq | "primeiro escritório" encostava no texto de baixo | espaço certo |
| checkout | o link dos termos quebrava torto em várias linhas | texto corrido |
| alvos de toque no celular | logo, filtros, "primeiro acesso", "esqueci a senha", "entrar" do apê e "comparar planos" com menos de 32 px | 40 a 44 px |
| página de vendas da gestão | manchas coloridas desfocadas no fundo | fundo bege uniforme |
| lista de exemplo das vendas | títulos cortados no meio da palavra | terminam com "…" |
| cartão "sinal recebido" | cobria o nome "Mariana Costa" | mais abaixo |
| etapas das vendas (celular de 320 px) | "obra e pagamentos" cortado | quebra em duas linhas |
| movimento | páginas estáticas | entrada suave dos cartões, retorno ao tocar, número do carrinho que "pula" (tudo desligado para quem pede menos movimento) |
| economia de dados | — | quem usa "economia de dados" no celular não pré-carrega nada |
| compartilhar o link | título e descrição só da gestão | "planê · arquivos, gestão e apê" |

Falsos alarmes conferidos na imagem: perguntas frequentes fechadas, cartões que trocam com animação e o brilho que passa nos botões.

## Sugestões (por ordem de impacto)

1. **Compra teste real** no Pix em `/arquivos` (e reembolso no painel) antes de divulgar.
2. **Renomear os Instagrams** (@plane.arquivos, @plane.ape, @plane.arq): os links do site já apontam para eles.
3. **Página de vendas da gestão leve**: ela ainda carrega o sistema inteiro (~1,2 MB). Dá para levar para a entrada leve, como a principal.
4. **Fundo do sistema dos assinantes**: ainda tem manchas suaves (pedido de 19/10), o que contraria a regra nova "fundo bege uniforme". Posso tirar.
5. **Zoom no celular**: hoje o site bloqueia o zoom com dois dedos. Liberar ajuda quem enxerga pouco, e as caixas de texto já têm 16 px (o iPhone não dá zoom sozinho).
6. **Capas das planilhas**: os 3 produtos em Excel ainda usam o desenho em vez de uma capa de verdade.
7. **Prova social nas vitrines**: 2 ou 3 depoimentos curtos e o número de vendas quando houver.
8. **Busca do Google**: as vitrines usam `#/`, que o Google lê mal. Uma página estática com a lista de produtos em `/arquivos/` e `/arq/` ajuda a aparecer nas buscas.
9. **Cupom de lançamento** e **kit beleza** (anamnese + termo + tabela de preços com desconto).
10. **E-mail pós-compra com a frente vizinha** (comprou arquivo de arq → 14 dias da gestão).
11. **Estilos do sistema** (~450 KB num arquivo só): dividir por tela deixa o login e o painel mais rápidos.
12. **Fonte The Seasons** (33 KB): dá para cortar só as letras usadas.

## Segunda rodada · 12/11/2026

- **Visual**: página principal e vitrines refeitas no desenho da página de vendas da planê.arq (topo de vidro, título com itálico, janela com cartões flutuantes, faixa rosé, seções alternadas, perguntas frequentes, faixa escura e rodapé). Os componentes ficam em `src/frentes/ui.tsx` e usam as mesmas classes `lp-*`.
- **Mockups**: cenas novas para os 18 produtos, com as páginas reais de cada arquivo (folhas em leque, celulares com os stories, cartões impressos e janela de planilha), em `public/ape/amostras/m2-*.webp`, e páginas de dentro para a galeria do detalhe (`p-*.webp`).
- **Depoimentos** (item 7): seção "quem usa, conta" em cada vitrine, só com depoimentos reais publicados no painel e da própria frente (o servidor descobre a frente pela compra de quem escreveu ou pela página).
- **Google** (item 8): `useplane.com.br/arquivos/` e `/arq/` abrem a própria vitrine, com título, descrição, imagem de compartilhamento e a lista de produtos em JSON-LD; `sitemap.xml` e `robots.txt` gerados a cada publicação (`vite.config.ts`).
- **Cupom e kit beleza** (item 9): cupom `LANCAMENTO` (15% em planê.arquivos e planê.arq até 31/12), com aviso na vitrine, campo no checkout e editor no painel (produtos e preços → cupons). Kit atendimento completo (anamnese, termo, tabela de preços e vale-presente, 30% off).
- **E-mail pós-compra** (item 10): quem compra na planê.arq recebe o convite para a gestão (14 dias grátis); quem compra na planê.arquivos, o link da loja.
- **Estilos** (item 11): as regras da página de vendas saíram de `platform.css` para `src/pages/landing.css`. Quem usa o sistema baixa 47 KB a menos; a página de vendas e a de entrar ficaram idênticas pixel a pixel (comparadas antes e depois em notebook e celular).
