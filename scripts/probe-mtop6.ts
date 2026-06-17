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

  // Patch mtop.request to log all calls
  await page.addInitScript(() => {
    const origLog = console.log;
    (window as any).__mtopCalls = [];
    Object.defineProperty(window, 'lib', {
      configurable: true,
      set(v) {
        if (v && v.mtop && !v.mtop.__patched) {
          const origRequest = v.mtop.request.bind(v.mtop);
          v.mtop.request = function(opts: any, ...args: any[]) {
            (window as any).__mtopCalls.push({ when: Date.now(), opts: JSON.parse(JSON.stringify(opts)) });
            return origRequest(opts, ...args);
          };
          v.mtop.__patched = true;
        }
        Object.defineProperty(window, 'lib', { value: v, writable: true, configurable: true });
      },
      get() { return undefined; }
    });
  });

  await page.goto("https://redmart.lazada.sg/search/?q=milk", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(8000);

  const calls = await page.evaluate(() => (window as any).__mtopCalls);
  console.log(`Captured ${calls?.length || 0} mtop calls`);
  if (calls && calls.length > 0) {
    console.log("\nFirst 3 mtop calls (full format):");
    for (const call of calls.slice(0, 3)) {
      console.log(JSON.stringify(call, null, 2));
    }
  }

  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
