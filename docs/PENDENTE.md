# O que falta (para continuar de qualquer conta)

Atualizado em 12/11/2026. Quem continuar: leia este arquivo, `CLAUDE.md` e `docs/FRENTES.md` antes de mexer.
Marque aqui o que for terminando (troque `[ ]` por `[x]`) e publique junto.

## Feito em 12/11 (segunda rodada)

- [x] **4 estilos em cada arquivo**, na mesma compra: **delicado** (a pegada do site da planê: bege, azul
  acinzentado e rosé, cantos redondos), **criativo** (colagem com cores mais vivas: terracota, pêssego,
  lilás e ameixa, sem exagero), **minimalista** (preto e branco, serifa fina espaçada, cursiva) e **elegante**
  (preto, dourado e taupe; antes se chamava "chique"). Vale para artes, documentos (Word e PDF), planilhas e
  os modelos de freelancer e da planê.arq. Nomes dos arquivos: `<id>.ext` é o criativo; os outros levam
  `--delicado`, `--minimalista` ou `--elegante`. A importação apaga sozinha os antigos `--chique`.
- [x] Sem a fileira de traços e sem listras no espaço da foto, em todos os arquivos.
- [x] Desenhos novos das fichas (rosto com proporção, mapa de cílios em 7 zonas, corpo de frente e de costas),
  em vetor com curvas suaves (`tools/arquivos/mapas_svg.py`).
- [x] Produtos novos: **Cartão de cuidados com QR code** e **Cartão lembrança** (5,9 x 10 cm), nos 4 estilos.
- [x] Loja: bolinhas para ver cada estilo (cartão e detalhe), celular com cartões em 2 colunas, filtros atrás
  do botão "filtrar", "ver todos", topo e "como funciona" mais curtos. Página principal com menos texto no celular.
- [x] Manchas suaves + vidro líquido na página principal e nas vitrines.
- [x] Instagrams: apê → @apzinho_1204; arquivos → @plane.arquivos; arq → @sou.plane.

## Feito em 13/11

- [x] Loja como site de loja: página de vendas (`#/arquivos`), página com todos os produtos (`#/arquivos/produtos`)
  e página de cada produto (`#/arquivos/p:<id>`), com faixa de oferta animada, carrinho pulsando, selo de
  desconto, "comprar agora" e barra de compra fixa no celular. Só "ver todos (+N)", sem "ver mais 12".
- [x] **Cada estilo é uma compra**: no carrinho e no pedido o item é `<id>--<estilo>` (site em
  `src/frentes/estilos.ts`, servidor em `supabase/functions/pagamentos/ape.ts`); a entrega mostra só os
  arquivos daquele estilo, com um botão para cada arquivo (antes só aparecia o primeiro).
- [x] **Links do Canva**: painel da dona → produtos → "links do Canva" (um por arquivo e estilo). Quem compra
  vê "editar no Canva" na página do pedido.

## O que ainda falta

- [ ] **Colar os links do Canva** (é a dona que faz; o Canva não deixa criar "link de modelo" por programa):
  no Canva, Criar design → Importar arquivo (o PowerPoint ou o Word do estilo), depois Compartilhar → Mais →
  Link de modelo; colar no painel → produtos → links do Canva → salvar loja. O painel mostra quantos faltam.

- [ ] **Mockups (as cenas com celular e folhas)** ainda mostram o criativo antigo (rosé). As prévias de cada estilo
  já são as novas; refazer as cenas com `mock.py`/`mock_b.py` + `shot-t.cjs` a partir das páginas novas.
- [ ] **Fotos de exemplo**: a rede deste ambiente bloqueia Unsplash/Pexels. Liberando, trocar o
  "arraste sua foto aqui" por foto de uso comercial liberado (nunca foto do Google: dá problema de direito autoral).
- [ ] Planilhas não têm prévia por estilo na loja (os 4 estilos vão no download).
- [ ] Abrir umas artes no Canva para conferir fontes (Poppins, Cormorant Garamond, Great Vibes).

## Ações da dona (fora do código)

- [ ] Criar o perfil @plane.arquivos e colocar o link `useplane.com.br/arquivos` na bio.
- [ ] Link da bio do @apzinho_1204: `useplane.com.br/apzinho`.
- [ ] Fazer uma compra teste com o cupom `LANCAMENTO`.
- [ ] Abrir 2 ou 3 artes no Canva (Criar design → Importar arquivo) e conferir a troca de foto.
- [ ] Revisar contratos (noivas, freelancer, arquitetura) com um advogado antes de divulgar.

## Onde está cada coisa

- Motores que geram os arquivos (sem o texto pago): `tools/arquivos/` (ver o LEIAME de lá).
- Os arquivos prontos ficam só no armazenamento privado do Supabase (nunca no repositório, ele é público).
  Para mandar arquivos novos: pacote cifrado em `ape-import/*.bin` + workflow `ape-arquivos.yml` com
  `etapa=importar`; depois apague o `.bin` e publique.
- Catálogo da loja: `src/ape/catalogo-beleza.ts` (site) e `supabase/functions/pagamentos/catalogo-beleza.ts`
  (servidor, mesmos preços). Mockups em `public/ape/amostras/` (`m2-*` cena, `t-*` sem fundo, `p-*` páginas).
- Painel da dona: `#/ape-admin` (produtos, imagens, cupons, vendas e arquivos das três lojas).
- Antes de publicar: `npx tsc -b` e `npm run test:smoke`; publicar = push para `main` e `plataforma`.
