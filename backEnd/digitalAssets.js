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

function escapeXml(value) {
  return normalizeDisplayText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function wrapText(value, maxLineLength = 28, maxLines = 4) {
  const words = String(value || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";

  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxLineLength && current) {
      lines.push(current);
      current = word;
      return;
    }

    current = next;
  });

  if (current) {
    lines.push(current);
  }

  return lines.slice(0, maxLines);
}

function textLines(lines, x, y, size, color = "#ffffff", weight = 800, lineHeight = 1.15) {
  return lines.map((line, index) => (
    `<text x="${x}" y="${y + (index * size * lineHeight)}" fill="${color}" font-size="${size}" font-weight="${weight}">${escapeXml(line)}</text>`
  )).join("\n");
}

function createHeroSvg(pageModel) {
  const headline = wrapText(pageModel.headline, 26, 3);
  const subheadline = wrapText(pageModel.subheadline, 54, 3);
  const highlights = pageModel.highlights.slice(0, 4);
  const details = pageModel.eventDetails || [];

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900" role="img" aria-label="${escapeXml(pageModel.headline)}">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0f6b56"/>
      <stop offset="0.58" stop-color="#26766a"/>
      <stop offset="1" stop-color="#b35f37"/>
    </linearGradient>
    <radialGradient id="light" cx="68%" cy="22%" r="62%">
      <stop offset="0" stop-color="#ffe7b8" stop-opacity="0.86"/>
      <stop offset="1" stop-color="#ffe7b8" stop-opacity="0"/>
    </radialGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="18" stdDeviation="22" flood-color="#0d3029" flood-opacity="0.24"/>
    </filter>
  </defs>
  <rect width="1600" height="900" fill="url(#sky)"/>
  <rect width="1600" height="900" fill="url(#light)"/>
  <path d="M0 628 C210 526 346 690 557 598 C755 512 832 328 1078 393 C1297 450 1392 544 1600 442 L1600 900 L0 900 Z" fill="#f7f1e7" opacity="0.92"/>
  <path d="M1020 182 C1128 116 1278 135 1376 232 C1476 332 1492 483 1417 590 C1337 704 1169 722 1045 643 C914 560 882 369 963 245 C978 222 995 201 1020 182 Z" fill="#fff8ec" opacity="0.92" filter="url(#shadow)"/>
  <circle cx="1206" cy="394" r="156" fill="#e7f2ee"/>
  <path d="M1091 435 C1140 365 1192 334 1255 340 C1320 348 1371 398 1395 474 C1346 525 1285 550 1212 548 C1149 546 1102 507 1091 435 Z" fill="#126853"/>
  <path d="M1130 430 C1169 392 1210 376 1255 382 C1304 388 1340 421 1358 471 C1316 498 1272 511 1225 508 C1182 504 1147 478 1130 430 Z" fill="#f0b66d"/>
  <g transform="translate(96 160)">
${textLines(headline, 0, 86, 86)}
${textLines(subheadline, 4, 368, 31, "#ffffff", 600, 1.35)}
  </g>
  <g transform="translate(100 710)">
    ${highlights.map((highlight, index) => {
      const x = index * 250;
      return `<g transform="translate(${x} 0)">
      <rect x="0" y="0" width="222" height="54" rx="12" fill="#ffffff" opacity="0.95"/>
      <text x="18" y="35" fill="#126853" font-size="22" font-weight="900">${escapeXml(highlight)}</text>
    </g>`;
    }).join("\n")}
  </g>
  <g transform="translate(1020 675)">
    ${details.map((detail, index) => (
      `<text x="0" y="${index * 34}" fill="#126853" font-size="25" font-weight="900">${escapeXml(detail)}</text>`
    )).join("\n")}
  </g>
</svg>`;
}

function createDetailSvg(pageModel, comparison) {
  const sections = pageModel.sections.slice(0, 3);
  const score = comparison.score || 0;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="900" viewBox="0 0 1800 900" role="img" aria-label="Profile and event fit summary">
  <rect width="1800" height="900" fill="#fbfaf7"/>
  <rect x="70" y="60" width="1660" height="780" rx="28" fill="#ffffff" stroke="#d7ded7" stroke-width="4"/>
  <text x="130" y="132" fill="#126853" font-size="32" font-weight="900">TAILORED EVENT GUIDE</text>
  <text x="130" y="214" fill="#17201c" font-size="82" font-weight="900">${escapeXml(pageModel.audience)}</text>
  <g transform="translate(1510 94)">
    <circle cx="82" cy="82" r="82" fill="#eaf3ef"/>
    <circle cx="82" cy="82" r="60" fill="#126853"/>
    <text x="82" y="89" text-anchor="middle" fill="#ffffff" font-size="42" font-weight="900">${score}%</text>
    <text x="82" y="132" text-anchor="middle" fill="#ffffff" font-size="18" font-weight="800">FIT</text>
  </g>
  ${sections.map((section, index) => {
    const y = 316 + (index * 178);
    const bodyLines = wrapText(section.body, 102, 3);
    return `<g transform="translate(130 ${y})">
      <rect x="0" y="-46" width="1540" height="146" rx="20" fill="#f2f5f1"/>
      <circle cx="48" cy="20" r="30" fill="#b65f34"/>
      <text x="48" y="31" text-anchor="middle" fill="#ffffff" font-size="30" font-weight="900">${index + 1}</text>
      <text x="110" y="-6" fill="#17201c" font-size="34" font-weight="900">${escapeXml(section.title)}</text>
      ${textLines(bodyLines, 110, 40, 25, "#3f4a45", 700, 1.22)}
    </g>`;
  }).join("\n")}
  <path d="M1512 760 C1560 716 1625 710 1676 746 C1628 796 1564 819 1480 812 C1483 791 1493 774 1512 760 Z" fill="#126853"/>
</svg>`;
}

function createDigitalAssets({ pageModel, comparison }) {
  return [
    {
      id: "hero",
      fileName: "hero.svg",
      relativeUrl: "assets/hero.svg",
      contentType: "image/svg+xml",
      content: createHeroSvg(pageModel)
    },
    {
      id: "detail",
      fileName: "detail.svg",
      relativeUrl: "assets/detail.svg",
      contentType: "image/svg+xml",
      content: createDetailSvg(pageModel, comparison)
    }
  ];
}

module.exports = {
  createDigitalAssets
};
