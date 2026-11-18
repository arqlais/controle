/* Fotos de todas as telas do sistema da RDL (gestão), sem login, com reservas fictícias.
   Uso: VITE_ARTIFACT=1 npx vite build --outDir /tmp/rdl-dist && (cd /tmp/rdl-dist && python3 -m http.server 8799 &) && node scripts/rdl-telas.cjs /tmp/rdl-telas
   Com VITE_ARTIFACT=1 o build abre a prévia local, sem login (nada vai para a nuvem). */
const { chromium, devices } = require('playwright')
const out = process.argv[2] || '/tmp/rdl-telas'
const base = process.env.RDL_URL || 'http://localhost:8799/'
require('fs').mkdirSync(out, { recursive: true })
const PAGINAS = ['inicio', 'reservas', 'arts', 'agenda', 'financeiro', 'clientes', 'orcamentos', 'documentos', 'contratos', 'config']
;(async () => {
  const b = await chromium.launch()
  for (const [tag, opts] of [['cel', { ...devices['iPhone 13'], deviceScaleFactor: 1 }], ['ipad', { viewport: { width: 1080, height: 810 }, deviceScaleFactor: 1, hasTouch: true }], ['pc', { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }]]) {
    const ctx = await b.newContext(opts)
    await ctx.addInitScript(() => { try { sessionStorage.setItem('modo-rdl', '1') } catch {} })
    const p = await ctx.newPage()
    p.on('pageerror', (e) => console.log(tag, 'ERRO', e.message))
    await p.goto(base + '#/inicio'); await p.waitForTimeout(2500)
    for (const pg of PAGINAS) {
      await p.goto(base + '#/' + pg); await p.waitForTimeout(1800)
      await p.screenshot({ path: `${out}/${tag}-${pg}.png`, fullPage: true })
    }
    // vistorias: tabela, agenda e a ficha de um morador
    await p.goto(base + '#/reservas'); await p.waitForTimeout(2500)
    for (const v of ['tabela', 'agenda']) { const t = p.locator(`.seg button:has-text("${v}"), button:has-text("${v}")`).first(); if (await t.count()) { await t.click(); await p.waitForTimeout(600); await p.screenshot({ path: `${out}/${tag}-reservas-${v}.png`, fullPage: true }) } }
    const etapas = p.locator('button:has-text("etapas")').first(); if (await etapas.count()) await etapas.click()
    const card = p.locator('.rdp-card').nth(3); if (await card.count()) { await card.click(); await p.waitForTimeout(800); const m = p.locator('.modal').first(); if (await m.count()) await m.screenshot({ path: `${out}/${tag}-ficha.png` }) }
    await ctx.close()
  }
  await b.close()
})()
