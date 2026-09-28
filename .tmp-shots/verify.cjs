const { chromium } = require('C:/Users/nuke/Documents/bulk product/node_modules/playwright');

const exe = 'C:/Users/nuke/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe';
const URL = 'http://127.0.0.1:3100/shop/the-arewa-set';

(async () => {
  const browser = await chromium.launch({ executablePath: exe, headless: true });
  for (const [name, vp] of [
    ['mobile', { width: 390, height: 844 }],
    ['desktop', { width: 1440, height: 900 }],
  ]) {
    const page = await browser.newPage({ viewport: vp });
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('text=ADD TO BAG', { timeout: 60000 });
    await page.waitForTimeout(1500);

    const data = await page.evaluate(() => {
      const out = {};
      const find = (txt) =>
        [...document.querySelectorAll('p, span, label, button, a, div')].find(
          (el) => el.childElementCount === 0 && el.textContent.trim() === txt
        );
      const box = (el) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height) };
      };
      const style = (el, props) => {
        if (!el) return null;
        const cs = getComputedStyle(el);
        return Object.fromEntries(props.map((p) => [p, cs[p]]));
      };

      out.metaRow = { text: (find('Select a size') || {}).textContent, box: box(find('Select a size')), style: style(find('Select a size'), ['textTransform', 'fontSize', 'color']) };
      out.sizeGuide = { box: box(find('Size guide')), style: style(find('Size guide'), ['textTransform', 'fontSize']) };
      const toggle = [...document.querySelectorAll('[role="radiogroup"]')].find((g) =>
        g.getAttribute('aria-label') === 'Size options'
      );
      out.toggle = box(toggle);
      const chips = [...document.querySelectorAll('[role="radiogroup"]')].find((g) =>
        ['Size', 'Closest size — pattern reference'].includes(g.getAttribute('aria-label'))
      );
      out.chips = box(chips);
      const label = find('TAILORING NOTES (OPTIONAL)');
      out.notesLabel = { box: box(label), lines: label ? Math.round(label.getBoundingClientRect().height / parseFloat(getComputedStyle(label).lineHeight)) : null };
      const ta = document.querySelector('#order-notes');
      out.textarea = {
        placeholder: ta ? ta.getAttribute('placeholder') : null,
        box: box(ta),
        rows: ta ? ta.rows : null,
      };
      const addBtn = [...document.querySelectorAll('button')].find((b) =>
        b.textContent.trim().includes('ADD TO BAG')
      );
      out.addBtn = box(addBtn);
      // gap arithmetic (page coords need absolute: add scrollY)
      const sy = window.scrollY;
      const abs = (b) => (b ? { top: b.top + sy, bottom: b.bottom + sy } : null);
      const a = {
        toggle: abs(out.toggle),
        meta: abs(out.metaRow.box),
        chips: abs(out.chips),
        label: abs(out.notesLabel.box),
        ta: abs(out.textarea.box),
        btn: abs(out.addBtn),
      };
      out.gaps = {
        toggleToMeta: a.toggle && a.meta ? a.meta.top - a.toggle.bottom : null,
        metaToChips: a.meta && a.chips ? a.chips.top - a.meta.bottom : null,
        labelToTextarea: a.label && a.ta ? a.ta.top - a.label.bottom : null,
        textareaToButton: a.ta && a.btn ? a.btn.top - a.ta.bottom : null,
      };
      return out;
    });
    console.log(`\n===== ${name} (${vp.width}px) =====`);
    console.log(JSON.stringify(data, null, 1));
    await page.close();
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
