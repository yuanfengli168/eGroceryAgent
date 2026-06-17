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

  // Try with a 10s timeout in the page
  const result = await page.evaluate(async () => {
    const w = window as any;
    const mtop = w.lib?.mtop;
    if (!mtop) return { error: "no mtop" };

    // Use Promise.race with a timeout
    return await Promise.race([
      new Promise((resolve) => {
        mtop.request(
          {
            api: "mtop.lazada.gsearch.appsearch",
            v: "1.0",
            appKey: "24677475",
            type: "jsonp",
            dataType: "jsonp",
            isSec: 1,
            AntiCreep: true,
            timeout: 10000,
            sessionOption: "AutoLoginOnly",
            data: { q: "milk", page: 1 },
          },
          (response: any) => {
            resolve({ ok: true, ret: response.ret, hasData: !!response.data });
          },
          (error: any) => {
            resolve({ ok: false, error: JSON.stringify(error).substring(0, 500) });
          }
        );
      }),
      new Promise((resolve) => setTimeout(() => resolve({ timeout: true }), 12000)),
    ]);
  });
  console.log("Result:", JSON.stringify(result, null, 2).substring(0, 1500));

  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
