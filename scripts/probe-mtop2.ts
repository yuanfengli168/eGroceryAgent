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

  // Inspect the lzd mtop namespace
  const inspect = await page.evaluate(() => {
    const w = window as any;
    return {
      __lzdlib_mtop__keys: w.__lzdlib_mtop__ ? Object.keys(w.__lzdlib_mtop__).slice(0, 30) : null,
      __lzdlib_mtop__type: typeof w.__lzdlib_mtop__,
      lib_keys: w.lib ? Object.keys(w.lib).slice(0, 30) : null,
      lib_type: typeof w.lib,
      isMtopMiddlewareReady: w.isMtopMiddlewareReady,
    };
  });
  console.log("Inspect:", JSON.stringify(inspect, null, 2));

  // Try to find the mtop instance
  const findMtop = await page.evaluate(() => {
    const w = window as any;
    const candidates: Array<{ name: string; type: string; keys?: string[] }> = [];

    // Check __lzdlib_mtop__ deeply
    if (w.__lzdlib_mtop__) {
      const obj = w.__lzdlib_mtop__;
      for (const k of Object.keys(obj)) {
        const v = obj[k];
        if (v && typeof v === 'object' && typeof v.request === 'function') {
          candidates.push({ name: '__lzdlib_mtop__.' + k, type: 'has request', keys: Object.keys(v).slice(0, 10) });
        } else if (v && typeof v === 'object') {
          candidates.push({ name: '__lzdlib_mtop__.' + k, type: typeof v, keys: Object.keys(v).slice(0, 5) });
        }
      }
    }

    return candidates;
  });
  console.log("\nCandidates:", JSON.stringify(findMtop, null, 2));

  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
