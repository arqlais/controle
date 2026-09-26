/* Teste de fumaça: as ações do dia a dia continuam funcionando depois de cada atualização.
   Uso: npm run test:smoke  (gera a versão de teste e abre no Chromium sem janela). */
import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'

const PORT = 4199
const server = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: process.argv[2] || 'dist-test', stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 800))
const exe = process.env.CHROMIUM || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined)
const browser = await chromium.launch(exe ? { executablePath: exe } : {})
let fails = 0
const ok = (cond, msg) => { console.log(`${cond ? '✓' : '✗'} ${msg}`); if (!cond) fails++ }

try {
  for (const vp of [{ width: 1440, height: 900, name: 'computador' }, { width: 375, height: 812, name: 'celular' }]) {
    const page = await browser.newPage({ viewport: vp })
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto(`http://localhost:${PORT}/#/projetos`)
    await page.waitForTimeout(900)
    const stored = () => page.evaluate(() => { const k = Object.keys(localStorage).find((x) => x.startsWith('lais3d')); return k ? JSON.parse(localStorage[k]) : null })
    const go = (h) => page.evaluate((h) => (location.hash = h), h)

    // 1. demanda com sinal pago: passa por TODAS as fases, inclusive voltar para "em alinhamento"
    await go('#/projetos'); await page.waitForTimeout(400)
    if (vp.width > 800) {
      const sel = page.locator('.kcard select.status-select').first()
      const values = await sel.locator('option').evaluateAll((os) => os.map((o) => o.value))
      const id = await page.locator('.kcard').first().evaluate((el) => el.closest('[data-id]')?.getAttribute('data-id') ?? '')
      for (const v of [...values, 'briefing']) {
        const card = page.locator('.kcard select.status-select').first()
        // o card muda de coluna: procura a demanda de novo pelo título
        await card.selectOption(v); await page.waitForTimeout(250)
      }
      ok(errors.length === 0, `${vp.name}: quadro troca de fase sem erro`)
    }
    // mais direto: pega uma demanda com sinal pago e força cada fase pela lista
    await page.evaluate(() => localStorage.setItem('proj-view', 'lista'))
    await go('#/inicio'); await page.waitForTimeout(200); await go('#/projetos'); await page.waitForTimeout(500)
    // garante que os dados estão gravados (o exemplo só é salvo depois da primeira alteração)
    if (!(await stored())) {
      await go('#/orcamentos'); await page.waitForTimeout(400)
      const q = page.locator('select[aria-label="Status do orçamento"]').first()
      const v0 = await q.inputValue(); await q.selectOption(v0 === 'rascunho' ? 'enviado' : 'rascunho'); await page.waitForTimeout(200); await q.selectOption(v0); await page.waitForTimeout(300)
    }
    const data0 = await stored()
    const paid = data0?.projects.find((p) => p.payments[0]?.paidDate)
    if (paid) {
      await go(`#/projetos/${paid.id}`); await page.waitForTimeout(500)
      const statusSel = page.locator('select').filter({ has: page.locator('option[value="briefing"]') }).first()
      const all = await statusSel.locator('option').evaluateAll((os) => os.map((o) => o.value))
      for (const v of all) {
        await statusSel.selectOption(v); await page.waitForTimeout(250)
        const now = (await stored()).projects.find((p) => p.id === paid.id).status
        ok(now === v, `${vp.name}: demanda com sinal pago vai para "${v}"`)
      }
    } else ok(false, `${vp.name}: não achei demanda com sinal pago no exemplo`)

    // 2. orçamento: status muda na lista
    await go('#/orcamentos'); await page.waitForTimeout(500)
    const qsel = page.locator('select[aria-label="Status do orçamento"]').first()
    for (const v of ['recusado', 'enviado', 'rascunho']) {
      await qsel.selectOption(v); await page.waitForTimeout(250)
      ok((await qsel.inputValue()) === v, `${vp.name}: orçamento muda para "${v}"`)
    }

    // 3. pagamento: marcar e desfazer no financeiro
    await go('#/financeiro'); await page.waitForTimeout(500)
    const before = (await stored())?.projects.flatMap((p) => p.payments).filter((x) => x.paidDate).length ?? 0
    const btn = page.getByRole('button', { name: /marcar pago/i }).first()
    if (await btn.count()) {
      await btn.click(); await page.waitForTimeout(300)
      const after = (await stored()).projects.flatMap((p) => p.payments).filter((x) => x.paidDate).length
      ok(after === before + 1, `${vp.name}: marcar pagamento`)
    }

    // 4. todas as páginas abrem sem erro e sem passar da largura da tela
    for (const r of ['inicio', 'projetos', 'clientes', 'financeiro', 'agenda', 'orcamentos', 'config', 'manual', 'perfil', 'orcamentos/novo']) {
      await go(`#/${r}`); await page.waitForTimeout(300)
      const wide = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)
      ok(!wide, `${vp.name}: página ${r} cabe na tela`)
    }
    ok(errors.length === 0, `${vp.name}: nenhum erro de JavaScript${errors.length ? ' → ' + errors.join(' | ') : ''}`)
    await page.close()
  }
} finally {
  await browser.close()
  server.kill()
}
console.log(fails ? `\n${fails} falha(s)` : '\ntudo certo')
process.exit(fails ? 1 : 0)
