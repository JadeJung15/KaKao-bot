import http from "node:http";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const targetArg = process.argv[2] || process.env.SMOKE_BASE_URL || "";
let server;
let tempDbPath;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function localBaseUrl() {
  tempDbPath = path.join(repoRoot, "data", `smoke-db-${process.pid}.json`);
  process.env.DB_PATH = tempDbPath;
  process.env.ADMIN_CONSOLE_TOKEN = process.env.ADMIN_CONSOLE_TOKEN || "smoke-token";
  process.env.OWNER_ADMIN_EMAILS = process.env.OWNER_ADMIN_EMAILS || `owner-${process.pid}@pixgom.test`;
  await unlink(tempDbPath).catch(() => {});
  const { requestHandler } = await import("../server.js");
  server = http.createServer(requestHandler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${server.address().port}`;
}

async function text(baseUrl, pathname) {
  const response = await fetch(`${baseUrl}${pathname}`);
  assert(response.ok, `${pathname} returned ${response.status}`);
  return response.text();
}

async function json(baseUrl, pathname) {
  const response = await fetch(`${baseUrl}${pathname}`);
  assert(response.ok, `${pathname} returned ${response.status}`);
  return response.json();
}

try {
  const baseUrl = targetArg ? targetArg.replace(/\/+$/, "") : await localBaseUrl();
  const health = await json(baseUrl, "/health?versionCode=19");
  assert(health.ok === true, "/health ok false");
  assert(health.dbStatus?.ok === true, "/health dbStatus not ok");
  assert(Array.isArray(health.features), "/health features missing");

  const commandStore = await text(baseUrl, "/command-store");
  assert(commandStore.includes("Command Store") || commandStore.includes("명령어 스토어"), "/command-store content missing");

  const admin = await text(baseUrl, "/admin");
  assert(admin.includes("픽셀곰 운영자 어드민"), "/admin title missing");
  assert(admin.includes("복구 dry-run 확인"), "/admin backup dry-run missing");

  const consolePage = await text(baseUrl, "/console");
  assert(consolePage.includes("구매자 콘솔") || consolePage.includes("픽셀곰 콘솔"), "/console content missing");

  console.log(JSON.stringify({
    ok: true,
    baseUrl,
    version: health.version,
    dbStatus: health.dbStatus.status || health.dbStatus.type,
    checked: ["/health", "/command-store", "/admin", "/console"]
  }, null, 2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (tempDbPath) await unlink(tempDbPath).catch(() => {});
}
