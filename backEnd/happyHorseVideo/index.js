const crypto = require("node:crypto");
const { fetchEventPage: defaultFetchEventPage } = require("../eventReader");

const DEFAULT_MODEL = process.env.HAPPY_HORSE_ALIBABA_MODEL || "wan2.6-t2v";
const DEFAULT_SIZE = process.env.HAPPY_HORSE_ALIBABA_SIZE || "1280*720";
const DEFAULT_BASE_URL = process.env.DASHSCOPE_BASE_URL || "https://dashscope-intl.aliyuncs.com";
const DEFAULT_MCP_GENERATE_TOOL = process.env.ALIBABA_MODEL_STUDIO_MCP_GENERATE_TOOL || "video_generation";
const DEFAULT_MCP_STATUS_TOOL = process.env.ALIBABA_MODEL_STUDIO_MCP_STATUS_TOOL || "get_task";
const DEFAULT_POLL_INTERVAL_MS = Number(process.env.HAPPY_HORSE_JOB_POLL_INTERVAL_MS || 5000);
const DEFAULT_MAX_POLLS = Number(process.env.HAPPY_HORSE_JOB_MAX_POLLS || 120);
const HAPPY_HORSE_DURATION_SECONDS = 10;
const HAPPY_HORSE_PROMPT_LIMIT = 1500;

const jobs = new Map();

class HappyHorseVideoError extends Error {
  constructor(message, code, statusCode = 400) {
    super(message);
    this.name = "HappyHorseVideoError";
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

function safeUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch (error) {
    return "";
  }
}

function normalizeProfile(rawProfile) {
  if (!isPlainObject(rawProfile)) {
    throw new HappyHorseVideoError("Profile is required.", "VALIDATION_ERROR", 422);
  }

  const title = normalizeText(rawProfile.title || rawProfile.name || "Saved Persona");
  const summary = normalizeText(rawProfile.summary || rawProfile.description || rawProfile.needs || "");
  const tone = normalizeText(rawProfile.tone || rawProfile.recommendedTone || "");

  if (!title && !summary && !tone) {
    throw new HappyHorseVideoError("Profile must include usable details.", "VALIDATION_ERROR", 422);
  }

  return {
    title: title || "Saved Persona",
    summary,
    tone
  };
}

async function resolveEventSource(input, fetchEventPage = defaultFetchEventPage) {
  if (isPlainObject(input.eventSource)) {
    return input.eventSource;
  }

  const eventUrl = safeUrl(input.eventUrl);
  if (!eventUrl) {
    throw new HappyHorseVideoError("Event URL is required.", "VALIDATION_ERROR", 422);
  }

  return fetchEventPage(eventUrl);
}

function addSnippet(snippets, value) {
  if (Array.isArray(value)) {
    value.forEach((item) => addSnippet(snippets, item));
    return;
  }

  if (isPlainObject(value)) {
    [
      value.name,
      value.title,
      value.heading,
      value.summary,
      value.description,
      value.body,
      value.text,
      value.location,
      value.startDate,
      value.date,
      value.ticketInfo?.summary
    ].forEach((item) => addSnippet(snippets, item));
    return;
  }

  const text = normalizeText(value);
  if (text && !snippets.includes(text)) {
    snippets.push(text);
  }
}

function getEventName(eventSource) {
  return normalizeText(eventSource.eventInfo?.name || eventSource.name || eventSource.title || "the event");
}

function createHappyHorseVideoPrompt({ profile, eventSource }) {
  const eventName = getEventName(eventSource);
  const snippets = [];
  const eventInfo = eventSource.eventInfo || {};

  addSnippet(snippets, eventSource.title);
  addSnippet(snippets, eventSource.name);
  addSnippet(snippets, eventSource.description);
  addSnippet(snippets, eventSource.headings);
  addSnippet(snippets, eventSource.textSnippets);
  addSnippet(snippets, eventInfo.name);
  addSnippet(snippets, eventInfo.description);
  addSnippet(snippets, eventInfo.startDate);
  addSnippet(snippets, eventInfo.location);
  addSnippet(snippets, eventInfo.sections);
  addSnippet(snippets, eventInfo.ticketInfo);

  return truncateText([
    `Create a 10 second HappyHorse promotional video for "${eventName}".`,
    `Target profile: ${profile.title}.`,
    profile.summary ? `Audience needs: ${profile.summary}.` : "",
    profile.tone ? `Voice and mood: ${profile.tone}.` : "",
    snippets.length ? `Event information: ${snippets.slice(0, 10).join(" | ")}.` : "",
    "Style: warm, energetic, accessible, family-friendly, polished, upbeat, and social-share ready.",
    "Visual direction: focus on the feeling of attending the event, welcoming motion, bright details, and a celebratory final beat.",
    "Do not include dense or unreadable text overlays. Avoid fake logos and avoid showing API or technical UI."
  ].filter(Boolean).join(" "), HAPPY_HORSE_PROMPT_LIMIT);
}

function createAlibabaVideoPayload({ prompt }) {
  return {
    model: DEFAULT_MODEL,
    input: {
      prompt
    },
    parameters: {
      duration: HAPPY_HORSE_DURATION_SECONDS,
      size: DEFAULT_SIZE,
      prompt_extend: true
    }
  };
}

function getDashscopeApiKey() {
  const value = normalizeText(process.env.DASHSCOPE_API_KEY);
  if (!value || value === "your_dashscope_api_key_here") {
    return "";
  }

  return value;
}

async function readProviderJson(response, providerName) {
  const text = await response.text();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new HappyHorseVideoError(`${providerName} returned an unreadable response.`, "PROVIDER_RESPONSE_ERROR", 502);
  }
}

function parseMcpResponseText(text) {
  const trimmed = String(text || "").trim();
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
    return JSON.parse(payloads[payloads.length - 1] || "{}");
  }

  return JSON.parse(text);
}

async function readMcpJson(response) {
  const text = await response.text();
  if (!text) {
    return {};
  }

  try {
    return parseMcpResponseText(text);
  } catch (error) {
    throw new HappyHorseVideoError("Alibaba Model Studio MCP returned an unreadable response.", "MCP_RESPONSE_ERROR", 502);
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

function normalizeProviderStatus(value) {
  const status = normalizeText(value).toUpperCase();
  if (["SUCCEEDED", "SUCCESS", "COMPLETED", "FINISHED"].includes(status)) {
    return "completed";
  }

  if (["FAILED", "ERROR", "CANCELED", "CANCELLED"].includes(status)) {
    return "failed";
  }

  if (["RUNNING", "PROCESSING", "PENDING", "QUEUED"].includes(status)) {
    return "running";
  }

  return status ? "running" : "queued";
}

function createDashScopeModelStudioAdapter({
  apiKey = getDashscopeApiKey(),
  baseUrl = DEFAULT_BASE_URL,
  fetchImpl = fetch
} = {}) {
  const trimmedBaseUrl = String(baseUrl || "").replace(/\/+$/, "");

  function getHeaders(extra = {}) {
    if (!apiKey) {
      throw new HappyHorseVideoError("Video service is not configured.", "VIDEO_SERVICE_NOT_CONFIGURED", 503);
    }

    return {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      ...extra
    };
  }

  return {
    async submitVideo(payload, { signal } = {}) {
      const response = await fetchImpl(`${trimmedBaseUrl}/api/v1/services/aigc/video-generation/video-synthesis`, {
        method: "POST",
        headers: getHeaders({
          "x-dashscope-async": "enable"
        }),
        body: JSON.stringify(payload),
        signal
      });
      const body = await readProviderJson(response, "Alibaba Model Studio");

      if (response.status === 401 || response.status === 403) {
        throw new HappyHorseVideoError("Video service authentication failed.", "PROVIDER_AUTH_ERROR", response.status);
      }

      if (!response.ok || body.code) {
        throw new HappyHorseVideoError(body.message || `Alibaba Model Studio returned ${response.status}.`, "PROVIDER_ERROR", response.status || 502);
      }

      const providerJobId = body.output?.task_id || body.output?.taskId || body.task_id || body.id;
      const immediateVideoUrl = findValueByKey(body, ["video_url", "videoUrl", "url"]);

      if (!providerJobId && !immediateVideoUrl) {
        throw new HappyHorseVideoError("Alibaba Model Studio did not return a task ID.", "PROVIDER_RESPONSE_ERROR", 502);
      }

      return {
        providerJobId,
        videoUrl: immediateVideoUrl,
        status: immediateVideoUrl ? "completed" : normalizeProviderStatus(body.output?.task_status || body.task_status)
      };
    },

    async getVideoJob(providerJobId, { signal } = {}) {
      const response = await fetchImpl(`${trimmedBaseUrl}/api/v1/tasks/${encodeURIComponent(providerJobId)}`, {
        method: "GET",
        headers: getHeaders(),
        signal
      });
      const body = await readProviderJson(response, "Alibaba Model Studio");

      if (response.status === 401 || response.status === 403) {
        throw new HappyHorseVideoError("Video service authentication failed.", "PROVIDER_AUTH_ERROR", response.status);
      }

      if (!response.ok || body.code) {
        throw new HappyHorseVideoError(body.message || `Alibaba Model Studio returned ${response.status}.`, "PROVIDER_ERROR", response.status || 502);
      }

      const providerStatus = body.output?.task_status || body.task_status || body.status;
      const videoUrl = findValueByKey(body, ["video_url", "videoUrl", "url"]);

      return {
        providerJobId,
        status: normalizeProviderStatus(providerStatus),
        videoUrl,
        error: normalizeText(body.output?.message || body.message || body.error?.message)
      };
    }
  };
}

function createAlibabaModelStudioMcpAdapter({
  apiKey = getDashscopeApiKey(),
  mcpUrl = process.env.ALIBABA_MODEL_STUDIO_MCP_URL || process.env.MODEL_STUDIO_MCP_URL || "",
  generateTool = DEFAULT_MCP_GENERATE_TOOL,
  statusTool = DEFAULT_MCP_STATUS_TOOL,
  fetchImpl = fetch
} = {}) {
  const trimmedMcpUrl = String(mcpUrl || "").trim();

  async function callTool(name, args, signal) {
    if (!trimmedMcpUrl) {
      throw new HappyHorseVideoError("Alibaba Model Studio MCP URL is not configured.", "MCP_NOT_CONFIGURED", 503);
    }

    if (!apiKey) {
      throw new HappyHorseVideoError("Video service is not configured.", "VIDEO_SERVICE_NOT_CONFIGURED", 503);
    }

    const response = await fetchImpl(trimmedMcpUrl, {
      method: "POST",
      headers: {
        accept: "application/json, text/event-stream",
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        "x-dashscope-api-key": apiKey
      },
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

    const body = await readMcpJson(response);

    if (response.status === 401 || response.status === 403) {
      throw new HappyHorseVideoError("Video service authentication failed.", "PROVIDER_AUTH_ERROR", response.status);
    }

    if (!response.ok || body.error) {
      throw new HappyHorseVideoError(body.error?.message || `Alibaba Model Studio MCP returned ${response.status}.`, "MCP_ERROR", response.status || 502);
    }

    return body.result || body;
  }

  return {
    async submitVideo(payload, { signal } = {}) {
      const result = await callTool(generateTool, payload, signal);
      const providerJobId = result.output?.task_id || result.output?.taskId || result.task_id || result.id || findValueByKey(result, ["task_id", "taskId", "id"]);
      const videoUrl = findValueByKey(result, ["video_url", "videoUrl", "url"]);

      if (!providerJobId && !videoUrl) {
        throw new HappyHorseVideoError("Alibaba Model Studio MCP did not return a task ID.", "MCP_RESPONSE_ERROR", 502);
      }

      return {
        providerJobId,
        videoUrl,
        status: videoUrl ? "completed" : normalizeProviderStatus(result.output?.task_status || result.task_status || result.status)
      };
    },

    async getVideoJob(providerJobId, { signal } = {}) {
      const result = await callTool(statusTool, {
        task_id: providerJobId,
        taskId: providerJobId,
        id: providerJobId
      }, signal);
      const videoUrl = findValueByKey(result, ["video_url", "videoUrl", "url"]);

      return {
        providerJobId,
        status: normalizeProviderStatus(result.output?.task_status || result.task_status || result.status),
        videoUrl,
        error: normalizeText(result.output?.message || result.message || result.error?.message)
      };
    }
  };
}

function createMockAlibabaModelStudioAdapter({
  fail = false,
  videoUrl = "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4"
} = {}) {
  const calls = [];

  return {
    calls,
    async submitVideo(payload) {
      calls.push({ type: "submitVideo", payload });
      return {
        providerJobId: "mock-alibaba-task",
        status: fail ? "failed" : "running"
      };
    },
    async getVideoJob(providerJobId) {
      calls.push({ type: "getVideoJob", providerJobId });
      return fail
        ? { providerJobId, status: "failed", error: "Mock video generation failed." }
        : { providerJobId, status: "completed", videoUrl };
    }
  };
}

function createDefaultAlibabaModelStudioAdapter() {
  if (process.env.HAPPY_HORSE_ALIBABA_USE_MOCK === "true") {
    return createMockAlibabaModelStudioAdapter();
  }

  if (process.env.ALIBABA_MODEL_STUDIO_MCP_URL || process.env.MODEL_STUDIO_MCP_URL) {
    return createAlibabaModelStudioMcpAdapter();
  }

  return createDashScopeModelStudioAdapter();
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createJobId() {
  return `hhv_${Date.now().toString(36)}_${crypto.randomBytes(6).toString("hex")}`;
}

function toPublicJob(job) {
  if (!job) {
    return null;
  }

  return {
    id: job.id,
    ok: job.status !== "failed",
    status: job.status,
    message: job.message,
    error: job.error,
    videoUrl: job.videoUrl,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt
  };
}

function updateJob(job, patch) {
  Object.assign(job, patch, {
    updatedAt: new Date().toISOString()
  });
}

function failJob(job, error) {
  const code = error.code || "VIDEO_JOB_ERROR";
  let safeMessage = error.message || "Video generation failed.";

  if (code === "VIDEO_SERVICE_NOT_CONFIGURED") {
    safeMessage = "DASHSCOPE_API_KEY is missing or empty in .env.";
  } else if (code === "PROVIDER_AUTH_ERROR") {
    safeMessage = "Alibaba Model Studio rejected DASHSCOPE_API_KEY. Check the key and Model Studio access.";
  } else if (code === "MCP_NOT_CONFIGURED") {
    safeMessage = "Alibaba Model Studio MCP URL is not configured.";
  }

  console.error("[happyHorseVideo] job failed", {
    jobId: job.id,
    code,
    message: error.message,
    statusCode: error.statusCode
  });

  updateJob(job, {
    status: "failed",
    message: "Video generation failed.",
    error: safeMessage
  });
}

async function runHappyHorseVideoJob(jobId, input, {
  adapter = createDefaultAlibabaModelStudioAdapter(),
  fetchEventPage = defaultFetchEventPage,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  maxPolls = DEFAULT_MAX_POLLS
} = {}) {
  const job = jobs.get(jobId);
  if (!job) {
    throw new HappyHorseVideoError("Video job was not found.", "JOB_NOT_FOUND", 404);
  }

  try {
    updateJob(job, { status: "preparing", message: "Preparing video brief..." });
    const profile = normalizeProfile(input.profile || input.targetProfile);
    const eventSource = await resolveEventSource(input, fetchEventPage);
    const prompt = createHappyHorseVideoPrompt({ profile, eventSource });
    const payload = createAlibabaVideoPayload({ prompt });
    job.prompt = prompt;
    job.payload = payload;

    updateJob(job, { status: "submitting", message: "Creating HappyHorse video..." });
    const submitted = await adapter.submitVideo(payload);
    job.providerJobId = submitted.providerJobId;

    if (submitted.videoUrl || submitted.status === "completed") {
      updateJob(job, {
        status: "completed",
        message: "Video ready.",
        videoUrl: submitted.videoUrl
      });
      return toPublicJob(job);
    }

    updateJob(job, { status: "running", message: "HappyHorse video is generating..." });

    for (let poll = 0; poll < maxPolls; poll += 1) {
      const providerJob = await adapter.getVideoJob(job.providerJobId);

      if (providerJob.status === "completed") {
        if (!providerJob.videoUrl) {
          throw new HappyHorseVideoError("Alibaba Model Studio completed without a video URL.", "PROVIDER_RESPONSE_ERROR", 502);
        }

        updateJob(job, {
          status: "completed",
          message: "Video ready.",
          videoUrl: providerJob.videoUrl
        });
        return toPublicJob(job);
      }

      if (providerJob.status === "failed") {
        throw new HappyHorseVideoError(providerJob.error || "Alibaba Model Studio video job failed.", "PROVIDER_JOB_FAILED", 502);
      }

      updateJob(job, { status: "running", message: "HappyHorse video is generating..." });
      if (pollIntervalMs > 0 && poll < maxPolls - 1) {
        await delay(pollIntervalMs);
      }
    }

    throw new HappyHorseVideoError("HappyHorse video generation timed out.", "VIDEO_TIMEOUT", 504);
  } catch (error) {
    failJob(job, error);
    return toPublicJob(job);
  }
}

function createHappyHorseVideoJob(input, options = {}) {
  const now = new Date().toISOString();
  const job = {
    id: createJobId(),
    status: "queued",
    message: "Queued for HappyHorse video generation...",
    error: "",
    videoUrl: "",
    createdAt: now,
    updatedAt: now
  };

  jobs.set(job.id, job);

  if (options.autoStart !== false) {
    Promise.resolve()
      .then(() => runHappyHorseVideoJob(job.id, input, options))
      .catch((error) => failJob(job, error));
  }

  return toPublicJob(job);
}

function getHappyHorseVideoJob(jobId) {
  return toPublicJob(jobs.get(jobId));
}

function getStatusCode(error) {
  if (error instanceof HappyHorseVideoError) {
    return error.statusCode;
  }

  return 400;
}

async function handleCreateHappyHorseVideoJob(request, response, { readJsonBody, sendJson }) {
  try {
    const body = await readJsonBody(request);
    const job = createHappyHorseVideoJob(body);

    sendJson(response, 202, {
      ok: true,
      job
    });
  } catch (error) {
    sendJson(response, getStatusCode(error), {
      ok: false,
      code: error.code || "VIDEO_JOB_ERROR",
      error: error.message
    });
  }
}

async function handleGetHappyHorseVideoJob(request, response, { sendJson }) {
  const requestUrl = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  const jobId = decodeURIComponent(requestUrl.pathname.replace(/^\/api\/happyhorse-video-jobs\//, ""));
  const job = getHappyHorseVideoJob(jobId);

  if (!job) {
    sendJson(response, 404, {
      ok: false,
      error: "Video job was not found."
    });
    return;
  }

  sendJson(response, 200, {
    ok: job.status !== "failed",
    job
  });
}

module.exports = {
  HAPPY_HORSE_DURATION_SECONDS,
  HappyHorseVideoError,
  createAlibabaVideoPayload,
  createAlibabaModelStudioMcpAdapter,
  createDashScopeModelStudioAdapter,
  createDefaultAlibabaModelStudioAdapter,
  createHappyHorseVideoJob,
  createHappyHorseVideoPrompt,
  createMockAlibabaModelStudioAdapter,
  getDashscopeApiKey,
  getHappyHorseVideoJob,
  handleCreateHappyHorseVideoJob,
  handleGetHappyHorseVideoJob,
  jobs,
  normalizeProviderStatus,
  runHappyHorseVideoJob
};
