const express = require("express");
const puppeteer = require("puppeteer"); // Or chrome-aws-lambda if deployed
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get("/api/extract", async (req, res) => {
  const postUrl = req.query.url;

  if (!postUrl || !postUrl.includes("instagram.com/")) {
    return res.status(400).json({ error: "Invalid Instagram URL." });
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    const page = await browser.newPage();
    await page.goto(postUrl, { waitUntil: "networkidle2", timeout: 20000 });

    const result = await page.evaluate(() => {
      let caption = null;
      let image = null;

      // Try ld+json metadata
      const ldJson = document.querySelector('script[type="application/ld+json"]');
      if (ldJson) {
        try {
          const metadata = JSON.parse(ldJson.innerText);
          caption = metadata.caption || metadata.articleBody || null;
          image = metadata.image || null;
        } catch (e) {
          // Fall through
        }
      }

      // Fallback: Reels & posts
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

    if (!result.caption && !result.image) {
      return res.status(500).json({ error: "Could not extract content from post or reel." });
    }

    res.json(result);
  } catch (err) {
    console.error("Error extracting:", err.message);
    res.status(500).json({ error: "Puppeteer failed to extract Instagram content." });
  } finally {
    if (browser) await browser.close();
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
