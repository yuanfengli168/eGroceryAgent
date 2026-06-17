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

  // Capture all network requests
  const allRequests: any[] = [];
  page.on("request", (req) => {
    const url = req.url();
    if (url.includes("acs-m.lazada") || url.includes("mtop")) {
      allRequests.push({ when: Date.now(), url: url.substring(0, 250), method: req.method() });
    }
  });
  page.on("response", async (resp) => {
    const url = resp.url();
    if (url.includes("acs-m.lazada") || url.includes("mtop")) {
      try {
        const text = await resp.text();
        const last = allRequests[allRequests.length - 1];
        if (last && last.url === url.substring(0, 250)) {
          last.responseBody = text.substring(0, 500);
          last.status = resp.status();
        }
      } catch {}
    }
  });

  try {
    await page.goto("https://redmart.lazada.sg/search/?q=milk", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(8000);
    console.log(`Initial load: ${allRequests.length} mtop calls`);

    // Reset tracker
    allRequests.length = 0;

    // Now make our call
    await page.evaluate(async () => {
      const w = window as any;
      const mtop = w.lib?.mtop;
      if (!mtop) return;
      return new Promise((resolve) => {
        const to = setTimeout(() => resolve("timedout"), 12000);
        mtop.request(
          {
            api: "mtop.lazada.gsearch.appsearch",
            v: "1.0",
            H5Request: true,
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
            clearTimeout(to);
            (window as any).__result = { ok: true, ret: response.ret, hasData: !!response.data };
            resolve("done");
          },
          (error: any) => {
            clearTimeout(to);
            (window as any).__result = { error: error.ret || error };
            resolve("error");
          }
        );
      });
    });
    await page.waitForTimeout(3000);

    console.log(`\nAfter our call: ${allRequests.length} mtop requests`);
    for (const r of allRequests) {
      console.log(`\n${r.status || '?'} ${r.method} ${r.url.substring(0, 200)}`);
      if (r.responseBody) console.log("  body:", r.responseBody.substring(0, 300));
    }

    const result = await page.evaluate(() => (window as any).__result);
    console.log("\nResult:", JSON.stringify(result, null, 2).substring(0, 1500));
  } finally {
    await browser.close();
  }
}
main().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
