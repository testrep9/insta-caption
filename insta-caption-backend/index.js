const express = require("express");
const chromium = require("chrome-aws-lambda");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

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
    await page.setDefaultNavigationTimeout(30000);
    await page.goto(url, { waitUntil: "networkidle2", timeout: 20000 });

    const result = await page.evaluate(() => {
      let caption = null;
      let image = null;

      const ldJson = document.querySelector('script[type="application/ld+json"]');
      if (ldJson) {
        try {
          const metadata = JSON.parse(ldJson.innerText);
          caption = metadata.caption || metadata.articleBody || null;
          image = metadata.image || null;
        } catch (e) {}
      }

      if (!caption) {
        const captionElem = document.querySelector("meta[property='og:description']");
        if (captionElem) {
          caption = captionElem.getAttribute("content");
        }
      }

      if (!image) {
        const imgElem = document.querySelector("meta[property='og:image']");
        if (imgElem) {
          image = imgElem.getAttribute("content");
        }
      }

      return { caption, image };
    });

    return result;
  } catch (err) {
    console.error("⚠️ Puppeteer error:", err.message);
    throw new Error("Failed to extract Instagram content.");
  } finally {
    if (browser) await browser.close();
  }
};

// ✅ Final & clean GET /api/extract endpoint
app.get("/api/extract", async (req, res) => {
  const postUrl = req.query.url;
  const validPath = /instagram\.com\/(p|reel|tv)\/[a-zA-Z0-9_-]+/i;

  if (!postUrl || !validPath.test(postUrl)) {
    return res.status(400).json({
      error: "Invalid Instagram media URL. Must be a post, reel, or IGTV link.",
    });
  }

  try {
    const result = await extractInstagramData(postUrl);

    if (!result.caption && !result.image) {
      return res.status(500).json({
        error: "Could not extract content from post or reel.",
      });
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Start server
app.listen(PORT, () => {
  console.log("✅ Instagram Caption Extractor API is live!");
  console.log(`🌐 Listening on http://localhost:${PORT}`);
});
