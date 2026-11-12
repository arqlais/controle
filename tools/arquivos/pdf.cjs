const { chromium } = require('playwright')
const fs = require('fs'), path = require('path')
const [htmlDir, outDir, prevDir] = process.argv.slice(2)
;(async () => {
  const b = await chromium.launch()
  const p = await b.newPage()
  fs.mkdirSync(prevDir, { recursive: true })
  for (const f of fs.readdirSync(htmlDir).filter((x) => x.endsWith('.html'))) {
    await p.goto('file://' + path.join(htmlDir, f))
    await p.evaluate(() => document.fonts.ready)
    const id = f.replace('.html', '')
    await p.pdf({ path: path.join(outDir, id + '.pdf'), format: 'A4', printBackground: true, preferCSSPageSize: true })
    console.log('pdf', id)
  }
  await b.close()
})()
