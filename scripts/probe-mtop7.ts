import { chromium } from "playwright-extra";
import stealth from "puppeteer-extra-plugin-stealth";

chromium.use(stealth());

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    viewport: { width: 1366, height: 768 },
    locale: "en-SG",
    timezoneId: "Asia/Singapore",
  });
  const page = await ctx.newPage();
  await page.goto("https://redmart.lazada.sg/search/?q=milk", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(6000);

  // Patch the existing mtop
  const calls: any[] = [];
  await page.evaluate(() => {
    const w = window as any;
    if (w.lib?.mtop && !w.lib.mtop.__patched) {
      const origRequest = w.lib.mtop.request.bind(w.lib.mtop);
      w.lib.mtop.request = function(opts: any, ...args: any[]) {
        (window as any).__calls = (window as any).__calls || [];
        (window as any).__calls.push({ when: Date.now(), opts: JSON.parse(JSON.stringify(opts)) });
        return origRequest(opts, ...args);
      };
      w.lib.mtop.__patched = true;
    }
  });

  // Now do an action that triggers more mtop calls
  await page.waitForTimeout(5000);

  const captured = await page.evaluate(() => (window as any).__calls || []);
  console.log(`Captured ${captured.length} mtop calls after patch`);
  for (const call of captured.slice(0, 5)) {
    console.log(JSON.stringify(call, null, 2).substring(0, 800));
    console.log("---");
  }

  // Also check: are there any product cards now?
  const cards = await page.locator('[data-spm="product"]').count();
  console.log(`\nProduct cards: ${cards}`);

  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
