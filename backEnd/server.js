const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const { loadEnvFile } = require("./env");

loadEnvFile();

const { handleCreateVideo } = require("./customizeVideo");
const { handleCreateWebPage } = require("./customizeWebPage");
const {
  handleCreateHappyHorseVideoJob,
  handleGetHappyHorseVideoJob
} = require("./happyHorseVideo");
const { OUTPUT_ROOT } = require("./storage");

const PORT = Number(process.env.PORT || 3001);

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type"
  });
  response.end(JSON.stringify(payload));
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error("Request body is too large."));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(new Error("Request body must be valid JSON."));
      }
    });
    request.on("error", reject);
  });
}

function getContentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const contentTypes = {
    ".html": "text/html; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp"
  };

  return contentTypes[extension] || "application/octet-stream";
}

async function serveGeneratedFile(request, response) {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);
  const relativePath = requestUrl.pathname.replace(/^\/generated\//, "");
  const filePath = path.join(OUTPUT_ROOT, relativePath);
  const rootWithSeparator = `${OUTPUT_ROOT}${path.sep}`;

  if (!filePath.startsWith(rootWithSeparator)) {
    sendJson(response, 403, { ok: false, error: "Forbidden." });
    return;
  }

  try {
    const file = await fs.readFile(filePath);
    const contentType = getContentType(filePath);

    response.writeHead(200, { "content-type": contentType });
    response.end(file);
  } catch (error) {
    sendJson(response, 404, { ok: false, error: "Generated file was not found." });
  }
}

const server = http.createServer(async (request, response) => {
  try {
    if (request.method === "OPTIONS") {
      sendJson(response, 204, {});
      return;
    }

    if (request.method === "GET" && request.url === "/health") {
      sendJson(response, 200, { ok: true });
      return;
    }

    if (request.method === "POST" && request.url === "/api/create-web-page") {
      await handleCreateWebPage(request, response, { readJsonBody, sendJson });
      return;
    }

    if (request.method === "POST" && request.url === "/api/create-video") {
      await handleCreateVideo(request, response, { readJsonBody, sendJson });
      return;
    }

    if (request.method === "POST" && request.url === "/api/happyhorse-video-jobs") {
      await handleCreateHappyHorseVideoJob(request, response, { readJsonBody, sendJson });
      return;
    }

    if (request.method === "GET" && request.url.startsWith("/api/happyhorse-video-jobs/")) {
      await handleGetHappyHorseVideoJob(request, response, { sendJson });
      return;
    }

    if (request.method === "GET" && request.url.startsWith("/generated/")) {
      await serveGeneratedFile(request, response);
      return;
    }

    sendJson(response, 404, { ok: false, error: "Route not found." });
  } catch (error) {
    sendJson(response, 400, { ok: false, error: error.message });
  }
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`CustomBrochure backend listening on http://localhost:${PORT}`);
  });
}

module.exports = {
  server,
  handleCreateHappyHorseVideoJob,
  handleGetHappyHorseVideoJob,
  handleCreateVideo,
  handleCreateWebPage
};
