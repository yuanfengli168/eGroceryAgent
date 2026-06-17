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

  // Patch mtop to log what it does
  const result = await page.evaluate(async () => {
    const w = window as any;
    const mtop = w.lib?.mtop;
    if (!mtop) return { error: "no mtop" };

    // Intercept __processRequestMethod
    const origMethod = mtop.CLASS.prototype.__processRequestMethod;
    mtop.CLASS.prototype.__processRequestMethod = function(cb: any) {
      console.log("__processRequestMethod called, params:", JSON.stringify(this.params), "options before:", JSON.stringify(this.options).substring(0, 200));
      const r = origMethod.call(this, cb);
      console.log("__processRequestMethod done, options after:", JSON.stringify(this.options).substring(0, 200));
      return r;
    };

    return await Promise.race([
      new Promise((resolve) => {
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
            resolve({ ok: true, ret: response.ret, resultCount: response.data?.result?.length });
          },
          (error: any) => {
            resolve({ error: JSON.stringify(error).substring(0, 1000) });
          }
        );
      }),
      new Promise((resolve) => setTimeout(() => resolve({ timeout: true }), 18000)),
    ]);
  });
  console.log("Result:", JSON.stringify(result, null, 2).substring(0, 2000));

  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
