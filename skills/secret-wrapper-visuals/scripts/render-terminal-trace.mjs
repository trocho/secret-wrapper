#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";


const defaultLines = [
  "$ secret-wrapper run --provider macos-keychain --bind DEMO_API_TOKEN=demo-mcp.api-token",
  "--bind DEMO_PASSWORD=demo-mcp.password -- demo-mcp",
  "secret-wrapper: debug: provider=macos-keychain; binds=DEMO_API_TOKEN, DEMO_PASSWORD",
  "secret-wrapper: debug: a value is unavailable; opening authorization page",
  "✓ Authorization completed — values were never printed",
  "secret-wrapper: debug: secret values retrieved; starting target process",
  "demo-mcp started",
];
const unsafeValue = /(?:bearer\s+\S+|(?:sk|ghp|xoxb|bws)_[a-z0-9_-]{12,})/i;


function readArguments(argv) {
  const options = { lines: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--output") {
      options.output = argv[++index];
    } else if (value === "--title") {
      options.title = argv[++index];
    } else if (value === "--line") {
      options.lines.push(argv[++index]);
    } else {
      throw new Error(`unknown argument: ${value}`);
    }
  }
  if (!options.output) {
    throw new Error("usage: render-terminal-trace.mjs --output PATH [--title TEXT] [--line TEXT ...]");
  }
  return options;
}


function escapeXml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}


function renderLine(line, index, y) {
  const colors = ["#f8f8f2", "#f8f8f2", "#b6c2de", "#b6c2de", "#79e6a3", "#b6c2de", "#8996b3"];
  if (index === 0 && line.startsWith("$ ")) {
    return `<text x="68" y="${y}" fill="#8be9fd">$</text><text x="88" y="${y}" fill="${colors[index]}">${escapeXml(line.slice(2))}</text>`;
  }
  return `<text x="68" y="${y}" fill="${colors[index] ?? "#b6c2de"}">${escapeXml(line)}</text>`;
}


function renderSvg(title, lines) {
  const height = Math.max(390, 164 + lines.length * 34);
  const content = lines.map((line, index) => renderLine(line, index, 124 + index * 34)).join("\n    ");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="${height}" viewBox="0 0 1200 ${height}" role="img" aria-labelledby="title description">
  <title id="title">${escapeXml(title)}</title>
  <desc id="description">A sanitized terminal trace for Secret Wrapper. It contains demo-only values and never prints credentials.</desc>
  <rect width="1200" height="${height}" fill="#0b1020"/>
  <rect x="36" y="30" width="1128" height="${height - 60}" rx="16" fill="#10182a" stroke="#334155"/>
  <rect x="36" y="30" width="1128" height="54" rx="16" fill="#172033"/>
  <path d="M36 68h1128v16H36z" fill="#172033"/>
  <circle cx="68" cy="57" r="7" fill="#ff6b6b"/><circle cx="92" cy="57" r="7" fill="#ffd166"/><circle cx="116" cy="57" r="7" fill="#69db7c"/>
  <text x="146" y="62" fill="#aab8d5" font-family="system-ui, sans-serif" font-size="15">Terminal — demo without real credentials</text>
  <g font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="16">
    ${content}
  </g>
</svg>
`;
}


const options = readArguments(process.argv.slice(2));
const lines = options.lines.length === 0 ? defaultLines : options.lines;
if (lines.some((line) => !line || line.length > 120 || unsafeValue.test(line))) {
  throw new Error("terminal traces must use short, sanitized demo-only lines");
}
const output = resolve(options.output);
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, renderSvg(options.title ?? "Secret Wrapper launcher trace", lines), "utf8");
console.log(`wrote ${output}`);
