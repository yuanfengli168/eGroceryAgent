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
  try {
    await page.goto("https://redmart.lazada.sg/search/?q=milk", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(8000);

    // Just check what mtop.request returns
    const result = await page.evaluate(async () => {
      const w = window as any;
      const mtop = w.lib?.mtop;
      if (!mtop) return { error: "no mtop" };

      console.log("Available methods:", Object.keys(mtop).filter((k: string) => typeof mtop[k] === 'function'));

      // Try mtop.request with the H5Request flag set
      return await new Promise((resolve) => {
        const timeout = setTimeout(() => resolve({ timeout: true }), 15000);
        mtop.request(
          {
            api: "mtop.lazada.gsearch.appsearch",
            v: "1.0",
            H5Request: true,  // <-- THIS IS THE KEY
            appKey: "24677475",
            type: "GET",
            dataType: "jsonp",
            isSec: 1,
            AntiCreep: true,
            timeout: 10000,
            sessionOption: "AutoLoginOnly",
            data: { q: "milk", page: 1 },
          },
          (response: any) => {
            clearTimeout(timeout);
            resolve({ ok: true, ret: response.ret, hasData: !!response.data });
          },
          (error: any) => {
            clearTimeout(timeout);
            resolve({ error: error.ret || error, retJson: error.retJson });
          }
        );
      });
    });
    console.log("Result:", JSON.stringify(result, null, 2).substring(0, 1500));
  } finally {
    await browser.close();
  }
}
main().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
