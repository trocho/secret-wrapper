import { parseSelector } from "../../src/selector.mjs";
import { ProviderError } from "../../src/provider-error.mjs";
import { collectBrowserValues } from "../../src/setup.mjs";


const failure = process.argv.includes("--failure");
const bindings = [
  { name: "DEMO_API_TOKEN", selector: parseSelector("demo-mcp.api-token") },
  { name: "DEMO_PASSWORD", selector: parseSelector("demo-mcp.password") },
];


console.log("$ secret-wrapper run --provider macos-keychain --bind DEMO_API_TOKEN=demo-mcp.api-token --bind DEMO_PASSWORD=demo-mcp.password -- demo-mcp");
console.log("secret-wrapper: debug: provider=macos-keychain; binds=DEMO_API_TOKEN=demo-mcp.api-token, DEMO_PASSWORD=demo-mcp.password; scope=none");
console.log("secret-wrapper: debug: a value is unavailable; opening authorization page");

try {
  const result = await collectBrowserValues(bindings, {
    provider: "macOS Keychain",
    processName: "demo-mcp",
  }, {
    open: async (url) => {
      console.log(`AUTHORIZATION_URL=${url}`);
    },
    onSubmit: async () => {
      if (failure) {
        throw new ProviderError("Demo provider rejected the update. Check that the keychain is unlocked, then submit again.");
      }
      return [
        { name: "DEMO_API_TOKEN", status: "created successfully" },
        { name: "DEMO_PASSWORD", status: "preserved (a value was added while this form was open)" },
      ];
    },
  });
  console.log("secret-wrapper: debug: authorization completed; starting target process");
  console.log(JSON.stringify(result.outcomes));
} catch (error) {
  const message = error instanceof Error ? error.message : "authorization failed";
  console.error(`secret-wrapper: ${message}`);
  process.exitCode = 78;
}
