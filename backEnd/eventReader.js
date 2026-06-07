const { extractEventPage } = require("./contentAnalyzer");

function normalizeEventUrl(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    throw new Error("Event URL is required.");
  }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = new URL(withProtocol);

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Only http and https URLs are supported.");
  }

  return url.href;
}

async function fetchEventPage(eventUrl) {
  const normalizedUrl = normalizeEventUrl(eventUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(normalizedUrl, {
      headers: {
        "accept": "text/html,application/xhtml+xml",
        "user-agent": "CustomBrochure/1.0"
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Event page returned ${response.status}.`);
    }

    const contentType = response.headers.get("content-type") || "";
    if (contentType && !contentType.includes("text/html")) {
      throw new Error("Event URL did not return an HTML page.");
    }

    const html = await response.text();
    return extractEventPage(html, response.url || normalizedUrl);
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  fetchEventPage,
  normalizeEventUrl
};
