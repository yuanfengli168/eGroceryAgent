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

  // Track the tmd punish page
  const tmdPages: string[] = [];
  page.on("response", async (resp) => {
    const url = resp.url();
    if (url.includes("_____tmd_____")) {
      try {
        const text = await resp.text();
        tmdPages.push(`${resp.status()} ${url.substring(0, 200)}\n${text.substring(0, 800)}`);
      } catch {}
    }
  });

  try {
    await page.goto("https://redmart.lazada.sg/search/?q=milk", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(5000);

    // Click the real search box and type
    const searchInput = page.locator('input.search-box__input--O34g, input[role="searchbox"], .search-box__input--O34g').first();
    if (await searchInput.count() === 0) {
      // Try the ant-select input
      const altInput = page.locator('input#rc_select_0').first();
      console.log("Using rc_select_0 input");
      await altInput.click();
      await page.waitForTimeout(500);
      await page.keyboard.type("milk", { delay: 200 });
    } else {
      console.log("Using search-box__input--O34g");
      await searchInput.click();
      await page.waitForTimeout(500);
      await page.keyboard.type("milk", { delay: 200 });
    }
    
    await page.waitForTimeout(5000);

    console.log(`\n=== TMD Punish pages (${tmdPages.length}) ===`);
    for (const t of tmdPages.slice(0, 3)) {
      console.log(t);
      console.log("---");
    }
  } finally {
    await browser.close();
  }
}
main().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
