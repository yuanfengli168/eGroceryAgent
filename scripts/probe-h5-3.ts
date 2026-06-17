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

  // Listen to network for mtop calls
  const mtopCalls: any[] = [];
  page.on("response", async (resp) => {
    if (resp.url().includes("acs-m.lazada.sg")) {
      try {
        const body = await resp.text();
        mtopCalls.push({ url: resp.url().substring(0, 200), body: body.substring(0, 1000) });
      } catch {}
    }
  });

  await page.goto("https://redmart.lazada.sg/search/?q=milk", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(8000);

  // Now make a call
  await page.evaluate(async () => {
    const w = window as any;
    const mtop = w.lib?.mtop;
    return new Promise((resolve) => {
      mtop.H5Request(
        {
          api: "mtop.lazada.gsearch.appsearch",
          v: "1.0",
          appKey: "24677475",
          type: "GET",
          dataType: "jsonp",
          isSec: 1,
          AntiCreep: true,
          timeout: 15000,
          sessionOption: "AutoLoginOnly",
          data: { q: "milk", page: 1 },
        },
        (response: any) => {
          (window as any).__result = { ok: true, ret: response.ret, data: response.data };
          resolve(true);
        },
        (error: any) => {
          (window as any).__result = { error: error };
          resolve(true);
        }
      );
    });
  });
  await page.waitForTimeout(2000);

  const result = await page.evaluate(() => (window as any).__result);
  console.log("Result:", JSON.stringify(result, null, 2).substring(0, 1500));

  console.log(`\n=== mtop calls during our test: ${mtopCalls.length} ===`);
  for (const call of mtopCalls.slice(-5)) {
    console.log(call.url);
    console.log("  body:", call.body.substring(0, 300));
    console.log();
  }

  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
