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
    { id: 'arquivos' as const, titulo: 'Planê.arquivos · arquivos prontos para beleza, saúde e arquitetura', desc: 'Fichas de anamnese, termos de consentimento, receituário, odontograma, stories, tabela de preços, contratos e planilhas para nail, lash, sobrancelha, biomedicina, estética, dentista, médico e arquitetura. Nos 4 estilos, baixa na hora.' },
    { id: 'arq' as const, titulo: 'Planê.arq · gestão para quem projeta', desc: 'Clientes, orçamentos, propostas, contratos, prazos e financeiro do escritório num lugar só. 14 dias grátis, sem cartão.' },
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
        const itens = produtos.filter((p) => p.ativo && (frenteDe(p) === pg.id || (pg.id === 'arquivos' && frenteDe(p) === 'arq')))
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
              url: pg.id === 'arquivos' ? `${SITE}/arquivos/p/${p.id}/` : url,
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
      // uma página por produto (o Google lê: título, descrição, preço, imagem e dados de produto) e o arquivo do Google Shopping (gratuito)
      const daLoja = produtos.filter((p) => p.ativo && (frenteDe(p) === 'arquivos' || frenteDe(p) === 'arq') && (p.cat || 'arquivos') !== 'plataforma' && reais(p.preco) > 0)
      const urlProd = (id: string) => `${SITE}/arquivos/p/${id}/`
      const imgDe = (p: (typeof daLoja)[number]) => `${SITE}/${(p.amostras?.[0] || 'og-plane-site.jpg').replace(/^\//, '')}`
      for (const p of daLoja) {
        const url = urlProd(p.id)
        const titulo = `${p.nome} · editável · planê.arquivos`
        const desc = `${p.desc} Nos 4 estilos, baixa na hora. ${p.preco} no Pix.`
        const ldp = { '@context': 'https://schema.org', '@type': 'Product', name: p.nome, description: p.desc, image: [imgDe(p)], sku: p.id, brand: { '@type': 'Brand', name: 'planê' }, category: p.tipo || 'arquivos', offers: { '@type': 'Offer', price: reais(p.preco).toFixed(2), priceCurrency: 'BRL', availability: 'https://schema.org/InStock', url, itemCondition: 'https://schema.org/NewCondition', seller: { '@type': 'Organization', name: 'planê' }, hasMerchantReturnPolicy: { '@type': 'MerchantReturnPolicy', applicableCountry: 'BR', returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow', merchantReturnDays: 7 } } }
        const h = base
          .replace('<meta charset="UTF-8" />', '<meta charset="UTF-8" />\n    <base href="../../../" />')
          .replace(/<title>[^<]*<\/title>/, `<title>${esc(titulo)}</title>`)
          .replace(/(<meta name="description" content=")[^"]*(")/, `$1${esc(desc)}$2`)
          .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${esc(titulo)}$2`)
          .replace(/(<meta name="twitter:title" content=")[^"]*(")/, `$1${esc(titulo)}$2`)
          .replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${esc(desc)}$2`)
          .replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${url}$2`)
          .replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${url}$2`)
          .replace(/(<meta property="og:image" content=")[^"]*(")/, `$1${imgDe(p)}$2`)
          .replace(/(<meta property="og:image:secure_url" content=")[^"]*(")/, `$1${imgDe(p)}$2`)
          .replace(/(<meta name="twitter:image" content=")[^"]*(")/, `$1${imgDe(p)}$2`)
          .replace(/\s*<meta property="og:image:(type|width|height)" content="[^"]*" \/>/g, '')
          .replace('</head>', `  <script type="application/ld+json">${JSON.stringify(ldp).replace(/</g, '\\u003c')}</script>\n  </head>`)
          .replace('<div id="root"></div>', `<div id="root"></div>\n    <noscript><main><h1>${esc(p.nome)}</h1><p>${esc(p.desc)}</p><p>${esc(p.preco)} no Pix</p><ul>${(p.itens || []).map((t) => `<li>${esc(t)}</li>`).join('')}</ul></main></noscript>`)
        fs.mkdirSync(path.join(outDir, 'arquivos', 'p', p.id), { recursive: true })
        fs.writeFileSync(path.join(outDir, 'arquivos', 'p', p.id, 'index.html'), h)
      }
      const x = (t: string) => esc(String(t || ''))
      const feed = daLoja.map((p) => `  <item>\n    <g:id>${x(p.id)}</g:id>\n    <title>${x(p.nome)}</title>\n    <description>${x(p.desc)}</description>\n    <link>${urlProd(p.id)}</link>\n    <g:image_link>${imgDe(p)}</g:image_link>\n    <g:price>${reais(p.preco).toFixed(2)} BRL</g:price>\n    <g:availability>in_stock</g:availability>\n    <g:condition>new</g:condition>\n    <g:brand>planê</g:brand>\n    <g:identifier_exists>no</g:identifier_exists>\n    <g:google_product_category>Software &gt; Digital Goods &amp; Currency</g:google_product_category>\n    <g:product_type>${x(p.sub && p.sub !== 'todos' ? p.sub : 'arquivos')} &gt; ${x(p.tipo || 'arquivos')}</g:product_type>\n  </item>`).join('\n')
      fs.writeFileSync(path.join(outDir, 'google-produtos.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">\n<channel>\n  <title>planê.arquivos</title>\n  <link>${SITE}/arquivos/</link>\n  <description>Arquivos editáveis para profissionais</description>\n${feed}\n</channel>\n</rss>\n`)
      const hoje = new Date().toISOString().slice(0, 10)
      const urls = [...['', 'arquivos/', 'arq/', 'ape/'].map((u) => `${SITE}/${u}`), ...daLoja.map((p) => urlProd(p.id))].map((u) => `  <url><loc>${u}</loc><lastmod>${hoje}</lastmod></url>`).join('\n')
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
