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
