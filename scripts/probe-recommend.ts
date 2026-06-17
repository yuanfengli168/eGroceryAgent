import { chromium } from "playwright-extra";
import stealth from "puppeteer-extra-plugin-stealth";
import { writeFileSync } from "node:fs";

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
  let recommendResponse = "";
  page.on("response", async (resp) => {
    const url = resp.url();
    if (url.includes("LazadaRecommend.recommend") || url.includes("lazadarecommend.recommend")) {
      try {
        const body = await resp.text();
        recommendResponse = body;
      } catch {}
    }
  });
  await page.goto("https://redmart.lazada.sg/search/?q=milk", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(8000);
  writeFileSync("/tmp/redmart_recommend.txt", recommendResponse);
  console.log("Saved", recommendResponse.length, "bytes to /tmp/redmart_recommend.txt");
  await browser.close();
}
main().catch(console.error);
