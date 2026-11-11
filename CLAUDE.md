# planê — combinados do projeto

- Marca: **planê** · site useplane.com.br · e-mail equipe.plane@gmail.com · Instagram @sou.plane (ficam em `PLATFORM`, `src/plans.ts`).

- A cada atualização publicada, registre o que mudou em `src/news.ts` (novidades que os assinantes veem ao abrir o sistema): texto curto e geral, sem excesso de detalhe, agrupando mudanças parecidas. Nada de `beta: true` no que já está liberado.
- Emojis só em conversas (mensagens de WhatsApp, chat). Na interface, use ícones/símbolos.
- "R$" sempre com R maiúsculo (use `lower()` de `src/utils.ts` quando precisar mostrar texto em minúsculas).
- Foco visual: notebook e celular. No celular, o que for configuração avançada fica no computador e aparece o aviso `DesktopNote`.
- Antes de publicar: `npx tsc -b` e `npm run test:smoke`. Publicação: push para `main` e `plataforma`.
- Cores: só a paleta azul e rosa do planê (`src/palette.ts` e as variáveis de `src/styles.css`). Nada de verde, amarelo ou vermelho puro na interface; "ok" usa o azul, "atenção" e "urgente" usam os tons de rosa. As cores dos documentos de cada profissional continuam livres. Precisou de cor nova: use `SERIES`/`EXTRA` de `src/palette.ts`; se faltar um tom, acrescente lá um tom apagado que converse com o azul e o rosa (dá para passar por `harmonize()`), nunca uma cor viva solta no código.
- **Três frentes** (plano em `docs/FRENTES.md`, nomes e Instagrams em `src/frentes/frentes.ts`): página principal `#/plane` (raiz para quem nunca entrou), **planê arquivos** `#/arquivos` e **planê arq** `#/arq` (vitrines em `src/frentes/`, mesmo checkout da loja do apê; cada produto tem `frente` e `nicho` em `src/ape/model.ts`) e **planê apzinho** (antigo planê.apê). Endereços curtos em `public/arquivos`, `public/arq`, `public/apzinho`.
- **planê apzinho** (`src/ape/`, guia em `docs/APE.md`): loja do apê e orçamentos dos futuros moradores do San Levi, em `#/ape` (público) e `#/ape-admin` (dona). Tem paleta própria só nas variáveis `--a-*` de `src/ape/ape.css` (a regra azul e rosa acima vale para o planê); mesmo assim, nada de verde, amarelo ou vermelho vivos. Não entra em `src/news.ts` (não é para assinantes).
