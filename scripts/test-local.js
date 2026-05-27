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
  assert.equal(health.json.version, "0.5.11");
  assert.equal(health.json.dbStatus.ok, true);
  assert.equal(health.json.dbStatus.type, "local-json");
  assert.match(health.json.serverTime, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(health.json.serverTimezone, "Asia/Seoul");
  assert.equal(health.json.minAndroidVersion, "1.0.17");
  assert.equal(health.json.latestAndroidVersion, "1.0.27");
  assert.equal(health.json.latestAndroidVersionCode, 28);
  assert.equal(health.json.minAndroidVersionCode, 18);
  assert.equal(health.json.latestAndroidVersionCode, 28);
  assert.equal(health.json.appUpdateRequired, false);
  assert.equal(health.json.gamesEnabled, true);
  assert.equal(Object.hasOwn(health.json, "benchmark"), false);
  assert.match(health.json.features.join(","), /profile-registry/);
  assert.match(health.json.features.join(","), /admin-nickname-merge-tool/);
  assert.match(health.json.features.join(","), /admin-nickname-merge-history/);
  assert.match(health.json.features.join(","), /admin-nickname-merge-candidates/);
  assert.match(health.json.features.join(","), /message-inbox/);
  assert.match(health.json.features.join(","), /point-shop/);
  assert.match(health.json.features.join(","), /game-item-economy/);
  assert.match(health.json.features.join(","), /game-cooldowns/);
  assert.match(health.json.features.join(","), /fishing-bait-aquarium/);
  assert.match(health.json.features.join(","), /generated-fish-catalog/);
  assert.match(health.json.features.join(","), /bulk-item-purchase/);
  assert.match(health.json.features.join(","), /rpg-adventure-pack/);
  assert.match(health.json.features.join(","), /pixel-monster-rpg-pack/);
  assert.match(health.json.features.join(","), /pet-raising-pack/);
  assert.match(health.json.features.join(","), /game-room-role-split/);
  assert.match(health.json.features.join(","), /detailed-member-history/);
  assert.match(health.json.features.join(","), /admin-commands/);
  assert.match(health.json.features.join(","), /point-ledger/);
  assert.match(health.json.features.join(","), /like-points/);
  assert.match(health.json.features.join(","), /attendance-rewards/);
  assert.match(health.json.features.join(","), /member-rankings/);
  assert.match(health.json.features.join(","), /raw-event-log/);
  assert.match(health.json.features.join(","), /room-analytics-log-retention/);
  assert.match(health.json.features.join(","), /admin-room-log-browser/);
  assert.match(health.json.features.join(","), /admin-room-log-export/);
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
  assert.match(health.json.features.join(","), /react-admin-console/);
  assert.match(health.json.features.join(","), /react-buyer-console/);
  assert.match(health.json.features.join(","), /room-status-snapshot/);
  assert.match(health.json.features.join(","), /archived-room-lifecycle/);
  assert.match(health.json.features.join(","), /buyer-restore-request/);
  assert.match(health.json.features.join(","), /admin-workflow-panels/);
  assert.match(health.json.features.join(","), /buyer-request-status-dashboard/);
  assert.match(health.json.features.join(","), /console-home-navigation/);
  assert.match(health.json.features.join(","), /admin-console-command-admin-tools/);
  assert.match(health.json.features.join(","), /admin-room-bulk-archive/);
  assert.match(health.json.features.join(","), /unified-buyer-guide/);
  assert.match(health.json.features.join(","), /bridge-room-profile-sync/);
  assert.match(health.json.features.join(","), /game-room-admin-sync/);
  assert.match(health.json.features.join(","), /android-notification-sender-fallback/);
  assert.equal(health.json.buyerConsoleUrl, "https://pixgom.com/console");
  assert.equal(health.json.buyerSetupUrl, "https://pixgom.com/console?view=setup");
  assert.equal(health.json.androidBuyerGuideUrl, "https://pixgom.com/console?from=android&view=setup");
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
  assert.match(health.json.features.join(","), /admin-management-command-pack-guard/);
  assert.match(health.json.features.join(","), /additive-command-pack-install/);
  assert.match(health.json.features.join(","), /command-pack-remove-command/);
  assert.match(health.json.features.join(","), /command-store-kakao-preview/);
  assert.match(health.json.features.join(","), /command-store-filter-refinement/);
  assert.match(health.json.features.join(","), /command-store-mode-ux/);
  assert.match(health.json.features.join(","), /new-buyer-journey-ux/);
  assert.match(health.json.features.join(","), /auth-session-gate/);
  assert.match(health.json.features.join(","), /silent-auth-transition/);
  assert.match(health.json.features.join(","), /room-report-workflow/);
  assert.match(health.json.features.join(","), /buyer-room-transfer/);
  assert.match(health.json.features.join(","), /command-store-action-cleanup/);
  assert.match(health.json.features.join(","), /command-pack-detail-help/);
  assert.match(health.json.features.join(","), /install-delete-code-ux/);
  assert.match(health.json.features.join(","), /game-pack-help-pages/);
  assert.match(health.json.features.join(","), /game-room-apply-ux/);
  assert.match(health.json.features.join(","), /compact-command-pack-actions/);
  assert.match(health.json.features.join(","), /help-command-list-style/);
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
  assert.match(health.json.features.join(","), /buyer-account-profile-edit/);
  assert.match(health.json.features.join(","), /application-inquiry-workflow/);
  assert.match(health.json.features.join(","), /buyer-room-groups/);
  assert.match(health.json.features.join(","), /buyer-room-mode-settings/);
  assert.match(health.json.features.join(","), /bridge-connect-linked-room-batch/);
  assert.match(health.json.features.join(","), /buyer-game-room-link/);
  assert.match(health.json.features.join(","), /bridge-connect-diagnostics/);
  assert.match(health.json.features.join(","), /admin-game-room-link/);
  assert.match(health.json.features.join(","), /admin-room-rename/);
  assert.match(health.json.features.join(","), /rpg-short-item-selector/);
  assert.match(health.json.features.join(","), /rpg-auto-equip-presets/);
  assert.match(health.json.features.join(","), /rpg-expanded-equipment-stats/);
  assert.match(health.json.features.join(","), /lunch-menu-recommendation/);
  assert.match(health.json.features.join(","), /command-response-emoji-ux/);
  assert.match(health.json.features.join(","), /inventory-sale-cleanup/);
  assert.match(health.json.features.join(","), /inventory-item-locks/);
  assert.match(health.json.features.join(","), /hidden-item-id-chat-results/);
  assert.match(health.json.features.join(","), /hidden-system-shop-ids/);
  assert.match(health.json.features.join(","), /command-discovery-hub/);
  assert.match(health.json.features.join(","), /starter-tutorial-command/);
  assert.match(health.json.features.join(","), /personalized-command-recommendations/);
  assert.match(health.json.features.join(","), /alias-preferred-display-names/);
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
  assert.match(homeText, /href="\/login">로그인<\/a>/);
  assert.match(homeText, /정보수정/);
  const homeNavText = homeText.match(/<nav class="nav-links"[\s\S]*?<\/nav>/)?.[0] || "";
  assert.doesNotMatch(homeNavText, /href="\/store"/);
  assert.match(homeNavText, /href="\/login">로그인<\/a>/);
  assert.match(homeText, /0\.5\.01/);
  assert.match(homeText, /구매자 콘솔 단계 안내/);
  assert.match(homeText, /승인 전\/승인 후\/앱 연결 완료/);
  assert.match(homeText, /0\.5\.00/);
  assert.match(homeText, /앱 연결 코드 표시 안정화/);
  assert.match(homeText, /결제 승인 요청 노출 개선/);
  assert.match(homeText, /0\.4\.82/);
  assert.match(homeText, /0\.4\.81/);
  assert.match(homeText, /0\.4\.70/);
  assert.match(homeText, /0\.4\.80/);
  assert.match(homeText, /0\.4\.79/);
  assert.match(homeText, /처음 시작은 5단계/);
  assert.match(homeText, /계정 만들기/);
  assert.match(homeText, /첫 명령어 설치/);
  assert.match(homeText, /하나의 브릿지로 일반방\+게임방 운영/);
  assert.match(homeText, /게임방 추가 신청/);
  assert.match(homeText, /일반방 연결코드 1번만 입력해도 연결된 게임방까지/);
  assert.match(homeText, /0\.4\.97/);
  assert.match(homeText, /방별 로그 조회/);

  for (const pagePath of ["/privacy", "/terms", "/updates", "/notice", "/store", "/guide", "/buyer-guide", "/login", "/signup", "/forgot-password", "/reset-password", "/apply", "/account", "/console", "/my-rooms", "/setup", "/license", "/status", "/command-store", "/help/pet", "/help/rpg", "/help/monster", "/help/attendance", "/help/ranking", "/help/games", "/help/shop"]) {
    const page = await fetch(`${baseUrl}${pagePath}`);
    assert.equal(page.status, 200);
    assert.match(page.headers.get("content-type") || "", /text\/html/);
  }

  const noticePageText = await (await fetch(`${baseUrl}/notice`)).text();
  assert.match(noticePageText, /장애 대응 기준/);
  const updatesPageText = await (await fetch(`${baseUrl}/updates`)).text();
  assert.match(updatesPageText, /픽셀곰 0\.5\.01/);
  assert.match(updatesPageText, /구매자 콘솔 단계 안내/);
  assert.match(updatesPageText, /승인 전\/승인 후\/앱 연결 완료/);
  assert.match(updatesPageText, /픽셀곰 0\.5\.00/);
  assert.match(updatesPageText, /앱 연결 코드 표시 안정화/);
  assert.match(updatesPageText, /결제 승인 요청 노출 개선/);
  assert.match(updatesPageText, /픽셀곰 0\.4\.97/);
  assert.match(updatesPageText, /픽셀곰 0\.4\.84/);
  assert.match(updatesPageText, /픽셀곰 0\.4\.92/);
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
  assert.match(applyPageText, /data-room-purpose/);
  assert.match(applyPageText, /일반 운영방/);
  assert.match(applyPageText, /게임방 추가/);
  assert.match(applyPageText, /data-linked-application-field/);
  assert.match(applyPageText, /loadBuyerRoomsForGameApply/);
  assert.match(applyPageText, /신청접수가 정상적으로 완료되었습니다/);
  assert.match(applyPageText, /data-apply-success/);
  assert.match(applyPageText, /data-application-inquiry-form/);
  assert.match(applyPageText, /결제요청 일시/);
  assert.match(applyPageText, /입금승인 후 앱 연결 코드가 발급됩니다/);
  assert.match(applyPageText, /결제 확인 요청은 관리자 콘솔의 결제 승인 요청에 함께 표시됩니다/);
  assert.match(applyPageText, /기준 일반방/);
  assert.match(applyPageText, /\/api\/application-inquiries/);
  const accountPageText = await (await fetch(`${baseUrl}/account`)).text();
  assert.match(accountPageText, /정보수정/);
  assert.match(accountPageText, /닉네임 수정/);
  assert.match(accountPageText, /data-account-profile-form/);
  assert.match(accountPageText, /\/api\/buyer\/account\/profile/);
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
  assert.match(commandStoreScriptText, /command-pack-command-list/);
  assert.match(commandStoreScriptText, /commandsDetailed/);
  assert.match(commandStoreScriptText, /도움말 보기/);
  assert.match(commandStoreScriptText, /command-pack-actions/);
  assert.match(commandStoreScriptText, /data-pack-action-kind="cart"/);
  assert.match(commandStoreScriptText, /"담기"/);
  assert.match(commandStoreScriptText, />복사<\/button>/);
  assert.match(commandStoreScriptText, />도움말<\/a>/);
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
  assert.equal(commandTemplates.json.version, "0.5.11");
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
  assert.equal(commandPacks.json.version, "0.5.11");
  const profileHistoryPack = commandPacks.json.packs.find((pack) => pack.id === "profile-history");
  assert.ok(profileHistoryPack);
  assert.ok(profileHistoryPack.fixedCommands.includes("/닉병합"));
  assert.equal(commandPacks.json.total, 13);
  assert.equal(commandPacks.json.packs.some((pack) => pack.id === "ops-core" && pack.fixedCommands.includes("/상태") && pack.fixedCommands.includes("/운세") && pack.fixedCommands.includes("/신고")), true);
  assert.equal(commandPacks.json.packs.some((pack) => pack.id === "ops-core" && pack.installCode === "pk.001" && pack.installCodeType === "pack"), true);
  assert.equal(commandPacks.json.packs.some((pack) => pack.id === "game-chance" && pack.fixedCommands.includes("/뽑기") && pack.fixedCommands.includes("/홀짝")), true);
  assert.equal(commandPacks.json.packs.some((pack) => pack.id === "admin-ops" && pack.fixedCommands.includes("/포인트차감") && pack.fixedCommands.includes("/상점추가") && pack.fixedCommands.includes("/명령어팩제거")), true);
  assert.equal(commandPacks.json.packs.some((pack) => pack.id === "rpg-adventure"
    && pack.fixedCommands.includes("/던전")
    && pack.fixedCommands.includes("/제작")
    && pack.fixedCommands.includes("/제작가능")
    && pack.fixedCommands.includes("/세트아이템")
    && pack.fixedCommands.includes("/자동장착")
    && pack.fixedCommands.includes("/아이템상세")
    && pack.fixedCommands.includes("/판매목록")
    && pack.fixedCommands.includes("/일괄판매")
    && pack.fixedCommands.includes("/판매미리보기")
    && pack.fixedCommands.includes("/가방정리")
    && pack.fixedCommands.includes("/아이템잠금")
    && pack.fixedCommands.includes("/장비상세")
    && pack.fixedCommands.includes("/스탯")), true);
  assert.equal(commandPacks.json.packs.some((pack) => pack.id === "shop-inventory"
    && pack.fixedCommands.includes("/판매미리보기")
    && pack.fixedCommands.includes("/가방정리")
    && pack.fixedCommands.includes("/아이템잠금해제")
    && pack.fixedCommands.includes("/잠금목록")), true);
  assert.equal(commandPacks.json.packs.some((pack) => pack.id === "event-engagement" && pack.fixedCommands.includes("/점메추")), true);
  assert.equal(commandPacks.json.packs.some((pack) => pack.id === "pixel-monster-rpg" && pack.fixedCommands.includes("/몬스터탐험") && pack.fixedCommands.includes("/포획")), true);
  assert.equal(commandPacks.json.packs.some((pack) => pack.id === "pet-raising" && pack.fixedCommands.includes("/펫입양") && pack.fixedCommands.includes("/펫훈련")), true);
  assert.equal(commandPacks.json.packs.some((pack) => pack.id === "all-in-one-ops" && pack.fixedCommands.includes("/관리자등록") && pack.fixedCommands.includes("/신고처리") && pack.fixedCommands.includes("/상점")), true);
  assert.equal(commandPacks.json.packs.some((pack) => pack.id === "basic-ops"), false);
  const petPack = commandPacks.json.packs.find((pack) => pack.id === "pet-raising");
  assert.equal(petPack.helpPath, "/help/pet");
  assert.equal(petPack.installCommand, "/명령어설치 pk.008");
  assert.equal(petPack.removeCommand, "/명령어팩제거 pk.008");
  assert.equal(petPack.commandsDetailed.some((item) => item.command === "/펫상점" && item.registered === true && /펫/.test(item.description)), true);
  assert.equal(commandPacks.json.packs.flatMap((pack) => pack.commandsDetailed || []).every((item) => item.registered === true), true);
  assert.equal(Array.isArray(commandPacks.json.current.installedPackDetails), true);

  const helpPetPageText = await (await fetch(`${baseUrl}/help/pet`)).text();
  assert.match(helpPetPageText, /펫키우기팩/);
  assert.match(helpPetPageText, /설치 방법/);
  assert.match(helpPetPageText, /기본 명령어/);
  assert.match(helpPetPageText, /설치 취소/);
  assert.match(helpPetPageText, /오류 발생 시 확인 항목/);
  const helpScriptText = await (await fetch(`${baseUrl}/game-pack-help.js`)).text();
  assert.match(helpScriptText, /help-command-list/);
  const stylesText = await (await fetch(`${baseUrl}/styles.css`)).text();
  assert.match(stylesText, /\.help-command-list/);
  assert.match(stylesText, /\.command-pack-actions/);
  assert.match(stylesText, /\.installed-pack-summary/);
  assert.match(stylesText, /\.command-pack-remove-note/);
  assert.doesNotMatch(stylesText, /\.post-card span\s*\{/);

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
  assert.match(consolePageText, /구매자 셀프 관리 콘솔/);
  assert.match(consolePageText, /data-console-app="buyer"/);
  assert.match(consolePageText, /\/console-ui\/assets\/buyer\.js/);
  assert.match(consolePageText, /게임방 접기\/펼치기/);
  assert.match(consolePageText, /문의\/이관\/복구 요청/);
  assert.match(consolePageText, /href="\/">홈으로<\/a>/);
  for (const aliasPath of ["/buyer-guide", "/setup", "/my-rooms", "/license"]) {
    const aliasText = await (await fetch(`${baseUrl}${aliasPath}`)).text();
    assert.match(aliasText, /data-console-app="buyer"/);
    assert.match(aliasText, /\/console-ui\/assets\/buyer\.js/);
    assert.doesNotMatch(aliasText, /data-buyer-form|data-console-login/);
  }
  const buyerReactSource = await readFile(path.join(repoRoot, "src", "console-app", "buyer.jsx"), "utf8");
  assert.match(buyerReactSource, /\/api\/buyer\/console/);
  assert.match(buyerReactSource, /홈으로/);
  assert.match(buyerReactSource, /consoleViewFromLocation/);
  assert.match(buyerReactSource, /BuyerStepOverview/);
  assert.match(buyerReactSource, /data-buyer-step-overview/);
  assert.match(buyerReactSource, /승인 전/);
  assert.match(buyerReactSource, /승인 후/);
  assert.match(buyerReactSource, /앱 연결 완료/);
  assert.match(buyerReactSource, /앱 연결 코드 복사/);
  assert.match(buyerReactSource, /앱 연결 상태/);
  assert.match(buyerReactSource, /AppConnectCodePanel/);
  assert.match(buyerReactSource, /data-app-connect-code/);
  assert.match(buyerReactSource, /id="app-connect-code"/);
  assert.match(buyerReactSource, /앱 연결 코드/);
  assert.match(buyerReactSource, /연결 코드 복사/);
  assert.match(buyerReactSource, /앱에서 붙여넣기/);
  assert.match(buyerReactSource, /copyTextToClipboard/);
  assert.match(buyerReactSource, /navigator\.clipboard/);
  assert.match(buyerReactSource, /서버와 다시 동기화/);
  assert.match(buyerReactSource, /\/console\?view=setup/);
  assert.match(buyerReactSource, /\/api\/buyer\/room-mode-settings/);
  assert.match(buyerReactSource, /\/api\/buyer\/restore-requests/);
  assert.match(buyerReactSource, /\/api\/application-inquiries/);
  assert.match(buyerReactSource, /구매자가 직접 수정 가능한 항목/);
  assert.match(buyerReactSource, /문의 등록/);
  assert.match(buyerReactSource, /내 신고 상태/);
  assert.match(buyerReactSource, /이관 요청 상태/);
  assert.match(buyerReactSource, /복구 요청 상태/);
  assert.match(buyerReactSource, /요청 접수됨/);

  const commandStorePageText = await (await fetch(`${baseUrl}/command-store`)).text();
  assert.match(commandStorePageText, /명령어 팩/);
  assert.match(commandStorePageText, /장착/);
  assert.match(commandStorePageText, /교체/);
  assert.match(commandStorePageText, /data-installed-pack-summary/);
  assert.match(commandStoreScriptText, /\/api\/command-packs/);
  assert.match(commandStoreScriptText, /\/api\/buyer\/command-packs\/apply/);
  assert.match(commandStoreScriptText, /renderInstalledPackSummary/);
  assert.match(commandStoreScriptText, /command-pack-remove-note/);

  const adminPage = await fetch(`${baseUrl}/admin`);
  assert.equal(adminPage.status, 200);
  const adminPageText = await adminPage.text();
  assert.match(adminPageText, /픽셀곰 운영자 어드민/);
  assert.match(adminPageText, /일반방 중심 통합 운영 콘솔/);
  assert.match(adminPageText, /신청\/결제/);
  assert.match(adminPageText, /종료 보관/);
  assert.match(adminPageText, /백업\/복구/);
  assert.match(adminPageText, /data-console-app="admin"/);
  assert.match(adminPageText, /\/console-ui\/assets\/admin\.js/);
  assert.match(adminPageText, /href="\/">홈으로<\/a>/);
  assert.match(adminPageText, /신고/);
  assert.match(adminPageText, /이관 내역/);
  const adminReactSource = await readFile(path.join(repoRoot, "src", "console-app", "admin.jsx"), "utf8");
  assert.match(adminReactSource, /\/api\/admin\/rooms/);
  assert.match(adminReactSource, /\/api\/admin\/archived-rooms/);
  assert.match(adminReactSource, /\/api\/admin\/restore-requests\?status=all/);
  assert.match(adminReactSource, /\/api\/admin\/restore-requests\/resolve/);
  assert.match(adminReactSource, /\/api\/admin\/reports\/resolve/);
  assert.match(adminReactSource, /\/api\/admin\/application-inquiries\/resolve/);
  assert.match(adminReactSource, /PaymentApprovalQueue/);
  assert.match(adminReactSource, /\/api\/admin\/applications\/approve/);
  assert.match(adminReactSource, /결제 승인 요청/);
  assert.match(adminReactSource, /입금승인/);
  assert.match(adminReactSource, /paymentReviewNeeded/);
  assert.match(adminReactSource, /paymentInquiriesByApplication/);
  assert.match(adminReactSource, /결제 확인 문의/);
  assert.match(adminReactSource, /paymentInquiry/);
  assert.match(adminReactSource, /\/api\/admin\/rooms\/archive/);
  assert.match(adminReactSource, /\/api\/admin\/rooms\/bulk-archive/);
  assert.match(adminReactSource, /\/api\/admin\/rooms\/force-archive/);
  assert.match(adminReactSource, /\/api\/admin\/rooms\/force-delete/);
  assert.match(adminReactSource, /\/api\/admin\/rooms\/restore/);
  assert.match(adminReactSource, /\/api\/admin\/rooms\/purge/);
  assert.match(adminReactSource, /\/api\/admin\/backup\/validate/);
  assert.match(adminReactSource, /\/api\/admin\/room-logs/);
  assert.match(adminReactSource, /커스텀 명령어 \/ 관리자/);
  assert.match(adminReactSource, /사과=맛있어/);
  assert.match(adminReactSource, /명령어 저장/);
  assert.match(adminReactSource, /관리자 등록/);
  assert.match(adminReactSource, /닉네임 병합 도구/);
  assert.match(adminReactSource, /병합 미리보기/);
  assert.match(adminReactSource, /\/api\/admin\/nickname-merge\/preview/);
  assert.match(adminReactSource, /\/api\/admin\/nickname-merge/);
  assert.match(adminReactSource, /\/api\/admin\/nickname-merges/);
  assert.match(adminReactSource, /\/api\/admin\/nickname-merge\/undo/);
  assert.match(adminReactSource, /병합 후보/);
  assert.match(adminReactSource, /병합 이력/);
  assert.match(adminReactSource, /되돌리기/);
  assert.match(adminReactSource, /CSV 다운로드/);
  assert.match(adminReactSource, /JSON 다운로드/);
  assert.match(adminReactSource, /신고 상태/);
  assert.match(adminReactSource, /문의 상태/);
  assert.match(adminReactSource, /이관 상태/);
  assert.match(adminReactSource, /방별 로그/);
  assert.match(adminReactSource, /로그 검색/);
  assert.match(adminReactSource, /명령어 필터/);
  assert.match(adminReactSource, /analyticsLogCount/);
  assert.match(adminReactSource, /완전 삭제 확인/);
  assert.match(adminReactSource, /복구 dry-run 검증/);
  assert.match(adminReactSource, /고객 0명 초기화/);
  assert.match(adminReactSource, /roomStatusSnapshot|snapshot/);
  assert.doesNotMatch(adminPageText, /ADMIN_CONSOLE_TOKEN/);
  const consoleStylesText = await readFile(path.join(repoRoot, "public", "styles.css"), "utf8");
  assert.match(consoleStylesText, /console-hero-actions/);
  assert.match(consoleStylesText, /console-compact-row/);
  assert.match(consoleStylesText, /console-two-column-form/);

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
  assert.match(sessionNavText, /href: "\/login", label: "로그인"/);
  assert.match(sessionNavText, /href = "\/account"/);

  const packageJson = JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf8"));
  assert.equal(packageJson.version, "0.5.11");
  const serverSourceText = await readFile(path.join(repoRoot, "server.js"), "utf8");
  assert.match(serverSourceText, /const LUNCH_MENU_ITEMS = Object\.freeze/);
  assert.match(serverSourceText, /COMMAND_RESPONSE_ICON_BY_CATEGORY/);
  assert.match(serverSourceText, /COMMAND_RESPONSE_ICON_EXEMPT_COMMANDS/);
  const registryCategoryMatches = [...serverSourceText.matchAll(/registryEntry\("\/[^"]+",\s*"([^"]+)"/g)].map((match) => match[1]);
  const iconCategoryMatches = [...serverSourceText.matchAll(/^\s*"([^"]+)":\s*"[^"]+"/gm)].map((match) => match[1]);
  for (const category of new Set(registryCategoryMatches)) {
    assert.ok(iconCategoryMatches.includes(category), `명령어 카테고리 이모지 누락: ${category}`);
  }
  const lunchMenuMatches = serverSourceText.match(/\{\s*name:\s*"[^"]+",\s*categories:\s*\[/g) || [];
  assert.ok(lunchMenuMatches.length >= 120, "점메추 메뉴는 120개 이상이어야 합니다.");
  for (const category of ["한식", "중식", "일식", "양식", "분식", "패스트푸드", "국밥", "면류", "도시락", "다이어트식", "매운 음식", "가벼운 음식", "든든한 음식", "배달 추천", "혼밥 추천"]) {
    assert.match(serverSourceText, new RegExp(category));
  }
  assert.equal(packageJson.scripts["build:console"], "vite build --config vite.console.config.mjs");
  assert.equal(packageJson.scripts["dev:console"], "vite --config vite.console.config.mjs");
  assert.equal(packageJson.scripts["check:deploy"], "npm run build:console && node scripts/predeploy-check.js");
  assert.equal(packageJson.scripts["smoke:local"], "node scripts/smoke-check.js");
  assert.equal(packageJson.scripts["smoke:prod"], "node scripts/smoke-check.js https://pixgom.com");
  assert.equal(packageJson.scripts["android:bundle"], "node scripts/android-release-bundle.js");
  assert.equal(packageJson.scripts["android:release-report"], "node scripts/android-release-bundle.js --report-only");
  const androidGradle = await readFile(path.join(repoRoot, "pixelgom-bridge-android", "app", "build.gradle"), "utf8");
  assert.match(androidGradle, /versionCode 29/);
  assert.match(androidGradle, /versionName "1\.0\.28"/);
  const androidEventSender = await readFile(path.join(repoRoot, "pixelgom-bridge-android", "app", "src", "main", "java", "com", "pixgom", "bridge", "EventSender.java"), "utf8");
  assert.match(androidEventSender, /optJSONArray\("rooms"\)/);
  assert.match(androidEventSender, /roomResults/);
  assert.match(androidEventSender, /roomRole/);
  assert.match(androidEventSender, /canonicalRoomName/);
  assert.match(androidEventSender, /roomProfileSync/);
  assert.match(androidEventSender, /\/api\/bridge\/room-profile-sync/);
  const androidMainActivity = await readFile(path.join(repoRoot, "pixelgom-bridge-android", "app", "src", "main", "java", "com", "pixgom", "bridge", "MainActivity.java"), "utf8");
  assert.match(androidMainActivity, /for \(EventSender\.RoomConnectResult room/);
  assert.match(androidMainActivity, /addOrUpdateRoomProfile/);
  assert.match(androidMainActivity, /연결된 게임방까지 자동 등록/);
  assert.match(androidMainActivity, /setLastConnectSummary/);
  assert.match(androidMainActivity, /서버와 다시 동기화/);
  assert.match(androidMainActivity, /syncRoomProfiles/);
  assert.match(androidMainActivity, /대표방\(일반방\)/);
  assert.match(androidMainActivity, /gameRoomProfilesView/);
  assert.match(androidMainActivity, /toggleGameRoomList/);
  assert.match(androidMainActivity, /게임방 목록 펼치기/);
  assert.match(androidMainActivity, /게임방 목록 접기/);
  assert.match(androidMainActivity, /BUYER_CONNECT_CODE_URL/);
  assert.match(androidMainActivity, /\/console\?from=android&view=setup/);
  assert.match(androidMainActivity, /#app-connect-code/);
  assert.match(androidMainActivity, /연결코드 찾기\/복사/);
  assert.match(androidMainActivity, /connectionCodeInput = input\("앱 연결코드"[\s\S]*연결코드 찾기\/복사[\s\S]*연결코드로 방 추가\/갱신/);
  assert.match(androidMainActivity, /서버 설정 초기화 \/ 등록 취소/);
  assert.match(androidMainActivity, /confirmResetServerSettings/);
  assert.match(androidMainActivity, /resetServerSettings/);
  assert.match(androidMainActivity, /BridgeConfig\.clearServerSettings/);
  assert.match(androidMainActivity, /구매자 계정과 서버 결제\/신청 데이터는 삭제되지 않습니다/);
  assert.doesNotMatch(androidMainActivity, /openUrl\(WEBSITE_URL \+ "\/buyer-guide"\)/);
  assert.doesNotMatch(androidMainActivity, /openUrl\(WEBSITE_URL \+ "\/admin"\)/);
  const androidBridgeConfig = await readFile(path.join(repoRoot, "pixelgom-bridge-android", "app", "src", "main", "java", "com", "pixgom", "bridge", "BridgeConfig.java"), "utf8");
  assert.match(androidBridgeConfig, /EMPTY_ROOM_PROFILES/);
  assert.match(androidBridgeConfig, /clearServerSettings/);
  assert.match(androidBridgeConfig, /putBoolean\(KEY_ENABLED, false\)/);
  assert.match(androidBridgeConfig, /remove\(KEY_DEVICE_LICENSE\)/);
  assert.match(androidBridgeConfig, /lastConnectSummary/);
  assert.match(androidBridgeConfig, /lastIgnoreReason/);
  assert.match(androidBridgeConfig, /lastProfileSyncSummary/);
  assert.match(androidBridgeConfig, /roomProfilesJson/);
  assert.match(androidBridgeConfig, /primaryGeneralRoomProfile/);
  assert.match(androidBridgeConfig, /generalRoomProfilesSummary/);
  assert.match(androidBridgeConfig, /gameRoomProfilesSummary/);
  assert.match(androidBridgeConfig, /gameRoomProfileCount/);
  assert.match(androidBridgeConfig, /대표방\(일반방\)/);
  assert.match(androidBridgeConfig, /등록된 방 없음/);
  assert.match(androidBridgeConfig, /\[게임방\]/);
  const androidBridgeEvent = await readFile(path.join(repoRoot, "pixelgom-bridge-android", "app", "src", "main", "java", "com", "pixgom", "bridge", "BridgeEvent.java"), "utf8");
  assert.match(androidBridgeEvent, /long postedAtMs/);
  const androidKakaoParser = await readFile(path.join(repoRoot, "pixelgom-bridge-android", "app", "src", "main", "java", "com", "pixgom", "bridge", "KakaoNotificationParser.java"), "utf8");
  assert.match(androidKakaoParser, /ParsedMessage lineParsed = parseSenderMessage\(lastTextLine\(extras\)\)/);
  assert.match(androidKakaoParser, /firstText\(lastMessageSender\(extras\), parsed\.sender, lineParsed\.sender\)/);
  assert.match(androidKakaoParser, /event\.postedAtMs = statusBarNotification\.getPostTime\(\)/);
  const androidNotificationListener = await readFile(path.join(repoRoot, "pixelgom-bridge-android", "app", "src", "main", "java", "com", "pixgom", "bridge", "PixelgomNotificationListener.java"), "utf8");
  assert.match(androidNotificationListener, /setLastIgnoreReason/);
  assert.match(androidNotificationListener, /등록방 아님 rawRoom/);
  assert.match(androidNotificationListener, /event\.senderId/);
  assert.match(androidNotificationListener, /event\.postedAtMs/);
  const androidChecklist = await readFile(path.join(repoRoot, "pixelgom-bridge-android", "PLAY_STORE_CHECKLIST.md"), "utf8");
  assert.match(androidChecklist, /비공개 테스트/);
  assert.match(androidChecklist, /1\.0\.22 \(23\)/);
  assert.match(androidChecklist, /1\.0\.23 \(24\)/);

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

  const adminUtilitySave = await request("/api/admin/rooms?token=test-admin-token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      originalRoomName: "콘솔방",
      room: "콘솔방",
      roomId: "consoleRoom1",
      roomLink: "https://open.kakao.com/o/consoleRoom1",
      roomAdmins: ["콘솔관리자", "부관리자"],
      licenseKey: adminRoom.json.room.licenseKey,
      subscriptionExpiresAt: "2099-12-31",
      features: adminRoom.json.room.features,
      customCommands: [
        ...adminRoom.json.room.customCommands,
        { trigger: "사과", response: "맛있어", updatedBy: "admin_console" }
      ]
    })
  });
  assert.equal(adminUtilitySave.response.status, 200);
  assert.equal(adminUtilitySave.json.room.customCommands.some((command) => command.trigger === "사과" && command.response === "맛있어"), true);
  assert.equal(adminUtilitySave.json.room.admins.includes("부관리자"), true);
  const quickCustomReply = await chatPayload({
    registeredRoom: false,
    room: "콘솔방",
    msg: "사과",
    sender: "콘솔사용자",
    roomId: "consoleRoom1",
    roomLink: "https://open.kakao.com/o/consoleRoom1",
    licenseKey: adminRoom.json.room.licenseKey
  });
  assert.equal(quickCustomReply.response.status, 200);
  assert.match(quickCustomReply.json.reply, /맛있어/);
  const adminUtilityDelete = await request("/api/admin/rooms?token=test-admin-token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      originalRoomName: "콘솔방",
      room: "콘솔방",
      roomId: "consoleRoom1",
      roomLink: "https://open.kakao.com/o/consoleRoom1",
      roomAdmins: ["콘솔관리자"],
      licenseKey: adminRoom.json.room.licenseKey,
      subscriptionExpiresAt: "2099-12-31",
      features: adminRoom.json.room.features,
      customCommands: adminUtilitySave.json.room.customCommands.filter((command) => command.trigger !== "사과")
    })
  });
  assert.equal(adminUtilityDelete.response.status, 200);
  assert.equal(adminUtilityDelete.json.room.customCommands.some((command) => command.trigger === "사과"), false);
  assert.equal(adminUtilityDelete.json.room.admins.includes("부관리자"), false);

  await chatPayload({
    registeredRoom: false,
    room: "콘솔방",
    msg: "일반방 닉 데이터",
    sender: "병합오리 95",
    roomId: "consoleRoom1",
    roomLink: "https://open.kakao.com/o/consoleRoom1",
    licenseKey: adminRoom.json.room.licenseKey
  });
  await chatPayload({
    registeredRoom: false,
    room: "콘솔방",
    msg: "게임방 닉 데이터",
    sender: "병합오리",
    roomId: "consoleRoom1",
    roomLink: "https://open.kakao.com/o/consoleRoom1",
    licenseKey: adminRoom.json.room.licenseKey
  });
  await chatPayload({
    registeredRoom: false,
    room: "콘솔방",
    msg: "/포인트지급 병합오리 95 100",
    sender: "콘솔관리자",
    roomId: "consoleRoom1",
    roomLink: "https://open.kakao.com/o/consoleRoom1",
    licenseKey: adminRoom.json.room.licenseKey
  });
  await chatPayload({
    registeredRoom: false,
    room: "콘솔방",
    msg: "/포인트지급 병합오리 200",
    sender: "콘솔관리자",
    roomId: "consoleRoom1",
    roomLink: "https://open.kakao.com/o/consoleRoom1",
    licenseKey: adminRoom.json.room.licenseKey
  });
  const nicknameMergePreviewUnauthorized = await request("/api/admin/nickname-merge/preview", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ roomName: "콘솔방", targetName: "병합오리 95", sourceName: "병합오리" })
  });
  assert.equal(nicknameMergePreviewUnauthorized.response.status, 401);
  const nicknameMergePreview = await request("/api/admin/nickname-merge/preview?token=test-admin-token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ roomName: "콘솔방", targetName: "병합오리 95", sourceName: "병합오리" })
  });
  assert.equal(nicknameMergePreview.response.status, 200);
  assert.equal(nicknameMergePreview.json.ok, true);
  assert.equal(nicknameMergePreview.json.preview.target.name, "병합오리 95");
  assert.equal(nicknameMergePreview.json.preview.source.name, "병합오리");
  assert.equal(nicknameMergePreview.json.preview.merged.points >= 304, true);
  assert.equal(nicknameMergePreview.json.preview.command, "/닉병합 병합오리 95 병합오리");
  const nicknameMergeCandidates = await request(`/api/admin/nickname-merges?token=test-admin-token&roomName=${encodeURIComponent("콘솔방")}`);
  assert.equal(nicknameMergeCandidates.response.status, 200);
  assert.equal(nicknameMergeCandidates.json.ok, true);
  assert.equal(nicknameMergeCandidates.json.candidates.some((candidate) => candidate.target.name === "병합오리 95" && candidate.source.name === "병합오리"), true);
  const nicknameMergeExecute = await request("/api/admin/nickname-merge?token=test-admin-token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ roomName: "콘솔방", targetName: "병합오리 95", sourceName: "병합오리" })
  });
  assert.equal(nicknameMergeExecute.response.status, 200);
  assert.equal(nicknameMergeExecute.json.ok, true);
  assert.equal(nicknameMergeExecute.json.result.merged, true);
  assert.match(nicknameMergeExecute.json.result.mergeId, /^nmg_/);
  assert.equal(nicknameMergeExecute.json.preview.target.name, "병합오리 95");
  const nicknameMergeHistory = await request(`/api/admin/nickname-merges?token=test-admin-token&roomName=${encodeURIComponent("콘솔방")}`);
  assert.equal(nicknameMergeHistory.response.status, 200);
  assert.equal(nicknameMergeHistory.json.history.some((item) => item.id === nicknameMergeExecute.json.result.mergeId && item.status === "active"), true);
  const nicknameMergedPoint = await chatPayload({
    registeredRoom: false,
    room: "콘솔방",
    msg: "/포인트",
    sender: "병합오리",
    roomId: "consoleRoom1",
    roomLink: "https://open.kakao.com/o/consoleRoom1",
    licenseKey: adminRoom.json.room.licenseKey
  });
  assert.match(nicknameMergedPoint.json.reply, /병합오리님의 포인트 :/);
  const nicknameMergeUndo = await request("/api/admin/nickname-merge/undo?token=test-admin-token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ roomName: "콘솔방", mergeId: nicknameMergeExecute.json.result.mergeId })
  });
  assert.equal(nicknameMergeUndo.response.status, 200);
  assert.equal(nicknameMergeUndo.json.ok, true);
  assert.equal(nicknameMergeUndo.json.merge.status, "undone");
  const nicknameMergeHistoryAfterUndo = await request(`/api/admin/nickname-merges?token=test-admin-token&roomName=${encodeURIComponent("콘솔방")}`);
  assert.equal(nicknameMergeHistoryAfterUndo.json.history.some((item) => item.id === nicknameMergeExecute.json.result.mergeId && item.status === "undone"), true);
  const nicknameSourcePointAfterUndo = await chatPayload({
    registeredRoom: false,
    room: "콘솔방",
    msg: "/포인트",
    sender: "병합오리",
    roomId: "consoleRoom1",
    roomLink: "https://open.kakao.com/o/consoleRoom1",
    licenseKey: adminRoom.json.room.licenseKey
  });
  assert.match(nicknameSourcePointAfterUndo.json.reply, /병합오리님의 포인트 :/);

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
  assert.ok(adminRooms.json.rooms.find((room) => room.name === "콘솔방")?.roomStatusSnapshot);
  assert.equal(adminRooms.json.rooms.find((room) => room.name === "콘솔방")?.roomStatusSnapshot.permissions.adminOnly.includes("license"), true);

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
  assert.equal(adminDelete.json.archivedRoom.roomName, "삭제테스트방");
  const adminRoomsAfterDelete = await request("/api/admin/rooms?token=test-admin-token");
  assert.doesNotMatch(JSON.stringify(adminRoomsAfterDelete.json.rooms), /삭제테스트방/);
  const adminArchivedRooms = await request("/api/admin/archived-rooms?token=test-admin-token");
  assert.equal(adminArchivedRooms.response.status, 200);
  assert.match(JSON.stringify(adminArchivedRooms.json.archivedRooms), /삭제테스트방/);
  assert.equal(adminArchivedRooms.json.archivedRooms[0].roomStatusSnapshot.lifecycle.status, "archived");
  const adminRestoreArchived = await request("/api/admin/rooms/restore?token=test-admin-token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ archiveId: adminDelete.json.archivedRoom.id })
  });
  assert.equal(adminRestoreArchived.response.status, 200);
  assert.equal(adminRestoreArchived.json.restoredRoom.name, "삭제테스트방");
  const adminArchiveAgain = await request("/api/admin/rooms/archive?token=test-admin-token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ room: "삭제테스트방", reason: "purge 회귀 테스트" })
  });
  assert.equal(adminArchiveAgain.response.status, 200);
  const purgeBlocked = await request("/api/admin/rooms/purge?token=test-admin-token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ archiveId: adminArchiveAgain.json.archivedRoom.id, confirmRoomName: "삭제테스트방" })
  });
  assert.equal(purgeBlocked.response.status, 400);
  assert.equal(purgeBlocked.json.error, "purge_confirmation_required");
  const purgeConfirmed = await request("/api/admin/rooms/purge?token=test-admin-token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ archiveId: adminArchiveAgain.json.archivedRoom.id, confirmRoomName: "삭제테스트방", confirmPermanentDelete: "PERMANENT_DELETE" })
  });
  assert.equal(purgeConfirmed.response.status, 200);
  assert.equal(purgeConfirmed.json.purgedRoom.roomName, "삭제테스트방");

  const adminDiagnostics = await request("/api/admin/diagnostics?token=test-admin-token");
  assert.equal(adminDiagnostics.response.status, 200);
  assert.equal(adminDiagnostics.json.version, "0.5.11");
  assert.ok(Number.isFinite(adminDiagnostics.json.summary.rooms));
  assert.ok(Number.isFinite(adminDiagnostics.json.summary.problemRooms));
  assert.ok(Number.isFinite(adminDiagnostics.json.summary.bridgeProblemRooms));
  assert.equal(adminDiagnostics.json.incidentMessages.SERVER_ERROR.code, "server_error");
  assert.match(JSON.stringify(adminDiagnostics.json.rooms), /콘솔방/);

  const adminBackup = await request("/api/admin/backup?token=test-admin-token");
  assert.equal(adminBackup.response.status, 200);
  assert.equal(adminBackup.json.ok, true);
  assert.equal(adminBackup.json.schemaVersion, 1);
  assert.equal(adminBackup.json.version, "0.5.11");
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
  assert.match(apply.json.payment.requestedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(apply.json.application.payment.requestedAt, apply.json.payment.requestedAt);
  assert.match(apply.json.inquiryAccessToken, /\./);

  const applicationInquiry = await request("/api/application-inquiries", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      applicationId: apply.json.application.id,
      inquiryAccessToken: apply.json.inquiryAccessToken,
      type: "deposit_check",
      message: "입금 확인 부탁드립니다."
    })
  });
  assert.equal(applicationInquiry.response.status, 200);
  assert.equal(applicationInquiry.json.inquiry.applicationId, apply.json.application.id);
  assert.equal(applicationInquiry.json.inquiry.type, "deposit_check");
  assert.equal(applicationInquiry.json.inquiry.status, "open");
  const reusedApplicationInquiry = await request("/api/application-inquiries", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      applicationId: apply.json.application.id,
      inquiryAccessToken: apply.json.inquiryAccessToken,
      type: "payment_check",
      message: "다시 확인 부탁드립니다."
    })
  });
  assert.equal(reusedApplicationInquiry.response.status, 409);
  assert.equal(reusedApplicationInquiry.json.error, "inquiry_token_used");

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
  assert.match(login.json.guideToken, /\./);

  const profileUpdate = await request("/api/buyer/account/profile", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      token: login.json.guideToken,
      nickname: "테스터수정"
    })
  });
  assert.equal(profileUpdate.response.status, 200);
  assert.equal(profileUpdate.json.account.nickname, "테스터수정");
  const invalidProfileUpdate = await request("/api/buyer/account/profile", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: login.json.guideToken, nickname: "가" })
  });
  assert.equal(invalidProfileUpdate.response.status, 400);
  assert.equal(invalidProfileUpdate.json.error, "nickname_invalid");
  const profileLogin = await request("/api/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: `tester-${process.pid}@pixgom.test`,
      password: "password123"
    })
  });
  assert.equal(profileLogin.json.account.nickname, "테스터수정");

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
  assert.equal(adminApplications.json.summary.paymentReviewNeeded >= 1, true);
  assert.equal(adminApplications.json.lifecycleSummary.pendingPayment >= 1, true);
  assert.equal(adminApplications.json.applications.some((application) => application.id === apply.json.application.id && application.payment.requestedAt === apply.json.payment.requestedAt), true);
  assert.equal(adminApplications.json.applications.some((application) => application.id === apply.json.application.id && application.inquirySummary.open === 1), true);
  assert.equal(adminApplications.json.applications.some((application) => application.id === apply.json.application.id && application.paymentReviewNeeded === true), true);
  assert.equal(adminApplications.json.applications.some((application) => application.id === apply.json.application.id && application.appConnectCodeStatus === "pending_approval"), true);
  const pendingLifecycle = adminApplications.json.applications.find((application) => application.id === apply.json.application.id).lifecycle;
  assert.equal(pendingLifecycle.status, "pending_payment");
  assert.equal(pendingLifecycle.available, false);
  assert.match(pendingLifecycle.actionRequired, /입금|승인/);
  const adminApplicationInquiries = await request("/api/admin/application-inquiries?token=test-admin-token");
  assert.equal(adminApplicationInquiries.response.status, 200);
  assert.equal(adminApplicationInquiries.json.inquiries.some((inquiry) => inquiry.applicationId === apply.json.application.id && inquiry.status === "open"), true);
  const resolvedApplicationInquiry = await request("/api/admin/application-inquiries/resolve", {
    method: "POST",
    headers: { "content-type": "application/json", "x-admin-token": "test-admin-token" },
    body: JSON.stringify({ inquiryId: applicationInquiry.json.inquiry.id, resolution: "입금 확인 대기 안내" })
  });
  assert.equal(resolvedApplicationInquiry.response.status, 200);
  assert.equal(resolvedApplicationInquiry.json.inquiry.status, "resolved");

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
  assert.equal(approvedApplication.json.application.lifecycle.status, "active");
  assert.equal(approvedApplication.json.application.lifecycle.available, true);
  assert.equal(approvedApplication.json.payment.status, "paid");
  assert.equal(approvedApplication.json.room.roomStatusSnapshot.lifecycle.status, "active");
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

  const foreignApplicationInquiry = await request("/api/application-inquiries", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      token: kakaoNoEmailToken,
      applicationId: apply.json.application.id,
      type: "other",
      message: "다른 계정 신청 문의 시도"
    })
  });
  assert.equal(foreignApplicationInquiry.response.status, 403);
  assert.equal(foreignApplicationInquiry.json.error, "application_forbidden");

  const buyerGuideApproved = await request("/api/buyer/guide", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: approvedLogin.json.guideToken })
  });
  assert.equal(buyerGuideApproved.response.status, 200);
  assert.equal(buyerGuideApproved.json.ok, true);
  assert.equal(buyerGuideApproved.json.version, "0.5.11");
  assert.equal(buyerGuideApproved.json.testAppUrl, "https://play.google.com/apps/internaltest/4700397680875890998");
  assert.match(JSON.stringify(buyerGuideApproved.json.rooms), /판매신청방/);
  assert.match(JSON.stringify(buyerGuideApproved.json.rooms), /^.*PXG-.*$/);
  assert.match(buyerGuideApproved.json.rooms[0].bridgeConnectCode, /\./);
  assert.match(JSON.stringify(buyerGuideApproved.json.sections), /알림 접근 권한/);
  assert.match(JSON.stringify(buyerGuideApproved.json.sections), /화면 감지\/접근성 권한을 사용하지 않습니다/);
  assert.equal(buyerGuideApproved.json.guideUrls.console, "/console");
  assert.equal(buyerGuideApproved.json.guideUrls.setup, "/console?view=setup");
  assert.deepEqual(
    buyerGuideApproved.json.rooms.map((room) => room.applicationId),
    buyerGuideApproved.json.console.rooms.map((room) => room.applicationId)
  );

  const buyerConsoleApproved = await request("/api/buyer/console", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: approvedLogin.json.guideToken })
  });
  assert.equal(buyerConsoleApproved.response.status, 200);
  assert.equal(buyerConsoleApproved.json.ok, true);
  assert.equal(buyerConsoleApproved.json.version, "0.5.11");
  assert.match(buyerConsoleApproved.json.ownerAdminNotice, /\/admin/);
  assert.equal(buyerConsoleApproved.json.rooms.length, 1);
  assert.equal(buyerConsoleApproved.json.appConnectCodes.length >= 1, true);
  assert.equal(buyerConsoleApproved.json.appConnectCodes.some((item) => item.applicationId === apply.json.application.id && /\./.test(item.bridgeConnectCode)), true);
  assert.equal(buyerConsoleApproved.json.applications.some((application) => application.id === apply.json.application.id && application.appConnectCodeStatus === "ready"), true);
  assert.equal(buyerConsoleApproved.json.plan.monthlyPriceKrw, 5500);
  assert.equal(buyerConsoleApproved.json.plan.additionalRoomPriceKrw, 2200);
  assert.equal(buyerConsoleApproved.json.commandStore.total, commandTemplates.json.total);
  assert.equal(buyerConsoleApproved.json.rooms[0].licenseStatus, "active");
  assert.equal(buyerConsoleApproved.json.rooms[0].subscriptionStatus, "active");
  assert.equal(buyerConsoleApproved.json.rooms[0].subscriptionStatusLabel, "정상");
  assert.match(buyerConsoleApproved.json.rooms[0].subscriptionNotice, /정상/);
  assert.equal(buyerConsoleApproved.json.rooms[0].bridgeStatus, "ready");
  assert.equal(buyerConsoleApproved.json.rooms[0].roomStatusSnapshot.lifecycle.status, "active");
  assert.equal(buyerConsoleApproved.json.rooms[0].roomStatusSnapshot.lifecycle.available, true);
  assert.equal(buyerConsoleApproved.json.lifecycleSummary.active >= 1, true);
  assert.equal(buyerConsoleApproved.json.lifecycleSummary.paymentReviewNeeded >= 1, true);
  assert.equal(buyerConsoleApproved.json.guideUrls.android, "/console?from=android&view=setup");
  assert.match(JSON.stringify(buyerConsoleApproved.json.guideSections), /구매자 콘솔/);
  assert.match(JSON.stringify(buyerConsoleApproved.json.guideSections), /앱 연결 코드 카드/);
  assert.equal(buyerConsoleApproved.json.rooms[0].roomStatusSnapshot.bridge.status, "ready");
  assert.deepEqual(buyerConsoleApproved.json.rooms[0].roomStatusSnapshot.permissions.buyerEditable.includes("modeSplit"), true);
  assert.equal(buyerConsoleApproved.json.rooms[0].commandCount, 0);
  assert.equal(buyerConsoleApproved.json.canApplyGameRoom, true);
  assert.equal(buyerConsoleApproved.json.rooms[0].canApplyGameRoom, true);
  assert.match(buyerConsoleApproved.json.rooms[0].gameRoomApplyUrl, /\/apply\?roomPurpose=game_room/);
  assert.match(buyerConsoleApproved.json.rooms[0].gameRoomApplyUrl, new RegExp(buyerConsoleApproved.json.rooms[0].applicationId));
  assert.deepEqual(buyerConsoleApproved.json.rooms[0].linkedGameRooms, []);

  const buyerConsoleInquiry = await request("/api/application-inquiries", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      token: approvedLogin.json.guideToken,
      applicationId: buyerConsoleApproved.json.rooms[0].applicationId,
      type: "payment_check",
      message: "구매자 콘솔 문의 회귀"
    })
  });
  assert.equal(buyerConsoleInquiry.response.status, 200);
  assert.equal(buyerConsoleInquiry.json.inquiry.status, "open");
  const adminInquiryReview = await request("/api/admin/application-inquiries/resolve?token=test-admin-token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ inquiryId: buyerConsoleInquiry.json.inquiry.id, status: "in_review", resolution: "관리자 확인중" })
  });
  assert.equal(adminInquiryReview.response.status, 200);
  assert.equal(adminInquiryReview.json.inquiry.status, "in_review");
  assert.equal(adminInquiryReview.json.inquiry.statusLabel, "확인중");
  const adminInReviewInquiries = await request("/api/admin/application-inquiries?token=test-admin-token&status=in_review");
  assert.equal(adminInReviewInquiries.response.status, 200);
  assert.equal(adminInReviewInquiries.json.inquiries.some((inquiry) => inquiry.id === buyerConsoleInquiry.json.inquiry.id), true);
  const buyerRoomReport = await chatPayload({
    room: "판매신청방",
    msg: "/신고 문제회원 구매자 콘솔 신고 상태 확인",
    sender: "구매자신고자",
    roomId: "salesRoom1",
    roomLink: "https://open.kakao.com/o/salesRoom1",
    licenseKey: approvedApplication.json.room.licenseKey
  });
  assert.equal(buyerRoomReport.response.status, 200);
  const buyerRoomReportId = buyerRoomReport.json.reply.match(/R\d{4}/)?.[0];
  assert.ok(buyerRoomReportId);
  const buyerConsoleWorkflow = await request("/api/buyer/console", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: approvedLogin.json.guideToken })
  });
  assert.equal(buyerConsoleWorkflow.json.inquiries.some((inquiry) => inquiry.id === buyerConsoleInquiry.json.inquiry.id && inquiry.status === "in_review"), true);
  assert.equal(buyerConsoleWorkflow.json.reports.some((report) => report.id === buyerRoomReportId && report.roomName === "판매신청방"), true);
  assert.equal(buyerConsoleWorkflow.json.transfers.length >= 0, true);

  const buyerRoomArchive = await request("/api/admin/rooms/archive?token=test-admin-token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ room: "판매신청방", reason: "구매자 복구 요청 회귀" })
  });
  assert.equal(buyerRoomArchive.response.status, 200);
  assert.equal(buyerRoomArchive.json.archivedRoom.roomName, "판매신청방");
  const buyerConsoleArchived = await request("/api/buyer/console", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: approvedLogin.json.guideToken })
  });
  assert.equal(buyerConsoleArchived.response.status, 200);
  assert.equal(buyerConsoleArchived.json.archivedRooms.some((archive) => archive.id === buyerRoomArchive.json.archivedRoom.id), true);
  const buyerRestoreRequest = await request("/api/buyer/restore-requests", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: approvedLogin.json.guideToken, archiveId: buyerRoomArchive.json.archivedRoom.id, reason: "실수로 종료된 방 복구 요청" })
  });
  assert.equal(buyerRestoreRequest.response.status, 200);
  assert.equal(buyerRestoreRequest.json.request.status, "open");
  assert.equal(buyerRestoreRequest.json.request.archivedRoomExists, true);
  const duplicateRestoreRequest = await request("/api/buyer/restore-requests", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: approvedLogin.json.guideToken, archiveId: buyerRoomArchive.json.archivedRoom.id, reason: "중복 복구 요청" })
  });
  assert.equal(duplicateRestoreRequest.response.status, 200);
  assert.equal(duplicateRestoreRequest.json.duplicate, true);
  assert.equal(duplicateRestoreRequest.json.restoreRequests.filter((request) => request.archiveId === buyerRoomArchive.json.archivedRoom.id && request.status !== "resolved").length, 1);
  const adminRestoreRequests = await request("/api/admin/restore-requests?token=test-admin-token&status=all");
  assert.equal(adminRestoreRequests.response.status, 200);
  assert.equal(adminRestoreRequests.json.requests.some((request) => request.id === buyerRestoreRequest.json.request.id), true);
  const reviewRestoreRequest = await request("/api/admin/restore-requests/resolve?token=test-admin-token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ requestId: buyerRestoreRequest.json.request.id, status: "in_review", resolution: "확인중" })
  });
  assert.equal(reviewRestoreRequest.response.status, 200);
  assert.equal(reviewRestoreRequest.json.request.status, "in_review");
  const restoreBuyerRoom = await request("/api/admin/rooms/restore?token=test-admin-token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ archiveId: buyerRoomArchive.json.archivedRoom.id, restoreRequestId: buyerRestoreRequest.json.request.id, resolution: "복구 요청 승인" })
  });
  assert.equal(restoreBuyerRoom.response.status, 200);
  assert.equal(restoreBuyerRoom.json.restoredRoom.name, "판매신청방");
  const adminRestoreRequestsAfter = await request("/api/admin/restore-requests?token=test-admin-token&status=all");
  assert.equal(adminRestoreRequestsAfter.json.requests.find((request) => request.id === buyerRestoreRequest.json.request.id).status, "resolved");
  const buyerConsoleRestored = await request("/api/buyer/console", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: approvedLogin.json.guideToken })
  });
  assert.equal(buyerConsoleRestored.json.rooms.some((room) => room.roomName === "판매신청방"), true);
  assert.equal(buyerConsoleRestored.json.archivedRooms.some((archive) => archive.id === buyerRoomArchive.json.archivedRoom.id), false);

  const adminModeSplitSave = await request("/api/admin/rooms?token=test-admin-token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      originalRoomName: "판매신청방",
      room: "판매신청방",
      roomId: "salesRoom1",
      roomLink: "https://open.kakao.com/o/salesRoom1",
      roomAdmins: ["신청관리자"],
      licenseKey: approvedApplication.json.room.licenseKey,
      subscriptionExpiresAt: "2099-12-31",
      modeSplit: {
        blockGamesInGeneralRoom: false,
        blockOpsInGameRoom: true,
        sharePointsAndInventory: true
      }
    })
  });
  assert.equal(adminModeSplitSave.response.status, 200);
  assert.equal(adminModeSplitSave.json.room.roomStatusSnapshot.settings.modeSplit.blockGamesInGeneralRoom, false);
  assert.equal(adminModeSplitSave.json.room.roomStatusSnapshot.settings.modeSplit.gameRoomOpsBlocked, true);
  assert.match(adminModeSplitSave.json.room.roomStatusSnapshot.settings.lastSavedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(adminModeSplitSave.json.room.roomStatusSnapshot.settings.history.some((item) => item.type === "admin_console_room_saved"), true);

  const buyerConsoleAfterAdminModeSave = await request("/api/buyer/console", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: approvedLogin.json.guideToken })
  });
  assert.equal(
    buyerConsoleAfterAdminModeSave.json.rooms[0].roomStatusSnapshot.settings.modeSplit.blockGamesInGeneralRoom,
    adminModeSplitSave.json.room.roomStatusSnapshot.settings.modeSplit.blockGamesInGeneralRoom
  );
  const bridgeAfterAdminModeSave = await request("/api/bridge/connect", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code: buyerConsoleApproved.json.rooms[0].bridgeConnectCode })
  });
  assert.equal(bridgeAfterAdminModeSave.response.status, 200);
  assert.equal(
    bridgeAfterAdminModeSave.json.room.roomStatusSnapshot.settings.modeSplit.blockGamesInGeneralRoom,
    adminModeSplitSave.json.room.roomStatusSnapshot.settings.modeSplit.blockGamesInGeneralRoom
  );

  const buyerForbiddenModeSave = await request("/api/buyer/room-mode-settings", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      token: approvedLogin.json.guideToken,
      applicationId: buyerConsoleApproved.json.rooms[0].applicationId,
      licenseKey: "PXG-HACK-0000",
      blockGamesInGeneralRoom: true
    })
  });
  assert.equal(buyerForbiddenModeSave.response.status, 403);
  assert.equal(buyerForbiddenModeSave.json.error, "buyer_field_not_allowed");

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

  const packPointGrant = await chatPayload({
    registeredRoom: false,
    room: "판매신청방",
    msg: "/포인트지급 팩사용자 여 100",
    sender: "신청관리자",
    roomId: "salesRoom1",
    roomLink: "https://open.kakao.com/o/salesRoom1",
    licenseKey: approvedApplication.json.room.licenseKey
  });
  assert.match(packPointGrant.json.reply, /포인트 지급 완료/);

  const packPointDebit = await chatPayload({
    registeredRoom: false,
    room: "판매신청방",
    msg: "/포인트차감 팩사용자 여 10",
    sender: "신청관리자",
    roomId: "salesRoom1",
    roomLink: "https://open.kakao.com/o/salesRoom1",
    licenseKey: approvedApplication.json.room.licenseKey
  });
  assert.match(packPointDebit.json.reply, /포인트 차감 완료/);

  const packPointDebitDenied = await chatPayload({
    registeredRoom: false,
    room: "판매신청방",
    msg: "/포인트차감 팩사용자 여 10",
    sender: "구매자",
    roomId: "salesRoom1",
    roomLink: "https://open.kakao.com/o/salesRoom1",
    licenseKey: approvedApplication.json.room.licenseKey
  });
  assert.match(packPointDebitDenied.json.reply, /관리자 전용/);

  const packShopAdd = await chatPayload({
    registeredRoom: false,
    room: "판매신청방",
    msg: "/상점추가 팩물약 50 팩 테스트",
    sender: "신청관리자",
    roomId: "salesRoom1",
    roomLink: "https://open.kakao.com/o/salesRoom1",
    licenseKey: approvedApplication.json.room.licenseKey
  });
  assert.match(packShopAdd.json.reply, /상점 상품이 추가/);

  const packItemGrant = await chatPayload({
    registeredRoom: false,
    room: "판매신청방",
    msg: "/아이템지급 팩사용자 여 1 1",
    sender: "신청관리자",
    roomId: "salesRoom1",
    roomLink: "https://open.kakao.com/o/salesRoom1",
    licenseKey: approvedApplication.json.room.licenseKey
  });
  assert.match(packItemGrant.json.reply, /아이템지급 완료/);

  const packShopDelete = await chatPayload({
    registeredRoom: false,
    room: "판매신청방",
    msg: "/상점삭제 1",
    sender: "신청관리자",
    roomId: "salesRoom1",
    roomLink: "https://open.kakao.com/o/salesRoom1",
    licenseKey: approvedApplication.json.room.licenseKey
  });
  assert.match(packShopDelete.json.reply, /상점에서 숨겼습니다/);

  const packList = await chatPayload({
    registeredRoom: false,
    room: "판매신청방",
    msg: "/명령어팩목록",
    sender: "신청관리자",
    roomId: "salesRoom1",
    roomLink: "https://open.kakao.com/o/salesRoom1",
    licenseKey: approvedApplication.json.room.licenseKey
  });
  assert.match(packList.json.reply, /장착된 명령어 팩/);
  assert.match(packList.json.reply, /pk\.001 운영 기본팩/);

  const packListDetailed = await chatPayload({
    registeredRoom: false,
    room: "판매신청방",
    msg: "/명령어팩목록 자세히",
    sender: "신청관리자",
    roomId: "salesRoom1",
    roomLink: "https://open.kakao.com/o/salesRoom1",
    licenseKey: approvedApplication.json.room.licenseKey
  });
  assert.match(packListDetailed.json.reply, /장착된 명령어 팩 상세/);
  assert.match(packListDetailed.json.reply, /pk\.001 운영 기본팩/);
  assert.match(packListDetailed.json.reply, /포함 명령어/);
  assert.match(packListDetailed.json.reply, /\/상태/);

  const commandPackCatalogReply = await chatPayload({
    registeredRoom: false,
    room: "판매신청방",
    msg: "/명령어팩",
    sender: "신청관리자",
    roomId: "salesRoom1",
    roomLink: "https://open.kakao.com/o/salesRoom1",
    licenseKey: approvedApplication.json.room.licenseKey
  });
  assert.match(commandPackCatalogReply.json.reply, /사용 가능한 명령어팩/);
  assert.match(commandPackCatalogReply.json.reply, /pk\.001 운영 기본팩/);
  assert.match(commandPackCatalogReply.json.reply, /pk\.008 펫키우기팩/);

  const commandPackDetailReply = await chatPayload({
    registeredRoom: false,
    room: "판매신청방",
    msg: "/명령어팩 pk.001",
    sender: "신청관리자",
    roomId: "salesRoom1",
    roomLink: "https://open.kakao.com/o/salesRoom1",
    licenseKey: approvedApplication.json.room.licenseKey
  });
  assert.match(commandPackDetailReply.json.reply, /운영 기본팩/);
  assert.match(commandPackDetailReply.json.reply, /포함 명령어/);
  assert.match(commandPackDetailReply.json.reply, /\/상태/);
  assert.match(commandPackDetailReply.json.reply, /\/명령어설치 pk\.001/);

  const commandPackPetAliasReply = await chatPayload({
    registeredRoom: false,
    room: "판매신청방",
    msg: "/명령어팩 pk.pet",
    sender: "신청관리자",
    roomId: "salesRoom1",
    roomLink: "https://open.kakao.com/o/salesRoom1",
    licenseKey: approvedApplication.json.room.licenseKey
  });
  assert.match(commandPackPetAliasReply.json.reply, /펫키우기팩/);
  assert.match(commandPackPetAliasReply.json.reply, /\/펫상점/);
  assert.match(commandPackPetAliasReply.json.reply, /\/help\/pet/);

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

  const mergePackApply = await request("/api/buyer/command-packs/apply", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      token: approvedLogin.json.guideToken,
      applicationId: buyerConsoleApproved.json.rooms[0].applicationId,
      installedPackIds: ["game-chance"]
    })
  });
  assert.equal(mergePackApply.response.status, 200);
  assert.equal(mergePackApply.json.current.installedPackIds.includes("ops-core"), true);
  assert.equal(mergePackApply.json.current.installedPackIds.includes("all-in-one-ops"), true);
  assert.equal(mergePackApply.json.current.installedPackIds.includes("game-chance"), true);

  const chatPackRemove = await chatPayload({
    registeredRoom: false,
    room: "판매신청방",
    msg: "/명령어팩제거 pk.004",
    sender: "신청관리자",
    roomId: "salesRoom1",
    roomLink: "https://open.kakao.com/o/salesRoom1",
    licenseKey: approvedApplication.json.room.licenseKey
  });
  assert.match(chatPackRemove.json.reply, /명령어팩 제거 완료/);
  assert.match(chatPackRemove.json.reply, /게임 확률팩/);
  assert.match(chatPackRemove.json.reply, /보존/);
  assert.match(chatPackRemove.json.reply, /다른 팩 또는 직접 추가 명령어와 겹치면 유지/);

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
  assert.equal(roomPackState.json.current.installedPackDetails.some((pack) => pack.id === "ops-core" && pack.commandsDetailed.some((item) => item.command === "/상태")), true);
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
      q: "공지초안"
    })
  });
  assert.equal(buyerComingSoonSearch.response.status, 200);
  assert.equal(buyerComingSoonSearch.json.items.some((item) => item.status === "coming_soon" && item.available === false), true);

  const pendingBaseGameRoomApply = await request("/api/apply", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      token: kakaoNoEmailToken,
      roomPurpose: "game_room",
      linkedApplicationId: kakaoContactApply.json.application.id,
      roomName: "미승인게임방",
      roomLink: "https://open.kakao.com/o/pendingGame1",
      adminName: "카카오관리자",
      contact: "openchat-contact"
    })
  });
  assert.equal(pendingBaseGameRoomApply.response.status, 403);
  assert.equal(pendingBaseGameRoomApply.json.error, "linked_room_approval_required");

  const gameRoomApply = await request("/api/apply", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      token: approvedLogin.json.guideToken,
      roomPurpose: "game_room",
      linkedApplicationId: buyerConsoleApproved.json.rooms[0].applicationId,
      roomName: "판매게임방",
      roomLink: "https://open.kakao.com/o/salesGame1",
      adminName: "신청관리자",
      contact: "game-contact"
    })
  });
  assert.equal(gameRoomApply.response.status, 200);
  assert.equal(gameRoomApply.json.application.plan.type, "game_room");
  assert.equal(gameRoomApply.json.application.roomPurpose, "game_room");
  assert.equal(gameRoomApply.json.application.linkedApplicationId, buyerConsoleApproved.json.rooms[0].applicationId);
  assert.equal(gameRoomApply.json.application.mainRoom.roomName, "판매신청방");
  assert.equal(gameRoomApply.json.application.linkedApplication.roomName, "판매신청방");
  assert.equal(gameRoomApply.json.payment.amountKrw, 2200);
  assert.match(gameRoomApply.json.payment.requestedAt, /^\d{4}-\d{2}-\d{2}T/);
  const adminApplicationsWithGameRoom = await request("/api/admin/applications?token=test-admin-token");
  assert.equal(adminApplicationsWithGameRoom.json.applications.some((application) => (
    application.id === gameRoomApply.json.application.id
    && application.mainRoom.roomName === "판매신청방"
    && application.payment.requestedAt === gameRoomApply.json.payment.requestedAt
  )), true);

  const duplicateGameRoomApply = await request("/api/apply", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      token: approvedLogin.json.guideToken,
      roomPurpose: "game_room",
      linkedApplicationId: buyerConsoleApproved.json.rooms[0].applicationId,
      roomName: "판매게임방2",
      roomLink: "https://open.kakao.com/o/salesGame2",
      adminName: "신청관리자",
      contact: "game-contact"
    })
  });
  assert.equal(duplicateGameRoomApply.response.status, 409);
  assert.equal(duplicateGameRoomApply.json.error, "game_room_already_exists");

  const approvedGameRoom = await request("/api/admin/applications/approve", {
    method: "POST",
    headers: { "content-type": "application/json", "x-admin-token": "test-admin-token" },
    body: JSON.stringify({ applicationId: gameRoomApply.json.application.id, months: 1 })
  });
  assert.equal(approvedGameRoom.response.status, 200);
  assert.equal(approvedGameRoom.json.room.roomRole, "game");
  assert.equal(approvedGameRoom.json.room.canonicalRoomName, "판매신청방");
  const stateAfterGameRoomApproval = await readTestState();
  const stateGeneralRoom = Object.values(stateAfterGameRoomApproval.rooms).find((room) => room.name === "판매신청방");
  const stateGameRoom = Object.values(stateAfterGameRoomApproval.rooms).find((room) => room.name === "판매게임방");
  assert.equal(stateGeneralRoom.settings.roomRole, "general");
  assert.equal(stateGameRoom.settings.roomRole, "game");
  assert.equal(stateGameRoom.settings.canonicalRoomKey, "판매신청방");
  assert.equal(stateGeneralRoom.settings.linkedGameRoomKeys.includes("판매게임방"), true);

  const secondGroupAdminRegister = await chatPayload({
    registeredRoom: false,
    room: "판매신청방",
    msg: "/관리자등록 부관리자",
    sender: "신청관리자",
    roomId: "salesRoom1",
    roomLink: "https://open.kakao.com/o/salesRoom1",
    licenseKey: approvedApplication.json.room.licenseKey
  });
  assert.match(secondGroupAdminRegister.json.reply, /부관리자님이 관리자로 등록되었습니다/);

  const buyerConsoleWithGameRoom = await request("/api/buyer/console", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: approvedLogin.json.guideToken })
  });
  assert.equal(buyerConsoleWithGameRoom.response.status, 200);
  assert.equal(buyerConsoleWithGameRoom.json.canApplyGameRoom, false);
  const consoleGeneralRoom = buyerConsoleWithGameRoom.json.rooms.find((room) => room.applicationId === buyerConsoleApproved.json.rooms[0].applicationId);
  const consoleGameRoom = buyerConsoleWithGameRoom.json.rooms.find((room) => room.applicationId === gameRoomApply.json.application.id);
  assert.equal(consoleGeneralRoom.canApplyGameRoom, false);
  assert.equal(consoleGeneralRoom.linkedGameRooms.some((room) => room.applicationId === gameRoomApply.json.application.id && room.roomName === "판매게임방"), true);
  assert.equal(consoleGameRoom.roomPurpose, "game_room");
  assert.equal(consoleGameRoom.canApplyGameRoom, false);
  assert.equal(consoleGameRoom.linkedApplicationId, buyerConsoleApproved.json.rooms[0].applicationId);
  assert.deepEqual(consoleGeneralRoom.roomAdmins.map((name) => name).sort(), ["부관리자", "신청관리자"].sort());
  assert.deepEqual(consoleGameRoom.roomAdmins.map((name) => name).sort(), ["부관리자", "신청관리자"].sort());
  assert.equal(Array.isArray(buyerConsoleWithGameRoom.json.roomGroups), true);
  const consoleRoomGroup = buyerConsoleWithGameRoom.json.roomGroups.find((group) => group.baseRoom.applicationId === buyerConsoleApproved.json.rooms[0].applicationId);
  assert.equal(consoleRoomGroup.baseRoom.roomName, "판매신청방");
  assert.equal(consoleRoomGroup.gameRooms.some((room) => room.applicationId === gameRoomApply.json.application.id), true);
  assert.deepEqual(consoleRoomGroup.gameRooms[0].roomAdmins.map((name) => name).sort(), ["부관리자", "신청관리자"].sort());
  assert.equal(consoleRoomGroup.roomModeSettings.generalRoomGameBlocked, true);
  assert.equal(consoleRoomGroup.roomModeSettings.gameRoomOpsBlocked, true);
  assert.equal(consoleRoomGroup.roomModeSettings.blockGamesInGeneralRoom, true);
  assert.equal(consoleRoomGroup.roomModeSettings.blockOpsInGameRoom, true);

  const bridgeConnectBaseWithGame = await request("/api/bridge/connect", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code: consoleGeneralRoom.bridgeConnectCode })
  });
  assert.equal(bridgeConnectBaseWithGame.response.status, 200);
  assert.equal(bridgeConnectBaseWithGame.json.room.roomName, "판매신청방");
  assert.equal(Array.isArray(bridgeConnectBaseWithGame.json.rooms), true);
  assert.deepEqual(
    bridgeConnectBaseWithGame.json.rooms.map((room) => room.roomName).sort(),
    ["판매게임방", "판매신청방"].sort()
  );
  assert.equal(bridgeConnectBaseWithGame.json.rooms.find((room) => room.roomName === "판매게임방").roomRole, "game");
  assert.equal(bridgeConnectBaseWithGame.json.rooms.find((room) => room.roomName === "판매게임방").canonicalRoomName, "판매신청방");
  assert.deepEqual(bridgeConnectBaseWithGame.json.rooms.find((room) => room.roomName === "판매게임방").roomAdmins.map((name) => name).sort(), ["부관리자", "신청관리자"].sort());
  assert.equal(bridgeConnectBaseWithGame.json.bridgeDiagnostics.responseRoomCount, 2);
  assert.equal(bridgeConnectBaseWithGame.json.bridgeDiagnostics.linkedGameRoomCount, 1);
  assert.equal(bridgeConnectBaseWithGame.json.bridgeDiagnostics.issues.includes("game_room_not_linked"), false);

  const bridgeConnectGameWithBase = await request("/api/bridge/connect", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code: consoleGameRoom.bridgeConnectCode })
  });
  assert.equal(bridgeConnectGameWithBase.response.status, 200);
  assert.deepEqual(
    bridgeConnectGameWithBase.json.rooms.map((room) => room.roomName).sort(),
    ["판매게임방", "판매신청방"].sort()
  );
  assert.equal(bridgeConnectGameWithBase.json.bridgeDiagnostics.responseRoomCount, 2);
  assert.equal(bridgeConnectGameWithBase.json.bridgeDiagnostics.requestedRoomRole, "game");

  const invalidProfileSync = await request("/api/bridge/room-profile-sync", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      rooms: [{ roomName: "판매신청방", roomId: "salesRoom1", licenseKey: "wrong-license" }]
    })
  });
  assert.equal(invalidProfileSync.response.status, 403);
  assert.equal(invalidProfileSync.json.error, "valid_room_profile_required");

  const validProfileSync = await request("/api/bridge/room-profile-sync", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      rooms: [
        {
          roomName: consoleGeneralRoom.roomName,
          roomId: consoleGeneralRoom.roomId,
          licenseKey: consoleGeneralRoom.licenseKey
        }
      ]
    })
  });
  assert.equal(validProfileSync.response.status, 200);
  assert.equal(validProfileSync.json.ok, true);
  assert.equal(validProfileSync.json.version, "0.5.11");
  assert.equal(validProfileSync.json.summary.requestedRoomCount, 1);
  assert.equal(validProfileSync.json.summary.syncedRoomCount, 2);
  assert.deepEqual(
    validProfileSync.json.rooms.map((room) => room.roomName).sort(),
    ["판매게임방", "판매신청방"].sort()
  );
  assert.equal(validProfileSync.json.guideUrls.android, "/console?from=android&view=setup");

  const generalRoomGameBlocked = await chatPayload({
    registeredRoom: false,
    room: "판매신청방",
    msg: "/던전",
    sender: "게임참여자",
    roomId: "salesRoom1",
    roomLink: "https://open.kakao.com/o/salesRoom1",
    licenseKey: approvedApplication.json.room.licenseKey
  });
  assert.match(generalRoomGameBlocked.json.reply, /일반방에서는 게임 실행 명령어를 사용할 수 없습니다/);

  const gameRoomDice = await chatPayload({
    registeredRoom: false,
    room: "판매게임방",
    msg: "/주사위",
    sender: "게임참여자",
    roomId: "salesGame1",
    roomLink: "https://open.kakao.com/o/salesGame1",
    licenseKey: approvedGameRoom.json.room.licenseKey
  });
  assert.match(gameRoomDice.json.reply, /주사위 게임/);

  const generalRoomPointAfterGame = await chatPayload({
    registeredRoom: false,
    room: "판매신청방",
    msg: "/포인트",
    sender: "게임참여자",
    roomId: "salesRoom1",
    roomLink: "https://open.kakao.com/o/salesRoom1",
    licenseKey: approvedApplication.json.room.licenseKey
  });
  assert.match(generalRoomPointAfterGame.json.reply, /게임참여자님의 포인트 : 🅟/);

  const gameRoomBag = await chatPayload({
    registeredRoom: false,
    room: "판매게임방",
    msg: "/가방",
    sender: "게임참여자",
    roomId: "salesGame1",
    roomLink: "https://open.kakao.com/o/salesGame1",
    licenseKey: approvedGameRoom.json.room.licenseKey
  });
  assert.match(gameRoomBag.json.reply, /게임참여자님의 가방/);

  const generalNoticeRegister = await chatPayload({
    registeredRoom: false,
    room: "판매신청방",
    msg: "/명령어등록 /게임방공지 일반방 공지입니다.",
    sender: "신청관리자",
    roomId: "salesRoom1",
    roomLink: "https://open.kakao.com/o/salesRoom1",
    licenseKey: approvedApplication.json.room.licenseKey
  });
  assert.match(generalNoticeRegister.json.reply, /커스텀 명령어가 저장되었습니다/);

  const gameRoomOpsBlocked = await chatPayload({
    registeredRoom: false,
    room: "판매게임방",
    msg: "/게임방공지",
    sender: "게임참여자",
    roomId: "salesGame1",
    roomLink: "https://open.kakao.com/o/salesGame1",
    licenseKey: approvedGameRoom.json.room.licenseKey
  });
  assert.match(gameRoomOpsBlocked.json.reply, /게임방에서는 게임 명령어만 사용할 수 있습니다/);

  const roomModeDisabled = await request("/api/buyer/room-mode-settings", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      token: approvedLogin.json.guideToken,
      applicationId: buyerConsoleApproved.json.rooms[0].applicationId,
      generalRoomGameBlocked: false,
      gameRoomOpsBlocked: false
    })
  });
  assert.equal(roomModeDisabled.response.status, 200);
  const disabledGroup = roomModeDisabled.json.roomGroups.find((group) => group.baseRoom.applicationId === buyerConsoleApproved.json.rooms[0].applicationId);
  assert.equal(disabledGroup.roomModeSettings.generalRoomGameBlocked, false);
  assert.equal(disabledGroup.roomModeSettings.gameRoomOpsBlocked, false);
  assert.equal(disabledGroup.roomModeSettings.blockGamesInGeneralRoom, false);
  assert.equal(disabledGroup.roomModeSettings.blockOpsInGameRoom, false);
  assert.equal(roomModeDisabled.json.savedSettings.modeSplit.blockGamesInGeneralRoom, false);
  assert.match(roomModeDisabled.json.savedSettings.roomStatusSnapshot.settings.lastSavedAt, /^\d{4}-\d{2}-\d{2}T/);
  const generalRoomGameAllowedAfterToggle = await chatPayload({
    registeredRoom: false,
    room: "판매신청방",
    msg: "/던전",
    sender: "게임참여자",
    roomId: "salesRoom1",
    roomLink: "https://open.kakao.com/o/salesRoom1",
    licenseKey: approvedApplication.json.room.licenseKey
  });
  assert.doesNotMatch(generalRoomGameAllowedAfterToggle.json.reply || "", /일반방에서는 게임 실행 명령어를 사용할 수 없습니다/);
  const gameRoomOpsAllowedAfterToggle = await chatPayload({
    registeredRoom: false,
    room: "판매게임방",
    msg: "/게임방공지",
    sender: "게임참여자",
    roomId: "salesGame1",
    roomLink: "https://open.kakao.com/o/salesGame1",
    licenseKey: approvedGameRoom.json.room.licenseKey
  });
  assert.match(gameRoomOpsAllowedAfterToggle.json.reply || "", /일반방 공지입니다/);
  const roomModeEnabled = await request("/api/buyer/room-mode-settings", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      token: approvedLogin.json.guideToken,
      applicationId: buyerConsoleApproved.json.rooms[0].applicationId,
      generalRoomGameBlocked: true,
      gameRoomOpsBlocked: true
    })
  });
  assert.equal(roomModeEnabled.response.status, 200);
  assert.equal(roomModeEnabled.json.savedSettings.modeSplit.blockGamesInGeneralRoom, true);
  assert.equal(roomModeEnabled.json.savedSettings.modeSplit.blockOpsInGameRoom, true);

  const linkerEmail = `linker-${process.pid}@pixgom.test`;
  const linkSignup = await request("/api/signup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      nickname: "연결테스터",
      email: linkerEmail,
      password: "password123",
      passwordConfirm: "password123",
      termsAgreed: true,
      privacyAgreed: true
    })
  });
  assert.equal(linkSignup.response.status, 200);
  const linkBaseApply = await request("/api/apply", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: linkerEmail,
      password: "password123",
      roomName: "기존일반방",
      roomLink: "https://open.kakao.com/o/linkBase1",
      adminName: "연결관리자",
      contact: "link-contact"
    })
  });
  assert.equal(linkBaseApply.response.status, 200);
  const linkCandidateApply = await request("/api/apply", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: linkerEmail,
      password: "password123",
      roomName: "기존승인게임후보",
      roomLink: "https://open.kakao.com/o/linkGame1",
      adminName: "연결관리자",
      contact: "link-contact"
    })
  });
  assert.equal(linkCandidateApply.response.status, 200);
  const linkPendingApply = await request("/api/apply", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: linkerEmail,
      password: "password123",
      roomName: "기존미승인게임후보",
      roomLink: "https://open.kakao.com/o/linkPending1",
      adminName: "연결관리자",
      contact: "link-contact"
    })
  });
  assert.equal(linkPendingApply.response.status, 200);
  const approvedLinkBase = await request("/api/admin/applications/approve", {
    method: "POST",
    headers: { "content-type": "application/json", "x-admin-token": "test-admin-token" },
    body: JSON.stringify({ applicationId: linkBaseApply.json.application.id, months: 1 })
  });
  assert.equal(approvedLinkBase.response.status, 200);
  const approvedLinkCandidate = await request("/api/admin/applications/approve", {
    method: "POST",
    headers: { "content-type": "application/json", "x-admin-token": "test-admin-token" },
    body: JSON.stringify({ applicationId: linkCandidateApply.json.application.id, months: 1 })
  });
  assert.equal(approvedLinkCandidate.response.status, 200);
  const adminRoomsBeforeBuyerGameLink = await request("/api/admin/rooms?token=test-admin-token");
  assert.equal(adminRoomsBeforeBuyerGameLink.response.status, 200);
  const unlinkedRoomGroup = adminRoomsBeforeBuyerGameLink.json.roomGroups.find((group) => group.baseApplication?.id === linkBaseApply.json.application.id);
  assert.ok(unlinkedRoomGroup);
  assert.equal(unlinkedRoomGroup.bridgeDiagnostics.responseRoomCount, 1);
  assert.equal(unlinkedRoomGroup.bridgeDiagnostics.issues.includes("approved_room_candidates_not_linked"), true);
  assert.equal(unlinkedRoomGroup.bridgeDiagnostics.unlinkedApprovedRoomCandidates.some((room) => room.id === linkCandidateApply.json.application.id), true);
  const linkLogin = await request("/api/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: linkerEmail, password: "password123" })
  });
  assert.equal(linkLogin.response.status, 200);
  const gameRoomLinkSelf = await request("/api/buyer/game-room-link", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      token: linkLogin.json.guideToken,
      baseApplicationId: linkBaseApply.json.application.id,
      gameApplicationId: linkBaseApply.json.application.id
    })
  });
  assert.equal(gameRoomLinkSelf.response.status, 400);
  assert.equal(gameRoomLinkSelf.json.error, "same_application");
  const gameRoomLinkPending = await request("/api/buyer/game-room-link", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      token: linkLogin.json.guideToken,
      baseApplicationId: linkBaseApply.json.application.id,
      gameApplicationId: linkPendingApply.json.application.id
    })
  });
  assert.equal(gameRoomLinkPending.response.status, 403);
  assert.equal(gameRoomLinkPending.json.error, "game_room_approval_required");
  const gameRoomLinkForbidden = await request("/api/buyer/game-room-link", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      token: approvedLogin.json.guideToken,
      baseApplicationId: linkBaseApply.json.application.id,
      gameApplicationId: linkCandidateApply.json.application.id
    })
  });
  assert.equal(gameRoomLinkForbidden.response.status, 403);
  assert.equal(gameRoomLinkForbidden.json.error, "application_forbidden");
  const gameRoomLink = await request("/api/buyer/game-room-link", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      token: linkLogin.json.guideToken,
      baseApplicationId: linkBaseApply.json.application.id,
      gameApplicationId: linkCandidateApply.json.application.id
    })
  });
  assert.equal(gameRoomLink.response.status, 200);
  assert.equal(gameRoomLink.json.application.roomPurpose, "game_room");
  assert.equal(gameRoomLink.json.application.linkedApplicationId, linkBaseApply.json.application.id);
  const linkedRoomGroup = gameRoomLink.json.roomGroups.find((group) => group.baseRoom.applicationId === linkBaseApply.json.application.id);
  assert.equal(linkedRoomGroup.roomModeSettings.enabled, true);
  assert.equal(linkedRoomGroup.gameRooms.some((room) => room.applicationId === linkCandidateApply.json.application.id), true);
  const gameRoomLinkAgain = await request("/api/buyer/game-room-link", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      token: linkLogin.json.guideToken,
      baseApplicationId: linkBaseApply.json.application.id,
      gameApplicationId: linkCandidateApply.json.application.id
    })
  });
  assert.equal(gameRoomLinkAgain.response.status, 409);
  assert.equal(gameRoomLinkAgain.json.error, "game_room_already_linked");
  const linkedGameDice = await chatPayload({
    registeredRoom: false,
    room: "기존승인게임후보",
    msg: "/주사위",
    sender: "연결참여자",
    roomId: "linkGame1",
    roomLink: "https://open.kakao.com/o/linkGame1",
    licenseKey: approvedLinkCandidate.json.room.licenseKey
  });
  assert.match(linkedGameDice.json.reply, /주사위 게임/);
  const linkedGameStatus = await chatPayload({
    registeredRoom: false,
    room: "기존승인게임후보",
    msg: "/상태",
    sender: "연결참여자",
    roomId: "linkGame1",
    roomLink: "https://open.kakao.com/o/linkGame1",
    licenseKey: approvedLinkCandidate.json.room.licenseKey
  });
  assert.match(linkedGameStatus.json.reply, /서버 정상/);
  const linkConsoleAfter = await request("/api/buyer/console", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: linkLogin.json.guideToken })
  });
  const linkBaseRoom = linkConsoleAfter.json.rooms.find((room) => room.applicationId === linkBaseApply.json.application.id);
  const linkGameRoom = linkConsoleAfter.json.rooms.find((room) => room.applicationId === linkCandidateApply.json.application.id);
  const linkedBridgeConnect = await request("/api/bridge/connect", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code: linkBaseRoom.bridgeConnectCode })
  });
  assert.equal(linkedBridgeConnect.response.status, 200);
  assert.deepEqual(
    linkedBridgeConnect.json.rooms.map((room) => room.roomName).sort(),
    ["기존승인게임후보", "기존일반방"].sort()
  );
  const linkedGameBridgeConnect = await request("/api/bridge/connect", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code: linkGameRoom.bridgeConnectCode })
  });
  assert.equal(linkedGameBridgeConnect.response.status, 200);
  assert.deepEqual(
    linkedGameBridgeConnect.json.rooms.map((room) => room.roomName).sort(),
    ["기존승인게임후보", "기존일반방"].sort()
  );

  const adminLinkEmail = `admin-link-${process.pid}@pixgom.test`;
  const adminLinkSignup = await request("/api/signup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      nickname: "어드민연결",
      email: adminLinkEmail,
      password: "password123",
      passwordConfirm: "password123",
      termsAgreed: true,
      privacyAgreed: true
    })
  });
  assert.equal(adminLinkSignup.response.status, 200);
  const adminBaseApply = await request("/api/apply", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: adminLinkEmail,
      password: "password123",
      roomName: "관리자기준방",
      roomLink: "https://open.kakao.com/o/adminBase1",
      adminName: "어드민연결관리자",
      contact: "admin-link-contact"
    })
  });
  assert.equal(adminBaseApply.response.status, 200);
  const adminGameApply = await request("/api/apply", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: adminLinkEmail,
      password: "password123",
      roomName: "관리자게임방",
      roomLink: "https://open.kakao.com/o/adminGame1",
      adminName: "어드민연결관리자",
      contact: "admin-link-contact"
    })
  });
  assert.equal(adminGameApply.response.status, 200);
  await request("/api/admin/applications/approve", {
    method: "POST",
    headers: { "content-type": "application/json", "x-admin-token": "test-admin-token" },
    body: JSON.stringify({ applicationId: adminBaseApply.json.application.id, months: 1 })
  });
  await request("/api/admin/applications/approve", {
    method: "POST",
    headers: { "content-type": "application/json", "x-admin-token": "test-admin-token" },
    body: JSON.stringify({ applicationId: adminGameApply.json.application.id, months: 1 })
  });
  const adminGameRoomLink = await request("/api/admin/game-room-link", {
    method: "POST",
    headers: { "content-type": "application/json", "x-admin-token": "test-admin-token" },
    body: JSON.stringify({
      baseApplicationId: adminBaseApply.json.application.id,
      gameApplicationId: adminGameApply.json.application.id
    })
  });
  assert.equal(adminGameRoomLink.response.status, 200);
  assert.equal(adminGameRoomLink.json.application.roomPurpose, "game_room");
  assert.equal(adminGameRoomLink.json.application.linkedApplicationId, adminBaseApply.json.application.id);
  assert.equal(adminGameRoomLink.json.roomGroups.some((group) => group.baseApplication?.id === adminBaseApply.json.application.id && group.gameApplications.some((item) => item.id === adminGameApply.json.application.id)), true);

  const adminRoomsAfterGameLink = await request("/api/admin/rooms?token=test-admin-token");
  const adminLinkedGroup = adminRoomsAfterGameLink.json.roomGroups.find((group) => group.baseApplication?.id === adminBaseApply.json.application.id);
  assert.equal(adminLinkedGroup.bridgeDiagnostics.responseRoomCount, 2);
  assert.equal(adminLinkedGroup.gameRooms.some((room) => room.name === "관리자게임방"), true);

  const adminRenameRoom = await request("/api/admin/rooms", {
    method: "POST",
    headers: { "content-type": "application/json", "x-admin-token": "test-admin-token" },
    body: JSON.stringify({
      originalRoomName: "관리자기준방",
      room: "관리자기준방변경",
      roomId: "adminBase1",
      roomLink: "https://open.kakao.com/o/adminBase1",
      roomAdmins: ["어드민연결관리자"],
      features: { attendance: true, points: true, rankings: true, history: true, profiles: true, localJs: true, games: true, shop: true, customCommands: true }
    })
  });
  assert.equal(adminRenameRoom.response.status, 200);
  assert.equal(adminRenameRoom.json.room.name, "관리자기준방변경");
  const stateAfterAdminRename = await readTestState();
  assert.equal(Boolean(stateAfterAdminRename.rooms["관리자기준방"]), false);
  assert.equal(Boolean(stateAfterAdminRename.rooms["관리자기준방변경"]), true);
  assert.equal(stateAfterAdminRename.applications[adminBaseApply.json.application.id].roomName, "관리자기준방변경");
  assert.equal(stateAfterAdminRename.rooms["관리자게임방"].settings.canonicalRoomName, "관리자기준방변경");
  assert.equal(stateAfterAdminRename.rooms["관리자게임방"].settings.canonicalRoomKey, "관리자기준방변경");
  const adminRenameConflict = await request("/api/admin/rooms", {
    method: "POST",
    headers: { "content-type": "application/json", "x-admin-token": "test-admin-token" },
    body: JSON.stringify({
      originalRoomName: "관리자기준방변경",
      room: "관리자게임방"
    })
  });
  assert.equal(adminRenameConflict.response.status, 409);
  assert.equal(adminRenameConflict.json.error, "room_name_conflict");

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
    room: "판매게임방",
    msg: "/운영주사위",
    sender: "구매자",
    roomId: "salesGame1",
    roomLink: "https://open.kakao.com/o/salesGame1",
    licenseKey: approvedGameRoom.json.room.licenseKey
  });
  assert.match(diceProxyReply.json.reply, /주사위 게임/);

  const proxyBaitPurchase = await chatPayload({
    registeredRoom: false,
    room: "판매게임방",
    msg: "/미끼구매 1",
    sender: "구매자",
    roomId: "salesGame1",
    roomLink: "https://open.kakao.com/o/salesGame1",
    licenseKey: approvedGameRoom.json.room.licenseKey
  });
  assert.match(proxyBaitPurchase.json.reply, /미끼 구매 완료/);

  const fishingPackProxyReply = await chatPayload({
    registeredRoom: false,
    room: "판매게임방",
    msg: "/운영낚시",
    sender: "구매자",
    roomId: "salesGame1",
    roomLink: "https://open.kakao.com/o/salesGame1",
    licenseKey: approvedGameRoom.json.room.licenseKey
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
  assert.match(commandInstallList.json.reply, /설치 코드 : no\.\d{3}/);
  assert.match(commandInstallList.json.reply, /삭제 코드 : \d{4}/);
  assert.match(commandInstallList.json.reply, /\/설치취소 \d{4}/);
  const deleteCodeMatch = commandInstallList.json.reply.match(/\/규칙[\s\S]*?삭제 코드 : (\d{4})/);
  assert.ok(deleteCodeMatch, "설치목록에서 /규칙 삭제 코드를 확인할 수 있어야 합니다.");
  const invalidDeleteCode = deleteCodeMatch[1] === "9999" ? "9998" : "9999";

  const wrongDeleteCode = await chatPayload({
    registeredRoom: false,
    room: "판매추가방",
    msg: `/설치취소 ${invalidDeleteCode}`,
    sender: "신청관리자",
    roomId: "salesRoom2",
    roomLink: "https://open.kakao.com/o/salesRoom2",
    licenseKey: approvedAdditionalRoom.json.room.licenseKey
  });
  assert.match(wrongDeleteCode.json.reply, /삭제 코드를 확인/);

  const commandDeleteByCode = await chatPayload({
    registeredRoom: false,
    room: "판매추가방",
    msg: `/설치취소 ${deleteCodeMatch[1]}`,
    sender: "신청관리자",
    roomId: "salesRoom2",
    roomLink: "https://open.kakao.com/o/salesRoom2",
    licenseKey: approvedAdditionalRoom.json.room.licenseKey
  });
  assert.match(commandDeleteByCode.json.reply, /설치 명령어를 삭제했습니다/);
  assert.match(commandDeleteByCode.json.reply, /\/규칙/);

  const deletedRuleReply = await chatPayload({
    registeredRoom: false,
    room: "판매추가방",
    msg: "/규칙",
    sender: "구매자",
    roomId: "salesRoom2",
    roomLink: "https://open.kakao.com/o/salesRoom2",
    licenseKey: approvedAdditionalRoom.json.room.licenseKey
  });
  assert.equal(deletedRuleReply.json.reply === null || /등록되지 않은 명령어/.test(deletedRuleReply.json.reply), true);

  const missingPetPackReply = await chatPayload({
    registeredRoom: false,
    room: "판매추가방",
    msg: "/펫상점",
    sender: "구매자",
    roomId: "salesRoom2",
    roomLink: "https://open.kakao.com/o/salesRoom2",
    licenseKey: approvedAdditionalRoom.json.room.licenseKey
  });
  assert.match(missingPetPackReply.json.reply, /미설치/);
  assert.match(missingPetPackReply.json.reply, /\/명령어설치 pk\.008/);
  assert.match(missingPetPackReply.json.reply, /\/help\/pet/);

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
  assert.equal(bridgeConnect.json.room.roomStatusSnapshot.lifecycle.status, "active");
  assert.equal(bridgeConnect.json.room.roomStatusSnapshot.bridge.status, "ready");

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

  const petHelp = await chatPayload({
    registeredRoom: false,
    room: "콘솔방",
    msg: "/도움말 펫",
    sender: "콘솔관리자",
    roomId: "consoleRoom1",
    roomLink: "https://open.kakao.com/o/consoleRoom1",
    licenseKey: "PXG-CONSOLE-1234"
  });
  assert.match(petHelp.json.reply, /펫키우기팩/);
  assert.match(petHelp.json.reply, /\/help\/pet/);
  assert.match(petHelp.json.reply, /\/명령어설치 pk\.008/);

  const rpgHelp = await chatPayload({
    registeredRoom: false,
    room: "콘솔방",
    msg: "/게임팩도움말 RPG",
    sender: "콘솔관리자",
    roomId: "consoleRoom1",
    roomLink: "https://open.kakao.com/o/consoleRoom1",
    licenseKey: "PXG-CONSOLE-1234"
  });
  assert.match(rpgHelp.json.reply, /RPG 모험팩/);
  assert.match(rpgHelp.json.reply, /\/help\/rpg/);

  const gamePackHelpList = await chatPayload({
    registeredRoom: false,
    room: "콘솔방",
    msg: "/게임팩도움말",
    sender: "콘솔관리자",
    roomId: "consoleRoom1",
    roomLink: "https://open.kakao.com/o/consoleRoom1",
    licenseKey: "PXG-CONSOLE-1234"
  });
  assert.match(gamePackHelpList.json.reply, /게임팩 도움말/);
  assert.match(gamePackHelpList.json.reply, /pet/);
  assert.match(gamePackHelpList.json.reply, /rpg/);

  const unknownGamePackHelp = await chatPayload({
    registeredRoom: false,
    room: "콘솔방",
    msg: "/게임팩도움말 unknown",
    sender: "콘솔관리자",
    roomId: "consoleRoom1",
    roomLink: "https://open.kakao.com/o/consoleRoom1",
    licenseKey: "PXG-CONSOLE-1234"
  });
  assert.match(unknownGamePackHelp.json.reply, /찾을 수 없는 게임팩/);
  assert.match(unknownGamePackHelp.json.reply, /사용 가능한 게임팩/);

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
  assert.match(help.json.template.outputs[0].simpleText.text, /빠른 찾기/);
  assert.match(help.json.template.outputs[0].simpleText.text, /\/메뉴/);
  assert.match(help.json.template.outputs[0].simpleText.text, /\/찾기 게임/);

  const menuHelp = await chatPayload({
    registeredRoom: false,
    room: "콘솔방",
    msg: "/메뉴",
    sender: "콘솔관리자",
    roomId: "consoleRoom1",
    roomLink: "https://open.kakao.com/o/consoleRoom1",
    licenseKey: "PXG-CONSOLE-1234"
  });
  assert.match(menuHelp.json.reply, /픽셀곰 메뉴/);
  assert.match(menuHelp.json.reply, /처음 시작/);
  assert.match(menuHelp.json.reply, /게임/);
  assert.match(menuHelp.json.reply, /가방/);
  assert.match(menuHelp.json.reply, /\/찾기 게임/);

  const findGameHelp = await chatPayload({
    registeredRoom: false,
    room: "콘솔방",
    msg: "/찾기 게임",
    sender: "콘솔관리자",
    roomId: "consoleRoom1",
    roomLink: "https://open.kakao.com/o/consoleRoom1",
    licenseKey: "PXG-CONSOLE-1234"
  });
  assert.match(findGameHelp.json.reply, /명령어 찾기/);
  assert.match(findGameHelp.json.reply, /\/낚시/);
  assert.match(findGameHelp.json.reply, /\/던전/);
  assert.match(findGameHelp.json.reply, /\/가방정리/);

  const startGuide = await chatPayload({
    registeredRoom: false,
    room: "콘솔방",
    msg: "/시작",
    sender: "콘솔관리자",
    roomId: "consoleRoom1",
    roomLink: "https://open.kakao.com/o/consoleRoom1",
    licenseKey: "PXG-CONSOLE-1234"
  });
  assert.match(startGuide.json.reply, /픽셀곰 시작 가이드/);
  assert.match(startGuide.json.reply, /1\. 상태 확인/);
  assert.match(startGuide.json.reply, /\/추천/);
  assert.match(startGuide.json.reply, /\/찾기 게임/);

  const recommendationHelp = await chatPayload({
    registeredRoom: false,
    room: "콘솔방",
    msg: "/추천",
    sender: "콘솔관리자",
    roomId: "consoleRoom1",
    roomLink: "https://open.kakao.com/o/consoleRoom1",
    licenseKey: "PXG-CONSOLE-1234"
  });
  assert.match(recommendationHelp.json.reply, /추천 명령어/);
  assert.match(recommendationHelp.json.reply, /\/포인트/);
  assert.match(recommendationHelp.json.reply, /\/게임/);
  assert.match(recommendationHelp.json.reply, /\/가방정리/);

  const findSellHelp = await chatPayload({
    registeredRoom: false,
    room: "콘솔방",
    msg: "/찾기 판매",
    sender: "콘솔관리자",
    roomId: "consoleRoom1",
    roomLink: "https://open.kakao.com/o/consoleRoom1",
    licenseKey: "PXG-CONSOLE-1234"
  });
  assert.match(findSellHelp.json.reply, /명령어 찾기/);
  assert.match(findSellHelp.json.reply, /\/판매목록/);
  assert.match(findSellHelp.json.reply, /\/판매미리보기/);

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

  await chat("/포인트지급 미미 300", "관리자");
  await chat("/아이템지급 미미 1 1", "관리자");
  const aliasTargetPoint = await chat("/포인트 미미", "사용자");
  assert.match(aliasTargetPoint.json.reply, /미미님의 포인트/);
  const aliasSenderPoint = await chat("/포인트", "미미");
  assert.match(aliasSenderPoint.json.reply, /미미님의 포인트/);
  const aliasAttendance = await chat("/출석", "미미");
  assert.match(aliasAttendance.json.reply, /미미님 출석/);
  const aliasBag = await chat("/가방", "미미");
  assert.match(aliasBag.json.reply, /미미님의 가방/);

  await chat("일반방 닉 데이터", "오리 95");
  await chat("게임방 닉 데이터", "오리");
  const aliasTargetGrant = await chat("/포인트지급 오리 95 100", "관리자");
  assert.match(aliasTargetGrant.json.reply, /포인트 지급 완료/);
  const aliasSourceGrant = await chat("/포인트지급 오리 200", "관리자");
  assert.match(aliasSourceGrant.json.reply, /포인트 지급 완료/);
  const aliasMergeRegister = await chat("/별명등록 오리 95 오리", "관리자");
  assert.match(aliasMergeRegister.json.reply, /별명이 오리/);
  assert.match(aliasMergeRegister.json.reply, /데이터 병합/);
  const aliasMergedPoint = await chat("/포인트", "오리 95");
  assert.match(aliasMergedPoint.json.reply, /🅟306/);
  const aliasSourcePointAfterMerge = await chat("/포인트", "오리");
  assert.match(aliasSourcePointAfterMerge.json.reply, /오리님의 포인트 : 🅟308/);

  await chat("일반방 수동 병합 데이터", "거북 77");
  await chat("게임방 수동 병합 데이터", "거북");
  const manualTargetGrant = await chat("/포인트지급 거북 77 50", "관리자");
  assert.match(manualTargetGrant.json.reply, /포인트 지급 완료/);
  const manualSourceGrant = await chat("/포인트지급 거북 70", "관리자");
  assert.match(manualSourceGrant.json.reply, /포인트 지급 완료/);
  const nicknameMergeDenied = await chat("/닉병합 거북 77 거북", "사용자");
  assert.match(nicknameMergeDenied.json.reply, /관리자 전용/);
  const nicknameMerge = await chat("/닉병합 거북 77 거북", "관리자");
  assert.match(nicknameMerge.json.reply, /닉네임 병합 완료/);
  assert.match(nicknameMerge.json.reply, /기준 : 거북 77/);
  assert.match(nicknameMerge.json.reply, /합친 닉 : 거북/);
  const manualMergedPoint = await chat("/포인트", "거북 77");
  assert.match(manualMergedPoint.json.reply, /🅟126/);
  const manualSourcePointAfterMerge = await chat("/포인트", "거북");
  assert.match(manualSourcePointAfterMerge.json.reply, /거북님의 포인트 : 🅟128/);

  await chat("포인트 기능 테스트 시작", "포순이 여");

  const attendance = await chat("/출석", "포순이 여");
  assert.match(attendance.json.reply, /포순이 여님 출석/);
  assert.match(attendance.json.reply, /🅟100 획득/);

  const attendanceDuplicate = await chat("/출석체크", "포순이 여");
  assert.match(attendanceDuplicate.json.reply, /이미 출첵/);

  const shortAttendance = await chat("ㅊㅊ", "초성출석 남");
  assert.match(shortAttendance.json.reply, /초성출석 남님 출석/);

  const pointGrant = await chat("/포인트지급 포순이 여 2500", "관리자");
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

  const bulkPurchase = await chat("/구매 1 10", "포순이 여");
  assert.match(bulkPurchase.json.reply, /구매 완료/);
  assert.match(bulkPurchase.json.reply, /물약 x 10/);
  assert.match(bulkPurchase.json.reply, /사용 포인트 : 🅟1,000/);

  const bag = await chat("/가방", "포순이 여");
  assert.match(bag.json.reply, /포순이 여님의 가방/);
  assert.match(bag.json.reply, /1\. 물약 x 11/);

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

  const lunchDefault = await chat("/점메추", "점심러 여");
  assert.match(lunchDefault.json.reply, /오늘 점심 추천/);
  assert.match(lunchDefault.json.reply, /자세히/);

  const lunchSpicy = await chat("/점메추 매운거", "점심러 여");
  assert.match(lunchSpicy.json.reply, /매운/);
  assert.match(lunchSpicy.json.reply, /(추천|어떠세요)/);

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

  const dungeonList = await chat("/던전목록", "모험가 여");
  assert.match(dungeonList.json.reply, /픽셀곰 던전 목록/);
  assert.match(dungeonList.json.reply, /초급 광산/);
  assert.doesNotMatch(dungeonList.json.reply, /#11\d{3}/);

  const dungeonRun = await chat("/던전", "모험가 여");
  assert.match(dungeonRun.json.reply, /던전 결과/);
  assert.match(dungeonRun.json.reply, /(가방에 보관|꽝)/);
  assert.doesNotMatch(dungeonRun.json.reply, /#11\d{3}/);

  const dungeonCooldown = await chat("/던전", "모험가 여");
  assert.match(dungeonCooldown.json.reply, /쿨타임/);
  assert.match(dungeonCooldown.json.reply, /던전은/);

  const materialGrant = await chat("/아이템지급 모험가 여 11000 2", "관리자");
  assert.match(materialGrant.json.reply, /아이템지급 완료/);
  assert.match(materialGrant.json.reply, /철광석/);

  const craftPointGrant = await chat("/포인트지급 모험가 여 200", "관리자");
  assert.match(craftPointGrant.json.reply, /포인트 지급 완료/);

  const smith = await chat("/대장간", "모험가 여");
  assert.match(smith.json.reply, /픽셀곰 대장간/);
  assert.doesNotMatch(smith.json.reply, /12001/);
  assert.match(smith.json.reply, /1\. \[무기/);
  assert.match(smith.json.reply, /제작 종류/);
  assert.match(smith.json.reply, /무기/);
  assert.match(smith.json.reply, /방어구/);
  assert.match(smith.json.reply, /장신구/);
  assert.match(smith.json.reply, /세트/);

  const craftableList = await chat("/제작가능", "모험가 여");
  assert.match(craftableList.json.reply, /제작 가능 목록/);
  assert.match(craftableList.json.reply, /수습 모험검/);

  const craftWeapon = await chat("/제작 1", "모험가 여");
  assert.match(craftWeapon.json.reply, /제작 완료/);
  assert.match(craftWeapon.json.reply, /수습 모험검/);
  assert.match(craftWeapon.json.reply, /자동 장착/);

  const equipment = await chat("/장비", "모험가 여");
  assert.match(equipment.json.reply, /모험가 여님의 장비/);
  assert.match(equipment.json.reply, /수습 모험검/);
  assert.match(equipment.json.reply, /총 전투력/);

  const rpgSetList = await chat("/세트아이템", "모험가 여");
  assert.match(rpgSetList.json.reply, /RPG 세트 아이템/);
  assert.match(rpgSetList.json.reply, /광산 세트/);
  assert.match(rpgSetList.json.reply, /별빛 세트/);

  await chat("/아이템지급 모험가 여 11001 3", "관리자");
  await chat("/아이템지급 모험가 여 11004 2", "관리자");
  await chat("/아이템지급 모험가 여 11014 2", "관리자");
  await chat("/포인트지급 모험가 여 500", "관리자");
  const craftMiningWeapon = await chat("/제작 12002", "모험가 여");
  assert.match(craftMiningWeapon.json.reply, /광산 파쇄도끼/);
  assert.match(craftMiningWeapon.json.reply, /자동 장착/);
  const craftMiningArmor = await chat("/제작 12006", "모험가 여");
  assert.match(craftMiningArmor.json.reply, /흑철 흉갑/);
  assert.match(craftMiningArmor.json.reply, /자동 장착/);
  const craftMiningAccessory = await chat("/제작 12009", "모험가 여");
  assert.match(craftMiningAccessory.json.reply, /광부 부적/);
  assert.match(craftMiningAccessory.json.reply, /자동 장착/);
  const miningSetEquipment = await chat("/장비", "모험가 여");
  assert.match(miningSetEquipment.json.reply, /광산 세트/);
  assert.match(miningSetEquipment.json.reply, /3세트/);
  assert.doesNotMatch(miningSetEquipment.json.reply, /#120/);

  const rpgItems = await chat("/아이템", "모험가 여");
  assert.match(rpgItems.json.reply, /보유 아이템 1\//);
  assert.match(rpgItems.json.reply, /1\./);
  assert.match(rpgItems.json.reply, /자세히 보기: \/아이템상세 번호/);

  const rpgItemDetail = await chat("/아이템상세 1", "모험가 여");
  assert.match(rpgItemDetail.json.reply, /아이템 상세/);
  assert.match(rpgItemDetail.json.reply, /판매가/);
  assert.match(rpgItemDetail.json.reply, /관리번호/);

  const equipByShortNumber = await chat("/장착 1", "모험가 여");
  assert.match(equipByShortNumber.json.reply, /장착 완료/);
  assert.match(equipByShortNumber.json.reply, /비교/);

  const equipByName = await chat("/장착 광산 파쇄도끼", "모험가 여");
  assert.match(equipByName.json.reply, /장착 완료/);
  assert.match(equipByName.json.reply, /광산 파쇄도끼/);

  const equippedSellBlocked = await chat("/판매 광산 파쇄도끼", "모험가 여");
  assert.match(equippedSellBlocked.json.reply, /장착 중인 장비/);

  const sellByName = await chat("/판매 수습 모험검", "모험가 여");
  assert.match(sellByName.json.reply, /판매 완료/);
  assert.match(sellByName.json.reply, /수습 모험검/);

  const saleList = await chat("/판매목록", "모험가 여");
  assert.match(saleList.json.reply, /판매 목록/);
  assert.match(saleList.json.reply, /\/판매 1/);

  const cleanupGrantA = await chat("/아이템지급 정리러 여 11000 3", "관리자");
  assert.match(cleanupGrantA.json.reply, /철광석/);
  await chat("/아이템지급 정리러 여 11001 2", "관리자");
  await chat("/아이템지급 정리러 여 10000 2", "관리자");

  const salePreviewBefore = await chat("/판매미리보기 재료", "정리러 여");
  assert.match(salePreviewBefore.json.reply, /판매 미리보기/);
  assert.match(salePreviewBefore.json.reply, /예상 획득/);
  const cleanupBagBefore = await chat("/가방", "정리러 여");
  assert.match(cleanupBagBefore.json.reply, /철광석 x 3/);

  const itemLock = await chat("/아이템잠금 1", "정리러 여");
  assert.match(itemLock.json.reply, /아이템 잠금/);
  const lockList = await chat("/잠금목록", "정리러 여");
  assert.match(lockList.json.reply, /잠금 목록/);
  assert.match(lockList.json.reply, /1개/);
  const lockedPreview = await chat("/판매미리보기 물고기", "정리러 여");
  assert.match(lockedPreview.json.reply, /잠금 1개/);

  const multiSell = await chat("/판매 2,3", "정리러 여");
  assert.match(multiSell.json.reply, /판매 완료/);
  assert.match(multiSell.json.reply, /판매 수량/);

  await chat("/아이템지급 범위러 여 11000 2", "관리자");
  await chat("/아이템지급 범위러 여 11001 2", "관리자");
  await chat("/아이템지급 범위러 여 11002 2", "관리자");
  const rangeSell = await chat("/판매 1-3", "범위러 여");
  assert.match(rangeSell.json.reply, /판매 완료/);
  assert.match(rangeSell.json.reply, /판매 수량 : 3개/);

  await chat("/아이템지급 정리러 여 11000 2", "관리자");
  await chat("/아이템지급 정리러 여 10001 2", "관리자");
  const sellMaterials = await chat("/판매 재료", "정리러 여");
  assert.match(sellMaterials.json.reply, /판매 완료/);
  assert.match(sellMaterials.json.reply, /재료/);

  const bagCleanup = await chat("/가방정리", "정리러 여");
  assert.match(bagCleanup.json.reply, /가방 정리/);
  assert.match(bagCleanup.json.reply, /판매미리보기/);

  const unlock = await chat("/아이템잠금해제 1", "정리러 여");
  assert.match(unlock.json.reply, /잠금 해제/);
  const lockListEmpty = await chat("/잠금목록", "정리러 여");
  assert.match(lockListEmpty.json.reply, /잠금된 아이템이 없습니다/);

  await chat("/아이템지급 모험가 여 11000 2", "관리자");
  await chat("/아이템지급 모험가 여 11002 1", "관리자");
  const bulkDuplicateSale = await chat("/일괄판매 중복", "모험가 여");
  assert.match(bulkDuplicateSale.json.reply, /일괄판매 완료/);
  assert.match(bulkDuplicateSale.json.reply, /중복/);

  const bulkCommonSale = await chat("/일괄판매 일반", "모험가 여");
  assert.match(bulkCommonSale.json.reply, /일괄판매 완료/);
  assert.match(bulkCommonSale.json.reply, /일반/);

  const autoEquipAttack = await chat("/자동장착 공격", "모험가 여");
  assert.match(autoEquipAttack.json.reply, /자동장착 완료/);
  assert.match(autoEquipAttack.json.reply, /공격/);
  assert.match(autoEquipAttack.json.reply, /(공격력|치명타|명중)/);

  const autoEquipDefense = await chat("/자동장착 방어", "모험가 여");
  assert.match(autoEquipDefense.json.reply, /자동장착 완료/);
  assert.match(autoEquipDefense.json.reply, /방어/);

  const autoEquipMagic = await chat("/자동장착 마법", "모험가 여");
  assert.match(autoEquipMagic.json.reply, /자동장착 완료/);
  assert.match(autoEquipMagic.json.reply, /마법/);

  const equipmentDetail = await chat("/장비상세", "모험가 여");
  assert.match(equipmentDetail.json.reply, /장비 상세/);
  assert.match(equipmentDetail.json.reply, /마법 공격력/);

  const statsView = await chat("/스탯", "모험가 여");
  assert.match(statsView.json.reply, /스탯/);
  assert.match(statsView.json.reply, /HP/);
  assert.match(statsView.json.reply, /MP/);

  const monsterDex = await chat("/몬스터도감", "몬스터러 여");
  assert.match(monsterDex.json.reply, /픽셀몬스터 도감/);
  assert.match(monsterDex.json.reply, /150종/);
  assert.doesNotMatch(monsterDex.json.reply, /pm\d{3}/);

  const monsterExplore = await chat("/몬스터탐험", "몬스터러 여");
  assert.match(monsterExplore.json.reply, /몬스터 탐험/);
  assert.match(monsterExplore.json.reply, /발견/);

  const monsterCapture = await chat("/포획", "몬스터러 여");
  assert.match(monsterCapture.json.reply, /포획 성공/);

  const monsterList = await chat("/몬스터목록", "몬스터러 여");
  assert.match(monsterList.json.reply, /몬스터러 여님의 몬스터/);
  assert.match(monsterList.json.reply, /Lv\./);

  const monsterTrain = await chat("/몬스터훈련", "몬스터러 여");
  assert.match(monsterTrain.json.reply, /몬스터 훈련/);

  const monsterBattle = await chat("/몬스터전투", "몬스터러 여");
  assert.match(monsterBattle.json.reply, /몬스터 전투/);

  const petAdopt = await chat("/펫입양 뭉치", "펫집사 여");
  assert.match(petAdopt.json.reply, /펫 입양 완료/);
  assert.match(petAdopt.json.reply, /뭉치/);

  const petStatus = await chat("/펫", "펫집사 여");
  assert.match(petStatus.json.reply, /펫집사 여님의 펫/);
  assert.match(petStatus.json.reply, /배고픔/);

  const petFeed = await chat("/펫먹이", "펫집사 여");
  assert.match(petFeed.json.reply, /펫 먹이 완료/);

  const petPlay = await chat("/펫놀기", "펫집사 여");
  assert.match(petPlay.json.reply, /펫 놀기 완료/);

  const petClean = await chat("/펫씻기", "펫집사 여");
  assert.match(petClean.json.reply, /펫 씻기 완료/);

  const petSleep = await chat("/펫재우기", "펫집사 여");
  assert.match(petSleep.json.reply, /펫 휴식 완료/);

  const petTrain = await chat("/펫훈련", "펫집사 여");
  assert.match(petTrain.json.reply, /펫 훈련/);

  const petShop = await chat("/펫상점", "펫집사 여");
  assert.match(petShop.json.reply, /펫 상점/);
  assert.doesNotMatch(petShop.json.reply, /9302/);
  assert.match(petShop.json.reply, /1\. 펫 간식/);

  const baitShop = await chat("/미끼상점", "낚시러 여");
  assert.match(baitShop.json.reply, /미끼 상점/);
  assert.match(baitShop.json.reply, /기본 미끼/);
  assert.doesNotMatch(baitShop.json.reply, /9001/);
  assert.match(baitShop.json.reply, /1\. 기본 미끼/);

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
  assert.match(fishingItem.json.reply, /판매가: 🅟/);
  assert.doesNotMatch(fishingItem.json.reply, /#10\d{3}/);

  const fishingCooldown = await chat("/낚시", "낚시러 여");
  assert.match(fishingCooldown.json.reply, /쿨타임/);
  assert.match(fishingCooldown.json.reply, /낚시는/);

  const aquarium = await chat("/어항", "낚시러 여");
  assert.match(aquarium.json.reply, /낚시러 여님의 어항/);
  assert.match(aquarium.json.reply, /수집/);
  assert.match(aquarium.json.reply, /판매: \/판매 물고기/);

  const fishingBag = await chat("/가방", "낚시러 여");
  assert.match(fishingBag.json.reply, /판매가/);
  assert.match(fishingBag.json.reply, /자세히 보기/);

  const sellFish = await chat("/판매 물고기", "낚시러 여");
  assert.match(sellFish.json.reply, /판매 완료/);
  assert.match(sellFish.json.reply, /지급 포인트/);

  const exploreItem = await chat("/탐험", "탐험가 여");
  assert.match(exploreItem.json.reply, /탐험 결과/);
  assert.match(exploreItem.json.reply, /가방에 보관/);
  assert.doesNotMatch(exploreItem.json.reply, /#9\d{3}/);

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
  assert.match(cheerReply.json.reply, /포순이 여 -> 미미/);
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
  assert.match(missingAttendance.json.reply, /오리/);

  const likeRank = await chat("/좋아요순위", "포순이 여");
  assert.match(likeRank.json.reply, /채팅방 좋아요순위/);
  assert.match(likeRank.json.reply, /미미 ♥11/);

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
  assert.match(inbox.json.reply, /💌 미미님, 1건의 메시지/);
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

  const sensitiveChat = await chat("연락은 test@example.com 또는 010-1234-5678 token=abc123", "로그사용자");
  assert.equal(sensitiveChat.json.reply, null);

  const roomLogsUnauthorized = await request(`/api/admin/room-logs?room=${encodeURIComponent("테스트방")}`);
  assert.equal(roomLogsUnauthorized.response.status, 401);

  const roomLogs = await request(`/api/admin/room-logs?room=${encodeURIComponent("테스트방")}&limit=50`, {
    headers: { "x-admin-session": "test-admin-token" }
  });
  assert.equal(roomLogs.response.status, 200);
  assert.equal(roomLogs.json.ok, true);
  assert.equal(roomLogs.json.version, "0.5.11");
  assert.ok(roomLogs.json.summary.totalLogs >= 1);
  assert.ok(Number.isFinite(roomLogs.json.summary.recent24h));
  assert.ok(Number.isFinite(roomLogs.json.summary.commandLogs));
  assert.ok(Number.isFinite(roomLogs.json.summary.errorLogs));
  assert.ok(Array.isArray(roomLogs.json.summary.topCommands));
  assert.ok(roomLogs.json.rooms.some((room) => room.room === "테스트방" && room.count >= 1));
  const sensitiveLog = roomLogs.json.logs.find((log) => /연락은/.test(log.messagePreview || ""));
  assert.ok(sensitiveLog);
  assert.match(sensitiveLog.messagePreview, /\[email\]/);
  assert.match(sensitiveLog.messagePreview, /\[phone\]/);
  assert.match(sensitiveLog.messagePreview, /\[secret\]/);
  assert.doesNotMatch(sensitiveLog.messagePreview, /test@example\.com/);
  assert.doesNotMatch(sensitiveLog.messagePreview, /010-1234-5678/);
  assert.ok(sensitiveLog.messageHash);
  assert.ok(sensitiveLog.senderHash);

  const roomLogsCsvExport = await request(`/api/admin/room-logs/export?room=${encodeURIComponent("테스트방")}&format=csv&limit=10`, {
    headers: { "x-admin-session": "test-admin-token" }
  });
  assert.equal(roomLogsCsvExport.response.status, 200);
  assert.equal(roomLogsCsvExport.json.format, "csv");
  assert.match(roomLogsCsvExport.json.filename, /\.csv$/);
  assert.match(roomLogsCsvExport.json.content, /at,room,sender,eventType,command,isCommand,messagePreview/);
  const roomLogsJsonExport = await request(`/api/admin/room-logs/export?room=${encodeURIComponent("테스트방")}&format=json&limit=10`, {
    headers: { "x-admin-session": "test-admin-token" }
  });
  assert.equal(roomLogsJsonExport.response.status, 200);
  assert.equal(roomLogsJsonExport.json.format, "json");
  assert.match(roomLogsJsonExport.json.filename, /\.json$/);
  assert.match(roomLogsJsonExport.json.content, /"logs"/);

  const slashHelp = await chat("/", "사용자");
  assert.equal(slashHelp.json.reply, null);

  const disableGameAtEnd = await chat("/기능끄기 게임", "관리자");
  assert.match(disableGameAtEnd.json.reply, /게임 기능이 꺼졌습니다/);

  const disabledGame = await chat("/낚시", "사용자");
  assert.match(disabledGame.json.reply, /게임 기능은 이 방에서 꺼져/);

  const forceDeleteSeed = await request("/api/admin/rooms?token=test-admin-token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      room: "강제삭제방",
      roomId: "forceDeleteRoom1",
      roomAdmins: ["강제관리자"],
      subscriptionExpiresAt: "2099-12-31"
    })
  });
  assert.equal(forceDeleteSeed.response.status, 200);
  const forceDeleteBlocked = await request("/api/admin/rooms/force-delete?token=test-admin-token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ roomName: "강제삭제방", confirmRoomName: "강제삭제방" })
  });
  assert.equal(forceDeleteBlocked.response.status, 400);
  assert.equal(forceDeleteBlocked.json.error, "purge_confirmation_required");
  const forceDeleteConfirmed = await request("/api/admin/rooms/force-delete?token=test-admin-token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ roomName: "강제삭제방", confirmRoomName: "강제삭제방", confirmPermanentDelete: "PERMANENT_DELETE" })
  });
  assert.equal(forceDeleteConfirmed.response.status, 200);
  assert.equal(forceDeleteConfirmed.json.purgedRoom.roomName, "강제삭제방");

  const bulkArchiveBlocked = await request("/api/admin/rooms/bulk-archive?token=test-admin-token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ confirmBulkArchive: "WRONG" })
  });
  assert.equal(bulkArchiveBlocked.response.status, 400);
  assert.equal(bulkArchiveBlocked.json.error, "bulk_archive_confirmation_required");
  const bulkAccountPreserve = await request("/api/signup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      nickname: "보존회원",
      email: `bulk-preserve-${process.pid}@pixgom.test`,
      password: "password123",
      passwordConfirm: "password123",
      termsAgreed: true,
      privacyAgreed: true
    })
  });
  assert.equal(bulkAccountPreserve.response.status, 200);
  const bulkArchive = await request("/api/admin/rooms/bulk-archive?token=test-admin-token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ confirmBulkArchive: "ARCHIVE_ALL_ROOMS", reason: "고객 0명 초기화 테스트" })
  });
  assert.equal(bulkArchive.response.status, 200);
  assert.ok(bulkArchive.json.summary.accountsPreserved >= 1);
  assert.equal(bulkArchive.json.summary.activeRooms, 0);
  assert.ok(bulkArchive.json.summary.archivedCount >= 1);
  const adminRoomsAfterBulkArchive = await request("/api/admin/rooms?token=test-admin-token");
  assert.equal(adminRoomsAfterBulkArchive.response.status, 200);
  assert.equal(adminRoomsAfterBulkArchive.json.summary.rooms, 0);

  const chatGet = await request("/chat-event");
  assert.equal(chatGet.response.status, 405);

  console.log("Room ops bot tests passed.");
} finally {
  await cleanup();
}
