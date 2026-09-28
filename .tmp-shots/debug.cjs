const { chromium } = require('C:/Users/nuke/Documents/bulk product/node_modules/playwright');

const exe = 'C:/Users/nuke/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe';
const URL = 'http://127.0.0.1:3100/shop/the-arewa-set';

(async () => {
  const browser = await chromium.launch({ executablePath: exe, headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('console', (m) => console.log('[console]', m.type(), m.text().slice(0, 200)));
  page.on('requestfailed', (r) => console.log('[reqfail]', r.url().slice(0, 120), r.failure()?.errorText));
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  try {
    await page.waitForSelector('text=Add to bag', { timeout: 45000 });
    console.log('FOUND Add to bag');
  } catch {
    console.log('NOT FOUND Add to bag — body snippet:');
    console.log((await page.textContent('body'))?.slice(0, 500));
  }
  await page.screenshot({ path: 'C:/Users/nuke/Documents/stylessence/.tmp-shots/debug-mobile.png', fullPage: true });
  console.log('title:', await page.title());
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
