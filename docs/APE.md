# planê.apê

Orçamentos dos futuros moradores do San Levi (MRV), dentro do planê: mesmo código, mesmo Supabase, mesmo domínio e o mesmo design (Poppins + The Seasons, símbolo do planê, pílulas, menu de baixo no celular), com as cores do apê 1204 e público próprio.

## Endereços

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
