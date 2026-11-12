# O que falta (para continuar de qualquer conta)

Atualizado em 12/11/2026. Quem continuar: leia este arquivo, `CLAUDE.md` e `docs/FRENTES.md` antes de mexer.
Marque aqui o que for terminando (troque `[ ]` por `[x]`) e publique junto.

## Pedido em andamento (12/11)

1. [x] **3 estilos em cada arquivo** (feito em 27 arquivos de beleza: artes, documentos e certificado; faltam as planilhas, os arquivos antigos de beleza (anamnese, termo, tabela de preços, caixa) e os da planê.arq): minimalista, chique e criativo, sem separar por categoria. A compra
   leva os três estilos do mesmo arquivo, e a cliente escolhe qual usar. Na loja, o cartão e o detalhe têm a
   troca de estilo (bolinhas), que muda o mockup.
   - **minimalista**: fundo branco ou off-white, tinta preta, título serifado fino em caixa alta e espaçado,
     um detalhe cursivo, etiquetas em caixa preta com letra branca, monograma grande e apagado no fundo, foto
     sangrando a página. Referência: material de curso de sobrancelha que a dona mandou.
   - **chique**: fundo preto, dourado e taupe, título serifado e cursivo dourado, fotos redondas com aro
     dourado, molduras de linha fina. Referência: catálogo de nail designer que a dona mandou.
   - **criativo**: a colagem que já existe (polaroid, fita, adesivo, coração), em azul e rosé.
   - [ ] Ideias boas das referências (ainda não feitas): cartão de cuidados com **QR code** ("escaneie e confira os cuidados") e
     cartão de **lembrança** pequeno (5,9 x 10 cm).
2. [x] **Nada de "linha de traços"**: a fileira de tracinhos que ficava embaixo do título dos documentos e o
   listrado dentro do espaço da foto saem de todos os arquivos.
3. [ ] **Fotos**: onde fizer sentido, usar foto de banco gratuito (Unsplash ou Pexels, uso comercial
   liberado) só como exemplo; a cliente troca arrastando a foto dela por cima. A rede deste ambiente bloqueia
   esses sites; se continuar bloqueado, manter o espaço "arraste sua foto aqui" liso, sem listras.
4. [ ] **Ilustração**: nada amador (os desenhos de rosto, olhos e corpo das fichas são os antigos; revisar ou trocar por foto). Corpo e rosto só com traço limpo e proporção certa; se não ficar bom,
   usar foto em vez de desenho.
5. [ ] **Conferência** (artes e documentos conferidos em PDF; falta abrir no Canva): nenhum texto sobreposto, espaçamento e proporção certos, testar tudo aberto no Canva.
6. [x] **Visual da plataforma**: poucas manchas suaves (azul e rosé, desfocadas) atrás do topo e de 1 ou 2
   seções, com cartões de vidro líquido (fundo translúcido + desfoque + borda clara). Sem excesso, sem repetir
   em toda seção, sem degradê de fundo inteiro.
7. [x] **Instagram de cada frente** (decidido em 12/11):
   - planê.apê → **@apzinho_1204** (perfil pessoal do apê, mostra a obra; foco é renda extra, não venda).
   - planê.arquivos → **@plane.arquivos** (perfil próprio; fala de toda a plataforma, foco em vender arquivos).
   - planê.arq → **@sou.plane** continua (não criar um terceiro perfil agora; renomear para @plane.arq só se
     um dia quiser separar).

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
