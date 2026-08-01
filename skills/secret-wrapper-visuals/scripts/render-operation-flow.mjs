#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";


function readOutput(argv) {
  if (argv.length !== 2 || argv[0] !== "--output" || !argv[1]) {
    throw new Error("usage: render-operation-flow.mjs --output PATH");
  }
  return resolve(argv[1]);
}


function participant(x, title, subtitle) {
  return `<g>
    <rect x="${x - 102}" y="86" width="204" height="72" rx="14" fill="#172438" stroke="#334155"/>
    <text x="${x}" y="116" text-anchor="middle" fill="#f8fafc" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="16" font-weight="700">${title}</text>
    <text x="${x}" y="140" text-anchor="middle" fill="#9aa9bc" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="13">${subtitle}</text>
    <line x1="${x}" y1="158" x2="${x}" y2="810" stroke="#334155" stroke-dasharray="5 8"/>
  </g>`;
}


function arrow(from, to, y, label, dashed = false) {
  const direction = to > from ? 1 : -1;
  const start = from + direction * 12;
  const end = to - direction * 16;
  return `<g>
    <line x1="${start}" y1="${y}" x2="${end}" y2="${y}" stroke="#77e3ba" stroke-width="2"${dashed ? ' stroke-dasharray="7 6"' : ""}/>
    <path d="M${end} ${y} l${-direction * 10} -6 v12 z" fill="#77e3ba"/>
    <rect x="${Math.min(from, to) + 20}" y="${y - 27}" width="${Math.abs(to - from) - 40}" height="22" rx="5" fill="#0a101a"/>
    <text x="${(from + to) / 2}" y="${y - 11}" text-anchor="middle" fill="#dbe6f3" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="13">${label}</text>
  </g>`;
}


function render() {
  const caller = 130;
  const wrapper = 365;
  const adapter = 600;
  const provider = 835;
  const target = 1070;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="860" viewBox="0 0 1200 860" role="img" aria-labelledby="title description">
  <title id="title">How Secret Wrapper launches a process</title>
  <desc id="description">A generated provider-neutral launch sequence. Secret Wrapper retrieves bound values, opens a local authorization form only when a value is missing, and launches the target process after every value is available.</desc>
  <rect width="1200" height="860" fill="#0a101a"/>
  <text x="56" y="48" fill="#77e3ba" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="14" letter-spacing="2">SECRET WRAPPER · OPERATION SEQUENCE</text>
  <text x="56" y="75" fill="#9aa9bc" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="14">Secrets remain in the selected provider until the target starts.</text>
  ${participant(caller, "Launch", "command")}
  ${participant(wrapper, "Secret Wrapper", "orchestrator")}
  ${participant(adapter, "Adapter", "provider contract")}
  ${participant(provider, "Secret store", "existing provider")}
  ${participant(target, "Target", "MCP or tool")}
  ${arrow(caller, wrapper, 212, "start command with binds")}
  ${arrow(wrapper, adapter, 266, "resolve every selector")}
  ${arrow(adapter, provider, 320, "retrieve stored values")}
  <rect x="334" y="354" width="532" height="300" rx="18" fill="#111b2a" stroke="#3d526b"/>
  <text x="356" y="382" fill="#77e3ba" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="13" font-weight="700">ONLY WHEN A VALUE IS MISSING</text>
  ${arrow(provider, adapter, 425, "missing value confirmed", true)}
  ${arrow(adapter, wrapper, 470, "authorization required", true)}
  <rect x="383" y="494" width="199" height="58" rx="12" fill="#172438" stroke="#77e3ba"/>
  <text x="482" y="518" text-anchor="middle" fill="#f8fafc" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="14" font-weight="700">Local browser form</text>
  <text x="482" y="539" text-anchor="middle" fill="#9aa9bc" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="12">collect all missing values</text>
  ${arrow(wrapper, provider, 615, "save, then retrieve again")}
  ${arrow(provider, adapter, 690, "resolved values", true)}
  ${arrow(adapter, wrapper, 740, "all binds ready", true)}
  ${arrow(wrapper, target, 800, "launch with bound environment")}
</svg>
`;
}


const output = readOutput(process.argv.slice(2));
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, render(), "utf8");
console.log(`wrote ${output}`);
