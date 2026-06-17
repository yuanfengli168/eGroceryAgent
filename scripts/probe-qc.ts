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

  // First, check if QC is in scope
  const qcInfo = await page.evaluate(() => {
    const w = window as any;
    return {
      hasQC: typeof w.QC,
      // Check if it's in any module scope
      mtopRequest: typeof w.lib?.mtop?.request,
      mtopConfig: w.lib?.mtop?.config ? Object.keys(w.lib.mtop.config) : null,
    };
  });
  console.log("QC info:", JSON.stringify(qcInfo, null, 2));

  // Try calling QC from within the page context using the bundle's scope
  // We need to access QC - it's in the IIFE scope of desktop.js
  // Try via the React component
  const result = await page.evaluate(async () => {
    const w = window as any;
    // Try mtop.request directly with the right shape
    const mtop = w.lib?.mtop;
    if (!mtop) return { error: "no mtop" };

    // Use the same call shape the bundle uses
    return new Promise((resolve) => {
      mtop.request(
        {
          api: "mtop.lazada.gsearch.appsearch",
          v: "1.0",
          ecode: 0,
          type: "GET",
          isSec: 1,
          AntiCreep: true,
          timeout: 20000,
          needLogin: false,
          appKey: "24677475",  // SG desktop
          dataType: "jsonp",  // try jsonp instead of json
          sessionOption: "AutoLoginOnly",
          data: {
            q: "milk",
            page: 1,
            tab: "SEARCH_TAB_DEFAULT",
          },
        },
        (response: any) => {
          resolve({ ok: true, response });
        },
        (error: any) => {
          resolve({ ok: false, error });
        }
      );
    });
  });
  console.log("\nDirect mtop.request result:");
  console.log(JSON.stringify(result, null, 2).substring(0, 2000));

  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
