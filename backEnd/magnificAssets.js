function normalizePromptText(value) {
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
    ldquo: "\"",
    rdquo: "\"",
    lsquo: "'",
    rsquo: "'"
  };
  let text = String(value || "");

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

function createAssetPrompt(pageModel, eventPage, comparison) {
  const highlights = pageModel.highlights.length
    ? pageModel.highlights.join(", ")
    : "welcoming event details";
  const sourceImage = pageModel.sourceImage
    ? `Use this source event image as visual reference: ${pageModel.sourceImage}.`
    : "No usable source event image was found, so infer visuals from the event page details.";
  const eventDetails = (pageModel.eventDetails || [])
    .map((detail) => normalizePromptText(detail.replace(":", "").toLowerCase()))
    .join(", ");
  const eventCues = normalizePromptText(
    eventPage.eventInfo?.description
      || eventPage.description
      || eventPage.headings.join(", ")
      || eventPage.sourceUrl
  );

  return {
    provider: "magnific-mcp",
    status: "local_assets_created_and_ready_for_magnific_replacement",
    assets: [
      {
        id: "hero",
        fileName: "hero.png",
        fallbackUrl: "assets/hero.svg",
        aspectRatio: "16:9",
        prompt: [
          `Create a polished hero image for "${pageModel.eventName}" tailored to ${pageModel.audience}.`,
          sourceImage,
          eventDetails ? `Event details: ${eventDetails}.` : "",
          `Visual priorities: ${normalizePromptText(highlights)}.`,
          "Style: premium editorial event web page, realistic lighting, inviting composition, no text in image."
        ].filter(Boolean).join(" ")
      },
      {
        id: "detail",
        fileName: "detail.png",
        fallbackUrl: "assets/detail.svg",
        aspectRatio: "4:3",
        prompt: [
          `Create a supporting event detail image for ${normalizePromptText(pageModel.audience)}.`,
          sourceImage,
          `Use cues from this event page: ${eventCues}.`,
          `Emphasize ${normalizePromptText(comparison.interests.join(", ") || "clarity, value, and ease")}. No text in image.`
        ].filter(Boolean).join(" ")
      }
    ]
  };
}

module.exports = {
  createAssetPrompt
};
