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
  await page.waitForTimeout(6000);

  // Try calling lib.mtop with full diagnostics
  const result = await page.evaluate(async () => {
    const w = window as any;
    const mtop = w.lib?.mtop;
    if (!mtop) return { error: "no mtop" };

    // Test getTimestamp which is the simplest API
    const r = await new Promise((resolve) => {
      try {
        mtop.request({
          api: "mtop.common.getTimestamp",
          v: "1.0",
          type: "jsonp",
          dataType: "jsonp",
          timeout: 10000,
        }, (response: any) => {
          resolve({ ok: true, response: JSON.parse(JSON.stringify(response)) });
        });
      } catch (e: any) {
        resolve({ error: e.message || String(e), stack: e.stack });
      }
    });
    return r;
  });
  console.log(JSON.stringify(result, null, 2));

  // Now try the actual search
  const search = await page.evaluate(async () => {
    const w = window as any;
    const mtop = w.lib?.mtop;
    if (!mtop) return { error: "no mtop" };

    return new Promise((resolve) => {
      try {
        mtop.request({
          api: "mtop.lazada.gsearch.appsearch",
          v: "1.0",
          appKey: "24677475",
          type: "originaljson",
          dataType: "originaljson",
          isSec: 1,
          AntiCreep: true,
          timeout: 20000,
          sessionOption: "AutoLoginOnly",
          data: {
            q: "milk",
            page: 1,
            tab: "SEARCH_TAB_DEFAULT",
            officialCatId: "",
            catId: "",
            spm: "a2o42.home.search.0",
            scenario: "PCSearchPage",
            appId: "9788",
            rn: "5c069d4dca5f20000166e8d1192651f5",
            searchCard:
              '{"serverHitExtraInfo":null,"algorithmInfoV2":"{\\"o\\":\\"1467766\\",\\"m\\":\\"1086770\\"}","bucket":"0","sceneId":"1","style":"search-card-default","trackParams":{"spm":"a2o42.home.search.0","trackingId":"2102fccc17816960111321331eaf5e"}}',
            sproject: '{"main":{"sproject":{"sceneId":"1","sprojectId":"3564"}}}',
            sversion: '{"main":{"sversion":{"trackParams":{"sprintId":"50067","launchVersionId":"1140"}}}}',
          },
        }, (response: any) => {
          resolve({ ok: true, response: JSON.parse(JSON.stringify(response)).substring ? JSON.parse(JSON.stringify(response)) : response });
        });
      } catch (e: any) {
        resolve({ error: e.message || String(e), stack: e.stack });
      }
    });
  });
  console.log("\nSearch result:", JSON.stringify(search, null, 2).substring(0, 3000));

  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
