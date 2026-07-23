// src/fetchNews.js
// Fetches recent headlines from a curated list of Canadian news RSS feeds.
// Every feed is fetched independently and wrapped in a try/catch so a
// single dead/blocked feed never crashes the whole run.
//
// Lesson learned from the Bangladesh News AI Agent: some publisher sites
// block requests coming from cloud/CI servers (GitHub Actions included).
// Google News is kept in the mix as a resilient aggregator fallback in
// case any individual outlet starts returning 403s.

const Parser = require("rss-parser");

const parser = new Parser({
  timeout: 15000,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (compatible; CanadianNewsAgent/1.0; +https://github.com/mahabub2016)",
  },
});

const FEEDS = [
  { name: "CBC News", url: "https://www.cbc.ca/cmlink/rss-topstories" },
  { name: "CTV News", url: "https://www.ctvnews.ca/rss/ctvnews-ca-top-stories-public-rss-1.822009" },
  { name: "Global News", url: "https://globalnews.ca/feed/" },
  { name: "National Post", url: "https://nationalpost.com/feed/" },
  { name: "Google News - Canada", url: "https://news.google.com/rss?hl=en-CA&gl=CA&ceid=CA:en" },
];

async function fetchFeed(feed) {
  try {
    const parsed = await parser.parseURL(feed.url);
    return (parsed.items || []).map((item) => ({
      title: (item.title || "").trim(),
      link: item.link || "",
      pubDate: item.pubDate ? new Date(item.pubDate) : null,
      snippet: (item.contentSnippet || item.content || "").replace(/\s+/g, " ").trim(),
      source: feed.name,
    }));
  } catch (err) {
    console.warn(`[fetchNews] Skipping "${feed.name}" (${feed.url}): ${err.message}`);
    return [];
  }
}

async function fetchAllNews(limit = 40) {
  const results = await Promise.all(FEEDS.map(fetchFeed));
  const allItems = results.flat();

  if (allItems.length === 0) {
    throw new Error(
      "No news items were fetched from any source. All RSS feeds failed or returned empty."
    );
  }

  // Dedupe: different feeds sometimes carry the same wire story with a
  // near-identical title. Normalize and drop repeats, keeping the first seen.
  const seen = new Set();
  const deduped = [];
  for (const item of allItems) {
    if (!item.title) continue;
    const key = item.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }

  deduped.sort((a, b) => (b.pubDate?.getTime() || 0) - (a.pubDate?.getTime() || 0));

  return deduped.slice(0, limit);
}

module.exports = { fetchAllNews, FEEDS };
