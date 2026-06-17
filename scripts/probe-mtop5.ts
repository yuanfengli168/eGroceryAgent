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
  await page.waitForTimeout(8000);

  // Now try a simpler API call to see the correct format
  const result = await page.evaluate(async () => {
    const w = window as any;
    const mtop = w.lib?.mtop;
    if (!mtop) return { error: "no mtop" };

    // Try the timestamp API with the EXACT same params the page uses
    return new Promise((resolve) => {
      try {
        mtop.request({
          api: "mtop.common.getTimestamp",
          v: "1.0",
          appKey: "24814220",
          t: "",
          sign: "",
          type: "jsonp",
          dataType: "jsonp",
          timeout: 20000,
          callback: "mtopjsonp_test",
          data: {},
        }, (response: any) => {
          resolve({ ok: true, response });
        });
      } catch (e: any) {
        resolve({ error: e.message || String(e) });
      }
    });
  });
  console.log("getTimestamp with appKey 24814220:");
  console.log(JSON.stringify(result, null, 2));

  // Now try without appKey (let mtop figure it out)
  const result2 = await page.evaluate(async () => {
    const w = window as any;
    const mtop = w.lib?.mtop;
    return new Promise((resolve) => {
      try {
        mtop.request({
          api: "mtop.common.getTimestamp",
          v: "1.0",
          type: "jsonp",
          dataType: "jsonp",
          timeout: 20000,
        }, (response: any) => {
          resolve({ ok: true, response });
        });
      } catch (e: any) {
        resolve({ error: e.message || String(e) });
      }
    });
  });
  console.log("\ngetTimestamp without appKey:");
  console.log(JSON.stringify(result2, null, 2));

  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
