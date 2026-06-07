const assert = require("node:assert/strict");

const {
  HAPPY_HORSE_DURATION_SECONDS,
  createAlibabaModelStudioMcpAdapter,
  createAlibabaVideoPayload,
  createDashScopeModelStudioAdapter,
  createHappyHorseVideoJob,
  createHappyHorseVideoPrompt,
  createMockAlibabaModelStudioAdapter,
  getHappyHorseVideoJob,
  jobs,
  runHappyHorseVideoJob
} = require("../happyHorseVideo");
const { textOnlyVideoInput } = require("./videoFixtures");

(async () => {
  jobs.clear();

  const profile = textOnlyVideoInput.targetProfile;
  const eventSource = textOnlyVideoInput.eventSource;
  const prompt = createHappyHorseVideoPrompt({ profile, eventSource });
  assert.ok(prompt.includes("10 second HappyHorse promotional video"));
  assert.ok(prompt.includes("Outdoor Movie Night"));
  assert.ok(prompt.length <= 1500);

  const payload = createAlibabaVideoPayload({ prompt });
  assert.equal(HAPPY_HORSE_DURATION_SECONDS, 10);
  assert.equal(payload.parameters.duration, 10);
  assert.equal(payload.input.prompt, prompt);

  const mockAdapter = createMockAlibabaModelStudioAdapter();
  const queuedJob = createHappyHorseVideoJob({
    profile,
    eventSource
  }, { autoStart: false });
  assert.equal(queuedJob.status, "queued");

  const completedJob = await runHappyHorseVideoJob(queuedJob.id, {
    profile,
    eventSource
  }, {
    adapter: mockAdapter,
    pollIntervalMs: 0,
    maxPolls: 2
  });

  assert.equal(completedJob.status, "completed");
  assert.ok(completedJob.videoUrl.endsWith(".mp4"));
  assert.equal(mockAdapter.calls[0].type, "submitVideo");
  assert.equal(mockAdapter.calls[0].payload.parameters.duration, 10);
  assert.equal(mockAdapter.calls[1].type, "getVideoJob");

  const failingAdapter = createMockAlibabaModelStudioAdapter({ fail: true });
  const failingJob = createHappyHorseVideoJob({
    profile,
    eventSource
  }, { autoStart: false });
  const failedJob = await runHappyHorseVideoJob(failingJob.id, {
    profile,
    eventSource
  }, {
    adapter: failingAdapter,
    pollIntervalMs: 0,
    maxPolls: 2
  });
  assert.equal(failedJob.status, "failed");
  assert.match(failedJob.error, /Mock video generation failed/);
  assert.equal(getHappyHorseVideoJob(failingJob.id).status, "failed");

  const providerCalls = [];
  const providerAdapter = createDashScopeModelStudioAdapter({
    apiKey: "dashscope-test-key",
    baseUrl: "https://dashscope-intl.example.test",
    fetchImpl: async (url, options) => {
      providerCalls.push({
        url,
        method: options.method,
        headers: options.headers,
        body: options.body
      });

      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          output: {
            task_id: "task-123",
            task_status: "PENDING"
          }
        })
      };
    }
  });

  const submitted = await providerAdapter.submitVideo(payload);
  assert.equal(submitted.providerJobId, "task-123");
  assert.equal(providerCalls[0].url, "https://dashscope-intl.example.test/api/v1/services/aigc/video-generation/video-synthesis");
  assert.equal(providerCalls[0].headers.authorization, "Bearer dashscope-test-key");
  assert.equal(providerCalls[0].headers["x-dashscope-async"], "enable");
  assert.equal(JSON.parse(providerCalls[0].body).parameters.duration, 10);

  const mcpCalls = [];
  const mcpAdapter = createAlibabaModelStudioMcpAdapter({
    apiKey: "dashscope-test-key",
    mcpUrl: "https://mcp.alibaba.example.test",
    generateTool: "video_generation",
    statusTool: "get_task",
    fetchImpl: async (url, options) => {
      const body = JSON.parse(options.body);
      mcpCalls.push({
        url,
        headers: options.headers,
        body
      });

      if (body.params.name === "video_generation") {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            result: {
              output: {
                task_id: "mcp-task-123",
                task_status: "PENDING"
              }
            }
          })
        };
      }

      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          result: {
            output: {
              task_status: "SUCCEEDED",
              video_url: "https://example.com/mcp-video.mp4"
            }
          }
        })
      };
    }
  });

  const mcpSubmitted = await mcpAdapter.submitVideo(payload);
  const mcpCompleted = await mcpAdapter.getVideoJob(mcpSubmitted.providerJobId);
  assert.equal(mcpSubmitted.providerJobId, "mcp-task-123");
  assert.equal(mcpCompleted.videoUrl, "https://example.com/mcp-video.mp4");
  assert.equal(mcpCalls[0].url, "https://mcp.alibaba.example.test");
  assert.equal(mcpCalls[0].headers.authorization, "Bearer dashscope-test-key");
  assert.equal(mcpCalls[0].headers["x-dashscope-api-key"], "dashscope-test-key");
  assert.equal(mcpCalls[0].body.method, "tools/call");
  assert.equal(mcpCalls[0].body.params.name, "video_generation");
  assert.equal(mcpCalls[0].body.params.arguments.parameters.duration, 10);
  assert.equal(mcpCalls[1].body.params.name, "get_task");

  const originalDashscopeKey = process.env.DASHSCOPE_API_KEY;
  delete process.env.DASHSCOPE_API_KEY;
  const missingKeyJob = createHappyHorseVideoJob({
    profile,
    eventSource
  }, { autoStart: false });
  const missingKeyResult = await runHappyHorseVideoJob(missingKeyJob.id, {
    profile,
    eventSource
  }, {
    adapter: createDashScopeModelStudioAdapter({ apiKey: "" }),
    pollIntervalMs: 0,
    maxPolls: 1
  });
  assert.equal(missingKeyResult.status, "failed");
  assert.equal(missingKeyResult.error, "DASHSCOPE_API_KEY is missing or empty in .env.");

  if (originalDashscopeKey === undefined) {
    delete process.env.DASHSCOPE_API_KEY;
  } else {
    process.env.DASHSCOPE_API_KEY = originalDashscopeKey;
  }
})();
