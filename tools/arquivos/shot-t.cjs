const { chromium } = require('playwright'); const fs = require('fs'), path = require('path')
;(async () => {
  const [dir, out] = process.argv.slice(2); fs.mkdirSync(out, { recursive: true })
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1200, height: 900 } })
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.html'))) {
    await p.goto('file://' + path.join(dir, f)); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(120)
    await p.screenshot({ path: path.join(out, f.replace('.html', '.png')), omitBackground: true })
  }
  await b.close()
})()
