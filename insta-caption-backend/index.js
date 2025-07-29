const extractInstagramData = async (url) => {
  let browser;

  try {
    browser = await chromium.puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath,
      headless: chromium.headless,
    });

    const page = await browser.newPage();

    // ✅ Fake a real browser
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36"
    );

    // ✅ Set preferred language and disable login wall
    await page.setExtraHTTPHeaders({
      "Accept-Language": "en-US,en;q=0.9",
    });

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    // ✅ Wait for og:image or og:description to be present
    await page.waitForSelector("meta[property='og:image']", { timeout: 10000 });

    const result = await page.evaluate(() => {
      let caption = null;
      let image = null;

      const ldJson = document.querySelector('script[type="application/ld+json"]');
      if (ldJson) {
        try {
          const metadata = JSON.parse(ldJson.innerText);
          caption = metadata.caption || metadata.articleBody || null;
          image = metadata.image || null;
        } catch (_) {}
      }

      if (!caption) {
        const captionElem = document.querySelector("meta[property='og:description']");
        if (captionElem) caption = captionElem.content;
      }

      if (!image) {
        const imgElem = document.querySelector("meta[property='og:image']");
        if (imgElem) image = imgElem.content;
      }

      return { caption, image };
    });

    return result;
  } catch (err) {
    console.error("❌ Puppeteer error:", err.message);
    throw new Error("Failed to extract Instagram content.");
  } finally {
    if (browser) await browser.close();
  }
};