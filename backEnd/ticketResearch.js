const { extractTicketInfoFromText } = require("./contentAnalyzer");

const AFFORDABILITY_TERMS = [
  "affordability",
  "affordable",
  "budget",
  "cheap",
  "cost",
  "cost-conscious",
  "discount",
  "free",
  "low cost",
  "price",
  "pricing",
  "student",
  "value"
];

function decodeEntities(value) {
  const entityMap = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: "\"",
    apos: "'",
    nbsp: " ",
    hellip: "...",
    ndash: "-",
    mdash: "-",
    laquo: "<<",
    raquo: ">>",
    ldquo: "\"",
    rdquo: "\"",
    lsquo: "'",
    rsquo: "'",
    times: "x"
  };

  let text = String(value || "");

  for (let pass = 0; pass < 3; pass += 1) {
    const decoded = text
      .replace(/&(?:(?:amp);?)*nbsp;?/gi, " ")
      .replace(/&amp;/g, "&")
      .replace(/&#39;/g, "'")
      .replace(/&#(\d+);?/g, (_, code) => String.fromCharCode(Number(code)))
      .replace(/&#x([0-9a-f]+);?/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
      .replace(/&([a-z]+);?/gi, (match, entity) => entityMap[entity.toLowerCase()] ?? match);

    if (decoded === text) {
      break;
    }

    text = decoded;
  }

  return text;
}

function stripTags(value) {
  return decodeEntities(String(value || "").replace(/<[^>]*>/g, " "));
}

function normalizeWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function profileMentionsAffordability(profile) {
  const profileText = `${profile?.title || ""} ${profile?.summary || ""}`.toLowerCase();
  return AFFORDABILITY_TERMS.some((term) => profileText.includes(term));
}

function hasExplicitTicketInfo(eventPage) {
  return Boolean(eventPage?.eventInfo?.ticketInfo?.summary);
}

function compactEventName(eventPage) {
  const eventName = eventPage?.eventInfo?.name || eventPage?.title || "";
  return normalizeWhitespace(eventName)
    .replace(/\s*[-:|]\s*.*$/, "")
    .slice(0, 120);
}

function buildTicketSearchQuery(eventPage) {
  const eventName = compactEventName(eventPage);
  const location = eventPage?.eventInfo?.locations?.find((entry) => entry.length < 120) || "";
  const host = eventPage?.sourceUrl ? new URL(eventPage.sourceUrl).hostname.replace(/^www\./, "") : "";

  return [
    eventName,
    location,
    "tickets price admission",
    host
  ].filter(Boolean).join(" ");
}

function extractDuckDuckGoResults(html) {
  const results = [];
  const blocks = html.match(/<div[^>]+class=["'][^"']*result[^"']*["'][\s\S]*?(?=<div[^>]+class=["'][^"']*result|<\/body>|$)/gi) || [];

  blocks.slice(0, 8).forEach((block) => {
    const title = stripTags((block.match(/<a[^>]+class=["'][^"']*result__a[^"']*["'][^>]*>([\s\S]*?)<\/a>/i) || [])[1]);
    const snippet = stripTags((block.match(/<a[^>]+class=["'][^"']*result__snippet[^"']*["'][^>]*>([\s\S]*?)<\/a>/i)
      || block.match(/<div[^>]+class=["'][^"']*result__snippet[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)
      || [])[1]);
    const url = decodeEntities((block.match(/href=["']([^"']+)["']/i) || [])[1] || "");

    if (title || snippet) {
      results.push({ title: normalizeWhitespace(title), snippet: normalizeWhitespace(snippet), url });
    }
  });

  return results;
}

function extractBingResults(html) {
  const results = [];
  const blocks = html.match(/<li[^>]+class=["']b_algo["'][\s\S]*?<\/li>/gi) || [];

  blocks.slice(0, 8).forEach((block) => {
    const title = stripTags((block.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i) || [])[1]);
    const snippet = stripTags((block.match(/<p[^>]*>([\s\S]*?)<\/p>/i) || [])[1]);
    const url = decodeEntities((block.match(/<a[^>]+href=["']([^"']+)["']/i) || [])[1] || "");

    if (title || snippet) {
      results.push({ title: normalizeWhitespace(title), snippet: normalizeWhitespace(snippet), url });
    }
  });

  return results;
}

async function fetchText(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: {
        "accept": "text/html,application/xhtml+xml",
        "user-agent": "CustomBrochure/1.0 ticket price research"
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Search returned ${response.status}.`);
    }

    return response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function searchTicketPrices(query) {
  const encodedQuery = encodeURIComponent(query);
  const providers = [
    {
      url: `https://duckduckgo.com/html/?q=${encodedQuery}`,
      parse: extractDuckDuckGoResults
    },
    {
      url: `https://www.bing.com/search?q=${encodedQuery}`,
      parse: extractBingResults
    }
  ];

  for (const provider of providers) {
    try {
      const html = await fetchText(provider.url);
      const results = provider.parse(html);
      if (results.length) {
        return results;
      }
    } catch (error) {
      // Search is a best-effort enrichment. Try the next provider if one fails.
    }
  }

  return [];
}

async function addTicketPriceResearch(profile, eventPage) {
  if (!profileMentionsAffordability(profile)) {
    return {
      ...eventPage,
      ticketResearch: { searched: false, reason: "profile does not mention affordability" }
    };
  }

  if (hasExplicitTicketInfo(eventPage)) {
    return {
      ...eventPage,
      ticketResearch: { searched: false, reason: "source page includes ticket info" }
    };
  }

  const query = buildTicketSearchQuery(eventPage);
  const results = await searchTicketPrices(query);
  const searchableText = results
    .map((result) => `${result.title}. ${result.snippet}`)
    .join(" ");
  const ticketInfo = extractTicketInfoFromText(searchableText);

  if (!ticketInfo) {
    return {
      ...eventPage,
      ticketResearch: {
        searched: true,
        query,
        found: false,
        resultsChecked: results.length
      }
    };
  }

  return {
    ...eventPage,
    eventInfo: {
      ...eventPage.eventInfo,
      ticketInfo: {
        summary: `${ticketInfo} (from web search; confirm on the ticketing site before purchase)`,
        source: "web search",
        query,
        resultUrl: results.find((result) => (
          extractTicketInfoFromText(`${result.title}. ${result.snippet}`)
        ))?.url || ""
      }
    },
    ticketResearch: {
      searched: true,
      query,
      found: true,
      resultsChecked: results.length
    }
  };
}

module.exports = {
  addTicketPriceResearch,
  profileMentionsAffordability,
  hasExplicitTicketInfo
};
