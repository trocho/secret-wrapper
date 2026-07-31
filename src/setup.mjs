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
<style>:root{color-scheme:dark;--ink:#eaf0f8;--muted:#9aa9bc;--line:#2c3a4d;--panel:#111b2a;--panel-2:#172438;--accent:#77e3ba;--accent-ink:#062218}*{box-sizing:border-box}body{min-height:100vh;margin:0;padding:clamp(1.5rem,6vw,5rem) 1rem;background:radial-gradient(circle at 12% 4%,#233a52 0,transparent 31rem),#0a101a;color:var(--ink);font:16px/1.5 ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace}main{max-width:44rem;margin:auto;padding:clamp(1.5rem,4vw,3rem);border:1px solid var(--line);border-radius:1.25rem;background:linear-gradient(145deg,var(--panel-2),var(--panel));box-shadow:0 2rem 6rem #0008}.eyebrow{margin-bottom:1rem;color:var(--accent);font-size:.72rem;font-weight:700;letter-spacing:.16em}h1{margin:0;color:#fff;font:700 clamp(2rem,5vw,3.4rem)/.95 Georgia,serif;letter-spacing:-.04em}.lede{max-width:38rem;margin:1.75rem 0 1rem;color:#d7e0eb}.notice{margin:0;padding:.85rem 1rem;border-left:3px solid var(--accent);background:#0b1721;color:var(--muted);font-size:.88rem}.error{margin:1.5rem 0 0;padding:1rem;border:1px solid #d77979;border-radius:.65rem;background:#361b26;color:#ffd9d9}.error-followup{margin:.8rem 0 0;color:var(--muted);font-size:.88rem}label{display:block;margin:1.4rem 0}label strong{display:block;color:#fff;font-size:.86rem;letter-spacing:.05em}small{display:block;margin:.28rem 0 .5rem;color:var(--muted);font-size:.8rem}input{width:100%;border:1px solid #40526a;border-radius:.6rem;padding:.8rem .9rem;background:#09111c;color:var(--ink);font:inherit;outline:none}input:focus{border-color:var(--accent);box-shadow:0 0 0 3px #77e3ba2b}button{margin:.45rem .5rem 0 0;border:1px solid #627087;border-radius:.5rem;padding:.75rem 1rem;background:transparent;color:var(--ink);font:700 .8rem ui-monospace,SFMono-Regular,Menlo,monospace;cursor:pointer}button:first-of-type{border-color:var(--accent);background:var(--accent);color:var(--accent-ink)}button:hover{transform:translateY(-1px)}</style>
<main><div class="eyebrow">SECRET WRAPPER · LOCAL AUTHORIZATION</div>
<h1>Authorize the launch.</h1>
<p class="lede"><strong>${escapeHtml(processName)}</strong> needs the values below before it can start. Secret Wrapper will store submitted values in <strong>${escapeHtml(provider)}</strong> and pass them only to that process.</p>
<p class="notice">Enter only values you want to add or change. Blank fields keep the stored value unchanged. Values are not displayed or logged.</p>
<form method="post" action="${action}">${fields}
<button type="submit">Save and continue</button><button type="submit" name="cancel" value="1">Cancel</button></form></main>
</html>`;
}


function resultPage(outcomes) {
  const items = outcomes.map(({ name, status }) => `<li><strong>${escapeHtml(name)}</strong>: ${escapeHtml(status)}</li>`).join("\n");
  return `<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Secret Wrapper authorization complete</title>
<style>:root{color-scheme:dark;--ink:#eaf0f8;--muted:#9aa9bc;--line:#2c3a4d;--panel:#111b2a;--panel-2:#172438;--accent:#77e3ba}*{box-sizing:border-box}body{min-height:100vh;margin:0;padding:clamp(1.5rem,6vw,5rem) 1rem;background:radial-gradient(circle at 12% 4%,#233a52 0,transparent 31rem),#0a101a;color:var(--ink);font:16px/1.5 ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace}main{max-width:44rem;margin:auto;padding:clamp(1.5rem,4vw,3rem);border:1px solid var(--line);border-radius:1.25rem;background:linear-gradient(145deg,var(--panel-2),var(--panel));box-shadow:0 2rem 6rem #0008}.eyebrow{margin-bottom:1rem;color:var(--accent);font-size:.72rem;font-weight:700;letter-spacing:.16em}h1{margin:0;color:#fff;font:700 clamp(2rem,5vw,3.4rem)/.95 Georgia,serif;letter-spacing:-.04em}.lede{margin:1.75rem 0;color:#d7e0eb}.status{margin:0;padding:0;list-style:none}.status li{margin:.7rem 0;padding:.8rem 1rem;border:1px solid #304157;border-radius:.65rem;background:#0b1721}.status strong{color:var(--accent)}.close{margin:1.75rem 0 0;color:var(--muted)}</style>
<main><div class="eyebrow">SECRET WRAPPER · LOCAL AUTHORIZATION</div>
<h1>Authorization complete.</h1>
<p class="lede">Secret Wrapper checked each value again immediately before saving.</p>
<ul class="status">${items}</ul>
<p class="close">You can close this tab.</p></main>
</html>`;
}


function errorPage(bindings, action, context, error) {
  return page(bindings, action, context)
    .replace("</style>", ".with-error{padding:1.5rem}.with-error h1{font-size:2.55rem}.with-error .lede{margin:.9rem 0 .65rem;font-size:.9rem}.with-error .notice{padding:.6rem .75rem;font-size:.78rem}.with-error .error{margin:.75rem 0 0;padding:.65rem;font-size:.83rem}.with-error .error-followup{margin:.5rem 0;font-size:.75rem}.with-error label{margin:.55rem 0}.with-error small{margin:.15rem 0 .3rem}.with-error input{padding:.55rem .7rem}.with-error button{margin-top:.25rem;padding:.6rem .8rem}</style>")
    .replace("<main>", "<main class=\"with-error\">")
    .replace(
      "<form method=\"post\"",
      `<p class="error" role="alert"><strong>Secret Wrapper could not save the submitted values.</strong> ${escapeHtml(error)}</p><p class="error-followup">Correct the values or resolve the provider error, then submit again. Values are not shown or retained in this page.</p><form method="post"`,
    );
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
  onSubmit = undefined,
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
        const outcomes = onSubmit ? await onSubmit(result) : undefined;
        response.writeHead(200, responseHeaders);
        response.end(outcomes ? resultPage(outcomes) : "<p>Your values were received. You can close this tab.</p>");
        finish(resolve, outcomes ? { values: result, outcomes } : result);
      } catch (error) {
        const message = error instanceof Error ? error.message : "the provider failed";
        response.writeHead(500, responseHeaders);
        response.end(errorPage(bindings, action, context, message));
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
  ifMissing = false,
} = {}) {
  if (!canSaveSecret(provider)) {
    throw new ProviderError(`${provider} does not support browser authorization yet`);
  }
  const persist = async (values) => {
    const outcomes = [];
    for (const binding of bindings) {
      if (!values[binding.name]) {
        outcomes.push({ name: binding.name, status: "not changed (blank input)" });
        continue;
      }
      const result = await save(provider, binding, values[binding.name], { ifMissing });
      outcomes.push({ name: binding.name, status: result.status === "preserved"
        ? "preserved (a value was added while this form was open)"
        : `${result.status} successfully` });
    }
    return outcomes;
  };
  const collected = await collectValues(bindings, { provider: providerLabels[provider] ?? provider, processName }, { onSubmit: persist });
  if (collected?.outcomes) {
    return collected.outcomes;
  }
  return persist(collected);
}
