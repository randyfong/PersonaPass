const STOP_WORDS = new Set([
  "about", "after", "again", "also", "and", "are", "because", "been", "but", "can",
  "could", "each", "for", "from", "get", "has", "have", "how", "into", "its",
  "more", "our", "out", "over", "the", "their", "there", "this", "through", "to",
  "under", "use", "was", "with", "you", "your"
]);

const LOW_VALUE_EVENT_KEYWORDS = new Set([
  "icon", "image", "photo", "photos", "rating", "read", "section", "star", "chevron",
  "close", "menu", "navigation", "mobile", "button", "view", "more", "show"
]);

const INTEREST_SIGNALS = [
  { label: "convenience", terms: ["easy", "simple", "simplicity", "quick", "nearby", "parking", "schedule", "access", "accessibility", "low-friction"] },
  { label: "family value", terms: ["family", "kid", "kids", "child", "children", "caregiver", "parents", "all ages", "age-appropriate", "stroller", "safety"] },
  { label: "learning", terms: ["learn", "workshop", "class", "speaker", "session", "education", "educational", "hands-on"] },
  { label: "networking", terms: ["network", "meet", "community", "conference", "business", "professionals"] },
  { label: "comfort", terms: ["comfortable", "comfort", "accessible", "accessibility", "seating", "transportation", "reassurance", "relaxed"] },
  { label: "affordability", terms: ["free", "discount", "budget", "student", "included", "value", "cost", "cheap", "money"] },
  { label: "social energy", terms: ["friends", "buddy", "buddies", "music", "party", "social", "festival", "live", "group", "together", "beer", "beers", "drink", "drinks"] }
];

const AFFORDABLE_PRICE_MAX = 40;
const MODERATE_PRICE_MAX = 60;
const UNMET_NEED_CATEGORY_PENALTY = 10;
const AGE_FIT_BONUS = 30;
const AGE_CAUTION_PENALTY = 25;
const AGE_MISMATCH_PENALTY = 45;
const AGE_INAPPROPRIATE_MAX_SCORE = 15;
const AGE_CAUTION_MAX_SCORE = 55;
const ADULT_FRIENDLY_NO_KIDS_MIN_SCORE = 50;
const YOUNG_FAMILY_NO_AGE_RESTRICTIONS_BASE_SCORE = 50;
const ADULT_TARGET_MIN_SCORE = 72;
const ADULT_SPEND_READY_MIN_SCORE = 82;
const SPEND_READY_ADULT_BONUS = 10;
const STRONG_AFFORDABILITY_TERMS = new Set([
  "free",
  "discount",
  "budget",
  "student",
  "included",
  "value",
  "cheap"
]);

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
  const decoded = decodeEntities(String(value || ""));
  return decodeEntities(decoded.replace(/<[^>]*>/g, " "));
}

function normalizeWhitespace(value) {
  return value.replace(/\\[nrt]/g, " ").replace(/\s+/g, " ").trim();
}

function toPlainText(value) {
  return normalizeWhitespace(stripTags(value || ""));
}

function formatDisplayDate(value) {
  if (!value) {
    return "";
  }

  const plainValue = toPlainText(value);
  if (!/(?:\b\d{4}\b|\b\d{1,2}\/\d{1,2}\/\d{2,4}\b)/.test(plainValue)) {
    return plainValue;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return plainValue;
  }

  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function formatDisplayDateRange(startValue, endValue) {
  const start = new Date(startValue);
  const end = new Date(endValue);

  if (Number.isNaN(start.getTime())) {
    return "";
  }

  if (Number.isNaN(end.getTime())) {
    return formatDisplayDate(startValue);
  }

  const dateFormatter = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  });
  const timeFormatter = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit"
  });

  if (dateFormatter.format(start) === dateFormatter.format(end)) {
    return `${dateFormatter.format(start)}, ${timeFormatter.format(start)} - ${timeFormatter.format(end)}`;
  }

  return `${formatDisplayDate(startValue)} - ${formatDisplayDate(endValue)}`;
}

function extractFirst(pattern, html) {
  const match = html.match(pattern);
  return match ? toPlainText(match[1]) : "";
}

function extractAll(pattern, html, limit = 8) {
  const values = [];
  let match = pattern.exec(html);
  while (match && values.length < limit) {
    const text = toPlainText(match[1]);
    if (text) {
      values.push(text);
    }
    match = pattern.exec(html);
  }
  return values;
}

function getAttribute(tag, attributeName) {
  const pattern = new RegExp(`${attributeName}\\s*=\\s*["']([^"']+)["']`, "i");
  const match = tag.match(pattern);
  return match ? decodeEntities(match[1]).trim() : "";
}

function extractMeta(html, key, value) {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  const target = value.toLowerCase();

  const tag = tags.find((metaTag) => (
    getAttribute(metaTag, key).toLowerCase() === target
  ));

  return tag ? getAttribute(tag, "content") : "";
}

function resolveUrl(value, sourceUrl) {
  if (!value || /^data:/i.test(value)) {
    return "";
  }

  try {
    return new URL(value, sourceUrl).href;
  } catch (error) {
    return "";
  }
}

function extractKeywords(text, limit = 14) {
  const counts = new Map();
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3 && !STOP_WORDS.has(word) && !/^\d/.test(word));

  words.forEach((word) => {
    counts.set(word, (counts.get(word) || 0) + 1);
  });

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([word]) => word);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasSignalTerm(normalizedText, term) {
  if (term === "free") {
    return /(^|[^a-z0-9-])free(?=$|[^a-z0-9-])/.test(normalizedText);
  }

  const escapedTerm = escapeRegExp(term.toLowerCase()).replace(/\\ /g, "\\s+");
  return new RegExp(`(^|[^a-z0-9])${escapedTerm}(?=$|[^a-z0-9])`).test(normalizedText);
}

function asArray(value) {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function normalizeJsonLdType(type) {
  return asArray(type).map((entry) => String(entry).toLowerCase());
}

function flattenJsonLd(value) {
  if (!value || typeof value !== "object") {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap(flattenJsonLd);
  }

  const graph = Array.isArray(value["@graph"]) ? value["@graph"].flatMap(flattenJsonLd) : [];
  return [value, ...graph];
}

function parseJsonLd(html) {
  const scripts = [];
  const pattern = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match = pattern.exec(html);

  while (match) {
    try {
      scripts.push(...flattenJsonLd(JSON.parse(match[1].trim())));
    } catch (error) {
      // Ignore invalid publisher JSON-LD and continue with other signals.
    }

    match = pattern.exec(html);
  }

  return scripts;
}

function extractJsonLdEvent(html) {
  const nodes = parseJsonLd(html);
  const event = nodes.find((node) => normalizeJsonLdType(node["@type"]).includes("event"));

  if (!event) {
    return {};
  }

  const location = typeof event.location === "string"
    ? event.location
    : [
      event.location?.name,
      event.location?.address?.streetAddress,
      event.location?.address?.addressLocality,
      event.location?.address?.addressRegion
    ].filter(Boolean).join(", ");

  return {
    name: toPlainText(event.name || ""),
    description: toPlainText(event.description || ""),
    startDate: toPlainText(event.startDate || ""),
    endDate: toPlainText(event.endDate || ""),
    location: toPlainText(location || ""),
    images: asArray(event.image).map((image) => (typeof image === "string" ? image : image?.url)).filter(Boolean),
    ticketInfo: extractTicketInfoFromOffers(event.offers)
  };
}

function normalizeTicketPrice(value) {
  if (value === undefined || value === null || value === "") {
    return "";
  }

  if (typeof value === "number") {
    return value === 0 ? "free" : `$${value}`;
  }

  const text = toPlainText(value);
  if (!text) {
    return "";
  }

  if (/^(?:0|0\.00)$/i.test(text)) {
    return "free";
  }

  if (/^\d+(?:\.\d{2})?$/.test(text)) {
    return `$${text}`;
  }

  return text;
}

function extractTicketInfoFromOffers(offers) {
  const offerList = asArray(offers).flatMap((offer) => {
    if (!offer || typeof offer !== "object") {
      return [];
    }

    if (Array.isArray(offer.offers)) {
      return [offer, ...offer.offers];
    }

    return [offer];
  });

  const summaries = offerList.map((offer) => {
    const name = toPlainText(offer.name || offer.category || "");
    const price = normalizeTicketPrice(offer.price || offer.lowPrice || offer.highPrice);
    const currency = toPlainText(offer.priceCurrency || "");
    const availability = toPlainText(offer.availability || "").split("/").at(-1) || "";

    if (!price && !name) {
      return "";
    }

    return [name, price, price && currency && !price.startsWith("$") ? currency : "", availability]
      .filter(Boolean)
      .join(" ");
  }).filter(Boolean);

  return summaries.length ? summaries.slice(0, 3).join("; ") : "";
}

function extractLikelyDates(text) {
  const datePatterns = [
    /\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)(?:day)?[,]?\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}(?:,\s+\d{4})?(?:\s+(?:at|@)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?/gi,
    /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}(?:,\s+\d{4})?(?:\s+(?:at|@)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?/gi,
    /\b\d{1,2}\/\d{1,2}\/\d{2,4}(?:\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?/gi
  ];

  return datePatterns.flatMap((pattern) => text.match(pattern) || []).slice(0, 4);
}

function extractLikelyLocations(text) {
  const normalized = normalizeWhitespace(text || "");
  const blocked = /\b(?:call us|my order|rating|reviews?|tickets? starting|navigation|menu icon|gift cards?)\b/i;
  const venuePattern = /\b((?:The\s+)?[A-Z][A-Za-z0-9'’&.-]+(?:\s+[A-Z][A-Za-z0-9'’&.-]+){0,6}\s+(?:Theatre|Theater|Stadium|Park|Gardens|Center|Centre|Hall|Arena|Lawn|Plaza|Fairgrounds|Library|Museum|Club))\b/g;
  const addressPattern = /\b\d{1,6}\s+[A-Z][A-Za-z0-9'.-]*(?:\s+[A-Za-z0-9'.-]+){0,8}\s+(?:Street|St\.?|Avenue|Ave\.?|Road|Rd\.?|Boulevard|Blvd\.?|Drive|Dr\.?|Lane|Ln\.?|Way|Court|Ct\.?)(?:,?\s+[A-Z][A-Za-z .'-]+,?\s+[A-Z]{2}(?:\s+\d{5})?)?/;
  const results = [];
  let venueMatch = venuePattern.exec(normalized);

  while (venueMatch && results.length < 4) {
    const venue = normalizeWhitespace(venueMatch[1]);
    const nearby = normalized.slice(venueMatch.index, venueMatch.index + 320);
    const address = nearby.match(addressPattern)?.[0] || "";
    const location = address ? `${venue}, ${address}` : venue;

    if (!blocked.test(location) && !results.includes(location)) {
      results.push(location);
    }

    venueMatch = venuePattern.exec(normalized);
  }

  const addressOnly = normalized.match(addressPattern)?.[0] || "";
  if (addressOnly && !results.some((location) => location.includes(addressOnly))) {
    results.push(addressOnly);
  }

  const lines = normalized.split(/[.!?]/).map(normalizeWhitespace).filter(Boolean);
  lines
    .filter((line) => /\b(?:venue|location|address|where|located|takes place|plays at)\b/i.test(line))
    .filter((line) => line.length < 180 && !blocked.test(line))
    .forEach((line) => {
      if (results.length < 4 && !results.includes(line)) {
        results.push(line);
      }
    });

  return results.slice(0, 4);
}

function cleanTicketInfo(value) {
  return normalizeWhitespace(value)
    .replace(/^[^\w$]+/, "")
    .replace(/\s+([,.])/g, "$1")
    .slice(0, 160);
}

function extractTicketInfoFromText(text) {
  const normalized = normalizeWhitespace(text || "");
  if (!normalized) {
    return "";
  }

  const labeledPatterns = [
    /\b(?:tickets?|admission|entry|price|cost)\s*(?:is|are|from|start(?:s|ing)? at|:|-|–|—)\s*((?:free|no charge|included|\$\s?\d[\d,]*(?:\.\d{2})?(?:\s*(?:-|to|–|—)\s*\$?\s?\d[\d,]*(?:\.\d{2})?)?)(?:\s+(?:general admission|per person|for adults?|for kids?|children|students?|seniors?|advance|at the door|online))?)/i,
    /\b((?:free|no charge)\s+(?:tickets?|admission|entry))/i,
    /\b(\$\s?\d[\d,]*(?:\.\d{2})?(?:\s*(?:-|to|–|—)\s*\$?\s?\d[\d,]*(?:\.\d{2})?)?\s*(?:general admission|per person|for adults?|for kids?|children|students?|seniors?|tickets?|admission|entry))/i
  ];

  for (const pattern of labeledPatterns) {
    const match = normalized.match(pattern);
    if (match?.[1]) {
      return cleanTicketInfo(match[1]);
    }
  }

  const priceMatch = normalized.match(/\$\s?\d[\d,]*(?:\.\d{2})?/);
  if (!priceMatch) {
    return "";
  }

  const start = Math.max(0, priceMatch.index - 90);
  const end = Math.min(normalized.length, priceMatch.index + 120);
  const context = normalized.slice(start, end);

  if (!/\b(?:tickets?|admission|entry|price|cost|general admission)\b/i.test(context)) {
    return "";
  }

  return cleanTicketInfo(context);
}

function scoreImage(image) {
  let score = 0;
  const combined = `${image.url} ${image.alt || ""} ${image.source || ""}`.toLowerCase();

  if (image.source.includes("og:") || image.source.includes("twitter:")) score += 40;
  if (/\b(hero|event|banner|cover|main|program|conference|festival)\b/.test(combined)) score += 24;
  if (/\.(jpe?g|png|webp)(?:[?#]|$)/.test(image.url.toLowerCase())) score += 16;
  if (/\.gif(?:[?#]|$)/i.test(image.url)) score -= 80;
  if (/\b(logo|icon|sprite|avatar|loading|spinner|placeholder|loader)\b/.test(combined)) score -= 60;
  if (/tribe-loading|loading\.gif|spinner\.gif|ajax-loader/i.test(combined)) score -= 80;
  if (image.width >= 600 || image.height >= 350) score += 12;
  if (image.width && image.width < 160) score -= 20;
  if (image.height && image.height < 120) score -= 20;

  return score;
}

function isPlaceholderImage(image) {
  const combined = `${image.url} ${image.alt || ""} ${image.source || ""}`.toLowerCase();
  return /\b(loading|spinner|placeholder|loader)\b/.test(combined)
    || /\.gif(?:[?#]|$)/i.test(image.url)
    || /tribe-loading|loading\.gif|spinner\.gif|ajax-loader/.test(combined);
}

function extractImages(html, sourceUrl, jsonLdEvent) {
  const images = [];
  const pushImage = (url, source, alt = "", width = 0, height = 0) => {
    const resolvedUrl = resolveUrl(url, sourceUrl);
    if (!resolvedUrl || images.some((image) => image.url === resolvedUrl)) {
      return;
    }

    images.push({
      url: resolvedUrl,
      source,
      alt: toPlainText(alt),
      width: Number(width) || 0,
      height: Number(height) || 0,
      placeholder: false
    });
  };

  [
    ["og:image", extractMeta(html, "property", "og:image")],
    ["twitter:image", extractMeta(html, "name", "twitter:image")],
    ["twitter:image", extractMeta(html, "property", "twitter:image")]
  ].forEach(([source, url]) => pushImage(url, source));

  asArray(jsonLdEvent.images).forEach((url) => pushImage(url, "json-ld"));

  const imgTags = html.match(/<img\b[^>]*>/gi) || [];
  imgTags.slice(0, 80).forEach((tag) => {
    const src = getAttribute(tag, "src") || getAttribute(tag, "data-src") || getAttribute(tag, "data-lazy-src");
    pushImage(src, "img", getAttribute(tag, "alt"), getAttribute(tag, "width"), getAttribute(tag, "height"));
  });

  return images
    .map((image) => {
      const placeholder = isPlaceholderImage(image);
      return { ...image, placeholder, score: placeholder ? -100 : scoreImage(image) };
    })
    .filter((image) => image.placeholder || image.score > -20)
    .sort((a, b) => {
      if (a.placeholder !== b.placeholder) {
        return a.placeholder ? 1 : -1;
      }

      return b.score - a.score;
    })
    .slice(0, 10);
}

function extractEventSections(html) {
  const sections = [];
  const pattern = /<h([1-3])[^>]*>([\s\S]*?)<\/h\1>([\s\S]*?)(?=<h[1-3]\b|<\/body>|$)/gi;
  let match = pattern.exec(html);

  while (match && sections.length < 6) {
    const title = toPlainText(match[2]);
    const body = toPlainText(match[3]).slice(0, 280);
    if (title && body) {
      sections.push({ title, body });
    }

    match = pattern.exec(html);
  }

  return sections;
}

function extractEventPage(html, sourceUrl) {
  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");

  const jsonLdEvent = extractJsonLdEvent(html);
  const title = jsonLdEvent.name
    || extractMeta(html, "property", "og:title")
    || extractMeta(html, "name", "twitter:title")
    || extractFirst(/<title[^>]*>([\s\S]*?)<\/title>/i, withoutScripts);
  const description = jsonLdEvent.description
    || extractMeta(html, "name", "description")
    || extractMeta(html, "property", "og:description")
    || extractMeta(html, "name", "twitter:description");
  const headings = extractAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi, withoutScripts, 10);
  const bodyText = toPlainText(withoutScripts).slice(0, 12000);
  const combined = [title, description, headings.join(" "), bodyText].join(" ");
  const dates = [
    jsonLdEvent.startDate,
    jsonLdEvent.endDate,
    ...extractLikelyDates(bodyText)
  ].filter(Boolean);
  const displayDates = dates.map(formatDisplayDate).filter(Boolean);
  const displayDateRange = formatDisplayDateRange(jsonLdEvent.startDate, jsonLdEvent.endDate);
  const locations = [
    jsonLdEvent.location,
    ...extractLikelyLocations(bodyText)
  ].filter(Boolean);
  const images = extractImages(html, sourceUrl, jsonLdEvent);
  const sections = extractEventSections(withoutScripts);
  const ticketInfo = jsonLdEvent.ticketInfo || extractTicketInfoFromText(bodyText);

  return {
    sourceUrl,
    title: title || new URL(sourceUrl).hostname,
    description,
    headings,
    eventInfo: {
      name: title || new URL(sourceUrl).hostname,
      description,
      startDate: dates[0] || "",
      endDate: dates[1] || "",
      dates: [...new Set(dates)].slice(0, 4),
      displayStartDate: displayDates[0] || "",
      displayEndDate: displayDates[1] || "",
      displayDateRange,
      displayDates: [...new Set(displayDates)].slice(0, 4),
      location: locations[0] || "",
      locations: [...new Set(locations)].slice(0, 4),
      sections,
      ticketInfo: ticketInfo ? {
        summary: ticketInfo,
        source: jsonLdEvent.ticketInfo ? "event structured data" : "event page"
      } : null
    },
    images,
    primaryImage: images.find((image) => !image.placeholder) || null,
    keywords: extractKeywords(combined),
    text: bodyText
  };
}

function inferInterestSignals(text) {
  const normalized = text.toLowerCase();
  return INTEREST_SIGNALS
    .map((signal) => {
      const evidence = signal.terms.filter((term) => hasSignalTerm(normalized, term));

      return {
        label: signal.label,
        score: evidence.length,
        evidence
      };
    })
    .filter((signal) => signal.score > 0)
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));
}

function inferInterests(text) {
  return inferInterestSignals(text).slice(0, 4).map((signal) => signal.label);
}

function profileAllowsSignal(profileText, signal) {
  if (signal.label !== "family value") {
    return true;
  }

  return /\b(?:famil(?:y|ies)|parents?|kids?|children|child|caregivers?|stroller|all ages|age-appropriate)\b/i.test(profileText);
}

function filterProfileSignals(profileText, signals) {
  return signals.filter((signal) => profileAllowsSignal(profileText, signal));
}

function mergeSignal(signals, signal) {
  const existingSignal = signals.find((entry) => entry.label === signal.label);
  if (!existingSignal) {
    return [...signals, signal];
  }

  return signals.map((entry) => {
    if (entry.label !== signal.label) {
      return entry;
    }

    return {
      ...entry,
      score: entry.score + signal.score,
      evidence: [...new Set([...entry.evidence, ...signal.evidence])]
    };
  });
}

function hasBudgetConcernCue(profileText) {
  return /\b(?:budget|cheap|afford|free|discount|deal|value|save|low-cost|cost-conscious|price-sensitive|manageable (?:price|cost))\b/i.test(profileText);
}

function hasSpendReadyCue(profileText) {
  return /\b(?:ready to spend|chunk of money|money in (?:our|my|their) pocket|splurge|treat (?:our|my|them)selves?|spend (?:as much )?money|spend as much money as (?:we|i|they) can|love to spend)\b/i.test(profileText);
}

function hasAdultNightOutCue(profileText) {
  return /\b(?:go out|out on the town|night out|date night|adult group outing|ready to spend|30 years old|thirties|30s)\b/i.test(profileText);
}

function buildProfileInterestSignals(profileText) {
  let signals = filterProfileSignals(profileText, inferInterestSignals(profileText));

  if (hasSpendReadyCue(profileText) && !hasBudgetConcernCue(profileText)) {
    signals = signals.filter((signal) => signal.label !== "affordability");
  }

  if (hasAdultNightOutCue(profileText)) {
    const evidence = [];
    if (/\b(?:go out|out on the town|night out|date night|adult group outing)\b/i.test(profileText)) {
      evidence.push("night out");
    }
    if (hasSpendReadyCue(profileText)) {
      evidence.push("ready to spend");
    }
    if (/\b(?:30 years old|thirties|30s)\b/i.test(profileText)) {
      evidence.push("adult outing");
    }

    signals = mergeSignal(signals, {
      label: "social energy",
      score: Math.max(1, evidence.length),
      evidence: evidence.length ? evidence : ["adult night out"]
    });
  }

  return signals.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));
}

function filterEventKeywords(keywords) {
  return keywords.filter((keyword) => !LOW_VALUE_EVENT_KEYWORDS.has(keyword));
}

function extractLowestTicketPrice(value) {
  const text = toPlainText(value || "").replace(/\$\s+/g, "$").replace(/\s+\./g, ".");
  if (!text) {
    return null;
  }

  if (/\b(?:free|complimentary|no charge)\b/i.test(text)) {
    return 0;
  }

  const prices = [...text.matchAll(/\$\s*(\d+(?:\.\d{1,2})?)/g)]
    .map((match) => Number(match[1]))
    .filter((price) => Number.isFinite(price));

  return prices.length ? Math.min(...prices) : null;
}

function createTicketAffordabilitySignal(eventPage) {
  const ticketSummary = eventPage.eventInfo?.ticketInfo?.summary || "";
  const price = extractLowestTicketPrice(ticketSummary);

  if (price === null) {
    return null;
  }

  if (price === 0) {
    return {
      label: "affordability",
      score: 4,
      evidence: ["free ticket price"],
      ticketPrice: price
    };
  }

  if (price <= AFFORDABLE_PRICE_MAX) {
    return {
      label: "affordability",
      score: 3,
      evidence: [`tickets from $${price}`],
      ticketPrice: price
    };
  }

  if (price <= MODERATE_PRICE_MAX) {
    return {
      label: "affordability",
      score: 1,
      evidence: [`moderate ticket price $${price}`],
      ticketPrice: price
    };
  }

  return {
    label: "affordability",
    score: 0,
    evidence: [`ticket price $${price}`],
    ticketPrice: price
  };
}

function applyTicketPriceToAffordability(signals, eventPage) {
  const ticketSignal = createTicketAffordabilitySignal(eventPage);
  if (!ticketSignal) {
    return signals;
  }

  const affordabilitySignal = signals.find((signal) => signal.label === "affordability");
  const otherSignals = signals.filter((signal) => signal.label !== "affordability");

  if (ticketSignal.score > 0) {
    return [
      ...otherSignals,
      {
        label: "affordability",
        score: (affordabilitySignal?.score || 0) + ticketSignal.score,
        evidence: [...new Set([
          ...(affordabilitySignal?.evidence || []),
          ...ticketSignal.evidence
        ])],
        ticketPrice: ticketSignal.ticketPrice
      }
    ].sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));
  }

  if (!affordabilitySignal) {
    return signals;
  }

  const strongEvidence = affordabilitySignal.evidence.filter((term) => (
    STRONG_AFFORDABILITY_TERMS.has(term)
  ));

  if (!strongEvidence.length) {
    return otherSignals;
  }

  return [
    ...otherSignals,
    {
      ...affordabilitySignal,
      score: strongEvidence.length,
      evidence: strongEvidence
    }
  ].sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));
}

function mergeInterestSignals(profileSignals, eventSignals) {
  return profileSignals
    .map((profileSignal) => {
      const eventSignal = eventSignals.find((signal) => signal.label === profileSignal.label);
      if (!eventSignal) {
        return null;
      }

      return {
        label: profileSignal.label,
        score: profileSignal.score + eventSignal.score,
        profileEvidence: profileSignal.evidence,
        eventEvidence: eventSignal.evidence
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));
}

function findUnmetNeedSignals(profileSignals, eventSignals) {
  return profileSignals
    .filter((profileSignal) => !eventSignals.some((signal) => signal.label === profileSignal.label))
    .map((profileSignal) => ({
      label: profileSignal.label,
      profileEvidence: profileSignal.evidence
    }));
}

function inferProfileAgeGroup(profileText) {
  if (/\b(?:child|children|kid|kids|caregiver|caregivers|parent|parents|age-appropriate)\b/i.test(profileText)) {
    return "child";
  }

  if (/\b(?:young family|family|families|stroller|multiple ages|all ages)\b/i.test(profileText)) {
    return "family";
  }

  if (/\b(?:teen|teenager|teenagers|youth|peer-friendly|independence|social relevance)\b/i.test(profileText)) {
    return "teen";
  }

  if (/\b(?:senior|seniors|older adult|older adults|retired|mobility)\b/i.test(profileText)) {
    return "senior";
  }

  if (/\b(?:adult|adults|adult-friendly|adult group outing|date night|night out|30 years old|thirties|30s)\b/i.test(profileText)) {
    return "adult";
  }

  return "";
}

function extractProfileAges(profileText) {
  const ages = new Set();
  const addAge = (value) => {
    const age = Number(value);
    if (Number.isInteger(age) && age >= 0 && age <= 120) {
      ages.add(age);
    }
  };

  for (const match of profileText.matchAll(/\b(\d{1,3})\s*(?:years?\s*old|yrs?\s*old|year-old|yr-old|y\/o|yo)\b/gi)) {
    addAge(match[1]);
  }

  for (const match of profileText.matchAll(/\b(?:ages?|aged)\s*((?:\d{1,3}\s*(?:,|and|&|-|to)?\s*){1,8})/gi)) {
    for (const ageMatch of match[1].matchAll(/\d{1,3}/g)) {
      addAge(ageMatch[0]);
    }
  }

  for (const match of profileText.matchAll(/\b(?:child|children|kid|kids|teen|teenager|teenagers|son|daughter)\b(?:\W+\w+){0,5}?\W+(\d{1,3})\b/gi)) {
    addAge(match[1]);
  }

  return [...ages].sort((a, b) => a - b);
}

function extractAgeSignals(eventPage) {
  const text = normalizeWhitespace([
    eventPage.text || "",
    eventPage.description || "",
    eventPage.eventInfo?.description || "",
    eventPage.eventInfo?.sections?.map((section) => `${section.title || ""} ${section.body || ""}`).join(" ") || ""
  ].join(" ")).toLowerCase();
  const evidence = [];
  const minAges = [];
  const forbiddenUnderAges = [];
  const addEvidence = (value) => {
    const cleanValue = sanitizeSnippet(value);
    if (cleanValue && !evidence.includes(cleanValue)) {
      evidence.push(cleanValue);
    }
  };

  for (const match of text.matchAll(/\b(?:ages?|recommended for ages?)\s*(\d{1,2})\s*(?:\+|and up|or older)\b/gi)) {
    minAges.push(Number(match[1]));
    addEvidence(match[0]);
  }

  for (const match of text.matchAll(/\b(?:children|kids|guests|patrons)?\s*under\s*(\d{1,2})\s+(?:are\s+)?(?:not permitted|not allowed|prohibited|restricted)\b/gi)) {
    forbiddenUnderAges.push(Number(match[1]));
    addEvidence(match[0]);
  }

  for (const match of text.matchAll(/\b(18|21)\s*\+\b/g)) {
    minAges.push(Number(match[1]));
    addEvidence(match[0]);
  }

  if (/\b(?:all ages|for all ages|family-friendly|family friendly|kid-friendly|kid friendly|children welcome)\b/i.test(text)) {
    addEvidence(text.match(/\b(?:all ages|for all ages|family-friendly|family friendly|kid-friendly|kid friendly|children welcome)\b/i)?.[0] || "all ages");
  }

  if (/\b(?:adult themes|adults only|mature audiences?|explicit content|gunfire|strobe lights?|smoke|herbal cigarette smoke)\b/i.test(text)) {
    addEvidence(text.match(/\b(?:adult themes|adults only|mature audiences?|explicit content|gunfire|strobe lights?|smoke|herbal cigarette smoke)\b/i)?.[0] || "content advisory");
  }

  return {
    minAge: minAges.length ? Math.max(...minAges) : null,
    forbiddenUnderAge: forbiddenUnderAges.length ? Math.max(...forbiddenUnderAges) : null,
    hasAllAgesCue: /\b(?:all ages|for all ages|family-friendly|family friendly|kid-friendly|kid friendly|children welcome)\b/i.test(text),
    hasFamilyOrKidsCue: /\b(?:famil(?:y|ies)|kids?|children|child|parents?|caregivers?)\b/i.test(text),
    hasAdultEntertainmentCue: /\b(?:adult entertainment|adult themes|adults only|mature audiences?|explicit content|nightlife|cabaret|burlesque|cocktails?|bar|drinks?|21\s*\+)\b/i.test(text),
    hasAdultOnlyCue: /\b(?:adults only|mature audiences?|18\s*\+|21\s*\+)\b/i.test(text),
    hasChildContentCaution: /\b(?:adult themes|explicit content|gunfire|strobe lights?|smoke|herbal cigarette smoke)\b/i.test(text),
    hasSeniorAccessCue: /\b(?:accessible|accessibility|wheelchair|assisted listening|closed captioning|seating|comfort|transportation)\b/i.test(text),
    evidence: evidence.slice(0, 4)
  };
}

function assessAgeCompatibility(profileText, eventPage) {
  const profileAgeGroup = inferProfileAgeGroup(profileText);
  const profileAges = extractProfileAges(profileText);
  const ageSignals = extractAgeSignals(eventPage);
  const eventMinimumAge = Math.max(ageSignals.minAge || 0, ageSignals.forbiddenUnderAge || 0) || null;
  const profileAgesBelowRestriction = eventMinimumAge === null
    ? []
    : profileAges.filter((age) => age < eventMinimumAge);
  const profileAgesMeetRestriction = Boolean(
    eventMinimumAge !== null
    && profileAges.length
    && profileAgesBelowRestriction.length === 0
  );
  const adultFriendlyEvent = Boolean(
    ageSignals.hasAdultEntertainmentCue
    || ageSignals.hasAdultOnlyCue
    || ageSignals.hasChildContentCaution
    || ageSignals.forbiddenUnderAge !== null
    || (ageSignals.minAge !== null && ageSignals.minAge >= 12)
  );

  if (profileAgesBelowRestriction.length) {
    return {
      profileAgeGroup,
      profileAges,
      eventMinimumAge,
      status: "mismatch",
      scoreAdjustment: -AGE_MISMATCH_PENALTY,
      maxScore: AGE_INAPPROPRIATE_MAX_SCORE,
      adultFriendlyEvent,
      evidence: ageSignals.evidence
    };
  }

  if (!profileAgeGroup) {
    return {
      profileAgeGroup,
      profileAges,
      eventMinimumAge,
      status: "neutral",
      scoreAdjustment: 0,
      maxScore: null,
      adultFriendlyEvent,
      evidence: ageSignals.evidence
    };
  }

  if (profileAgeGroup === "senior") {
    if (ageSignals.hasSeniorAccessCue) {
      return {
        profileAgeGroup,
        profileAges,
        eventMinimumAge,
        status: "match",
        scoreAdjustment: AGE_FIT_BONUS,
        maxScore: null,
        adultFriendlyEvent,
        evidence: ageSignals.evidence.length ? ageSignals.evidence : ["accessibility or seating guidance"]
      };
    }

    return {
      profileAgeGroup,
      profileAges,
      eventMinimumAge,
      status: "caution",
      scoreAdjustment: -AGE_CAUTION_PENALTY,
      maxScore: AGE_CAUTION_MAX_SCORE,
      adultFriendlyEvent,
      evidence: ["no clear accessibility or senior comfort guidance"]
    };
  }

  if (profileAgeGroup === "teen") {
    if (!profileAgesMeetRestriction && ((ageSignals.minAge !== null && ageSignals.minAge > 17) || ageSignals.hasAdultOnlyCue)) {
      return {
        profileAgeGroup,
        profileAges,
        eventMinimumAge,
        status: "mismatch",
        scoreAdjustment: -AGE_MISMATCH_PENALTY,
        maxScore: AGE_INAPPROPRIATE_MAX_SCORE,
        adultFriendlyEvent,
        evidence: ageSignals.evidence
      };
    }

    if (profileAgesMeetRestriction || (ageSignals.minAge !== null && ageSignals.minAge <= 13)) {
      return {
        profileAgeGroup,
        profileAges,
        eventMinimumAge,
        status: "match",
        scoreAdjustment: AGE_FIT_BONUS,
        maxScore: null,
        adultFriendlyEvent,
        evidence: ageSignals.evidence
      };
    }

    if (ageSignals.hasAllAgesCue) {
      return {
        profileAgeGroup,
        profileAges,
        eventMinimumAge,
        status: "match",
        scoreAdjustment: Math.round(AGE_FIT_BONUS * 0.75),
        maxScore: null,
        adultFriendlyEvent,
        evidence: ageSignals.evidence
      };
    }

    return {
      profileAgeGroup,
      profileAges,
      eventMinimumAge,
      status: "caution",
      scoreAdjustment: -AGE_CAUTION_PENALTY,
      maxScore: AGE_CAUTION_MAX_SCORE,
      adultFriendlyEvent,
      evidence: ["no clear teen age guidance"]
    };
  }

  if (profileAgeGroup === "child" || profileAgeGroup === "family") {
    if (profileAgesMeetRestriction) {
      return {
        profileAgeGroup,
        profileAges,
        eventMinimumAge,
        status: ageSignals.hasChildContentCaution ? "caution" : "match",
        scoreAdjustment: ageSignals.hasChildContentCaution ? -AGE_CAUTION_PENALTY : AGE_FIT_BONUS,
        maxScore: ageSignals.hasChildContentCaution ? AGE_CAUTION_MAX_SCORE : null,
        adultFriendlyEvent,
        evidence: ageSignals.evidence
      };
    }

    if (ageSignals.minAge !== null || ageSignals.forbiddenUnderAge !== null || ageSignals.hasChildContentCaution) {
      return {
        profileAgeGroup,
        profileAges,
        eventMinimumAge,
        status: "mismatch",
        scoreAdjustment: -AGE_MISMATCH_PENALTY,
        maxScore: AGE_INAPPROPRIATE_MAX_SCORE,
        adultFriendlyEvent,
        evidence: ageSignals.evidence
      };
    }

    if (ageSignals.hasAllAgesCue || ageSignals.hasFamilyOrKidsCue) {
      return {
        profileAgeGroup,
        profileAges,
        eventMinimumAge,
        status: "match",
        scoreAdjustment: AGE_FIT_BONUS,
        maxScore: null,
        adultFriendlyEvent,
        evidence: ageSignals.evidence.length ? ageSignals.evidence : ["source mentions family or kids"]
      };
    }

    return {
      profileAgeGroup,
      profileAges,
      eventMinimumAge,
      status: "caution",
      scoreAdjustment: -AGE_CAUTION_PENALTY,
      maxScore: AGE_CAUTION_MAX_SCORE,
      adultFriendlyEvent,
      evidence: ["no clear child or family age guidance"]
    };
  }

  if (profileAgeGroup === "adult") {
    if (adultFriendlyEvent) {
      return {
        profileAgeGroup,
        profileAges,
        eventMinimumAge,
        status: "match",
        scoreAdjustment: AGE_FIT_BONUS,
        maxScore: null,
        adultFriendlyEvent,
        evidence: ageSignals.evidence.length ? ageSignals.evidence : ["adult-oriented age or content guidance"]
      };
    }

    return {
      profileAgeGroup,
      profileAges,
      eventMinimumAge,
      status: "neutral",
      scoreAdjustment: 0,
      maxScore: null,
      adultFriendlyEvent,
      evidence: ageSignals.evidence
    };
  }

  return {
    profileAgeGroup,
    profileAges,
    eventMinimumAge,
    status: "neutral",
    scoreAdjustment: 0,
    maxScore: null,
    adultFriendlyEvent,
    evidence: ageSignals.evidence
  };
}

function compareProfileToEvent(profile, eventPage) {
  const profileText = `${profile.title || ""} ${profile.summary || ""}`;
  const profileKeywords = extractKeywords(profileText, 12);
  const eventKeywords = filterEventKeywords(eventPage.keywords || []);
  const overlap = profileKeywords.filter((keyword) => eventKeywords.includes(keyword));
  const profileSignals = buildProfileInterestSignals(profileText);
  const eventSignals = applyTicketPriceToAffordability(
    inferInterestSignals(eventPage.text || ""),
    eventPage
  ).filter((signal) => profileAllowsSignal(profileText, signal));
  const matchedSignals = mergeInterestSignals(profileSignals, eventSignals).slice(0, 4);
  const unmetSignals = findUnmetNeedSignals(profileSignals, eventSignals);
  const ageCompatibility = assessAgeCompatibility(profileText, eventPage);
  const spendReadyPremiumFit = ageCompatibility.profileAgeGroup === "adult"
    && ageCompatibility.status === "match"
    && hasSpendReadyCue(profileText)
    && !hasBudgetConcernCue(profileText);
  const interests = matchedSignals.map((signal) => signal.label);
  const evidenceCount = matchedSignals.reduce((sum, signal) => (
    sum + signal.profileEvidence.length + signal.eventEvidence.length
  ), 0);
  const rawScore = Math.min(100, Math.round(
    (overlap.length * 12) + (matchedSignals.length * 16) + Math.min(evidenceCount * 3, 24)
  ));
  const unmetNeedPenalty = Math.min(40, unmetSignals.length * UNMET_NEED_CATEGORY_PENALTY);
  const ageScoreAdjustment = ageCompatibility.scoreAdjustment;
  const spendReadyScoreBonus = spendReadyPremiumFit ? SPEND_READY_ADULT_BONUS : 0;
  const uncappedScore = Math.max(0, Math.min(100, rawScore - unmetNeedPenalty + ageScoreAdjustment + spendReadyScoreBonus));
  const ageScoreCap = Number.isFinite(ageCompatibility.maxScore) ? ageCompatibility.maxScore : null;
  const profileIncludesKids = ageCompatibility.profileAgeGroup === "child" || ageCompatibility.profileAgeGroup === "family";
  const youngFamilyNoAgeRestrictionsFloor = /\byoung family\b/i.test(profileText)
    && profileIncludesKids
    && !ageCompatibility.adultFriendlyEvent
    && ageCompatibility.status !== "mismatch";
  const youngFamilyFloorPenalty = youngFamilyNoAgeRestrictionsFloor
    && unmetSignals.some((signal) => signal.label === "affordability")
    ? UNMET_NEED_CATEGORY_PENALTY
    : 0;
  const adultFriendlyNoKidsFloor = ageCompatibility.adultFriendlyEvent
    && !profileIncludesKids
    && ageCompatibility.status !== "mismatch";
  const scoreFloor = ageCompatibility.profileAgeGroup === "adult" && ageCompatibility.status === "match"
    ? (spendReadyPremiumFit ? ADULT_SPEND_READY_MIN_SCORE : ADULT_TARGET_MIN_SCORE)
    : Math.max(
      youngFamilyNoAgeRestrictionsFloor ? YOUNG_FAMILY_NO_AGE_RESTRICTIONS_BASE_SCORE - youngFamilyFloorPenalty : 0,
      adultFriendlyNoKidsFloor ? ADULT_FRIENDLY_NO_KIDS_MIN_SCORE : 0
    );
  const floorAdjustedScore = Math.max(uncappedScore, scoreFloor);
  const score = ageScoreCap === null ? floorAdjustedScore : Math.min(floorAdjustedScore, ageScoreCap);

  return {
    profileKeywords,
    eventKeywords,
    overlap,
    profileSignals,
    eventSignals,
    matchedSignals,
    unmetSignals,
    ageCompatibility,
    interests,
    rawScore,
    unmetNeedPenalty,
    ageScoreAdjustment,
    spendReadyPremiumFit,
    spendReadyScoreBonus,
    ageScoreCap,
    scoreFloor,
    uncappedScore,
    score
  };
}

function sentenceFromList(items, fallback) {
  if (!items.length) {
    return fallback;
  }

  if (items.length === 1) {
    return items[0];
  }

  if (items.length === 2) {
    return `${items[0]} and ${items[1]}`;
  }

  return `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`;
}

function sanitizeSnippet(value) {
  return toPlainText(value || "")
    .replace(/\s+([,.])/g, "$1")
    .replace(/\$\s+/g, "$")
    .replace(/\s+-\s+/g, "-")
    .slice(0, 180);
}

function extractAfterLabel(text, labelPattern, stopPattern) {
  const match = text.match(new RegExp(`${labelPattern}\\s+([\\s\\S]{12,260}?)(?=\\s+(?:${stopPattern})\\b|$)`, "i"));
  return match?.[1] ? sanitizeSnippet(match[1]) : "";
}

function extractEventFactSnippets(eventPage) {
  const text = normalizeWhitespace(eventPage.text || "");
  const facts = [];
  const pushFact = (label, value) => {
    const cleanValue = sanitizeSnippet(value)
      .replace(new RegExp(`^(?:${escapeRegExp(label)}\\s*)+`, "i"), "");
    if (cleanValue && !facts.some((fact) => fact.label === label || fact.text === cleanValue)) {
      facts.push({ label, text: cleanValue });
    }
  };

  pushFact("runtime", extractAfterLabel(text, "Run Time", "audience|content advisory|late seating|accessibility|dates|show dates"));
  pushFact("age guidance", extractAfterLabel(text, "Ages?", "content advisory|late seating|accessibility|dates|show dates|official tickets"));
  pushFact("content advisory", extractAfterLabel(text, "Content Advisory", "late seating|accessibility|dates|show dates|official tickets|video"));
  pushFact("late seating", extractAfterLabel(text, "Late Seating", "accessibility|dates|show dates|official tickets|video"));
  pushFact("accessibility", extractAfterLabel(text, "Accessibility", "dates|show dates|official tickets|video|theater"));

  const theaterMatch = text.match(/\b(Theater|Venue)\s+Learn more about the (?:theater|venue)\.\s+([\s\S]{12,260}?)(?=\s+(?:Read More|View Seating Map|Get Directions|More Theater|section icon|Reviews)\b|$)/i);
  if (theaterMatch?.[2]) {
    pushFact("venue notes", theaterMatch[2]);
  }

  const faqAgeMatch = text.match(/\bWhat is the age recommendation[^?]*\?\s+([\s\S]{12,180}?)(?=\s+[A-Z][^?]{8,80}\?|$)/i);
  if (faqAgeMatch?.[1]) {
    pushFact("age guidance", faqAgeMatch[1]);
  }

  const ticketSummary = eventPage.eventInfo?.ticketInfo?.summary;
  if (ticketSummary) {
    pushFact("ticket price", ticketSummary);
  }

  return facts.slice(0, 8);
}

function isIncompleteRawDate(value) {
  const text = toPlainText(value || "");
  return text && !/(?:\b\d{4}\b|\b\d{1,2}\/\d{1,2}\/\d{2,4}\b)/.test(text);
}

function chooseEventDateText(eventInfo = {}) {
  const rawDate = eventInfo.dates?.[0] || eventInfo.startDate || "";
  const displayDate = eventInfo.displayDateRange || eventInfo.displayDates?.[0] || eventInfo.displayStartDate || "";

  if (/\b2001\b/.test(displayDate) && isIncompleteRawDate(rawDate)) {
    return rawDate;
  }

  return displayDate || rawDate || "";
}

function isLowQualityLocation(value) {
  const text = toPlainText(value || "");
  return /\b(?:call us|contact us|customer service|my order|rating|reviews?|tickets? starting|navigation|menu icon|gift cards?|photos theater|aristocrats rub elbows)\b/i.test(text);
}

function chooseEventLocationText(eventPage) {
  const candidates = [
    ...extractLikelyLocations(eventPage.text || ""),
    ...(eventPage.eventInfo?.locations || []),
    eventPage.eventInfo?.location || ""
  ].map(toPlainText).filter(Boolean);

  return candidates.find((location) => !isLowQualityLocation(location)) || "";
}

function findFact(facts, label) {
  return facts.find((fact) => fact.label === label)?.text || "";
}

function compactAgeGuidance(value) {
  return sanitizeSnippet(value)
    .replace(/Recommended for ages 12 and up/i, "ages 12+")
    .replace(/Children under 4 are not permitted/i, "no children under 4")
    .replace(/Children under 12 are not permitted in Can-Can seats/i, "under 12 not in Can-Can seats")
    .replace(/[.]+/g, ";")
    .replace(/;$/g, "")
    .trim();
}

function compactContentAdvisory(value) {
  return sanitizeSnippet(value)
    .replace(/This production uses/i, "")
    .replace(/herbal cigarette smoke/i, "smoke")
    .replace(/some adult themes/i, "adult themes")
    .replace(/[.]+$/g, "")
    .trim();
}

function stripEndingPunctuation(value) {
  return sanitizeSnippet(value).replace(/[.,;:]+$/g, "");
}

function createProfilePriorityPhrase(profile) {
  const summary = profile.summary || "";
  const priorities = [];

  if (/\b(?:safety|reassurance|caregivers?)\b/i.test(summary)) priorities.push("caregiver reassurance");
  if (/\b(?:simple|simplicity|easy|concrete)\b/i.test(summary)) priorities.push("simple logistics");
  if (/\b(?:age-appropriate|child|children|kids?)\b/i.test(summary)) priorities.push("age-appropriate fit");
  if (/\b(?:fun|playful)\b/i.test(summary)) priorities.push("fun");
  if (/\b(?:comfort|accessible|accessibility|seating)\b/i.test(summary)) priorities.push("comfort and access");
  if (/\b(?:budget|cheap|afford|free|cost|value|money)\b/i.test(summary)) priorities.push("clear value");
  if (/\b(?:friends?|social|group|together|buddies|beer|beers|drink|drinks)\b/i.test(summary)) priorities.push("a social outing");
  if (/\b(?:speed|quick|business|productive|productivity|meeting|traveler|hassle)\b/i.test(summary)) priorities.push("efficient planning");
  if (/\b(?:learn|class|workshop|education|educational|hands-on|skill)\b/i.test(summary)) priorities.push("learning");

  return sentenceFromList([...new Set(priorities)].slice(0, 3), "clear practical details");
}

function createAdultPriorityPhrase(profile) {
  const summary = profile.summary || "";
  const priorities = [];

  if (/\b(?:friends?|buddies|group|together|beer|beers|drink|drinks)\b/i.test(summary)) {
    priorities.push("a relaxed adult group outing");
  }

  if (/\b(?:money|budget|cheap|afford|cost|spend)\b/i.test(summary)) {
    priorities.push("a manageable price");
  }

  if (/\b(?:adult|thirties|30s)\b/i.test(summary)) {
    priorities.push("adult-friendly plans");
  }

  return sentenceFromList([...new Set(priorities)].slice(0, 3), createProfilePriorityPhrase(profile));
}

function createSourceEvidencePhrase(comparison, facts) {
  const factLabels = facts.map((fact) => fact.label).filter((label) => label !== "ticket price").slice(0, 3);
  const signalLabels = (comparison.matchedSignals || []).map((signal) => signal.label).slice(0, 2);
  const evidence = [...factLabels, ...signalLabels].filter(Boolean);

  return sentenceFromList([...new Set(evidence)].slice(0, 4), "source-page details");
}

function createKeywordPhrase(comparison, facts) {
  const overlap = comparison.overlap || [];
  if (overlap.length) {
    return sentenceFromList(overlap.slice(0, 3), "the strongest event benefits");
  }

  const evidence = [
    ...(comparison.matchedSignals || []).map((signal) => signal.label),
    ...facts.map((fact) => fact.label).filter((label) => label !== "ticket price"),
    ...(comparison.eventKeywords || []).slice(0, 5)
  ];

  return sentenceFromList([...new Set(evidence)].slice(0, 3), "the strongest event benefits");
}

function createAdultWhyFitSection({ audience, eventName, profile, comparison, facts }) {
  const priorities = createAdultPriorityPhrase(profile);
  const ticketPrice = findFact(facts, "ticket price");
  const matchedLabels = (comparison.matchedSignals || []).map((signal) => signal.label);
  const sourceDetails = [
    matchedLabels.includes("social energy") ? "big musical/social energy" : "",
    ticketPrice ? `tickets from ${sanitizeSnippet(ticketPrice)}` : "",
    findFact(facts, "runtime") ? `runtime ${stripEndingPunctuation(findFact(facts, "runtime").replace(/including one intermission/i, "incl. intermission"))}` : ""
  ].filter(Boolean);

  if (sourceDetails.length) {
    return `${eventName} is a ${comparison.score || 0}% fit for ${audience}: the profile points to ${priorities}. The source supports ${sentenceFromList(sourceDetails, "practical event details")}, so the main check is whether the price and show format work for the group.`;
  }

  return `${eventName} is a ${comparison.score || 0}% fit for ${audience}: the profile points to ${priorities}, and the source supports that with ${createSourceEvidencePhrase(comparison, facts)}.`;
}

function createWhyFitSection({ audience, eventName, profile, comparison, facts }) {
  const priorities = createProfilePriorityPhrase(profile);
  const sourceEvidence = createSourceEvidencePhrase(comparison, facts);
  const score = comparison.score || 0;

  if (/child|kid|caregiver|parent/i.test(`${audience} ${profile.summary || ""}`)) {
    const ageGuidance = findFact(facts, "age guidance");
    const contentAdvisory = findFact(facts, "content advisory");
    const sourceNotes = [];

    if (ageGuidance) {
      sourceNotes.push(compactAgeGuidance(ageGuidance));
    }

    if (contentAdvisory) {
      sourceNotes.push(compactContentAdvisory(contentAdvisory));
    }

    if (sourceNotes.length) {
      return `Cautious ${score}% fit: the ${audience} profile wants ${priorities}. Source flags ${sentenceFromList(sourceNotes.slice(0, 2), sourceEvidence)}, so this needs a caregiver check.`;
    }

    return `${eventName} is a cautious ${score}% fit for ${audience}: the profile asks for ${priorities}, while the source points to ${sourceEvidence}. Treat it as promising only if the practical notes work for your child.`;
  }

  if (/adult|thirties|30s|beer|drink|buddies/i.test(`${audience} ${profile.summary || ""}`)) {
    return createAdultWhyFitSection({ audience, eventName, profile, comparison, facts });
  }

  return `${eventName} is a ${score}% fit for ${audience}: the profile asks for ${priorities}, and the source supports that with ${sourceEvidence}.`;
}

function createGoodToKnowSection({ audience, profile, facts, interestPhrase }) {
  const ageGuidance = findFact(facts, "age guidance");
  const contentAdvisory = findFact(facts, "content advisory");
  const accessibility = findFact(facts, "accessibility") || findFact(facts, "venue notes");
  const asSentence = (prefix, text) => {
    if (!text) {
      return "";
    }

    const cleanText = sanitizeSnippet(text).replace(/[.]+$/g, "");
    return `${prefix}: ${cleanText}.`;
  };

  if (/child|kid|caregiver|parent/i.test(`${audience} ${profile.summary || ""}`)) {
    const runtime = findFact(facts, "runtime");
    const ageAndContent = [
      ageGuidance ? compactAgeGuidance(ageGuidance) : "",
      contentAdvisory ? compactContentAdvisory(contentAdvisory) : ""
    ].filter(Boolean).join("; ");

    return [
      runtime ? asSentence("Runtime", runtime.replace(/including one intermission/i, "incl. intermission")) : "",
      asSentence("Age/content", ageAndContent),
      asSentence("Access", accessibility)
    ].filter(Boolean).join(" ") || "Check age guidance, content advisories, accessibility, and seating details before making this a child outing.";
  }

  return [
    asSentence("Age guidance", ageGuidance),
    asSentence("Content note", contentAdvisory),
    asSentence("Access note", accessibility)
  ].filter(Boolean).join(" ") || `This guide highlights ${interestPhrase} and the practical details that can help you decide whether to attend.`;
}

function createVisitDetailMessage(detailBits, eventPage) {
  if (!detailBits.length) {
    return eventPage.eventInfo?.sections?.[0]?.body
      || eventPage.description
      || "Check the event page for timing, access, location, and what to expect when you arrive.";
  }

  const dateDetail = detailBits.find((detail) => detail.startsWith("Date:"));
  const locationDetail = detailBits.find((detail) => detail.startsWith("Location:"));
  const dateText = dateDetail ? dateDetail.replace(/^Date:\s*/, "") : "";
  const locationText = locationDetail ? locationDetail.replace(/^Location:\s*/, "") : "";

  return [
    dateText ? `The event is scheduled for ${dateText}.` : "",
    locationText ? `It takes place at ${locationText}.` : "",
    eventPage.eventInfo?.ticketInfo?.summary ? `Tickets are listed from ${sanitizeSnippet(eventPage.eventInfo.ticketInfo.summary)}.` : "",
    "Check travel time, accessibility, seating, and arrival needs before you go."
  ].filter(Boolean).join(" ");
}

function createAudienceMessage(profile, interestPhrase) {
  const summary = profile.summary || "";

  if (/accessib|comfort|clarity|support|reliab|patient/i.test(summary)) {
    return "This guide focuses on clear timing, comfort, accessibility, and support so you can decide with confidence.";
  }

  if (/safety|caregiver|simple|fun|age|child|kid/i.test(summary)) {
    return "This guide highlights safety, simple logistics, and age-appropriate details so caregivers can plan with less friction.";
  }

  if (/budget|family|flexib|stroller|parents/i.test(summary)) {
    return "This guide emphasizes practical planning, family fit, cost, and flexibility so the visit feels manageable.";
  }

  if (/speed|business|productiv|meeting|traveler/i.test(summary)) {
    return "This guide keeps timing, location, and practical value easy to scan so the event can fit around a busy schedule.";
  }

  return `This guide highlights ${interestPhrase} and the practical details that can help you decide whether to attend.`;
}

function createProfileFitMessage(profile, interestPhrase) {
  const summary = profile.summary || "";
  const normalized = summary.toLowerCase();
  const needs = [];

  if (/friend|social|buddy|buddies|group|together|beer|drink/i.test(summary)) {
    needs.push("a relaxed social outing");
  }

  if (/budget|cheap|afford|free|cost|money|discount|value/i.test(summary)) {
    needs.push("clear value and a manageable cost");
  }

  if (/adult|thirties|30s|beer|drink/i.test(summary)) {
    needs.push("adult-friendly plans");
  }

  if (/family|parent|kid|child|stroller|caregiver/i.test(summary)) {
    needs.push("family-friendly logistics");
  }

  if (/speed|quick|business|productiv|meeting|traveler|hassle/i.test(summary)) {
    needs.push("efficient timing and low-friction planning");
  }

  if (/accessib|comfort|support|seating|transit|parking|reliab/i.test(summary)) {
    needs.push("comfort, access, and practical arrival details");
  }

  if (/learn|class|workshop|education|hands-on|skill/i.test(summary)) {
    needs.push("something useful or engaging to do");
  }

  const distinctNeeds = [...new Set(needs)].slice(0, 3);
  const needPhrase = distinctNeeds.length
    ? sentenceFromList(distinctNeeds, "")
    : `${interestPhrase} with enough detail to decide confidently`;

  if (!normalized.trim()) {
    return `If you care about ${needPhrase}, this event is worth a closer look because the details are easy to compare against your plans.`;
  }

  return `You are looking for ${needPhrase}. This event is worth comparing because the page surfaces details you can check against those priorities before deciding.`;
}

function createFitProofPoint(comparison) {
  const matchedCount = comparison.matchedSignals?.length || 0;
  const sharedKeywordCount = comparison.overlap?.length || 0;
  const unmetCount = comparison.unmetSignals?.length || 0;
  const ageAdjustment = comparison.ageScoreAdjustment || 0;
  const adjustments = [
    comparison.unmetNeedPenalty
      ? `subtracting ${comparison.unmetNeedPenalty} points for ${unmetCount} unmet need ${unmetCount === 1 ? "category" : "categories"}`
      : "",
    ageAdjustment
      ? `${ageAdjustment > 0 ? "adding" : "subtracting"} ${Math.abs(ageAdjustment)} points for age ${comparison.ageCompatibility?.status || "fit"}`
      : ""
  ].filter(Boolean);
  const adjustmentText = adjustments.length ? ` after ${sentenceFromList(adjustments, "")}` : "";
  const capText = Number.isFinite(comparison.ageScoreCap) && comparison.uncappedScore > comparison.ageScoreCap
    ? `, capped at ${comparison.ageScoreCap}% because of age guidance`
    : "";

  if (matchedCount && sharedKeywordCount) {
    return `${comparison.score}% fit${adjustmentText}${capText} from ${matchedCount} matched interest ${matchedCount === 1 ? "category" : "categories"} and ${sharedKeywordCount} shared profile/event ${sharedKeywordCount === 1 ? "keyword" : "keywords"}.`;
  }

  if (matchedCount) {
    return `${comparison.score}% fit${adjustmentText}${capText} from ${matchedCount} matched interest ${matchedCount === 1 ? "category" : "categories"} found in both the saved profile and event page.`;
  }

  if (sharedKeywordCount) {
    return `${comparison.score}% fit${adjustmentText}${capText} from ${sharedKeywordCount} shared profile/event ${sharedKeywordCount === 1 ? "keyword" : "keywords"}; no interest category matched on both sides.`;
  }

  return `0% fit${adjustmentText}${capText}: no saved interest category or profile keyword clearly matched the event page.`;
}

function createCategoryEvidenceMessage(comparison) {
  const matchedSignals = comparison.matchedSignals || [];

  if (!matchedSignals.length) {
    return "No interest category was shown unless it appeared in both the saved profile and the event page.";
  }

  const evidenceSummary = matchedSignals.slice(0, 3).map((signal) => {
    const profileEvidence = sentenceFromList(signal.profileEvidence.slice(0, 2), "profile language");
    const eventEvidence = sentenceFromList(signal.eventEvidence.slice(0, 2), "event page language");
    return `${signal.label} matched profile cues (${profileEvidence}) with event cues (${eventEvidence})`;
  });

  return `The category chips are shown only when saved-profile cues and event-page cues both support them: ${sentenceFromList(evidenceSummary, "")}.`;
}

function createVisitorGuide({ audience, eventName, profile, eventPage, comparison, interestPhrase, keywordPhrase, detailBits }) {
  const dateDetail = detailBits.find((detail) => detail.startsWith("Date:"));
  const locationDetail = detailBits.find((detail) => detail.startsWith("Location:"));
  const strongestSignals = keywordPhrase || "the event's clearest benefits";
  const profileFitMessage = createProfileFitMessage(profile, interestPhrase);

  return {
    title: "What to Know",
    opener: `${eventName} may be a good match if you are looking for ${interestPhrase}.`,
    reasons: [
      createCategoryEvidenceMessage(comparison),
      `The event page also highlights ${strongestSignals}, which can help you quickly understand what kind of experience to expect.`,
      profileFitMessage,
      locationDetail
        ? `${locationDetail.replace(/^Location:\s*/, "The event takes place at ")}, so you can check travel time, parking, and nearby transit before deciding.`
        : "Review the event location and access details before making plans."
    ],
    notes: [
      dateDetail
        ? `${dateDetail.replace(/^Date:\s*/, "The scheduled time is ")}. Check whether the duration and arrival timing work for your day.`
        : "Check the event time and expected duration before going.",
      "Look for practical details such as cost, accessibility, comfort, what to bring, and how active participation will be.",
      eventPage.sourceImages?.length || eventPage.images?.length
        ? "The source images give a sense of the atmosphere, but the event page is still the best place to confirm final details."
        : "If the event page has limited imagery, rely on the written details to understand the setting and format."
    ],
    close: `Use this page as a quick guide to decide whether ${eventName} fits your interests, schedule, and comfort level.`
  };
}

function createTailoredPageModel(profile, eventPage, comparison) {
  const audience = profile.title || "Event Guest";
  const eventName = eventPage.eventInfo?.name || eventPage.title || "This Event";
  const interestPhrase = sentenceFromList(comparison.interests, "the event details that matter most");
  const eventFacts = extractEventFactSnippets(eventPage);
  const keywordPhrase = createKeywordPhrase(comparison, eventFacts);
  const dateText = chooseEventDateText(eventPage.eventInfo);
  const locationText = chooseEventLocationText(eventPage);
  const ticketText = eventPage.eventInfo?.ticketInfo?.summary || "";
  const detailBits = [
    dateText ? `Date: ${dateText}` : "",
    locationText ? `Location: ${locationText}` : "",
    ticketText ? `Ticket price: ${sanitizeSnippet(ticketText)}` : ""
  ].filter(Boolean);
  const visitorGuide = createVisitorGuide({
    audience,
    eventName,
    profile,
    eventPage,
    comparison,
    interestPhrase,
    keywordPhrase,
    detailBits
  });

  return {
    eventName,
    audience,
    headline: eventName,
    subheadline: eventPage.description
      ? `${eventPage.description.slice(0, 180)}${eventPage.description.length > 180 ? "..." : ""}`
      : `A tailored guide that connects ${keywordPhrase} with this audience's likely needs.`,
    callToAction: "Plan My Visit",
    proofPoint: createFitProofPoint(comparison),
    eventDetails: detailBits,
    visitorGuide,
    sourceImage: eventPage.primaryImage?.url || "",
    sourceImages: eventPage.images || [],
    sections: [
      {
        title: "Why this may fit you",
        body: createWhyFitSection({ audience, eventName, profile, comparison, facts: eventFacts })
      },
      {
        title: "Plan your visit",
        body: createVisitDetailMessage(detailBits, eventPage)
      },
      {
        title: "Good to know",
        body: createGoodToKnowSection({ audience, profile, facts: eventFacts, interestPhrase })
      }
    ],
    highlights: comparison.interests
  };
}

module.exports = {
  compareProfileToEvent,
  createTailoredPageModel,
  extractEventPage,
  extractTicketInfoFromText,
  extractKeywords
};
