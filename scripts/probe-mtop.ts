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
  await page.waitForTimeout(5000);

  // Check what globals are available
  const globals = await page.evaluate(() => {
    return {
      hasMtop: typeof (window as any).mtop,
      hasLibMtop: typeof (window as any).LibMtop,
      hasMTOP: typeof (window as any).MTOP,
      hasWindowMtop: typeof (window as any).window?.mtop,
      // List interesting window properties
      props: Object.keys(window).filter(k =>
        k.toLowerCase().includes('mtop') ||
        k.toLowerCase().includes('lazada') ||
        k.toLowerCase().includes('lib')
      ),
    };
  });
  console.log("Globals:", JSON.stringify(globals, null, 2));

  // Try to call mtop directly
  const mtopTest = await page.evaluate(async () => {
    const w = window as any;
    // Try different mtop access patterns
    const mtop = w.mtop || w.MTOP || w.LibMtop || w.LZD?.mtop;
    if (!mtop) return { error: "no mtop global found" };

    // Try a simple call
    try {
      const result = await new Promise((resolve, reject) => {
        const r = mtop.request({
          api: "mtop.common.getTimestamp",
          v: "1.0",
          appKey: "24814220",
          type: "jsonp",
          dataType: "jsonp",
          timeout: 10000,
        });
        if (r && typeof r.then === 'function') {
          r.then(resolve, reject);
        } else if (r && r.callback) {
          // JSONP style
          r.callback('mtp_test', resolve);
        } else {
          resolve(r);
        }
      });
      return { success: true, result: JSON.stringify(result).substring(0, 500) };
    } catch (e) {
      return { error: String(e).substring(0, 500) };
    }
  });
  console.log("\nmtop test:", JSON.stringify(mtopTest, null, 2));

  // Also check: are there any DOM elements with data we can use?
  const dataEls = await page.evaluate(() => {
    return {
      scripts: Array.from(document.querySelectorAll('script[src*="mtop"]')).map(s => (s as HTMLScriptElement).src),
      dataSpm: document.querySelector('[data-spm]')?.getAttribute('data-spm'),
    };
  });
  console.log("\nData elements:", JSON.stringify(dataEls, null, 2));

  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
