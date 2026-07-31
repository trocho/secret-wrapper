import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { canSaveSecret, saveSecret } from "./providers.mjs";
import { selectorText } from "./selector.mjs";
import { ProviderError } from "./provider-error.mjs";


const maxFormBytes = 64 * 1024;
const providerLabels = {
  "macos-keychain": "macOS Keychain",
  "linux-secret-service": "Linux Secret Service",
  bitwarden: "Bitwarden",
};
const responseHeaders = {
  "content-type": "text/html; charset=utf-8",
  "cache-control": "no-store",
  "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'",
  "referrer-policy": "no-referrer",
};


function browserCommand(platform) {
  if (platform === "darwin") {
    return ["open"];
  }
  if (platform === "win32") {
    return ["cmd", ["/c", "start", ""]];
  }
  return ["xdg-open"];
}


export function openBrowser(url, platform = process.platform) {
  const [command, prefix = []] = browserCommand(platform);
  return new Promise((resolve, reject) => {
    const child = spawn(command, [...prefix, url], { detached: true, stdio: "ignore" });
    child.once("error", reject);
    child.once("spawn", () => {
      child.unref();
      resolve();
    });
  });
}


function escapeHtml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}


function page(bindings, action, { provider, processName }) {
  const fields = bindings.map((binding, index) => `
    <label>
      <strong>${escapeHtml(binding.name)}</strong>
      <small>${escapeHtml(selectorText(binding.selector))}</small>
      <input type="password" name="bind-${index}" autocomplete="off" spellcheck="false">
    </label>`).join("\n");
  return `<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Secret Wrapper authorization</title>
<style>body{font:16px system-ui,sans-serif;max-width:42rem;margin:3rem auto;padding:0 1rem}label{display:block;margin:1.25rem 0}small{display:block;color:#555;margin:.2rem 0}input{box-sizing:border-box;width:100%;padding:.65rem}button{padding:.7rem 1rem;margin-right:.5rem}</style>
<h1>Authorize Secret Wrapper</h1>
<p><strong>${escapeHtml(processName)}</strong> needs the values below before it can start. Secret Wrapper will store submitted values in <strong>${escapeHtml(provider)}</strong> and pass them only to that process.</p>
<p>Enter only values you want to add or change. Blank fields keep the stored value unchanged. Values are not displayed or logged.</p>
<form method="post" action="${action}">${fields}
<button type="submit">Save and continue</button><button type="submit" name="cancel" value="1">Cancel</button></form>
</html>`;
}


function formBody(request) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      size += Buffer.byteLength(chunk);
      if (size > maxFormBytes) {
        reject(new ProviderError("authorization form is too large"));
        request.destroy();
        return;
      }
      body += chunk;
    });
    request.once("end", () => resolve(new URLSearchParams(body)));
    request.once("error", reject);
  });
}


export function collectBrowserValues(bindings, context, {
  open = openBrowser,
  timeoutMilliseconds = 10 * 60 * 1000,
} = {}) {
  return new Promise((resolve, reject) => {
    const token = randomBytes(24).toString("hex");
    let timer;
    const finish = (callback, value) => {
      clearTimeout(timer);
      server.close();
      callback(value);
    };
    const server = createServer(async (request, response) => {
      const action = `/${token}`;
      if (request.method === "GET" && request.url === action) {
        response.writeHead(200, responseHeaders);
        response.end(page(bindings, action, context));
        return;
      }
      if (request.method !== "POST" || request.url !== action) {
        response.writeHead(404).end();
        return;
      }
      try {
        const values = await formBody(request);
        if (values.has("cancel")) {
          response.writeHead(200, responseHeaders);
          response.end("<p>Cancelled. You can close this tab.</p>");
          finish(reject, new ProviderError("authorization was cancelled"));
          return;
        }
        const result = Object.fromEntries(bindings.map((binding, index) => [binding.name, values.get(`bind-${index}`) ?? ""]));
        response.writeHead(200, responseHeaders);
        response.end("<p>Your values were received. Secret Wrapper is saving them now. You can close this tab.</p>");
        finish(resolve, result);
      } catch (error) {
        response.writeHead(400, { ...responseHeaders, "content-type": "text/plain; charset=utf-8" });
        response.end("Invalid form submission.");
        finish(reject, error);
      }
    });
    server.once("error", reject);
    server.listen(0, "127.0.0.1", async () => {
      const { port } = server.address();
      const url = `http://127.0.0.1:${port}/${token}`;
      try {
        await open(url);
      } catch (error) {
        finish(reject, error);
        return;
      }
      timer = setTimeout(() => finish(reject, new ProviderError("authorization timed out")), timeoutMilliseconds);
    });
  });
}


export async function authorizeBindings(provider, bindings, {
  collectValues = collectBrowserValues,
  save = saveSecret,
  processName = "A local process",
} = {}) {
  if (!canSaveSecret(provider)) {
    throw new ProviderError(`${provider} does not support browser authorization yet`);
  }
  const values = await collectValues(bindings, { provider: providerLabels[provider] ?? provider, processName });
  for (const binding of bindings) {
    if (values[binding.name]) {
      save(provider, binding, values[binding.name]);
    }
  }
}
