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

  // Track ALL JS files loaded, especially dynamic chunks
  const jsFiles: any[] = [];
  page.on("request", (req) => {
    const url = req.url();
    if (url.endsWith(".js") || url.includes(".js?")) {
      jsFiles.push({ when: Date.now(), url });
    }
  });

  // Track mtop API calls
  const mtopCalls: any[] = [];
  page.on("request", (req) => {
    const url = req.url();
    if (url.includes("acs-m.lazada.sg") || url.includes("mtop")) {
      mtopCalls.push({ when: Date.now(), url: url.substring(0, 200) });
    }
  });
  page.on("response", async (resp) => {
    const url = resp.url();
    if (url.includes("acs-m.lazada.sg") || url.includes("mtop")) {
      try {
        const text = await resp.text();
        const last = mtopCalls[mtopCalls.length - 1];
        if (last && last.url === url.substring(0, 200)) {
          last.responseBody = text.substring(0, 2000);
          last.status = resp.status();
        }
      } catch {}
    }
  });

  try {
    await page.goto("https://redmart.lazada.sg/search/?q=milk", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(5000);
    const jsAfterLoad = jsFiles.length;
    const mtopAfterLoad = mtopCalls.length;
    console.log(`After initial load: ${jsAfterLoad} JS files, ${mtopAfterLoad} mtop calls`);

    // Now try to find and focus the search box
    const searchBoxInfo = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input'));
      return inputs.map((el, i) => ({
        i,
        type: el.type,
        placeholder: el.placeholder,
        name: el.name,
        id: el.id,
        className: typeof el.className === 'string' ? el.className.substring(0, 100) : '',
        visible: (el as HTMLElement).offsetParent !== null,
        ariaLabel: el.getAttribute('aria-label'),
      }));
    });
    console.log("\nInput boxes:");
    for (const box of searchBoxInfo) {
      console.log(JSON.stringify(box));
    }

    // Try to find search-related elements
    const searchEls = await page.evaluate(() => {
      const results: any[] = [];
      document.querySelectorAll('[class*="search" i], [class*="Search"], [data-search], [id*="search" i]').forEach((el) => {
        const tag = el.tagName.toLowerCase();
        const cls = typeof el.className === 'string' ? el.className.substring(0, 100) : '';
        if (tag === 'input' || tag === 'button' || tag === 'a') {
          results.push({ tag, cls, text: (el.textContent || '').substring(0, 50) });
        }
      });
      return results.slice(0, 10);
    });
    console.log("\nSearch-related elements:");
    for (const el of searchEls) {
      console.log(JSON.stringify(el));
    }

    // Try to interact: focus the first visible text input and type
    console.log("\n--- Typing 'milk' in search box ---");
    const visibleInput = searchBoxInfo.findIndex(b => b.visible && (b.type === 'text' || b.type === 'search' || b.placeholder.toLowerCase().includes('search')));
    console.log(`Using input index: ${visibleInput}`);
    
    if (visibleInput >= 0) {
      const sel = `(document.querySelectorAll('input')[${visibleInput}])`;
      await page.evaluate(`${sel}.focus()`);
      await page.keyboard.type("milk", { delay: 100 });
      await page.waitForTimeout(3000);
      console.log(`After typing: ${jsFiles.length - jsAfterLoad} new JS files, ${mtopCalls.length - mtopAfterLoad} new mtop calls`);
      
      // Print new JS files
      for (const j of jsFiles.slice(jsAfterLoad)) {
        console.log("  JS:", j.url);
      }

      // Press Enter
      console.log("\n--- Pressing Enter ---");
      await page.keyboard.press("Enter");
      await page.waitForTimeout(5000);
      console.log(`After Enter: ${jsFiles.length - jsAfterLoad} new JS files, ${mtopCalls.length - mtopAfterLoad} new mtop calls`);
      
      for (const j of jsFiles.slice(jsAfterLoad)) {
        console.log("  JS:", j.url);
      }

      console.log("\n=== mtop calls summary ===");
      const searchCalls = mtopCalls.filter(c => c.url.includes('gsearch') || c.url.includes('search') || c.url.includes('tmd'));
      for (const c of searchCalls) {
        console.log(`${c.status} ${c.url.substring(0, 150)}`);
        if (c.responseBody) console.log(`  body: ${c.responseBody.substring(0, 400)}`);
      }
    }
  } finally {
    await browser.close();
  }
}
main().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
