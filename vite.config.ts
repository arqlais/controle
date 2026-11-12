import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import { PRODUTOS, comPrecos, frenteDe, reais } from './src/ape/model'

const SITE = 'https://useplane.com.br'

/* Páginas que o Google lê: useplane.com.br/arquivos/ e /arq/ abrem a própria vitrine (sem redirecionar),
   com título, descrição, lista de produtos (JSON-LD) e um resumo para quem não roda JavaScript.
   Gera a partir do catálogo (src/ape/model.ts) a cada publicação; também cria o sitemap.xml. */
function frentesSeo(): Plugin {
  const PAGINAS = [
    { id: 'arquivos' as const, titulo: 'Planê.arquivos · arquivos prontos para mandar hoje', desc: 'Fichas de anamnese, termo de consentimento, tabela de preços, vale-presente, avisos de fim de ano, contratos e planilhas editáveis no Canva, no Word e no Excel. Baixa na hora.' },
    { id: 'arq' as const, titulo: 'Planê.arq · modelos para quem projeta', desc: 'Proposta e contrato de projeto de interiores, briefing residencial, checklist de levantamento, calculadora de honorários e manual do cliente. Word, PDF, Canva e Excel.' },
  ]
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  let outDir = 'dist'
  return {
    name: 'frentes-seo',
    apply: 'build',
    configResolved(c) {
      outDir = c.build.outDir
    },
    closeBundle() {
      if (process.env.VITE_ARTIFACT === '1') return
      const base = fs.readFileSync(path.join(outDir, 'index.html'), 'utf8')
      const produtos = comPrecos(PRODUTOS)
      for (const pg of PAGINAS) {
        const url = `${SITE}/${pg.id}/`
        const itens = produtos.filter((p) => p.ativo && frenteDe(p) === pg.id)
        const ld = {
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          name: pg.titulo,
          url,
          itemListElement: itens.map((p, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            item: {
              '@type': 'Product',
              name: p.nome,
              description: p.desc,
              image: p.amostras?.[0] ? `${SITE}/${p.amostras[0]}` : undefined,
              url: `${url}#/${pg.id}/loja:${p.id}`,
              brand: { '@type': 'Brand', name: 'planê' },
              offers: { '@type': 'Offer', price: reais(p.preco).toFixed(2), priceCurrency: 'BRL', availability: 'https://schema.org/InStock', url },
            },
          })),
        }
        const resumo = `<noscript><main><h1>${esc(pg.titulo)}</h1><p>${esc(pg.desc)}</p><ul>${itens.map((p) => `<li><b>${esc(p.nome)}</b> · ${esc(p.preco)} · ${esc(p.desc)}</li>`).join('')}</ul></main></noscript>`
        const capa = itens[0]?.amostras?.[0] ? `${SITE}/${itens[0].amostras[0]}` : `${SITE}/og-plane-site.jpg`
        let h = base
          .replace('<meta charset="UTF-8" />', '<meta charset="UTF-8" />\n    <base href="../" />')
          .replace(/<title>[^<]*<\/title>/, `<title>${esc(pg.titulo)}</title>`)
          .replace(/(<meta name="description" content=")[^"]*(")/, `$1${esc(pg.desc)}$2`)
          .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${esc(pg.titulo)}$2`)
          .replace(/(<meta name="twitter:title" content=")[^"]*(")/, `$1${esc(pg.titulo)}$2`)
          .replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${esc(pg.desc)}$2`)
          .replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${url}$2`)
          .replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${url}$2`)
          .replace(/(<meta property="og:image" content=")[^"]*(")/, `$1${capa}$2`)
          .replace(/(<meta property="og:image:secure_url" content=")[^"]*(")/, `$1${capa}$2`)
          .replace(/(<meta name="twitter:image" content=")[^"]*(")/, `$1${capa}$2`)
          .replace('</head>', `  <script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>\n  </head>`)
          .replace('<div id="root"></div>', `<div id="root"></div>\n    ${resumo}`)
        // a capa do link compartilhado é webp/jpg: o tipo genérico do index não vale aqui
        h = h.replace(/\s*<meta property="og:image:(type|width|height)" content="[^"]*" \/>/g, '')
        fs.mkdirSync(path.join(outDir, pg.id), { recursive: true })
        fs.writeFileSync(path.join(outDir, pg.id, 'index.html'), h)
      }
      const hoje = new Date().toISOString().slice(0, 10)
      const urls = ['', 'arquivos/', 'arq/', 'ape/'].map((u) => `  <url><loc>${SITE}/${u}</loc><lastmod>${hoje}</lastmod></url>`).join('\n')
      fs.writeFileSync(path.join(outDir, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`)
      fs.writeFileSync(path.join(outDir, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`)
    },
  }
}

// base relativa: funciona no GitHub Pages, Netlify, Vercel ou abrindo de qualquer subpasta
export default defineConfig({
  base: './',
  plugins: [react(), frentesSeo()],
  // na versão Artifact tudo precisa ir dentro de um único HTML (fontes inclusas)
  build: { assetsInlineLimit: process.env.VITE_ARTIFACT === '1' ? 100_000_000 : 4096 },
})
