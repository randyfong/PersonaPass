const { pathToFileURL } = require("node:url");
const { compareProfileToEvent, createTailoredPageModel } = require("../contentAnalyzer");
const { createDigitalAssets } = require("../digitalAssets");
const { fetchEventPage } = require("../eventReader");
const { createAssetPrompt } = require("../magnificAssets");
const { renderTailoredPage } = require("../pageRenderer");
const { saveGeneratedPage } = require("../storage");
const { addTicketPriceResearch } = require("../ticketResearch");

function normalizeProfile(profile) {
  if (!profile || typeof profile !== "object") {
    throw new Error("Saved profile is required.");
  }

  return {
    title: String(profile.title || "Custom Profile").trim(),
    summary: String(profile.summary || "").trim()
  };
}

async function createCustomizedWebPage({ profile: rawProfile, eventUrl }) {
  const profile = normalizeProfile(rawProfile);
  const fetchedEventPage = await fetchEventPage(eventUrl);
  const eventPage = await addTicketPriceResearch(profile, fetchedEventPage);
  const comparison = compareProfileToEvent(profile, eventPage);
  const pageModel = createTailoredPageModel(profile, eventPage, comparison);
  const assetManifest = createAssetPrompt(pageModel, eventPage, comparison);
  const digitalAssets = createDigitalAssets({ pageModel, eventPage, comparison, assetManifest });
  const html = renderTailoredPage({ pageModel, eventPage, assetManifest, digitalAssets });
  const saved = await saveGeneratedPage({
    pageModel,
    html,
    assetManifest,
    analysis: { profile, eventPage, comparison, pageModel, digitalAssets },
    digitalAssets
  });

  return {
    saved,
    pageModel,
    assetManifest,
    digitalAssets,
    comparison
  };
}

async function handleCreateWebPage(request, response, { readJsonBody, sendJson }) {
  const body = await readJsonBody(request);
  const { saved, pageModel, assetManifest, digitalAssets, comparison } = await createCustomizedWebPage(body);

  sendJson(response, 201, {
    ok: true,
    page: {
      title: pageModel.headline,
      url: `/generated/${saved.folderName}/index.html`,
      fileUrl: pathToFileURL(saved.files.html).href,
      outputDirectory: saved.outputDirectory
    },
    magnificAssets: assetManifest,
    digitalAssets: digitalAssets.map(({ id, fileName, relativeUrl, contentType }) => ({
      id,
      fileName,
      relativeUrl: `/generated/${saved.folderName}/${relativeUrl}`,
      contentType
    })),
    comparison
  });
}

module.exports = {
  createCustomizedWebPage,
  handleCreateWebPage,
  normalizeProfile
};
