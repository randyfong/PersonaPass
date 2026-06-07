const assert = require("node:assert/strict");

const {
  createHappyHorsePayload,
  createDefaultHappyHorseAdapter,
  createMagnificMcpHappyHorseAdapter,
  createMockHappyHorseAdapter,
  extractEventAssets,
  generateCustomizedVideo,
  getMagnificMcpToken,
  happyHorseModelSlug
} = require("../customizeVideo");
const {
  imageVideoInput,
  textOnlyVideoInput,
  urlRouteVideoInput
} = require("./videoFixtures");

(async () => {
  assert.equal(happyHorseModelSlug, "happy-horse-1");

  const textAssets = extractEventAssets(textOnlyVideoInput.eventSource, textOnlyVideoInput.targetProfile);
  const textPayload = createHappyHorsePayload({
    targetProfile: textOnlyVideoInput.targetProfile,
    eventSource: textOnlyVideoInput.eventSource,
    assets: textAssets
  });

  assert.equal(textPayload.slug, "happy-horse-1");
  assert.equal(textPayload.duration, 10);
  assert.equal(textPayload.aspectRatio, "16:9");
  assert.equal(textPayload.resolution, "720p");
  assert.equal(textPayload.withSoundEffects, true);
  assert.equal(textPayload.references, undefined);
  assert.ok(textPayload.prompt.includes("Outdoor Movie Night"));
  assert.ok(textPayload.prompt.length <= 2500);

  const imageAssets = extractEventAssets(imageVideoInput.eventSource, imageVideoInput.targetProfile);
  const imagePayload = createHappyHorsePayload({
    targetProfile: imageVideoInput.targetProfile,
    eventSource: imageVideoInput.eventSource,
    assets: imageAssets
  });

  assert.equal(imagePayload.slug, "happy-horse-1");
  assert.equal(imagePayload.references.length, 4);
  assert.deepEqual(imagePayload.references[0], {
    type: "image",
    url: "https://example.com/assets/rooftop.jpg"
  });

  const textVideo = await generateCustomizedVideo(textOnlyVideoInput, {
    adapter: createMockHappyHorseAdapter()
  });
  assert.equal(textVideo.status, "mock_completed");
  assert.equal(textVideo.creationId, "mock-happy-horse-1-text");
  assert.equal(textVideo.payload.slug, "happy-horse-1");
  assert.ok(textVideo.videoUrl.endsWith(".mp4"));

  const urlRouteVideo = await generateCustomizedVideo(urlRouteVideoInput, {
    adapter: createMockHappyHorseAdapter(),
    fetchEventPage: async () => textOnlyVideoInput.eventSource
  });
  assert.equal(urlRouteVideo.payload.slug, "happy-horse-1");
  assert.equal(urlRouteVideo.status, "mock_completed");

  await assert.rejects(
    () => generateCustomizedVideo({}, { adapter: createMockHappyHorseAdapter() }),
    (error) => error.code === "VALIDATION_ERROR"
  );

  await assert.rejects(
    () => generateCustomizedVideo(textOnlyVideoInput, {
      timeoutMs: 5,
      adapter: {
        generate: () => new Promise(() => {})
      }
    }),
    (error) => error.code === "VIDEO_TIMEOUT" && error.statusCode === 504
  );

  const originalMockMode = process.env.HAPPY_HORSE_USE_MOCK;
  const originalMcpUrl = process.env.MAGNIFIC_MCP_URL;
  const originalMcpToken = process.env.MAGNIFIC_MCP_TOKEN;
  const originalApiKey = process.env.MAGNIFIC_API_KEY;
  delete process.env.HAPPY_HORSE_USE_MOCK;
  delete process.env.MAGNIFIC_MCP_URL;
  delete process.env.MAGNIFIC_MCP_TOKEN;
  process.env.MAGNIFIC_API_KEY = "your_magnific_api_key_here";
  assert.equal(getMagnificMcpToken(), "");

  process.env.MAGNIFIC_MCP_TOKEN = "real-mcp-token";
  assert.equal(getMagnificMcpToken(), "real-mcp-token");

  const mcpCalls = [];
  const testMcpAdapter = createMagnificMcpHappyHorseAdapter({
    mcpUrl: "https://mcp.example.test",
    fetchImpl: async (url, options) => {
      const body = JSON.parse(options.body);
      mcpCalls.push({
        url,
        body,
        authorization: options.headers.authorization,
        magnificApiKey: options.headers["x-magnific-api-key"]
      });

      if (body.params.name === "video_generate") {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            result: {
              creationIdentifier: "creation-123"
            }
          })
        };
      }

      if (body.params.name === "creations_wait") {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            result: {
              status: "completed",
              url: "https://example.com/video.mp4"
            }
          })
        };
      }

      throw new Error(`Unexpected MCP tool ${body.params.name}`);
    }
  });

  const mcpResult = await testMcpAdapter.generate(textPayload);
  assert.equal(mcpResult.videoUrl, "https://example.com/video.mp4");
  assert.equal(mcpCalls[0].url, "https://mcp.example.test");
  assert.equal(mcpCalls[0].authorization, "Bearer real-mcp-token");
  assert.equal(mcpCalls[0].magnificApiKey, "real-mcp-token");
  assert.equal(mcpCalls[0].body.method, "tools/call");
  assert.equal(mcpCalls[0].body.params.name, "video_generate");
  assert.equal(mcpCalls[0].body.params.arguments.video.clips[0].slug, "happy-horse-1");
  assert.equal(mcpCalls[1].body.params.name, "creations_wait");

  const unauthorizedAdapter = createMagnificMcpHappyHorseAdapter({
    mcpUrl: "https://mcp.example.test",
    fetchImpl: async () => ({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({})
    })
  });

  await assert.rejects(
    () => unauthorizedAdapter.generate(textPayload),
    (error) => error.code === "MCP_AUTH_ERROR" && error.statusCode === 401
  );

  process.env.MAGNIFIC_MCP_URL = "";
  await assert.rejects(
    () => createMagnificMcpHappyHorseAdapter({ mcpUrl: "" }).generate(textPayload),
    (error) => error.code === "MCP_ERROR" && error.message.includes("MAGNIFIC_MCP_URL")
  );

  process.env.HAPPY_HORSE_USE_MOCK = "true";
  const explicitMockResult = await createDefaultHappyHorseAdapter().generate(textPayload);
  assert.equal(explicitMockResult.status, "mock_completed");

  if (originalMockMode === undefined) {
    delete process.env.HAPPY_HORSE_USE_MOCK;
  } else {
    process.env.HAPPY_HORSE_USE_MOCK = originalMockMode;
  }

  if (originalMcpUrl === undefined) {
    delete process.env.MAGNIFIC_MCP_URL;
  } else {
    process.env.MAGNIFIC_MCP_URL = originalMcpUrl;
  }

  if (originalMcpToken === undefined) {
    delete process.env.MAGNIFIC_MCP_TOKEN;
  } else {
    process.env.MAGNIFIC_MCP_TOKEN = originalMcpToken;
  }

  if (originalApiKey === undefined) {
    delete process.env.MAGNIFIC_API_KEY;
  } else {
    process.env.MAGNIFIC_API_KEY = originalApiKey;
  }
})();
