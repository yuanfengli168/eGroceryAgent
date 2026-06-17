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

  // Test 1: mtop.H5Request with full search params
  const result1 = await page.evaluate(async () => {
    const w = window as any;
    const mtop = w.lib?.mtop;
    if (!mtop) return { error: "no mtop" };

    return await Promise.race([
      new Promise((resolve) => {
        mtop.H5Request(
          {
            api: "mtop.lazada.gsearch.appsearch",
            v: "1.0",
            appKey: "24677475",
            type: "jsonp",
            dataType: "jsonp",
            isSec: 1,
            AntiCreep: true,
            timeout: 15000,
            sessionOption: "AutoLoginOnly",
            data: {
              q: "milk",
              page: 1,
              tab: "SEARCH_TAB_DEFAULT",
            },
          },
          (response: any) => {
            // Try to extract useful data
            const data = response.data || {};
            const ret = response.ret || [];
            resolve({
              ret,
              hasData: !!data,
              dataKeys: Object.keys(data),
              resultCount: data.result?.length || 0,
              firstResult: data.result?.[0] ? Object.keys(data.result[0]) : null,
              // Get first few product names if available
              firstNames: data.result?.slice(0, 3).map((r: any) => r.title || r.name) || [],
            });
          },
          (error: any) => {
            resolve({ error: JSON.stringify(error).substring(0, 1000) });
          }
        );
      }),
      new Promise((resolve) => setTimeout(() => resolve({ timeout: true }), 18000)),
    ]);
  });
  console.log("mtop.H5Request result:");
  console.log(JSON.stringify(result1, null, 2).substring(0, 2000));

  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
