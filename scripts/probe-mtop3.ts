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

  // Try calling lib.mtop
  const result = await page.evaluate(async () => {
    const w = window as any;
    const mtop = w.lib?.mtop;
    if (!mtop) return { error: "no mtop" };

    // Inspect what methods are available
    const methods = Object.keys(mtop).filter(k => typeof mtop[k] === 'function').slice(0, 20);

    // Try a simple timestamp call
    try {
      const r = await mtop.request({
        api: "mtop.common.getTimestamp",
        v: "1.0",
        type: "jsonp",
        dataType: "jsonp",
        timeout: 10000,
      });
      return {
        methods,
        result: r,
      };
    } catch (e: any) {
      return { error: e.message || String(e), methods };
    }
  });
  console.log(JSON.stringify(result, null, 2));

  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
