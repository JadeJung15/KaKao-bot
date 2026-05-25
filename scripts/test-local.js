import assert from "node:assert/strict";
import http from "node:http";
import { createHmac } from "node:crypto";
import { readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

let server;
let weatherServer;
let testDbPath;
let baseUrl = process.env.TEST_BASE_URL || "";
const registeredRoomId = "gu25P5vi";
const registeredRoomLink = "https://open.kakao.com/o/gu25P5vi";

if (!baseUrl) {
  testDbPath = path.join(repoRoot, "data", `test-room-ops-db-${process.pid}.json`);
  process.env.DB_PATH = testDbPath;
  process.env.ADMIN_NAMES = "";
  process.env.ADMIN_CONSOLE_TOKEN = "test-admin-token";
  process.env.OWNER_ADMIN_EMAILS = `owner-${process.pid}@pixgom.test`;
  await unlink(testDbPath).catch(() => {});

  weatherServer = http.createServer((req, res) => {
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({
      current: {
        time: "2026-05-25T13:00",
        temperature_2m: 22.4,
        apparent_temperature: 23.1,
        relative_humidity_2m: 61,
        precipitation: 0,
        weather_code: 2,
        wind_speed_10m: 8.4
      },
      current_units: {
        temperature_2m: "°C",
        apparent_temperature: "°C",
        relative_humidity_2m: "%",
        precipitation: "mm",
        wind_speed_10m: "km/h"
      },
      hourly: {
        time: ["2026-05-25T13:00"],
        precipitation_probability: [20]
      }
    }));
  });
  await new Promise((resolve) => weatherServer.listen(0, "127.0.0.1", resolve));
  process.env.OPEN_METEO_BASE_URL = `http://127.0.0.1:${weatherServer.address().port}/v1/forecast`;

  const { requestHandler } = await import("../server.js");
  server = http.createServer(requestHandler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
}

async function cleanup() {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (weatherServer) await new Promise((resolve) => weatherServer.close(resolve));
  if (testDbPath) await unlink(testDbPath).catch(() => {});
}

async function request(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, options);
  const json = await response.json();
  return { response, json };
}

function signTestBuyerToken(accountId, email = "") {
  const payload = {
    kind: "buyer-guide",
    sub: accountId,
    email,
    exp: Date.now() + 60 * 60 * 1000
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", "test-admin-token").update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

async function upsertTestAccount(account) {
  if (!testDbPath) throw new Error("testDbPath_required");
  const state = JSON.parse(await readFile(testDbPath, "utf8"));
  state.accounts ||= {};
  state.accounts[account.id] = {
    status: "active",
    applicationIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...account
  };
  await writeFile(testDbPath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  return state.accounts[account.id];
}

async function readTestState() {
  if (!testDbPath) throw new Error("testDbPath_required");
  return JSON.parse(await readFile(testDbPath, "utf8"));
}

async function chat(msg, sender = "사용자", room = "테스트방") {
  return request("/chat-event", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      room,
      msg,
      sender,
      roomId: registeredRoomId,
      roomLink: registeredRoomLink,
      isGroupChat: true,
      packageName: "com.kakao.talk"
    })
  });
}

async function chatPayload(payload) {
  const { registeredRoom = true, ...body } = payload;
  return request("/chat-event", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      ...(registeredRoom ? { roomId: registeredRoomId, roomLink: registeredRoomLink } : {}),
      isGroupChat: true,
      rawIsGroupChat: true,
      packageName: "com.kakao.talk",
      ...body
    })
  });
}

try {
  const health = await request("/health");
  assert.equal(health.response.status, 200);
  assert.equal(health.json.ok, true);
  assert.equal(health.json.service, "kakao-room-ops-bot");
  assert.equal(health.json.version, "0.4.85");
  assert.equal(health.json.dbStatus.ok, true);
  assert.equal(health.json.dbStatus.type, "local-json");
  assert.match(health.json.serverTime, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(health.json.serverTimezone, "Asia/Seoul");
  assert.equal(health.json.minAndroidVersion, "1.0.17");
  assert.equal(health.json.latestAndroidVersion, "1.0.20");
  assert.equal(health.json.minAndroidVersionCode, 18);
  assert.equal(health.json.latestAndroidVersionCode, 21);
  assert.equal(health.json.appUpdateRequired, false);
  assert.equal(health.json.gamesEnabled, true);
  assert.equal(Object.hasOwn(health.json, "benchmark"), false);
  assert.match(health.json.features.join(","), /profile-registry/);
  assert.match(health.json.features.join(","), /message-inbox/);
  assert.match(health.json.features.join(","), /point-shop/);
  assert.match(health.json.features.join(","), /game-item-economy/);
  assert.match(health.json.features.join(","), /game-cooldowns/);
  assert.match(health.json.features.join(","), /fishing-bait-aquarium/);
  assert.match(health.json.features.join(","), /generated-fish-catalog/);
  assert.match(health.json.features.join(","), /detailed-member-history/);
  assert.match(health.json.features.join(","), /admin-commands/);
  assert.match(health.json.features.join(","), /point-ledger/);
  assert.match(health.json.features.join(","), /like-points/);
  assert.match(health.json.features.join(","), /attendance-rewards/);
  assert.match(health.json.features.join(","), /member-rankings/);
  assert.match(health.json.features.join(","), /raw-event-log/);
  assert.match(health.json.features.join(","), /role-based-help/);
  assert.match(health.json.features.join(","), /stable-user-ids/);
  assert.match(health.json.features.join(","), /admin-identity-reset/);
  assert.match(health.json.features.join(","), /bridge-auto-extract/);
  assert.match(health.json.features.join(","), /identity-nickname-summary/);
  assert.match(health.json.features.join(","), /raw-identity-nickname-recovery/);
  assert.match(health.json.features.join(","), /cross-room-identity-nickname-recovery/);
  assert.match(health.json.features.join(","), /identity-scoped-recent-events/);
  assert.match(health.json.features.join(","), /registered-room-guard/);
  assert.match(health.json.features.join(","), /system-event-dedupe/);
  assert.match(health.json.features.join(","), /compact-welcome-text/);
  assert.match(health.json.features.join(","), /bridge-reply-echo-guard/);
  assert.match(health.json.features.join(","), /passive-notification-guard/);
  assert.match(health.json.features.join(","), /multi-room-registry/);
  assert.match(health.json.features.join(","), /room-join-phrase/);
  assert.match(health.json.features.join(","), /commercial-subscription-gate/);
  assert.match(health.json.features.join(","), /future-game-roadmap/);
  assert.match(health.json.features.join(","), /license-key-guard/);
  assert.match(health.json.features.join(","), /admin-console-api/);
  assert.match(health.json.features.join(","), /admin-room-delete/);
  assert.match(health.json.features.join(","), /room-feature-toggles/);
  assert.match(health.json.features.join(","), /subscription-reminders/);
  assert.match(health.json.features.join(","), /admin-diagnostics-api/);
  assert.match(health.json.features.join(","), /admin-backup-restore/);
  assert.match(health.json.features.join(","), /chat-mini-games/);
  assert.match(health.json.features.join(","), /fixed-command-catalog/);
  assert.match(health.json.features.join(","), /custom-room-commands/);
  assert.match(health.json.features.join(","), /public-service-pages/);
  assert.match(health.json.features.join(","), /customer-signup-api/);
  assert.match(health.json.features.join(","), /customer-login-api/);
  assert.match(health.json.features.join(","), /manual-payment-approval/);
  assert.match(health.json.features.join(","), /buyer-guide-api/);
  assert.match(health.json.features.join(","), /protected-buyer-guide/);
  assert.match(health.json.features.join(","), /buyer-session-token/);
  assert.match(health.json.features.join(","), /split-account-application-flow/);
  assert.match(health.json.features.join(","), /bridge-connect-code-api/);
  assert.match(health.json.features.join(","), /buyer-room-auto-sync/);
  assert.match(health.json.features.join(","), /bridge-multi-room-auto-sync/);
  assert.match(health.json.features.join(","), /play-internal-test-link/);
  assert.match(health.json.features.join(","), /admin-console-search/);
  assert.match(health.json.features.join(","), /room-game-settings/);
  assert.match(health.json.features.join(","), /bridge-test-checklist/);
  assert.match(health.json.features.join(","), /admin-subscription-filters/);
  assert.match(health.json.features.join(","), /game-season-schedule/);
  assert.match(health.json.features.join(","), /buyer-owner-console-split/);
  assert.match(health.json.features.join(","), /supabase-auth-bridge/);
  assert.match(health.json.features.join(","), /kakao-login-ready/);
  assert.match(health.json.features.join(","), /kanana-ai-roadmap/);
  assert.match(health.json.features.join(","), /signup-consent-audit/);
  assert.match(health.json.features.join(","), /password-reset-flow/);
  assert.match(health.json.features.join(","), /owner-email-admin-access/);
  assert.match(health.json.features.join(","), /account-nickname-field/);
  assert.match(health.json.features.join(","), /additional-room-pricing/);
  assert.match(health.json.features.join(","), /simple-status-page/);
  assert.match(health.json.features.join(","), /branded-email-template/);
  assert.match(health.json.features.join(","), /kakao-oidc-id-token-login/);
  assert.match(health.json.features.join(","), /kakao-social-login-first-connect/);
  assert.match(health.json.features.join(","), /command-template-store/);
  assert.match(health.json.features.join(","), /representative-command-store/);
  assert.match(health.json.features.join(","), /chat-command-install-copy/);
  assert.match(health.json.features.join(","), /buyer-command-template-install/);
  assert.match(health.json.features.join(","), /owned-bridge-engine-marketing/);
  assert.match(health.json.features.join(","), /command-template-response-editor/);
  assert.match(health.json.features.join(","), /command-template-cart-favorites/);
  assert.match(health.json.features.join(","), /buyer-custom-command-management/);
  assert.match(health.json.features.join(","), /game-template-engine-shortcuts/);
  assert.match(health.json.features.join(","), /slashless-custom-command-triggers/);
  assert.match(health.json.features.join(","), /room-scoped-command-management/);
  assert.match(health.json.features.join(","), /admin-application-record-cleanup/);
  assert.match(health.json.features.join(","), /command-store-pagination/);
  assert.match(health.json.features.join(","), /command-template-bundles/);
  assert.match(health.json.features.join(","), /ready-to-use-command-responses/);
  assert.match(health.json.features.join(","), /command-store-set-editor/);
  assert.match(health.json.features.join(","), /server-version-diagnostics/);
  assert.match(health.json.features.join(","), /health-db-status-cards/);
  assert.match(health.json.features.join(","), /bridge-home-diagnostics/);
  assert.match(health.json.features.join(","), /bridge-log-share-action/);
  assert.match(health.json.features.join(","), /buyer-console-onboarding/);
  assert.match(health.json.features.join(","), /buyer-room-status-fields/);
  assert.match(health.json.features.join(","), /admin-room-status-badges/);
  assert.match(health.json.features.join(","), /admin-feature-summary-cards/);
  assert.match(health.json.features.join(","), /command-store-installed-search/);
  assert.match(health.json.features.join(","), /command-store-kakao-preview/);
  assert.match(health.json.features.join(","), /command-store-filter-refinement/);
  assert.match(health.json.features.join(","), /command-store-mode-ux/);
  assert.match(health.json.features.join(","), /new-buyer-journey-ux/);
  assert.match(health.json.features.join(","), /auth-session-gate/);
  assert.match(health.json.features.join(","), /silent-auth-transition/);
  assert.match(health.json.features.join(","), /room-report-workflow/);
  assert.match(health.json.features.join(","), /buyer-room-transfer/);
  assert.match(health.json.features.join(","), /command-store-action-cleanup/);
  assert.match(health.json.features.join(","), /compact-site-navigation/);
  assert.match(health.json.features.join(","), /why-pixgom-redesign/);
  assert.match(health.json.features.join(","), /subscription-expiry-guidance/);
  assert.match(health.json.features.join(","), /bridge-connect-expiry-gate/);
  assert.match(health.json.features.join(","), /license-error-user-guidance/);
  assert.match(health.json.features.join(","), /backup-schema-version/);
  assert.match(health.json.features.join(","), /admin-backup-dry-run/);
  assert.match(health.json.features.join(","), /backup-restore-error-summary/);
  assert.match(health.json.features.join(","), /deployment-preflight-script/);
  assert.match(health.json.features.join(","), /deployment-smoke-script/);
  assert.match(health.json.features.join(","), /rollback-runbook/);
  assert.match(health.json.features.join(","), /android-release-report/);
  assert.match(health.json.features.join(","), /play-closed-testing-checklist/);
  assert.match(health.json.features.join(","), /android-version-compatibility-guidance/);
  assert.match(health.json.features.join(","), /standardized-incident-messages/);
  assert.match(health.json.features.join(","), /admin-diagnostics-summary/);
  assert.match(health.json.features.join(","), /incident-history-cards/);
  assert.match(health.json.features.join(","), /server-owned-room-settings/);
  assert.equal(health.json.incidentMessages.SERVER_ERROR.code, "server_error");
  assert.equal(health.json.incidentMessages.DB_ERROR.code, "db_error");
  assert.equal(health.json.incidentMessages.AUTH_ERROR.code, "auth_error");
  assert.equal(health.json.incidentMessages.SUBSCRIPTION_EXPIRED.code, "subscription_expired");
  assert.equal(health.json.monthlyPriceKrw, 5500);
  assert.equal(health.json.additionalRoomPriceKrw, 2200);
  assert.equal(health.json.adminConsoleEnabled, true);

  const outdatedHealth = await request("/health?versionCode=17");
  assert.equal(outdatedHealth.response.status, 200);
  assert.equal(outdatedHealth.json.appUpdateRequired, true);
  assert.equal(outdatedHealth.json.clientAndroidVersionCode, 17);

  const authConfig = await request("/api/auth/config");
  assert.equal(authConfig.response.status, 200);
  assert.equal(authConfig.json.auth.mode, "local");
  assert.equal(authConfig.json.routes.ownerAdmin, "/admin");
  assert.equal(authConfig.json.routes.buyerConsole, "/console");

  const home = await fetch(`${baseUrl}/`);
  assert.equal(home.status, 200);
  assert.match(home.headers.get("content-type") || "", /text\/html/);
  const homeText = await home.text();
  assert.match(homeText, /픽셀곰/);
  assert.match(homeText, /KAKAOTALK/);
  assert.match(homeText, /kakaotalk:\/\/web\/openExternal/);
  assert.match(homeText, /intent:\/\//);
  assert.doesNotMatch(homeText, /package=com\.android\.chrome/);
  assert.doesNotMatch(homeText, /"#Intent"/);
  assert.match(homeText, /targetUrl\.search\}#Intent`/);
  assert.match(homeText, /기본 브라우저/);
  assert.match(homeText, /픽셀곰 브릿지/);
  assert.match(homeText, /픽셀곰 브릿지/);
  assert.match(homeText, /픽셀곰 콘솔/);
  assert.match(homeText, /픽셀곰봇/);
  assert.match(homeText, /픽셀곰 RPG/);
  assert.match(homeText, /다중방/);
  assert.match(homeText, /방장봇 입장확인/);
  assert.match(homeText, /화면 감지 없이/);
  assert.match(homeText, /5,500원/);
  assert.match(homeText, /2,200원/);
  assert.match(homeText, /게임/);
  assert.match(homeText, /관리 콘솔/);
  assert.match(homeText, /기능 ON\/OFF/);
  assert.match(homeText, /주사위/);
  assert.match(homeText, /커스텀 명령어/);
  assert.match(homeText, /업데이트 기록/);
  assert.match(homeText, /0\.4\.64/);
  assert.match(homeText, /0\.4\.65/);
  assert.match(homeText, /0\.4\.66/);
  assert.match(homeText, /0\.4\.63/);
  assert.match(homeText, /0\.4\.62/);
  assert.match(homeText, /0\.4\.61/);
  assert.match(homeText, /0\.4\.51/);
  assert.match(homeText, /0\.4\.50/);
  assert.match(homeText, /0\.4\.49/);
  assert.match(homeText, /0\.4\.43/);
  assert.match(homeText, /0\.4\.44/);
  assert.match(homeText, /0\.4\.45/);
  assert.match(homeText, /수동 입금 확인/);
  assert.match(homeText, /구매자 전용/);
  assert.match(homeText, /개인정보처리방침/);
  assert.match(homeText, /서비스 이용약관/);
  assert.match(homeText, /data-site-search/);
  assert.match(homeText, /href="https:\/\/open\.kakao\.com\/o\/gu25P5vi"/);
  assert.match(homeText, /오픈채팅 문의/);
  assert.match(homeText, /Kanana/);
  assert.match(homeText, /AI 운영 도우미 후보/);
  assert.match(homeText, /0\.4\.53/);
  assert.match(homeText, /0\.4\.52/);
  assert.match(homeText, /0\.4\.57/);
  assert.match(homeText, /0\.4\.58/);
  assert.match(homeText, /0\.4\.59/);
  assert.doesNotMatch(homeText, /MessengerBotR/);
  assert.match(homeText, /자체 개발 브릿지 엔진으로 카카오 오픈채팅 운영을/);
  assert.match(homeText, /타 앱 스크립트에 기대지 않는 오픈채팅 운영 엔진/);
  assert.match(homeText, /Vercel \+ postgres 중심/);
  assert.match(homeText, /전용 브릿지 엔진/);
  assert.match(homeText, /대표 명령어 팩/);
  assert.match(homeText, /명령어 스토어/);
  assert.match(homeText, /aria-label="픽셀곰 시작 흐름"/);
  assert.match(homeText, /Step 01/);
  assert.match(homeText, /서비스 신청/);
  assert.match(homeText, /앱 연결/);
  assert.match(homeText, /명령어 설치/);
  assert.match(homeText, /운영 관리/);
  const statusStripText = homeText.match(/<section class="status-strip"[\s\S]*?<\/section>/)?.[0] || "";
  assert.doesNotMatch(statusStripText, /전용 브릿지/);
  assert.doesNotMatch(statusStripText, /단일 요금/);
  assert.doesNotMatch(statusStripText, /커스텀 명령어/);
  assert.match(homeText, /href="\/command-store">명령어<\/a>/);
  assert.match(homeText, /href="\/console">콘솔<\/a>/);
  const homeNavText = homeText.match(/<nav class="nav-links"[\s\S]*?<\/nav>/)?.[0] || "";
  assert.doesNotMatch(homeNavText, /href="\/store"/);
  assert.match(homeText, /0\.4\.82/);
  assert.match(homeText, /0\.4\.81/);
  assert.match(homeText, /0\.4\.70/);
  assert.match(homeText, /0\.4\.80/);
  assert.match(homeText, /0\.4\.79/);
  assert.match(homeText, /처음 시작은 5단계/);
  assert.match(homeText, /계정 만들기/);
  assert.match(homeText, /첫 명령어 설치/);

  for (const pagePath of ["/privacy", "/terms", "/updates", "/notice", "/store", "/guide", "/buyer-guide", "/login", "/signup", "/forgot-password", "/reset-password", "/apply", "/console", "/my-rooms", "/setup", "/license", "/status", "/command-store"]) {
    const page = await fetch(`${baseUrl}${pagePath}`);
    assert.equal(page.status, 200);
    assert.match(page.headers.get("content-type") || "", /text\/html/);
  }

  const noticePageText = await (await fetch(`${baseUrl}/notice`)).text();
  assert.match(noticePageText, /장애 대응 기준/);
  const updatesPageText = await (await fetch(`${baseUrl}/updates`)).text();
  assert.match(updatesPageText, /픽셀곰 0\.4\.84/);
  assert.match(updatesPageText, /픽셀곰 0\.4\.82/);
  assert.match(updatesPageText, /픽셀곰 0\.4\.83/);
  assert.match(updatesPageText, /픽셀곰 0\.4\.81/);
  assert.match(updatesPageText, /픽셀곰 0\.4\.80/);
  assert.match(updatesPageText, /픽셀곰 0\.4\.79/);
  assert.match(updatesPageText, /픽셀곰 0\.4\.70/);

  const signupPageText = await (await fetch(`${baseUrl}/signup`)).text();
  assert.match(signupPageText, /처음 시작 5단계/);
  assert.match(signupPageText, /auth-page auth-checking/);
  assert.doesNotMatch(signupPageText, /로그인 세션을 확인 중입니다/);
  assert.match(signupPageText, /createSilentGate/);
  assert.match(signupPageText, /계정 만들기/);
  assert.match(signupPageText, /friendlyError/);
  const applyPageText = await (await fetch(`${baseUrl}/apply`)).text();
  assert.match(applyPageText, /처음 시작 5단계/);
  assert.match(applyPageText, /auth-page auth-checking/);
  assert.doesNotMatch(applyPageText, /로그인 세션을 확인 중입니다/);
  assert.match(applyPageText, /createSilentGate/);
  assert.match(applyPageText, /신청 전 확인/);
  assert.match(applyPageText, /https:\/\/open\.kakao\.com\/o\/abcd1234/);
  assert.match(applyPageText, /friendlyError/);
  assert.match(applyPageText, /data-account-identity/);
  assert.match(applyPageText, /연락 가능한 연락처/);
  assert.match(applyPageText, /storedAccessPayload/);
  const loginPageText = await (await fetch(`${baseUrl}/login`)).text();
  assert.match(loginPageText, /처음 시작 5단계/);
  assert.match(loginPageText, /auth-page auth-checking/);
  assert.doesNotMatch(loginPageText, /로그인 세션을 확인 중입니다/);
  assert.match(loginPageText, /createSilentGate/);
  assert.match(loginPageText, /다음 행동: 서비스 신청하기/);

  const commandStorePage = await fetch(`${baseUrl}/command-store`);
  const commandStoreText = await commandStorePage.text();
  assert.match(commandStoreText, /명령어 스토어/);
  assert.match(commandStoreText, /즐겨찾기/);
  assert.match(commandStoreText, /장바구니/);
  assert.match(commandStoreText, /응답 문구/);
  assert.match(commandStoreText, /10종 명령어 팩/);
  assert.match(commandStoreText, /data-template-grid/);
  assert.match(commandStoreText, /data-load-more/);
  assert.match(commandStoreText, /대표 명령어/);
  assert.match(commandStoreText, /팩으로 시작/);
  assert.match(commandStoreText, /명령어 찾기/);
  assert.match(commandStoreText, /내 장바구니/);
  assert.match(commandStoreText, /data-store-mode="packs"/);
  assert.match(commandStoreText, /상세 필터/);
  assert.match(commandStoreText, /data-filter-mode="bundle"/);
  assert.match(commandStoreText, /data-filter-mode="participant"/);
  assert.match(commandStoreText, /설치된 명령어 검색/);
  assert.match(commandStoreText, /data-installed-search/);
  const commandStoreScriptText = await (await fetch(`${baseUrl}/command-store.js`)).text();
  assert.match(commandStoreScriptText, /template-install-preview/);
  assert.match(commandStoreScriptText, /설치 전 카카오 응답 미리보기/);
  assert.match(commandStoreScriptText, /카톡 설치 명령어 복사/);
  assert.match(commandStoreScriptText, /data-copy-cart-install/);
  assert.match(commandStoreScriptText, /고급: 사이트에서 바로 설치/);
  assert.match(commandStoreScriptText, /recommendedPacksForCart/);
  assert.match(commandStoreScriptText, /matchesTokens/);
  assert.match(commandStoreScriptText, /data-edit-command/);
  assert.match(commandStoreScriptText, /처음이면 운영 기본팩 담기/);
  assert.match(commandStoreScriptText, /data-add-first-pack/);

  const checklistAsset = await fetch(`${baseUrl}/assets/pixgom-checklist.png`);
  assert.equal(checklistAsset.status, 200);

  const commandTemplates = await request("/api/command-templates");
  assert.equal(commandTemplates.response.status, 200);
  assert.equal(commandTemplates.json.ok, true);
  assert.equal(commandTemplates.json.version, "0.4.85");
  assert.equal(commandTemplates.json.total, commandTemplates.json.templates.length);
  assert.equal(commandTemplates.json.total < 400, true);
  assert.equal(commandTemplates.json.total > 100, true);
  assert.equal(commandTemplates.json.categories.some((category) => category.title === "게임 연결"), true);
  assert.equal(commandTemplates.json.categories.some((category) => category.title === "기본 운영"), true);
  assert.equal(commandTemplates.json.categories.some((category) => category.title === "관리자용"), true);
  assert.equal(commandTemplates.json.templates.filter((template) => template.categoryId === "basic-ops" && template.trigger === "/공지").length, 1);
  assert.equal(commandTemplates.json.templates.some((template) => template.categoryId === "basic-ops" && /공지 (안내|요약|확인|바로보기)/.test(template.title)), false);
  assert.equal(commandTemplates.json.templates.some((template) => template.trigger === "/출석" && template.kind === "fixed"), true);
  assert.equal(commandTemplates.json.templates.some((template) => template.installable && template.kind === "custom"), true);
  assert.equal(commandTemplates.json.templates.some((template) => template.installable && template.proxyCommand === "/주사위"), true);
  assert.equal(commandTemplates.json.templates.some((template) => template.kind === "game-template" && !template.proxyCommand && template.installable === false && template.status === "coming_soon"), true);
  assert.equal(commandTemplates.json.templates.every((template) => template.kind !== "roadmap" || (template.installable === false && template.status === "coming_soon")), true);
  assert.equal(commandTemplates.json.summary.bundles >= 4, true);
  assert.equal(commandTemplates.json.templates.some((template) => template.kind === "bundle" && template.commands?.length > 1), true);
  assert.equal(commandTemplates.json.templates.some((template) => template.id === "bundle-ops-starter" && template.installCode === "st.001" && template.installCodeType === "set"), true);
  assert.equal(commandTemplates.json.templates.some((template) => template.categoryId === "basic-ops" && template.trigger === "/공지" && /^no\.\d{3}$/.test(template.installCode) && template.installCodeType === "command"), true);
  assert.equal(commandTemplates.json.templates.some((template) => template.trigger === "/신고" && template.installable), false);
  assert.equal(commandTemplates.json.templates.some((template) => template.trigger === "/신고처리" && template.installable), false);
  assert.equal(commandTemplates.json.templates.some((template) => template.trigger === "/쿠폰" && template.installable), false);
  assert.equal(commandTemplates.json.templates.some((template) => template.trigger === "/인기투표" && template.installable), false);
  assert.equal(commandTemplates.json.templates.some((template) => template.trigger === "/투표" && template.installable), false);
  assert.equal(commandTemplates.json.templates.some((template) => /관리자가 보상, 쿨타임, 확률/.test(template.response || "")), false);
  assert.equal(commandTemplates.json.templates.some((template) => /템플릿 번호/.test(template.response || "")), false);

  const commandPacks = await request("/api/command-packs");
  assert.equal(commandPacks.response.status, 200);
  assert.equal(commandPacks.json.ok, true);
  assert.equal(commandPacks.json.version, "0.4.85");
  assert.equal(commandPacks.json.total, 10);
  assert.equal(commandPacks.json.packs.some((pack) => pack.id === "ops-core" && pack.fixedCommands.includes("/상태") && pack.fixedCommands.includes("/운세") && pack.fixedCommands.includes("/신고")), true);
  assert.equal(commandPacks.json.packs.some((pack) => pack.id === "ops-core" && pack.installCode === "pk.001" && pack.installCodeType === "pack"), true);
  assert.equal(commandPacks.json.packs.some((pack) => pack.id === "game-chance" && pack.fixedCommands.includes("/뽑기") && pack.fixedCommands.includes("/홀짝")), true);
  assert.equal(commandPacks.json.packs.some((pack) => pack.id === "all-in-one-ops" && pack.fixedCommands.includes("/관리자등록") && pack.fixedCommands.includes("/신고처리") && pack.fixedCommands.includes("/상점")), true);
  assert.equal(commandPacks.json.packs.some((pack) => pack.id === "basic-ops"), false);

  const statusPage = await fetch(`${baseUrl}/status`);
  const statusPageText = await statusPage.text();
  assert.match(statusPageText, /서버 상태/);
  assert.match(statusPageText, /연결 상태/);
  assert.match(statusPageText, /서버\/앱 버전/);
  assert.match(statusPageText, /저장소 상태/);
  assert.match(statusPageText, /장애 대응 기준|서버 오류/);
  assert.match(statusPageText, /data-status-incident/);
  assert.match(statusPageText, /data-status-app-version/);
  assert.match(statusPageText, /추가 방/);
  assert.doesNotMatch(statusPageText, /"features"/);

  const consolePageText = await (await fetch(`${baseUrl}/console`)).text();
  assert.match(consolePageText, /구매자 콘솔/);
  assert.match(consolePageText, /20260525-silent-auth/);
  assert.match(consolePageText, /buyer-gate is-auth-checking/);
  assert.doesNotMatch(consolePageText, /로그인 세션을 확인 중입니다/);
  const buyerConsoleScriptText = await (await fetch(`${baseUrl}/buyer-console.js`)).text();
  assert.match(buyerConsoleScriptText, /buyer-onboarding/);
  assert.match(buyerConsoleScriptText, /처음 시작 체크리스트/);
  assert.match(buyerConsoleScriptText, /renderNextAction/);
  assert.match(buyerConsoleScriptText, /다음 할 일/);
  assert.match(buyerConsoleScriptText, /\/api\/buyer\/room-commands/);
  assert.match(buyerConsoleScriptText, /명령어 검색/);
  assert.match(buyerConsoleScriptText, /장착된 명령어 팩/);
  assert.match(buyerConsoleScriptText, /showConsoleGate/);
  assert.match(buyerConsoleScriptText, /운영 기본팩 설치 명령어 복사/);
  assert.match(buyerConsoleScriptText, /\/명령어설치 pk\.001/);
  assert.match(buyerConsoleScriptText, /방 소유권 이관/);
  assert.match(buyerConsoleScriptText, /\/api\/buyer\/room-transfer\/create/);
  assert.match(buyerConsoleScriptText, /\/api\/buyer\/room-transfer\/accept/);
  assert.match(buyerConsoleScriptText, /\/api\/buyer\/room-transfer\/cancel/);
  assert.match(buyerConsoleScriptText, /이관 내역/);
  assert.match(buyerConsoleScriptText, /renderTransferHistory/);

  const commandStorePageText = await (await fetch(`${baseUrl}/command-store`)).text();
  assert.match(commandStorePageText, /명령어 팩/);
  assert.match(commandStorePageText, /장착/);
  assert.match(commandStorePageText, /교체/);
  assert.match(commandStoreScriptText, /\/api\/command-packs/);
  assert.match(commandStoreScriptText, /\/api\/buyer\/command-packs\/apply/);

  const adminPage = await fetch(`${baseUrl}/admin`);
  assert.equal(adminPage.status, 200);
  const adminPageText = await adminPage.text();
  assert.match(adminPageText, /픽셀곰 콘솔/);
  assert.match(adminPageText, /방별 기능 ON\/OFF/);
  assert.match(adminPageText, /admin-status-badge/);
  assert.match(adminPageText, /백업 복구/);
  assert.match(adminPageText, /복구 dry-run 확인/);
  assert.match(adminPageText, /\/api\/admin\/backup\/validate/);
  assert.match(adminPageText, /신청\/결제/);
  assert.match(adminPageText, /명령어 추가\/수정/);
  assert.match(adminPageText, /게임 시즌\/보상 설정/);
  assert.match(adminPageText, /선택 방 삭제/);
  assert.match(adminPageText, /기록 삭제/);
  assert.match(adminPageText, /슬래시\(\/\) 없이도 등록 가능/);
  assert.match(adminPageText, /만료 임박 7일/);
  assert.match(adminPageText, /문제 방/);
  assert.match(adminPageText, /브릿지 확인/);
  assert.match(adminPageText, /시즌 시작일/);
  assert.match(adminPageText, /방, 관리자, 라이선스/);
  assert.match(adminPageText, /운영자 로그인 확인/);
  assert.match(adminPageText, /room-delete-button/);
  assert.match(adminPageText, /신고 관리/);
  assert.match(adminPageText, /data-load-reports/);
  assert.match(adminPageText, /data-report-status-filter/);
  assert.match(adminPageText, /\/api\/admin\/reports\/resolve/);
  assert.match(adminPageText, /이관 내역/);
  assert.match(adminPageText, /data-load-transfers/);
  assert.match(adminPageText, /data-transfer-status-filter/);
  assert.match(adminPageText, /\/api\/admin\/transfers/);
  assert.match(adminPageText, /session-nav\.js/);
  assert.doesNotMatch(adminPageText, /ADMIN_CONSOLE_TOKEN/);

  const authScript = await fetch(`${baseUrl}/auth.js`);
  assert.equal(authScript.status, 200);
  const authScriptText = await authScript.text();
  assert.match(authScriptText, /kakaoOidcStartUrl/);
  assert.match(authScriptText, /friendlyError/);
  assert.match(authScriptText, /openchat_link_required/);
  assert.match(authScriptText, /createSilentGate/);
  assert.match(authScriptText, /hasStoredSessionHint/);

  const sessionNavScript = await fetch(`${baseUrl}/session-nav.js`);
  assert.equal(sessionNavScript.status, 200);
  const sessionNavText = await sessionNavScript.text();
  assert.match(sessionNavText, /pixgomOwnerToken/);
  assert.match(sessionNavText, /pixgomBuyerToken/);
  assert.match(sessionNavText, /normalizeSiteNavigation/);
  assert.match(sessionNavText, /nav-menu-toggle/);
  assert.match(sessionNavText, /nav-logout/);

  const packageJson = JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf8"));
  assert.equal(packageJson.version, "0.4.85");
  assert.equal(packageJson.scripts["check:deploy"], "node scripts/predeploy-check.js");
  assert.equal(packageJson.scripts["smoke:local"], "node scripts/smoke-check.js");
  assert.equal(packageJson.scripts["smoke:prod"], "node scripts/smoke-check.js https://pixgom.com");
  assert.equal(packageJson.scripts["android:bundle"], "node scripts/android-release-bundle.js");
  assert.equal(packageJson.scripts["android:release-report"], "node scripts/android-release-bundle.js --report-only");
  const androidGradle = await readFile(path.join(repoRoot, "pixelgom-bridge-android", "app", "build.gradle"), "utf8");
  assert.match(androidGradle, /versionCode 21/);
  assert.match(androidGradle, /versionName "1\.0\.20"/);
  const androidChecklist = await readFile(path.join(repoRoot, "pixelgom-bridge-android", "PLAY_STORE_CHECKLIST.md"), "utf8");
  assert.match(androidChecklist, /비공개 테스트/);
  assert.match(androidChecklist, /1\.0\.20 \(21\)/);

  const adminUnauthorized = await request("/api/admin/rooms");
  assert.equal(adminUnauthorized.response.status, 401);
  assert.equal(adminUnauthorized.json.error, "owner_login_required");

  const signupWithoutConsent = await request("/api/signup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      nickname: "동의누락",
      email: `missing-consent-${process.pid}@pixgom.test`,
      password: "password123",
      passwordConfirm: "password123"
    })
  });
  assert.equal(signupWithoutConsent.response.status, 400);
  assert.equal(signupWithoutConsent.json.error, "terms_required");

  const signupWithoutNickname = await request("/api/signup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: `missing-nickname-${process.pid}@pixgom.test`,
      password: "password123",
      passwordConfirm: "password123",
      termsAgreed: true,
      privacyAgreed: true
    })
  });
  assert.equal(signupWithoutNickname.response.status, 400);
  assert.equal(signupWithoutNickname.json.error, "nickname_required");

  const signupMismatch = await request("/api/signup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      nickname: "불일치",
      email: `mismatch-${process.pid}@pixgom.test`,
      password: "password123",
      passwordConfirm: "password124",
      termsAgreed: true,
      privacyAgreed: true
    })
  });
  assert.equal(signupMismatch.response.status, 400);
  assert.equal(signupMismatch.json.error, "password_mismatch");

  const ownerSignup = await request("/api/signup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      nickname: "운영자",
      email: `owner-${process.pid}@pixgom.test`,
      password: "password123",
      passwordConfirm: "password123",
      termsAgreed: true,
      privacyAgreed: true
    })
  });
  assert.equal(ownerSignup.response.status, 200);
  assert.equal(ownerSignup.json.account.ownerAccess, true);
  assert.equal(ownerSignup.json.account.nickname, "운영자");

  const ownerLogin = await request("/api/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: `owner-${process.pid}@pixgom.test`,
      password: "password123"
    })
  });
  assert.equal(ownerLogin.response.status, 200);
  assert.equal(ownerLogin.json.ownerAccess, true);
  assert.match(ownerLogin.json.ownerToken, /\./);

  const adminMe = await request("/api/admin/me", {
    headers: { "x-admin-session": ownerLogin.json.ownerToken }
  });
  assert.equal(adminMe.response.status, 200);
  assert.equal(adminMe.json.owner, `owner-${process.pid}@pixgom.test`);

  const ownerAdminRooms = await request("/api/admin/rooms", {
    headers: { "x-admin-session": ownerLogin.json.ownerToken }
  });
  assert.equal(ownerAdminRooms.response.status, 200);

  const adminRoom = await request("/api/admin/rooms", {
    method: "POST",
    headers: { "content-type": "application/json", "x-admin-token": "test-admin-token" },
    body: JSON.stringify({
      room: "콘솔방",
      roomId: "consoleRoom1",
      roomLink: "https://open.kakao.com/o/consoleRoom1",
      joinPhrase: "콘솔 입장확인",
      roomAdmins: ["콘솔관리자"],
      licenseKey: "PXG-CONSOLE-1234",
      subscriptionExpiresAt: "2099-12-31",
      features: {
        attendance: false,
        points: true,
        rankings: true,
        history: true,
        profiles: true,
        localJs: true,
        games: true,
        customCommands: true
      },
      gameSettings: {
        seasonName: "콘솔 시즌",
        seasonStartsAt: "2026-06-01",
        seasonEndsAt: "2026-06-30",
        diceReward: 7,
        fishingReward: 8,
        exploreReward: 9
      },
      customCommands: [{ trigger: "/공지", response: "콘솔 공지입니다." }]
    })
  });
  assert.equal(adminRoom.response.status, 200);
  assert.equal(adminRoom.json.room.licenseKey, "PXG-CONSOLE-1234");
  assert.match(adminRoom.json.room.subscription.expiresAt, /2099/);
  assert.equal(adminRoom.json.room.features.attendance, false);
  assert.equal(adminRoom.json.room.features.games, true);
  assert.equal(adminRoom.json.room.features.customCommands, true);
  assert.equal(adminRoom.json.room.licenseStatus, "active");
  assert.equal(adminRoom.json.room.bridgeStatus, "ready");
  assert.equal(adminRoom.json.room.commandCount, 1);
  assert.equal(adminRoom.json.room.subscription.statusLabel, "정상");
  assert.equal(adminRoom.json.room.disabledFeatures.includes("출석"), true);
  assert.equal(adminRoom.json.room.gameSettings.seasonName, "콘솔 시즌");
  assert.match(adminRoom.json.room.gameSettings.seasonStartsAt, /2026/);
  assert.match(adminRoom.json.room.gameSettings.seasonEndsAt, /2026/);
  assert.equal(adminRoom.json.room.gameSettings.diceReward, 7);
  assert.equal(adminRoom.json.room.customCommands[0].trigger, "/공지");

  const staleBridgeFeatures = await chatPayload({
    registeredRoom: false,
    room: "콘솔방",
    msg: "일반 대화",
    sender: "콘솔사용자",
    roomId: "consoleRoom1",
    roomLink: "https://open.kakao.com/o/consoleRoom1",
    licenseKey: "PXG-CONSOLE-1234",
    features: {
      attendance: true,
      games: false,
      customCommands: false
    }
  });
  assert.equal(staleBridgeFeatures.response.status, 200);
  const adminRoomsAfterStaleBridge = await request("/api/admin/rooms?token=test-admin-token");
  assert.equal(adminRoomsAfterStaleBridge.response.status, 200);
  const consoleRoomAfterStaleBridge = adminRoomsAfterStaleBridge.json.rooms.find((room) => room.name === "콘솔방");
  assert.equal(consoleRoomAfterStaleBridge.features.attendance, false);
  assert.equal(consoleRoomAfterStaleBridge.features.games, true);
  assert.equal(consoleRoomAfterStaleBridge.features.customCommands, true);

  const adminRooms = await request("/api/admin/rooms?token=test-admin-token");
  assert.equal(adminRooms.response.status, 200);
  assert.match(JSON.stringify(adminRooms.json.rooms), /콘솔방/);
  assert.equal(adminRooms.json.summary.rooms >= 1, true);
  assert.equal(typeof adminRooms.json.summary.expiringRooms, "number");

  const adminDeleteSeed = await request("/api/admin/rooms", {
    method: "POST",
    headers: { "content-type": "application/json", "x-admin-token": "test-admin-token" },
    body: JSON.stringify({
      room: "삭제테스트방",
      roomId: "deleteRoom1",
      roomAdmins: ["삭제관리자"],
      licenseKey: "PXG-DELETE-1234",
      subscriptionExpiresAt: "2099-12-31"
    })
  });
  assert.equal(adminDeleteSeed.response.status, 200);
  const adminDelete = await request("/api/admin/rooms", {
    method: "DELETE",
    headers: { "content-type": "application/json", "x-admin-token": "test-admin-token" },
    body: JSON.stringify({ room: "삭제테스트방", roomId: "deleteRoom1" })
  });
  assert.equal(adminDelete.response.status, 200);
  assert.equal(adminDelete.json.deletedRoom.name, "삭제테스트방");
  const adminRoomsAfterDelete = await request("/api/admin/rooms?token=test-admin-token");
  assert.doesNotMatch(JSON.stringify(adminRoomsAfterDelete.json.rooms), /삭제테스트방/);

  const adminDiagnostics = await request("/api/admin/diagnostics?token=test-admin-token");
  assert.equal(adminDiagnostics.response.status, 200);
  assert.equal(adminDiagnostics.json.version, "0.4.85");
  assert.ok(Number.isFinite(adminDiagnostics.json.summary.rooms));
  assert.ok(Number.isFinite(adminDiagnostics.json.summary.problemRooms));
  assert.ok(Number.isFinite(adminDiagnostics.json.summary.bridgeProblemRooms));
  assert.equal(adminDiagnostics.json.incidentMessages.SERVER_ERROR.code, "server_error");
  assert.match(JSON.stringify(adminDiagnostics.json.rooms), /콘솔방/);

  const adminBackup = await request("/api/admin/backup?token=test-admin-token");
  assert.equal(adminBackup.response.status, 200);
  assert.equal(adminBackup.json.ok, true);
  assert.equal(adminBackup.json.schemaVersion, 1);
  assert.equal(adminBackup.json.version, "0.4.85");
  assert.ok(adminBackup.json.state.rooms);

  const backupValidation = await request("/api/admin/backup/validate?token=test-admin-token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(adminBackup.json)
  });
  assert.equal(backupValidation.response.status, 200);
  assert.equal(backupValidation.json.ok, true);
  assert.equal(backupValidation.json.supportedSchemaVersion, 1);
  assert.ok(backupValidation.json.roomCount >= 1);
  assert.match(backupValidation.json.summary, /복구 대상/);

  const fullStateRestoreBlocked = await request("/api/admin/restore?token=test-admin-token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(adminBackup.json)
  });
  assert.equal(fullStateRestoreBlocked.response.status, 409);
  assert.equal(fullStateRestoreBlocked.json.error, "full_state_restore_blocked");
  assert.match(fullStateRestoreBlocked.json.summary, /전체 state 덮어쓰기 복구/);

  const roomUnitRestore = await request("/api/admin/restore?token=test-admin-token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ schemaVersion: 1, rooms: Object.values(adminBackup.json.state.rooms).slice(0, 1) })
  });
  assert.equal(roomUnitRestore.response.status, 200);
  assert.equal(roomUnitRestore.json.ok, true);
  assert.ok(roomUnitRestore.json.restored.length >= 1);

  const backupValidationFailure = await request("/api/admin/backup/validate?token=test-admin-token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ schemaVersion: 1, rooms: [] })
  });
  assert.equal(backupValidationFailure.response.status, 400);
  assert.equal(backupValidationFailure.json.ok, false);
  assert.match(backupValidationFailure.json.errors.join(","), /rooms_required/);
  assert.match(backupValidationFailure.json.summary, /검증 실패/);

  const signup = await request("/api/signup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      nickname: "테스터",
      email: `tester-${process.pid}@pixgom.test`,
      password: "password123",
      passwordConfirm: "password123",
      termsAgreed: true,
      privacyAgreed: true,
      marketingAgreed: true
    })
  });
  assert.equal(signup.response.status, 200);
  assert.equal(signup.json.created, true);
  assert.equal(signup.json.account.nickname, "테스터");
  assert.equal(signup.json.account.email, `tester-${process.pid}@pixgom.test`);
  assert.equal(signup.json.account.consents.terms, true);
  assert.equal(signup.json.account.consents.privacy, true);
  assert.equal(signup.json.account.consents.marketing, true);
  assert.equal(Object.hasOwn(signup.json, "application"), false);

  const apply = await request("/api/apply", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: `tester-${process.pid}@pixgom.test`,
      password: "password123",
      roomName: "판매신청방",
      roomLink: "https://open.kakao.com/o/salesRoom1",
      adminName: "신청관리자",
      contact: "kakao-test",
      memo: "자동 테스트 신청"
    })
  });
  assert.equal(apply.response.status, 200);
  assert.equal(apply.json.application.status, "pending_payment");
  assert.equal(apply.json.payment.status, "awaiting_manual_deposit");
  assert.equal(apply.json.payment.amountKrw, 5500);

  const badDuplicateSignup = await request("/api/signup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      nickname: "테스터",
      email: `tester-${process.pid}@pixgom.test`,
      password: "wrongpass123",
      roomName: "판매신청방2",
      roomLink: "https://open.kakao.com/o/salesRoom2",
      adminName: "신청관리자"
    })
  });
  assert.equal(badDuplicateSignup.response.status, 409);
  assert.equal(badDuplicateSignup.json.error, "email_already_registered");

  const login = await request("/api/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: `tester-${process.pid}@pixgom.test`,
      password: "password123"
    })
  });
  assert.equal(login.response.status, 200);
  assert.equal(login.json.applications.length, 1);
  assert.equal(login.json.applications[0].payment.status, "awaiting_manual_deposit");
  assert.equal(login.json.buyerAccess, false);
  assert.equal(Object.hasOwn(login.json, "guideToken"), false);

  const buyerGuideAnonymous = await request("/api/buyer/guide", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({})
  });
  assert.equal(buyerGuideAnonymous.response.status, 401);
  assert.equal(buyerGuideAnonymous.json.error, "invalid_login");

  const buyerGuidePending = await request("/api/buyer/guide", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: `tester-${process.pid}@pixgom.test`,
      password: "password123"
    })
  });
  assert.equal(buyerGuidePending.response.status, 403);
  assert.equal(buyerGuidePending.json.error, "buyer_approval_required");

  const adminApplications = await request("/api/admin/applications?token=test-admin-token");
  assert.equal(adminApplications.response.status, 200);
  assert.match(JSON.stringify(adminApplications.json.applications), /판매신청방/);
  assert.equal(adminApplications.json.summary.pending >= 1, true);

  const cleanupApplication = await request("/api/apply", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: `tester-${process.pid}@pixgom.test`,
      password: "password123",
      roomName: "삭제신청방",
      roomLink: "https://open.kakao.com/o/deleteApply1",
      adminName: "신청관리자"
    })
  });
  assert.equal(cleanupApplication.response.status, 200);
  const deletedApplication = await request("/api/admin/applications", {
    method: "DELETE",
    headers: { "content-type": "application/json", "x-admin-token": "test-admin-token" },
    body: JSON.stringify({ applicationId: cleanupApplication.json.application.id })
  });
  assert.equal(deletedApplication.response.status, 200);
  assert.equal(deletedApplication.json.deletedApplication.roomName, "삭제신청방");
  const adminApplicationsAfterDelete = await request("/api/admin/applications?token=test-admin-token");
  assert.doesNotMatch(JSON.stringify(adminApplicationsAfterDelete.json.applications), /삭제신청방/);

  const approvedApplication = await request("/api/admin/applications/approve", {
    method: "POST",
    headers: { "content-type": "application/json", "x-admin-token": "test-admin-token" },
    body: JSON.stringify({ applicationId: apply.json.application.id, months: 1 })
  });
  assert.equal(approvedApplication.response.status, 200);
  assert.equal(approvedApplication.json.application.status, "approved");
  assert.equal(approvedApplication.json.payment.status, "paid");
  assert.match(approvedApplication.json.room.licenseKey, /^PXG-/);

  const approvedLogin = await request("/api/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: `tester-${process.pid}@pixgom.test`,
      password: "password123"
    })
  });
  assert.equal(approvedLogin.response.status, 200);
  assert.equal(approvedLogin.json.buyerAccess, true);
  assert.match(approvedLogin.json.guideToken, /\./);
  assert.equal(approvedLogin.json.buyerRooms.length, 1);
  assert.match(approvedLogin.json.buyerRooms[0].bridgeConnectCode, /\./);

  const tokenApply = await request("/api/apply", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      token: approvedLogin.json.guideToken,
      roomName: "토큰추가방",
      roomLink: "https://open.kakao.com/o/tokenApply1",
      adminName: "신청관리자",
      contact: "kakao-token"
    })
  });
  assert.equal(tokenApply.response.status, 200);
  assert.equal(tokenApply.json.application.email, `tester-${process.pid}@pixgom.test`);
  assert.equal(tokenApply.json.application.status, "pending_payment");
  assert.equal(tokenApply.json.payment.amountKrw, 2200);

  const kakaoNoEmailAccountId = `acct_kakao_no_email_${process.pid}`;
  await upsertTestAccount({
    id: kakaoNoEmailAccountId,
    email: "",
    nickname: "카카오닉",
    auth: {
      provider: "kakao",
      externalId: `kakao-${process.pid}`,
      providers: ["kakao"],
      name: "카카오닉",
      linkedAt: new Date().toISOString()
    },
    consents: {
      terms: { agreed: true, at: new Date().toISOString(), version: "2026-05-25" },
      privacy: { agreed: true, at: new Date().toISOString(), version: "2026-05-25" },
      marketing: { agreed: false, at: "", version: "2026-05-25" }
    }
  });
  const kakaoNoEmailToken = signTestBuyerToken(kakaoNoEmailAccountId);
  const kakaoNoContactApply = await request("/api/apply", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      token: kakaoNoEmailToken,
      roomName: "카카오무이메일방",
      roomLink: "https://open.kakao.com/o/kakaoNoEmail1",
      adminName: "카카오관리자"
    })
  });
  assert.equal(kakaoNoContactApply.response.status, 400);
  assert.equal(kakaoNoContactApply.json.error, "contact_required");

  const kakaoContactApply = await request("/api/apply", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      token: kakaoNoEmailToken,
      roomName: "카카오무이메일방",
      roomLink: "https://open.kakao.com/o/kakaoNoEmail1",
      adminName: "카카오관리자",
      contact: "openchat-contact"
    })
  });
  assert.equal(kakaoContactApply.response.status, 200);
  assert.equal(kakaoContactApply.json.application.email, "");
  assert.equal(kakaoContactApply.json.application.contact, "openchat-contact");

  const buyerGuideApproved = await request("/api/buyer/guide", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: approvedLogin.json.guideToken })
  });
  assert.equal(buyerGuideApproved.response.status, 200);
  assert.equal(buyerGuideApproved.json.ok, true);
  assert.equal(buyerGuideApproved.json.version, "0.4.85");
  assert.equal(buyerGuideApproved.json.testAppUrl, "https://play.google.com/apps/internaltest/4700397680875890998");
  assert.match(JSON.stringify(buyerGuideApproved.json.rooms), /판매신청방/);
  assert.match(JSON.stringify(buyerGuideApproved.json.rooms), /^.*PXG-.*$/);
  assert.match(buyerGuideApproved.json.rooms[0].bridgeConnectCode, /\./);
  assert.match(JSON.stringify(buyerGuideApproved.json.sections), /알림 접근 권한/);
  assert.match(JSON.stringify(buyerGuideApproved.json.sections), /화면 감지\/접근성 권한을 사용하지 않습니다/);

  const buyerConsoleApproved = await request("/api/buyer/console", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: approvedLogin.json.guideToken })
  });
  assert.equal(buyerConsoleApproved.response.status, 200);
  assert.equal(buyerConsoleApproved.json.ok, true);
  assert.equal(buyerConsoleApproved.json.version, "0.4.85");
  assert.match(buyerConsoleApproved.json.ownerAdminNotice, /\/admin/);
  assert.equal(buyerConsoleApproved.json.rooms.length, 1);
  assert.equal(buyerConsoleApproved.json.plan.monthlyPriceKrw, 5500);
  assert.equal(buyerConsoleApproved.json.plan.additionalRoomPriceKrw, 2200);
  assert.equal(buyerConsoleApproved.json.commandStore.total, commandTemplates.json.total);
  assert.equal(buyerConsoleApproved.json.rooms[0].licenseStatus, "active");
  assert.equal(buyerConsoleApproved.json.rooms[0].subscriptionStatus, "active");
  assert.equal(buyerConsoleApproved.json.rooms[0].subscriptionStatusLabel, "정상");
  assert.match(buyerConsoleApproved.json.rooms[0].subscriptionNotice, /정상/);
  assert.equal(buyerConsoleApproved.json.rooms[0].bridgeStatus, "ready");
  assert.equal(buyerConsoleApproved.json.rooms[0].commandCount, 0);

  const fixedTemplate = commandTemplates.json.templates.find((template) => template.trigger === "/출석");
  const fixedTemplateInstall = await request("/api/buyer/command-templates/install", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      token: approvedLogin.json.guideToken,
      applicationId: buyerConsoleApproved.json.rooms[0].applicationId,
      templateId: fixedTemplate.id
    })
  });
  assert.equal(fixedTemplateInstall.response.status, 400);
  assert.equal(fixedTemplateInstall.json.error, "template_not_installable");

  const installableTemplate = commandTemplates.json.templates.find((template) => template.installable && template.categoryId === "basic-ops");
  assert.ok(installableTemplate);

  const directCustomInstall = await request("/api/buyer/command-templates/install", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      token: approvedLogin.json.guideToken,
      applicationId: buyerConsoleApproved.json.rooms[0].applicationId,
      templateId: installableTemplate.id,
      trigger: "/직접",
      response: "직접 만든 명령어입니다."
    })
  });
  assert.equal(directCustomInstall.response.status, 200);
  assert.equal(directCustomInstall.json.command.trigger, "/직접");

  const corePackApply = await request("/api/buyer/command-packs/apply", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      token: approvedLogin.json.guideToken,
      applicationId: buyerConsoleApproved.json.rooms[0].applicationId,
      commandPackId: "ops-core"
    })
  });
  assert.equal(corePackApply.response.status, 200);
  assert.equal(corePackApply.json.ok, true);
  assert.equal(corePackApply.json.current.installedPackIds.includes("ops-core"), true);
  assert.equal(corePackApply.json.room.commandPacks.installedPackTitles.includes("운영 기본팩"), true);
  assert.equal(corePackApply.json.room.commandCount >= 1, true);

  const allInOnePackApply = await request("/api/buyer/command-packs/apply", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      token: approvedLogin.json.guideToken,
      applicationId: buyerConsoleApproved.json.rooms[0].applicationId,
      commandPackId: "all-in-one-ops"
    })
  });
  assert.equal(allInOnePackApply.response.status, 200);
  assert.equal(allInOnePackApply.json.current.installedPackIds.includes("all-in-one-ops"), true);
  assert.equal(allInOnePackApply.json.room.features.attendance, true);
  assert.equal(allInOnePackApply.json.room.features.points, true);
  assert.equal(allInOnePackApply.json.room.features.rankings, true);
  assert.equal(allInOnePackApply.json.room.features.shop, true);

  const roomPackState = await request("/api/buyer/room-command-packs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      token: approvedLogin.json.guideToken,
      applicationId: buyerConsoleApproved.json.rooms[0].applicationId
    })
  });
  assert.equal(roomPackState.response.status, 200);
  assert.equal(roomPackState.json.current.installedPackIds.includes("ops-core"), true);
  assert.equal(roomPackState.json.current.installedPackIds.includes("all-in-one-ops"), true);
  assert.equal(roomPackState.json.packs.some((pack) => pack.id === "all-in-one-ops" && pack.installed === true), true);

  const proPackCommands = await request("/api/buyer/custom-commands", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      token: approvedLogin.json.guideToken,
      applicationId: buyerConsoleApproved.json.rooms[0].applicationId
    })
  });
  assert.equal(proPackCommands.response.status, 200);
  assert.equal(proPackCommands.json.commands.some((command) => command.trigger === "/직접" && !command.sourcePackId), true);
  assert.equal(proPackCommands.json.commands.some((command) => command.sourcePackId === "all-in-one-ops"), false);

  const proPackSearch = await request("/api/buyer/room-commands", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      token: approvedLogin.json.guideToken,
      applicationId: buyerConsoleApproved.json.rooms[0].applicationId,
      q: "레벨"
    })
  });
  assert.equal(proPackSearch.response.status, 200);
  assert.equal(proPackSearch.json.items.some((item) => item.command === "/포인트순위" && item.aliases.includes("/레벨순위") && item.sourcePackTitle === "풀 운영 올인원팩"), true);

  const blockedOtherRoomPack = await request("/api/buyer/command-packs/apply", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      token: approvedLogin.json.guideToken,
      applicationId: "app_other_buyer_room",
      commandPackId: "ops-core"
    })
  });
  assert.equal(blockedOtherRoomPack.response.status, 404);
  assert.equal(blockedOtherRoomPack.json.error, "approved_room_not_found");

  const templateInstall = await request("/api/buyer/command-templates/install", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      token: approvedLogin.json.guideToken,
      applicationId: buyerConsoleApproved.json.rooms[0].applicationId,
      templateId: installableTemplate.id
    })
  });
  assert.equal(templateInstall.response.status, 200);
  assert.equal(templateInstall.json.ok, true);
  assert.equal(templateInstall.json.command.trigger, installableTemplate.trigger);
  assert.equal(templateInstall.json.room.roomName, "판매신청방");

  const buyerCommands = await request("/api/buyer/custom-commands", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      token: approvedLogin.json.guideToken,
      applicationId: buyerConsoleApproved.json.rooms[0].applicationId
    })
  });
  assert.equal(buyerCommands.response.status, 200);
  assert.equal(buyerCommands.json.ok, true);
  assert.equal(buyerCommands.json.commands.some((command) => command.trigger === installableTemplate.trigger), true);
  assert.equal(buyerCommands.json.commands.some((command) => command.sourceTemplateId === installableTemplate.id), true);

  const buyerWeatherSearch = await request("/api/buyer/room-commands", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      token: approvedLogin.json.guideToken,
      applicationId: buyerConsoleApproved.json.rooms[0].applicationId,
      q: "날씨"
    })
  });
  assert.equal(buyerWeatherSearch.response.status, 200);
  assert.equal(buyerWeatherSearch.json.ok, true);
  assert.equal(buyerWeatherSearch.json.roomName, "판매신청방");
  assert.equal(buyerWeatherSearch.json.items.some((item) => item.command === "/날씨" && item.status === "available"), true);
  assert.equal(buyerWeatherSearch.json.items.some((item) => item.aliases.includes("/시흥날씨")), true);

  const buyerTemplateSearch = await request("/api/buyer/room-commands", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      token: approvedLogin.json.guideToken,
      applicationId: buyerConsoleApproved.json.rooms[0].applicationId,
      q: installableTemplate.trigger
    })
  });
  assert.equal(buyerTemplateSearch.response.status, 200);
  assert.equal(buyerTemplateSearch.json.items.some((item) => item.command === installableTemplate.trigger && item.installed === true && item.status === "available"), true);

  const buyerComingSoonSearch = await request("/api/buyer/room-commands", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      token: approvedLogin.json.guideToken,
      applicationId: buyerConsoleApproved.json.rooms[0].applicationId,
      q: "펫키우기"
    })
  });
  assert.equal(buyerComingSoonSearch.response.status, 200);
  assert.equal(buyerComingSoonSearch.json.items.some((item) => item.status === "coming_soon" && item.available === false), true);

  const adminCommandSearch = await request("/api/admin/room-commands", {
    method: "POST",
    headers: { "content-type": "application/json", "x-admin-token": "test-admin-token" },
    body: JSON.stringify({
      roomName: "판매신청방",
      q: "관리자"
    })
  });
  assert.equal(adminCommandSearch.response.status, 200);
  assert.equal(adminCommandSearch.json.items.some((item) => item.command === "/관리자등록" && item.status === "available"), true);

  const installedTemplateReply = await chatPayload({
    registeredRoom: false,
    room: "판매신청방",
    msg: installableTemplate.trigger,
    sender: "구매자",
    roomId: "salesRoom1",
    roomLink: "https://open.kakao.com/o/salesRoom1",
    licenseKey: approvedApplication.json.room.licenseKey
  });
  assert.equal(installedTemplateReply.json.ignored, false);
  assert.match(installedTemplateReply.json.reply, /오늘 공지는/);
  assert.doesNotMatch(installedTemplateReply.json.reply, /템플릿 번호/);

  const opsBundleTemplate = commandTemplates.json.templates.find((template) => template.id === "bundle-ops-starter");
  assert.ok(opsBundleTemplate);
  assert.equal(opsBundleTemplate.commands.length, 4);
  const bundleInstall = await request("/api/buyer/command-templates/install", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      token: approvedLogin.json.guideToken,
      applicationId: buyerConsoleApproved.json.rooms[0].applicationId,
      templateId: opsBundleTemplate.id
    })
  });
  assert.equal(bundleInstall.response.status, 200);
  assert.equal(bundleInstall.json.ok, true);
  assert.equal(bundleInstall.json.installedCount, 4);
  assert.equal(bundleInstall.json.commands.some((command) => command.trigger === "/규칙"), true);

  const bundleRuleReply = await chatPayload({
    registeredRoom: false,
    room: "판매신청방",
    msg: "/규칙",
    sender: "구매자",
    roomId: "salesRoom1",
    roomLink: "https://open.kakao.com/o/salesRoom1",
    licenseKey: approvedApplication.json.room.licenseKey
  });
  assert.match(bundleRuleReply.json.reply, /두글자 닉네임/);

  const slashlessTemplateInstall = await request("/api/buyer/command-templates/install", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      token: approvedLogin.json.guideToken,
      applicationId: buyerConsoleApproved.json.rooms[0].applicationId,
      templateId: installableTemplate.id,
      trigger: "공지",
      response: "맛있어"
    })
  });
  assert.equal(slashlessTemplateInstall.response.status, 200);
  assert.equal(slashlessTemplateInstall.json.command.trigger, "공지");

  const slashTemplateInstall = await request("/api/buyer/command-templates/install", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      token: approvedLogin.json.guideToken,
      applicationId: buyerConsoleApproved.json.rooms[0].applicationId,
      templateId: installableTemplate.id,
      trigger: "/공지",
      response: "맛없어"
    })
  });
  assert.equal(slashTemplateInstall.response.status, 200);
  assert.equal(slashTemplateInstall.json.command.trigger, "/공지");

  const bangTemplateInstall = await request("/api/buyer/command-templates/install", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      token: approvedLogin.json.guideToken,
      applicationId: buyerConsoleApproved.json.rooms[0].applicationId,
      templateId: installableTemplate.id,
      trigger: "!공지",
      response: "차가워"
    })
  });
  assert.equal(bangTemplateInstall.response.status, 200);
  assert.equal(bangTemplateInstall.json.command.trigger, "!공지");

  for (const [msg, expected] of [["공지", /맛있어/], ["/공지", /맛없어/], ["!공지", /차가워/]]) {
    const reply = await chatPayload({
      registeredRoom: false,
      room: "판매신청방",
      msg,
      sender: "구매자",
      roomId: "salesRoom1",
      roomLink: "https://open.kakao.com/o/salesRoom1",
      licenseKey: approvedApplication.json.room.licenseKey
    });
    assert.match(reply.json.reply, expected);
  }

  const disableCustomCommands = await request("/api/admin/rooms", {
    method: "POST",
    headers: { "content-type": "application/json", "x-admin-token": "test-admin-token" },
    body: JSON.stringify({
      room: "판매신청방",
      features: { customCommands: false }
    })
  });
  assert.equal(disableCustomCommands.response.status, 200);
  assert.equal(disableCustomCommands.json.room.features.customCommands, false);
  const disabledCustomReply = await chatPayload({
    registeredRoom: false,
    room: "판매신청방",
    msg: "공지",
    sender: "구매자",
    roomId: "salesRoom1",
    roomLink: "https://open.kakao.com/o/salesRoom1",
    licenseKey: approvedApplication.json.room.licenseKey
  });
  assert.match(disabledCustomReply.json.reply, /커스텀 명령어 기능은 이 방에서 꺼져 있습니다/);
  const enableCustomCommands = await request("/api/admin/rooms", {
    method: "POST",
    headers: { "content-type": "application/json", "x-admin-token": "test-admin-token" },
    body: JSON.stringify({
      room: "판매신청방",
      features: { customCommands: true }
    })
  });
  assert.equal(enableCustomCommands.response.status, 200);
  assert.equal(enableCustomCommands.json.room.features.customCommands, true);

  const diceTemplate = commandTemplates.json.templates.find((template) => template.proxyCommand === "/주사위");
  const diceInstall = await request("/api/buyer/command-templates/install", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      token: approvedLogin.json.guideToken,
      applicationId: buyerConsoleApproved.json.rooms[0].applicationId,
      templateId: diceTemplate.id,
      trigger: "/운영주사위",
      response: "운영 주사위 시작"
    })
  });
  assert.equal(diceInstall.response.status, 200);
  assert.equal(diceInstall.json.command.proxyCommand, "/주사위");

  const enableApprovedGame = await chatPayload({
    registeredRoom: false,
    room: "판매신청방",
    msg: "/기능켜기 게임",
    sender: "신청관리자",
    roomId: "salesRoom1",
    roomLink: "https://open.kakao.com/o/salesRoom1",
    licenseKey: approvedApplication.json.room.licenseKey
  });
  assert.match(enableApprovedGame.json.reply, /게임 기능이 켜졌습니다/);

  const fishingTemplate = commandTemplates.json.templates.find((template) => template.proxyCommand === "/낚시");
  assert.ok(fishingTemplate);
  const fishingInstall = await request("/api/buyer/command-templates/install", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      token: approvedLogin.json.guideToken,
      applicationId: buyerConsoleApproved.json.rooms[0].applicationId,
      templateId: fishingTemplate.id,
      trigger: "/운영낚시",
      response: "운영 낚시 시작"
    })
  });
  assert.equal(fishingInstall.response.status, 200);
  assert.equal(fishingInstall.json.command.proxyCommand, "/낚시");

  const gamePackApply = await request("/api/buyer/command-packs/apply", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      token: approvedLogin.json.guideToken,
      applicationId: buyerConsoleApproved.json.rooms[0].applicationId,
      commandPackId: "game-chance"
    })
  });
  assert.equal(gamePackApply.response.status, 200);
  assert.equal(gamePackApply.json.current.installedPackIds.includes("game-chance"), true);

  const diceProxyReply = await chatPayload({
    registeredRoom: false,
    room: "판매신청방",
    msg: "/운영주사위",
    sender: "구매자",
    roomId: "salesRoom1",
    roomLink: "https://open.kakao.com/o/salesRoom1",
    licenseKey: approvedApplication.json.room.licenseKey
  });
  assert.match(diceProxyReply.json.reply, /주사위 게임/);

  const proxyBaitPurchase = await chatPayload({
    registeredRoom: false,
    room: "판매신청방",
    msg: "/미끼구매 1",
    sender: "구매자",
    roomId: "salesRoom1",
    roomLink: "https://open.kakao.com/o/salesRoom1",
    licenseKey: approvedApplication.json.room.licenseKey
  });
  assert.match(proxyBaitPurchase.json.reply, /미끼 구매 완료/);

  const fishingPackProxyReply = await chatPayload({
    registeredRoom: false,
    room: "판매신청방",
    msg: "/운영낚시",
    sender: "구매자",
    roomId: "salesRoom1",
    roomLink: "https://open.kakao.com/o/salesRoom1",
    licenseKey: approvedApplication.json.room.licenseKey
  });
  assert.match(fishingPackProxyReply.json.reply, /낚시 결과/);

  const gamePackRemove = await request("/api/buyer/command-packs/apply", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      token: approvedLogin.json.guideToken,
      applicationId: buyerConsoleApproved.json.rooms[0].applicationId,
      commandPackId: "game-chance",
      action: "remove"
    })
  });
  assert.equal(gamePackRemove.response.status, 200);
  assert.equal(gamePackRemove.json.current.installedPackIds.includes("game-chance"), false);
  const afterGamePackRemove = await request("/api/buyer/custom-commands", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      token: approvedLogin.json.guideToken,
      applicationId: buyerConsoleApproved.json.rooms[0].applicationId
    })
  });
  assert.equal(afterGamePackRemove.json.commands.some((command) => command.trigger === "/운영낚시"), true);

  const deleteInstalled = await request("/api/buyer/custom-commands/delete", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      token: approvedLogin.json.guideToken,
      applicationId: buyerConsoleApproved.json.rooms[0].applicationId,
      trigger: installableTemplate.trigger
    })
  });
  assert.equal(deleteInstalled.response.status, 200);
  assert.equal(deleteInstalled.json.ok, true);

  const additionalRoomApply = await request("/api/apply", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: `tester-${process.pid}@pixgom.test`,
      password: "password123",
      roomName: "판매추가방",
      roomLink: "https://open.kakao.com/o/salesRoom2",
      adminName: "신청관리자",
      contact: "kakao-test",
      memo: "자동 테스트 추가 방"
    })
  });
  assert.equal(additionalRoomApply.response.status, 200);
  assert.equal(additionalRoomApply.json.application.plan.type, "additional_room");
  assert.equal(additionalRoomApply.json.payment.amountKrw, 2200);

  const approvedAdditionalRoom = await request("/api/admin/applications/approve", {
    method: "POST",
    headers: { "content-type": "application/json", "x-admin-token": "test-admin-token" },
    body: JSON.stringify({ applicationId: additionalRoomApply.json.application.id, months: 1 })
  });
  assert.equal(approvedAdditionalRoom.response.status, 200);
  assert.equal(approvedAdditionalRoom.json.payment.amountKrw, 2200);
  assert.equal(approvedAdditionalRoom.json.room.subscription.monthlyPriceKrw, 2200);
  const buyerConsoleWithAdditionalRoom = await request("/api/buyer/console", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: approvedLogin.json.guideToken })
  });
  const additionalRoomPayload = buyerConsoleWithAdditionalRoom.json.rooms.find((room) => room.roomName === "판매추가방");
  assert.ok(additionalRoomPayload?.bridgeConnectCode);

  const directNoticeBeforeChatInstall = await chatPayload({
    registeredRoom: false,
    room: "판매추가방",
    msg: "/명령어등록 /공지 직접 공지입니다.",
    sender: "신청관리자",
    roomId: "salesRoom2",
    roomLink: "https://open.kakao.com/o/salesRoom2",
    licenseKey: approvedAdditionalRoom.json.room.licenseKey
  });
  assert.match(directNoticeBeforeChatInstall.json.reply, /커스텀 명령어가 저장되었습니다/);

  const commandInstallSearch = await chatPayload({
    registeredRoom: false,
    room: "판매추가방",
    msg: "/명령어검색 공지",
    sender: "신청관리자",
    roomId: "salesRoom2",
    roomLink: "https://open.kakao.com/o/salesRoom2",
    licenseKey: approvedAdditionalRoom.json.room.licenseKey
  });
  assert.match(commandInstallSearch.json.reply, /명령어 설치 코드 검색 결과/);
  assert.match(commandInstallSearch.json.reply, /no\.100/);
  assert.match(commandInstallSearch.json.reply, /st\.001/);

  const commandInstallDenied = await chatPayload({
    registeredRoom: false,
    room: "판매추가방",
    msg: "/명령어설치 pk.001",
    sender: "일반참여자",
    roomId: "salesRoom2",
    roomLink: "https://open.kakao.com/o/salesRoom2",
    licenseKey: approvedAdditionalRoom.json.room.licenseKey
  });
  assert.match(commandInstallDenied.json.reply, /관리자 전용/);

  const invalidCommandInstall = await chatPayload({
    registeredRoom: false,
    room: "판매추가방",
    msg: "/명령어설치 xx.001",
    sender: "신청관리자",
    roomId: "salesRoom2",
    roomLink: "https://open.kakao.com/o/salesRoom2",
    licenseKey: approvedAdditionalRoom.json.room.licenseKey
  });
  assert.match(invalidCommandInstall.json.reply, /찾을 수 없는 코드/);

  const commandInstallPreview = await chatPayload({
    registeredRoom: false,
    room: "판매추가방",
    msg: "/명령어설치 pk.001 no.100 101 st.001",
    sender: "신청관리자",
    senderId: "admin-install-user",
    roomId: "salesRoom2",
    roomLink: "https://open.kakao.com/o/salesRoom2",
    licenseKey: approvedAdditionalRoom.json.room.licenseKey
  });
  assert.match(commandInstallPreview.json.reply, /명령어 설치 미리보기/);
  assert.match(commandInstallPreview.json.reply, /pk\.001 운영 기본팩/);
  assert.match(commandInstallPreview.json.reply, /st\.001 운영 기본 세트/);
  assert.match(commandInstallPreview.json.reply, /\/공지: 기존 명령어 보존/);
  const confirmMatch = commandInstallPreview.json.reply.match(/\/설치확인 (\d{4})/);
  assert.ok(confirmMatch);

  const wrongInstallConfirm = await chatPayload({
    registeredRoom: false,
    room: "판매추가방",
    msg: "/설치확인 0000",
    sender: "신청관리자",
    senderId: "admin-install-user",
    roomId: "salesRoom2",
    roomLink: "https://open.kakao.com/o/salesRoom2",
    licenseKey: approvedAdditionalRoom.json.room.licenseKey
  });
  assert.match(wrongInstallConfirm.json.reply, /일치하지 않습니다/);

  const commandInstallConfirm = await chatPayload({
    registeredRoom: false,
    room: "판매추가방",
    msg: `/설치확인 ${confirmMatch[1]}`,
    sender: "신청관리자",
    senderId: "admin-install-user",
    roomId: "salesRoom2",
    roomLink: "https://open.kakao.com/o/salesRoom2",
    licenseKey: approvedAdditionalRoom.json.room.licenseKey
  });
  assert.match(commandInstallConfirm.json.reply, /명령어 설치가 완료되었습니다/);
  assert.match(commandInstallConfirm.json.reply, /장착된 팩/);
  assert.match(commandInstallConfirm.json.reply, /\/규칙/);

  const preservedDirectNoticeReply = await chatPayload({
    registeredRoom: false,
    room: "판매추가방",
    msg: "/공지",
    sender: "구매자",
    roomId: "salesRoom2",
    roomLink: "https://open.kakao.com/o/salesRoom2",
    licenseKey: approvedAdditionalRoom.json.room.licenseKey
  });
  assert.match(preservedDirectNoticeReply.json.reply, /직접 공지입니다/);

  const commandInstallList = await chatPayload({
    registeredRoom: false,
    room: "판매추가방",
    msg: "/명령어설치목록",
    sender: "신청관리자",
    roomId: "salesRoom2",
    roomLink: "https://open.kakao.com/o/salesRoom2",
    licenseKey: approvedAdditionalRoom.json.room.licenseKey
  });
  assert.match(commandInstallList.json.reply, /명령어 설치 현황/);
  assert.match(commandInstallList.json.reply, /pk\.001 운영 기본팩/);
  assert.match(commandInstallList.json.reply, /\/규칙/);

  const bridgeConnect = await request("/api/bridge/connect", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code: buyerGuideApproved.json.rooms[0].bridgeConnectCode })
  });
  assert.equal(bridgeConnect.response.status, 200);
  assert.equal(bridgeConnect.json.ok, true);
  assert.equal(bridgeConnect.json.room.roomName, "판매신청방");
  assert.equal(bridgeConnect.json.room.roomId, "salesRoom1");
  assert.match(bridgeConnect.json.room.licenseKey, /^PXG-/);

  const sourceTransferRoom = buyerConsoleWithAdditionalRoom.json.rooms.find((room) => room.roomName === "판매신청방");
  assert.ok(sourceTransferRoom?.applicationId);
  const transferReport = await chatPayload({
    registeredRoom: false,
    room: "판매신청방",
    msg: "/신고 악성사용자 이관 전 신고",
    sender: "신고자",
    roomId: "salesRoom1",
    roomLink: "https://open.kakao.com/o/salesRoom1",
    licenseKey: approvedApplication.json.room.licenseKey
  });
  assert.match(transferReport.json.reply, /신고가 접수/);
  const stateBeforeTransfer = await readTestState();
  const roomBeforeTransfer = Object.values(stateBeforeTransfer.rooms || {}).find((room) => room.name === "판매신청방");
  assert.ok(roomBeforeTransfer);
  const reportCountBeforeTransfer = (roomBeforeTransfer.reports || []).length;
  const commandCountBeforeTransfer = (roomBeforeTransfer.settings?.customCommands || []).length;

  const pendingReceiverSignup = await request("/api/signup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: `transfer-pending-${process.pid}@pixgom.test`,
      password: "password123",
      passwordConfirm: "password123",
      nickname: "이관대기",
      termsAgreed: true,
      privacyAgreed: true
    })
  });
  assert.equal(pendingReceiverSignup.response.status, 200);

  const transferCreateForPending = await request("/api/buyer/room-transfer/create", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      token: approvedLogin.json.guideToken,
      applicationId: sourceTransferRoom.applicationId,
      confirmRoomName: sourceTransferRoom.roomName
    })
  });
  assert.equal(transferCreateForPending.response.status, 200);
  assert.match(transferCreateForPending.json.transfer.code, /^\d{6}$/);
  assert.match(transferCreateForPending.json.transfer.expiresAt, /^\d{4}-\d{2}-\d{2}T/);

  const pendingRoomTransferCreate = await request("/api/buyer/room-transfer/create", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      token: approvedLogin.json.guideToken,
      applicationId: tokenApply.json.application.id,
      confirmRoomName: "토큰추가방"
    })
  });
  assert.equal(pendingRoomTransferCreate.response.status, 403);
  assert.equal(pendingRoomTransferCreate.json.error, "transfer_room_not_approved");

  const unauthTransferAccept = await request("/api/buyer/room-transfer/accept", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code: transferCreateForPending.json.transfer.code })
  });
  assert.equal(unauthTransferAccept.response.status, 401);

  const pendingReceiverAccept = await request("/api/buyer/room-transfer/accept", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: `transfer-pending-${process.pid}@pixgom.test`,
      password: "password123",
      code: transferCreateForPending.json.transfer.code
    })
  });
  assert.equal(pendingReceiverAccept.response.status, 403);
  assert.equal(pendingReceiverAccept.json.error, "receiver_approval_required");

  const selfTransferAccept = await request("/api/buyer/room-transfer/accept", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      token: approvedLogin.json.guideToken,
      code: transferCreateForPending.json.transfer.code
    })
  });
  assert.equal(selfTransferAccept.response.status, 400);
  assert.equal(selfTransferAccept.json.error, "self_transfer_not_allowed");

  const receiverSignup = await request("/api/signup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: `transfer-receiver-${process.pid}@pixgom.test`,
      password: "password123",
      passwordConfirm: "password123",
      nickname: "이관받는사람",
      termsAgreed: true,
      privacyAgreed: true
    })
  });
  assert.equal(receiverSignup.response.status, 200);
  const receiverApply = await request("/api/apply", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: `transfer-receiver-${process.pid}@pixgom.test`,
      password: "password123",
      roomName: "이관수신자승인방",
      roomLink: "https://open.kakao.com/o/transferReceiver1",
      adminName: "수신관리자",
      contact: "receiver-contact"
    })
  });
  assert.equal(receiverApply.response.status, 200);
  const receiverApproved = await request("/api/admin/applications/approve", {
    method: "POST",
    headers: { "content-type": "application/json", "x-admin-token": "test-admin-token" },
    body: JSON.stringify({ applicationId: receiverApply.json.application.id, months: 1 })
  });
  assert.equal(receiverApproved.response.status, 200);
  const receiverLogin = await request("/api/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: `transfer-receiver-${process.pid}@pixgom.test`,
      password: "password123"
    })
  });
  assert.equal(receiverLogin.response.status, 200);
  assert.equal(receiverLogin.json.buyerAccess, true);
  assert.match(receiverLogin.json.guideToken, /\./);

  const transferCreateByOther = await request("/api/buyer/room-transfer/create", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      token: receiverLogin.json.guideToken,
      applicationId: sourceTransferRoom.applicationId,
      confirmRoomName: sourceTransferRoom.roomName
    })
  });
  assert.equal(transferCreateByOther.response.status, 404);
  assert.equal(transferCreateByOther.json.error, "application_not_found");

  const wrongCodeAccept = await request("/api/buyer/room-transfer/accept", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: receiverLogin.json.guideToken, code: "000000" })
  });
  assert.equal(wrongCodeAccept.response.status, 404);
  assert.equal(wrongCodeAccept.json.error, "transfer_code_not_found");

  const stateForExpiry = await readTestState();
  stateForExpiry.roomTransfers[transferCreateForPending.json.transfer.id].expiresAt = "2020-01-01T00:00:00.000Z";
  await writeFile(testDbPath, `${JSON.stringify(stateForExpiry, null, 2)}\n`, "utf8");
  const expiredTransferAccept = await request("/api/buyer/room-transfer/accept", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      token: receiverLogin.json.guideToken,
      code: transferCreateForPending.json.transfer.code
    })
  });
  assert.equal(expiredTransferAccept.response.status, 410);
  assert.equal(expiredTransferAccept.json.error, "transfer_code_expired");

  const transferCreate = await request("/api/buyer/room-transfer/create", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      token: approvedLogin.json.guideToken,
      applicationId: sourceTransferRoom.applicationId,
      confirmRoomName: sourceTransferRoom.roomName
    })
  });
  assert.equal(transferCreate.response.status, 200);
  assert.match(transferCreate.json.transfer.code, /^\d{6}$/);

  const transferAccept = await request("/api/buyer/room-transfer/accept", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      token: receiverLogin.json.guideToken,
      code: transferCreate.json.transfer.code
    })
  });
  assert.equal(transferAccept.response.status, 200);
  assert.equal(transferAccept.json.room.roomName, "판매신청방");
  assert.equal(transferAccept.json.transfer.status, "accepted");

  const reusedTransferAccept = await request("/api/buyer/room-transfer/accept", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      token: receiverLogin.json.guideToken,
      code: transferCreate.json.transfer.code
    })
  });
  assert.equal(reusedTransferAccept.response.status, 409);
  assert.equal(reusedTransferAccept.json.error, "transfer_code_used");

  const sourceConsoleAfterTransfer = await request("/api/buyer/console", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: approvedLogin.json.guideToken })
  });
  assert.equal(sourceConsoleAfterTransfer.response.status, 200);
  assert.equal(sourceConsoleAfterTransfer.json.rooms.some((room) => room.roomName === "판매신청방"), false);
  assert.equal(sourceConsoleAfterTransfer.json.transfers.some((transfer) => (
    transfer.roomName === "판매신청방"
    && transfer.status === "accepted"
    && transfer.direction === "sent"
  )), true);

  const receiverConsoleAfterTransfer = await request("/api/buyer/console", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: receiverLogin.json.guideToken })
  });
  assert.equal(receiverConsoleAfterTransfer.response.status, 200);
  const receivedRoom = receiverConsoleAfterTransfer.json.rooms.find((room) => room.roomName === "판매신청방");
  assert.ok(receivedRoom);
  assert.match(receivedRoom.bridgeConnectCode, /\./);
  assert.notEqual(receivedRoom.bridgeConnectCode, sourceTransferRoom.bridgeConnectCode);
  assert.equal(receiverConsoleAfterTransfer.json.transfers.some((transfer) => (
    transfer.roomName === "판매신청방"
    && transfer.status === "accepted"
    && transfer.direction === "received"
  )), true);

  const adminTransfersDenied = await request("/api/admin/transfers");
  assert.equal(adminTransfersDenied.response.status, 401);
  assert.equal(adminTransfersDenied.json.error, "owner_login_required");

  const adminTransfersAccepted = await request("/api/admin/transfers?token=test-admin-token&status=accepted");
  assert.equal(adminTransfersAccepted.response.status, 200);
  assert.equal(adminTransfersAccepted.json.summary.accepted >= 1, true);
  assert.equal(adminTransfersAccepted.json.transfers.some((transfer) => (
    transfer.roomName === "판매신청방"
    && transfer.status === "accepted"
    && transfer.fromAccount.id === approvedLogin.json.account.id
    && transfer.toAccount.id === receiverLogin.json.account.id
  )), true);

  const oldBridgeAfterTransfer = await request("/api/bridge/connect", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code: sourceTransferRoom.bridgeConnectCode })
  });
  assert.equal(oldBridgeAfterTransfer.response.status, 404);
  assert.equal(oldBridgeAfterTransfer.json.error, "connect_target_not_found");

  const stateAfterTransfer = await readTestState();
  assert.equal(stateAfterTransfer.applications[sourceTransferRoom.applicationId].accountId, receiverLogin.json.account.id);
  assert.equal(stateAfterTransfer.payments[stateAfterTransfer.applications[sourceTransferRoom.applicationId].paymentId].accountId, receiverLogin.json.account.id);
  assert.equal(stateAfterTransfer.accounts[approvedLogin.json.account.id].applicationIds.includes(sourceTransferRoom.applicationId), false);
  assert.equal(stateAfterTransfer.accounts[receiverLogin.json.account.id].applicationIds.includes(sourceTransferRoom.applicationId), true);
  assert.equal(stateAfterTransfer.applications[sourceTransferRoom.applicationId].transferHistory.length, 1);
  const roomAfterTransfer = Object.values(stateAfterTransfer.rooms || {}).find((room) => room.name === "판매신청방");
  assert.equal((roomAfterTransfer.reports || []).length, reportCountBeforeTransfer);
  assert.equal((roomAfterTransfer.settings?.customCommands || []).length, commandCountBeforeTransfer);

  const cancelTransferCreate = await request("/api/buyer/room-transfer/create", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      token: approvedLogin.json.guideToken,
      applicationId: additionalRoomPayload.applicationId,
      confirmRoomName: additionalRoomPayload.roomName
    })
  });
  assert.equal(cancelTransferCreate.response.status, 200);
  const cancelTransfer = await request("/api/buyer/room-transfer/cancel", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      token: approvedLogin.json.guideToken,
      transferId: cancelTransferCreate.json.transfer.id
    })
  });
  assert.equal(cancelTransfer.response.status, 200);
  assert.equal(cancelTransfer.json.transfer.status, "cancelled");
  const sourceConsoleAfterCancel = await request("/api/buyer/console", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: approvedLogin.json.guideToken })
  });
  assert.equal(sourceConsoleAfterCancel.json.transfers.some((transfer) => (
    transfer.roomName === "판매추가방"
    && transfer.status === "cancelled"
    && transfer.direction === "sent"
  )), true);
  const adminTransfersCancelled = await request("/api/admin/transfers?token=test-admin-token&status=cancelled");
  assert.equal(adminTransfersCancelled.response.status, 200);
  assert.equal(adminTransfersCancelled.json.transfers.some((transfer) => (
    transfer.id === cancelTransfer.json.transfer.id
    && transfer.status === "cancelled"
  )), true);

  const expiredAdditionalRoom = await request("/api/admin/rooms", {
    method: "POST",
    headers: { "content-type": "application/json", "x-admin-token": "test-admin-token" },
    body: JSON.stringify({
      room: "판매추가방",
      roomId: "salesRoom2",
      roomLink: "https://open.kakao.com/o/salesRoom2",
      roomAdmins: ["신청관리자"],
      licenseKey: approvedAdditionalRoom.json.room.licenseKey,
      subscriptionExpiresAt: "2020-01-01T00:00:00.000Z"
    })
  });
  assert.equal(expiredAdditionalRoom.response.status, 200);
  assert.equal(expiredAdditionalRoom.json.room.subscription.status, "expired");
  assert.equal(expiredAdditionalRoom.json.room.subscription.statusLabel, "만료");

  const expiredBridgeConnect = await request("/api/bridge/connect", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code: additionalRoomPayload.bridgeConnectCode })
  });
  assert.equal(expiredBridgeConnect.response.status, 403);
  assert.equal(expiredBridgeConnect.json.error, "subscription_expired");
  assert.equal(expiredBridgeConnect.json.issue.code, "subscription_expired");
  assert.match(expiredBridgeConnect.json.message, /브릿지 연결이 차단/);
  assert.doesNotMatch(expiredBridgeConnect.json.message, /PXG|5,500원|라이선스/);

  const approvedRoomStatus = await chatPayload({
    registeredRoom: false,
    room: "판매신청방",
    msg: "/구독상태",
    sender: "신청관리자",
    roomId: "salesRoom1",
    roomLink: "https://open.kakao.com/o/salesRoom1",
    licenseKey: approvedApplication.json.room.licenseKey
  });
  assert.equal(approvedRoomStatus.json.ignored, false);
  assert.match(approvedRoomStatus.json.reply, /구독 상태/);
  assert.match(approvedRoomStatus.json.reply, /상태: 정상/);

  const unsetSubscriptionRoom = await request("/api/admin/rooms", {
    method: "POST",
    headers: { "content-type": "application/json", "x-admin-token": "test-admin-token" },
    body: JSON.stringify({
      room: "미설정구독방",
      roomId: "unsetSubscriptionRoom",
      roomLink: "https://open.kakao.com/o/unsetSubscriptionRoom",
      roomAdmins: ["미설정관리자"],
      licenseKey: "PXG-UNSET-1234",
      subscriptionExpiresAt: "unset"
    })
  });
  assert.equal(unsetSubscriptionRoom.response.status, 200);
  assert.equal(unsetSubscriptionRoom.json.room.subscription.status, "unset");
  const unsetSubscriptionStatus = await chatPayload({
    registeredRoom: false,
    room: "미설정구독방",
    msg: "/구독상태",
    sender: "미설정관리자",
    roomId: "unsetSubscriptionRoom",
    roomLink: "https://open.kakao.com/o/unsetSubscriptionRoom",
    licenseKey: "PXG-UNSET-1234"
  });
  assert.match(unsetSubscriptionStatus.json.reply, /상태: 미설정/);
  assert.match(unsetSubscriptionStatus.json.reply, /구독 만료일을 설정/);

  for (const days of [7, 3, 1]) {
    const roomName = `만료임박${days}일방`;
    const roomId = `expiringRoom${days}`;
    const expiresAt = new Date(Date.now() + days * 86400000).toISOString();
    const expiringRegister = await chatPayload({
      registeredRoom: false,
      room: roomName,
      msg: "/방등록 픽셀곰 입장확인",
      sender: "임박관리자",
      roomId,
      roomLink: `https://open.kakao.com/o/${roomId}`,
      licenseKey: `PXG-EXPIRING-${days}`,
      subscriptionExpiresAt: expiresAt
    });
    assert.match(expiringRegister.json.reply, /방 등록 완료/);
    const expiringStatus = await chatPayload({
      registeredRoom: false,
      room: roomName,
      msg: "/구독상태",
      sender: "임박관리자",
      roomId,
      roomLink: `https://open.kakao.com/o/${roomId}`,
      licenseKey: `PXG-EXPIRING-${days}`
    });
    assert.match(expiringStatus.json.reply, new RegExp(`만료 임박 ${days}일`));
    assert.match(expiringStatus.json.reply, new RegExp(`구독 만료 ${days}일 전`));
  }

  const missingLicense = await chatPayload({
    registeredRoom: false,
    room: "콘솔방",
    msg: "/상태",
    sender: "콘솔관리자",
    roomId: "consoleRoom1",
    roomLink: "https://open.kakao.com/o/consoleRoom1"
  });
  assert.equal(missingLicense.json.ignored, true);
  assert.equal(missingLicense.json.reason, "missing_license");
  assert.match(missingLicense.json.reply, /연결 확인/);
  assert.match(missingLicense.json.reply, /연결값이 비어/);
  assert.doesNotMatch(missingLicense.json.reply, /라이선스|PXG|5,500원|roomId/);

  const invalidLicense = await chatPayload({
    registeredRoom: false,
    room: "콘솔방",
    msg: "/상태",
    sender: "콘솔관리자",
    roomId: "consoleRoom1",
    roomLink: "https://open.kakao.com/o/consoleRoom1",
    licenseKey: "PXG-WRONG-1234"
  });
  assert.equal(invalidLicense.json.ignored, true);
  assert.equal(invalidLicense.json.reason, "invalid_license");
  assert.match(invalidLicense.json.reply, /일치하지 않습니다/);
  assert.doesNotMatch(invalidLicense.json.reply, /PXG|5,500원|roomId|등록된 키/);

  const licensedStatus = await chatPayload({
    registeredRoom: false,
    room: "콘솔방",
    msg: "/상태",
    sender: "콘솔관리자",
    roomId: "consoleRoom1",
    roomLink: "https://open.kakao.com/o/consoleRoom1",
    licenseKey: "PXG-CONSOLE-1234"
  });
  assert.equal(licensedStatus.json.ignored, false);
  assert.match(licensedStatus.json.reply, /운영봇 서버 정상 연결/);

  const disabledAttendance = await chatPayload({
    registeredRoom: false,
    room: "콘솔방",
    msg: "/출석",
    sender: "콘솔관리자",
    roomId: "consoleRoom1",
    roomLink: "https://open.kakao.com/o/consoleRoom1",
    licenseKey: "PXG-CONSOLE-1234"
  });
  assert.match(disabledAttendance.json.reply, /출석 기능은 이 방에서 꺼져/);

  const gameReply = await chatPayload({
    registeredRoom: false,
    room: "콘솔방",
    msg: "/주사위",
    sender: "콘솔관리자",
    roomId: "consoleRoom1",
    roomLink: "https://open.kakao.com/o/consoleRoom1",
    licenseKey: "PXG-CONSOLE-1234"
  });
  assert.match(gameReply.json.reply, /주사위 게임/);
  assert.match(gameReply.json.reply, /콘솔 시즌/);

  const gameHelp = await chatPayload({
    registeredRoom: false,
    room: "콘솔방",
    msg: "/게임",
    sender: "콘솔관리자",
    roomId: "consoleRoom1",
    roomLink: "https://open.kakao.com/o/consoleRoom1",
    licenseKey: "PXG-CONSOLE-1234"
  });
  assert.match(gameHelp.json.reply, /콘솔 시즌/);
  assert.match(gameHelp.json.reply, /시즌 기간/);
  assert.match(gameHelp.json.reply, /주사위 기본 보상: 🅟7/);

  const customConsoleReply = await chatPayload({
    registeredRoom: false,
    room: "콘솔방",
    msg: "/공지",
    sender: "콘솔관리자",
    roomId: "consoleRoom1",
    roomLink: "https://open.kakao.com/o/consoleRoom1",
    licenseKey: "PXG-CONSOLE-1234"
  });
  assert.match(customConsoleReply.json.reply, /콘솔 공지입니다/);

  const help = await request("/skill", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      userRequest: {
        timezone: "Asia/Seoul",
        utterance: "/도움말",
        user: {
          id: "test-user",
          type: "accountId",
          properties: { nickname: "테스터" }
        }
      }
    })
  });
  assert.equal(help.response.status, 200);
  assert.match(help.json.template.outputs[0].simpleText.text, /참여자 명령어/);
  assert.match(help.json.template.outputs[0].simpleText.text, /메시지/);
  assert.match(help.json.template.outputs[0].simpleText.text, /날씨/);
  assert.match(help.json.template.outputs[0].simpleText.text, /운세/);
  assert.doesNotMatch(help.json.template.outputs[0].simpleText.text, /최근이벤트/);
  assert.match(help.json.template.outputs[0].simpleText.text, /포인트/);
  assert.match(help.json.template.outputs[0].simpleText.text, /ㅊㅊ/);
  assert.match(help.json.template.outputs[0].simpleText.text, /미출석/);
  assert.match(help.json.template.outputs[0].simpleText.text, /출석순위/);
  assert.match(help.json.template.outputs[0].simpleText.text, /상점/);
  assert.match(help.json.template.outputs[0].simpleText.text, /가방선물/);
  assert.match(help.json.template.outputs[0].simpleText.text, /좋아요/);
  assert.match(help.json.template.outputs[0].simpleText.text, /이체/);
  assert.match(help.json.template.outputs[0].simpleText.text, /응원/);
  assert.doesNotMatch(help.json.template.outputs[0].simpleText.text, /뽑기/);
  assert.doesNotMatch(help.json.template.outputs[0].simpleText.text, /\/홀.*예: \/홀 100/);
  assert.match(help.json.template.outputs[0].simpleText.text, /출석/);
  assert.doesNotMatch(help.json.template.outputs[0].simpleText.text, /프로필등록/);
  assert.doesNotMatch(help.json.template.outputs[0].simpleText.text, /입퇴장상세/);
  assert.doesNotMatch(help.json.template.outputs[0].simpleText.text, /관리자등록/);
  assert.doesNotMatch(help.json.template.outputs[0].simpleText.text, /관리자재설정/);
  assert.doesNotMatch(help.json.template.outputs[0].simpleText.text, /원본로그/);
  assert.doesNotMatch(help.json.template.outputs[0].simpleText.text, /픽셀곰게임|게임연동/);
  assert.doesNotMatch(help.json.template.outputs[0].simpleText.text, /구독|라이선스|월 이용금액|5,500원|roomId/);
  assert.doesNotMatch(help.json.template.outputs[0].simpleText.text, /벤치마크|laggobot|라꼬봇/i);
  assert.match(help.json.template.outputs[0].simpleText.text, /포인트/);

  const skillPlainText = await request("/skill", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      userRequest: {
        timezone: "Asia/Seoul",
        utterance: "안녕하세요",
        user: {
          id: "test-user",
          type: "accountId",
          properties: { nickname: "테스터" }
        }
      }
    })
  });
  assert.equal(skillPlainText.response.status, 200);
  assert.equal(skillPlainText.json.template.outputs[0].simpleText.text, "");

  for (const message of [
    "안녕하세요",
    "오늘 날씨 어때?",
    "https://pixgom.com/path/test",
    "http://example.com/a/b",
    "2026/05/25",
    "A/B 테스트",
    "문장 중간에 /가 들어간 경우",
    "C:/Users/test",
    "이미지/파일 경로처럼 보이는 문자열"
  ]) {
    const nonCommand = await chat(message, "라우팅사용자", "라우팅검증방");
    assert.equal(nonCommand.json.reply, null);
  }

  const bareSlash = await chat("/", "라우팅사용자", "슬래시검증방");
  assert.equal(bareSlash.json.reply, null);

  const unknownCommand = await chat("/없는명령어", "라우팅사용자", "미등록검증방");
  assert.equal(unknownCommand.json.reply, null);
  const unknownCommandRepeat = await chat("/또없는명령어", "라우팅사용자", "미등록검증방");
  assert.equal(unknownCommandRepeat.json.reply, null);

  const weatherWithoutDefault = await chat("/날씨", "날씨사용자", "날씨검증방");
  assert.match(weatherWithoutDefault.json.reply, /사용법: \/날씨 서울/);
  const todayWeatherWithoutDefault = await chat("/오늘날씨", "날씨사용자", "오늘날씨검증방");
  assert.match(todayWeatherWithoutDefault.json.reply, /사용법: \/날씨 서울/);
  const seoulWeather = await chat("/날씨 서울", "날씨사용자", "날씨검증방");
  assert.match(seoulWeather.json.reply, /서울 날씨/);
  assert.match(seoulWeather.json.reply, /현재 기온: 22\.4/);
  assert.match(seoulWeather.json.reply, /강수: 0mm \/ 가능성 20%/);
  const siheungWeather = await chat("/시흥날씨", "날씨사용자", "날씨검증방");
  assert.match(siheungWeather.json.reply, /시흥 날씨/);
  const dynamicWeather = await chat("/서울날씨", "날씨사용자", "날씨검증방");
  assert.match(dynamicWeather.json.reply, /서울 날씨/);
  const unknownWeatherRegion = await chat("/날씨 없는지역", "날씨사용자", "날씨검증방");
  assert.match(unknownWeatherRegion.json.reply, /지역을 찾을 수 없습니다/);
  const tooSpecificWeather = await chat("/날씨 서울 강남", "날씨사용자", "날씨검증방");
  assert.match(tooSpecificWeather.json.reply, /사용법: \/날씨 서울/);
  if (process.env.OPEN_METEO_BASE_URL) {
    const originalWeatherBaseUrl = process.env.OPEN_METEO_BASE_URL;
    process.env.OPEN_METEO_BASE_URL = "http://127.0.0.1:1/v1/forecast";
    const weatherFailure = await chat("/날씨 서울", "날씨사용자", "날씨실패방");
    assert.match(weatherFailure.json.reply, /날씨 정보를 불러오지 못했습니다/);
    const weatherFailureRepeat = await chat("/날씨 서울", "날씨사용자", "날씨실패방");
    assert.equal(weatherFailureRepeat.json.reply, null);
    process.env.OPEN_METEO_BASE_URL = originalWeatherBaseUrl;
  }

  const fortune = await chatPayload({
    room: "운세검증방",
    msg: "/운세",
    sender: "운세사용자",
    senderId: "fortune-user-1"
  });
  assert.match(fortune.json.reply, /오늘의 운세/);
  assert.match(fortune.json.reply, /전체운:/);
  assert.match(fortune.json.reply, /조심할 점:/);
  assert.match(fortune.json.reply, /행운 포인트:/);
  assert.match(fortune.json.reply, /한 줄 조언:/);
  const fortuneRepeat = await chatPayload({
    room: "운세검증방",
    msg: "/오늘운세",
    sender: "운세사용자",
    senderId: "fortune-user-1"
  });
  assert.equal(fortuneRepeat.json.reply, fortune.json.reply);
  const fortuneInvalid = await chat("/운세 테스트", "운세사용자", "운세검증방");
  assert.match(fortuneInvalid.json.reply, /사용법: \/운세/);

  const removedProfileForm = await chat("/공질", "관리자");
  assert.equal(removedProfileForm.response.status, 200);
  assert.equal(removedProfileForm.json.reply === null || /등록되지 않은 명령어/.test(removedProfileForm.json.reply), true);

  const privateChat = await chatPayload({
    registeredRoom: false,
    room: "개인차단방",
    msg: "개인 대화는 기록되면 안 됨",
    sender: "미정",
    isGroupChat: false,
    rawIsGroupChat: false,
    isMultiChat: false
  });
  assert.equal(privateChat.json.ignored, true);
  assert.equal(privateChat.json.reason, "non_group_chat");

  const privateRank = await chat("/채팅오늘", "관리자", "개인차단방");
  assert.doesNotMatch(privateRank.json.reply, /미정/);

  const registeredRoomWithoutGroupFlag = await chatPayload({
    room: "등록방",
    msg: "/상태",
    sender: "관리자",
    isGroupChat: false,
    rawIsGroupChat: false,
    isMultiChat: false
  });
  assert.equal(registeredRoomWithoutGroupFlag.json.ignored, false);
  assert.match(registeredRoomWithoutGroupFlag.json.reply, /운영봇 서버 정상 연결/);

  const unregisteredGroupRoom = await chatPayload({
    registeredRoom: false,
    room: "미등록방",
    msg: "/상태",
    sender: "관리자"
  });
  assert.equal(unregisteredGroupRoom.json.ignored, true);
  assert.equal(unregisteredGroupRoom.json.reason, "unregistered_room");

  const privateRoomRegister = await chatPayload({
    registeredRoom: false,
    room: "개인등록차단방",
    msg: "/방등록 입장확인",
    sender: "개인사용자",
    isGroupChat: false,
    rawIsGroupChat: false,
    isMultiChat: false,
    roomId: "privateRoom1",
    roomLink: "https://open.kakao.com/o/privateRoom1"
  });
  assert.equal(privateRoomRegister.json.ignored, true);
  assert.equal(privateRoomRegister.json.reason, "non_group_chat");

  const roomRegister = await chatPayload({
    registeredRoom: false,
    room: "판매테스트방",
    msg: "/방등록 픽셀곰 입장확인",
    sender: "판매관리자",
    roomId: "salesRoom1",
    roomLink: "https://open.kakao.com/o/salesRoom1",
    licenseKey: "PXG-SALES-1234"
  });
  assert.equal(roomRegister.json.ignored, false);
  assert.match(roomRegister.json.reply, /방 등록 완료/);
  assert.match(roomRegister.json.reply, /픽셀곰 입장확인/);

  const roomInfo = await chatPayload({
    registeredRoom: false,
    room: "판매테스트방",
    msg: "/방정보",
    sender: "판매관리자",
    roomId: "salesRoom1",
    roomLink: "https://open.kakao.com/o/salesRoom1",
    licenseKey: "PXG-SALES-1234"
  });
  assert.match(roomInfo.json.reply, /판매테스트방 방 설정/);
  assert.match(roomInfo.json.reply, /입장확인 문구: 픽셀곰 입장확인/);
  assert.doesNotMatch(roomInfo.json.reply, /월 이용금액|5,500원|라이선스|PXG-SALES-1234|salesRoom1|open\.kakao/);

  const roomInfoDenied = await chatPayload({
    registeredRoom: false,
    room: "판매테스트방",
    msg: "/방정보",
    sender: "일반참여자",
    roomId: "salesRoom1",
    roomLink: "https://open.kakao.com/o/salesRoom1",
    licenseKey: "PXG-SALES-1234"
  });
  assert.match(roomInfoDenied.json.reply, /관리자 전용/);

  const expiredRoomRegister = await chatPayload({
    registeredRoom: false,
    room: "만료테스트방",
    msg: "/방등록 만료 입장확인",
    sender: "만료관리자",
    roomId: "expiredRoom1",
    roomLink: "https://open.kakao.com/o/expiredRoom1",
    licenseKey: "PXG-EXP-1234",
    subscriptionExpiresAt: "2020-01-01T00:00:00.000Z"
  });
  assert.equal(expiredRoomRegister.json.ignored, false);
  assert.match(expiredRoomRegister.json.reply, /방 등록 완료/);
  assert.doesNotMatch(expiredRoomRegister.json.reply, /월 이용금액|5,500원|라이선스/);

  const expiredAttendance = await chatPayload({
    registeredRoom: false,
    room: "만료테스트방",
    msg: "/출석",
    sender: "일반사용자",
    roomId: "expiredRoom1",
    roomLink: "https://open.kakao.com/o/expiredRoom1",
    licenseKey: "PXG-EXP-1234"
  });
  assert.equal(expiredAttendance.json.ignored, false);
  assert.match(expiredAttendance.json.reply, /이용기간이 만료/);
  assert.doesNotMatch(expiredAttendance.json.reply, /5,500원|라이선스|이용기간 만료:/);

  const expiredStatus = await chatPayload({
    registeredRoom: false,
    room: "만료테스트방",
    msg: "/구독상태",
    sender: "만료관리자",
    roomId: "expiredRoom1",
    roomLink: "https://open.kakao.com/o/expiredRoom1",
    licenseKey: "PXG-EXP-1234"
  });
  assert.match(expiredStatus.json.reply, /구독 상태/);
  assert.match(expiredStatus.json.reply, /만료/);
  assert.doesNotMatch(expiredStatus.json.reply, /월 이용금액|5,500원|라이선스/);

  const extendDenied = await chatPayload({
    registeredRoom: false,
    room: "만료테스트방",
    msg: "/구독연장 1",
    sender: "일반사용자",
    roomId: "expiredRoom1",
    roomLink: "https://open.kakao.com/o/expiredRoom1",
    licenseKey: "PXG-EXP-1234"
  });
  assert.match(extendDenied.json.reply, /관리자 전용/);

  const extendSubscription = await chatPayload({
    registeredRoom: false,
    room: "만료테스트방",
    msg: "/구독연장 1",
    sender: "만료관리자",
    roomId: "expiredRoom1",
    roomLink: "https://open.kakao.com/o/expiredRoom1",
    licenseKey: "PXG-EXP-1234"
  });
  assert.match(extendSubscription.json.reply, /구독이 연장/);
  assert.doesNotMatch(extendSubscription.json.reply, /월 이용금액|5,500원|라이선스/);

  const activeAfterExtend = await chatPayload({
    registeredRoom: false,
    room: "만료테스트방",
    msg: "/출석",
    sender: "일반사용자",
    roomId: "expiredRoom1",
    roomLink: "https://open.kakao.com/o/expiredRoom1",
    licenseKey: "PXG-EXP-1234"
  });
  assert.doesNotMatch(activeAfterExtend.json.reply, /이용기간이 만료/);

  const joinSignal = await chatPayload({
    registeredRoom: false,
    room: "판매테스트방",
    msg: "픽셀곰 입장확인",
    sender: "오픈채팅봇",
    roomId: "salesRoom1",
    roomLink: "https://open.kakao.com/o/salesRoom1",
    licenseKey: "PXG-SALES-1234"
  });
  assert.equal(joinSignal.json.reply, null);

  const joinedFirstChat = await chatPayload({
    registeredRoom: false,
    room: "판매테스트방",
    msg: "안녕",
    sender: "새고객 남",
    roomId: "salesRoom1",
    roomLink: "https://open.kakao.com/o/salesRoom1",
    licenseKey: "PXG-SALES-1234"
  });
  assert.equal(joinedFirstChat.json.reply, null);

  const joinedHistory = await chatPayload({
    registeredRoom: false,
    room: "판매테스트방",
    msg: "/닉이력 새고객 남",
    sender: "판매관리자",
    roomId: "salesRoom1",
    roomLink: "https://open.kakao.com/o/salesRoom1",
    licenseKey: "PXG-SALES-1234"
  });
  assert.match(joinedHistory.json.reply, /새고객 남님 히스토리/);
  assert.doesNotMatch(joinedHistory.json.reply, /입장 히스토리\s+기록 없음/);

  await chatPayload({
    room: "예약이름차단방",
    msg: "예약 이름은 순위에 노출되면 안 됨",
    sender: "미정"
  });
  const reservedRank = await chat("/채팅오늘", "관리자", "예약이름차단방");
  assert.doesNotMatch(reservedRank.json.reply, /미정/);

  const unsafeAdminRegister = await chat("/관리자등록 침입자", "침입자", "관리자보안방");
  assert.match(unsafeAdminRegister.json.reply, /초기 관리자는 환경변수/);

  process.env.ADMIN_NAMES = "관리자";

  const adminRegister = await chat("/관리자등록 관리자", "관리자");
  assert.match(adminRegister.json.reply, /관리자로 등록/);

  const adminList = await chat("/관리자목록", "관리자");
  assert.match(adminList.json.reply, /관리자/);

  const adminHelp = await chat("/?", "관리자");
  assert.match(adminHelp.json.reply, /관리자 명령어/);
  assert.match(adminHelp.json.reply, /프로필등록/);
  assert.match(adminHelp.json.reply, /입퇴장상세/);
  assert.match(adminHelp.json.reply, /관리자등록/);
  assert.match(adminHelp.json.reply, /관리자재설정/);
  assert.match(adminHelp.json.reply, /고유값초기화/);
  assert.match(adminHelp.json.reply, /원본로그/);
  assert.match(adminHelp.json.reply, /신고목록/);
  assert.match(adminHelp.json.reply, /신고처리/);
  assert.match(adminHelp.json.reply, /포인트지급/);
  assert.match(adminHelp.json.reply, /명령어등록/);

  const reportUsage = await chat("/신고", "신고자", "신고테스트방");
  assert.match(reportUsage.json.reply, /사용법: \/신고 닉네임 사유/);

  const reportCreated = await chat("/신고 문제사용자 반복적인 도배", "신고자", "신고테스트방");
  assert.match(reportCreated.json.reply, /신고가 접수/);
  assert.match(reportCreated.json.reply, /신고번호: R\d{4}/);
  assert.match(reportCreated.json.reply, /관리자 메시지함/);
  const reportId = reportCreated.json.reply.match(/R\d{4}/)?.[0];
  assert.ok(reportId);

  const reportListDenied = await chat("/신고목록", "일반사용자", "신고테스트방");
  assert.match(reportListDenied.json.reply, /관리자 전용/);

  const reportList = await chat("/신고목록", "관리자", "신고테스트방");
  assert.match(reportList.json.reply, new RegExp(reportId));
  assert.match(reportList.json.reply, /문제사용자/);
  assert.match(reportList.json.reply, /반복적인 도배/);

  const reportInbox = await chat("/메시지", "관리자", "신고테스트방");
  assert.match(reportInbox.json.reply, new RegExp(reportId));
  assert.match(reportInbox.json.reply, /신고가 접수/);

  const reportResolvedDenied = await chat(`/신고처리 ${reportId} 확인`, "일반사용자", "신고테스트방");
  assert.match(reportResolvedDenied.json.reply, /관리자 전용/);

  const reportResolved = await chat(`/신고처리 ${reportId} 확인 후 조치`, "관리자", "신고테스트방");
  assert.match(reportResolved.json.reply, /신고 처리가 완료/);
  assert.match(reportResolved.json.reply, /확인 후 조치/);

  const reportCreatedForAdmin = await chat("/신고 다른사용자 부적절한 홍보", "신고자", "신고테스트방");
  const adminReportId = reportCreatedForAdmin.json.reply.match(/R\d{4}/)?.[0];
  assert.ok(adminReportId);

  const adminReportsDenied = await request("/api/admin/reports");
  assert.equal(adminReportsDenied.response.status, 401);
  assert.equal(adminReportsDenied.json.error, "owner_login_required");

  const adminReportsOpen = await request("/api/admin/reports?token=test-admin-token&status=open");
  assert.equal(adminReportsOpen.response.status, 200);
  assert.equal(adminReportsOpen.json.summary.open >= 1, true);
  assert.equal(adminReportsOpen.json.reports.some((report) => report.roomName === "신고테스트방" && report.id === adminReportId && report.status === "open"), true);

  const adminReportResolved = await request("/api/admin/reports/resolve", {
    method: "POST",
    headers: { "content-type": "application/json", "x-admin-token": "test-admin-token" },
    body: JSON.stringify({
      roomName: "신고테스트방",
      reportId: adminReportId,
      resolution: "어드민 화면에서 처리"
    })
  });
  assert.equal(adminReportResolved.response.status, 200);
  assert.equal(adminReportResolved.json.report.status, "resolved");
  assert.equal(adminReportResolved.json.report.resolution, "어드민 화면에서 처리");

  const adminReportsResolved = await request("/api/admin/reports?token=test-admin-token&status=resolved");
  assert.equal(adminReportsResolved.response.status, 200);
  assert.equal(adminReportsResolved.json.reports.some((report) => report.id === adminReportId && report.status === "resolved"), true);

  const fixedCommands = await chat("/고정명령어", "관리자");
  assert.match(fixedCommands.json.reply, /픽셀곰 고정 명령어/);
  assert.match(fixedCommands.json.reply, /게임\/연동 예약/);

  const gameCommands = await chat("/게임명령어", "관리자");
  assert.match(gameCommands.json.reply, /픽셀곰 게임 명령어/);
  assert.match(gameCommands.json.reply, /뽑기/);
  assert.match(gameCommands.json.reply, /\/홀 금액/);
  assert.match(gameCommands.json.reply, /픽셀곰게임/);

  const reservedCustomCommand = await chat("/명령어등록 /상태 상태 덮어쓰기", "관리자");
  assert.match(reservedCustomCommand.json.reply, /고정 명령어/);

  const customCommandRegister = await chat("/명령어등록 /규칙 두글자 닉네임 뒤에 성별을 붙여주세요.", "관리자");
  assert.match(customCommandRegister.json.reply, /커스텀 명령어가 저장/);

  const customCommandList = await chat("/명령어목록", "관리자");
  assert.match(customCommandList.json.reply, /\/규칙/);

  const customCommandReply = await chat("/규칙", "사용자");
  assert.match(customCommandReply.json.reply, /두글자 닉네임/);

  const customCommandDelete = await chat("/명령어삭제 /규칙", "관리자");
  assert.match(customCommandDelete.json.reply, /삭제했습니다/);

  const customCommandAfterDelete = await chat("/규칙", "사용자");
  assert.equal(customCommandAfterDelete.json.reply === null || /등록되지 않은 명령어/.test(customCommandAfterDelete.json.reply), true);

  const tempAdminRegister = await chat("/관리자등록 임시관리자", "관리자");
  assert.match(tempAdminRegister.json.reply, /관리자로 등록/);

  const adminResetDenied = await chat("/관리자재설정 관리자,부관리자", "사용자");
  assert.match(adminResetDenied.json.reply, /관리자 전용/);

  const adminReset = await chat("/관리자재설정 관리자,부관리자", "관리자");
  assert.match(adminReset.json.reply, /관리자 목록이 재설정/);
  assert.match(adminReset.json.reply, /관리자/);
  assert.match(adminReset.json.reply, /부관리자/);

  const adminListAfterReset = await chat("/관리자목록", "관리자");
  assert.match(adminListAfterReset.json.reply, /부관리자/);
  assert.doesNotMatch(adminListAfterReset.json.reply, /임시관리자/);

  const uniqueEntry = await chatPayload({
    room: "고유값방",
    msg: "고유대상 남님이 들어왔습니다.",
    sender: "오픈채팅봇",
    targetUserId: "openchat-user-1",
    senderId: "openchat-bot"
  });
  assert.match(uniqueEntry.json.reply, /고유대상 남님 어서오세요/);

  await chatPayload({
    room: "고유값방",
    msg: "고유대상 남님이 나갔습니다.",
    sender: "오픈채팅봇",
    targetUserId: "openchat-user-1",
    senderId: "openchat-bot"
  });

  const uniqueReentry = await chatPayload({
    room: "고유값방",
    msg: "바뀐대상 남님이 들어왔습니다.",
    sender: "오픈채팅봇",
    targetUserId: "openchat-user-1",
    senderId: "openchat-bot"
  });
  assert.match(uniqueReentry.json.reply, /2회 재입장/);
  assert.match(uniqueReentry.json.reply, /고유대상 남/);
  assert.match(uniqueReentry.json.reply, /바뀐대상 남/);

  await chat("/관리자등록 일반사용자", "관리자", "고유값방");
  const recentEvents = await chat("/최근이벤트 5", "일반사용자", "고유값방");
  assert.match(recentEvents.json.reply, /targetUserId : openchat-user-1/);
  assert.match(recentEvents.json.reply, /id 후보/);

  const rawLogDenied = await chat("/원본로그 3", "비관리자", "고유값방");
  assert.match(rawLogDenied.json.reply, /관리자 전용/);

  const rawLog = await chat("/원본로그 5", "관리자", "고유값방");
  assert.match(rawLog.json.reply, /원본 이벤트 로그/);
  assert.match(rawLog.json.reply, /targetUserId/);

  const explicitEntry = await chatPayload({
    room: "자동추출방",
    msg: "브릿지 원문",
    sender: "오픈채팅봇",
    eventType: "entered",
    targetName: "자동대상 남",
    profileHash: "bridge-bot-hash"
  });
  assert.match(explicitEntry.json.reply, /자동대상 남님 어서오세요/);
  assert.doesNotMatch(explicitEntry.json.reply, /친구들과 함께 즐겁게 소통|좋아요 누르기|프로필작성/);

  const duplicateExplicitEntry = await chatPayload({
    room: "자동추출방",
    msg: "브릿지 원문",
    sender: "오픈채팅봇",
    eventType: "entered",
    targetName: "자동대상 남",
    profileHash: "bridge-bot-hash"
  });
  assert.equal(duplicateExplicitEntry.json.reply, null);

  await chatPayload({
    room: "자동추출방",
    msg: "브릿지 퇴장 원문",
    sender: "오픈채팅봇",
    eventType: "left",
    targetName: "자동대상 남",
    profileHash: "bridge-bot-hash"
  });

  const explicitReentry = await chatPayload({
    room: "자동추출방",
    msg: "브릿지 재입장 원문",
    sender: "오픈채팅봇",
    eventType: "entered",
    targetName: "자동대상 남",
    profileHash: "bridge-bot-hash"
  });
  assert.match(explicitReentry.json.reply, /2회 재입장/);

  const bridgeReplyEcho = await chatPayload({
    room: "자동추출방",
    msg: "휴가 즐기는 어피치님 히스토리\n\n❰ 닉네임 히스토리 ❱\n• 휴가 즐기는 어피치\n\n❰ 입장 히스토리 ❱\n· 26.05.23",
    sender: "⚠ 휴가 즐기는 어피치님 4회 재입장 ⚠",
    profileHash: "bridge-echo-hash"
  });
  assert.equal(bridgeReplyEcho.json.reply, null);

  const passiveAttachment = await chatPayload({
    room: "자동추출방",
    msg: "사진을 보냈습니다",
    sender: "미정",
    profileHash: "unknown-media-hash"
  });
  assert.equal(passiveAttachment.json.reply, null);

  const explicitNickChange = await chatPayload({
    room: "자동추출방",
    msg: "닉변 원문",
    sender: "오픈채팅봇",
    eventType: "nickname_changed",
    fromName: "자동대상 남",
    toName: "자동변경 남"
  });
  assert.match(explicitNickChange.json.reply, /자동대상 남 -> 자동변경 남/);

  const arrowText = await chatPayload({
    room: "오탐방",
    msg: "현재: 카카오톡 → 메신저봇 앱 → 픽셀곰 서버 → 카카오톡 답장",
    sender: "오탐사용자",
    profileHash: "arrow-false-positive-hash"
  });
  assert.equal(arrowText.json.reply, null);

  await chat("/관리자등록 오탐사용자", "관리자", "오탐방");
  const arrowEvents = await chat("/최근이벤트 1", "오탐사용자", "오탐방");
  assert.match(arrowEvents.json.reply, /event : -/);
  assert.doesNotMatch(arrowEvents.json.reply, /nickname_changed/);

  const profileHashChat = await chatPayload({
    room: "자동추출방",
    msg: "프로필 해시 테스트",
    sender: "해시사용자 남",
    profileHash: "profile-hash-user-1"
  });
  assert.equal(profileHashChat.json.reply, null);

  const autoEvents = await chat("/최근이벤트 5", "관리자", "자동추출방");
  assert.match(autoEvents.json.reply, /event : nickname_changed/);
  assert.match(autoEvents.json.reply, /senderId : profile-hash-user-1/);

  await chatPayload({
    room: "해시닉변방",
    msg: "예전 닉네임으로 보낸 채팅",
    sender: "예전해시닉 남",
    profileHash: "profile-hash-rename-1"
  });

  await chatPayload({
    room: "해시닉변방",
    msg: "새 닉네임으로 보낸 채팅",
    sender: "새해시닉 남",
    profileHash: "profile-hash-rename-1"
  });

  await chat("/관리자등록 일반사용자", "관리자", "해시닉변방");
  const hashRenameEvents = await chat("/최근이벤트 5", "일반사용자", "해시닉변방");
  assert.match(hashRenameEvents.json.reply, /회원이력 : 새해시닉 남 \(이전닉: 예전해시닉 남\)/);

  await chatPayload({
    room: "첫채팅재입장방",
    msg: "예전 닉으로 활동",
    sender: "첫채팅예전닉 남",
    profileHash: "first-chat-reentry-hash-1"
  });

  const firstChatReentry = await chatPayload({
    room: "첫채팅재입장방",
    msg: "재입장 후 첫 채팅",
    sender: "첫채팅현재닉 남",
    profileHash: "first-chat-reentry-hash-1"
  });
  assert.match(firstChatReentry.json.reply, /닉네임 변경/);
  assert.match(firstChatReentry.json.reply, /현재닉 : 첫채팅현재닉 남/);
  assert.match(firstChatReentry.json.reply, /이전닉 : 첫채팅예전닉 남/);
  assert.doesNotMatch(firstChatReentry.json.reply, /고유값|후보|재입장/);

  const secondChatAfterReentry = await chatPayload({
    room: "첫채팅재입장방",
    msg: "두 번째 채팅",
    sender: "첫채팅현재닉 남",
    profileHash: "first-chat-reentry-hash-1"
  });
  assert.equal(secondChatAfterReentry.json.reply, null);

  await chatPayload({
    room: "고유값충돌방",
    msg: "첫 번째 이름",
    sender: "충돌첫닉 남",
    profileHash: "collision-prone-hash-1"
  });
  await chatPayload({
    room: "고유값충돌방",
    msg: "두 번째 이름",
    sender: "충돌둘닉 남",
    profileHash: "collision-prone-hash-1"
  });
  const collisionProneChat = await chatPayload({
    room: "고유값충돌방",
    msg: "세 번째 이름",
    sender: "충돌셋닉 남",
    profileHash: "collision-prone-hash-1"
  });
  assert.match(collisionProneChat.json.reply, /닉네임 변경/);
  assert.match(collisionProneChat.json.reply, /이전닉 : 충돌둘닉 남/);
  assert.match(collisionProneChat.json.reply, /현재닉 : 충돌셋닉 남/);
  assert.doesNotMatch(collisionProneChat.json.reply, /충돌첫닉 남/);
  assert.doesNotMatch(collisionProneChat.json.reply, /고유값|후보|재입장/);

  await chatPayload({
    room: "미정해시오탐방",
    msg: "알림 파서가 보낸 미정",
    sender: "미정",
    profileHash: "unknown-to-named-hash-1"
  });
  const unknownHashFalseRename = await chatPayload({
    room: "미정해시오탐방",
    msg: "실제 닉네임 첫 채팅",
    sender: "두팔",
    profileHash: "unknown-to-named-hash-1"
  });
  assert.equal(unknownHashFalseRename.json.reply, null);

  const unknownHashHistory = await chat("/닉이력 두팔", "일반사용자", "미정해시오탐방");
  assert.doesNotMatch(unknownHashHistory.json.reply, /미정/);

  if (testDbPath) {
    await writeFile(testDbPath, JSON.stringify({
      rooms: {
        레거시오염방: {
          name: "레거시오염방",
          profiles: {},
          aliases: {},
          people: {
            두팔: {
              currentName: "두팔",
              names: ["미정", "두팔"],
              nickChanges: [{ from: "미정", to: "두팔", at: "2026-05-23T12:00:00.000Z", source: "identity" }],
              entries: [],
              exits: [],
              kicks: [],
              chats: { total: 0, byDate: {}, byWeek: {} },
              attendance: { dates: [], currentStreak: 0 }
            }
          },
          admins: [],
          inbox: {},
          events: [],
          rawEvents: [],
          peopleByIdentity: {},
          ambiguousIdentities: []
        }
      }
    }));

    const legacyPollutedHistory = await chat("/닉이력 두팔", "일반사용자", "레거시오염방");
    assert.doesNotMatch(legacyPollutedHistory.json.reply, /미정/);
    assert.doesNotMatch(legacyPollutedHistory.json.reply, /닉네임 변경/);
  }

  await chatPayload({
    room: "공유해시오탐방",
    msg: "미정 첫 활동",
    sender: "미정",
    profileHash: "shared-profile-hash-1"
  });
  await chatPayload({
    room: "공유해시오탐방",
    msg: "두팔 독립 활동",
    sender: "두팔"
  });
  const sharedHashFalseRename = await chatPayload({
    room: "공유해시오탐방",
    msg: "트ㅋㅋㅋㅋㅋㅋ",
    sender: "두팔",
    profileHash: "shared-profile-hash-1"
  });
  assert.equal(sharedHashFalseRename.json.reply, null);

  const sharedHashFlipFlop = await chatPayload({
    room: "공유해시오탐방",
    msg: "엥?",
    sender: "미정",
    profileHash: "shared-profile-hash-1"
  });
  assert.equal(sharedHashFlipFlop.json.reply, null);

  const identityResetDenied = await chat("/고유값초기화 두팔", "사용자", "공유해시오탐방");
  assert.match(identityResetDenied.json.reply, /관리자 전용/);

  const identityReset = await chat("/고유값초기화 두팔", "관리자", "공유해시오탐방");
  assert.match(identityReset.json.reply, /고유값 초기화 완료/);
  assert.match(identityReset.json.reply, /대상 : 두팔/);
  assert.match(identityReset.json.reply, /차단 고유값 : 1개/);

  await chatPayload({
    room: "활성사용자방",
    msg: "기존 활동",
    sender: "활성예전닉 남",
    profileHash: "active-user-hash-1"
  });

  await chatPayload({
    room: "활성사용자방",
    msg: "닉 변경 후 첫 안내",
    sender: "활성현재닉 남",
    profileHash: "active-user-hash-1"
  });

  const activeUserNormalChat = await chatPayload({
    room: "활성사용자방",
    msg: "그냥 일반 대화",
    sender: "활성현재닉 남",
    profileHash: "active-user-hash-1"
  });
  assert.equal(activeUserNormalChat.json.reply, null);

  await chatPayload({
    room: "원본복구방",
    msg: "구버전 시점 채팅",
    sender: "복구전닉 남",
    senderId: "raw-recover-id-1",
    profileHash: "raw-recover-id-1"
  });

  await chat("/관리자등록 복구후닉 남", "관리자", "원본복구방");
  const recoverEventsBeforePersonRename = await chatPayload({
    room: "원본복구방",
    msg: "/최근이벤트 5",
    sender: "복구후닉 남",
    profileHash: "raw-recover-id-1"
  });
  assert.match(recoverEventsBeforePersonRename.json.reply, /회원이력 : 복구후닉 남 \(이전닉: 복구전닉 남\)/);

  await chatPayload({
    room: "원본복구이전방",
    msg: "다른 방에 남은 예전 채팅",
    sender: "이전방닉 남",
    senderId: "cross-room-recover-id-1",
    profileHash: "cross-room-recover-id-1"
  });

  await chat("/관리자등록 현재방닉 남", "관리자", "원본복구현재방");
  const crossRoomRecoverEvents = await chatPayload({
    room: "원본복구현재방",
    msg: "/최근이벤트 10",
    sender: "현재방닉 남",
    senderId: "cross-room-recover-id-1",
    profileHash: "cross-room-recover-id-1"
  });
  assert.match(crossRoomRecoverEvents.json.reply, /회원이력 : 현재방닉 남 \(이전닉: 이전방닉 남\)/);
  assert.match(crossRoomRecoverEvents.json.reply, /같은 고유값 기준/);
  assert.match(crossRoomRecoverEvents.json.reply, /sender : 이전방닉 남/);
  assert.match(crossRoomRecoverEvents.json.reply, /sender : 현재방닉 남/);
  assert.match(crossRoomRecoverEvents.json.reply, /sender : 이전방닉 남[\s\S]+회원이력 : 현재방닉 남 \(이전닉: 이전방닉 남\)/);

  const removedLinkCommand = await chat("/건의방", "사용자");
  assert.equal(removedLinkCommand.json.reply === null || /등록되지 않은 명령어/.test(removedLinkCommand.json.reply), true);

  const removedLinkRegister = await chat("/링크등록 건의방 https://open.kakao.com/o/test", "관리자");
  assert.equal(removedLinkRegister.json.reply === null || /등록되지 않은 명령어/.test(removedLinkRegister.json.reply), true);

  const profileRegister = await chat(`/프로필등록 미미 여 && ☑닉 /성별 : 미미 / 여
☑MBTI / 키 : 엔프피 / 153
☑지역 / 기미돌 : 경기 / 기
☑매력어필 : 작고소듕
☑썸상 : 크고 건강하신 연하남`, "관리자");
  assert.match(profileRegister.json.reply, /프로필이 등록되었습니다/);

  const aliasRegister = await chat("/별명등록 미미 여 미미", "관리자");
  assert.match(aliasRegister.json.reply, /별명이 미미/);

  const profileView = await chat("/프로필 미미", "사용자");
  assert.match(profileView.json.reply, /미미 여/);
  assert.match(profileView.json.reply, /엔프피/);

  await chat("포인트 기능 테스트 시작", "포순이 여");

  const attendance = await chat("/출석", "포순이 여");
  assert.match(attendance.json.reply, /포순이 여님 출석/);
  assert.match(attendance.json.reply, /🅟100 획득/);

  const attendanceDuplicate = await chat("/출석체크", "포순이 여");
  assert.match(attendanceDuplicate.json.reply, /이미 출첵/);

  const shortAttendance = await chat("ㅊㅊ", "초성출석 남");
  assert.match(shortAttendance.json.reply, /초성출석 남님 출석/);

  const pointGrant = await chat("/포인트지급 포순이 여 1000", "관리자");
  assert.match(pointGrant.json.reply, /포인트 지급 완료/);
  assert.match(pointGrant.json.reply, /포순이 여/);

  const shopAddDenied = await chat("/상점추가 물약 100 HP 회복", "사용자");
  assert.match(shopAddDenied.json.reply, /관리자 전용/);

  const shopAdd = await chat("/상점추가 물약 100 HP 회복", "관리자");
  assert.match(shopAdd.json.reply, /상점 상품이 추가/);
  assert.match(shopAdd.json.reply, /1\. 물약 - 🅟100/);

  const shopList = await chat("/상점", "포순이 여");
  assert.match(shopList.json.reply, /픽셀곰 상점/);
  assert.match(shopList.json.reply, /물약/);

  const purchase = await chat("/구매 1", "포순이 여");
  assert.match(purchase.json.reply, /구매 완료/);
  assert.match(purchase.json.reply, /물약/);

  const bag = await chat("/가방", "포순이 여");
  assert.match(bag.json.reply, /포순이 여님의 가방/);
  assert.match(bag.json.reply, /1\. 물약 x 1/);

  const itemGrant = await chat("/아이템지급 미미 여 1 2", "관리자");
  assert.match(itemGrant.json.reply, /아이템지급 완료/);

  const adminBag = await chat("/가방 미미 여", "관리자");
  assert.match(adminBag.json.reply, /미미 여님의 가방/);
  assert.match(adminBag.json.reply, /물약 x 2/);

  const itemRevoke = await chat("/아이템회수 미미 여 1 1", "관리자");
  assert.match(itemRevoke.json.reply, /아이템회수 완료/);

  const gift = await chat("/가방선물 미미 여 1 1", "포순이 여");
  assert.match(gift.json.reply, /가방 선물 완료/);

  const itemUse = await chat("/사용 1", "미미 여");
  assert.match(itemUse.json.reply, /아이템 사용 완료/);

  const purchaseHistory = await chat("/구매내역", "포순이 여");
  assert.match(purchaseHistory.json.reply, /구매\/아이템 내역/);
  assert.match(purchaseHistory.json.reply, /물약/);

  const shopHistory = await chat("/상점내역", "관리자");
  assert.match(shopHistory.json.reply, /상점 내역/);
  assert.match(shopHistory.json.reply, /물약/);

  const shopDelete = await chat("/상점삭제 1", "관리자");
  assert.match(shopDelete.json.reply, /상점에서 숨겼습니다/);

  const emptyShop = await chat("/상점", "포순이 여");
  assert.match(emptyShop.json.reply, /등록된 상품이 없습니다/);

  const pointView = await chat("/포인트", "포순이 여");
  assert.match(pointView.json.reply, /포순이 여님의 포인트 : 🅟/);

  const pointGuide = await chat("/포인트안내", "포순이 여");
  assert.match(pointGuide.json.reply, /포인트 콘텐츠/);
  assert.match(pointGuide.json.reply, /응원 카드/);
  assert.match(pointGuide.json.reply, /게임형 포인트 명령어/);

  const drawCatalogDisabled = await chat("/뽑기목록", "포순이 여");
  assert.match(drawCatalogDisabled.json.reply, /게임 기능은 이 방에서 꺼져/);

  const oddEvenDisabled = await chat("/홀 100", "포순이 여");
  assert.match(oddEvenDisabled.json.reply, /게임 기능은 이 방에서 꺼져/);

  const enableDrawGames = await chat("/기능켜기 게임", "관리자");
  assert.match(enableDrawGames.json.reply, /게임 기능이 켜졌습니다/);

  const drawCatalog = await chat("/뽑기목록", "포순이 여");
  assert.match(drawCatalog.json.reply, /뽑기 목록/);
  assert.match(drawCatalog.json.reply, /대박/);

  const baitShop = await chat("/미끼상점", "낚시러 여");
  assert.match(baitShop.json.reply, /미끼 상점/);
  assert.match(baitShop.json.reply, /기본 미끼/);

  const fishingWithoutBait = await chat("/낚시", "낚시러 여");
  assert.match(fishingWithoutBait.json.reply, /미끼가 부족합니다/);

  const fishingPointGrant = await chat("/포인트지급 낚시러 여 500", "관리자");
  assert.match(fishingPointGrant.json.reply, /포인트 지급 완료/);

  const baitPurchase = await chat("/미끼구매 3", "낚시러 여");
  assert.match(baitPurchase.json.reply, /미끼 구매 완료/);
  assert.match(baitPurchase.json.reply, /기본 미끼 x 3/);

  const fishingItem = await chat("/낚시", "낚시러 여");
  assert.match(fishingItem.json.reply, /낚시 결과/);
  assert.match(fishingItem.json.reply, /가방에 보관/);
  assert.match(fishingItem.json.reply, /판매가 : 🅟/);
  const caughtFishId = fishingItem.json.reply.match(/#(10\d{3})/)?.[1];
  assert.ok(caughtFishId, "낚시 결과에 물고기 상품 번호가 포함되어야 합니다.");

  const fishingCooldown = await chat("/낚시", "낚시러 여");
  assert.match(fishingCooldown.json.reply, /쿨타임/);
  assert.match(fishingCooldown.json.reply, /낚시는/);

  const aquarium = await chat("/어항", "낚시러 여");
  assert.match(aquarium.json.reply, /낚시러 여님의 어항/);
  assert.match(aquarium.json.reply, /수집/);
  assert.match(aquarium.json.reply, new RegExp(caughtFishId));

  const fishingBag = await chat("/가방", "낚시러 여");
  assert.match(fishingBag.json.reply, /판매가/);
  assert.match(fishingBag.json.reply, new RegExp(caughtFishId));

  const sellFish = await chat(`/판매 ${caughtFishId} 1`, "낚시러 여");
  assert.match(sellFish.json.reply, /판매 완료/);
  assert.match(sellFish.json.reply, /지급 포인트/);

  const exploreItem = await chat("/탐험", "탐험가 여");
  assert.match(exploreItem.json.reply, /탐험 결과/);
  assert.match(exploreItem.json.reply, /가방에 보관/);

  const exploreCooldown = await chat("/탐험", "탐험가 여");
  assert.match(exploreCooldown.json.reply, /쿨타임/);
  assert.match(exploreCooldown.json.reply, /탐험은/);

  const diceGame = await chat("/주사위", "주사위러 여");
  assert.match(diceGame.json.reply, /주사위 게임/);

  const diceCooldown = await chat("/주사위", "주사위러 여");
  assert.match(diceCooldown.json.reply, /쿨타임/);
  assert.match(diceCooldown.json.reply, /주사위는/);

  const invalidLikeAmount = await chat("/좋아요 미미 10000", "포순이 여");
  assert.match(invalidLikeAmount.json.reply, /1 ~ 999 범위/);

  const likeReply = await chat("/좋아요 미미 10", "포순이 여");
  assert.match(likeReply.json.reply, /💕/);

  const selfLike = await chat("/좋아요 포순이 1", "포순이 여");
  assert.match(selfLike.json.reply, /님 말고 다른 사람/);

  const transfer = await chat("/이체 미미 100", "포순이 여");
  assert.match(transfer.json.reply, /이체 완료/);
  assert.match(transfer.json.reply, /수수료 : 🅟10/);

  const cheerReply = await chat("/응원 미미 여 오늘도 고마워", "포순이 여");
  assert.match(cheerReply.json.reply, /포인트 응원 카드/);
  assert.match(cheerReply.json.reply, /포순이 여 -> 미미 여/);
  assert.match(cheerReply.json.reply, /오늘도 고마워/);
  assert.match(cheerReply.json.reply, /사용 포인트 : 🅟50/);

  const luckyDraw = await chat("/뽑기", "포순이 여");
  assert.match(luckyDraw.json.reply, /뽑기 결과/);
  assert.match(luckyDraw.json.reply, /포순이 여님 (대박|성공|본전|꽝)/);
  assert.match(luckyDraw.json.reply, /사용 : 🅟100/);
  assert.match(luckyDraw.json.reply, /획득 : 🅟(0|100|200|500)/);
  assert.doesNotMatch(luckyDraw.json.reply, /공개 확률/);

  const luckyDrawCooldown = await chat("/뽑기", "포순이 여");
  assert.match(luckyDrawCooldown.json.reply, /쿨타임/);
  assert.match(luckyDrawCooldown.json.reply, /뽑기는/);

  const oddEven = await chat("/홀 100", "포순이 여");
  assert.match(oddEven.json.reply, /홀짝 결과/);
  assert.match(oddEven.json.reply, /선택 : 홀/);
  assert.match(oddEven.json.reply, /베팅 : 🅟100/);
  assert.match(oddEven.json.reply, /결과 : (홀|짝)/);
  assert.match(oddEven.json.reply, /배당 : x2/);
  assert.match(oddEven.json.reply, /지급 포인트 : 🅟(0|200)/);

  const oddEvenCooldown = await chat("/짝 100", "포순이 여");
  assert.match(oddEvenCooldown.json.reply, /쿨타임/);
  assert.match(oddEvenCooldown.json.reply, /홀짝은/);

  const memberInfo = await chat("/내정보", "포순이 여");
  assert.match(memberInfo.json.reply, /레벨/);
  assert.match(memberInfo.json.reply, /보유 포인트/);
  assert.match(memberInfo.json.reply, /소비한 포인트/);
  assert.match(memberInfo.json.reply, /경험치/);

  const receiverInfo = await chat("/내정보", "미미 여");
  assert.match(receiverInfo.json.reply, /♥ x 11/);

  const pointRank = await chat("/포인트순위", "포순이 여");
  assert.match(pointRank.json.reply, /채팅방 포인트 순위/);
  assert.match(pointRank.json.reply, /포순이 여/);

  const attendanceRank = await chat("/출석순위", "포순이 여");
  assert.match(attendanceRank.json.reply, /채팅방 출석 순위/);
  assert.match(attendanceRank.json.reply, /포순이 여/);

  const missingAttendance = await chat("/미출석", "포순이 여");
  assert.match(missingAttendance.json.reply, /오늘 미출석/);
  assert.match(missingAttendance.json.reply, /미미 여/);

  const likeRank = await chat("/좋아요순위", "포순이 여");
  assert.match(likeRank.json.reply, /채팅방 좋아요순위/);
  assert.match(likeRank.json.reply, /미미 여 ♥11/);

  const levelRank = await chat("/레벨순위", "포순이 여");
  assert.match(levelRank.json.reply, /채팅방 레벨 순위/);

  const todayChatRank = await chat("/채팅오늘", "포순이 여");
  assert.match(todayChatRank.json.reply, /오늘 채팅 순위/);

  const weekChatRank = await chat("/채팅금주", "포순이 여");
  assert.match(weekChatRank.json.reply, /이번 주 채팅 순위/);

  const adminDebit = await chat("/포인트차감 포순이 여 10", "관리자");
  assert.match(adminDebit.json.reply, /포인트 차감 완료/);

  const mentionMessage = await chat("미미야 확인해줘 @미미 여", "관리자");
  assert.equal(mentionMessage.json.reply, null);

  const unreadNotice = await chat("왔어", "미미 여");
  assert.match(unreadNotice.json.reply, /읽지 않은 메시지가 1건/);
  assert.match(unreadNotice.json.reply, /\/메시지/);

  const unreadNoticeRepeat = await chat("다시 왔어", "미미 여");
  assert.equal(unreadNoticeRepeat.json.reply, null);

  const inbox = await chat("/메시지", "미미 여");
  assert.match(inbox.json.reply, /💌 미미 여님, 1건의 메시지/);
  assert.match(inbox.json.reply, /보낸사람 : 관리자/);
  assert.match(inbox.json.reply, /미미야 확인해줘/);

  const emptyInbox = await chat("/메세지", "미미 여");
  assert.match(emptyInbox.json.reply, /읽지 않은 메시지가 없습니다/);

  await chat("미미야 새로 확인해줘 @미미 여", "관리자");
  const secondUnreadNotice = await chat("새 메시지 확인", "미미 여");
  assert.match(secondUnreadNotice.json.reply, /읽지 않은 메시지가 1건/);
  const secondInbox = await chat("/메시지", "미미 여");
  assert.match(secondInbox.json.reply, /미미야 새로 확인해줘/);

  const firstEntry = await chat("새친구 남님이 들어왔습니다.타인, 기관 등의 사칭에 유의해 주세요.", "오픈채팅봇");
  assert.match(firstEntry.json.reply, /새친구 남님 어서오세요/);
  assert.doesNotMatch(firstEntry.json.reply, /친구들과 함께 즐겁게 소통|두글자로 해주고 뒤에 성별|프로필작성/);

  const duplicateFirstEntry = await chat("새친구 남님이 들어왔습니다.", "오픈채팅봇");
  assert.equal(duplicateFirstEntry.json.reply, null);

  const exitReply = await chat("새친구 남님이 나갔습니다.", "오픈채팅봇");
  assert.match(exitReply.json.reply, /새친구 남님 안녕히 가세요/);
  assert.match(exitReply.json.reply, /닉네임 히스토리/);
  assert.match(exitReply.json.reply, /입장 히스토리/);
  assert.match(exitReply.json.reply, /퇴장 히스토리/);

  await chat("미정님이 들어왔습니다.", "오픈채팅봇", "후보방");
  await chat("미정님이 나갔습니다.", "오픈채팅봇", "후보방");
  const candidateEntry = await chat("어피치님이 들어왔습니다.타인, 기관 등의 사칭에 유의해 주세요.", "오픈채팅봇", "후보방");
  assert.match(candidateEntry.json.reply, /재입장 후보 히스토리/);
  assert.match(candidateEntry.json.reply, /미정/);
  assert.match(candidateEntry.json.reply, /어피치/);

  const secondEntry = await chat("새친구 남님이 들어왔습니다.", "오픈채팅봇");
  assert.match(secondEntry.json.reply, /2회 재입장/);
  assert.match(secondEntry.json.reply, /강퇴이력 : 0회/);
  assert.match(secondEntry.json.reply, /입장 히스토리/);
  assert.match(secondEntry.json.reply, /퇴장 히스토리/);

  const nickChange = await chat("새친구 남 ➙ 새이름 남", "오픈채팅봇");
  assert.match(nickChange.json.reply, /닉네임 변경/);
  assert.match(nickChange.json.reply, /새친구 남 -> 새이름 남/);
  assert.match(nickChange.json.reply, /최초닉/);
  assert.match(nickChange.json.reply, /• 새이름 남/);

  const kickedFirstEntry = await chat("재입장 남님이 들어왔습니다.", "오픈채팅봇");
  assert.match(kickedFirstEntry.json.reply, /재입장 남님 어서오세요/);

  await chat("재입장 남님을 내보냈습니다.", "오픈채팅봇");

  const kickedReentry = await chat("재입장 남님이 들어왔습니다.", "오픈채팅봇");
  assert.match(kickedReentry.json.reply, /2회 재입장/);
  assert.match(kickedReentry.json.reply, /강퇴이력 : 1회/);
  assert.match(kickedReentry.json.reply, /강퇴사유 : 미등록/);

  await chat("새이름 남님을 내보냈습니다.", "오픈채팅봇");

  const detailedHistory = await chat("/입퇴장상세 새이름", "관리자");
  assert.match(detailedHistory.json.reply, /입퇴장 상세/);
  assert.match(detailedHistory.json.reply, /입장 2회/);
  assert.match(detailedHistory.json.reply, /퇴장 1회/);
  assert.match(detailedHistory.json.reply, /강퇴 1회/);
  assert.match(detailedHistory.json.reply, /닉변 1회/);

  const nickHistory = await chat("/닉이력 새이름", "사용자");
  assert.match(nickHistory.json.reply, /새친구 남/);
  assert.match(nickHistory.json.reply, /새이름 남/);

  const normalChat = await chat("일반 대화", "사용자");
  assert.equal(normalChat.json.reply, null);
  assert.equal(normalChat.json.handled, false);

  const slashHelp = await chat("/", "사용자");
  assert.equal(slashHelp.json.reply, null);

  const disableGameAtEnd = await chat("/기능끄기 게임", "관리자");
  assert.match(disableGameAtEnd.json.reply, /게임 기능이 꺼졌습니다/);

  const disabledGame = await chat("/낚시", "사용자");
  assert.match(disabledGame.json.reply, /게임 기능은 이 방에서 꺼져/);

  const chatGet = await request("/chat-event");
  assert.equal(chatGet.response.status, 405);

  console.log("Room ops bot tests passed.");
} finally {
  await cleanup();
}
