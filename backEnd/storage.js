const fs = require("node:fs/promises");
const path = require("node:path");

const OUTPUT_ROOT = path.join(__dirname, "generated");

function slugify(value) {
  return String(value || "custom-event")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70) || "custom-event";
}

async function saveGeneratedPage({ pageModel, html, assetManifest, analysis, digitalAssets = [] }) {
  const folderName = `${Date.now()}-${slugify(pageModel.eventName)}`;
  const outputDirectory = path.join(OUTPUT_ROOT, folderName);
  const assetDirectory = path.join(outputDirectory, "assets");
  await fs.mkdir(outputDirectory, { recursive: true });
  await fs.mkdir(assetDirectory, { recursive: true });

  const files = {
    html: path.join(outputDirectory, "index.html"),
    assets: path.join(outputDirectory, "magnific-assets.json"),
    analysis: path.join(outputDirectory, "analysis.json")
  };

  await Promise.all([
    fs.writeFile(files.html, html, "utf8"),
    fs.writeFile(files.assets, JSON.stringify(assetManifest, null, 2), "utf8"),
    fs.writeFile(files.analysis, JSON.stringify(analysis, null, 2), "utf8"),
    ...digitalAssets.map((asset) => (
      fs.writeFile(path.join(assetDirectory, asset.fileName), asset.content, "utf8")
    ))
  ]);

  return {
    folderName,
    outputDirectory,
    files
  };
}

module.exports = {
  OUTPUT_ROOT,
  saveGeneratedPage
};
