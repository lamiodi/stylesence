const path = require('path');
const { chromium } = require('C:/Users/nuke/Documents/bulk product/node_modules/playwright');

const exe = 'C:/Users/nuke/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe';
const OUT = 'C:/Users/nuke/Documents/stylessence/.tmp-shots';
const URL = 'http://127.0.0.1:3100/shop/the-arewa-set';

(async () => {
  const browser = await chromium.launch({ executablePath: exe, headless: true });
  for (const [name, vp] of [
    ['mobile', { width: 390, height: 844 }],
    ['desktop', { width: 1440, height: 900 }],
  ]) {
    const page = await browser.newPage({ viewport: vp, deviceScaleFactor: 2 });
    try {
      await page.goto(URL, { waitUntil: 'networkidle', timeout: 45000 });
    } catch {
      /* video stream may keep network busy — fall through */
    }
    await page.waitForTimeout(3000);
    // full page
    await page.screenshot({ path: path.join(OUT, `${name}-full.png`), fullPage: true });

    // crop around the buy column: locate the "Size — Select" eyebrow's section
    const el = await page.$('text=Additional instructions for your order');
    if (el) {
      const box = await el.boundingBox();
      if (box) {
        const pad = vp.width < 700 ? 520 : 420;
        await page.screenshot({
          path: path.join(OUT, `${name}-buybox.png`),
          clip: { x: 0, y: Math.max(0, box.y - pad), width: vp.width, height: Math.min(vp.height * 1.6, pad + 420) },
        });
      }
    }
    await page.close();
  }
  await browser.close();
  console.log('done');
})().catch((e) => { console.error(e); process.exit(1); });
