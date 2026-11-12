# Motores dos arquivos da planê.arquivos

Código que desenha os arquivos vendidos (PowerPoint para Canva, Word, PDF e planilhas) e os mockups da loja.
Os **textos pagos** (contratos, fichas completas) não ficam aqui, porque o repositório é público: eles estão
dentro dos próprios arquivos, no armazenamento privado (baixe pelo painel da dona, aba arquivos).

- `peca.py` motor das peças visuais (PPTX); `layouts.py` modelos de página do estilo criativo (colagem).
- `estilos.py` os três estilos (minimalista, chique, criativo) e seus modelos de página.
- `render.py` Word + HTML → PDF; `mapas.py` desenhos de rosto, olhos e corpo; `planilhas.py` planilhas.
- `mock.py`, `mock_b.py` cenas de mockup; `shot.cjs`/`shot-t.cjs` fotografam as cenas (com e sem fundo).
- `cifra.mjs` monta o pacote cifrado (`ape-import/*.bin`) que o workflow `ape-arquivos.yml` importa.

Fontes (pasta `~/.fonts`): Poppins, Cormorant Garamond, Great Vibes e Pinyon Script (todas gratuitas e
presentes no Canva). Converter PPTX em PDF: `soffice --headless --convert-to pdf`.
Variável `CONTEUDO`: pasta de trabalho (padrão `~/conteudo`).
