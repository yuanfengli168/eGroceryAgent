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
  const initialCalls: any[] = [];
  page.on("request", (req) => {
    const url = req.url();
    if (url.includes("acs-m.lazada") && url.includes("mtop")) {
      initialCalls.push({
        when: Date.now(),
        url: url,
        headers: req.headers(),
        postData: req.postData(),
      });
    }
  });

  try {
    await page.goto("https://redmart.lazada.sg/search/?q=milk", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(5000);

    console.log(`Captured ${initialCalls.length} mtop calls during initial load\n`);
    for (let i = 0; i < Math.min(3, initialCalls.length); i++) {
      const call = initialCalls[i];
      console.log(`=== Call ${i + 1} ===`);
      console.log("URL:", call.url);
      console.log("Headers:", JSON.stringify(call.headers, null, 2).substring(0, 800));
      console.log();
    }

    // Now make our call and see if it differs
    const compareResult = await page.evaluate(() => {
      const w = window as any;
      const mtop = w.lib?.mtop;
      // Get the config that the page uses
      return {
        config: mtop?.config ? Object.keys(mtop.config) : null,
        // Get cookies that the page has
        cookies: document.cookie,
        // Get window.locale
        locale: (window as any).LZD?.locale || 'unknown',
      };
    });
    console.log("Page state:", JSON.stringify(compareResult, null, 2).substring(0, 1000));
  } finally {
    await browser.close();
  }
}
main().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
