const assert = require("node:assert/strict");

const { parseEnvLine } = require("../env");

assert.deepEqual(parseEnvLine("MAGNIFIC_MCP_URL=https://mcp.magnific.com"), {
  key: "MAGNIFIC_MCP_URL",
  value: "https://mcp.magnific.com"
});
assert.deepEqual(parseEnvLine("MAGNIFIC_MCP_TOKEN=\"secret-value\""), {
  key: "MAGNIFIC_MCP_TOKEN",
  value: "secret-value"
});
assert.equal(parseEnvLine("# ignored"), null);
assert.equal(parseEnvLine("not valid"), null);
