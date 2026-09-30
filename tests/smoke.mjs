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
      const sel = page.locator('.kcard:not(.kcard-draft) select.status-select').first()
      const values = await sel.locator('option').evaluateAll((os) => os.map((o) => o.value))
      const id = await page.locator('.kcard').first().evaluate((el) => el.closest('[data-id]')?.getAttribute('data-id') ?? '')
      for (const v of [...values, 'briefing']) {
        const card = page.locator('.kcard:not(.kcard-draft) select.status-select').first()
        // o card muda de coluna: procura a demanda de novo pelo título
        await card.selectOption(v); await page.waitForTimeout(250)
        if (await page.locator('.modal').count()) { await page.locator('.modal-foot .btn').last().click(); await page.waitForTimeout(200) }
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
        // fases importantes perguntam antes (pagamentos, data de entrega): confirma
        if (await page.locator('.modal').count()) {
          if (v === 'entregue') { const box = page.locator('.modal .status-q input[type=checkbox]').first(); if (await box.count()) await box.check() }
          await page.locator('.modal-foot .btn').last().click(); await page.waitForTimeout(250)
        }
        const now = (await stored()).projects.find((p) => p.id === paid.id).status
        ok(now === v, `${vp.name}: demanda com sinal pago vai para "${v}"`)
        if (v === 'entregue') {
          const pr = (await stored()).projects.find((p) => p.id === paid.id)
          ok(!!pr.deliveredDate && pr.tasks.every((t) => t.done), `${vp.name}: ao entregar, pergunta e registra data e etapas`)
        }
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

    // 3b. orçamento: colar a resposta do cliente marca as plantas; campo de m² apaga o zero; cobrar junto
    await go('#/orcamentos/novo'); await page.waitForTimeout(500)
    // orçamento novo pergunta para quem é
    if (await page.locator('.aud-option').count()) await page.locator('.aud-option[data-audience=parceiro]').click()
    await page.getByRole('button', { name: 'colar resposta' }).click()
    await page.locator('.scope-text').fill('plantas executivas:\n- planta de layout (mobiliário)\n- \u2060planta elétrica\n\ndetalhamentos (caso precise):\n- marcenaria\n- serralheria com vidraçaria')
    await page.getByRole('button', { name: 'marcar no orçamento' }).click(); await page.waitForTimeout(300)
    const descs = await page.locator('.q-item textarea').evaluateAll((els) => els.map((e) => e.value))
    ok(descs.length === 2 && descs[0].includes('planta elétrica') && descs[1].includes('serralheria com vidraçaria'), `${vp.name}: resposta do cliente vira executivo + detalhamento`)
    const qty = page.locator('.q-item').first().locator('input[type=number]').first()
    await qty.fill(''); await qty.type('34')
    ok((await qty.inputValue()) === '34', `${vp.name}: área do serviço aceita 34 sem sobrar o 0`)
    // cada planta marcada soma no valor (área grande para não cair no valor mínimo)
    await qty.fill('300'); await page.waitForTimeout(100)
    const priceOf = () => page.locator('.q-item').first().locator('.money-input input').last().inputValue().then(Number)
    const priceBefore = await priceOf()
    await page.locator('.q-item').first().getByRole('button', { name: 'planta de forro' }).click(); await page.waitForTimeout(150)
    ok((await priceOf()) > priceBefore, `${vp.name}: marcar uma planta aumenta o valor pelo m²`)
    // arquivo aberto: soma a taxa interna e muda o texto de entrega, sem falar da taxa no PDF
    const closedPrice = await priceOf()
    await page.getByRole('button', { name: 'aberto (editável)' }).click(); await page.waitForTimeout(150)
    const filesText = await page.locator('.field', { hasText: 'formatos de arquivos entregues' }).locator('input').inputValue()
    ok((await priceOf()) > closedPrice && /aberto/.test(filesText), `${vp.name}: arquivo aberto soma a taxa e muda a entrega`)
    await page.getByRole('button', { name: 'fechado (PDF)' }).click(); await page.waitForTimeout(150)
    // pavimentos: cada um a mais encarece
    const onePrice = await priceOf()
    await page.getByRole('button', { name: 'Mais um pavimento' }).click(); await page.waitForTimeout(150)
    ok((await priceOf()) > onePrice, `${vp.name}: 2 pavimentos encarecem o executivo`)
    await page.getByRole('button', { name: 'Menos um pavimento' }).click(); await page.waitForTimeout(150)
    await page.locator('.q-item').nth(1).getByText('cobrar junto com o serviço de cima').click(); await page.waitForTimeout(200)
    ok((await page.getByText('Somado ao valor do serviço 01').count()) === 1, `${vp.name}: cobrar dois serviços juntos`)

    // 3c. duas propostas: fechando as duas juntas sai mais barato
    await go('#/orcamentos/novo'); await page.waitForTimeout(500)
    // orçamento novo pergunta para quem é
    if (await page.locator('.aud-option').count()) await page.locator('.aud-option[data-audience=parceiro]').click()
    await page.getByRole('button', { name: 'propostas + juntas' }).click(); await page.waitForTimeout(150)
    await page.locator('.q-item-head select').nth(0).selectOption('render-vray')
    await page.locator('.q-item-head select').nth(1).selectOption('render-ia'); await page.waitForTimeout(150)
    const comboSec = page.locator('section.card', { has: page.locator('h3', { hasText: 'fechando as duas juntas' }) })
    await comboSec.getByRole('button', { name: '10%' }).click(); await page.waitForTimeout(150)
    const [sep, joint] = await comboSec.locator('.quote-totals b').allInnerTexts()
    const num = (t) => Number(t.replace(/[^\d,]/g, '').replace(',', '.'))
    ok(num(joint) > 0 && num(joint) < num(sep), `${vp.name}: duas propostas com desconto para fechar juntas`)

    // 3d. cliente final: escolhe o tipo de projeto e a proposta sai em slides com as etapas
    await go('#/orcamentos/novo'); await page.waitForTimeout(500)
    {
      if (await page.locator('.aud-option').count()) {
        await page.locator('.aud-option[data-audience=final]').click(); await page.waitForTimeout(200)
        await page.locator('.proc-card').first().click(); await page.waitForTimeout(400)
      } else {
        await page.locator('.field', { hasText: 'para quem é' }).getByRole('button', { name: 'cliente final' }).click(); await page.waitForTimeout(400)
      }
      await page.locator('#q-client').fill('Mar'); await page.waitForTimeout(150)
      ok(await page.locator('.cp-list li').count() > 0, `${vp.name}: cliente aparece enquanto digita`)
      await page.keyboard.press('Enter'); await page.waitForTimeout(300)
      await page.getByRole('button', { name: 'propostas + juntas' }).click(); await page.waitForTimeout(400)
      ok(await page.locator('.sp-rail li').count() >= 3, `${vp.name}: proposta de cliente final com as etapas`)
      ok(await page.locator('.sp-combo-total').count() >= 1, `${vp.name}: slides mostram o valor fechando juntas`)
    }

    // 3e. documentos e etapas de trabalho
    await go('#/documentos'); await page.waitForTimeout(600)
    ok(await page.locator('.docs-card').count() === 4, `${vp.name}: documentos (guia, placa, briefing, apresentação)`)
    await page.locator('.docs-card').nth(1).click(); await page.waitForTimeout(500)
    await page.getByLabel('Para onde o QR code leva').fill('@estudio'); await page.waitForTimeout(200)
    ok(await page.locator('.pq-code path').count() === 1, `${vp.name}: placa de obra gera o QR code`)
    await page.locator('.dk-page .back').click(); await page.waitForTimeout(300)
    ok(await page.getByRole('button', { name: 'Voltar sem salvar' }).count() === 1, `${vp.name}: documento pergunta antes de sair sem salvar`)
    await page.getByRole('button', { name: 'Salvar e voltar' }).click(); await page.waitForTimeout(300)
    await go('#/processos'); await page.waitForTimeout(400)
    ok(await page.locator('.step-card').count() > 0, `${vp.name}: etapas de trabalho (cliente final)`)

    // 3e2. manual por plano
    await go('#/manual'); await page.waitForTimeout(400)
    await page.locator('.manual-plan-tabs button', { hasText: 'Essencial' }).click(); await page.waitForTimeout(150)
    const offEss = await page.locator('.manual-tool.is-off').count()
    await page.locator('.manual-plan-tabs button', { hasText: 'Estúdio' }).click(); await page.waitForTimeout(150)
    ok(offEss > 0 && await page.locator('.manual-tool.is-off').count() === 0, `${vp.name}: manual mostra o que cada plano tem`)
    await page.locator('.manual-track button', { hasText: 'cliente final' }).click(); await page.waitForTimeout(150)
    ok(await page.locator('.manual-step').count() === 8, `${vp.name}: manual tem a jornada do cliente final`)

    // 3f. link do briefing abre só com a cópia que vai dentro dele (sem nuvem)
    const packed = await page.evaluate(async () => {
      const payload = { title: 'Teste', clientName: 'Ana', studio: 'estúdio', owner: 'Laís', accent: '#a88a80', intro: 'oi', phone: '31999999999', sections: [{ id: 'a', title: 'a' }], questions: [{ id: 'q1', section: 'a', label: 'Quer TV?', kind: 'choice', options: ['sim', 'não'] }, { id: 'q2', section: 'a', label: 'Polegadas', kind: 'choice', options: ['32', '43'], showIf: { q: 'q1', is: 'sim' } }] }
      const res = new Response(new Blob([new TextEncoder().encode(JSON.stringify(payload))]).stream().pipeThrough(new CompressionStream('deflate-raw')))
      const out = new Uint8Array(await res.arrayBuffer()); let s = ''; for (const b of out) s += String.fromCharCode(b)
      return 'z' + btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    })
    await go(`#/briefing/00000000-0000-0000-0000-00000000000${vp.width > 800 ? 1 : 2}/${packed}`); await page.waitForTimeout(700)
    ok((await page.locator('.bf-public h1').first().textContent()) === 'Teste', `${vp.name}: link do briefing abre pela cópia do link`)
    await page.locator('.bf-cover .bf-send').click(); await page.waitForTimeout(300)
    await page.getByRole('radio', { name: 'sim' }).click(); await page.waitForTimeout(150)
    ok(await page.locator('.bf-sub').count() === 1, `${vp.name}: sub-pergunta aparece com a resposta`)
    await page.getByText('enviar respostas').click(); await page.waitForTimeout(500)
    ok(await page.locator('a[href*="whatsapp"], a[href*="wa.me"]').count() >= 1, `${vp.name}: sem nuvem, as respostas vão pelo WhatsApp`)
    await go('#/inicio'); await page.waitForTimeout(400)

    // 4. todas as páginas abrem sem erro e sem passar da largura da tela
    for (const r of ['inicio', 'projetos', 'clientes', 'financeiro', 'agenda', 'orcamentos', 'config', 'manual', 'perfil', 'orcamentos/novo', 'documentos', 'processos', 'briefings']) {
      await go(`#/${r}`); await page.waitForTimeout(300)
      const wide = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)
      ok(!wide, `${vp.name}: página ${r} cabe na tela`)
    }
    ok(errors.length === 0, `${vp.name}: nenhum erro de JavaScript${errors.length ? ' → ' + errors.join(' | ') : ''}`)
    await page.close()
  }
  // 5. plataforma (prévia): página de vendas → cadastro → chat com a dona → painel da dona
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto(`http://localhost:${PORT}/`)
    await page.waitForTimeout(900)
    ok(await page.locator('.lp-hero h1').count() === 1, 'plataforma: página de vendas abre sem login')
    ok(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), 'plataforma: página de vendas cabe no celular')
    await page.locator('.lp-top .btn.primary').click(); await page.waitForTimeout(300)
    await page.fill('#signup-name', 'Cliente Teste')
    await page.locator('.wp-option[data-profile="ambos"]').click()
    await page.locator('button.auth-submit').click(); await page.waitForTimeout(300)
    ok(await page.locator('.pf-signup .auth-error').count() === 1, 'plataforma: sem aceitar os termos não cria a conta')
    await page.locator('#signup-terms').check()
    await page.locator('button.auth-submit').click(); await page.waitForTimeout(900)
    ok(await page.locator('.pf-trial-banner', { hasText: 'Estúdio' }).count() === 1, 'plataforma: cadastro entra no teste grátis do Estúdio')
    ok(await page.locator('.nw-welcome').count() === 1, 'plataforma: cartão de boas-vindas aparece no primeiro acesso')
    await page.getByRole('button', { name: /começar o passo a passo/ }).click(); await page.waitForTimeout(300)
    ok(await page.locator('.tour').count() === 1, 'plataforma: passo a passo começa depois das boas-vindas')
    await page.locator('#tour-next').click(); await page.waitForTimeout(200)
    ok(await page.evaluate(() => location.hash.includes('config')), 'plataforma: passo a passo leva até a tela explicada')
    await page.locator('.tour .icon-btn').click(); await page.waitForTimeout(300)
    ok(await page.locator('.tour').count() === 0, 'plataforma: passo a passo fecha com "ver depois"')
    ok(await page.locator('.ai-fab.pf-chat-fab').count() === 1, 'plataforma: cliente tem chat com a dona (sem IA)')
    await page.locator('.pf-chat-fab').click(); await page.waitForTimeout(200)
    await page.locator('.pf-chat .rich-box').click()
    await page.keyboard.type('mensagem de teste')
    await page.locator('.pf-chat .btn.primary').click()
    const sent = await page.locator('.pf-chat .ai-msg', { hasText: 'mensagem de teste' }).first().waitFor({ timeout: 8000 }).then(() => true, () => false)
    ok(sent, `plataforma: mensagem enviada no chat${sent ? '' : ` → tela: ${(await page.locator('.pf-chat').innerText().catch(() => 'chat fechado')).slice(0, 300).replace(/\n/g, ' | ')} · erros: ${errors.join(' | ') || 'nenhum'}`}`)
    // negrito pela barrinha + emoji, e Enter manda
    await page.locator('.pf-chat .rich-box').click()
    await page.keyboard.type('importante')
    await page.keyboard.press('ControlOrMeta+A')
    await page.locator('.pf-chat .rich-tools .msg-tool').first().click()
    await page.keyboard.press('End')
    await page.locator('.pf-chat .rich-tools .msg-tool.emoji').click()
    await page.locator('.pf-chat .rich-emojis .msg-tool').first().click()
    await page.locator('.pf-chat .rich-box').press('Enter')
    const bold = await page.locator('.pf-chat .ai-msg b', { hasText: 'importante' }).first().waitFor({ timeout: 5000 }).then(() => true, () => false)
    ok(bold, `plataforma: mensagem com negrito e emoji${bold ? '' : ` → ${await page.locator('.pf-chat .ai-msg').last().innerHTML().catch(() => '')}`}`)
    await page.locator('.pf-chat-fab').click().catch(() => undefined) // fecha o chat
    // testando o Essencial: contratos ficam bloqueados
    await page.evaluate(() => (location.hash = '#/assinatura'))
    const tryBtn = page.locator('.pf-plan', { has: page.locator('h3', { hasText: /^Essencial$/ }) }).getByRole('button', { name: /testar este plano/ })
    const found = await tryBtn.waitFor({ timeout: 8000 }).then(() => true, () => false)
    ok(found, `plataforma: tela de assinatura mostra os planos${found ? '' : ` → tela: ${(await page.locator('main').innerText().catch(() => '')).slice(0, 400).replace(/\n/g, ' | ')} · erros: ${errors.join(' | ') || 'nenhum'}`}`)
    await tryBtn.click(); await page.waitForTimeout(200)
    await page.locator('.modal-foot .btn').last().click(); await page.waitForTimeout(500)
    await page.evaluate(() => (location.hash = '#/contratos')); await page.waitForTimeout(300)
    ok(await page.getByText('disponível no plano').count() === 1, 'plataforma: Essencial não tem contratos')
    await page.locator('.pf-preview-btn').click()
    await page.locator('.pf-preview-menu button', { hasText: 'dona' }).click(); await page.waitForTimeout(700)
    await page.evaluate(() => (location.hash = '#/plataforma')); await page.waitForTimeout(500)
    await page.locator('.pf-tabs .segmented button', { hasText: 'conversas' }).click(); await page.waitForTimeout(300)
    ok(await page.locator('.pf-thread', { hasText: 'importante' }).count() === 1, 'plataforma: dona recebe a conversa')
    await page.locator('.pf-thread', { hasText: 'importante' }).click(); await page.waitForTimeout(300)
    ok(await page.locator('.pf-thread-view .ai-msg b', { hasText: 'importante' }).count() === 1, 'plataforma: dona vê a formatação da mensagem')
    ok(await page.locator('.pf-thread-view .rich-ai').count() === 1, 'plataforma: botão responder com IA na conversa')
    await page.locator('.pf-thread-view .rich-ai').click(); await page.waitForTimeout(300)
    ok(await page.locator('.toast', { hasText: 'chave do Gemini' }).count() >= 1, 'plataforma: sem chave, a IA explica onde colocar')
    for (const r of ['plataforma', 'contratos', 'contratos/modelos', 'config']) {
      await page.evaluate((h) => (location.hash = h), `#/${r}`); await page.waitForTimeout(300)
      ok(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), `plataforma: página ${r} cabe no celular`)
    }
    ok(errors.length === 0, `plataforma: nenhum erro de JavaScript${errors.length ? ' → ' + errors.join(' | ') : ''}`)
    await page.close()
  }
} finally {
  await browser.close()
  server.kill()
}
console.log(fails ? `\n${fails} falha(s)` : '\ntudo certo')
process.exit(fails ? 1 : 0)
