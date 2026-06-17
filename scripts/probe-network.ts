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

  // Capture ALL JS bundle requests after the initial load
  const jsBundles: string[] = [];
  page.on("request", (req) => {
    const url = req.url();
    if (url.endsWith(".js") || url.includes(".js?")) {
      jsBundles.push(url);
    }
  });

  // First, just load the search page and wait
  await page.goto("https://redmart.lazada.sg/search/?q=milk", { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(3000);

  console.log(`Total JS bundles loaded: ${jsBundles.length}`);
  // Look for the search result handler
  const searchRelated = jsBundles.filter(u =>
    u.includes("search") ||
    u.includes("result") ||
    u.includes("gsearch") ||
    u.includes("OneSearch") ||
    u.includes("srp")
  );
  console.log(`Search-related bundles: ${searchRelated.length}`);
  for (const u of searchRelated.slice(0, 10)) {
    console.log("  ", u);
  }

  // Look for chunks loaded on demand
  console.log("\nNon-bundled (webpack chunk) URLs:");
  const chunks = jsBundles.filter(u => /\/\d+\.[a-f0-9]+\.js$/.test(u));
  console.log(`  Found ${chunks.length} webpack chunks`);
  for (const c of chunks.slice(0, 10)) {
    console.log("  ", c);
  }

  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
