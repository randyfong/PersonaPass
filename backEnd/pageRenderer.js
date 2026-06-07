function normalizeDisplayText(value) {
  let text = String(value || "");
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

  for (let pass = 0; pass < 3; pass += 1) {
    const decoded = text
      .replace(/&(?:(?:amp);?)*nbsp;?/gi, " ")
      .replace(/&#(\d+);?/g, (_, code) => String.fromCharCode(Number(code)))
      .replace(/&#x([0-9a-f]+);?/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
      .replace(/&([a-z]+);?/gi, (match, entity) => entityMap[entity.toLowerCase()] ?? match);

    if (decoded === text) {
      break;
    }

    text = decoded;
  }

  return text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function escapeHtml(value) {
  return normalizeDisplayText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderHighlights(highlights) {
  return highlights.map((highlight) => `<li>${escapeHtml(highlight)}</li>`).join("\n");
}

function renderSections(sections) {
  return sections.map((section) => `
        <article>
          <h2>${escapeHtml(section.title)}</h2>
          <p>${escapeHtml(section.body)}</p>
        </article>`).join("\n");
}

function renderEventDetails(details) {
  if (!details.length) {
    return "";
  }

  return `<dl class="event-details">
${details.map((detail) => {
    const [label, ...valueParts] = detail.split(":");
    return `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(valueParts.join(":").trim())}</dd></div>`;
  }).join("\n")}
      </dl>`;
}

function renderSourceImages(images) {
  const displayImages = images.map((image) => {
    const combined = `${image.url || ""} ${image.alt || ""} ${image.source || ""}`.toLowerCase();
    const placeholder = image.placeholder
      || /\b(loading|spinner|placeholder|loader)\b/.test(combined)
      || /\.gif(?:[?#]|$)/.test(image.url || "")
      || /tribe-loading|loading\.gif|spinner\.gif|ajax-loader/.test(combined);

    return { ...image, placeholder };
  });
  if (!displayImages.length) {
    return "";
  }

  return `<section class="source-images" aria-label="Images found on the source event page">
      <h2>Source Event Images</h2>
      <div class="source-image-grid">
${displayImages.slice(0, 4).map((image) => {
    return image.placeholder ? `
        <figure>
          <div class="image-loading-tile">Image Loading</div>
          <figcaption>${escapeHtml(image.alt || image.source || "Image loading")}</figcaption>
        </figure>` : `
        <figure>
          <img src="${escapeHtml(image.url)}" alt="${escapeHtml(image.alt || "Source event image")}">
          <figcaption>${escapeHtml(image.alt || image.source || "Source event image")}</figcaption>
        </figure>`;
  }).join("\n")}
      </div>
    </section>`;
}

function renderGuideList(items) {
  return items.map((item) => `<li>${escapeHtml(item)}</li>`).join("\n");
}

function renderVisitorGuide(visitorGuide) {
  if (!visitorGuide) {
    return "";
  }

  return `<section class="visitor-guide" aria-labelledby="visitor-guide-title">
      <div class="guide-copy">
        <p class="eyebrow">Visitor Guide</p>
        <h2 id="visitor-guide-title">${escapeHtml(visitorGuide.title || "What to Know")}</h2>
        <p>${escapeHtml(visitorGuide.opener)}</p>
        <p>${escapeHtml(visitorGuide.close)}</p>
      </div>
      <article class="guide-card">
        <h3>Why It May Appeal</h3>
        <ul>
${renderGuideList(visitorGuide.reasons || [])}
        </ul>
      </article>
      <article class="guide-card">
        <h3>Good to Know</h3>
        <ul>
${renderGuideList(visitorGuide.notes || [])}
        </ul>
      </article>
    </section>`;
}

function renderImageLoadingScript() {
  return `<script>
    document.querySelectorAll(".source-image-grid img").forEach((image) => {
      if (!/\\.gif(?:[?#]|$)/i.test(image.currentSrc || image.src || "")) {
        return;
      }

      const placeholder = document.createElement("div");
      placeholder.className = "image-loading-tile";
      placeholder.textContent = "Image Loading";
      image.replaceWith(placeholder);
    });
  </script>`;
}

function renderTailoredPage({ pageModel, eventPage, assetManifest, digitalAssets = [] }) {
  const heroAsset = pageModel.sourceImage || digitalAssets.find((asset) => asset.id === "hero")?.relativeUrl || "assets/hero.svg";
  const detailAsset = digitalAssets.find((asset) => asset.id === "detail")?.relativeUrl || "assets/detail.svg";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(pageModel.headline)}</title>
  <style>
    :root {
      color-scheme: light;
      --ink: #17201c;
      --muted: #5d6761;
      --paper: #fbfaf7;
      --surface: #ffffff;
      --line: #d7ded7;
      --accent: #126853;
      --accent-2: #b65f34;
      --soft: #eaf3ef;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: var(--ink);
      background: var(--paper);
      overflow-wrap: break-word;
    }

    .hero {
      min-height: 760px;
      display: grid;
      align-items: end;
      padding: 36px;
      background:
        linear-gradient(90deg, rgba(18, 104, 83, 0.86), rgba(18, 104, 83, 0.18)),
        url("${escapeHtml(heroAsset)}") center / cover no-repeat;
      color: #ffffff;
    }

    .hero-inner,
    .content {
      width: min(1760px, calc(100vw - 72px));
      margin: 0 auto;
    }

    .source {
      display: inline-flex;
      max-width: 100%;
      margin-bottom: 20px;
      color: #ffffff;
      font-weight: 800;
      overflow-wrap: anywhere;
    }

    h1 {
      max-width: 1120px;
      margin: 0 0 18px;
      font-size: 6.2rem;
      line-height: 0.92;
      letter-spacing: 0;
    }

    .lead {
      max-width: 860px;
      margin: 0 0 28px;
      color: rgba(255, 255, 255, 0.9);
      font-size: 1.28rem;
      line-height: 1.5;
    }

    .button {
      display: inline-grid;
      min-height: 52px;
      padding: 0 22px;
      place-items: center;
      border-radius: 8px;
      background: #ffffff;
      color: var(--accent);
      font-weight: 900;
      text-decoration: none;
    }

    .event-details {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 10px;
      max-width: 100%;
      margin: 0 0 28px;
    }

    .event-details div {
      padding: 10px 14px;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.92);
      color: var(--ink);
    }

    .event-details dt {
      font-size: 0.75rem;
      color: var(--accent);
      font-weight: 900;
      text-transform: uppercase;
    }

    .event-details dd {
      margin: 2px 0 0;
      font-weight: 800;
    }

    .content {
      display: grid;
      gap: 28px;
      padding: 42px 0 64px;
    }

    .eyebrow {
      margin: 0 0 8px;
      color: var(--accent);
      font-size: 0.78rem;
      font-weight: 900;
      letter-spacing: 0;
      text-transform: uppercase;
    }

    .proof {
      display: grid;
      grid-template-columns: minmax(280px, 360px) minmax(0, 1fr);
      gap: 24px;
      align-items: start;
    }

    article p {
      color: var(--muted);
      line-height: 1.65;
    }

    .proof > div {
      display: grid;
      align-content: start;
      gap: 18px;
      padding: 26px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--surface);
    }

    .detail-asset {
      width: 100%;
      height: clamp(360px, 31vw, 560px);
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--surface);
      box-shadow: 0 18px 44px rgba(23, 32, 28, 0.08);
      object-fit: cover;
    }

    .sections {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 16px;
    }

    .visitor-guide {
      display: grid;
      grid-template-columns: minmax(380px, 0.9fr) repeat(2, minmax(320px, 1fr));
      gap: 16px;
      align-items: stretch;
      padding: 26px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--soft);
    }

    .guide-copy h2 {
      margin: 0 0 12px;
      font-size: 2.45rem;
      line-height: 1;
      letter-spacing: 0;
    }

    .guide-copy p {
      margin: 0 0 14px;
      color: var(--muted);
      line-height: 1.6;
    }

    .guide-card {
      background: rgba(255, 255, 255, 0.76);
    }

    .guide-card h3 {
      margin: 0 0 12px;
      font-size: 1.15rem;
      letter-spacing: 0;
    }

    .guide-card ul {
      display: grid;
      gap: 10px;
      margin: 0;
      padding-left: 18px;
      color: var(--muted);
      line-height: 1.5;
    }

    .source-images {
      display: grid;
      gap: 14px;
    }

    .source-images h2 {
      margin: 0;
      font-size: 1.35rem;
    }

    .source-image-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 12px;
    }

    figure {
      margin: 0;
      border: 1px solid var(--line);
      border-radius: 8px;
      overflow: hidden;
      background: var(--surface);
    }

    figure img {
      width: 100%;
      aspect-ratio: 4 / 3;
      object-fit: cover;
      display: block;
    }

    .image-loading-tile {
      display: grid;
      width: 100%;
      aspect-ratio: 4 / 3;
      place-items: center;
      background: #f2f5f1;
      color: var(--muted);
      font-size: 1.2rem;
      font-weight: 900;
    }

    figcaption {
      padding: 10px;
      color: var(--muted);
      font-size: 0.85rem;
      line-height: 1.35;
    }

    article {
      padding: 22px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--surface);
    }

    article h2 {
      margin: 0 0 12px;
      font-size: 1.25rem;
      letter-spacing: 0;
    }

    .highlights {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      padding: 0;
      margin: 0;
      list-style: none;
    }

    .highlights li {
      padding: 8px 12px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--surface);
      color: var(--accent);
      font-weight: 800;
    }

    @media (max-width: 1180px) {
      .hero-inner,
      .content {
        width: min(100% - 44px, 1120px);
      }

      .hero {
        min-height: 680px;
      }

      h1 {
        max-width: 940px;
        font-size: 4.8rem;
      }

      .proof,
      .visitor-guide {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 720px) {
      .hero-inner,
      .content {
        width: min(100% - 28px, 100%);
      }

      .hero {
        min-height: 640px;
        padding: 22px 0;
      }

      h1 {
        font-size: 3.2rem;
      }

      .lead {
        font-size: 1.05rem;
      }

      .source {
        font-size: 0.92rem;
      }

      .content {
        padding: 24px 0 42px;
      }

      .event-details {
        grid-template-columns: 1fr;
      }

      .proof > div,
      .visitor-guide,
      article {
        padding: 18px;
      }

      .proof,
      .visitor-guide,
      .sections,
      .source-image-grid {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <header class="hero">
    <div class="hero-inner">
      <a class="source" href="${escapeHtml(eventPage.sourceUrl)}">${escapeHtml(eventPage.sourceUrl)}</a>
      <h1>${escapeHtml(pageModel.headline)}</h1>
      <p class="lead">${escapeHtml(pageModel.subheadline)}</p>
      ${renderEventDetails(pageModel.eventDetails || [])}
      <a class="button" href="${escapeHtml(eventPage.sourceUrl)}">${escapeHtml(pageModel.callToAction)}</a>
    </div>
  </header>

  <main class="content">
    <section class="proof">
      <div>
        <ul class="highlights">
${renderHighlights(pageModel.highlights)}
        </ul>
      </div>
      <img class="detail-asset" src="${escapeHtml(detailAsset)}" alt="Tailored profile and event fit summary">
    </section>

    ${renderVisitorGuide(pageModel.visitorGuide)}

    <section class="sections">
${renderSections(pageModel.sections)}
    </section>

    ${renderSourceImages(pageModel.sourceImages || [])}
  </main>
  ${renderImageLoadingScript()}
</body>
</html>`;
}

module.exports = {
  renderTailoredPage
};
