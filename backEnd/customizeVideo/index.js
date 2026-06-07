const { fetchEventPage: defaultFetchEventPage } = require("../eventReader");

const happyHorseModelSlug = "happy-horse-1";
const DEFAULT_VIDEO_TIMEOUT_MS = Number(process.env.HAPPY_HORSE_TIMEOUT_MS || 360000);
const HAPPY_HORSE_PROMPT_LIMIT = 2500;
const HAPPY_HORSE_IMAGE_LIMIT = 9;
const DEFAULT_MAGNIFIC_MCP_URL = "https://mcp.magnific.com";

class VideoGenerationError extends Error {
  constructor(message, code, statusCode = 400) {
    super(message);
    this.name = "VideoGenerationError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function truncateText(value, maxLength) {
  const text = normalizeText(value);
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 3).trim()}...`;
}

function normalizeTargetProfile(rawProfile) {
  if (!isPlainObject(rawProfile)) {
    throw new VideoGenerationError("targetProfile is required.", "VALIDATION_ERROR", 422);
  }

  const title = normalizeText(rawProfile.title || rawProfile.name || "Custom Profile");
  const summary = normalizeText(rawProfile.summary || rawProfile.description || rawProfile.needs || "");
  const tone = normalizeText(rawProfile.tone || rawProfile.recommendedTone || rawProfile.tonePreference || "");

  if (!title && !summary) {
    throw new VideoGenerationError("targetProfile must include a title or summary.", "VALIDATION_ERROR", 422);
  }

  return {
    ...rawProfile,
    title: title || "Custom Profile",
    summary,
    tone
  };
}

async function resolveEventSource(input, fetchEventPage = defaultFetchEventPage) {
  if (isPlainObject(input.eventSource)) {
    return input.eventSource;
  }

  if (input.eventUrl) {
    return fetchEventPage(input.eventUrl);
  }

  throw new VideoGenerationError("eventSource or eventUrl is required.", "VALIDATION_ERROR", 422);
}

function safeUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch (error) {
    return "";
  }
}

function addImageCandidate(images, value, label = "event image") {
  if (Array.isArray(value)) {
    value.forEach((item) => addImageCandidate(images, item, label));
    return;
  }

  if (isPlainObject(value)) {
    addImageCandidate(
      images,
      value.url || value.src || value.href || value.image || value.contentUrl,
      value.alt || value.title || value.type || label
    );
    return;
  }

  const url = safeUrl(value);
  if (!url || images.some((image) => image.url === url)) {
    return;
  }

  images.push({ type: "image", url, label });
}

function addTextSnippet(snippets, value) {
  if (Array.isArray(value)) {
    value.forEach((item) => addTextSnippet(snippets, item));
    return;
  }

  if (isPlainObject(value)) {
    addTextSnippet(snippets, value.title);
    addTextSnippet(snippets, value.name);
    addTextSnippet(snippets, value.heading);
    addTextSnippet(snippets, value.body);
    addTextSnippet(snippets, value.summary);
    addTextSnippet(snippets, value.description);
    addTextSnippet(snippets, value.text);
    addTextSnippet(snippets, value.location);
    addTextSnippet(snippets, value.startDate);
    addTextSnippet(snippets, value.date);
    addTextSnippet(snippets, value.ticketInfo?.summary);
    return;
  }

  const text = normalizeText(value);
  if (!text || snippets.includes(text)) {
    return;
  }

  snippets.push(text);
}

function extractEventAssets(eventSource, targetProfile) {
  if (!isPlainObject(eventSource)) {
    throw new VideoGenerationError("eventSource must be structured JSON.", "ASSET_EXTRACTION_ERROR", 422);
  }

  const images = [];
  const textSnippets = [];
  const eventInfo = eventSource.eventInfo || {};

  addImageCandidate(images, eventSource.images, "event image");
  addImageCandidate(images, eventSource.mediaAssets, "media asset");
  addImageCandidate(images, eventSource.sourceImages, "source image");
  addImageCandidate(images, eventSource.image, "event image");
  addImageCandidate(images, eventSource.ogImage || eventSource.og?.image, "open graph image");
  addImageCandidate(images, eventSource.twitterImage || eventSource.twitter?.image, "twitter image");
  addImageCandidate(images, eventInfo.image, "event info image");

  addTextSnippet(textSnippets, targetProfile.title);
  addTextSnippet(textSnippets, targetProfile.summary);
  addTextSnippet(textSnippets, targetProfile.tone);
  addTextSnippet(textSnippets, eventSource.title);
  addTextSnippet(textSnippets, eventSource.name);
  addTextSnippet(textSnippets, eventSource.description);
  addTextSnippet(textSnippets, eventSource.headings);
  addTextSnippet(textSnippets, eventSource.textSnippets);
  addTextSnippet(textSnippets, eventInfo.name);
  addTextSnippet(textSnippets, eventInfo.description);
  addTextSnippet(textSnippets, eventInfo.startDate);
  addTextSnippet(textSnippets, eventInfo.location);
  addTextSnippet(textSnippets, eventInfo.sections);
  addTextSnippet(textSnippets, eventInfo.ticketInfo);

  return {
    images: images.slice(0, HAPPY_HORSE_IMAGE_LIMIT),
    textSnippets: textSnippets.slice(0, 18)
  };
}

function getEventName(eventSource) {
  return normalizeText(eventSource.eventInfo?.name || eventSource.name || eventSource.title || "the event");
}

function createHappyHorsePrompt({ targetProfile, eventSource, assets }) {
  const eventName = getEventName(eventSource);
  const snippets = assets.textSnippets.slice(0, 10).join(" | ");
  const imageDirection = assets.images.length
    ? "Use the provided event images as visual anchors for image-to-video motion, matching their colors, composition, logos, and atmosphere without adding unreadable text."
    : "Create the teaser from the written event details only; use bold motion, clear event atmosphere, and no fake logos.";

  return truncateText([
    `Create a 10-second upbeat event teaser video for "${eventName}".`,
    `Target profile: ${targetProfile.title}. ${targetProfile.summary}`,
    targetProfile.tone ? `Preferred tone: ${targetProfile.tone}.` : "",
    snippets ? `Event details and usable copy cues: ${snippets}.` : "",
    imageDirection,
    "Tempo and feel: energetic, fun, creative, inviting, fast but polished.",
    "Structure: quick opening hook, lively middle with dynamic camera motion, celebratory final beat.",
    "Avoid dense on-screen text; if text appears, keep it minimal, crisp, and event-safe.",
    "High-quality cinematic event marketing teaser, bright sound effects, social-share ready."
  ].filter(Boolean).join(" "), HAPPY_HORSE_PROMPT_LIMIT);
}

function createHappyHorsePayload({ targetProfile, eventSource, assets }) {
  const prompt = createHappyHorsePrompt({ targetProfile, eventSource, assets });
  const payload = {
    slug: happyHorseModelSlug,
    duration: 10,
    aspectRatio: "16:9",
    resolution: "720p",
    prompt,
    withSoundEffects: true
  };

  if (assets.images.length) {
    payload.references = assets.images.map((image) => ({
      type: "image",
      url: image.url
    }));
  }

  return payload;
}

function normalizeAdapterResult(result, payload) {
  const videoUrl = result?.videoUrl || result?.url || result?.results?.url || result?.results?.originalUrl;
  if (!videoUrl) {
    throw new VideoGenerationError("Magnific did not return a video URL.", "GENERATION_ERROR", 502);
  }

  return {
    videoUrl,
    creationId: result.creationId || result.creationIdentifier || result.identifier || "happy-horse-video",
    status: result.status || "completed",
    model: happyHorseModelSlug,
    payload
  };
}

function createMockHappyHorseAdapter() {
  return {
    async generate(payload) {
      if (payload.slug !== happyHorseModelSlug) {
        throw new VideoGenerationError("Happy Horse payload used the wrong model slug.", "GENERATION_ERROR", 502);
      }

      return {
        videoUrl: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
        creationId: `mock-${happyHorseModelSlug}-${payload.references?.length ? "image" : "text"}`,
        status: "mock_completed"
      };
    }
  };
}

function getMagnificMcpToken() {
  const token = normalizeText(process.env.MAGNIFIC_MCP_TOKEN || process.env.MAGNIFIC_API_KEY);
  if (!token || token === "your_magnific_api_key_here") {
    return "";
  }

  return token;
}

function parseMcpResponseText(text) {
  const trimmed = normalizeText(text);
  if (!trimmed) {
    return {};
  }

  if (trimmed.startsWith("data:")) {
    const payloads = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.replace(/^data:\s*/, ""))
      .filter((line) => line && line !== "[DONE]");
    const lastPayload = payloads[payloads.length - 1] || "{}";
    return JSON.parse(lastPayload);
  }

  return JSON.parse(text);
}

async function readMcpResponse(response) {
  const text = await response.text();
  if (!text) {
    return {};
  }

  try {
    return parseMcpResponseText(text);
  } catch (error) {
    throw new VideoGenerationError("Magnific MCP returned an unreadable response.", "MCP_ERROR", 502);
  }
}

function findValueByKey(value, keys) {
  if (!value || typeof value !== "object") {
    return "";
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findValueByKey(item, keys);
      if (found) {
        return found;
      }
    }
    return "";
  }

  for (const key of keys) {
    if (typeof value[key] === "string" && value[key]) {
      return value[key];
    }
  }

  for (const nested of Object.values(value)) {
    const found = findValueByKey(nested, keys);
    if (found) {
      return found;
    }
  }

  return "";
}

function findFirstUrl(value) {
  if (typeof value === "string") {
    return safeUrl(value);
  }

  if (!value || typeof value !== "object") {
    return "";
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findFirstUrl(item);
      if (found) {
        return found;
      }
    }
    return "";
  }

  const directUrl = findValueByKey(value, ["videoUrl", "url", "originalUrl", "previewUrl"]);
  if (directUrl) {
    return safeUrl(directUrl);
  }

  for (const nested of Object.values(value)) {
    const found = findFirstUrl(nested);
    if (found) {
      return found;
    }
  }

  return "";
}

function findCreationIdentifier(value) {
  return findValueByKey(value, [
    "creationIdentifier",
    "identifier",
    "creationId",
    "id"
  ]);
}

function createMagnificMcpHappyHorseAdapter({
  mcpUrl = process.env.MAGNIFIC_MCP_URL || process.env.MAGNIFIC_API_BASE_URL || DEFAULT_MAGNIFIC_MCP_URL,
  fetchImpl = fetch,
  waitPolls = Number(process.env.MAGNIFIC_MCP_WAIT_POLLS || 12)
} = {}) {
  async function callTool(name, args, signal) {
    if (!mcpUrl) {
      throw new VideoGenerationError(
        "MAGNIFIC_MCP_URL is not configured. Set it to the Magnific MCP server URL, or set HAPPY_HORSE_USE_MOCK=true for local testing.",
        "MCP_ERROR",
        503
      );
    }

    const token = getMagnificMcpToken();
    const headers = {
      accept: "application/json, text/event-stream",
      "content-type": "application/json"
    };

    if (token) {
      headers.authorization = `Bearer ${token}`;
      headers["x-magnific-api-key"] = token;
    }

    const response = await fetchImpl(mcpUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        method: "tools/call",
        params: {
          name,
          arguments: args
        }
      }),
      signal
    });

    const body = await readMcpResponse(response);
    if (response.status === 401) {
      throw new VideoGenerationError(
        `Magnific MCP rejected ${name} with 401. Add a valid Magnific API key to .env as MAGNIFIC_API_KEY or MAGNIFIC_MCP_TOKEN.`,
        "MCP_AUTH_ERROR",
        401
      );
    }

    if (!response.ok || body.error) {
      const message = body.error?.message || `Magnific MCP ${name} returned ${response.status}.`;
      throw new VideoGenerationError(message, "MCP_ERROR", response.status || 502);
    }

    return body.result || body;
  }

  return {
    async generate(payload, { signal } = {}) {
      const generateResult = await callTool("video_generate", {
        video: {
          clips: [payload]
        }
      }, signal);
      const immediateUrl = findFirstUrl(generateResult);
      const creationId = findCreationIdentifier(generateResult);

      if (immediateUrl) {
        return {
          videoUrl: immediateUrl,
          creationId,
          status: "completed"
        };
      }

      if (!creationId) {
        throw new VideoGenerationError(
          "Magnific MCP did not return a creation identifier.",
          "MCP_ERROR",
          502
        );
      }

      let lastWaitResult = null;
      for (let poll = 0; poll < waitPolls; poll += 1) {
        lastWaitResult = await callTool("creations_wait", {
          identifiers: [creationId],
          timeoutSeconds: 25
        }, signal);

        const waitedUrl = findFirstUrl(lastWaitResult);
        if (waitedUrl) {
          return {
            videoUrl: waitedUrl,
            creationId,
            status: findValueByKey(lastWaitResult, ["status"]) || "completed"
          };
        }
      }

      const creation = await callTool("creations_get", {
        creationIdentifier: creationId
      });
      const finalUrl = findFirstUrl(creation);

      if (!finalUrl) {
        throw new VideoGenerationError(
          "Magnific MCP creation completed without a video URL.",
          "MCP_ERROR",
          502
        );
      }

      return {
        videoUrl: finalUrl,
        creationId,
        status: findValueByKey(creation, ["status"]) || findValueByKey(lastWaitResult, ["status"]) || "completed"
      };
    }
  };
}

function createDefaultHappyHorseAdapter() {
  if (process.env.HAPPY_HORSE_USE_MOCK === "true") {
    return createMockHappyHorseAdapter();
  }

  return createMagnificMcpHappyHorseAdapter();
}

function withTimeout(work, timeoutMs) {
  const controller = new AbortController();
  let timeoutId;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      reject(new VideoGenerationError("Happy Horse video generation timed out.", "VIDEO_TIMEOUT", 504));
    }, timeoutMs);
  });

  return Promise.race([
    Promise.resolve().then(() => work(controller.signal)),
    timeoutPromise
  ]).finally(() => clearTimeout(timeoutId));
}

async function generateCustomizedVideo(input, options = {}) {
  const sourceInput = isPlainObject(input) ? input : {};
  const targetProfile = normalizeTargetProfile(sourceInput.targetProfile || sourceInput.profile);
  const eventSource = await resolveEventSource(sourceInput, options.fetchEventPage || defaultFetchEventPage);
  const assets = extractEventAssets(eventSource, targetProfile);
  const payload = createHappyHorsePayload({ targetProfile, eventSource, assets });
  const adapter = options.adapter || createDefaultHappyHorseAdapter();
  const timeoutMs = options.timeoutMs || DEFAULT_VIDEO_TIMEOUT_MS;
  const result = await withTimeout(
    (signal) => adapter.generate(payload, { signal, targetProfile, eventSource, assets }),
    timeoutMs
  );

  return normalizeAdapterResult(result, payload);
}

function getStatusCode(error) {
  if (error instanceof VideoGenerationError) {
    return error.statusCode;
  }

  return 400;
}

async function handleCreateVideo(request, response, { readJsonBody, sendJson }) {
  try {
    const body = await readJsonBody(request);
    const video = await generateCustomizedVideo(body);

    sendJson(response, 201, {
      ok: true,
      videoUrl: video.videoUrl,
      creationId: video.creationId,
      status: video.status,
      model: video.model,
      video
    });
  } catch (error) {
    const code = error.code || "VIDEO_GENERATION_ERROR";
    sendJson(response, getStatusCode(error), {
      ok: false,
      code,
      error: error.message
    });
  }
}

module.exports = {
  DEFAULT_VIDEO_TIMEOUT_MS,
  VideoGenerationError,
  createDefaultHappyHorseAdapter,
  createHappyHorsePayload,
  createMagnificMcpHappyHorseAdapter,
  createMockHappyHorseAdapter,
  extractEventAssets,
  getMagnificMcpToken,
  generateCustomizedVideo,
  handleCreateVideo,
  happyHorseModelSlug
};
