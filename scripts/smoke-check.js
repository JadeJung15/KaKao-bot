import http from "node:http";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const targetArg = process.argv[2] || process.env.SMOKE_BASE_URL || "";
let server;
let tempDbPath;

const PUBLIC_PAGE_PATHS = Object.freeze([
  "/",
  "/privacy",
  "/terms",
  "/updates",
  "/notice",
  "/store",
  "/guide",
  "/buyer-guide",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/apply",
  "/account",
  "/console",
  "/my-rooms",
  "/setup",
  "/license",
  "/status",
  "/command-store",
  "/help/pet",
  "/help/rpg",
  "/help/monster",
  "/help/attendance",
  "/help/ranking",
  "/help/games",
  "/help/shop",
  "/admin"
]);

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

async function json(baseUrl, pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, options);
  assert(response.ok, `${pathname} returned ${response.status}`);
  return response.json();
}

async function ownerTokenFromCredentials(baseUrl) {
  const adminToken = process.env.PIXGOM_SMOKE_ADMIN_TOKEN || process.env.SMOKE_ADMIN_TOKEN || "";
  if (adminToken) return adminToken;

  const email = process.env.PIXGOM_SMOKE_EMAIL || "";
  const password = process.env.PIXGOM_SMOKE_PASSWORD || "";
  if (!email || !password) return "";

  const config = await json(baseUrl, "/api/auth/config");
  let loginPayload = { email, password };
  if (config.auth?.supabaseEnabled) {
    assert(config.auth.supabaseUrl && config.auth.supabaseAnonKey, "supabase auth config missing");
    const tokenUrl = `${String(config.auth.supabaseUrl).replace(/\/+$/, "")}/auth/v1/token?grant_type=password`;
    const tokenResponse = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        apikey: config.auth.supabaseAnonKey,
        authorization: `Bearer ${config.auth.supabaseAnonKey}`
      },
      body: JSON.stringify({ email, password })
    });
    assert(tokenResponse.ok, `supabase password login returned ${tokenResponse.status}`);
    const tokenJson = await tokenResponse.json();
    assert(tokenJson.access_token, "supabase access token missing");
    loginPayload = { accessToken: tokenJson.access_token };
  }

  const loginResponse = await fetch(`${baseUrl}/api/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(loginPayload)
  });
  assert(loginResponse.ok, `/api/login returned ${loginResponse.status}`);
  const login = await loginResponse.json();
  assert(login.ownerAccess === true, "smoke account is not an owner admin");
  assert(login.ownerToken, "owner token missing");
  return login.ownerToken;
}

async function adminSmoke(baseUrl, checked) {
  const token = await ownerTokenFromCredentials(baseUrl);
  if (!token) return { skipped: true, reason: "admin credentials not provided" };
  const options = { headers: { "x-admin-session": token } };
  const me = await json(baseUrl, "/api/admin/me", options);
  assert(me.ok !== false, "/api/admin/me ok false");
  const rooms = await json(baseUrl, "/api/admin/rooms", options);
  assert(Array.isArray(rooms.rooms), "/api/admin/rooms rooms missing");
  checked.push("/api/admin/me", "/api/admin/rooms");

  const diagnostics = await json(baseUrl, "/api/admin/diagnostics", options);
  assert(Array.isArray(diagnostics.rooms), "/api/admin/diagnostics rooms missing");
  const liveEvents = await json(baseUrl, "/api/admin/live-events?limit=1", options);
  assert(Array.isArray(liveEvents.events), "/api/admin/live-events events missing");
  const performance = await json(baseUrl, "/api/admin/performance-summary?window=1h", options);
  assert(Array.isArray(performance.rooms), "/api/admin/performance-summary rooms missing");
  checked.push("/api/admin/diagnostics", "/api/admin/live-events", "/api/admin/performance-summary");

  const firstRoom = rooms.rooms.find((room) => room.name)?.name || "";
  if (!firstRoom) return { skipped: false, nicknameMerges: "skipped_no_rooms" };
  const mergePath = `/api/admin/nickname-merges?roomName=${encodeURIComponent(firstRoom)}&limit=1`;
  const nicknameMerges = await json(baseUrl, mergePath, options);
  assert(Array.isArray(nicknameMerges.history), "/api/admin/nickname-merges history missing");
  assert(Array.isArray(nicknameMerges.candidates), "/api/admin/nickname-merges candidates missing");
  checked.push("/api/admin/nickname-merges");
  return { skipped: false, nicknameMerges: "checked" };
}

async function publicPageSmoke(baseUrl, checked, options = {}) {
  if (!options.fullSite) return { skipped: true, reason: "full site smoke not requested" };
  const missingMeta = [];
  for (const pagePath of PUBLIC_PAGE_PATHS) {
    const response = await fetch(`${baseUrl}${pagePath}`);
    assert(response.ok, `${pagePath} returned ${response.status}`);
    assert(/text\/html/i.test(response.headers.get("content-type") || ""), `${pagePath} is not html`);
    const body = await response.text();
    if (!/<meta\s+name="description"\s+content="[^"]{20,}"/i.test(body)) missingMeta.push(pagePath);
  }
  assert(!missingMeta.length, `meta description missing: ${missingMeta.join(", ")}`);
  checked.push(...PUBLIC_PAGE_PATHS.map((pagePath) => `page:${pagePath}`));
  return { skipped: false, pages: PUBLIC_PAGE_PATHS.length };
}

try {
  const baseUrl = targetArg ? targetArg.replace(/\/+$/, "") : await localBaseUrl();
  const checked = ["/health", "/command-store", "/admin", "/console", "/my-rooms"];
  const fullSiteSmoke = !targetArg || process.env.PIXGOM_SMOKE_FULL_SITE === "1" || process.env.SMOKE_FULL_SITE === "1";
  const health = await json(baseUrl, "/health?versionCode=20");
  assert(health.ok === true, "/health ok false");
  assert(health.dbStatus?.ok === true, "/health dbStatus not ok");
  assert(Array.isArray(health.features), "/health features missing");

  const commandStore = await text(baseUrl, "/command-store");
  assert(commandStore.includes("Command Store") || commandStore.includes("명령어 스토어"), "/command-store content missing");

  const admin = await text(baseUrl, "/admin");
  assert(admin.includes("픽셀곰 운영자 어드민"), "/admin title missing");
  assert(admin.includes("일반방 중심 통합 운영 콘솔"), "/admin console shell missing");
  assert(admin.includes("/console-ui/assets/admin.js"), "/admin react asset missing");

  const consolePage = await text(baseUrl, "/console");
  assert(consolePage.includes("구매자 셀프 관리 콘솔") || consolePage.includes("픽셀곰 콘솔"), "/console content missing");
  assert(consolePage.includes("/console-ui/assets/buyer.js"), "/console react asset missing");

  const myRooms = await text(baseUrl, "/my-rooms");
  assert(myRooms.includes("내 방") || myRooms.includes("구매자 콘솔"), "/my-rooms content missing");

  const publicPages = await publicPageSmoke(baseUrl, checked, { fullSite: fullSiteSmoke });
  const adminSmokeResult = await adminSmoke(baseUrl, checked);

  console.log(JSON.stringify({
    ok: true,
    baseUrl,
    version: health.version,
    dbStatus: health.dbStatus.status || health.dbStatus.type,
    checked,
    publicPages,
    admin: adminSmokeResult
  }, null, 2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (tempDbPath) await unlink(tempDbPath).catch(() => {});
}
