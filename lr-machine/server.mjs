import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { collectProjectData } from "./lib/collect-project-data.mjs";
import { renderPage } from "./lib/render-page.mjs";

const LR_ROOT = fileURLToPath(new URL(".", import.meta.url));
const DEFAULT_PROJECT_ROOT = resolve(LR_ROOT, "..");
const PUBLIC_ROOT = resolve(LR_ROOT, "public");
const SNAPSHOT_ROOT = resolve(LR_ROOT, "snapshots");

const CONTENT_TYPES = {
  css: "text/css; charset=utf-8",
  html: "text/html; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  json: "application/json; charset=utf-8",
  text: "text/plain; charset=utf-8",
};

function securityHeaders(contentType, snapshot = false) {
  const scriptPolicy = snapshot ? "'self' 'unsafe-inline'" : "'self'";
  return {
    "Content-Type": contentType,
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Content-Security-Policy": `default-src 'self'; script-src ${scriptPolicy}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; base-uri 'none'; form-action 'none'`,
  };
}

function send(
  response,
  status,
  body,
  contentType = CONTENT_TYPES.text,
  options = {},
) {
  response.writeHead(status, {
    ...securityHeaders(contentType, options.snapshot),
    "Cache-Control": options.cache ?? "no-store",
  });
  response.end(body);
}

async function readAsset(name) {
  if (name === "styles.css")
    return readFile(resolve(PUBLIC_ROOT, name), "utf8");
  if (name === "app.js") return readFile(resolve(PUBLIC_ROOT, name), "utf8");
  return null;
}

function safeSnapshotName(pathname) {
  try {
    const name = decodeURIComponent(pathname.slice("/snapshots/".length));
    if (!/^[A-Za-z0-9._-]+\.html$/.test(name)) return null;
    if (basename(name) !== name) return null;
    return name;
  } catch {
    return null;
  }
}

export function createLearningServer({
  projectRoot = DEFAULT_PROJECT_ROOT,
} = {}) {
  return createServer(async (request, response) => {
    const method = request.method ?? "GET";
    if (method !== "GET" && method !== "HEAD") {
      send(response, 405, "Method Not Allowed");
      return;
    }

    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const pathname = url.pathname;

    try {
      if (pathname === "/" || pathname === "/index.html") {
        const page = renderPage();
        send(response, 200, method === "HEAD" ? "" : page, CONTENT_TYPES.html);
        return;
      }

      if (pathname === "/api/project") {
        const data = await collectProjectData(projectRoot);
        const json = JSON.stringify(data);
        send(response, 200, method === "HEAD" ? "" : json, CONTENT_TYPES.json);
        return;
      }

      if (pathname === "/assets/styles.css" || pathname === "/assets/app.js") {
        const name = pathname.endsWith("styles.css") ? "styles.css" : "app.js";
        const asset = await readAsset(name);
        const contentType = name.endsWith(".css")
          ? CONTENT_TYPES.css
          : CONTENT_TYPES.js;
        send(response, 200, method === "HEAD" ? "" : asset, contentType, {
          cache: "public, max-age=60",
        });
        return;
      }

      if (pathname.startsWith("/snapshots/")) {
        const name = safeSnapshotName(pathname);
        if (!name) {
          send(response, 400, "Invalid snapshot path");
          return;
        }
        const html = await readFile(resolve(SNAPSHOT_ROOT, name), "utf8").catch(
          () => null,
        );
        if (html === null) {
          send(response, 404, "Snapshot not found");
          return;
        }
        send(response, 200, method === "HEAD" ? "" : html, CONTENT_TYPES.html, {
          snapshot: true,
          cache: "public, max-age=300",
        });
        return;
      }

      send(response, 404, "Not Found");
    } catch (error) {
      console.error(
        "LR Machine request failed:",
        error instanceof Error ? error.message : error,
      );
      send(response, 500, "Internal Server Error");
    }
  });
}

export async function startLearningServer({
  projectRoot = DEFAULT_PROJECT_ROOT,
  host = "127.0.0.1",
  port = 4310,
} = {}) {
  const server = createLearningServer({ projectRoot });
  await new Promise((resolvePromise, reject) => {
    server.once("error", reject);
    server.listen(port, host, resolvePromise);
  });
  return server;
}

const directEntry = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : "";
if (import.meta.url === directEntry) {
  const port = Number.parseInt(process.env.LR_PORT ?? "4310", 10);
  const server = await startLearningServer({
    port: Number.isFinite(port) ? port : 4310,
  });
  const address = server.address();
  const actualPort =
    typeof address === "object" && address ? address.port : port;
  console.log(`LR Machine listening at http://127.0.0.1:${actualPort}`);

  const close = () => server.close(() => process.exit(0));
  process.once("SIGINT", close);
  process.once("SIGTERM", close);
}
