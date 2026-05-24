import assert from "node:assert/strict";
import http from "node:http";
import { unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

let server;
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

  const { requestHandler } = await import("../server.js");
  server = http.createServer(requestHandler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
}

async function cleanup() {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (testDbPath) await unlink(testDbPath).catch(() => {});
}

async function request(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, options);
  const json = await response.json();
  return { response, json };
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
  assert.equal(health.json.version, "0.4.54");
  assert.equal(health.json.gamesEnabled, true);
  assert.equal(Object.hasOwn(health.json, "benchmark"), false);
  assert.match(health.json.features.join(","), /profile-registry/);
  assert.match(health.json.features.join(","), /message-inbox/);
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
  assert.equal(health.json.monthlyPriceKrw, 5500);
  assert.equal(health.json.additionalRoomPriceKrw, 2200);
  assert.equal(health.json.adminConsoleEnabled, true);

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

  for (const pagePath of ["/privacy", "/terms", "/updates", "/notice", "/store", "/guide", "/buyer-guide", "/login", "/signup", "/forgot-password", "/reset-password", "/apply", "/console", "/my-rooms", "/setup", "/license", "/status"]) {
    const page = await fetch(`${baseUrl}${pagePath}`);
    assert.equal(page.status, 200);
    assert.match(page.headers.get("content-type") || "", /text\/html/);
  }

  const statusPage = await fetch(`${baseUrl}/status`);
  const statusPageText = await statusPage.text();
  assert.match(statusPageText, /서버 상태/);
  assert.match(statusPageText, /연결 상태/);
  assert.match(statusPageText, /추가 방/);
  assert.doesNotMatch(statusPageText, /"features"/);

  const adminPage = await fetch(`${baseUrl}/admin`);
  assert.equal(adminPage.status, 200);
  const adminPageText = await adminPage.text();
  assert.match(adminPageText, /픽셀곰 콘솔/);
  assert.match(adminPageText, /방별 기능 ON\/OFF/);
  assert.match(adminPageText, /백업 복구/);
  assert.match(adminPageText, /신청\/결제/);
  assert.match(adminPageText, /명령어 추가\/수정/);
  assert.match(adminPageText, /게임 시즌\/보상 설정/);
  assert.match(adminPageText, /만료 임박 7일/);
  assert.match(adminPageText, /시즌 시작일/);
  assert.match(adminPageText, /방, 관리자, 라이선스/);
  assert.match(adminPageText, /운영자 로그인 확인/);
  assert.match(adminPageText, /room-delete-button/);
  assert.match(adminPageText, /session-nav\.js/);
  assert.doesNotMatch(adminPageText, /ADMIN_CONSOLE_TOKEN/);

  const authScript = await fetch(`${baseUrl}/auth.js`);
  assert.equal(authScript.status, 200);
  assert.match(await authScript.text(), /kakaoOidcStartUrl/);

  const sessionNavScript = await fetch(`${baseUrl}/session-nav.js`);
  assert.equal(sessionNavScript.status, 200);
  const sessionNavText = await sessionNavScript.text();
  assert.match(sessionNavText, /pixgomOwnerToken/);
  assert.match(sessionNavText, /pixgomBuyerToken/);

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
  assert.equal(adminRoom.json.room.gameSettings.seasonName, "콘솔 시즌");
  assert.match(adminRoom.json.room.gameSettings.seasonStartsAt, /2026/);
  assert.match(adminRoom.json.room.gameSettings.seasonEndsAt, /2026/);
  assert.equal(adminRoom.json.room.gameSettings.diceReward, 7);
  assert.equal(adminRoom.json.room.customCommands[0].trigger, "/공지");

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
  assert.match(JSON.stringify(adminDiagnostics.json.rooms), /콘솔방/);

  const adminBackup = await request("/api/admin/backup?token=test-admin-token");
  assert.equal(adminBackup.response.status, 200);
  assert.equal(adminBackup.json.ok, true);
  assert.ok(adminBackup.json.state.rooms);

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

  const buyerGuideApproved = await request("/api/buyer/guide", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: approvedLogin.json.guideToken })
  });
  assert.equal(buyerGuideApproved.response.status, 200);
  assert.equal(buyerGuideApproved.json.ok, true);
  assert.equal(buyerGuideApproved.json.version, "0.4.54");
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
  assert.equal(buyerConsoleApproved.json.version, "0.4.54");
  assert.match(buyerConsoleApproved.json.ownerAdminNotice, /\/admin/);
  assert.equal(buyerConsoleApproved.json.rooms.length, 1);
  assert.equal(buyerConsoleApproved.json.plan.monthlyPriceKrw, 5500);
  assert.equal(buyerConsoleApproved.json.plan.additionalRoomPriceKrw, 2200);

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
  assert.match(missingLicense.json.reply, /라이선스 확인/);

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
  assert.match(help.json.template.outputs[0].simpleText.text, /최근이벤트/);
  assert.match(help.json.template.outputs[0].simpleText.text, /포인트/);
  assert.match(help.json.template.outputs[0].simpleText.text, /좋아요/);
  assert.match(help.json.template.outputs[0].simpleText.text, /이체/);
  assert.match(help.json.template.outputs[0].simpleText.text, /응원/);
  assert.match(help.json.template.outputs[0].simpleText.text, /뽑기/);
  assert.match(help.json.template.outputs[0].simpleText.text, /\/홀 금액/);
  assert.match(help.json.template.outputs[0].simpleText.text, /출석/);
  assert.doesNotMatch(help.json.template.outputs[0].simpleText.text, /프로필등록/);
  assert.doesNotMatch(help.json.template.outputs[0].simpleText.text, /입퇴장상세/);
  assert.doesNotMatch(help.json.template.outputs[0].simpleText.text, /관리자등록/);
  assert.doesNotMatch(help.json.template.outputs[0].simpleText.text, /관리자재설정/);
  assert.doesNotMatch(help.json.template.outputs[0].simpleText.text, /원본로그/);
  assert.doesNotMatch(help.json.template.outputs[0].simpleText.text, /벤치마크|laggobot|라꼬봇/i);
  assert.match(help.json.template.outputs[0].simpleText.text, /가상 포인트/);

  const removedProfileForm = await chat("/공질", "관리자");
  assert.equal(removedProfileForm.response.status, 200);
  assert.match(removedProfileForm.json.reply, /등록되지 않은 명령어/);

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
  assert.match(roomInfo.json.reply, /월 이용금액: 5,500원/);
  assert.match(roomInfo.json.reply, /이용기간 만료:/);

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
  assert.match(expiredRoomRegister.json.reply, /월 이용금액: 5,500원/);
  assert.match(expiredRoomRegister.json.reply, /이용기간 만료:/);

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
  assert.match(expiredAttendance.json.reply, /5,500원/);

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
  assert.match(expiredStatus.json.reply, /5,500원/);

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
  assert.match(extendSubscription.json.reply, /월 이용금액: 5,500원/);

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
  assert.match(adminHelp.json.reply, /포인트지급/);
  assert.match(adminHelp.json.reply, /명령어등록/);

  const fixedCommands = await chat("/고정명령어", "관리자");
  assert.match(fixedCommands.json.reply, /픽셀곰 고정 명령어/);
  assert.match(fixedCommands.json.reply, /게임\/연동 예약/);

  const gameCommands = await chat("/게임명령어", "관리자");
  assert.match(gameCommands.json.reply, /픽셀곰 게임 명령어/);
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
  assert.match(customCommandAfterDelete.json.reply, /등록되지 않은 명령어/);

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

  const recentEvents = await chat("/최근이벤트 5", "일반사용자", "고유값방");
  assert.match(recentEvents.json.reply, /targetUserId : openchat-user-1/);
  assert.match(recentEvents.json.reply, /id 후보/);

  const rawLogDenied = await chat("/원본로그 3", "일반사용자", "고유값방");
  assert.match(rawLogDenied.json.reply, /관리자 전용/);

  const rawLog = await chat("/원본로그 4", "관리자", "고유값방");
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
  assert.match(removedLinkCommand.json.reply, /등록되지 않은 명령어/);

  const removedLinkRegister = await chat("/링크등록 건의방 https://open.kakao.com/o/test", "관리자");
  assert.match(removedLinkRegister.json.reply, /등록되지 않은 명령어/);

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

  const pointGrant = await chat("/포인트지급 포순이 여 1000", "관리자");
  assert.match(pointGrant.json.reply, /포인트 지급 완료/);
  assert.match(pointGrant.json.reply, /포순이 여/);

  const pointView = await chat("/포인트", "포순이 여");
  assert.match(pointView.json.reply, /포순이 여님의 포인트 : 🅟/);

  const pointGuide = await chat("/포인트안내", "포순이 여");
  assert.match(pointGuide.json.reply, /포인트 콘텐츠/);
  assert.match(pointGuide.json.reply, /응원 카드/);
  assert.match(pointGuide.json.reply, /뽑기/);
  assert.match(pointGuide.json.reply, /\/홀 금액/);

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

  const oddEven = await chat("/홀 100", "포순이 여");
  assert.match(oddEven.json.reply, /홀짝 결과/);
  assert.match(oddEven.json.reply, /선택 : 홀/);
  assert.match(oddEven.json.reply, /베팅 : 🅟100/);
  assert.match(oddEven.json.reply, /결과 : (홀|짝)/);
  assert.match(oddEven.json.reply, /배당 : x2/);
  assert.match(oddEven.json.reply, /지급 포인트 : 🅟(0|200)/);

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

  const inbox = await chat("/메시지", "미미 여");
  assert.match(inbox.json.reply, /💌 미미 여님, 1건의 메시지/);
  assert.match(inbox.json.reply, /보낸사람 : 관리자/);
  assert.match(inbox.json.reply, /미미야 확인해줘/);

  const emptyInbox = await chat("/메세지", "미미 여");
  assert.match(emptyInbox.json.reply, /메시지가 없습니다/);

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
  assert.match(slashHelp.json.reply, /운영봇 참여자 명령어/);
  assert.doesNotMatch(slashHelp.json.reply, /등록되지 않은 명령어/);

  const disabledGame = await chat("/낚시", "사용자");
  assert.match(disabledGame.json.reply, /게임 기능은 이 방에서 꺼져/);

  const chatGet = await request("/chat-event");
  assert.equal(chatGet.response.status, 405);

  console.log("Room ops bot tests passed.");
} finally {
  await cleanup();
}
