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
    await page.locator('.q-more-btn', { hasText: 'arquivo final' }).click(); await page.waitForTimeout(100)
    await page.getByRole('button', { name: 'aberto (editável)', exact: false }).last().click(); await page.waitForTimeout(150)
    const filesText = await page.locator('.field', { hasText: 'formatos de arquivos entregues' }).locator('textarea').inputValue()
    ok((await priceOf()) > closedPrice && /aberto/.test(filesText), `${vp.name}: arquivo aberto soma a taxa e muda a entrega`)
    await page.getByRole('button', { name: 'fechado (PDF)' }).click(); await page.waitForTimeout(150)
    // pavimentos: cada um a mais encarece
    const onePrice = await priceOf()
    await page.getByRole('button', { name: 'Mais um pavimento' }).click(); await page.waitForTimeout(150)
    ok((await priceOf()) > onePrice, `${vp.name}: 2 pavimentos encarecem o executivo`)
    await page.getByRole('button', { name: 'Menos um pavimento' }).click(); await page.waitForTimeout(150)
    await page.locator('.q-item').nth(1).locator('.q-more-btn').click(); await page.waitForTimeout(100)
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
    ok(await page.locator('.docs-card-icon').count() === 3 && await page.locator('.docs-card:not(.docs-card-icon)').count() === 4, `${vp.name}: documentos (proposta, recibo, contrato + guia, placa, briefing, apresentação)`)
    await page.locator('.docs-card:not(.docs-card-icon)').nth(1).click(); await page.waitForTimeout(500)
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
  // 4b. contrato: link de assinatura → cliente assina no celular → confirmação colada vale
  {
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } })
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto(`http://localhost:${PORT}/#/contratos`); await page.waitForTimeout(900)
    await page.locator('text=Contrato — Renders').first().click(); await page.waitForTimeout(700)
    await page.getByRole('button', { name: /criar link de assinatura/ }).click(); await page.waitForTimeout(1000)
    const link = await page.locator('.sg-link input').inputValue()
    ok(link.includes('#/assinar/'), 'contrato: cria o link de assinatura')
    const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ['geolocation'], geolocation: { latitude: -19.92, longitude: -43.94 } })
    const m = await mctx.newPage()
    m.on('pageerror', (e) => errors.push(e.message))
    await m.goto(link.replace(/^https?:\/\/[^/]+\//, `http://localhost:${PORT}/`)); await m.waitForTimeout(1200)
    ok(await m.locator('.cs-doc .contract-page').count() > 0, 'contrato: cliente abre o contrato pelo link')
    await m.getByPlaceholder('como no documento').fill('Beatriz Souza Lima'); await m.getByPlaceholder('só os números').fill('12345678909')
    await m.getByPlaceholder('para constar no registro da assinatura').fill('beatriz@exemplo.com')
    // assinatura desenhada com o "dedo"
    await m.locator('.sp-area').scrollIntoViewIfNeeded()
    const pad = await m.locator('.sp-area').boundingBox()
    await m.mouse.move(pad.x + 40, pad.y + pad.height * 0.6); await m.mouse.down()
    for (let k = 1; k <= 12; k++) await m.mouse.move(pad.x + 40 + k * 20, pad.y + pad.height * (0.6 + 0.2 * Math.sin(k)), { steps: 2 })
    await m.mouse.up(); await m.waitForTimeout(200)
    await m.locator('.cs-agree input').last().check(); await m.getByRole('button', { name: 'assinar contrato' }).click(); await m.waitForTimeout(800)
    ok(await m.locator('.cs-done .sg-glyph').count() === 1, 'contrato: assinatura desenhada com o dedo')
    const wa = await m.locator('.cs-done a.bf-send').getAttribute('href')
    const msg = decodeURIComponent(new URL(wa).searchParams.get('text'))
    ok(/código da assinatura: z/.test(msg), 'contrato: assinatura gera a confirmação para o WhatsApp')
    await page.locator('.sg-paste textarea').fill(msg); await page.getByRole('button', { name: 'registrar assinatura' }).click(); await page.waitForTimeout(500)
    ok(((await page.locator('.sg-done b').textContent()) ?? '').includes('Beatriz Souza Lima'), 'contrato: confirmação colada registra a assinatura')
    ok(await page.locator('.c-signed').count() > 0 && await page.locator('.c-sign .sg-glyph, .lc-sign-box .sg-glyph').count() > 0, 'contrato: assinatura desenhada aparece no PDF')
    ok(await page.locator('.c-cert').count() > 0, 'contrato: PDF ganha o certificado de assinatura')
    ok(errors.length === 0, `contrato: nenhum erro de JavaScript${errors.length ? ' → ' + errors.join(' | ') : ''}`)
    await m.close(); await page.close()
  }
  // 4b2. anexar o próprio contrato (Word) vira modelo editável, com sugestões de etiquetas
  {
    const { default: JSZip } = await import('jszip')
    const P = (t, b) => `<w:p><w:r>${b ? '<w:rPr><w:b/></w:rPr>' : ''}<w:t xml:space="preserve">${t}</w:t></w:r></w:p>`
    const zip = new JSZip()
    zip.file('word/document.xml', `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${[P('Contrato de Arquitetura', true), P('Contratante: Maria da Silva, CPF 123.456.789-09.'), P('Cláusula 1 – Do valor', true), P('O valor é de R$ 12.500,00.'), P('__________________'), P('CONTRATANTE')].join('')}</w:body></w:document>`)
    const buffer = await zip.generateAsync({ type: 'nodebuffer' })
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } })
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto(`http://localhost:${PORT}/#/contratos`); await page.waitForTimeout(900)
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: /anexar meu contrato/ }).first().click()])
    await fc.setFiles({ name: 'Meu contrato.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer }); await page.waitForTimeout(1200)
    const text = await page.locator('.ct-templates .rt-page').innerText()
    ok(/^Contrato de Arquitetura/.test(text) && text.includes('Cláusula 1') && !/CONTRATANTE\s*$/.test(text) && !text.includes('____') && await page.locator('.ct-templates .rt-page span[style*="font-weight:700"]').count() >= 2, 'contrato: Word anexado vira modelo com o desenho do arquivo (negrito, sem linhas de assinatura)')
    ok(await page.locator('.ct-swap-list li').count() >= 2, 'contrato: sugere trocar CPF e valor por etiquetas')
    await page.locator('.ct-swap-manual input').fill('Maria da Silva'); await page.locator('.ct-swap-manual .btn').click(); await page.waitForTimeout(300)
    ok((await page.locator('.ct-templates .rt-page').innerText()).includes('{contratante}'), 'contrato: troca o nome do cliente pela etiqueta')
    ok(errors.length === 0, `contrato anexado: nenhum erro de JavaScript${errors.length ? ' → ' + errors.join(' | ') : ''}`)
    await page.close()
  }
  // 4b3. anexar o próprio briefing (Word) vira modelo com partes, perguntas e opções
  {
    const { default: JSZip } = await import('jszip')
    const P = (t, b) => `<w:p><w:r>${b ? '<w:rPr><w:b/></w:rPr>' : ''}<w:t xml:space="preserve">${t}</w:t></w:r></w:p>`
    const zip = new JSZip()
    zip.file('word/document.xml', `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${[P('Meu Briefing', true), P('Sobre você', true), P('1. Nome completo:'), P('2. Quais ambientes?'), P('☐ Sala'), P('☐ Cozinha'), P('3. Envie fotos do espaço.')].join('')}</w:body></w:document>`)
    const buffer = await zip.generateAsync({ type: 'nodebuffer' })
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } })
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto(`http://localhost:${PORT}/#/briefings`); await page.waitForTimeout(900)
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: /anexar meu briefing/ }).click()])
    await fc.setFiles({ name: 'Meu briefing.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer }); await page.waitForTimeout(1500)
    const t = await page.evaluate(() => { const k = Object.keys(localStorage).find((x) => x.startsWith('lais3d')); return JSON.parse(localStorage[k]).settings.briefingTemplates.at(-1) })
    ok(t?.name === 'Meu Briefing' && t.sections.length === 1 && t.questions.length === 3, 'briefing: Word anexado vira modelo (partes e perguntas)')
    ok(t?.questions[1]?.kind === 'multi' && t.questions[1].options?.join('/') === 'Sala/Cozinha' && t.questions[2]?.kind === 'photos', 'briefing: opções de marcar e pergunta de fotos reconhecidas')
    ok((await page.evaluate(() => location.hash)).startsWith('#/briefings/meu-'), 'briefing: abre o modelo importado para editar')
    ok(errors.length === 0, `briefing anexado: nenhum erro de JavaScript${errors.length ? ' → ' + errors.join(' | ') : ''}`)
    await page.close()
  }
  // 4c. assinatura chega sozinha + painel do cliente (link, recado e central de avisos)
  {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, permissions: ['geolocation'], geolocation: { latitude: -19.92, longitude: -43.94 } })
    const page = await ctx.newPage()
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto(`http://localhost:${PORT}/#/contratos`); await page.waitForTimeout(900)
    await page.locator('text=Contrato — Renders').first().click(); await page.waitForTimeout(700)
    await page.getByRole('button', { name: /criar link de assinatura/ }).click(); await page.waitForTimeout(1000)
    const link = await page.locator('.sg-link input').inputValue()
    const contractHash = await page.evaluate(() => location.hash)
    const m = await ctx.newPage()
    m.on('pageerror', (e) => errors.push(e.message))
    await m.goto(link.replace(/^https?:\/\/[^/]+\//, `http://localhost:${PORT}/`)); await m.waitForTimeout(1200)
    await m.getByPlaceholder('como no documento').fill('Beatriz Souza Lima'); await m.getByPlaceholder('só os números').fill('12345678909')
    await m.getByPlaceholder('para constar no registro da assinatura').fill('beatriz@exemplo.com')
    await m.locator('.sp-area').scrollIntoViewIfNeeded()
    const pad = await m.locator('.sp-area').boundingBox()
    await m.mouse.move(pad.x + 40, pad.y + pad.height * 0.6); await m.mouse.down()
    for (let k = 1; k <= 8; k++) await m.mouse.move(pad.x + 40 + k * 25, pad.y + pad.height * 0.5, { steps: 2 })
    await m.mouse.up()
    await m.locator('.cs-agree input').last().check(); await m.getByRole('button', { name: 'assinar contrato' }).click(); await m.waitForTimeout(900)
    await m.close()
    await page.bringToFront(); await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await page.waitForTimeout(1200)
    await page.evaluate((h) => (location.hash = h), contractHash); await page.waitForTimeout(600)
    ok(((await page.locator('.sg-done b').textContent().catch(() => '')) ?? '').includes('Beatriz Souza Lima'), 'contrato: assinatura pelo link chega sozinha no sistema')
    ok(await page.locator('.nt-count').count() === 1, 'avisos: assinatura aparece na central de avisos')
    const cid = await page.evaluate(() => { const k = Object.keys(localStorage).find((x) => x.startsWith('lais3d')); const d = JSON.parse(localStorage[k]); return d.contracts.find((c) => c.sign)?.clientId })
    await page.evaluate((id) => (location.hash = `#/clientes/${id}`), cid); await page.waitForTimeout(700)
    await page.getByRole('button', { name: /criar o painel/ }).click(); await page.waitForTimeout(800)
    const plink = await page.locator('.pn-link-row:not(.pn-newlink) input').inputValue()
    ok(plink.includes('#/cliente/'), 'painel: cria o link do painel do cliente')
    await page.locator('.pn-share summary').click()
    const boxes = page.locator('.pn-share input[type=checkbox]:not(:disabled):not(:checked)')
    for (let n = await boxes.count(); n > 0; n--) { await boxes.first().check(); await page.waitForTimeout(80) }
    const pub = await ctx.newPage()
    pub.on('pageerror', (e) => errors.push(e.message))
    await pub.goto(`http://localhost:${PORT}/${plink.slice(plink.indexOf('#'))}`); await pub.waitForTimeout(1500)
    ok(await pub.locator('.cp-journey').count() > 0, 'painel: cliente vê os projetos com etapas')
    ok(await pub.locator('.cp-doc.is-ok').count() > 0, 'painel: cliente vê o contrato assinado')
    await pub.locator('.cp-doc.is-ok .btn').first().click(); await pub.waitForTimeout(800)
    ok(await pub.locator('.pn-viewer .c-signed, .pn-viewer .sg-glyph, .pn-viewer .c-sign-typed').count() > 0, 'painel: contrato assinado abre com a assinatura')
    await pub.keyboard.press('Escape')
    await pub.locator('.pn-talk textarea').fill('Pode me mandar a planta atualizada?')
    await pub.getByRole('button', { name: /mandar recado/ }).click(); await pub.waitForTimeout(500)
    ok(await pub.locator('.pn-sent').count() === 1, 'painel: cliente manda recado')
    await pub.close()
    await page.bringToFront(); await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await page.waitForTimeout(1200)
    await page.locator('.nt-wrap .icon-btn').click(); await page.waitForTimeout(300)
    ok(await page.locator('.nt-list li', { hasText: 'Recado' }).count() === 1, 'avisos: recado do painel aparece na central')
    ok(errors.length === 0, `painel: nenhum erro de JavaScript${errors.length ? ' → ' + errors.join(' | ') : ''}`)
    await ctx.close()
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
    // testando o Essencial: contratos aparecem como prévia, bloqueados
    await page.evaluate(() => (location.hash = '#/assinatura'))
    const tryBtn = page.locator('.pf-plan', { has: page.locator('h3', { hasText: /^Essencial$/ }) }).getByRole('button', { name: /testar este plano/ })
    const found = await tryBtn.waitFor({ timeout: 8000 }).then(() => true, () => false)
    ok(found, `plataforma: tela de assinatura mostra os planos${found ? '' : ` → tela: ${(await page.locator('main').innerText().catch(() => '')).slice(0, 400).replace(/\n/g, ' | ')} · erros: ${errors.join(' | ') || 'nenhum'}`}`)
    await tryBtn.click(); await page.waitForTimeout(200)
    await page.locator('.modal-foot .btn').last().click(); await page.waitForTimeout(500)
    await page.evaluate(() => (location.hash = '#/contratos')); await page.waitForTimeout(300)
    ok(await page.locator('.lk-banner').count() === 1 && await page.locator('.lk-view').count() === 1, 'plataforma: Essencial vê contratos só como prévia bloqueada')
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
