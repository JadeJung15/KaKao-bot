import http from "node:http";
import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { copyFile, mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const DEFAULT_BOT_NAME = process.env.BOT_DISPLAY_NAME || "운영봇";
const ROOM_BRAND_NAME = process.env.ROOM_BRAND_NAME || "픽셀곰";
const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_DIR = path.join(__dirname, "data");
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, "room-ops-db.json");
const FORTUNE_POOL_PATH = process.env.FORTUNE_POOL_PATH || path.join(DATA_DIR, "fortune-pool.json");
const STATE_ID = process.env.BOT_STATE_ID || "main";
const STATIC_CONTENT_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp"
};

export const APP_VERSION = "0.5.28";
const BACKUP_SCHEMA_VERSION = 1;
export const FEATURES = [
  "health-check",
  "chat-event-webhook",
  "kakao-skill-webhook",
  "role-based-help",
  "identity-conflict-guard",
  "profile-registry",
  "alias-registry",
  "nickname-manual-merge",
  "admin-nickname-merge-tool",
  "admin-nickname-merge-history",
  "admin-nickname-merge-candidates",
  "join-exit-history",
  "nickname-history",
  "detailed-member-history",
  "message-inbox",
  "admin-commands",
  "point-ledger",
  "like-points",
  "point-transfer",
  "point-cheer",
  "point-lucky-draw",
  "simple-lucky-draw-result",
  "point-odd-even",
  "point-odd-even-betting",
  "attendance-rewards",
  "member-levels",
  "member-rankings",
  "raw-event-log",
  "room-analytics-log-retention",
  "admin-room-log-browser",
  "admin-room-log-export",
  "stable-user-ids",
  "admin-identity-reset",
  "bridge-auto-extract",
  "identity-nickname-summary",
  "raw-identity-nickname-recovery",
  "cross-room-identity-nickname-recovery",
  "identity-scoped-recent-events",
  "first-chat-reentry-notice",
  "room-safe-bridge-defaults",
  "private-chat-guard",
  "registered-room-guard",
  "future-game-roadmap",
  "bridge-self-test-commands",
  "entry-reentry-candidate-history",
  "reserved-name-nickname-guard",
  "reserved-history-cleanup",
  "system-event-dedupe",
  "compact-welcome-text",
  "bridge-reply-echo-guard",
  "passive-notification-guard",
  "multi-room-registry",
  "room-join-phrase",
  "commercial-bridge-mode",
  "commercial-subscription-gate",
  "license-key-guard",
  "admin-console-api",
  "admin-room-delete",
  "room-feature-toggles",
  "subscription-reminders",
  "admin-diagnostics-api",
  "admin-backup-restore",
  "chat-mini-games",
  "point-chance-game-pack",
  "fixed-command-catalog",
  "custom-room-commands",
  "public-service-pages",
  "customer-signup-api",
  "customer-login-api",
  "manual-payment-approval",
  "admin-application-workflow",
  "custom-command-console-builder",
  "buyer-guide-api",
  "protected-buyer-guide",
  "buyer-session-token",
  "split-account-application-flow",
  "bridge-connect-code-api",
  "buyer-room-auto-sync",
  "bridge-multi-room-auto-sync",
  "play-internal-test-link",
  "admin-console-search",
  "room-game-settings",
  "bridge-test-checklist",
  "admin-subscription-filters",
  "game-season-schedule",
  "buyer-owner-console-split",
  "supabase-auth-bridge",
  "kakao-login-ready",
  "kanana-ai-roadmap",
  "signup-consent-audit",
  "password-reset-flow",
  "owner-email-admin-access",
  "account-nickname-field",
  "additional-room-pricing",
  "simple-status-page",
  "branded-email-template",
  "kakao-oidc-id-token-login",
  "kakao-social-login-first-connect",
  "attendance-short-command",
  "attendance-missing-list",
  "attendance-ranking",
  "lucky-draw-catalog",
  "point-shop",
  "member-inventory",
  "item-gift",
  "shop-admin-commands",
  "game-item-economy",
  "game-cooldowns",
  "fishing-bait-aquarium",
  "generated-fish-catalog",
  "bulk-item-purchase",
  "rpg-adventure-pack",
  "pixel-monster-rpg-pack",
  "pet-raising-pack",
  "game-room-role-split",
  "chat-sensitive-info-redaction",
  "command-template-store",
  "representative-command-store",
  "buyer-command-template-install",
  "owned-bridge-engine-marketing",
  "command-template-response-editor",
  "command-template-cart-favorites",
  "buyer-custom-command-management",
  "game-template-engine-shortcuts",
  "slashless-custom-command-triggers",
  "room-scoped-command-management",
  "admin-application-record-cleanup",
  "command-store-pagination",
  "command-template-bundles",
  "ready-to-use-command-responses",
  "command-store-set-editor",
  "server-version-diagnostics",
  "health-db-status-cards",
  "bridge-home-diagnostics",
  "bridge-log-share-action",
  "buyer-console-onboarding",
  "buyer-room-status-fields",
  "buyer-room-transfer",
  "admin-room-status-badges",
  "admin-feature-summary-cards",
  "command-store-installed-search",
  "command-pack-install-swap",
  "admin-management-command-pack-guard",
  "additive-command-pack-install",
  "command-pack-remove-command",
  "chat-command-install-copy",
  "command-store-kakao-preview",
  "command-store-filter-refinement",
  "command-store-mode-ux",
  "new-buyer-journey-ux",
  "auth-session-gate",
  "silent-auth-transition",
  "room-report-workflow",
  "command-store-action-cleanup",
  "command-pack-detail-help",
  "install-delete-code-ux",
  "game-pack-help-pages",
  "game-room-apply-ux",
  "compact-command-pack-actions",
  "help-command-list-style",
  "installed-command-pack-summary",
  "android-1021-release-prep",
  "android-1021-play-latest",
  "compact-site-navigation",
  "why-pixgom-redesign",
  "subscription-expiry-guidance",
  "bridge-connect-expiry-gate",
  "license-error-user-guidance",
  "backup-schema-version",
  "admin-backup-dry-run",
  "backup-restore-error-summary",
  "deployment-preflight-script",
  "deployment-smoke-script",
  "rollback-runbook",
  "android-release-report",
  "play-closed-testing-checklist",
  "android-version-compatibility-guidance",
  "standardized-incident-messages",
  "admin-diagnostics-summary",
  "incident-history-cards",
  "server-owned-room-settings",
  "buyer-account-profile-edit",
  "application-inquiry-workflow",
  "application-payment-requested-at",
  "buyer-room-groups",
  "buyer-room-mode-settings",
  "buyer-room-feature-settings",
  "bridge-connect-linked-room-batch",
  "buyer-game-room-link",
  "bridge-connect-diagnostics",
  "admin-game-room-link",
  "admin-room-rename",
  "react-admin-console",
  "react-buyer-console",
  "room-status-snapshot",
  "archived-room-lifecycle",
  "buyer-restore-request",
  "unified-room-lifecycle",
  "admin-workflow-panels",
  "buyer-request-status-dashboard",
  "console-home-navigation",
  "admin-console-command-admin-tools",
  "admin-room-bulk-archive",
  "unified-buyer-guide",
  "bridge-room-profile-sync",
  "android-buyer-console-routing",
  "game-room-admin-sync",
  "android-notification-sender-fallback",
  "rpg-crafting-auto-equip",
  "rpg-craftable-list",
  "rpg-equipment-set-bonus",
  "rpg-short-item-selector",
  "rpg-auto-equip-presets",
  "rpg-expanded-equipment-stats",
  "lunch-menu-recommendation",
  "command-response-emoji-ux",
  "inventory-sale-cleanup",
  "inventory-item-locks",
  "hidden-item-id-chat-results",
  "hidden-system-shop-ids",
  "command-discovery-hub",
  "starter-tutorial-command",
  "personalized-command-recommendations",
  "alias-preferred-display-names",
  "beginner-command-store-flow",
  "segmented-command-recommendations",
  "log-based-command-top",
  "alias-summary-console",
  "game-hub-discovery",
  "daily-action-checklist",
  "smart-sale-cleanup-recommendations",
  "dashboard-integrated-search",
  "duplicate-identity-search-disambiguation",
  "command-store-journey-sections",
  "console-game-ops-overview",
  "console-dashboard-entrypoints",
  "console-search-result-accessibility",
  "console-search-deep-links",
  "inventory-page-navigation",
  "chat-state-warm-cache",
  "chat-event-timing-diagnostics",
  "bridge-retry-queue",
  "chat-event-deduplication",
  "chat-event-detailed-timing",
  "admin-live-event-diagnostics",
  "read-only-command-save-skip",
  "android-1030-play-latest",
  "android-1031-release-prep",
  "android-account-auto-connect",
  "android-native-buyer-console",
  "android-dark-bridge-ui",
  "android-email-otp-login",
  "android-social-login-routing",
  "app-diagnostic-log-clarity",
  "admin-live-log-status-badges",
  "buyer-app-connection-check-card",
  "ux-work-type-guide",
  "pixel-monster-daily-loop",
  "pixel-monster-team-evolution",
  "pixel-monster-weekly-boss",
  "rpg-auto-hunt-ticket",
  "rpg-equipment-enhancement",
  "rpg-adventure-hub",
  "rpg-auto-crafting",
  "functional-shop-item-mapping",
  "dungeon-precious-metal-drops",
  "multi-auto-game-tickets",
  "auto-command-bulk-runs",
  "expanded-rpg-equipment-catalog",
  "expanded-dungeon-catalog"
];

const DEFAULT_REGISTERED_ROOM_LINKS = ["https://open.kakao.com/o/gu25P5vi"];
const MONTHLY_PRICE_KRW = Math.max(0, Number(process.env.MONTHLY_PRICE_KRW || 5500)) || 5500;
const ADDITIONAL_ROOM_PRICE_KRW = Math.max(0, Number(process.env.ADDITIONAL_ROOM_PRICE_KRW || 2200)) || 2200;
const DEFAULT_SUBSCRIPTION_DAYS = Math.max(1, Number(process.env.DEFAULT_SUBSCRIPTION_DAYS || 30));
const ROOM_ANALYTICS_LOG_LIMIT = Math.max(100, Number(process.env.ROOM_ANALYTICS_LOG_LIMIT || 5000));
const ROOM_ANALYTICS_EXPORT_LIMIT = Math.max(10, Number(process.env.ROOM_ANALYTICS_EXPORT_LIMIT || 500));
const ROOM_ANALYTICS_MESSAGE_PREVIEW_LIMIT = 240;
const CHAT_STATE_CACHE_TTL_MS = Math.max(0, Number(process.env.CHAT_STATE_CACHE_TTL_MS || process.env.STATE_CACHE_TTL_MS || 5000));
const ADMIN_CONSOLE_TOKEN = normalizeText(process.env.ADMIN_CONSOLE_TOKEN || process.env.PIXGOM_ADMIN_TOKEN || "");
const OWNER_ADMIN_EMAILS = (process.env.OWNER_ADMIN_EMAILS || process.env.ADMIN_EMAILS || "jadejung15@gmail.com")
  .split(",")
  .map((email) => normalizeEmail(email))
  .filter(Boolean);
const PLAY_INTERNAL_TEST_URL = "https://play.google.com/apps/internaltest/4700397680875890998";
const PUBLIC_SITE_URL = normalizeText(process.env.PUBLIC_SITE_URL || process.env.SITE_URL || "https://pixgom.com").replace(/\/+$/, "");
const INCIDENT_MESSAGES = Object.freeze({
  SERVER_ERROR: {
    code: "server_error",
    title: "서버 오류",
    message: "서버 처리 중 문제가 발생했습니다. 잠시 후 다시 시도하고, 반복되면 운영자에게 문의해 주세요."
  },
  DB_ERROR: {
    code: "db_error",
    title: "DB 오류",
    message: "운영 DB 연결을 확인하지 못했습니다. 저장소 상태와 Vercel 환경변수를 확인해 주세요."
  },
  AUTH_ERROR: {
    code: "auth_error",
    title: "권한 오류",
    message: "로그인 세션 또는 운영자 권한을 확인해 주세요."
  },
  SUBSCRIPTION_EXPIRED: {
    code: "subscription_expired",
    title: "구독 만료",
    message: "이용기간이 만료되어 일반 명령어와 브릿지 연결이 차단됩니다. 방 관리자에게 연장을 요청해 주세요."
  }
});
const MIN_ANDROID_VERSION = normalizeText(process.env.MIN_ANDROID_VERSION || "1.0.17");
const LATEST_ANDROID_VERSION = normalizeText(process.env.LATEST_ANDROID_VERSION || "1.0.48");
const MIN_ANDROID_VERSION_CODE = Math.max(1, Number(process.env.MIN_ANDROID_VERSION_CODE || 18));
const LATEST_ANDROID_VERSION_CODE = Math.max(MIN_ANDROID_VERSION_CODE, Number(process.env.LATEST_ANDROID_VERSION_CODE || 49));
const SUPABASE_URL = normalizeText(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
const SUPABASE_ANON_KEY = normalizeText(process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "");
const SUPABASE_KAKAO_ENABLED = normalizeText(process.env.SUPABASE_KAKAO_ENABLED || "false") === "true";
const SUPABASE_GOOGLE_ENABLED = normalizeText(process.env.SUPABASE_GOOGLE_ENABLED || "false") === "true";
const SUPABASE_APPLE_ENABLED = normalizeText(process.env.SUPABASE_APPLE_ENABLED || "false") === "true";
const SUPABASE_OTP_ENABLED = normalizeText(process.env.SUPABASE_OTP_ENABLED || "true") !== "false";
const KAKAO_REST_API_KEY = normalizeText(process.env.KAKAO_REST_API_KEY || process.env.KAKAO_CLIENT_ID || "");
const KAKAO_CLIENT_SECRET = normalizeText(process.env.KAKAO_CLIENT_SECRET || "");
const KAKAO_OIDC_ENABLED = normalizeText(process.env.KAKAO_OIDC_ENABLED || "true") !== "false";
const KAKAO_OIDC_CALLBACK_PATH = "/api/auth/kakao/callback";
const KAKAO_OIDC_SCOPE = "openid profile_nickname profile_image";

const CHAT_POINT_REWARD = 2;
const CHAT_EXP_REWARD = 1;
const ATTENDANCE_POINT_REWARD = 100;
const ATTENDANCE_EXP_REWARD = 10;
const LEVEL_UP_POINT_REWARD = 100;
const LIKE_POINT_COST = 4;
const CHEER_POINT_COST = 50;
const MAX_CHEER_MESSAGE_LENGTH = 80;
const LUCKY_DRAW_POINT_COST = 100;
const CHANCE_GAME_MIN_BET = 10;
const CHANCE_GAME_MAX_BET = 100000;
const TRANSFER_FEE_RATE = 0.1;
const DICE_REWARD = 30;
const FISHING_REWARD = 40;
const EXPLORE_REWARD = 50;
const GAME_COOLDOWNS_MS = Object.freeze({
  dice: 10 * 1000,
  fishing: 30 * 1000,
  explore: 20 * 1000,
  dungeon: 30 * 1000,
  monsterExplore: 60 * 1000,
  monsterTrain: 30 * 1000,
  monsterBattle: 90 * 1000,
  petFeed: 10 * 1000,
  petPlay: 10 * 1000,
  petClean: 10 * 1000,
  petSleep: 10 * 1000,
  petTrain: 30 * 1000,
  luckyDraw: 10 * 1000,
  oddEven: 5 * 1000,
  coinFlip: 5 * 1000,
  roulette: 5 * 1000,
  slotMachine: 5 * 1000,
  lottery: 5 * 1000,
  highLow: 5 * 1000,
  bombAvoid: 5 * 1000,
  treasureBox: 5 * 1000
});
const GAME_COOLDOWN_LABELS = Object.freeze({
  dice: "주사위는",
  fishing: "낚시는",
  explore: "탐험은",
  dungeon: "던전은",
  monsterExplore: "몬스터탐험은",
  monsterTrain: "몬스터훈련은",
  monsterBattle: "몬스터전투는",
  petFeed: "펫먹이는",
  petPlay: "펫놀기는",
  petClean: "펫씻기는",
  petSleep: "펫재우기는",
  petTrain: "펫훈련은",
  luckyDraw: "뽑기는",
  oddEven: "홀짝은",
  coinFlip: "코인은",
  roulette: "룰렛은",
  slotMachine: "슬롯은",
  lottery: "복권은",
  highLow: "하이로우는",
  bombAvoid: "폭탄피하기는",
  treasureBox: "보물상자는"
});
const GAME_REWARD_MAX = 1000000;
const GAME_SEASON_NAME_LIMIT = 40;
const SHOP_PRODUCT_LIMIT = 50;
const SHOP_PRODUCT_NAME_LIMIT = 40;
const SHOP_PRODUCT_DESCRIPTION_LIMIT = 140;
const SHOP_TRANSACTION_LIMIT = 300;
const SHOP_MAX_PRICE = 1000000;
const SHOP_MAX_QUANTITY = 99;
const INVENTORY_PAGE_SIZE = 5;
const BAIT_ITEM_ID = 9001;
const CAPTURE_STONE_ITEM_ID = 9301;
const PET_SNACK_ITEM_ID = 9302;
const AUTO_HUNT_TICKET_ITEM_ID = 9303;
const ENHANCEMENT_STONE_ITEM_ID = 9304;
const AUTO_EXPLORE_TICKET_ITEM_ID = 9305;
const AUTO_FISHING_TICKET_ITEM_ID = 9306;
const AUTO_DRAW_TICKET_ITEM_ID = 9307;
const COPPER_TREASURE_ITEM_ID = 9401;
const SILVER_TREASURE_ITEM_ID = 9402;
const GOLD_TREASURE_ITEM_ID = 9403;
const DIAMOND_TREASURE_ITEM_ID = 9404;
const FISH_ITEM_ID_START = 10000;
const FISH_SPECIES_COUNT = 60;
const FISH_GRADE_COUNT = 5;
const FISH_CATALOG_SIZE = FISH_SPECIES_COUNT * FISH_GRADE_COUNT;
const RPG_ITEM_ID_START = 11000;
const RPG_ITEM_CATALOG_SIZE = 500;
const RPG_WEAPON_ITEM_ID_START = 12000;
const RPG_AUTO_HUNT_RUNS = 10;
const RPG_MAX_ENHANCEMENT_LEVEL = 10;
const RPG_REWARD_CHOICE_TTL_MS = 10 * 60 * 1000;
const PIXEL_MONSTER_SPECIES_COUNT = 150;
const REENTRY_CANDIDATE_WINDOW_MS = 24 * 60 * 60 * 1000;
const SYSTEM_EVENT_DUPLICATE_WINDOW_MS = 2 * 60 * 1000;
const JOIN_SIGNAL_WINDOW_MS = 30 * 60 * 1000;
const UNKNOWN_COMMAND_USER_COOLDOWN_MS = 60 * 1000;
const UNKNOWN_COMMAND_ROOM_COOLDOWN_MS = 30 * 1000;
const WEATHER_ERROR_COOLDOWN_MS = 60 * 1000;
const OPEN_METEO_BASE_URL = process.env.OPEN_METEO_BASE_URL || "https://api.open-meteo.com/v1/forecast";
const DEFAULT_WEATHER_REGION = normalizeText(process.env.DEFAULT_WEATHER_REGION || "");
const DEFAULT_JOIN_PHRASE = process.env.DEFAULT_JOIN_PHRASE || "입장확인";
const DEFAULT_ROOM_FEATURES = Object.freeze({
  attendance: true,
  points: true,
  rankings: true,
  history: true,
  profiles: true,
  localJs: true,
  games: false,
  shop: true,
  customCommands: true
});
const DEFAULT_GAME_SETTINGS = Object.freeze({
  seasonName: "픽셀곰 시즌 1",
  seasonStartsAt: "",
  seasonEndsAt: "",
  diceReward: DICE_REWARD,
  fishingReward: FISHING_REWARD,
  exploreReward: EXPLORE_REWARD
});
const FEATURE_LABELS = Object.freeze({
  attendance: "출석",
  points: "포인트",
  rankings: "랭킹",
  history: "히스토리",
  profiles: "프로필",
  localJs: "JS 자동응답",
  games: "게임",
  shop: "상점",
  customCommands: "커스텀 명령어"
});
const COMMAND_RESPONSE_ICON_BY_CATEGORY = Object.freeze({
  "기본": "📘",
  "운영": "📩",
  "날씨": "🌤️",
  "운세": "🔮",
  "출석": "✅",
  "포인트": "🅟",
  "게임": "🎲",
  "랭킹": "🏆",
  "상점/가방": "🎒",
  "RPG": "🏰",
  "생활": "🍱",
  "픽셀몬스터": "✨",
  "펫키우기": "🐾",
  "커스텀": "🧩",
  "스토어": "📦",
  "프로필": "👤",
  "히스토리": "📜",
  "관리자": "🛠️"
});
const COMMAND_RESPONSE_KNOWN_PREFIXES = Object.freeze([
  "📘", "📩", "🌤️", "🔮", "✅", "🅟", "💰", "🎲", "🏆", "🎒", "🛒",
  "🏰", "⚔️", "🛡️", "🍱", "✨", "🐾", "🧩", "📦", "👤", "📜", "🛠️",
  "🚨", "❌", "⚠️", "🎣", "🐟", "🔒", "🔓"
]);
const COMMAND_RESPONSE_ICON_EXEMPT_COMMANDS = new Set([
  "/브릿지",
  "/bridge",
  "/js상태",
  "/jsstatus",
  "/로컬상태",
  "/최근이벤트",
  "/이벤트로그",
  "/원본로그",
  "/원본이벤트"
]);
const CUSTOM_COMMAND_LIMIT = 30;
const CUSTOM_COMMAND_RESPONSE_LIMIT = 700;
const SIGNUP_PASSWORD_MIN_LENGTH = 8;
const LEGAL_CONSENT_VERSION = "2026-05-25";
const BUYER_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const OWNER_TOKEN_TTL_MS = 12 * 60 * 60 * 1000;
const ROOM_TRANSFER_CODE_TTL_MS = 30 * 60 * 1000;
const APPLICATION_STATUS_LABELS = Object.freeze({
  pending_payment: "결제 대기",
  approved: "승인 완료",
  rejected: "반려",
  on_hold: "보류",
  ended: "이용 종료",
  archived: "이용 종료 보관"
});
const PAYMENT_STATUS_LABELS = Object.freeze({
  awaiting_manual_deposit: "입금 대기",
  paid: "입금 확인",
  rejected: "반려",
  on_hold: "보류",
  ended: "이용 종료"
});
const FIXED_COMMAND_GROUPS = Object.freeze([
  {
    title: "기본 운영",
    commands: ["/상태", "/도움말", "/브릿지", "/js상태", "/로컬상태", "/메시지", "/신고", "/출석", "/출첵", "/ㅊㅊ", "/포인트", "/내정보", "/프로필", "/내별명", "/닉이력"]
  },
  {
    title: "포인트/랭킹",
    commands: ["/좋아요", "/응원", "/이체", "/미출석", "/출석순위", "/포인트순위", "/좋아요순위", "/레벨순위", "/채팅오늘", "/채팅금주"]
  },
  {
    title: "상점/가방",
    commands: ["/상점", "/구매", "/구매내역", "/가방", "/가방정리", "/아이템상세", "/판매목록", "/판매미리보기", "/사용", "/가방선물", "/판매", "/일괄판매", "/아이템잠금", "/아이템잠금해제", "/잠금목록"]
  },
  {
    title: "관리자",
    commands: ["/방등록", "/방정보", "/방목록", "/방삭제", "/입장문구", "/기능목록", "/기능켜기", "/기능끄기", "/구독상태", "/구독연장", "/구독만료", "/관리자등록", "/관리자삭제", "/관리자목록", "/최근이벤트", "/원본로그", "/신고목록", "/신고처리", "/프로필등록", "/프로필삭제", "/별명등록", "/별명삭제", "/별명목록", "/닉병합", "/입퇴장상세", "/고유값초기화", "/포인트지급", "/포인트차감", "/포인트설정", "/상점추가", "/상점수정", "/상점삭제", "/상점정리", "/상점초기화", "/상점내역", "/아이템지급", "/아이템회수", "/명령어등록", "/명령어삭제", "/명령어목록", "/명령어팩목록", "/명령어팩제거"]
  },
  {
    title: "게임/연동 예약",
    commands: [
      "/게임", "/확률게임", "/주사위", "/낚시", "/탐험", "/자동탐험", "/자동모험", "/자동낚시", "/뽑기", "/자동뽑기", "/뽑기목록", "/홀", "/짝", "/코인", "/동전", "/룰렛", "/슬롯", "/복권", "/하이로우", "/폭탄피하기", "/보물상자", "/미끼상점", "/미끼구매", "/어항", "/수족관",
      "/모험", "/던전", "/던전목록", "/자동던전", "/대장간", "/제작", "/자동제작", "/제작가능", "/강화", "/강화목록", "/강화상세", "/보상선택", "/장비", "/장착",
      "/몬스터탐험", "/포획", "/몬스터", "/몬스터목록", "/몬스터훈련", "/몬스터전투", "/몬스터도감",
      "/펫입양", "/펫", "/펫먹이", "/펫놀기", "/펫씻기", "/펫재우기", "/펫훈련", "/펫상점",
      "/픽셀곰게임", "/게임연동"
    ]
  }
]);
const RESERVED_CUSTOM_COMMANDS = new Set([
  "/",
  "/help",
  "/status",
  "/bridge",
  "/jsstatus",
  "/?",
  "/커스텀명령어",
  "/고정명령어",
  "/게임명령어",
  ...FIXED_COMMAND_GROUPS.flatMap((group) => group.commands)
]);
const LUCKY_DRAW_OUTCOMES = [
  { threshold: 0.05, label: "대박", reward: 500, chance: "5%" },
  { threshold: 0.20, label: "성공", reward: 200, chance: "15%" },
  { threshold: 0.50, label: "본전", reward: 100, chance: "30%" },
  { threshold: 1, label: "꽝", reward: 0, chance: "50%" }
];
const FISH_GRADES = Object.freeze([
  { id: "common", label: "흔한", chance: 0.55, sellBase: 15, sellStep: 1 },
  { id: "uncommon", label: "고급", chance: 0.25, sellBase: 35, sellStep: 2 },
  { id: "rare", label: "희귀", chance: 0.12, sellBase: 80, sellStep: 3 },
  { id: "epic", label: "영웅", chance: 0.06, sellBase: 180, sellStep: 4 },
  { id: "legendary", label: "전설", chance: 0.02, sellBase: 500, sellStep: 5 }
]);
const FISH_SPECIES = Object.freeze([
  "붕어", "잉어", "메기", "송어", "연어", "참돔", "농어", "우럭", "광어", "방어",
  "고등어", "삼치", "갈치", "전어", "도미", "복어", "가자미", "민어", "쏘가리", "피라미",
  "은어", "빙어", "미꾸라지", "장어", "문어", "오징어", "갑오징어", "해파리", "불가사리", "소라",
  "가리비", "전복", "조개", "새우", "게", "바닷가재", "청새치", "황새치", "돛새치", "참치",
  "상어", "가오리", "해마", "흰동가리", "나비고기", "엔젤피시", "구피", "베타", "금붕어", "열대어",
  "비단잉어", "플라워혼", "디스커스", "아로와나", "피라냐", "철갑상어", "개복치", "만타가오리", "심해어", "황금고래"
]);
const RPG_MATERIAL_BASES = Object.freeze([
  "철광석", "구리광석", "은광석", "금광석", "흑철광석", "미스릴 조각", "별빛 수정", "마력 가루", "고대 목재", "질긴 가죽",
  "푸른 약초", "붉은 약초", "동굴 버섯", "수정 파편", "암염", "석탄", "화염석", "빙결석", "바람 깃털", "그림자 천",
  "빛나는 모래", "황동 톱니", "낡은 룬", "작은 뼈", "단단한 껍질"
]);
const RPG_MATERIAL_PREFIXES = Object.freeze(["", "정제된", "빛나는", "단단한", "고대의"]);
const RPG_MATERIAL_RARITIES = Object.freeze([
  { id: "common", label: "일반", sellBase: 12, priceMultiplier: 2 },
  { id: "uncommon", label: "고급", sellBase: 24, priceMultiplier: 2 },
  { id: "rare", label: "희귀", sellBase: 48, priceMultiplier: 2 },
  { id: "epic", label: "영웅", sellBase: 110, priceMultiplier: 2 },
  { id: "legendary", label: "전설", sellBase: 260, priceMultiplier: 2 }
]);
const RPG_PRECIOUS_DROPS = Object.freeze([
  { id: COPPER_TREASURE_ITEM_ID, name: "동", sellPrice: 3000, rarity: "rare", weight: 70 },
  { id: SILVER_TREASURE_ITEM_ID, name: "은", sellPrice: 10000, rarity: "epic", weight: 22 },
  { id: GOLD_TREASURE_ITEM_ID, name: "금", sellPrice: 50000, rarity: "legendary", weight: 7 },
  { id: DIAMOND_TREASURE_ITEM_ID, name: "다이아", sellPrice: 100000, rarity: "legendary", weight: 1 }
]);
function generatedRpgAdventureItems() {
  return Array.from({ length: RPG_ITEM_CATALOG_SIZE }, (_, index) => {
    const base = RPG_MATERIAL_BASES[index % RPG_MATERIAL_BASES.length];
    const prefix = RPG_MATERIAL_PREFIXES[Math.floor(index / RPG_MATERIAL_BASES.length) % RPG_MATERIAL_PREFIXES.length];
    const rarity = RPG_MATERIAL_RARITIES[Math.floor(index / 100)] || RPG_MATERIAL_RARITIES[0];
    const name = index === 0 ? "철광석" : compactSpaces(`${prefix} ${base}`);
    const sellPrice = rarity.sellBase + (index % 25);
    return {
      id: RPG_ITEM_ID_START + index,
      name,
      price: sellPrice * rarity.priceMultiplier,
      sellPrice,
      description: `${rarity.label} 등급 던전 재료`,
      active: true,
      system: true,
      category: "rpg_material",
      rarity: rarity.id,
      gradeLabel: rarity.label
    };
  });
}
const RPG_ADVENTURE_ITEMS = Object.freeze(generatedRpgAdventureItems());
const RPG_EQUIPMENT_SLOT_LABELS = Object.freeze({
  weapon: "무기",
  armor: "방어구",
  accessory: "장신구"
});
const RPG_STAT_LABELS = Object.freeze({
  attack: "공격력",
  defense: "방어력",
  agility: "민첩",
  hp: "HP",
  mp: "MP",
  magicAttack: "마법 공격력",
  magicDefense: "마법 방어력",
  crit: "치명타",
  evasion: "회피",
  accuracy: "명중",
  skillEffect: "스킬 효과"
});
const RPG_STAT_KEYS = Object.freeze(Object.keys(RPG_STAT_LABELS));
const RPG_AUTO_EQUIP_PRESETS = Object.freeze({
  balance: {
    label: "균형",
    weights: { attack: 1.1, defense: 1.1, agility: 0.9, hp: 0.12, mp: 0.1, magicAttack: 1, magicDefense: 0.9, crit: 1, evasion: 0.8, accuracy: 0.8, skillEffect: 0.8 },
    focus: ["attack", "defense", "hp"]
  },
  attack: {
    label: "공격",
    aliases: ["공격", "딜", "딜러"],
    weights: { attack: 2, crit: 1.4, accuracy: 1.2, agility: 0.8, hp: 0.04 },
    focus: ["attack", "crit", "accuracy"]
  },
  defense: {
    label: "방어",
    aliases: ["방어", "탱", "탱커"],
    weights: { defense: 2, hp: 0.18, magicDefense: 1.4, evasion: 0.6 },
    focus: ["defense", "hp", "magicDefense"]
  },
  agility: {
    label: "민첩",
    aliases: ["민첩", "속도", "회피"],
    weights: { agility: 2, evasion: 1.5, accuracy: 1.1, crit: 0.8 },
    focus: ["agility", "evasion", "accuracy"]
  },
  magic: {
    label: "마법",
    aliases: ["마법", "마공", "마나"],
    weights: { magicAttack: 2, mp: 0.18, skillEffect: 1.5, magicDefense: 0.8 },
    focus: ["magicAttack", "mp", "skillEffect"]
  },
  survival: {
    label: "생존",
    aliases: ["생존", "체력", "버티기"],
    weights: { hp: 0.24, defense: 1.6, magicDefense: 1.4, evasion: 1 },
    focus: ["hp", "defense", "magicDefense"]
  }
});
const RPG_EQUIPMENT_SETS = Object.freeze({
  mining: {
    name: "광산 세트",
    pieces: [RPG_WEAPON_ITEM_ID_START + 2, RPG_WEAPON_ITEM_ID_START + 6, RPG_WEAPON_ITEM_ID_START + 9],
    bonuses: { 2: 3, 3: 8 },
    description: "채굴과 초급 던전에 강한 균형형 세트"
  },
  starlight: {
    name: "별빛 세트",
    pieces: [RPG_WEAPON_ITEM_ID_START + 3, RPG_WEAPON_ITEM_ID_START + 7, RPG_WEAPON_ITEM_ID_START + 10],
    bonuses: { 2: 5, 3: 12 },
    description: "희귀 재료로 제작하는 고전투력 세트"
  },
  shadow: {
    name: "그림자 세트",
    pieces: [RPG_WEAPON_ITEM_ID_START + 4, RPG_WEAPON_ITEM_ID_START + 8, RPG_WEAPON_ITEM_ID_START + 11],
    bonuses: { 2: 4, 3: 10 },
    description: "중급 유적 이후 장비 전환용 세트"
  },
  volcanic: {
    name: "용암 세트",
    pieces: [RPG_WEAPON_ITEM_ID_START + 100, RPG_WEAPON_ITEM_ID_START + 101, RPG_WEAPON_ITEM_ID_START + 102],
    bonuses: { 2: 9, 3: 18 },
    description: "화염석 기반 상급 공격 세트"
  },
  sky: {
    name: "천공 세트",
    pieces: [RPG_WEAPON_ITEM_ID_START + 103, RPG_WEAPON_ITEM_ID_START + 104, RPG_WEAPON_ITEM_ID_START + 105],
    bonuses: { 2: 8, 3: 17 },
    description: "바람 깃털 기반 민첩/명중 세트"
  },
  royal: {
    name: "왕릉 세트",
    pieces: [RPG_WEAPON_ITEM_ID_START + 106, RPG_WEAPON_ITEM_ID_START + 107, RPG_WEAPON_ITEM_ID_START + 108],
    bonuses: { 2: 10, 3: 20 },
    description: "고대 왕릉 재료로 제작하는 생존 세트"
  },
  abyssal: {
    name: "심연 세트",
    pieces: [RPG_WEAPON_ITEM_ID_START + 109, RPG_WEAPON_ITEM_ID_START + 110, RPG_WEAPON_ITEM_ID_START + 111],
    bonuses: { 2: 11, 3: 22 },
    description: "심연 재료 기반 마법 세트"
  },
  diamond: {
    name: "다이아 세트",
    pieces: [RPG_WEAPON_ITEM_ID_START + 112, RPG_WEAPON_ITEM_ID_START + 113, RPG_WEAPON_ITEM_ID_START + 114],
    bonuses: { 2: 14, 3: 28 },
    description: "보석 보상을 활용하는 최상급 균형 세트"
  }
});
const RPG_EQUIPMENT_RECIPES = Object.freeze([
  {
    itemId: RPG_WEAPON_ITEM_ID_START + 1,
    name: "수습 모험검",
    slot: "weapon",
    materialId: RPG_ITEM_ID_START,
    materialQty: 2,
    pointCost: 50,
    power: 5,
    sellPrice: 120,
    description: "철광석으로 제작하는 기본 모험 무기"
  },
  {
    itemId: RPG_WEAPON_ITEM_ID_START + 2,
    name: "광산 파쇄도끼",
    slot: "weapon",
    setId: "mining",
    materialId: RPG_ITEM_ID_START + 1,
    materialQty: 3,
    pointCost: 120,
    power: 9,
    sellPrice: 220,
    description: "던전 채굴에 어울리는 고급 무기"
  },
  {
    itemId: RPG_WEAPON_ITEM_ID_START + 3,
    name: "별빛 룬소드",
    slot: "weapon",
    setId: "starlight",
    materialId: RPG_ITEM_ID_START + 6,
    materialQty: 2,
    pointCost: 300,
    power: 16,
    sellPrice: 520,
    description: "희귀 재료로 만드는 상급 무기"
  },
  {
    itemId: RPG_WEAPON_ITEM_ID_START + 4,
    name: "그림자 단검",
    slot: "weapon",
    setId: "shadow",
    materials: [{ id: RPG_ITEM_ID_START + 19, qty: 2 }, { id: RPG_ITEM_ID_START + 22, qty: 1 }],
    pointCost: 240,
    power: 13,
    sellPrice: 430,
    description: "그림자 천과 룬으로 제작하는 빠른 무기"
  },
  {
    itemId: RPG_WEAPON_ITEM_ID_START + 5,
    name: "수습 가죽갑옷",
    slot: "armor",
    materialId: RPG_ITEM_ID_START + 9,
    materialQty: 2,
    pointCost: 60,
    power: 4,
    sellPrice: 130,
    description: "질긴 가죽으로 만드는 기본 방어구"
  },
  {
    itemId: RPG_WEAPON_ITEM_ID_START + 6,
    name: "흑철 흉갑",
    slot: "armor",
    setId: "mining",
    materialId: RPG_ITEM_ID_START + 4,
    materialQty: 2,
    pointCost: 180,
    power: 10,
    sellPrice: 330,
    description: "흑철광석으로 제작하는 광산 세트 방어구"
  },
  {
    itemId: RPG_WEAPON_ITEM_ID_START + 7,
    name: "별빛 로브",
    slot: "armor",
    setId: "starlight",
    materialId: RPG_ITEM_ID_START + 6,
    materialQty: 2,
    pointCost: 320,
    power: 15,
    sellPrice: 540,
    description: "별빛 수정으로 제작하는 별빛 세트 방어구"
  },
  {
    itemId: RPG_WEAPON_ITEM_ID_START + 8,
    name: "그림자 망토",
    slot: "armor",
    setId: "shadow",
    materialId: RPG_ITEM_ID_START + 19,
    materialQty: 3,
    pointCost: 260,
    power: 12,
    sellPrice: 450,
    description: "그림자 천으로 제작하는 회피형 방어구"
  },
  {
    itemId: RPG_WEAPON_ITEM_ID_START + 9,
    name: "광부 부적",
    slot: "accessory",
    setId: "mining",
    materialId: RPG_ITEM_ID_START + 14,
    materialQty: 2,
    pointCost: 80,
    power: 3,
    sellPrice: 150,
    description: "암염을 깎아 만든 광산 세트 장신구"
  },
  {
    itemId: RPG_WEAPON_ITEM_ID_START + 10,
    name: "별빛 목걸이",
    slot: "accessory",
    setId: "starlight",
    materials: [{ id: RPG_ITEM_ID_START + 6, qty: 1 }, { id: RPG_ITEM_ID_START + 13, qty: 2 }],
    pointCost: 260,
    power: 11,
    sellPrice: 460,
    description: "별빛 수정과 수정 파편으로 제작하는 장신구"
  },
  {
    itemId: RPG_WEAPON_ITEM_ID_START + 11,
    name: "그림자 반지",
    slot: "accessory",
    setId: "shadow",
    materials: [{ id: RPG_ITEM_ID_START + 19, qty: 1 }, { id: RPG_ITEM_ID_START + 22, qty: 2 }],
    pointCost: 210,
    power: 9,
    sellPrice: 380,
    description: "그림자 세트를 완성하는 룬 장신구"
  },
  {
    itemId: RPG_WEAPON_ITEM_ID_START + 12,
    name: "고대 탐험가 나침반",
    slot: "accessory",
    materials: [{ id: RPG_ITEM_ID_START + 22, qty: 1 }, { id: RPG_ITEM_ID_START + 21, qty: 2 }],
    pointCost: 150,
    power: 6,
    sellPrice: 260,
    description: "유적 탐험에 도움을 주는 범용 장신구"
  }
]);
const RPG_EXPANDED_SET_THEMES = Object.freeze([
  { setId: "volcanic", prefix: "용암", materialId: RPG_ITEM_ID_START + 16, pointBase: 850, powerBase: 24, rarity: "epic", skill: "화염 베기" },
  { setId: "sky", prefix: "천공", materialId: RPG_ITEM_ID_START + 18, pointBase: 780, powerBase: 22, rarity: "rare", skill: "질풍 사격" },
  { setId: "royal", prefix: "왕릉", materialId: RPG_ITEM_ID_START + 22, pointBase: 900, powerBase: 25, rarity: "epic", skill: "왕가의 보호" },
  { setId: "abyssal", prefix: "심연", materialId: RPG_ITEM_ID_START + 19, pointBase: 980, powerBase: 27, rarity: "legendary", skill: "그림자 파동" },
  { setId: "diamond", prefix: "다이아", materialId: DIAMOND_TREASURE_ITEM_ID, pointBase: 2500, powerBase: 38, rarity: "legendary", skill: "보석 공명" }
]);

const RPG_EXPANDED_SLOT_TEMPLATES = Object.freeze([
  { slot: "weapon", suffix: "대검", materialQty: 4, powerBonus: 6, stats: { attack: 22, crit: 4, accuracy: 4 } },
  { slot: "armor", suffix: "갑옷", materialQty: 4, powerBonus: 4, stats: { defense: 20, hp: 60, magicDefense: 6 } },
  { slot: "accessory", suffix: "반지", materialQty: 3, powerBonus: 2, stats: { agility: 8, mp: 25, skillEffect: 5 } }
]);

const RPG_EXTRA_EQUIPMENT_THEMES = Object.freeze([
  { prefix: "서리", materialId: RPG_ITEM_ID_START + 17, base: 18, skill: "빙결 보호" },
  { prefix: "폭풍", materialId: RPG_ITEM_ID_START + 18, base: 19, skill: "폭풍 가속" },
  { prefix: "태양", materialId: RPG_ITEM_ID_START + 20, base: 21, skill: "태양 일격" },
  { prefix: "달빛", materialId: RPG_ITEM_ID_START + 6, base: 20, skill: "달빛 회복" },
  { prefix: "흑철", materialId: RPG_ITEM_ID_START + 4, base: 17, skill: "흑철 방벽" },
  { prefix: "미스릴", materialId: RPG_ITEM_ID_START + 5, base: 22, skill: "미스릴 집중" },
  { prefix: "룬", materialId: RPG_ITEM_ID_START + 22, base: 20, skill: "룬 증폭" },
  { prefix: "고대", materialId: RPG_ITEM_ID_START + 8, base: 18, skill: "고대 지식" }
]);

function rpgGeneratedStats(slot, base, bonus = 0) {
  if (slot === "weapon") return { attack: base + bonus, crit: Math.max(2, Math.floor(base / 5)), accuracy: Math.max(2, Math.floor(base / 6)) };
  if (slot === "armor") return { defense: base + bonus, hp: (base + bonus) * 4, magicDefense: Math.max(2, Math.floor(base / 4)) };
  return { agility: Math.max(2, Math.floor(base / 3)), mp: (base + bonus) * 2, skillEffect: Math.max(2, Math.floor(base / 5)) };
}

function generatedExpandedRpgEquipmentRecipes() {
  const setRecipes = RPG_EXPANDED_SET_THEMES.flatMap((theme, themeIndex) => (
    RPG_EXPANDED_SLOT_TEMPLATES.map((slotTemplate, slotIndex) => {
      const itemId = RPG_WEAPON_ITEM_ID_START + 100 + (themeIndex * RPG_EXPANDED_SLOT_TEMPLATES.length) + slotIndex;
      const power = theme.powerBase + slotTemplate.powerBonus + themeIndex;
      return {
        itemId,
        name: `${theme.prefix} ${slotTemplate.suffix}`,
        slot: slotTemplate.slot,
        setId: theme.setId,
        materialId: theme.materialId,
        materialQty: slotTemplate.materialQty,
        pointCost: theme.pointBase + (slotIndex * 120),
        power,
        sellPrice: Math.max(650, Math.floor((theme.pointBase + power * 80) * 0.45)),
        description: `${RPG_EQUIPMENT_SETS[theme.setId]?.name || theme.prefix} 제작 장비`,
        rarity: theme.rarity,
        stats: { ...rpgGeneratedStats(slotTemplate.slot, power), ...slotTemplate.stats },
        magicSkill: theme.skill,
        specialOptions: [`${theme.prefix} 보너스`, "세트 효과"]
      };
    })
  ));
  const extraRecipes = RPG_EXTRA_EQUIPMENT_THEMES.flatMap((theme, themeIndex) => (
    RPG_EXPANDED_SLOT_TEMPLATES.map((slotTemplate, slotIndex) => {
      const itemId = RPG_WEAPON_ITEM_ID_START + 150 + (themeIndex * RPG_EXPANDED_SLOT_TEMPLATES.length) + slotIndex;
      const suffix = slotTemplate.slot === "weapon" ? "검" : slotTemplate.slot === "armor" ? "코트" : "목걸이";
      const power = theme.base + slotTemplate.powerBonus + Math.floor(themeIndex / 2);
      return {
        itemId,
        name: `${theme.prefix} ${suffix}`,
        slot: slotTemplate.slot,
        materialId: theme.materialId,
        materialQty: slotTemplate.materialQty,
        pointCost: 420 + themeIndex * 80 + slotIndex * 70,
        power,
        sellPrice: 340 + themeIndex * 90 + slotIndex * 60,
        description: `${theme.prefix} 재료로 제작하는 확장 장비`,
        rarity: power >= 25 ? "rare" : "uncommon",
        stats: rpgGeneratedStats(slotTemplate.slot, power, slotIndex),
        magicSkill: theme.skill,
        specialOptions: ["확장 제작식"]
      };
    })
  ));
  return [...setRecipes, ...extraRecipes];
}

const RPG_EXPANDED_EQUIPMENT_RECIPES = Object.freeze(generatedExpandedRpgEquipmentRecipes());
const RPG_WEAPON_RECIPES = Object.freeze([...RPG_EQUIPMENT_RECIPES, ...RPG_EXPANDED_EQUIPMENT_RECIPES]);
function emptyRpgStats() {
  return Object.fromEntries(RPG_STAT_KEYS.map((key) => [key, 0]));
}

function normalizeRpgStats(value = {}) {
  const stats = emptyRpgStats();
  for (const key of RPG_STAT_KEYS) {
    stats[key] = Math.trunc(Number(value?.[key] || 0));
  }
  return stats;
}

function derivedRpgStats(item = {}) {
  const power = Math.max(0, Math.trunc(Number(item.power || 0)));
  const slot = item.slot || item.category || "weapon";
  const stats = emptyRpgStats();
  if (slot === "weapon") {
    stats.attack = power;
    stats.crit = Math.max(0, Math.floor(power / 4));
    stats.accuracy = Math.max(1, Math.floor(power / 3));
    if (/룬|별빛|마법|수정/.test(item.name || "")) {
      stats.magicAttack = Math.max(1, Math.floor(power * 0.8));
      stats.mp = power * 4;
      stats.skillEffect = Math.max(1, Math.floor(power / 5));
    }
    if (/단검|그림자/.test(item.name || "")) {
      stats.agility = Math.max(1, Math.floor(power * 0.7));
      stats.evasion = Math.max(1, Math.floor(power / 3));
    }
  } else if (slot === "armor") {
    stats.defense = power;
    stats.hp = power * 8;
    stats.magicDefense = Math.max(0, Math.floor(power / 3));
    if (/망토|그림자/.test(item.name || "")) {
      stats.agility = Math.max(1, Math.floor(power / 3));
      stats.evasion = Math.max(1, Math.floor(power / 2));
    }
    if (/로브|별빛/.test(item.name || "")) {
      stats.mp = power * 5;
      stats.magicDefense += Math.max(1, Math.floor(power / 2));
    }
  } else {
    stats.agility = Math.max(0, Math.floor(power / 2));
    stats.mp = power * 3;
    stats.magicAttack = Math.max(0, Math.floor(power / 2));
    stats.magicDefense = Math.max(0, Math.floor(power / 3));
    stats.skillEffect = Math.max(0, Math.floor(power / 4));
    if (/부적|나침반/.test(item.name || "")) stats.accuracy = Math.max(1, Math.floor(power / 2));
    if (/반지|그림자/.test(item.name || "")) stats.evasion = Math.max(1, Math.floor(power / 2));
  }
  return stats;
}

function rpgEquipmentStats(item = {}) {
  return normalizeRpgStats(item.stats && typeof item.stats === "object" ? item.stats : derivedRpgStats(item));
}

const PIXEL_MONSTER_ELEMENTS = Object.freeze(["숲", "바위", "물결", "불꽃", "바람", "빛", "그림자"]);
const PIXEL_MONSTER_RARITIES = Object.freeze([
  { id: "common", label: "일반", catchRate: 0.65 },
  { id: "uncommon", label: "고급", catchRate: 0.45 },
  { id: "rare", label: "희귀", catchRate: 0.30 },
  { id: "epic", label: "영웅", catchRate: 0.18 }
]);
const PIXEL_MONSTER_REGIONS = Object.freeze({
  숲: { label: "숲", elements: ["숲", "바람"], note: "초보자가 시작하기 좋은 지역입니다." },
  동굴: { label: "동굴", elements: ["바위", "그림자"], note: "단단하고 희귀한 몬스터가 자주 보입니다." },
  바다: { label: "바다", elements: ["물결"], note: "물결 속성 몬스터를 노리기 좋습니다." },
  화산: { label: "화산", elements: ["불꽃", "바위"], note: "불꽃 속성 성장 재료가 잘 나옵니다." },
  랜덤: { label: "랜덤", elements: [], note: "모든 속성이 고르게 등장합니다." }
});
const PIXEL_MONSTER_EVOLUTION_STAGES = Object.freeze([
  { stage: 1, level: 5, shards: 3, suffix: "성장형", powerBonus: 8 },
  { stage: 2, level: 15, shards: 10, suffix: "진화형", powerBonus: 20 },
  { stage: 3, level: 30, shards: 25, suffix: "완전체", powerBonus: 45 }
]);
const PIXEL_MONSTER_DEX_REWARD_THRESHOLDS = Object.freeze([10, 30, 50, 100]);
const PIXEL_MONSTER_BOSS_DAILY_LIMIT = 3;
const PIXEL_MONSTER_NAME_PARTS = Object.freeze(["몽", "리프", "코어", "루미", "플레어", "아쿠", "윈디", "쉐도", "바니", "토리", "라온", "미루"]);
const PIXEL_MONSTER_SPECIES = Object.freeze(Array.from({ length: PIXEL_MONSTER_SPECIES_COUNT }, (_, index) => {
  const rarity = PIXEL_MONSTER_RARITIES[Math.min(PIXEL_MONSTER_RARITIES.length - 1, Math.floor(index / 45))];
  const element = PIXEL_MONSTER_ELEMENTS[index % PIXEL_MONSTER_ELEMENTS.length];
  const name = `픽셀${PIXEL_MONSTER_NAME_PARTS[index % PIXEL_MONSTER_NAME_PARTS.length]}${String(index + 1).padStart(3, "0")}`;
  return {
    speciesId: `pm${String(index + 1).padStart(3, "0")}`,
    name,
    element,
    rarity: rarity.id,
    rarityLabel: rarity.label,
    catchRate: rarity.catchRate,
    basePower: 8 + index
  };
}));
const LUNCH_MENU_ITEMS = Object.freeze([
  { name: "김치찌개", categories: ["한식", "든든한 음식", "배달 추천"], note: "뜨끈하고 실패 확률 낮은 메뉴입니다." },
  { name: "된장찌개", categories: ["한식", "가벼운 음식", "혼밥 추천"], note: "속 편하게 먹기 좋습니다." },
  { name: "제육볶음", categories: ["한식", "매운 음식", "든든한 음식"], note: "밥이 바로 생각나는 선택입니다." },
  { name: "불고기백반", categories: ["한식", "든든한 음식"], note: "무난하지만 만족도가 높습니다." },
  { name: "비빔밥", categories: ["한식", "가벼운 음식", "혼밥 추천"], note: "채소와 밥을 균형 있게 먹기 좋습니다." },
  { name: "순두부찌개", categories: ["한식", "매운 음식", "배달 추천"], note: "칼칼하게 기분 전환하기 좋습니다." },
  { name: "닭갈비", categories: ["한식", "매운 음식", "든든한 음식"], note: "여럿이 먹기 좋은 점심입니다." },
  { name: "갈비탕", categories: ["한식", "국밥", "든든한 음식"], note: "든든하게 체력 보충하기 좋습니다." },
  { name: "짜장면", categories: ["중식", "면류", "배달 추천"], note: "빠르고 익숙한 선택입니다." },
  { name: "짬뽕", categories: ["중식", "면류", "매운 음식"], note: "얼큰한 국물이 필요할 때 좋습니다." },
  { name: "볶음밥", categories: ["중식", "든든한 음식", "혼밥 추천"], note: "간단하지만 포만감이 좋습니다." },
  { name: "마파두부덮밥", categories: ["중식", "매운 음식", "도시락"], note: "매콤하고 부드러운 밥 메뉴입니다." },
  { name: "탕수육덮밥", categories: ["중식", "든든한 음식", "배달 추천"], note: "바삭한 맛이 필요할 때 좋습니다." },
  { name: "유산슬밥", categories: ["중식", "가벼운 음식"], note: "자극을 줄이고 싶을 때 어울립니다." },
  { name: "고추잡채밥", categories: ["중식", "매운 음식", "든든한 음식"], note: "매콤한 볶음 메뉴가 당길 때 좋습니다." },
  { name: "중화비빔밥", categories: ["중식", "매운 음식", "혼밥 추천"], note: "짬뽕보다 밥이 당길 때 추천합니다." },
  { name: "초밥", categories: ["일식", "가벼운 음식", "혼밥 추천"], note: "깔끔하게 먹기 좋습니다." },
  { name: "돈카츠", categories: ["일식", "든든한 음식"], note: "바삭한 한 끼가 필요할 때 좋습니다." },
  { name: "규동", categories: ["일식", "덮밥", "혼밥 추천"], note: "빠르게 먹기 좋은 덮밥입니다." },
  { name: "라멘", categories: ["일식", "면류", "든든한 음식"], note: "국물과 면이 같이 당길 때 좋습니다." },
  { name: "우동", categories: ["일식", "면류", "가벼운 음식"], note: "따뜻하고 부담이 적습니다." },
  { name: "가츠동", categories: ["일식", "든든한 음식", "도시락"], note: "돈카츠와 밥을 한 번에 해결합니다." },
  { name: "냉소바", categories: ["일식", "면류", "가벼운 음식"], note: "더운 날 가볍게 먹기 좋습니다." },
  { name: "연어덮밥", categories: ["일식", "덮밥", "혼밥 추천"], note: "깔끔한 점심으로 좋습니다." },
  { name: "파스타", categories: ["양식", "면류", "배달 추천"], note: "느긋한 점심 분위기에 어울립니다." },
  { name: "리조또", categories: ["양식", "든든한 음식"], note: "부드럽고 든든합니다." },
  { name: "함박스테이크", categories: ["양식", "든든한 음식", "도시락"], note: "밥과 소스 조합이 좋습니다." },
  { name: "샐러드파스타", categories: ["양식", "다이어트식", "가벼운 음식"], note: "가볍게 먹고 싶을 때 좋습니다." },
  { name: "그릴치킨", categories: ["양식", "다이어트식", "든든한 음식"], note: "단백질 챙기기 좋은 선택입니다." },
  { name: "피자", categories: ["양식", "패스트푸드", "배달 추천"], note: "나눠 먹기 좋은 메뉴입니다." },
  { name: "오므라이스", categories: ["양식", "도시락", "혼밥 추천"], note: "부드럽고 무난합니다." },
  { name: "스테이크덮밥", categories: ["양식", "든든한 음식"], note: "조금 특별한 점심으로 좋습니다." },
  { name: "떡볶이", categories: ["분식", "매운 음식", "배달 추천"], note: "매콤한 기분 전환 메뉴입니다." },
  { name: "김밥", categories: ["분식", "가벼운 음식", "혼밥 추천"], note: "간단하고 빠릅니다." },
  { name: "라볶이", categories: ["분식", "면류", "매운 음식"], note: "분식과 면을 같이 즐깁니다." },
  { name: "순대", categories: ["분식", "든든한 음식"], note: "떡볶이와 같이 먹어도 좋습니다." },
  { name: "튀김", categories: ["분식", "배달 추천"], note: "바삭한 사이드가 필요할 때 좋습니다." },
  { name: "쫄면", categories: ["분식", "면류", "매운 음식"], note: "새콤매콤하게 입맛을 살립니다." },
  { name: "잔치국수", categories: ["분식", "면류", "가벼운 음식"], note: "편하게 먹기 좋은 국수입니다." },
  { name: "참치김밥", categories: ["분식", "도시락", "혼밥 추천"], note: "간단하지만 든든합니다." },
  { name: "햄버거", categories: ["패스트푸드", "배달 추천", "혼밥 추천"], note: "빠르게 한 끼 해결하기 좋습니다." },
  { name: "치킨버거", categories: ["패스트푸드", "든든한 음식"], note: "바삭한 식감이 좋습니다." },
  { name: "샌드위치", categories: ["패스트푸드", "가벼운 음식", "다이어트식"], note: "회의 사이에 먹기 편합니다." },
  { name: "타코", categories: ["패스트푸드", "양식"], note: "색다른 점심으로 좋습니다." },
  { name: "브리또", categories: ["패스트푸드", "든든한 음식"], note: "손쉽게 먹는 든든한 메뉴입니다." },
  { name: "핫도그", categories: ["패스트푸드", "가벼운 음식"], note: "간단히 먹기 좋습니다." },
  { name: "치킨랩", categories: ["패스트푸드", "다이어트식", "가벼운 음식"], note: "가볍지만 단백질도 챙깁니다." },
  { name: "감자튀김세트", categories: ["패스트푸드", "배달 추천"], note: "가볍게 즐기는 패스트푸드입니다." },
  { name: "돼지국밥", categories: ["국밥", "한식", "든든한 음식"], note: "든든함이 필요한 날 추천합니다." },
  { name: "순대국밥", categories: ["국밥", "한식", "든든한 음식"], note: "오래 가는 포만감이 있습니다." },
  { name: "콩나물국밥", categories: ["국밥", "가벼운 음식", "해장"], note: "시원하고 부담이 적습니다." },
  { name: "설렁탕", categories: ["국밥", "한식", "든든한 음식"], note: "부드럽게 속을 채우기 좋습니다." },
  { name: "육개장", categories: ["국밥", "매운 음식", "든든한 음식"], note: "얼큰하게 힘내기 좋습니다." },
  { name: "뼈해장국", categories: ["국밥", "매운 음식", "든든한 음식"], note: "오후 체력이 필요할 때 좋습니다." },
  { name: "소고기국밥", categories: ["국밥", "한식", "든든한 음식"], note: "고기와 국물이 안정적입니다." },
  { name: "굴국밥", categories: ["국밥", "가벼운 음식"], note: "깔끔한 국물 메뉴입니다." },
  { name: "칼국수", categories: ["면류", "한식", "든든한 음식"], note: "따뜻한 면이 당길 때 좋습니다." },
  { name: "냉면", categories: ["면류", "한식", "가벼운 음식"], note: "시원하게 먹기 좋습니다." },
  { name: "비빔국수", categories: ["면류", "매운 음식", "가벼운 음식"], note: "새콤매콤하게 가볍습니다." },
  { name: "잔치국수", categories: ["면류", "가벼운 음식", "혼밥 추천"], note: "부담 없는 국수 메뉴입니다." },
  { name: "쌀국수", categories: ["면류", "가벼운 음식", "배달 추천"], note: "국물이 깔끔합니다." },
  { name: "탄탄면", categories: ["면류", "중식", "매운 음식"], note: "고소하고 매콤합니다." },
  { name: "팟타이", categories: ["면류", "양식", "배달 추천"], note: "색다른 면 요리입니다." },
  { name: "김치우동", categories: ["면류", "일식", "매운 음식"], note: "뜨끈하고 실패 확률 낮은 메뉴입니다." },
  { name: "제육도시락", categories: ["도시락", "한식", "든든한 음식"], note: "회사 점심으로 안정적입니다." },
  { name: "치킨마요덮밥", categories: ["도시락", "든든한 음식", "혼밥 추천"], note: "달달하고 든든합니다." },
  { name: "불고기도시락", categories: ["도시락", "한식"], note: "무난하게 먹기 좋습니다." },
  { name: "연어도시락", categories: ["도시락", "일식", "가벼운 음식"], note: "깔끔한 도시락입니다." },
  { name: "닭가슴살도시락", categories: ["도시락", "다이어트식", "가벼운 음식"], note: "식단 관리에 좋습니다." },
  { name: "소시지야채볶음도시락", categories: ["도시락", "든든한 음식"], note: "익숙한 반찬 조합입니다." },
  { name: "돈까스도시락", categories: ["도시락", "일식", "든든한 음식"], note: "바삭한 도시락입니다." },
  { name: "참치마요덮밥", categories: ["도시락", "혼밥 추천"], note: "간단하고 빠르게 먹습니다." },
  { name: "닭가슴살샐러드", categories: ["다이어트식", "가벼운 음식"], note: "가볍게 단백질을 챙깁니다." },
  { name: "연어샐러드", categories: ["다이어트식", "가벼운 음식"], note: "깔끔하고 산뜻합니다." },
  { name: "포케", categories: ["다이어트식", "가벼운 음식", "혼밥 추천"], note: "밥과 채소를 균형 있게 먹습니다." },
  { name: "두부덮밥", categories: ["다이어트식", "한식", "가벼운 음식"], note: "부담이 적은 밥 메뉴입니다." },
  { name: "곤약비빔면", categories: ["다이어트식", "면류", "매운 음식"], note: "가볍게 매콤함을 챙깁니다." },
  { name: "샐러드랩", categories: ["다이어트식", "패스트푸드", "가벼운 음식"], note: "손쉽게 먹는 가벼운 점심입니다." },
  { name: "현미도시락", categories: ["다이어트식", "도시락"], note: "식단 관리에 안정적입니다." },
  { name: "오트밀닭죽", categories: ["다이어트식", "가벼운 음식"], note: "속이 편한 메뉴입니다." },
  { name: "불닭덮밥", categories: ["매운 음식", "도시락", "든든한 음식"], note: "강한 매운맛이 필요할 때 좋습니다." },
  { name: "마라탕", categories: ["매운 음식", "중식", "배달 추천"], note: "입맛을 확 깨웁니다." },
  { name: "마라샹궈", categories: ["매운 음식", "중식", "든든한 음식"], note: "매운 볶음이 당길 때 좋습니다." },
  { name: "낙지덮밥", categories: ["매운 음식", "한식", "든든한 음식"], note: "매콤하게 힘내기 좋습니다." },
  { name: "매운갈비찜", categories: ["매운 음식", "한식", "배달 추천"], note: "든든한 매운 메뉴입니다." },
  { name: "쭈꾸미볶음", categories: ["매운 음식", "한식"], note: "밥과 잘 맞는 매콤함입니다." },
  { name: "김치볶음밥", categories: ["매운 음식", "한식", "혼밥 추천"], note: "간단하고 익숙합니다." },
  { name: "얼큰칼국수", categories: ["매운 음식", "면류"], note: "칼칼한 국물이 좋습니다." },
  { name: "계란찜정식", categories: ["가벼운 음식", "한식"], note: "부드럽고 편안합니다." },
  { name: "죽", categories: ["가벼운 음식", "한식", "혼밥 추천"], note: "속이 예민한 날 좋습니다." },
  { name: "토스트", categories: ["가벼운 음식", "패스트푸드"], note: "짧은 점심에 어울립니다." },
  { name: "메밀소바", categories: ["가벼운 음식", "면류", "일식"], note: "깔끔하게 먹기 좋습니다." },
  { name: "카프레제샐러드", categories: ["가벼운 음식", "양식", "다이어트식"], note: "산뜻한 점심입니다." },
  { name: "닭죽", categories: ["가벼운 음식", "한식"], note: "부담 없이 든든합니다." },
  { name: "오니기리", categories: ["가벼운 음식", "일식", "혼밥 추천"], note: "간단히 먹기 좋습니다." },
  { name: "유부초밥", categories: ["가벼운 음식", "일식", "도시락"], note: "달달하고 가볍습니다." },
  { name: "보쌈정식", categories: ["든든한 음식", "한식"], note: "포만감이 오래 갑니다." },
  { name: "찜닭", categories: ["든든한 음식", "한식", "배달 추천"], note: "여럿이 먹기 좋습니다." },
  { name: "삼겹살정식", categories: ["든든한 음식", "한식"], note: "제대로 먹고 싶은 날 추천합니다." },
  { name: "부대찌개", categories: ["든든한 음식", "한식", "매운 음식"], note: "밥과 국물이 모두 좋습니다." },
  { name: "닭곰탕", categories: ["든든한 음식", "국밥"], note: "담백하게 체력을 채웁니다." },
  { name: "카레라이스", categories: ["든든한 음식", "일식", "혼밥 추천"], note: "빠르고 안정적인 메뉴입니다." },
  { name: "고기국수", categories: ["든든한 음식", "면류"], note: "면이지만 포만감이 큽니다." },
  { name: "치즈돈카츠", categories: ["든든한 음식", "일식"], note: "고소하고 든든합니다." },
  { name: "치킨", categories: ["배달 추천", "패스트푸드", "든든한 음식"], note: "나눠 먹기 좋은 배달 메뉴입니다." },
  { name: "족발", categories: ["배달 추천", "한식", "든든한 음식"], note: "회의 후 점심에도 잘 맞습니다." },
  { name: "보쌈", categories: ["배달 추천", "한식", "든든한 음식"], note: "깔끔하게 고기 먹기 좋습니다." },
  { name: "분짜", categories: ["배달 추천", "면류", "가벼운 음식"], note: "상큼한 면 요리입니다." },
  { name: "닭강정", categories: ["배달 추천", "패스트푸드"], note: "달콤바삭한 점심입니다." },
  { name: "김치찜", categories: ["배달 추천", "한식", "매운 음식"], note: "밥이 잘 들어갑니다." },
  { name: "샤브샤브", categories: ["배달 추천", "가벼운 음식"], note: "채소와 고기를 같이 먹습니다." },
  { name: "로제떡볶이", categories: ["배달 추천", "분식"], note: "부드러운 매콤함입니다." },
  { name: "혼밥김치찌개", categories: ["혼밥 추천", "한식", "든든한 음식"], note: "혼자 먹기 좋은 찌개입니다." },
  { name: "컵밥", categories: ["혼밥 추천", "도시락"], note: "빠르게 먹기 좋습니다." },
  { name: "덮밥", categories: ["혼밥 추천", "도시락", "든든한 음식"], note: "선택지가 넓은 한 그릇입니다." },
  { name: "미니우동세트", categories: ["혼밥 추천", "일식", "면류"], note: "가볍게 세트로 먹기 좋습니다." },
  { name: "삼각김밥세트", categories: ["혼밥 추천", "가벼운 음식"], note: "시간이 없을 때 좋습니다." },
  { name: "편의점도시락", categories: ["혼밥 추천", "도시락"], note: "가장 빠른 현실적 선택입니다." },
  { name: "버섯덮밥", categories: ["혼밥 추천", "가벼운 음식"], note: "담백한 한 그릇입니다." },
  { name: "소고기덮밥", categories: ["혼밥 추천", "든든한 음식"], note: "혼밥이어도 든든합니다." }
]);
const LUNCH_CATEGORY_ALIASES = Object.freeze({
  매운거: "매운 음식",
  매운것: "매운 음식",
  매운: "매운 음식",
  가벼운거: "가벼운 음식",
  가벼운것: "가벼운 음식",
  가볍게: "가벼운 음식",
  든든한거: "든든한 음식",
  든든한것: "든든한 음식",
  든든: "든든한 음식",
  배달: "배달 추천",
  혼밥: "혼밥 추천",
  랜덤: "",
  아무거나: ""
});
const PET_SPECIES = Object.freeze(["몽실펫", "콩알펫", "루미펫", "토리펫"]);
const EXPLORE_REWARD_ITEMS = Object.freeze([
  { id: 9101, name: "낡은 보물상자", sellPrice: 45, description: "탐험에서 발견한 작은 보물상자", category: "explore", rarity: "common" },
  { id: 9102, name: "반짝이는 수정", sellPrice: 75, description: "빛을 머금은 탐험 보상", category: "explore", rarity: "uncommon" },
  { id: 9103, name: "픽셀곰 표식", sellPrice: 120, description: "픽셀곰 발자국이 새겨진 표식", category: "explore", rarity: "rare" },
  { id: 9104, name: "고대 지도 조각", sellPrice: 220, description: "다음 모험을 암시하는 지도 조각", category: "explore", rarity: "epic" },
  { id: 9105, name: "별빛 유물", sellPrice: 600, description: "희귀한 탐험 전리품", category: "explore", rarity: "legendary" }
]);
const SYSTEM_PRODUCTS = Object.freeze([
  {
    id: BAIT_ITEM_ID,
    name: "기본 미끼",
    price: 20,
    sellPrice: 10,
    description: "낚시에 사용하는 기본 미끼",
    active: true,
    system: true,
    category: "bait"
  },
  {
    id: CAPTURE_STONE_ITEM_ID,
    name: "기본 포획석",
    price: 30,
    sellPrice: 15,
    description: "픽셀몬스터 포획에 사용하는 기본 도구",
    active: true,
    system: true,
    category: "capture"
  },
  {
    id: PET_SNACK_ITEM_ID,
    name: "펫 간식",
    price: 15,
    sellPrice: 7,
    description: "펫 친밀도를 올리는 간식",
    active: true,
    system: true,
    category: "pet"
  },
  {
    id: AUTO_HUNT_TICKET_ITEM_ID,
    name: "자동던전권",
    price: 250,
    sellPrice: 100,
    description: "RPG 던전 10회를 한 번에 요약 처리하는 티켓",
    active: true,
    system: true,
    category: "rpg_ticket",
    rarity: "uncommon",
    gradeLabel: "고급"
  },
  {
    id: AUTO_EXPLORE_TICKET_ITEM_ID,
    name: "자동탐험권",
    price: 160,
    sellPrice: 60,
    description: "탐험 10회를 한 번에 요약 처리하는 티켓",
    active: true,
    system: true,
    category: "explore_ticket",
    rarity: "uncommon",
    gradeLabel: "고급"
  },
  {
    id: AUTO_FISHING_TICKET_ITEM_ID,
    name: "자동낚시권",
    price: 180,
    sellPrice: 70,
    description: "미끼를 소비해 낚시 10회를 한 번에 요약 처리하는 티켓",
    active: true,
    system: true,
    category: "fishing_ticket",
    rarity: "uncommon",
    gradeLabel: "고급"
  },
  {
    id: AUTO_DRAW_TICKET_ITEM_ID,
    name: "자동뽑기권",
    price: 140,
    sellPrice: 50,
    description: "포인트 뽑기 10회를 한 번에 요약 처리하는 티켓",
    active: true,
    system: true,
    category: "draw_ticket",
    rarity: "uncommon",
    gradeLabel: "고급"
  },
  {
    id: ENHANCEMENT_STONE_ITEM_ID,
    name: "강화석",
    price: 120,
    sellPrice: 45,
    description: "RPG 장비 강화에 사용하는 재료",
    active: true,
    system: true,
    category: "rpg_enhance",
    rarity: "uncommon",
    gradeLabel: "고급"
  },
  ...RPG_PRECIOUS_DROPS.map((item) => ({
    id: item.id,
    name: item.name,
    price: item.sellPrice * 2,
    sellPrice: item.sellPrice,
    description: `던전에서 낮은 확률로 발견되는 ${item.name} 보상`,
    active: true,
    system: true,
    category: "rpg_treasure",
    rarity: item.rarity,
    gradeLabel: item.rarity === "legendary" ? "전설" : item.rarity === "epic" ? "영웅" : "희귀"
  })),
  ...EXPLORE_REWARD_ITEMS.map((item) => ({
    ...item,
    price: item.sellPrice * 2,
    active: true,
    system: true
  })),
  ...RPG_ADVENTURE_ITEMS,
  ...RPG_WEAPON_RECIPES.map((recipe) => ({
    id: recipe.itemId,
    name: recipe.name,
    price: recipe.sellPrice * 2,
    sellPrice: recipe.sellPrice,
    description: recipe.description,
    active: true,
    system: true,
    category: recipe.slot || "weapon",
    slot: recipe.slot || "weapon",
    slotLabel: RPG_EQUIPMENT_SLOT_LABELS[recipe.slot || "weapon"] || "장비",
    setId: recipe.setId || "",
    setName: recipe.setId ? RPG_EQUIPMENT_SETS[recipe.setId]?.name || "" : "",
    rarity: recipe.power >= 15 ? "rare" : recipe.power >= 9 ? "uncommon" : "common",
    gradeLabel: recipe.power >= 15 ? "희귀" : recipe.power >= 9 ? "고급" : "일반",
    power: recipe.power,
    stats: rpgEquipmentStats(recipe),
    levelLimit: recipe.levelLimit || 1,
    jobLimit: recipe.jobLimit || "",
    enhancement: recipe.enhancement || 0,
    specialOptions: recipe.specialOptions || [],
    magicSkill: recipe.magicSkill || ""
  })),
  ...FISH_SPECIES.flatMap((species, speciesIndex) => FISH_GRADES.map((grade, gradeIndex) => {
    const id = FISH_ITEM_ID_START + (speciesIndex * FISH_GRADE_COUNT) + gradeIndex;
    const sellPrice = grade.sellBase + (speciesIndex * grade.sellStep);
    return {
      id,
      name: `${grade.label} ${species}`,
      price: sellPrice * 2,
      sellPrice,
      description: `${grade.label} 등급 낚시 물고기`,
      active: true,
      system: true,
      category: "fish",
      rarity: grade.id,
      gradeLabel: grade.label,
      species
    };
  }))
]);
const SYSTEM_PRODUCT_MAP = new Map(SYSTEM_PRODUCTS.map((product) => [String(product.id), product]));
const FUNCTIONAL_SHOP_ITEM_GUIDES = Object.freeze([
  { name: "자동던전권", aliases: ["자동사냥권"], systemId: AUTO_HUNT_TICKET_ITEM_ID, use: "/자동던전", example: "/상점추가 자동던전권 250 던전 10회 자동던전 티켓" },
  { name: "자동탐험권", systemId: AUTO_EXPLORE_TICKET_ITEM_ID, use: "/자동탐험", example: "/상점추가 자동탐험권 160 탐험 10회 자동탐험 티켓" },
  { name: "자동낚시권", systemId: AUTO_FISHING_TICKET_ITEM_ID, use: "/자동낚시", example: "/상점추가 자동낚시권 180 낚시 10회 자동낚시 티켓" },
  { name: "자동뽑기권", systemId: AUTO_DRAW_TICKET_ITEM_ID, use: "/자동뽑기", example: "/상점추가 자동뽑기권 140 뽑기 10회 자동뽑기 티켓" },
  { name: "강화석", systemId: ENHANCEMENT_STONE_ITEM_ID, use: "/강화", example: "/상점추가 강화석 120 장비 강화 재료" },
  { name: "기본 미끼", systemId: BAIT_ITEM_ID, use: "/낚시", example: "/상점추가 기본 미끼 20 낚시용 미끼" },
  { name: "기본 포획석", systemId: CAPTURE_STONE_ITEM_ID, use: "/포획", example: "/상점추가 기본 포획석 30 몬스터 포획 도구" },
  { name: "펫 간식", systemId: PET_SNACK_ITEM_ID, use: "/펫먹이", example: "/상점추가 펫 간식 15 펫 돌봄 간식" }
]);
const MAX_LIKE_AMOUNT = 999;
const STORE_TEMPLATE_VERSION = 2;
const COMMAND_INSTALL_DRAFT_TTL_MS = 10 * 60 * 1000;
const COMMAND_INSTALL_MAX_CODES = 20;

const COMMAND_TEMPLATE_CATEGORY_CONFIGS = Object.freeze([
  {
    id: "basic-ops",
    title: "기본 운영",
    audience: "participant",
    kind: "custom",
    words: ["공지", "규칙", "문의", "운영진", "방소개", "초보안내", "인사", "자주묻는질문", "시간표"],
    actions: ["안내", "요약", "확인", "바로보기", "오늘", "필수", "모음", "처음"]
  },
  {
    id: "participant",
    title: "참여자용",
    audience: "participant",
    kind: "custom",
    words: ["프로필양식", "닉네임규칙", "입장인사", "대화주제", "자기소개", "오늘질문", "친구찾기", "방분위기", "참여팁", "활동안내"],
    actions: ["보기", "작성", "확인", "추천", "시작", "예시", "가이드", "체크"]
  },
  {
    id: "admin",
    title: "관리자용",
    audience: "admin",
    kind: "custom",
    words: ["점검공지", "경고안내", "운영메모", "제재기준", "상점공지", "관리규칙", "휴방안내"],
    actions: ["양식", "공지", "체크", "기록", "안내", "템플릿", "요약", "보고"]
  },
  {
    id: "chance-game",
    title: "확률게임",
    audience: "participant",
    kind: "game-template",
    words: ["행운상자", "복권", "카드뽑기", "동전던지기", "랜덤박스", "룰렛", "보물상자", "주사위", "운세뽑기", "별뽑기"],
    actions: ["안내", "확률", "보상표", "시작", "랭킹", "주의", "시즌", "참여"]
  },
  {
    id: "pet",
    title: "펫키우기",
    audience: "participant",
    kind: "game-template",
    words: ["펫입양", "밥주기", "산책", "놀아주기", "펫상태", "펫상점", "펫훈련", "펫진화", "펫랭킹", "펫선물"],
    actions: ["안내", "방법", "보상", "쿨타임", "아이템", "성장", "시즌", "도움말"]
  },
  {
    id: "rpg",
    title: "RPG/탐험",
    audience: "participant",
    kind: "game-template",
    words: ["탐험", "던전", "채집", "광산", "낚시터", "보스", "퀘스트", "장비", "스킬", "길드"],
    actions: ["안내", "시작", "보상", "랭킹", "상점", "강화", "시즌", "도움말"]
  },
  {
    id: "shop-item",
    title: "상점/아이템",
    audience: "participant",
    kind: "custom",
    words: ["상점안내", "아이템목록", "가방안내", "구매방법", "선물방법", "사용방법", "포인트안내", "보상교환", "시즌상품"],
    actions: ["보기", "안내", "예시", "규칙", "추천", "확인", "도움말", "주의"]
  },
  {
    id: "event-season",
    title: "이벤트/시즌",
    audience: "participant",
    kind: "custom",
    words: ["출석이벤트", "랭킹이벤트", "신규이벤트", "주말이벤트", "시즌공지", "보상안내", "미션", "챌린지", "기념일"],
    actions: ["안내", "참여", "보상", "기간", "규칙", "현황", "결과", "예정"]
  },
  {
    id: "community-fun",
    title: "커뮤니티/재미",
    audience: "participant",
    kind: "custom",
    words: ["오늘운세", "밸런스게임", "칭찬", "응원문구", "랜덤질문", "오늘메뉴", "심심풀이", "익명사연", "분위기전환"],
    actions: ["시작", "추천", "보기", "뽑기", "나누기", "참여", "예시", "모음"]
  },
  {
    id: "ai-helper",
    title: "AI 운영도우미 후보",
    audience: "admin",
    kind: "roadmap",
    words: ["공지초안", "규칙검토", "문의답변", "운영문구", "이벤트초안", "신고요약", "프로필검토", "채팅요약", "분위기분석", "도움말추천"],
    actions: ["후보", "초안", "검토", "요약", "추천", "정리", "자동화", "가이드"]
  }
]);

const COMMAND_TEMPLATE_BUNDLES = Object.freeze([
  {
    id: "bundle-ops-starter",
    categoryId: "bundle-ops",
    categoryTitle: "추천 세트",
    title: "운영 기본 세트",
    command: "4개 명령어 세트",
    trigger: "운영기본세트",
    audience: "participant",
    kind: "bundle",
    installable: true,
    editable: true,
    description: "공지, 규칙, 문의, 프로필양식을 한 번에 설치하는 기본 운영 세트입니다.",
    response: "오픈채팅방 기본 운영에 필요한 안내 문구 4개를 한 번에 설치합니다.",
    commands: [
      { trigger: "/공지", response: "오늘 공지는 여기입니다.\n\n중요한 내용은 이 메시지 아래에 이어서 안내해 주세요." },
      { trigger: "/규칙", response: "두글자 닉네임 뒤에 성별을 붙여주세요.\n예: 곰돌 남, 하늘 여" },
      { trigger: "/문의", response: "문의는 운영진에게 남겨주세요.\n확인 후 순서대로 답변드리겠습니다." },
      { trigger: "/프로필양식", response: "프로필 양식\n닉네임:\n성별:\n나이대:\n관심사:\n한마디:" }
    ],
    tags: ["세트", "운영", "공지", "규칙", "프로필", "추천"]
  },
  {
    id: "bundle-event-season",
    categoryId: "bundle-event",
    categoryTitle: "이벤트 세트",
    title: "이벤트 운영 세트",
    command: "4개 명령어 세트",
    trigger: "이벤트운영세트",
    audience: "participant",
    kind: "bundle",
    installable: true,
    editable: true,
    description: "이벤트 안내, 기간, 보상, 결과 공지를 같이 운영할 수 있는 세트입니다.",
    response: "이벤트 진행에 필요한 안내 문구 4개를 한 번에 설치합니다.",
    commands: [
      { trigger: "/이벤트", response: "진행 중인 이벤트 안내입니다.\n참여 방법과 기간을 확인해 주세요." },
      { trigger: "/이벤트기간", response: "이벤트 기간은 운영진 공지 기준으로 진행됩니다." },
      { trigger: "/이벤트보상", response: "이벤트 보상은 참여 조건 확인 후 순서대로 지급됩니다." },
      { trigger: "/이벤트결과", response: "이벤트 결과는 집계 후 이 명령어로 안내됩니다." }
    ],
    tags: ["세트", "이벤트", "시즌", "보상", "결과"]
  },
  {
    id: "bundle-shop-guide",
    categoryId: "bundle-shop",
    categoryTitle: "상점 세트",
    title: "상점 안내 세트",
    command: "4개 안내 세트",
    trigger: "상점안내세트",
    audience: "participant",
    kind: "bundle",
    installable: true,
    editable: true,
    description: "기본 상점/가방 명령어를 설명하는 안내용 커스텀 세트입니다. 고정 명령어 자체는 덮어쓰지 않습니다.",
    response: "상점, 구매, 가방, 선물 사용법을 안내하는 문구 4개를 설치합니다.",
    commands: [
      { trigger: "/상점안내", response: "상점 이용 안내\n/상점 으로 상품을 확인하고 /구매 번호 로 구매할 수 있습니다." },
      { trigger: "/구매안내", response: "구매 방법\n/구매 번호 형식으로 입력하면 포인트로 상품을 구매합니다." },
      { trigger: "/가방안내", response: "가방 이용 안내\n/가방 으로 보유 아이템을 확인하고 /사용 번호 로 사용할 수 있습니다." },
      { trigger: "/선물안내", response: "아이템 선물 안내\n/가방선물 닉네임 번호 수량 형식으로 선물할 수 있습니다." }
    ],
    tags: ["세트", "상점", "가방", "아이템", "안내"]
  },
  {
    id: "bundle-mini-games",
    categoryId: "bundle-game",
    categoryTitle: "게임 세트",
    title: "미니게임 연결 세트",
    command: "3개 게임 세트",
    trigger: "미니게임세트",
    audience: "participant",
    kind: "bundle",
    installable: true,
    editable: true,
    description: "주사위, 낚시, 탐험을 방 분위기에 맞는 별도 명령어로 연결합니다.",
    response: "현재 픽셀곰 미니게임 엔진에 바로 연결되는 명령어 3개를 설치합니다.",
    commands: [
      { trigger: "/운영주사위", response: "주사위 게임을 시작합니다.", proxyCommand: "/주사위" },
      { trigger: "/운영낚시", response: "낚시 게임을 시작합니다.", proxyCommand: "/낚시" },
      { trigger: "/운영탐험", response: "탐험 게임을 시작합니다.", proxyCommand: "/탐험" }
    ],
    tags: ["세트", "게임", "주사위", "낚시", "탐험", "연결"]
  }
]);

const ADMIN_MANAGEMENT_COMMANDS = Object.freeze([
  "/포인트지급", "/포인트차감", "/포인트설정",
  "/상점추가", "/상점수정", "/상점삭제", "/상점정리", "/상점초기화", "/상점내역",
  "/아이템지급", "/아이템회수", "/기능아이템목록",
  "/닉병합"
]);
const COMMAND_PACK_ALWAYS_INSTALLED_COMMANDS = Object.freeze([
  "/상태", "/도움말", "/메뉴", "/처음", "/시작", "/추천", "/찾기", "/명령어", "/오늘할일", "/판매추천", "/정리추천", "/방등록", "/신고", "/신고목록", "/신고처리",
  "/명령어검색", "/명령어설치", "/설치확인", "/설치취소", "/명령어설치목록",
  "/명령어팩", "/명령어팩목록", "/명령어팩제거", "/게임팩도움말", "/점메추", "/내별명", "/별명목록",
  ...ADMIN_MANAGEMENT_COMMANDS
]);

const COMMAND_PACK_COMMANDS = Object.freeze({
  "ops-core": ["/상태", "/도움말", "/브릿지", "/js상태", "/메시지", "/날씨", "/운세", "/신고"],
  "attendance-growth": ["/출석", "/미출석", "/출석순위", "/포인트", "/내정보", "/포인트순위"],
  "point-economy": ["/포인트", "/내정보", "/좋아요", "/응원", "/이체", "/포인트순위", "/좋아요순위", "/레벨순위"],
  "game-chance": ["/게임", "/확률게임", "/오늘할일", "/주사위", "/낚시", "/자동낚시", "/탐험", "/자동탐험", "/자동모험", "/뽑기", "/자동뽑기", "/뽑기목록", "/홀", "/짝", "/홀짝", "/코인", "/룰렛", "/슬롯", "/복권", "/하이로우", "/폭탄피하기", "/보물상자", "/미끼상점", "/미끼구매", "/어항", "/수족관", "/포인트"],
  "rpg-adventure": ["/모험", "/던전", "/던전목록", "/자동던전", "/자동탐험", "/자동모험", "/자동낚시", "/자동뽑기", "/대장간", "/제작가능", "/제작", "/자동제작", "/강화", "/강화목록", "/강화상세", "/보상선택", "/장비", "/장비상세", "/스탯", "/장착", "/자동장착", "/세트아이템", "/아이템", "/보유아이템", "/아이템상세", "/판매목록", "/판매미리보기", "/판매추천", "/정리추천", "/일괄판매", "/가방", "/가방정리", "/판매", "/아이템잠금", "/아이템잠금해제", "/잠금목록", "/포인트"],
  "pixel-monster-rpg": ["/몬스터탐험", "/포획", "/몬스터", "/몬스터목록", "/몬스터상세", "/몬스터팀", "/몬스터퀘스트", "/몬스터훈련", "/몬스터전투", "/몬스터진화", "/몬스터보스", "/몬스터도감", "/포인트"],
  "pet-raising": ["/펫입양", "/펫", "/펫먹이", "/펫놀기", "/펫씻기", "/펫재우기", "/펫훈련", "/펫상점", "/포인트"],
  "shop-inventory": ["/상점", "/구매", "/가방", "/가방정리", "/판매추천", "/정리추천", "/아이템상세", "/판매목록", "/판매미리보기", "/사용", "/가방선물", "/판매", "/일괄판매", "/아이템잠금", "/아이템잠금해제", "/잠금목록", "/구매내역", "/기능아이템목록"],
  "custom-command": ["/명령어목록", "/커스텀명령어", "/고정명령어", "/명령어등록", "/명령어수정", "/명령어삭제", "/커스텀등록", "/커스텀수정", "/커스텀삭제"],
  "profile-history": ["/프로필", "/내별명", "/별명목록", "/프로필등록", "/프로필삭제", "/별명등록", "/별명삭제", "/닉병합", "/입퇴장현황", "/닉이력", "/입퇴장상세"],
  "admin-ops": ["/관리자등록", "/관리자삭제", "/관리자재설정", "/관리자초기화", "/관리자목록", "/방등록", "/방정보", "/방목록", "/방삭제", "/기능목록", "/기능", "/기능켜기", "/기능끄기", "/구독상태", "/구독연장", "/구독만료", "/원본로그", "/원본이벤트", "/최근이벤트", "/이벤트로그", "/신고목록", "/신고처리", "/명령어검색", "/명령어설치", "/설치확인", "/설치취소", "/명령어설치목록", "/명령어팩", "/명령어팩목록", "/명령어팩제거", "/게임팩도움말", "/기능아이템목록", ...ADMIN_MANAGEMENT_COMMANDS],
  "event-engagement": ["/출석", "/오늘할일", "/좋아요", "/응원", "/운세", "/날씨", "/채팅오늘", "/채팅금주", "/포인트순위", "/점메추"]
});
const ALL_IN_ONE_PACK_COMMANDS = Object.freeze([...new Set(Object.values(COMMAND_PACK_COMMANDS).flat())]);

const LEGACY_PACK_COMMANDS = Object.freeze({
  "basic-ops": ["/도움말", "/메시지", "/프로필"],
  "basic-ops-plus": ["/도움말", "/메시지", "/출석", "/ㅊㅊ", "/미출석", "/포인트", "/내정보", "/출석순위", "/포인트순위", "/레벨순위", "/프로필"],
  "basic-ops-pro": ["/도움말", "/메시지", "/출석", "/ㅊㅊ", "/미출석", "/포인트", "/내정보", "/출석순위", "/포인트순위", "/레벨순위", "/상점", "/구매", "/구매내역", "/가방", "/사용", "/가방선물", "/판매", "/프로필"],
  "addon-mini-games-3": ["/게임", "/주사위", "/낚시", "/자동낚시", "/탐험", "/자동탐험", "/자동모험", "/뽑기", "/자동뽑기", "/뽑기목록", "/홀", "/짝", "/미끼상점", "/미끼구매", "/어항", "/수족관"]
});

const LEGACY_OPERATING_CUSTOM_COMMANDS = Object.freeze([
  { trigger: "/공지", response: "오늘 공지는 여기입니다.\n\n중요한 내용은 이 메시지 아래에 이어서 안내해 주세요." },
  { trigger: "/규칙", response: "두글자 닉네임 뒤에 성별을 붙여주세요.\n예: 곰돌 남, 하늘 여" },
  { trigger: "/문의", response: "문의는 운영진에게 남겨주세요.\n확인 후 순서대로 답변드리겠습니다." },
  { trigger: "/프로필양식", response: "프로필 양식\n닉네임:\n성별:\n나이대:\n관심사:\n한마디:" }
]);
const LEGACY_PLUS_CUSTOM_COMMANDS = Object.freeze([
  ...LEGACY_OPERATING_CUSTOM_COMMANDS,
  { trigger: "/운영진", response: "운영진 호출이 필요하면 닉네임과 내용을 함께 남겨주세요." },
  { trigger: "/방소개", response: "이 방은 함께 대화하고 이벤트를 즐기는 오픈채팅방입니다.\n처음 오신 분은 규칙을 먼저 확인해 주세요." },
  { trigger: "/입장안내", response: "처음 오신 분은 닉네임 규칙과 프로필 양식을 먼저 확인해 주세요." },
  { trigger: "/자주묻는질문", response: "자주 묻는 질문은 이 안내에 이어서 정리해 주세요.\n필요한 내용은 운영진이 계속 업데이트합니다." }
]);
const LEGACY_PRO_CUSTOM_COMMANDS = Object.freeze([
  ...LEGACY_PLUS_CUSTOM_COMMANDS,
  { trigger: "/이벤트", response: "진행 중인 이벤트 안내입니다.\n참여 방법과 기간을 확인해 주세요." },
  { trigger: "/이벤트기간", response: "이벤트 기간은 운영진 공지 기준으로 진행됩니다." },
  { trigger: "/보상안내", response: "보상은 참여 조건 확인 후 순서대로 지급됩니다." },
  { trigger: "/상점안내", response: "상점 이용 안내\n/상점 으로 상품을 확인하고 /구매 번호 로 구매할 수 있습니다." },
  { trigger: "/경고안내", response: "운영진 안내입니다.\n방 규칙 위반 내용이 확인되어 주의 안내드립니다." },
  { trigger: "/점검공지", response: "운영 점검 안내입니다.\n일부 기능 응답이 잠시 지연될 수 있습니다." }
]);

const COMMAND_PACKS = Object.freeze([
  {
    id: "ops-core",
    slot: "pack",
    version: 1,
    title: "운영 기본팩",
    tier: "Core",
    categoryTitle: "명령어 팩",
    description: "상태, 도움말, 브릿지 진단, 메시지함, 날씨와 운세를 묶은 기본 운영 팩입니다.",
    features: {},
    fixedCommands: COMMAND_PACK_COMMANDS["ops-core"],
    customCommands: [],
    tags: ["기본", "운영", "상태", "메시지", "날씨", "운세"]
  },
  {
    id: "attendance-growth",
    slot: "pack",
    version: 1,
    title: "출석 성장팩",
    tier: "Growth",
    categoryTitle: "명령어 팩",
    description: "출석 체크, 포인트 보상, 레벨 성장과 출석 순위를 제공합니다.",
    features: { attendance: true, points: true, rankings: true },
    fixedCommands: COMMAND_PACK_COMMANDS["attendance-growth"],
    customCommands: [],
    tags: ["출석", "성장", "포인트", "랭킹"]
  },
  {
    id: "point-economy",
    slot: "pack",
    version: 1,
    title: "포인트 경제팩",
    tier: "Economy",
    categoryTitle: "명령어 팩",
    description: "가상 포인트 확인, 이체, 좋아요, 응원과 랭킹을 제공합니다.",
    features: { points: true, rankings: true },
    fixedCommands: COMMAND_PACK_COMMANDS["point-economy"],
    customCommands: [],
    tags: ["포인트", "좋아요", "응원", "이체", "가상"]
  },
  {
    id: "game-chance",
    slot: "pack",
    version: 1,
    title: "게임 확률팩",
    tier: "Game",
    categoryTitle: "명령어 팩",
    description: "채팅방 내부 가상 포인트만 사용하는 주사위, 뽑기, 홀짝, 코인, 룰렛, 슬롯, 복권, 하이로우, 폭탄피하기, 보물상자 10종 게임 팩입니다.",
    features: { games: true, points: true },
    fixedCommands: COMMAND_PACK_COMMANDS["game-chance"],
    customCommands: [],
    tags: ["게임", "뽑기", "홀짝", "확률", "가상포인트", "코인", "룰렛", "슬롯"]
  },
  {
    id: "shop-inventory",
    slot: "pack",
    version: 1,
    title: "상점 가방팩",
    tier: "Shop",
    categoryTitle: "명령어 팩",
    description: "방 내부 가상 아이템 상점, 구매, 가방, 사용, 선물 기능을 제공합니다.",
    features: { shop: true, points: true },
    fixedCommands: COMMAND_PACK_COMMANDS["shop-inventory"],
    customCommands: [],
    tags: ["상점", "가방", "아이템", "구매", "가상"]
  },
  {
    id: "rpg-adventure",
    slot: "pack",
    version: 1,
    title: "RPG 모험팩",
    tier: "RPG",
    categoryTitle: "게임 팩",
    description: "던전, 재료 500종, 제작 가능 목록, 자동 장착, 세트 장비 보너스를 제공합니다.",
    features: { games: true, shop: true, points: true },
    fixedCommands: COMMAND_PACK_COMMANDS["rpg-adventure"],
    customCommands: [],
    tags: ["RPG", "던전", "대장간", "장비", "재료"]
  },
  {
    id: "pixel-monster-rpg",
    slot: "pack",
    version: 1,
    title: "픽셀몬스터 수집팩",
    tier: "Monster",
    categoryTitle: "게임 팩",
    description: "오리지널 픽셀몬스터 탐험, 포획, 훈련, 전투와 도감을 제공합니다.",
    features: { games: true, points: true },
    fixedCommands: COMMAND_PACK_COMMANDS["pixel-monster-rpg"],
    customCommands: [],
    tags: ["몬스터", "수집", "포획", "전투", "도감"]
  },
  {
    id: "pet-raising",
    slot: "pack",
    version: 1,
    title: "펫키우기팩",
    tier: "Pet",
    categoryTitle: "게임 팩",
    description: "개인별 펫 입양, 먹이, 놀기, 씻기, 휴식, 훈련 성장 루프를 제공합니다.",
    features: { games: true, points: true },
    fixedCommands: COMMAND_PACK_COMMANDS["pet-raising"],
    customCommands: [],
    tags: ["펫", "키우기", "성장", "훈련", "개인"]
  },
  {
    id: "custom-command",
    slot: "pack",
    version: 1,
    title: "커스텀 명령어팩",
    tier: "Custom",
    categoryTitle: "명령어 팩",
    description: "방별 커스텀 명령어 조회와 관리자 등록, 수정, 삭제 기능을 제공합니다.",
    features: { customCommands: true },
    fixedCommands: COMMAND_PACK_COMMANDS["custom-command"],
    customCommands: [],
    tags: ["커스텀", "명령어", "관리"]
  },
  {
    id: "profile-history",
    slot: "pack",
    version: 1,
    title: "프로필 히스토리팩",
    tier: "Profile",
    categoryTitle: "명령어 팩",
    description: "프로필, 별명, 입퇴장과 닉네임 이력 관리를 제공합니다.",
    features: { profiles: true, history: true },
    fixedCommands: COMMAND_PACK_COMMANDS["profile-history"],
    customCommands: [],
    tags: ["프로필", "히스토리", "닉이력", "입퇴장"]
  },
  {
    id: "admin-ops",
    slot: "pack",
    version: 1,
    title: "관리자 운영팩",
    tier: "Admin",
    categoryTitle: "명령어 팩",
    description: "방 운영, 관리자, 기능 ON/OFF, 구독과 로그 확인 명령어를 제공합니다.",
    features: { history: true, profiles: true, points: true, shop: true, customCommands: true },
    fixedCommands: COMMAND_PACK_COMMANDS["admin-ops"],
    customCommands: [],
    tags: ["관리자", "운영", "기능", "구독", "로그"]
  },
  {
    id: "event-engagement",
    slot: "pack",
    version: 1,
    title: "이벤트 참여팩",
    tier: "Event",
    categoryTitle: "명령어 팩",
    description: "출석, 응원, 좋아요, 운세, 날씨와 채팅 랭킹을 묶은 참여 유도 팩입니다.",
    features: { attendance: true, points: true, rankings: true },
    fixedCommands: COMMAND_PACK_COMMANDS["event-engagement"],
    customCommands: [],
    tags: ["이벤트", "참여", "출석", "응원", "랭킹"]
  },
  {
    id: "all-in-one-ops",
    slot: "pack",
    version: 1,
    title: "풀 운영 올인원팩",
    tier: "All-in-one",
    categoryTitle: "명령어 팩",
    description: "운영 기본부터 관리자 기능까지 한 번에 구성하되 권한별 실행 제한은 유지합니다.",
    features: { attendance: true, points: true, rankings: true, history: true, profiles: true, games: true, shop: true, customCommands: true },
    fixedCommands: ALL_IN_ONE_PACK_COMMANDS,
    customCommands: [],
    tags: ["올인원", "전체", "운영", "관리자"]
  },
  {
    id: "basic-ops",
    slot: "base",
    version: 1,
    title: "기본 운영팩",
    tier: "Legacy",
    categoryTitle: "명령어 팩",
    description: "이전 버전 호환용 기본 운영 팩입니다.",
    features: { customCommands: true, profiles: true },
    fixedCommands: LEGACY_PACK_COMMANDS["basic-ops"],
    customCommands: LEGACY_OPERATING_CUSTOM_COMMANDS,
    tags: ["legacy", "기본", "운영"],
    hidden: true
  },
  {
    id: "basic-ops-plus",
    slot: "base",
    version: 1,
    title: "기본 운영팩+",
    tier: "Legacy",
    categoryTitle: "명령어 팩",
    description: "이전 버전 호환용 확장 운영 팩입니다.",
    features: { attendance: true, points: true, rankings: true, profiles: true, customCommands: true },
    fixedCommands: LEGACY_PACK_COMMANDS["basic-ops-plus"],
    customCommands: LEGACY_PLUS_CUSTOM_COMMANDS,
    tags: ["legacy", "기본", "운영", "출석"],
    hidden: true
  },
  {
    id: "basic-ops-pro",
    slot: "base",
    version: 1,
    title: "기본 운영팩 Pro",
    tier: "Legacy",
    categoryTitle: "명령어 팩",
    description: "이전 버전 호환용 Pro 운영 팩입니다.",
    features: { attendance: true, points: true, rankings: true, profiles: true, shop: true, customCommands: true },
    fixedCommands: LEGACY_PACK_COMMANDS["basic-ops-pro"],
    customCommands: LEGACY_PRO_CUSTOM_COMMANDS,
    tags: ["legacy", "프로", "운영"],
    hidden: true
  },
  {
    id: "addon-mini-games-3",
    slot: "addon",
    version: 1,
    title: "미니게임 3종 애드온",
    tier: "Legacy",
    categoryTitle: "게임 애드온",
    description: "이전 버전 호환용 미니게임 애드온입니다.",
    features: { games: true, points: true },
    fixedCommands: LEGACY_PACK_COMMANDS["addon-mini-games-3"],
    customCommands: [
      { trigger: "/운영주사위", response: "주사위 게임을 시작합니다.", proxyCommand: "/주사위" },
      { trigger: "/운영낚시", response: "낚시 게임을 시작합니다.", proxyCommand: "/낚시" },
      { trigger: "/운영탐험", response: "탐험 게임을 시작합니다.", proxyCommand: "/탐험" }
    ],
    tags: ["legacy", "게임", "주사위", "낚시", "탐험"],
    hidden: true
  },
  {
    id: "combo-basic-plus-games",
    slot: "combo",
    version: 1,
    title: "기본 운영팩+ + 미니게임 3종",
    tier: "Legacy",
    categoryTitle: "조합 팩",
    description: "이전 버전 호환용 조합 팩입니다.",
    basePackId: "basic-ops-plus",
    addonPackIds: ["addon-mini-games-3"],
    features: {},
    fixedCommands: [],
    customCommands: [],
    tags: ["legacy", "조합", "미니게임"],
    hidden: true
  }
]);

const COMMAND_PACK_HELP = Object.freeze({
  "attendance-growth": "attendance",
  "point-economy": "attendance",
  "event-engagement": "ranking",
  "game-chance": "games",
  "shop-inventory": "shop",
  "rpg-adventure": "rpg",
  "pixel-monster-rpg": "monster",
  "pet-raising": "pet"
});

const COMMAND_PACK_ALIASES = Object.freeze({
  "pk.pet": "pet-raising",
  pet: "pet-raising",
  "펫": "pet-raising",
  "펫키우기": "pet-raising",
  "pk.rpg": "rpg-adventure",
  rpg: "rpg-adventure",
  "알피지": "rpg-adventure",
  "모험": "rpg-adventure",
  "pk.monster": "pixel-monster-rpg",
  monster: "pixel-monster-rpg",
  "몬스터": "pixel-monster-rpg",
  "픽셀몬스터": "pixel-monster-rpg"
});

const GAME_PACK_HELP_TOPICS = Object.freeze({
  pet: {
    title: "펫키우기팩",
    path: "/help/pet",
    packIds: ["pet-raising"],
    aliases: ["펫", "pet", "펫키우기"],
    intro: "개인별 펫을 입양하고 먹이, 놀이, 씻기, 휴식, 훈련으로 성장시키는 게임팩입니다.",
    firstSteps: ["/명령어설치 pk.008", "/기능켜기 게임", "/펫입양 이름", "/펫 으로 상태 확인"],
    adminSetup: ["명령어팩 장착: /명령어설치 pk.008", "게임 기능 켜기: /기능켜기 게임", "설치 확인: /명령어설치목록"],
    examples: ["/펫입양 뭉치", "/펫", "/펫먹이", "/펫놀기", "/펫상점"],
    related: ["game-chance", "shop-inventory"]
  },
  rpg: {
    title: "RPG 모험팩",
    path: "/help/rpg",
    packIds: ["rpg-adventure"],
    aliases: ["rpg", "RPG", "모험", "던전"],
    intro: "던전, 자동던전 10회 요약, 자동탐험/자동낚시/자동뽑기, 장비 강화, 확장 제작식을 묶은 모험형 게임팩입니다.",
    firstSteps: ["/명령어설치 pk.006", "/기능켜기 게임", "/모험", "/자동던전 상급 10", "/제작가능", "/자동제작", "/강화목록", "/자동장착 공격"],
    adminSetup: ["명령어팩 장착: /명령어설치 pk.006", "게임 기능 켜기: /기능켜기 게임", "상점/가방 기능 확인: /기능목록"],
    examples: ["/모험", "/던전 중급", "/자동던전 상급 10", "/자동탐험 2", "/자동낚시 2", "/자동뽑기 2", "/대장간", "/제작가능", "/자동제작", "/강화 무기", "/강화상세", "/자동장착 공격", "/보상선택 포인트"],
    related: ["shop-inventory", "pet-raising"]
  },
  monster: {
    title: "픽셀몬스터 수집팩",
    path: "/help/monster",
    packIds: ["pixel-monster-rpg"],
    aliases: ["monster", "몬스터", "픽셀몬스터"],
    intro: "오리지널 픽셀몬스터를 발견, 포획, 팀 편성, 오늘 퀘스트, 진화, 주간 보스로 이어가는 수집형 RPG 팩입니다.",
    firstSteps: ["/명령어설치 pk.007", "/기능켜기 게임", "/몬스터", "/몬스터탐험", "/포획", "/몬스터퀘스트"],
    adminSetup: ["명령어팩 장착: /명령어설치 pk.007", "게임 기능 켜기: /기능켜기 게임", "설치 확인: /명령어설치목록"],
    examples: ["/몬스터", "/몬스터탐험 숲", "/포획", "/몬스터팀 1 2 3", "/몬스터진화", "/몬스터보스"],
    related: ["rpg-adventure", "game-chance"]
  },
  attendance: {
    title: "출석/포인트팩",
    path: "/help/attendance",
    packIds: ["attendance-growth", "point-economy"],
    aliases: ["attendance", "출석", "포인트"],
    intro: "출석, 포인트 확인, 이체, 좋아요, 응원으로 참여 보상을 운영하는 기본 성장 팩입니다.",
    firstSteps: ["/명령어설치 pk.002", "/출석", "/포인트", "/포인트순위"],
    adminSetup: ["출석 성장팩: /명령어설치 pk.002", "포인트 경제팩: /명령어설치 pk.003", "포인트 기능 확인: /기능목록"],
    examples: ["/출석", "/포인트", "/좋아요 닉네임 10", "/이체 닉네임 100"],
    related: ["event-engagement", "shop-inventory"]
  },
  ranking: {
    title: "랭킹/경쟁형 팩",
    path: "/help/ranking",
    packIds: ["event-engagement", "attendance-growth"],
    aliases: ["ranking", "랭킹", "순위"],
    intro: "출석, 좋아요, 채팅 활동을 순위로 보여주는 경쟁형 운영 팩입니다.",
    firstSteps: ["/명령어설치 pk.011", "/출석순위", "/좋아요순위", "/채팅오늘"],
    adminSetup: ["이벤트 참여팩: /명령어설치 pk.011", "랭킹 기능 확인: /기능목록"],
    examples: ["/출석순위", "/포인트순위", "/좋아요순위", "/채팅금주"],
    related: ["attendance-growth", "point-economy"]
  },
  games: {
    title: "포인트 확률 게임팩 10종",
    path: "/help/games",
    packIds: ["game-chance"],
    aliases: ["games", "game", "게임", "미니게임", "확률게임"],
    intro: "주사위, 뽑기, 홀짝, 코인, 룰렛, 슬롯, 복권, 하이로우, 폭탄피하기, 보물상자를 제공하는 가상 포인트 전용 확률 게임팩입니다.",
    firstSteps: ["/명령어설치 pk.004", "/기능켜기 게임", "/확률게임", "/코인 앞 100"],
    adminSetup: ["게임 확률팩: /명령어설치 pk.004", "게임 기능 켜기: /기능켜기 게임"],
    examples: ["/확률게임", "/코인 앞 100", "/룰렛 빨강 100", "/슬롯 100", "/보물상자 2 100"],
    related: ["rpg-adventure", "pet-raising"]
  },
  shop: {
    title: "상점/가방팩",
    path: "/help/shop",
    packIds: ["shop-inventory"],
    aliases: ["shop", "상점", "가방"],
    intro: "아이템 구매, 가방 확인, 사용, 선물, 판매 흐름을 제공하는 경제 팩입니다.",
    firstSteps: ["/명령어설치 pk.005", "/상점", "/구매 1", "/가방"],
    adminSetup: ["상점 가방팩: /명령어설치 pk.005", "상점 기능 확인: /기능목록", "상품 추가: /상점추가 상품명 가격 설명"],
    examples: ["/상점", "/구매 1 10", "/가방", "/판매 번호 1"],
    related: ["point-economy", "rpg-adventure"]
  }
});

const initialState = {
  rooms: {},
  accounts: {},
  applications: {},
  payments: {},
  archivedRooms: {},
  restoreRequests: {},
  updatedAt: null
};

let pgPool;
let pgSchemaReady = false;
let stateCache = null;
let stateCacheKey = "";
let stateCacheLoadedAt = 0;
let stateCacheFingerprint = "";
const chatPageMemory = new Map();
const CHAT_PAGE_MEMORY_TTL_MS = Math.max(60_000, Number(process.env.CHAT_PAGE_MEMORY_TTL_MS || 600_000));

function normalizeText(value) {
  return String(value ?? "").trim();
}

function compactSpaces(value) {
  return normalizeText(value).replace(/\s+/g, " ");
}

function incidentMessage(key) {
  return INCIDENT_MESSAGES[key] || INCIDENT_MESSAGES.SERVER_ERROR;
}

function incidentMessagesPayload() {
  return Object.fromEntries(Object.entries(INCIDENT_MESSAGES).map(([key, value]) => [key, { ...value }]));
}

function keyFor(value) {
  return compactSpaces(value).toLowerCase();
}

function commandTemplateSlug(value) {
  return keyFor(value)
    .replace(/[^a-z0-9가-힣_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function normalizeCommandToken(value) {
  const token = compactSpaces(value).split(/\s+/)[0] || "";
  if (token.startsWith("／")) return `/${token.slice(1)}`;
  return token;
}

function slashTokenLooksLikeNonCommand(token) {
  if (!token.startsWith("/")) return false;
  if (/^\/+$/.test(token)) return true;
  if (/^\/?\d{2,4}\/\d{1,2}(?:\/\d{1,2})?$/.test(token)) return true;
  return false;
}

function slashTokenLooksLikeCommand(token) {
  if (token === "/?") return true;
  return /^\/[0-9A-Za-z가-힣ㄱ-ㅎㅏ-ㅣ_-]{1,31}$/u.test(token);
}

function parseBotCommand(message) {
  const rawText = normalizeText(message);
  const rawFirstLine = normalizeText(rawText.split(/\r?\n/)[0] || "");
  if (!rawFirstLine) {
    return { isCommandAttempt: false, command: "", args: [], rawFirstLine, rawText, reason: "empty" };
  }

  const firstToken = normalizeCommandToken(rawFirstLine);
  const normalizedFirstLine = firstToken === "ㅊㅊ"
    ? `/ㅊㅊ${rawFirstLine.slice(firstToken.length)}`
    : rawFirstLine.replace(/^\s*／/, "/");
  if (firstToken === "ㅊㅊ") {
    return { isCommandAttempt: true, command: "/ㅊㅊ", args: [], rawFirstLine, rawText, reason: "short_attendance" };
  }
  if (!firstToken.startsWith("/")) {
    return { isCommandAttempt: false, command: "", args: [], rawFirstLine, rawText, reason: "no_prefix" };
  }
  if (slashTokenLooksLikeNonCommand(firstToken)) {
    return { isCommandAttempt: false, command: "", args: [], rawFirstLine, rawText, reason: "non_command_slash" };
  }
  if (!slashTokenLooksLikeCommand(firstToken)) {
    return { isCommandAttempt: false, command: "", args: [], rawFirstLine, rawText, reason: "invalid_command_token" };
  }

  const parts = compactSpaces(normalizedFirstLine).split(/\s+/);
  return {
    isCommandAttempt: true,
    command: normalizeCommandToken(parts[0]),
    args: parts.slice(1),
    rawFirstLine,
    rawText,
    reason: "command"
  };
}

const READ_ONLY_SAVE_SKIP_COMMANDS = new Set([
  "/상태", "/status", "/브릿지", "/bridge", "/js상태", "/jsstatus", "/로컬상태",
  "/도움말", "/help", "/?", "/메뉴", "/처음", "/찾기", "/명령어",
  "/게임", "/게임명령어", "/확률게임", "/점메추", "/명령어팩", "/게임팩도움말",
  "/포인트", "/내포인트", "/고정명령어", "/추천", "/추천명령어", "/오늘할일", "/할일",
  "/판매추천", "/정리추천", "/명령어목록", "/커스텀명령어", "/명령어검색", "/명령어설치목록",
  "/명령어팩목록", "/장착팩", "/팩목록", "/방정보", "/방목록", "/구독상태", "/기능", "/기능목록",
  "/상점", "/구매내역", "/상점내역", "/기능아이템목록", "/가방", "/아이템", "/보유아이템",
  "/판매목록", "/판매미리보기", "/가방정리", "/아이템상세", "/잠금목록",
  "/미끼상점", "/어항", "/수족관", "/던전목록", "/모험", "/대장간", "/제작가능",
  "/강화목록", "/강화상세", "/장비", "/장비상세", "/스탯", "/세트아이템",
  "/몬스터", "/몬스터목록", "/몬스터상세", "/몬스터퀘스트", "/몬스터도감",
  "/펫", "/펫상점", "/미출석", "/출석순위", "/포인트순위", "/좋아요순위", "/레벨순위",
  "/채팅오늘", "/채팅금주", "/포인트안내", "/포인트규칙", "/뽑기목록", "/내정보", "/정보",
  "/관리자목록", "/프로필", "/내별명", "/별명목록", "/입퇴장상세", "/입퇴장현황", "/닉이력",
  "/최근이벤트", "/이벤트로그", "/원본로그", "/원본이벤트", "/운세", "/오늘운세"
]);

function isReadOnlySaveSkipCommand(message) {
  const parsed = parseBotCommand(message);
  if (!parsed.isCommandAttempt) return false;
  const compactCommand = compactSpaces(message);
  if (/^\/출석\s*순위$/.test(compactCommand)) return true;
  if (/^\/포인트\s*순위$/.test(compactCommand)) return true;
  if (/^\/좋아요\s*순위$/.test(compactCommand)) return true;
  if (/^\/레벨\s*순위$/.test(compactCommand)) return true;
  return READ_ONLY_SAVE_SKIP_COMMANDS.has(parsed.command);
}

const WEATHER_REGIONS = Object.freeze({
  "시흥": { name: "시흥", latitude: 37.3799, longitude: 126.8031, aliases: ["시흥시"] },
  "서울": { name: "서울", latitude: 37.5665, longitude: 126.9780, aliases: ["서울시"] },
  "인천": { name: "인천", latitude: 37.4563, longitude: 126.7052, aliases: ["인천시"] },
  "수원": { name: "수원", latitude: 37.2636, longitude: 127.0286, aliases: ["수원시"] },
  "안산": { name: "안산", latitude: 37.3219, longitude: 126.8309, aliases: ["안산시"] },
  "안양": { name: "안양", latitude: 37.3943, longitude: 126.9568, aliases: ["안양시"] },
  "부산": { name: "부산", latitude: 35.1796, longitude: 129.0756, aliases: ["부산시"] },
  "대구": { name: "대구", latitude: 35.8714, longitude: 128.6014, aliases: ["대구시"] },
  "대전": { name: "대전", latitude: 36.3504, longitude: 127.3845, aliases: ["대전시"] },
  "광주": { name: "광주", latitude: 35.1595, longitude: 126.8526, aliases: ["광주시"] },
  "울산": { name: "울산", latitude: 35.5384, longitude: 129.3114, aliases: ["울산시"] },
  "제주": { name: "제주", latitude: 33.4996, longitude: 126.5312, aliases: ["제주시"] }
});

const WEATHER_ALIAS_TO_REGION = Object.freeze(Object.fromEntries(
  Object.values(WEATHER_REGIONS).flatMap((region) => [
    [keyFor(region.name), region.name],
    ...(region.aliases || []).map((alias) => [keyFor(alias), region.name])
  ])
));

function commandTemplateResponse(category, word, action, serial) {
  const proxyCommand = gameTemplateProxyCommand(category, word);
  if (category.kind === "game-template") {
    if (proxyCommand) {
      const gameLabels = {
        "/주사위": "주사위",
        "/낚시": "낚시",
        "/탐험": "탐험"
      };
      const label = gameLabels[proxyCommand] || word;
      return [
        `${label} 게임 안내`,
        "",
        `${proxyCommand} 명령어로 바로 참여할 수 있습니다.`,
        "결과에 따라 포인트가 지급되며, 보상은 방 설정에 맞춰 운영됩니다.",
        "무리한 반복 사용은 운영진 안내에 따라 제한될 수 있습니다."
      ].join("\n");
    }
    return [
      `${word} ${action}`,
      "",
      `${word} 관련 게임은 준비 중입니다.`,
      "지금은 참여 방법, 보상표, 시즌 일정을 안내하는 문구로 사용할 수 있습니다.",
      "정식 게임 연결 전까지는 이벤트 공지용으로 운영해 주세요."
    ].join("\n");
  }
  if (category.kind === "roadmap") {
    return [
      `${word} ${action}`,
      "",
      "AI 운영도우미 후보 템플릿입니다.",
      "실제 AI 자동화 연결 전에는 개인정보와 운영 정책을 먼저 확인해 주세요."
    ].join("\n");
  }
  if (category.id === "basic-ops") {
    if (/공지/.test(word)) return "오늘 공지는 여기입니다.\n\n중요한 내용은 이 메시지 아래에 이어서 안내해 주세요.";
    if (/규칙/.test(word)) return "두글자 닉네임 뒤에 성별을 붙여주세요.\n예: 곰돌 남, 하늘 여";
    if (/문의/.test(word)) return "문의는 운영진에게 남겨주세요.\n확인 후 순서대로 답변드리겠습니다.";
    if (/운영진/.test(word)) return "운영진 호출이 필요하면 닉네임과 내용을 함께 남겨주세요.";
    if (/방소개/.test(word)) return "이 방은 함께 대화하고 이벤트를 즐기는 오픈채팅방입니다.\n처음 오신 분은 규칙을 먼저 확인해 주세요.";
  }
  if (category.id === "participant") {
    if (/프로필/.test(word)) return "프로필 양식\n닉네임:\n성별:\n나이대:\n관심사:\n한마디:";
    if (/닉네임/.test(word)) return "닉네임은 알아보기 쉽게 설정해 주세요.\n운영진이 확인하기 어려운 이름은 변경을 요청할 수 있습니다.";
    if (/입장인사/.test(word)) return "처음 오신 분은 가볍게 인사부터 나눠주세요.\n반갑게 맞이하겠습니다.";
  }
  if (category.id === "admin") {
    if (/경고/.test(word)) return "운영진 안내입니다.\n방 규칙 위반 내용이 확인되어 주의 안내드립니다.\n같은 상황이 반복되면 추가 조치가 있을 수 있습니다.";
    if (/점검/.test(word)) return "운영 점검 안내입니다.\n일부 기능 응답이 잠시 지연될 수 있습니다.";
    if (/랭킹보상/.test(word)) return "랭킹 보상 안내입니다.\n대상자와 지급 기준은 운영진 확인 후 공지됩니다.";
  }
  if (category.id === "shop-item") {
    if (/상점|아이템/.test(word)) return "상점 이용 안내\n/상점 으로 상품을 확인하고 /구매 번호 로 구매할 수 있습니다.";
    if (/가방/.test(word)) return "가방 이용 안내\n/가방 으로 보유 아이템을 확인하고 /사용 번호 로 사용할 수 있습니다.";
    if (/선물/.test(word)) return "아이템 선물 안내\n/가방선물 닉네임 번호 수량 형식으로 선물할 수 있습니다.";
  }
  if (category.id === "event-season") {
    return `${word} ${action}\n\n참여 기간과 보상 기준은 이 공지 아래에 이어서 안내해 주세요.\n참여 전 방 규칙을 먼저 확인해 주세요.`;
  }
  if (category.id === "community-fun") {
    return `${word} ${action}\n\n가볍게 참여해 주세요.\n서로 불편하지 않은 선에서 즐겁게 대화해요.`;
  }
  return [
    `${word} ${action}`,
    "",
    "방 운영 안내입니다.",
    "필요한 내용은 이 메시지 아래에 이어서 안내해 주세요."
  ].join("\n");
}

function gameTemplateProxyCommand(category, word) {
  if (category.kind !== "game-template") return "";
  if (/주사위/.test(word)) return "/주사위";
  if (/낚시/.test(word)) return "/낚시";
  if (/던전|채집|광산|보스|퀘스트/.test(word)) return "/던전";
  if (/탐험/.test(word)) return "/탐험";
  if (/펫/.test(word)) return "/펫입양";
  if (/몬스터/.test(word)) return "/몬스터탐험";
  return "";
}

const REPRESENTATIVE_COMMAND_TEMPLATES = Object.freeze([
  ["basic-ops", "기본 운영", "participant", "custom", "/공지", "공지", "오늘 공지는 여기입니다.\n\n중요한 내용은 이 메시지 아래에 이어서 안내해 주세요.", "방 공지 대표 명령어입니다."],
  ["basic-ops", "기본 운영", "participant", "custom", "/규칙", "규칙", "두글자 닉네임 뒤에 성별을 붙여주세요.\n예: 곰돌 남, 하늘 여", "방 규칙 안내 대표 명령어입니다."],
  ["basic-ops", "기본 운영", "participant", "custom", "/문의", "문의", "문의는 운영진에게 남겨주세요.\n확인 후 순서대로 답변드리겠습니다.", "운영진 문의 안내 대표 명령어입니다."],
  ["basic-ops", "기본 운영", "participant", "custom", "/운영진", "운영진", "운영진 호출이 필요하면 닉네임과 내용을 함께 남겨주세요.", "운영진 호출 안내입니다."],
  ["basic-ops", "기본 운영", "participant", "custom", "/방소개", "방소개", "이 방은 함께 대화하고 이벤트를 즐기는 오픈채팅방입니다.\n처음 오신 분은 규칙을 먼저 확인해 주세요.", "방 소개 대표 명령어입니다."],
  ["basic-ops", "기본 운영", "participant", "custom", "/초보안내", "초보안내", "처음 오신 분은 공지와 규칙을 먼저 확인해 주세요.\n궁금한 점은 /문의 로 남겨주세요.", "초보 참여자 안내입니다."],
  ["basic-ops", "기본 운영", "participant", "custom", "/인사", "인사", "처음 오신 분은 가볍게 인사부터 나눠주세요.\n반갑게 맞이하겠습니다.", "입장 인사 안내입니다."],
  ["basic-ops", "기본 운영", "participant", "custom", "/자주묻는질문", "자주 묻는 질문", "자주 묻는 질문은 이 안내에 이어서 정리해 주세요.\n필요한 내용은 운영진이 계속 업데이트합니다.", "FAQ 대표 명령어입니다."],
  ["basic-ops", "기본 운영", "participant", "custom", "/시간표", "시간표", "방 일정과 운영 시간은 이 메시지 아래에 이어서 안내해 주세요.", "시간표 안내 대표 명령어입니다."],
  ["participant", "참여자용", "participant", "custom", "/프로필양식", "프로필 양식", "프로필 양식\n닉네임:\n성별:\n나이대:\n관심사:\n한마디:", "참여자 프로필 작성 양식입니다."],
  ["participant", "참여자용", "participant", "custom", "/닉네임규칙", "닉네임 규칙", "닉네임은 알아보기 쉽게 설정해 주세요.\n운영진이 확인하기 어려운 이름은 변경을 요청할 수 있습니다.", "닉네임 규칙 안내입니다."],
  ["participant", "참여자용", "participant", "custom", "/입장인사", "입장 인사", "처음 오신 분은 가볍게 인사부터 나눠주세요.\n반갑게 맞이하겠습니다.", "입장 인사 안내입니다."],
  ["participant", "참여자용", "participant", "custom", "/대화주제", "대화 주제", "오늘 대화 주제는 운영진이 이 메시지 아래에 이어서 안내합니다.", "대화 주제 안내입니다."],
  ["participant", "참여자용", "participant", "custom", "/자기소개", "자기소개", "자기소개 양식\n닉네임:\n관심사:\n요즘 하고 싶은 이야기:", "자기소개 양식입니다."],
  ["participant", "참여자용", "participant", "custom", "/오늘질문", "오늘 질문", "오늘의 질문은 이 메시지 아래에 이어서 안내해 주세요.", "참여 유도 질문입니다."],
  ["participant", "참여자용", "participant", "custom", "/친구찾기", "친구찾기", "같이 이야기할 친구를 찾을 때는 관심사와 가능한 시간을 함께 남겨주세요.", "친구 찾기 안내입니다."],
  ["participant", "참여자용", "participant", "custom", "/방분위기", "방 분위기", "서로 존중하며 편하게 대화하는 분위기를 지향합니다.", "방 분위기 안내입니다."],
  ["participant", "참여자용", "participant", "custom", "/참여팁", "참여 팁", "공지와 규칙을 확인한 뒤 관심 있는 주제로 편하게 참여해 주세요.", "참여 팁 안내입니다."],
  ["participant", "참여자용", "participant", "custom", "/활동안내", "활동 안내", "출석, 응원, 좋아요 같은 기능은 방 설정에 따라 사용할 수 있습니다.", "활동 기능 안내입니다."],
  ["admin", "관리자용", "admin", "custom", "/점검공지", "점검 공지", "운영 점검 안내입니다.\n일부 기능 응답이 잠시 지연될 수 있습니다.", "관리자용 점검 공지입니다."],
  ["admin", "관리자용", "admin", "custom", "/경고안내", "경고 안내", "운영진 안내입니다.\n방 규칙 위반 내용이 확인되어 주의 안내드립니다.", "관리자용 경고 안내입니다."],
  ["admin", "관리자용", "admin", "custom", "/운영메모", "운영 메모", "운영진 메모입니다.\n확인할 내용을 이 메시지 아래에 이어서 정리해 주세요.", "운영진 메모 양식입니다."],
  ["admin", "관리자용", "admin", "custom", "/제재기준", "제재 기준", "방 제재 기준은 운영진 공지 기준을 따릅니다.\n세부 기준은 이 메시지 아래에 이어서 안내해 주세요.", "제재 기준 안내입니다."],
  ["admin", "관리자용", "admin", "custom", "/상점공지", "상점 공지", "상점 안내입니다.\n상품 변경이나 점검 내용은 이 메시지 아래에 이어서 안내해 주세요.", "상점 공지 안내입니다."],
  ["admin", "관리자용", "admin", "custom", "/관리규칙", "관리 규칙", "관리 규칙은 방 운영진 기준에 따라 적용됩니다.\n세부 내용은 이 메시지 아래에 이어서 안내해 주세요.", "관리 규칙 안내입니다."],
  ["admin", "관리자용", "admin", "custom", "/휴방안내", "휴방 안내", "휴방 안내입니다.\n재개 일정은 운영진 공지를 확인해 주세요.", "휴방 안내입니다."],
  ["shop-item", "상점/아이템", "participant", "custom", "/상점안내", "상점 안내", "상점 이용 안내\n/상점 으로 상품을 확인하고 /구매 번호 로 구매할 수 있습니다.", "가상 포인트 상점 안내입니다."],
  ["shop-item", "상점/아이템", "participant", "custom", "/아이템목록", "아이템 목록", "아이템 목록은 /상점 으로 확인할 수 있습니다.", "아이템 목록 안내입니다."],
  ["shop-item", "상점/아이템", "participant", "custom", "/가방안내", "가방 안내", "가방 이용 안내\n/가방 으로 보유 아이템을 확인하고 /사용 번호 로 사용할 수 있습니다.", "가방 사용 안내입니다."],
  ["shop-item", "상점/아이템", "participant", "custom", "/구매방법", "구매 방법", "구매 방법\n/구매 번호 형식으로 입력하면 가상 포인트로 상품을 구매합니다.", "구매 방법 안내입니다."],
  ["shop-item", "상점/아이템", "participant", "custom", "/선물방법", "선물 방법", "아이템 선물 안내\n/가방선물 닉네임 번호 수량 형식으로 선물할 수 있습니다.", "아이템 선물 안내입니다."],
  ["shop-item", "상점/아이템", "participant", "custom", "/사용방법", "사용 방법", "아이템 사용 안내\n/사용 번호 형식으로 보유 아이템을 사용할 수 있습니다.", "아이템 사용 안내입니다."],
  ["shop-item", "상점/아이템", "participant", "custom", "/포인트안내", "포인트 안내", "포인트는 채팅방 내부 가상 포인트이며 현금 가치나 환전 기능이 없습니다.", "가상 포인트 정책 안내입니다."],
  ["shop-item", "상점/아이템", "participant", "custom", "/보상교환", "보상 교환", "보상 교환은 방 내부 가상 아이템 기준으로만 운영합니다.", "가상 보상 교환 안내입니다."],
  ["shop-item", "상점/아이템", "participant", "custom", "/시즌상품", "시즌 상품", "시즌 상품은 운영진이 등록한 방 내부 가상 아이템 기준으로 운영합니다.", "시즌 상품 안내입니다."],
  ["event-season", "이벤트/시즌", "participant", "custom", "/출석이벤트", "출석 이벤트", "출석 이벤트 안내입니다.\n참여 기간과 보상 기준을 확인해 주세요.", "출석 이벤트 안내입니다."],
  ["event-season", "이벤트/시즌", "participant", "custom", "/랭킹이벤트", "랭킹 이벤트", "랭킹 이벤트 안내입니다.\n집계 기준과 기간을 확인해 주세요.", "랭킹 이벤트 안내입니다."],
  ["event-season", "이벤트/시즌", "participant", "custom", "/신규이벤트", "신규 이벤트", "진행 중인 신규 이벤트를 이 메시지 아래에 이어서 안내해 주세요.", "신규 이벤트 안내입니다."],
  ["event-season", "이벤트/시즌", "participant", "custom", "/주말이벤트", "주말 이벤트", "주말 이벤트 안내입니다.\n참여 방법과 기간을 확인해 주세요.", "주말 이벤트 안내입니다."],
  ["event-season", "이벤트/시즌", "participant", "custom", "/시즌공지", "시즌 공지", "시즌 공지입니다.\n기간과 참여 조건을 확인해 주세요.", "시즌 공지 안내입니다."],
  ["event-season", "이벤트/시즌", "participant", "custom", "/보상안내", "보상 안내", "보상은 참여 조건 확인 후 순서대로 지급됩니다.", "보상 안내입니다."],
  ["event-season", "이벤트/시즌", "participant", "custom", "/미션", "미션", "오늘의 미션은 이 메시지 아래에 이어서 안내해 주세요.", "미션 안내입니다."],
  ["event-season", "이벤트/시즌", "participant", "custom", "/챌린지", "챌린지", "챌린지 안내입니다.\n참여 방법과 기간을 확인해 주세요.", "챌린지 안내입니다."],
  ["event-season", "이벤트/시즌", "participant", "custom", "/기념일", "기념일", "기념일 이벤트 안내입니다.\n참여 전 방 규칙을 확인해 주세요.", "기념일 안내입니다."],
  ["community-fun", "커뮤니티/재미", "participant", "custom", "/오늘운세안내", "오늘 운세 안내", "오늘 운세는 /운세 또는 /오늘운세 로 확인할 수 있습니다.", "운세 기능 안내입니다."],
  ["community-fun", "커뮤니티/재미", "participant", "custom", "/밸런스게임", "밸런스 게임", "밸런스 게임 주제는 이 메시지 아래에 이어서 안내해 주세요.", "밸런스 게임 안내입니다."],
  ["community-fun", "커뮤니티/재미", "participant", "custom", "/칭찬", "칭찬", "서로의 좋은 점을 가볍게 칭찬해 주세요.", "칭찬 참여 안내입니다."],
  ["community-fun", "커뮤니티/재미", "participant", "custom", "/응원문구", "응원 문구", "오늘의 응원 문구는 이 메시지 아래에 이어서 안내해 주세요.", "응원 문구 안내입니다."],
  ["community-fun", "커뮤니티/재미", "participant", "custom", "/랜덤질문", "랜덤 질문", "랜덤 질문은 운영진이 이 메시지 아래에 이어서 안내합니다.", "랜덤 질문 안내입니다."],
  ["community-fun", "커뮤니티/재미", "participant", "custom", "/오늘메뉴", "오늘 메뉴", "오늘 메뉴 추천은 이 메시지 아래에 이어서 안내해 주세요.", "오늘 메뉴 안내입니다."],
  ["community-fun", "커뮤니티/재미", "participant", "custom", "/심심풀이", "심심풀이", "심심풀이 주제는 이 메시지 아래에 이어서 안내해 주세요.", "심심풀이 안내입니다."],
  ["community-fun", "커뮤니티/재미", "participant", "custom", "/익명사연", "익명 사연", "익명 사연은 운영진 안내 기준에 맞춰 접수해 주세요.", "익명 사연 안내입니다."],
  ["community-fun", "커뮤니티/재미", "participant", "custom", "/분위기전환", "분위기 전환", "분위기 전환용 주제는 이 메시지 아래에 이어서 안내해 주세요.", "분위기 전환 안내입니다."],
  ["game-link", "게임 연결", "participant", "game-template", "/운영주사위", "운영 주사위", "주사위 게임을 시작합니다.", "설치하면 /주사위 미니게임 엔진으로 연결됩니다.", "/주사위"],
  ["game-link", "게임 연결", "participant", "game-template", "/운영낚시", "운영 낚시", "낚시 게임을 시작합니다.", "설치하면 /낚시 미니게임 엔진으로 연결됩니다.", "/낚시"],
  ["game-link", "게임 연결", "participant", "game-template", "/운영탐험", "운영 탐험", "탐험 게임을 시작합니다.", "설치하면 /탐험 미니게임 엔진으로 연결됩니다.", "/탐험"],
  ["game-link", "게임 연결", "participant", "game-template", "/펫입양", "펫키우기", "/펫입양 이름 으로 개인 펫을 입양합니다.", "설치하면 펫키우기 엔진으로 연결됩니다.", "/펫입양"],
  ["game-link", "게임 연결", "participant", "game-template", "/게임후보", "게임 후보", "새 게임 후보는 준비 중입니다.", "추가 게임 확장 준비중 템플릿입니다. 현재는 설치할 수 없습니다.", ""],
  ["ai-helper", "AI 운영도우미 후보", "admin", "roadmap", "/공지초안", "공지 초안", "AI 공지 초안 기능은 준비 중입니다.", "AI 기능 후보 템플릿입니다. 실제 자동화 전에는 운영자 검토가 필요합니다.", ""]
]);

function representativeCommandTemplates() {
  return REPRESENTATIVE_COMMAND_TEMPLATES.map((row, index) => {
    const [categoryId, categoryTitle, audience, kind, trigger, title, response, description, proxyCommand = ""] = row;
    const installable = kind === "custom" || (kind === "game-template" && Boolean(proxyCommand));
    return {
      id: `${categoryId}-${String(index + 1).padStart(3, "0")}`,
      categoryId,
      categoryTitle,
      title,
      command: trigger,
      trigger,
      audience,
      kind,
      installable,
      editable: installable,
      description,
      response,
      proxyCommand,
      status: installable ? "available" : "coming_soon",
      disabledReason: installable ? "" : (kind === "roadmap" ? "정책 검토 후 공개 예정입니다." : "아직 실제 실행 기능이 연결되지 않았습니다."),
      tags: [categoryTitle, audience === "admin" ? "관리자" : "참여자", kind, title]
    };
  });
}

function fixedCommandTemplates() {
  const templates = [];
  for (const group of FIXED_COMMAND_GROUPS) {
    for (const command of group.commands) {
      const audience = group.title === "관리자" ? "admin" : "participant";
      templates.push({
        id: `fixed-${commandTemplateSlug(command)}`,
        categoryId: "fixed-current",
        categoryTitle: "현재 기본 명령어",
        title: `${command} 기본 기능`,
        command,
        trigger: command,
        audience,
        kind: "fixed",
        installable: false,
        editable: false,
        description: "현재 서버에 내장된 고정 명령어입니다. 커스텀 명령어로 덮어쓸 수 없습니다.",
        response: "",
        status: "available",
        disabledReason: "",
        tags: [group.title, "고정", audience === "admin" ? "관리자" : "참여자"]
      });
    }
  }
  return templates;
}

function generatedCommandTemplates() {
  const templates = [
    ...fixedCommandTemplates(),
    ...COMMAND_TEMPLATE_BUNDLES,
    ...representativeCommandTemplates()
  ];
  const seen = new Set();
  return templates.filter((template) => {
    const key = normalizeCustomCommandTrigger(template.trigger || template.command || template.id);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const COMMAND_TEMPLATES = Object.freeze(generatedCommandTemplates());

function commandTemplateCategories() {
  const byId = new Map();
  for (const template of COMMAND_TEMPLATES) {
    const current = byId.get(template.categoryId) || {
      id: template.categoryId,
      title: template.categoryTitle,
      count: 0,
      installableCount: 0
    };
    current.count += 1;
    if (template.installable) current.installableCount += 1;
    byId.set(template.categoryId, current);
  }
  return [...byId.values()];
}

function publicCommandTemplate(template) {
  const commands = (template.commands || []).map((command) => ({
    trigger: command.trigger,
    response: command.response,
    proxyCommand: command.proxyCommand || ""
  }));
  const installCode = commandTemplateInstallCode(template);
  return {
    id: template.id,
    installCode,
    installCodeType: commandTemplateInstallCodeType(template),
    categoryId: template.categoryId,
    categoryTitle: template.categoryTitle,
    title: template.title,
    command: template.command,
    trigger: template.trigger,
    audience: template.audience,
    kind: template.kind,
    installable: template.installable,
    editable: template.editable,
    status: template.status || (template.installable ? "available" : "read_only"),
    disabledReason: template.disabledReason || "",
    description: template.description,
    response: template.response,
    proxyCommand: template.proxyCommand || "",
    commands,
    bundleSize: commands.length,
    tags: template.tags
  };
}

function commandTemplateCatalogPayload() {
  const categories = commandTemplateCategories();
  return {
    ok: true,
    version: APP_VERSION,
    total: COMMAND_TEMPLATES.length,
    categories,
    summary: {
      participant: COMMAND_TEMPLATES.filter((template) => template.audience === "participant").length,
      admin: COMMAND_TEMPLATES.filter((template) => template.audience === "admin").length,
      installable: COMMAND_TEMPLATES.filter((template) => template.installable).length,
      fixed: COMMAND_TEMPLATES.filter((template) => template.kind === "fixed").length,
      games: COMMAND_TEMPLATES.filter((template) => template.kind === "game-template").length,
      bundles: COMMAND_TEMPLATES.filter((template) => (template.commands || []).length > 1).length
    },
    templates: COMMAND_TEMPLATES.map(publicCommandTemplate)
  };
}

function commandTemplateById(id) {
  const templateId = normalizeText(id);
  return COMMAND_TEMPLATES.find((template) => template.id === templateId) || null;
}

function visibleCommandPacks() {
  return COMMAND_PACKS.filter((pack) => !pack.hidden && pack.slot === "pack");
}

function paddedInstallNumber(value) {
  return String(value).padStart(3, "0");
}

function commandPackInstallCode(pack) {
  const index = visibleCommandPacks().findIndex((item) => item.id === pack?.id);
  return index >= 0 ? `pk.${paddedInstallNumber(index + 1)}` : "";
}

function commandTemplateInstallCodeType(template) {
  if (!template?.installable) return "";
  return (template.commands || []).length > 1 ? "set" : "command";
}

function installableSetTemplates() {
  return COMMAND_TEMPLATES.filter((template) => template.installable && (template.commands || []).length > 1);
}

function installableSingleTemplates() {
  return COMMAND_TEMPLATES.filter((template) => template.installable && (template.commands || []).length <= 1);
}

function commandTemplateInstallCode(template) {
  if (!template?.installable) return "";
  if ((template.commands || []).length > 1) {
    const index = installableSetTemplates().findIndex((item) => item.id === template.id);
    return index >= 0 ? `st.${paddedInstallNumber(index + 1)}` : "";
  }
  const index = installableSingleTemplates().findIndex((item) => item.id === template.id);
  return index >= 0 ? `no.${paddedInstallNumber(index + 100)}` : "";
}

function commandPackByInstallCode(code) {
  const match = normalizeText(code).toLowerCase().match(/^pk\.(\d{3})$/);
  if (!match) return null;
  return visibleCommandPacks()[Number(match[1]) - 1] || null;
}

function commandTemplateByInstallCode(code) {
  const value = normalizeText(code).toLowerCase();
  const setMatch = value.match(/^st\.(\d{3})$/);
  if (setMatch) return installableSetTemplates()[Number(setMatch[1]) - 1] || null;
  const singleMatch = value.match(/^no\.(\d{3})$/);
  if (!singleMatch) return null;
  return installableSingleTemplates()[Number(singleMatch[1]) - 100] || null;
}

function commandPackById(id) {
  const packId = normalizeText(id);
  return COMMAND_PACKS.find((pack) => pack.id === packId) || null;
}

function commandPackByCodeOrAlias(value = "") {
  const key = normalizeText(value).toLowerCase();
  if (!key) return null;
  return commandPackByInstallCode(key)
    || commandPackById(key)
    || commandPackById(COMMAND_PACK_ALIASES[key])
    || visibleCommandPacks().find((pack) => key === pack.title.toLowerCase())
    || null;
}

function validCommandPackId(id, slot = "") {
  const pack = commandPackById(id);
  if (!pack) return "";
  if (slot && pack.slot !== slot) return "";
  return pack.id;
}

function normalizeCommandPackState(value = {}) {
  const basePackId = validCommandPackId(value.basePackId, "base");
  const addonPackIds = [...new Set((Array.isArray(value.addonPackIds) ? value.addonPackIds : [])
    .map((id) => validCommandPackId(id, "addon"))
    .filter(Boolean))];
  const installedPackIds = [...new Set((Array.isArray(value.installedPackIds) ? value.installedPackIds : [])
    .map((id) => validCommandPackId(id, "pack"))
    .filter(Boolean))];
  return {
    basePackId,
    addonPackIds,
    installedPackIds,
    installedAt: normalizeText(value.installedAt),
    updatedAt: normalizeText(value.updatedAt),
    updatedBy: normalizeText(value.updatedBy)
  };
}

function helpPathForPack(pack) {
  const slug = COMMAND_PACK_HELP[pack?.id || ""];
  return slug ? `/help/${slug}` : "";
}

function installCommandForPack(pack) {
  const code = commandPackInstallCode(pack);
  return code ? `/명령어설치 ${code}` : "";
}

function removeCommandForPack(pack) {
  const code = commandPackInstallCode(pack);
  return code ? `/명령어팩제거 ${code}` : "";
}

function registryItemForCommandName(command) {
  const token = normalizeCommandToken(command);
  return COMMAND_REGISTRY.find((item) => item.command === token || (item.aliases || []).includes(token)) || null;
}

function commandDetailForPackCommand(command) {
  const item = registryItemForCommandName(command);
  return {
    command,
    description: item?.description || "채팅 명령어",
    aliases: item?.aliases || [],
    requiresRole: item?.requiresRole || "",
    requiresFeature: item?.requiresFeature || "",
    registered: Boolean(item)
  };
}

function publicCommandPack(pack, current = {}) {
  const commandCount = (pack.customCommands || []).length + (pack.fixedCommands || []).length;
  const installed = pack.slot === "pack"
    ? (current.installedPackIds || []).includes(pack.id)
    : pack.slot === "base"
      ? current.basePackId === pack.id
      : pack.slot === "addon"
        ? (current.addonPackIds || []).includes(pack.id)
        : current.basePackId === pack.basePackId && (pack.addonPackIds || []).every((id) => (current.addonPackIds || []).includes(id));
  return {
    id: pack.id,
    installCode: commandPackInstallCode(pack),
    installCodeType: "pack",
    slot: pack.slot,
    version: pack.version,
    title: pack.title,
    tier: pack.tier,
    categoryTitle: pack.categoryTitle,
    description: pack.description,
    commandCount,
    fixedCommands: pack.fixedCommands || [],
    commandsDetailed: [...new Set(pack.fixedCommands || [])].map((command) => commandDetailForPackCommand(command)),
    customCommands: (pack.customCommands || []).map((command) => ({
      trigger: command.trigger,
      response: command.response,
      proxyCommand: command.proxyCommand || ""
    })),
    helpPath: helpPathForPack(pack),
    installCommand: installCommandForPack(pack),
    removeCommand: removeCommandForPack(pack),
    deleteHints: pack.slot === "pack" ? [removeCommandForPack(pack)].filter(Boolean) : [],
    features: pack.features || {},
    basePackId: pack.basePackId || "",
    addonPackIds: pack.addonPackIds || [],
    hidden: Boolean(pack.hidden),
    installed,
    status: "available",
    installable: true,
    tags: pack.tags || []
  };
}

function commandPackCatalogPayload(current = {}) {
  const normalized = normalizeCommandPackState(current);
  const visiblePacks = COMMAND_PACKS.filter((pack) => !pack.hidden);
  return {
    ok: true,
    version: APP_VERSION,
    total: visiblePacks.length,
    summary: {
      pack: visiblePacks.filter((pack) => pack.slot === "pack").length,
      legacy: COMMAND_PACKS.filter((pack) => pack.hidden).length,
      installed: visiblePacks.filter((pack) => publicCommandPack(pack, normalized).installed).length
    },
    current: commandPackStatePayload(normalized),
    packs: visiblePacks.map((pack) => publicCommandPack(pack, normalized))
  };
}

function commandPackStatePayload(current = {}) {
  const normalized = normalizeCommandPackState(current);
  const basePack = commandPackById(normalized.basePackId);
  const addonPacks = normalized.addonPackIds.map((id) => commandPackById(id)).filter(Boolean);
  const installedPacks = normalized.installedPackIds.map((id) => commandPackById(id)).filter(Boolean);
  return {
    ...normalized,
    basePackTitle: basePack?.title || "",
    installedPackTitles: installedPacks.map((pack) => pack.title),
    installedPacks: installedPacks.map((pack) => ({ id: pack.id, title: pack.title, tier: pack.tier })),
    installedPackDetails: installedPacks.map((pack) => publicCommandPack(pack, normalized)),
    addonPackTitles: addonPacks.map((pack) => pack.title),
    addonPacks: addonPacks.map((pack) => ({ id: pack.id, title: pack.title, tier: pack.tier })),
    addonPackDetails: addonPacks.map((pack) => publicCommandPack(pack, normalized)),
    basePackDetail: basePack ? publicCommandPack(basePack, normalized) : null
  };
}

function nowIso() {
  return new Date().toISOString();
}

function shortKstDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "2-digit",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}.${value.month}.${value.day}`;
}

function kstTimestamp() {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    dateStyle: "medium",
    timeStyle: "medium"
  }).format(new Date());
}

function kstDateTime(date = new Date()) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function kstDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function kstDateKey(date = new Date()) {
  const parts = kstDateParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function kstMonthKey(date = new Date()) {
  const parts = kstDateParts(date);
  return `${parts.year}-${parts.month}`;
}

function utcDateKey(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function previousDateKey(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return utcDateKey(new Date(Date.UTC(year, month - 1, day) - 86400000));
}

function kstWeekKey(date = new Date()) {
  const [year, month, day] = kstDateKey(date).split("-").map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  const mondayOffset = (utcDate.getUTCDay() + 6) % 7;
  return utcDateKey(new Date(utcDate.getTime() - mondayOffset * 86400000));
}

function kstLongDate(date = new Date()) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(date);
}

function botNames() {
  return (process.env.BOT_NAMES || `${DEFAULT_BOT_NAME},봇`)
    .split(",")
    .map((name) => normalizeText(name))
    .filter(Boolean);
}

function configuredAdmins() {
  return (process.env.ADMIN_NAMES || "")
    .split(",")
    .map((name) => stripKakaoSuffix(name))
    .filter(Boolean);
}

function isBotSender(sender) {
  return botNames().includes(normalizeText(sender));
}

function jsonResponse(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

async function staticResponse(req, res, pathname) {
  if (!["GET", "HEAD"].includes(req.method || "")) return false;

  let relativePath;
  try {
    relativePath = pathname === "/" ? "index.html" : pathname === "/admin" ? "admin.html" : decodeURIComponent(pathname.replace(/^\/+/, ""));
    if (relativePath && !path.extname(relativePath) && !relativePath.endsWith("/")) {
      relativePath = `${relativePath}.html`;
    }
  } catch {
    return false;
  }
  if (!relativePath || relativePath.includes("\0")) return false;

  const filePath = path.join(PUBLIC_DIR, relativePath);
  const safePath = path.relative(PUBLIC_DIR, filePath);
  if (safePath.startsWith("..") || path.isAbsolute(safePath)) return false;

  try {
    const body = await readFile(filePath);
    const extension = path.extname(filePath).toLowerCase();
    const responseBody = extension === ".html"
      ? injectSessionNavScript(body.toString("utf8"))
      : body;
    const cacheControl = [".ico", ".jpg", ".jpeg", ".png", ".svg", ".webp"].includes(extension)
      ? "public, max-age=31536000, immutable"
      : "no-cache";
    res.writeHead(200, {
      "content-type": STATIC_CONTENT_TYPES[extension] || "application/octet-stream",
      "cache-control": cacheControl
    });
    if (req.method === "HEAD") res.end();
    else res.end(responseBody);
    return true;
  } catch (error) {
    if (error?.code !== "ENOENT" && error?.code !== "EISDIR") throw error;
    return false;
  }
}

function cloneInitialState() {
  return structuredClone(initialState);
}

async function getPgPool() {
  if (!process.env.DATABASE_URL) return null;
  if (!pgPool) {
    const { Pool } = await import("pg");
    const useSsl = process.env.PGSSL !== "disable" && !/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL);
    pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: Number(process.env.PG_POOL_MAX || 1),
      ssl: useSsl ? { rejectUnauthorized: false } : false
    });
  }
  return pgPool;
}

async function ensurePgDb(pool) {
  if (pgSchemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS kakao_room_ops_state (
      id text PRIMARY KEY,
      data jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  pgSchemaReady = true;
}

async function loadStateFromPostgres(pool) {
  await ensurePgDb(pool);
  const result = await pool.query("SELECT data FROM kakao_room_ops_state WHERE id = $1", [STATE_ID]);
  if (!result.rows.length) {
    const state = cloneInitialState();
    await saveStateToPostgres(pool, state);
    return state;
  }
  const data = result.rows[0].data;
  return typeof data === "string" ? JSON.parse(data) : data;
}

async function saveStateToPostgres(pool, state) {
  await ensurePgDb(pool);
  state.updatedAt = nowIso();
  await pool.query(
    `
      INSERT INTO kakao_room_ops_state (id, data, updated_at)
      VALUES ($1, $2::jsonb, now())
      ON CONFLICT (id)
      DO UPDATE SET data = EXCLUDED.data, updated_at = now()
    `,
    [STATE_ID, JSON.stringify(state)]
  );
}

async function loadState() {
  const pool = await getPgPool();
  const cached = cachedStateFor(pool);
  if (cached) return cached;
  if (pool) return rememberStateCache(pool, normalizeState(await loadStateFromPostgres(pool)));

  await mkdir(path.dirname(DB_PATH), { recursive: true });
  if (!existsSync(DB_PATH)) {
    const state = cloneInitialState();
    await saveState(state);
    return state;
  }
  const raw = await readFile(DB_PATH, "utf8");
  return rememberStateCache(pool, normalizeState(JSON.parse(raw)));
}

async function saveState(state) {
  const pool = await getPgPool();
  if (pool) {
    await saveStateToPostgres(pool, state);
    rememberStateCache(pool, state);
    return;
  }

  state.updatedAt = nowIso();
  await mkdir(path.dirname(DB_PATH), { recursive: true });
  const tmpPath = `${DB_PATH}.tmp`;
  await writeFile(tmpPath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  await replaceStateFile(tmpPath, DB_PATH);
  rememberStateCache(pool, state);
}

async function storageHealthStatus() {
  const checkedAt = nowIso();
  if (process.env.DATABASE_URL) {
    try {
      const pool = await getPgPool();
      await pool.query("SELECT 1 AS ok");
      return {
        ok: true,
        status: "ok",
        type: "postgres",
        label: "운영 DB",
        checkedAt
      };
    } catch (error) {
      return {
        ok: false,
        status: "error",
        type: "postgres",
        label: "운영 DB",
        checkedAt,
        message: "운영 DB 연결을 확인하지 못했습니다."
      };
    }
  }

  try {
    const exists = existsSync(DB_PATH);
    if (exists) await readFile(DB_PATH, "utf8");
    return {
      ok: true,
      status: exists ? "ok" : "ready",
      type: "local-json",
      label: exists ? "로컬 저장소" : "로컬 저장소 준비",
      checkedAt
    };
  } catch (error) {
    return {
      ok: false,
      status: "error",
      type: "local-json",
      label: "로컬 저장소",
      checkedAt,
      message: "로컬 저장소 파일을 읽지 못했습니다."
    };
  }
}

function versionCodeFromHealthOptions(options = {}) {
  const raw = options.androidVersionCode
    || options.appVersionCode
    || options.versionCode
    || options.clientVersionCode
    || "";
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function injectSessionNavScript(html) {
  if (!html.includes("</body>") || html.includes("/session-nav.js")) return html;
  return html.replace("</body>", '    <script src="/session-nav.js?v=20260525-command-sets" defer></script>\n  </body>');
}

async function replaceStateFile(tmpPath, targetPath) {
  try {
    await rename(tmpPath, targetPath);
    return;
  } catch (error) {
    if (!["EPERM", "EBUSY", "EACCES"].includes(error?.code)) throw error;
  }
  await new Promise((resolve) => setTimeout(resolve, 80));
  try {
    await rename(tmpPath, targetPath);
    return;
  } catch (error) {
    if (!["EPERM", "EBUSY", "EACCES"].includes(error?.code)) throw error;
  }
  await copyFile(tmpPath, targetPath);
  await unlink(tmpPath).catch(() => {});
}

function normalizeState(state) {
  state.rooms ||= {};
  state.accounts ||= {};
  state.applications ||= {};
  state.payments ||= {};
  state.roomTransfers ||= {};
  state.applicationInquiries ||= {};
  state.archivedRooms ||= {};
  state.restoreRequests ||= {};
  return state;
}

function elapsedMs(startedAt) {
  return Math.max(0, Math.round((performance.now() - startedAt) * 10) / 10);
}

function chatTimingPayload(startedAt, detail = {}) {
  return {
    receivedAt: detail.receivedAt || "",
    eventId: detail.eventId || "",
    totalMs: elapsedMs(startedAt),
    loadStateMs: Math.max(0, Math.round(Number(detail.loadStateMs || 0) * 10) / 10),
    guardMs: Math.max(0, Math.round(Number(detail.guardMs || 0) * 10) / 10),
    commandMs: Math.max(0, Math.round(Number(detail.commandMs || 0) * 10) / 10),
    logMs: Math.max(0, Math.round(Number(detail.logMs || 0) * 10) / 10),
    saveStateMs: Math.max(0, Math.round(Number(detail.saveStateMs || 0) * 10) / 10),
    cacheHit: Boolean(detail.cacheHit),
    duplicate: Boolean(detail.duplicate),
    saveRequired: detail.saveRequired !== false
  };
}

function generateEntityId(prefix) {
  return `${prefix}_${randomBytes(8).toString("hex")}`;
}

function normalizeEmail(value) {
  return compactSpaces(value).toLowerCase().slice(0, 180);
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));
}

function truthyConsent(value) {
  if (value === true) return true;
  const normalized = normalizeText(value).toLowerCase();
  return ["1", "true", "yes", "y", "on", "동의"].includes(normalized);
}

function validateConsentPayload(payload = {}) {
  const errors = [];
  if (!truthyConsent(payload.termsAgreed || payload.termsConsent)) errors.push("terms_required");
  if (!truthyConsent(payload.privacyAgreed || payload.privacyConsent)) errors.push("privacy_required");
  return {
    ok: errors.length === 0,
    errors,
    value: {
      termsAgreed: true,
      privacyAgreed: true,
      marketingAgreed: truthyConsent(payload.marketingAgreed || payload.marketingConsent)
    }
  };
}

function consentAuditFromPayload(payload = {}) {
  const now = nowIso();
  return {
    terms: {
      agreed: truthyConsent(payload.termsAgreed || payload.termsConsent),
      at: now,
      version: LEGAL_CONSENT_VERSION
    },
    privacy: {
      agreed: truthyConsent(payload.privacyAgreed || payload.privacyConsent),
      at: now,
      version: LEGAL_CONSENT_VERSION
    },
    marketing: {
      agreed: truthyConsent(payload.marketingAgreed || payload.marketingConsent),
      at: now,
      version: LEGAL_CONSENT_VERSION
    }
  };
}

function applyConsentToAccount(account = {}, payload = {}) {
  if (!truthyConsent(payload.termsAgreed || payload.termsConsent) && !truthyConsent(payload.privacyAgreed || payload.privacyConsent)) {
    return account;
  }
  account.consents = {
    ...(account.consents || {}),
    ...consentAuditFromPayload(payload)
  };
  return account;
}

function accountHasRequiredConsents(account = {}) {
  return Boolean(account.consents?.terms?.agreed && account.consents?.privacy?.agreed);
}

function normalizeAccountNickname(payload = {}) {
  return compactSpaces(payload.nickname || payload.displayName || payload.fullName || payload.full_name || payload.name || "").slice(0, 40);
}

function applyAccountProfile(account = {}, payload = {}) {
  const nickname = normalizeAccountNickname(payload);
  if (nickname) account.nickname = nickname;
  return account;
}

function validateAccountPayload(payload = {}, options = {}) {
  const email = normalizeEmail(payload.email);
  const password = String(payload.password || "");
  const passwordConfirm = String(payload.passwordConfirm || payload.confirmPassword || payload.password_confirmation || "");
  const nickname = normalizeAccountNickname(payload);
  const errors = [];
  if (!validEmail(email)) errors.push("email_required");
  if (password.length < SIGNUP_PASSWORD_MIN_LENGTH) errors.push("password_too_short");
  if (passwordConfirm && passwordConfirm !== password) errors.push("password_mismatch");
  if (options.requireNickname && !nickname) errors.push("nickname_required");
  if (options.requireConsents) {
    const consentValidation = validateConsentPayload(payload);
    errors.push(...consentValidation.errors);
  }
  return {
    ok: errors.length === 0,
    errors,
    value: { email, password, nickname }
  };
}

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(String(password), salt, 32).toString("hex");
  return { algorithm: "scrypt", salt, hash };
}

function verifyPassword(password, passwordHash = {}) {
  if (passwordHash.algorithm !== "scrypt" || !passwordHash.salt || !passwordHash.hash) return false;
  const expected = Buffer.from(passwordHash.hash, "hex");
  const actual = scryptSync(String(password), passwordHash.salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function findAccountByEmail(state, email) {
  const normalized = normalizeEmail(email);
  return Object.values(state.accounts || {}).find((account) => account.email === normalized);
}

function findAccountByExternalUser(state, provider, externalId) {
  const normalizedProvider = normalizeText(provider);
  const normalizedExternalId = normalizeText(externalId);
  if (!normalizedProvider || !normalizedExternalId) return null;
  return Object.values(state.accounts || {}).find((account) => {
    const primary = account.auth?.provider === normalizedProvider
      && account.auth?.externalId === normalizedExternalId;
    const linked = Array.isArray(account.externalAccounts)
      && account.externalAccounts.some((external) => (
        external.provider === normalizedProvider
        && external.externalId === normalizedExternalId
      ));
    return primary || linked;
  });
}

function supabaseEnabled() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

function supabaseOtpEnabled() {
  return Boolean(supabaseEnabled() && SUPABASE_OTP_ENABLED);
}

function authConfigPayload() {
  const kakaoOidcEnabled = kakaoOidcConfigured();
  return {
    ok: true,
    version: APP_VERSION,
    auth: {
      mode: supabaseEnabled() ? "supabase" : "local",
      supabaseEnabled: supabaseEnabled(),
      supabaseUrl: SUPABASE_URL,
      supabaseAnonKey: SUPABASE_ANON_KEY,
      kakaoEnabled: supabaseEnabled() && SUPABASE_KAKAO_ENABLED,
      googleEnabled: supabaseEnabled() && SUPABASE_GOOGLE_ENABLED,
      appleEnabled: supabaseEnabled() && SUPABASE_APPLE_ENABLED,
      otpEnabled: supabaseOtpEnabled(),
      kakaoMode: kakaoOidcEnabled ? "oidc" : "supabase-oauth",
      kakaoOidcEnabled,
      kakaoOidcStartUrl: kakaoOidcEnabled ? "/api/auth/kakao/start" : "",
      googleStartUrl: supabaseEnabled() && SUPABASE_GOOGLE_ENABLED ? "/api/auth/social/start?provider=google" : "",
      appleStartUrl: supabaseEnabled() && SUPABASE_APPLE_ENABLED ? "/api/auth/social/start?provider=apple" : "",
      passwordResetUrl: supabaseEnabled() ? "/api/auth/password-reset/request" : "",
      loginRedirectUrl: `${PUBLIC_SITE_URL}/login`,
      consoleRedirectUrl: `${PUBLIC_SITE_URL}/console`
    },
    routes: {
      ownerAdmin: "/admin",
      buyerConsole: "/console",
      rooms: "/my-rooms",
      setup: "/setup",
      license: "/license",
      forgotPassword: "/forgot-password",
      resetPassword: "/reset-password"
    },
    ownerAdmin: {
      enabled: OWNER_ADMIN_EMAILS.length > 0,
      auth: "email_allowlist"
    }
  };
}

function kakaoOidcConfigured() {
  return Boolean(supabaseEnabled() && SUPABASE_KAKAO_ENABLED && KAKAO_OIDC_ENABLED && KAKAO_REST_API_KEY);
}

function kakaoOidcRedirectUri() {
  return `${PUBLIC_SITE_URL}${KAKAO_OIDC_CALLBACK_PATH}`;
}

function supabaseSocialProviderEnabled(provider = "") {
  const normalized = normalizeText(provider);
  if (normalized === "google") return supabaseEnabled() && SUPABASE_GOOGLE_ENABLED;
  if (normalized === "apple") return supabaseEnabled() && SUPABASE_APPLE_ENABLED;
  return false;
}

function supabaseSocialStartUrl(provider = "", redirectTo = "") {
  const normalized = normalizeText(provider);
  if (!supabaseSocialProviderEnabled(normalized)) return "";
  const params = new URLSearchParams({
    provider: normalized,
    redirect_to: redirectTo || `${PUBLIC_SITE_URL}/login`
  });
  return `${SUPABASE_URL}/auth/v1/authorize?${params.toString()}`;
}

function authStateSecret() {
  return ADMIN_CONSOLE_TOKEN || SUPABASE_ANON_KEY || STATE_ID;
}

function authStateEncode(value) {
  return Buffer.from(value).toString("base64url");
}

function authStateDecode(value) {
  return Buffer.from(String(value || ""), "base64url").toString("utf8");
}

function signAuthState(payload) {
  return createHmac("sha256", authStateSecret()).update(payload).digest("base64url");
}

function sanitizeLocalRedirect(value, fallback = "/login") {
  const redirect = normalizeText(value || fallback);
  if (!redirect.startsWith("/") || redirect.startsWith("//") || redirect.includes("\\")) return fallback;
  if (redirect.startsWith("/api/")) return fallback;
  return redirect;
}

function createKakaoOidcState(redirectPath) {
  const payload = authStateEncode(JSON.stringify({
    redirectPath: sanitizeLocalRedirect(redirectPath),
    exp: Date.now() + 10 * 60 * 1000
  }));
  return `${payload}.${signAuthState(payload)}`;
}

function verifyKakaoOidcState(stateValue) {
  const [payload, signature] = normalizeText(stateValue).split(".");
  if (!payload || !signature) return { ok: false, redirectPath: "/login" };
  const expected = signAuthState(payload);
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== signatureBuffer.length || !timingSafeEqual(expectedBuffer, signatureBuffer)) {
    return { ok: false, redirectPath: "/login" };
  }
  try {
    const parsed = JSON.parse(authStateDecode(payload));
    if (Number(parsed.exp || 0) < Date.now()) return { ok: false, redirectPath: "/login" };
    return { ok: true, redirectPath: sanitizeLocalRedirect(parsed.redirectPath) };
  } catch {
    return { ok: false, redirectPath: "/login" };
  }
}

function htmlResponse(res, statusCode, html) {
  res.writeHead(statusCode, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(html);
}

function redirectResponse(res, location) {
  res.writeHead(302, {
    location,
    "cache-control": "no-store"
  });
  res.end();
}

function jsonForScript(value) {
  return JSON.stringify(value).replace(/[<>&]/g, (char) => ({
    "<": "\\u003c",
    ">": "\\u003e",
    "&": "\\u0026"
  })[char]);
}

function kakaoCallbackErrorPage(message, redirectPath = "/login") {
  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>카카오 로그인 오류 | 픽셀곰</title>
    <link rel="stylesheet" href="/styles.css?v=20260525-auth-pricing">
  </head>
  <body class="auth-page">
    <main class="auth-shell">
      <section class="auth-card">
        <p class="section-kicker">Kakao Login</p>
        <h1>카카오 로그인을 완료하지 못했습니다.</h1>
        <p>${message}</p>
        <a class="button button-primary" href="${sanitizeLocalRedirect(redirectPath)}">로그인으로 돌아가기</a>
      </section>
    </main>
  </body>
</html>`;
}

function kakaoOidcCallbackPage({ idToken, redirectPath }) {
  const payload = {
    supabaseUrl: SUPABASE_URL,
    supabaseAnonKey: SUPABASE_ANON_KEY,
    idToken,
    redirectPath: sanitizeLocalRedirect(redirectPath)
  };
  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>카카오 로그인 처리 중 | 픽셀곰</title>
    <link rel="stylesheet" href="/styles.css?v=20260525-auth-pricing">
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
  </head>
  <body class="auth-page">
    <main class="auth-shell">
      <section class="auth-card">
        <p class="section-kicker">Kakao Login</p>
        <h1>카카오 로그인 처리 중입니다.</h1>
        <p>잠시만 기다려 주세요. 완료 후 픽셀곰으로 돌아갑니다.</p>
        <pre class="form-status" data-kakao-oidc-status aria-live="polite">Supabase 세션을 생성하고 있습니다.</pre>
      </section>
    </main>
    <script>
      const payload = ${jsonForScript(payload)};
      const statusBox = document.querySelector("[data-kakao-oidc-status]");
      (async () => {
        try {
          const client = window.supabase.createClient(payload.supabaseUrl, payload.supabaseAnonKey);
          const { error } = await client.auth.signInWithIdToken({
            provider: "kakao",
            token: payload.idToken
          });
          if (error) throw error;
          statusBox.textContent = "로그인 세션 생성 완료. 이동합니다.";
          window.location.replace(payload.redirectPath);
        } catch (error) {
          statusBox.textContent = "카카오 로그인 실패: " + (error?.message || "unknown_error");
        }
      })();
    </script>
  </body>
</html>`;
}

async function handleKakaoOidcStart(res, url) {
  const redirectPath = sanitizeLocalRedirect(url.searchParams.get("redirect") || "/login");
  if (!kakaoOidcConfigured()) {
    htmlResponse(res, 503, kakaoCallbackErrorPage("카카오 OIDC 로그인이 아직 서버에 설정되지 않았습니다.", redirectPath));
    return;
  }
  const params = new URLSearchParams({
    response_type: "code",
    client_id: KAKAO_REST_API_KEY,
    redirect_uri: kakaoOidcRedirectUri(),
    scope: KAKAO_OIDC_SCOPE,
    state: createKakaoOidcState(redirectPath)
  });
  redirectResponse(res, `https://kauth.kakao.com/oauth/authorize?${params.toString()}`);
}

async function handleKakaoOidcCallback(res, url) {
  const state = verifyKakaoOidcState(url.searchParams.get("state"));
  const redirectPath = state.redirectPath || "/login";
  if (!state.ok) {
    htmlResponse(res, 400, kakaoCallbackErrorPage("로그인 요청 시간이 만료되었거나 올바르지 않습니다.", redirectPath));
    return;
  }
  const error = normalizeText(url.searchParams.get("error"));
  if (error) {
    htmlResponse(res, 400, kakaoCallbackErrorPage(`카카오가 로그인을 취소했습니다: ${error}`, redirectPath));
    return;
  }
  const code = normalizeText(url.searchParams.get("code"));
  if (!code) {
    htmlResponse(res, 400, kakaoCallbackErrorPage("카카오 인증 코드가 없습니다.", redirectPath));
    return;
  }
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: KAKAO_REST_API_KEY,
    redirect_uri: kakaoOidcRedirectUri(),
    code
  });
  if (KAKAO_CLIENT_SECRET) body.set("client_secret", KAKAO_CLIENT_SECRET);
  const response = await fetch("https://kauth.kakao.com/oauth/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded;charset=utf-8" },
    body
  });
  const tokenPayload = await response.json().catch(() => ({}));
  if (!response.ok || !tokenPayload.id_token) {
    htmlResponse(res, 502, kakaoCallbackErrorPage("카카오 ID 토큰을 발급받지 못했습니다. 관리자 설정을 확인해 주세요.", redirectPath));
    return;
  }
  htmlResponse(res, 200, kakaoOidcCallbackPage({ idToken: tokenPayload.id_token, redirectPath }));
}

async function supabaseUserFromAccessToken(accessToken) {
  const token = normalizeText(accessToken);
  if (!token) return { ok: false, status: 401, error: "missing_access_token" };
  if (!supabaseEnabled()) return { ok: false, status: 503, error: "supabase_not_configured" };
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      authorization: `Bearer ${token}`
    }
  });
  if (!response.ok) return { ok: false, status: 401, error: "invalid_access_token" };
  const user = await response.json();
  const email = normalizeEmail(user.email || user.user_metadata?.email);
  if (!user.id) return { ok: false, status: 401, error: "invalid_supabase_user" };
  const provider = normalizeText(user.app_metadata?.provider || user.identities?.[0]?.provider || "supabase");
  return {
    ok: true,
    user: {
      id: normalizeText(user.id),
      email: validEmail(email) ? email : "",
      provider,
      providers: Array.isArray(user.app_metadata?.providers) ? user.app_metadata.providers : [],
      name: normalizeAccountNickname(user.user_metadata || {}),
      avatarUrl: normalizeText(user.user_metadata?.avatar_url || user.user_metadata?.picture || "")
    }
  };
}

async function supabaseUserFromPassword(email, password) {
  const normalizedEmail = normalizeEmail(email);
  const rawPassword = String(password || "");
  if (!validEmail(normalizedEmail) || !rawPassword) {
    return { ok: false, status: 401, error: "invalid_login" };
  }
  if (!supabaseEnabled()) return { ok: false, status: 503, error: "supabase_not_configured" };
  let response;
  try {
    response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        email: normalizedEmail,
        password: rawPassword
      })
    });
  } catch {
    return { ok: false, status: 502, error: "supabase_login_unavailable" };
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) {
    return { ok: false, status: 401, error: "invalid_login" };
  }
  return supabaseUserFromAccessToken(payload.access_token);
}

async function sendSupabaseEmailOtp(email) {
  const normalizedEmail = normalizeEmail(email);
  if (!validEmail(normalizedEmail)) return { ok: false, status: 400, error: "email_required" };
  if (!supabaseOtpEnabled()) return { ok: false, status: 503, error: "supabase_otp_unavailable" };
  let response;
  try {
    response = await fetch(`${SUPABASE_URL}/auth/v1/otp`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        email: normalizedEmail,
        create_user: true,
        should_create_user: true
      })
    });
  } catch {
    return { ok: false, status: 502, error: "supabase_otp_unavailable" };
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return { ok: false, status: response.status || 502, error: payload.error || payload.msg || "supabase_otp_unavailable" };
  }
  return { ok: true, status: 200 };
}

async function requestSupabasePasswordRecovery(email) {
  const normalizedEmail = normalizeEmail(email);
  if (!validEmail(normalizedEmail)) return { ok: false, status: 400, error: "email_required" };
  if (!supabaseEnabled()) return { ok: false, status: 503, error: "supabase_not_configured" };
  const redirectTo = `${PUBLIC_SITE_URL}/reset-password`;
  let response;
  try {
    response = await fetch(`${SUPABASE_URL}/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTo)}`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        "content-type": "application/json"
      },
      body: JSON.stringify({ email: normalizedEmail })
    });
  } catch {
    return { ok: false, status: 502, error: "password_reset_unavailable" };
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return { ok: false, status: response.status || 502, error: payload.error || payload.msg || "password_reset_unavailable" };
  }
  return { ok: true, status: 200, message: "password_reset_sent", email: normalizedEmail };
}

async function supabaseUserFromEmailOtp(email, token) {
  const normalizedEmail = normalizeEmail(email);
  const otp = normalizeText(token);
  if (!validEmail(normalizedEmail) || !otp) return { ok: false, status: 401, error: "invalid_otp" };
  if (!supabaseOtpEnabled()) return { ok: false, status: 503, error: "supabase_otp_unavailable" };
  let response;
  try {
    response = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        email: normalizedEmail,
        token: otp,
        type: "email"
      })
    });
  } catch {
    return { ok: false, status: 502, error: "supabase_otp_unavailable" };
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) {
    return { ok: false, status: response.status || 401, error: payload.error || payload.msg || "invalid_otp" };
  }
  return supabaseUserFromAccessToken(payload.access_token);
}

async function kakaoUserFromAccessToken(accessToken) {
  const token = normalizeText(accessToken);
  if (!token) return { ok: false, status: 401, error: "missing_kakao_access_token" };
  const response = await fetch("https://kapi.kakao.com/v2/user/me", {
    headers: { authorization: `Bearer ${token}` }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.id) return { ok: false, status: 401, error: "invalid_kakao_access_token" };
  const kakaoAccount = payload.kakao_account || {};
  const properties = payload.properties || {};
  const profile = kakaoAccount.profile || {};
  const email = normalizeEmail(kakaoAccount.email || "");
  return {
    ok: true,
    user: {
      id: normalizeText(payload.id),
      email: validEmail(email) ? email : "",
      provider: "kakao",
      providers: ["kakao"],
      name: normalizeAccountNickname({
        nickname: profile.nickname || properties.nickname || kakaoAccount.name || ""
      }),
      avatarUrl: normalizeText(profile.profile_image_url || properties.profile_image || "")
    }
  };
}

function isOwnerEmail(email) {
  return OWNER_ADMIN_EMAILS.includes(normalizeEmail(email));
}

function ensureExternalAccount(state, externalUser = {}, payload = {}) {
  const provider = externalUser.provider || "supabase";
  let account = findAccountByExternalUser(state, provider, externalUser.id) || (externalUser.email ? findAccountByEmail(state, externalUser.email) : null);
  if (!account) {
    const accountId = generateEntityId("acct");
    account = {
      id: accountId,
      email: externalUser.email || "",
      status: "active",
      applicationIds: [],
      createdAt: nowIso()
    };
    state.accounts[accountId] = account;
  }
  account.auth = {
    provider,
    externalId: externalUser.id,
    providers: externalUser.providers || [],
    name: externalUser.name || account.auth?.name || "",
    avatarUrl: externalUser.avatarUrl || account.auth?.avatarUrl || "",
    linkedAt: account.auth?.linkedAt || nowIso()
  };
  account.email = externalUser.email || account.email || "";
  applyAccountProfile(account, { nickname: normalizeAccountNickname(payload) || externalUser.name || account.nickname || "" });
  account.status ||= "active";
  account.applicationIds ||= [];
  account.lastLoginAt = nowIso();
  applyConsentToAccount(account, payload);
  account.updatedAt = nowIso();
  return account;
}

function linkExternalAccount(account = {}, externalUser = {}) {
  const provider = normalizeText(externalUser.provider || "kakao");
  const externalId = normalizeText(externalUser.id);
  if (!provider || !externalId) return account;
  account.externalAccounts = Array.isArray(account.externalAccounts) ? account.externalAccounts : [];
  const existing = account.externalAccounts.find((item) => item.provider === provider && item.externalId === externalId);
  const linked = {
    provider,
    externalId,
    providers: externalUser.providers || [provider],
    name: externalUser.name || "",
    avatarUrl: externalUser.avatarUrl || "",
    linkedAt: existing?.linkedAt || nowIso(),
    updatedAt: nowIso()
  };
  if (existing) Object.assign(existing, linked);
  else account.externalAccounts.push(linked);
  account.auth ||= {};
  if (!account.auth.provider || account.auth.provider === "password") {
    account.auth = { ...linked };
  }
  if (!account.email && externalUser.email) account.email = externalUser.email;
  if (!account.nickname && externalUser.name) account.nickname = externalUser.name;
  account.updatedAt = nowIso();
  return account;
}

async function externalAccountFromRequest(state, body = {}, options = {}) {
  const accessToken = normalizeText(body.accessToken || body.supabaseAccessToken || body.jwt);
  if (!accessToken) return null;
  const auth = await supabaseUserFromAccessToken(accessToken);
  if (!auth.ok) return auth;
  const existing = findAccountByExternalUser(state, auth.user.provider || "supabase", auth.user.id) || findAccountByEmail(state, auth.user.email);
  if (!existing && options.requireConsentsForNew) {
    const consentValidation = validateConsentPayload(body);
    if (!consentValidation.ok) return { ok: false, status: 400, error: consentValidation.errors[0], errors: consentValidation.errors };
  }
  return { ok: true, account: ensureExternalAccount(state, auth.user, body) };
}

function publicAccountView(account = {}) {
  return {
    id: account.id || "",
    email: account.email || "",
    nickname: account.nickname || account.auth?.name || "",
    status: account.status || "active",
    ownerAccess: isOwnerEmail(account.email),
    authProvider: account.auth?.provider || "password",
    createdAt: account.createdAt || "",
    lastLoginAt: account.lastLoginAt || "",
    consents: {
      terms: Boolean(account.consents?.terms?.agreed),
      privacy: Boolean(account.consents?.privacy?.agreed),
      marketing: Boolean(account.consents?.marketing?.agreed),
      termsAt: account.consents?.terms?.at || "",
      privacyAt: account.consents?.privacy?.at || "",
      marketingAt: account.consents?.marketing?.at || "",
      version: account.consents?.terms?.version || LEGAL_CONSENT_VERSION
    },
    applicationIds: account.applicationIds || []
  };
}

function publicPaymentView(payment = {}) {
  const requestedAt = payment.requestedAt || payment.createdAt || "";
  return {
    id: payment.id || "",
    applicationId: payment.applicationId || "",
    amountKrw: Number(payment.amountKrw || MONTHLY_PRICE_KRW),
    method: payment.method || "manual_deposit",
    status: payment.status || "awaiting_manual_deposit",
    statusLabel: PAYMENT_STATUS_LABELS[payment.status] || payment.status || "입금 대기",
    requestedAt,
    createdAt: payment.createdAt || "",
    approvedAt: payment.approvedAt || "",
    approvedBy: payment.approvedBy || ""
  };
}

function lifecycleTone(status = "") {
  if (["active", "approved_paid"].includes(status)) return "good";
  if (["pending_payment", "payment_required", "approved_unpaid", "expiring_soon", "needs_setup"].includes(status)) return "warn";
  if (["expired", "rejected", "on_hold", "archived", "purged", "cancelled"].includes(status)) return "bad";
  return "neutral";
}

function applicationLifecycleSnapshot(state = {}, application = {}, roomState = null, options = {}) {
  const payment = state.payments?.[application.paymentId] || {};
  const room = roomState || state.rooms?.[roomKey(application.roomName)];
  const subscription = room ? updateSubscriptionStatus(room) : {};
  let status = "pending_payment";
  let label = "결제 대기";
  let available = false;
  let actionRequired = "입금 확인 대기";
  if (options.archivedRecord || application.archivedAt) {
    status = "archived";
    label = "이용 종료 보관";
    actionRequired = "복구 요청 또는 관리자 복구";
  } else if (application.purgedAt) {
    status = "purged";
    label = "완전 삭제";
    actionRequired = "재신청 필요";
  } else if (["rejected", "cancelled"].includes(application.status)) {
    status = application.status;
    label = APPLICATION_STATUS_LABELS[application.status] || "반려";
    actionRequired = "신청 정보 확인";
  } else if (application.status === "on_hold" || payment.status === "on_hold") {
    status = "on_hold";
    label = "보류";
    actionRequired = "관리자 확인 필요";
  } else if (application.status !== "approved") {
    status = "pending_payment";
    label = APPLICATION_STATUS_LABELS[application.status] || "결제 대기";
    actionRequired = "입금 또는 승인 대기";
  } else if (payment.status !== "paid") {
    status = "approved_unpaid";
    label = "승인 대기";
    actionRequired = "입금 확인 필요";
  } else if (subscription.status === "expired") {
    status = "expired";
    label = "만료";
    actionRequired = "연장 결제 필요";
  } else if (room?.settings?.enabled === false) {
    status = "on_hold";
    label = "보류";
    actionRequired = "방 사용 설정 확인";
  } else if (!room?.settings?.registered) {
    status = "needs_setup";
    label = "설정 필요";
    actionRequired = "방 등록 및 앱 연결 필요";
  } else {
    status = "active";
    label = "이용 중";
    available = true;
    actionRequired = "정상 운영";
  }
  const remainingDays = Number(subscription.remainingDays);
  if (status === "active" && Number.isFinite(remainingDays) && remainingDays >= 0 && remainingDays <= 7) {
    status = "expiring_soon";
    label = "만료 임박";
    actionRequired = "연장 결제 권장";
  }
  return {
    status,
    label,
    tone: lifecycleTone(status),
    available,
    actionRequired,
    applicationStatus: application.status || "pending_payment",
    applicationStatusLabel: APPLICATION_STATUS_LABELS[application.status] || application.status || "결제 대기",
    paymentStatus: payment.status || "awaiting_manual_deposit",
    paymentStatusLabel: PAYMENT_STATUS_LABELS[payment.status] || payment.status || "입금 대기",
    subscriptionStatus: subscription.status || "unset",
    expiresAt: subscription.expiresAt || "",
    remainingDays: Number.isFinite(remainingDays) ? remainingDays : null
  };
}

function publicLinkedApplicationSummary(state = {}, application = {}) {
  if (!application?.id) return null;
  const payment = state.payments?.[application.paymentId] || {};
  const roomState = state.rooms?.[roomKey(application.roomName)];
  const lifecycle = applicationLifecycleSnapshot(state, application, roomState);
  return {
    id: application.id || "",
    roomName: application.roomName || "",
    roomLink: application.roomLink || "",
    roomId: application.roomId || "",
    roomPurpose: application.roomPurpose || "general_room",
    status: application.status || "pending_payment",
    statusLabel: APPLICATION_STATUS_LABELS[application.status] || application.status || "결제 대기",
    paymentStatus: payment.status || "awaiting_manual_deposit",
    paymentStatusLabel: PAYMENT_STATUS_LABELS[payment.status] || payment.status || "입금 대기",
    paymentRequestedAt: payment.requestedAt || payment.createdAt || "",
    lifecycle
  };
}

function paymentReviewNeededForApplication(state = {}, application = {}) {
  if (!application?.id || application.archivedAt || application.purgedAt) return false;
  if (["cancelled", "rejected", "on_hold"].includes(application.status)) return false;
  const payment = state.payments?.[application.paymentId] || {};
  if (application.status !== "approved") return true;
  return payment.status !== "paid";
}

function appConnectCodeStatusForApplication(state = {}, application = {}) {
  if (!application?.id || application.purgedAt) return "unavailable";
  if (application.archivedAt) return "archived";
  if (applicationApprovedAndPaid(state, application)) return "ready";
  return "pending_approval";
}

function appConnectCodeStatusLabel(status = "") {
  return {
    ready: "발급 완료",
    pending_approval: "입금승인 후 발급",
    archived: "이용 종료",
    unavailable: "발급 불가"
  }[status] || "확인 필요";
}

function applicationInquirySummary(state = {}, applicationId = "") {
  const inquiries = Object.values(state.applicationInquiries || {})
    .filter((inquiry) => inquiry.applicationId === applicationId);
  const open = inquiries.filter((inquiry) => inquiry.status !== "resolved").length;
  const latest = inquiries
    .map((inquiry) => inquiry.createdAt || "")
    .sort()
    .at(-1) || "";
  return {
    total: inquiries.length,
    open,
    latestAt: latest
  };
}

function billableApplicationCount(state, account = {}) {
  return (account.applicationIds || [])
    .map((id) => state.applications?.[id])
    .filter((application) => application && application.status !== "cancelled" && application.status !== "rejected")
    .length;
}

function applicationPlanForAccount(state, account = {}, options = {}) {
  if (options.roomPurpose === "game_room") {
    return {
      type: "game_room",
      label: "게임방 옵션",
      monthlyPriceKrw: ADDITIONAL_ROOM_PRICE_KRW,
      baseMonthlyPriceKrw: MONTHLY_PRICE_KRW,
      additionalRoomPriceKrw: ADDITIONAL_ROOM_PRICE_KRW,
      days: DEFAULT_SUBSCRIPTION_DAYS
    };
  }
  const additionalRoom = billableApplicationCount(state, account) > 0;
  return {
    type: additionalRoom ? "additional_room" : "base_room",
    label: additionalRoom ? "추가 방" : "기본 방",
    monthlyPriceKrw: additionalRoom ? ADDITIONAL_ROOM_PRICE_KRW : MONTHLY_PRICE_KRW,
    baseMonthlyPriceKrw: MONTHLY_PRICE_KRW,
    additionalRoomPriceKrw: ADDITIONAL_ROOM_PRICE_KRW,
    days: DEFAULT_SUBSCRIPTION_DAYS
  };
}

function publicApplicationView(application = {}, state = null) {
  const payment = state?.payments?.[application.paymentId] || {};
  const roomState = state?.rooms?.[roomKey(application.roomName)] || null;
  const lifecycle = state ? applicationLifecycleSnapshot(state, application, roomState) : null;
  const paymentReviewNeeded = state ? paymentReviewNeededForApplication(state, application) : false;
  const appConnectCodeStatus = state ? appConnectCodeStatusForApplication(state, application) : "unavailable";
  const mainRoom = normalizeApplicationRoomPurpose(application.roomPurpose) === "game_room"
    ? publicLinkedApplicationSummary(state || {}, state?.applications?.[application.linkedApplicationId])
    : null;
  return {
    id: application.id || "",
    accountId: application.accountId || "",
    email: application.email || "",
    roomName: application.roomName || "",
    roomLink: application.roomLink || "",
    roomId: application.roomId || "",
    adminName: application.adminName || "",
    contact: application.contact || "",
    memo: application.memo || "",
    roomPurpose: application.roomPurpose || "general_room",
    linkedApplicationId: application.linkedApplicationId || "",
    status: application.status || "pending_payment",
    statusLabel: APPLICATION_STATUS_LABELS[application.status] || application.status || "결제 대기",
    lifecycle,
    lifecycleStatus: lifecycle?.status || "",
    lifecycleLabel: lifecycle?.label || "",
    paymentReviewNeeded,
    appConnectCodeStatus,
    appConnectCodeStatusLabel: appConnectCodeStatusLabel(appConnectCodeStatus),
    plan: application.plan || {
      type: "base_room",
      label: "기본 방",
      monthlyPriceKrw: MONTHLY_PRICE_KRW,
      baseMonthlyPriceKrw: MONTHLY_PRICE_KRW,
      additionalRoomPriceKrw: ADDITIONAL_ROOM_PRICE_KRW,
      days: DEFAULT_SUBSCRIPTION_DAYS
    },
    payment: publicPaymentView(payment),
    mainRoom,
    linkedApplication: mainRoom,
    inquirySummary: state ? applicationInquirySummary(state, application.id || "") : { total: 0, open: 0, latestAt: "" },
    licenseKey: application.licenseKey || "",
    createdAt: application.createdAt || "",
    approvedAt: application.approvedAt || "",
    approvedBy: application.approvedBy || ""
  };
}

function base64UrlEncode(value) {
  return Buffer.from(value).toString("base64url");
}

function base64UrlJson(value) {
  return base64UrlEncode(JSON.stringify(value));
}

function buyerTokenSecret() {
  return normalizeText(process.env.BUYER_TOKEN_SECRET || ADMIN_CONSOLE_TOKEN || "local-buyer-token-secret");
}

function signTokenPayload(payload) {
  const encoded = base64UrlJson(payload);
  const signature = createHmac("sha256", buyerTokenSecret()).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

function verifyTokenPayload(token) {
  const [encoded, signature] = normalizeText(token).split(".");
  if (!encoded || !signature) return null;
  const expected = createHmac("sha256", buyerTokenSecret()).update(encoded).digest("base64url");
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== signatureBuffer.length || !timingSafeEqual(expectedBuffer, signatureBuffer)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (!payload.exp || Number(payload.exp) <= Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function buyerTokenForAccount(account = {}) {
  return signTokenPayload({
    kind: "buyer-guide",
    sub: account.id,
    email: account.email,
    exp: Date.now() + BUYER_TOKEN_TTL_MS
  });
}

function loginOtpChallengeForAccount(account = {}) {
  return signTokenPayload({
    kind: "buyer-login-otp",
    sub: account.id,
    email: account.email,
    exp: Date.now() + 10 * 60 * 1000
  });
}

function verifyLoginOtpChallenge(token, email = "") {
  const payload = verifyTokenPayload(token);
  if (!payload || payload.kind !== "buyer-login-otp") return null;
  if (normalizeEmail(payload.email) !== normalizeEmail(email)) return null;
  return payload;
}

function ownerTokenForAccount(account = {}) {
  return signTokenPayload({
    kind: "owner-admin",
    sub: account.id,
    email: account.email,
    exp: Date.now() + OWNER_TOKEN_TTL_MS
  });
}

function bridgeConnectCodeForApplication(account = {}, application = {}) {
  return signTokenPayload({
    kind: "bridge-connect",
    sub: account.id,
    app: application.id,
    email: account.email,
    room: application.roomName,
    exp: Date.now() + BUYER_TOKEN_TTL_MS
  });
}

function buyerGuideUrlsPayload({ absolute = false } = {}) {
  const urls = {
    console: "/console",
    setup: "/console?view=setup",
    rooms: "/console?view=rooms",
    license: "/console?view=license",
    android: "/console?from=android&view=setup"
  };
  if (!absolute) return urls;
  return Object.fromEntries(Object.entries(urls).map(([key, value]) => [key, `${PUBLIC_SITE_URL}${value}`]));
}

function signedTokenHash(value = "") {
  return createHmac("sha256", buyerTokenSecret()).update(normalizeText(value)).digest("hex");
}

function applicationInquiryTokenForApplication(application = {}, account = {}) {
  return signTokenPayload({
    kind: "application-inquiry",
    sub: account.id,
    app: application.id,
    email: account.email,
    exp: Date.now() + BUYER_TOKEN_TTL_MS
  });
}

function roomTransferCodeHash(code) {
  return createHmac("sha256", buyerTokenSecret()).update(normalizeText(code)).digest("hex");
}

function tokenFromRequest(req, body = {}) {
  return normalizeText(
    body.token
      || body.buyerToken
      || req.headers["x-buyer-token"]
      || req.headers.authorization?.replace(/^Bearer\s+/i, "")
  );
}

function accountFromBuyerToken(state, token) {
  const tokenPayload = verifyTokenPayload(token);
  if (tokenPayload?.sub && (!tokenPayload.kind || tokenPayload.kind === "buyer-guide") && state.accounts?.[tokenPayload.sub]) {
    return state.accounts[tokenPayload.sub];
  }
  return null;
}

function approvedBuyerApplications(state, account = {}) {
  return (account.applicationIds || [])
    .map((id) => state.applications?.[id])
    .filter(Boolean)
    .filter((application) => !application.archivedAt)
    .filter((application) => application.status === "approved")
    .filter((application) => state.payments?.[application.paymentId]?.status === "paid");
}

function applicationApprovedAndPaid(state, application = {}) {
  return Boolean(application?.status === "approved" && !application.archivedAt && state.payments?.[application.paymentId]?.status === "paid");
}

function applicationActiveForBilling(application = {}) {
  return Boolean(application && !["cancelled", "rejected"].includes(application.status));
}

function gameRoomApplicationsForBase(state, account = {}, baseApplication = {}) {
  if (!baseApplication?.id) return [];
  return (account.applicationIds || [])
    .map((id) => state.applications?.[id])
    .filter(Boolean)
    .filter(applicationActiveForBilling)
    .filter((application) => normalizeApplicationRoomPurpose(application.roomPurpose) === "game_room")
    .filter((application) => application.linkedApplicationId === baseApplication.id);
}

function gameRoomSummaryPayload(state, account = {}, application = {}) {
  const roomState = state.rooms?.[roomKey(application.roomName)];
  const roomView = roomState ? roomAdminView(roomState, state, { application }) : null;
  const payment = state.payments?.[application.paymentId] || {};
  const approved = application.status === "approved" && payment.status === "paid";
  return {
    applicationId: application.id || "",
    roomName: application.roomName || "",
    roomId: application.roomId || roomView?.roomIds?.[0] || "",
    roomLink: application.roomLink || roomView?.roomLinks?.[0] || "",
    roomPurpose: application.roomPurpose || "game_room",
    linkedApplicationId: application.linkedApplicationId || "",
    status: application.status || "pending_payment",
    statusLabel: APPLICATION_STATUS_LABELS[application.status] || application.status || "결제 대기",
    paymentStatus: payment.status || "awaiting_manual_deposit",
    paymentStatusLabel: PAYMENT_STATUS_LABELS[payment.status] || payment.status || "입금 대기",
    roomRole: roomView?.roomRole || "game",
    bridgeStatus: approved && (application.roomId || roomView?.roomIds?.[0]) ? "ready" : "needs_setup",
    bridgeConnectCode: approved ? bridgeConnectCodeForApplication(account, application) : ""
  };
}

function linkedRoomStatesForAdminSync(state, roomState = {}) {
  const rooms = [];
  const addRoom = (candidate) => {
    if (!candidate || rooms.includes(candidate)) return;
    rooms.push(candidate);
  };
  addRoom(roomState);
  const currentKey = roomKey(roomState.name);
  const canonicalKey = roomKey(roomState.settings?.canonicalRoomKey || "");
  if (canonicalKey && state.rooms?.[canonicalKey]) addRoom(state.rooms[canonicalKey]);
  for (const key of roomState.settings?.linkedGameRoomKeys || []) {
    if (state.rooms?.[key]) addRoom(state.rooms[key]);
  }
  for (const candidate of Object.values(state.rooms || {})) {
    if (roomKey(candidate.settings?.canonicalRoomKey || "") === currentKey) addRoom(candidate);
  }
  return rooms;
}

function syncRoomGroupAdmins(state, roomState = {}) {
  const rooms = linkedRoomStatesForAdminSync(state, roomState);
  const admins = uniqueNames(rooms.flatMap((room) => room.admins || []));
  if (!admins.length) return [];
  for (const room of rooms) room.admins = [...admins];
  return admins;
}

function effectiveRoomAdminsForApplication(state, account = {}, application = {}, roomState = null, roomView = null) {
  const admins = [
    ...(roomView?.admins || []),
    application.adminName || ""
  ];
  if (roomState) {
    admins.push(...linkedRoomStatesForAdminSync(state, roomState).flatMap((room) => room.admins || []));
  }
  const purpose = normalizeApplicationRoomPurpose(application.roomPurpose);
  if (purpose === "game_room" && application.linkedApplicationId) {
    const baseApplication = state.applications?.[application.linkedApplicationId];
    const baseRoomState = baseApplication ? state.rooms?.[roomKey(baseApplication.roomName)] : null;
    admins.push(baseApplication?.adminName || "", ...(baseRoomState?.admins || []));
  } else {
    for (const gameApplication of gameRoomApplicationsForBase(state, account, application)) {
      const gameRoomState = state.rooms?.[roomKey(gameApplication.roomName)];
      admins.push(gameApplication.adminName || "", ...(gameRoomState?.admins || []));
    }
  }
  return uniqueNames(admins);
}

function applicationRoomPayload(state, account = {}, application = {}) {
  const roomState = state.rooms?.[roomKey(application.roomName)];
  const roomView = roomState ? roomAdminView(roomState, state, { application, account }) : null;
  const roomPurpose = application.roomPurpose || "general_room";
  const isGameRoom = normalizeApplicationRoomPurpose(roomPurpose) === "game_room";
  const linkedGameRooms = isGameRoom ? [] : gameRoomApplicationsForBase(state, account, application);
  const payloadRoomRole = effectiveRoomRoleForApplication(state, roomState, application, account, linkedGameRooms);
  const licenseKey = application.licenseKey || roomView?.licenseKey || "";
  const subscription = roomView?.subscription || application.plan || {};
  const customCommands = roomView?.customCommands || [];
  const bridgeConnectCode = bridgeConnectCodeForApplication(account, application);
  const subscriptionStatus = subscription.status || (application.status === "approved" ? "active" : "pending");
  const subscriptionDays = Number.isFinite(Number(subscription.remainingDays))
    ? Number(subscription.remainingDays)
    : remainingDays(subscription.expiresAt);
  const subscriptionLabel = subscription.statusLabel || subscriptionStatusLabel(subscriptionStatus, subscriptionDays);
  const subscriptionNotice = subscription.notice || subscriptionNoticeText(subscriptionStatus, subscriptionDays);
  const licenseStatus = licenseKey ? roomView?.licenseStatus || "active" : "missing";
  const bridgeStatus = bridgeConnectCode && licenseKey && (application.roomId || roomView?.roomIds?.[0])
    ? "ready"
    : "needs_setup";
  const roomAdmins = effectiveRoomAdminsForApplication(state, account, application, roomState, roomView);
  return {
    applicationId: application.id || "",
    roomName: application.roomName || "",
    roomId: application.roomId || roomView?.roomIds?.[0] || "",
    roomLink: application.roomLink || roomView?.roomLinks?.[0] || "",
    adminName: application.adminName || "",
    roomPurpose,
    linkedApplicationId: application.linkedApplicationId || "",
    linkedGameRooms: linkedGameRooms.map((item) => gameRoomSummaryPayload(state, account, item)),
    canApplyGameRoom: !isGameRoom && application.status === "approved" && state.payments?.[application.paymentId]?.status === "paid" && linkedGameRooms.length === 0,
    gameRoomApplyUrl: !isGameRoom ? `/apply?roomPurpose=game_room&linkedApplicationId=${encodeURIComponent(application.id || "")}` : "",
    roomRole: payloadRoomRole,
    canonicalRoomName: roomView?.canonicalRoomName || "",
    joinPhrase: roomView?.joinPhrase || DEFAULT_JOIN_PHRASE,
    licenseKey,
    licenseStatus,
    subscriptionStatus,
    subscriptionStatusLabel: subscriptionLabel,
    subscriptionNotice,
    bridgeStatus,
    roomAdmins,
    features: roomView?.features || DEFAULT_ROOM_FEATURES,
    customCommands,
    commandCount: customCommands.length,
    commandPacks: commandPackStatePayload(roomView?.commandPacks || {}),
    aliasSummary: roomView?.aliasSummary || (roomState ? aliasSummaryPayload(roomState, { limit: 20 }) : { totalProfiles: 0, aliasCount: 0, mergedAliasCount: 0, items: [] }),
    gameUsageSummary: roomState ? gameUsageSummaryPayload(roomState) : gameUsageSummaryPayload({}),
    gameSettings: roomView?.gameSettings || DEFAULT_GAME_SETTINGS,
    roomStatusSnapshot: roomView?.roomStatusSnapshot || (roomState ? roomStatusSnapshot(state, roomState, { application, account }) : null),
    subscription,
    monthlyPriceKrw: roomView?.subscription?.monthlyPriceKrw || application.plan?.monthlyPriceKrw || MONTHLY_PRICE_KRW,
    serverUrl: "https://pixgom.com/chat-event",
    bridgeConnectCode
  };
}

function effectiveRoomRoleForApplication(state = {}, roomState = null, application = {}, account = {}, linkedGameRooms = null) {
  const purpose = normalizeApplicationRoomPurpose(application.roomPurpose);
  if (purpose === "game_room") return "game";
  const savedRole = normalizeRoomRole(roomState?.settings?.roomRole || "");
  const gameRooms = Array.isArray(linkedGameRooms)
    ? linkedGameRooms
    : gameRoomApplicationsForBase(state, account || state.accounts?.[application.accountId] || {}, application);
  if (purpose !== "game_room" && gameRooms.length > 0) return "general";
  return savedRole;
}

function bridgeConnectApplicationsForApplication(state, account = {}, application = {}) {
  const applications = [];
  const addApplication = (item) => {
    if (!item?.id || !applicationApprovedAndPaid(state, item)) return;
    if (item.accountId !== account.id) return;
    if (applications.some((existing) => existing.id === item.id)) return;
    applications.push(item);
  };
  const isGameRoom = normalizeApplicationRoomPurpose(application.roomPurpose) === "game_room";
  if (isGameRoom) {
    addApplication(state.applications?.[application.linkedApplicationId]);
    addApplication(application);
    return applications;
  }
  addApplication(application);
  for (const gameApplication of gameRoomApplicationsForBase(state, account, application)) {
    addApplication(gameApplication);
  }
  return applications;
}

function bridgeConnectRoomsPayload(state, account = {}, application = {}) {
  return bridgeConnectApplicationsForApplication(state, account, application)
    .map((item) => applicationRoomPayload(state, account, item));
}

function bridgeConnectDiagnosticsPayload(state, account = {}, application = {}, rooms = null) {
  const responseRooms = Array.isArray(rooms) ? rooms : bridgeConnectRoomsPayload(state, account, application);
  const requestedRoomRole = normalizeApplicationRoomPurpose(application.roomPurpose) === "game_room" ? "game" : "general";
  const baseApplication = requestedRoomRole === "game"
    ? state.applications?.[application.linkedApplicationId]
    : application;
  const linkedGameApplications = baseApplication?.id
    ? gameRoomApplicationsForBase(state, account, baseApplication).filter(applicationApprovedAndPaid.bind(null, state))
    : [];
  const linkedIds = new Set([
    baseApplication?.id,
    ...linkedGameApplications.map((item) => item.id)
  ].filter(Boolean));
  const unlinkedApprovedRoomCandidates = Object.values(state.applications || {})
    .filter((item) => item.accountId === account.id)
    .filter((item) => !linkedIds.has(item.id))
    .filter((item) => normalizeApplicationRoomPurpose(item.roomPurpose) !== "game_room")
    .filter((item) => applicationApprovedAndPaid(state, item))
    .map((item) => publicLinkedApplicationSummary(state, item));
  const issues = [];
  if (requestedRoomRole === "game" && !baseApplication) issues.push("main_room_not_found");
  if (requestedRoomRole === "general" && linkedGameApplications.length === 0 && unlinkedApprovedRoomCandidates.length > 0) {
    issues.push("approved_room_candidates_not_linked");
  }
  if (linkedGameApplications.length > 0 && responseRooms.length < linkedGameApplications.length + 1) {
    issues.push("bridge_rooms_missing");
  }
  if (requestedRoomRole === "game" && responseRooms.length < 2) issues.push("game_room_not_linked");
  return {
    requestedApplicationId: application.id || "",
    requestedRoomName: application.roomName || "",
    requestedRoomRole,
    baseApplicationId: baseApplication?.id || "",
    baseRoomName: baseApplication?.roomName || "",
    responseRoomCount: responseRooms.length || 1,
    expectedRoomCount: Math.max(1, 1 + linkedGameApplications.length),
    linkedGameRoomCount: linkedGameApplications.length,
    linkedGameRooms: linkedGameApplications.map((item) => publicLinkedApplicationSummary(state, item)),
    unlinkedApprovedRoomCandidates,
    issues,
    ok: issues.length === 0
  };
}

function boolFromPayload(value, fallback = true) {
  if (value === true || value === false) return value;
  const normalized = normalizeText(value).toLowerCase();
  if (["true", "1", "yes", "y", "on", "켜기", "차단"].includes(normalized)) return true;
  if (["false", "0", "no", "n", "off", "끄기", "허용"].includes(normalized)) return false;
  return fallback;
}

function normalizedModeSplit(mode = {}, fallback = {}) {
  const blockGamesFallback = fallback.blockGamesInGeneralRoom ?? fallback.generalRoomGameBlocked ?? true;
  const blockOpsFallback = fallback.blockOpsInGameRoom ?? fallback.gameRoomOpsBlocked ?? true;
  const shareFallback = fallback.sharePointsAndInventory ?? fallback.sharedData ?? true;
  return {
    blockGamesInGeneralRoom: boolFromPayload(mode.blockGamesInGeneralRoom ?? mode.generalRoomGameBlocked, blockGamesFallback),
    blockOpsInGameRoom: boolFromPayload(mode.blockOpsInGameRoom ?? mode.gameRoomOpsBlocked, blockOpsFallback),
    sharePointsAndInventory: boolFromPayload(mode.sharePointsAndInventory ?? mode.sharedData, shareFallback),
    updatedAt: normalizeText(mode.updatedAt || fallback.updatedAt),
    updatedBy: normalizeText(mode.updatedBy || fallback.updatedBy)
  };
}

function modeSplitFromPayload(payload = {}, current = {}, updatedBy = "") {
  const source = payload.modeSplit && typeof payload.modeSplit === "object" ? payload.modeSplit : payload;
  const fallback = normalizedModeSplit(current);
  return {
    ...normalizedModeSplit(source, fallback),
    updatedAt: nowIso(),
    updatedBy: updatedBy || normalizeText(source.updatedBy || payload.updatedBy || payload.by)
  };
}

function roomModeSettingsPayload(state, baseApplication = {}, linkedGameApplications = []) {
  const baseRoomState = state.rooms?.[roomKey(baseApplication.roomName)];
  const gameStates = linkedGameApplications
    .map((application) => state.rooms?.[roomKey(application.roomName)])
    .filter(Boolean);
  const fallbackBlockGames = normalizeRoomRole(baseRoomState?.settings?.roomRole) === "general";
  const fallbackBlockOps = gameStates.length
    ? gameStates.every((roomState) => normalizeRoomRole(roomState.settings?.roomRole) === "game")
    : true;
  const mode = normalizedModeSplit(baseRoomState?.settings?.modeSplit, {
    blockGamesInGeneralRoom: fallbackBlockGames,
    blockOpsInGameRoom: fallbackBlockOps,
    sharePointsAndInventory: true
  });
  return {
    enabled: linkedGameApplications.length > 0,
    blockGamesInGeneralRoom: mode.blockGamesInGeneralRoom,
    blockOpsInGameRoom: mode.blockOpsInGameRoom,
    sharePointsAndInventory: mode.sharePointsAndInventory,
    generalRoomGameBlocked: mode.blockGamesInGeneralRoom,
    gameRoomOpsBlocked: mode.blockOpsInGameRoom,
    sharedData: mode.sharePointsAndInventory,
    updatedAt: mode.updatedAt || "",
    updatedBy: mode.updatedBy || "",
    lastSavedAt: mode.updatedAt || roomLastSettingsSavedAt(baseRoomState || {}),
    description: "일반방과 게임방은 같은 포인트/가방/게임 데이터를 공유합니다."
  };
}

function buyerRoomGroupsPayload(state, account = {}, approvedApplications = null) {
  const applications = approvedApplications || approvedBuyerApplications(state, account);
  const generalApplications = applications.filter((application) => normalizeApplicationRoomPurpose(application.roomPurpose) !== "game_room");
  const baseIds = new Set(generalApplications.map((application) => application.id));
  const groups = generalApplications.map((application) => {
    const linkedGameApplications = gameRoomApplicationsForBase(state, account, application)
      .filter((item) => item.status === "approved" && state.payments?.[item.paymentId]?.status === "paid");
    return {
      baseRoom: applicationRoomPayload(state, account, application),
      gameRooms: linkedGameApplications.map((item) => applicationRoomPayload(state, account, item)),
      roomModeSettings: roomModeSettingsPayload(state, application, linkedGameApplications)
    };
  });
  for (const gameApplication of applications.filter((application) => normalizeApplicationRoomPurpose(application.roomPurpose) === "game_room")) {
    if (baseIds.has(gameApplication.linkedApplicationId)) continue;
    groups.push({
      baseRoom: null,
      gameRooms: [applicationRoomPayload(state, account, gameApplication)],
      roomModeSettings: roomModeSettingsPayload(state, {}, [gameApplication])
    });
  }
  return groups;
}

function buyerGuidePayload(state, account = {}) {
  const applications = approvedBuyerApplications(state, account);
  if (!applications.length) return { ok: false, status: 403, error: "buyer_approval_required" };
  const console = buyerConsolePayload(state, account);
  const rooms = console.rooms || applications.map((application) => applicationRoomPayload(state, account, application));
  return {
    ok: true,
    version: APP_VERSION,
    account: publicAccountView(account),
    testAppUrl: PLAY_INTERNAL_TEST_URL,
    rooms,
    roomGroups: console.roomGroups || [],
    console,
    guideUrls: buyerGuideUrlsPayload(),
    sections: [
      {
        title: "처음 시작",
        items: [
          `픽셀곰 브릿지 앱을 봇폰에 설치합니다. 내부 테스트 링크: ${PLAY_INTERNAL_TEST_URL}`,
          "앱 첫 화면에서 알림 접근 권한을 허용합니다.",
          "구매자 콘솔의 설치 안내에서 승인된 방 연결코드를 확인합니다.",
          "앱에서 연결코드 자동 설정을 실행하면 방 이름, roomId, 오픈채팅 링크, 라이선스 키가 자동 입력됩니다.",
          "앱에서 서버 테스트 전송 후 카카오방에서 /브릿지, /상태를 확인합니다."
        ]
      },
      {
        title: "PC에서 접속",
        items: [
          "https://pixgom.com/console 으로 로그인해 구매 상태, 설치 상태, 문의 상태를 확인합니다.",
          "관리자는 https://pixgom.com/admin 에서 방 등록, 구독, 커스텀 명령어를 관리합니다.",
          "운영자 어드민은 등록된 운영자 이메일 로그인으로만 접근합니다."
        ]
      },
      {
        title: "모바일에서 접속",
        items: [
          "휴대폰 브라우저에서 https://pixgom.com/console?view=setup 을 열고 로그인합니다.",
          "연결코드는 승인된 방마다 별도로 발급됩니다.",
          "Android Chrome은 메뉴에서 '홈 화면에 추가'를 선택해 바로가기를 만들 수 있습니다.",
          "iPhone Safari는 공유 버튼에서 '홈 화면에 추가'를 선택합니다."
        ]
      },
      {
        title: "휴대폰 앱 권한",
        items: [
          "필수 권한은 알림 접근 권한입니다.",
          "픽셀곰 브릿지는 기본 운영에서 화면 감지/접근성 권한을 사용하지 않습니다.",
          "카카오톡 알림이 꺼져 있거나 방 알림이 오지 않으면 봇도 반응하지 않습니다.",
          "배터리 절전이 강하면 알림 수신이 지연될 수 있어 절전 예외를 권장합니다."
        ]
      },
      {
        title: "기본 테스트 순서",
        items: [
          "카카오방에서 /브릿지를 보냅니다.",
          "카카오방에서 /상태를 보냅니다.",
          "/명령어목록 으로 커스텀 명령어를 확인합니다.",
          "/출석, /포인트, /포인트순위 순서로 기본 기능을 확인합니다.",
          "게임 기능을 켠 방은 /게임, /주사위를 확인합니다."
        ]
      },
      {
        title: "문제 해결",
        items: [
          "응답이 없으면 앱의 알림 권한, 방 이름, roomId, 라이선스 키를 먼저 확인합니다.",
          "라이선스 오류가 나오면 콘솔의 라이선스 키와 앱 입력값이 같은지 확인합니다.",
          "개인톡 또는 등록되지 않은 방 메시지는 서버가 무시합니다.",
          "입장/퇴장 문구는 카카오 알림으로 오지 않으면 기본 알림 방식만으로는 감지되지 않습니다."
        ]
      }
    ]
  };
}

function roomKey(room) {
  return keyFor(room || "default");
}

function roomTitle(room) {
  return normalizeText(room) || "기본방";
}

function normalizeRoomRole(value = "") {
  const text = compactSpaces(value).toLowerCase().replace(/[\s-]+/g, "_");
  if (["general", "general_room", "일반", "일반방"].includes(text)) return "general";
  if (["game", "game_room", "게임", "게임방"].includes(text)) return "game";
  return "standard";
}

function normalizeReportId(value) {
  return normalizeText(value).toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 20);
}

function reportNumberFromId(value) {
  const match = normalizeReportId(value).match(/(\d+)$/);
  return match ? Math.max(0, Math.trunc(Number(match[1]) || 0)) : 0;
}

function normalizeReports(value = []) {
  const list = Array.isArray(value) ? value : [];
  return list
    .map((item) => {
      const report = item && typeof item === "object" ? item : {};
      const id = normalizeReportId(report.id);
      if (!id) return null;
      const status = ["open", "resolved"].includes(report.status) ? report.status : "open";
      return {
        id,
        status,
        reporter: stripKakaoSuffix(report.reporter || report.from || ""),
        reporterKey: normalizeText(report.reporterKey),
        target: stripKakaoSuffix(report.target || ""),
        reason: previewText(report.reason || report.content || "", 300),
        createdAt: normalizeText(report.createdAt || report.at) || nowIso(),
        resolvedAt: normalizeText(report.resolvedAt),
        resolvedBy: stripKakaoSuffix(report.resolvedBy || ""),
        resolution: previewText(report.resolution || report.result || "", 180)
      };
    })
    .filter(Boolean)
    .slice(-200);
}

function nextReportNumber(roomState) {
  const current = Math.max(1, Math.trunc(Number(roomState.reportNextId || 1)) || 1);
  const maxExisting = Math.max(0, ...(roomState.reports || []).map((report) => reportNumberFromId(report.id)));
  return Math.max(current, maxExisting + 1);
}

function ensureRoom(state, room) {
  const key = roomKey(room);
  state.rooms[key] ||= {
    name: roomTitle(room),
    profiles: {},
    aliases: {},
    people: {},
    admins: [],
    inbox: {},
    reports: [],
    reportNextId: 1,
    commandRouting: {},
    commandInstallDrafts: {},
    unreadNoticeStates: {},
    events: [],
    rawEvents: [],
    analyticsLogs: [],
    recentEventIds: [],
    peopleByIdentity: {},
    ambiguousIdentities: [],
    shop: {},
    settings: { commandPacks: normalizeCommandPackState() },
    pendingEntries: []
  };
  const roomState = state.rooms[key];
  roomState.name ||= roomTitle(room);
  roomState.profiles ||= {};
  roomState.aliases ||= {};
  roomState.people ||= {};
  roomState.admins ||= [];
  roomState.inbox ||= {};
  roomState.reports = normalizeReports(roomState.reports || []);
  roomState.reportNextId = nextReportNumber(roomState);
  roomState.commandRouting ||= {};
  roomState.commandInstallDrafts ||= {};
  roomState.commandRouting.unknownNotices ||= { byUser: {}, byRoom: {} };
  roomState.commandRouting.unknownNotices.byUser ||= {};
  roomState.commandRouting.unknownNotices.byRoom ||= {};
  roomState.unreadNoticeStates ||= {};
  roomState.events ||= [];
  roomState.rawEvents ||= [];
  roomState.analyticsLogs ||= [];
  roomState.recentEventIds = Array.isArray(roomState.recentEventIds) ? roomState.recentEventIds.slice(-300) : [];
  if (roomState.analyticsLogs.length > ROOM_ANALYTICS_LOG_LIMIT) {
    roomState.analyticsLogs = roomState.analyticsLogs.slice(-ROOM_ANALYTICS_LOG_LIMIT);
  }
  roomState.peopleByIdentity ||= {};
  roomState.ambiguousIdentities ||= [];
  roomState.shop = normalizeShopState(roomState.shop || {});
  roomState.settings ||= {};
  roomState.settings.commandPacks = normalizeCommandPackState(roomState.settings.commandPacks || {});
  roomState.settings.enabled = roomState.settings.enabled !== false;
  roomState.settings.registered ||= false;
  roomState.settings.roomIds ||= [];
  roomState.settings.roomLinks ||= [];
  roomState.settings.roomRole = normalizeRoomRole(roomState.settings.roomRole);
  roomState.settings.canonicalRoomKey = roomKey(roomState.settings.canonicalRoomKey || "") === roomKey("") ? "" : roomKey(roomState.settings.canonicalRoomKey || "");
  roomState.settings.linkedGameRoomKeys = [...new Set((Array.isArray(roomState.settings.linkedGameRoomKeys) ? roomState.settings.linkedGameRoomKeys : [])
    .map((key) => roomKey(key))
    .filter((key) => key && key !== roomKey("")))];
  roomState.settings.joinPhrase ||= DEFAULT_JOIN_PHRASE;
  roomState.settings.features = normalizeFeatureSettings(roomState.settings.features || {});
  roomState.settings.customCommands = normalizeCustomCommands(roomState.settings.customCommands || {});
  roomState.settings.gameSettings = normalizeGameSettings(roomState.settings.gameSettings || {});
  roomState.settings.subscription ||= {};
  roomState.settings.subscription.monthlyPriceKrw = Number(roomState.settings.subscription.monthlyPriceKrw || MONTHLY_PRICE_KRW);
  roomState.pendingEntries ||= [];
  for (const person of Object.values(roomState.people)) normalizePersonState(person);
  return roomState;
}

function canonicalDataRoomState(state, roomState) {
  const canonicalKey = normalizeText(roomState?.settings?.canonicalRoomKey || "");
  if (!canonicalKey || !state.rooms?.[canonicalKey]) return roomState;
  return ensureRoom(state, state.rooms[canonicalKey].name || canonicalKey);
}

function normalizeInventory(value = {}) {
  const entries = Array.isArray(value)
    ? value.map((item) => [item?.productId ?? item?.id, item?.quantity ?? item?.qty ?? 1])
    : Object.entries(value || {});
  const inventory = {};
  for (const [rawId, rawQuantity] of entries) {
    const id = String(Math.trunc(Number(rawId || 0)));
    const quantity = Math.max(0, Math.trunc(Number(rawQuantity || 0)));
    if (!id || id === "0" || !quantity) continue;
    inventory[id] = (inventory[id] || 0) + quantity;
  }
  return inventory;
}

function storageCacheKey(pool) {
  return pool ? `postgres:${STATE_ID}` : `local:${DB_PATH}`;
}

function localStateFingerprint() {
  if (!existsSync(DB_PATH)) return "missing";
  const stat = statSync(DB_PATH);
  return `${stat.mtimeMs}:${stat.size}`;
}

function markStateCacheHit(state, cacheHit) {
  if (!state || typeof state !== "object") return state;
  Object.defineProperty(state, "__cacheHit", {
    value: Boolean(cacheHit),
    writable: true,
    configurable: true,
    enumerable: false
  });
  return state;
}

function cachedStateFor(pool) {
  if (!CHAT_STATE_CACHE_TTL_MS) return null;
  if (!pool && process.env.ENABLE_LOCAL_STATE_CACHE !== "true") return null;
  const key = storageCacheKey(pool);
  if (!stateCache || stateCacheKey !== key) return null;
  if (!pool && stateCacheFingerprint !== localStateFingerprint()) return null;
  if (Date.now() - stateCacheLoadedAt > CHAT_STATE_CACHE_TTL_MS) return null;
  return markStateCacheHit(stateCache, true);
}

function rememberStateCache(pool, state) {
  if (!CHAT_STATE_CACHE_TTL_MS || !state) return state;
  if (!pool && process.env.ENABLE_LOCAL_STATE_CACHE !== "true") return state;
  stateCache = markStateCacheHit(state, false);
  stateCacheKey = storageCacheKey(pool);
  stateCacheLoadedAt = Date.now();
  stateCacheFingerprint = pool ? stateCacheKey : localStateFingerprint();
  return stateCache;
}

function normalizeInventoryLocks(value = []) {
  const source = Array.isArray(value)
    ? value
    : Object.entries(value || {})
      .filter(([, enabled]) => enabled !== false)
      .map(([id]) => id);
  return [...new Set(source
    .map((id) => String(Math.max(0, Math.trunc(Number(id || 0)))))
    .filter((id) => id && id !== "0"))]
    .slice(0, 300);
}

function normalizeGameCooldowns(value = {}) {
  const source = value && typeof value === "object" ? value : {};
  const cooldowns = {};
  for (const key of Object.keys(GAME_COOLDOWNS_MS)) {
    const text = normalizeText(source[key]);
    if (text && !Number.isNaN(Date.parse(text))) cooldowns[key] = text;
  }
  return cooldowns;
}

function normalizeEquipment(value = {}) {
  const weapon = Math.max(0, Math.trunc(Number(value?.weapon || 0)));
  const armor = Math.max(0, Math.trunc(Number(value?.armor || 0)));
  const accessory = Math.max(0, Math.trunc(Number(value?.accessory || 0)));
  return {
    weapon: weapon ? String(weapon) : "",
    armor: armor ? String(armor) : "",
    accessory: accessory ? String(accessory) : ""
  };
}

function normalizeEquipmentEnhancements(value = {}) {
  const result = {};
  for (const [rawId, rawLevel] of Object.entries(value || {})) {
    const id = String(Math.max(0, Math.trunc(Number(rawId || 0))));
    const product = systemProductById(id);
    if (!id || id === "0" || !product || !rpgEquipmentSlot(product)) continue;
    const level = Math.min(RPG_MAX_ENHANCEMENT_LEVEL, Math.max(0, Math.trunc(Number(rawLevel || 0))));
    if (level > 0) result[id] = level;
  }
  return result;
}

function normalizePendingRpgReward(value = null) {
  if (!value || typeof value !== "object") return null;
  const expiresAt = Date.parse(value.expiresAt || "");
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;
  const choices = Array.isArray(value.choices) ? value.choices.filter((choice) => ["재료", "포인트", "강화재료"].includes(choice)) : [];
  if (!choices.length) return null;
  return {
    id: normalizeText(value.id) || randomBytes(4).toString("hex"),
    source: normalizeText(value.source || "dungeon"),
    dungeon: normalizeText(value.dungeon || ""),
    choices,
    createdAt: normalizeText(value.createdAt || nowIso()),
    expiresAt: new Date(expiresAt).toISOString()
  };
}

function pixelMonsterSpeciesById(speciesId = "") {
  const id = normalizeText(speciesId);
  return PIXEL_MONSTER_SPECIES.find((species) => species.speciesId === id) || null;
}

function normalizeOwnedMonsters(value = []) {
  return (Array.isArray(value) ? value : [])
    .map((monster) => {
      const species = pixelMonsterSpeciesById(monster?.speciesId);
      if (!species) return null;
      const level = Math.max(1, Math.trunc(Number(monster.level || 1)));
      const evolutionStage = Math.min(3, Math.max(0, Math.trunc(Number(monster.evolutionStage || 0))));
      return {
        id: normalizeText(monster.id) || randomBytes(4).toString("hex"),
        speciesId: species.speciesId,
        name: compactSpaces(monster.name || species.name).slice(0, 24) || species.name,
        element: species.element,
        rarity: species.rarity,
        level,
        exp: Math.max(0, Math.trunc(Number(monster.exp || 0))),
        teamSlot: Math.min(3, Math.max(0, Math.trunc(Number(monster.teamSlot || 0)))),
        evolutionStage,
        bond: Math.min(100, Math.max(0, Math.trunc(Number(monster.bond || 0)))),
        wins: Math.max(0, Math.trunc(Number(monster.wins || 0))),
        shards: Math.max(0, Math.trunc(Number(monster.shards || 0))),
        lastUsedAt: normalizeText(monster.lastUsedAt || ""),
        caughtAt: normalizeText(monster.caughtAt) || nowIso()
      };
    })
    .filter(Boolean)
    .slice(0, 200);
}

function normalizePendingMonster(value = null) {
  const species = pixelMonsterSpeciesById(value?.speciesId);
  if (!species) return null;
  return {
    speciesId: species.speciesId,
    region: normalizeText(value.region || ""),
    discoveredAt: normalizeText(value.discoveredAt) || nowIso()
  };
}

function normalizePetState(value = null) {
  if (!value || typeof value !== "object") return null;
  return {
    name: compactSpaces(value.name || "픽셀펫").slice(0, 24) || "픽셀펫",
    species: PET_SPECIES.includes(value.species) ? value.species : PET_SPECIES[0],
    hunger: Math.min(100, Math.max(0, Math.trunc(Number(value.hunger ?? 20)))),
    happiness: Math.min(100, Math.max(0, Math.trunc(Number(value.happiness ?? 70)))),
    energy: Math.min(100, Math.max(0, Math.trunc(Number(value.energy ?? 70)))),
    cleanliness: Math.min(100, Math.max(0, Math.trunc(Number(value.cleanliness ?? 70)))),
    health: Math.min(100, Math.max(0, Math.trunc(Number(value.health ?? 90)))),
    level: Math.max(1, Math.trunc(Number(value.level || 1))),
    exp: Math.max(0, Math.trunc(Number(value.exp || 0))),
    bornAt: normalizeText(value.bornAt) || nowIso(),
    updatedAt: normalizeText(value.updatedAt) || nowIso()
  };
}

function normalizeShopState(value = {}) {
  const shop = value && typeof value === "object" ? value : {};
  const products = Array.isArray(shop.products) ? shop.products : [];
  let maxId = 0;
  shop.products = products
    .map((product) => {
      const id = Math.max(0, Math.trunc(Number(product?.id || 0)));
      if (!id) return null;
      maxId = Math.max(maxId, id);
      return {
        id,
        name: compactSpaces(product.name).slice(0, SHOP_PRODUCT_NAME_LIMIT) || `상품${id}`,
        price: Math.min(SHOP_MAX_PRICE, Math.max(1, Math.trunc(Number(product.price || 0) || 1))),
        description: compactSpaces(product.description).slice(0, SHOP_PRODUCT_DESCRIPTION_LIMIT),
        active: product.active !== false,
        createdAt: normalizeText(product.createdAt) || nowIso(),
        createdBy: normalizeText(product.createdBy),
        updatedAt: normalizeText(product.updatedAt) || normalizeText(product.createdAt) || nowIso(),
        updatedBy: normalizeText(product.updatedBy),
        deletedAt: normalizeText(product.deletedAt),
        deletedBy: normalizeText(product.deletedBy)
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.id - right.id);
  shop.nextProductId = Math.max(maxId + 1, Math.trunc(Number(shop.nextProductId || 1)) || 1);
  shop.transactions = (Array.isArray(shop.transactions) ? shop.transactions : [])
    .map((transaction) => ({
      id: normalizeText(transaction.id) || randomBytes(4).toString("hex"),
      type: normalizeText(transaction.type) || "unknown",
      productId: Math.max(0, Math.trunc(Number(transaction.productId || 0))),
      productName: compactSpaces(transaction.productName).slice(0, SHOP_PRODUCT_NAME_LIMIT),
      quantity: Math.max(1, Math.trunc(Number(transaction.quantity || 1))),
      unitPrice: Math.max(0, Math.trunc(Number(transaction.unitPrice || 0))),
      totalPrice: Math.max(0, Math.trunc(Number(transaction.totalPrice || 0))),
      from: stripKakaoSuffix(transaction.from || ""),
      to: stripKakaoSuffix(transaction.to || ""),
      by: stripKakaoSuffix(transaction.by || ""),
      at: normalizeText(transaction.at) || nowIso()
    }))
    .slice(-SHOP_TRANSACTION_LIMIT);
  return shop;
}

function formatKrw(value) {
  const amount = Math.max(0, Number(value || 0));
  return `${amount.toLocaleString("ko-KR")}원`;
}

function normalizeLicenseKey(value) {
  return compactSpaces(value).toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 80);
}

function maskedLicenseKey(value) {
  const key = normalizeLicenseKey(value);
  if (!key) return "미발급";
  if (key.length <= 8) return key;
  return `${key.slice(0, 7)}…${key.slice(-4)}`;
}

function generateLicenseKey(roomState) {
  const roomId = openChatRoomId(roomState?.settings?.roomIds?.[0] || "");
  const roomPart = (roomId || roomKey(roomState?.name || "room")).replace(/[^A-Za-z0-9]/g, "").slice(0, 8).toUpperCase() || "ROOM";
  return `PXG-${roomPart}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

function booleanSetting(value, fallback = true) {
  if (value === true || value === false) return value;
  if (typeof value === "string") {
    const text = value.trim().toLowerCase();
    if (["true", "1", "on", "yes", "enabled", "켜짐"].includes(text)) return true;
    if (["false", "0", "off", "no", "disabled", "꺼짐"].includes(text)) return false;
  }
  return fallback;
}

function normalizeFeatureSettings(value = {}) {
  const features = {};
  for (const [key, defaultValue] of Object.entries(DEFAULT_ROOM_FEATURES)) {
    features[key] = booleanSetting(value[key], defaultValue);
  }
  return features;
}

function boundedGameReward(value, fallback) {
  if (value === undefined || value === null || normalizeText(value) === "") return fallback;
  const number = Number(String(value ?? "").replace(/,/g, ""));
  if (!Number.isFinite(number)) return fallback;
  return Math.min(GAME_REWARD_MAX, Math.max(0, Math.trunc(number)));
}

function parseGameSeasonStart(value) {
  return parseKstCalendarDate(value, { endOfDay: false });
}

function parseGameSeasonEnd(value) {
  return parseKstCalendarDate(value, { endOfDay: true });
}

function normalizeGameSettings(value = {}) {
  const source = value && typeof value === "object" ? value : {};
  const seasonName = compactSpaces(source.seasonName || source.season || source.name || DEFAULT_GAME_SETTINGS.seasonName)
    .slice(0, GAME_SEASON_NAME_LIMIT)
    || DEFAULT_GAME_SETTINGS.seasonName;
  const seasonStartsAt = parseGameSeasonStart(source.seasonStartsAt || source.seasonStartAt || source.startsAt || source.startAt);
  const seasonEndsAt = parseGameSeasonEnd(source.seasonEndsAt || source.seasonEndAt || source.endsAt || source.endAt);
  return {
    seasonName,
    seasonStartsAt,
    seasonEndsAt,
    diceReward: boundedGameReward(source.diceReward ?? source.dice ?? source.diceBaseReward, DEFAULT_GAME_SETTINGS.diceReward),
    fishingReward: boundedGameReward(source.fishingReward ?? source.fishing ?? source.fishingBaseReward, DEFAULT_GAME_SETTINGS.fishingReward),
    exploreReward: boundedGameReward(source.exploreReward ?? source.explore ?? source.exploreBaseReward, DEFAULT_GAME_SETTINGS.exploreReward)
  };
}

function gameSettings(roomState) {
  roomState.settings ||= {};
  roomState.settings.gameSettings = normalizeGameSettings(roomState.settings.gameSettings || {});
  return roomState.settings.gameSettings;
}

function applyGameSettingsFromPayload(roomState, payload = {}) {
  const directSettings = payload.gameSettings;
  if (directSettings && typeof directSettings === "object") {
    roomState.settings.gameSettings = normalizeGameSettings(directSettings);
    return;
  }
  const inlineSettings = {
    seasonName: payload.gameSeasonName || payload.seasonName,
    seasonStartsAt: payload.gameSeasonStartsAt || payload.gameSeasonStartAt || payload.seasonStartsAt || payload.seasonStartAt,
    seasonEndsAt: payload.gameSeasonEndsAt || payload.gameSeasonEndAt || payload.seasonEndsAt || payload.seasonEndAt,
    diceReward: payload.gameDiceReward ?? payload.diceReward,
    fishingReward: payload.gameFishingReward ?? payload.fishingReward,
    exploreReward: payload.gameExploreReward ?? payload.exploreReward
  };
  const hasInlineSetting = Object.values(inlineSettings).some((value) => value !== undefined && value !== null && normalizeText(value) !== "");
  if (hasInlineSetting) roomState.settings.gameSettings = normalizeGameSettings(inlineSettings);
}

function normalizeCustomCommandTrigger(value) {
  const firstToken = compactSpaces(value).split(/\s+/)[0] || "";
  const cleaned = firstToken
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/[=]/g, "")
    .slice(0, 32);
  return cleaned;
}

function normalizeCustomCommandResponse(value) {
  return normalizeText(value).slice(0, CUSTOM_COMMAND_RESPONSE_LIMIT);
}

function normalizeCustomCommands(value = []) {
  const source = Array.isArray(value)
    ? value
    : Object.entries(value || {}).map(([trigger, response]) => ({ trigger, response }));
  const byTrigger = new Map();
  for (const item of source) {
    const trigger = normalizeCustomCommandTrigger(item?.trigger || item?.command || item?.name);
    const response = normalizeCustomCommandResponse(item?.response || item?.reply || item?.text);
    if (!trigger || !response || RESERVED_CUSTOM_COMMANDS.has(trigger)) continue;
    byTrigger.set(trigger, {
      trigger,
      response,
      updatedAt: normalizeText(item?.updatedAt) || nowIso(),
      updatedBy: normalizeText(item?.updatedBy),
      sourceTemplateId: normalizeText(item?.sourceTemplateId),
      sourceTemplateKind: normalizeText(item?.sourceTemplateKind),
      sourcePackId: normalizeText(item?.sourcePackId),
      sourcePackSlot: normalizeText(item?.sourcePackSlot),
      sourcePackVersion: Number(item?.sourcePackVersion || 0) || 0,
      proxyCommand: normalizeCustomCommandTrigger(item?.proxyCommand)
    });
  }
  return [...byTrigger.values()].slice(0, CUSTOM_COMMAND_LIMIT);
}

function customCommands(roomState) {
  roomState.settings ||= {};
  roomState.settings.customCommands = normalizeCustomCommands(roomState.settings.customCommands || {});
  return roomState.settings.customCommands;
}

function customCommandSummary(roomState) {
  const commands = customCommands(roomState);
  return commands.length ? `${commands.length}개` : "없음";
}

function fixedCommandCatalogText(isAdminUser = false) {
  const groups = isAdminUser ? FIXED_COMMAND_GROUPS : FIXED_COMMAND_GROUPS.filter((group) => group.title !== "관리자");
  const preview = (commands) => `${commands.slice(0, 8).join(", ")}${commands.length > 8 ? ` 외 ${commands.length - 8}개` : ""}`;
  return [
    "픽셀곰 고정 명령어",
    ...groups.map((group) => `${group.title}: ${preview(group.commands)}`),
    "커스텀 등록: /명령어등록 /공지 내용 · 검색: /찾기 게임"
  ].join("\n").trim();
}

function gameCommandCatalogText() {
  return [
    "픽셀곰 게임 명령어",
    "허브: /게임, /확률게임, /오늘할일",
    "기본: /주사위, /낚시, /탐험, /뽑기",
    "베팅: /홀 금액, /짝 금액, /코인 앞 100, /룰렛 빨강 100",
    "확률팩: /슬롯 100, /복권 100, /하이로우 하이 100, /폭탄피하기 3 100, /보물상자 2 100",
    "RPG: /모험, /던전목록, /자동던전, /강화목록, /자동제작",
    "예약: /픽셀곰게임, /게임연동 · 상세: /게임팩도움말 RPG"
  ].join("\n");
}

function customCommandListText(roomState) {
  const commands = customCommands(roomState);
  if (!commands.length) {
    return [
      "등록된 커스텀 명령어가 없습니다.",
      "관리자는 /명령어등록 /공지 내용 또는 /명령어등록 공지 내용 형식으로 추가할 수 있습니다.",
      "/ 없이도 커스텀 가능하며 /, !, . 같은 접두 문자도 서로 구분합니다."
    ].join("\n");
  }
  return [
    "방별 커스텀 명령어",
    "",
    ...commands.map((item) => `• ${item.trigger} - ${item.response.split(/\n/)[0].slice(0, 34)}${item.response.length > 34 ? "..." : ""}`),
    "",
    `최대 ${CUSTOM_COMMAND_LIMIT}개까지 등록할 수 있습니다.`
  ].join("\n");
}

function parseCustomCommandRegistration(text) {
  const body = normalizeText(text.replace(/^\/(?:명령어등록|명령어수정|커스텀등록|커스텀수정)\s*/i, ""));
  const match = body.match(/^(\S+)\s+([\s\S]+)$/);
  if (!match) return { trigger: "", response: "" };
  return {
    trigger: normalizeCustomCommandTrigger(match[1]),
    response: normalizeCustomCommandResponse(match[2])
  };
}

function customCommandRegisterCommand(roomState, sender, text) {
  const denied = requireAdmin(roomState, sender);
  if (denied) return denied;
  const { trigger, response } = parseCustomCommandRegistration(text);
  if (!trigger || !response) {
    return [
      "형식: /명령어등록 /공지 내용",
      "예: /명령어등록 /규칙 두글자 닉네임 뒤에 성별을 붙여주세요."
    ].join("\n");
  }
  if (RESERVED_CUSTOM_COMMANDS.has(trigger)) {
    return [
      `${trigger} 은 고정 명령어라 커스텀 명령어로 등록할 수 없습니다.`,
      "/고정명령어 로 예약된 명령어를 확인해주세요."
    ].join("\n");
  }
  const commands = customCommands(roomState);
  const existingIndex = commands.findIndex((item) => item.trigger === trigger);
  if (existingIndex < 0 && commands.length >= CUSTOM_COMMAND_LIMIT) {
    return `커스텀 명령어는 최대 ${CUSTOM_COMMAND_LIMIT}개까지 등록할 수 있습니다.`;
  }
  const item = { trigger, response, updatedAt: nowIso(), updatedBy: sender };
  if (existingIndex >= 0) commands[existingIndex] = item;
  else commands.push(item);
  recordRoomEvent(roomState, { type: "custom_command_saved", trigger, by: sender });
  return [
    "커스텀 명령어가 저장되었습니다.",
    `명령어: ${trigger}`,
    "",
    response
  ].join("\n");
}

function customCommandDeleteCommand(roomState, sender, text) {
  const denied = requireAdmin(roomState, sender);
  if (denied) return denied;
  const trigger = normalizeCustomCommandTrigger(text.replace(/^\/(?:명령어삭제|커스텀삭제)\s*/i, ""));
  if (!trigger) return "형식: /명령어삭제 /공지";
  const before = customCommands(roomState).length;
  roomState.settings.customCommands = customCommands(roomState).filter((item) => item.trigger !== trigger);
  if (roomState.settings.customCommands.length === before) return `${trigger} 커스텀 명령어를 찾지 못했습니다.`;
  recordRoomEvent(roomState, { type: "custom_command_deleted", trigger, by: sender });
  return `${trigger} 커스텀 명령어를 삭제했습니다.`;
}

function customCommandReply(roomState, command, sender) {
  const trigger = normalizeCustomCommandTrigger(command);
  if (!trigger) return "";
  const item = customCommandMatch(roomState, command);
  if (!item) return "";
  if (!featureEnabled(roomState, "customCommands")) return featureDisabledText("customCommands");
  if (item.proxyCommand) {
    if (!featureEnabled(roomState, "games")) return featureDisabledText("games");
    if (item.proxyCommand === "/주사위") return diceGameCommand(roomState, sender);
    if (item.proxyCommand === "/낚시") return fishingGameCommand(roomState, sender);
    if (item.proxyCommand === "/탐험") return exploreGameCommand(roomState, sender);
  }
  recordRoomEvent(roomState, { type: "custom_command_used", trigger });
  return item.response;
}

function customCommandMatch(roomState, command) {
  const trigger = normalizeCustomCommandTrigger(command);
  if (!trigger) return null;
  return customCommands(roomState).find((commandItem) => commandItem.trigger === trigger) || null;
}

function roomFeatures(roomState) {
  roomState.settings ||= {};
  roomState.settings.features = normalizeFeatureSettings(roomState.settings.features || {});
  return roomState.settings.features;
}

function featureEnabled(roomState, key) {
  return roomFeatures(roomState)[key] !== false;
}

function featureLabel(key) {
  return FEATURE_LABELS[key] || key;
}

function featureKeyFromText(value) {
  const text = compactSpaces(value).toLowerCase();
  const aliases = {
    attendance: ["attendance", "attend", "출석", "출첵", "출석체크"],
    points: ["point", "points", "포인트", "좋아요", "응원", "이체"],
    rankings: ["ranking", "rankings", "rank", "랭킹", "순위"],
    history: ["history", "histories", "히스토리", "닉이력", "입퇴장", "최근이벤트"],
    profiles: ["profile", "profiles", "프로필"],
    localJs: ["js", "javascript", "자동응답", "js자동응답", "localjs"],
    games: ["game", "games", "게임", "미니게임", "주사위", "낚시", "탐험", "뽑기", "확률뽑기", "홀짝", "홀", "짝"],
    shop: ["shop", "store", "inventory", "item", "상점", "가방", "아이템", "구매"],
    customCommands: ["custom", "customcommands", "command", "commands", "커스텀", "커스텀명령어", "명령어", "자동문구"]
  };
  for (const [key, names] of Object.entries(aliases)) {
    if (names.includes(text)) return key;
  }
  return "";
}

function applyFeatureSettingsFromPayload(roomState, payload = {}) {
  const current = roomFeatures(roomState);
  const incoming = payload.features && typeof payload.features === "object" && !Array.isArray(payload.features)
    ? payload.features
    : {};
  const direct = {
    attendance: payload.attendanceEnabled,
    points: payload.pointsEnabled,
    rankings: payload.rankingsEnabled || payload.rankingEnabled,
    history: payload.historyEnabled,
    profiles: payload.profilesEnabled || payload.profileEnabled,
    localJs: payload.localJsEnabled || payload.jsAutoReplyEnabled || payload.scriptEnabled,
    games: payload.gamesEnabled || payload.gameEnabled,
    shop: payload.shopEnabled || payload.storeEnabled || payload.inventoryEnabled,
    customCommands: payload.customCommandsEnabled || payload.customCommandEnabled
  };
  let changed = false;
  for (const key of Object.keys(DEFAULT_ROOM_FEATURES)) {
    const value = Object.hasOwn(incoming, key) ? incoming[key] : direct[key];
    if (value === undefined || value === null || value === "") continue;
    const next = booleanSetting(value, current[key]);
    if (current[key] !== next) changed = true;
    current[key] = next;
  }
  return changed;
}

function featureLines(roomState) {
  const features = roomFeatures(roomState);
  return Object.entries(FEATURE_LABELS).map(([key, label]) => `• ${label}: ${features[key] ? "켜짐" : "꺼짐"}`);
}

function featureSettingsCommand(roomState) {
  const features = roomFeatures(roomState);
  const enabled = [];
  const disabled = [];
  for (const [key, label] of Object.entries(FEATURE_LABELS)) {
    (features[key] ? enabled : disabled).push(label);
  }
  return [
    "방별 기능 설정",
    `켜짐: ${enabled.join(", ") || "없음"}`,
    `꺼짐: ${disabled.join(", ") || "없음"}`,
    "관리: /기능켜기 출석 · /기능끄기 게임",
    "상세 설정은 운영 콘솔에서 확인하세요."
  ].join("\n");
}

function featureUpdateCommand(roomState, sender, text, enabled) {
  const denied = requireAdmin(roomState, sender);
  if (denied) return denied;
  const body = normalizeText(text.replace(/^\/(?:기능켜기|기능끄기|기능설정)\s*/i, ""));
  const key = featureKeyFromText(body);
  if (!key) return "형식: /기능켜기 출석 또는 /기능끄기 게임";
  const features = roomFeatures(roomState);
  features[key] = enabled;
  recordRoomEvent(roomState, { type: "feature_updated", feature: key, enabled, by: sender });
  return [
    `${featureLabel(key)} 기능이 ${enabled ? "켜졌습니다" : "꺼졌습니다"}.`,
    "",
    ...featureLines(roomState)
  ].join("\n");
}

function featureDisabledText(key) {
  return [
    `${featureLabel(key)} 기능은 이 방에서 꺼져 있습니다.`,
    "원인: 기능 꺼짐",
    "관리자에게 /기능켜기 명령 또는 관리 콘솔 설정을 요청하세요."
  ].join("\n");
}

function addDaysIso(sourceDate, days) {
  const date = sourceDate instanceof Date ? sourceDate : new Date(sourceDate || Date.now());
  return new Date(date.getTime() + days * 86400000).toISOString();
}

function parseKstCalendarDate(value, { endOfDay = true } = {}) {
  const text = normalizeText(value);
  if (!text) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const time = endOfDay ? "23:59:59" : "00:00:00";
    const kstDate = new Date(`${text}T${time}+09:00`);
    return Number.isNaN(kstDate.getTime()) ? "" : kstDate.toISOString();
  }
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function parseSubscriptionDate(value) {
  return parseKstCalendarDate(value, { endOfDay: true });
}

function formatSubscriptionDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "미설정";
  return kstDateTime(date);
}

function formatGameSeasonDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "미설정";
  return kstDateKey(date);
}

function gameSeasonPeriodText(settings = {}) {
  if (!settings.seasonStartsAt && !settings.seasonEndsAt) return "시즌 기간: 미설정";
  return `시즌 기간: ${settings.seasonStartsAt ? formatGameSeasonDate(settings.seasonStartsAt) : "미설정"} ~ ${settings.seasonEndsAt ? formatGameSeasonDate(settings.seasonEndsAt) : "미설정"}`;
}

function gameSeasonStatusText(settings = {}) {
  const now = Date.now();
  const startsAt = new Date(settings.seasonStartsAt || "");
  const endsAt = new Date(settings.seasonEndsAt || "");
  if (!Number.isNaN(startsAt.getTime()) && now < startsAt.getTime()) return "시즌 상태: 예정";
  if (!Number.isNaN(endsAt.getTime()) && now > endsAt.getTime()) return "시즌 상태: 종료";
  if (settings.seasonStartsAt || settings.seasonEndsAt) return "시즌 상태: 진행 중";
  return "시즌 상태: 미설정";
}

function remainingDays(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.ceil((date.getTime() - Date.now()) / 86400000);
}

function personKey(name) {
  return keyFor(stripKakaoSuffix(name));
}

const RESERVED_PERSON_KEYS = new Set([
  "미정",
  "익명",
  "unknown",
  "unknown user",
  "anonymous",
  "undefined",
  "null"
].map(keyFor));

function isReservedPersonName(name) {
  const key = personKey(name);
  return !key || RESERVED_PERSON_KEYS.has(key);
}

function stripKakaoSuffix(name) {
  return normalizeText(name)
    .replace(/님$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeIdentityId(value) {
  const id = normalizeText(value);
  if (!id || id === "[object Object]") return "";
  return id.slice(0, 200);
}

function identityPersonKey(roomState, identityId) {
  const id = normalizeIdentityId(identityId);
  if (isAmbiguousIdentity(roomState, id)) return "";
  const key = id ? roomState.peopleByIdentity?.[id] : "";
  const person = key ? roomState.people?.[key] : null;
  if (!person || isReservedPersonName(person.currentName)) return "";
  return key;
}

function isAmbiguousIdentity(roomState, identityId) {
  const id = normalizeIdentityId(identityId);
  return Boolean(id && roomState.ambiguousIdentities?.includes(id));
}

function markAmbiguousIdentity(roomState, identityId) {
  const id = normalizeIdentityId(identityId);
  if (!id) return;
  roomState.ambiguousIdentities ||= [];
  addUnique(roomState.ambiguousIdentities, id);
  if (roomState.peopleByIdentity) delete roomState.peopleByIdentity[id];
  for (const person of Object.values(roomState.people || {})) {
    person.identities = (person.identities || []).filter((value) => normalizeIdentityId(value) !== id);
  }
}

function identityNamesForEvent(event, identityId) {
  const id = normalizeIdentityId(identityId);
  if (!id) return [];
  const identity = event?.identity || {};
  return uniqueNames([
    normalizeIdentityId(identity.senderId) === id ? event.sender : "",
    normalizeIdentityId(identity.targetUserId) === id ? event.eventName : ""
  ]).filter((name) => !isReservedPersonName(name));
}

function identityLooksShared(roomState, identityId, currentName) {
  const id = normalizeIdentityId(identityId);
  const currentKey = keyFor(currentName);
  if (!id || !currentKey) return false;
  if (isAmbiguousIdentity(roomState, id)) return true;

  const sequence = [];
  for (const event of (roomState.rawEvents || []).slice(-30)) {
    for (const name of identityNamesForEvent(event, id)) {
      const nameKey = keyFor(name);
      if (nameKey && nameKey !== sequence.at(-1)) sequence.push(nameKey);
    }
  }

  const lastIndex = sequence.length - 1;
  if (lastIndex < 0 || sequence[lastIndex] !== currentKey) return false;
  return sequence.some((nameKey, index) => (
    index < lastIndex
    && nameKey === currentKey
    && sequence.slice(index + 1, lastIndex).some((laterKey) => laterKey !== currentKey)
  ));
}

function remapPersonKey(roomState, oldKey, newKey, person) {
  if (!oldKey || !newKey || oldKey === newKey) return;
  roomState.people[newKey] = person;
  delete roomState.people[oldKey];
  if (roomState.inbox?.[oldKey]) {
    roomState.inbox[newKey] = [...(roomState.inbox[newKey] || []), ...roomState.inbox[oldKey]];
    delete roomState.inbox[oldKey];
  }
  roomState.admins = (roomState.admins || []).map((name) => (personKey(name) === oldKey ? person.currentName : name));
  if (roomState.profiles[oldKey] && !roomState.profiles[newKey]) {
    roomState.profiles[newKey] = { ...roomState.profiles[oldKey], name: person.currentName };
    delete roomState.profiles[oldKey];
  }
  for (const [alias, key] of Object.entries(roomState.aliases || {})) {
    if (key === oldKey) roomState.aliases[alias] = newKey;
  }
  for (const [id, key] of Object.entries(roomState.peopleByIdentity || {})) {
    if (key === oldKey) roomState.peopleByIdentity[id] = newKey;
  }
}

function attachPersonIdentity(roomState, key, person, identityId) {
  const id = normalizeIdentityId(identityId);
  if (!id) return;
  if (isReservedPersonName(person?.currentName)) return;
  person.identities ||= [];
  if (!person.identities.includes(id)) person.identities.push(id);
  roomState.peopleByIdentity ||= {};
  roomState.peopleByIdentity[id] = key;
}

function ensurePerson(roomState, name, identityId = "") {
  const displayName = stripKakaoSuffix(name);
  const displayKey = personKey(displayName);
  if (identityLooksShared(roomState, identityId, displayName)) markAmbiguousIdentity(roomState, identityId);
  const existingKey = identityPersonKey(roomState, identityId);
  if (existingKey && displayKey && existingKey !== displayKey && roomState.people[displayKey]) {
    markAmbiguousIdentity(roomState, identityId);
  }
  const trustedIdentityKey = isAmbiguousIdentity(roomState, identityId) ? "" : identityPersonKey(roomState, identityId);
  const aliasTargetKey = roomState.aliases?.[keyFor(displayName)] || "";
  const key = trustedIdentityKey || aliasTargetKey || displayKey;
  if (!key) return null;
  roomState.people[key] ||= {
    currentName: displayName,
    names: [],
    entries: [],
    exits: [],
    kicks: [],
    nickChanges: [],
    joinedAt: nowIso(),
    points: 0,
    spentPoints: 0,
    exp: 0,
    level: 1,
    hearts: 0,
    attendance: { dates: [], currentStreak: 0 },
    chats: { total: 0, byDate: {}, byWeek: {} },
    identities: [],
    firstChatReentryNotices: []
  };
  const person = roomState.people[key];
  normalizePersonState(person);
  const previousName = person.currentName;
  if (
    displayName
    && previousName
    && keyFor(previousName) !== keyFor(displayName)
    && !isReservedPersonName(previousName)
    && !isReservedPersonName(displayName)
  ) {
    addUnique(person.names, previousName);
    person.nickChanges.push({ from: previousName, to: displayName, at: nowIso(), source: "identity" });
  }
  person.currentName ||= displayName;
  if (displayName) person.currentName = displayName;
  addUnique(person.names, displayName);
  const storageKey = aliasTargetKey || displayKey || key;
  if (trustedIdentityKey && storageKey && trustedIdentityKey !== storageKey) remapPersonKey(roomState, trustedIdentityKey, storageKey, person);
  if (!isAmbiguousIdentity(roomState, identityId)) attachPersonIdentity(roomState, storageKey || key, person, identityId);
  return person;
}

function normalizePersonState(person) {
  person.names ||= [];
  person.entries ||= [];
  person.exits ||= [];
  person.kicks ||= [];
  person.nickChanges ||= [];
  person.joinedAt ||= nowIso();
  person.points = Number.isFinite(Number(person.points)) ? Number(person.points) : 0;
  person.spentPoints = Number.isFinite(Number(person.spentPoints)) ? Number(person.spentPoints) : 0;
  person.exp = Number.isFinite(Number(person.exp)) ? Number(person.exp) : 0;
  person.level = Math.max(1, Number.isFinite(Number(person.level)) ? Number(person.level) : 1);
  person.hearts = Number.isFinite(Number(person.hearts)) ? Number(person.hearts) : 0;
  person.attendance ||= {};
  person.attendance.dates ||= [];
  person.attendance.currentStreak = Math.max(0, Number(person.attendance.currentStreak || 0));
  person.chats ||= {};
  person.chats.total = Math.max(0, Number(person.chats.total || 0));
  person.chats.byDate ||= {};
  person.chats.byWeek ||= {};
  person.inventory = normalizeInventory(person.inventory || {});
  person.lockedInventory = normalizeInventoryLocks(person.lockedInventory || person.lockedItems || []);
  person.gameCooldowns = normalizeGameCooldowns(person.gameCooldowns || {});
  person.uiState ||= {};
  person.uiState.inventoryPages ||= {};
  person.equipment = normalizeEquipment(person.equipment || {});
  person.equipmentEnhancements = normalizeEquipmentEnhancements(person.equipmentEnhancements || {});
  person.pendingRpgReward = normalizePendingRpgReward(person.pendingRpgReward || null);
  person.rpgAutoHunt ||= {};
  person.rpgAutoHunt.date = person.rpgAutoHunt.date === kstDateKey() ? person.rpgAutoHunt.date : kstDateKey();
  person.rpgAutoHunt.count = Math.max(0, Math.trunc(Number(person.rpgAutoHunt.count || 0)));
  person.monsters = normalizeOwnedMonsters(person.monsters || []);
  person.pendingMonster = normalizePendingMonster(person.pendingMonster || null);
  person.monsterShards ||= {};
  for (const [speciesId, count] of Object.entries(person.monsterShards || {})) {
    const species = pixelMonsterSpeciesById(speciesId);
    if (!species) delete person.monsterShards[speciesId];
    else person.monsterShards[species.speciesId] = Math.max(0, Math.trunc(Number(count) || 0));
  }
  person.monsterQuestStats ||= {};
  const monsterQuestDate = kstDateKey();
  if (person.monsterQuestStats.date !== monsterQuestDate) {
    person.monsterQuestStats = { date: monsterQuestDate, explore: 0, capture: 0, train: 0, battle: 0, boss: 0 };
  } else {
    for (const key of ["explore", "capture", "train", "battle", "boss"]) {
      person.monsterQuestStats[key] = Math.max(0, Math.trunc(Number(person.monsterQuestStats[key] || 0)));
    }
  }
  person.monsterQuests ||= {};
  person.monsterDexRewards ||= [];
  person.monsterDexRewards = Array.isArray(person.monsterDexRewards)
    ? person.monsterDexRewards.map((value) => Math.trunc(Number(value) || 0)).filter((value) => PIXEL_MONSTER_DEX_REWARD_THRESHOLDS.includes(value))
    : [];
  person.pet = normalizePetState(person.pet || null);
  person.identities ||= [];
  person.firstChatReentryNotices ||= [];
  cleanupReservedPersonHistory(person);
  return person;
}

function cleanupReservedPersonHistory(person) {
  if (!person) return;
  const currentKey = personKey(person.currentName);
  const beforeChanges = person.nickChanges || [];
  person.nickChanges = beforeChanges.filter((event) => (
    !isReservedPersonName(event.from)
    && !isReservedPersonName(event.to)
  ));
  person.names = uniqueNames([
    person.currentName,
    ...(person.names || []),
    ...person.nickChanges.flatMap((event) => [event.from, event.to])
  ]).filter((name) => {
    if (!isReservedPersonName(name)) return true;
    return currentKey && personKey(name) === currentKey;
  });
  if (beforeChanges.length !== person.nickChanges.length) {
    person.firstChatReentryNotices = [];
  }
}

function addUnique(list, value) {
  const normalized = normalizeText(value);
  if (normalized && !list.includes(normalized)) list.push(normalized);
}

function displayNameForKey(roomState, key, fallback = "") {
  const profile = roomState.profiles?.[key] || {};
  return profile.alias || profile.aliases?.[0] || profile.name || roomState.people[key]?.currentName || stripKakaoSuffix(fallback) || key;
}

function displayNameForPerson(roomState, person, fallback = "") {
  const key = person?.currentName ? personKey(person.currentName) : "";
  return key ? displayNameForKey(roomState, key, fallback || person.currentName) : stripKakaoSuffix(fallback) || "";
}

function existingPersonKey(roomState, query) {
  const key = resolveName(roomState, query);
  if (key && roomState.people[key]) return key;
  if (key && roomState.profiles[key]) {
    ensurePerson(roomState, roomState.profiles[key].name);
    return key;
  }
  return "";
}

function mergeNumericMaps(target = {}, source = {}) {
  const result = { ...(target || {}) };
  for (const [key, value] of Object.entries(source || {})) {
    result[key] = Math.max(0, Number(result[key] || 0)) + Math.max(0, Number(value || 0));
  }
  return result;
}

function mergeCooldownMaps(target = {}, source = {}) {
  const result = { ...(target || {}) };
  for (const [key, value] of Object.entries(source || {})) {
    const currentTime = Date.parse(result[key] || "");
    const sourceTime = Date.parse(value || "");
    if (Number.isFinite(sourceTime) && (!Number.isFinite(currentTime) || sourceTime > currentTime)) {
      result[key] = value;
    }
  }
  return normalizeGameCooldowns(result);
}

function mergeEquipmentState(target = {}, source = {}) {
  const targetEquipment = normalizeEquipment(target || {});
  const sourceEquipment = normalizeEquipment(source || {});
  return {
    weapon: targetEquipment.weapon || sourceEquipment.weapon || "",
    armor: targetEquipment.armor || sourceEquipment.armor || "",
    accessory: targetEquipment.accessory || sourceEquipment.accessory || ""
  };
}

function mergeProfileForPerson(roomState, targetKey, sourceKey, targetPerson, sourcePerson, extraAliases = []) {
  roomState.profiles ||= {};
  roomState.aliases ||= {};
  const sourceProfile = roomState.profiles[sourceKey] || {};
  const targetProfile = roomState.profiles[targetKey] || {};
  const aliases = uniqueNames([
    targetProfile.alias,
    ...(targetProfile.aliases || []),
    sourceProfile.name,
    sourceProfile.alias,
    ...(sourceProfile.aliases || []),
    sourcePerson?.currentName,
    ...(sourcePerson?.names || []),
    ...extraAliases
  ]).filter((name) => keyFor(name) !== keyFor(targetPerson.currentName));

  roomState.profiles[targetKey] = {
    name: targetProfile.name || targetPerson.currentName,
    alias: targetProfile.alias || aliases[0] || "",
    aliases,
    fields: { ...(sourceProfile.fields || {}), ...(targetProfile.fields || {}) },
    raw: targetProfile.raw || sourceProfile.raw || "",
    updatedAt: nowIso(),
    updatedBy: targetProfile.updatedBy || sourceProfile.updatedBy || ""
  };

  for (const alias of aliases) roomState.aliases[keyFor(alias)] = targetKey;
  for (const [alias, key] of Object.entries(roomState.aliases || {})) {
    if (key === sourceKey) roomState.aliases[alias] = targetKey;
  }
  if (sourceKey !== targetKey) delete roomState.profiles[sourceKey];
}

function cloneJson(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function nicknameMergeSnapshot(roomState, targetKey, sourceKey, targetName, sourceName, options = {}) {
  return {
    id: generateEntityId("nmg"),
    status: "active",
    roomName: roomState.name || "",
    targetKey,
    sourceKey,
    targetName,
    sourceName,
    reason: options.source || "manual_merge",
    by: options.by || "",
    createdAt: nowIso(),
    undoneAt: "",
    undoneBy: "",
    snapshot: {
      targetPerson: cloneJson(roomState.people?.[targetKey] || null),
      sourcePerson: cloneJson(roomState.people?.[sourceKey] || null),
      targetProfile: cloneJson(roomState.profiles?.[targetKey] || null),
      sourceProfile: cloneJson(roomState.profiles?.[sourceKey] || null),
      aliases: cloneJson(roomState.aliases || {}),
      peopleByIdentity: cloneJson(roomState.peopleByIdentity || {}),
      admins: cloneJson(roomState.admins || []),
      inboxTarget: cloneJson(roomState.inbox?.[targetKey] || null),
      inboxSource: cloneJson(roomState.inbox?.[sourceKey] || null)
    }
  };
}

function recordNicknameMergeHistory(roomState, history) {
  if (!history?.id) return "";
  roomState.nicknameMergeHistory ||= [];
  roomState.nicknameMergeHistory.unshift(history);
  if (roomState.nicknameMergeHistory.length > 100) roomState.nicknameMergeHistory = roomState.nicknameMergeHistory.slice(0, 100);
  return history.id;
}

function mergePersonData(roomState, targetKey, sourceKey, options = {}) {
  if (!targetKey || !sourceKey) return { ok: false, error: "not_found" };
  if (targetKey === sourceKey) return { ok: true, merged: false, targetKey, sourceKey };
  roomState.people ||= {};
  const targetPerson = normalizePersonState(roomState.people[targetKey] || ensurePerson(roomState, options.targetName || targetKey));
  const sourcePerson = normalizePersonState(roomState.people[sourceKey] || ensurePerson(roomState, options.sourceName || sourceKey));
  if (!targetPerson || !sourcePerson) return { ok: false, error: "not_found" };

  const targetName = targetPerson.currentName || options.targetName || displayNameForKey(roomState, targetKey, targetKey);
  const sourceName = sourcePerson.currentName || options.sourceName || displayNameForKey(roomState, sourceKey, sourceKey);
  const history = options.trackHistory === false ? null : nicknameMergeSnapshot(roomState, targetKey, sourceKey, targetName, sourceName, options);
  targetPerson.currentName = targetName;
  targetPerson.names = uniqueNames([
    targetName,
    ...(targetPerson.names || []),
    sourceName,
    ...(sourcePerson.names || [])
  ]);
  targetPerson.entries = [...(targetPerson.entries || []), ...(sourcePerson.entries || [])];
  targetPerson.exits = [...(targetPerson.exits || []), ...(sourcePerson.exits || [])];
  targetPerson.kicks = [...(targetPerson.kicks || []), ...(sourcePerson.kicks || [])];
  targetPerson.nickChanges = [
    ...(targetPerson.nickChanges || []),
    ...(sourcePerson.nickChanges || []),
    { from: sourceName, to: targetName, at: nowIso(), source: options.source || "manual_merge" }
  ].filter((event) => event.from && event.to);
  targetPerson.joinedAt = [targetPerson.joinedAt, sourcePerson.joinedAt]
    .filter(Boolean)
    .sort()[0] || nowIso();
  targetPerson.points = Math.max(0, Number(targetPerson.points || 0)) + Math.max(0, Number(sourcePerson.points || 0));
  targetPerson.spentPoints = Math.max(0, Number(targetPerson.spentPoints || 0)) + Math.max(0, Number(sourcePerson.spentPoints || 0));
  targetPerson.exp = Math.max(0, Number(targetPerson.exp || 0)) + Math.max(0, Number(sourcePerson.exp || 0));
  targetPerson.level = Math.max(1, Number(targetPerson.level || 1), Number(sourcePerson.level || 1));
  targetPerson.hearts = Math.max(0, Number(targetPerson.hearts || 0)) + Math.max(0, Number(sourcePerson.hearts || 0));
  targetPerson.attendance = {
    dates: [...new Set([...(targetPerson.attendance?.dates || []), ...(sourcePerson.attendance?.dates || [])])].sort(),
    currentStreak: Math.max(Number(targetPerson.attendance?.currentStreak || 0), Number(sourcePerson.attendance?.currentStreak || 0))
  };
  targetPerson.chats = {
    total: Math.max(0, Number(targetPerson.chats?.total || 0)) + Math.max(0, Number(sourcePerson.chats?.total || 0)),
    byDate: mergeNumericMaps(targetPerson.chats?.byDate, sourcePerson.chats?.byDate),
    byWeek: mergeNumericMaps(targetPerson.chats?.byWeek, sourcePerson.chats?.byWeek)
  };
  targetPerson.inventory = normalizeInventory(mergeNumericMaps(targetPerson.inventory, sourcePerson.inventory));
  targetPerson.gameCooldowns = mergeCooldownMaps(targetPerson.gameCooldowns, sourcePerson.gameCooldowns);
  targetPerson.equipment = mergeEquipmentState(targetPerson.equipment, sourcePerson.equipment);
  targetPerson.monsters = normalizeOwnedMonsters([...(targetPerson.monsters || []), ...(sourcePerson.monsters || [])]);
  targetPerson.pendingMonster = targetPerson.pendingMonster || sourcePerson.pendingMonster || null;
  targetPerson.pet = targetPerson.pet || sourcePerson.pet || null;
  targetPerson.identities = [...new Set([...(targetPerson.identities || []), ...(sourcePerson.identities || [])].map(normalizeIdentityId).filter(Boolean))];
  targetPerson.firstChatReentryNotices = [...new Set([...(targetPerson.firstChatReentryNotices || []), ...(sourcePerson.firstChatReentryNotices || [])])];
  normalizePersonState(targetPerson);

  roomState.people[targetKey] = targetPerson;
  if (roomState.inbox?.[sourceKey]) {
    roomState.inbox[targetKey] = [...(roomState.inbox[targetKey] || []), ...roomState.inbox[sourceKey]];
    delete roomState.inbox[sourceKey];
  }
  roomState.admins = (roomState.admins || []).map((name) => (personKey(name) === sourceKey ? targetName : name));
  roomState.admins = uniqueNames(roomState.admins);
  for (const [id, key] of Object.entries(roomState.peopleByIdentity || {})) {
    if (key === sourceKey) roomState.peopleByIdentity[id] = targetKey;
  }
  for (const id of targetPerson.identities || []) {
    if (!isAmbiguousIdentity(roomState, id)) {
      roomState.peopleByIdentity ||= {};
      roomState.peopleByIdentity[id] = targetKey;
    }
  }
  mergeProfileForPerson(roomState, targetKey, sourceKey, targetPerson, sourcePerson, options.aliases || []);
  delete roomState.people[sourceKey];
  const mergeId = recordNicknameMergeHistory(roomState, history);
  recordRoomEvent(roomState, {
    type: "nickname_merged",
    mergeId,
    target: targetName,
    source: sourceName,
    by: options.by || "",
    reason: options.source || "manual_merge"
  });
  return { ok: true, merged: true, mergeId, targetKey, sourceKey, targetName, sourceName, points: targetPerson.points };
}

function roomAdminKeys(roomState) {
  return new Set([...configuredAdmins(), ...(roomState.admins || [])].map(personKey).filter(Boolean));
}

function hasAnyAdmin(roomState) {
  return roomAdminKeys(roomState).size > 0;
}

function isAdmin(roomState, sender) {
  const senderKey = personKey(sender);
  return Boolean(senderKey && roomAdminKeys(roomState).has(senderKey));
}

function adminOnlyMessage() {
  return [
    "관리자 전용 명령어입니다.",
    "등록된 관리자에게 요청해주세요."
  ].join("\n");
}

function initialAdminRequiredMessage() {
  return [
    "초기 관리자는 환경변수 ADMIN_NAMES로 먼저 지정해야 합니다.",
    "예: ADMIN_NAMES=무잔,우유 여"
  ].join("\n");
}

function requireAdmin(roomState, sender) {
  if (isAdmin(roomState, sender)) return null;
  if (!hasAnyAdmin(roomState)) return initialAdminRequiredMessage();
  return adminOnlyMessage();
}

function unknownCommandNoticeText(roomState, sender, parsedCommand) {
  if (!parsedCommand?.isCommandAttempt || !parsedCommand.command) return null;
  if (!slashTokenLooksLikeCommand(parsedCommand.command)) return null;

  roomState.commandRouting ||= {};
  const noticeEnabled = roomState.commandRouting.unknownNoticeEnabled === true
    || process.env.UNKNOWN_COMMAND_NOTICE_ENABLED === "true";
  if (!noticeEnabled) return null;

  roomState.commandRouting.unknownNotices ||= { byUser: {}, byRoom: {} };
  const state = roomState.commandRouting.unknownNotices;
  state.byUser ||= {};
  state.byRoom ||= {};

  const now = Date.now();
  const userKey = personKey(sender) || "unknown";
  const roomKeyValue = roomKey(roomState.name || "default");
  const lastUserAt = Number(state.byUser[userKey]?.lastNotifiedAtMs || 0);
  const lastRoomAt = Number(state.byRoom[roomKeyValue]?.lastNotifiedAtMs || 0);
  if (now - lastUserAt < UNKNOWN_COMMAND_USER_COOLDOWN_MS) return null;
  if (now - lastRoomAt < UNKNOWN_COMMAND_ROOM_COOLDOWN_MS) return null;

  const record = {
    command: parsedCommand.command,
    lastNotifiedAt: nowIso(),
    lastNotifiedAtMs: now
  };
  state.byUser[userKey] = record;
  state.byRoom[roomKeyValue] = record;
  return "등록되지 않은 명령어입니다. /도움말 로 사용 가능한 명령어를 확인해주세요.";
}

function recordRoomEvent(roomState, event) {
  roomState.events.push({ ...event, at: nowIso() });
  if (roomState.events.length > 500) roomState.events = roomState.events.slice(-500);
}

function shortHash(value) {
  const text = normalizeText(value);
  return text ? createHash("sha256").update(text).digest("hex").slice(0, 16) : "";
}

function parseTimestampMs(value) {
  if (Number.isFinite(Number(value)) && Number(value) > 0) return Number(value);
  const parsed = Date.parse(normalizeText(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function resolveChatEventId(payload = {}, { room = "", sender = "", message = "" } = {}) {
  const explicit = normalizeText(payload.eventId || payload.bridgeEventId || payload.event_id || payload.id);
  if (explicit) return explicit.slice(0, 96);
  const roomId = normalizeText(payload.roomId || payload.openChatId || payload.roomLink || payload.openChatLink || room);
  const timestampSource = payload.bridgeReceivedAt || payload.postedAtMs || payload.createdAt || payload.at;
  const timestamp = parseTimestampMs(timestampSource);
  const timeKey = timestamp ? Math.floor(timestamp / 5000) : `${Date.now()}:${randomBytes(4).toString("hex")}`;
  return `srv_${shortHash([roomId, room, sender, message, timeKey].join("|"))}`;
}

function eventIdSeen(roomState, eventId) {
  if (!eventId) return false;
  roomState.recentEventIds ||= [];
  return roomState.recentEventIds.includes(eventId);
}

function rememberEventId(roomState, eventId) {
  if (!eventId) return;
  roomState.recentEventIds ||= [];
  if (!roomState.recentEventIds.includes(eventId)) roomState.recentEventIds.push(eventId);
  if (roomState.recentEventIds.length > 300) roomState.recentEventIds = roomState.recentEventIds.slice(-300);
}

function redactSensitiveText(value) {
  return normalizeText(value)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu, "[email]")
    .replace(/(?:\+?82[-.\s]?)?0?1[016789][-\s.]?\d{3,4}[-\s.]?\d{4}/g, "[phone]")
    .replace(/\b(?:token|secret|password|비밀번호|인증번호|api[_-]?key)\s*[:=]\s*\S+/giu, "[secret]");
}

function payloadValue(payload, paths) {
  for (const pathParts of paths) {
    let value = payload;
    for (const part of pathParts) {
      value = value?.[part];
      if (value == null) break;
    }
    const normalized = normalizeIdentityId(value);
    if (normalized) return normalized;
  }
  return "";
}

function listValues(...values) {
  return values
    .flatMap((value) => String(value || "").split(/[\s,]+/))
    .map((value) => value.trim())
    .filter(Boolean);
}

function openChatRoomId(value) {
  const text = normalizeText(value);
  if (!text) return "";
  const urlMatch = text.match(/open\.kakao\.com\/o\/([A-Za-z0-9_-]+)/i);
  if (urlMatch) return urlMatch[1];
  const bare = text.match(/^[A-Za-z0-9_-]{4,80}$/);
  return bare ? bare[0] : "";
}

function envRegisteredRoomIds() {
  const ids = listValues(
    process.env.REGISTERED_ROOM_IDS,
    process.env.REGISTERED_OPENCHAT_IDS,
    ...DEFAULT_REGISTERED_ROOM_LINKS
  );
  const links = listValues(process.env.REGISTERED_ROOM_LINKS, process.env.REGISTERED_OPENCHAT_LINKS);
  return new Set([...ids, ...links].map(openChatRoomId).filter(Boolean));
}

function stateRegisteredRoomIds(state = {}) {
  const ids = [];
  for (const roomState of Object.values(state.rooms || {})) {
    const settings = roomState?.settings || {};
    if (!settings.registered || settings.enabled === false) continue;
    ids.push(...(settings.roomIds || []), ...(settings.roomLinks || []));
  }
  return new Set(ids.map(openChatRoomId).filter(Boolean));
}

function registeredRoomIds(state = {}) {
  return new Set([...envRegisteredRoomIds(), ...stateRegisteredRoomIds(state)]);
}

function payloadRoomId(payload = {}) {
  return openChatRoomId(
    payload.roomId ||
      payload.roomID ||
      payload.openChatId ||
      payload.openchatId ||
      payload.kakaoOpenChatId ||
      payload.roomLink ||
      payload.openChatLink ||
      payload.link
  );
}

function isRegisteredRoomPayload(payload = {}, state = null, room = "") {
  const ids = registeredRoomIds(state || {});
  if (!ids.size && !state) return true;
  const roomId = payloadRoomId(payload);
  if (roomId && ids.has(roomId)) return true;
  const roomNameKey = roomKey(room || payload.room || payload.rawRoom);
  const roomState = state?.rooms?.[roomNameKey];
  return Boolean(roomState?.settings?.registered && roomState.settings.enabled !== false);
}

function booleanPayloadValue(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const text = String(value ?? "").trim().toLowerCase();
  if (!text) return null;
  if (["true", "1", "yes", "y", "group", "multi", "openchat", "open_chat"].includes(text)) return true;
  if (["false", "0", "no", "n", "private", "direct", "dm", "personal", "one_to_one"].includes(text)) return false;
  return null;
}

function isGroupChatPayload(payload = {}) {
  const rawGroup = booleanPayloadValue(payload.rawIsGroupChat);
  const rawMulti = booleanPayloadValue(payload.rawIsMultiChat ?? payload.isMultiChat);
  if (rawGroup === true || rawMulti === true) return true;
  if (rawGroup === false || rawMulti === false) return false;

  const group = booleanPayloadValue(payload.isGroupChat);
  if (group !== null) return group;

  const chatType = String(payload.chatType || payload.roomType || "").trim().toLowerCase();
  if (/(group|multi|open)/.test(chatType)) return true;
  if (/(private|direct|dm|personal|one)/.test(chatType)) return false;

  return false;
}

function collectPayloadIds(value, basePath = "", depth = 0, results = []) {
  if (!value || typeof value !== "object" || depth > 6 || results.length >= 20) return results;
  for (const [key, nested] of Object.entries(value)) {
    const pathName = basePath ? `${basePath}.${key}` : key;
    const keyName = key.toLowerCase();
    if (/^(roomid|room_id|openchatid|openchat_id|openchatroomid|open_chat_room_id|kakaoopenchatid)$/.test(keyName)) continue;
    if (/^(eventid|event_id|bridgeeventid|bridge_event_id|messageid|message_id|notificationid|notification_id)$/.test(keyName)) continue;
    if (nested && typeof nested === "object") {
      collectPayloadIds(nested, pathName, depth + 1, results);
      continue;
    }
    if (/(^id$|id$|userid|user_id|profileid|profile_id|memberid|member_id|accountid|account_id|hash$)/i.test(keyName)) {
      const id = normalizeIdentityId(nested);
      if (id) results.push({ path: pathName, value: id });
    }
  }
  return results.filter((item, index, list) => list.findIndex((value) => value.path === item.path && value.value === item.value) === index);
}

function payloadIdentity(payload) {
  return {
    senderId: payloadValue(payload, [
      ["senderId"],
      ["senderID"],
      ["senderUserId"],
      ["senderProfileId"],
      ["senderHash"],
      ["senderProfileHash"],
      ["profileHash"],
      ["authorHash"],
      ["userId"],
      ["profileId"],
      ["memberId"],
      ["accountId"],
      ["sender", "id"],
      ["sender", "userId"],
      ["sender", "profileId"],
      ["user", "id"],
      ["user", "userId"],
      ["user", "profileId"],
      ["profile", "id"],
      ["member", "id"],
      ["author", "id"]
    ]),
    targetUserId: payloadValue(payload, [
      ["targetUserId"],
      ["targetId"],
      ["targetProfileId"],
      ["targetMemberId"],
      ["targetHash"],
      ["targetProfileHash"],
      ["target", "id"],
      ["target", "userId"],
      ["target", "profileId"],
      ["targetUser", "id"],
      ["targetUser", "userId"],
      ["targetProfile", "id"],
      ["event", "targetUserId"],
      ["event", "targetId"],
      ["event", "targetHash"],
      ["event", "targetProfileHash"],
      ["event", "target", "id"],
      ["event", "target", "userId"]
    ]),
    candidates: collectPayloadIds(payload)
  };
}

function sanitizePayload(value, depth = 0) {
  if (depth > 7) return "[depth-limit]";
  if (Array.isArray(value)) return value.slice(0, 30).map((item) => sanitizePayload(item, depth + 1));
  if (!value || typeof value !== "object") return value;
  const result = {};
  for (const [key, nested] of Object.entries(value).slice(0, 80)) {
    if (/(token|secret|password|authorization|cookie|apikey|api_key)/i.test(key)) {
      result[key] = "[redacted]";
    } else {
      result[key] = sanitizePayload(nested, depth + 1);
    }
  }
  return result;
}

function previewText(value, maxLength = 120) {
  const text = normalizeText(value).replace(/\s+/g, " ");
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function recordRoomAnalyticsLog(roomState, payload, meta = {}) {
  roomState.analyticsLogs ||= [];
  const message = normalizeText(meta.message || payload?.msg || payload?.message);
  const parsed = parseBotCommand(message);
  const identity = payloadIdentity(payload);
  const sender = normalizeText(meta.sender || payload?.sender || "익명");
  const room = normalizeText(meta.room || payload?.room || "");
  const timing = meta.timing || {};
  const log = {
    at: nowIso(),
    eventId: normalizeText(meta.eventId || payload?.eventId || payload?.bridgeEventId || ""),
    room,
    roomKey: roomKey(room),
    sender: previewText(redactSensitiveText(sender), 80),
    senderHash: shortHash(sender),
    messagePreview: previewText(redactSensitiveText(message), ROOM_ANALYTICS_MESSAGE_PREVIEW_LIMIT),
    messageHash: shortHash(message),
    messageLength: message.length,
    isCommand: parsed.isCommandAttempt,
    command: parsed.command || "",
    eventType: meta.event?.type || "",
    eventName: previewText(redactSensitiveText(meta.event?.name || meta.event?.to || ""), 80),
    roomId: openChatRoomId(payload?.roomId || payload?.roomLink || payload?.openChatId || payload?.openChatLink),
    packageName: normalizeText(payload?.packageName || ""),
    chatType: normalizeText(payload?.chatType || payload?.roomType || ""),
    isGroupChat: isGroupChatPayload(payload),
    senderIdentityHash: shortHash(identity.senderId),
    targetIdentityHash: shortHash(identity.targetUserId),
    candidateIdentityCount: identity.candidates?.length || 0,
    bridgeReceivedAt: normalizeText(payload?.bridgeReceivedAt || ""),
    bridgeSentAt: normalizeText(payload?.bridgeSentAt || ""),
    serverReceivedAt: normalizeText(meta.serverReceivedAt || ""),
    replyGeneratedAt: normalizeText(meta.replyGeneratedAt || ""),
    status: normalizeText(meta.status || "received"),
    ignoreReason: normalizeText(meta.ignoreReason || ""),
    errorReason: normalizeText(meta.errorReason || ""),
    replyLength: Math.max(0, Number(meta.replyLength || 0) || 0),
    saveRequired: meta.saveRequired !== false,
    duplicate: Boolean(meta.duplicate),
    totalMs: Math.max(0, Number(timing.totalMs || 0) || 0),
    loadStateMs: Math.max(0, Number(timing.loadStateMs || 0) || 0),
    guardMs: Math.max(0, Number(timing.guardMs || 0) || 0),
    commandMs: Math.max(0, Number(timing.commandMs || 0) || 0),
    logMs: Math.max(0, Number(timing.logMs || 0) || 0),
    saveStateMs: Math.max(0, Number(timing.saveStateMs || 0) || 0)
  };
  roomState.analyticsLogs.push(log);
  if (roomState.analyticsLogs.length > ROOM_ANALYTICS_LOG_LIMIT) {
    roomState.analyticsLogs = roomState.analyticsLogs.slice(-ROOM_ANALYTICS_LOG_LIMIT);
  }
  return log;
}

function recordRawEvent(roomState, payload, meta = {}) {
  roomState.rawEvents ||= [];
  const analyticsLog = recordRoomAnalyticsLog(roomState, payload, meta);
  const identity = payloadIdentity(payload);
  const event = {
    at: nowIso(),
    eventId: analyticsLog.eventId,
    route: "chat-event",
    room: meta.room || "",
    sender: meta.sender || "",
    message: meta.message || "",
    eventType: meta.event?.type || "",
    eventName: meta.event?.name || meta.event?.to || "",
    status: analyticsLog.status,
    ignoreReason: analyticsLog.ignoreReason,
    errorReason: analyticsLog.errorReason,
    timing: meta.timing || {},
    identity,
    payload: sanitizePayload(payload)
  };
  roomState.rawEvents.push(event);
  if (roomState.rawEvents.length > 50) roomState.rawEvents = roomState.rawEvents.slice(-50);
  return { event, analyticsLog };
}

function resolveName(roomState, query) {
  const raw = stripKakaoSuffix(query);
  if (!raw) return "";
  const directKey = personKey(raw);
  if (roomState.profiles[directKey] || roomState.people[directKey]) return directKey;
  const aliasKey = keyFor(raw);
  if (roomState.aliases[aliasKey]) return roomState.aliases[aliasKey];
  const matches = Object.entries(roomState.profiles)
    .filter(([, profile]) => {
      const haystack = [profile.name, profile.alias, ...(profile.aliases || [])].map(keyFor);
      return haystack.some((value) => value.includes(aliasKey));
    })
    .map(([key]) => key);
  if (matches.length === 1) return matches[0];
  const peopleMatches = Object.entries(roomState.people)
    .filter(([, person]) => {
      const haystack = [person.currentName, ...(person.names || [])].map(keyFor);
      return haystack.some((value) => value.includes(aliasKey));
    })
    .map(([key]) => key);
  if (peopleMatches.length === 1) return peopleMatches[0];
  return directKey;
}

function parseProfileFields(rawProfile) {
  const fields = {};
  for (const line of rawProfile.split(/\r?\n/)) {
    const cleaned = line.replace(/^☑/, "").trim();
    const match = cleaned.match(/^([^:：]+)[:：]\s*(.*)$/);
    if (match) fields[match[1].trim()] = match[2].trim();
  }
  return fields;
}

function displayProfile(profile) {
  const lines = [`${profile.name}${profile.alias ? ` (${profile.alias})` : ""}님 프로필`, ""];
  const fields = profile.fields || {};
  const order = ["닉 /성별", "MBTI / 키", "지역 / 기미돌", "매력어필", "썸상", "입방날자", "출퇴여부"];
  for (const key of order) {
    if (fields[key]) lines.push(`☑${key} : ${fields[key]}`);
  }
  const extraKeys = Object.keys(fields).filter((key) => !order.includes(key));
  for (const key of extraKeys) lines.push(`☑${key} : ${fields[key]}`);
  if (lines.length === 2 && profile.raw) lines.push(profile.raw);
  return lines.join("\n");
}

function profileRegisterCommand(roomState, sender, text) {
  const body = text.replace(/^\/프로필\s*등록\s*/i, "/프로필등록 ").replace(/^\/프로필등록\s*/i, "");
  const [targetPart, ...profileParts] = body.split("&&");
  const target = stripKakaoSuffix(targetPart);
  const rawProfile = profileParts.join("&&").trim();
  if (!target || !rawProfile) {
    return "형식: /프로필등록 닉네임 && 프로필내용";
  }

  const key = personKey(target);
  const person = ensurePerson(roomState, target);
  const fields = parseProfileFields(rawProfile);
  const profile = {
    name: target,
    alias: roomState.profiles[key]?.alias || "",
    aliases: roomState.profiles[key]?.aliases || [],
    fields,
    raw: rawProfile,
    updatedAt: nowIso(),
    updatedBy: sender
  };
  roomState.profiles[key] = profile;
  if (profile.alias) roomState.aliases[keyFor(profile.alias)] = key;
  recordRoomEvent(roomState, { type: "profile_registered", name: target, by: sender });
  if (person) person.currentName = target;
  return `${target}님 프로필이 등록되었습니다.`;
}

function profileViewCommand(roomState, text, sender) {
  const query = stripKakaoSuffix(text.replace(/^\/프로필\s*/i, "").replace(/^\/프로칠\s*/i, ""));
  const target = query || sender;
  const key = resolveName(roomState, target);
  const profile = roomState.profiles[key];
  if (!profile) return `"${target}" 닉네임 또는 별명이 존재하지 않습니다.`;
  return displayProfile(profile);
}

function profileDeleteCommand(roomState, text) {
  const target = stripKakaoSuffix(text.replace(/^\/프로필삭제\s*/i, ""));
  if (!target) return "형식: /프로필삭제 닉네임";
  const key = resolveName(roomState, target);
  const profile = roomState.profiles[key];
  if (!profile) return `"${target}" 닉네임 또는 별명이 존재하지 않습니다.`;
  for (const alias of [profile.alias, ...(profile.aliases || [])]) {
    if (alias) delete roomState.aliases[keyFor(alias)];
  }
  delete roomState.profiles[key];
  recordRoomEvent(roomState, { type: "profile_deleted", name: profile.name });
  return `${profile.name}님 프로필이 삭제되었습니다.`;
}

function aliasRegisterCommand(roomState, sender, text) {
  const args = text.replace(/^\/별명등록\s*/i, "").split(/\s+/).filter(Boolean);
  if (args.length < 2) return "형식: /별명등록 닉네임 별명";
  const alias = args.at(-1);
  const target = args.slice(0, -1).join(" ");
  const key = resolveName(roomState, target);
  const displayName = stripKakaoSuffix(target);
  ensurePerson(roomState, displayName);
  const sourceKey = existingPersonKey(roomState, alias);
  const mergeResult = sourceKey && sourceKey !== key
    ? mergePersonData(roomState, key, sourceKey, {
      targetName: displayName,
      sourceName: alias,
      aliases: [alias],
      by: sender,
      source: "alias_register"
    })
    : { merged: false };
  roomState.profiles[key] ||= {
    name: displayName,
    alias: "",
    aliases: [],
    fields: {},
    raw: "",
    updatedAt: nowIso(),
    updatedBy: sender
  };
  const profile = roomState.profiles[key];
  profile.alias ||= alias;
  addUnique(profile.aliases, alias);
  roomState.aliases[keyFor(alias)] = key;
  recordRoomEvent(roomState, { type: "alias_registered", name: profile.name, alias, by: sender });
  return [
    `${profile.name}님의 별명이 ${alias} (으)로 등록되었습니다.`,
    mergeResult.merged ? `데이터 병합: ${mergeResult.sourceName} → ${mergeResult.targetName}` : ""
  ].filter(Boolean).join("\n");
}

function parseNicknameMergeTarget(roomState, text) {
  const body = text.replace(/^\/(?:닉병합|닉네임병합|별명병합)\s*/i, "").trim();
  const tokens = body.split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return null;
  const fallbackCandidates = [];
  for (let index = 1; index < tokens.length; index += 1) {
    const targetName = stripKakaoSuffix(tokens.slice(0, index).join(" "));
    const sourceName = stripKakaoSuffix(tokens.slice(index).join(" "));
    if (!targetName || !sourceName) continue;
    const targetKey = existingPersonKey(roomState, targetName);
    const sourceKey = existingPersonKey(roomState, sourceName);
    if (targetKey && sourceKey && targetKey !== sourceKey) {
      return { targetName, sourceName, targetKey, sourceKey };
    }
    if (!targetKey && sourceKey) fallbackCandidates.push({ targetName, sourceName, sourceKey });
    if (targetKey && sourceKey && targetKey === sourceKey) {
      fallbackCandidates.push({ targetName, sourceName, targetKey, sourceKey, same: true });
    }
  }
  const sameCandidate = fallbackCandidates.find((candidate) => candidate.same);
  if (sameCandidate) return sameCandidate;
  if (fallbackCandidates.length === 1) {
    const candidate = fallbackCandidates[0];
    const person = ensurePerson(roomState, candidate.targetName);
    return {
      ...candidate,
      targetKey: personKey(person?.currentName || candidate.targetName)
    };
  }
  return null;
}

function nicknameMergeCommand(roomState, sender, text) {
  const parsed = parseNicknameMergeTarget(roomState, text);
  if (!parsed) {
    return [
      "형식: /닉병합 기준닉 합칠닉",
      "예: /닉병합 오리 95 오리",
      "띄어쓰기 닉네임은 기존 데이터 기준으로 자동 판정합니다."
    ].join("\n");
  }
  if (parsed.same || parsed.targetKey === parsed.sourceKey) {
    return "이미 같은 닉네임 데이터로 연결되어 있습니다.";
  }
  const result = mergePersonData(roomState, parsed.targetKey, parsed.sourceKey, {
    targetName: parsed.targetName,
    sourceName: parsed.sourceName,
    aliases: [parsed.sourceName],
    by: sender,
    source: "manual_nickname_merge"
  });
  if (!result.ok) return "병합할 닉네임 데이터를 찾지 못했습니다. /닉이력 으로 대상 닉네임을 먼저 확인해 주세요.";
  return [
    "닉네임 병합 완료",
    `기준 : ${result.targetName}`,
    `합친 닉 : ${result.sourceName}`,
    `보유 포인트 : ${formatPoint(result.points)}`,
    "",
    "일반방/게임방에서 닉네임이 달라도 합친 닉은 같은 사람 데이터로 조회됩니다."
  ].join("\n");
}

function aliasDeleteCommand(roomState, text) {
  const alias = stripKakaoSuffix(text.replace(/^\/별명삭제\s*/i, ""));
  if (!alias) return "형식: /별명삭제 별명";
  const key = roomState.aliases[keyFor(alias)] || resolveName(roomState, alias);
  const profile = roomState.profiles[key];
  if (!profile) return `"${alias}" 별명이 존재하지 않습니다.`;
  profile.aliases = (profile.aliases || []).filter((value) => keyFor(value) !== keyFor(alias));
  if (keyFor(profile.alias) === keyFor(alias)) profile.alias = profile.aliases[0] || "";
  delete roomState.aliases[keyFor(alias)];
  recordRoomEvent(roomState, { type: "alias_deleted", name: profile.name, alias });
  return "별명이 삭제되었습니다.";
}

function adminRegisterCommand(roomState, sender, text) {
  const target = stripKakaoSuffix(text.replace(/^\/관리자등록\s*/i, ""));
  if (!target) return "형식: /관리자등록 닉네임";
  const denied = requireAdmin(roomState, sender);
  if (denied) return denied;

  ensurePerson(roomState, target);
  addUnique(roomState.admins, target);
  recordRoomEvent(roomState, { type: "admin_registered", name: target, by: sender });
  return `${target}님이 관리자로 등록되었습니다.`;
}

function adminDeleteCommand(roomState, sender, text) {
  const denied = requireAdmin(roomState, sender);
  if (denied) return denied;

  const target = stripKakaoSuffix(text.replace(/^\/관리자삭제\s*/i, ""));
  if (!target) return "형식: /관리자삭제 닉네임";
  const targetKey = personKey(target);
  const before = roomState.admins.length;
  roomState.admins = roomState.admins.filter((name) => personKey(name) !== targetKey);
  if (roomState.admins.length === before) return `${target}님은 등록된 관리자가 아닙니다.`;
  recordRoomEvent(roomState, { type: "admin_deleted", name: target, by: sender });
  return `${target}님이 관리자 목록에서 삭제되었습니다.`;
}

function parseAdminNames(value) {
  const names = value
    .split(/[,\n]/)
    .map((name) => stripKakaoSuffix(name))
    .filter(Boolean);
  return names.filter((name, index, list) => list.findIndex((value) => personKey(value) === personKey(name)) === index);
}

function adminResetCommand(roomState, sender, text) {
  const denied = requireAdmin(roomState, sender);
  if (denied) return denied;

  const isClearCommand = /^\/관리자초기화(?:\s|$)/i.test(text);
  const body = text.replace(/^\/(?:관리자초기화|관리자재설정)\s*/i, "");
  const names = parseAdminNames(body);

  if (!names.length && isClearCommand) {
    roomState.admins = [];
    recordRoomEvent(roomState, { type: "admin_reset", names: [], by: sender });
    const rootAdmins = configuredAdmins();
    return [
      "방 관리자 목록이 초기화되었습니다.",
      "환경변수 ADMIN_NAMES 관리자는 계속 유지됩니다.",
      rootAdmins.length ? ["", "현재 환경변수 관리자", ...rootAdmins.map((name) => `• ${name}`)].join("\n") : ""
    ].filter(Boolean).join("\n");
  }

  if (!names.length) return "형식: /관리자재설정 닉네임1,닉네임2";

  for (const name of names) ensurePerson(roomState, name);
  roomState.admins = names;
  recordRoomEvent(roomState, { type: "admin_reset", names, by: sender });
  return ["관리자 목록이 재설정되었습니다.", ...names.map((name) => `• ${name}`)].join("\n");
}

function adminListCommand(roomState) {
  const names = [...configuredAdmins(), ...(roomState.admins || [])]
    .filter(Boolean)
    .filter((name, index, list) => list.findIndex((value) => personKey(value) === personKey(name)) === index);
  if (!names.length) return "등록된 관리자가 없습니다.\n/관리자등록 닉네임 으로 초기 관리자를 등록해주세요.";
  return ["관리자 목록", ...names.map((name) => `• ${name}`)].join("\n");
}

function roomRegistrationCommand(text) {
  return /^\/(?:방등록|방설정|입장문구|방정보|방목록|방삭제|구독상태|구독연장|구독만료|기능|기능목록|기능켜기|기능끄기|기능설정)(?:\s|$)/i.test(normalizeText(text));
}

function subscriptionSettings(roomState) {
  roomState.settings ||= {};
  roomState.settings.subscription ||= {};
  const subscription = roomState.settings.subscription;
  subscription.monthlyPriceKrw = Number(subscription.monthlyPriceKrw || MONTHLY_PRICE_KRW);
  return subscription;
}

function updateSubscriptionStatus(roomState) {
  const subscription = subscriptionSettings(roomState);
  if (!subscription.expiresAt) {
    subscription.status = "unset";
    subscription.remainingDays = null;
    subscription.statusLabel = "미설정";
    subscription.notice = "관리 콘솔에서 구독 만료일을 설정해 주세요.";
    return subscription;
  }
  subscription.status = subscription.expiresAt ? (isSubscriptionExpired(roomState) ? "expired" : "active") : "unset";
  subscription.remainingDays = remainingDays(subscription.expiresAt);
  subscription.statusLabel = subscriptionStatusLabel(subscription.status, subscription.remainingDays);
  subscription.notice = subscriptionNoticeText(subscription.status, subscription.remainingDays);
  return subscription;
}

function isSubscriptionExpired(roomState) {
  const subscription = subscriptionSettings(roomState);
  if (!subscription.expiresAt) return false;
  const expiresAt = new Date(subscription.expiresAt).getTime();
  return Number.isFinite(expiresAt) && expiresAt <= Date.now();
}

function subscriptionBypassCommand(text) {
  return /^\/(?:구독상태|구독연장|구독만료|방정보|방등록|방설정|입장문구|방목록|기능|기능목록|기능켜기|기능끄기|도움말|help|\?|메뉴|처음|시작|추천|찾기|명령어)(?:\s|$)/i.test(normalizeText(text));
}

function subscriptionStatusLabel(status, days) {
  if (status === "expired") return "만료";
  if (status === "unset") return "미설정";
  if (days === 0) return "오늘 만료";
  if ([7, 3, 1].includes(days)) return `만료 임박 ${days}일`;
  return "정상";
}

function subscriptionNoticeText(status, days) {
  if (status === "expired") return incidentMessage("SUBSCRIPTION_EXPIRED").message;
  if (status === "unset") return "관리 콘솔에서 구독 만료일을 설정해야 합니다.";
  if (days === 0) return "오늘 구독이 만료됩니다. 운영자에게 연장을 요청해 주세요.";
  if ([7, 3, 1].includes(days)) return `구독 만료 ${days}일 전입니다. 운영자에게 연장을 요청해 주세요.`;
  return "구독이 정상 상태입니다.";
}

function subscriptionExpiredText(roomState) {
  updateSubscriptionStatus(roomState);
  const issue = incidentMessage("SUBSCRIPTION_EXPIRED");
  return [
    issue.title,
    issue.message
  ].join("\n");
}

function subscriptionLines(roomState) {
  const subscription = updateSubscriptionStatus(roomState);
  const days = subscription.remainingDays;
  return [
    "구독 상태",
    "",
    `상태: ${subscription.statusLabel}`,
    `이용기간 만료: ${formatSubscriptionDate(subscription.expiresAt)}`,
    days === null ? "남은 기간: 미설정" : days < 0 ? "남은 기간: 만료됨" : `남은 기간: ${days}일`,
    `안내: ${subscription.notice}`,
    "상세 운영 정보는 관리 콘솔에서 확인하세요."
  ];
}

function subscriptionStatusCommand(roomState) {
  return subscriptionLines(roomState).join("\n");
}

function subscriptionReminder(roomState, sender, text) {
  if (!isAdmin(roomState, sender)) return "";
  if (/^\/(?:구독상태|구독연장|구독만료)(?:\s|$)/i.test(normalizeText(text))) return "";
  const subscription = updateSubscriptionStatus(roomState);
  const days = remainingDays(subscription.expiresAt);
  if (![7, 3, 1, 0].includes(days)) return "";
  subscription.reminders ||= {};
  const key = `${kstDateKey()}:${days}`;
  if (subscription.reminders[key]) return "";
  subscription.reminders[key] = nowIso();
  recordRoomEvent(roomState, { type: "subscription_reminder", days, by: "system" });
  const label = days === 0 ? "오늘 만료" : `${days}일 후 만료`;
  return [
    "구독 만료 알림",
    `${roomState.name || "현재방"} 이용기간이 ${label}됩니다.`,
    `만료일: ${formatSubscriptionDate(subscription.expiresAt)}`,
    "필요 시 /구독연장 1 을 실행하세요."
  ].join("\n");
}

function appendOperationalNotice(roomState, sender, text, reply) {
  if (!reply) return reply;
  const reminder = subscriptionReminder(roomState, sender, text);
  return reminder ? `${reminder}\n\n${reply}` : reply;
}

function licenseSettings(roomState) {
  roomState.settings ||= {};
  roomState.settings.license ||= {};
  roomState.settings.license.key = normalizeLicenseKey(roomState.settings.license.key || roomState.settings.licenseKey || "");
  delete roomState.settings.licenseKey;
  return roomState.settings.license;
}

function applyLicenseFromPayload(roomState, payload = {}) {
  const license = licenseSettings(roomState);
  const incoming = normalizeLicenseKey(payload.licenseKey || payload.roomLicenseKey || payload.bridgeLicenseKey);
  license.key = incoming || license.key || generateLicenseKey(roomState);
  license.status = "active";
  license.updatedAt = nowIso();
  return license;
}

function licenseGuardResult(roomState, payload = {}, message = "", registrationCommand = false) {
  if (registrationCommand) return null;
  const license = licenseSettings(roomState);
  if (!license.key) return null;
  const incoming = normalizeLicenseKey(payload.licenseKey || payload.roomLicenseKey || payload.bridgeLicenseKey);
  if (incoming && incoming === license.key) return null;
  const isCommand = parseBotCommand(message).isCommandAttempt;
  const guidance = incoming
    ? "브릿지 앱 연결값이 이 방과 일치하지 않습니다."
    : "브릿지 앱 연결값이 비어 있습니다.";
  return {
    ok: true,
    reply: isCommand ? [
      "픽셀곰 연결 확인이 필요합니다.",
      guidance,
      "구매자 콘솔에서 연결코드를 다시 적용해 주세요."
    ].join("\n") : null,
    ignored: true,
    reason: incoming ? "invalid_license" : "missing_license"
  };
}

function shouldRunLicenseGuard(roomState, message = "", registrationCommand = false) {
  if (registrationCommand) return true;
  const parsed = parseBotCommand(message);
  if (!parsed.isCommandAttempt) return true;
  if (registryItemForCommandName(parsed.command)) return true;
  return Boolean(customCommandMatch(roomState, compactSpaces(message)));
}

function subscriptionExtendCommand(roomState, sender, text) {
  const denied = requireAdmin(roomState, sender);
  if (denied) return denied;
  const rawMonths = Number(normalizeText(text.replace(/^\/구독연장\s*/i, "")) || 1);
  const months = Math.min(24, Math.max(1, Number.isFinite(rawMonths) ? Math.floor(rawMonths) : 1));
  const subscription = subscriptionSettings(roomState);
  const currentExpires = new Date(subscription.expiresAt || 0);
  const base = Number.isFinite(currentExpires.getTime()) && currentExpires.getTime() > Date.now()
    ? currentExpires
    : new Date();
  subscription.startedAt ||= nowIso();
  subscription.expiresAt = addDaysIso(base, months * DEFAULT_SUBSCRIPTION_DAYS);
  subscription.status = "active";
  subscription.monthlyPriceKrw = MONTHLY_PRICE_KRW;
  recordRoomEvent(roomState, { type: "subscription_extended", by: sender, months, expiresAt: subscription.expiresAt });
  return [
    `구독이 연장되었습니다. (${months}개월)`,
    "",
    ...subscriptionLines(roomState)
  ].join("\n");
}

function subscriptionExpireCommand(roomState, sender, text) {
  const denied = requireAdmin(roomState, sender);
  if (denied) return denied;
  const value = normalizeText(text.replace(/^\/구독만료\s*/i, ""));
  const expiresAt = parseSubscriptionDate(value);
  if (!expiresAt) return "형식: /구독만료 2026-06-30";
  const subscription = subscriptionSettings(roomState);
  subscription.startedAt ||= nowIso();
  subscription.expiresAt = expiresAt;
  subscription.status = subscription.expiresAt ? (isSubscriptionExpired(roomState) ? "expired" : "active") : "unset";
  subscription.monthlyPriceKrw = MONTHLY_PRICE_KRW;
  recordRoomEvent(roomState, { type: "subscription_expiry_set", by: sender, expiresAt });
  return [
    "구독 만료일이 설정되었습니다.",
    "",
    ...subscriptionLines(roomState)
  ].join("\n");
}

function applySubscriptionFromPayload(roomState, payload = {}) {
  const subscription = subscriptionSettings(roomState);
  const payloadPrice = Number(payload.monthlyPriceKrw || payload.monthlyPrice || payload.priceKrw || 0);
  subscription.monthlyPriceKrw = payloadPrice > 0 ? payloadPrice : MONTHLY_PRICE_KRW;
  subscription.startedAt ||= parseSubscriptionDate(payload.subscriptionStartedAt || payload.subscriptionStartAt) || nowIso();
  const payloadExpiry = parseSubscriptionDate(payload.subscriptionExpiresAt || payload.subscriptionExpireAt || payload.subscriptionEndAt);
  subscription.expiresAt = payloadExpiry || subscription.expiresAt || addDaysIso(new Date(), DEFAULT_SUBSCRIPTION_DAYS);
  subscription.status = isSubscriptionExpired(roomState) ? "expired" : "active";
  return subscription;
}

function payloadAdminNames(payload = {}) {
  const value = Array.isArray(payload.roomAdmins)
    ? payload.roomAdmins.join(",")
    : payload.roomAdmins || payload.admins || payload.adminNames || "";
  return parseAdminNames(value);
}

function roomSettingsLines(roomState) {
  const settings = roomState.settings || {};
  const subscription = updateSubscriptionStatus(roomState);
  const features = roomFeatures(roomState);
  const featureEntries = Object.entries(FEATURE_LABELS);
  const enabledCount = featureEntries.filter(([key]) => features[key]).length;
  const focusFeatureText = ["attendance", "games", "shop", "customCommands"]
    .map((key) => `${featureLabel(key)} ${features[key] ? "켜짐" : "꺼짐"}`)
    .join(" · ");
  return [
    `${roomState.name || "현재방"} 방 설정`,
    `등록: ${settings.registered ? "켜짐" : "꺼짐"} · 구독: ${subscription.status === "expired" ? "만료" : subscription.status === "active" ? "정상" : "미설정"}`,
    `입장확인 문구: ${settings.joinPhrase || DEFAULT_JOIN_PHRASE}`,
    `관리자: ${(roomState.admins || []).length ? `${roomState.admins.length}명 등록` : "미등록"}`,
    `기능: ${enabledCount}/${featureEntries.length} 켜짐`,
    `주요 기능: ${focusFeatureText}`,
    "상세 운영 정보는 관리 콘솔에서만 확인합니다."
  ];
}

function roomInfoCommand(roomState) {
  return roomSettingsLines(roomState).join("\n");
}

function roomListCommand(state) {
  const rooms = Object.values(state.rooms || {})
    .filter((roomState) => roomState?.settings?.registered && roomState.settings.enabled !== false)
    .sort((left, right) => keyFor(left.name).localeCompare(keyFor(right.name)));
  if (!rooms.length) return "등록된 방이 없습니다.\n현재 방에서 /방등록 입장확인문구 를 실행하세요.";
  const lines = ["등록 방 목록"];
  rooms.forEach((roomState, index) => {
    lines.push(
      `${index + 1}. ${roomState.name || "이름없음"}`,
      `   입장문구: ${roomState.settings?.joinPhrase || DEFAULT_JOIN_PHRASE}`,
      `   상태: ${roomState.settings?.enabled === false ? "비활성" : "활성"}`
    );
  });
  lines.push("", "상세 운영 정보는 관리 콘솔에서만 확인합니다.");
  return lines.join("\n");
}

function roomRegisterCommand(roomState, sender, text, payload = {}) {
  const denied = hasAnyAdmin(roomState) ? requireAdmin(roomState, sender) : null;
  if (denied) return denied;

  const body = normalizeText(text.replace(/^\/방등록\s*/i, ""));
  const linkMatch = body.match(/https?:\/\/open\.kakao\.com\/o\/[A-Za-z0-9_-]+/i);
  const payloadPhrase = normalizeText(payload.joinPhrase || payload.roomJoinPhrase || "");
  const phrase = payloadPhrase
    || normalizeText(body.replace(/https?:\/\/open\.kakao\.com\/o\/[A-Za-z0-9_-]+/ig, ""))
    || roomState.settings.joinPhrase
    || DEFAULT_JOIN_PHRASE;
  const ids = [
    payloadRoomId(payload),
    openChatRoomId(linkMatch?.[0] || ""),
    openChatRoomId(payload.roomLink || payload.openChatLink || payload.link || "")
  ].filter(Boolean);
  const links = [
    normalizeText(linkMatch?.[0] || ""),
    normalizeText(payload.roomLink || payload.openChatLink || payload.link || "")
  ].filter(Boolean);

  roomState.settings.registered = true;
  roomState.settings.enabled = true;
  roomState.settings.joinPhrase = phrase;
  roomState.settings.registeredAt ||= nowIso();
  roomState.settings.registeredBy ||= sender;
  for (const id of ids) addUnique(roomState.settings.roomIds, id);
  for (const link of links) addUnique(roomState.settings.roomLinks, link);
  for (const adminName of payloadAdminNames(payload)) addUnique(roomState.admins, adminName);
  if (!hasAnyAdmin(roomState)) addUnique(roomState.admins, sender);
  applyLicenseFromPayload(roomState, payload);
  applySubscriptionFromPayload(roomState, payload);
  applyFeatureSettingsFromPayload(roomState, payload);
  recordRoomEvent(roomState, { type: "room_registered", by: sender, joinPhrase: phrase });

  return [
    "방 등록 완료",
    "",
    ...roomSettingsLines(roomState),
    "",
    "방장봇 환영문구를 위 입장확인 문구와 같게 설정하세요."
  ].join("\n");
}

function roomJoinPhraseCommand(roomState, sender, text) {
  const denied = requireAdmin(roomState, sender);
  if (denied) return denied;
  const phrase = normalizeText(text.replace(/^\/(?:방설정|입장문구)\s*/i, ""));
  if (!phrase) return "형식: /입장문구 픽셀곰 입장확인";
  roomState.settings.joinPhrase = phrase;
  roomState.settings.registered = true;
  recordRoomEvent(roomState, { type: "room_join_phrase_updated", by: sender, joinPhrase: phrase });
  return [`입장확인 문구가 변경되었습니다.`, `문구: ${phrase}`].join("\n");
}

function roomDeleteCommand(roomState, sender) {
  const denied = requireAdmin(roomState, sender);
  if (denied) return denied;
  roomState.settings.registered = false;
  roomState.settings.enabled = false;
  recordRoomEvent(roomState, { type: "room_unregistered", by: sender });
  return `${roomState.name || "현재방"} 등록을 해제했습니다.`;
}

function collectIdentityIdsForName(roomState, key, target, requestIdentity = {}) {
  const person = roomState.people?.[key] || null;
  const nameKeys = new Set(uniqueNames([target, person?.currentName, ...(person?.names || [])]).map(keyFor));
  const ids = new Set([
    ...(person?.identities || []),
    ...Object.entries(roomState.peopleByIdentity || {})
      .filter(([, mappedKey]) => mappedKey === key)
      .map(([id]) => id),
    ...identityIds(requestIdentity)
  ].map(normalizeIdentityId).filter(Boolean));

  for (const event of roomState.rawEvents || []) {
    const eventNameKeys = uniqueNames([event.sender, event.eventName]).map(keyFor);
    if (eventNameKeys.some((nameKey) => nameKeys.has(nameKey))) {
      for (const id of identityIds(event.identity || {})) ids.add(id);
    }
  }

  return [...ids].filter(Boolean);
}

function resetIdentityNickHistory(person) {
  if (!person) return { removedNames: 0, removedNickChanges: 0 };
  const previousNameCount = person.names?.length || 0;
  const previousChangeCount = person.nickChanges?.length || 0;
  person.nickChanges = (person.nickChanges || []).filter((event) => event.source !== "identity");
  person.names = uniqueNames([
    person.currentName,
    ...person.nickChanges.flatMap((event) => [event.from, event.to])
  ]);
  person.firstChatReentryNotices = [];
  return {
    removedNames: Math.max(0, previousNameCount - person.names.length),
    removedNickChanges: Math.max(0, previousChangeCount - person.nickChanges.length)
  };
}

function identityResetCommand(roomState, sender, text, identity = {}) {
  const denied = requireAdmin(roomState, sender);
  if (denied) return denied;

  const target = stripKakaoSuffix(text.replace(/^\/고유값초기화\s*/i, "")) || stripKakaoSuffix(sender);
  if (!target) return "형식: /고유값초기화 닉네임";

  const key = existingPersonKey(roomState, target) || personKey(target);
  const person = roomState.people?.[key] || null;
  const targetIsSender = personKey(target) === personKey(sender) || key === personKey(sender);
  const ids = collectIdentityIdsForName(roomState, key, target, targetIsSender ? identity : {});
  const history = resetIdentityNickHistory(person);

  for (const id of ids) markAmbiguousIdentity(roomState, id);

  recordRoomEvent(roomState, {
    type: "identity_reset",
    name: person?.currentName || target,
    ids: ids.length,
    by: sender
  });

  if (!person && !ids.length) return `"${target}" 고유값 기록을 찾을 수 없습니다.`;

  return [
    "고유값 초기화 완료",
    "",
    `대상 : ${person?.currentName || target}`,
    `차단 고유값 : ${ids.length}개`,
    `자동 닉변 기록 정리 : ${history.removedNickChanges}건`,
    "",
    "이후 해당 고유값은 닉네임 변경 안내에 사용하지 않습니다."
  ].join("\n");
}

function recentEventsCommand(state, roomState, sender, text) {
  const count = Math.min(20, Math.max(1, Number(text.match(/\d+/)?.[0] || 10)));
  const roomEvents = roomState.rawEvents || [];
  const requestEvent = roomEvents.at(-1) || null;
  const requestIdentity = requestEvent?.identity || {};
  const requestIds = identityIds(requestIdentity);
  const requestCurrentNames = new Map(
    requestIds
      .map((id) => [id, currentIdentityName(requestIdentity, requestEvent, id)])
      .filter(([, name]) => Boolean(name))
  );
  const identityEvents = requestIds.length ? identityRawEvents(state, roomState, requestIds) : [];
  const events = (identityEvents.length ? identityEvents : roomEvents).slice(-count);
  const isIdentityScoped = identityEvents.length > 0;
  if (!events.length) return "최근 원본 이벤트가 없습니다.";

  const lines = [`최근 원본 이벤트 ${events.length}건${isIdentityScoped ? " (같은 고유값 기준)" : ""}`, ""];
  events.forEach((event, index) => {
    const identity = event.identity || {};
    const candidateText = (identity.candidates || [])
      .slice(0, 3)
      .map((item) => `${item.path}=${item.value}`)
      .join(" / ");
    lines.push(`${index + 1}. ${kstDateTime(new Date(event.at))}`);
    if (isIdentityScoped) lines.push(`• room : ${event.room || "-"}`);
    lines.push(`• sender : ${event.sender || "-"}`);
    lines.push(`• msg : ${previewText(event.message) || "-"}`);
    lines.push(`• event : ${event.eventType || "-"}`);
    lines.push(`• senderId : ${identity.senderId || "없음"}`);
    lines.push(`• targetUserId : ${identity.targetUserId || "없음"}`);
    const memberText = identityMemberSummary(state, roomState, identity, event, requestCurrentNames);
    if (memberText) lines.push(`• 회원이력 : ${memberText}`);
    if (candidateText) lines.push(`• id 후보 : ${candidateText}`);
    lines.push("");
  });
  lines.push("원본 JSON 확인은 관리자 전용 /원본로그 를 사용하세요.");
  return lines.join("\n").trim();
}

function identityIds(identity = {}) {
  return [identity.senderId, identity.targetUserId, ...(identity.candidates || []).map((item) => item.value)]
    .map(normalizeIdentityId)
    .filter(Boolean)
    .filter((id, index, list) => list.indexOf(id) === index);
}

function allRoomStates(state, currentRoomState) {
  const rooms = Object.values(state?.rooms || {}).filter(Boolean);
  if (!currentRoomState || rooms.includes(currentRoomState)) return rooms;
  return [currentRoomState, ...rooms];
}

function identityRawEvents(state, currentRoomState, ids) {
  const targetIds = new Set((ids || []).map(normalizeIdentityId).filter(Boolean));
  if (!targetIds.size) return [];
  const events = [];
  for (const roomState of allRoomStates(state, currentRoomState)) {
    for (const event of roomState.rawEvents || []) {
      const candidateIds = identityIds(event.identity || {});
      if (candidateIds.some((id) => targetIds.has(id))) events.push(event);
    }
  }
  return events.sort((left, right) => new Date(left.at).getTime() - new Date(right.at).getTime());
}

function identityPeopleFromRooms(state, currentRoomState, identityId) {
  const id = normalizeIdentityId(identityId);
  if (!id) return [];
  const people = [];
  const seen = new Set();
  for (const roomState of allRoomStates(state, currentRoomState)) {
    const key = identityPersonKey(roomState, id);
    const person = key ? roomState.people?.[key] : null;
    if (!person || seen.has(person)) continue;
    seen.add(person);
    people.push(person);
  }
  return people;
}

function uniqueNames(names) {
  return names
    .map(stripKakaoSuffix)
    .filter(Boolean)
    .filter((name, index, list) => list.findIndex((value) => keyFor(value) === keyFor(name)) === index);
}

function currentIdentityName(identity, event, identityId) {
  const id = normalizeIdentityId(identityId);
  if (!id) return "";
  if (normalizeIdentityId(identity.senderId) === id && event?.sender) return stripKakaoSuffix(event.sender);
  if (normalizeIdentityId(identity.targetUserId) === id && event?.eventName) return stripKakaoSuffix(event.eventName);
  return "";
}

function identityMemberSummary(state, roomState, identity = {}, event = {}, currentNames = new Map()) {
  const ids = identityIds(identity);
  for (const id of ids) {
    const people = identityPeopleFromRooms(state, roomState, id);
    const rawNames = identityNamesFromRawEvents(state, roomState, id);
    if (!people.length && !rawNames.length) continue;
    const names = uniqueNames([...people.flatMap((person) => person.names || []), ...people.map((person) => person.currentName), ...rawNames]);
    const current = currentNames.get(id) || currentIdentityName(identity, event, id) || people[0]?.currentName || rawNames.at(-1) || names.at(-1) || "";
    const previous = names.filter((name) => keyFor(name) !== keyFor(current));
    if (previous.length) return `${current} (이전닉: ${previous.join(", ")})`;
    return current;
  }
  return "";
}

function identityNamesFromRawEvents(state, currentRoomState, identityId) {
  const targetId = normalizeIdentityId(identityId);
  if (!targetId) return [];
  const names = [];
  for (const roomState of allRoomStates(state, currentRoomState)) {
    for (const event of roomState.rawEvents || []) {
      const identity = event.identity || {};
      const candidateIds = identityIds(identity);
      if (!candidateIds.includes(targetId)) continue;
      if (normalizeIdentityId(identity.senderId) === targetId && event.sender) names.push(stripKakaoSuffix(event.sender));
      if (normalizeIdentityId(identity.targetUserId) === targetId && event.eventName) names.push(stripKakaoSuffix(event.eventName));
    }
  }
  return uniqueNames(names);
}

function rawLogCommand(roomState, sender, text) {
  const denied = requireAdmin(roomState, sender);
  if (denied) return denied;

  const events = roomState.rawEvents || [];
  if (!events.length) return "최근 원본 이벤트가 없습니다.";
  const indexFromLatest = Math.min(events.length, Math.max(1, Number(text.match(/\d+/)?.[0] || 1)));
  const event = events.at(-indexFromLatest);
  const json = JSON.stringify(event.payload, null, 2);
  const clipped = json.length > 1700 ? `${json.slice(0, 1700)}\n...생략` : json;
  return [
    `원본 이벤트 로그 (${indexFromLatest}번째 최신)`,
    "",
    `수신시각 : ${kstDateTime(new Date(event.at))}`,
    `sender : ${event.sender || "-"}`,
    `msg : ${previewText(event.message) || "-"}`,
    "",
    clipped
  ].join("\n");
}

function messageId(roomState, targetKey) {
  const count = (roomState.inbox?.[targetKey]?.length || 0) + 1;
  return `${targetKey}-${Date.now().toString(36)}-${count}`;
}

function candidateMentionNames(roomState) {
  const candidates = [];
  for (const [key, person] of Object.entries(roomState.people || {})) {
    for (const name of [person.currentName, ...(person.names || [])]) {
      if (name) candidates.push({ key, name });
    }
  }
  for (const [key, profile] of Object.entries(roomState.profiles || {})) {
    for (const name of [profile.name, profile.alias, ...(profile.aliases || [])]) {
      if (name) candidates.push({ key, name });
    }
  }
  return candidates
    .filter((candidate, index, list) => {
      return list.findIndex((value) => value.key === candidate.key && keyFor(value.name) === keyFor(candidate.name)) === index;
    })
    .sort((a, b) => keyFor(b.name).length - keyFor(a.name).length);
}

function resolveMentionTarget(roomState, rawMention) {
  const mention = compactSpaces(rawMention).replace(/^[\s@]+|[\s,.!?~ㅋㅎㅠㅜ]+$/g, "");
  if (!mention || keyFor(mention) === "all") return "";

  const direct = resolveName(roomState, mention);
  if (roomState.people[direct] || roomState.profiles[direct]) return direct;

  const mentionKey = keyFor(mention);
  for (const candidate of candidateMentionNames(roomState)) {
    const candidateKey = keyFor(candidate.name);
    if (mentionKey === candidateKey || mentionKey.startsWith(`${candidateKey} `)) return candidate.key;
  }

  const words = mention.split(/\s+/);
  for (const size of [2, 1]) {
    const sliced = words.slice(0, size).join(" ");
    if (!sliced) continue;
    const key = resolveName(roomState, sliced);
    if (roomState.people[key] || roomState.profiles[key]) return key;
  }
  return "";
}

function mentionedTargetKeys(roomState, message, sender) {
  const senderKey = personKey(sender);
  const keys = [];
  for (const match of message.matchAll(/@([^@\r\n]+)/g)) {
    const key = resolveMentionTarget(roomState, match[1]);
    if (key && key !== senderKey && !keys.includes(key)) keys.push(key);
  }
  return keys;
}

function recordMentionMessages(roomState, sender, message) {
  if (!message.includes("@")) return [];
  const targetKeys = mentionedTargetKeys(roomState, message, sender);
  if (!targetKeys.length) return [];

  const at = nowIso();
  for (const key of targetKeys) {
    roomState.inbox[key] ||= [];
    roomState.inbox[key].push({
      id: messageId(roomState, key),
      from: stripKakaoSuffix(sender),
      content: message,
      at,
      readAt: null
    });
    if (roomState.inbox[key].length > 100) roomState.inbox[key] = roomState.inbox[key].slice(-100);
  }
  recordRoomEvent(roomState, { type: "message_stored", from: sender, targets: targetKeys.map((key) => displayNameForKey(roomState, key)) });
  return targetKeys;
}

function pushInboxMessage(roomState, targetName, from, content) {
  const key = resolveName(roomState, targetName);
  if (!key) return "";
  roomState.inbox ||= {};
  roomState.inbox[key] ||= [];
  roomState.inbox[key].push({
    id: messageId(roomState, key),
    from: stripKakaoSuffix(from),
    content: previewText(content, 900),
    at: nowIso(),
    readAt: null
  });
  if (roomState.inbox[key].length > 100) roomState.inbox[key] = roomState.inbox[key].slice(-100);
  return key;
}

function reportAdminNames(roomState) {
  const names = [...configuredAdmins(), ...(roomState.admins || [])]
    .map(stripKakaoSuffix)
    .filter(Boolean);
  return names.filter((name, index, list) => list.findIndex((value) => personKey(value) === personKey(name)) === index);
}

function nextReportId(roomState) {
  const next = nextReportNumber(roomState);
  roomState.reportNextId = next + 1;
  return `R${String(next).padStart(4, "0")}`;
}

function parseReportInput(parsed) {
  const body = compactSpaces((parsed?.args || []).join(" "));
  if (!body) return { target: "", reason: "" };
  const parts = body.split(/\s+/);
  if (parts.length >= 2 && parts[0].length <= 24) {
    return { target: stripKakaoSuffix(parts[0]), reason: previewText(parts.slice(1).join(" "), 260) };
  }
  return { target: "", reason: previewText(body, 260) };
}

function reportUsageText() {
  return [
    "사용법: /신고 닉네임 사유",
    "대상이 명확하지 않으면 /신고 사유 로 접수할 수 있습니다."
  ].join("\n");
}

function reportCreateCommand(roomState, sender, parsed) {
  const input = parseReportInput(parsed);
  if (!input.reason) return reportUsageText();

  roomState.reports = normalizeReports(roomState.reports || []);
  const report = {
    id: nextReportId(roomState),
    status: "open",
    reporter: stripKakaoSuffix(sender),
    reporterKey: resolveName(roomState, sender),
    target: input.target,
    reason: input.reason,
    createdAt: nowIso(),
    resolvedAt: "",
    resolvedBy: "",
    resolution: ""
  };
  roomState.reports.push(report);
  if (roomState.reports.length > 200) roomState.reports = roomState.reports.slice(-200);

  const adminNames = reportAdminNames(roomState);
  const message = [
    `신고가 접수되었습니다. (${report.id})`,
    `신고자: ${report.reporter || "-"}`,
    `대상: ${report.target || "미지정"}`,
    `내용: ${report.reason}`,
    "",
    `/신고목록 으로 확인하고 /신고처리 ${report.id} 처리내용 으로 완료 처리할 수 있습니다.`
  ].join("\n");
  const deliveredKeys = adminNames.map((adminName) => pushInboxMessage(roomState, adminName, "픽셀곰 신고함", message)).filter(Boolean);
  recordRoomEvent(roomState, { type: "report_created", reportId: report.id, reporter: report.reporter, target: report.target, deliveredAdmins: deliveredKeys.length });

  return [
    "신고가 접수되었습니다.",
    `신고번호: ${report.id}`,
    deliveredKeys.length
      ? "방 관리자 메시지함으로 전달했습니다."
      : "등록된 방 관리자가 없어 신고 기록만 저장했습니다."
  ].join("\n");
}

function reportListCommand(roomState, parsed) {
  roomState.reports = normalizeReports(roomState.reports || []);
  const showAll = (parsed?.args || []).some((arg) => /^(전체|all)$/i.test(arg));
  const reports = (showAll ? roomState.reports : roomState.reports.filter((report) => report.status !== "resolved")).slice(-10).reverse();
  if (!reports.length) return showAll ? "신고 기록이 없습니다." : "대기 중인 신고가 없습니다.";

  const lines = [showAll ? "신고 목록" : "대기 중인 신고 목록", ""];
  reports.forEach((report, index) => {
    lines.push(`${index + 1}. ${report.id} · ${report.status === "resolved" ? "처리완료" : "대기"}`);
    lines.push(`신고자: ${report.reporter || "-"} / 대상: ${report.target || "미지정"}`);
    lines.push(`내용: ${previewText(report.reason, 90)}`);
    if (report.status === "resolved") lines.push(`처리: ${report.resolution || "-"} (${report.resolvedBy || "-"})`);
    if (index < reports.length - 1) lines.push("");
  });
  return lines.join("\n");
}

function reportResolveCommand(roomState, sender, parsed) {
  const [rawId, ...resolutionParts] = parsed?.args || [];
  const id = normalizeReportId(rawId || "");
  if (!id) return "사용법: /신고처리 R0001 처리내용";

  roomState.reports = normalizeReports(roomState.reports || []);
  const report = roomState.reports.find((item) => item.id === id);
  if (!report) return "해당 신고번호를 찾을 수 없습니다.";
  if (report.status === "resolved") return `${report.id} 신고는 이미 처리 완료 상태입니다.`;

  report.status = "resolved";
  report.resolvedAt = nowIso();
  report.resolvedBy = stripKakaoSuffix(sender);
  report.resolution = previewText(resolutionParts.join(" ") || "처리 완료", 180);
  recordRoomEvent(roomState, { type: "report_resolved", reportId: report.id, by: sender });
  return [
    "신고 처리가 완료되었습니다.",
    `신고번호: ${report.id}`,
    `처리내용: ${report.resolution}`
  ].join("\n");
}

function unreadMessages(roomState, sender) {
  const key = resolveName(roomState, sender);
  return (roomState.inbox?.[key] || []).filter((message) => !message.readAt);
}

function unreadNoticeStateHash(messages = []) {
  const latest = messages.at(-1) || {};
  return `${messages.length}:${latest.id || latest.at || ""}`;
}

function clearUnreadNoticeState(roomState, key) {
  if (!key) return;
  roomState.unreadNoticeStates ||= {};
  delete roomState.unreadNoticeStates[key];
}

function unreadNoticeText(roomState, sender) {
  const key = resolveName(roomState, sender);
  const messages = unreadMessages(roomState, sender);
  if (!messages.length) {
    clearUnreadNoticeState(roomState, key);
    return null;
  }

  roomState.unreadNoticeStates ||= {};
  const stateHash = unreadNoticeStateHash(messages);
  const previous = roomState.unreadNoticeStates[key];
  if (previous?.notifiedStateHash === stateHash) return null;

  roomState.unreadNoticeStates[key] = {
    unreadCount: messages.length,
    latestUnreadId: messages.at(-1)?.id || "",
    latestUnreadAt: messages.at(-1)?.at || "",
    notifiedStateHash: stateHash,
    lastNotifiedAt: nowIso()
  };

  const displayName = displayNameForKey(roomState, key, sender);
  return [
    `${displayName}님`,
    `읽지 않은 메시지가 ${messages.length}건 있습니다.`,
    "",
    "\"/메시지\" 명령어를 입력하여 메시지를 확인하세요."
  ].join("\n");
}

function messageInboxCommand(roomState, sender) {
  const key = resolveName(roomState, sender);
  const messages = unreadMessages(roomState, sender);
  if (!messages.length) {
    clearUnreadNoticeState(roomState, key);
    return "읽지 않은 메시지가 없습니다.";
  }

  const readAt = nowIso();
  const visibleMessages = messages.slice(0, 5);
  for (const message of visibleMessages) message.readAt = readAt;
  clearUnreadNoticeState(roomState, key);

  const displayName = displayNameForKey(roomState, key, sender);
  const lines = [`💌 ${displayName}님, ${messages.length}건의 메시지가 있습니다.`, ""];
  visibleMessages.forEach((message, index) => {
    lines.push(`${index + 1}.`);
    lines.push(`‣ 시간 : ${kstDateTime(new Date(message.at))}`);
    lines.push(`‣ 보낸사람 : ${message.from}`);
    lines.push(`‣ 내용 : ${previewText(message.content, 180)}`);
    if (index < visibleMessages.length - 1) lines.push("");
  });
  const remaining = messages.length - visibleMessages.length;
  if (remaining > 0) {
    lines.push("");
    lines.push(`외 ${remaining}건은 /메시지 를 다시 입력해 확인할 수 있습니다.`);
  }
  return lines.join("\n");
}

function weatherUsageText() {
  return "사용법: /날씨 서울, /날씨 시흥, /오늘날씨, /시흥날씨";
}

function weatherRegionByName(value) {
  const key = keyFor(value);
  const canonical = WEATHER_ALIAS_TO_REGION[key];
  return canonical ? WEATHER_REGIONS[canonical] : null;
}

function defaultWeatherRegion(roomState) {
  const configured = normalizeText(roomState.settings?.defaultWeatherRegion || DEFAULT_WEATHER_REGION);
  return configured ? weatherRegionByName(configured) : null;
}

function weatherRegionFromCommand(roomState, parsedCommand) {
  const command = parsedCommand.command;
  if (command === "/날씨") {
    if (parsedCommand.args.length > 1) return { error: weatherUsageText() };
    if (parsedCommand.args.length === 1) {
      const region = weatherRegionByName(parsedCommand.args[0]);
      return region ? { region } : { error: "지역을 찾을 수 없습니다. 예: /날씨 서울" };
    }
    const region = defaultWeatherRegion(roomState);
    return region ? { region } : { error: weatherUsageText() };
  }
  if (command === "/오늘날씨") {
    if (parsedCommand.args.length) return { error: weatherUsageText() };
    const region = defaultWeatherRegion(roomState);
    return region ? { region } : { error: weatherUsageText() };
  }
  const dynamicMatch = command.match(/^\/(.+)날씨$/u);
  if (dynamicMatch) {
    if (parsedCommand.args.length) return { error: weatherUsageText() };
    const region = weatherRegionByName(dynamicMatch[1]);
    return region ? { region } : { error: "지역을 찾을 수 없습니다. 예: /날씨 서울" };
  }
  return { error: weatherUsageText() };
}

function weatherCodeText(code) {
  const value = Number(code);
  if ([0].includes(value)) return "맑음";
  if ([1, 2].includes(value)) return "대체로 맑음";
  if ([3].includes(value)) return "흐림";
  if ([45, 48].includes(value)) return "안개";
  if ([51, 53, 55, 56, 57].includes(value)) return "이슬비";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(value)) return "비";
  if ([71, 73, 75, 77, 85, 86].includes(value)) return "눈";
  if ([95, 96, 99].includes(value)) return "뇌우";
  return "확인 필요";
}

function weatherErrorText(roomState, regionName) {
  roomState.commandRouting ||= {};
  roomState.commandRouting.weatherErrors ||= {};
  const key = keyFor(regionName || "default");
  const previous = roomState.commandRouting.weatherErrors[key];
  const now = Date.now();
  if (previous?.lastNotifiedAtMs && now - Number(previous.lastNotifiedAtMs) < WEATHER_ERROR_COOLDOWN_MS) return null;
  roomState.commandRouting.weatherErrors[key] = {
    lastNotifiedAt: nowIso(),
    lastNotifiedAtMs: now
  };
  return "날씨 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.";
}

async function weatherCommand(roomState, parsedCommand) {
  const resolved = weatherRegionFromCommand(roomState, parsedCommand);
  if (resolved.error) return resolved.error;
  const region = resolved.region;
  try {
    const url = new URL(process.env.OPEN_METEO_BASE_URL || OPEN_METEO_BASE_URL);
    url.searchParams.set("latitude", String(region.latitude));
    url.searchParams.set("longitude", String(region.longitude));
    url.searchParams.set("current", "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m");
    url.searchParams.set("hourly", "precipitation_probability");
    url.searchParams.set("timezone", "Asia/Seoul");
    const response = await fetch(url, { signal: AbortSignal.timeout(Number(process.env.WEATHER_TIMEOUT_MS || 3500)) });
    if (!response.ok) throw new Error(`weather_status_${response.status}`);
    const data = await response.json();
    const current = data.current || {};
    const units = data.current_units || {};
    const hourly = data.hourly || {};
    const currentHour = normalizeText(current.time).slice(0, 13);
    const probabilityIndex = Array.isArray(hourly.time)
      ? hourly.time.findIndex((time) => normalizeText(time).slice(0, 13) === currentHour)
      : -1;
    const precipitationProbability = probabilityIndex >= 0 ? hourly.precipitation_probability?.[probabilityIndex] : null;
    return [
      `${region.name} 날씨`,
      `현재 기온: ${current.temperature_2m ?? "-"}${units.temperature_2m || "°C"}`,
      `체감/습도: ${current.apparent_temperature ?? "-"}${units.apparent_temperature || "°C"} / ${current.relative_humidity_2m ?? "-"}${units.relative_humidity_2m || "%"}`,
      `상태: ${weatherCodeText(current.weather_code)}`,
      `강수: ${current.precipitation ?? 0}${units.precipitation || "mm"}${precipitationProbability == null ? "" : ` / 가능성 ${precipitationProbability}%`}`,
      `풍속: ${current.wind_speed_10m ?? "-"}${units.wind_speed_10m || "km/h"}`,
      `기준 시각: ${normalizeText(current.time).replace("T", " ") || kstDateTime()}`
    ].join("\n");
  } catch {
    return weatherErrorText(roomState, region.name);
  }
}

let fortunePoolCache = null;

async function fortunePool() {
  if (fortunePoolCache) return fortunePoolCache;
  const raw = await readFile(FORTUNE_POOL_PATH, "utf8");
  const parsed = JSON.parse(raw);
  for (const key of ["flow", "caution", "luck", "advice"]) {
    if (!Array.isArray(parsed[key]) || !parsed[key].length) throw new Error(`fortune_pool_${key}_missing`);
  }
  fortunePoolCache = parsed;
  return fortunePoolCache;
}

function hashNumber(value) {
  return Number.parseInt(createHash("sha256").update(String(value)).digest("hex").slice(0, 12), 16);
}

function seededPick(items, seed) {
  return items[hashNumber(seed) % items.length];
}

async function fortuneCommand(roomState, sender, parsedCommand, identity = {}) {
  if (parsedCommand.args.length) return "사용법: /운세 또는 /오늘운세";
  const pool = await fortunePool();
  const dateKey = kstDateKey();
  const stableId = normalizeIdentityId(identity.senderId) || `${roomKey(roomState.name)}:${personKey(sender)}`;
  const seedBase = `${dateKey}:${stableId}`;
  return [
    "오늘의 운세",
    `전체운: ${seededPick(pool.flow, `${seedBase}:flow`)}`,
    `조심할 점: ${seededPick(pool.caution, `${seedBase}:caution`)}`,
    `행운 포인트: ${seededPick(pool.luck, `${seedBase}:luck`)}`,
    `한 줄 조언: ${seededPick(pool.advice, `${seedBase}:advice`)}`
  ].join("\n");
}

function formatNumber(value) {
  return Math.max(0, Math.trunc(Number(value) || 0)).toLocaleString("ko-KR");
}

function formatPoint(value) {
  return `🅟${formatNumber(value)}`;
}

function requiredExpForLevel(level) {
  return 48 + Math.max(1, Number(level) || 1) * 2;
}

function parseAmount(value) {
  const amount = Number(String(value || "").replace(/,/g, ""));
  if (!Number.isInteger(amount) || amount <= 0) return null;
  return amount;
}

function parseTargetAndAmount(text, commandPattern) {
  const body = text.replace(commandPattern, "").trim();
  const match = body.match(/^(.+?)\s*([0-9][0-9,]*)$/);
  if (!match) return null;
  return {
    target: stripKakaoSuffix(match[1]),
    amount: parseAmount(match[2])
  };
}

function grantExpAndLevel(roomState, person, expAmount, fallback = "") {
  normalizePersonState(person);
  person.exp += Math.max(0, Number(expAmount) || 0);
  const notices = [];
  const displayName = displayNameForPerson(roomState, person, fallback);
  while (person.exp >= requiredExpForLevel(person.level)) {
    const fromLevel = person.level;
    person.exp -= requiredExpForLevel(person.level);
    person.level += 1;
    person.points += LEVEL_UP_POINT_REWARD;
    notices.push([
      `${displayName}님 레벨업!`,
      "",
      `LV.${fromLevel} ➜ LV.${person.level}`,
      "",
      `${formatPoint(LEVEL_UP_POINT_REWARD)} 획득`
    ].join("\n"));
  }
  return notices;
}

function recentPreviousIdentityName(roomState, identityId, currentName) {
  const targetId = normalizeIdentityId(identityId);
  const currentKey = keyFor(currentName);
  if (!targetId || !currentKey) return "";
  if (isAmbiguousIdentity(roomState, targetId)) return "";

  const events = roomState.rawEvents || [];
  for (let index = events.length - 2; index >= 0; index -= 1) {
    const event = events[index];
    const identity = event.identity || {};
    if (!identityIds(identity).includes(targetId)) continue;

    const names = uniqueNames([
      normalizeIdentityId(identity.senderId) === targetId ? event.sender : "",
      normalizeIdentityId(identity.targetUserId) === targetId ? event.eventName : ""
    ]).filter((name) => keyFor(name) !== currentKey && !isReservedPersonName(name));

    if (names.length) return names[0];
  }
  return "";
}

function firstChatReentryNotice(roomState, person, sender, identityId = "") {
  const currentName = stripKakaoSuffix(sender);
  const currentKey = keyFor(currentName);
  if (isReservedPersonName(currentName)) return null;
  if (identityLooksShared(roomState, identityId, currentName)) {
    markAmbiguousIdentity(roomState, identityId);
    return null;
  }
  const recentPreviousName = recentPreviousIdentityName(roomState, identityId, currentName);
  const previousNames = uniqueNames([...(person.names || []), person.currentName])
    .filter((name) => keyFor(name) !== currentKey && !isReservedPersonName(name));
  const orderedPreviousNames = uniqueNames([recentPreviousName, ...previousNames]);
  if (!currentName || !orderedPreviousNames.length) return null;

  person.firstChatReentryNotices ||= [];
  const noticeKey = `v2:${currentKey}:${keyFor(orderedPreviousNames[0])}`;
  if (person.firstChatReentryNotices.includes(noticeKey)) return null;
  person.firstChatReentryNotices.push(noticeKey);
  if (person.firstChatReentryNotices.length > 30) person.firstChatReentryNotices = person.firstChatReentryNotices.slice(-30);

  const isCandidate = orderedPreviousNames.length > 1;
  recordRoomEvent(roomState, {
    type: isCandidate ? "first_chat_reentry_candidate_notice" : "first_chat_reentry_notice",
    name: currentName,
    previousNames: orderedPreviousNames
  });

  return [
    "【 닉네임 변경 】",
    "",
    `이전닉 : ${orderedPreviousNames[0]}`,
    `현재닉 : ${currentName}`
  ].join("\n");
}

function isSystemOrOpenChatBotSender(sender) {
  const key = keyFor(sender);
  return key.includes("오픈채팅봇") || key.includes("방장봇") || key.includes("카카오시스템") || key.includes("openchatbot");
}

function roomJoinPhraseMessage(roomState, sender, message) {
  if (!isSystemOrOpenChatBotSender(sender)) return false;
  const phrase = compactSpaces(roomState.settings?.joinPhrase || DEFAULT_JOIN_PHRASE);
  const text = compactSpaces(message);
  return Boolean(phrase && text && text.includes(phrase));
}

function recordJoinPhraseSignal(roomState, sender, message) {
  roomState.pendingEntries ||= [];
  const at = nowIso();
  const phrase = roomState.settings?.joinPhrase || DEFAULT_JOIN_PHRASE;
  roomState.pendingEntries.push({ at, phrase, sender, message, claimedBy: "" });
  if (roomState.pendingEntries.length > 100) roomState.pendingEntries = roomState.pendingEntries.slice(-100);
  recordRoomEvent(roomState, { type: "join_phrase_signal", phrase, sender });
  return null;
}

function claimPendingEntry(roomState, person, sender) {
  if (!person || isReservedPersonName(sender)) return null;
  const now = Date.now();
  const pending = (roomState.pendingEntries || []).find((entry) => {
    if (entry.claimedBy) return false;
    const at = new Date(entry.at).getTime();
    return Number.isFinite(at) && now - at <= JOIN_SIGNAL_WINDOW_MS;
  });
  if (!pending) return null;

  const alreadyHasRecentEntry = (person.entries || []).some((entry) => {
    const at = new Date(entry.at).getTime();
    return Number.isFinite(at) && Math.abs(at - new Date(pending.at).getTime()) <= JOIN_SIGNAL_WINDOW_MS;
  });
  if (alreadyHasRecentEntry) {
    pending.claimedBy = person.currentName || sender;
    return null;
  }

  person.entries.push({ at: pending.at, source: "join_phrase" });
  pending.claimedBy = person.currentName || sender;
  recordRoomEvent(roomState, { type: "entered_by_join_phrase", name: person.currentName || sender, phrase: pending.phrase });
  return person.entries.length > 1 ? reentryText(roomState, person) : null;
}

function recordActivity(roomState, sender, identityId = "", options = {}) {
  const person = ensurePerson(roomState, sender, identityId);
  if (!person) return null;
  const entryNotice = options.firstChatNotice ? claimPendingEntry(roomState, person, sender) : null;
  const reentryNotice = !entryNotice && options.firstChatNotice ? firstChatReentryNotice(roomState, person, sender, identityId) : null;
  const dateKey = kstDateKey();
  const weekKey = kstWeekKey();
  person.lastSeenAt = nowIso();
  if (featureEnabled(roomState, "points")) person.points += CHAT_POINT_REWARD;
  person.chats.total += 1;
  person.chats.byDate[dateKey] = (person.chats.byDate[dateKey] || 0) + 1;
  person.chats.byWeek[weekKey] = (person.chats.byWeek[weekKey] || 0) + 1;
  const notices = grantExpAndLevel(roomState, person, CHAT_EXP_REWARD, sender);
  return entryNotice || reentryNotice || notices[0] || null;
}

function pointViewCommand(roomState, text, sender) {
  const target = stripKakaoSuffix(text.replace(/^\/(?:내포인트|포인트)\s*/i, "")) || sender;
  const key = existingPersonKey(roomState, target) || personKey(target);
  const person = roomState.people[key] || ensurePerson(roomState, target);
  return `${displayNameForKey(roomState, key, target)}님의 포인트 : ${formatPoint(person.points)}`;
}

function pointGuideText() {
  return [
    "포인트 콘텐츠",
    "",
    "모으기",
    `• 일반 채팅 : ${formatPoint(CHAT_POINT_REWARD)}`,
    `• 출석 : ${formatPoint(ATTENDANCE_POINT_REWARD)}`,
    `• 레벨업 : ${formatPoint(LEVEL_UP_POINT_REWARD)}`,
    "",
    "사용하기",
    `• /좋아요 닉네임 수량 : 1개당 ${formatPoint(LIKE_POINT_COST)}`,
    `• /응원 닉네임 메시지 : 응원 카드 ${formatPoint(CHEER_POINT_COST)}`,
    "• /이체 닉네임 포인트 : 수수료 10%",
    "• /게임 : 뽑기, 홀짝 등 게임형 포인트 명령어 확인",
    "",
    "순위",
    "• /포인트순위, /좋아요순위, /레벨순위"
  ].join("\n");
}

function attendanceCommand(roomState, sender) {
  const person = ensurePerson(roomState, sender);
  const displayName = displayNameForPerson(roomState, person, sender);
  const today = kstDateKey();
  if (person.attendance.dates.includes(today)) return `${displayName}님 이미 출첵 하셨습니다.`;

  const lastDate = person.attendance.dates.at(-1);
  person.attendance.currentStreak = lastDate === previousDateKey(today) ? person.attendance.currentStreak + 1 : 1;
  person.attendance.dates.push(today);
  person.points += ATTENDANCE_POINT_REWARD;
  const notices = grantExpAndLevel(roomState, person, ATTENDANCE_EXP_REWARD, sender);
  const firstLine = person.attendance.currentStreak > 1
    ? `${displayName}님 ${person.attendance.currentStreak}일 연속 출석!`
    : `${displayName}님 출석!`;
  return [
    firstLine,
    "",
    `${formatPoint(ATTENDANCE_POINT_REWARD)} 획득`,
    ...notices.flatMap((notice) => ["", notice])
  ].join("\n");
}

function missingAttendanceCommand(roomState) {
  const today = kstDateKey();
  const people = Object.values(roomState.people || {})
    .map((person) => normalizePersonState(person))
    .filter((person) => !isReservedPersonName(person.currentName))
    .filter((person) => person.chats.total > 0 || person.attendance.dates.length > 0 || person.entries.length > 0)
    .filter((person) => !person.attendance.dates.includes(today))
    .sort((left, right) => keyFor(left.currentName).localeCompare(keyFor(right.currentName)));

  if (!people.length) {
    return [
      "오늘 미출석",
      "",
      "기록된 참여자 기준으로 미출석자가 없습니다.",
      "카카오톡 전체 멤버 목록은 서버로 제공되지 않아, 봇이 기록한 참여자만 기준으로 집계합니다."
    ].join("\n");
  }

  return [
    `오늘 미출석 ${people.length}명`,
    "",
    ...people.slice(0, 30).map((person, index) => `${index + 1}. ${displayNameForPerson(roomState, person)}`),
    people.length > 30 ? `...외 ${people.length - 30}명` : "",
    "",
    "기준: 봇이 기록한 참여자"
  ].filter(Boolean).join("\n");
}

function attendanceRankingCommand(roomState, sender) {
  const rows = rankedPeople(roomState, (person) => person.attendance.dates.length);
  const senderKey = existingPersonKey(roomState, sender) || personKey(sender);
  const ownRank = rows.findIndex((item) => item.key === senderKey) + 1;
  const lines = [
    "채팅방 출석 순위",
    "",
    `• ${displayNameForKey(roomState, senderKey, sender)}님 : ${ownRank ? `${ownRank}위` : "순위 없음"}`,
    ""
  ];
  rows.slice(0, 15).forEach((item, index) => {
    const rank = index + 1;
    lines.push(`${medal(rank)} ${displayNameForPerson(roomState, item.person)} ${formatNumber(item.person.attendance.dates.length)}일`);
  });
  if (!rows.length) lines.push("기록 없음");
  return lines.join("\n");
}

function likeCommand(roomState, sender, text) {
  const parsed = parseTargetAndAmount(text, /^\/좋아요\s*/i);
  if (!parsed?.target || !parsed.amount) return "형식: /좋아요 닉네임 1~999";
  if (parsed.amount < 1 || parsed.amount > MAX_LIKE_AMOUNT) return `1 ~ ${MAX_LIKE_AMOUNT} 범위 안의 숫자를 입력하세요.`;

  const giver = ensurePerson(roomState, sender);
  const targetKey = existingPersonKey(roomState, parsed.target);
  const senderKey = existingPersonKey(roomState, sender) || personKey(sender);
  if (!targetKey) return `"${parsed.target}" 사용자를 찾을 수 없습니다.`;
  if (targetKey === senderKey) return "님 말고 다른 사람";

  const receiver = roomState.people[targetKey];
  const cost = parsed.amount * LIKE_POINT_COST;
  if (giver.points < cost) {
    return [
      "포인트가 부족합니다.",
      "",
      `• 보유 포인트 : ${formatPoint(giver.points)}`
    ].join("\n");
  }

  giver.points -= cost;
  giver.spentPoints += cost;
  receiver.hearts += parsed.amount;
  recordRoomEvent(roomState, { type: "liked", from: giver.currentName, to: receiver.currentName, amount: parsed.amount, cost });
  return "💕".repeat(parsed.amount);
}

function parseCheerTarget(roomState, body) {
  const normalizedBody = compactSpaces(body);
  const candidates = candidateMentionNames(roomState)
    .filter((item, index, list) => list.findIndex((other) => other.key === item.key && keyFor(other.name) === keyFor(item.name)) === index)
    .sort((left, right) => right.name.length - left.name.length);

  for (const candidate of candidates) {
    const name = stripKakaoSuffix(candidate.name);
    if (normalizedBody === name) return { key: candidate.key, name, message: "" };
    if (normalizedBody.startsWith(`${name} `)) {
      return { key: candidate.key, name, message: normalizedBody.slice(name.length).trim() };
    }
  }
  return null;
}

function cheerCommand(roomState, sender, text) {
  const body = text.replace(/^\/(?:응원|응원카드)\s*/i, "").trim();
  if (!body) return "형식: /응원 닉네임 메시지";

  const parsed = parseCheerTarget(roomState, body);
  if (!parsed?.key || !parsed.message) return "형식: /응원 닉네임 메시지";
  if (parsed.message.length > MAX_CHEER_MESSAGE_LENGTH) return `응원 메시지는 ${MAX_CHEER_MESSAGE_LENGTH}자 이내로 입력해주세요.`;

  const senderPerson = ensurePerson(roomState, sender);
  const senderKey = existingPersonKey(roomState, sender) || personKey(sender);
  if (parsed.key === senderKey) return "본인에게는 응원 카드를 보낼 수 없습니다.";
  if (senderPerson.points < CHEER_POINT_COST) {
    return [
      "포인트가 부족합니다.",
      "",
      `• 필요 포인트 : ${formatPoint(CHEER_POINT_COST)}`,
      `• 보유 포인트 : ${formatPoint(senderPerson.points)}`
    ].join("\n");
  }

  const receiverName = displayNameForKey(roomState, parsed.key, parsed.name);
  const receiver = roomState.people[parsed.key] || ensurePerson(roomState, receiverName);
  senderPerson.points -= CHEER_POINT_COST;
  senderPerson.spentPoints += CHEER_POINT_COST;
  receiver.hearts += 1;
  recordRoomEvent(roomState, {
    type: "point_cheer",
    from: senderPerson.currentName,
    to: receiver.currentName,
    message: parsed.message,
    cost: CHEER_POINT_COST
  });
  return [
    "포인트 응원 카드",
    "",
    `${displayNameForPerson(roomState, senderPerson, sender)} -> ${displayNameForKey(roomState, parsed.key, parsed.name)}`,
    `"${parsed.message}"`,
    "",
    `사용 포인트 : ${formatPoint(CHEER_POINT_COST)}`
  ].join("\n");
}

function luckyDrawCommand(roomState, sender) {
  const person = ensurePerson(roomState, sender);
  if (person.points < LUCKY_DRAW_POINT_COST) {
    return [
      "포인트가 부족합니다.",
      "",
      `• 필요 포인트 : ${formatPoint(LUCKY_DRAW_POINT_COST)}`,
      `• 보유 포인트 : ${formatPoint(person.points)}`
    ].join("\n");
  }
  const cooldown = gameCooldownText(person, "luckyDraw");
  if (cooldown) return cooldown;

  const roll = Math.random();
  const outcome = LUCKY_DRAW_OUTCOMES.find((item) => roll < item.threshold) || LUCKY_DRAW_OUTCOMES.at(-1);
  person.points -= LUCKY_DRAW_POINT_COST;
  person.spentPoints += LUCKY_DRAW_POINT_COST;
  if (outcome.reward > 0) person.points += outcome.reward;
  markGameCooldown(person, "luckyDraw");

  recordRoomEvent(roomState, {
    type: "lucky_draw",
    name: person.currentName,
    cost: LUCKY_DRAW_POINT_COST,
    reward: outcome.reward,
    outcome: outcome.label
  });

  return [
    "뽑기 결과",
    "",
    `${displayNameForPerson(roomState, person, sender)}님 ${outcome.label}`,
    `사용 : ${formatPoint(LUCKY_DRAW_POINT_COST)}`,
    `획득 : ${formatPoint(outcome.reward)}`,
    `보유 : ${formatPoint(person.points)}`
  ].join("\n");
}

function luckyDrawCatalogText() {
  return [
    "뽑기 목록",
    "",
    `참가 비용: ${formatPoint(LUCKY_DRAW_POINT_COST)}`,
    "",
    ...LUCKY_DRAW_OUTCOMES.map((item) => `• ${item.label}: ${item.chance} / ${formatPoint(item.reward)}`),
    "",
    "/뽑기 로 1회 참여합니다."
  ].join("\n");
}

function shopState(roomState) {
  roomState.shop = normalizeShopState(roomState.shop || {});
  return roomState.shop;
}

function shopProductById(roomState, productId) {
  const id = Math.max(0, Math.trunc(Number(productId || 0)));
  if (!id) return null;
  return shopState(roomState).products.find((product) => product.id === id) || null;
}

function systemProductById(productId) {
  const id = Math.max(0, Math.trunc(Number(productId || 0)));
  if (!id) return null;
  return SYSTEM_PRODUCT_MAP.get(String(id)) || null;
}

function inventoryProductById(roomState, productId) {
  return shopProductById(roomState, productId) || systemProductById(productId);
}

function productSellPrice(product) {
  if (!product) return 0;
  const explicit = Math.trunc(Number(product.sellPrice || 0));
  if (explicit > 0) return Math.min(SHOP_MAX_PRICE, explicit);
  return Math.max(1, Math.floor(Math.trunc(Number(product.price || 0)) * 0.5));
}

function isFishProductId(productId) {
  const id = Math.trunc(Number(productId || 0));
  return id >= FISH_ITEM_ID_START && id < FISH_ITEM_ID_START + FISH_CATALOG_SIZE;
}

function pickWeightedFishGrade() {
  const roll = Math.random();
  let cumulative = 0;
  for (const grade of FISH_GRADES) {
    cumulative += grade.chance;
    if (roll <= cumulative) return grade;
  }
  return FISH_GRADES.at(-1);
}

function fishProductsByGrade(gradeId) {
  return SYSTEM_PRODUCTS.filter((product) => product.category === "fish" && product.rarity === gradeId);
}

function randomFishProduct() {
  const grade = pickWeightedFishGrade();
  const candidates = fishProductsByGrade(grade.id);
  return candidates[Math.floor(Math.random() * candidates.length)] || systemProductById(FISH_ITEM_ID_START);
}

function randomExploreProduct() {
  const index = Math.floor(Math.random() * EXPLORE_REWARD_ITEMS.length);
  return systemProductById(EXPLORE_REWARD_ITEMS[index]?.id) || systemProductById(EXPLORE_REWARD_ITEMS[0].id);
}

function gameCooldownText(person, gameKey) {
  normalizePersonState(person);
  const cooldownMs = GAME_COOLDOWNS_MS[gameKey] || 0;
  if (!cooldownMs) return "";
  const lastAt = Date.parse(person.gameCooldowns?.[gameKey] || "");
  if (!Number.isFinite(lastAt)) return "";
  const remainingMs = cooldownMs - (Date.now() - lastAt);
  if (remainingMs <= 0) return "";
  const label = GAME_COOLDOWN_LABELS[gameKey] || "게임은";
  const seconds = Math.max(1, Math.ceil(remainingMs / 1000));
  return `${label} ${Math.ceil(cooldownMs / 1000)}초 쿨타임입니다. ${seconds}초 후 다시 시도해주세요.`;
}

function markGameCooldown(person, gameKey) {
  normalizePersonState(person);
  if (!GAME_COOLDOWNS_MS[gameKey]) return;
  person.gameCooldowns[gameKey] = nowIso();
}

function activeShopProducts(roomState) {
  return shopState(roomState).products.filter((product) => product.active !== false);
}

function shopProductInventorySummary(roomState, productId) {
  const id = String(Math.max(0, Math.trunc(Number(productId || 0))));
  if (!id) return { holders: 0, totalQuantity: 0 };
  let holders = 0;
  let totalQuantity = 0;
  for (const person of Object.values(roomState.people || {})) {
    const quantity = inventoryQuantity(person, id);
    if (!quantity) continue;
    holders += 1;
    totalQuantity += quantity;
  }
  return { holders, totalQuantity };
}

function productLine(product) {
  return `${product.id}. ${product.name} - ${formatPoint(product.price)}${product.description ? `\n   ${product.description}` : ""}`;
}

function recordShopTransaction(roomState, transaction) {
  const shop = shopState(roomState);
  shop.transactions.push({
    id: randomBytes(5).toString("hex"),
    at: nowIso(),
    quantity: 1,
    unitPrice: 0,
    totalPrice: 0,
    ...transaction
  });
  if (shop.transactions.length > SHOP_TRANSACTION_LIMIT) shop.transactions = shop.transactions.slice(-SHOP_TRANSACTION_LIMIT);
}

function inventoryQuantity(person, productId) {
  normalizePersonState(person);
  return Math.max(0, Math.trunc(Number(person.inventory[String(productId)] || 0)));
}

function addInventory(person, productId, quantity) {
  normalizePersonState(person);
  const id = String(productId);
  const amount = Math.max(0, Math.trunc(Number(quantity || 0)));
  if (!amount) return inventoryQuantity(person, id);
  const current = inventoryQuantity(person, id);
  person.inventory[id] = current + amount;
  return person.inventory[id];
}

function removeInventory(person, productId, quantity) {
  normalizePersonState(person);
  const id = String(productId);
  const amount = Math.max(0, Math.trunc(Number(quantity || 0)));
  if (!amount) return inventoryQuantity(person, id);
  const current = inventoryQuantity(person, id);
  if (current < amount) return -1;
  const next = current - amount;
  if (next) person.inventory[id] = next;
  else delete person.inventory[id];
  return next;
}

function functionalShopGuideForProduct(product) {
  const nameKey = keyFor(product?.name || "");
  return FUNCTIONAL_SHOP_ITEM_GUIDES.find((guide) => (
    Number(product?.id) === guide.systemId
    || nameKey === keyFor(guide.name)
    || (guide.aliases || []).some((alias) => nameKey === keyFor(alias))
  )) || null;
}

function functionalShopItemListCommand(roomState, sender) {
  const denied = requireAdmin(roomState, sender);
  if (denied) return denied;
  return [
    "🛒 기능성 아이템 목록",
    "",
    ...FUNCTIONAL_SHOP_ITEM_GUIDES.map((guide) => {
      const product = systemProductById(guide.systemId);
      return `• ${guide.name}: ${guide.use} / 시스템 ${guide.systemId} / 판매가 ${formatPoint(productSellPrice(product))}`;
    }),
    "",
    "상점 등록 예시",
    ...FUNCTIONAL_SHOP_ITEM_GUIDES.slice(0, 3).map((guide) => `- ${guide.example}`),
    "",
    "위 이름과 같게 등록하면 구매한 방 상점 상품도 기능 아이템으로 인식됩니다."
  ].join("\n");
}

const AUTO_GAME_TICKET_CONFIGS = Object.freeze({
  hunt: {
    name: "자동던전권",
    systemId: AUTO_HUNT_TICKET_ITEM_ID,
    category: "rpg_ticket",
    command: "/자동던전",
    directCommand: "/던전",
    title: "자동던전"
  },
  explore: {
    name: "자동탐험권",
    systemId: AUTO_EXPLORE_TICKET_ITEM_ID,
    category: "explore_ticket",
    command: "/자동탐험",
    directCommand: "/탐험",
    title: "자동탐험"
  },
  fishing: {
    name: "자동낚시권",
    systemId: AUTO_FISHING_TICKET_ITEM_ID,
    category: "fishing_ticket",
    command: "/자동낚시",
    directCommand: "/낚시",
    title: "자동낚시"
  },
  draw: {
    name: "자동뽑기권",
    systemId: AUTO_DRAW_TICKET_ITEM_ID,
    category: "draw_ticket",
    command: "/자동뽑기",
    directCommand: "/뽑기",
    title: "자동뽑기"
  }
});

function isAutoGameTicketProduct(product, config = AUTO_GAME_TICKET_CONFIGS.hunt) {
  if (!product) return false;
  const guide = functionalShopGuideForProduct(product);
  return guide?.systemId === config.systemId || product.category === config.category;
}

function autoGameTicketRows(roomState, person, config = AUTO_GAME_TICKET_CONFIGS.hunt) {
  normalizePersonState(person);
  return Object.entries(person.inventory || {})
    .map(([productId, quantity]) => ({
      productId,
      quantity: Math.max(0, Math.trunc(Number(quantity || 0))),
      product: inventoryProductById(roomState, productId)
    }))
    .filter((row) => row.quantity > 0 && isAutoGameTicketProduct(row.product, config))
    .sort((left, right) => {
      const leftSystem = Number(left.productId) === config.systemId ? 0 : 1;
      const rightSystem = Number(right.productId) === config.systemId ? 0 : 1;
      return leftSystem - rightSystem || Number(left.productId) - Number(right.productId);
    });
}

function autoGameTicketQuantity(roomState, person, config = AUTO_GAME_TICKET_CONFIGS.hunt) {
  return autoGameTicketRows(roomState, person, config).reduce((sum, row) => sum + row.quantity, 0);
}

function consumeAutoGameTickets(roomState, person, config = AUTO_GAME_TICKET_CONFIGS.hunt, quantity = 1) {
  const consumed = [];
  let left = Math.max(1, Math.trunc(Number(quantity || 1)));
  for (const row of autoGameTicketRows(roomState, person, config)) {
    if (left <= 0) break;
    const amount = Math.min(left, row.quantity);
    removeInventory(person, row.productId, amount);
    consumed.push({ ...row, quantity: amount });
    left -= amount;
  }
  return consumed;
}

function parseAutoGameCommand(text = "", commandPattern = /^\/자동던전\s*/i) {
  const body = compactSpaces(text.replace(commandPattern, ""));
  if (!body) return { subject: "", ticketUse: 1 };
  const parts = body.split(/\s+/).filter(Boolean);
  let ticketUse = 1;
  if (/^[0-9]+$/.test(parts.at(-1) || "")) {
    const requested = Number(parts.pop());
    ticketUse = Number.isSafeInteger(requested) ? Math.max(1, requested) : 1;
  }
  return { subject: parts.join(" "), ticketUse };
}

function autoGameTicketRequiredText(config = AUTO_GAME_TICKET_CONFIGS.hunt, ticketUse = 1) {
  const runs = ticketUse * RPG_AUTO_HUNT_RUNS;
  return [
    `🎫 ${config.name}이 필요합니다.`,
    "",
    `${config.title}은 ${config.name} 1장으로 ${RPG_AUTO_HUNT_RUNS}회를 요약 처리합니다.`,
    ticketUse > 1 ? `요청 수량: ${ticketUse}장 = ${runs}회` : "",
    "구매/획득: 방 상점 구매, 이벤트 보상, 관리자 지급을 이용해 주세요.",
    `직접 플레이: ${config.directCommand}`
  ].filter(Boolean).join("\n");
}

function autoHuntTicketRows(roomState, person) {
  return autoGameTicketRows(roomState, person, AUTO_GAME_TICKET_CONFIGS.hunt);
}

function autoHuntTicketQuantity(roomState, person) {
  return autoGameTicketQuantity(roomState, person, AUTO_GAME_TICKET_CONFIGS.hunt);
}

function consumeAutoHuntTicket(roomState, person) {
  return consumeAutoGameTickets(roomState, person, AUTO_GAME_TICKET_CONFIGS.hunt, 1)[0] || null;
}

function addInventoryCounts(person, counts) {
  for (const [productId, quantity] of counts.entries()) {
    addInventory(person, productId, quantity);
  }
}

function parseProductIdFromCommand(text, pattern) {
  const body = compactSpaces(text.replace(pattern, ""));
  const productId = Math.trunc(Number(body));
  if (!productId || String(productId) !== body.replace(/,/g, "")) return 0;
  return productId;
}

function shopListCommand(roomState, sender) {
  const person = ensurePerson(roomState, sender);
  const products = activeShopProducts(roomState);
  if (!products.length) {
    return [
      "픽셀곰 상점",
      "",
      "등록된 상품이 없습니다.",
      "관리자가 /상점추가 상품명 가격 설명 으로 추가할 수 있습니다."
    ].join("\n");
  }
  return [
    "픽셀곰 상점",
    "",
    `보유 포인트: ${formatPoint(person.points)}`,
    "",
    ...products.map(productLine),
    "",
    "/구매 번호 수량 으로 구매합니다. 수량을 생략하면 1개 구매합니다."
  ].join("\n");
}

function purchaseItemCommand(roomState, sender, text) {
  const parsed = parseProductQuantityCommand(text, /^\/구매\s*/i);
  const productId = parsed?.productId || 0;
  const purchaseQuantity = parsed?.quantity || 0;
  if (!productId || !purchaseQuantity) return "형식: /구매 번호 수량";
  const product = shopProductById(roomState, productId);
  if (!product || product.active === false) return "판매 중인 상품 번호가 아닙니다. /상점 으로 목록을 확인해주세요.";
  const buyer = ensurePerson(roomState, sender);
  const totalPrice = product.price * purchaseQuantity;
  if (buyer.points < totalPrice) {
    return [
      "포인트가 부족합니다.",
      "",
      `• 필요 포인트 : ${formatPoint(totalPrice)}`,
      `• 보유 포인트 : ${formatPoint(buyer.points)}`
    ].join("\n");
  }
  buyer.points -= totalPrice;
  buyer.spentPoints += totalPrice;
  const quantity = addInventory(buyer, product.id, purchaseQuantity);
  recordShopTransaction(roomState, {
    type: "purchase",
    productId: product.id,
    productName: product.name,
    quantity: purchaseQuantity,
    unitPrice: product.price,
    totalPrice,
    from: buyer.currentName,
    to: buyer.currentName,
    by: buyer.currentName
  });
  return [
    "구매 완료",
    "",
    `• 상품 : ${product.name} x ${purchaseQuantity}`,
    `• 사용 포인트 : ${formatPoint(totalPrice)}`,
    `• 보유 수량 : ${quantity}개`,
    `• 남은 포인트 : ${formatPoint(buyer.points)}`
  ].join("\n");
}

function parseProductQuantityCommand(text, pattern) {
  const body = compactSpaces(text.replace(pattern, ""));
  if (!body) return null;
  const match = body.match(/^([0-9]+)(?:\s+([0-9]+))?$/);
  if (!match) return null;
  const quantity = Number(match[2] || 1);
  return {
    productId: Math.trunc(Number(match[1])),
    quantity: Number.isSafeInteger(quantity) ? Math.max(1, quantity) : 1
  };
}

function parseInventoryActionText(text, pattern) {
  const body = compactSpaces(text.replace(pattern, ""));
  if (!body) return null;
  const parts = body.split(/\s+/);
  let quantity = 1;
  let selector = body;
  if (parts.length > 1 && /^[0-9]+$/.test(parts.at(-1))) {
    quantity = Math.min(SHOP_MAX_QUANTITY, Math.max(1, Math.trunc(Number(parts.at(-1)))));
    selector = parts.slice(0, -1).join(" ");
  }
  return { selector: compactSpaces(selector), quantity };
}

function parseInventorySelectorList(selector = "") {
  const body = compactSpaces(selector);
  if (!body) return [];
  const tokens = body.split(/\s*,\s*/).filter(Boolean);
  const selectors = [];
  for (const token of tokens) {
    const range = token.match(/^([0-9]+)\s*-\s*([0-9]+)$/);
    if (range) {
      const start = Math.max(1, Math.trunc(Number(range[1])));
      const end = Math.max(1, Math.trunc(Number(range[2])));
      const [from, to] = start <= end ? [start, end] : [end, start];
      for (let value = from; value <= Math.min(to, from + 49); value += 1) selectors.push(String(value));
    } else {
      selectors.push(token);
    }
  }
  return [...new Set(selectors)].slice(0, SHOP_MAX_QUANTITY);
}

function inventoryDisplayRows(roomState, person, filter = null) {
  const rows = inventoryRows(roomState, person).filter((row) => !filter || filter(row));
  return rows.map((row, index) => ({ ...row, selectNo: index + 1 }));
}

function isEquippedProduct(person, productId) {
  normalizePersonState(person);
  const id = String(productId);
  return ["weapon", "armor", "accessory"].some((slot) => String(person.equipment?.[slot] || "") === id);
}

function isLockedInventoryProduct(person, productId) {
  normalizePersonState(person);
  return (person.lockedInventory || []).includes(String(productId));
}

function setInventoryLock(person, productId, locked) {
  normalizePersonState(person);
  const id = String(productId);
  const locks = new Set(person.lockedInventory || []);
  if (locked) locks.add(id);
  else locks.delete(id);
  person.lockedInventory = normalizeInventoryLocks([...locks]);
  return person.lockedInventory;
}

function resolveInventoryRow(roomState, person, selector, filter = null) {
  const body = compactSpaces(selector || "");
  if (!body) return null;
  const rows = inventoryDisplayRows(roomState, person, filter);
  const numeric = body.match(/^[0-9]+$/) ? Math.trunc(Number(body)) : 0;
  if (numeric > 0 && numeric < 1000) return rows[numeric - 1] || null;
  if (numeric >= 1000) return rows.find((row) => row.productId === numeric) || null;
  const key = keyFor(body);
  return rows.find((row) => keyFor(row.name) === key)
    || rows.find((row) => keyFor(row.name).includes(key))
    || null;
}

function itemIcon(rowOrProduct = {}) {
  const category = rowOrProduct.category || "";
  const slot = rowOrProduct.slot || "";
  if (slot === "weapon" || category === "weapon") return "⚔️";
  if (slot === "armor" || category === "armor") return "🛡️";
  if (slot === "accessory" || category === "accessory") return "✨";
  if (category === "fish") return "🐟";
  if (category === "rpg_material") return "⛏️";
  if (category === "bait") return "🎣";
  if (category === "pet") return "🐾";
  return "🎒";
}

function clampPage(value, totalPages = 1) {
  const maxPage = Math.max(1, Math.trunc(Number(totalPages) || 1));
  const page = Math.trunc(Number(value) || 1);
  return Math.min(Math.max(1, page), maxPage);
}

function chatPageMemoryKey(roomState, person, fallback, pageKey) {
  const roomPart = roomKey(roomState?.name || "");
  const personPart = personKey(person?.currentName || fallback || "");
  return `${roomPart}:${personPart}:${pageKey}`;
}

function rememberedChatPage(memoryKey, fallbackPage = 1) {
  if (!memoryKey) return fallbackPage;
  const record = chatPageMemory.get(memoryKey);
  if (!record || Date.now() - Number(record.at || 0) > CHAT_PAGE_MEMORY_TTL_MS) {
    chatPageMemory.delete(memoryKey);
    return fallbackPage;
  }
  return Math.max(1, Math.trunc(Number(record.page || fallbackPage)) || fallbackPage);
}

function rememberChatPage(memoryKey, page) {
  if (!memoryKey) return;
  chatPageMemory.set(memoryKey, { page, at: Date.now() });
  if (chatPageMemory.size <= 1000) return;
  const cutoff = Date.now() - CHAT_PAGE_MEMORY_TTL_MS;
  for (const [key, record] of chatPageMemory.entries()) {
    if (Number(record.at || 0) < cutoff || chatPageMemory.size > 1000) chatPageMemory.delete(key);
  }
}

function inventoryPageFromText(text, pattern, person = null, pageKey = "items", totalPages = 1, memoryKey = "") {
  const body = compactSpaces(text.replace(pattern, ""));
  const storedPage = person?.uiState?.inventoryPages?.[pageKey] || 1;
  const rememberedPage = rememberedChatPage(memoryKey, storedPage);
  let page = 1;
  if (!body || body === "1") page = 1;
  else if (body === "다음") page = Number(rememberedPage) + 1;
  else if (body === "이전") page = Number(rememberedPage) - 1;
  else {
    const match = body.match(/^([0-9]+)(?:\s*페이지)?$/);
    page = match ? Math.trunc(Number(match[1])) : 1;
  }
  const currentPage = clampPage(page, totalPages);
  if (memoryKey) {
    rememberChatPage(memoryKey, currentPage);
  } else if (person) {
    normalizePersonState(person);
    person.uiState.inventoryPages[pageKey] = currentPage;
  }
  return currentPage;
}

function baitShopCommand(roomState, sender) {
  const person = ensurePerson(roomState, sender);
  const bait = systemProductById(BAIT_ITEM_ID);
  return [
    "🎣 미끼 상점",
    "",
    `1. ${bait.name} - ${formatPoint(bait.price)} / 판매가 ${formatPoint(bait.sellPrice)}`,
    `   ${bait.description}`,
    "",
    `보유 포인트: ${formatPoint(person.points)}`,
    `보유 미끼: ${inventoryQuantity(person, BAIT_ITEM_ID)}개`,
    "",
    "구매: /미끼구매 수량"
  ].join("\n");
}

function baitPurchaseCommand(roomState, sender, text) {
  const body = compactSpaces(text.replace(/^\/미끼구매\s*/i, ""));
  const requested = Number(body || 1);
  const quantity = Number.isSafeInteger(requested) ? Math.max(1, requested) : 0;
  if (!quantity || (body && String(quantity) !== body.replace(/,/g, ""))) return "형식: /미끼구매 수량";
  const bait = systemProductById(BAIT_ITEM_ID);
  const person = ensurePerson(roomState, sender);
  const totalPrice = bait.price * quantity;
  if (person.points < totalPrice) {
    return [
      "포인트가 부족합니다.",
      "",
      `• 필요 포인트 : ${formatPoint(totalPrice)}`,
      `• 보유 포인트 : ${formatPoint(person.points)}`
    ].join("\n");
  }
  person.points -= totalPrice;
  person.spentPoints += totalPrice;
  const currentQuantity = addInventory(person, BAIT_ITEM_ID, quantity);
  recordShopTransaction(roomState, {
    type: "bait_purchase",
    productId: BAIT_ITEM_ID,
    productName: bait.name,
    quantity,
    unitPrice: bait.price,
    totalPrice,
    from: person.currentName,
    to: person.currentName,
    by: person.currentName
  });
  return [
    "미끼 구매 완료",
    "",
    `• 상품 : ${bait.name} x ${quantity}`,
    `• 사용 포인트 : ${formatPoint(totalPrice)}`,
    `• 보유 미끼 : ${currentQuantity}개`,
    `• 남은 포인트 : ${formatPoint(person.points)}`
  ].join("\n");
}

function sellItemCommand(roomState, sender, text) {
  const person = ensurePerson(roomState, sender);
  const body = compactSpaces(text.replace(/^\/판매\s*/i, ""));
  if (!body) {
    return ["❌ 명령어를 확인해 주세요.", "사용 예시:", " /판매 1", " /판매 1,3,5", " /판매 재료"].join("\n");
  }
  const mode = inventorySaleModeFromText(body);
  if (mode) return executeInventorySaleMode(roomState, person, mode, { title: "💰 판매 완료" });

  const selectors = parseInventorySelectorList(body);
  const isMultiSelector = /,/.test(body) || /^[0-9]+\s*-\s*[0-9]+$/.test(body);
  if (isMultiSelector) {
    const rows = selectors.map((selector) => resolveInventoryRow(roomState, person, selector)).filter(Boolean);
    if (!rows.length) return "❌ 판매할 아이템을 찾지 못했습니다. /판매목록 으로 번호를 확인해 주세요.";
    const plan = inventorySalePlan(roomState, person, rows, { mode: "선택", quantity: 1 });
    return applyInventorySalePlan(roomState, person, plan, { title: "💰 판매 완료", emptyText: "선택한 아이템 중 판매 가능한 항목이 없습니다." });
  }

  const parsed = parseInventoryActionText(text, /^\/판매\s*/i);
  if (!parsed?.selector) {
    return ["❌ 명령어를 확인해 주세요.", "사용 예시:", " /판매 1", " /판매 낡은검", " /판매 10000 2"].join("\n");
  }
  const row = resolveInventoryRow(roomState, person, parsed.selector);
  if (!row) return "❌ 판매할 아이템을 찾지 못했습니다. /판매목록 으로 번호를 확인해 주세요.";
  const plan = inventorySalePlan(roomState, person, [row], { mode: "선택", quantity: parsed.quantity });
  if (!plan.items.length && plan.excluded["장착중"]) {
    return ["⚠️ 장착 중인 장비입니다.", "먼저 다른 장비를 장착하거나 중복 수량만 판매해 주세요.", "예시: /자동장착 공격"].join("\n");
  }
  if (!plan.items.length && plan.excluded["잠금"]) {
    return ["⚠️ 잠금된 아이템입니다.", "판매하려면 /아이템잠금해제 번호 를 먼저 실행해 주세요.", "확인: /잠금목록"].join("\n");
  }
  return applyInventorySalePlan(roomState, person, plan, { title: "💰 판매 완료", emptyText: "선택한 아이템은 판매할 수 없습니다." });
}

function inventoryRows(roomState, person) {
  normalizePersonState(person);
  return Object.entries(person.inventory)
    .map(([productId, quantity]) => {
      const product = inventoryProductById(roomState, productId);
      return {
        productId: Number(productId),
        quantity,
        name: product?.name || `삭제된 상품 #${productId}`,
        active: product?.active !== false,
        sellPrice: productSellPrice(product),
        category: product?.category || "shop",
        rarity: product?.rarity || "",
        slot: product?.slot || "",
        gradeLabel: product?.gradeLabel || "",
        locked: isLockedInventoryProduct(person, productId)
      };
    })
    .filter((item) => item.quantity > 0)
    .sort((left, right) => left.productId - right.productId);
}

function inventorySaleModeFromText(text = "") {
  const body = compactSpaces(text);
  const aliases = {
    "일반": "일반",
    "중복": "중복",
    "재료": "재료",
    "전리품": "재료",
    "물고기": "물고기",
    "생선": "물고기"
  };
  return aliases[body] || "";
}

function saleModeMatchesRow(row, mode) {
  if (mode === "중복") return true;
  if (mode === "재료") return row.category === "rpg_material" || row.category === "explore";
  if (mode === "물고기") return row.category === "fish" || isFishProductId(row.productId);
  if (mode === "일반") {
    return row.rarity === "common"
      || row.gradeLabel === "일반"
      || row.category === "fish"
      || row.category === "rpg_material"
      || row.category === "explore";
  }
  return true;
}

function saleProtectedReason(person, row, product) {
  if (!productSellPrice(product)) return "판매불가";
  if (isLockedInventoryProduct(person, row.productId)) return "잠금";
  if (["bait", "pet"].includes(row.category)) return "보호";
  return "";
}

function inventorySalePlan(roomState, person, rows, options = {}) {
  const mode = options.mode || "선택";
  const requestedQuantity = Math.max(1, Math.trunc(Number(options.quantity || 1)));
  const items = [];
  const excluded = {};
  const sourceRows = rows || inventoryRows(roomState, person).filter((row) => saleModeMatchesRow(row, mode));
  for (const row of sourceRows) {
    const product = inventoryProductById(roomState, row.productId);
    const reason = saleProtectedReason(person, row, product);
    const equippedReserve = isEquippedProduct(person, row.productId) ? 1 : 0;
    const baseSellable = Math.max(0, inventoryQuantity(person, row.productId) - equippedReserve);
    const quantity = mode === "중복"
      ? Math.max(0, baseSellable - 1)
      : Math.min(baseSellable, options.quantity === Infinity ? baseSellable : requestedQuantity);
    if (reason || !quantity) {
      const excludedReason = reason || (equippedReserve ? "장착중" : "수량부족");
      excluded[excludedReason] = (excluded[excludedReason] || 0) + 1;
      continue;
    }
    const unitPrice = productSellPrice(product);
    items.push({
      productId: row.productId,
      name: product?.name || row.name,
      quantity,
      unitPrice,
      totalPrice: unitPrice * quantity
    });
  }
  return {
    mode,
    items,
    excluded,
    totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
    totalPrice: items.reduce((sum, item) => sum + item.totalPrice, 0)
  };
}

function excludedSaleText(excluded = {}) {
  const text = Object.entries(excluded)
    .filter(([, count]) => count > 0)
    .map(([reason, count]) => `${reason} ${count}개`)
    .join(", ");
  return text || "없음";
}

function inventorySalePlanText(plan, options = {}) {
  const title = options.title || "💰 판매 미리보기";
  const action = options.action || `/판매 ${plan.mode}`;
  const previewItems = plan.items.slice(0, 4).map((item) => `${item.name} x${item.quantity}`);
  return [
    title,
    "",
    `• 대상 : ${plan.mode} ${plan.totalQuantity}개`,
    `• 예상 획득 : ${formatPoint(plan.totalPrice)}`,
    previewItems.length ? `• 주요 아이템 : ${previewItems.join(", ")}` : "",
    `• 제외 : ${excludedSaleText(plan.excluded)}`,
    "",
    `실행: ${action}`
  ].filter(Boolean).join("\n");
}

function applyInventorySalePlan(roomState, person, plan, options = {}) {
  if (!plan.items.length) {
    return [
      options.title || "💰 판매 결과",
      "",
      options.emptyText || `${plan.mode} 조건에 맞는 판매 가능 아이템이 없습니다.`,
      `제외: ${excludedSaleText(plan.excluded)}`
    ].join("\n");
  }
  for (const item of plan.items) {
    removeInventory(person, item.productId, item.quantity);
    recordShopTransaction(roomState, {
      type: "sell",
      productId: item.productId,
      productName: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
      from: person.currentName,
      to: person.currentName,
      by: person.currentName
    });
  }
  person.points += plan.totalPrice;
  const previewItems = plan.items.slice(0, 4).map((item) => `${item.name} x${item.quantity}`);
  return [
    options.title || "💰 판매 완료",
    "",
    `• 방식 : ${plan.mode}`,
    `• 판매 수량 : ${plan.totalQuantity}개`,
    `• 지급 포인트 : ${formatPoint(plan.totalPrice)}`,
    previewItems.length ? `• 주요 아이템 : ${previewItems.join(", ")}` : "",
    `• 제외 : ${excludedSaleText(plan.excluded)}`,
    `• 보유 포인트 : ${formatPoint(person.points)}`
  ].filter(Boolean).join("\n");
}

function executeInventorySaleMode(roomState, person, mode, options = {}) {
  const rows = inventoryRows(roomState, person).filter((row) => saleModeMatchesRow(row, mode));
  const plan = inventorySalePlan(roomState, person, rows, { mode, quantity: Infinity });
  return applyInventorySalePlan(roomState, person, plan, {
    title: options.title || "💰 일괄판매 완료",
    emptyText: `${mode} 조건에 맞는 판매 가능 아이템이 없습니다.`
  });
}

function inventoryCommand(roomState, sender, text) {
  const isItemCommand = /^\/(?:아이템|보유아이템)(?:\s|$)/.test(text);
  const query = stripKakaoSuffix(text.replace(isItemCommand ? /^\/(?:아이템|보유아이템)\s*/i : /^\/가방\s*/i, ""));
  let target = sender;
  const isPageQuery = !query || query === "다음" || /^[0-9]+$/.test(query);
  if (query && !isItemCommand && !isPageQuery) {
    const denied = requireAdmin(roomState, sender);
    if (denied) return denied;
    target = query;
  }
  const key = existingPersonKey(roomState, target) || (query ? "" : personKey(sender));
  const person = key ? roomState.people[key] || ensurePerson(roomState, target) : null;
  if (!person) return `"${target}" 사용자를 찾을 수 없습니다.`;
  const rows = inventoryRows(roomState, person);
  const displayName = displayNameForPerson(roomState, person, target);
  if (!rows.length) {
    return [
      `${displayName}님의 가방`,
      "",
      "보유한 아이템이 없습니다.",
      "/상점 으로 구매 가능한 상품을 확인하세요."
    ].join("\n");
  }
  const pageSize = INVENTORY_PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const baseCommand = isItemCommand ? "/아이템" : "/가방";
  const pageKey = isItemCommand ? "items" : "bag";
  const currentPage = inventoryPageFromText(
    text,
    isItemCommand ? /^\/(?:아이템|보유아이템)\s*/i : /^\/가방\s*/i,
    person,
    pageKey,
    totalPages,
    chatPageMemoryKey(roomState, person, target, pageKey)
  );
  const displayRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize)
    .map((item, index) => ({ ...item, selectNo: (currentPage - 1) * pageSize + index + 1 }));
  return [
    `🎒 ${displayName}님의 ${isItemCommand ? "보유 아이템" : "가방"} ${currentPage}/${totalPages}`,
    ...displayRows.map((item) => `${item.selectNo}. ${item.name} x ${item.quantity} ${itemIcon(item)} / 판매가 ${formatPoint(item.sellPrice)}${item.locked ? " / 잠금" : ""}`),
    totalPages > 1
      ? `자세히 보기: /아이템상세 번호 · 이동: ${baseCommand} 1~${totalPages} · ${currentPage < totalPages ? `다음: ${baseCommand} 다음 또는 ${baseCommand} ${currentPage + 1}` : "마지막 페이지"}`
      : "자세히 보기: /아이템상세 번호 · 판매 예시: /판매 1"
  ].filter(Boolean).join("\n");
}

function itemDetailCommand(roomState, sender, text) {
  const body = compactSpaces(text.replace(/^\/아이템상세\s*/i, ""));
  const person = ensurePerson(roomState, sender);
  const row = resolveInventoryRow(roomState, person, body);
  if (!row) return "❌ 아이템을 찾지 못했습니다. /아이템 으로 번호를 확인해 주세요.";
  const product = inventoryProductById(roomState, row.productId);
  const slot = rpgEquipmentSlot(product);
  const stats = slot ? rpgEquipmentStats(product) : null;
  const statLine = stats ? rpgStatSummary(stats, ["attack", "defense", "agility", "hp", "mp", "magicAttack"]) : "";
  return [
    `🎒 아이템 상세 ${row.selectNo || ""}`.trim(),
    "",
    `${itemIcon(product)} ${product?.name || row.name} x${row.quantity}`,
    `판매가: ${formatPoint(row.sellPrice)}`,
    `관리번호: ${row.productId}`,
    slot ? `부위: ${RPG_EQUIPMENT_SLOT_LABELS[slot] || "장비"}` : `분류: ${product?.category || row.category}`,
    product?.gradeLabel ? `등급: ${product.gradeLabel}` : "",
    product?.setName ? `세트: ${product.setName}` : "",
    statLine ? `능력치: ${statLine}` : "",
    product?.description || ""
  ].filter(Boolean).join("\n");
}

function saleListCommand(roomState, sender, text) {
  const person = ensurePerson(roomState, sender);
  const rows = inventoryDisplayRows(roomState, person, (row) => productSellPrice(inventoryProductById(roomState, row.productId)) > 0);
  if (!rows.length) return "💰 판매 목록\n\n판매 가능한 아이템이 없습니다.";
  const pageSize = INVENTORY_PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = inventoryPageFromText(
    text,
    /^\/판매목록\s*/i,
    person,
    "saleList",
    totalPages,
    chatPageMemoryKey(roomState, person, sender, "saleList")
  );
  const displayRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  return [
    `💰 판매 목록 ${currentPage}/${totalPages}`,
    ...displayRows.map((item) => `${item.selectNo}. ${item.name} x ${item.quantity} ${itemIcon(item)} / ${formatPoint(item.sellPrice)}${isEquippedProduct(person, item.productId) ? " / 장착중" : ""}${item.locked ? " / 잠금" : ""}`),
    totalPages > 1
      ? `판매: /판매 1 · 이동: /판매목록 1~${totalPages} · ${currentPage < totalPages ? `다음: /판매목록 다음 또는 /판매목록 ${currentPage + 1}` : "정리: /판매미리보기 중복"}`
      : "판매: /판매 1 · 정리: /판매미리보기 중복"
  ].filter(Boolean).join("\n");
}

function bulkSellCommand(roomState, sender, text) {
  const mode = compactSpaces(text.replace(/^\/일괄판매\s*/i, "")) || "중복";
  if (!["일반", "중복", "재료", "물고기"].includes(mode)) return "❌ 사용 예시:\n /일괄판매 일반\n /일괄판매 중복\n /일괄판매 재료\n /일괄판매 물고기";
  const person = ensurePerson(roomState, sender);
  return executeInventorySaleMode(roomState, person, mode, { title: "💰 일괄판매 완료" });
}

function salePreviewCommand(roomState, sender, text) {
  const mode = inventorySaleModeFromText(text.replace(/^\/판매미리보기\s*/i, "")) || "중복";
  const person = ensurePerson(roomState, sender);
  const rows = inventoryRows(roomState, person).filter((row) => saleModeMatchesRow(row, mode));
  const plan = inventorySalePlan(roomState, person, rows, { mode, quantity: Infinity });
  return inventorySalePlanText(plan, { action: `/판매 ${mode}` });
}

function inventoryCleanupCommand(roomState, sender) {
  const person = ensurePerson(roomState, sender);
  const duplicate = inventorySalePlan(roomState, person, inventoryRows(roomState, person).filter((row) => saleModeMatchesRow(row, "중복")), { mode: "중복", quantity: Infinity });
  const material = inventorySalePlan(roomState, person, inventoryRows(roomState, person).filter((row) => saleModeMatchesRow(row, "재료")), { mode: "재료", quantity: Infinity });
  const fish = inventorySalePlan(roomState, person, inventoryRows(roomState, person).filter((row) => saleModeMatchesRow(row, "물고기")), { mode: "물고기", quantity: Infinity });
  return [
    "🎒 가방 정리",
    "",
    "추천 정리:",
    `1. 중복 아이템 판매 - ${duplicate.totalQuantity}개 / ${formatPoint(duplicate.totalPrice)}`,
    `2. 재료 판매 - ${material.totalQuantity}개 / ${formatPoint(material.totalPrice)}`,
    `3. 물고기 판매 - ${fish.totalQuantity}개 / ${formatPoint(fish.totalPrice)}`,
    "",
    "/판매미리보기 중복",
    "/판매미리보기 재료",
    "/판매미리보기 물고기",
    "/아이템잠금 3"
  ].join("\n");
}

function inventoryLockCommand(roomState, sender, text, locked) {
  const person = ensurePerson(roomState, sender);
  const commandPattern = locked ? /^\/아이템잠금\s*/i : /^\/아이템잠금해제\s*/i;
  const selector = compactSpaces(text.replace(commandPattern, ""));
  const row = resolveInventoryRow(roomState, person, selector);
  if (!row) return "❌ 아이템을 찾지 못했습니다. /아이템 으로 번호를 확인해 주세요.";
  setInventoryLock(person, row.productId, locked);
  return [
    locked ? "🔒 아이템 잠금" : "🔓 아이템 잠금 해제",
    "",
    `${row.name} x${row.quantity}`,
    locked ? "일괄 판매와 정리 대상에서 제외됩니다." : "다시 판매와 정리 대상으로 사용할 수 있습니다.",
    "확인: /잠금목록"
  ].join("\n");
}

function inventoryLockListCommand(roomState, sender) {
  const person = ensurePerson(roomState, sender);
  const rows = inventoryDisplayRows(roomState, person).filter((row) => isLockedInventoryProduct(person, row.productId));
  if (!rows.length) return "🔒 잠금 목록\n\n잠금된 아이템이 없습니다.";
  return [
    `🔒 잠금 목록 ${rows.length}개`,
    "",
    ...rows.slice(0, 12).map((row) => `${row.selectNo}. ${row.name} x${row.quantity} ${itemIcon(row)}`),
    rows.length > 12 ? `...외 ${rows.length - 12}개` : "",
    "",
    "해제: /아이템잠금해제 번호"
  ].filter(Boolean).join("\n");
}

function aquariumCommand(roomState, sender, text) {
  const query = stripKakaoSuffix(text.replace(/^\/(?:어항|수족관)\s*/i, ""));
  let target = sender;
  if (query) {
    const denied = requireAdmin(roomState, sender);
    if (denied) return denied;
    target = query;
  }
  const key = existingPersonKey(roomState, target) || (query ? "" : personKey(sender));
  const person = key ? roomState.people[key] || ensurePerson(roomState, target) : null;
  if (!person) return `"${target}" 사용자를 찾을 수 없습니다.`;
  const displayName = displayNameForPerson(roomState, person, target);
  const fishRows = inventoryRows(roomState, person).filter((item) => isFishProductId(item.productId));
  if (!fishRows.length) {
    return [
      `${displayName}님의 어항`,
      "",
      "보유한 물고기가 없습니다.",
      "/미끼구매 후 /낚시 로 물고기를 모아보세요."
    ].join("\n");
  }
  const totalQuantity = fishRows.reduce((sum, item) => sum + item.quantity, 0);
  const totalSellPrice = fishRows.reduce((sum, item) => sum + (item.sellPrice * item.quantity), 0);
  const gradeCounts = Object.fromEntries(FISH_GRADES.map((grade) => [grade.id, 0]));
  for (const item of fishRows) {
    const product = systemProductById(item.productId);
    if (product?.rarity) gradeCounts[product.rarity] = (gradeCounts[product.rarity] || 0) + item.quantity;
  }
  const gradeLine = FISH_GRADES
    .map((grade) => `${grade.label} ${gradeCounts[grade.id] || 0}`)
    .join(" / ");
  return [
    `${displayName}님의 어항`,
    "",
    `수집: ${fishRows.length}/${FISH_CATALOG_SIZE}종`,
    `보유 물고기: ${totalQuantity}마리`,
    `총 판매가: ${formatPoint(totalSellPrice)}`,
    `등급별: ${gradeLine}`,
    "",
    ...fishRows.slice(0, 20).map((item, index) => `${index + 1}. ${item.name} x ${item.quantity} / 판매가: ${formatPoint(item.sellPrice)}`),
    fishRows.length > 20 ? `...외 ${fishRows.length - 20}종` : "",
    "",
    "판매: /판매 물고기",
    "상세: /아이템상세 번호"
  ].filter((line) => line !== "").join("\n");
}

function useItemCommand(roomState, sender, text) {
  const productId = parseProductIdFromCommand(text, /^\/사용\s*/i);
  if (!productId) return "형식: /사용 번호";
  const product = inventoryProductById(roomState, productId);
  const person = ensurePerson(roomState, sender);
  const nextQuantity = removeInventory(person, productId, 1);
  if (nextQuantity < 0) return "가방에 해당 아이템이 없습니다.";
  recordShopTransaction(roomState, {
    type: "use",
    productId,
    productName: product?.name || `상품 #${productId}`,
    quantity: 1,
    from: person.currentName,
    to: person.currentName,
    by: person.currentName
  });
  return [
    "아이템 사용 완료",
    "",
    `• 상품 : ${product?.name || `상품 #${productId}`}`,
    `• 남은 수량 : ${nextQuantity}개`,
    "효과형 아이템은 추후 게임 기능과 연결됩니다."
  ].join("\n");
}

function parseGiftItem(text) {
  const body = compactSpaces(text.replace(/^\/가방선물\s*/i, ""));
  const match = body.match(/^(.+?)\s+([0-9]+)\s+([0-9]+)$/);
  if (!match) return null;
  return {
    target: stripKakaoSuffix(match[1]),
    productId: Math.trunc(Number(match[2])),
    quantity: Math.min(SHOP_MAX_QUANTITY, Math.max(1, Math.trunc(Number(match[3]))))
  };
}

function giftItemCommand(roomState, sender, text) {
  const parsed = parseGiftItem(text);
  if (!parsed?.target || !parsed.productId || !parsed.quantity) return "형식: /가방선물 닉네임 번호 수량";
  const giver = ensurePerson(roomState, sender);
  const targetKey = existingPersonKey(roomState, parsed.target);
  if (!targetKey) return `"${parsed.target}" 사용자를 찾을 수 없습니다.`;
  const giverKey = existingPersonKey(roomState, sender) || personKey(sender);
  if (targetKey === giverKey) return "본인에게는 선물할 수 없습니다.";
  const receiver = roomState.people[targetKey];
  const nextGiverQuantity = removeInventory(giver, parsed.productId, parsed.quantity);
  if (nextGiverQuantity < 0) return "선물할 아이템 수량이 부족합니다.";
  const product = inventoryProductById(roomState, parsed.productId);
  const receiverQuantity = addInventory(receiver, parsed.productId, parsed.quantity);
  recordShopTransaction(roomState, {
    type: "gift",
    productId: parsed.productId,
    productName: product?.name || `상품 #${parsed.productId}`,
    quantity: parsed.quantity,
    from: giver.currentName,
    to: receiver.currentName,
    by: giver.currentName
  });
  return [
    "가방 선물 완료",
    "",
    `• 상품 : ${product?.name || `상품 #${parsed.productId}`}`,
    `• 보낸 사람 : ${displayNameForPerson(roomState, giver, sender)}`,
    `• 받은 사람 : ${displayNameForPerson(roomState, receiver, parsed.target)}`,
    `• 수량 : ${parsed.quantity}개`,
    `• 받은 사람 보유 : ${receiverQuantity}개`
  ].join("\n");
}

function purchaseHistoryCommand(roomState, sender) {
  const person = ensurePerson(roomState, sender);
  const nameKey = personKey(person.currentName);
  const displayName = displayNameForPerson(roomState, person, sender);
  const transactions = shopState(roomState).transactions
    .filter((item) => [item.from, item.to, item.by].some((name) => personKey(name) === nameKey))
    .slice(-10)
    .reverse();
  if (!transactions.length) return `${displayName}님의 구매/아이템 내역이 없습니다.`;
  return [
    `${displayName}님 구매/아이템 내역`,
    "",
    ...transactions.map((item, index) => `${index + 1}. ${shortKstDate(new Date(item.at))} ${shopTransactionLabel(item)} ${item.productName || `상품 #${item.productId}`} x ${item.quantity}`)
  ].join("\n");
}

function parseShopAdd(text) {
  const body = normalizeText(text.replace(/^\/상점추가\s*/i, ""));
  const match = body.match(/^(.+?)\s+([0-9][0-9,]*)\s+([\s\S]+)$/);
  if (!match) return null;
  return {
    name: compactSpaces(match[1]).slice(0, SHOP_PRODUCT_NAME_LIMIT),
    price: parseAmount(match[2]),
    description: compactSpaces(match[3]).slice(0, SHOP_PRODUCT_DESCRIPTION_LIMIT)
  };
}

function shopAddCommand(roomState, sender, text) {
  const denied = requireAdmin(roomState, sender);
  if (denied) return denied;
  const parsed = parseShopAdd(text);
  if (!parsed?.name || !parsed.price || !parsed.description) return "형식: /상점추가 상품명 가격 설명";
  if (parsed.price > SHOP_MAX_PRICE) return `상품 가격은 최대 ${formatPoint(SHOP_MAX_PRICE)}까지 가능합니다.`;
  const shop = shopState(roomState);
  if (activeShopProducts(roomState).length >= SHOP_PRODUCT_LIMIT) return `상점 상품은 최대 ${SHOP_PRODUCT_LIMIT}개까지 등록할 수 있습니다.`;
  const product = {
    id: shop.nextProductId++,
    name: parsed.name,
    price: parsed.price,
    description: parsed.description,
    active: true,
    createdAt: nowIso(),
    createdBy: sender,
    updatedAt: nowIso(),
    updatedBy: sender
  };
  shop.products.push(product);
  recordShopTransaction(roomState, {
    type: "product_added",
    productId: product.id,
    productName: product.name,
    by: sender
  });
  const functionalGuide = functionalShopGuideForProduct(product);
  return [
    "상점 상품이 추가되었습니다.",
    "",
    productLine(product),
    functionalGuide ? "" : "",
    functionalGuide ? `기능성 아이템: ${functionalGuide.name}으로 인식됩니다.` : "",
    functionalGuide ? `사용 명령어: ${functionalGuide.use}` : "",
    functionalGuide ? "목록: /기능아이템목록" : ""
  ].filter((line) => line !== "").join("\n");
}

function parseShopUpdate(text) {
  const body = normalizeText(text.replace(/^\/상점수정\s*/i, ""));
  const match = body.match(/^([0-9]+)\s+([0-9][0-9,]*)\s+([\s\S]+)$/);
  if (!match) return null;
  return {
    productId: Math.trunc(Number(match[1])),
    price: parseAmount(match[2]),
    description: compactSpaces(match[3]).slice(0, SHOP_PRODUCT_DESCRIPTION_LIMIT)
  };
}

function shopUpdateCommand(roomState, sender, text) {
  const denied = requireAdmin(roomState, sender);
  if (denied) return denied;
  const parsed = parseShopUpdate(text);
  if (!parsed?.productId || !parsed.price || !parsed.description) return "형식: /상점수정 번호 가격 설명";
  if (parsed.price > SHOP_MAX_PRICE) return `상품 가격은 최대 ${formatPoint(SHOP_MAX_PRICE)}까지 가능합니다.`;
  const product = shopProductById(roomState, parsed.productId);
  if (!product) return "상품 번호를 찾을 수 없습니다.";
  product.price = parsed.price;
  product.description = parsed.description;
  product.active = true;
  product.updatedAt = nowIso();
  product.updatedBy = sender;
  recordShopTransaction(roomState, {
    type: "product_updated",
    productId: product.id,
    productName: product.name,
    unitPrice: product.price,
    by: sender
  });
  return [
    "상점 상품이 수정되었습니다.",
    "",
    productLine(product)
  ].join("\n");
}

function shopDeleteCommand(roomState, sender, text) {
  const denied = requireAdmin(roomState, sender);
  if (denied) return denied;
  const productId = parseProductIdFromCommand(text, /^\/상점삭제\s*/i);
  if (!productId) return "형식: /상점삭제 번호";
  const shop = shopState(roomState);
  const product = shopProductById(roomState, productId);
  if (!product) return "상품 번호를 찾을 수 없습니다.";
  const inventorySummary = shopProductInventorySummary(roomState, product.id);
  if (inventorySummary.totalQuantity <= 0) {
    shop.products = shop.products.filter((item) => item.id !== product.id);
    recordShopTransaction(roomState, {
      type: "product_purged",
      productId: product.id,
      productName: product.name,
      by: sender
    });
    return [
      "🛠️ 상점 상품 완전 삭제",
      "",
      `${product.name} 상품을 상점에서 완전 삭제했습니다.`,
      "가방 보유자가 없는 상품이라 목록에서도 제거되었습니다."
    ].join("\n");
  }
  product.active = false;
  product.deletedAt = nowIso();
  product.deletedBy = sender;
  product.updatedAt = product.deletedAt;
  product.updatedBy = sender;
  recordShopTransaction(roomState, {
    type: "product_deleted",
    productId: product.id,
    productName: product.name,
    by: sender
  });
  return [
    "🛠️ 상점 상품 숨김 처리",
    "",
    `${product.name} 상품은 보유자가 있어 완전 삭제하지 않았습니다.`,
    `• 보유자 : ${inventorySummary.holders}명`,
    `• 보유 수량 : ${inventorySummary.totalQuantity}개`,
    "",
    "상점 목록에서는 숨김 처리했습니다. 완전 삭제하려면 보유 아이템을 회수한 뒤 /상점정리 를 실행해 주세요."
  ].join("\n");
}

function shopCleanupCommand(roomState, sender) {
  const denied = requireAdmin(roomState, sender);
  if (denied) return denied;
  const shop = shopState(roomState);
  const removed = [];
  const kept = [];
  shop.products = shop.products.filter((product) => {
    if (product.active !== false) return true;
    const inventorySummary = shopProductInventorySummary(roomState, product.id);
    if (inventorySummary.totalQuantity > 0) {
      kept.push({ product, inventorySummary });
      return true;
    }
    removed.push(product);
    return false;
  });
  if (removed.length) {
    recordShopTransaction(roomState, {
      type: "shop_cleanup",
      productId: 0,
      productName: removed.map((product) => product.name).slice(0, 5).join(", "),
      quantity: removed.length,
      by: sender
    });
  }
  return [
    "🧹 상점 정리 완료",
    "",
    `• 완전 삭제 : ${removed.length}개`,
    `• 보유자 있어 유지 : ${kept.length}개`,
    removed.length ? `• 삭제 상품 : ${removed.map((product) => product.name).slice(0, 5).join(", ")}${removed.length > 5 ? ` 외 ${removed.length - 5}개` : ""}` : "",
    kept.length ? "보유자가 있는 숨김 상품은 아이템 회수 후 다시 정리할 수 있습니다." : ""
  ].filter(Boolean).join("\n");
}

function shopResetCommand(roomState, sender) {
  const denied = requireAdmin(roomState, sender);
  if (denied) return denied;
  const shop = shopState(roomState);
  for (const product of shop.products) {
    if (product.active === false) continue;
    product.active = false;
    product.deletedAt = nowIso();
    product.deletedBy = sender;
  }
  recordShopTransaction(roomState, { type: "shop_reset", by: sender });
  return "상점 상품을 모두 숨겼습니다. 기존 가방 아이템은 유지됩니다.";
}

function shopTransactionLabel(transaction) {
  const labels = {
    purchase: "구매",
    use: "사용",
    gift: "선물",
    sell: "판매",
    bait_purchase: "미끼구매",
    fishing_catch: "낚시획득",
    game_reward: "게임보상",
    product_added: "상품추가",
    product_updated: "상품수정",
    product_deleted: "상품삭제",
    product_purged: "상품완전삭제",
    shop_cleanup: "상점정리",
    rpg_auto_hunt_crafting_bonus: "자동던전제작보너스",
    shop_reset: "상점초기화",
    item_granted: "아이템지급",
    item_revoked: "아이템회수"
  };
  return labels[transaction.type] || transaction.type || "기록";
}

function shopHistoryCommand(roomState, sender) {
  const denied = requireAdmin(roomState, sender);
  if (denied) return denied;
  const transactions = shopState(roomState).transactions.slice(-15).reverse();
  if (!transactions.length) return "상점 내역이 없습니다.";
  return [
    "상점 내역",
    "",
    ...transactions.map((item, index) => {
      const names = [item.from && `from ${item.from}`, item.to && `to ${item.to}`, item.by && `by ${item.by}`].filter(Boolean).join(" / ");
      const amount = item.totalPrice ? ` / ${formatPoint(item.totalPrice)}` : "";
      return `${index + 1}. ${shortKstDate(new Date(item.at))} ${shopTransactionLabel(item)} ${item.productName || `상품 #${item.productId}`} x ${item.quantity}${amount}${names ? ` / ${names}` : ""}`;
    })
  ].join("\n");
}

function parseAdminItemTransfer(text, commandPattern) {
  const body = compactSpaces(text.replace(commandPattern, ""));
  const match = body.match(/^(.+?)\s+([0-9]+)\s+([0-9]+)$/);
  if (!match) return null;
  return {
    target: stripKakaoSuffix(match[1]),
    productId: Math.trunc(Number(match[2])),
    quantity: Math.min(SHOP_MAX_QUANTITY, Math.max(1, Math.trunc(Number(match[3]))))
  };
}

function adminItemTransferCommand(roomState, sender, text, mode) {
  const denied = requireAdmin(roomState, sender);
  if (denied) return denied;
  const commandPattern = mode === "grant" ? /^\/아이템지급\s*/i : /^\/아이템회수\s*/i;
  const parsed = parseAdminItemTransfer(text, commandPattern);
  const label = mode === "grant" ? "아이템지급" : "아이템회수";
  if (!parsed?.target || !parsed.productId || !parsed.quantity) return `형식: /${label} 닉네임 번호 수량`;
  const product = inventoryProductById(roomState, parsed.productId);
  if (!product) return "상품 번호를 찾을 수 없습니다.";
  const targetKey = existingPersonKey(roomState, parsed.target) || personKey(parsed.target);
  const person = roomState.people[targetKey] || ensurePerson(roomState, parsed.target);
  let nextQuantity = 0;
  if (mode === "grant") nextQuantity = addInventory(person, parsed.productId, parsed.quantity);
  else {
    nextQuantity = removeInventory(person, parsed.productId, parsed.quantity);
    if (nextQuantity < 0) return "회수할 아이템 수량이 부족합니다.";
  }
  recordShopTransaction(roomState, {
    type: mode === "grant" ? "item_granted" : "item_revoked",
    productId: product.id,
    productName: product.name,
    quantity: parsed.quantity,
    to: person.currentName,
    by: sender
  });
  return [
    `${label} 완료`,
    "",
    `• 대상 : ${displayNameForPerson(roomState, person, parsed.target)}`,
    `• 상품 : ${product.name}`,
    `• 수량 : ${parsed.quantity}개`,
    `• 현재 보유 : ${nextQuantity}개`
  ].join("\n");
}

function parseOddEvenBet(text) {
  const body = compactSpaces(text);
  const direct = body.match(/^\/(홀|짝)\s+([0-9][0-9,]*)$/);
  const legacy = body.match(/^\/홀짝\s+(홀|짝)\s+([0-9][0-9,]*)$/);
  const match = direct || legacy;
  if (!match) return null;

  return {
    choice: match[1],
    amount: parseAmount(match[2])
  };
}

function oddEvenCommand(roomState, sender, text) {
  const bet = parseOddEvenBet(text);
  if (!bet?.choice || !bet.amount) return "형식: /홀 1000 또는 /짝 1000";

  const person = ensurePerson(roomState, sender);
  if (person.points < bet.amount) {
    return [
      "포인트가 부족합니다.",
      "",
      `• 필요 포인트 : ${formatPoint(bet.amount)}`,
      `• 보유 포인트 : ${formatPoint(person.points)}`
    ].join("\n");
  }
  const cooldown = gameCooldownText(person, "oddEven");
  if (cooldown) return cooldown;

  const result = Math.random() < 0.5 ? "홀" : "짝";
  const isWin = bet.choice === result;
  const reward = isWin ? bet.amount * 2 : 0;
  person.points -= bet.amount;
  person.spentPoints += bet.amount;
  if (reward > 0) person.points += reward;
  markGameCooldown(person, "oddEven");

  recordRoomEvent(roomState, {
    type: "odd_even",
    name: person.currentName,
    choice: bet.choice,
    result,
    cost: bet.amount,
    reward
  });

  return [
    "홀짝 결과",
    "",
    `참여자 : ${displayNameForPerson(roomState, person, sender)}`,
    `선택 : ${bet.choice}`,
    `베팅 : ${formatPoint(bet.amount)}`,
    `결과 : ${result}`,
    `당첨 : ${isWin ? "성공" : "실패"}`,
    `배당 : x2`,
    `지급 포인트 : ${formatPoint(reward)}`,
    `보유 포인트 : ${formatPoint(person.points)}`
  ].join("\n");
}

function chanceGameGuideText() {
  return [
    "포인트 확률 게임팩 10종",
    "",
    "가상 포인트 전용입니다. 현금, 환전, 외부 거래와 연결하지 않습니다.",
    `베팅 범위: ${formatPoint(CHANCE_GAME_MIN_BET)} ~ ${formatPoint(CHANCE_GAME_MAX_BET)}`,
    "",
    "1. /주사위 - 결과만큼 포인트 보상",
    "2. /뽑기 - 고정 비용 랜덤 보상",
    "3. /홀 100 - 홀짝 맞히기",
    "4. /코인 앞 100 - 앞/뒤 맞히기",
    "5. /룰렛 빨강 100 - 빨강/검정/초록 룰렛",
    "6. /슬롯 100 - 같은 그림을 맞히는 3릴 슬롯",
    "7. /복권 100 - 즉석 등급 뽑기",
    "8. /하이로우 하이 100 - 숫자 높낮이 맞히기",
    "9. /폭탄피하기 3 100 - 1~5 중 폭탄 피하기",
    "10. /보물상자 2 100 - 1~4 상자 선택",
    "",
    "예시: /코인 앞 100, /룰렛 초록 100, /보물상자 2 100"
  ].join("\n");
}

function chanceGameUsageText(usage) {
  return [
    `형식: ${usage}`,
    "",
    `베팅 범위: ${formatPoint(CHANCE_GAME_MIN_BET)} ~ ${formatPoint(CHANCE_GAME_MAX_BET)}`,
    "가상 포인트 전용 게임입니다."
  ].join("\n");
}

function chanceGameBetErrorText(amount, usage) {
  if (!amount) return chanceGameUsageText(usage);
  if (amount < CHANCE_GAME_MIN_BET) return `최소 베팅은 ${formatPoint(CHANCE_GAME_MIN_BET)}입니다.`;
  if (amount > CHANCE_GAME_MAX_BET) return `최대 베팅은 ${formatPoint(CHANCE_GAME_MAX_BET)}입니다.`;
  return "";
}

function normalizeChanceChoice(value, aliases) {
  const key = normalizeText(value).toLowerCase();
  return aliases[key] || "";
}

function parseChoiceChanceBet(text, commandPattern, aliases) {
  const body = compactSpaces(text.replace(commandPattern, "")).trim();
  const parts = body ? body.split(/\s+/) : [];
  const amountIndex = parts.findIndex((part) => parseAmount(part));
  const amount = amountIndex >= 0 ? parseAmount(parts[amountIndex]) : null;
  const rawChoice = parts.filter((_, index) => index !== amountIndex).join(" ");
  return {
    choice: normalizeChanceChoice(rawChoice, aliases),
    amount,
    rawChoice
  };
}

function parseAmountChanceBet(text, commandPattern) {
  const body = compactSpaces(text.replace(commandPattern, "")).trim();
  const amount = (body ? body.split(/\s+/) : [])
    .map((part) => parseAmount(part))
    .find((value) => value);
  return { amount: amount || null };
}

function parseNumberChoiceChanceBet(text, commandPattern, maxChoice) {
  const body = compactSpaces(text.replace(commandPattern, "")).trim();
  const parts = body ? body.split(/\s+/) : [];
  const choice = Number(parts[0] || 0);
  const amount = parseAmount(parts[1]);
  return {
    choice: Number.isInteger(choice) && choice >= 1 && choice <= maxChoice ? choice : 0,
    amount
  };
}

function runPointChanceGame(roomState, sender, config) {
  const betError = chanceGameBetErrorText(config.amount, config.usage);
  if (betError) return betError;

  const person = ensurePerson(roomState, sender);
  if (person.points < config.amount) {
    return [
      "포인트가 부족합니다.",
      "",
      `• 필요 포인트 : ${formatPoint(config.amount)}`,
      `• 보유 포인트 : ${formatPoint(person.points)}`
    ].join("\n");
  }
  const cooldown = gameCooldownText(person, config.cooldownKey);
  if (cooldown) return cooldown;

  const outcome = config.play(config.amount);
  const reward = Math.max(0, Math.trunc(Number(outcome.reward || 0)));
  person.points -= config.amount;
  person.spentPoints += config.amount;
  if (reward > 0) person.points += reward;
  markGameCooldown(person, config.cooldownKey);
  recordRoomEvent(roomState, {
    type: config.eventType,
    name: person.currentName,
    cost: config.amount,
    reward,
    ...(outcome.event || {})
  });

  return [
    config.title,
    "",
    `참여자 : ${displayNameForPerson(roomState, person, sender)}`,
    ...(outcome.lines || []),
    `베팅 : ${formatPoint(config.amount)}`,
    `배당 : ${outcome.payoutLabel || "x0"}`,
    `지급 포인트 : ${formatPoint(reward)}`,
    `보유 포인트 : ${formatPoint(person.points)}`
  ].join("\n");
}

function coinFlipCommand(roomState, sender, text) {
  const bet = parseChoiceChanceBet(text, /^\/(?:코인|동전)\s*/i, {
    앞: "앞",
    앞면: "앞",
    head: "앞",
    heads: "앞",
    뒤: "뒤",
    뒷면: "뒤",
    tail: "뒤",
    tails: "뒤"
  });
  if (!bet.choice) return chanceGameUsageText("/코인 앞 100 또는 /코인 뒤 100");
  return runPointChanceGame(roomState, sender, {
    title: "코인 결과",
    cooldownKey: "coinFlip",
    eventType: "chance_coin_flip",
    amount: bet.amount,
    usage: "/코인 앞 100 또는 /코인 뒤 100",
    play: (amount) => {
      const result = Math.random() < 0.5 ? "앞" : "뒤";
      const win = bet.choice === result;
      return {
        reward: win ? amount * 2 : 0,
        payoutLabel: "x2",
        lines: [`선택 : ${bet.choice}`, `결과 : ${result}`, `당첨 : ${win ? "성공" : "실패"}`],
        event: { choice: bet.choice, result, win }
      };
    }
  });
}

function rouletteCommand(roomState, sender, text) {
  const bet = parseChoiceChanceBet(text, /^\/룰렛\s*/i, {
    빨강: "빨강",
    빨간: "빨강",
    레드: "빨강",
    red: "빨강",
    검정: "검정",
    검은: "검정",
    블랙: "검정",
    black: "검정",
    초록: "초록",
    녹색: "초록",
    그린: "초록",
    green: "초록"
  });
  if (!bet.choice) return chanceGameUsageText("/룰렛 빨강 100 또는 /룰렛 초록 100");
  return runPointChanceGame(roomState, sender, {
    title: "룰렛 결과",
    cooldownKey: "roulette",
    eventType: "chance_roulette",
    amount: bet.amount,
    usage: "/룰렛 빨강 100 또는 /룰렛 초록 100",
    play: (amount) => {
      const roll = Math.random();
      const result = roll < 0.475 ? "빨강" : roll < 0.95 ? "검정" : "초록";
      const multiplier = bet.choice === result ? (result === "초록" ? 14 : 2) : 0;
      return {
        reward: amount * multiplier,
        payoutLabel: bet.choice === "초록" ? "x14" : "x2",
        lines: [`선택 : ${bet.choice}`, `결과 : ${result}`, `당첨 : ${multiplier > 0 ? "성공" : "실패"}`],
        event: { choice: bet.choice, result, multiplier }
      };
    }
  });
}

function slotMachineCommand(roomState, sender, text) {
  const bet = parseAmountChanceBet(text, /^\/슬롯\s*/i);
  const symbols = ["곰", "별", "벨", "체리", "보석"];
  return runPointChanceGame(roomState, sender, {
    title: "슬롯 결과",
    cooldownKey: "slotMachine",
    eventType: "chance_slot",
    amount: bet.amount,
    usage: "/슬롯 100",
    play: (amount) => {
      const reels = Array.from({ length: 3 }, () => symbols[Math.floor(Math.random() * symbols.length)]);
      const counts = new Map(reels.map((symbol) => [symbol, reels.filter((item) => item === symbol).length]));
      const maxCount = Math.max(...counts.values());
      const multiplier = maxCount === 3 ? (reels[0] === "보석" ? 20 : 8) : maxCount === 2 ? 2 : 0;
      return {
        reward: amount * multiplier,
        payoutLabel: multiplier ? `x${multiplier}` : "x0",
        lines: [`릴 : ${reels.join(" / ")}`, `등급 : ${maxCount === 3 ? "트리플" : maxCount === 2 ? "페어" : "꽝"}`],
        event: { reels, multiplier }
      };
    }
  });
}

function lotteryCommand(roomState, sender, text) {
  const bet = parseAmountChanceBet(text, /^\/복권\s*/i);
  return runPointChanceGame(roomState, sender, {
    title: "복권 결과",
    cooldownKey: "lottery",
    eventType: "chance_lottery",
    amount: bet.amount,
    usage: "/복권 100",
    play: (amount) => {
      const roll = Math.random();
      const prize = roll < 0.02
        ? { grade: "잭팟", multiplier: 20 }
        : roll < 0.10
          ? { grade: "1등", multiplier: 5 }
          : roll < 0.35
            ? { grade: "2등", multiplier: 2 }
            : roll < 0.55
              ? { grade: "본전", multiplier: 1 }
              : { grade: "꽝", multiplier: 0 };
      return {
        reward: amount * prize.multiplier,
        payoutLabel: `x${prize.multiplier}`,
        lines: [`등급 : ${prize.grade}`],
        event: { grade: prize.grade, multiplier: prize.multiplier }
      };
    }
  });
}

function highLowCommand(roomState, sender, text) {
  const bet = parseChoiceChanceBet(text, /^\/하이로우\s*/i, {
    하이: "하이",
    high: "하이",
    높음: "하이",
    로우: "로우",
    low: "로우",
    낮음: "로우"
  });
  if (!bet.choice) return chanceGameUsageText("/하이로우 하이 100 또는 /하이로우 로우 100");
  return runPointChanceGame(roomState, sender, {
    title: "하이로우 결과",
    cooldownKey: "highLow",
    eventType: "chance_high_low",
    amount: bet.amount,
    usage: "/하이로우 하이 100 또는 /하이로우 로우 100",
    play: (amount) => {
      const number = Math.floor(Math.random() * 13) + 1;
      const result = number >= 8 ? "하이" : number <= 6 ? "로우" : "세븐";
      const draw = result === "세븐";
      const win = bet.choice === result;
      const multiplier = draw ? 1 : win ? 2 : 0;
      return {
        reward: amount * multiplier,
        payoutLabel: draw ? "x1" : "x2",
        lines: [`선택 : ${bet.choice}`, `숫자 : ${number}`, `결과 : ${result}`, `당첨 : ${draw ? "무승부" : win ? "성공" : "실패"}`],
        event: { choice: bet.choice, number, result, multiplier }
      };
    }
  });
}

function bombAvoidCommand(roomState, sender, text) {
  const bet = parseNumberChoiceChanceBet(text, /^\/폭탄피하기\s*/i, 5);
  if (!bet.choice) return chanceGameUsageText("/폭탄피하기 3 100");
  return runPointChanceGame(roomState, sender, {
    title: "폭탄피하기 결과",
    cooldownKey: "bombAvoid",
    eventType: "chance_bomb_avoid",
    amount: bet.amount,
    usage: "/폭탄피하기 3 100",
    play: (amount) => {
      const bomb = Math.floor(Math.random() * 5) + 1;
      const safe = bet.choice !== bomb;
      return {
        reward: safe ? Math.trunc(amount * 1.5) : 0,
        payoutLabel: "x1.5",
        lines: [`선택 : ${bet.choice}번`, `폭탄 : ${bomb}번`, `결과 : ${safe ? "생존" : "폭발"}`],
        event: { choice: bet.choice, bomb, safe }
      };
    }
  });
}

function treasureBoxCommand(roomState, sender, text) {
  const bet = parseNumberChoiceChanceBet(text, /^\/보물상자\s*/i, 4);
  if (!bet.choice) return chanceGameUsageText("/보물상자 2 100");
  return runPointChanceGame(roomState, sender, {
    title: "보물상자 결과",
    cooldownKey: "treasureBox",
    eventType: "chance_treasure_box",
    amount: bet.amount,
    usage: "/보물상자 2 100",
    play: (amount) => {
      const multipliers = [0, 0.5, 2, 5];
      for (let i = multipliers.length - 1; i > 0; i -= 1) {
        const swapIndex = Math.floor(Math.random() * (i + 1));
        [multipliers[i], multipliers[swapIndex]] = [multipliers[swapIndex], multipliers[i]];
      }
      const multiplier = multipliers[bet.choice - 1] || 0;
      return {
        reward: Math.trunc(amount * multiplier),
        payoutLabel: `x${multiplier}`,
        lines: [`선택 : ${bet.choice}번`, `결과 : ${multiplier === 0 ? "빈 상자" : `${multiplier}배 상자`}`],
        event: { choice: bet.choice, multiplier }
      };
    }
  });
}

function transferCommand(roomState, sender, text) {
  const parsed = parseTargetAndAmount(text, /^\/이체\s*/i);
  if (!parsed?.target || !parsed.amount) return "형식: /이체 닉네임 포인트";

  const senderPerson = ensurePerson(roomState, sender);
  const targetKey = existingPersonKey(roomState, parsed.target);
  const senderKey = existingPersonKey(roomState, sender) || personKey(sender);
  if (!targetKey) return `"${parsed.target}" 사용자를 찾을 수 없습니다.`;
  if (targetKey === senderKey) return "본인에게는 이체할 수 없습니다.";

  const receiver = roomState.people[targetKey];
  const fee = Math.max(1, Math.ceil(parsed.amount * TRANSFER_FEE_RATE));
  const totalCost = parsed.amount + fee;
  if (senderPerson.points < totalCost) {
    return [
      "포인트가 부족합니다.",
      "",
      `• 보유 포인트 : ${formatPoint(senderPerson.points)}`,
      `• 수수료 : ${formatPoint(fee)}`
    ].join("\n");
  }

  senderPerson.points -= totalCost;
  senderPerson.spentPoints += fee;
  receiver.points += parsed.amount;
  recordRoomEvent(roomState, { type: "point_transferred", from: senderPerson.currentName, to: receiver.currentName, amount: parsed.amount, fee });
  return [
    "✅ 이체 완료",
    "",
    `• 송금인 : ${displayNameForPerson(roomState, senderPerson, sender)}`,
    `• 수취인 : ${displayNameForKey(roomState, targetKey, parsed.target)}`,
    `• 포인트 : ${formatPoint(parsed.amount)}`,
    `• 수수료 : ${formatPoint(fee)}`
  ].join("\n");
}

function diceGameCommand(roomState, sender) {
  const person = ensurePerson(roomState, sender);
  const displayName = displayNameForPerson(roomState, person, sender);
  const cooldown = gameCooldownText(person, "dice");
  if (cooldown) return cooldown;
  const settings = gameSettings(roomState);
  const roll = Math.floor(Math.random() * 6) + 1;
  const reward = roll * settings.diceReward;
  person.points += reward;
  markGameCooldown(person, "dice");
  recordRoomEvent(roomState, { type: "game_dice", name: person.currentName, roll, reward, seasonName: settings.seasonName });
  return [
    "주사위 게임",
    `시즌: ${settings.seasonName}`,
    "",
    `${displayName}님 결과: ${roll}`,
    `획득: ${formatPoint(reward)}`,
    `보유: ${formatPoint(person.points)}`
  ].join("\n");
}

function fishingGameCommand(roomState, sender) {
  const person = ensurePerson(roomState, sender);
  const displayName = displayNameForPerson(roomState, person, sender);
  const settings = gameSettings(roomState);
  const baitQuantity = inventoryQuantity(person, BAIT_ITEM_ID);
  if (baitQuantity <= 0) {
    return [
      "미끼가 부족합니다.",
      "",
      "/미끼상점 에서 가격을 확인하고 /미끼구매 수량 으로 구매해 주세요."
    ].join("\n");
  }
  const cooldown = gameCooldownText(person, "fishing");
  if (cooldown) return cooldown;
  removeInventory(person, BAIT_ITEM_ID, 1);
  const item = randomFishProduct();
  const itemQuantity = addInventory(person, item.id, 1);
  markGameCooldown(person, "fishing");
  recordRoomEvent(roomState, { type: "game_fishing", name: person.currentName, item: item.name, itemId: item.id, reward: item.sellPrice, seasonName: settings.seasonName });
  recordShopTransaction(roomState, {
    type: "fishing_catch",
    productId: item.id,
    productName: item.name,
    quantity: 1,
    unitPrice: item.sellPrice,
    totalPrice: item.sellPrice,
    to: person.currentName,
    by: person.currentName
  });
  return [
    "낚시 결과",
    `시즌: ${settings.seasonName}`,
    "",
    `${displayName}님이 물고기를 낚았습니다.`,
    `가방에 보관: ${item.name} x ${itemQuantity}`,
    `판매가: ${formatPoint(item.sellPrice)}`,
    `남은 미끼 : ${inventoryQuantity(person, BAIT_ITEM_ID)}개`
  ].join("\n");
}

function exploreGameCommand(roomState, sender) {
  const person = ensurePerson(roomState, sender);
  const displayName = displayNameForPerson(roomState, person, sender);
  const cooldown = gameCooldownText(person, "explore");
  if (cooldown) return cooldown;
  const settings = gameSettings(roomState);
  const item = randomExploreProduct();
  const itemQuantity = addInventory(person, item.id, 1);
  markGameCooldown(person, "explore");
  recordRoomEvent(roomState, { type: "game_explore", name: person.currentName, item: item.name, itemId: item.id, reward: item.sellPrice, seasonName: settings.seasonName });
  recordShopTransaction(roomState, {
    type: "game_reward",
    productId: item.id,
    productName: item.name,
    quantity: 1,
    unitPrice: item.sellPrice,
    totalPrice: item.sellPrice,
    to: person.currentName,
    by: person.currentName
  });
  return [
    "탐험 결과",
    `시즌: ${settings.seasonName}`,
    "",
    `${displayName}님이 전리품을 발견했습니다.`,
    `가방에 보관: ${item.name} x ${itemQuantity}`,
    `판매가: ${formatPoint(item.sellPrice)}`
  ].join("\n");
}

const DUNGEON_CRAFT_MATERIAL_IDS = Object.freeze({
  beginner: [0, 1, 4, 9, 14].map((offset) => RPG_ITEM_ID_START + offset),
  middle: [6, 13, 19, 21, 22].map((offset) => RPG_ITEM_ID_START + offset),
  advanced: [16, 18, 19, 22].map((offset) => RPG_ITEM_ID_START + offset),
  royal: [22, 21, 8, 19].map((offset) => RPG_ITEM_ID_START + offset),
  volcanic: [16, 17, 20, 4].map((offset) => RPG_ITEM_ID_START + offset),
  sky: [18, 6, 13, 5].map((offset) => RPG_ITEM_ID_START + offset)
});

const DUNGEON_CONFIGS = Object.freeze([
  { key: "beginner", names: ["", "초급", "초급 광산", "광산"], title: "초급 광산", purpose: "초급 재료", blankChance: 0.25, itemStart: 0, itemEnd: 119, treasureChance: 0.08, preciousChance: 0.015, craftMaterialChance: 0.35, craftMaterialIds: DUNGEON_CRAFT_MATERIAL_IDS.beginner },
  { key: "middle", names: ["중급", "중급 유적", "유적"], title: "중급 유적", purpose: "중급 제작", blankChance: 0.30, itemStart: 80, itemEnd: 299, treasureChance: 0.10, preciousChance: 0.025, craftMaterialChance: 0.30, craftMaterialIds: DUNGEON_CRAFT_MATERIAL_IDS.middle },
  { key: "advanced", names: ["상급", "상급 심연", "심연"], title: "상급 심연", purpose: "상급 강화/희귀", blankChance: 0.35, itemStart: 240, itemEnd: 499, treasureChance: 0.12, preciousChance: 0.04, craftMaterialChance: 0.32, craftMaterialIds: DUNGEON_CRAFT_MATERIAL_IDS.advanced },
  { key: "royal", names: ["왕릉", "고대 왕릉"], title: "고대 왕릉", purpose: "왕릉 세트/룬 재료", blankChance: 0.32, itemStart: 200, itemEnd: 380, treasureChance: 0.14, preciousChance: 0.035, craftMaterialChance: 0.34, craftMaterialIds: DUNGEON_CRAFT_MATERIAL_IDS.royal },
  { key: "volcanic", names: ["용암", "용암 성채", "성채"], title: "용암 성채", purpose: "용암 세트/화염석", blankChance: 0.38, itemStart: 160, itemEnd: 340, treasureChance: 0.16, preciousChance: 0.05, craftMaterialChance: 0.36, craftMaterialIds: DUNGEON_CRAFT_MATERIAL_IDS.volcanic },
  { key: "sky", names: ["천공", "천공 유적", "하늘"], title: "천공 유적", purpose: "천공 세트/바람 재료", blankChance: 0.34, itemStart: 180, itemEnd: 420, treasureChance: 0.15, preciousChance: 0.045, craftMaterialChance: 0.35, craftMaterialIds: DUNGEON_CRAFT_MATERIAL_IDS.sky }
]);
const DUNGEON_RUNTIME_CACHE = new WeakMap();

function dungeonConfigFromText(text = "") {
  const body = compactSpaces(text.replace(/^\/던전\s*/i, ""));
  return DUNGEON_CONFIGS.find((config) => config.names.includes(body)) || DUNGEON_CONFIGS[0];
}

function dungeonListCommand() {
  return [
    "픽셀곰 던전 목록",
    "초급 광산: 초급 재료 · 중급 유적: 중급 제작 · 상급 심연: 상급 강화/희귀",
    "고대 왕릉: 왕릉 세트 · 용암 성채: 용암 세트 · 천공 유적: 천공 세트",
    "낮은 확률 보석: 동/은/금/다이아",
    "입장: /던전 중급 · 자동: /자동던전 상급 10",
    "성장: /제작가능 · /강화목록"
  ].join("\n");
}

function dungeonRuntimeConfig(config) {
  let runtime = DUNGEON_RUNTIME_CACHE.get(config);
  if (runtime) return runtime;
  const craftMaterialIds = Array.isArray(config.craftMaterialIds) ? config.craftMaterialIds.filter(Boolean) : [];
  const craftMaterialProducts = craftMaterialIds.map((id) => systemProductById(id)).filter(Boolean);
  const itemProducts = [];
  for (let offset = config.itemStart; offset <= config.itemEnd; offset += 1) {
    const product = systemProductById(RPG_ITEM_ID_START + offset);
    if (product) itemProducts.push(product);
  }
  const preciousProducts = RPG_PRECIOUS_DROPS
    .map((item) => ({ ...item, product: systemProductById(item.id) }))
    .filter((item) => item.product);
  const rewardProducts = [...itemProducts, ...craftMaterialProducts, ...preciousProducts.map((item) => item.product)];
  const uniqueRewardProducts = [...new Map(rewardProducts.map((product) => [product.id, product])).values()];
  runtime = {
    blankChance: Number(config.blankChance || 0),
    craftMaterialChance: Number(config.craftMaterialChance || 0),
    preciousChance: Number(config.preciousChance || 0),
    craftMaterialProducts,
    itemProducts,
    fallbackItem: systemProductById(RPG_ITEM_ID_START),
    preciousProducts,
    preciousWeight: preciousProducts.reduce((sum, item) => sum + Number(item.weight || 0), 0),
    sellPriceById: new Map(uniqueRewardProducts.map((product) => [product.id, productSellPrice(product)])),
    rareIds: new Set(uniqueRewardProducts.filter(rpgRareReward).map((product) => product.id))
  };
  DUNGEON_RUNTIME_CACHE.set(config, runtime);
  return runtime;
}

function randomDungeonItem(config) {
  const runtime = dungeonRuntimeConfig(config);
  if (Math.random() < runtime.blankChance) return null;
  const precious = randomDungeonPreciousDrop(config);
  if (precious) return precious;
  const craftMaterial = randomDungeonCraftMaterial(config);
  if (craftMaterial && Math.random() < runtime.craftMaterialChance) return craftMaterial;
  const candidates = runtime.itemProducts;
  return candidates[Math.floor(Math.random() * candidates.length)] || runtime.fallbackItem;
}

function randomDungeonCraftMaterial(config) {
  const candidates = dungeonRuntimeConfig(config).craftMaterialProducts;
  return candidates[Math.floor(Math.random() * candidates.length)] || null;
}

function randomDungeonPreciousDrop(config) {
  const runtime = dungeonRuntimeConfig(config);
  if (Math.random() >= runtime.preciousChance || runtime.preciousWeight <= 0) return null;
  let roll = Math.random() * runtime.preciousWeight;
  for (const item of runtime.preciousProducts) {
    roll -= Number(item.weight || 0);
    if (roll <= 0) return item.product;
  }
  return systemProductById(COPPER_TREASURE_ITEM_ID);
}

function dungeonCommand(roomState, sender, text) {
  const person = ensurePerson(roomState, sender);
  const displayName = displayNameForPerson(roomState, person, sender);
  const cooldown = gameCooldownText(person, "dungeon");
  if (cooldown) return cooldown;
  const config = dungeonConfigFromText(text);
  const item = randomDungeonItem(config);
  markGameCooldown(person, "dungeon");
  const treasureFound = Math.random() < Number(config.treasureChance || 0);
  if (treasureFound) createPendingRpgReward(person, config);
  if (!item) {
    recordRoomEvent(roomState, { type: "dungeon_blank", name: person.currentName, dungeon: config.title });
    return [
      "던전 결과",
      "",
      `${displayName}님이 ${config.title}을(를) 탐험했습니다.`,
      "결과: 꽝",
      treasureFound ? "보물상자 발견: /보상선택 재료|포인트|강화재료" : "아무것도 얻지 못했습니다."
    ].join("\n");
  }
  const quantity = addInventory(person, item.id, 1);
  recordShopTransaction(roomState, {
    type: "dungeon_reward",
    productId: item.id,
    productName: item.name,
    quantity: 1,
    unitPrice: item.sellPrice,
    totalPrice: item.sellPrice,
    to: person.currentName,
    by: person.currentName
  });
  recordRoomEvent(roomState, { type: "dungeon_reward", name: person.currentName, dungeon: config.title, itemId: item.id, item: item.name });
  return [
    "던전 결과",
    "",
    `${displayName}님이 ${config.title}에서 재료를 획득했습니다.`,
    `가방에 보관: ${item.name} x ${quantity}`,
    `판매가: ${formatPoint(item.sellPrice)}`,
    treasureFound ? "보물상자: /보상선택 포인트" : "",
    "판매: /판매 1",
    "상세: /아이템상세 1"
  ].filter(Boolean).join("\n");
}

function rpgRareReward(product) {
  return ["rare", "epic", "legendary"].includes(product?.rarity) || Number(product?.sellPrice || 0) >= 48;
}

function createPendingRpgReward(person, config) {
  person.pendingRpgReward = {
    id: randomBytes(4).toString("hex"),
    source: "dungeon",
    dungeon: config.title,
    choices: ["재료", "포인트", "강화재료"],
    createdAt: nowIso(),
    expiresAt: new Date(Date.now() + RPG_REWARD_CHOICE_TTL_MS).toISOString()
  };
  return person.pendingRpgReward;
}

function grantAutoDungeonCraftingSupport(roomState, person, config, runs) {
  const materialProducts = dungeonRuntimeConfig(config).craftMaterialProducts;
  const materialCount = materialProducts.length ? Math.floor(Math.max(0, runs) / 50) : 0;
  const pointBonus = Math.floor(Math.max(0, runs) / 100) * 100;
  const materialCounts = new Map();
  let totalSell = 0;
  const fullCycles = materialProducts.length ? Math.floor(materialCount / materialProducts.length) : 0;
  const remainder = materialProducts.length ? materialCount % materialProducts.length : 0;
  materialProducts.forEach((product, index) => {
    const quantity = fullCycles + (index < remainder ? 1 : 0);
    if (!quantity) return;
    addInventory(person, product.id, quantity);
    totalSell += productSellPrice(product) * quantity;
    materialCounts.set(product.id, {
      product,
      quantity
    });
  });
  if (pointBonus > 0) person.points += pointBonus;
  const materials = [...materialCounts.values()];
  if (materials.length || pointBonus > 0) {
    recordShopTransaction(roomState, {
      type: "rpg_auto_hunt_crafting_bonus",
      productId: materials[0]?.product?.id || 0,
      productName: materials.map((item) => item.product.name).slice(0, 4).join(", "),
      quantity: materials.reduce((sum, item) => sum + item.quantity, 0),
      totalPrice: pointBonus,
      to: person.currentName,
      by: person.currentName
    });
  }
  return {
    materials,
    materialCount: materials.reduce((sum, item) => sum + item.quantity, 0),
    pointBonus,
    totalSell
  };
}

function autoHuntDungeonCommand(roomState, sender, text) {
  const person = ensurePerson(roomState, sender);
  const parsed = parseAutoGameCommand(text, /^\/자동(?:던전|사냥)\s*/i);
  const ticketUse = parsed.ticketUse;
  const ticketCount = autoHuntTicketQuantity(roomState, person);
  if (ticketCount < ticketUse) return autoGameTicketRequiredText(AUTO_GAME_TICKET_CONFIGS.hunt, ticketUse);
  const config = dungeonConfigFromText(`/던전 ${parsed.subject}`);
  const consumedTickets = consumeAutoGameTickets(roomState, person, AUTO_GAME_TICKET_CONFIGS.hunt, ticketUse);
  const runs = ticketUse * RPG_AUTO_HUNT_RUNS;
  person.rpgAutoHunt ||= { date: kstDateKey(), count: 0 };
  if (person.rpgAutoHunt.date !== kstDateKey()) person.rpgAutoHunt = { date: kstDateKey(), count: 0 };
  person.rpgAutoHunt.count += ticketUse;

  const rewardCounts = new Map();
  let rewardCount = 0;
  let blanks = 0;
  let totalSell = 0;
  let rareCount = 0;
  for (let index = 0; index < runs; index += 1) {
    const item = randomDungeonItem(config);
    if (!item) {
      blanks += 1;
      continue;
    }
    rewardCounts.set(item.id, (rewardCounts.get(item.id) || 0) + 1);
    rewardCount += 1;
    totalSell += productSellPrice(item);
    if (rpgRareReward(item)) rareCount += 1;
  }
  addInventoryCounts(person, rewardCounts);
  const craftingBonus = grantAutoDungeonCraftingSupport(roomState, person, config, runs);
  totalSell += craftingBonus.totalSell;
  recordRoomEvent(roomState, {
    type: "rpg_auto_hunt",
    name: person.currentName,
    dungeon: config.title,
    runs,
    tickets: ticketUse,
    rewards: rewardCount + craftingBonus.materialCount,
    blanks,
    totalSell,
    craftingBonusMaterials: craftingBonus.materialCount,
    craftingBonusPoints: craftingBonus.pointBonus
  });
  recordShopTransaction(roomState, {
    type: "rpg_auto_hunt",
    productId: consumedTickets[0]?.productId || AUTO_HUNT_TICKET_ITEM_ID,
    productName: consumedTickets[0]?.product?.name || AUTO_GAME_TICKET_CONFIGS.hunt.name,
    quantity: ticketUse,
    unitPrice: 0,
    totalPrice: totalSell,
    to: person.currentName,
    by: person.currentName
  });
  return [
    "🏰 자동던전 결과",
    `${config.title} ${runs}회 요약`,
    "",
    `획득: ${rewardCount + craftingBonus.materialCount}개 / 꽝 ${blanks}회`,
    `희귀 이상: ${rareCount}개`,
    craftingBonus.materialCount || craftingBonus.pointBonus ? `제작 보너스: 재료 ${craftingBonus.materialCount}개 / 지원금 ${formatPoint(craftingBonus.pointBonus)}` : "",
    `예상 판매가: ${formatPoint(totalSell)}`,
    `제작 가능: ${rpgCraftableCount(person)}개`,
    `남은 ${AUTO_GAME_TICKET_CONFIGS.hunt.name}: ${autoHuntTicketQuantity(roomState, person)}장`
  ].filter(Boolean).join("\n");
}

function autoExploreCommand(roomState, sender, text) {
  const person = ensurePerson(roomState, sender);
  const config = AUTO_GAME_TICKET_CONFIGS.explore;
  const parsed = parseAutoGameCommand(text, /^\/자동(?:탐험|모험)\s*/i);
  const ticketUse = parsed.ticketUse;
  const ticketCount = autoGameTicketQuantity(roomState, person, config);
  if (ticketCount < ticketUse) return autoGameTicketRequiredText(config, ticketUse);
  consumeAutoGameTickets(roomState, person, config, ticketUse);
  const runs = ticketUse * RPG_AUTO_HUNT_RUNS;
  const rewardCounts = new Map();
  let rewardCount = 0;
  let totalSell = 0;
  let rareCount = 0;
  for (let index = 0; index < runs; index += 1) {
    const item = randomExploreProduct();
    rewardCounts.set(item.id, (rewardCounts.get(item.id) || 0) + 1);
    rewardCount += 1;
    totalSell += productSellPrice(item);
    if (rpgRareReward(item)) rareCount += 1;
  }
  addInventoryCounts(person, rewardCounts);
  recordRoomEvent(roomState, { type: "auto_explore", name: person.currentName, runs, tickets: ticketUse, rewards: rewardCount, totalSell });
  recordShopTransaction(roomState, {
    type: "auto_explore",
    productId: AUTO_EXPLORE_TICKET_ITEM_ID,
    productName: config.name,
    quantity: ticketUse,
    totalPrice: totalSell,
    to: person.currentName,
    by: person.currentName
  });
  return [
    "🧭 자동탐험 결과",
    `${runs}회 요약`,
    "",
    `획득: ${rewardCount}개`,
    `희귀 이상: ${rareCount}개`,
    `예상 판매가: ${formatPoint(totalSell)}`,
    `남은 자동탐험권: ${autoGameTicketQuantity(roomState, person, config)}장`
  ].join("\n");
}

function autoFishingCommand(roomState, sender, text) {
  const person = ensurePerson(roomState, sender);
  const config = AUTO_GAME_TICKET_CONFIGS.fishing;
  const parsed = parseAutoGameCommand(text, /^\/자동낚시\s*/i);
  const ticketUse = parsed.ticketUse;
  const ticketCount = autoGameTicketQuantity(roomState, person, config);
  if (ticketCount < ticketUse) return autoGameTicketRequiredText(config, ticketUse);
  const runs = ticketUse * RPG_AUTO_HUNT_RUNS;
  const baitCount = inventoryQuantity(person, BAIT_ITEM_ID);
  if (baitCount < runs) {
    return [
      "🎣 자동낚시 준비 필요",
      "",
      `필요 미끼: ${runs}개`,
      `보유 미끼: ${baitCount}개`,
      "미끼 구매: /미끼구매 수량"
    ].join("\n");
  }
  consumeAutoGameTickets(roomState, person, config, ticketUse);
  removeInventory(person, BAIT_ITEM_ID, runs);
  const rewardCounts = new Map();
  let rewardCount = 0;
  let totalSell = 0;
  let rareCount = 0;
  for (let index = 0; index < runs; index += 1) {
    const item = randomFishProduct();
    rewardCounts.set(item.id, (rewardCounts.get(item.id) || 0) + 1);
    rewardCount += 1;
    totalSell += productSellPrice(item);
    if (rpgRareReward(item)) rareCount += 1;
  }
  addInventoryCounts(person, rewardCounts);
  recordRoomEvent(roomState, { type: "auto_fishing", name: person.currentName, runs, tickets: ticketUse, rewards: rewardCount, totalSell });
  recordShopTransaction(roomState, {
    type: "auto_fishing",
    productId: AUTO_FISHING_TICKET_ITEM_ID,
    productName: config.name,
    quantity: ticketUse,
    totalPrice: totalSell,
    to: person.currentName,
    by: person.currentName
  });
  return [
    "🎣 자동낚시 결과",
    `${runs}회 요약`,
    "",
    `획득: ${rewardCount}마리`,
    `희귀 이상: ${rareCount}마리`,
    `예상 판매가: ${formatPoint(totalSell)}`,
    `남은 자동낚시권: ${autoGameTicketQuantity(roomState, person, config)}장`,
    `남은 미끼: ${inventoryQuantity(person, BAIT_ITEM_ID)}개`
  ].join("\n");
}

function autoLuckyDrawCommand(roomState, sender, text) {
  const person = ensurePerson(roomState, sender);
  const config = AUTO_GAME_TICKET_CONFIGS.draw;
  const parsed = parseAutoGameCommand(text, /^\/자동뽑기\s*/i);
  const ticketUse = parsed.ticketUse;
  const ticketCount = autoGameTicketQuantity(roomState, person, config);
  if (ticketCount < ticketUse) return autoGameTicketRequiredText(config, ticketUse);
  const runs = ticketUse * RPG_AUTO_HUNT_RUNS;
  const totalCost = LUCKY_DRAW_POINT_COST * runs;
  if (person.points < totalCost) {
    return [
      "💰 자동뽑기 포인트 부족",
      "",
      `필요 포인트: ${formatPoint(totalCost)}`,
      `보유 포인트: ${formatPoint(person.points)}`
    ].join("\n");
  }
  consumeAutoGameTickets(roomState, person, config, ticketUse);
  person.points -= totalCost;
  person.spentPoints += totalCost;
  let totalReward = 0;
  const outcomeCounts = {};
  for (let index = 0; index < runs; index += 1) {
    const roll = Math.random();
    const outcome = LUCKY_DRAW_OUTCOMES.find((item) => roll < item.threshold) || LUCKY_DRAW_OUTCOMES.at(-1);
    totalReward += outcome.reward;
    outcomeCounts[outcome.label] = (outcomeCounts[outcome.label] || 0) + 1;
  }
  person.points += totalReward;
  recordRoomEvent(roomState, { type: "auto_lucky_draw", name: person.currentName, runs, tickets: ticketUse, cost: totalCost, reward: totalReward });
  recordShopTransaction(roomState, {
    type: "auto_lucky_draw",
    productId: AUTO_DRAW_TICKET_ITEM_ID,
    productName: config.name,
    quantity: ticketUse,
    unitPrice: LUCKY_DRAW_POINT_COST,
    totalPrice: totalCost,
    to: person.currentName,
    by: person.currentName
  });
  const outcomeSummary = Object.entries(outcomeCounts).map(([label, count]) => `${label} ${count}회`).join(" / ");
  return [
    "🎲 자동뽑기 결과",
    `${runs}회 요약`,
    "",
    `결과: ${outcomeSummary}`,
    `사용: ${formatPoint(totalCost)} / 획득: ${formatPoint(totalReward)}`,
    `남은 자동뽑기권: ${autoGameTicketQuantity(roomState, person, config)}장`,
    `남은 포인트: ${formatPoint(person.points)}`
  ].join("\n");
}

function rewardChoiceCommand(roomState, sender, text) {
  const person = ensurePerson(roomState, sender);
  const pending = normalizePendingRpgReward(person.pendingRpgReward);
  person.pendingRpgReward = pending;
  if (!pending) {
    return [
      "🎁 보상 선택",
      "선택 가능한 보상이 없습니다.",
      "던전에서 보물상자를 발견하면 /보상선택 재료|포인트|강화재료 를 사용할 수 있습니다."
    ].join("\n");
  }
  const body = compactSpaces(text.replace(/^\/보상선택\s*/i, ""));
  const choice = pending.choices.find((item) => keyFor(item) === keyFor(body)) || "";
  if (!choice) return `보상 선택: ${pending.choices.join(" / ")}`;
  let result = "";
  if (choice === "포인트") {
    person.points += 120;
    result = `포인트 ${formatPoint(120)}`;
  } else if (choice === "강화재료") {
    const qty = addInventory(person, ENHANCEMENT_STONE_ITEM_ID, 1);
    result = `강화석 x ${qty}`;
  } else {
    const item = randomDungeonItem(DUNGEON_CONFIGS[0]) || systemProductById(RPG_ITEM_ID_START);
    const qty = addInventory(person, item.id, 1);
    result = `${item.name} x ${qty}`;
  }
  person.pendingRpgReward = null;
  recordRoomEvent(roomState, { type: "rpg_reward_choice", name: person.currentName, choice, result });
  return ["🎁 보상 선택 완료", `선택: ${choice}`, `획득: ${result}`].join("\n");
}

function rpgAdventureHubCommand(roomState, sender) {
  const person = ensurePerson(roomState, sender);
  const displayName = displayNameForPerson(roomState, person, sender);
  const ticketCount = autoHuntTicketQuantity(roomState, person);
  const exploreTicketCount = autoGameTicketQuantity(roomState, person, AUTO_GAME_TICKET_CONFIGS.explore);
  const fishingTicketCount = autoGameTicketQuantity(roomState, person, AUTO_GAME_TICKET_CONFIGS.fishing);
  const drawTicketCount = autoGameTicketQuantity(roomState, person, AUTO_GAME_TICKET_CONFIGS.draw);
  const craftableCount = rpgCraftableCount(person);
  const equipped = rpgEquippedProductsBySlot(person);
  const enhanceTarget = equipped.weapon || equipped.armor || equipped.accessory;
  const enhanceText = enhanceTarget
    ? `${rpgEquipmentName(person, enhanceTarget)}`
    : "장비 없음";
  const cooldown = gameCooldownText(person, "dungeon") || "바로 가능";
  return [
    `🏰 ${displayName}님의 RPG 모험`,
    `오늘 할 일: /던전 → /제작가능 → /강화목록`,
    `${AUTO_GAME_TICKET_CONFIGS.hunt.name}: ${ticketCount}장 · 자동탐험권 ${exploreTicketCount}장 · 자동낚시권 ${fishingTicketCount}장 · 자동뽑기권 ${drawTicketCount}장`,
    `제작 가능: ${craftableCount}개 · 강화 추천: ${enhanceText}`,
    `던전 상태: ${cooldown}`,
    "대량 실행: /자동던전 상급 10 · 추천 행동: /자동장착 공격"
  ].join("\n");
}

function rpgRecipeMaterials(recipe) {
  if (Array.isArray(recipe.materials) && recipe.materials.length) {
    return recipe.materials.map((item) => ({
      id: Math.trunc(Number(item.id || 0)),
      qty: Math.max(1, Math.trunc(Number(item.qty || 1)))
    })).filter((item) => item.id);
  }
  return [{ id: recipe.materialId, qty: recipe.materialQty }];
}

function rpgMaterialText(recipe, person = null) {
  return rpgRecipeMaterials(recipe).map((item) => {
    const material = systemProductById(item.id);
    const owned = person ? `(${inventoryQuantity(person, item.id)}/${item.qty})` : "";
    return `${material?.name || `#${item.id}`} x ${item.qty}${owned}`;
  }).join(", ");
}

function rpgRecipeCanCraft(person, recipe) {
  if (!person || !recipe) return false;
  const hasMaterials = rpgRecipeMaterials(recipe).every((item) => inventoryQuantity(person, item.id) >= item.qty);
  return hasMaterials && Number(person.points || 0) >= Number(recipe.pointCost || 0);
}

function rpgCraftableCount(person) {
  return RPG_WEAPON_RECIPES.filter((recipe) => rpgRecipeCanCraft(person, recipe)).length;
}

function rpgRecipeDisplayNo(recipe) {
  const index = RPG_WEAPON_RECIPES.findIndex((item) => item.itemId === recipe?.itemId);
  return index >= 0 ? index + 1 : 0;
}

function rpgRecipeLine(recipe, person = null) {
  const slot = RPG_EQUIPMENT_SLOT_LABELS[recipe.slot || "weapon"] || "장비";
  const setName = recipe.setId ? ` / ${RPG_EQUIPMENT_SETS[recipe.setId]?.name || "세트"}` : "";
  const craftable = person ? (rpgRecipeCanCraft(person, recipe) ? "제작 가능" : "재료 부족") : "";
  const craftableText = craftable ? ` / ${craftable}` : "";
  const displayNo = rpgRecipeDisplayNo(recipe) || "?";
  return `${displayNo}. [${slot}${setName}] ${recipe.name} - ${rpgMaterialText(recipe, person)} + ${formatPoint(recipe.pointCost)} / 전투력 +${recipe.power}${craftableText}`;
}

function rpgRecipeFromCraftText(text = "") {
  const body = compactSpaces(text.replace(/^\/제작\s*/i, ""));
  const raw = body.replace(/,/g, "");
  const numeric = Math.trunc(Number(raw));
  if (!body || !numeric || String(numeric) !== raw) return null;
  if (numeric >= 1000) return RPG_WEAPON_RECIPES.find((item) => item.itemId === numeric) || null;
  return RPG_WEAPON_RECIPES[numeric - 1] || null;
}

function blacksmithCommand(roomState = null, sender = "") {
  const person = roomState && sender ? ensurePerson(roomState, sender) : null;
  const craftableCount = person ? rpgCraftableCount(person) : 0;
  return [
    "픽셀곰 대장간",
    "제작 종류: 무기 / 방어구 / 장신구 / 세트",
    `확장 제작식: ${RPG_WEAPON_RECIPES.length}종`,
    person ? `지금 제작 가능: ${craftableCount}개` : "지금 제작 가능: /제작가능",
    "제작: /제작가능 → /제작 1 · 자동 제작: /자동제작",
    "강화 추천: /강화목록 · 세트 보너스: /세트아이템"
  ].join("\n");
}

function craftRpgRecipe(roomState, person, recipe) {
  for (const material of rpgRecipeMaterials(recipe)) {
    removeInventory(person, material.id, material.qty);
  }
  person.points -= recipe.pointCost;
  person.spentPoints += recipe.pointCost;
  const quantity = addInventory(person, recipe.itemId, 1);
  const product = systemProductById(recipe.itemId);
  const autoEquipped = autoEquipIfBetter(person, product);
  recordShopTransaction(roomState, {
    type: "equipment_crafted",
    productId: recipe.itemId,
    productName: recipe.name,
    quantity: 1,
    unitPrice: recipe.pointCost,
    totalPrice: recipe.pointCost,
    to: person.currentName,
    by: person.currentName
  });
  return { quantity, product, autoEquipped };
}

function craftWeaponCommand(roomState, sender, text) {
  const recipe = rpgRecipeFromCraftText(text);
  if (!recipe) return "형식: /제작 1";
  const person = ensurePerson(roomState, sender);
  const missingMaterials = rpgRecipeMaterials(recipe).filter((item) => inventoryQuantity(person, item.id) < item.qty);
  if (missingMaterials.length) {
    return [
      "재료가 부족합니다.",
      "",
      ...missingMaterials.map((item) => {
        const material = systemProductById(item.id);
        return `• ${material?.name || `#${item.id}`} : ${inventoryQuantity(person, item.id)}/${item.qty}`;
      }),
      "",
      "/제작가능 으로 지금 만들 수 있는 장비를 확인하세요."
    ].join("\n");
  }
  if (person.points < recipe.pointCost) {
    return [
      "포인트가 부족합니다.",
      "",
      `• 필요 포인트 : ${formatPoint(recipe.pointCost)}`,
      `• 보유 포인트 : ${formatPoint(person.points)}`
    ].join("\n");
  }
  const { quantity, autoEquipped } = craftRpgRecipe(roomState, person, recipe);
  return [
    "제작 완료",
    "",
    `• 장비 : ${recipe.name}`,
    `• 종류 : ${RPG_EQUIPMENT_SLOT_LABELS[recipe.slot || "weapon"] || "장비"}`,
    `• 보유 수량 : ${quantity}개`,
    `• 사용 포인트 : ${formatPoint(recipe.pointCost)}`,
    autoEquipped ? `• 자동 장착 : ${recipe.name}` : "• 자동 장착 : 현재 장비가 더 강해 가방에 보관"
  ].join("\n");
}

function autoCraftCandidateRecipes(person) {
  normalizePersonState(person);
  return RPG_WEAPON_RECIPES
    .filter((recipe) => rpgRecipeCanCraft(person, recipe))
    .map((recipe) => {
      const product = systemProductById(recipe.itemId);
      const slot = rpgEquipmentSlot(product);
      const score = rpgScoreProductForPerson(person, product, "balance");
      return { recipe, product, slot, score };
    })
    .filter((item) => item.slot)
    .sort((left, right) => (
      right.score - left.score
      || Number(right.recipe.power || 0) - Number(left.recipe.power || 0)
      || Number(right.recipe.itemId || 0) - Number(left.recipe.itemId || 0)
    ));
}

function autoCraftEquipmentCommand(roomState, sender) {
  const person = ensurePerson(roomState, sender);
  const crafted = [];
  const craftedSlots = new Set();
  while (craftedSlots.size < 3) {
    const next = autoCraftCandidateRecipes(person).find((item) => !craftedSlots.has(item.slot));
    if (!next) break;
    const result = craftRpgRecipe(roomState, person, next.recipe);
    crafted.push({ ...next, ...result });
    craftedSlots.add(next.slot);
  }
  if (!crafted.length) {
    return [
      "자동제작할 장비가 없습니다.",
      "현재 재료와 포인트로 제작 가능한 장비가 없습니다.",
      "",
      "확인: /제작가능",
      "재료 획득: /던전 또는 /자동던전"
    ].join("\n");
  }
  const autoEquippedCount = crafted.filter((item) => item.autoEquipped).length;
  return [
    "자동제작 완료",
    "",
    `제작 ${crafted.length}개 / 자동 장착 ${autoEquippedCount}개`,
    ...crafted.map((item) => `• ${RPG_EQUIPMENT_SLOT_LABELS[item.slot] || "장비"}: ${item.recipe.name}`),
    "",
    `보유 포인트 : ${formatPoint(person.points)}`,
    "장비 확인: /장비"
  ].join("\n");
}

function craftableEquipmentCommand(roomState, sender) {
  const person = ensurePerson(roomState, sender);
  const craftable = RPG_WEAPON_RECIPES
    .filter((recipe) => rpgRecipeCanCraft(person, recipe))
    .sort((left, right) => (
      Number(right.power || 0) - Number(left.power || 0)
      || Number(right.itemId || 0) - Number(left.itemId || 0)
    ));
  const visible = craftable.slice(0, 4);
  return [
    "제작 가능 목록",
    ...(craftable.length
      ? visible.map((recipe) => rpgRecipeLine(recipe, person))
      : ["현재 제작 가능한 장비가 없습니다. /던전에서 재료를 모아주세요."]),
    craftable.length > visible.length ? `외 ${craftable.length - visible.length}개 · 전체 제작식: /대장간` : "전체 제작식: /대장간",
    `포인트: ${formatPoint(person.points)} · 세트: /세트아이템 · 자동: /자동제작`
  ].join("\n");
}

function rpgEquipmentSlot(product) {
  if (!product) return "";
  if (["weapon", "armor", "accessory"].includes(product.slot)) return product.slot;
  if (["weapon", "armor", "accessory"].includes(product.category)) return product.category;
  return "";
}

function rpgStatSummary(stats = {}, keys = RPG_STAT_KEYS, limit = 6) {
  const normalized = normalizeRpgStats(stats);
  const rows = keys
    .map((key) => ({ key, value: normalized[key] || 0 }))
    .filter((item) => item.value !== 0)
    .slice(0, limit)
    .map((item) => `${RPG_STAT_LABELS[item.key]} +${item.value}`);
  return rows.join(" / ") || "능력치 없음";
}

function rpgCombinedStats(products = []) {
  const total = emptyRpgStats();
  for (const product of products.filter(Boolean)) {
    const stats = rpgEquipmentStats(product);
    for (const key of RPG_STAT_KEYS) total[key] += stats[key] || 0;
  }
  return total;
}

function rpgEquippedProductsBySlot(person) {
  person.equipment = normalizeEquipment(person.equipment || {});
  return {
    weapon: systemProductById(person.equipment.weapon),
    armor: systemProductById(person.equipment.armor),
    accessory: systemProductById(person.equipment.accessory)
  };
}

function rpgEnhancementLevel(person, productId) {
  normalizePersonState(person);
  return Math.min(RPG_MAX_ENHANCEMENT_LEVEL, Math.max(0, Math.trunc(Number(person.equipmentEnhancements?.[String(productId)] || 0))));
}

function rpgEnhancementStats(product, level = 0) {
  const stats = emptyRpgStats();
  const safeLevel = Math.min(RPG_MAX_ENHANCEMENT_LEVEL, Math.max(0, Math.trunc(Number(level || 0))));
  if (!product || safeLevel <= 0) return stats;
  const slot = rpgEquipmentSlot(product);
  if (slot === "weapon") {
    stats.attack = safeLevel * 2;
    stats.crit = Math.floor(safeLevel / 2);
  } else if (slot === "armor") {
    stats.defense = safeLevel * 2;
    stats.hp = safeLevel * 12;
    stats.magicDefense = Math.floor(safeLevel / 2);
  } else if (slot === "accessory") {
    stats.agility = safeLevel;
    stats.accuracy = safeLevel;
    stats.evasion = Math.floor(safeLevel / 2);
  }
  return stats;
}

function rpgStatsWithEnhancement(person, product) {
  const base = rpgEquipmentStats(product);
  const bonus = rpgEnhancementStats(product, rpgEnhancementLevel(person, product?.id));
  const merged = emptyRpgStats();
  for (const key of RPG_STAT_KEYS) merged[key] = (base[key] || 0) + (bonus[key] || 0);
  return merged;
}

function rpgEquipmentName(person, product) {
  if (!product) return "미장착";
  const level = rpgEnhancementLevel(person, product.id);
  return `${product.name}${level ? ` +${level}` : ""}`;
}

function rpgScoreProductForPerson(person, product, presetKey = "balance") {
  const preset = RPG_AUTO_EQUIP_PRESETS[presetKey] || RPG_AUTO_EQUIP_PRESETS.balance;
  const weights = preset.weights || {};
  const stats = rpgStatsWithEnhancement(person, product);
  return RPG_STAT_KEYS.reduce((sum, key) => sum + ((stats[key] || 0) * (weights[key] ?? 0.4)), Number(product?.power || 0) * 0.5);
}

function rpgPresetFromText(value = "") {
  const key = keyFor(value || "balance");
  if (!key || key === "기본" || key === "자동") return "balance";
  for (const [presetKey, preset] of Object.entries(RPG_AUTO_EQUIP_PRESETS)) {
    if (presetKey === key || keyFor(preset.label) === key || (preset.aliases || []).some((alias) => keyFor(alias) === key)) return presetKey;
  }
  return "balance";
}

function rpgScoreProduct(product, presetKey = "balance") {
  const preset = RPG_AUTO_EQUIP_PRESETS[presetKey] || RPG_AUTO_EQUIP_PRESETS.balance;
  const weights = preset.weights || {};
  const stats = rpgEquipmentStats(product);
  return RPG_STAT_KEYS.reduce((sum, key) => sum + ((stats[key] || 0) * (weights[key] ?? 0.4)), Number(product?.power || 0) * 0.5);
}

function rpgStatDiffSummary(before = {}, after = {}, keys = RPG_STAT_KEYS, limit = 4) {
  const rows = [];
  for (const key of keys) {
    const diff = Math.trunc(Number(after[key] || 0)) - Math.trunc(Number(before[key] || 0));
    if (!diff) continue;
    rows.push(`${RPG_STAT_LABELS[key]} ${diff > 0 ? "+" : ""}${diff}`);
  }
  return rows.slice(0, limit).join(" / ") || "변화 없음";
}

function rpgCurrentStats(person) {
  const equipped = rpgEquippedProductsBySlot(person);
  const stats = emptyRpgStats();
  for (const product of Object.values(equipped).filter(Boolean)) {
    const productStats = rpgStatsWithEnhancement(person, product);
    for (const key of RPG_STAT_KEYS) stats[key] += productStats[key] || 0;
  }
  const setBonus = rpgSetBonusSummary(person);
  if (setBonus.totalBonus) {
    stats.attack += setBonus.totalBonus;
    stats.defense += Math.floor(setBonus.totalBonus / 2);
  }
  return stats;
}

function rpgEquipmentComparison(currentProduct, nextProduct) {
  const before = currentProduct ? rpgEquipmentStats(currentProduct) : emptyRpgStats();
  const after = nextProduct ? rpgEquipmentStats(nextProduct) : emptyRpgStats();
  return rpgStatDiffSummary(before, after, ["attack", "defense", "agility", "hp", "mp", "magicAttack", "magicDefense", "crit", "evasion", "accuracy", "skillEffect"], 4);
}

function autoEquipIfBetter(person, product) {
  const slot = rpgEquipmentSlot(product);
  if (!slot) return false;
  person.equipment = normalizeEquipment(person.equipment || {});
  const current = systemProductById(person.equipment[slot]);
  if (!current || rpgScoreProductForPerson(person, product, "balance") > rpgScoreProductForPerson(person, current, "balance")) {
    person.equipment[slot] = String(product.id);
    return true;
  }
  return false;
}

function autoEquipBestEquipment(person, presetKey = "balance") {
  normalizePersonState(person);
  person.equipment = normalizeEquipment(person.equipment || {});
  const beforeStats = rpgCurrentStats(person);
  const beforeEquipment = rpgEquippedProductsBySlot(person);
  const changes = [];
  for (const slot of ["weapon", "armor", "accessory"]) {
    const candidates = Object.entries(person.inventory || {})
      .filter(([, quantity]) => Math.trunc(Number(quantity || 0)) > 0)
      .map(([productId]) => systemProductById(productId))
      .filter((product) => rpgEquipmentSlot(product) === slot)
      .sort((left, right) => rpgScoreProductForPerson(person, right, presetKey) - rpgScoreProductForPerson(person, left, presetKey));
    const best = candidates[0];
    if (best && String(person.equipment[slot] || "") !== String(best.id)) {
      changes.push({
        slot,
        from: rpgEquipmentName(person, beforeEquipment[slot]),
        to: rpgEquipmentName(person, best)
      });
      person.equipment[slot] = String(best.id);
    }
  }
  const afterStats = rpgCurrentStats(person);
  return {
    presetKey,
    preset: RPG_AUTO_EQUIP_PRESETS[presetKey] || RPG_AUTO_EQUIP_PRESETS.balance,
    changes,
    beforeStats,
    afterStats
  };
}

function equippedRpgProducts(person) {
  person.equipment = normalizeEquipment(person.equipment || {});
  return ["weapon", "armor", "accessory"]
    .map((slot) => ({ slot, product: systemProductById(person.equipment?.[slot]) }))
    .filter((item) => item.product);
}

function rpgSetBonusSummary(person) {
  const counts = {};
  for (const { product } of equippedRpgProducts(person)) {
    if (!product.setId) continue;
    counts[product.setId] = (counts[product.setId] || 0) + 1;
  }
  const active = [];
  let totalBonus = 0;
  for (const [setId, count] of Object.entries(counts)) {
    const set = RPG_EQUIPMENT_SETS[setId];
    if (!set) continue;
    const bonusCount = Object.keys(set.bonuses).map(Number).filter((need) => count >= need).sort((a, b) => b - a)[0] || 0;
    const bonus = bonusCount ? Number(set.bonuses[bonusCount] || 0) : 0;
    if (bonus > 0) {
      totalBonus += bonus;
      active.push(`${set.name} ${bonusCount}세트 +${bonus}`);
    }
  }
  return { totalBonus, active };
}

function equipmentCommand(roomState, sender) {
  const person = ensurePerson(roomState, sender);
  const displayName = displayNameForPerson(roomState, person, sender);
  const weapon = systemProductById(person.equipment?.weapon);
  const armor = systemProductById(person.equipment?.armor);
  const accessory = systemProductById(person.equipment?.accessory);
  const setBonus = rpgSetBonusSummary(person);
  const stats = rpgCurrentStats(person);
  return [
    `⚔️ ${displayName}님의 장비`,
    `장비: 무기 ${rpgEquipmentName(person, weapon)} / 방어구 ${rpgEquipmentName(person, armor)} / 장신구 ${rpgEquipmentName(person, accessory)}`,
    `세트 효과: ${setBonus.active.length ? setBonus.active.join(", ") : "없음"}`,
    `총 전투력: +${Math.round(Object.values(stats).reduce((sum, value) => sum + Number(value || 0), 0))} · 핵심 스탯: ${rpgStatSummary(stats, ["attack", "defense", "agility", "hp", "mp", "magicAttack"], 4)}`,
    "강화: /강화목록 · 상세: /장비상세",
    "자동 추천: /자동장착 공격"
  ].join("\n");
}

function equipWeaponCommand(roomState, sender, text) {
  const person = ensurePerson(roomState, sender);
  const body = compactSpaces(text.replace(/^\/장착\s*/i, ""));
  const row = resolveInventoryRow(roomState, person, body, (item) => Boolean(rpgEquipmentSlot(inventoryProductById(roomState, item.productId))));
  if (!row) return ["❌ 명령어를 확인해 주세요.", "사용 예시:", " /장착 1", " /장착 철검", " /자동장착 공격"].join("\n");
  const product = systemProductById(row.productId);
  const slot = rpgEquipmentSlot(product);
  const current = systemProductById(person.equipment?.[slot]);
  const comparison = rpgEquipmentComparison(current, product);
  person.equipment[slot] = String(row.productId);
  return [
    "⚔️ 장착 완료",
    "",
    `• 종류 : ${RPG_EQUIPMENT_SLOT_LABELS[slot] || "장비"}`,
    `• 장비 : ${product.name}`,
    `• 비교 : ${comparison}`
  ].join("\n");
}

function autoEquipCommand(roomState, sender, text) {
  const person = ensurePerson(roomState, sender);
  const presetKey = rpgPresetFromText(text.replace(/^\/자동장착\s*/i, ""));
  const result = autoEquipBestEquipment(person, presetKey);
  const focus = result.preset.focus || ["attack", "defense", "hp"];
  const diff = rpgStatDiffSummary(result.beforeStats, result.afterStats, focus, 4);
  return [
    "⚔️ 자동장착 완료",
    "",
    `• 기준 : ${result.preset.label}`,
    ...(result.changes.length ? result.changes.map((item) => `${RPG_EQUIPMENT_SLOT_LABELS[item.slot] || "장비"}: ${item.from} → ${item.to}`) : ["변경: 현재 장비가 가장 적합합니다."]),
    `• 변화 : ${diff}`,
    `• 기준 스탯 : ${rpgStatSummary(result.afterStats, focus, 3)}`
  ].join("\n");
}

function rpgEnhancementCost(level = 0) {
  const nextLevel = Math.min(RPG_MAX_ENHANCEMENT_LEVEL, Math.max(1, Math.trunc(Number(level || 0)) + 1));
  return {
    nextLevel,
    materialId: nextLevel >= 4 ? ENHANCEMENT_STONE_ITEM_ID : RPG_ITEM_ID_START,
    materialQty: nextLevel >= 4 ? Math.ceil(nextLevel / 2) : nextLevel + 1,
    pointCost: nextLevel * 80,
    successRate: nextLevel <= 3 ? 1 : Math.max(0.45, 0.95 - (nextLevel * 0.05))
  };
}

function rpgEnhancementRecommendations(person) {
  normalizePersonState(person);
  const equipped = rpgEquippedProductsBySlot(person);
  const rows = [];
  for (const slot of ["weapon", "armor", "accessory"]) {
    const product = equipped[slot];
    if (product) rows.push({ slot, product, source: "equipped" });
  }
  for (const [productId, quantity] of Object.entries(person.inventory || {})) {
    if (rows.some((row) => String(row.product.id) === String(productId))) continue;
    if (Math.trunc(Number(quantity || 0)) <= 0) continue;
    const product = systemProductById(productId);
    if (product && rpgEquipmentSlot(product)) rows.push({ slot: rpgEquipmentSlot(product), product, source: "inventory" });
  }
  return rows
    .sort((left, right) => rpgScoreProductForPerson(person, right.product, "balance") - rpgScoreProductForPerson(person, left.product, "balance"))
    .slice(0, 8);
}

function rpgEnhanceTarget(roomState, person, text = "") {
  const body = compactSpaces(text.replace(/^\/강화\s*/i, ""));
  const equipped = rpgEquippedProductsBySlot(person);
  const slotAliases = {
    "": "weapon",
    무기: "weapon",
    검: "weapon",
    방어구: "armor",
    갑옷: "armor",
    장신구: "accessory",
    악세: "accessory",
    액세서리: "accessory"
  };
  const slot = slotAliases[keyFor(body)];
  if (slot) return equipped[slot] ? { slot, product: equipped[slot] } : null;

  const numeric = Math.trunc(Number(body.replace(/,/g, "")));
  if (numeric > 0 && String(numeric) === body.replace(/,/g, "")) {
    const recommendations = rpgEnhancementRecommendations(person);
    if (numeric < 1000 && recommendations[numeric - 1]) return recommendations[numeric - 1];
    const product = systemProductById(numeric);
    if (product && rpgEquipmentSlot(product) && inventoryQuantity(person, numeric) > 0) return { slot: rpgEquipmentSlot(product), product };
  }

  const row = resolveInventoryRow(roomState, person, body, (item) => Boolean(rpgEquipmentSlot(inventoryProductById(roomState, item.productId))));
  if (!row) return null;
  const product = systemProductById(row.productId);
  return product ? { slot: rpgEquipmentSlot(product), product } : null;
}

function rpgEnhancementListCommand(roomState, sender) {
  const person = ensurePerson(roomState, sender);
  const rows = rpgEnhancementRecommendations(person).slice(0, 3);
  return [
    "🛠️ 강화 추천",
    "",
    ...(rows.length ? rows.map((row, index) => {
      const level = rpgEnhancementLevel(person, row.product.id);
      const cost = rpgEnhancementCost(level);
      const material = systemProductById(cost.materialId);
      return `${index + 1}. ${rpgEquipmentName(person, row.product)} / 다음 +${cost.nextLevel} / ${material?.name || "재료"} x${cost.materialQty} + ${formatPoint(cost.pointCost)}`;
    }) : ["강화할 장비가 없습니다. /던전과 /제작가능으로 장비를 먼저 준비해 주세요."]),
    "",
    "실행: /강화 1 또는 /강화 무기",
    "상세: /강화상세"
  ].join("\n");
}

function rpgEnhancementDetailCommand(roomState, sender) {
  const person = ensurePerson(roomState, sender);
  const rows = rpgEnhancementRecommendations(person).slice(0, 5);
  return [
    "🛠️ 강화 상세",
    "",
    ...(rows.length ? rows.map((row, index) => {
      const level = rpgEnhancementLevel(person, row.product.id);
      const cost = rpgEnhancementCost(level);
      const material = systemProductById(cost.materialId);
      return `${index + 1}. ${rpgEquipmentName(person, row.product)} → +${cost.nextLevel} / 성공률 ${Math.round(cost.successRate * 100)}% / ${material?.name || "재료"} ${inventoryQuantity(person, cost.materialId)}/${cost.materialQty} / ${formatPoint(cost.pointCost)}`;
    }) : ["강화할 장비가 없습니다."]),
    "",
    "실패해도 장비는 파괴되지 않습니다.",
    "단, 재료와 포인트는 사용됩니다."
  ].join("\n");
}

function rpgEnhanceCommand(roomState, sender, text) {
  const person = ensurePerson(roomState, sender);
  const target = rpgEnhanceTarget(roomState, person, text);
  if (!target?.product) return "강화할 장비를 찾지 못했습니다.\n사용 예시: /강화 1, /강화 무기";
  const level = rpgEnhancementLevel(person, target.product.id);
  if (level >= RPG_MAX_ENHANCEMENT_LEVEL) return `${rpgEquipmentName(person, target.product)}은 이미 최대 강화입니다.`;
  const cost = rpgEnhancementCost(level);
  const material = systemProductById(cost.materialId);
  if (inventoryQuantity(person, cost.materialId) < cost.materialQty) {
    return [
      "⚠️ 강화 재료가 부족합니다.",
      `${material?.name || "재료"}: ${inventoryQuantity(person, cost.materialId)}/${cost.materialQty}`,
      "재료 획득: /던전 또는 /자동던전"
    ].join("\n");
  }
  if (person.points < cost.pointCost) {
    return [
      "⚠️ 포인트가 부족합니다.",
      `필요: ${formatPoint(cost.pointCost)}`,
      `보유: ${formatPoint(person.points)}`
    ].join("\n");
  }
  removeInventory(person, cost.materialId, cost.materialQty);
  person.points -= cost.pointCost;
  person.spentPoints += cost.pointCost;
  const success = Math.random() <= cost.successRate;
  if (success) person.equipmentEnhancements[String(target.product.id)] = cost.nextLevel;
  recordRoomEvent(roomState, {
    type: success ? "rpg_equipment_enhanced" : "rpg_equipment_enhance_failed",
    name: person.currentName,
    productId: target.product.id,
    productName: target.product.name,
    level: success ? cost.nextLevel : level,
    costPoint: cost.pointCost
  });
  if (!success) {
    return [
      "🛠️ 강화 실패",
      `${target.product.name} +${level} 유지`,
      "장비는 파괴되지 않습니다.",
      `남은 포인트: ${formatPoint(person.points)}`
    ].join("\n");
  }
  return [
    "🛠️ 강화 완료",
    `${target.product.name} +${cost.nextLevel}`,
    `사용: ${material?.name || "재료"} x${cost.materialQty}, ${formatPoint(cost.pointCost)}`,
    `남은 포인트: ${formatPoint(person.points)}`,
    "스탯 확인: /장비"
  ].join("\n");
}

function equipmentDetailCommand(roomState, sender) {
  const person = ensurePerson(roomState, sender);
  const displayName = displayNameForPerson(roomState, person, sender);
  const equipped = rpgEquippedProductsBySlot(person);
  const setBonus = rpgSetBonusSummary(person);
  return [
    `🛡️ ${displayName}님의 장비 상세`,
    "",
    ...["weapon", "armor", "accessory"].map((slot) => {
      const product = equipped[slot];
      return `${RPG_EQUIPMENT_SLOT_LABELS[slot]}: ${product ? `${rpgEquipmentName(person, product)} / ${rpgStatSummary(rpgStatsWithEnhancement(person, product), RPG_STAT_KEYS, 5)}` : "미장착"}`;
    }),
    "",
    `세트: ${setBonus.active.length ? setBonus.active.join(", ") : "없음"}`,
    "스탯 전체: /스탯"
  ].join("\n");
}

function rpgStatsCommand(roomState, sender) {
  const person = ensurePerson(roomState, sender);
  const displayName = displayNameForPerson(roomState, person, sender);
  const stats = rpgCurrentStats(person);
  return [
    `📈 ${displayName}님의 스탯`,
    "",
    `공격력 ${stats.attack} / 방어력 ${stats.defense} / 민첩 ${stats.agility}`,
    `HP ${stats.hp} / MP ${stats.mp}`,
    `마법 공격력 ${stats.magicAttack} / 마법 방어력 ${stats.magicDefense}`,
    `치명타 ${stats.crit} / 회피 ${stats.evasion} / 명중 ${stats.accuracy}`,
    `스킬 효과 ${stats.skillEffect}`
  ].join("\n");
}

function rpgSetItemsCommand() {
  const sets = Object.values(RPG_EQUIPMENT_SETS);
  return [
    "RPG 세트 아이템",
    sets.slice(0, 2).map((set) => set.name).join(" · "),
    sets.slice(2, 4).map((set) => set.name).join(" · "),
    sets.slice(4, 6).map((set) => set.name).join(" · "),
    sets.slice(6, 8).map((set) => set.name).join(" · "),
    "보너스: 2세트/3세트 장착 시 전투력 추가",
    "제작식: /대장간 · 지금 가능한 제작: /제작가능"
  ].join("\n");
}

function monsterRegionFromText(text = "") {
  const body = compactSpaces(text.replace(/^\/몬스터탐험\s*/i, ""));
  const key = body ? keyFor(body) : "랜덤";
  if (["숲", "forest"].includes(key)) return PIXEL_MONSTER_REGIONS.숲;
  if (["동굴", "굴", "cave"].includes(key)) return PIXEL_MONSTER_REGIONS.동굴;
  if (["바다", "해변", "sea", "ocean"].includes(key)) return PIXEL_MONSTER_REGIONS.바다;
  if (["화산", "volcano"].includes(key)) return PIXEL_MONSTER_REGIONS.화산;
  return PIXEL_MONSTER_REGIONS.랜덤;
}

function randomPixelMonsterSpecies(region = PIXEL_MONSTER_REGIONS.랜덤) {
  const pool = region?.elements?.length
    ? PIXEL_MONSTER_SPECIES.filter((species) => region.elements.includes(species.element))
    : PIXEL_MONSTER_SPECIES;
  return pool[Math.floor(Math.random() * pool.length)] || PIXEL_MONSTER_SPECIES[0];
}

function monsterPower(monster = {}) {
  const species = pixelMonsterSpeciesById(monster.speciesId);
  const stage = Math.max(0, Math.trunc(Number(monster.evolutionStage || 0)));
  const stageBonus = PIXEL_MONSTER_EVOLUTION_STAGES.slice(0, stage).reduce((sum, item) => sum + item.powerBonus, 0);
  return (species?.basePower || 10) + Math.max(1, Number(monster.level) || 1) * 3 + stageBonus + Math.floor(Number(monster.bond || 0) / 10);
}

function monsterDisplayName(monster = {}) {
  const stage = Math.max(0, Math.trunc(Number(monster.evolutionStage || 0)));
  const suffix = stage > 0 ? PIXEL_MONSTER_EVOLUTION_STAGES[stage - 1]?.suffix || "" : "";
  return suffix ? `${monster.name} ${suffix}` : monster.name;
}

function monsterTeam(person = {}) {
  normalizePersonState(person);
  const selected = person.monsters
    .filter((monster) => monster.teamSlot > 0)
    .sort((left, right) => left.teamSlot - right.teamSlot);
  return selected.length ? selected : person.monsters.slice(0, 3);
}

function firstOwnedMonster(person) {
  normalizePersonState(person);
  return monsterTeam(person)[0] || person.monsters[0] || null;
}

function selectOwnedMonster(person, selector = "") {
  normalizePersonState(person);
  const body = compactSpaces(selector);
  if (!body) return firstOwnedMonster(person);
  const index = Math.trunc(Number(body));
  if (Number.isFinite(index) && index >= 1 && index <= person.monsters.length) return person.monsters[index - 1];
  const key = keyFor(body);
  return person.monsters.find((monster) => keyFor(monster.name) === key || keyFor(monsterDisplayName(monster)) === key) || null;
}

function ensureMonsterQuestStats(person) {
  normalizePersonState(person);
  return person.monsterQuestStats;
}

function incrementMonsterQuestStat(person, key, amount = 1) {
  const stats = ensureMonsterQuestStats(person);
  stats[key] = Math.max(0, Math.trunc(Number(stats[key] || 0))) + amount;
}

function monsterQuestDefinitions() {
  return [
    { key: "explore", label: "몬스터 탐험 1회", target: 1, command: "/몬스터탐험" },
    { key: "capture", label: "포획 1회", target: 1, command: "/포획" },
    { key: "battle", label: "전투 또는 보스 1회", target: 1, command: "/몬스터전투" }
  ];
}

function monsterQuestLines(person) {
  const stats = ensureMonsterQuestStats(person);
  return monsterQuestDefinitions().map((quest, index) => {
    const current = quest.key === "battle" ? Math.max(stats.battle || 0, stats.boss || 0) : stats[quest.key] || 0;
    const done = current >= quest.target;
    return `${index + 1}. ${done ? "완료" : "진행"} ${quest.label} (${Math.min(current, quest.target)}/${quest.target})`;
  });
}

function monsterQuestSummary(person) {
  return monsterQuestLines(person).join(" · ");
}

function monsterDexSummary(person) {
  normalizePersonState(person);
  const uniqueCount = new Set(person.monsters.map((monster) => monster.speciesId)).size;
  const nextGoal = PIXEL_MONSTER_DEX_REWARD_THRESHOLDS.find((goal) => uniqueCount < goal) || PIXEL_MONSTER_SPECIES_COUNT;
  return { uniqueCount, percent: Math.floor((uniqueCount / PIXEL_MONSTER_SPECIES_COUNT) * 100), nextGoal };
}

function addMonsterShards(person, speciesId, amount = 1) {
  normalizePersonState(person);
  const species = pixelMonsterSpeciesById(speciesId);
  if (!species) return 0;
  const count = Math.max(0, Math.trunc(Number(amount) || 0));
  person.monsterShards[species.speciesId] = Math.max(0, Number(person.monsterShards[species.speciesId] || 0)) + count;
  return person.monsterShards[species.speciesId];
}

function levelUpMonster(monster, expGain) {
  monster.exp += Math.max(0, Math.trunc(Number(expGain) || 0));
  let leveled = false;
  while (monster.exp >= monster.level * 50) {
    monster.exp -= monster.level * 50;
    monster.level += 1;
    leveled = true;
  }
  return leveled;
}

function monsterDexCommand(roomState, sender, text = "") {
  const person = ensurePerson(roomState, sender);
  const requested = compactSpaces(text.replace(/^\/몬스터도감\s*/i, ""));
  const filterElement = PIXEL_MONSTER_ELEMENTS.find((element) => keyFor(element) === keyFor(requested));
  const speciesPool = filterElement ? PIXEL_MONSTER_SPECIES.filter((species) => species.element === filterElement) : PIXEL_MONSTER_SPECIES;
  const owned = new Set(person.monsters.map((monster) => monster.speciesId));
  const preview = speciesPool.slice(0, 6)
    .map((species, index) => `${index + 1}. ${owned.has(species.speciesId) ? "보유" : "미발견"} ${species.name} [${species.element}/${species.rarityLabel}]`)
    .join("\n");
  const dex = monsterDexSummary(person);
  return [
    "🔮 픽셀몬스터 도감",
    `수집률: ${dex.uniqueCount}/${PIXEL_MONSTER_SPECIES_COUNT}종 (${dex.percent}%)`,
    `다음 목표: ${dex.nextGoal}종 보상`,
    filterElement ? `속성 필터: ${filterElement}` : "속성 필터: 전체",
    preview,
    "상세: /몬스터상세 1"
  ].join("\n");
}

function monsterExploreCommand(roomState, sender, text = "") {
  const person = ensurePerson(roomState, sender);
  const displayName = displayNameForPerson(roomState, person, sender);
  const cooldown = gameCooldownText(person, "monsterExplore");
  if (cooldown) return cooldown;
  const region = monsterRegionFromText(text);
  const species = randomPixelMonsterSpecies(region);
  const captureStones = inventoryQuantity(person, CAPTURE_STONE_ITEM_ID);
  const captureBonus = captureStones > 0 ? 12 : 0;
  const catchRate = Math.min(95, Math.round(species.catchRate * 100) + captureBonus);
  person.pendingMonster = { speciesId: species.speciesId, region: region.label, discoveredAt: nowIso() };
  incrementMonsterQuestStat(person, "explore");
  markGameCooldown(person, "monsterExplore");
  return [
    "🔎 몬스터 탐험",
    `${displayName}님이 ${region.label}에서 ${species.name}을(를) 발견했습니다.`,
    `${species.element === "숲" ? "🌿" : "✨"} 속성: ${species.element} / 등급: ${species.rarityLabel}`,
    `포획률: ${catchRate}%${captureStones > 0 ? " + 포획석 보너스" : ""}`,
    "포획: /포획",
    "다른 지역: /몬스터탐험 바다"
  ].join("\n");
}

function monsterCaptureCommand(roomState, sender) {
  const person = ensurePerson(roomState, sender);
  const displayName = displayNameForPerson(roomState, person, sender);
  const pending = normalizePendingMonster(person.pendingMonster);
  if (!pending) return "❌ 발견한 몬스터가 없습니다.\n/몬스터탐험 으로 먼저 찾아주세요.";
  const species = pixelMonsterSpeciesById(pending.speciesId);
  const captureStones = inventoryQuantity(person, CAPTURE_STONE_ITEM_ID);
  const captureBonus = captureStones > 0 ? 0.12 : 0;
  const firstMonsterBonus = person.monsters.length === 0;
  const success = firstMonsterBonus || Math.random() < Math.min(0.95, species.catchRate + captureBonus);
  if (captureStones > 0) removeInventory(person, CAPTURE_STONE_ITEM_ID, 1);
  person.pendingMonster = null;
  if (!success) {
    const shards = addMonsterShards(person, species.speciesId, 1);
    return [
      "⚠️ 포획 실패",
      `${species.name}이(가) 도망갔습니다.`,
      `대신 조각 +1개 (보유 ${formatNumber(shards)}개)`,
      "다음 행동: /몬스터탐험"
    ].join("\n");
  }
  const monster = {
    id: randomBytes(4).toString("hex"),
    speciesId: species.speciesId,
    name: species.name,
    element: species.element,
    rarity: species.rarity,
    level: 1,
    exp: 0,
    teamSlot: person.monsters.length === 0 ? 1 : 0,
    evolutionStage: 0,
    bond: 5,
    wins: 0,
    shards: 1,
    lastUsedAt: nowIso(),
    caughtAt: nowIso()
  };
  person.monsters.push(monster);
  addMonsterShards(person, species.speciesId, 1);
  incrementMonsterQuestStat(person, "capture");
  return [
    "✅ 포획 성공",
    `${displayName}님이 ${species.name}을(를) 동료로 맞이했습니다.`,
    `대표팀: ${monster.teamSlot ? "자동 등록" : "/몬스터팀 으로 편성"}`,
    `퀘스트: ${monsterQuestSummary(person)}`,
    "다음: /몬스터"
  ].join("\n");
}

function monsterHubCommand(roomState, sender) {
  const person = ensurePerson(roomState, sender);
  const displayName = displayNameForPerson(roomState, person, sender);
  const team = monsterTeam(person);
  const dex = monsterDexSummary(person);
  const cooldowns = ["monsterExplore", "monsterTrain", "monsterBattle"]
    .map((key) => gameCooldownText(person, key))
    .filter(Boolean)
    .slice(0, 1);
  return [
    "👾 몬스터 허브",
    `${displayName}님의 수집률: ${dex.uniqueCount}/${PIXEL_MONSTER_SPECIES_COUNT}종 (${dex.percent}%)`,
    `대표팀: ${team.length ? team.map((monster) => `${monsterDisplayName(monster)} Lv.${monster.level}`).join(", ") : "없음"}`,
    `오늘 할 일: ${monsterQuestSummary(person)}`,
    `추천: ${person.monsters.length ? "/몬스터훈련 · /몬스터전투 · /몬스터보스" : "/몬스터탐험 · /포획"}`,
    cooldowns.length ? `쿨타임: ${cooldowns[0]}` : "쿨타임: 바로 진행 가능"
  ].join("\n");
}

function monsterListCommand(roomState, sender) {
  const person = ensurePerson(roomState, sender);
  const displayName = displayNameForPerson(roomState, person, sender);
  if (!person.monsters.length) return `${displayName}님의 몬스터가 없습니다. /몬스터탐험 으로 시작해 주세요.`;
  return [
    `👾 ${displayName}님의 몬스터`,
    ...person.monsters.slice(0, 10).map((monster, index) => {
      const species = pixelMonsterSpeciesById(monster.speciesId);
      const team = monster.teamSlot ? ` 팀${monster.teamSlot}` : "";
      return `${index + 1}. ${monsterDisplayName(monster)} Lv.${monster.level} [${species?.element || monster.element}] EXP ${monster.exp}${team}`;
    }),
    "상세: /몬스터상세 1",
    "대표팀: /몬스터팀 1 2 3"
  ].join("\n");
}

function monsterDetailCommand(roomState, sender, text) {
  const person = ensurePerson(roomState, sender);
  const selector = compactSpaces(text.replace(/^\/몬스터상세\s*/i, ""));
  const monster = selectOwnedMonster(person, selector || "1");
  if (!monster) return "❌ 몬스터를 찾지 못했습니다.\n예시: /몬스터상세 1";
  const species = pixelMonsterSpeciesById(monster.speciesId);
  const nextEvolution = PIXEL_MONSTER_EVOLUTION_STAGES[monster.evolutionStage] || null;
  const shardCount = Number(person.monsterShards?.[monster.speciesId] || 0);
  return [
    "🔍 몬스터 상세",
    `${monsterDisplayName(monster)} Lv.${monster.level} [${species?.element || monster.element}/${species?.rarityLabel || monster.rarity}]`,
    `전투력: ${formatNumber(monsterPower(monster))} / 친밀도: ${formatNumber(monster.bond)}`,
    `승리: ${formatNumber(monster.wins)}회 / 조각: ${formatNumber(shardCount)}개`,
    `진화: ${nextEvolution ? `Lv.${nextEvolution.level}, 조각 ${nextEvolution.shards}개 필요` : "최종 단계"}`,
    `관리번호: ${monster.speciesId}`
  ].join("\n");
}

function monsterQuestCommand(roomState, sender) {
  const person = ensurePerson(roomState, sender);
  return [
    "📌 오늘 퀘스트",
    ...monsterQuestLines(person),
    "완료 보상: 포인트, 포획석, 조각",
    "시작: /몬스터탐험"
  ].join("\n");
}

function monsterTeamCommand(roomState, sender, text) {
  const person = ensurePerson(roomState, sender);
  const body = compactSpaces(text.replace(/^\/몬스터팀\s*/i, ""));
  if (!body) {
    const team = monsterTeam(person);
    return [
      "👥 대표팀",
      team.length ? team.map((monster, index) => `${index + 1}. ${monsterDisplayName(monster)} Lv.${monster.level}`).join("\n") : "대표팀이 없습니다.",
      "설정: /몬스터팀 1 2 3"
    ].join("\n");
  }
  const indexes = body.split(/\s+/).map((value) => Math.trunc(Number(value))).filter((value) => Number.isFinite(value) && value > 0);
  if (indexes.length > 3) return "❌ 대표팀은 최대 3마리까지 설정할 수 있습니다.\n예시: /몬스터팀 1 2 3";
  if (!indexes.length || indexes.some((index) => !person.monsters[index - 1])) return "❌ 번호를 확인해 주세요.\n예시: /몬스터팀 1 2 3";
  person.monsters.forEach((monster) => { monster.teamSlot = 0; });
  indexes.forEach((index, slot) => { person.monsters[index - 1].teamSlot = slot + 1; });
  const team = monsterTeam(person);
  return [
    "✅ 대표팀 설정",
    `${team.length}마리 편성 완료`,
    team.map((monster, index) => `${index + 1}. ${monsterDisplayName(monster)} Lv.${monster.level}`).join("\n")
  ].join("\n");
}

function monsterTrainCommand(roomState, sender) {
  const person = ensurePerson(roomState, sender);
  const monster = firstOwnedMonster(person);
  if (!monster) return "훈련할 몬스터가 없습니다. /몬스터탐험 과 /포획 을 먼저 진행해 주세요.";
  const cooldown = gameCooldownText(person, "monsterTrain");
  if (cooldown) return cooldown;
  const firstTrainToday = (person.monsterQuestStats?.train || 0) === 0;
  const expGain = firstTrainToday ? 35 : 25;
  const leveled = levelUpMonster(monster, expGain);
  monster.bond = Math.min(100, Number(monster.bond || 0) + 5);
  monster.lastUsedAt = nowIso();
  incrementMonsterQuestStat(person, "train");
  markGameCooldown(person, "monsterTrain");
  return [
    "📈 몬스터 훈련",
    `${monsterDisplayName(monster)} 훈련 완료`,
    `레벨: ${monster.level}${leveled ? " 상승" : ""} / 경험치: ${monster.exp}/${monster.level * 50}`,
    `친밀도 +5 / 진화 게이지: Lv.${monster.level}`,
    "다음: /몬스터진화"
  ].join("\n");
}

function monsterBattleCommand(roomState, sender) {
  const person = ensurePerson(roomState, sender);
  const monster = firstOwnedMonster(person);
  if (!monster) return "전투할 몬스터가 없습니다. /몬스터탐험 과 /포획 을 먼저 진행해 주세요.";
  const cooldown = gameCooldownText(person, "monsterBattle");
  if (cooldown) return cooldown;
  const species = pixelMonsterSpeciesById(monster.speciesId);
  const opponent = randomPixelMonsterSpecies();
  const advantage = species?.element === opponent.element ? 0 : (species?.element === "물결" && opponent.element === "불꽃") || (species?.element === "숲" && opponent.element === "바위") || (species?.element === "불꽃" && opponent.element === "숲") ? 8 : 0;
  const power = monsterPower(monster) + advantage;
  const enemyPower = opponent.basePower + Math.floor(Math.random() * 20);
  const win = power >= enemyPower;
  const reward = win ? 30 + monster.level * 6 : 10 + monster.level * 2;
  levelUpMonster(monster, win ? 22 : 12);
  if (win) monster.wins += 1;
  monster.bond = Math.min(100, Number(monster.bond || 0) + (win ? 3 : 1));
  monster.lastUsedAt = nowIso();
  person.points += reward;
  incrementMonsterQuestStat(person, "battle");
  markGameCooldown(person, "monsterBattle");
  return [
    "⚔️ 몬스터 전투",
    `${monsterDisplayName(monster)} vs ${opponent.name}`,
    `결과: ${win ? "승리" : "패배"} / 상성 보너스 ${advantage ? `+${advantage}` : "없음"}`,
    `획득: ${formatPoint(reward)} / 보유 ${formatPoint(person.points)}`,
    "다음: /몬스터퀘스트"
  ].join("\n");
}

function monsterEvolutionCommand(roomState, sender) {
  const person = ensurePerson(roomState, sender);
  const monster = firstOwnedMonster(person);
  if (!monster) return "몬스터 진화 조건을 확인할 몬스터가 없습니다.\n/몬스터탐험 과 /포획 을 먼저 진행해 주세요.";
  const next = PIXEL_MONSTER_EVOLUTION_STAGES[monster.evolutionStage] || null;
  if (!next) return `✅ 몬스터 진화\n${monsterDisplayName(monster)}은(는) 이미 최종 단계입니다.`;
  const shards = Number(person.monsterShards?.[monster.speciesId] || 0);
  const ready = monster.level >= next.level && shards >= next.shards;
  if (!ready) {
    return [
      "🧬 몬스터 진화 조건",
      `${monsterDisplayName(monster)} → ${next.suffix}`,
      `필요: Lv.${next.level}, 조각 ${next.shards}개`,
      `현재: Lv.${monster.level}, 조각 ${formatNumber(shards)}개`,
      "성장: /몬스터훈련, /몬스터보스"
    ].join("\n");
  }
  person.monsterShards[monster.speciesId] = shards - next.shards;
  monster.evolutionStage = next.stage;
  monster.bond = Math.min(100, Number(monster.bond || 0) + 10);
  return [
    "✅ 몬스터 진화 완료",
    `${monster.name}이(가) ${monsterDisplayName(monster)}로 진화했습니다.`,
    `전투력 +${next.powerBonus}`,
    "다음: /몬스터상세 1"
  ].join("\n");
}

function monsterBossKey(date = new Date()) {
  const parts = kstDateParts(date);
  const week = Math.ceil(Number(parts.day) / 7);
  return `${parts.year}-${parts.month}-W${week}`;
}

function ensureMonsterBoss(roomState) {
  const key = monsterBossKey();
  if (!roomState.monsterBoss || roomState.monsterBoss.weekKey !== key) {
    roomState.monsterBoss = { weekKey: key, name: "균열의 픽셀괴수", hp: 5000, totalDamage: 0, damageBy: {}, updatedAt: nowIso() };
  }
  roomState.monsterBoss.damageBy ||= {};
  return roomState.monsterBoss;
}

function monsterBossCommand(roomState, sender) {
  const person = ensurePerson(roomState, sender);
  const team = monsterTeam(person);
  if (!team.length) return "주간 보스에 참여할 몬스터가 없습니다.\n/몬스터탐험 과 /포획 으로 시작해 주세요.";
  const stats = ensureMonsterQuestStats(person);
  if ((stats.boss || 0) >= PIXEL_MONSTER_BOSS_DAILY_LIMIT) {
    return `⚠️ 주간 보스\n오늘 참여 가능 횟수를 모두 사용했습니다. (${PIXEL_MONSTER_BOSS_DAILY_LIMIT}/일)`;
  }
  const boss = ensureMonsterBoss(roomState);
  const damage = team.reduce((sum, monster) => sum + monsterPower(monster), 0);
  const senderKey = personKey(sender);
  boss.totalDamage = Math.max(0, Number(boss.totalDamage || 0)) + damage;
  boss.damageBy[senderKey] = Math.max(0, Number(boss.damageBy[senderKey] || 0)) + damage;
  boss.updatedAt = nowIso();
  person.points += Math.max(10, Math.floor(damage / 4));
  incrementMonsterQuestStat(person, "boss");
  return [
    "🐲 주간 보스",
    `${boss.name}에게 ${formatNumber(damage)} 피해`,
    `누적 피해: ${formatNumber(boss.totalDamage)}/${formatNumber(boss.hp)}`,
    `오늘 참여: ${formatNumber(stats.boss)}/${PIXEL_MONSTER_BOSS_DAILY_LIMIT}`,
    "보상: 포인트 + 조각 후보"
  ].join("\n");
}

function petAdoptCommand(roomState, sender, text) {
  const person = ensurePerson(roomState, sender);
  const displayName = displayNameForPerson(roomState, person, sender);
  if (person.pet) return `${displayName}님은 이미 ${person.pet.name}을(를) 키우고 있습니다. /펫 으로 상태를 확인해 주세요.`;
  const name = compactSpaces(text.replace(/^\/펫입양\s*/i, "")).slice(0, 24) || "픽셀펫";
  const species = PET_SPECIES[Math.floor(Math.random() * PET_SPECIES.length)] || PET_SPECIES[0];
  person.pet = normalizePetState({ name, species, hunger: 20, happiness: 70, energy: 70, cleanliness: 70, health: 90, level: 1, exp: 0, bornAt: nowIso(), updatedAt: nowIso() });
  return [
    "펫 입양 완료",
    "",
    `${displayName}님이 ${person.pet.name} (${person.pet.species})을(를) 입양했습니다.`,
    "/펫 으로 상태를 확인해 주세요."
  ].join("\n");
}

function petStatusCommand(roomState, sender) {
  const person = ensurePerson(roomState, sender);
  if (!person.pet) return "키우는 펫이 없습니다. /펫입양 이름 으로 입양해 주세요.";
  const displayName = displayNameForPerson(roomState, person, sender);
  const pet = person.pet;
  return [
    `${displayName}님의 펫`,
    "",
    `${pet.name} (${pet.species}) Lv.${pet.level}`,
    `배고픔: ${pet.hunger}/100`,
    `행복: ${pet.happiness}/100`,
    `에너지: ${pet.energy}/100`,
    `청결: ${pet.cleanliness}/100`,
    `건강: ${pet.health}/100`,
    `경험치: ${pet.exp}/${pet.level * 40}`
  ].join("\n");
}

function ensurePetForCare(person) {
  normalizePersonState(person);
  return person.pet;
}

function boundedPetStat(value) {
  return Math.min(100, Math.max(0, Math.trunc(Number(value || 0))));
}

function petCareCommand(roomState, sender, action) {
  const person = ensurePerson(roomState, sender);
  const pet = ensurePetForCare(person);
  if (!pet) return "키우는 펫이 없습니다. /펫입양 이름 으로 입양해 주세요.";
  const cooldown = gameCooldownText(person, action.cooldownKey);
  if (cooldown) return cooldown;
  pet.hunger = boundedPetStat(pet.hunger + (action.hunger || 0));
  pet.happiness = boundedPetStat(pet.happiness + (action.happiness || 0));
  pet.energy = boundedPetStat(pet.energy + (action.energy || 0));
  pet.cleanliness = boundedPetStat(pet.cleanliness + (action.cleanliness || 0));
  pet.health = boundedPetStat(pet.health + (action.health || 0));
  pet.updatedAt = nowIso();
  markGameCooldown(person, action.cooldownKey);
  return [
    action.title,
    "",
    `${pet.name} 상태가 좋아졌습니다.`,
    `배고픔 ${pet.hunger}/100 · 행복 ${pet.happiness}/100 · 에너지 ${pet.energy}/100 · 청결 ${pet.cleanliness}/100`
  ].join("\n");
}

function petTrainCommand(roomState, sender) {
  const person = ensurePerson(roomState, sender);
  const pet = ensurePetForCare(person);
  if (!pet) return "키우는 펫이 없습니다. /펫입양 이름 으로 입양해 주세요.";
  const cooldown = gameCooldownText(person, "petTrain");
  if (cooldown) return cooldown;
  pet.exp += 20;
  if (pet.exp >= pet.level * 40) {
    pet.exp = 0;
    pet.level += 1;
    person.points += 30;
  }
  pet.energy = boundedPetStat(pet.energy - 10);
  pet.happiness = boundedPetStat(pet.happiness + 5);
  pet.updatedAt = nowIso();
  markGameCooldown(person, "petTrain");
  return [
    "펫 훈련",
    "",
    `${pet.name} 훈련 완료`,
    `레벨: ${pet.level}`,
    `경험치: ${pet.exp}/${pet.level * 40}`
  ].join("\n");
}

function petShopCommand(roomState, sender) {
  const person = ensurePerson(roomState, sender);
  const snack = systemProductById(PET_SNACK_ITEM_ID);
  if (!snack) {
    return [
      "펫 상점 데이터 오류",
      "",
      "원인: 펫 간식 상품 데이터를 찾지 못했습니다.",
      "잠시 후 다시 시도하고 반복되면 운영자에게 문의해 주세요.",
      "도움말: /help/pet"
    ].join("\n");
  }
  return [
    "🐾 펫 상점",
    "",
    `1. ${snack.name} - ${formatPoint(snack.price)} / 판매가 ${formatPoint(snack.sellPrice)}`,
    "돌봄: /펫먹이, /펫놀기, /펫씻기, /펫재우기",
    `보유 포인트: ${formatPoint(person.points)}`,
    "",
    "구매형 간식 확장은 준비 중입니다."
  ].join("\n");
}

function gameHelpText(roomState) {
  const enabled = featureEnabled(roomState, "games");
  const settings = gameSettings(roomState);
  return [
    "🎮 게임 허브",
    `상태: ${enabled ? "켜짐" : "꺼짐"} · 시즌: ${settings.seasonName} · ${gameSeasonStatusText(settings)} · ${gameSeasonPeriodText(settings)}`,
    `주사위 기본 보상: ${formatPoint(settings.diceReward)} x 결과`,
    "RPG: /모험, /자동던전 상급 10, /강화목록 · 낚시: /낚시, /자동낚시",
    `펫: /펫입양, /펫 · 픽셀몬스터: /몬스터, /몬스터퀘스트, /몬스터보스 (${PIXEL_MONSTER_SPECIES_COUNT}종)`,
    "확률/점메추: /확률게임, /코인 앞 100, /룰렛 빨강 100, /점메추 한식",
    enabled ? "보상 아이템은 /가방 에 보관되고 /판매추천 으로 정리할 수 있습니다." : "관리자가 /기능켜기 게임 을 실행하면 사용할 수 있습니다."
  ].join("\n");
}

function dailyActionChecklistCommand(roomState, sender) {
  const person = ensurePerson(roomState, sender);
  const bait = Number(person.inventory?.[String(BAIT_ITEM_ID)] || 0);
  const pet = person.pet?.name || "";
  const inventoryCount = Object.values(person.inventory || {}).reduce((sum, count) => sum + Math.max(0, Number(count) || 0), 0);
  return [
    "📌 오늘 할 일",
    `1. /출석 · /낚시 - 미끼 ${formatNumber(bait)}개`,
    "2. /모험 또는 /던전 · /자동던전 상급 10",
    "3. /몬스터퀘스트 · /몬스터보스",
    pet ? `4. /펫 - ${pet} 상태 확인` : "4. /펫입양 이름 - 첫 펫 시작",
    `5. /가방정리 - 보유 ${formatNumber(inventoryCount)}개 정리`,
    "빠른 추천: /추천 돈벌기 · /추천 RPG · /정리추천"
  ].join("\n");
}

function inventoryRecommendationSummary(person = {}) {
  const inventory = person.inventory || {};
  const entries = Object.entries(inventory)
    .map(([itemId, count]) => ({ product: systemProductById(itemId), itemId, count: Math.max(0, Number(count) || 0) }))
    .filter((entry) => entry.count > 0 && entry.product);
  const duplicates = entries.filter((entry) => entry.count > 1).reduce((sum, entry) => sum + entry.count - 1, 0);
  const materials = entries.filter((entry) => entry.product.category === "rpg_material" || entry.product.category === "explore").reduce((sum, entry) => sum + entry.count, 0);
  const fish = entries.filter((entry) => entry.product.category === "fish" || isFishProductId(entry.itemId)).reduce((sum, entry) => sum + entry.count, 0);
  return { total: entries.reduce((sum, entry) => sum + entry.count, 0), duplicates, materials, fish };
}

function saleRecommendationCommand(roomState, sender) {
  const person = ensurePerson(roomState, sender);
  const summary = inventoryRecommendationSummary(person);
  return [
    "💰 판매 추천",
    "",
    `보유 아이템: ${formatNumber(summary.total)}개`,
    `중복: ${formatNumber(summary.duplicates)}개 · 재료: ${formatNumber(summary.materials)}개 · 물고기: ${formatNumber(summary.fish)}개`,
    "",
    "1. /판매미리보기 중복",
    "2. /판매미리보기 재료",
    "3. /판매미리보기 물고기",
    "4. /일괄판매 중복",
    "",
    "보호할 아이템: /아이템잠금 번호"
  ].join("\n");
}

function cleanupRecommendationCommand(roomState, sender) {
  const person = ensurePerson(roomState, sender);
  const summary = inventoryRecommendationSummary(person);
  return [
    "🎒 정리 추천",
    "",
    `가방: ${formatNumber(summary.total)}개`,
    "1. /가방정리 - 추천 흐름 확인",
    "2. /판매미리보기 중복 - 1개씩 남기고 정리",
    "3. /판매미리보기 일반 - 일반 전리품 정리",
    "4. /잠금목록 - 보호 아이템 확인",
    "",
    "자세히: /아이템 1, /아이템상세 1"
  ].join("\n");
}

function lunchCategoryFromText(text = "") {
  const body = compactSpaces(text.replace(/^\/점메추\s*/i, ""));
  if (!body) return "";
  const alias = LUNCH_CATEGORY_ALIASES[body] ?? LUNCH_CATEGORY_ALIASES[keyFor(body)];
  if (alias !== undefined) return alias;
  return LUNCH_MENU_ITEMS.some((item) => item.categories.includes(body)) ? body : "";
}

function lunchRecommendationCommand(text) {
  const category = lunchCategoryFromText(text);
  const candidates = category
    ? LUNCH_MENU_ITEMS.filter((item) => item.categories.includes(category))
    : LUNCH_MENU_ITEMS;
  const item = candidates[Math.floor(Math.random() * candidates.length)] || LUNCH_MENU_ITEMS[0];
  return [
    `🍱 오늘 점심 추천${category ? ` (${category})` : ""}`,
    `${item.name} 어떠세요?`,
    item.note,
    "",
    "자세히: /점메추 한식 · /점메추 매운거 · /점메추 가벼운거"
  ].join("\n");
}

function adminPointAdjustCommand(roomState, sender, text, mode) {
  const denied = requireAdmin(roomState, sender);
  if (denied) return denied;

  const commandPattern = mode === "grant" ? /^\/포인트지급\s*/i : mode === "debit" ? /^\/포인트차감\s*/i : /^\/포인트설정\s*/i;
  const parsed = parseTargetAndAmount(text, commandPattern);
  if (!parsed?.target || !parsed.amount) {
    const name = mode === "grant" ? "포인트지급" : mode === "debit" ? "포인트차감" : "포인트설정";
    return `형식: /${name} 닉네임 포인트`;
  }

  const targetKey = existingPersonKey(roomState, parsed.target) || personKey(parsed.target);
  const person = roomState.people[targetKey] || ensurePerson(roomState, parsed.target);
  if (mode === "grant") person.points += parsed.amount;
  if (mode === "debit") person.points = Math.max(0, person.points - parsed.amount);
  if (mode === "set") person.points = parsed.amount;
  const label = mode === "grant" ? "지급" : mode === "debit" ? "차감" : "설정";
  recordRoomEvent(roomState, { type: `point_${mode}`, name: person.currentName, amount: parsed.amount, by: sender });
  return [
    `포인트 ${label} 완료`,
    "",
    `• 대상 : ${displayNameForPerson(roomState, person, parsed.target)}`,
    `• 금액 : ${formatPoint(parsed.amount)}`,
    `• 보유 포인트 : ${formatPoint(person.points)}`
  ].join("\n");
}

function memberInfoCommand(roomState, text, sender) {
  const query = stripKakaoSuffix(text.replace(/^\/(?:내정보|레벨)\s*/i, "").replace(/^\/정보\s*/i, "")) || sender;
  const key = existingPersonKey(roomState, query) || personKey(query);
  const person = roomState.people[key] || ensurePerson(roomState, query);
  const profile = roomState.profiles[key];
  const today = kstDateKey();
  const month = kstMonthKey();
  const nextExp = requiredExpForLevel(person.level);
  const expPercent = nextExp ? ((person.exp / nextExp) * 100).toFixed(2) : "0.00";
  const displayName = displayNameForPerson(roomState, person, query);
  const nameLine = `${profile?.alias ? "🌿" : "🥚"}${displayName}`;
  const monthAttendance = person.attendance.dates.filter((date) => date.startsWith(month)).length;
  return [
    nameLine,
    "",
    `• 레벨 : ${person.level}`,
    `• 가입일 : ${kstLongDate(new Date(person.joinedAt))}`,
    `• 총 출석일 : ${person.attendance.dates.length}일`,
    `• 당월 출석일 : ${monthAttendance}일`,
    `• 연속 출석일 : ${person.attendance.currentStreak}일`,
    `• 전체 채팅 : ${formatNumber(person.chats.total)}회`,
    `• 오늘 채팅 : ${formatNumber(person.chats.byDate[today] || 0)}회`,
    `• 보유 포인트 : ${formatPoint(person.points)}`,
    `• 소비한 포인트 : ${formatPoint(person.spentPoints)}`,
    "• 타이틀 개수 : 0개",
    `• 경험치 : ${formatNumber(person.exp)} / ${formatNumber(nextExp)} (${expPercent}%)`,
    "",
    `♥ x ${formatNumber(person.hearts)}`
  ].join("\n");
}

function rankedPeople(roomState, scoreFn) {
  return Object.entries(roomState.people || {})
    .map(([key, person]) => {
      normalizePersonState(person);
      return { key, person, score: scoreFn(person) };
    })
    .filter((item) => item.score > 0 && !isReservedPersonName(item.person.currentName))
    .sort((a, b) => b.score - a.score || keyFor(a.person.currentName).localeCompare(keyFor(b.person.currentName)));
}

function medal(rank) {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `${rank}위 -`;
}

function rankingText(roomState, sender, type) {
  const today = kstDateKey();
  const week = kstWeekKey();
  const configs = {
    points: {
      title: "채팅방 포인트 순위",
      score: (person) => person.points,
      value: (item) => formatPoint(item.score)
    },
    likes: {
      title: "채팅방 좋아요순위",
      score: (person) => person.hearts,
      value: (item) => `♥${formatNumber(item.score)}`
    },
    levels: {
      title: "채팅방 레벨 순위",
      score: (person) => person.level * 100000 + person.exp,
      value: (item) => `LV.${item.person.level} (${formatNumber(item.person.exp)} / ${formatNumber(requiredExpForLevel(item.person.level))})`
    },
    todayChats: {
      title: "오늘 채팅 순위",
      score: (person) => person.chats.byDate[today] || 0,
      value: (item, total) => `(${formatNumber(item.score)}회, ${total ? ((item.score / total) * 100).toFixed(1) : "0.0"}%)`
    },
    weekChats: {
      title: "이번 주 채팅 순위",
      score: (person) => person.chats.byWeek[week] || 0,
      value: (item, total) => `(${formatNumber(item.score)}회, ${total ? ((item.score / total) * 100).toFixed(1) : "0.0"}%)`
    }
  };
  const config = configs[type];
  const rows = rankedPeople(roomState, config.score);
  const total = rows.reduce((sum, item) => sum + item.score, 0);
  const senderKey = existingPersonKey(roomState, sender) || personKey(sender);
  const ownRank = rows.findIndex((item) => item.key === senderKey) + 1;
  const lines = [config.title, ""];
  if (type === "todayChats" || type === "weekChats") lines.push(`• 그룹방 전체 : ${formatNumber(total)}회`);
  lines.push(`• ${displayNameForKey(roomState, senderKey, sender)}님 : ${ownRank ? `${ownRank}위` : "순위 없음"}`, "");
  rows.slice(0, 15).forEach((item, index) => {
    const rank = index + 1;
    lines.push(`${medal(rank)} ${displayNameForPerson(roomState, item.person, item.person.currentName)} ${config.value(item, total)}`);
  });
  if (!rows.length) lines.push("기록 없음");
  return lines.join("\n");
}

function personHistoryText(roomState, query, sender) {
  const target = stripKakaoSuffix(query) || sender;
  const key = resolveName(roomState, target);
  const person = roomState.people[key];
  if (!person) return `"${target}" 닉네임 기록이 없습니다.`;
  const lines = [`${displayNameForPerson(roomState, person, target)}님 히스토리`, ""];
  lines.push("❰ 닉네임 히스토리 ❱");
  if (person.names?.length) {
    for (const name of person.names) lines.push(`• ${name}`);
  } else {
    lines.push("기록 없음");
  }
  lines.push("");
  lines.push("❰ 입장 히스토리 ❱");
  if (person.entries?.length) {
    for (const event of person.entries.slice(-10)) lines.push(`· ${shortKstDate(new Date(event.at))}`);
  } else {
    lines.push("기록 없음");
  }
  lines.push("");
  lines.push("❰ 퇴장 히스토리 ❱");
  if (person.exits?.length) {
    for (const event of person.exits.slice(-10)) lines.push(`· ${shortKstDate(new Date(event.at))}`);
  } else {
    lines.push("기록 없음");
  }
  if (person.nickChanges?.length) {
    lines.push("");
    lines.push("❰ 닉네임 변경 ❱");
    for (const event of person.nickChanges.slice(-10)) {
      lines.push(`· ${event.from} ➙ ${event.to} (${shortKstDate(new Date(event.at))})`);
    }
  }
  return lines.join("\n");
}

function latestExitLikeAt(person) {
  const events = [...(person.exits || []), ...(person.kicks || [])];
  return events
    .map((event) => new Date(event.at).getTime())
    .filter(Number.isFinite)
    .sort((a, b) => b - a)[0] || 0;
}

function recentExitCandidateText(roomState, currentName) {
  const currentKey = personKey(currentName);
  const now = Date.now();
  const candidates = Object.entries(roomState.people || {})
    .filter(([key]) => key !== currentKey)
    .map(([key, person]) => ({ key, person, lastExitAt: latestExitLikeAt(person) }))
    .filter(({ lastExitAt }) => lastExitAt && now - lastExitAt <= REENTRY_CANDIDATE_WINDOW_MS)
    .sort((a, b) => b.lastExitAt - a.lastExitAt)
    .slice(0, 3);
  if (!candidates.length) return "";

  const lines = [
    "【 재입장 후보 히스토리 】",
    "",
    "고유값이 없어 확정은 아니지만, 최근 퇴장자 후보입니다."
  ];
  for (const { person, lastExitAt } of candidates) {
    const names = uniqueNames([person.currentName, ...(person.names || [])])
      .filter((name) => personKey(name) !== currentKey)
      .slice(0, 4);
    lines.push(
      "",
      `• ${displayNameForPerson(roomState, person, person.currentName) || "이름없음"} - 마지막 퇴장 ${shortKstDate(new Date(lastExitAt))}`,
      `  입장 ${person.entries?.length || 0}회 / 퇴장 ${person.exits?.length || 0}회 / 강퇴 ${person.kicks?.length || 0}회`,
      `  이전닉: ${names.length ? names.join(", ") : "기록 없음"}`
    );
  }
  return lines.join("\n");
}

function personDetailedHistoryText(roomState, query, sender) {
  const target = stripKakaoSuffix(query) || sender;
  const key = resolveName(roomState, target);
  const person = roomState.people[key];
  if (!person) return `"${target}" 닉네임 기록이 없습니다.`;

  const entries = person.entries || [];
  const exits = person.exits || [];
  const kicks = person.kicks || [];
  const nickChanges = person.nickChanges || [];
  const timeline = [
    ...entries.map((event) => ({ type: "입장", at: event.at })),
    ...exits.map((event) => ({ type: "퇴장", at: event.at })),
    ...kicks.map((event) => ({ type: "강퇴", at: event.at })),
    ...nickChanges.map((event) => ({ type: "닉변", at: event.at, detail: `${event.from} ➙ ${event.to}` }))
  ].sort((a, b) => new Date(a.at) - new Date(b.at));

  const lines = [
    `${displayNameForPerson(roomState, person, target)}님 입퇴장 상세`,
    "",
    `입장 ${entries.length}회 / 퇴장 ${exits.length}회 / 강퇴 ${kicks.length}회 / 닉변 ${nickChanges.length}회`,
    "",
    "상세 이벤트"
  ];

  if (!timeline.length) {
    lines.push("기록 없음");
    return lines.join("\n");
  }

  timeline.slice(-30).forEach((event, index) => {
    const detail = event.detail ? ` - ${event.detail}` : "";
    lines.push(`${index + 1}. ${event.type} - ${kstDateTime(new Date(event.at))}${detail}`);
  });
  return lines.join("\n");
}

function nicknameHistoryText(person) {
  const names = person.names || [];
  if (!names.length) return "기록 없음";
  const firstName = names[0];
  const lines = [`최초닉 : ${firstName}`];
  for (const name of names.slice(1)) lines.push(`• ${name}`);
  return lines.join("\n");
}

function welcomeText(roomState, person, reentryCandidateText = "") {
  const lines = [
    `${displayNameForPerson(roomState, person, person.currentName)}님 어서오세요👀`
  ];
  if (reentryCandidateText) lines.push("", reentryCandidateText);
  return lines.join("\n");
}

function reentryText(roomState, person) {
  const kickCount = person.kicks?.length || 0;
  const lines = [
    `⚠ ${displayNameForPerson(roomState, person, person.currentName)}님 ${person.entries.length}회 재입장 ⚠`,
    "",
    `- 강퇴이력 : ${kickCount}회`
  ];
  if (kickCount > 0) lines.push("- 강퇴사유 : 미등록");
  lines.push("", personHistoryText(roomState, person.currentName, person.currentName));
  return lines.join("\n");
}

function recordEntry(roomState, name, identityId = "") {
  const person = ensurePerson(roomState, name, identityId);
  if (!person) return null;
  const at = nowIso();
  person.entries.push({ at });
  recordRoomEvent(roomState, { type: "entered", name: person.currentName });
  const count = person.entries.length;
  if (count <= 1) return welcomeText(roomState, person, identityId ? "" : recentExitCandidateText(roomState, person.currentName));
  return reentryText(roomState, person);
}

function recordExit(roomState, name, type = "left", identityId = "") {
  const person = ensurePerson(roomState, name, identityId);
  if (!person) return null;
  const event = { at: nowIso() };
  if (type === "kicked") person.kicks.push(event);
  else person.exits.push(event);
  recordRoomEvent(roomState, { type, name: person.currentName });
  if (type === "kicked") return null;
  return [
    `${displayNameForPerson(roomState, person, person.currentName)}님 안녕히 가세요👀`,
    "",
    personHistoryText(roomState, person.currentName, person.currentName)
  ].join("\n");
}

function recordNickChange(roomState, from, to, identityId = "") {
  const oldKey = identityPersonKey(roomState, identityId) || personKey(from);
  const newKey = personKey(to);
  const oldPerson = roomState.people[oldKey];
  const person = oldPerson || ensurePerson(roomState, to, identityId);
  if (!person) return null;
  const at = nowIso();
  addUnique(person.names, from);
  addUnique(person.names, to);
  person.currentName = stripKakaoSuffix(to);
  person.nickChanges.push({ from: stripKakaoSuffix(from), to: stripKakaoSuffix(to), at });
  remapPersonKey(roomState, oldKey, newKey, person);
  attachPersonIdentity(roomState, newKey, person, identityId);
  recordRoomEvent(roomState, { type: "nickname_changed", from, to });
  return [
    "【 닉네임 변경 】",
    "",
    `${stripKakaoSuffix(from)} -> ${stripKakaoSuffix(to)}`,
    "",
    "【 닉네임 히스토리 】",
    "",
    nicknameHistoryText(person)
  ].join("\n");
}

function eventTypeAlias(value) {
  const type = keyFor(value);
  if (["entered", "enter", "join", "joined", "입장"].includes(type)) return "entered";
  if (["left", "leave", "exit", "exited", "나감", "퇴장"].includes(type)) return "left";
  if (["kicked", "kick", "ban", "banned", "내보냄", "강퇴"].includes(type)) return "kicked";
  if (["nickname_changed", "nicknamechanged", "nick_changed", "nickchanged", "rename", "renamed", "닉변", "닉네임변경"].includes(type)) {
    return "nickname_changed";
  }
  return "";
}

function nicknameChangeName(value) {
  const name = stripKakaoSuffix(value);
  if (!name || name.length > 30) return "";
  if (isReservedPersonName(name)) return "";
  if (/https?:|www\.|[{};]/i.test(name)) return "";
  if (/[:：]/.test(name)) return "";
  return name;
}

function nicknameChangeEvent(from, to) {
  const cleanFrom = nicknameChangeName(from);
  const cleanTo = nicknameChangeName(to);
  if (!cleanFrom || !cleanTo || keyFor(cleanFrom) === keyFor(cleanTo)) return null;
  return { type: "nickname_changed", from: cleanFrom, to: cleanTo };
}

function payloadSystemEvent(payload, message) {
  const explicitType = eventTypeAlias(payload?.eventType || payload?.type || payload?.event?.type || payload?.systemEvent?.type);
  if (explicitType) {
    if (explicitType === "nickname_changed") {
      const from = stripKakaoSuffix(payload?.fromName || payload?.from || payload?.oldName || payload?.beforeName || payload?.event?.fromName || "");
      const to = stripKakaoSuffix(payload?.toName || payload?.to || payload?.newName || payload?.afterName || payload?.event?.toName || "");
      return nicknameChangeEvent(from, to);
    } else {
      const name = stripKakaoSuffix(payload?.targetName || payload?.target || payload?.name || payload?.event?.targetName || payload?.event?.name || "");
      if (name) return { type: explicitType, name };
    }
  }
  return detectSystemEvent(message);
}

function detectSystemEvent(message) {
  const text = normalizeText(message).replace(/\s+/g, " ");
  let match = text.match(/^(.+?)님이 들어왔습니다/);
  if (match) return { type: "entered", name: match[1] };
  match = text.match(/^(.+?)님이 나갔습니다/);
  if (match) return { type: "left", name: match[1] };
  match = text.match(/^(.+?)님을 내보냈습니다/);
  if (match) return { type: "kicked", name: match[1] };
  match = text.match(/^(.+?)\s*(?:➙|->|→)\s*(.+?)$/);
  if (match) return nicknameChangeEvent(match[1], match[2]);
  match = text.match(/^(.+?)님이\s+(.+?)\(으\)로\s+닉네임을\s+변경/);
  if (match) return nicknameChangeEvent(match[1], match[2]);
  return null;
}

function systemEventKey(event) {
  if (!event?.type) return "";
  if (["entered", "left", "kicked"].includes(event.type)) {
    const key = personKey(event.name);
    return key ? `${event.type}:${key}` : "";
  }
  if (event.type === "nickname_changed") {
    const fromKey = personKey(event.from);
    const toKey = personKey(event.to);
    return fromKey && toKey ? `${event.type}:${fromKey}->${toKey}` : "";
  }
  return "";
}

function isDuplicateSystemEvent(roomState, event) {
  const currentKey = systemEventKey(event);
  if (!currentKey) return false;

  const events = roomState.events || [];
  const now = Date.now();
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const previous = events[index];
    const previousKey = systemEventKey(previous);
    if (!previousKey) continue;

    const previousAt = new Date(previous.at).getTime();
    if (!Number.isFinite(previousAt) || now - previousAt > SYSTEM_EVENT_DUPLICATE_WINDOW_MS) return false;
    return previousKey === currentKey;
  }
  return false;
}

function isBridgeReplyEchoMessage(sender, message) {
  const text = compactSpaces(`${sender || ""} ${message || ""}`);
  if (!text || normalizeText(message).startsWith("/")) return false;
  return [
    "운영봇 서버 정상 연결",
    "픽셀곰 브릿지 앱 단독 응답 정상",
    "픽셀곰 브릿지 로컬 상태 정상",
    "픽셀곰 브릿지 JS",
    "닉네임 히스토리",
    "입장 히스토리",
    "퇴장 히스토리",
    "강퇴이력",
    "회 재입장",
    "님 어서오세요",
    "님 안녕히 가세요",
    "【 닉네임 변경 】",
    "님의 포인트 :",
    "이미 출석 하셨습니다",
    "획득",
    "픽셀곰 상점",
    "님의 가방",
    "구매 완료",
    "아이템 사용 완료",
    "가방 선물 완료",
    "상점 내역"
  ].some((marker) => text.includes(marker));
}

function isPassiveAttachmentNotice(sender, message) {
  if (!isReservedPersonName(sender)) return false;
  const text = compactSpaces(message);
  return /^(사진|동영상|영상|파일|이모티콘|스티커|음성메시지).{0,12}보냈습니다\.?$/.test(text);
}

function statusText(room = "") {
  return [
    `${DEFAULT_BOT_NAME} 서버 정상 연결`,
    `시간: ${kstTimestamp()}`,
    `방: ${room || "미지정"}`,
    `버전: ${APP_VERSION}`,
    "게임 기능: 준비 중"
  ].join("\n");
}

function bridgeServerText(room = "") {
  return [
    "픽셀곰 브릿지 서버 명령 정상",
    `시간: ${kstTimestamp()}`,
    `방: ${room || "미지정"}`,
    `서버 버전: ${APP_VERSION}`,
    "앱 단독 테스트는 MessengerBot을 잠깐 중지한 뒤 /브릿지 를 다시 보내 확인하세요."
  ].join("\n");
}

function bridgeJsServerText() {
  return [
    "픽셀곰 JS 호환 명령 수신 정상",
    "서버 경로에서는 JS를 직접 실행하지 않습니다.",
    "픽셀곰 브릿지 앱 단독 JS 응답은 앱 업데이트 후 /js상태 로 확인하세요."
  ].join("\n");
}

const ACTIVE_GAME_ROOM_COMMANDS = new Set([
  "/게임", "/게임명령어", "/확률게임", "/주사위", "/낚시", "/자동낚시", "/탐험", "/자동탐험", "/자동모험", "/뽑기", "/자동뽑기", "/확률뽑기", "/뽑기목록", "/홀", "/짝", "/홀짝",
  "/코인", "/동전", "/룰렛", "/슬롯", "/복권", "/하이로우", "/폭탄피하기", "/보물상자",
  "/미끼상점", "/미끼구매", "/어항", "/수족관",
  "/모험", "/던전", "/던전목록", "/자동던전", "/자동사냥", "/대장간", "/제작가능", "/제작", "/자동제작", "/강화", "/강화목록", "/강화상세", "/보상선택", "/장비", "/장비상세", "/스탯", "/장착", "/자동장착", "/세트아이템",
  "/몬스터탐험", "/포획", "/몬스터", "/몬스터목록", "/몬스터상세", "/몬스터팀", "/몬스터퀘스트", "/몬스터훈련", "/몬스터전투", "/몬스터진화", "/몬스터보스", "/몬스터도감",
  "/펫입양", "/펫", "/펫먹이", "/펫놀기", "/펫씻기", "/펫재우기", "/펫훈련", "/펫상점"
]);
const GAME_ROOM_ECONOMY_COMMANDS = new Set([
  "/포인트", "/내포인트", "/내정보", "/레벨", "/정보", "/가방", "/아이템", "/보유아이템", "/아이템상세", "/판매목록", "/일괄판매", "/판매", "/구매내역", "/상점", "/구매", "/점메추"
]);
const GAME_ROOM_DIAGNOSTIC_COMMANDS = new Set([
  "/상태", "/status", "/브릿지", "/bridge", "/js상태", "/jsstatus", "/로컬상태", "/도움말", "/help", "/?", "/메뉴", "/처음", "/시작", "/추천", "/찾기", "/명령어", "/게임팩도움말"
]);

function commandForRoomRole(command) {
  const token = normalizeCommandToken(command);
  if (token === "/확률뽑기") return "/뽑기";
  return token;
}

function isActiveGameRoomCommand(command) {
  return ACTIVE_GAME_ROOM_COMMANDS.has(commandForRoomRole(command));
}

function isGameRoomAllowedCommand(command, customItem = null) {
  const token = commandForRoomRole(command);
  if (ACTIVE_GAME_ROOM_COMMANDS.has(token) || GAME_ROOM_ECONOMY_COMMANDS.has(token) || GAME_ROOM_DIAGNOSTIC_COMMANDS.has(token)) return true;
  return Boolean(customItem?.proxyCommand && ACTIVE_GAME_ROOM_COMMANDS.has(commandForRoomRole(customItem.proxyCommand)));
}

function roomRoleRestrictionText(physicalRoomState, dataRoomState, command, compactCommand = "") {
  const role = normalizeRoomRole(physicalRoomState?.settings?.roomRole);
  if (role === "standard") return "";
  const customItem = customCommandMatch(dataRoomState, compactCommand);
  if (role === "general" && (isActiveGameRoomCommand(command) || (customItem?.proxyCommand && isActiveGameRoomCommand(customItem.proxyCommand)))) {
    return [
      "일반방에서는 게임 실행 명령어를 사용할 수 없습니다.",
      "연결된 게임방에서 게임을 진행해 주세요. /가방, /판매, /포인트는 일반방에서도 사용할 수 있습니다."
    ].join("\n");
  }
  if (role === "game" && !isGameRoomAllowedCommand(command, customItem)) {
    return [
      "게임방에서는 게임 명령어만 사용할 수 있습니다.",
      "운영 공지, 신고 처리, 관리자 명령은 일반방에서 진행해 주세요."
    ].join("\n");
  }
  return "";
}

function commandFeatureKey(command) {
  if (/^\/(?:출석|출석체크|출첵|ㅊㅊ|미출석)$/.test(command)) return "attendance";
  if (/^\/(?:포인트안내|포인트규칙)$/.test(command)) return "points";
  if (/^\/포인트\s*순위$|^\/포인트순위$|^\/좋아요\s*순위$|^\/좋아요순위$|^\/레벨\s*순위$|^\/레벨순위$|^\/출석\s*순위$|^\/출석순위$/.test(command)) return "rankings";
  if (command === "/채팅오늘" || command === "/채팅금주") return "rankings";
  if (/^\/(?:최근이벤트|이벤트로그|원본로그|원본이벤트|입퇴장현황|닉이력|입퇴장상세)(?:\s|$)/.test(command)) return "history";
  if (/^\/(?:프로필|프로칠|내별명|별명목록|프로필등록|프로필삭제|별명등록|별명삭제|닉병합|닉네임병합|별명병합)(?:\s|$)/.test(command)) return "profiles";
  if (/^\/(?:게임|확률게임|오늘할일|주사위|낚시|자동낚시|탐험|자동탐험|자동모험|확률뽑기|뽑기|자동뽑기|뽑기목록|홀짝|홀|짝|코인|동전|룰렛|슬롯|복권|하이로우|폭탄피하기|보물상자|미끼상점|미끼구매|어항|수족관|모험|던전|던전목록|자동던전|자동사냥|대장간|제작가능|제작|자동제작|강화|강화목록|강화상세|보상선택|장비|장비상세|스탯|장착|자동장착|세트아이템|몬스터탐험|포획|몬스터|몬스터목록|몬스터상세|몬스터팀|몬스터퀘스트|몬스터훈련|몬스터전투|몬스터진화|몬스터보스|몬스터도감|펫입양|펫|펫먹이|펫놀기|펫씻기|펫재우기|펫훈련|펫상점)(?:\s|$)/.test(command)) return "games";
  if (/^\/(?:포인트|내포인트|좋아요|응원|응원카드|이체|포인트지급|포인트차감|포인트설정|내정보|레벨|정보)(?:\s|$)/.test(command)) return "points";
  if (/^\/(?:상점|구매|구매내역|가방|가방정리|정리추천|판매추천|아이템|보유아이템|아이템상세|판매목록|판매미리보기|일괄판매|아이템잠금|아이템잠금해제|잠금목록|사용|가방선물|판매|상점추가|상점수정|상점삭제|상점정리|상점초기화|상점내역|아이템지급|아이템회수|기능아이템목록)(?:\s|$)/.test(command)) return "shop";
  if (/^\/(?:명령어목록|커스텀명령어)(?:\s|$)/.test(command)) return "customCommands";
  return "";
}

function commandPackIdsForCommand(command) {
  return COMMAND_PACKS
    .filter((pack) => !pack.hidden && (pack.fixedCommands || []).includes(command))
    .map((pack) => pack.id);
}

function registryEntry(command, category, description, options = {}) {
  const featureKey = options.featureKey || options.requiresFeature || null;
  return {
    id: options.id || `builtin-${commandTemplateSlug(command.replace(/^\//, ""))}`,
    command,
    aliases: options.aliases || [],
    category,
    description,
    examples: options.examples || [command],
    handler: options.handler || "builtin",
    enabled: options.enabled !== false,
    visibility: options.visibility || "public",
    requiresRole: options.requiresRole || null,
    requiresFeature: featureKey,
    featureKey,
    requiresLicense: options.requiresLicense || null,
    storeTemplateId: options.storeTemplateId || "",
    packIds: options.packIds || commandPackIdsForCommand(command),
    roomScoped: options.roomScoped !== false,
    searchableKeywords: options.searchableKeywords || [],
    status: options.status || (options.enabled === false ? "disabled" : "available"),
    disabledReason: options.disabledReason || null
  };
}

const COMMAND_REGISTRY = Object.freeze([
  registryEntry("/상태", "기본", "서버 연결 상태 확인", { aliases: ["/status"], searchableKeywords: ["서버", "연결"] }),
  registryEntry("/도움말", "기본", "현재 사용 가능한 명령어 확인", { aliases: ["/help", "/?", "/메뉴", "/처음", "/찾기", "/명령어"], examples: ["/메뉴", "/찾기 게임"], searchableKeywords: ["help", "명령어", "처음", "찾기"] }),
  registryEntry("/시작", "기본", "처음 쓰는 사용자를 위한 5단계 시작 가이드", { aliases: ["/처음시작"], examples: ["/시작"], searchableKeywords: ["처음", "시작", "가이드", "튜토리얼"] }),
  registryEntry("/추천", "기본", "현재 방 상태에 맞는 추천 명령어 확인", { aliases: ["/추천명령어"], examples: ["/추천", "/추천 돈벌기", "/추천 RPG"], searchableKeywords: ["추천", "명령어", "다음", "할일", "돈벌기", "펫", "수집"] }),
  registryEntry("/오늘할일", "기본", "출석, 게임, 펫, 가방 정리 하루 루틴 안내", { aliases: ["/오늘 할일", "/할일"], examples: ["/오늘할일"], searchableKeywords: ["오늘", "할일", "루틴", "출석", "던전"] }),
  registryEntry("/브릿지", "기본", "브릿지 연결 진단", { aliases: ["/bridge"], searchableKeywords: ["연결", "진단"] }),
  registryEntry("/js상태", "기본", "브릿지 JS 호환 진단", { aliases: ["/jsstatus", "/로컬상태"], searchableKeywords: ["js", "로컬"] }),
  registryEntry("/메시지", "운영", "내 읽지 않은 메시지함 확인", { aliases: ["/메세지", "/메시지함"], searchableKeywords: ["읽지 않은", "쪽지"] }),
  registryEntry("/신고", "운영", "방 관리자에게 신고 접수", { examples: ["/신고 닉네임 사유", "/신고 사유"], searchableKeywords: ["신고", "관리자", "메시지함"] }),
  registryEntry("/날씨", "날씨", "지역별 실시간 날씨 조회", { aliases: ["/오늘날씨", "/시흥날씨", "/서울날씨"], examples: ["/날씨 서울", "/시흥날씨"], searchableKeywords: ["오늘날씨", "시흥", "서울"] }),
  registryEntry("/운세", "운세", "날짜와 사용자 기준 오늘의 운세", { aliases: ["/오늘운세"], searchableKeywords: ["오늘운세", "행운"] }),
  registryEntry("/출석", "출석", "일일 출석 보상", { aliases: ["/출석체크", "/출첵", "/ㅊㅊ"], requiresFeature: "attendance" }),
  registryEntry("/미출석", "출석", "오늘 미출석 참여자 확인", { requiresFeature: "attendance" }),
  registryEntry("/출석순위", "출석", "누적 출석 순위", { aliases: ["/출석 순위"], requiresFeature: "rankings", searchableKeywords: ["랭킹"] }),
  registryEntry("/포인트", "포인트", "내 포인트 확인", { aliases: ["/내포인트"], requiresFeature: "points" }),
  registryEntry("/내정보", "포인트", "레벨, 포인트, 채팅 정보 확인", { aliases: ["/레벨", "/정보"], requiresFeature: "points" }),
  registryEntry("/좋아요", "포인트", "포인트로 하트 보내기", { examples: ["/좋아요 닉네임 10"], requiresFeature: "points", searchableKeywords: ["하트"] }),
  registryEntry("/응원", "포인트", "포인트 응원 카드 보내기", { examples: ["/응원 닉네임 메시지"], requiresFeature: "points" }),
  registryEntry("/확률게임", "게임", "포인트 확률 게임팩 10종 안내", { examples: ["/확률게임"], requiresFeature: "games", searchableKeywords: ["포인트", "확률", "게임", "코인", "룰렛", "슬롯"] }),
  registryEntry("/뽑기", "게임", "공개 확률 포인트 뽑기", { aliases: ["/확률뽑기", "/자동뽑기"], requiresFeature: "games", searchableKeywords: ["포인트", "확률", "랜덤", "자동뽑기"] }),
  registryEntry("/뽑기목록", "게임", "뽑기 확률과 보상 확인", { requiresFeature: "games", searchableKeywords: ["포인트", "확률", "보상"] }),
  registryEntry("/홀", "게임", "홀짝 포인트 베팅", { aliases: ["/짝", "/홀짝"], examples: ["/홀 100", "/짝 100"], requiresFeature: "games", searchableKeywords: ["포인트", "베팅"] }),
  registryEntry("/코인", "게임", "앞뒤 맞히기 포인트 게임", { aliases: ["/동전"], examples: ["/코인 앞 100", "/코인 뒤 100"], requiresFeature: "games", searchableKeywords: ["포인트", "확률", "앞", "뒤"] }),
  registryEntry("/룰렛", "게임", "빨강 검정 초록 룰렛 포인트 게임", { examples: ["/룰렛 빨강 100", "/룰렛 초록 100"], requiresFeature: "games", searchableKeywords: ["포인트", "확률", "룰렛", "빨강", "검정", "초록"] }),
  registryEntry("/슬롯", "게임", "3릴 슬롯 포인트 게임", { examples: ["/슬롯 100"], requiresFeature: "games", searchableKeywords: ["포인트", "확률", "슬롯"] }),
  registryEntry("/복권", "게임", "즉석 복권 포인트 게임", { examples: ["/복권 100"], requiresFeature: "games", searchableKeywords: ["포인트", "확률", "복권"] }),
  registryEntry("/하이로우", "게임", "숫자 높낮이 맞히기 포인트 게임", { examples: ["/하이로우 하이 100", "/하이로우 로우 100"], requiresFeature: "games", searchableKeywords: ["포인트", "확률", "하이", "로우"] }),
  registryEntry("/폭탄피하기", "게임", "1~5 중 폭탄을 피하는 포인트 게임", { examples: ["/폭탄피하기 3 100"], requiresFeature: "games", searchableKeywords: ["포인트", "확률", "폭탄"] }),
  registryEntry("/보물상자", "게임", "1~4 상자 선택 포인트 게임", { examples: ["/보물상자 2 100"], requiresFeature: "games", searchableKeywords: ["포인트", "확률", "보물", "상자"] }),
  registryEntry("/이체", "포인트", "포인트 이체", { examples: ["/이체 닉네임 100"], requiresFeature: "points" }),
  registryEntry("/포인트순위", "랭킹", "방별 랭킹 확인", { aliases: ["/좋아요순위", "/레벨순위", "/채팅오늘", "/채팅금주"], requiresFeature: "rankings" }),
  registryEntry("/미끼상점", "게임", "낚시용 미끼 가격 확인", { requiresFeature: "games", searchableKeywords: ["낚시", "미끼", "상점"] }),
  registryEntry("/미끼구매", "게임", "포인트로 낚시 미끼 구매", { examples: ["/미끼구매 10"], requiresFeature: "games", searchableKeywords: ["낚시", "미끼", "구매"] }),
  registryEntry("/어항", "게임", "보유 물고기와 수집률 확인", { aliases: ["/수족관"], requiresFeature: "games", searchableKeywords: ["낚시", "물고기", "수집"] }),
  registryEntry("/상점", "상점/가방", "구매 가능한 아이템 확인", { requiresFeature: "shop" }),
  registryEntry("/구매", "상점/가방", "포인트로 아이템 구매", { examples: ["/구매 1", "/구매 1 10"], requiresFeature: "shop" }),
  registryEntry("/가방", "상점/가방", "내 아이템 확인", { aliases: ["/아이템", "/보유아이템"], examples: ["/아이템", "/아이템 다음", "/아이템 2"], requiresFeature: "shop" }),
  registryEntry("/가방정리", "상점/가방", "가방 정리와 판매 추천", { examples: ["/가방정리"], requiresFeature: "shop" }),
  registryEntry("/판매추천", "상점/가방", "판매 가능한 품목과 일괄 판매 흐름 추천", { examples: ["/판매추천"], requiresFeature: "shop", searchableKeywords: ["판매", "추천", "정리"] }),
  registryEntry("/정리추천", "상점/가방", "잠금, 중복, 재료 정리 흐름 추천", { examples: ["/정리추천"], requiresFeature: "shop", searchableKeywords: ["가방", "정리", "추천"] }),
  registryEntry("/아이템상세", "상점/가방", "짧은 번호로 아이템 상세 확인", { examples: ["/아이템상세 2"], requiresFeature: "shop" }),
  registryEntry("/판매목록", "상점/가방", "판매 가능한 보유 아이템 확인", { examples: ["/판매목록"], requiresFeature: "shop" }),
  registryEntry("/판매미리보기", "상점/가방", "일괄 판매 전 예상 포인트 확인", { examples: ["/판매미리보기 중복", "/판매미리보기 재료"], requiresFeature: "shop" }),
  registryEntry("/일괄판매", "상점/가방", "일반, 중복, 재료, 물고기 일괄 판매", { examples: ["/일괄판매 일반", "/일괄판매 중복"], requiresFeature: "shop" }),
  registryEntry("/아이템잠금", "상점/가방", "중요 아이템 판매 잠금", { aliases: ["/아이템잠금해제", "/잠금목록"], examples: ["/아이템잠금 3", "/아이템잠금해제 3"], requiresFeature: "shop" }),
  registryEntry("/사용", "상점/가방", "아이템 사용", { examples: ["/사용 1"], requiresFeature: "shop" }),
  registryEntry("/가방선물", "상점/가방", "아이템 선물", { examples: ["/가방선물 닉네임 1 1"], requiresFeature: "shop" }),
  registryEntry("/판매", "상점/가방", "가방 아이템을 포인트로 판매", { examples: ["/판매 1", "/판매 재료"], requiresFeature: "shop" }),
  registryEntry("/구매내역", "상점/가방", "구매와 아이템 내역", { requiresFeature: "shop" }),
  registryEntry("/게임", "게임", "RPG, 낚시, 펫, 수집, 점메추 게임 허브", { aliases: ["/게임명령어"], requiresFeature: "games", searchableKeywords: ["허브", "RPG", "낚시", "펫", "픽셀몬스터"] }),
  registryEntry("/주사위", "게임", "주사위 보상 게임", { requiresFeature: "games" }),
  registryEntry("/낚시", "게임", "낚시 보상 게임", { aliases: ["/자동낚시"], requiresFeature: "games", searchableKeywords: ["낚시", "자동낚시"] }),
  registryEntry("/탐험", "게임", "탐험 보상 게임", { aliases: ["/자동탐험", "/자동모험"], requiresFeature: "games", searchableKeywords: ["탐험", "자동탐험", "자동모험"] }),
  registryEntry("/모험", "RPG", "RPG 오늘 할 일과 추천 행동 확인", { aliases: ["/RPG", "/알피지"], examples: ["/모험"], requiresFeature: "games", searchableKeywords: ["RPG", "허브", "모험", "자동던전", "강화"] }),
  registryEntry("/던전", "RPG", "던전 탐험과 재료 획득", { aliases: ["/던전목록", "/자동던전", "/자동사냥", "/보상선택"], examples: ["/던전", "/던전 중급", "/자동던전 중급", "/자동던전 상급 10"], requiresFeature: "games", searchableKeywords: ["RPG", "모험", "재료", "자동던전", "자동사냥", "보상"] }),
  registryEntry("/대장간", "RPG", "장비 제작과 강화 흐름 확인", { aliases: ["/제작", "/자동제작", "/제작가능", "/강화", "/강화목록", "/강화상세", "/장비", "/장비상세", "/스탯", "/장착", "/자동장착", "/세트아이템"], examples: ["/대장간", "/제작가능", "/자동제작", "/제작 1", "/강화 무기", "/자동장착 공격"], requiresFeature: "games", searchableKeywords: ["무기", "방어구", "장신구", "제작", "자동제작", "장비", "세트", "강화"] }),
  registryEntry("/점메추", "생활", "점심 메뉴 추천", { examples: ["/점메추", "/점메추 한식", "/점메추 매운거"], searchableKeywords: ["점심", "메뉴", "추천", "음식"] }),
  registryEntry("/몬스터탐험", "픽셀몬스터", "오리지널 몬스터 발견과 수집 성장", { aliases: ["/포획", "/몬스터", "/몬스터목록", "/몬스터상세", "/몬스터팀", "/몬스터퀘스트", "/몬스터훈련", "/몬스터전투", "/몬스터진화", "/몬스터보스", "/몬스터도감"], requiresFeature: "games", searchableKeywords: ["몬스터", "수집", "도감", "퀘스트", "보스", "진화"] }),
  registryEntry("/펫입양", "펫키우기", "개인 펫 입양과 성장", { aliases: ["/펫", "/펫먹이", "/펫놀기", "/펫씻기", "/펫재우기", "/펫훈련", "/펫상점"], requiresFeature: "games", searchableKeywords: ["펫", "키우기", "훈련"] }),
  registryEntry("/명령어목록", "커스텀", "방별 커스텀 명령어 확인", { aliases: ["/커스텀명령어"], requiresFeature: "customCommands" }),
  registryEntry("/고정명령어", "커스텀", "예약된 기본 명령어 확인", { requiresFeature: "customCommands" }),
  registryEntry("/명령어검색", "스토어", "설치 가능한 명령어 코드 검색", { visibility: "admin", requiresRole: "admin", searchableKeywords: ["스토어", "장바구니", "설치코드"] }),
  registryEntry("/명령어설치", "스토어", "명령어 코드 설치 미리보기", { visibility: "admin", requiresRole: "admin", examples: ["/명령어설치 pk.001 no.100"], searchableKeywords: ["스토어", "장바구니", "설치"] }),
  registryEntry("/설치확인", "스토어", "명령어 설치 최종 확인", { visibility: "admin", requiresRole: "admin", examples: ["/설치확인 4821"], searchableKeywords: ["스토어", "설치"] }),
  registryEntry("/설치취소", "스토어", "명령어 설치 대기 취소", { visibility: "admin", requiresRole: "admin", examples: ["/설치취소 4821"], searchableKeywords: ["스토어", "설치"] }),
  registryEntry("/명령어설치목록", "스토어", "설치된 명령어 팩과 커스텀 명령어 확인", { visibility: "admin", requiresRole: "admin", searchableKeywords: ["스토어", "설치목록"] }),
  registryEntry("/명령어팩", "스토어", "명령어팩 목록과 상세 확인", { aliases: ["/팩목록"], examples: ["/명령어팩", "/명령어팩 pk.001"], searchableKeywords: ["스토어", "팩", "상세"] }),
  registryEntry("/명령어팩목록", "스토어", "장착된 명령어 팩 확인", { aliases: ["/장착팩"], visibility: "admin", requiresRole: "admin", searchableKeywords: ["스토어", "팩", "장착"] }),
  registryEntry("/명령어팩제거", "스토어", "장착된 명령어 팩 제거", { aliases: ["/팩제거"], visibility: "admin", requiresRole: "admin", examples: ["/명령어팩제거 pk.004", "/팩제거 game-chance"], searchableKeywords: ["스토어", "팩", "제거"] }),
  registryEntry("/게임팩도움말", "스토어", "게임팩 도움말 링크 확인", { aliases: ["/게임팩 도움말"], examples: ["/게임팩도움말 pet"], searchableKeywords: ["게임팩", "도움말", "펫", "RPG"] }),
  registryEntry("/프로필", "프로필", "프로필 조회", { aliases: ["/프로칠"], examples: ["/프로필 닉네임"], requiresFeature: "profiles" }),
  registryEntry("/내별명", "프로필", "내 대표 닉과 등록 별명 확인", { examples: ["/내별명"], requiresFeature: "profiles", searchableKeywords: ["별명", "닉네임", "내정보"] }),
  registryEntry("/입퇴장현황", "히스토리", "입퇴장과 닉네임 이력 조회", { aliases: ["/닉이력"], examples: ["/닉이력 닉네임"], requiresFeature: "history" }),
  registryEntry("/원본로그", "관리자", "최신 원본 JSON 확인", { aliases: ["/원본이벤트"], visibility: "admin", requiresRole: "admin", requiresFeature: "history" }),
  registryEntry("/최근이벤트", "관리자", "브릿지 원본 이벤트 요약", { aliases: ["/이벤트로그"], visibility: "admin", requiresRole: "admin", requiresFeature: "history" }),
  registryEntry("/신고목록", "관리자", "접수된 신고 목록 확인", { visibility: "admin", requiresRole: "admin", searchableKeywords: ["신고", "처리", "관리자"] }),
  registryEntry("/신고처리", "관리자", "신고 처리 완료 기록", { visibility: "admin", requiresRole: "admin", examples: ["/신고처리 R0001 처리 완료"], searchableKeywords: ["신고", "처리", "관리자"] }),
  registryEntry("/프로필등록", "관리자", "프로필 등록", { aliases: ["/프로필 등록"], visibility: "admin", requiresRole: "admin", requiresFeature: "profiles" }),
  registryEntry("/프로필삭제", "관리자", "프로필 삭제", { visibility: "admin", requiresRole: "admin", requiresFeature: "profiles" }),
  registryEntry("/별명등록", "관리자", "별명 등록", { visibility: "admin", requiresRole: "admin", requiresFeature: "profiles" }),
  registryEntry("/별명목록", "관리자", "방 별명과 병합 상태 목록", { examples: ["/별명목록", "/별명목록 오리"], visibility: "admin", requiresRole: "admin", requiresFeature: "profiles", searchableKeywords: ["별명", "닉네임", "목록", "게임방"] }),
  registryEntry("/별명삭제", "관리자", "별명 삭제", { visibility: "admin", requiresRole: "admin", requiresFeature: "profiles" }),
  registryEntry("/닉병합", "관리자", "일반방/게임방 닉네임 데이터 병합", { aliases: ["/닉네임병합", "/별명병합"], examples: ["/닉병합 오리 95 오리"], visibility: "admin", requiresRole: "admin", requiresFeature: "profiles", searchableKeywords: ["닉네임", "별명", "병합", "게임방"] }),
  registryEntry("/입퇴장상세", "관리자", "입퇴장 상세 이력", { visibility: "admin", requiresRole: "admin", requiresFeature: "history" }),
  registryEntry("/관리자등록", "관리자", "방 관리자 등록", { visibility: "admin", requiresRole: "admin" }),
  registryEntry("/관리자삭제", "관리자", "방 관리자 삭제", { visibility: "admin", requiresRole: "admin" }),
  registryEntry("/관리자재설정", "관리자", "방 관리자 목록 재설정", { aliases: ["/관리자초기화"], visibility: "admin", requiresRole: "admin" }),
  registryEntry("/관리자목록", "관리자", "방 관리자 목록 확인", { visibility: "admin", requiresRole: "admin" }),
  registryEntry("/고유값초기화", "관리자", "이름 섞임 방지용 고유값 초기화", { visibility: "admin", requiresRole: "admin", requiresFeature: "history" }),
  registryEntry("/방등록", "관리자", "방 등록", { visibility: "admin", requiresRole: "admin" }),
  registryEntry("/입장문구", "관리자", "입장확인 문구 설정", { aliases: ["/방설정"], visibility: "admin", requiresRole: "admin" }),
  registryEntry("/방정보", "관리자", "방 정보와 목록 관리", { aliases: ["/방목록", "/방삭제"], visibility: "admin", requiresRole: "admin" }),
  registryEntry("/기능목록", "관리자", "방별 기능 ON/OFF 관리", { aliases: ["/기능", "/기능켜기", "/기능끄기"], visibility: "admin", requiresRole: "admin" }),
  registryEntry("/구독상태", "관리자", "구독 상태 관리", { aliases: ["/구독연장", "/구독만료"], visibility: "admin", requiresRole: "admin" }),
  registryEntry("/명령어등록", "관리자", "커스텀 명령어 등록과 삭제", { aliases: ["/명령어수정", "/커스텀등록", "/커스텀수정", "/명령어삭제", "/커스텀삭제"], visibility: "admin", requiresRole: "admin", requiresFeature: "customCommands" }),
  registryEntry("/포인트지급", "관리자", "참여자 포인트 관리", { aliases: ["/포인트차감", "/포인트설정"], visibility: "admin", requiresRole: "admin", requiresFeature: "points" }),
  registryEntry("/상점추가", "관리자", "상점과 아이템 관리", { aliases: ["/상점수정", "/상점삭제", "/상점정리", "/상점초기화", "/상점내역", "/아이템지급", "/아이템회수", "/기능아이템목록"], visibility: "admin", requiresRole: "admin", requiresFeature: "shop" })
]);

function resolveCommandRegistryItem(command, compactCommand = "") {
  const token = normalizeCommandToken(command);
  const raw = compactSpaces(compactCommand);
  return COMMAND_REGISTRY.find((item) => (
    item.command === token
    || (item.aliases || []).includes(token)
    || (raw && (item.command === raw || (item.aliases || []).includes(raw)))
  )) || null;
}

function responseAlreadyDecorated(line = "") {
  const text = line.trim();
  return COMMAND_RESPONSE_KNOWN_PREFIXES.some((prefix) => text.startsWith(prefix));
}

function commandReplyToneIcon(reply = "") {
  const text = compactSpaces(reply).slice(0, 160);
  if (/오류|실패|찾지 못|없습니다|잘못|불가|차단|권한|만료/.test(text)) return "❌";
  if (/부족|쿨타임|대기|확인|주의|장착 중|잠금/.test(text)) return "⚠️";
  if (/완료|성공|획득|지급|저장|등록|해제/.test(text)) return "✅";
  return "";
}

function decorateCommandReplyFromMessage(message = "", reply = "") {
  if (!reply || typeof reply !== "string") return reply;
  const parsed = parseBotCommand(normalizeText(message));
  const compactCommand = compactSpaces(message);
  const command = parsed.command || normalizeCustomCommandTrigger(compactCommand);
  if (!command || COMMAND_RESPONSE_ICON_EXEMPT_COMMANDS.has(command)) return reply;
  const registryItem = resolveCommandRegistryItem(command, compactCommand);
  if (!registryItem) return reply;
  const lines = reply.split("\n");
  const index = lines.findIndex((line) => line.trim());
  if (index < 0 || responseAlreadyDecorated(lines[index])) return reply;
  const icon = commandReplyToneIcon(reply) || COMMAND_RESPONSE_ICON_BY_CATEGORY[registryItem.category] || "📘";
  lines[index] = `${icon} ${lines[index].trim()}`;
  return lines.join("\n");
}

function commandAvailability(item, roomState = null, sender = "", options = {}) {
  const adminUser = options.isAdminUser ?? (roomState ? isAdmin(roomState, sender) : false);
  if (item.enabled === false || item.status === "disabled") return { available: false, status: "disabled", disabledReason: item.disabledReason || "비활성화됨" };
  if (item.requiresRole === "admin" && !adminUser) return { available: false, status: "admin_only", disabledReason: "관리자 전용" };
  if (roomState && !commandInstalledInRoom(item, roomState)) {
    return { available: false, status: "install_required", disabledReason: "명령어 팩 설치 필요" };
  }
  if (roomState && item.requiresFeature && !featureEnabled(roomState, item.requiresFeature)) {
    return { available: false, status: "disabled", disabledReason: `${featureLabel(item.requiresFeature)} 기능이 꺼져 있습니다.` };
  }
  return { available: true, status: "available", disabledReason: null };
}

function commandSearchTokens(query = "") {
  return compactSpaces(query)
    .toLowerCase()
    .split(/[\s,]+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function commandSearchMatches(item, tokens = []) {
  if (!tokens.length) return true;
  const haystack = [
    item.command,
    ...(item.aliases || []),
    item.category,
    item.description,
    ...(item.examples || []),
    ...(item.searchableKeywords || []),
    item.sourcePackId,
    item.sourcePackTitle,
    item.status,
    item.disabledReason
  ].join(" ").toLowerCase();
  return tokens.every((token) => haystack.includes(token));
}

function activeCommandPacks(roomState) {
  const current = normalizeCommandPackState(roomState.settings?.commandPacks || {});
  return [...(current.installedPackIds || []), current.basePackId, ...(current.addonPackIds || [])]
    .map((id) => commandPackById(id))
    .filter(Boolean);
}

function roomUsesExplicitCommandPacks(roomState) {
  const current = normalizeCommandPackState(roomState?.settings?.commandPacks || {});
  return Boolean(current.installedPackIds.length || current.basePackId || current.addonPackIds.length);
}

function commandInstalledInRoom(item, roomState) {
  if (!roomState || !roomUsesExplicitCommandPacks(roomState)) return true;
  if (COMMAND_PACK_ALWAYS_INSTALLED_COMMANDS.includes(item.command)) return true;
  if ((item.aliases || []).some((alias) => COMMAND_PACK_ALWAYS_INSTALLED_COMMANDS.includes(alias))) return true;
  const activePacks = activeCommandPacks(roomState);
  if ((item.packIds || []).some((id) => activePacks.some((pack) => pack.id === id))) return true;
  const commands = [item.command, ...(item.aliases || [])];
  return activePacks.some((pack) => commands.some((command) => (pack.fixedCommands || []).includes(command)));
}

function commandPackForFixedCommand(roomState, command) {
  return activeCommandPacks(roomState).find((pack) => (pack.fixedCommands || []).includes(command)) || null;
}

function commandInstallRequiredText(item) {
  const pack = (item.packIds || []).map((id) => commandPackById(id)).find((candidate) => candidate && !candidate.hidden && candidate.slot === "pack");
  if (!pack) return "미설치 명령어입니다. /명령어팩 으로 사용 가능한 팩을 확인해 주세요.";
  const detail = publicCommandPack(pack);
  return [
    "미설치 명령어입니다.",
    "",
    `${item.command} 명령어는 ${pack.title} 장착 후 사용할 수 있습니다.`,
    `설치: ${detail.installCommand}`,
    `도움말: ${detail.helpPath || "/command-store"}`,
    "",
    "팩 상세: /명령어팩 " + (detail.installCode || pack.id)
  ].join("\n");
}

function commandCatalogItemFromRegistry(item, roomState, sender, options = {}) {
  const availability = commandAvailability(item, roomState, sender, options);
  const sourcePack = commandPackForFixedCommand(roomState, item.command);
  return {
    command: item.command,
    aliases: item.aliases || [],
    category: item.category,
    description: item.description,
    examples: item.examples || [item.command],
    available: availability.available,
    installed: commandInstalledInRoom(item, roomState),
    requiresRole: item.requiresRole,
    requiresLicense: item.requiresLicense,
    requiresFeature: item.requiresFeature,
    featureKey: item.featureKey,
    status: availability.status,
    disabledReason: availability.disabledReason,
    source: "registry",
    sourcePackId: sourcePack?.id || "",
    sourcePackTitle: sourcePack?.title || "",
    sourcePackSlot: sourcePack?.slot || "",
    packIds: item.packIds || [],
    searchableKeywords: [...(item.searchableKeywords || []), sourcePack?.title || "", sourcePack?.tier || "", ...(item.packIds || [])].filter(Boolean)
  };
}

function commandCatalogItemFromCustom(command, roomState) {
  const enabled = featureEnabled(roomState, "customCommands");
  return {
    command: command.trigger,
    aliases: [],
    category: "방별 커스텀",
    description: (command.response || "").split(/\n/)[0].slice(0, 80) || "방별 커스텀 명령어",
    examples: [command.trigger],
    available: enabled,
    installed: true,
    requiresRole: null,
    requiresLicense: null,
    requiresFeature: "customCommands",
    status: enabled ? "available" : "disabled",
    disabledReason: enabled ? null : `${featureLabel("customCommands")} 기능이 꺼져 있습니다.`,
    source: "custom",
    sourceTemplateId: command.sourceTemplateId || "",
    sourcePackId: command.sourcePackId || "",
    sourcePackTitle: command.sourcePackId ? commandPackById(command.sourcePackId)?.title || "" : "",
    sourcePackSlot: command.sourcePackSlot || "",
    searchableKeywords: [command.sourceTemplateKind || "", command.proxyCommand || "", command.sourcePackId || "", commandPackById(command.sourcePackId)?.title || ""].filter(Boolean)
  };
}

function commandCatalogItemFromTemplate(template, installedTemplateIds = new Set()) {
  const installed = installedTemplateIds.has(template.id);
  const comingSoon = template.status === "coming_soon" || template.installable === false;
  return {
    command: template.command || template.trigger,
    aliases: (template.commands || []).map((command) => command.trigger).filter(Boolean),
    category: template.categoryTitle || "명령어 스토어",
    description: template.description || template.title || "",
    examples: [template.trigger || template.command].filter(Boolean),
    available: installed && !comingSoon,
    installed,
    requiresRole: template.audience === "admin" ? "admin" : null,
    requiresLicense: null,
    requiresFeature: template.kind === "game-template" ? "games" : template.kind === "custom" ? "customCommands" : null,
    status: comingSoon ? "coming_soon" : installed ? "available" : "install_required",
    disabledReason: comingSoon ? (template.disabledReason || "준비중") : installed ? null : "설치 필요",
    source: "template",
    storeTemplateId: template.id,
    searchableKeywords: [template.title, template.kind, ...(template.tags || [])].filter(Boolean)
  };
}

function buildRoomCommandCatalog(state, roomState, account = {}, options = {}) {
  const query = normalizeText(options.query || options.q);
  const tokens = commandSearchTokens(query);
  const sender = options.sender || account.nickname || account.email || "";
  const isAdminUser = Boolean(options.isAdminUser);
  const installedCommands = customCommands(roomState);
  const installedTemplateIds = new Set(installedCommands.map((command) => command.sourceTemplateId).filter(Boolean));
  const items = [
    ...COMMAND_REGISTRY.map((item) => commandCatalogItemFromRegistry(item, roomState, sender, { isAdminUser })),
    ...installedCommands.map((command) => commandCatalogItemFromCustom(command, roomState)),
    ...COMMAND_TEMPLATES
      .filter((template) => template.kind !== "fixed")
      .map((template) => commandCatalogItemFromTemplate(template, installedTemplateIds))
  ];
  const filtered = items
    .filter((item) => isAdminUser || item.source !== "template" || item.requiresRole !== "admin" || item.status === "coming_soon")
    .filter((item) => commandSearchMatches(item, tokens))
    .slice(0, 120);
  return {
    ok: true,
    version: APP_VERSION,
    roomId: roomState.settings?.roomIds?.[0] || "",
    roomName: roomState.name || "",
    query,
    total: filtered.length,
    items: filtered
  };
}

export async function healthPayload(options = {}) {
  const dbStatus = await storageHealthStatus();
  const clientVersionCode = versionCodeFromHealthOptions(options);
  const appUpdateRequired = clientVersionCode !== null && clientVersionCode < MIN_ANDROID_VERSION_CODE;
  return {
    ok: dbStatus.ok,
    service: "kakao-room-ops-bot",
    version: APP_VERSION,
    mode: "operations",
    storage: process.env.DATABASE_URL ? "postgres" : "local-json",
    dbStatus,
    serverTime: nowIso(),
    serverTimeKst: kstTimestamp(),
    serverTimezone: "Asia/Seoul",
    minAndroidVersion: MIN_ANDROID_VERSION,
    latestAndroidVersion: LATEST_ANDROID_VERSION,
    minAndroidVersionCode: MIN_ANDROID_VERSION_CODE,
    latestAndroidVersionCode: LATEST_ANDROID_VERSION_CODE,
    clientAndroidVersionCode: clientVersionCode,
    appUpdateRequired,
    gamesEnabled: true,
    gameRoadmapEnabled: true,
    monthlyPriceKrw: MONTHLY_PRICE_KRW,
    additionalRoomPriceKrw: ADDITIONAL_ROOM_PRICE_KRW,
    defaultSubscriptionDays: DEFAULT_SUBSCRIPTION_DAYS,
    buyerConsoleUrl: `${PUBLIC_SITE_URL}/console`,
    buyerSetupUrl: `${PUBLIC_SITE_URL}/console?view=setup`,
    androidBuyerGuideUrl: `${PUBLIC_SITE_URL}/console?from=android&view=setup`,
    adminConsoleEnabled: OWNER_ADMIN_EMAILS.length > 0,
    incidentMessages: incidentMessagesPayload(),
    features: FEATURES
  };
}

function adminDeleteApplication(state, payload = {}) {
  state.applications ||= {};
  state.payments ||= {};
  const applicationId = normalizeText(payload.applicationId || payload.id);
  if (!applicationId) return { ok: false, status: 400, error: "application_id_required" };
  const application = state.applications[applicationId];
  if (!application) return { ok: false, status: 404, error: "application_not_found" };
  const payment = state.payments[application.paymentId] || null;
  if (application.accountId && state.accounts?.[application.accountId]) {
    const account = state.accounts[application.accountId];
    account.applicationIds = (account.applicationIds || []).filter((id) => id !== applicationId);
    account.updatedAt = nowIso();
  }
  if (application.paymentId) delete state.payments[application.paymentId];
  delete state.applications[applicationId];
  return {
    ok: true,
    deletedApplication: publicApplicationView(application, { ...state, payments: { ...state.payments, ...(payment ? { [payment.id]: payment } : {}) } }),
    summary: {
      applications: Object.keys(state.applications).length
    }
  };
}

function helpText(roomStateOrAdmin = false, sender = "") {
  const roomState = typeof roomStateOrAdmin === "object" && roomStateOrAdmin !== null ? roomStateOrAdmin : null;
  const isAdminUser = roomState ? isAdmin(roomState, sender) : Boolean(roomStateOrAdmin);
  const groups = new Map();
  for (const item of COMMAND_REGISTRY) {
    const availability = commandAvailability(item, roomState, sender, { isAdminUser });
    if (!availability.available) continue;
    if (item.visibility === "admin" && !isAdminUser) continue;
    if (!groups.has(item.category)) groups.set(item.category, []);
    groups.get(item.category).push(item);
  }
  const lines = [
    `${DEFAULT_BOT_NAME} ${isAdminUser ? "관리자 명령어" : "참여자 명령어"}`,
    "",
    "빠른 찾기: /시작, /추천, /찾기 게임, /찾기 가방",
    ""
  ];
  for (const [category, items] of groups.entries()) {
    lines.push(category);
    for (const item of items) {
      const aliasText = item.aliases.length ? ` (${item.aliases.join(", ")})` : "";
      const exampleText = item.examples?.[0] && item.examples[0] !== item.command ? ` 예: ${item.examples[0]}` : "";
      lines.push(`${item.command}${aliasText} - ${item.description}${exampleText}`);
    }
    lines.push("");
  }
  lines.push("모든 보상과 상점 아이템은 채팅방 가상 포인트로만 사용합니다.");
  return lines.join("\n").trim();
}

function kakaoText(text) {
  return {
    version: "2.0",
    template: {
      outputs: [{ simpleText: { text } }]
    }
  };
}

function adminTokenFromRequest(req, url, body = {}) {
  return normalizeText(
    req.headers["x-admin-token"]
      || req.headers["x-admin-session"]
      || req.headers.authorization?.replace(/^Bearer\s+/i, "")
      || url.searchParams.get("token")
      || body.token
      || body.ownerToken
  );
}

async function requireAdminConsole(req, url, body = {}) {
  const token = adminTokenFromRequest(req, url, body);
  if (!token) return { ok: false, status: 401, error: "owner_login_required" };

  if (ADMIN_CONSOLE_TOKEN && token === ADMIN_CONSOLE_TOKEN) {
    return { ok: true, by: "admin_console_token" };
  }

  const tokenPayload = verifyTokenPayload(token);
  if (tokenPayload?.kind === "owner-admin" && isOwnerEmail(tokenPayload.email)) {
    return { ok: true, by: tokenPayload.email };
  }

  const external = await supabaseUserFromAccessToken(token);
  if (external.ok && isOwnerEmail(external.user.email)) {
    return { ok: true, by: external.user.email };
  }

  return { ok: false, status: 403, error: "owner_only" };
}

function applicationForRoomState(state = {}, roomState = {}) {
  const targetKey = roomKey(roomState.name);
  return Object.values(state.applications || {})
    .filter((application) => !application.archivedAt)
    .find((application) => roomKey(application.roomName) === targetKey) || null;
}

const COMMAND_DISCOVERY_TOPICS = Object.freeze([
  {
    key: "게임",
    aliases: ["게임", "미니게임", "확률게임", "낚시", "던전", "rpg"],
    title: "게임/RPG",
    commands: ["/게임", "/확률게임", "/낚시", "/던전", "/가방정리", "/코인 앞 100", "/룰렛 빨강 100", "/자동던전 상급 10", "/슬롯 100", "/오늘할일", "/모험", "/강화목록", "/자동탐험", "/자동낚시", "/자동뽑기", "/대장간", "/자동제작"]
  },
  {
    key: "가방",
    aliases: ["가방", "아이템", "판매", "상점", "정리"],
    title: "가방/상점",
    commands: ["/가방", "/정리추천", "/판매추천", "/아이템상세 1", "/판매목록", "/판매미리보기 중복", "/판매 재료", "/아이템잠금 1"]
  },
  {
    key: "포인트",
    aliases: ["포인트", "랭킹", "순위", "출석"],
    title: "포인트/출석",
    commands: ["/포인트", "/출석", "/출석순위", "/포인트순위", "/좋아요 닉네임 10", "/이체 닉네임 100"]
  },
  {
    key: "운영",
    aliases: ["운영", "관리", "관리자", "방설정"],
    title: "운영/관리",
    commands: ["/상태", "/명령어팩", "/명령어설치목록", "/관리자목록", "/기능목록", "/신고목록"]
  },
  {
    key: "도움",
    aliases: ["도움", "도움말", "처음", "시작"],
    title: "처음 시작",
    commands: ["/시작", "/추천", "/메뉴", "/도움말", "/찾기 게임", "/찾기 가방", "/게임팩도움말", "/명령어팩"]
  }
]);

function commandDiscoveryHubText(roomState = null, sender = "") {
  const isAdminUser = roomState ? isAdmin(roomState, sender) : false;
  return [
    "📘 픽셀곰 메뉴",
    "",
    "처음 시작: /시작, /추천",
    "게임 찾기: /찾기 게임",
    "가방 정리: /찾기 가방",
    "포인트/출석: /찾기 포인트",
    isAdminUser ? "관리자 기능: /찾기 운영" : "문의/신고: /신고 사유",
    "",
    "자주 쓰는 흐름",
    "1. /게임 -> 즐길 콘텐츠 확인",
    "2. /가방 -> 보유 아이템 확인",
    "3. /가방정리 -> 판매/잠금 추천",
    "",
    "찾기 예시: /찾기 낚시, /찾기 RPG, /찾기 판매"
  ].join("\n");
}

function commandDiscoveryTopic(query = "") {
  const normalized = normalizeText(query).toLowerCase();
  if (!normalized) return null;
  return COMMAND_DISCOVERY_TOPICS.find((topic) => (
    topic.aliases.some((alias) => normalized.includes(alias.toLowerCase()))
  )) || null;
}

function commandFindText(roomState = null, sender = "", query = "") {
  const normalized = normalizeText(query);
  const topic = commandDiscoveryTopic(normalized);
  if (!topic) {
    const tokens = commandSearchTokens(normalized);
    const isAdminUser = roomState ? isAdmin(roomState, sender) : false;
    const matches = COMMAND_REGISTRY
      .filter((item) => item.visibility !== "admin" || isAdminUser)
      .filter((item) => commandSearchMatches(item, tokens))
      .filter((item) => commandAvailability(item, roomState, sender, { isAdminUser }).available)
      .slice(0, 8);
    if (matches.length) {
      return [
        `🔎 명령어 찾기: ${normalized}`,
        "",
        ...matches.map((item, index) => {
          const example = item.examples?.[0] && item.examples[0] !== item.command ? ` 예: ${item.examples[0]}` : "";
          return `${index + 1}. ${item.command} - ${item.description}${example}`;
        }),
        "",
        "처음이면 /시작, 추천은 /추천"
      ].join("\n");
    }
    return [
      "🔎 명령어 찾기",
      "",
      "찾고 싶은 콘텐츠를 붙여서 입력해 주세요.",
      "",
      "/찾기 게임",
      "/찾기 가방",
      "/찾기 포인트",
      "/찾기 운영",
      "",
      "처음이면 /시작, 추천은 /추천"
    ].join("\n");
  }
  const isAdminUser = roomState ? isAdmin(roomState, sender) : false;
  const commandLines = topic.commands
    .filter((line) => isAdminUser || !["/관리자목록", "/기능목록", "/신고목록", "/명령어설치목록"].some((adminCommand) => line.startsWith(adminCommand)))
    .slice(0, 8)
    .map((line, index) => `${index + 1}. ${line}`);
  return [
    `🔎 명령어 찾기: ${topic.title}`,
    "",
    ...commandLines,
    "",
    "상세 도움말: /도움말",
    "팩 상세: /명령어팩 코드"
  ].join("\n");
}

function starterTutorialText(roomState = null, sender = "") {
  const isAdminUser = roomState ? isAdmin(roomState, sender) : false;
  return [
    "📘 픽셀곰 시작 가이드",
    "",
    "1. 상태 확인: /상태",
    "2. 오늘 할 일: /오늘할일, /추천",
    "3. 콘텐츠 찾기: /찾기 게임",
    "4. 보상 확인: /포인트, /가방",
    "5. 정리/판매: /가방정리",
    "",
    isAdminUser ? "관리자는 /명령어팩목록, /기능목록도 함께 확인하세요." : "모르는 명령어는 /메뉴 또는 /찾기 단어 로 찾을 수 있습니다."
  ].join("\n");
}

const COMMAND_RECOMMENDATION_PRESETS = Object.freeze({
  default: {
    label: "기본",
    findHint: "/찾기 게임, /찾기 가방",
    commands: [
      { command: "/출석", reason: "오늘 보상 받기", feature: "attendance" },
      { command: "/포인트", reason: "현재 포인트 확인", feature: "points" },
      { command: "/게임", reason: "즐길 콘텐츠 보기", feature: "games" },
      { command: "/가방정리", reason: "아이템 판매/잠금 추천", feature: "shop" },
      { command: "/점메추", reason: "점심 메뉴 빠르게 추천" }
    ]
  },
  game: {
    label: "게임",
    findHint: "/찾기 게임, /게임팩도움말",
    commands: [
      { command: "/확률게임", reason: "포인트 확률 게임 10종 보기", feature: "games" },
      { command: "/주사위", reason: "가볍게 포인트 게임 시작", feature: "games" },
      { command: "/코인", reason: "앞뒤 맞히기", feature: "games" },
      { command: "/낚시", reason: "미끼로 물고기 수집", feature: "games" },
      { command: "/던전", reason: "RPG 재료와 장비 보상", feature: "games" },
      { command: "/몬스터탐험", reason: "픽셀몬스터 수집 시작", feature: "games" },
      { command: "/펫", reason: "펫 상태 확인", feature: "games" },
      { command: "/점메추", reason: "채팅 참여형 유틸" }
    ],
    topCommands: ["/확률게임", "/주사위", "/코인", "/룰렛", "/슬롯", "/낚시", "/던전", "/탐험", "/몬스터탐험", "/포획", "/펫", "/점메추"]
  },
  ops: {
    label: "운영",
    findHint: "/찾기 운영, /명령어팩목록",
    commands: [
      { command: "/상태", reason: "서버 연결과 방 상태 확인" },
      { command: "/명령어팩목록", reason: "장착된 팩 확인" },
      { command: "/기능목록", reason: "방 기능 ON/OFF 점검" },
      { command: "/명령어설치목록", reason: "설치 명령어와 삭제 코드 확인" },
      { command: "/신고목록", reason: "접수된 신고 확인" },
      { command: "/방정보", reason: "라이선스와 방 설정 확인" }
    ],
    adminOnly: true,
    topCommands: ["/상태", "/명령어팩목록", "/기능목록", "/명령어설치목록", "/신고목록", "/방정보", "/관리자목록"]
  },
  cleanup: {
    label: "정리",
    findHint: "/찾기 판매, /찾기 가방",
    commands: [
      { command: "/가방정리", reason: "판매/잠금 정리 추천", feature: "shop" },
      { command: "/판매미리보기 중복", reason: "중복 아이템 예상 판매액 확인", feature: "shop" },
      { command: "/판매미리보기 재료", reason: "재료 일괄 판매 전 확인", feature: "shop" },
      { command: "/잠금목록", reason: "보호 중인 아이템 확인", feature: "shop" },
      { command: "/아이템", reason: "짧은 번호로 보유품 확인", feature: "shop" },
      { command: "/구매내역", reason: "구매/선물 내역 확인", feature: "shop" }
    ],
    topCommands: ["/가방정리", "/판매미리보기", "/판매", "/잠금목록", "/아이템", "/보유아이템", "/구매내역"]
  },
  earning: {
    label: "돈 벌기",
    findHint: "/게임, /오늘할일",
    commands: [
      { command: "/출석", reason: "기본 포인트 보상", feature: "attendance" },
      { command: "/낚시", reason: "물고기 획득 후 판매", feature: "games" },
      { command: "/던전", reason: "재료 획득 후 판매/제작", feature: "games" },
      { command: "/판매추천", reason: "가방에서 팔 만한 아이템 찾기", feature: "shop" },
      { command: "/포인트순위", reason: "방 포인트 경쟁 확인", feature: "rankings" }
    ],
    topCommands: ["/출석", "/낚시", "/던전", "/판매", "/판매추천", "/포인트", "/포인트순위"]
  },
  rpg: {
    label: "RPG",
    findHint: "/게임, /도움말 RPG",
    commands: [
      { command: "/모험", reason: "RPG 오늘 할 일과 성장 추천", feature: "games" },
      { command: "/자동던전 상급 10", reason: "자동던전권 10장으로 던전 100회 요약", feature: "games" },
      { command: "/던전", reason: "재료와 장비 성장", feature: "games" },
      { command: "/강화목록", reason: "강화할 장비와 비용 확인", feature: "games" },
      { command: "/제작가능", reason: "지금 만들 수 있는 장비 확인", feature: "games" },
      { command: "/자동제작", reason: "제작 가능한 장비 중 강한 장비 자동 제작", feature: "games" },
      { command: "/자동장착", reason: "보유 장비 자동 추천", feature: "games" },
      { command: "/장비", reason: "현재 장비 요약", feature: "games" },
      { command: "/스탯", reason: "전투 능력치 확인", feature: "games" }
    ],
    topCommands: ["/모험", "/자동던전", "/자동탐험", "/자동낚시", "/자동뽑기", "/던전", "/강화목록", "/강화", "/제작가능", "/자동제작", "/제작", "/자동장착", "/장비", "/스탯", "/세트아이템"]
  },
  pet: {
    label: "펫",
    findHint: "/게임, /도움말 펫",
    commands: [
      { command: "/펫입양", reason: "첫 펫 시작", feature: "games" },
      { command: "/펫", reason: "펫 상태 확인", feature: "games" },
      { command: "/펫먹이", reason: "배고픔 관리", feature: "games" },
      { command: "/펫놀기", reason: "행복도 관리", feature: "games" },
      { command: "/펫훈련", reason: "레벨 성장", feature: "games" }
    ],
    topCommands: ["/펫", "/펫입양", "/펫먹이", "/펫놀기", "/펫씻기", "/펫재우기", "/펫훈련"]
  },
  collection: {
    label: "수집",
    findHint: "/게임, /게임팩도움말 monster",
    commands: [
      { command: "/몬스터", reason: "대표팀과 오늘 할 일 확인", feature: "games" },
      { command: "/몬스터퀘스트", reason: "오늘 수집 목표 확인", feature: "games" },
      { command: "/몬스터탐험", reason: "픽셀몬스터 발견", feature: "games" },
      { command: "/포획", reason: "발견한 몬스터 포획", feature: "games" },
      { command: "/몬스터팀", reason: "대표팀 3마리 편성", feature: "games" },
      { command: "/몬스터보스", reason: "방 전체 주간 보스 참여", feature: "games" },
      { command: "/몬스터목록", reason: "보유 몬스터 확인", feature: "games" },
      { command: "/몬스터도감", reason: "도감 수집률 확인", feature: "games" }
    ],
    topCommands: ["/몬스터", "/몬스터퀘스트", "/몬스터탐험", "/포획", "/몬스터팀", "/몬스터보스", "/몬스터도감", "/몬스터훈련", "/몬스터전투"]
  }
});

function recommendationPresetFromText(text = "") {
  const key = keyFor(text);
  if (!key) return COMMAND_RECOMMENDATION_PRESETS.default;
  if (["돈벌기", "돈", "포인트벌기", "돈벌", "earning", "earn"].includes(key)) return COMMAND_RECOMMENDATION_PRESETS.earning;
  if (["rpg", "알피지", "던전", "장비", "제작"].includes(key)) return COMMAND_RECOMMENDATION_PRESETS.rpg;
  if (["펫", "펫키우기", "pet"].includes(key)) return COMMAND_RECOMMENDATION_PRESETS.pet;
  if (["수집", "몬스터", "픽셀몬스터", "도감", "collection", "collect"].includes(key)) return COMMAND_RECOMMENDATION_PRESETS.collection;
  if (["게임", "game", "games"].includes(key)) return COMMAND_RECOMMENDATION_PRESETS.game;
  if (["운영", "관리", "관리자", "ops", "admin", "operation"].includes(key)) return COMMAND_RECOMMENDATION_PRESETS.ops;
  if (["정리", "가방", "판매", "cleanup", "clean", "inventory", "shop"].includes(key)) return COMMAND_RECOMMENDATION_PRESETS.cleanup;
  return COMMAND_RECOMMENDATION_PRESETS.default;
}

function recentTopCommandRows(roomState = {}, preset = COMMAND_RECOMMENDATION_PRESETS.default, limit = 5) {
  const allowed = new Set(preset.topCommands || []);
  const counts = new Map();
  for (const log of (roomState.analyticsLogs || []).slice(-300)) {
    const command = normalizeText(log.command || "");
    if (!command || command === "/추천" || command === "/추천명령어") continue;
    if (allowed.size && !allowed.has(command)) continue;
    counts.set(command, (counts.get(command) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([command, count], index) => `${index + 1}. ${command} ${formatNumber(count)}회`);
}

function commandRecommendationText(roomState = null, sender = "", topicText = "") {
  const person = roomState && sender ? ensurePerson(roomState, sender) : null;
  const isAdminUser = roomState ? isAdmin(roomState, sender) : false;
  const preset = recommendationPresetFromText(topicText);
  const suggestions = [...preset.commands];
  if (person && Object.keys(person.inventory || {}).length) {
    suggestions.unshift({ command: "/판매미리보기 중복", reason: "중복 아이템 정리", feature: "shop" });
  }
  if (isAdminUser && preset === COMMAND_RECOMMENDATION_PRESETS.default) {
    suggestions.push({ command: "/명령어팩목록", reason: "장착된 팩 확인" });
    suggestions.push({ command: "/기능목록", reason: "방 기능 ON/OFF 확인" });
  }
  if (preset.adminOnly && !isAdminUser) {
    suggestions.unshift({ command: "/상태", reason: "참여자가 확인 가능한 기본 상태" });
  }
  const lines = suggestions
    .filter((item) => !item.feature || !roomState || featureEnabled(roomState, item.feature))
    .slice(0, 7)
    .map((item, index) => `${index + 1}. ${item.command} - ${item.reason}`);
  const topRows = roomState ? recentTopCommandRows(roomState, preset, 5) : [];
  return [
    `✨ 추천 명령어${preset.label === "기본" ? "" : `: ${preset.label}`}`,
    "",
    ...lines,
    "",
    "많이 쓰는 명령어 TOP",
    ...(topRows.length ? topRows : ["아직 기록 없음"]),
    "",
    `더 찾기: ${preset.findHint}`,
    "처음 안내: /시작"
  ].join("\n");
}

function roomLastSettingsSavedAt(roomState = {}) {
  const settings = roomState.settings || {};
  const event = [...(roomState.events || []), ...(roomState.rawEvents || [])]
    .filter((item) => ["admin_console_room_saved", "buyer_room_mode_settings_updated", "room_mode_settings_updated", "admin_game_room_linked"].includes(item?.type))
    .sort((left, right) => String(right.at || "").localeCompare(String(left.at || "")))[0];
  return settings.modeSplit?.updatedAt
    || settings.lastSavedAt
    || settings.license?.updatedAt
    || event?.at
    || settings.registeredAt
    || "";
}

function roomLifecycleSnapshot(state = {}, roomState = {}, application = null, archivedRecord = null) {
  if (application) {
    return applicationLifecycleSnapshot(state, application, roomState, { archivedRecord });
  }
  const subscription = updateSubscriptionStatus(roomState);
  if (archivedRecord || roomState.settings?.archivedAt) {
    return { status: "archived", label: "이용 종료 보관", tone: "bad", available: false, actionRequired: "복구 요청 또는 관리자 복구", reason: archivedRecord?.reason || roomState.settings?.archivedReason || "" };
  }
  if (subscription.status === "expired") return { status: "expired", label: "만료", tone: "bad", available: false, actionRequired: "연장 결제 필요" };
  if (roomState.settings?.enabled === false) return { status: "on_hold", label: "보류", tone: "bad", available: false, actionRequired: "방 사용 설정 확인" };
  if (!roomState.settings?.registered) return { status: "needs_setup", label: "설정 필요", tone: "warn", available: false, actionRequired: "방 등록 및 앱 연결 필요" };
  return { status: "active", label: "이용 중", tone: "good", available: true, actionRequired: "정상 운영" };
}

function roomStatusSnapshot(state = {}, roomState = {}, options = {}) {
  const application = options.application || applicationForRoomState(state, roomState);
  const account = options.account || state.accounts?.[application?.accountId] || {};
  const subscription = updateSubscriptionStatus(roomState);
  const diagnostics = roomDiagnostics(roomState);
  const license = licenseSettings(roomState);
  const settings = roomState.settings || {};
  const role = effectiveRoomRoleForApplication(state, roomState, application || {}, account);
  const bridgeReady = Boolean(license.key && (settings.roomIds || []).length && settings.registered !== false);
  const modeSplit = normalizedModeSplit(settings.modeSplit, {
    blockGamesInGeneralRoom: role === "general",
    blockOpsInGameRoom: role === "game",
    sharePointsAndInventory: true
  });
  return {
    roomName: roomState.name || "",
    role,
    roleLabel: role === "general" ? "일반방" : role === "game" ? "게임방" : "단일방",
    canonicalRoomKey: settings.canonicalRoomKey || "",
    canonicalRoomName: settings.canonicalRoomName || "",
    linkedGameRoomKeys: settings.linkedGameRoomKeys || [],
    lifecycle: roomLifecycleSnapshot(state, roomState, application, options.archivedRecord),
    subscription: {
      status: subscription.status || "unset",
      label: subscription.statusLabel || subscriptionStatusLabel(subscription.status || "unset", subscription.remainingDays),
      expiresAt: subscription.expiresAt || "",
      remainingDays: subscription.remainingDays
    },
    payment: application ? publicPaymentView(state.payments?.[application.paymentId] || {}) : null,
    license: {
      status: license.key ? license.status || "active" : "missing",
      hasKey: Boolean(license.key)
    },
    bridge: {
      status: bridgeReady ? "ready" : "needs_setup",
      label: bridgeReady ? "연동 가능" : "연동 확인 필요",
      roomIds: settings.roomIds || [],
      roomLinks: settings.roomLinks || []
    },
    settings: {
      enabled: settings.enabled !== false,
      registered: Boolean(settings.registered),
      lastSavedAt: roomLastSettingsSavedAt(roomState),
      modeSplit: {
        ...modeSplit,
        generalRoomGameBlocked: modeSplit.blockGamesInGeneralRoom,
        gameRoomOpsBlocked: modeSplit.blockOpsInGameRoom,
        sharedData: modeSplit.sharePointsAndInventory
      },
      issues: diagnostics.problems || [],
      history: (settings.settingsHistory || []).slice(-10).reverse()
    },
    permissions: {
      buyerEditable: ["features", "modeSplit", "commandPacks", "inquiries", "transfers", "restoreRequests"],
      adminOnly: ["roomName", "license", "payment", "subscription", "admins"]
    },
    diagnostics
  };
}

function gameCommandTopObjects(roomState = {}, limit = 5) {
  const gameCommands = new Set([
    "/게임", "/확률게임", "/오늘할일", "/주사위", "/낚시", "/자동낚시", "/탐험", "/자동탐험", "/자동모험", "/뽑기", "/자동뽑기", "/홀짝", "/홀", "/짝", "/코인", "/동전", "/룰렛", "/슬롯", "/복권", "/하이로우", "/폭탄피하기", "/보물상자", "/모험", "/자동던전", "/자동사냥", "/던전", "/강화", "/강화목록", "/몬스터탐험", "/포획", "/펫", "/펫먹이", "/점메추",
    "/판매추천", "/정리추천", "/가방정리", "/판매미리보기", "/자동장착"
  ]);
  const counts = new Map();
  for (const log of (roomState.analyticsLogs || []).slice(-500)) {
    const command = normalizeText(log.command || "");
    if (!command || !gameCommands.has(command)) continue;
    counts.set(command, (counts.get(command) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([command, count]) => ({ command, count }));
}

function gameOpsOverviewPayload(roomState = {}) {
  const features = roomFeatures(roomState);
  const settings = gameSettings(roomState);
  const packState = commandPackStatePayload(roomState.settings?.commandPacks || {});
  const shopItemCount = Object.keys(roomState.shop || {}).filter((key) => roomState.shop?.[key]?.active !== false).length;
  return {
    enabled: features.games !== false,
    statusLabel: features.games === false ? "게임 꺼짐" : "게임 사용 가능",
    installedGamePacks: (packState.installedPackDetails || [])
      .filter((pack) => ["game-chance", "rpg-adventure", "pixel-monster-rpg", "pet-raising", "shop-inventory"].includes(pack.id))
      .map((pack) => ({ id: pack.id, title: pack.title, code: pack.installCode || pack.id, commandCount: pack.commandCount || pack.fixedCommands?.length || 0 })),
    cooldowns: [
      { command: "/낚시", seconds: GAME_COOLDOWNS_MS.fishing / 1000 },
      { command: "/던전", seconds: GAME_COOLDOWNS_MS.dungeon / 1000 },
      { command: "/뽑기", seconds: GAME_COOLDOWNS_MS.luckyDraw / 1000 },
      { command: "/홀짝", seconds: GAME_COOLDOWNS_MS.oddEven / 1000 },
      { command: "/코인", seconds: GAME_COOLDOWNS_MS.coinFlip / 1000 },
      { command: "/룰렛", seconds: GAME_COOLDOWNS_MS.roulette / 1000 }
    ],
    rewards: {
      seasonName: settings.seasonName,
      diceReward: settings.diceReward,
      fishingReward: "물고기 아이템",
      exploreReward: "전리품 아이템"
    },
    shopItemCount,
    recentTopCommands: gameCommandTopObjects(roomState, 5)
  };
}

function gameUsageSummaryPayload(roomState = {}, person = null) {
  const features = roomFeatures(roomState);
  const packState = commandPackStatePayload(roomState.settings?.commandPacks || {});
  const inventory = person?.inventory || {};
  const inventoryCount = Object.values(inventory).reduce((sum, count) => sum + Math.max(0, Number(count) || 0), 0);
  return {
    enabled: features.games !== false,
    availableContent: [
      "출석/포인트",
      features.games === false ? "" : "RPG/낚시/펫/픽셀몬스터",
      "점메추",
      "가방/판매"
    ].filter(Boolean),
    installedGamePacks: (packState.installedPackDetails || [])
      .filter((pack) => ["game-chance", "rpg-adventure", "pixel-monster-rpg", "pet-raising", "shop-inventory"].includes(pack.id))
      .map((pack) => ({ id: pack.id, title: pack.title, code: pack.installCode || pack.id })),
    nextActions: ["/출석", "/오늘할일", "/낚시", "/던전", "/펫", "/정리추천"],
    cleanupRecommendation: inventoryCount > 0 ? `/판매미리보기 중복 또는 /정리추천 (${formatNumber(inventoryCount)}개 보유)` : "가방이 비어 있으면 /게임 또는 /상점부터 확인하세요.",
    appConnectionHint: "앱 연결 상태는 설치 안내 탭의 연결코드 카드에서 확인합니다."
  };
}

function roomAdminView(roomState, state = null, options = {}) {
  const settings = roomState.settings || {};
  const subscription = updateSubscriptionStatus(roomState);
  const license = licenseSettings(roomState);
  const features = roomFeatures(roomState);
  const roomIds = settings.roomIds || [];
  const customCommandsList = customCommands(roomState);
  const admins = state && typeof state === "object"
    ? uniqueNames(linkedRoomStatesForAdminSync(state, roomState).flatMap((room) => room.admins || []))
    : roomState.admins || [];
  return {
    name: roomState.name || "",
    registered: Boolean(settings.registered),
    enabled: settings.enabled !== false,
    roomRole: normalizeRoomRole(settings.roomRole),
    canonicalRoomKey: settings.canonicalRoomKey || "",
    canonicalRoomName: settings.canonicalRoomName || "",
    linkedGameRoomKeys: settings.linkedGameRoomKeys || [],
    roomIds,
    roomLinks: settings.roomLinks || [],
    joinPhrase: settings.joinPhrase || DEFAULT_JOIN_PHRASE,
    admins,
    licenseKey: license.key || "",
    licenseStatus: license.key ? license.status || "active" : "missing",
    bridgeStatus: license.key && roomIds.length ? "ready" : "needs_setup",
    features,
    featureSummary: Object.entries(FEATURE_LABELS)
      .filter(([key]) => features[key] !== false)
      .map(([, label]) => label),
    disabledFeatures: Object.entries(FEATURE_LABELS)
      .filter(([key]) => features[key] === false)
      .map(([, label]) => label),
    customCommands: customCommandsList,
    commandCount: customCommandsList.length,
    commandPacks: commandPackStatePayload(settings.commandPacks || {}),
    aliasSummary: aliasSummaryPayload(roomState, { limit: 20 }),
    gameOpsOverview: gameOpsOverviewPayload(roomState),
    gameSettings: gameSettings(roomState),
    settingsHistory: (settings.settingsHistory || []).slice(-20).reverse(),
    lastSettingsSavedAt: roomLastSettingsSavedAt(roomState),
    subscription: {
      status: subscription.status || "unset",
      statusLabel: subscription.statusLabel || subscriptionStatusLabel(subscription.status || "unset", subscription.remainingDays),
      monthlyPriceKrw: subscription.monthlyPriceKrw || MONTHLY_PRICE_KRW,
      startedAt: subscription.startedAt || "",
      expiresAt: subscription.expiresAt || "",
      remainingDays: subscription.remainingDays,
      notice: subscription.notice || subscriptionNoticeText(subscription.status || "unset", subscription.remainingDays)
    },
    diagnostics: roomDiagnostics(roomState),
    roomStatusSnapshot: state && typeof state === "object" ? roomStatusSnapshot(state, roomState, options) : null
  };
}

function roomDiagnostics(roomState) {
  const subscription = updateSubscriptionStatus(roomState);
  const license = licenseSettings(roomState);
  const features = roomFeatures(roomState);
  const roomIds = roomState.settings?.roomIds || [];
  const rawEvents = roomState.rawEvents || [];
  const events = roomState.events || [];
  const analyticsLogs = roomState.analyticsLogs || [];
  const problems = [];
  const bridgeProblems = [];
  if (!roomState.settings?.registered) problems.push("방 미등록");
  if (roomState.settings?.enabled === false) problems.push("방 비활성화");
  if (!license.key) problems.push("라이선스 없음");
  if (subscription.status === "expired") problems.push("구독 만료");
  if (!subscription.expiresAt) problems.push("구독 만료일 미설정");
  if (!Object.values(features).some(Boolean)) problems.push("모든 기능 꺼짐");
  if (!roomIds.length) bridgeProblems.push("roomId 없음");
  if (!license.key) bridgeProblems.push("라이선스 없음");
  if (!roomState.settings?.registered) bridgeProblems.push("등록 방 아님");
  const lastActivityAt = analyticsLogs.at(-1)?.at || rawEvents.at(-1)?.at || events.at(-1)?.at || "";
  return {
    ok: problems.length === 0,
    problems,
    bridgeStatus: bridgeProblems.length ? "needs_setup" : "ready",
    bridgeProblems,
    connectionStatus: lastActivityAt ? "event_seen" : "no_events",
    peopleCount: Object.keys(roomState.people || {}).length,
    adminsCount: (roomState.admins || []).length,
    rawEventCount: rawEvents.length,
    eventCount: events.length,
    analyticsLogCount: analyticsLogs.length,
    lastRawEventAt: rawEvents.at(-1)?.at || "",
    lastEventAt: events.at(-1)?.at || "",
    lastAnalyticsLogAt: analyticsLogs.at(-1)?.at || "",
    subscriptionStatus: subscription.status || "unset",
    subscriptionRemainingDays: remainingDays(subscription.expiresAt),
    licenseStatus: license.key ? license.status || "active" : "missing"
  };
}

function adminDiagnosticsSummary(diagnosticRooms = []) {
  const problemRooms = diagnosticRooms.filter((room) => room.diagnostics?.ok === false);
  const expiredRooms = diagnosticRooms.filter((room) => room.diagnostics?.subscriptionStatus === "expired");
  const bridgeProblemRooms = diagnosticRooms.filter((room) => room.diagnostics?.bridgeStatus !== "ready");
  const connectionIssueRooms = diagnosticRooms.filter((room) => room.diagnostics?.connectionStatus === "no_events");
  return {
    rooms: diagnosticRooms.length,
    problemRooms: problemRooms.length,
    expiredRooms: expiredRooms.length,
    bridgeProblemRooms: bridgeProblemRooms.length,
    connectionIssueRooms: connectionIssueRooms.length,
    problemRoomNames: problemRooms.map((room) => room.name).slice(0, 10),
    expiredRoomNames: expiredRooms.map((room) => room.name).slice(0, 10),
    bridgeProblemRoomNames: bridgeProblemRooms.map((room) => room.name).slice(0, 10)
  };
}

function analyticsWindowMs(windowText = "") {
  const key = normalizeText(windowText || "");
  if (!key || key === "all") return 0;
  const named = {
    "1h": 60 * 60 * 1000,
    "6h": 6 * 60 * 60 * 1000,
    "12h": 12 * 60 * 60 * 1000,
    "24h": 24 * 60 * 60 * 1000,
    "7d": 7 * 24 * 60 * 60 * 1000,
    "30d": 30 * 24 * 60 * 60 * 1000
  };
  if (named[key]) return named[key];
  const match = key.match(/^(\d+)(m|h|d)$/);
  if (!match) return 24 * 60 * 60 * 1000;
  const amount = Math.max(1, Math.min(365, Number(match[1]) || 1));
  const unitMs = match[2] === "m" ? 60 * 1000 : match[2] === "h" ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  return amount * unitMs;
}

function analyticsLimit(value) {
  return Math.min(
    Math.max(1, Number(value || ROOM_ANALYTICS_EXPORT_LIMIT) || ROOM_ANALYTICS_EXPORT_LIMIT),
    ROOM_ANALYTICS_EXPORT_LIMIT
  );
}

function adminRoomLogsPayload(state = {}, query = {}, options = {}) {
  const requestedRoom = normalizeText(query.room || query.roomName || "");
  const requestedType = normalizeText(query.type || query.eventType || "");
  const requestedCommand = normalizeText(query.command || "");
  const keyword = normalizeText(query.q || query.query || "");
  const requestedWindow = normalizeText(query.window || "");
  const includeAllLogs = options.includeAllLogs === true;
  const windowMs = analyticsWindowMs(requestedWindow);
  const now = Date.now();
  const limit = analyticsLimit(query.limit);
  const rooms = Object.values(state.rooms || {}).filter((roomState) => {
    if (!requestedRoom) return true;
    return roomKey(roomState.name) === roomKey(requestedRoom);
  });
  const allLogs = rooms.flatMap((roomState) => (roomState.analyticsLogs || []).map((log) => ({
    ...log,
    room: log.room || roomState.name || ""
  })));
  const filtered = allLogs
    .filter((log) => {
      if (!windowMs) return true;
      const time = new Date(log.at || 0).getTime();
      return Number.isFinite(time) && now - time <= windowMs;
    })
    .filter((log) => !requestedType || log.eventType === requestedType)
    .filter((log) => !requestedCommand || log.command === requestedCommand || log.command === `/${requestedCommand.replace(/^\/+/, "")}`)
    .filter((log) => {
      if (!keyword) return true;
      const haystack = `${log.room || ""} ${log.sender || ""} ${log.messagePreview || ""} ${log.command || ""} ${log.eventType || ""}`;
      return keyFor(haystack).includes(keyFor(keyword));
    })
    .sort((left, right) => String(right.at || "").localeCompare(String(left.at || "")));
  const roomSummaries = rooms.map((roomState) => {
    const logs = roomState.analyticsLogs || [];
    return {
      room: roomState.name || "",
      roomKey: roomKey(roomState.name || ""),
      count: logs.length,
      firstAt: logs[0]?.at || "",
      lastAt: logs.at(-1)?.at || ""
    };
  });
  const recent24h = filtered.filter((log) => {
    const time = new Date(log.at || 0).getTime();
    return Number.isFinite(time) && now - time <= 24 * 60 * 60 * 1000;
  }).length;
  const commandLogs = filtered.filter((log) => log.isCommand || log.command);
  const errorLogs = filtered.filter((log) => {
    const text = `${log.eventType || ""} ${log.command || ""} ${log.messagePreview || ""}`.toLowerCase();
    return /error|fail|exception|오류|실패|에러/.test(text);
  });
  const commandCounts = new Map();
  for (const log of commandLogs) {
    const command = log.command || "명령어";
    commandCounts.set(command, (commandCounts.get(command) || 0) + 1);
  }
  const topCommands = [...commandCounts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 5)
    .map(([command, count]) => ({ command, count }));
  const finite = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
  const avg = (values) => values.length
    ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10
    : 0;
  const percentile = (values, ratio) => {
    if (!values.length) return 0;
    return Math.round(values[Math.min(values.length - 1, Math.floor(values.length * ratio))] * 10) / 10;
  };
  const commandPerformance = new Map();
  for (const log of commandLogs) {
    const command = log.command || "명령어";
    const row = commandPerformance.get(command) || { command, totalMs: [], commandMs: [], saveStateMs: [] };
    row.totalMs.push(finite(log.totalMs));
    row.commandMs.push(finite(log.commandMs));
    row.saveStateMs.push(finite(log.saveStateMs));
    commandPerformance.set(command, row);
  }
  const slowCommands = [...commandPerformance.values()]
    .map((row) => {
      const sortedTotals = row.totalMs.slice().sort((left, right) => left - right);
      return {
        command: row.command,
        count: row.totalMs.length,
        avgTotalMs: avg(row.totalMs),
        p95TotalMs: percentile(sortedTotals, 0.95),
        maxTotalMs: Math.max(0, ...row.totalMs),
        avgCommandMs: avg(row.commandMs),
        avgSaveStateMs: avg(row.saveStateMs)
      };
    })
    .sort((left, right) => right.p95TotalMs - left.p95TotalMs || right.avgTotalMs - left.avgTotalMs || right.count - left.count)
    .slice(0, 5);
  const timedLogs = filtered.filter((log) => finite(log.totalMs) > 0);
  const sortedTotalMs = timedLogs.map((log) => finite(log.totalMs)).sort((left, right) => left - right);
  const saveMsValues = timedLogs.map((log) => finite(log.saveStateMs)).filter((value) => value >= 0);
  return {
    ok: true,
    version: APP_VERSION,
    generatedAt: nowIso(),
    retentionLimitPerRoom: ROOM_ANALYTICS_LOG_LIMIT,
    exportLimit: limit,
    filters: {
      room: requestedRoom,
      type: requestedType,
      command: requestedCommand,
      q: keyword,
      window: requestedWindow
    },
    summary: {
      rooms: roomSummaries.length,
      totalLogs: roomSummaries.reduce((sum, room) => sum + room.count, 0),
      matchedLogs: filtered.length,
      recent24h,
      commandLogs: commandLogs.length,
      errorLogs: errorLogs.length,
      duplicateLogs: filtered.filter((log) => log.duplicate || log.status === "duplicate").length,
      p50TotalMs: percentile(sortedTotalMs, 0.5),
      p95TotalMs: percentile(sortedTotalMs, 0.95),
      avgSaveStateMs: avg(saveMsValues),
      lastOkAt: filtered.find((log) => log.status === "handled")?.at || "",
      topCommands,
      slowCommands
    },
    rooms: roomSummaries,
    logs: includeAllLogs ? filtered : filtered.slice(0, limit)
  };
}

function adminLiveEventsPayload(state = {}, query = {}) {
  const status = normalizeText(query.status || "");
  const limit = analyticsLimit(query.limit);
  const payload = adminRoomLogsPayload(state, { ...query, limit: ROOM_ANALYTICS_EXPORT_LIMIT }, { includeAllLogs: true });
  const events = payload.logs
    .filter((log) => {
      const totalMs = Number(log.totalMs || 0);
      return !status
        || log.status === status
        || (status === "error" && log.errorReason)
        || (status === "duplicate" && (log.duplicate || log.status === "duplicate"))
        || (status === "slow" && totalMs >= 1000);
    })
    .slice(0, limit)
    .map((log) => ({
      eventId: log.eventId || "",
      room: log.room || "",
      sender: log.sender || "",
      command: log.command || "",
      status: log.status || "",
      ignoreReason: log.ignoreReason || "",
      errorReason: log.errorReason || "",
      bridgeReceivedAt: log.bridgeReceivedAt || "",
      bridgeSentAt: log.bridgeSentAt || "",
      serverReceivedAt: log.serverReceivedAt || log.at || "",
      replyGeneratedAt: log.replyGeneratedAt || "",
      totalMs: Number(log.totalMs || 0),
      commandMs: Number(log.commandMs || 0),
      saveStateMs: Number(log.saveStateMs || 0),
      duplicate: Boolean(log.duplicate),
      replyLength: Number(log.replyLength || 0),
      messagePreview: log.messagePreview || ""
    }));
  return {
    ok: true,
    version: APP_VERSION,
    generatedAt: nowIso(),
    filters: { ...payload.filters, status },
    summary: payload.summary,
    events
  };
}

function adminPerformanceSummaryPayload(state = {}, query = {}) {
  const payload = adminRoomLogsPayload(state, { ...query, limit: ROOM_ANALYTICS_EXPORT_LIMIT });
  return {
    ok: true,
    version: APP_VERSION,
    generatedAt: nowIso(),
    window: normalizeText(query.window || "24h"),
    filters: payload.filters,
    summary: {
      totalEvents: payload.summary.matchedLogs,
      commandEvents: payload.summary.commandLogs,
      errorEvents: payload.summary.errorLogs,
      duplicateEvents: payload.summary.duplicateLogs,
      p50TotalMs: payload.summary.p50TotalMs,
      p95TotalMs: payload.summary.p95TotalMs,
      avgSaveStateMs: payload.summary.avgSaveStateMs,
      recent24h: payload.summary.recent24h,
      lastOkAt: payload.summary.lastOkAt,
      topCommands: payload.summary.topCommands,
      slowCommands: payload.summary.slowCommands
    },
    rooms: payload.rooms
  };
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function roomLogsCsv(logs = []) {
  const headers = ["at", "eventId", "room", "sender", "status", "eventType", "command", "isCommand", "messagePreview", "totalMs", "commandMs", "saveStateMs", "messageHash", "senderHash"];
  return [
    headers.join(","),
    ...logs.map((log) => headers.map((key) => csvCell(log[key])).join(","))
  ].join("\n");
}

function adminRoomLogsExportPayload(state = {}, query = {}) {
  const payload = adminRoomLogsPayload(state, query);
  const format = normalizeText(query.format || "json").toLowerCase() === "csv" ? "csv" : "json";
  const roomSlug = keyFor(payload.filters.room || "all-rooms").replace(/[^a-z0-9_-]/g, "") || "all-rooms";
  const exportedAt = nowIso().replace(/[:.]/g, "-");
  const filename = `pixgom-room-logs-${roomSlug}-${exportedAt}.${format}`;
  const exportBody = {
    ok: true,
    version: APP_VERSION,
    generatedAt: payload.generatedAt,
    filters: payload.filters,
    summary: payload.summary,
    rooms: payload.rooms,
    logs: payload.logs
  };
  return {
    ok: true,
    version: APP_VERSION,
    format,
    filename,
    contentType: format === "csv" ? "text/csv; charset=utf-8" : "application/json; charset=utf-8",
    content: format === "csv" ? roomLogsCsv(payload.logs) : JSON.stringify(exportBody, null, 2),
    summary: payload.summary
  };
}

function searchMatchesText(queryKey = "", ...values) {
  if (!queryKey) return true;
  return values.some((value) => keyFor(value).includes(queryKey));
}

function identitySummaryForPerson(person = {}) {
  const identities = Array.isArray(person.identities) ? person.identities.filter(Boolean) : [];
  if (!identities.length) return { status: "missing", label: "고유값 없음", hints: [] };
  return {
    status: "confirmed",
    label: "확정",
    hints: identities.slice(0, 2).map((identity) => `hash:${createHash("sha256").update(String(identity)).digest("hex").slice(-4)}`)
  };
}

function personAliasesForKey(roomState = {}, key = "") {
  return Object.entries(roomState.aliases || {})
    .filter(([, targetKey]) => targetKey === key)
    .map(([alias]) => alias)
    .slice(0, 8);
}

function personSearchRowsForRoom(roomState = {}, query = "", options = {}) {
  const queryKey = keyFor(query);
  const allRows = Object.entries(roomState.people || {}).map(([key, person]) => {
    normalizePersonState(person);
    const displayName = displayNameForKey(roomState, key, person.currentName || key);
    const aliases = personAliasesForKey(roomState, key);
    const names = uniqueNames([displayName, person.currentName, ...(person.names || []), ...aliases]);
    const identity = identitySummaryForPerson(person);
    const inventoryQuantity = Object.values(person.inventory || {}).reduce((sum, count) => sum + Math.max(0, Number(count) || 0), 0);
    return {
      type: "person",
      roomName: roomState.name || "",
      personKey: key,
      displayName,
      representativeName: person.currentName || displayName,
      aliases,
      names,
      lastActiveAt: person.lastActiveAt || person.updatedAt || person.joinedAt || "",
      points: Math.max(0, Number(person.points || 0)),
      inventoryQuantity,
      identityStatus: identity.status,
      identitySummary: identity.label,
      identityHints: identity.hints,
      mergeGuide: "/닉병합 기준닉 합칠닉"
    };
  });
  const matchedRows = allRows.filter((row) => searchMatchesText(queryKey, row.displayName, row.representativeName, row.aliases.join(" "), row.names.join(" ")));
  const collision = matchedRows.length > 1;
  return matchedRows.slice(0, options.limit || 20).map((row) => ({
    ...row,
    identityStatus: collision ? "conflict_possible" : row.identityStatus,
    identitySummary: collision ? "충돌 가능" : row.identitySummary,
    mergeCommand: collision && matchedRows[0] && matchedRows[1]
      ? `/닉병합 ${matchedRows[0].displayName} ${matchedRows[1].displayName}`
      : "",
    conflictNotice: collision ? "동명이인 후보입니다. 자동 병합하지 말고 관리자 확인 후 닉병합을 사용하세요." : ""
  }));
}

function commandSearchRows(query = "", limit = 12) {
  const queryKey = keyFor(query);
  return COMMAND_REGISTRY
    .filter((item) => searchMatchesText(queryKey, item.command, item.description, item.category, (item.aliases || []).join(" "), (item.searchableKeywords || []).join(" ")))
    .slice(0, limit)
    .map((item) => ({
      type: "command",
      command: item.command,
      category: item.category,
      description: item.description,
      examples: item.examples || [item.command],
      packIds: item.packIds || []
    }));
}

function roomSearchRow(state = {}, roomState = {}) {
  const application = applicationForRoomState(state, roomState);
  const view = roomAdminView(roomState, state, { application });
  return {
    type: "room",
    roomName: view.name,
    role: view.roomRole,
    roleLabel: view.roomStatusSnapshot?.roleLabel || "단일방",
    licenseStatus: view.licenseStatus,
    bridgeStatus: view.bridgeStatus,
    subscriptionStatus: view.subscription?.status || "unset",
    applicationStatus: application?.status || "",
    commandCount: view.commandCount,
    installedPackCount: view.commandPacks?.installedPackDetails?.length || 0,
    gameOpsOverview: view.gameOpsOverview
  };
}

function adminSearchPayload(state = {}, query = {}) {
  const q = normalizeText(query.q || query.query || "");
  const queryKey = keyFor(q);
  const requestedRoom = normalizeText(query.roomName || query.room || "");
  const rooms = Object.values(state.rooms || {}).filter((roomState) => (
    !requestedRoom || roomKey(roomState.name) === roomKey(requestedRoom)
  ));
  const matchedRooms = rooms
    .filter((roomState) => requestedRoom || searchMatchesText(queryKey, roomState.name, roomState.settings?.canonicalRoomName, (roomState.admins || []).join(" ")))
    .map((roomState) => roomSearchRow(state, roomState));
  const people = rooms.flatMap((roomState) => personSearchRowsForRoom(roomState, q, { limit: 20 }));
  const logs = adminRoomLogsPayload(state, { room: requestedRoom, q, limit: 12 }).logs.map((log) => ({
    type: "log",
    roomName: log.room || "",
    at: log.at || "",
    sender: log.sender || "",
    command: log.command || "",
    eventType: log.eventType || "",
    messagePreview: log.messagePreview || ""
  }));
  const inquiries = Object.values(state.applicationInquiries || {})
    .map((inquiry) => publicApplicationInquiryView(state, inquiry))
    .filter((inquiry) => searchMatchesText(queryKey, inquiry.roomName, inquiry.message, inquiry.typeLabel, inquiry.statusLabel))
    .slice(0, 10)
    .map((inquiry) => ({ type: "inquiry", ...inquiry }));
  const commands = commandSearchRows(q, 12);
  const sections = { rooms: matchedRooms, people, commands, logs, inquiries };
  return {
    ok: true,
    version: APP_VERSION,
    query: q,
    generatedAt: nowIso(),
    sections,
    total: Object.values(sections).reduce((sum, items) => sum + items.length, 0),
    duplicateGuide: "동명이인 후보는 자동 병합하지 않습니다. 관리자만 /닉병합 기준닉 합칠닉 으로 처리하세요."
  };
}

function buyerSearchPayload(state = {}, account = {}, query = {}) {
  const q = normalizeText(query.q || query.query || "");
  const queryKey = keyFor(q);
  const applications = approvedBuyerApplications(state, account);
  const roomStates = applications
    .map((application) => state.rooms?.[roomKey(application.roomName)])
    .filter(Boolean);
  const rooms = applications
    .map((application) => applicationRoomPayload(state, account, application))
    .filter((room) => searchMatchesText(queryKey, room.roomName, room.bridgeStatus, room.subscriptionStatusLabel, room.roomAdmins?.join(" "), JSON.stringify(room.commandPacks || {})))
    .map((room) => ({
      type: "room",
      roomName: room.roomName,
      role: room.roomRole,
      bridgeStatus: room.bridgeStatus,
      subscriptionStatusLabel: room.subscriptionStatusLabel,
      appConnectCodeStatus: room.bridgeConnectCode ? "ready" : "needs_setup",
      gameUsageSummary: room.gameUsageSummary
    }));
  const people = roomStates.flatMap((roomState) => personSearchRowsForRoom(roomState, q, { limit: 10 }))
    .map((row) => ({
      ...row,
      conflictNotice: row.identityStatus === "conflict_possible" ? "동명이인 가능성 있음, 관리자 확인 필요" : row.conflictNotice
    }));
  const commands = commandSearchRows(q, 10);
  const packs = commandPackCatalogPayload().packs
    .filter((pack) => searchMatchesText(queryKey, pack.title, pack.id, pack.installCode, (pack.fixedCommands || []).join(" ")))
    .slice(0, 8)
    .map((pack) => ({ type: "pack", id: pack.id, title: pack.title, installCode: pack.installCode, commandCount: pack.commandCount }));
  const sections = {
    rooms,
    payments: applications
      .map((application) => publicApplicationView(application, state))
      .filter((application) => searchMatchesText(queryKey, application.roomName, application.statusLabel, application.payment?.statusLabel))
      .map((application) => ({ type: "payment", applicationId: application.id, roomName: application.roomName, statusLabel: application.statusLabel, paymentStatusLabel: application.payment?.statusLabel || "" })),
    appConnection: rooms.map((room) => ({ type: "appConnection", roomName: room.roomName, bridgeStatus: room.bridgeStatus, appConnectCodeStatus: room.appConnectCodeStatus })),
    commands,
    games: packs,
    aliases: people
  };
  return {
    ok: true,
    version: APP_VERSION,
    query: q,
    generatedAt: nowIso(),
    sections,
    total: Object.values(sections).reduce((sum, items) => sum + items.length, 0),
    duplicateGuide: "동명이인 가능성 있음, 관리자 확인 필요"
  };
}

function roomViewExpiringSoon(room, warningDays = 7) {
  const remaining = Number(room.subscription?.remainingDays);
  return room.subscription?.status === "active" && Number.isFinite(remaining) && remaining >= 0 && remaining <= warningDays;
}

function adminRoomGroupRoomRole(room = {}, application = {}) {
  const savedRole = normalizeRoomRole(room.roomRole || "");
  if (savedRole !== "standard") return savedRole;
  const purpose = normalizeApplicationRoomPurpose(application.roomPurpose);
  if (purpose === "game_room") return "game";
  if (application.id) return "general";
  return savedRole;
}

function adminRoomGroupRoomPreview(room = null, application = {}) {
  if (!room) return null;
  const roomRole = adminRoomGroupRoomRole(room, application);
  return {
    applicationId: application.id || room.applicationId || "",
    name: room.name || "",
    roomName: application.roomName || room.roomName || room.name || "",
    roomId: application.roomId || room.roomId || room.roomIds?.[0] || "",
    roomLink: application.roomLink || room.roomLink || room.roomLinks?.[0] || "",
    roomPurpose: application.roomPurpose || room.roomPurpose || "",
    registered: Boolean(room.registered),
    enabled: room.enabled !== false,
    roomRole,
    canonicalRoomKey: room.canonicalRoomKey || "",
    canonicalRoomName: room.canonicalRoomName || "",
    linkedGameRoomKeys: room.linkedGameRoomKeys || [],
    bridgeStatus: room.bridgeStatus || "",
    diagnostics: room.diagnostics || {},
    subscription: room.subscription || {},
    roomStatusSnapshot: room.roomStatusSnapshot || null
  };
}

function adminBridgeRoomPreview(room = {}) {
  return {
    applicationId: room.applicationId || "",
    roomName: room.roomName || room.name || "",
    roomPurpose: room.roomPurpose || "",
    roomRole: room.roomRole || "",
    bridgeStatus: room.bridgeStatus || "",
    roomId: room.roomId || "",
    roomLink: room.roomLink || ""
  };
}

function adminRoomGroupsPayload(state, rooms = []) {
  const roomByKey = new Map(rooms.map((room) => [roomKey(room.name), room]));
  const applications = Object.values(state.applications || {}).filter((application) => applicationApprovedAndPaid(state, application));
  const generalApplications = applications.filter((application) => normalizeApplicationRoomPurpose(application.roomPurpose) !== "game_room");
  const groups = generalApplications.map((application) => {
    const account = state.accounts?.[application.accountId] || {};
    const linkedGameApplications = gameRoomApplicationsForBase(state, account, application)
      .filter((item) => applicationApprovedAndPaid(state, item));
    const roomPayload = applicationRoomPayload(state, account, application);
    const bridgeRooms = bridgeConnectRoomsPayload(state, account, application);
    return {
      baseApplication: publicApplicationView(application, state),
      baseRoom: adminRoomGroupRoomPreview(roomByKey.get(roomKey(application.roomName)) || roomAdminView(ensureRoom(state, application.roomName), state, { application }), application),
      gameApplications: linkedGameApplications.map((item) => publicApplicationView(item, state)),
      gameRooms: linkedGameApplications.map((item) => adminRoomGroupRoomPreview(roomByKey.get(roomKey(item.roomName)) || roomAdminView(ensureRoom(state, item.roomName), state, { application: item }), item)),
      roomModeSettings: roomModeSettingsPayload(state, application, linkedGameApplications),
      bridgeDiagnostics: bridgeConnectDiagnosticsPayload(state, account, application, bridgeRooms),
      bridgeRoomsPreview: bridgeRooms.map(adminBridgeRoomPreview),
      connectCode: roomPayload.bridgeConnectCode || ""
    };
  });
  const groupedApplicationIds = new Set([
    ...generalApplications.map((item) => item.id),
    ...groups.flatMap((group) => group.gameApplications.map((item) => item.id))
  ]);
  for (const gameApplication of applications.filter((application) => normalizeApplicationRoomPurpose(application.roomPurpose) === "game_room")) {
    if (groupedApplicationIds.has(gameApplication.id)) continue;
    const account = state.accounts?.[gameApplication.accountId] || {};
    groups.push({
      baseApplication: null,
      baseRoom: null,
      gameApplications: [publicApplicationView(gameApplication, state)],
      gameRooms: [adminRoomGroupRoomPreview(roomByKey.get(roomKey(gameApplication.roomName)) || roomAdminView(ensureRoom(state, gameApplication.roomName), state, { application: gameApplication }), gameApplication)],
      roomModeSettings: roomModeSettingsPayload(state, {}, [gameApplication]),
      bridgeDiagnostics: bridgeConnectDiagnosticsPayload(state, account, gameApplication, bridgeConnectRoomsPayload(state, account, gameApplication)),
      bridgeRoomsPreview: bridgeConnectRoomsPayload(state, account, gameApplication).map(adminBridgeRoomPreview),
      connectCode: applicationRoomPayload(state, account, gameApplication).bridgeConnectCode || ""
    });
  }
  return groups.sort((left, right) => keyFor(left.baseRoom?.name || left.gameRooms?.[0]?.name).localeCompare(keyFor(right.baseRoom?.name || right.gameRooms?.[0]?.name)));
}

function ensureAdminApplicationRooms(state = {}) {
  Object.values(state.applications || {})
    .filter((application) => applicationApprovedAndPaid(state, application))
    .forEach((application) => {
      if (normalizeText(application.roomName)) ensureRoom(state, application.roomName);
    });
}

function adminRoomsPayload(state) {
  ensureAdminApplicationRooms(state);
  const rooms = Object.values(state.rooms || {})
    .map((roomState) => roomAdminView(roomState, state))
    .sort((left, right) => keyFor(left.name).localeCompare(keyFor(right.name)));
  const roomGroups = adminRoomGroupsPayload(state, rooms);
  return {
    ok: true,
    version: APP_VERSION,
    monthlyPriceKrw: MONTHLY_PRICE_KRW,
    additionalRoomPriceKrw: ADDITIONAL_ROOM_PRICE_KRW,
    defaultSubscriptionDays: DEFAULT_SUBSCRIPTION_DAYS,
    summary: {
      rooms: rooms.length,
      activeRooms: rooms.filter((room) => room.enabled && room.registered).length,
      expiredRooms: rooms.filter((room) => room.subscription.status === "expired").length,
      expiringRooms: rooms.filter((room) => roomViewExpiringSoon(room)).length,
      problemRooms: rooms.filter((room) => !room.diagnostics?.ok).length,
      bridgeProblemRooms: rooms.filter((room) => room.diagnostics?.bridgeStatus !== "ready").length,
      connectionIssueRooms: rooms.filter((room) => room.diagnostics?.connectionStatus === "no_events").length,
      archivedRooms: Object.keys(state.archivedRooms || {}).length
    },
    lifecycleSummary: lifecycleSummaryFromApplications(Object.values(state.applications || {}).map((application) => publicApplicationView(application, state))),
    rooms,
    roomGroups
  };
}

function lifecycleSummaryFromApplications(applications = []) {
  const summary = {
    total: applications.length,
    active: 0,
    pendingPayment: 0,
    approvedUnpaid: 0,
    expiringSoon: 0,
    expired: 0,
    onHold: 0,
    archived: 0,
    rejected: 0
  };
  for (const application of applications) {
    const status = application.lifecycle?.status || application.lifecycleStatus || application.status;
    if (status === "active") summary.active += 1;
    else if (status === "pending_payment") summary.pendingPayment += 1;
    else if (status === "approved_unpaid") summary.approvedUnpaid += 1;
    else if (status === "expiring_soon") summary.expiringSoon += 1;
    else if (status === "expired") summary.expired += 1;
    else if (status === "on_hold") summary.onHold += 1;
    else if (status === "archived") summary.archived += 1;
    else if (status === "rejected") summary.rejected += 1;
  }
  summary.paymentReviewNeeded = summary.pendingPayment + summary.approvedUnpaid;
  summary.unavailable = summary.expired + summary.onHold + summary.archived + summary.rejected;
  return summary;
}

function applicationsForRoomName(state = {}, roomName = "") {
  const targetKey = roomKey(roomName);
  return Object.values(state.applications || {}).filter((application) => roomKey(application.roomName) === targetKey);
}

function publicArchivedRoomView(state = {}, archive = {}) {
  const roomState = archive.room || {};
  return {
    id: archive.id || "",
    roomName: archive.roomName || roomState.name || "",
    roomKey: archive.roomKey || roomKey(roomState.name),
    reason: archive.reason || "",
    archivedAt: archive.archivedAt || "",
    archivedBy: archive.archivedBy || "",
    affectedApplicationIds: archive.affectedApplicationIds || [],
    applicationSummaries: (archive.affectedApplicationIds || [])
      .map((id) => state.applications?.[id] || archive.applicationSnapshots?.[id])
      .filter(Boolean)
      .map((application) => publicApplicationView(application, state)),
    room: roomState?.name ? roomAdminView(roomState, state, { archivedRecord: archive }) : null,
    roomStatusSnapshot: roomState?.name ? roomStatusSnapshot(state, roomState, { archivedRecord: archive }) : null
  };
}

function adminArchivedRoomsPayload(state) {
  const archivedRooms = Object.values(state.archivedRooms || {})
    .map((archive) => publicArchivedRoomView(state, archive))
    .sort((left, right) => String(right.archivedAt || "").localeCompare(String(left.archivedAt || "")));
  return {
    ok: true,
    version: APP_VERSION,
    summary: {
      archivedRooms: archivedRooms.length,
      restoreRequests: Object.keys(state.restoreRequests || {}).length
    },
    archivedRooms
  };
}

function adminRestoreRequestsPayload(state, options = {}) {
  const requestedStatus = normalizeText(options.status || "all");
  const requests = Object.values(state.restoreRequests || {})
    .map((request) => publicRestoreRequestView(state, request))
    .filter((request) => requestedStatus === "all" || request.status === requestedStatus)
    .sort((left, right) => String(right.createdAt || "").localeCompare(String(left.createdAt || "")));
  return {
    ok: true,
    version: APP_VERSION,
    filter: { status: requestedStatus },
    summary: {
      total: Object.keys(state.restoreRequests || {}).length,
      visible: requests.length,
      open: Object.values(state.restoreRequests || {}).filter((request) => request.status !== "resolved").length
    },
    requests
  };
}

function findActiveRoomEntry(state = {}, payload = {}) {
  state.rooms ||= {};
  const roomName = normalizeText(payload.room || payload.name || payload.roomName);
  const roomId = payloadRoomId(payload);
  if (!roomName && !roomId) return null;

  return Object.entries(state.rooms).find(([key, roomState]) => {
    const ids = roomState.settings?.roomIds || [];
    if (roomName && (key === roomKey(roomName) || keyFor(roomState.name) === keyFor(roomName))) return true;
    return Boolean(roomId && ids.includes(roomId));
  }) || null;
}

function adminArchiveRoom(state, payload = {}, archivedBy = "admin_console") {
  state.rooms ||= {};
  state.archivedRooms ||= {};
  const target = findActiveRoomEntry(state, payload);
  if (!target) {
    const roomName = normalizeText(payload.room || payload.name || payload.roomName);
    const roomId = payloadRoomId(payload);
    if (!roomName && !roomId) return { ok: false, status: 400, error: "room_required" };
    return { ok: false, status: 404, error: "room_not_found" };
  }
  const [key, roomState] = target;
  const affectedApplications = applicationsForRoomName(state, roomState.name);
  const archivedAt = nowIso();
  const archiveId = generateEntityId("arch");
  const reason = previewText(payload.reason || payload.archiveReason || "관리자 보관 처리", 180);
  const archivedRoomState = JSON.parse(JSON.stringify(roomState));
  archivedRoomState.settings ||= {};
  archivedRoomState.settings.archivedAt = archivedAt;
  archivedRoomState.settings.archivedBy = archivedBy;
  archivedRoomState.settings.archivedReason = reason;
  const applicationSnapshots = {};
  for (const application of affectedApplications) {
    applicationSnapshots[application.id] = JSON.parse(JSON.stringify(application));
    application.archivedAt = archivedAt;
    application.archivedBy = archivedBy;
    application.archivedReason = reason;
    application.updatedAt = archivedAt;
  }
  state.archivedRooms[archiveId] = {
    id: archiveId,
    roomKey: key,
    roomName: roomState.name || "",
    reason,
    archivedAt,
    archivedBy,
    affectedApplicationIds: affectedApplications.map((application) => application.id),
    applicationSnapshots,
    room: archivedRoomState
  };
  delete state.rooms[key];
  const archivedRoom = publicArchivedRoomView(state, state.archivedRooms[archiveId]);
  return {
    ok: true,
    deletedRoom: archivedRoom.room,
    archivedRoom,
    summary: {
      rooms: Object.keys(state.rooms).length,
      archivedRooms: Object.keys(state.archivedRooms).length
    }
  };
}

function adminDeleteRoom(state, payload = {}, deletedBy = "admin_console") {
  return adminArchiveRoom(state, payload, deletedBy);
}

function adminBulkArchiveRooms(state, payload = {}, archivedBy = "admin_console") {
  state.rooms ||= {};
  state.accounts ||= {};
  const confirm = normalizeText(payload.confirmBulkArchive || payload.confirm || "");
  if (confirm !== "ARCHIVE_ALL_ROOMS") {
    return { ok: false, status: 400, error: "bulk_archive_confirmation_required" };
  }
  const roomNames = Object.values(state.rooms || {})
    .map((roomState) => roomState.name)
    .filter(Boolean);
  const archivedRooms = [];
  const skipped = [];
  for (const roomName of roomNames) {
    const result = adminArchiveRoom(state, {
      roomName,
      reason: payload.reason || "고객 0명 초기화 보관 처리"
    }, archivedBy);
    if (result.ok) archivedRooms.push(result.archivedRoom);
    else skipped.push({ roomName, error: result.error || "archive_failed" });
  }
  return {
    ok: true,
    archivedRooms,
    skipped,
    summary: {
      accountsPreserved: Object.keys(state.accounts || {}).length,
      archivedCount: archivedRooms.length,
      skippedCount: skipped.length,
      activeRooms: Object.keys(state.rooms || {}).length,
      archivedRooms: Object.keys(state.archivedRooms || {}).length
    }
  };
}

function adminForceArchiveRoom(state, payload = {}, archivedBy = "admin_console") {
  const target = findActiveRoomEntry(state, payload);
  if (target) return adminArchiveRoom(state, payload, archivedBy);
  const roomName = normalizeText(payload.room || payload.name || payload.roomName);
  if (!roomName) return { ok: false, status: 400, error: "room_required" };
  const affectedApplications = applicationsForRoomName(state, roomName);
  if (!affectedApplications.length) return { ok: false, status: 404, error: "room_not_found" };
  state.archivedRooms ||= {};
  const archivedAt = nowIso();
  const archiveId = generateEntityId("arch");
  const reason = previewText(payload.reason || payload.archiveReason || "관리자 강제 보관 처리", 180);
  const roomState = {
    name: roomName,
    admins: [],
    people: {},
    events: [],
    rawEvents: [],
    analyticsLogs: [],
    settings: {
      registered: false,
      enabled: false,
      archivedAt,
      archivedBy,
      archivedReason: reason
    }
  };
  const applicationSnapshots = {};
  for (const application of affectedApplications) {
    applicationSnapshots[application.id] = JSON.parse(JSON.stringify(application));
    application.archivedAt = archivedAt;
    application.archivedBy = archivedBy;
    application.archivedReason = reason;
    application.updatedAt = archivedAt;
  }
  state.archivedRooms[archiveId] = {
    id: archiveId,
    roomKey: roomKey(roomName),
    roomName,
    reason,
    archivedAt,
    archivedBy,
    affectedApplicationIds: affectedApplications.map((application) => application.id),
    applicationSnapshots,
    room: roomState
  };
  return {
    ok: true,
    forced: true,
    deletedRoom: publicArchivedRoomView(state, state.archivedRooms[archiveId]).room,
    archivedRoom: publicArchivedRoomView(state, state.archivedRooms[archiveId]),
    summary: {
      rooms: Object.keys(state.rooms || {}).length,
      archivedRooms: Object.keys(state.archivedRooms || {}).length
    }
  };
}

function adminForceDeleteRoom(state, payload = {}, purgedBy = "admin_console") {
  const confirmRoomName = normalizeText(payload.confirmRoomName || payload.room || payload.name || payload.roomName);
  const confirmPermanentDelete = normalizeText(payload.confirmPermanentDelete || payload.confirm);
  if (!confirmRoomName || confirmPermanentDelete !== "PERMANENT_DELETE") {
    return { ok: false, status: 400, error: "purge_confirmation_required" };
  }
  const archivedTarget = findArchivedRoomEntry(state, payload);
  if (archivedTarget) {
    return adminPurgeArchivedRoom(state, {
      archiveId: archivedTarget[0],
      confirmRoomName,
      confirmPermanentDelete,
      resolution: payload.resolution || "관리자 강제 완전 삭제"
    }, purgedBy);
  }
  const activeTarget = findActiveRoomEntry(state, payload);
  if (activeTarget) {
    const archiveResult = adminArchiveRoom(state, {
      roomName: activeTarget[1].name,
      reason: payload.reason || "완전 삭제 전 자동 보관"
    }, purgedBy);
    if (!archiveResult.ok) return archiveResult;
    return adminPurgeArchivedRoom(state, {
      archiveId: archiveResult.archivedRoom.id,
      confirmRoomName,
      confirmPermanentDelete,
      resolution: payload.resolution || "관리자 강제 완전 삭제"
    }, purgedBy);
  }
  return { ok: false, status: 404, error: "room_not_found" };
}

function findArchivedRoomEntry(state = {}, payload = {}) {
  const archiveId = normalizeText(payload.archiveId || payload.id);
  const roomName = normalizeText(payload.room || payload.name || payload.roomName);
  return Object.entries(state.archivedRooms || {}).find(([id, archive]) => {
    if (archiveId && id === archiveId) return true;
    return Boolean(roomName && keyFor(archive.roomName) === keyFor(roomName));
  }) || null;
}

function adminRestoreArchivedRoom(state, payload = {}, restoredBy = "admin_console") {
  state.rooms ||= {};
  state.archivedRooms ||= {};
  const target = findArchivedRoomEntry(state, payload);
  if (!target) return { ok: false, status: 404, error: "archived_room_not_found" };
  const [archiveId, archive] = target;
  const roomState = JSON.parse(JSON.stringify(archive.room || {}));
  if (!roomState.name) return { ok: false, status: 400, error: "archived_room_invalid" };
  const key = roomKey(roomState.name);
  if (state.rooms[key]) return { ok: false, status: 409, error: "room_name_conflict" };
  roomState.settings ||= {};
  delete roomState.settings.archivedAt;
  delete roomState.settings.archivedBy;
  delete roomState.settings.archivedReason;
  recordRoomEvent(roomState, { type: "admin_archived_room_restored", by: restoredBy, archiveId });
  state.rooms[key] = roomState;
  for (const applicationId of archive.affectedApplicationIds || []) {
    const application = state.applications?.[applicationId];
    if (!application) continue;
    delete application.archivedAt;
    delete application.archivedBy;
    delete application.archivedReason;
    application.updatedAt = nowIso();
  }
  for (const request of Object.values(state.restoreRequests || {})) {
    if (request.archiveId !== archiveId || request.status === "resolved") continue;
    request.status = "resolved";
    request.resolvedAt = nowIso();
    request.resolvedBy = restoredBy;
    request.resolution = previewText(payload.resolution || "관리자 복구 완료", 300);
    request.updatedAt = request.resolvedAt;
  }
  delete state.archivedRooms[archiveId];
  return {
    ok: true,
    restoredRoom: roomAdminView(roomState, state),
    archivedRoomId: archiveId,
    summary: {
      rooms: Object.keys(state.rooms).length,
      archivedRooms: Object.keys(state.archivedRooms).length
    }
  };
}

function adminPurgeArchivedRoom(state, payload = {}, purgedBy = "admin_console") {
  const target = findArchivedRoomEntry(state, payload);
  if (!target) return { ok: false, status: 404, error: "archived_room_not_found" };
  const [archiveId, archive] = target;
  const confirmRoomName = normalizeText(payload.confirmRoomName);
  const confirmPermanentDelete = normalizeText(payload.confirmPermanentDelete || payload.confirm);
  if (keyFor(confirmRoomName) !== keyFor(archive.roomName) || confirmPermanentDelete !== "PERMANENT_DELETE") {
    return { ok: false, status: 400, error: "purge_confirmation_required" };
  }
  delete state.archivedRooms[archiveId];
  for (const applicationId of archive.affectedApplicationIds || []) {
    const application = state.applications?.[applicationId];
    if (!application) continue;
    application.purgedAt = nowIso();
    application.purgedBy = purgedBy;
    application.updatedAt = application.purgedAt;
  }
  for (const request of Object.values(state.restoreRequests || {})) {
    if (request.archiveId !== archiveId || request.status === "resolved") continue;
    request.status = "resolved";
    request.resolvedAt = nowIso();
    request.resolvedBy = purgedBy;
    request.resolution = previewText(payload.resolution || "완전 삭제 처리", 300);
    request.updatedAt = request.resolvedAt;
  }
  return {
    ok: true,
    purgedRoom: { id: archiveId, roomName: archive.roomName },
    summary: {
      archivedRooms: Object.keys(state.archivedRooms || {}).length
    }
  };
}

function findRoomEntryForAdminRename(state, payload = {}) {
  state.rooms ||= {};
  const originalRoomName = normalizeText(payload.originalRoomName || payload.originalRoom || payload.previousRoomName || payload.previousRoom || payload.originalName);
  const originalRoomId = normalizeText(payload.originalRoomId || payload.previousRoomId);
  if (!originalRoomName && !originalRoomId) return null;
  return Object.entries(state.rooms).find(([key, roomState]) => {
    const ids = roomState.settings?.roomIds || [];
    if (originalRoomName && (key === roomKey(originalRoomName) || keyFor(roomState.name) === keyFor(originalRoomName))) return true;
    return Boolean(originalRoomId && ids.includes(originalRoomId));
  }) || null;
}

function updateRoomNameReferences(state, oldName = "", newName = "", oldKey = "", newKey = "") {
  const oldNameKey = keyFor(oldName);
  for (const application of Object.values(state.applications || {})) {
    if (keyFor(application.roomName) === oldNameKey) {
      application.roomName = newName;
      application.updatedAt = nowIso();
    }
  }
  for (const roomState of Object.values(state.rooms || {})) {
    const settings = roomState.settings || {};
    if (settings.canonicalRoomKey === oldKey) {
      settings.canonicalRoomKey = newKey;
      settings.canonicalRoomName = newName;
    }
    if (keyFor(settings.canonicalRoomName) === oldNameKey) {
      settings.canonicalRoomName = newName;
    }
    if (Array.isArray(settings.linkedGameRoomKeys)) {
      settings.linkedGameRoomKeys = settings.linkedGameRoomKeys.map((key) => key === oldKey ? newKey : key);
    }
  }
  for (const inquiry of Object.values(state.applicationInquiries || {})) {
    if (keyFor(inquiry.roomName) === oldNameKey) inquiry.roomName = newName;
    if (keyFor(inquiry.mainRoomName) === oldNameKey) inquiry.mainRoomName = newName;
  }
  for (const transfer of Object.values(state.roomTransfers || {})) {
    if (keyFor(transfer.roomName) === oldNameKey) transfer.roomName = newName;
  }
}

function recordSettingsHistory(roomState, entry = {}) {
  roomState.settings ||= {};
  const settings = roomState.settings;
  settings.settingsHistory ||= [];
  settings.lastSavedAt = entry.at || nowIso();
  settings.lastSavedBy = entry.by || "admin_console";
  settings.settingsHistory.push({
    type: entry.type || "settings_saved",
    by: settings.lastSavedBy,
    at: settings.lastSavedAt,
    changedFields: entry.changedFields || [],
    summary: previewText(entry.summary || "", 160)
  });
  if (settings.settingsHistory.length > 80) settings.settingsHistory = settings.settingsHistory.slice(-80);
}

function modeSplitPayloadProvided(payload = {}) {
  if (payload.modeSplit && typeof payload.modeSplit === "object") return true;
  return ["blockGamesInGeneralRoom", "blockOpsInGameRoom", "sharePointsAndInventory", "generalRoomGameBlocked", "gameRoomOpsBlocked", "sharedData"]
    .some((key) => Object.hasOwn(payload, key));
}

function applyRoomModeSplit(state, baseRoomState, baseApplication = {}, linkedGameApplications = [], payload = {}, updatedBy = "admin_console") {
  if (!baseRoomState) return null;
  baseRoomState.settings ||= {};
  const mode = modeSplitFromPayload(payload, baseRoomState.settings.modeSplit || {}, updatedBy);
  baseRoomState.settings.modeSplit = mode;
  baseRoomState.settings.roomRole = mode.blockGamesInGeneralRoom ? "general" : "standard";
  baseRoomState.settings.features = normalizeFeatureSettings(baseRoomState.settings.features || {});
  baseRoomState.settings.features.games = true;
  recordSettingsHistory(baseRoomState, {
    type: "room_mode_settings_saved",
    by: updatedBy,
    at: mode.updatedAt,
    changedFields: ["modeSplit", "roomRole", "features.games"],
    summary: "일반방/게임방 분리 설정 저장"
  });
  recordRoomEvent(baseRoomState, {
    type: "room_mode_settings_updated",
    by: updatedBy,
    blockGamesInGeneralRoom: mode.blockGamesInGeneralRoom,
    blockOpsInGameRoom: mode.blockOpsInGameRoom,
    sharePointsAndInventory: mode.sharePointsAndInventory
  });
  for (const gameApplication of linkedGameApplications) {
    const gameRoomState = ensureRoom(state, gameApplication.roomName);
    gameRoomState.settings ||= {};
    gameRoomState.settings.roomRole = mode.blockOpsInGameRoom ? "game" : "standard";
    gameRoomState.settings.canonicalRoomKey = roomKey(baseRoomState.name);
    gameRoomState.settings.canonicalRoomName = baseRoomState.name;
    gameRoomState.settings.features = normalizeFeatureSettings(gameRoomState.settings.features || {});
    gameRoomState.settings.features.games = true;
    gameRoomState.settings.features.points = true;
    gameRoomState.settings.features.shop = true;
    gameRoomState.settings.features.customCommands = !mode.blockOpsInGameRoom;
    gameRoomState.settings.modeSplit = { ...mode };
    recordSettingsHistory(gameRoomState, {
      type: "room_mode_settings_saved",
      by: updatedBy,
      at: mode.updatedAt,
      changedFields: ["modeSplit", "roomRole", "canonicalRoomKey", "features"],
      summary: `기준 일반방 ${baseRoomState.name} 분리 설정 동기화`
    });
    recordRoomEvent(gameRoomState, {
      type: "room_mode_settings_updated",
      by: updatedBy,
      baseRoomName: baseRoomState.name,
      blockGamesInGeneralRoom: mode.blockGamesInGeneralRoom,
      blockOpsInGameRoom: mode.blockOpsInGameRoom,
      sharePointsAndInventory: mode.sharePointsAndInventory
    });
  }
  syncRoomGroupAdmins(state, baseRoomState);
  return mode;
}

function adminUpsertRoom(state, payload = {}) {
  const roomName = normalizeText(payload.room || payload.name);
  if (!roomName) return { ok: false, status: 400, error: "room_required" };
  state.rooms ||= {};
  const requestedKey = roomKey(roomName);
  const renameIdentityProvided = Boolean(normalizeText(payload.originalRoomName || payload.originalRoom || payload.previousRoomName || payload.previousRoom || payload.originalName || payload.originalRoomId || payload.previousRoomId));
  const originalEntry = findRoomEntryForAdminRename(state, payload);
  if (renameIdentityProvided && !originalEntry) return { ok: false, status: 404, error: "original_room_not_found" };
  let roomState = null;
  if (originalEntry) {
    const [originalKey, originalRoomState] = originalEntry;
    roomState = originalRoomState;
    if (originalKey !== requestedKey) {
      const existingTarget = state.rooms[requestedKey];
      if (existingTarget && existingTarget !== roomState) {
        return { ok: false, status: 409, error: "room_name_conflict" };
      }
      const previousRoomName = originalRoomState.name || payload.originalRoomName || originalKey;
      delete state.rooms[originalKey];
      roomState.name = roomName;
      state.rooms[requestedKey] = roomState;
      updateRoomNameReferences(state, previousRoomName, roomName, originalKey, requestedKey);
    } else {
      roomState.name = roomName;
    }
  } else {
    roomState = ensureRoom(state, roomName);
  }
  const settings = roomState.settings;
  const roomId = payloadRoomId(payload);
  const link = normalizeText(payload.roomLink || payload.openChatLink || payload.link || "");
  const joinPhrase = normalizeText(payload.joinPhrase || payload.roomJoinPhrase || settings.joinPhrase || DEFAULT_JOIN_PHRASE);

  settings.registered = payload.registered === false ? false : true;
  settings.enabled = payload.enabled === false ? false : true;
  if (payload.roomRole) settings.roomRole = normalizeRoomRole(payload.roomRole);
  if (payload.canonicalRoomKey) settings.canonicalRoomKey = roomKey(payload.canonicalRoomKey);
  if (payload.canonicalRoomName) settings.canonicalRoomName = normalizeText(payload.canonicalRoomName);
  settings.joinPhrase = joinPhrase;
  settings.registeredAt ||= nowIso();
  settings.registeredBy ||= "admin_console";
  if (roomId) addUnique(settings.roomIds, roomId);
  if (link) addUnique(settings.roomLinks, link);

  const admins = payloadAdminNames(payload);
  if (Object.hasOwn(payload, "roomAdmins") || Object.hasOwn(payload, "admins") || Object.hasOwn(payload, "adminNames")) {
    roomState.admins = admins;
  } else if (admins.length) {
    roomState.admins = admins;
  }
  syncRoomGroupAdmins(state, roomState);

  const license = licenseSettings(roomState);
  license.key = normalizeLicenseKey(payload.licenseKey) || license.key || generateLicenseKey(roomState);
  license.status = payload.licenseStatus === "paused" ? "paused" : "active";
  license.updatedAt = nowIso();
  applyFeatureSettingsFromPayload(roomState, payload);
  applyGameSettingsFromPayload(roomState, payload);
  if (Object.hasOwn(payload, "customCommands")) {
    settings.customCommands = normalizeCustomCommands(payload.customCommands);
  }

  const subscription = subscriptionSettings(roomState);
  subscription.monthlyPriceKrw = Number(payload.monthlyPriceKrw || MONTHLY_PRICE_KRW);
  subscription.startedAt ||= parseSubscriptionDate(payload.subscriptionStartedAt || payload.subscriptionStartAt) || nowIso();
  const subscriptionExpiryInput = normalizeText(payload.subscriptionExpiresAt || payload.subscriptionExpireAt || payload.subscriptionEndAt);
  if (subscriptionExpiryInput.toLowerCase() === "unset") {
    subscription.expiresAt = "";
  } else {
    subscription.expiresAt = parseSubscriptionDate(subscriptionExpiryInput)
      || subscription.expiresAt
      || addDaysIso(new Date(), DEFAULT_SUBSCRIPTION_DAYS);
  }
  subscription.status = isSubscriptionExpired(roomState) ? "expired" : "active";

  const changedFields = ["registered", "enabled", "joinPhrase", "license", "subscription"];
  if (modeSplitPayloadProvided(payload)) {
    const application = applicationForRoomState(state, roomState);
    const account = state.accounts?.[application?.accountId] || {};
    const linkedGameApplications = application && normalizeApplicationRoomPurpose(application.roomPurpose) !== "game_room"
      ? gameRoomApplicationsForBase(state, account, application).filter((item) => item.status === "approved" && state.payments?.[item.paymentId]?.status === "paid")
      : [];
    applyRoomModeSplit(state, roomState, application || {}, linkedGameApplications, payload, "admin_console");
    changedFields.push("modeSplit");
  }

  recordSettingsHistory(roomState, {
    type: "admin_console_room_saved",
    by: "admin_console",
    changedFields,
    summary: "관리자 콘솔 방 설정 저장"
  });
  recordRoomEvent(roomState, { type: "admin_console_room_saved", by: "admin_console", joinPhrase, licenseKey: maskedLicenseKey(license.key) });
  return { ok: true, room: roomAdminView(roomState, state) };
}

function restoreRoomFromAdminPayload(state, roomPayload = {}) {
  const settings = roomPayload.settings || {};
  const subscription = settings.subscription || roomPayload.subscription || {};
  const license = settings.license || {};
  const result = adminUpsertRoom(state, {
    room: roomPayload.name || roomPayload.room,
    roomId: roomPayload.roomIds?.[0] || roomPayload.roomId || settings.roomIds?.[0],
    roomLink: roomPayload.roomLinks?.[0] || roomPayload.roomLink || settings.roomLinks?.[0],
    joinPhrase: roomPayload.joinPhrase || settings.joinPhrase,
    roomAdmins: roomPayload.admins || roomPayload.roomAdmins || roomPayload.admins,
    licenseKey: roomPayload.licenseKey || license.key,
    monthlyPriceKrw: subscription.monthlyPriceKrw || roomPayload.monthlyPriceKrw,
    subscriptionStartedAt: subscription.startedAt || roomPayload.subscriptionStartedAt,
    subscriptionExpiresAt: subscription.expiresAt || roomPayload.subscriptionExpiresAt,
    registered: roomPayload.registered ?? settings.registered,
    enabled: roomPayload.enabled ?? settings.enabled,
    features: roomPayload.features || settings.features,
    gameSettings: roomPayload.gameSettings || settings.gameSettings,
    customCommands: roomPayload.customCommands || settings.customCommands
  });
  const roomIds = Array.isArray(roomPayload.roomIds) ? roomPayload.roomIds : settings.roomIds;
  if (result.ok && Array.isArray(roomIds)) {
    for (const id of roomIds) addUnique(ensureRoom(state, result.room.name).settings.roomIds, id);
  }
  const roomLinks = Array.isArray(roomPayload.roomLinks) ? roomPayload.roomLinks : settings.roomLinks;
  if (result.ok && Array.isArray(roomLinks)) {
    for (const link of roomLinks) addUnique(ensureRoom(state, result.room.name).settings.roomLinks, link);
  }
  return result;
}

function backupRoomEntries(payload = {}) {
  const fullStateRooms = payload?.state?.rooms;
  if (fullStateRooms && typeof fullStateRooms === "object" && !Array.isArray(fullStateRooms)) {
    return Object.entries(fullStateRooms).map(([key, roomPayload]) => ({ key, roomPayload }));
  }
  const roomList = Array.isArray(payload?.rooms)
    ? payload.rooms
    : Array.isArray(payload?.state?.rooms)
      ? payload.state.rooms
      : [];
  return roomList.map((roomPayload, index) => ({ key: `rooms[${index}]`, roomPayload }));
}

function validateBackupRoomEntry(entry = {}) {
  const roomPayload = entry.roomPayload || {};
  const settings = roomPayload.settings || {};
  const keyFallback = String(entry.key || "").startsWith("rooms[") ? "" : entry.key;
  const name = compactSpaces(roomPayload.name || roomPayload.room || keyFallback || "");
  const roomIds = Array.isArray(roomPayload.roomIds)
    ? roomPayload.roomIds.filter(Boolean)
    : Array.isArray(settings.roomIds)
      ? settings.roomIds.filter(Boolean)
      : [roomPayload.roomId].filter(Boolean);
  const roomLinks = Array.isArray(roomPayload.roomLinks)
    ? roomPayload.roomLinks.filter(Boolean)
    : Array.isArray(settings.roomLinks)
      ? settings.roomLinks.filter(Boolean)
      : [roomPayload.roomLink].filter(Boolean);
  const features = settings.features || roomPayload.features || {};
  const customCommands = settings.customCommands || roomPayload.customCommands || {};
  const subscription = settings.subscription || roomPayload.subscription || {};
  const licenseKey = settings.license?.key || roomPayload.licenseKey || "";
  const warnings = [];
  const errors = [];
  if (!name) errors.push("room_name_required");
  if (!roomIds.length) warnings.push("room_id_missing");
  if (!roomLinks.length) warnings.push("room_link_missing");
  if (!licenseKey) warnings.push("license_key_missing");
  if (!subscription.expiresAt && !roomPayload.subscriptionExpiresAt) warnings.push("subscription_expiry_missing");
  return {
    ok: errors.length === 0,
    errors,
    warnings,
    room: {
      name,
      roomIds,
      roomLinks,
      featureCount: Object.keys(features || {}).length,
      customCommandCount: Object.keys(customCommands || {}).length,
      licenseStatus: licenseKey ? "present" : "missing",
      subscriptionExpiresAt: subscription.expiresAt || roomPayload.subscriptionExpiresAt || ""
    }
  };
}

function validateAdminBackupPayload(payload = {}) {
  const schemaVersion = payload.schemaVersion || payload.backupSchemaVersion || "legacy";
  const entries = backupRoomEntries(payload);
  const errors = [];
  const warnings = [];
  if (!entries.length) errors.push("rooms_required");
  const roomResults = entries.map(validateBackupRoomEntry);
  for (const result of roomResults) {
    errors.push(...result.errors);
    warnings.push(...result.warnings);
  }
  const uniqueWarnings = [...new Set(warnings)];
  const restorableRooms = roomResults
    .filter((result) => result.room?.name)
    .map((result) => result.room);
  return {
    ok: errors.length === 0,
    error: errors.length ? "backup_validation_failed" : undefined,
    schemaVersion,
    supportedSchemaVersion: BACKUP_SCHEMA_VERSION,
    appVersion: APP_VERSION,
    sourceVersion: payload.version || payload.appVersion || "",
    checkedAt: nowIso(),
    roomCount: entries.length,
    restorableRoomCount: restorableRooms.length,
    restorableRooms,
    warnings: uniqueWarnings,
    errors: [...new Set(errors)],
    summary: errors.length
      ? `복구 전 검증 실패: ${[...new Set(errors)].join(", ")}`
      : `${restorableRooms.length}개 방을 복구 대상으로 확인했습니다. 실제 복구 전 관리자 계정과 대상 방을 다시 확인하세요.`
  };
}

function validateSignupPayload(payload = {}) {
  const accountValidation = validateAccountPayload(payload);
  const applicationValidation = validateApplicationFields(payload, accountValidation.value.email);
  return {
    ok: accountValidation.ok && applicationValidation.ok,
    errors: [...accountValidation.errors, ...applicationValidation.errors],
    value: {
      ...accountValidation.value,
      ...applicationValidation.value
    }
  };
}

function validateApplicationFields(payload = {}, fallbackEmail = "", options = {}) {
  const email = normalizeEmail(payload.email);
  const roomName = compactSpaces(payload.roomName || payload.room || "");
  const roomLink = normalizeText(payload.roomLink || payload.openChatLink || payload.link || "");
  const adminName = compactSpaces(payload.adminName || payload.roomAdmin || payload.managerName || "");
  const contact = normalizeText(payload.contact || "");
  const roomId = payloadRoomId({ roomId: payload.roomId, roomLink });
  const errors = [];
  const resolvedEmail = email || normalizeEmail(fallbackEmail);
  const missingEmailAllowed = Boolean(options.allowMissingEmail);
  if (!validEmail(resolvedEmail) && !(missingEmailAllowed && !resolvedEmail)) errors.push("email_required");
  if (missingEmailAllowed && !resolvedEmail && options.requireContactWithoutEmail && !contact) errors.push("contact_required");
  if (!roomName) errors.push("room_name_required");
  if (!roomLink || !roomId) errors.push("openchat_link_required");
  if (!adminName) errors.push("admin_name_required");
  return {
    ok: errors.length === 0,
    errors,
    value: {
      email: resolvedEmail,
      roomName,
      roomLink,
      roomId,
      adminName,
      contact,
      memo: normalizeText(payload.memo || "").slice(0, 500)
    }
  };
}

function normalizeApplicationRoomPurpose(value = "") {
  const text = compactSpaces(value).toLowerCase().replace(/[\s-]+/g, "_");
  if (["game", "game_room", "gameRoom", "게임방", "게임"].includes(text)) return "game_room";
  return "general_room";
}

function approvedApplicationByIdForAccount(state, account = {}, applicationId = "") {
  const id = normalizeText(applicationId);
  if (!id) return null;
  return approvedBuyerApplications(state, account).find((application) => application.id === id) || null;
}

function createApplicationForAccount(state, account = {}, payload = {}, options = {}) {
  const accountEmail = normalizeEmail(account.email);
  const allowMissingEmail = Boolean(options.allowMissingEmail || !accountEmail);
  const validated = validateApplicationFields(payload, accountEmail, {
    allowMissingEmail,
    requireContactWithoutEmail: allowMissingEmail
  });
  if (!validated.ok) return { ok: false, status: 400, error: validated.errors[0], errors: validated.errors };
  const value = validated.value;
  const roomPurpose = normalizeApplicationRoomPurpose(payload.roomPurpose || payload.purpose || payload.roomRole);
  const linkedApplication = roomPurpose === "game_room"
    ? approvedApplicationByIdForAccount(state, account, payload.linkedApplicationId || payload.baseApplicationId || payload.parentApplicationId)
    : null;
  if (roomPurpose === "game_room" && !linkedApplication) {
    return { ok: false, status: 403, error: "linked_room_approval_required" };
  }
  if (roomPurpose === "game_room" && gameRoomApplicationsForBase(state, account, linkedApplication).length) {
    return { ok: false, status: 409, error: "game_room_already_exists" };
  }
  const applicationId = generateEntityId("app");
  const paymentId = generateEntityId("pay");
  const plan = applicationPlanForAccount(state, account, { roomPurpose });
  const createdAt = nowIso();
  const application = {
    id: applicationId,
    accountId: account.id,
    email: value.email,
    roomName: value.roomName,
    roomLink: value.roomLink,
    roomId: value.roomId,
    adminName: value.adminName,
    contact: value.contact,
    memo: value.memo,
    roomPurpose,
    linkedApplicationId: linkedApplication?.id || "",
    status: "pending_payment",
    plan,
    paymentId,
    createdAt,
    updatedAt: createdAt
  };
  const payment = {
    id: paymentId,
    applicationId,
    accountId: account.id,
    amountKrw: plan.monthlyPriceKrw,
    method: "manual_deposit",
    status: "awaiting_manual_deposit",
    requestedAt: createdAt,
    createdAt,
    updatedAt: createdAt
  };
  state.applications[applicationId] = application;
  state.payments[paymentId] = payment;
  account.applicationIds ||= [];
  addUnique(account.applicationIds, applicationId);
  account.updatedAt = createdAt;
  const inquiryAccessToken = applicationInquiryTokenForApplication(application, account);
  application.inquiryAccess = {
    tokenHash: signedTokenHash(inquiryAccessToken),
    expiresAt: new Date(Date.now() + BUYER_TOKEN_TTL_MS).toISOString(),
    usedAt: ""
  };
  return {
    ok: true,
    account: publicAccountView(account),
    application: publicApplicationView(application, state),
    payment: publicPaymentView(payment),
    inquiryAccessToken,
    next: [
      `${plan.label} 월 이용금액 ${formatKrw(plan.monthlyPriceKrw)} 입금 확인 후 관리자가 승인합니다.`,
      "승인되면 방 등록, 라이선스 키, 30일 구독이 자동 생성됩니다."
    ]
  };
}

function createSignupAccount(state, payload = {}) {
  const existingEmail = normalizeEmail(payload.email);
  const existing = findAccountByEmail(state, existingEmail);
  const validated = validateAccountPayload(payload, { requireConsents: !existing || !accountHasRequiredConsents(existing), requireNickname: true });
  if (!validated.ok) return { ok: false, status: 400, error: validated.errors[0], errors: validated.errors };
  const value = validated.value;
  if (existing) {
    if (!verifyPassword(value.password, existing.passwordHash)) {
      return { ok: false, status: 409, error: "email_already_registered" };
    }
    applyAccountProfile(existing, payload);
    applyConsentToAccount(existing, payload);
    existing.updatedAt = nowIso();
    return {
      ok: true,
      created: false,
      account: publicAccountView(existing),
      next: [
        "이미 가입된 계정입니다.",
        "서비스 신청 화면에서 방 정보를 등록하거나 로그인에서 신청 상태를 확인하세요."
      ]
    };
  }

  const accountId = generateEntityId("acct");
  const account = {
    id: accountId,
    email: value.email,
    nickname: value.nickname,
    passwordHash: hashPassword(value.password),
    status: "active",
    applicationIds: [],
    consents: consentAuditFromPayload(payload),
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
  state.accounts[accountId] = account;
  return {
    ok: true,
    created: true,
    account: publicAccountView(account),
    next: [
      "회원가입이 완료되었습니다.",
      "다음 단계에서 방 이름, 오픈채팅 링크, 관리자 닉네임을 입력해 서비스를 신청하세요."
    ]
  };
}

function createSignupApplication(state, payload = {}) {
  const email = normalizeEmail(payload.email);
  const account = findAccountByEmail(state, email);
  if (account && !verifyPassword(String(payload.password || ""), account.passwordHash)) {
    return { ok: false, status: 409, error: "email_already_registered" };
  }
  if (!account || !accountHasRequiredConsents(account)) {
    const accountValidation = validateAccountPayload(payload, { requireConsents: true });
    if (!accountValidation.ok) return { ok: false, status: 400, error: accountValidation.errors[0], errors: accountValidation.errors };
  }
  const applicationValidation = validateApplicationFields(payload, email);
  if (!applicationValidation.ok) return { ok: false, status: 400, error: applicationValidation.errors[0], errors: applicationValidation.errors };
  const value = {
    ...(account ? { email } : validateAccountPayload(payload).value),
    ...applicationValidation.value
  };
  let targetAccount = account;
  if (!targetAccount) {
    const accountId = generateEntityId("acct");
    targetAccount = {
      id: accountId,
      email: value.email,
      nickname: value.nickname || normalizeAccountNickname(payload),
      passwordHash: hashPassword(value.password),
      status: "active",
      applicationIds: [],
      consents: consentAuditFromPayload(payload),
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
    state.accounts[accountId] = targetAccount;
  }
  applyAccountProfile(targetAccount, payload);
  applyConsentToAccount(targetAccount, payload);
  return createApplicationForAccount(state, targetAccount, value);
}

function loginPayloadForAccount(state, account = {}) {
  account.lastLoginAt = nowIso();
  account.updatedAt = nowIso();
  const applicationIds = account.applicationIds || [];
  const approvedApplications = approvedBuyerApplications(state, account);
  const buyerAccess = approvedApplications.length > 0;
  const ownerAccess = isOwnerEmail(account.email);
  return {
    ok: true,
    account: publicAccountView(account),
    buyerAccess,
    ownerAccess,
    ...(ownerAccess ? { ownerToken: ownerTokenForAccount(account), ownerNext: "/admin" } : {}),
    guideToken: buyerTokenForAccount(account),
    ...(buyerAccess ? { buyerRooms: approvedApplications.map((application) => applicationRoomPayload(state, account, application)) } : {}),
    applications: applicationIds
      .map((id) => state.applications?.[id])
      .filter(Boolean)
      .map((application) => publicApplicationView(application, state))
  };
}

function loginAccount(state, payload = {}) {
  const email = normalizeEmail(payload.email);
  const password = String(payload.password || "");
  const account = findAccountByEmail(state, email);
  if (!account || !verifyPassword(password, account.passwordHash)) {
    return { ok: false, status: 401, error: "invalid_login" };
  }
  return loginPayloadForAccount(state, account);
}

async function createSignupAccountFromRequest(state, body = {}) {
  const external = await externalAccountFromRequest(state, body, { requireConsentsForNew: true });
  if (external) {
    if (!external.ok) return external;
    return {
      ok: true,
      created: false,
      account: publicAccountView(external.account),
      guideToken: buyerTokenForAccount(external.account),
      next: [
        "소셜 로그인 계정이 연결되었습니다.",
        "서비스 신청 화면에서 방 정보를 등록하거나 구매자 콘솔에서 상태를 확인하세요."
      ]
    };
  }
  return createSignupAccount(state, body);
}

async function createSignupApplicationFromRequest(state, body = {}) {
  const tokenAccount = accountFromBuyerToken(state, normalizeText(body.token || body.buyerToken));
  if (tokenAccount) {
    return createApplicationForAccount(state, tokenAccount, { ...body, email: tokenAccount.email || "" }, { allowMissingEmail: true });
  }
  const external = await externalAccountFromRequest(state, body, { requireConsentsForNew: true });
  if (external) {
    if (!external.ok) return external;
    return createApplicationForAccount(state, external.account, { ...body, email: external.account.email || "" }, { allowMissingEmail: true });
  }
  return createSignupApplication(state, body);
}

async function loginAccountFromRequest(state, body = {}) {
  const external = await externalAccountFromRequest(state, body, { requireConsentsForNew: false });
  if (external) {
    if (!external.ok) return external;
    return loginPayloadForAccount(state, external.account);
  }
  const localLogin = loginAccount(state, body);
  if (localLogin.ok) return localLogin;
  const supabaseLogin = await supabaseUserFromPassword(body.email, body.password);
  if (supabaseLogin.ok) {
    return loginPayloadForAccount(state, ensureExternalAccount(state, supabaseLogin.user, body));
  }
  if (supabaseLogin.error === "supabase_login_unavailable") return supabaseLogin;
  return localLogin;
}

async function loginStartFromRequest(state, body = {}) {
  const email = normalizeEmail(body.email);
  const localLogin = loginAccount(state, body);
  let account = localLogin.ok ? state.accounts?.[localLogin.account?.id] : null;
  if (!account) {
    const supabaseLogin = await supabaseUserFromPassword(body.email, body.password);
    if (supabaseLogin.ok) {
      account = ensureExternalAccount(state, supabaseLogin.user, body);
    } else if (supabaseLogin.error === "supabase_login_unavailable") {
      return supabaseLogin;
    }
  }
  if (!account) return { ok: false, status: 401, error: "invalid_login" };
  if (!supabaseOtpEnabled()) {
    return loginPayloadForAccount(state, account);
  }
  const otp = await sendSupabaseEmailOtp(email);
  if (!otp.ok) return otp;
  return {
    ok: true,
    twoFactorRequired: true,
    challengeToken: loginOtpChallengeForAccount(account),
    email,
    expiresInSeconds: 600,
    message: "otp_sent"
  };
}

async function loginVerifyFromRequest(state, body = {}) {
  const email = normalizeEmail(body.email);
  const challenge = verifyLoginOtpChallenge(body.challengeToken || body.challenge || "", email);
  if (!challenge) return { ok: false, status: 401, error: "invalid_or_expired_challenge" };
  const otp = await supabaseUserFromEmailOtp(email, body.otpCode || body.code || body.token);
  if (!otp.ok) return otp;
  const account = ensureExternalAccount(state, otp.user, { email });
  if (challenge.sub && account.id !== challenge.sub) return { ok: false, status: 401, error: "account_mismatch" };
  return loginPayloadForAccount(state, account);
}

function buyerConsolePayload(state, account = {}) {
  const applicationIds = account.applicationIds || [];
  const applications = applicationIds
    .map((id) => state.applications?.[id])
    .filter(Boolean)
    .map((application) => publicApplicationView(application, state));
  const approvedApplications = approvedBuyerApplications(state, account);
  const rooms = approvedApplications.map((application) => applicationRoomPayload(state, account, application));
  const appConnectCodes = rooms
    .filter((room) => room.bridgeConnectCode)
    .map((room) => ({
      applicationId: room.applicationId || "",
      roomName: room.roomName || "",
      roomRole: room.roomRole || "standard",
      roomPurpose: room.roomPurpose || "general_room",
      bridgeStatus: room.bridgeStatus || "needs_setup",
      bridgeConnectCode: room.bridgeConnectCode || "",
      setupUrl: "/console?from=android&view=setup#app-connect-code"
    }));
  const roomGroups = buyerRoomGroupsPayload(state, account, approvedApplications);
  const lifecycleSummary = lifecycleSummaryFromApplications(applications);
  return {
    ok: true,
    version: APP_VERSION,
    account: publicAccountView(account),
    testAppUrl: PLAY_INTERNAL_TEST_URL,
    applications,
    lifecycleSummary,
    rooms,
    appConnectCodes,
    roomGroups,
    canApplyGameRoom: rooms.some((room) => room.canApplyGameRoom),
    gameRoomApplyHelp: "승인된 일반방 카드에서 게임방 추가 신청을 누른 뒤, 승인 후 같은 브릿지 앱에 일반방/게임방 연결코드를 차례로 입력하세요.",
    plan: {
      monthlyPriceKrw: MONTHLY_PRICE_KRW,
      additionalRoomPriceKrw: ADDITIONAL_ROOM_PRICE_KRW,
      days: DEFAULT_SUBSCRIPTION_DAYS
    },
    commandStore: commandTemplateCatalogPayload(),
    commandPacks: commandPackCatalogPayload(),
    transfers: buyerRoomTransfersPayload(state, account),
    inquiries: buyerApplicationInquiriesPayload(state, account),
    reports: buyerRoomReportsPayload(state, account),
    archivedRooms: buyerArchivedRoomsPayload(state, account),
    restoreRequests: buyerRestoreRequestsPayload(state, account),
    guideUrls: buyerGuideUrlsPayload(),
    guideSections: [
      {
        title: "구매자 콘솔에서 먼저 확인",
        items: [
          "설치 안내 탭 상단의 앱 연결 코드 카드에서 연결코드를 확인하고 복사합니다.",
          "앱에서는 구매자 콘솔 버튼으로 /console?from=android&view=setup 화면을 엽니다.",
          "복사한 연결코드를 앱 연결코드 입력칸에 붙여넣거나, 앱의 서버와 다시 동기화 버튼으로 최신 방 설정을 맞춥니다."
        ]
      },
      {
        title: "앱 연결 상태",
        items: [
          "서버 응답 방 수와 앱 저장 방 수가 같아야 합니다.",
          "게임방이 있으면 일반방과 게임방 역할이 앱 등록 방 목록에 함께 표시되어야 합니다.",
          "최근 무시 사유가 등록방 아님이면 카카오 알림의 방 이름과 콘솔 방 이름을 비교합니다."
        ]
      }
    ],
    ownerAdminNotice: "/admin 은 판매자 운영자 전용입니다. 구매자는 /console, /my-rooms, /setup, /license 화면만 사용합니다."
  };
}

function buyerApplicationInquiriesPayload(state, account = {}) {
  return Object.values(state.applicationInquiries || {})
    .filter((inquiry) => inquiry.accountId === account.id)
    .map((inquiry) => publicApplicationInquiryView(state, inquiry))
    .sort((left, right) => String(right.createdAt || "").localeCompare(String(left.createdAt || "")));
}

function buyerRoomReportsPayload(state, account = {}) {
  const ownedRoomNames = new Set((account.applicationIds || [])
    .map((id) => state.applications?.[id])
    .filter(Boolean)
    .map((application) => keyFor(application.roomName)));
  const reports = [];
  for (const roomState of Object.values(state.rooms || {})) {
    if (!ownedRoomNames.has(keyFor(roomState.name))) continue;
    roomState.reports = normalizeReports(roomState.reports || []);
    for (const report of roomState.reports) {
      reports.push(publicAdminReportView(roomState, report));
    }
  }
  return reports.sort((left, right) => String(right.createdAt || "").localeCompare(String(left.createdAt || "")));
}

function buyerArchivedRoomsPayload(state, account = {}) {
  const ownedApplicationIds = new Set(account.applicationIds || []);
  return Object.values(state.archivedRooms || {})
    .filter((archive) => (archive.affectedApplicationIds || []).some((id) => ownedApplicationIds.has(id)))
    .map((archive) => publicArchivedRoomView(state, archive))
    .sort((left, right) => String(right.archivedAt || "").localeCompare(String(left.archivedAt || "")));
}

function publicRestoreRequestView(state = {}, request = {}) {
  const archive = state.archivedRooms?.[request.archiveId] || {};
  const status = request.status || "open";
  return {
    id: request.id || "",
    archiveId: request.archiveId || "",
    roomName: request.roomName || archive.roomName || "",
    accountId: request.accountId || "",
    status,
    statusLabel: status === "resolved" ? "완료" : status === "in_review" ? "확인중" : "접수",
    reason: request.reason || "",
    createdAt: request.createdAt || "",
    updatedAt: request.updatedAt || "",
    resolvedAt: request.resolvedAt || "",
    resolvedBy: request.resolvedBy || "",
    resolution: request.resolution || "",
    archivedRoomExists: Boolean(archive.id)
  };
}

function buyerRestoreRequestsPayload(state, account = {}) {
  return Object.values(state.restoreRequests || {})
    .filter((request) => request.accountId === account.id)
    .map((request) => publicRestoreRequestView(state, request))
    .sort((left, right) => String(right.createdAt || "").localeCompare(String(left.createdAt || "")));
}

async function buyerRestoreRequestFromRequest(state, req, body = {}) {
  const auth = await accountFromBuyerRequest(state, req, body);
  if (!auth.ok) return auth;
  const archiveId = normalizeText(body.archiveId || body.id);
  const archive = state.archivedRooms?.[archiveId];
  if (!archive) return { ok: false, status: 404, error: "archived_room_not_found" };
  const ownedApplicationIds = new Set(auth.account.applicationIds || []);
  if (!(archive.affectedApplicationIds || []).some((id) => ownedApplicationIds.has(id))) {
    return { ok: false, status: 403, error: "restore_request_forbidden" };
  }
  state.restoreRequests ||= {};
  const existing = Object.values(state.restoreRequests).find((request) => (
    request.archiveId === archiveId
    && request.accountId === auth.account.id
    && request.status !== "resolved"
  ));
  if (existing) {
    return {
      ok: true,
      version: APP_VERSION,
      duplicate: true,
      request: publicRestoreRequestView(state, existing),
      ...buyerConsolePayload(state, auth.account)
    };
  }
  const requestId = generateEntityId("restore");
  state.restoreRequests[requestId] = {
    id: requestId,
    archiveId,
    roomName: archive.roomName || "",
    accountId: auth.account.id,
    status: "open",
    reason: previewText(body.reason || body.memo || "복구 요청", 300),
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
  return {
    ok: true,
    version: APP_VERSION,
    request: publicRestoreRequestView(state, state.restoreRequests[requestId]),
    ...buyerConsolePayload(state, auth.account)
  };
}

function adminResolveRestoreRequest(state, payload = {}, resolvedBy = "admin_console") {
  state.restoreRequests ||= {};
  const requestId = normalizeText(payload.requestId || payload.id || payload.restoreRequestId);
  const request = state.restoreRequests[requestId];
  if (!request) return { ok: false, status: 404, error: "restore_request_not_found" };
  const nextStatus = normalizeText(payload.status || "resolved");
  if (!["open", "in_review", "resolved"].includes(nextStatus)) {
    return { ok: false, status: 400, error: "invalid_restore_request_status" };
  }
  const now = nowIso();
  request.status = nextStatus;
  request.updatedAt = now;
  if (nextStatus === "resolved") {
    request.resolvedAt = now;
    request.resolvedBy = resolvedBy;
    request.resolution = previewText(payload.resolution || payload.memo || "관리자 처리 완료", 300);
  } else {
    request.resolution = previewText(payload.resolution || request.resolution || "", 300);
  }
  return {
    ok: true,
    version: APP_VERSION,
    request: publicRestoreRequestView(state, request),
    summary: adminRestoreRequestsPayload(state).summary
  };
}

function approvedApplicationForInstall(state, account = {}, body = {}) {
  const applications = approvedBuyerApplications(state, account);
  const applicationId = normalizeText(body.applicationId || body.appId);
  const roomName = normalizeText(body.roomName || body.room);
  const requestedRoomId = normalizeText(body.roomId);
  if (applicationId) return applications.find((application) => application.id === applicationId) || null;
  if (roomName) return applications.find((application) => keyFor(application.roomName) === keyFor(roomName)) || null;
  if (requestedRoomId) {
    return applications.find((application) => {
      if (normalizeText(application.roomId) === requestedRoomId) return true;
      const roomState = state.rooms?.[roomKey(application.roomName)];
      return (roomState?.settings?.roomIds || []).includes(requestedRoomId);
    }) || null;
  }
  return applications[0] || null;
}

function templateInstallItems(template, body = {}) {
  if ((template.commands || []).length) {
    const source = Array.isArray(body.commands) && body.commands.length ? body.commands : template.commands;
    return source.map((item, index) => {
      const fallback = template.commands[index] || {};
      return {
        trigger: normalizeCustomCommandTrigger(item?.trigger || item?.command || fallback.trigger),
        response: normalizeCustomCommandResponse(item?.response || item?.reply || fallback.response),
        proxyCommand: normalizeCustomCommandTrigger(item?.proxyCommand || fallback.proxyCommand || "")
      };
    });
  }
  return [{
    trigger: normalizeCustomCommandTrigger(body.trigger || template.trigger),
    response: normalizeCustomCommandResponse(body.response || template.response),
    proxyCommand: normalizeCustomCommandTrigger(template.proxyCommand || "")
  }];
}

function commandPackInstallItems(pack, slot) {
  return (pack.customCommands || []).map((item) => ({
    trigger: normalizeCustomCommandTrigger(item.trigger),
    response: normalizeCustomCommandResponse(item.response),
    proxyCommand: normalizeCustomCommandTrigger(item.proxyCommand || ""),
    sourcePackId: pack.id,
    sourcePackSlot: slot || pack.slot,
    sourcePackVersion: pack.version
  })).filter((item) => item.trigger && item.response);
}

function resolveCommandPackSelection(current = {}, body = {}) {
  const replaceMode = body.replace === true || normalizeText(body.mode).toLowerCase() === "replace";
  let installedPackIds = [...(current.installedPackIds || [])];
  if (Object.hasOwn(body, "installedPackIds")) {
    const requestedInstalledPackIds = [...new Set((Array.isArray(body.installedPackIds) ? body.installedPackIds : []).map((id) => validCommandPackId(id, "pack")).filter(Boolean))];
    installedPackIds = replaceMode ? requestedInstalledPackIds : [...new Set([...installedPackIds, ...requestedInstalledPackIds])];
  }
  let basePackId = Object.hasOwn(body, "basePackId")
    ? validCommandPackId(body.basePackId, "base")
    : current.basePackId || "";
  let addonPackIds = [...(current.addonPackIds || [])];
  if (Object.hasOwn(body, "addonPackIds")) {
    const requestedAddonPackIds = [...new Set((Array.isArray(body.addonPackIds) ? body.addonPackIds : []).map((id) => validCommandPackId(id, "addon")).filter(Boolean))];
    addonPackIds = replaceMode ? requestedAddonPackIds : [...new Set([...addonPackIds, ...requestedAddonPackIds])];
  }
  const requestedPack = commandPackById(body.commandPackId || body.packId);
  const action = normalizeText(body.action || "apply");
  if (requestedPack?.slot === "pack") {
    installedPackIds = action === "remove"
      ? installedPackIds.filter((id) => id !== requestedPack.id)
      : [...new Set([...installedPackIds, requestedPack.id])];
  }
  if (requestedPack?.slot === "base") basePackId = requestedPack.id;
  if (requestedPack?.slot === "addon") {
    addonPackIds = action === "remove"
      ? addonPackIds.filter((id) => id !== requestedPack.id)
      : [...new Set([...addonPackIds, requestedPack.id])];
  }
  if (requestedPack?.slot === "combo") {
    basePackId = validCommandPackId(requestedPack.basePackId, "base");
    addonPackIds = [...new Set((requestedPack.addonPackIds || []).map((id) => validCommandPackId(id, "addon")).filter(Boolean))];
  }
  return { basePackId, addonPackIds, installedPackIds };
}

function applyCommandPacksToRoom(roomState, account = {}, body = {}) {
  roomState.settings ||= {};
  const current = normalizeCommandPackState(roomState.settings.commandPacks || {});
  const requestedPack = commandPackById(body.commandPackId || body.packId);
  const action = normalizeText(body.action || "apply").toLowerCase();
  const selection = resolveCommandPackSelection(current, body);
  const basePack = selection.basePackId ? commandPackById(selection.basePackId) : null;
  const addonPacks = selection.addonPackIds.map((id) => commandPackById(id)).filter(Boolean);
  const installedPacks = selection.installedPackIds.map((id) => commandPackById(id)).filter(Boolean);
  if (selection.basePackId && !basePack) return { ok: false, status: 400, error: "invalid_base_pack" };
  if (addonPacks.length !== selection.addonPackIds.length) return { ok: false, status: 400, error: "invalid_addon_pack" };
  if (installedPacks.length !== selection.installedPackIds.length) return { ok: false, status: 400, error: "invalid_command_pack" };

  const installedAt = nowIso();
  const updatedBy = account.email || account.nickname || "buyer_console";
  const keepCommands = customCommands(roomState).filter((command) => !command.sourcePackSlot);
  const byTrigger = new Map(keepCommands.map((command) => [command.trigger, command]));
  const packCommands = [
    ...installedPacks.flatMap((pack) => commandPackInstallItems(pack, "pack")),
    ...(basePack ? commandPackInstallItems(basePack, "base") : []),
    ...addonPacks.flatMap((pack) => commandPackInstallItems(pack, "addon"))
  ];
  const skippedCommands = [];
  const installedCommands = [];
  for (const command of packCommands) {
    if (RESERVED_CUSTOM_COMMANDS.has(command.trigger)) {
      skippedCommands.push({ ...command, reason: "reserved_command" });
      continue;
    }
    const existing = byTrigger.get(command.trigger);
    if (existing) {
      skippedCommands.push({ ...command, reason: existing.sourcePackId ? "pack_command_exists" : "direct_command_exists" });
      continue;
    }
    const installedCommand = {
      trigger: command.trigger,
      response: command.response,
      updatedAt: installedAt,
      updatedBy,
      sourceTemplateId: "",
      sourceTemplateKind: "command-pack",
      sourcePackId: command.sourcePackId,
      sourcePackSlot: command.sourcePackSlot,
      sourcePackVersion: command.sourcePackVersion,
      proxyCommand: command.proxyCommand || ""
    };
    byTrigger.set(command.trigger, installedCommand);
    installedCommands.push(installedCommand);
  }
  if (byTrigger.size > CUSTOM_COMMAND_LIMIT) return { ok: false, status: 400, error: "custom_command_limit" };

  roomState.settings.customCommands = normalizeCustomCommands([...byTrigger.values()]);
  roomState.settings.commandPacks = normalizeCommandPackState({
    installedPackIds: selection.installedPackIds,
    basePackId: selection.basePackId,
    addonPackIds: selection.addonPackIds,
    installedAt: current.installedAt || installedAt,
    updatedAt: installedAt,
    updatedBy
  });
  roomState.settings.features ||= { ...DEFAULT_ROOM_FEATURES };
  for (const pack of [...installedPacks, basePack, ...addonPacks].filter(Boolean)) {
    for (const [key, value] of Object.entries(pack.features || {})) {
      roomState.settings.features[key] = value !== false;
    }
  }
  recordRoomEvent(roomState, {
    type: "command_packs_applied",
    trigger: [...selection.installedPackIds, selection.basePackId, ...selection.addonPackIds].filter(Boolean).join(", "),
    by: updatedBy
  });
  const remainingPackCommands = new Set([...installedPacks, basePack, ...addonPacks]
    .filter(Boolean)
    .flatMap((pack) => [...(pack.fixedCommands || []), ...(pack.customCommands || []).map((command) => command.trigger)]));
  const directCommandTriggers = new Set(keepCommands.map((command) => command.trigger));
  const requestedPackCommands = requestedPack
    ? [...new Set([...(requestedPack.fixedCommands || []), ...(requestedPack.customCommands || []).map((command) => command.trigger)])]
    : [];
  const keptCommands = action === "remove"
    ? requestedPackCommands.filter((command) => remainingPackCommands.has(command) || directCommandTriggers.has(command))
    : [];
  const removedCommands = action === "remove"
    ? requestedPackCommands.filter((command) => !keptCommands.includes(command))
    : [];
  return {
    ok: true,
    version: APP_VERSION,
    current: roomState.settings.commandPacks,
    packs: commandPackCatalogPayload(roomState.settings.commandPacks).packs,
    action,
    requestedPackId: requestedPack?.id || "",
    requestedPackTitle: requestedPack?.title || "",
    removedCommands,
    keptCommands,
    installedCommands,
    skippedCommands,
    customCommandCount: roomState.settings.customCommands.length
  };
}

function applyCommandPacksForBuyer(state, account = {}, body = {}) {
  const application = approvedApplicationForInstall(state, account, body);
  if (!application) return { ok: false, status: 404, error: "approved_room_not_found" };
  const roomState = ensureRoom(state, application.roomName);
  const result = applyCommandPacksToRoom(roomState, account, body);
  if (!result.ok) return result;
  return {
    ...result,
    room: applicationRoomPayload(state, account, application)
  };
}

function buyerRoomCommandPacksForAccount(state, account = {}, body = {}) {
  const application = approvedApplicationForInstall(state, account, body);
  if (!application) return { ok: false, status: 404, error: "approved_room_not_found" };
  const roomState = ensureRoom(state, application.roomName);
  return {
    ...commandPackCatalogPayload(roomState.settings.commandPacks),
    room: applicationRoomPayload(state, account, application)
  };
}

function installCommandTemplateForBuyer(state, account = {}, body = {}) {
  const application = approvedApplicationForInstall(state, account, body);
  if (!application) return { ok: false, status: 404, error: "approved_room_not_found" };
  const template = commandTemplateById(body.templateId || body.id);
  if (!template) return { ok: false, status: 404, error: "template_not_found" };
  if (!template.installable) return { ok: false, status: 400, error: "template_not_installable" };

  const installItems = templateInstallItems(template, body)
    .filter((item) => item.trigger && item.response);
  if (!installItems.length) return { ok: false, status: 400, error: "invalid_template_payload" };
  if (installItems.some((item) => RESERVED_CUSTOM_COMMANDS.has(item.trigger))) {
    return { ok: false, status: 409, error: "reserved_command" };
  }

  const roomState = ensureRoom(state, application.roomName);
  const commands = customCommands(roomState);
  const byTrigger = new Map(commands.map((item) => [item.trigger, item]));
  const newTriggerCount = installItems.filter((item) => !byTrigger.has(item.trigger)).length;
  if (commands.length + newTriggerCount > CUSTOM_COMMAND_LIMIT) {
    return { ok: false, status: 400, error: "custom_command_limit" };
  }
  const installedAt = nowIso();
  const installedCommands = installItems.map((item) => ({
    trigger: item.trigger,
    response: item.response,
    updatedAt: installedAt,
    updatedBy: account.email || account.nickname || "buyer_console",
    sourceTemplateId: template.id,
    sourceTemplateKind: template.kind,
    proxyCommand: item.proxyCommand || ""
  }));
  for (const item of installedCommands) byTrigger.set(item.trigger, item);
  roomState.settings.customCommands = normalizeCustomCommands([...byTrigger.values()]);
  recordRoomEvent(roomState, {
    type: "buyer_command_template_installed",
    trigger: installedCommands.map((item) => item.trigger).join(", "),
    templateId: template.id,
    by: account.email || account.nickname || "buyer_console"
  });
  return {
    ok: true,
    version: APP_VERSION,
    room: applicationRoomPayload(state, account, application),
    template: publicCommandTemplate(template),
    command: installedCommands[0],
    commands: installedCommands,
    installedCount: installedCommands.length
  };
}

function normalizeInstallCodeToken(token, fallbackType = "") {
  const value = normalizeText(token).toLowerCase();
  const full = value.match(/^(pk|no|st)\.(\d{1,3})$/);
  if (full) return { code: `${full[1]}.${paddedInstallNumber(full[2])}`, type: full[1] };
  const shorthand = value.match(/^\d{1,3}$/);
  if (shorthand && fallbackType) return { code: `${fallbackType}.${paddedInstallNumber(shorthand[0])}`, type: fallbackType };
  return { code: "", type: fallbackType };
}

function parseCommandInstallCodes(args = []) {
  const tokens = (Array.isArray(args) ? args.join(" ") : normalizeText(args)).split(/[\s,]+/).map(normalizeText).filter(Boolean);
  const entries = [];
  const invalid = [];
  const seen = new Set();
  let currentType = "";
  for (const token of tokens) {
    const parsed = normalizeInstallCodeToken(token, currentType);
    if (!parsed.code) {
      invalid.push(token);
      continue;
    }
    currentType = parsed.type;
    if (seen.has(parsed.code)) continue;
    seen.add(parsed.code);
    entries.push(parsed.code);
  }
  return {
    entries,
    invalid,
    tooMany: entries.length > COMMAND_INSTALL_MAX_CODES
  };
}

function commandInstallCatalogItems() {
  const packs = visibleCommandPacks().map((pack) => ({
    type: "pack",
    code: commandPackInstallCode(pack),
    id: pack.id,
    title: pack.title,
    description: pack.description,
    commands: pack.fixedCommands || [],
    search: [pack.title, pack.description, pack.categoryTitle, pack.tier, pack.id, ...(pack.tags || []), ...(pack.fixedCommands || [])]
  }));
  const templates = COMMAND_TEMPLATES
    .filter((template) => template.installable)
    .map((template) => ({
      type: commandTemplateInstallCodeType(template),
      code: commandTemplateInstallCode(template),
      id: template.id,
      title: template.title,
      description: template.description,
      commands: templateInstallItems(template).map((item) => item.trigger),
      search: [
        template.title,
        template.description,
        template.categoryTitle,
        template.kind,
        template.command,
        template.trigger,
        ...(template.tags || []),
        ...(template.commands || []).flatMap((command) => [command.trigger, command.response, command.proxyCommand])
      ]
    }));
  return [...packs, ...templates].filter((item) => item.code);
}

function commandInstallCatalogItemByCode(code) {
  const normalized = normalizeText(code).toLowerCase();
  if (normalized.startsWith("pk.")) {
    const pack = commandPackByInstallCode(normalized);
    return pack ? { type: "pack", code: commandPackInstallCode(pack), id: pack.id, pack } : null;
  }
  const template = commandTemplateByInstallCode(normalized);
  return template ? { type: commandTemplateInstallCodeType(template), code: commandTemplateInstallCode(template), id: template.id, template } : null;
}

function commandInstallDraftKey(roomState, sender, identity = {}) {
  return normalizeIdentityId(identity.senderId) || `${roomKey(roomState.name)}:${personKey(sender)}`;
}

function cleanupCommandInstallDrafts(roomState, now = Date.now()) {
  roomState.commandInstallDrafts ||= {};
  for (const [key, draft] of Object.entries(roomState.commandInstallDrafts)) {
    if (!draft?.expiresAt || Date.parse(draft.expiresAt) <= now) delete roomState.commandInstallDrafts[key];
  }
}

function createInstallConfirmCode() {
  return String((Number.parseInt(randomBytes(2).toString("hex"), 16) % 9000) + 1000);
}

function buildCommandInstallPlan(roomState, codes = []) {
  const entries = codes.map((code) => commandInstallCatalogItemByCode(code)).filter(Boolean);
  const invalid = codes.filter((code) => !commandInstallCatalogItemByCode(code));
  const currentPacks = normalizeCommandPackState(roomState.settings?.commandPacks || {});
  const installedPackIds = new Set([...(currentPacks.installedPackIds || []), currentPacks.basePackId, ...(currentPacks.addonPackIds || [])].filter(Boolean));
  const existingCommands = new Map(customCommands(roomState).map((command) => [command.trigger, command]));
  const plannedTriggers = new Set();
  const packs = [];
  const templates = [];
  const plannedCommands = [];
  const already = [];
  const skipped = [];

  for (const entry of entries) {
    if (entry.type === "pack") {
      if (installedPackIds.has(entry.pack.id)) already.push(`${entry.code} ${entry.pack.title}`);
      else packs.push(entry);
      continue;
    }
    const installItems = templateInstallItems(entry.template).filter((item) => item.trigger && item.response);
    const templatePlanned = [];
    for (const item of installItems) {
      if (RESERVED_CUSTOM_COMMANDS.has(item.trigger)) {
        skipped.push(`${item.trigger}: 고정 명령어와 충돌`);
        continue;
      }
      if (existingCommands.has(item.trigger)) {
        skipped.push(`${item.trigger}: 기존 명령어 보존`);
        continue;
      }
      if (plannedTriggers.has(item.trigger)) {
        skipped.push(`${item.trigger}: 같은 설치 요청 안에서 중복`);
        continue;
      }
      plannedTriggers.add(item.trigger);
      const planned = {
        ...item,
        sourceTemplateId: entry.template.id,
        sourceTemplateKind: entry.template.kind
      };
      templatePlanned.push(planned);
      plannedCommands.push(planned);
    }
    if (templatePlanned.length) templates.push({ ...entry, commandCount: templatePlanned.length });
    else already.push(`${entry.code} ${entry.template.title}`);
  }

  const limitExceeded = customCommands(roomState).length + plannedCommands.length > CUSTOM_COMMAND_LIMIT;
  return { entries, invalid, packs, templates, plannedCommands, already, skipped, limitExceeded };
}

function commandInstallRecommendations(roomState, plan) {
  const current = normalizeCommandPackState(roomState.settings?.commandPacks || {});
  const installed = new Set([...(current.installedPackIds || []), current.basePackId, ...(current.addonPackIds || [])].filter(Boolean));
  const requested = new Set((plan.packs || []).map((entry) => entry.pack.id));
  const commandText = [
    ...(plan.plannedCommands || []).map((command) => command.trigger),
    ...(plan.templates || []).map((entry) => entry.template.title),
    ...(plan.packs || []).flatMap((entry) => [entry.pack.id, entry.pack.title])
  ].join(" ");
  const candidates = [];
  if (/주사위|낚시|탐험|뽑기|홀짝|코인|룰렛|슬롯|복권|하이로우|폭탄피하기|보물상자|확률게임|게임/u.test(commandText)) candidates.push("game-chance");
  if (/상점|구매|가방|아이템|선물/u.test(commandText)) candidates.push("shop-inventory", "point-economy");
  if (/공지|규칙|문의|프로필양식/u.test(commandText)) candidates.push("ops-core");
  if (/출석|순위|랭킹|레벨/u.test(commandText)) candidates.push("attendance-growth");
  return [...new Set(candidates)]
    .map((id) => commandPackById(id))
    .filter((pack) => pack && !installed.has(pack.id) && !requested.has(pack.id))
    .slice(0, 3)
    .map((pack) => `${commandPackInstallCode(pack)} ${pack.title}`);
}

function commandInstallPlanText(roomState, plan, confirmCode = "") {
  const lines = ["명령어 설치 미리보기"];
  if (plan.invalid.length) lines.push("", "찾을 수 없는 코드", ...plan.invalid.map((code) => `- ${code}`));
  if (plan.packs.length) lines.push("", "설치 예정 팩", ...plan.packs.map((entry) => `- ${entry.code} ${entry.pack.title}`));
  if (plan.templates.length) lines.push("", "설치 예정 명령어/세트", ...plan.templates.map((entry) => `- ${entry.code} ${entry.template.title} (${entry.commandCount}개)`));
  if (plan.already.length) lines.push("", "이미 설치됨 또는 새로 설치할 항목 없음", ...plan.already.slice(0, 8).map((item) => `- ${item}`));
  if (plan.skipped.length) lines.push("", "건너뜀", ...plan.skipped.slice(0, 8).map((item) => `- ${item}`));
  const recommendations = commandInstallRecommendations(roomState, plan);
  if (recommendations.length) lines.push("", "같이 쓰기 좋은 추천", ...recommendations.map((item) => `- ${item}`));
  if (plan.limitExceeded) lines.push("", "커스텀 명령어 최대 개수를 초과하여 설치할 수 없습니다.");
  else if (confirmCode) lines.push("", `설치하려면 /설치확인 ${confirmCode} 을 입력해 주세요.`, `취소하려면 /설치취소 ${confirmCode} 을 입력해 주세요.`);
  else lines.push("", "새로 설치할 항목이 없습니다.");
  return lines.join("\n");
}

function installPlannedTemplateCommands(roomState, sender, plan) {
  const commands = customCommands(roomState);
  const byTrigger = new Map(commands.map((item) => [item.trigger, item]));
  const installedAt = nowIso();
  const installed = [];
  for (const item of plan.plannedCommands || []) {
    if (byTrigger.has(item.trigger)) continue;
    const command = {
      trigger: item.trigger,
      response: item.response,
      updatedAt: installedAt,
      updatedBy: sender,
      sourceTemplateId: item.sourceTemplateId,
      sourceTemplateKind: item.sourceTemplateKind,
      proxyCommand: item.proxyCommand || ""
    };
    byTrigger.set(command.trigger, command);
    installed.push(command);
  }
  roomState.settings.customCommands = normalizeCustomCommands([...byTrigger.values()]);
  if (installed.length) {
    recordRoomEvent(roomState, {
      type: "chat_command_install_templates",
      trigger: installed.map((item) => item.trigger).join(", "),
      by: sender
    });
  }
  return installed;
}

function commandInstallSearchText(query = "") {
  const tokens = commandSearchTokens(query);
  if (!tokens.length) {
    return [
      "검색어를 입력해 주세요.",
      "예: /명령어검색 공지",
      "예: /명령어설치 pk.001 no.100 102"
    ].join("\n");
  }
  const items = commandInstallCatalogItems()
    .filter((item) => {
      const haystack = [item.code, item.title, item.description, item.type, ...(item.commands || []), ...(item.search || [])].join(" ").toLowerCase();
      return tokens.every((token) => haystack.includes(token));
    })
    .slice(0, 6);
  if (!items.length) return "검색 결과가 없습니다. 다른 키워드로 다시 검색해 주세요.";
  return [
    "명령어 설치 코드 검색 결과",
    ...items.map((item) => `- ${item.code} ${item.title} (${item.type === "pack" ? "팩" : item.type === "set" ? "세트" : "명령어"})`)
  ].join("\n");
}

function commandInstallPreviewCommand(roomState, sender, parsed, identity = {}) {
  const denied = requireAdmin(roomState, sender);
  if (denied) return denied;
  const parsedCodes = parseCommandInstallCodes(parsed.args);
  if (parsedCodes.tooMany) return `한 번에 최대 ${COMMAND_INSTALL_MAX_CODES}개까지만 설치할 수 있습니다.`;
  if (!parsedCodes.entries.length && parsedCodes.invalid.length) {
    return commandInstallPlanText(roomState, { entries: [], invalid: parsedCodes.invalid, packs: [], templates: [], plannedCommands: [], already: [], skipped: [], limitExceeded: false });
  }
  if (!parsedCodes.entries.length) return "설치할 코드를 입력해 주세요.\n예: /명령어설치 pk.001 no.100 102 st.003";
  const plan = buildCommandInstallPlan(roomState, parsedCodes.entries);
  plan.invalid.push(...parsedCodes.invalid);
  if (plan.limitExceeded || (!plan.packs.length && !plan.plannedCommands.length)) return commandInstallPlanText(roomState, plan);
  cleanupCommandInstallDrafts(roomState);
  const confirmCode = createInstallConfirmCode();
  const key = commandInstallDraftKey(roomState, sender, identity);
  const createdAtMs = Date.now();
  roomState.commandInstallDrafts[key] = {
    code: confirmCode,
    entries: plan.entries.map((entry) => entry.code),
    createdAt: new Date(createdAtMs).toISOString(),
    expiresAt: new Date(createdAtMs + COMMAND_INSTALL_DRAFT_TTL_MS).toISOString(),
    by: sender
  };
  return commandInstallPlanText(roomState, plan, confirmCode);
}

function commandInstallConfirmCommand(roomState, sender, parsed, identity = {}) {
  const denied = requireAdmin(roomState, sender);
  if (denied) return denied;
  cleanupCommandInstallDrafts(roomState);
  const key = commandInstallDraftKey(roomState, sender, identity);
  const draft = roomState.commandInstallDrafts?.[key];
  const code = normalizeText(parsed.args?.[0]);
  if (!draft) return "확인 대기 중인 설치 요청이 없습니다. /명령어설치 로 먼저 미리보기를 만들어 주세요.";
  if (!code || draft.code !== code) return "설치확인 코드가 일치하지 않습니다.";
  const plan = buildCommandInstallPlan(roomState, draft.entries || []);
  if (plan.limitExceeded) return commandInstallPlanText(roomState, plan);
  const installedPacks = [];
  for (const entry of plan.packs) {
    const result = applyCommandPacksToRoom(roomState, { nickname: sender }, { commandPackId: entry.pack.id, action: "apply" });
    if (result.ok) installedPacks.push(`${entry.code} ${entry.pack.title}`);
  }
  const installedCommands = installPlannedTemplateCommands(roomState, sender, plan);
  delete roomState.commandInstallDrafts[key];
  const lines = ["명령어 설치가 완료되었습니다."];
  if (installedPacks.length) lines.push("", "장착된 팩", ...installedPacks.map((item) => `- ${item}`));
  if (installedCommands.length) lines.push("", "설치된 명령어", ...installedCommands.slice(0, 10).map((item) => `- ${item.trigger}`));
  if (plan.skipped.length) lines.push("", "건너뜀", ...plan.skipped.slice(0, 8).map((item) => `- ${item}`));
  const recommendations = commandInstallRecommendations(roomState, plan);
  if (recommendations.length) lines.push("", "다음 추천", ...recommendations.map((item) => `- ${item}`));
  return lines.join("\n");
}

function commandInstallCancelCommand(roomState, sender, parsed, identity = {}) {
  const denied = requireAdmin(roomState, sender);
  if (denied) return denied;
  cleanupCommandInstallDrafts(roomState);
  const key = commandInstallDraftKey(roomState, sender, identity);
  const draft = roomState.commandInstallDrafts?.[key];
  const code = normalizeText(parsed.args?.[0]);
  if (draft && (!code || draft.code === code)) {
    delete roomState.commandInstallDrafts[key];
    return "명령어 설치 요청을 취소했습니다.";
  }
  const deleteItem = customCommandDeleteItemByCode(roomState, code);
  if (deleteItem) {
    roomState.settings.customCommands = customCommands(roomState).filter((item) => item.trigger !== deleteItem.trigger);
    recordRoomEvent(roomState, { type: "custom_command_deleted", trigger: deleteItem.trigger, by: sender });
    return [
      "설치 명령어를 삭제했습니다.",
      "",
      `- 명령어 : ${deleteItem.trigger}`,
      `- 삭제 코드 : ${deleteItem.deleteCode}`,
      "",
      "/명령어설치목록 으로 남은 설치 항목을 확인하세요."
    ].join("\n");
  }
  if (draft) return "설치취소 코드가 일치하지 않습니다. 설치된 명령어 삭제는 /명령어설치목록 의 삭제 코드를 확인해 주세요.";
  return "삭제 코드를 확인할 수 없습니다. /명령어설치목록 에서 /설치취소 [삭제코드]를 확인해 주세요.";
}

function customCommandDeleteCode(command, index = 0) {
  const seed = `${command.trigger}|${command.sourceTemplateId || ""}|${command.sourcePackId || ""}|${index}`;
  return String((Number.parseInt(createHash("sha256").update(seed).digest("hex").slice(0, 8), 16) % 9000) + 1000);
}

function customCommandDeleteItems(roomState) {
  const used = new Set();
  return customCommands(roomState)
    .filter((command) => !command.sourcePackId)
    .map((command, index) => {
      let deleteCode = customCommandDeleteCode(command, index);
      let salt = index;
      while (used.has(deleteCode)) {
        salt += 1;
        deleteCode = customCommandDeleteCode(command, salt);
      }
      used.add(deleteCode);
      const template = command.sourceTemplateId ? commandTemplateById(command.sourceTemplateId) : null;
      return {
        ...command,
        installCode: template ? commandTemplateInstallCode(template) : "",
        deleteCode,
        deleteCommand: `/설치취소 ${deleteCode}`
      };
    });
}

function customCommandDeleteItemByCode(roomState, code = "") {
  const targetCode = normalizeText(code);
  if (!/^\d{4}$/.test(targetCode)) return null;
  return customCommandDeleteItems(roomState).find((item) => item.deleteCode === targetCode) || null;
}

function commandInstallListText(roomState, sender, identity = {}) {
  const denied = requireAdmin(roomState, sender);
  if (denied) return denied;
  cleanupCommandInstallDrafts(roomState);
  const current = normalizeCommandPackState(roomState.settings?.commandPacks || {});
  const packs = activeCommandPacks(roomState).filter((pack) => !pack.hidden);
  const commands = customCommandDeleteItems(roomState);
  const draft = roomState.commandInstallDrafts?.[commandInstallDraftKey(roomState, sender, identity)];
  const packSummary = packs.length ? packs.map((pack) => {
    const detail = publicCommandPack(pack, current);
    return `${detail.installCode || pack.id} ${pack.title} ${detail.commandCount}개`;
  }).join(" · ") : "없음";
  const commandLines = commands.slice(0, 3).map((command) => `${command.trigger} · 설치 코드 : ${command.installCode || "직접등록"} · 삭제 코드 : ${command.deleteCode} · 예: ${command.deleteCommand}`);
  const lines = [
    "명령어 설치 현황",
    `장착된 팩: ${packSummary}`,
    `커스텀 명령어 ${commands.length}개${commands.length > commandLines.length ? ` · 상위 ${commandLines.length}개 표시` : ""}`,
    ...(commandLines.length ? commandLines : ["커스텀 명령어 없음"])
  ];
  if (draft) lines.push(`확인 대기: /설치확인 ${draft.code} (${draft.expiresAt.slice(11, 16)}까지)`);
  if (!current.installedPackIds.length && !current.basePackId && !current.addonPackIds.length) lines.push("추천: /명령어설치 pk.001 로 운영 기본팩");
  return lines.join("\n");
}

function commandPackListText(roomState, sender, parsed = {}) {
  const denied = requireAdmin(roomState, sender);
  if (denied) return denied;
  const packs = activeCommandPacks(roomState).filter((pack) => !pack.hidden);
  const detailed = ["자세히", "상세", "전체"].includes(normalizeText(parsed.args?.[0]));
  const lines = [detailed ? "장착된 명령어 팩 상세" : "장착된 명령어 팩"];
  if (!packs.length) {
    lines.push("", "- 없음", "", "추천: /명령어설치 pk.001 로 운영 기본팩을 먼저 장착해 보세요.");
    return lines.join("\n");
  }
  lines.push("", ...packs.map((pack) => {
    const code = commandPackInstallCode(pack) || pack.id;
    const commandCount = (pack.fixedCommands || []).length + (pack.customCommands || []).length;
    if (!detailed) return `- ${code} ${pack.title} (${pack.id}, ${commandCount}개)`;
    const detail = publicCommandPack(pack, roomState.settings?.commandPacks || {});
    const commands = detail.commandsDetailed.map((item) => item.command).join(", ") || "없음";
    return `- ${code} ${pack.title} (${pack.id}, ${commandCount}개)\n  포함 명령어: ${commands}`;
  }));
  if (!detailed) lines.push("", "자세히: /명령어팩목록 자세히");
  lines.push("", "제거: /명령어팩제거 pk.004 또는 /명령어팩제거 game-chance");
  return lines.join("\n");
}

function commandPackCatalogText() {
  const packs = visibleCommandPacks();
  const featured = ["ops-core", "game-chance", "rpg-adventure", "pet-raising", "admin-ops"]
    .map((id) => packs.find((pack) => pack.id === id))
    .filter(Boolean)
    .map((pack) => `${commandPackInstallCode(pack)} ${pack.title}`);
  return [
    "사용 가능한 명령어팩",
    `추천: ${featured.slice(0, 2).join(" · ")}`,
    `게임/RPG: ${featured.slice(1, 4).join(" · ")}`,
    `운영: ${featured[0]} · ${featured[4] || "관리자팩"}`,
    `전체 ${packs.length}개 · 상세: /명령어팩 pk.001`,
    "설치: /명령어설치 pk.001 · 제거: /명령어팩제거 pk.001"
  ].join("\n");
}

function commandPackDetailText(pack, roomState = null) {
  const detail = publicCommandPack(pack, roomState?.settings?.commandPacks || {});
  const commands = detail.commandsDetailed.map((item) => item.command);
  const commandPreview = `${commands.slice(0, 10).join(", ")}${commands.length > 10 ? ` 외 ${commands.length - 10}개` : ""}`;
  return [
    `${detail.title}`,
    detail.description,
    `팩 코드: ${detail.installCode || detail.id} · 포함 명령어: ${detail.commandCount}개`,
    `포함 명령어: ${commandPreview}`,
    `도움말: ${detail.helpPath || "/command-store"}`,
    `설치: ${detail.installCommand || "/명령어설치 코드"}`,
    `제거: ${detail.removeCommand || "/명령어팩제거 코드"}`
  ].join("\n");
}

function commandPackInfoCommand(roomState, parsed) {
  const query = normalizeText(parsed.args?.[0]);
  if (!query) return commandPackCatalogText();
  const pack = commandPackByCodeOrAlias(query);
  if (!pack || pack.hidden) {
    return [
      "찾을 수 없는 명령어팩입니다.",
      "",
      "사용 가능한 명령어팩",
      ...visibleCommandPacks().map((item) => `- ${commandPackInstallCode(item)} ${item.title}`),
      "",
      "예: /명령어팩 pk.001"
    ].join("\n");
  }
  return commandPackDetailText(pack, roomState);
}

function commandPackFromRemoveArg(value = "") {
  const key = normalizeText(value);
  if (!key) return null;
  return commandPackByInstallCode(key)
    || commandPackById(key)
    || visibleCommandPacks().find((pack) => key === pack.title)
    || null;
}

function commandPackRemoveCommand(roomState, sender, parsed) {
  const denied = requireAdmin(roomState, sender);
  if (denied) return denied;
  const pack = commandPackFromRemoveArg(parsed.args?.[0]);
  if (!pack || pack.slot !== "pack") return "형식: /명령어팩제거 pk.004 또는 /명령어팩제거 game-chance";
  const current = normalizeCommandPackState(roomState.settings?.commandPacks || {});
  if (!current.installedPackIds.includes(pack.id)) return `${pack.title}은 현재 장착되어 있지 않습니다.`;
  const result = applyCommandPacksToRoom(roomState, { nickname: sender }, { commandPackId: pack.id, action: "remove" });
  if (!result.ok) return `명령어팩 제거 실패: ${result.error || "unknown_error"}`;
  const remainingPacks = activeCommandPacks(roomState).filter((item) => !item.hidden);
  const lines = [
    "명령어팩 제거 완료",
    `- 제거 팩 : ${commandPackInstallCode(pack) || pack.id} ${pack.title}`,
    `- 남은 팩 : ${remainingPacks.length ? remainingPacks.map((item) => item.title).join(", ") : "없음"}`
  ];
  lines.push(`- 제거 명령어 : ${result.removedCommands.length ? result.removedCommands.slice(0, 12).join(", ") : "없음"}`);
  lines.push(`- 보존 명령어 : ${result.keptCommands.length ? result.keptCommands.slice(0, 12).join(", ") : "없음"}`);
  lines.push("- 보존 기준 : 다른 팩 또는 직접 추가 명령어와 겹치면 유지");
  return lines.join("\n");
}

function gameHelpTopicByInput(value = "") {
  const key = normalizeText(value).toLowerCase();
  if (!key) return null;
  return Object.entries(GAME_PACK_HELP_TOPICS).find(([slug, topic]) => (
    slug === key
    || topic.aliases.some((alias) => alias.toLowerCase() === key)
    || topic.packIds.includes(key)
  ))?.[0] || null;
}

function gamePackHelpPayload(topicKey = "") {
  const slug = gameHelpTopicByInput(topicKey);
  if (!topicKey) {
    return {
      ok: true,
      version: APP_VERSION,
      topics: Object.entries(GAME_PACK_HELP_TOPICS).map(([key, topic]) => ({
        key,
        title: topic.title,
        path: topic.path,
        packIds: topic.packIds,
        installCommands: topic.packIds.map((id) => installCommandForPack(commandPackById(id))).filter(Boolean)
      }))
    };
  }
  if (!slug) return { ok: false, status: 404, error: "help_topic_not_found", topics: gamePackHelpPayload().topics };
  const topic = GAME_PACK_HELP_TOPICS[slug];
  const packs = topic.packIds.map((id) => commandPackById(id)).filter(Boolean).map((pack) => publicCommandPack(pack));
  return {
    ok: true,
    version: APP_VERSION,
    key: slug,
    title: topic.title,
    path: topic.path,
    intro: topic.intro,
    packs,
    commands: packs.flatMap((pack) => pack.commandsDetailed),
    examples: topic.examples,
    firstSteps: topic.firstSteps,
    adminSetup: topic.adminSetup,
    conditions: ["방 등록과 유효한 라이선스가 필요합니다.", "게임형 팩은 /기능켜기 게임 상태에서 실행됩니다.", "관리 명령어는 방 관리자만 사용할 수 있습니다."],
    errors: ["미설치: /명령어설치 코드로 팩을 장착합니다.", "기능 꺼짐: /기능켜기 게임 또는 관리 콘솔을 확인합니다.", "데이터 없음: 먼저 입양/탐험/포획 같은 시작 명령어를 실행합니다.", "일시 오류: 잠시 후 재시도하고 반복되면 운영자에게 문의합니다."],
    cancel: "커스텀 명령어는 /명령어설치목록의 삭제 코드로 /설치취소 [삭제코드]를 실행하고, 팩은 /명령어팩제거 [팩코드]로 제거합니다.",
    related: topic.related.map((id) => commandPackById(id)).filter(Boolean).map((pack) => ({ id: pack.id, title: pack.title, code: commandPackInstallCode(pack), path: helpPathForPack(pack) }))
  };
}

function gamePackHelpText(topicKey = "") {
  const payload = gamePackHelpPayload(topicKey);
  if (!topicKey) {
    return [
      "게임팩 도움말",
      "",
      ...payload.topics.map((topic) => `- ${topic.key}: ${topic.title} (${topic.path})`),
      "",
      "상세: /게임팩도움말 pet 또는 /도움말 RPG"
    ].join("\n");
  }
  if (!payload.ok) {
    return [
      "찾을 수 없는 게임팩입니다.",
      "",
      "사용 가능한 게임팩",
      ...payload.topics.map((topic) => `- ${topic.key}: ${topic.title}`),
      "",
      "예: /게임팩도움말 pet"
    ].join("\n");
  }
  const installCommands = payload.packs.map((pack) => pack.installCommand).filter(Boolean);
  return [
    `${payload.title}`,
    "",
    payload.intro,
    "",
    `도움말: ${payload.path}`,
    `설치: ${installCommands.join(", ") || "/명령어팩"}`,
    "",
    "대표 명령어",
    ...payload.commands.slice(0, 8).map((item) => `- ${item.command} - ${item.description}`),
    "",
    "처음 순서",
    ...payload.firstSteps.map((step) => `- ${step}`)
  ].join("\n");
}

function buyerCustomCommandsForAccount(state, account = {}, body = {}) {
  const application = approvedApplicationForInstall(state, account, body);
  if (!application) return { ok: false, status: 404, error: "approved_room_not_found" };
  const roomState = ensureRoom(state, application.roomName);
  return {
    ok: true,
    version: APP_VERSION,
    room: applicationRoomPayload(state, account, application),
    commands: customCommandDeleteItems(roomState).map((item) => ({
      trigger: item.trigger,
      response: item.response,
      updatedAt: item.updatedAt,
      updatedBy: item.updatedBy,
      sourceTemplateId: item.sourceTemplateId || "",
      sourceTemplateKind: item.sourceTemplateKind || "",
      sourcePackId: item.sourcePackId || "",
      sourcePackTitle: item.sourcePackId ? commandPackById(item.sourcePackId)?.title || "" : "",
      sourcePackSlot: item.sourcePackSlot || "",
      sourcePackVersion: item.sourcePackVersion || 0,
      proxyCommand: item.proxyCommand || "",
      installCode: item.installCode || "",
      deleteCode: item.deleteCode || "",
      deleteCommand: item.deleteCommand || ""
    }))
  };
}

function saveBuyerCustomCommand(state, account = {}, body = {}) {
  const application = approvedApplicationForInstall(state, account, body);
  if (!application) return { ok: false, status: 404, error: "approved_room_not_found" };
  const trigger = normalizeCustomCommandTrigger(body.trigger || body.command || body.name);
  const response = normalizeCustomCommandResponse(body.response || body.reply || body.message);
  if (!trigger) return { ok: false, status: 400, error: "invalid_command_trigger" };
  if (!response) return { ok: false, status: 400, error: "invalid_command_response" };
  if (RESERVED_CUSTOM_COMMANDS.has(trigger)) return { ok: false, status: 409, error: "reserved_command" };

  const roomState = ensureRoom(state, application.roomName);
  const commands = customCommands(roomState);
  const existingIndex = commands.findIndex((item) => item.trigger === trigger);
  if (existingIndex < 0 && commands.length >= CUSTOM_COMMAND_LIMIT) {
    return { ok: false, status: 400, error: "custom_command_limit" };
  }

  const item = {
    trigger,
    response,
    updatedAt: nowIso(),
    updatedBy: account.email || account.nickname || "buyer_console"
  };
  if (existingIndex >= 0) commands[existingIndex] = item;
  else commands.push(item);
  roomState.settings.customCommands = normalizeCustomCommands(commands);
  recordRoomEvent(roomState, {
    type: existingIndex >= 0 ? "buyer_custom_command_updated" : "buyer_custom_command_created",
    trigger,
    by: item.updatedBy
  });
  return {
    ok: true,
    version: APP_VERSION,
    room: applicationRoomPayload(state, account, application),
    command: item,
    commands: customCommands(roomState)
  };
}

function deleteBuyerCustomCommand(state, account = {}, body = {}) {
  const application = approvedApplicationForInstall(state, account, body);
  if (!application) return { ok: false, status: 404, error: "approved_room_not_found" };
  const trigger = normalizeCustomCommandTrigger(body.trigger || body.command);
  if (!trigger) return { ok: false, status: 400, error: "invalid_command_trigger" };
  const roomState = ensureRoom(state, application.roomName);
  const before = customCommands(roomState).length;
  roomState.settings.customCommands = customCommands(roomState).filter((item) => item.trigger !== trigger);
  if (roomState.settings.customCommands.length === before) return { ok: false, status: 404, error: "custom_command_not_found" };
  recordRoomEvent(roomState, {
    type: "buyer_custom_command_deleted",
    trigger,
    by: account.email || account.nickname || "buyer_console"
  });
  return {
    ok: true,
    version: APP_VERSION,
    room: applicationRoomPayload(state, account, application),
    deleted: trigger,
    commands: customCommands(roomState)
  };
}

async function accountFromBuyerRequest(state, req, body = {}) {
  const tokenAccount = accountFromBuyerToken(state, tokenFromRequest(req, body));
  if (tokenAccount) return { ok: true, account: tokenAccount };
  const external = await externalAccountFromRequest(state, body);
  if (external) return external;
  const login = loginAccount(state, body);
  if (!login.ok) return login;
  return { ok: true, account: state.accounts[login.account.id] };
}

async function buyerGuideFromRequest(state, req, body = {}) {
  const auth = await accountFromBuyerRequest(state, req, body);
  if (!auth.ok) return auth;
  const account = auth.account;
  const guide = buyerGuidePayload(state, account);
  if (!guide.ok) return guide;
  return { ...guide, guideToken: buyerTokenForAccount(account) };
}

async function buyerConsoleFromRequest(state, req, body = {}) {
  const auth = await accountFromBuyerRequest(state, req, body);
  if (!auth.ok) return auth;
  return { ...buyerConsolePayload(state, auth.account), guideToken: buyerTokenForAccount(auth.account) };
}

function requestedApprovedApplications(state, account = {}, applicationIds = []) {
  const approved = approvedBuyerApplications(state, account);
  const requestedIds = new Set((Array.isArray(applicationIds) ? applicationIds : [])
    .map((id) => normalizeText(id))
    .filter(Boolean));
  if (!requestedIds.size) return approved;
  return approved.filter((application) => requestedIds.has(application.id));
}

function bridgeAccountRoomsPayload(state, account = {}, applicationIds = []) {
  const applications = requestedApprovedApplications(state, account, applicationIds);
  const requestedIds = new Set((Array.isArray(applicationIds) ? applicationIds : [])
    .map((id) => normalizeText(id))
    .filter(Boolean));
  const roomsByApplication = new Map();
  const inactiveRooms = [];
  for (const application of applications) {
    const roomState = ensureRoom(state, application.roomName);
    const subscription = updateSubscriptionStatus(roomState);
    if (subscription.status === "expired") {
      inactiveRooms.push({
        applicationId: application.id || "",
        roomName: application.roomName || "",
        reason: "subscription_expired",
        statusLabel: subscription.statusLabel || "구독 만료",
        expiresAt: subscription.expiresAt || ""
      });
      continue;
    }
    for (const room of bridgeConnectRoomsPayload(state, account, application)) {
      if (!room.applicationId || roomsByApplication.has(room.applicationId)) continue;
      roomsByApplication.set(room.applicationId, room);
    }
  }
  const approvedIds = new Set(approvedBuyerApplications(state, account).map((application) => application.id));
  for (const requestedId of requestedIds) {
    if (!approvedIds.has(requestedId)) {
      inactiveRooms.push({
        applicationId: requestedId,
        roomName: "",
        reason: "not_approved_or_paid",
        statusLabel: "승인/결제 완료 필요",
        expiresAt: ""
      });
    }
  }
  const rooms = [...roomsByApplication.values()];
  return {
    ok: true,
    version: APP_VERSION,
    rooms,
    inactiveRooms,
    summary: {
      requested: requestedIds.size || applications.length,
      approved: applications.length,
      connected: rooms.length,
      inactive: inactiveRooms.length
    },
    guideToken: buyerTokenForAccount(account)
  };
}

async function bridgeAutoConnectFromRequest(state, req, body = {}) {
  const auth = await accountFromBuyerRequest(state, req, body);
  if (!auth.ok) return auth;
  return bridgeAccountRoomsPayload(state, auth.account, body.applicationIds);
}

async function bridgeAccountRoomSyncFromRequest(state, req, body = {}) {
  const auth = await accountFromBuyerRequest(state, req, body);
  if (!auth.ok) return auth;
  return bridgeAccountRoomsPayload(state, auth.account, body.applicationIds);
}

async function loginKakaoFromRequest(state, body = {}) {
  const kakao = await kakaoUserFromAccessToken(body.kakaoAccessToken || body.accessToken);
  if (!kakao.ok) return kakao;
  const account = findAccountByExternalUser(state, "kakao", kakao.user.id)
    || (kakao.user.email ? findAccountByEmail(state, kakao.user.email) : null);
  if (!account) {
    return {
      ok: false,
      status: 404,
      error: "kakao_account_not_linked",
      message: "이메일 로그인 후 계정 화면에서 카카오 계정을 연결해 주세요."
    };
  }
  linkExternalAccount(account, kakao.user);
  return loginPayloadForAccount(state, account);
}

async function linkKakaoAccountFromRequest(state, req, body = {}) {
  const auth = await accountFromBuyerRequest(state, req, body);
  if (!auth.ok) return auth;
  const kakao = await kakaoUserFromAccessToken(body.kakaoAccessToken || body.accessToken);
  if (!kakao.ok) return kakao;
  const alreadyLinked = findAccountByExternalUser(state, "kakao", kakao.user.id);
  if (alreadyLinked && alreadyLinked.id !== auth.account.id) {
    return { ok: false, status: 409, error: "kakao_account_already_linked" };
  }
  linkExternalAccount(auth.account, kakao.user);
  return {
    ...loginPayloadForAccount(state, auth.account),
    linkedProvider: "kakao"
  };
}

function validateProfileNickname(payload = {}) {
  const nickname = compactSpaces(payload.nickname || payload.displayName || payload.name || "");
  if (nickname.length < 2 || nickname.length > 30 || /[\u0000-\u001f\u007f]/.test(nickname)) {
    return { ok: false, status: 400, error: "nickname_invalid" };
  }
  return { ok: true, nickname };
}

async function buyerAccountProfileFromRequest(state, req, body = {}) {
  const auth = await accountFromBuyerRequest(state, req, body);
  if (!auth.ok) return auth;
  const validation = validateProfileNickname(body);
  if (!validation.ok) return validation;
  const account = auth.account;
  account.nickname = validation.nickname;
  if (account.auth) account.auth.name = validation.nickname;
  account.updatedAt = nowIso();
  return {
    ok: true,
    version: APP_VERSION,
    account: publicAccountView(account),
    guideToken: buyerTokenForAccount(account)
  };
}

const APPLICATION_INQUIRY_TYPE_LABELS = Object.freeze({
  deposit_check: "입금 확인 요청",
  payment_check: "결제 확인 요청",
  other: "기타 문의"
});

function normalizeApplicationInquiryType(value = "") {
  const type = normalizeText(value);
  return Object.hasOwn(APPLICATION_INQUIRY_TYPE_LABELS, type) ? type : "other";
}

function publicApplicationInquiryView(state = {}, inquiry = {}) {
  const application = state.applications?.[inquiry.applicationId] || {};
  const status = inquiry.status || "open";
  return {
    id: inquiry.id || "",
    applicationId: inquiry.applicationId || "",
    accountId: inquiry.accountId || "",
    roomName: inquiry.roomName || application.roomName || "",
    mainRoomName: inquiry.mainRoomName || publicLinkedApplicationSummary(state, state.applications?.[application.linkedApplicationId])?.roomName || "",
    type: inquiry.type || "other",
    typeLabel: APPLICATION_INQUIRY_TYPE_LABELS[inquiry.type] || APPLICATION_INQUIRY_TYPE_LABELS.other,
    message: inquiry.message || "",
    status,
    statusLabel: status === "resolved" ? "처리 완료" : status === "in_review" ? "확인중" : "접수",
    createdAt: inquiry.createdAt || "",
    updatedAt: inquiry.updatedAt || "",
    resolvedAt: inquiry.resolvedAt || "",
    resolvedBy: inquiry.resolvedBy || "",
    resolution: inquiry.resolution || "",
    application: publicApplicationView(application, state)
  };
}

function inquiryAccessFromToken(state = {}, application = {}, token = "") {
  const payload = verifyTokenPayload(token);
  if (payload?.kind !== "application-inquiry" || payload.app !== application.id || payload.sub !== application.accountId) {
    return { ok: false, status: 401, error: "invalid_inquiry_token" };
  }
  const access = application.inquiryAccess || {};
  if (!access.tokenHash || access.tokenHash !== signedTokenHash(token)) {
    return { ok: false, status: 401, error: "invalid_inquiry_token" };
  }
  if (access.usedAt) return { ok: false, status: 409, error: "inquiry_token_used" };
  if (Date.parse(access.expiresAt || "") <= Date.now()) {
    return { ok: false, status: 410, error: "inquiry_token_expired" };
  }
  return { ok: true, account: state.accounts?.[payload.sub], tokenAccess: access };
}

async function applicationInquiryAuthFromRequest(state, req, body = {}) {
  const applicationId = normalizeText(body.applicationId || body.appId);
  if (!applicationId) return { ok: false, status: 400, error: "application_id_required" };
  const application = state.applications?.[applicationId];
  if (!application) return { ok: false, status: 404, error: "application_not_found" };
  const inquiryAccessToken = normalizeText(body.inquiryAccessToken || body.inquiryToken);
  if (inquiryAccessToken) {
    const tokenAccess = inquiryAccessFromToken(state, application, inquiryAccessToken);
    if (!tokenAccess.ok) return tokenAccess;
    return { ok: true, application, account: tokenAccess.account || state.accounts?.[application.accountId] || {}, tokenAccess: tokenAccess.tokenAccess };
  }
  const auth = await accountFromBuyerRequest(state, req, body);
  if (!auth.ok) return auth;
  if (application.accountId !== auth.account.id) {
    return { ok: false, status: 403, error: "application_forbidden" };
  }
  return { ok: true, application, account: auth.account, tokenAccess: null };
}

async function createApplicationInquiryFromRequest(state, req, body = {}) {
  const auth = await applicationInquiryAuthFromRequest(state, req, body);
  if (!auth.ok) return auth;
  const message = previewText(body.message || body.memo || body.content || "", 1000);
  if (!message) return { ok: false, status: 400, error: "inquiry_message_required" };
  state.applicationInquiries ||= {};
  const application = auth.application;
  const mainRoom = publicLinkedApplicationSummary(state, state.applications?.[application.linkedApplicationId]);
  const now = nowIso();
  const inquiryId = generateEntityId("inq");
  const inquiry = {
    id: inquiryId,
    applicationId: application.id,
    accountId: application.accountId,
    roomName: application.roomName,
    mainRoomName: mainRoom?.roomName || "",
    type: normalizeApplicationInquiryType(body.type || body.kind),
    message,
    status: "open",
    createdAt: now,
    updatedAt: now,
    resolvedAt: "",
    resolvedBy: "",
    resolution: ""
  };
  state.applicationInquiries[inquiryId] = inquiry;
  if (auth.tokenAccess) auth.tokenAccess.usedAt = now;
  application.updatedAt = now;
  return {
    ok: true,
    version: APP_VERSION,
    inquiry: publicApplicationInquiryView(state, inquiry)
  };
}

function publicRoomTransferView(transfer = {}, options = {}) {
  const status = roomTransferStatus(transfer);
  return {
    id: transfer.id || "",
    applicationId: transfer.applicationId || "",
    roomName: transfer.roomName || "",
    status,
    statusLabel: ROOM_TRANSFER_STATUS_LABELS[status] || status,
    createdAt: transfer.createdAt || "",
    expiresAt: transfer.expiresAt || "",
    acceptedAt: transfer.acceptedAt || "",
    cancelledAt: transfer.cancelledAt || "",
    ...(options.code ? { code: options.code } : {})
  };
}

const ROOM_TRANSFER_STATUS_LABELS = Object.freeze({
  pending: "대기",
  accepted: "이관 완료",
  cancelled: "취소",
  expired: "만료"
});

function roomTransferStatus(transfer = {}) {
  if (transfer.status === "pending" && Date.parse(transfer.expiresAt || "") <= Date.now()) return "expired";
  return ["pending", "accepted", "cancelled", "expired"].includes(transfer.status) ? transfer.status : "pending";
}

function transferAccountView(account = {}) {
  if (!account) return { id: "", email: "", nickname: "" };
  return {
    id: account.id || "",
    email: account.email || "",
    nickname: account.nickname || account.auth?.name || "",
    authProvider: account.auth?.provider || "password"
  };
}

function publicBuyerRoomTransferView(state, transfer = {}, account = {}) {
  const direction = transfer.fromAccountId === account.id ? "sent" : "received";
  const otherAccount = direction === "sent"
    ? state.accounts?.[transfer.toAccountId]
    : state.accounts?.[transfer.fromAccountId];
  return {
    ...publicRoomTransferView(transfer),
    direction,
    counterpart: transferAccountView(otherAccount)
  };
}

function buyerRoomTransfersPayload(state, account = {}) {
  return Object.values(state.roomTransfers || {})
    .filter((transfer) => transfer.fromAccountId === account.id || transfer.toAccountId === account.id)
    .map((transfer) => publicBuyerRoomTransferView(state, transfer, account))
    .sort((left, right) => String(right.createdAt || "").localeCompare(String(left.createdAt || "")));
}

function publicAdminRoomTransferView(state, transfer = {}) {
  return {
    ...publicRoomTransferView(transfer),
    fromAccount: transferAccountView(state.accounts?.[transfer.fromAccountId]),
    toAccount: transferAccountView(state.accounts?.[transfer.toAccountId]),
    cancelReason: transfer.cancelReason || ""
  };
}

function adminTransfersPayload(state, options = {}) {
  const requestedStatus = normalizeText(options.status || "all");
  const status = ["pending", "accepted", "cancelled", "expired", "all"].includes(requestedStatus) ? requestedStatus : "all";
  const transfers = Object.values(state.roomTransfers || {})
    .map((transfer) => publicAdminRoomTransferView(state, transfer))
    .filter((transfer) => status === "all" || transfer.status === status)
    .sort((left, right) => String(right.createdAt || "").localeCompare(String(left.createdAt || "")));
  const allTransfers = Object.values(state.roomTransfers || {}).map((transfer) => publicRoomTransferView(transfer));
  return {
    ok: true,
    version: APP_VERSION,
    generatedAt: nowIso(),
    filter: { status },
    summary: {
      total: allTransfers.length,
      pending: allTransfers.filter((transfer) => transfer.status === "pending").length,
      accepted: allTransfers.filter((transfer) => transfer.status === "accepted").length,
      cancelled: allTransfers.filter((transfer) => transfer.status === "cancelled").length,
      expired: allTransfers.filter((transfer) => transfer.status === "expired").length,
      visible: transfers.length
    },
    transfers
  };
}

function generateRoomTransferCode(state) {
  state.roomTransfers ||= {};
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = String(randomBytes(4).readUInt32BE(0) % 1000000).padStart(6, "0");
    const codeHash = roomTransferCodeHash(code);
    const duplicate = Object.values(state.roomTransfers).some((transfer) => (
      transfer.codeHash === codeHash
      && transfer.status === "pending"
      && Date.parse(transfer.expiresAt || "") > Date.now()
    ));
    if (!duplicate) return { code, codeHash };
  }
  const fallback = String(Date.now() % 1000000).padStart(6, "0");
  return { code: fallback, codeHash: roomTransferCodeHash(fallback) };
}

function cancelPendingRoomTransfersForApplication(state, applicationId, reason = "superseded") {
  state.roomTransfers ||= {};
  const now = nowIso();
  for (const transfer of Object.values(state.roomTransfers)) {
    if (transfer.applicationId === applicationId && transfer.status === "pending") {
      transfer.status = "cancelled";
      transfer.cancelledAt = now;
      transfer.cancelReason = reason;
    }
  }
}

function roomTransferByCode(state, code) {
  const codeHash = roomTransferCodeHash(code);
  return Object.values(state.roomTransfers || {}).find((transfer) => transfer.codeHash === codeHash) || null;
}

async function buyerRoomTransferCreateFromRequest(state, req, body = {}) {
  const auth = await accountFromBuyerRequest(state, req, body);
  if (!auth.ok) return auth;
  const account = auth.account;
  const applicationId = normalizeText(body.applicationId || body.appId);
  const confirmRoomName = normalizeText(body.confirmRoomName || body.roomName || body.room);
  if (!applicationId) return { ok: false, status: 400, error: "application_id_required" };
  if (!confirmRoomName) return { ok: false, status: 400, error: "room_name_confirm_required" };
  const application = state.applications?.[applicationId];
  if (!application || application.accountId !== account.id) {
    return { ok: false, status: 404, error: "application_not_found" };
  }
  if (keyFor(application.roomName) !== keyFor(confirmRoomName)) {
    return { ok: false, status: 400, error: "room_name_mismatch" };
  }
  if (application.status !== "approved" || state.payments?.[application.paymentId]?.status !== "paid") {
    return { ok: false, status: 403, error: "transfer_room_not_approved" };
  }
  state.roomTransfers ||= {};
  cancelPendingRoomTransfersForApplication(state, application.id);
  const { code, codeHash } = generateRoomTransferCode(state);
  const transferId = generateEntityId("trf");
  const transfer = {
    id: transferId,
    applicationId: application.id,
    roomName: application.roomName,
    codeHash,
    status: "pending",
    fromAccountId: account.id,
    toAccountId: "",
    createdAt: nowIso(),
    expiresAt: new Date(Date.now() + ROOM_TRANSFER_CODE_TTL_MS).toISOString(),
    acceptedAt: "",
    cancelledAt: ""
  };
  state.roomTransfers[transferId] = transfer;
  return {
    ok: true,
    version: APP_VERSION,
    transfer: publicRoomTransferView(transfer, { code }),
    message: "이관 코드는 30분 동안 유효합니다. 받는 사람에게 6자리 코드만 전달하세요."
  };
}

async function buyerRoomTransferAcceptFromRequest(state, req, body = {}) {
  const auth = await accountFromBuyerRequest(state, req, body);
  if (!auth.ok) return auth;
  const receiver = auth.account;
  const code = normalizeText(body.code || body.transferCode).replace(/\D/g, "");
  if (!/^\d{6}$/.test(code)) return { ok: false, status: 400, error: "transfer_code_required" };
  const transfer = roomTransferByCode(state, code);
  if (!transfer || transfer.status === "cancelled") {
    return { ok: false, status: 404, error: "transfer_code_not_found" };
  }
  if (transfer.status === "accepted") {
    return { ok: false, status: 409, error: "transfer_code_used" };
  }
  if (Date.parse(transfer.expiresAt || "") <= Date.now()) {
    transfer.status = "expired";
    transfer.expiredAt = nowIso();
    return { ok: false, status: 410, error: "transfer_code_expired" };
  }
  if (!approvedBuyerApplications(state, receiver).length) {
    return {
      ok: false,
      status: 403,
      error: "receiver_approval_required",
      message: "서비스 신청과 입금승인이 완료된 계정만 받을 수 있습니다."
    };
  }
  if (transfer.fromAccountId === receiver.id) {
    return { ok: false, status: 400, error: "self_transfer_not_allowed" };
  }
  const application = state.applications?.[transfer.applicationId];
  const sender = state.accounts?.[transfer.fromAccountId];
  if (!application || !sender || application.accountId !== sender.id) {
    return { ok: false, status: 404, error: "transfer_target_not_found" };
  }
  if (application.status !== "approved" || state.payments?.[application.paymentId]?.status !== "paid") {
    return { ok: false, status: 403, error: "transfer_room_not_approved" };
  }
  const payment = state.payments?.[application.paymentId];
  sender.applicationIds = (sender.applicationIds || []).filter((id) => id !== application.id);
  receiver.applicationIds ||= [];
  addUnique(receiver.applicationIds, application.id);
  application.transferHistory ||= [];
  const acceptedAt = nowIso();
  application.transferHistory.push({
    transferId: transfer.id,
    fromAccountId: sender.id,
    toAccountId: receiver.id,
    at: acceptedAt,
    method: "buyer_code"
  });
  application.accountId = receiver.id;
  application.email = receiver.email || application.email || "";
  application.updatedAt = acceptedAt;
  if (payment) {
    payment.accountId = receiver.id;
    payment.updatedAt = acceptedAt;
  }
  sender.updatedAt = acceptedAt;
  receiver.updatedAt = acceptedAt;
  transfer.status = "accepted";
  transfer.toAccountId = receiver.id;
  transfer.acceptedAt = acceptedAt;
  return {
    ok: true,
    version: APP_VERSION,
    transfer: publicRoomTransferView(transfer),
    account: publicAccountView(receiver),
    room: applicationRoomPayload(state, receiver, application),
    guideToken: buyerTokenForAccount(receiver),
    message: "방 소유권 이관이 완료되었습니다."
  };
}

async function buyerRoomTransferCancelFromRequest(state, req, body = {}) {
  const auth = await accountFromBuyerRequest(state, req, body);
  if (!auth.ok) return auth;
  const transferId = normalizeText(body.transferId || body.id);
  const code = normalizeText(body.code || body.transferCode).replace(/\D/g, "");
  const transfer = transferId
    ? state.roomTransfers?.[transferId]
    : code
      ? roomTransferByCode(state, code)
      : null;
  if (!transfer || transfer.fromAccountId !== auth.account.id || transfer.status !== "pending") {
    return { ok: false, status: 404, error: "transfer_code_not_found" };
  }
  transfer.status = "cancelled";
  transfer.cancelledAt = nowIso();
  transfer.cancelReason = "sender_cancelled";
  return {
    ok: true,
    version: APP_VERSION,
    transfer: publicRoomTransferView(transfer)
  };
}

async function buyerCommandTemplateInstallFromRequest(state, req, body = {}) {
  const auth = await accountFromBuyerRequest(state, req, body);
  if (!auth.ok) return auth;
  const result = installCommandTemplateForBuyer(state, auth.account, body);
  if (!result.ok) return result;
  return { ...result, guideToken: buyerTokenForAccount(auth.account) };
}

async function buyerCommandPacksApplyFromRequest(state, req, body = {}) {
  const auth = await accountFromBuyerRequest(state, req, body);
  if (!auth.ok) return auth;
  const result = applyCommandPacksForBuyer(state, auth.account, body);
  if (!result.ok) return result;
  return { ...result, guideToken: buyerTokenForAccount(auth.account) };
}

async function buyerRoomCommandPacksFromRequest(state, req, body = {}) {
  const auth = await accountFromBuyerRequest(state, req, body);
  if (!auth.ok) return auth;
  const result = buyerRoomCommandPacksForAccount(state, auth.account, body);
  if (!result.ok) return result;
  return { ...result, guideToken: buyerTokenForAccount(auth.account) };
}

async function buyerCustomCommandsFromRequest(state, req, body = {}) {
  const auth = await accountFromBuyerRequest(state, req, body);
  if (!auth.ok) return auth;
  const result = buyerCustomCommandsForAccount(state, auth.account, body);
  if (!result.ok) return result;
  return { ...result, guideToken: buyerTokenForAccount(auth.account) };
}

async function buyerCustomCommandSaveFromRequest(state, req, body = {}) {
  const auth = await accountFromBuyerRequest(state, req, body);
  if (!auth.ok) return auth;
  const result = saveBuyerCustomCommand(state, auth.account, body);
  if (!result.ok) return result;
  return { ...result, guideToken: buyerTokenForAccount(auth.account) };
}

async function buyerCustomCommandDeleteFromRequest(state, req, body = {}) {
  const auth = await accountFromBuyerRequest(state, req, body);
  if (!auth.ok) return auth;
  const result = deleteBuyerCustomCommand(state, auth.account, body);
  if (!result.ok) return result;
  return { ...result, guideToken: buyerTokenForAccount(auth.account) };
}

async function buyerRoomCommandsFromRequest(state, req, body = {}) {
  const auth = await accountFromBuyerRequest(state, req, body);
  if (!auth.ok) return auth;
  const application = approvedApplicationForInstall(state, auth.account, body);
  if (!application) return { ok: false, status: 404, error: "approved_room_not_found" };
  const roomState = ensureRoom(state, application.roomName);
  return {
    ...buildRoomCommandCatalog(state, roomState, auth.account, {
      query: body.q || body.query || body.keyword,
      isAdminUser: false
    }),
    room: applicationRoomPayload(state, auth.account, application),
    guideToken: buyerTokenForAccount(auth.account)
  };
}

function approvedBaseApplicationForRoomMode(state, account = {}, body = {}) {
  const application = approvedApplicationForInstall(state, account, {
    applicationId: body.applicationId || body.baseApplicationId || body.appId,
    roomName: body.roomName || body.room
  });
  if (!application) return null;
  if (normalizeApplicationRoomPurpose(application.roomPurpose) === "game_room") return null;
  return application;
}

async function buyerRoomModeSettingsFromRequest(state, req, body = {}) {
  const auth = await accountFromBuyerRequest(state, req, body);
  if (!auth.ok) return auth;
  const forbiddenFields = ["licenseKey", "licenseStatus", "subscriptionExpiresAt", "subscriptionStatus", "monthlyPriceKrw", "paymentStatus", "roomAdmins", "admins", "features", "gameSettings", "customCommands", "roomRole"];
  const forbiddenField = forbiddenFields.find((key) => Object.hasOwn(body, key));
  if (forbiddenField) return { ok: false, status: 403, error: "buyer_field_not_allowed", field: forbiddenField };
  const baseApplication = approvedBaseApplicationForRoomMode(state, auth.account, body);
  if (!baseApplication) return { ok: false, status: 404, error: "approved_base_room_not_found" };
  const linkedGameApplications = gameRoomApplicationsForBase(state, auth.account, baseApplication)
    .filter((application) => application.status === "approved" && state.payments?.[application.paymentId]?.status === "paid");
  if (!linkedGameApplications.length) return { ok: false, status: 409, error: "game_room_not_connected" };

  const baseRoomState = ensureRoom(state, baseApplication.roomName);
  const savedModeSplit = applyRoomModeSplit(
    state,
    baseRoomState,
    baseApplication,
    linkedGameApplications,
    body,
    auth.account.email || auth.account.nickname || "buyer_console"
  );

  return {
    ...buyerConsolePayload(state, auth.account),
    savedSettings: {
      applicationId: baseApplication.id,
      modeSplit: savedModeSplit,
      roomStatusSnapshot: roomStatusSnapshot(state, baseRoomState, { application: baseApplication, account: auth.account })
    },
    guideToken: buyerTokenForAccount(auth.account)
  };
}

async function buyerRoomFeatureSettingsFromRequest(state, req, body = {}) {
  const auth = await accountFromBuyerRequest(state, req, body);
  if (!auth.ok) return auth;
  const forbiddenFields = ["licenseKey", "licenseStatus", "subscriptionExpiresAt", "subscriptionStatus", "monthlyPriceKrw", "paymentStatus", "roomAdmins", "admins", "gameSettings", "customCommands", "roomRole", "modeSplit"];
  const forbiddenField = forbiddenFields.find((key) => Object.hasOwn(body, key));
  if (forbiddenField) return { ok: false, status: 403, error: "buyer_field_not_allowed", field: forbiddenField };
  const application = approvedApplicationForInstall(state, auth.account, body);
  if (!application) return { ok: false, status: 404, error: "approved_room_not_found" };

  const roomState = ensureRoom(state, application.roomName);
  roomState.settings ||= {};
  applyFeatureSettingsFromPayload(roomState, body);
  const features = roomFeatures(roomState);
  const updatedBy = auth.account.email || auth.account.nickname || "buyer_console";
  recordSettingsHistory(roomState, {
    type: "buyer_feature_settings_saved",
    by: updatedBy,
    changedFields: ["features"],
    summary: "구매자 앱 방 기능 설정 저장"
  });
  recordRoomEvent(roomState, {
    type: "buyer_feature_settings_saved",
    by: updatedBy,
    enabledFeatures: Object.entries(features).filter(([, enabled]) => enabled).map(([key]) => key),
    disabledFeatures: Object.entries(features).filter(([, enabled]) => !enabled).map(([key]) => key)
  });

  return {
    ...buyerConsolePayload(state, auth.account),
    savedSettings: {
      applicationId: application.id,
      features,
      roomStatusSnapshot: roomStatusSnapshot(state, roomState, { application, account: auth.account })
    },
    guideToken: buyerTokenForAccount(auth.account)
  };
}

function buyerApplicationForGameLink(state, account = {}, id = "") {
  const applicationId = normalizeText(id);
  if (!applicationId) return { ok: false, status: 400, error: "application_id_required" };
  const application = state.applications?.[applicationId];
  if (!application) return { ok: false, status: 404, error: "application_not_found" };
  if (application.accountId !== account.id || !(account.applicationIds || []).includes(application.id)) {
    return { ok: false, status: 403, error: "application_forbidden" };
  }
  return { ok: true, application };
}

function linkApprovedRoomAsGameRoom(state, account = {}, body = {}, options = {}) {
  const baseId = normalizeText(body.baseApplicationId || body.applicationId || body.baseAppId);
  const gameId = normalizeText(body.gameApplicationId || body.gameRoomApplicationId || body.linkApplicationId);
  if (!baseId || !gameId) return { ok: false, status: 400, error: "application_id_required" };
  if (baseId === gameId) return { ok: false, status: 400, error: "same_application" };

  const baseResult = buyerApplicationForGameLink(state, account, baseId);
  if (!baseResult.ok) return baseResult;
  const gameResult = buyerApplicationForGameLink(state, account, gameId);
  if (!gameResult.ok) return gameResult;
  const baseApplication = baseResult.application;
  const gameApplication = gameResult.application;

  if (normalizeApplicationRoomPurpose(baseApplication.roomPurpose) === "game_room") {
    return { ok: false, status: 400, error: "base_room_invalid" };
  }
  if (normalizeApplicationRoomPurpose(gameApplication.roomPurpose) === "game_room") {
    return { ok: false, status: 409, error: "game_room_already_linked" };
  }
  if (!applicationApprovedAndPaid(state, baseApplication)) {
    return { ok: false, status: 403, error: "base_room_approval_required" };
  }
  if (!applicationApprovedAndPaid(state, gameApplication)) {
    return { ok: false, status: 403, error: "game_room_approval_required" };
  }
  const linkedGameApplications = gameRoomApplicationsForBase(state, account, baseApplication)
    .filter(applicationActiveForBilling);
  if (linkedGameApplications.length) {
    return { ok: false, status: 409, error: "game_room_already_exists" };
  }

  const updatedAt = nowIso();
  gameApplication.roomPurpose = "game_room";
  gameApplication.linkedApplicationId = baseApplication.id;
  gameApplication.plan ||= {};
  gameApplication.plan.type = "game_room";
  gameApplication.plan.monthlyPriceKrw = Number(gameApplication.plan.monthlyPriceKrw || ADDITIONAL_ROOM_PRICE_KRW);
  gameApplication.updatedAt = updatedAt;
  baseApplication.updatedAt = updatedAt;

  const gameRoomState = applyApprovedRoomPurposeSettings(state, gameApplication);
  recordRoomEvent(gameRoomState, {
    type: options.eventType || "buyer_game_room_linked",
    baseRoom: baseApplication.roomName,
    by: options.by || account.email || account.nickname || "buyer_console"
  });

  return {
    ok: true,
    version: APP_VERSION,
    application: publicApplicationView(gameApplication, state),
    room: applicationRoomPayload(state, account, gameApplication),
    ...buyerConsolePayload(state, account)
  };
}

async function buyerGameRoomLinkFromRequest(state, req, body = {}) {
  const auth = await accountFromBuyerRequest(state, req, body);
  if (!auth.ok) return auth;
  const result = linkApprovedRoomAsGameRoom(state, auth.account, body);
  if (!result.ok) return result;
  return { ...result, guideToken: buyerTokenForAccount(auth.account) };
}

function roomStateFromAdminRequest(state, body = {}) {
  const roomName = normalizeText(body.room || body.roomName || body.name);
  const requestedRoomId = normalizeText(body.roomId);
  if (roomName) {
    const direct = state.rooms?.[roomKey(roomName)];
    if (direct) return direct;
  }
  if (requestedRoomId) {
    return Object.values(state.rooms || {}).find((roomState) => (roomState.settings?.roomIds || []).includes(requestedRoomId)) || null;
  }
  return null;
}

function bridgeConnectFromRequest(state, body = {}) {
  const tokenPayload = verifyTokenPayload(normalizeText(body.code || body.connectCode || body.bridgeConnectCode || body.token));
  if (tokenPayload?.kind !== "bridge-connect" || !tokenPayload.sub || !tokenPayload.app) {
    return { ok: false, status: 401, error: "invalid_connect_code" };
  }
  const account = state.accounts?.[tokenPayload.sub];
  const application = state.applications?.[tokenPayload.app];
  if (!account || !application || application.accountId !== account.id) {
    return { ok: false, status: 404, error: "connect_target_not_found" };
  }
  if (application.status !== "approved" || state.payments?.[application.paymentId]?.status !== "paid") {
    return { ok: false, status: 403, error: "buyer_approval_required" };
  }
  const roomState = ensureRoom(state, application.roomName);
  const subscription = updateSubscriptionStatus(roomState);
  if (subscription.status === "expired") {
    const issue = incidentMessage("SUBSCRIPTION_EXPIRED");
    return {
      ok: false,
      status: 403,
      error: "subscription_expired",
      issue,
      message: issue.message,
      subscription: {
        status: subscription.status,
        statusLabel: subscription.statusLabel,
        expiresAt: subscription.expiresAt || "",
        remainingDays: subscription.remainingDays,
        notice: subscription.notice
      }
    };
  }
  const rooms = bridgeConnectRoomsPayload(state, account, application);
  const bridgeDiagnostics = bridgeConnectDiagnosticsPayload(state, account, application, rooms);
  return {
    ok: true,
    version: APP_VERSION,
    room: applicationRoomPayload(state, account, application),
    rooms: rooms.length ? rooms : [applicationRoomPayload(state, account, application)],
    bridgeDiagnostics
  };
}

function bridgeRoomProfileSyncFromRequest(state, body = {}) {
  const requestedRooms = Array.isArray(body.rooms)
    ? body.rooms
    : Array.isArray(body.profiles)
      ? body.profiles
      : [];
  const requestedProfiles = requestedRooms
    .map((item) => ({
      roomName: normalizeText(item.roomName || item.name || item.room),
      roomId: normalizeText(item.roomId || item.id),
      licenseKey: normalizeLicenseKey(item.licenseKey || item.roomLicenseKey || item.bridgeLicenseKey)
    }))
    .filter((item) => item.roomName || item.roomId || item.licenseKey);

  if (!requestedProfiles.length) {
    return { ok: false, status: 400, error: "room_profiles_required" };
  }

  const applications = Object.values(state.applications || {})
    .filter((application) => applicationApprovedAndPaid(state, application));
  const matchedApplications = [];
  const addMatchedApplication = (application) => {
    if (!application?.id || matchedApplications.some((item) => item.id === application.id)) return;
    matchedApplications.push(application);
  };

  for (const profile of requestedProfiles) {
    for (const application of applications) {
      const account = state.accounts?.[application.accountId] || {};
      const roomPayload = applicationRoomPayload(state, account, application);
      const roomIds = [roomPayload.roomId, application.roomId, ...(roomPayload.roomStatusSnapshot?.bridge?.roomIds || [])]
        .map((value) => normalizeText(value))
        .filter(Boolean);
      const roomNames = [roomPayload.roomName, application.roomName]
        .map((value) => keyFor(value))
        .filter(Boolean);
      const licenseMatches = Boolean(profile.licenseKey && normalizeLicenseKey(roomPayload.licenseKey) === profile.licenseKey);
      const roomIdMatches = Boolean(profile.roomId && roomIds.includes(profile.roomId));
      const roomNameMatches = Boolean(profile.roomName && roomNames.includes(keyFor(profile.roomName)));
      if (licenseMatches && (roomIdMatches || roomNameMatches)) {
        addMatchedApplication(application);
      }
    }
  }

  if (!matchedApplications.length) {
    return {
      ok: false,
      status: 403,
      error: "valid_room_profile_required",
      summary: {
        requestedRoomCount: requestedProfiles.length,
        syncedRoomCount: 0
      }
    };
  }

  const syncedApplications = [];
  const addSyncedApplication = (application) => {
    if (!application?.id || syncedApplications.some((item) => item.id === application.id)) return;
    syncedApplications.push(application);
  };
  for (const application of matchedApplications) {
    const account = state.accounts?.[application.accountId];
    if (!account) continue;
    for (const item of bridgeConnectApplicationsForApplication(state, account, application)) {
      addSyncedApplication(item);
    }
  }

  const rooms = syncedApplications
    .map((application) => applicationRoomPayload(state, state.accounts?.[application.accountId] || {}, application));

  return {
    ok: true,
    version: APP_VERSION,
    guideUrls: buyerGuideUrlsPayload(),
    summary: {
      requestedRoomCount: requestedProfiles.length,
      matchedRoomCount: matchedApplications.length,
      syncedRoomCount: rooms.length,
      generatedAt: nowIso()
    },
    rooms,
    diagnostics: matchedApplications.map((application) => {
      const account = state.accounts?.[application.accountId] || {};
      return bridgeConnectDiagnosticsPayload(state, account, application);
    })
  };
}

async function handlePublicAccountApi(req, url) {
  if (req.method === "GET" && url.pathname === "/api/auth/config") {
    return { status: 200, body: authConfigPayload() };
  }

  if (req.method === "GET" && url.pathname === "/api/auth/social/start") {
    const provider = normalizeText(url.searchParams.get("provider"));
    const startUrl = supabaseSocialStartUrl(provider, normalizeText(url.searchParams.get("redirectTo") || url.searchParams.get("redirect_to")));
    if (!startUrl) return { status: 503, body: { ok: false, error: "social_provider_not_configured", provider } };
    return { status: 200, body: { ok: true, provider, url: startUrl } };
  }

  if (req.method === "GET" && url.pathname === "/api/command-templates") {
    return { status: 200, body: commandTemplateCatalogPayload() };
  }

  if (req.method === "GET" && url.pathname === "/api/command-packs") {
    return { status: 200, body: commandPackCatalogPayload() };
  }

  if (req.method === "GET" && (url.pathname === "/api/game-pack-help" || url.pathname.startsWith("/api/game-pack-help/"))) {
    const topic = url.pathname === "/api/game-pack-help" ? "" : decodeURIComponent(url.pathname.replace(/^\/api\/game-pack-help\/?/, ""));
    const result = gamePackHelpPayload(topic);
    return { status: result.status || 200, body: result };
  }

  if (req.method === "POST" && url.pathname === "/api/signup") {
    const body = await readBody(req);
    const state = await loadState();
    const result = await createSignupAccountFromRequest(state, body);
    if (!result.ok) return { status: result.status || 400, body: result };
    await saveState(state);
    return { status: 200, body: result };
  }

  if (req.method === "POST" && url.pathname === "/api/apply") {
    const body = await readBody(req);
    const state = await loadState();
    const result = await createSignupApplicationFromRequest(state, body);
    if (!result.ok) return { status: result.status || 400, body: result };
    await saveState(state);
    return { status: 200, body: result };
  }

  if (req.method === "POST" && url.pathname === "/api/login") {
    const body = await readBody(req);
    const state = await loadState();
    const result = await loginAccountFromRequest(state, body);
    if (!result.ok) return { status: result.status || 401, body: result };
    await saveState(state);
    return { status: 200, body: result };
  }

  if (req.method === "POST" && url.pathname === "/api/auth/login/start") {
    const body = await readBody(req);
    const state = await loadState();
    const result = await loginStartFromRequest(state, body);
    if (!result.ok) return { status: result.status || 401, body: result };
    await saveState(state);
    return { status: 200, body: result };
  }

  if (req.method === "POST" && url.pathname === "/api/auth/login/verify") {
    const body = await readBody(req);
    const state = await loadState();
    const result = await loginVerifyFromRequest(state, body);
    if (!result.ok) return { status: result.status || 401, body: result };
    await saveState(state);
    return { status: 200, body: result };
  }

  if (req.method === "POST" && url.pathname === "/api/auth/password-reset/request") {
    const body = await readBody(req);
    const result = await requestSupabasePasswordRecovery(body.email);
    if (!result.ok) return { status: result.status || 400, body: result };
    return { status: 200, body: result };
  }

  if (req.method === "POST" && url.pathname === "/api/login/kakao") {
    const body = await readBody(req);
    const state = await loadState();
    const result = await loginKakaoFromRequest(state, body);
    if (!result.ok) return { status: result.status || 401, body: result };
    await saveState(state);
    return { status: 200, body: result };
  }

  if (req.method === "POST" && url.pathname === "/api/buyer/guide") {
    const body = await readBody(req);
    const state = await loadState();
    const result = await buyerGuideFromRequest(state, req, body);
    if (!result.ok) return { status: result.status || 401, body: result };
    await saveState(state);
    return { status: 200, body: result };
  }

  if (req.method === "POST" && url.pathname === "/api/buyer/console") {
    const body = await readBody(req);
    const state = await loadState();
    const result = await buyerConsoleFromRequest(state, req, body);
    if (!result.ok) return { status: result.status || 401, body: result };
    await saveState(state);
    return { status: 200, body: result };
  }

  if (req.method === "GET" && url.pathname === "/api/buyer/search") {
    const state = await loadState();
    const result = await accountFromBuyerRequest(state, req, Object.fromEntries(url.searchParams.entries()));
    if (!result.ok) return { status: result.status || 401, body: result };
    return { status: 200, body: buyerSearchPayload(state, result.account, Object.fromEntries(url.searchParams.entries())) };
  }

  if (req.method === "POST" && url.pathname === "/api/buyer/account/profile") {
    const body = await readBody(req);
    const state = await loadState();
    const result = await buyerAccountProfileFromRequest(state, req, body);
    if (!result.ok) return { status: result.status || 401, body: result };
    await saveState(state);
    return { status: 200, body: result };
  }

  if (req.method === "POST" && url.pathname === "/api/buyer/account/link-kakao") {
    const body = await readBody(req);
    const state = await loadState();
    const result = await linkKakaoAccountFromRequest(state, req, body);
    if (!result.ok) return { status: result.status || 401, body: result };
    await saveState(state);
    return { status: 200, body: result };
  }

  if (req.method === "POST" && url.pathname === "/api/application-inquiries") {
    const body = await readBody(req);
    const state = await loadState();
    const result = await createApplicationInquiryFromRequest(state, req, body);
    if (!result.ok) return { status: result.status || 400, body: result };
    await saveState(state);
    return { status: 200, body: result };
  }

  if (req.method === "POST" && url.pathname === "/api/buyer/room-transfer/create") {
    const body = await readBody(req);
    const state = await loadState();
    const result = await buyerRoomTransferCreateFromRequest(state, req, body);
    await saveState(state);
    if (!result.ok) return { status: result.status || 400, body: result };
    return { status: 200, body: result };
  }

  if (req.method === "POST" && url.pathname === "/api/buyer/room-mode-settings") {
    const body = await readBody(req);
    const state = await loadState();
    const result = await buyerRoomModeSettingsFromRequest(state, req, body);
    if (!result.ok) return { status: result.status || 400, body: result };
    await saveState(state);
    return { status: 200, body: result };
  }

  if (req.method === "POST" && url.pathname === "/api/buyer/room-feature-settings") {
    const body = await readBody(req);
    const state = await loadState();
    const result = await buyerRoomFeatureSettingsFromRequest(state, req, body);
    if (!result.ok) return { status: result.status || 400, body: result };
    await saveState(state);
    return { status: 200, body: result };
  }

  if (req.method === "POST" && url.pathname === "/api/buyer/game-room-link") {
    const body = await readBody(req);
    const state = await loadState();
    const result = await buyerGameRoomLinkFromRequest(state, req, body);
    if (!result.ok) return { status: result.status || 400, body: result };
    await saveState(state);
    return { status: 200, body: result };
  }

  if (req.method === "POST" && url.pathname === "/api/buyer/restore-requests") {
    const body = await readBody(req);
    const state = await loadState();
    const result = await buyerRestoreRequestFromRequest(state, req, body);
    if (!result.ok) return { status: result.status || 400, body: result };
    await saveState(state);
    return { status: 200, body: result };
  }

  if (req.method === "POST" && url.pathname === "/api/buyer/room-transfer/accept") {
    const body = await readBody(req);
    const state = await loadState();
    const result = await buyerRoomTransferAcceptFromRequest(state, req, body);
    await saveState(state);
    if (!result.ok) return { status: result.status || 400, body: result };
    return { status: 200, body: result };
  }

  if (req.method === "POST" && url.pathname === "/api/buyer/room-transfer/cancel") {
    const body = await readBody(req);
    const state = await loadState();
    const result = await buyerRoomTransferCancelFromRequest(state, req, body);
    await saveState(state);
    if (!result.ok) return { status: result.status || 400, body: result };
    return { status: 200, body: result };
  }

  if (req.method === "POST" && url.pathname === "/api/buyer/command-templates/install") {
    const body = await readBody(req);
    const state = await loadState();
    const result = await buyerCommandTemplateInstallFromRequest(state, req, body);
    if (!result.ok) return { status: result.status || 401, body: result };
    await saveState(state);
    return { status: 200, body: result };
  }

  if (req.method === "POST" && url.pathname === "/api/buyer/command-packs/apply") {
    const body = await readBody(req);
    const state = await loadState();
    const result = await buyerCommandPacksApplyFromRequest(state, req, body);
    if (!result.ok) return { status: result.status || 401, body: result };
    await saveState(state);
    return { status: 200, body: result };
  }

  if (req.method === "POST" && url.pathname === "/api/buyer/room-command-packs") {
    const body = await readBody(req);
    const state = await loadState();
    const result = await buyerRoomCommandPacksFromRequest(state, req, body);
    if (!result.ok) return { status: result.status || 401, body: result };
    return { status: 200, body: result };
  }

  if (req.method === "POST" && url.pathname === "/api/buyer/custom-commands") {
    const body = await readBody(req);
    const state = await loadState();
    const result = await buyerCustomCommandsFromRequest(state, req, body);
    if (!result.ok) return { status: result.status || 401, body: result };
    return { status: 200, body: result };
  }

  if (req.method === "POST" && url.pathname === "/api/buyer/custom-commands/save") {
    const body = await readBody(req);
    const state = await loadState();
    const result = await buyerCustomCommandSaveFromRequest(state, req, body);
    if (!result.ok) return { status: result.status || 401, body: result };
    await saveState(state);
    return { status: 200, body: result };
  }

  if (req.method === "POST" && url.pathname === "/api/buyer/room-commands") {
    const body = await readBody(req);
    const state = await loadState();
    const result = await buyerRoomCommandsFromRequest(state, req, body);
    if (!result.ok) return { status: result.status || 401, body: result };
    return { status: 200, body: result };
  }

  if (req.method === "POST" && url.pathname === "/api/buyer/custom-commands/delete") {
    const body = await readBody(req);
    const state = await loadState();
    const result = await buyerCustomCommandDeleteFromRequest(state, req, body);
    if (!result.ok) return { status: result.status || 401, body: result };
    await saveState(state);
    return { status: 200, body: result };
  }

  if (req.method === "POST" && url.pathname === "/api/bridge/connect") {
    const body = await readBody(req);
    const state = await loadState();
    const result = bridgeConnectFromRequest(state, body);
    return { status: result.status || 200, body: result };
  }

  if (req.method === "POST" && url.pathname === "/api/bridge/auto-connect") {
    const body = await readBody(req);
    const state = await loadState();
    const result = await bridgeAutoConnectFromRequest(state, req, body);
    return { status: result.status || 200, body: result };
  }

  if (req.method === "POST" && url.pathname === "/api/bridge/account-room-sync") {
    const body = await readBody(req);
    const state = await loadState();
    const result = await bridgeAccountRoomSyncFromRequest(state, req, body);
    return { status: result.status || 200, body: result };
  }

  if (req.method === "POST" && url.pathname === "/api/bridge/room-profile-sync") {
    const body = await readBody(req);
    const state = await loadState();
    const result = bridgeRoomProfileSyncFromRequest(state, body);
    return { status: result.status || 200, body: result };
  }

  return null;
}

function adminApplicationsPayload(state) {
  const applications = Object.values(state.applications || {})
    .map((application) => publicApplicationView(application, state))
    .sort((left, right) => String(right.createdAt || "").localeCompare(String(left.createdAt || "")));
  const lifecycleSummary = lifecycleSummaryFromApplications(applications);
  return {
    ok: true,
    version: APP_VERSION,
    monthlyPriceKrw: MONTHLY_PRICE_KRW,
    additionalRoomPriceKrw: ADDITIONAL_ROOM_PRICE_KRW,
    summary: {
      applications: applications.length,
      pending: applications.filter((application) => application.status === "pending_payment").length,
      approved: applications.filter((application) => application.status === "approved").length,
      active: lifecycleSummary.active,
      paymentReviewNeeded: lifecycleSummary.paymentReviewNeeded,
      expiringSoon: lifecycleSummary.expiringSoon,
      expired: lifecycleSummary.expired,
      onHold: lifecycleSummary.onHold,
      archived: lifecycleSummary.archived
    },
    lifecycleSummary,
    applications
  };
}

function adminApplicationInquiriesPayload(state, options = {}) {
  const requestedStatus = normalizeText(options.status || "all");
  const status = ["open", "in_review", "resolved", "all"].includes(requestedStatus) ? requestedStatus : "all";
  const inquiries = Object.values(state.applicationInquiries || {})
    .map((inquiry) => publicApplicationInquiryView(state, inquiry))
    .filter((inquiry) => status === "all" || inquiry.status === status)
    .sort((left, right) => String(right.createdAt || "").localeCompare(String(left.createdAt || "")));
  const all = Object.values(state.applicationInquiries || {});
  return {
    ok: true,
    version: APP_VERSION,
    generatedAt: nowIso(),
    filter: { status },
    summary: {
      total: all.length,
      open: all.filter((inquiry) => inquiry.status !== "resolved").length,
      inReview: all.filter((inquiry) => inquiry.status === "in_review").length,
      resolved: all.filter((inquiry) => inquiry.status === "resolved").length,
      visible: inquiries.length
    },
    inquiries
  };
}

function adminResolveApplicationInquiry(state, payload = {}, resolvedBy = "admin_console") {
  const inquiryId = normalizeText(payload.inquiryId || payload.id);
  if (!inquiryId) return { ok: false, status: 400, error: "inquiry_id_required" };
  const inquiry = state.applicationInquiries?.[inquiryId];
  if (!inquiry) return { ok: false, status: 404, error: "inquiry_not_found" };
  const nextStatus = normalizeText(payload.status || "resolved");
  if (!["open", "in_review", "resolved"].includes(nextStatus)) {
    return { ok: false, status: 400, error: "invalid_inquiry_status" };
  }
  inquiry.status = nextStatus;
  inquiry.updatedAt = nowIso();
  if (nextStatus === "resolved") {
    inquiry.status = "resolved";
    inquiry.resolvedAt = inquiry.updatedAt;
    inquiry.resolvedBy = resolvedBy;
    inquiry.resolution = previewText(payload.resolution || payload.result || "처리 완료", 300);
  } else {
    inquiry.resolution = previewText(payload.resolution || payload.result || inquiry.resolution || "", 300);
  }
  return {
    ok: true,
    version: APP_VERSION,
    inquiry: publicApplicationInquiryView(state, inquiry)
  };
}

function publicAdminReportView(roomState = {}, report = {}) {
  return {
    roomName: roomState.name || "",
    roomId: roomState.settings?.roomIds?.[0] || "",
    id: report.id || "",
    status: report.status || "open",
    reporter: report.reporter || "",
    target: report.target || "",
    reason: report.reason || "",
    createdAt: report.createdAt || "",
    resolvedAt: report.resolvedAt || "",
    resolvedBy: report.resolvedBy || "",
    resolution: report.resolution || ""
  };
}

function adminReportsPayload(state, options = {}) {
  const requestedStatus = normalizeText(options.status || "open");
  const status = ["open", "resolved", "all"].includes(requestedStatus) ? requestedStatus : "open";
  const roomFilter = normalizeText(options.room || options.roomName);
  const reports = [];
  for (const roomState of Object.values(state.rooms || {})) {
    roomState.reports = normalizeReports(roomState.reports || []);
    if (roomFilter && keyFor(roomState.name) !== keyFor(roomFilter)) continue;
    for (const report of roomState.reports) {
      if (status === "open" && report.status === "resolved") continue;
      if (status === "resolved" && report.status !== "resolved") continue;
      reports.push(publicAdminReportView(roomState, report));
    }
  }
  reports.sort((left, right) => String(right.createdAt || "").localeCompare(String(left.createdAt || "")));
  const allReports = Object.values(state.rooms || {}).flatMap((roomState) => normalizeReports(roomState.reports || []));
  return {
    ok: true,
    version: APP_VERSION,
    generatedAt: nowIso(),
    filter: {
      status,
      roomName: roomFilter
    },
    summary: {
      total: allReports.length,
      open: allReports.filter((report) => report.status !== "resolved").length,
      resolved: allReports.filter((report) => report.status === "resolved").length,
      visible: reports.length
    },
    reports
  };
}

function adminResolveReport(state, payload = {}, resolvedBy = "admin_console") {
  const roomName = normalizeText(payload.roomName || payload.room || payload.name);
  const reportId = normalizeReportId(payload.reportId || payload.id);
  if (!roomName) return { ok: false, status: 400, error: "room_required" };
  if (!reportId) return { ok: false, status: 400, error: "report_id_required" };
  const roomState = state.rooms?.[roomKey(roomName)] || Object.values(state.rooms || {}).find((room) => keyFor(room.name) === keyFor(roomName));
  if (!roomState) return { ok: false, status: 404, error: "room_not_found" };
  roomState.reports = normalizeReports(roomState.reports || []);
  const report = roomState.reports.find((item) => item.id === reportId);
  if (!report) return { ok: false, status: 404, error: "report_not_found" };
  if (report.status !== "resolved") {
    report.status = "resolved";
    report.resolvedAt = nowIso();
    report.resolvedBy = resolvedBy;
    report.resolution = previewText(payload.resolution || payload.result || "처리 완료", 180);
    recordRoomEvent(roomState, { type: "report_resolved", reportId: report.id, by: resolvedBy });
  }
  return {
    ok: true,
    version: APP_VERSION,
    report: publicAdminReportView(roomState, report)
  };
}

function applyApprovedRoomPurposeSettings(state, application = {}) {
  const roomState = ensureRoom(state, application.roomName);
  const roomPurpose = normalizeApplicationRoomPurpose(application.roomPurpose);
  if (roomPurpose !== "game_room") return roomState;
  const baseApplication = state.applications?.[application.linkedApplicationId];
  if (!baseApplication) return roomState;
  const baseRoomState = ensureRoom(state, baseApplication.roomName);
  const baseKey = roomKey(baseRoomState.name);
  const gameKey = roomKey(roomState.name);
  baseRoomState.settings.roomRole = "general";
  baseRoomState.settings.features = normalizeFeatureSettings(baseRoomState.settings.features || {});
  baseRoomState.settings.features.games = true;
  baseRoomState.settings.linkedGameRoomKeys ||= [];
  addUnique(baseRoomState.settings.linkedGameRoomKeys, gameKey);
  roomState.settings.roomRole = "game";
  roomState.settings.canonicalRoomKey = baseKey;
  roomState.settings.canonicalRoomName = baseRoomState.name;
  roomState.settings.features = normalizeFeatureSettings(roomState.settings.features || {});
  roomState.settings.features.games = true;
  roomState.settings.features.points = true;
  roomState.settings.features.shop = true;
  roomState.settings.features.customCommands = false;
  applyRoomModeSplit(state, baseRoomState, baseApplication, [application], {
    modeSplit: {
      blockGamesInGeneralRoom: true,
      blockOpsInGameRoom: true,
      sharePointsAndInventory: true
    }
  }, "admin_console");
  return roomState;
}

function adminApproveApplication(state, payload = {}, approvedBy = "admin_console") {
  const applicationId = normalizeText(payload.applicationId || payload.id);
  if (!applicationId) return { ok: false, status: 400, error: "application_id_required" };
  const application = state.applications?.[applicationId];
  if (!application) return { ok: false, status: 404, error: "application_not_found" };
  const months = Math.min(24, Math.max(1, Math.floor(Number(payload.months || 1) || 1)));
  const expiresAt = addDaysIso(new Date(), months * DEFAULT_SUBSCRIPTION_DAYS);
  const result = adminUpsertRoom(state, {
    room: application.roomName,
    roomId: application.roomId,
    roomLink: application.roomLink,
    joinPhrase: payload.joinPhrase || DEFAULT_JOIN_PHRASE,
    roomAdmins: [application.adminName],
    monthlyPriceKrw: Number(application.plan?.monthlyPriceKrw || state.payments?.[application.paymentId]?.amountKrw || MONTHLY_PRICE_KRW),
    subscriptionExpiresAt: expiresAt,
    registered: true,
    enabled: true,
    features: {
      attendance: true,
      points: true,
      rankings: true,
      history: true,
      profiles: true,
      localJs: true,
      games: false,
      shop: true,
      customCommands: true
    }
  });
  if (!result.ok) return result;
  const payment = state.payments?.[application.paymentId];
  if (payment) {
    payment.status = "paid";
    payment.approvedAt = nowIso();
    payment.approvedBy = approvedBy;
    payment.amountKrw = Number(payload.amountKrw || payment.amountKrw || MONTHLY_PRICE_KRW);
    payment.updatedAt = nowIso();
  }
  application.status = "approved";
  application.approvedAt = nowIso();
  application.approvedBy = approvedBy;
  const approvedRoomState = applyApprovedRoomPurposeSettings(state, application);
  const approvedRoom = roomAdminView(approvedRoomState, state, { application });
  application.licenseKey = approvedRoom.licenseKey;
  application.roomId = approvedRoom.roomIds?.[0] || application.roomId;
  application.updatedAt = nowIso();
  return {
    ok: true,
    application: publicApplicationView(application, state),
    payment: publicPaymentView(payment),
    room: approvedRoom
  };
}

function adminNicknameMergeRoomState(state, payload = {}) {
  const roomName = normalizeText(payload.roomName || payload.room || payload.name);
  if (!roomName) return null;
  const physicalRoomState = state.rooms?.[roomKey(roomName)];
  if (!physicalRoomState) return null;
  return canonicalDataRoomState(state, physicalRoomState);
}

function nicknameVariantKey(value = "") {
  return keyFor(value)
    .replace(/[0-9０-９]+/g, "")
    .replace(/\s+/g, "")
    .replace(/(?:남|여|남자|여자)$/u, "");
}

function nicknameMergePersonSummary(roomState, key = "", fallbackName = "") {
  const person = key ? roomState.people?.[key] : null;
  const profile = key ? roomState.profiles?.[key] : null;
  const aliases = Object.entries(roomState.aliases || {})
    .filter(([, value]) => value === key)
    .map(([alias]) => alias);
  const normalized = person ? normalizePersonState(person) : null;
  const inventory = normalized?.inventory || {};
  const inventoryQuantity = Object.values(inventory).reduce((sum, quantity) => sum + Number(quantity || 0), 0);
  return {
    key,
    name: normalized?.currentName || profile?.name || stripKakaoSuffix(fallbackName) || key,
    exists: Boolean(person || profile),
    points: Number(normalized?.points || 0),
    level: Number(normalized?.level || 1),
    exp: Number(normalized?.exp || 0),
    attendanceCount: normalized?.attendance?.dates?.length || 0,
    chatTotal: normalized?.chats?.total || 0,
    inventoryItemTypes: Object.keys(inventory).length,
    inventoryQuantity,
    monsterCount: normalized?.monsters?.length || 0,
    hasPet: Boolean(normalized?.pet),
    aliases: uniqueNames([profile?.alias, ...(profile?.aliases || []), ...aliases])
  };
}

function aliasSummaryItem(roomState, key = "", fallbackName = "") {
  const summary = nicknameMergePersonSummary(roomState, key, fallbackName);
  const person = roomState.people?.[key] || null;
  const profile = roomState.profiles?.[key] || null;
  const activeMerges = (roomState.nicknameMergeHistory || [])
    .filter((item) => item.status !== "undone" && (item.targetKey === key || item.sourceKey === key));
  return {
    ...summary,
    displayName: displayNameForKey(roomState, key, summary.name),
    names: uniqueNames([summary.name, profile?.name, ...(person?.names || [])]).filter(Boolean),
    aliasCount: summary.aliases.length,
    mergedAliasCount: activeMerges.length,
    mergeStatus: activeMerges.length ? "merged" : "single"
  };
}

function aliasSummaryPayload(roomState, options = {}) {
  const limit = Math.max(1, Math.min(100, Number(options.limit || 20) || 20));
  const keys = new Set([
    ...Object.keys(roomState.people || {}),
    ...Object.keys(roomState.profiles || {})
  ]);
  const items = [...keys]
    .map((key) => aliasSummaryItem(roomState, key))
    .filter((item) => item.exists && !isReservedPersonName(item.name))
    .sort((left, right) => (
      right.aliasCount - left.aliasCount
      || right.mergedAliasCount - left.mergedAliasCount
      || String(left.name).localeCompare(String(right.name), "ko")
    ));
  return {
    totalProfiles: items.length,
    aliasCount: items.reduce((sum, item) => sum + item.aliasCount, 0),
    mergedAliasCount: items.reduce((sum, item) => sum + item.mergedAliasCount, 0),
    items: items.slice(0, limit)
  };
}

function aliasSummaryLine(item = {}, index = null) {
  const prefix = index == null ? "" : `${index}. `;
  const aliases = item.aliases?.length ? item.aliases.join(", ") : "등록 없음";
  const names = (item.names || []).filter((name) => keyFor(name) !== keyFor(item.name));
  const nameHint = names.length ? ` · 연결 ${names.slice(0, 2).join(", ")}` : "";
  const mergeHint = item.mergedAliasCount ? ` · 병합 ${item.mergedAliasCount}건` : "";
  return `${prefix}${item.name} → ${aliases}${nameHint}${mergeHint}`;
}

function myAliasSummaryCommand(roomState, sender) {
  const key = roomState.aliases?.[keyFor(sender)] || existingPersonKey(roomState, sender) || personKey(sender);
  const item = aliasSummaryItem(roomState, key, sender);
  if (!item.exists) return "❌ 별명 데이터를 찾지 못했습니다. 먼저 방에서 채팅하거나 관리자에게 /별명등록을 요청해 주세요.";
  return [
    "🪪 별명 요약",
    `대표 닉 : ${item.name}`,
    `연결 닉 : ${item.names?.length ? item.names.join(", ") : item.name}`,
    `등록 별명 : ${item.aliases.length ? item.aliases.join(", ") : "등록 없음"}`,
    `병합 상태 : ${item.mergedAliasCount ? `연결 ${item.mergedAliasCount}건` : "단일 닉"}`,
    "",
    "별명으로도 /포인트, /가방, /프로필 조회가 가능합니다."
  ].join("\n");
}

function aliasListCommand(roomState, text) {
  const query = stripKakaoSuffix(text.replace(/^\/별명목록\s*/i, ""));
  if (query) {
    const key = existingPersonKey(roomState, query);
    if (!key) return `❌ "${query}" 닉네임 또는 별명을 찾지 못했습니다.`;
    const item = aliasSummaryItem(roomState, key, query);
    return [
      "🪪 별명 목록",
      aliasSummaryLine(item),
      "",
      `상세: /닉이력 ${item.name}`,
      `병합: /닉병합 기준닉 합칠닉`
    ].join("\n");
  }
  const summary = aliasSummaryPayload(roomState, { limit: 20 });
  const lines = summary.items
    .filter((item) => item.aliasCount || item.mergedAliasCount)
    .slice(0, 20)
    .map((item, index) => aliasSummaryLine(item, index + 1));
  return [
    "🪪 별명 목록",
    `대상 : ${summary.totalProfiles}명 / 별명 ${summary.aliasCount}개 / 병합 ${summary.mergedAliasCount}건`,
    "",
    ...(lines.length ? lines : ["등록된 별명이 없습니다."]),
    "",
    "조회: /별명목록 닉네임",
    "내 별명: /내별명"
  ].join("\n");
}

function publicNicknameMergeHistoryItem(roomState, item = {}) {
  return {
    id: item.id || "",
    status: item.status || "active",
    roomName: item.roomName || roomState.name || "",
    targetKey: item.targetKey || "",
    sourceKey: item.sourceKey || "",
    targetName: item.targetName || "",
    sourceName: item.sourceName || "",
    reason: item.reason || "",
    by: item.by || "",
    createdAt: item.createdAt || "",
    undoneAt: item.undoneAt || "",
    undoneBy: item.undoneBy || "",
    target: nicknameMergePersonSummary(roomState, item.targetKey, item.targetName),
    source: nicknameMergePersonSummary(roomState, item.sourceKey, item.sourceName)
  };
}

function nicknameMergeCandidates(roomState, limit = 20) {
  const people = Object.entries(roomState.people || {})
    .map(([key, person]) => [key, normalizePersonState(person)])
    .filter(([, person]) => person?.currentName && !isReservedPersonName(person.currentName));
  const candidates = [];
  for (let leftIndex = 0; leftIndex < people.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < people.length; rightIndex += 1) {
      const [leftKey, leftPerson] = people[leftIndex];
      const [rightKey, rightPerson] = people[rightIndex];
      const leftVariant = nicknameVariantKey(leftPerson.currentName);
      const rightVariant = nicknameVariantKey(rightPerson.currentName);
      if (!leftVariant || leftVariant !== rightVariant) continue;
      if (leftKey === rightKey) continue;
      const leftHasDigits = /\d/.test(keyFor(leftPerson.currentName));
      const rightHasDigits = /\d/.test(keyFor(rightPerson.currentName));
      const targetKey = leftHasDigits || !rightHasDigits ? leftKey : rightKey;
      const sourceKey = targetKey === leftKey ? rightKey : leftKey;
      const score = 80 + (leftHasDigits !== rightHasDigits ? 15 : 0);
      candidates.push({
        score,
        reason: "숫자/공백만 다른 닉네임 후보",
        target: nicknameMergePersonSummary(roomState, targetKey),
        source: nicknameMergePersonSummary(roomState, sourceKey),
        command: `/닉병합 ${displayNameForKey(roomState, targetKey)} ${displayNameForKey(roomState, sourceKey)}`
      });
    }
  }
  return candidates
    .sort((left, right) => right.score - left.score || right.target.points + right.source.points - (left.target.points + left.source.points))
    .slice(0, Math.max(1, Number(limit) || 20));
}

function adminNicknameMergesPayload(state, params = {}) {
  const roomState = adminNicknameMergeRoomState(state, params);
  if (!roomState) return { ok: false, status: 404, error: "room_not_found" };
  return {
    ok: true,
    version: APP_VERSION,
    roomName: roomState.name,
    history: (roomState.nicknameMergeHistory || []).map((item) => publicNicknameMergeHistoryItem(roomState, item)),
    candidates: nicknameMergeCandidates(roomState, params.limit || 20)
  };
}

function buildAdminNicknameMergePreview(state, payload = {}) {
  const roomState = adminNicknameMergeRoomState(state, payload);
  if (!roomState) return { ok: false, status: 404, error: "room_not_found" };
  const targetName = stripKakaoSuffix(payload.targetName || payload.target || payload.baseName);
  const sourceName = stripKakaoSuffix(payload.sourceName || payload.source || payload.mergeName);
  if (!targetName || !sourceName) return { ok: false, status: 400, error: "nickname_merge_name_required" };
  const targetKey = existingPersonKey(roomState, targetName);
  const sourceKey = existingPersonKey(roomState, sourceName);
  if (!targetKey) return { ok: false, status: 404, error: "target_nickname_not_found" };
  if (!sourceKey) return { ok: false, status: 404, error: "source_nickname_not_found" };
  if (targetKey === sourceKey) return { ok: false, status: 409, error: "nickname_already_merged" };
  const target = nicknameMergePersonSummary(roomState, targetKey, targetName);
  const source = nicknameMergePersonSummary(roomState, sourceKey, sourceName);
  return {
    ok: true,
    version: APP_VERSION,
    preview: {
      roomName: roomState.name,
      target,
      source,
      merged: {
        name: target.name,
        points: target.points + source.points,
        level: Math.max(target.level, source.level),
        exp: target.exp + source.exp,
        attendanceCount: new Set([
          ...(roomState.people?.[targetKey]?.attendance?.dates || []),
          ...(roomState.people?.[sourceKey]?.attendance?.dates || [])
        ]).size,
        chatTotal: target.chatTotal + source.chatTotal,
        inventoryItemTypes: Object.keys(normalizeInventory(mergeNumericMaps(roomState.people?.[targetKey]?.inventory, roomState.people?.[sourceKey]?.inventory))).length,
        inventoryQuantity: target.inventoryQuantity + source.inventoryQuantity,
        monsterCount: target.monsterCount + source.monsterCount,
        hasPet: target.hasPet || source.hasPet,
        aliases: uniqueNames([...(target.aliases || []), source.name, ...(source.aliases || [])])
      },
      command: `/닉병합 ${targetName} ${sourceName}`
    }
  };
}

function adminNicknameMergeExecute(state, payload = {}, by = "admin_console") {
  const previewResult = buildAdminNicknameMergePreview(state, payload);
  if (!previewResult.ok) return previewResult;
  const roomState = adminNicknameMergeRoomState(state, payload);
  const { target, source } = previewResult.preview;
  const result = mergePersonData(roomState, target.key, source.key, {
    targetName: target.name,
    sourceName: source.name,
    aliases: [source.name, ...(source.aliases || [])],
    by,
    source: "admin_console_nickname_merge"
  });
  if (!result.ok) return { ok: false, status: 400, error: result.error || "nickname_merge_failed" };
  const afterPreview = buildAdminNicknameMergePreview({
    ...state,
    rooms: {
      ...state.rooms,
      [roomKey(roomState.name)]: roomState
    }
  }, {
    roomName: roomState.name,
    targetName: target.name,
    sourceName: source.name
  });
  return {
    ok: true,
    version: APP_VERSION,
    result,
    preview: {
      ...previewResult.preview,
      target: nicknameMergePersonSummary(roomState, result.targetKey, result.targetName),
      source,
      merged: nicknameMergePersonSummary(roomState, result.targetKey, result.targetName),
      after: afterPreview.ok ? afterPreview.preview : null
    },
    room: roomAdminView(roomState, state)
  };
}

function adminNicknameMergeUndo(state, payload = {}, by = "admin_console") {
  const roomState = adminNicknameMergeRoomState(state, payload);
  if (!roomState) return { ok: false, status: 404, error: "room_not_found" };
  const mergeId = normalizeText(payload.mergeId || payload.id);
  if (!mergeId) return { ok: false, status: 400, error: "nickname_merge_id_required" };
  const merge = (roomState.nicknameMergeHistory || []).find((item) => item.id === mergeId);
  if (!merge) return { ok: false, status: 404, error: "nickname_merge_not_found" };
  if (merge.status === "undone") return { ok: false, status: 409, error: "nickname_merge_already_undone" };
  const snapshot = merge.snapshot || {};
  roomState.people ||= {};
  roomState.profiles ||= {};
  roomState.aliases = cloneJson(snapshot.aliases || {});
  roomState.peopleByIdentity = cloneJson(snapshot.peopleByIdentity || {});
  roomState.admins = cloneJson(snapshot.admins || []);
  if (snapshot.targetPerson) roomState.people[merge.targetKey] = normalizePersonState(cloneJson(snapshot.targetPerson));
  else delete roomState.people[merge.targetKey];
  if (snapshot.sourcePerson) roomState.people[merge.sourceKey] = normalizePersonState(cloneJson(snapshot.sourcePerson));
  else delete roomState.people[merge.sourceKey];
  if (snapshot.targetProfile) roomState.profiles[merge.targetKey] = cloneJson(snapshot.targetProfile);
  else delete roomState.profiles[merge.targetKey];
  if (snapshot.sourceProfile) roomState.profiles[merge.sourceKey] = cloneJson(snapshot.sourceProfile);
  else delete roomState.profiles[merge.sourceKey];
  roomState.inbox ||= {};
  if (snapshot.inboxTarget) roomState.inbox[merge.targetKey] = cloneJson(snapshot.inboxTarget);
  else delete roomState.inbox[merge.targetKey];
  if (snapshot.inboxSource) roomState.inbox[merge.sourceKey] = cloneJson(snapshot.inboxSource);
  else delete roomState.inbox[merge.sourceKey];
  merge.status = "undone";
  merge.undoneAt = nowIso();
  merge.undoneBy = by;
  recordRoomEvent(roomState, {
    type: "nickname_merge_undone",
    mergeId,
    target: merge.targetName,
    source: merge.sourceName,
    by
  });
  return {
    ok: true,
    version: APP_VERSION,
    merge: publicNicknameMergeHistoryItem(roomState, merge),
    room: roomAdminView(roomState, state)
  };
}

async function handleAdminApi(req, url) {
  if (req.method === "GET" && url.pathname === "/api/admin/me") {
    const auth = await requireAdminConsole(req, url);
    if (!auth.ok) return { status: auth.status, body: { ok: false, error: auth.error } };
    return {
      status: 200,
      body: {
        ok: true,
        version: APP_VERSION,
        owner: auth.by || "admin",
        ownerEmailsConfigured: OWNER_ADMIN_EMAILS.length
      }
    };
  }

  if (req.method === "GET" && url.pathname === "/api/admin/rooms") {
    const auth = await requireAdminConsole(req, url);
    if (!auth.ok) return { status: auth.status, body: { ok: false, error: auth.error } };
    const state = await loadState();
    return { status: 200, body: adminRoomsPayload(state) };
  }

  if (req.method === "GET" && url.pathname === "/api/admin/search") {
    const auth = await requireAdminConsole(req, url);
    if (!auth.ok) return { status: auth.status, body: { ok: false, error: auth.error } };
    const state = await loadState();
    return { status: 200, body: adminSearchPayload(state, Object.fromEntries(url.searchParams.entries())) };
  }

  if (req.method === "GET" && url.pathname === "/api/admin/archived-rooms") {
    const auth = await requireAdminConsole(req, url);
    if (!auth.ok) return { status: auth.status, body: { ok: false, error: auth.error } };
    const state = await loadState();
    return { status: 200, body: adminArchivedRoomsPayload(state) };
  }

  if (req.method === "POST" && url.pathname === "/api/admin/room-commands") {
    const body = await readBody(req);
    const auth = await requireAdminConsole(req, url, body);
    if (!auth.ok) return { status: auth.status, body: { ok: false, error: auth.error } };
    const state = await loadState();
    const roomState = roomStateFromAdminRequest(state, body);
    if (!roomState) return { status: 404, body: { ok: false, error: "room_not_found" } };
    return { status: 200, body: buildRoomCommandCatalog(state, roomState, {}, { query: body.q || body.query, isAdminUser: true }) };
  }

  if (req.method === "POST" && url.pathname === "/api/admin/nickname-merge/preview") {
    const body = await readBody(req);
    const auth = await requireAdminConsole(req, url, body);
    if (!auth.ok) return { status: auth.status, body: { ok: false, error: auth.error } };
    const state = await loadState();
    const result = buildAdminNicknameMergePreview(state, body);
    return { status: result.ok ? 200 : result.status || 400, body: result };
  }

  if (req.method === "GET" && url.pathname === "/api/admin/nickname-merges") {
    const auth = await requireAdminConsole(req, url);
    if (!auth.ok) return { status: auth.status, body: { ok: false, error: auth.error } };
    const state = await loadState();
    const result = adminNicknameMergesPayload(state, Object.fromEntries(url.searchParams.entries()));
    return { status: result.ok ? 200 : result.status || 400, body: result };
  }

  if (req.method === "POST" && url.pathname === "/api/admin/nickname-merge") {
    const body = await readBody(req);
    const auth = await requireAdminConsole(req, url, body);
    if (!auth.ok) return { status: auth.status, body: { ok: false, error: auth.error } };
    const state = await loadState();
    const result = adminNicknameMergeExecute(state, body, auth.by || "admin_console");
    if (!result.ok) return { status: result.status || 400, body: result };
    await saveState(state);
    return { status: 200, body: result };
  }

  if (req.method === "POST" && url.pathname === "/api/admin/nickname-merge/undo") {
    const body = await readBody(req);
    const auth = await requireAdminConsole(req, url, body);
    if (!auth.ok) return { status: auth.status, body: { ok: false, error: auth.error } };
    const state = await loadState();
    const result = adminNicknameMergeUndo(state, body, auth.by || "admin_console");
    if (!result.ok) return { status: result.status || 400, body: result };
    await saveState(state);
    return { status: 200, body: result };
  }

  if (req.method === "GET" && url.pathname === "/api/admin/diagnostics") {
    const auth = await requireAdminConsole(req, url);
    if (!auth.ok) return { status: auth.status, body: { ok: false, error: auth.error } };
    const state = await loadState();
    const rooms = Object.values(state.rooms || {}).map((roomState) => ({
      name: roomState.name,
      diagnostics: roomDiagnostics(roomState)
    }));
    return {
      status: 200,
      body: {
        ok: true,
        version: APP_VERSION,
        generatedAt: nowIso(),
        summary: adminDiagnosticsSummary(rooms),
        incidentMessages: incidentMessagesPayload(),
        rooms
      }
    };
  }

  if (req.method === "GET" && url.pathname === "/api/admin/room-logs") {
    const auth = await requireAdminConsole(req, url);
    if (!auth.ok) return { status: auth.status, body: { ok: false, error: auth.error } };
    const state = await loadState();
    return { status: 200, body: adminRoomLogsPayload(state, Object.fromEntries(url.searchParams.entries())) };
  }

  if (req.method === "GET" && url.pathname === "/api/admin/live-events") {
    const auth = await requireAdminConsole(req, url);
    if (!auth.ok) return { status: auth.status, body: { ok: false, error: auth.error } };
    const state = await loadState();
    return { status: 200, body: adminLiveEventsPayload(state, Object.fromEntries(url.searchParams.entries())) };
  }

  if (req.method === "GET" && url.pathname === "/api/admin/performance-summary") {
    const auth = await requireAdminConsole(req, url);
    if (!auth.ok) return { status: auth.status, body: { ok: false, error: auth.error } };
    const state = await loadState();
    return { status: 200, body: adminPerformanceSummaryPayload(state, Object.fromEntries(url.searchParams.entries())) };
  }

  if (req.method === "GET" && url.pathname === "/api/admin/room-logs/export") {
    const auth = await requireAdminConsole(req, url);
    if (!auth.ok) return { status: auth.status, body: { ok: false, error: auth.error } };
    const state = await loadState();
    return { status: 200, body: adminRoomLogsExportPayload(state, Object.fromEntries(url.searchParams.entries())) };
  }

  if (req.method === "GET" && url.pathname === "/api/admin/backup") {
    const auth = await requireAdminConsole(req, url);
    if (!auth.ok) return { status: auth.status, body: { ok: false, error: auth.error } };
    const state = await loadState();
    return {
      status: 200,
      body: {
        ok: true,
        schemaVersion: BACKUP_SCHEMA_VERSION,
        version: APP_VERSION,
        exportedAt: nowIso(),
        state
      }
    };
  }

  if (req.method === "POST" && url.pathname === "/api/admin/backup/validate") {
    const body = await readBody(req);
    const auth = await requireAdminConsole(req, url, body);
    if (!auth.ok) return { status: auth.status, body: { ok: false, error: auth.error } };
    const validation = validateAdminBackupPayload(body);
    return {
      status: validation.ok ? 200 : 400,
      body: validation
    };
  }

  if (req.method === "GET" && url.pathname === "/api/admin/applications") {
    const auth = await requireAdminConsole(req, url);
    if (!auth.ok) return { status: auth.status, body: { ok: false, error: auth.error } };
    const state = await loadState();
    return { status: 200, body: adminApplicationsPayload(state) };
  }

  if (req.method === "GET" && url.pathname === "/api/admin/reports") {
    const auth = await requireAdminConsole(req, url);
    if (!auth.ok) return { status: auth.status, body: { ok: false, error: auth.error } };
    const state = await loadState();
    return { status: 200, body: adminReportsPayload(state, Object.fromEntries(url.searchParams.entries())) };
  }

  if (req.method === "GET" && url.pathname === "/api/admin/transfers") {
    const auth = await requireAdminConsole(req, url);
    if (!auth.ok) return { status: auth.status, body: { ok: false, error: auth.error } };
    const state = await loadState();
    return { status: 200, body: adminTransfersPayload(state, Object.fromEntries(url.searchParams.entries())) };
  }

  if (req.method === "GET" && url.pathname === "/api/admin/application-inquiries") {
    const auth = await requireAdminConsole(req, url);
    if (!auth.ok) return { status: auth.status, body: { ok: false, error: auth.error } };
    const state = await loadState();
    return { status: 200, body: adminApplicationInquiriesPayload(state, Object.fromEntries(url.searchParams.entries())) };
  }

  if (req.method === "GET" && url.pathname === "/api/admin/restore-requests") {
    const auth = await requireAdminConsole(req, url);
    if (!auth.ok) return { status: auth.status, body: { ok: false, error: auth.error } };
    const state = await loadState();
    return { status: 200, body: adminRestoreRequestsPayload(state, Object.fromEntries(url.searchParams.entries())) };
  }

  if (req.method === "POST" && url.pathname === "/api/admin/restore-requests/resolve") {
    const body = await readBody(req);
    const auth = await requireAdminConsole(req, url, body);
    if (!auth.ok) return { status: auth.status, body: { ok: false, error: auth.error } };
    const state = await loadState();
    const result = adminResolveRestoreRequest(state, body, auth.by || "admin_console");
    if (!result.ok) return { status: result.status || 400, body: result };
    await saveState(state);
    return { status: 200, body: result };
  }

  if (req.method === "POST" && url.pathname === "/api/admin/rooms") {
    const body = await readBody(req);
    const auth = await requireAdminConsole(req, url, body);
    if (!auth.ok) return { status: auth.status, body: { ok: false, error: auth.error } };
    const state = await loadState();
    const result = adminUpsertRoom(state, body);
    if (!result.ok) return { status: result.status || 400, body: result };
    await saveState(state);
    return { status: 200, body: result };
  }

  if (req.method === "POST" && url.pathname === "/api/admin/game-room-link") {
    const body = await readBody(req);
    const auth = await requireAdminConsole(req, url, body);
    if (!auth.ok) return { status: auth.status, body: { ok: false, error: auth.error } };
    const state = await loadState();
    const baseApplication = state.applications?.[normalizeText(body.baseApplicationId || body.applicationId || body.baseAppId)];
    if (!baseApplication) return { status: 404, body: { ok: false, error: "application_not_found" } };
    const account = state.accounts?.[baseApplication.accountId];
    if (!account) return { status: 404, body: { ok: false, error: "account_not_found" } };
    const result = linkApprovedRoomAsGameRoom(state, account, body, {
      by: auth.by || "admin_console",
      eventType: "admin_game_room_linked"
    });
    if (!result.ok) return { status: result.status || 400, body: result };
    await saveState(state);
    return {
      status: 200,
      body: {
        ...result,
        roomGroups: adminRoomGroupsPayload(state, Object.values(state.rooms || {}).map((roomState) => roomAdminView(roomState, state)))
      }
    };
  }

  if ((req.method === "DELETE" && url.pathname === "/api/admin/rooms") || (req.method === "POST" && url.pathname === "/api/admin/rooms/delete")) {
    const body = await readBody(req);
    const auth = await requireAdminConsole(req, url, body);
    if (!auth.ok) return { status: auth.status, body: { ok: false, error: auth.error } };
    const state = await loadState();
    const result = adminDeleteRoom(state, body, auth.by || "admin_console");
    if (!result.ok) return { status: result.status || 400, body: result };
    await saveState(state);
    return { status: 200, body: result };
  }

  if (req.method === "POST" && url.pathname === "/api/admin/rooms/archive") {
    const body = await readBody(req);
    const auth = await requireAdminConsole(req, url, body);
    if (!auth.ok) return { status: auth.status, body: { ok: false, error: auth.error } };
    const state = await loadState();
    const result = adminArchiveRoom(state, body, auth.by || "admin_console");
    if (!result.ok) return { status: result.status || 400, body: result };
    await saveState(state);
    return { status: 200, body: result };
  }

  if (req.method === "POST" && url.pathname === "/api/admin/rooms/bulk-archive") {
    const body = await readBody(req);
    const auth = await requireAdminConsole(req, url, body);
    if (!auth.ok) return { status: auth.status, body: { ok: false, error: auth.error } };
    const state = await loadState();
    const result = adminBulkArchiveRooms(state, body, auth.by || "admin_console");
    if (!result.ok) return { status: result.status || 400, body: result };
    await saveState(state);
    return { status: 200, body: result };
  }

  if (req.method === "POST" && url.pathname === "/api/admin/rooms/force-archive") {
    const body = await readBody(req);
    const auth = await requireAdminConsole(req, url, body);
    if (!auth.ok) return { status: auth.status, body: { ok: false, error: auth.error } };
    const state = await loadState();
    const result = adminForceArchiveRoom(state, body, auth.by || "admin_console");
    if (!result.ok) return { status: result.status || 400, body: result };
    await saveState(state);
    return { status: 200, body: result };
  }

  if (req.method === "POST" && url.pathname === "/api/admin/rooms/force-delete") {
    const body = await readBody(req);
    const auth = await requireAdminConsole(req, url, body);
    if (!auth.ok) return { status: auth.status, body: { ok: false, error: auth.error } };
    const state = await loadState();
    const result = adminForceDeleteRoom(state, body, auth.by || "admin_console");
    if (!result.ok) return { status: result.status || 400, body: result };
    await saveState(state);
    return { status: 200, body: result };
  }

  if (req.method === "POST" && url.pathname === "/api/admin/rooms/restore") {
    const body = await readBody(req);
    const auth = await requireAdminConsole(req, url, body);
    if (!auth.ok) return { status: auth.status, body: { ok: false, error: auth.error } };
    const state = await loadState();
    const result = adminRestoreArchivedRoom(state, body, auth.by || "admin_console");
    if (!result.ok) return { status: result.status || 400, body: result };
    await saveState(state);
    return { status: 200, body: result };
  }

  if (req.method === "POST" && url.pathname === "/api/admin/rooms/purge") {
    const body = await readBody(req);
    const auth = await requireAdminConsole(req, url, body);
    if (!auth.ok) return { status: auth.status, body: { ok: false, error: auth.error } };
    const state = await loadState();
    const result = adminPurgeArchivedRoom(state, body, auth.by || "admin_console");
    if (!result.ok) return { status: result.status || 400, body: result };
    await saveState(state);
    return { status: 200, body: result };
  }

  if (req.method === "POST" && url.pathname === "/api/admin/reports/resolve") {
    const body = await readBody(req);
    const auth = await requireAdminConsole(req, url, body);
    if (!auth.ok) return { status: auth.status, body: { ok: false, error: auth.error } };
    const state = await loadState();
    const result = adminResolveReport(state, body, auth.by || "admin_console");
    if (!result.ok) return { status: result.status || 400, body: result };
    await saveState(state);
    return { status: 200, body: result };
  }

  if (req.method === "POST" && url.pathname === "/api/admin/application-inquiries/resolve") {
    const body = await readBody(req);
    const auth = await requireAdminConsole(req, url, body);
    if (!auth.ok) return { status: auth.status, body: { ok: false, error: auth.error } };
    const state = await loadState();
    const result = adminResolveApplicationInquiry(state, body, auth.by || "admin_console");
    if (!result.ok) return { status: result.status || 400, body: result };
    await saveState(state);
    return { status: 200, body: result };
  }

  if (req.method === "POST" && url.pathname === "/api/admin/applications/approve") {
    const body = await readBody(req);
    const auth = await requireAdminConsole(req, url, body);
    if (!auth.ok) return { status: auth.status, body: { ok: false, error: auth.error } };
    const state = await loadState();
    const result = adminApproveApplication(state, body, "admin_console");
    if (!result.ok) return { status: result.status || 400, body: result };
    await saveState(state);
    return { status: 200, body: result };
  }

  if ((req.method === "DELETE" && url.pathname === "/api/admin/applications") || (req.method === "POST" && url.pathname === "/api/admin/applications/delete")) {
    const body = await readBody(req);
    const auth = await requireAdminConsole(req, url, body);
    if (!auth.ok) return { status: auth.status, body: { ok: false, error: auth.error } };
    const state = await loadState();
    const result = adminDeleteApplication(state, body);
    if (!result.ok) return { status: result.status || 400, body: result };
    await saveState(state);
    return { status: 200, body: result };
  }

  if (req.method === "POST" && url.pathname === "/api/admin/restore") {
    const body = await readBody(req);
    const auth = await requireAdminConsole(req, url, body);
    if (!auth.ok) return { status: auth.status, body: { ok: false, error: auth.error } };
    const validation = validateAdminBackupPayload(body);
    if (!validation.ok) return { status: 400, body: validation };
    const state = await loadState();
    if (body.state?.rooms && typeof body.state.rooms === "object" && !Array.isArray(body.state.rooms)) {
      return {
        status: 409,
        body: {
          ...validation,
          ok: false,
          error: "full_state_restore_blocked",
          summary: "전체 state 덮어쓰기 복구는 현재 보류 중입니다. 먼저 dry-run 결과를 확인하고, 방 단위 복구만 사용하세요."
        }
      };
    }
    const rooms = Array.isArray(body.rooms)
      ? body.rooms
      : Array.isArray(body.state?.rooms)
        ? body.state.rooms
        : [];
    if (!rooms.length) return { status: 400, body: { ok: false, error: "rooms_required" } };
    const restored = [];
    for (const roomPayload of rooms) {
      const result = restoreRoomFromAdminPayload(state, roomPayload);
      if (result.ok) restored.push(result.room.name);
    }
    await saveState(state);
    return { status: 200, body: { ok: true, restored } };
  }

  return null;
}

async function handleCommand(state, room, sender, message, identity = {}) {
  const physicalRoomState = identity.physicalRoomState || ensureRoom(state, room);
  const roomState = canonicalDataRoomState(state, physicalRoomState);
  const text = normalizeText(message);
  const parsed = parseBotCommand(text);
  const compactCommand = compactSpaces(text);
  const command = parsed.command || normalizeCustomCommandTrigger(compactCommand);
  if (!parsed.isCommandAttempt && !customCommandMatch(roomState, compactCommand)) return null;
  const roleRestricted = roomRoleRestrictionText(physicalRoomState, roomState, command, compactCommand);
  if (roleRestricted) return roleRestricted;

  if (command === "/상태" || command === "/status") return statusText(room);
  if (command === "/브릿지" || command === "/bridge") return bridgeServerText(room);
  if (command === "/js상태" || command === "/jsstatus") return bridgeJsServerText();
  if (command === "/로컬상태") return `${DEFAULT_BOT_NAME} 자동응답 스크립트가 실행 중입니다. 이제 /상태 를 보내 서버 연결을 확인하세요.`;
  if (command === "/방등록") return roomRegisterCommand(roomState, sender, text, identity.payload || {});
  if (/^\/(?:방설정|입장문구)(?:\s|$)/.test(compactCommand)) return roomJoinPhraseCommand(roomState, sender, text);
  if (command === "/방정보") return requireAdmin(roomState, sender) || roomInfoCommand(roomState);
  if (command === "/방목록") return requireAdmin(roomState, sender) || roomListCommand(state);
  if (command === "/방삭제") return roomDeleteCommand(roomState, sender);
  if (command === "/구독상태") return requireAdmin(roomState, sender) || subscriptionStatusCommand(roomState);
  if (command === "/구독연장") return subscriptionExtendCommand(roomState, sender, text);
  if (command === "/구독만료") return subscriptionExpireCommand(roomState, sender, text);
  if (command === "/기능" || command === "/기능목록") return requireAdmin(roomState, sender) || featureSettingsCommand(roomState);
  if (command === "/기능켜기") return featureUpdateCommand(roomState, sender, text, true);
  if (command === "/기능끄기") return featureUpdateCommand(roomState, sender, text, false);
  if (command === "/고정명령어") return fixedCommandCatalogText(isAdmin(roomState, sender));
  if (command === "/게임명령어") return gameCommandCatalogText();
  if (command === "/명령어목록" || command === "/커스텀명령어") return customCommandListText(roomState);
  if (/^\/(?:명령어등록|명령어수정|커스텀등록|커스텀수정)\s/.test(compactCommand)) return customCommandRegisterCommand(roomState, sender, text);
  if (/^\/(?:명령어삭제|커스텀삭제)\s/.test(compactCommand)) return customCommandDeleteCommand(roomState, sender, text);
  if (command === "/명령어검색") return requireAdmin(roomState, sender) || commandInstallSearchText(parsed.args.join(" "));
  if (command === "/명령어설치") return commandInstallPreviewCommand(roomState, sender, parsed, identity);
  if (command === "/설치확인") return commandInstallConfirmCommand(roomState, sender, parsed, identity);
  if (command === "/설치취소") return commandInstallCancelCommand(roomState, sender, parsed, identity);
  if (command === "/명령어설치목록") return commandInstallListText(roomState, sender, identity);
  if (command === "/명령어팩" || command === "/팩목록") return commandPackInfoCommand(roomState, parsed);
  if (command === "/명령어팩목록" || command === "/장착팩") return commandPackListText(roomState, sender, parsed);
  if (command === "/명령어팩제거" || command === "/팩제거") return commandPackRemoveCommand(roomState, sender, parsed);
  if (command === "/게임팩도움말") return gamePackHelpText(parsed.args.join(" "));
  if (command === "/메뉴" || command === "/처음") return commandDiscoveryHubText(roomState, sender);
  if (command === "/시작" || command === "/처음시작") return starterTutorialText(roomState, sender);
  if (command === "/추천" || command === "/추천명령어") return commandRecommendationText(roomState, sender, parsed.args.join(" "));
  if (command === "/오늘할일" || command === "/할일") return dailyActionChecklistCommand(roomState, sender);
  if (command === "/판매추천") return saleRecommendationCommand(roomState, sender);
  if (command === "/정리추천") return cleanupRecommendationCommand(roomState, sender);
  if (command === "/찾기") return commandFindText(roomState, sender, parsed.args.join(" "));
  if (command === "/명령어") return parsed.args.length ? commandFindText(roomState, sender, parsed.args.join(" ")) : commandDiscoveryHubText(roomState, sender);
  const registryItem = resolveCommandRegistryItem(command, compactCommand);
  if (registryItem && !commandInstalledInRoom(registryItem, roomState)) return commandInstallRequiredText(registryItem);
  const requiredFeature = commandFeatureKey(compactCommand);
  if (requiredFeature && !featureEnabled(roomState, requiredFeature)) return featureDisabledText(requiredFeature);
  if (command === "/도움말" || command === "/help" || command === "/?") {
    const helpTopic = parsed.args.join(" ");
    return helpTopic ? gamePackHelpText(helpTopic) : helpText(roomState, sender);
  }
  if (command === "/점메추") return lunchRecommendationCommand(text);
  if (command === "/게임") return gameHelpText(roomState);
  if (command === "/확률게임") return chanceGameGuideText();
  if (command === "/주사위") return diceGameCommand(roomState, sender);
  if (command === "/미끼상점") return baitShopCommand(roomState, sender);
  if (command === "/미끼구매") return baitPurchaseCommand(roomState, sender, text);
  if (command === "/낚시") return fishingGameCommand(roomState, sender);
  if (command === "/자동낚시") return autoFishingCommand(roomState, sender, text);
  if (command === "/어항" || command === "/수족관") return aquariumCommand(roomState, sender, text);
  if (command === "/탐험") return exploreGameCommand(roomState, sender);
  if (command === "/자동탐험" || command === "/자동모험") return autoExploreCommand(roomState, sender, text);
  if (command === "/모험") return rpgAdventureHubCommand(roomState, sender);
  if (command === "/던전목록") return dungeonListCommand();
  if (command === "/던전") return dungeonCommand(roomState, sender, text);
  if (command === "/자동던전" || command === "/자동사냥") return autoHuntDungeonCommand(roomState, sender, text);
  if (command === "/대장간") return blacksmithCommand(roomState, sender);
  if (command === "/제작가능") return craftableEquipmentCommand(roomState, sender);
  if (command === "/제작") return craftWeaponCommand(roomState, sender, text);
  if (command === "/자동제작") return autoCraftEquipmentCommand(roomState, sender);
  if (command === "/강화") return rpgEnhanceCommand(roomState, sender, text);
  if (command === "/강화목록") return rpgEnhancementListCommand(roomState, sender);
  if (command === "/강화상세") return rpgEnhancementDetailCommand(roomState, sender);
  if (command === "/보상선택") return rewardChoiceCommand(roomState, sender, text);
  if (command === "/장비") return equipmentCommand(roomState, sender);
  if (command === "/장비상세") return equipmentDetailCommand(roomState, sender);
  if (command === "/스탯") return rpgStatsCommand(roomState, sender);
  if (command === "/장착") return equipWeaponCommand(roomState, sender, text);
  if (command === "/자동장착") return autoEquipCommand(roomState, sender, text);
  if (command === "/세트아이템") return rpgSetItemsCommand();
  if (command === "/몬스터도감") return monsterDexCommand(roomState, sender, text);
  if (command === "/몬스터탐험") return monsterExploreCommand(roomState, sender, text);
  if (command === "/포획") return monsterCaptureCommand(roomState, sender);
  if (command === "/몬스터") return monsterHubCommand(roomState, sender);
  if (command === "/몬스터목록") return monsterListCommand(roomState, sender);
  if (command === "/몬스터상세") return monsterDetailCommand(roomState, sender, text);
  if (command === "/몬스터팀") return monsterTeamCommand(roomState, sender, text);
  if (command === "/몬스터퀘스트") return monsterQuestCommand(roomState, sender);
  if (command === "/몬스터훈련") return monsterTrainCommand(roomState, sender);
  if (command === "/몬스터전투") return monsterBattleCommand(roomState, sender);
  if (command === "/몬스터진화") return monsterEvolutionCommand(roomState, sender);
  if (command === "/몬스터보스") return monsterBossCommand(roomState, sender);
  if (command === "/펫입양") return petAdoptCommand(roomState, sender, text);
  if (command === "/펫") return petStatusCommand(roomState, sender);
  if (command === "/펫먹이") return petCareCommand(roomState, sender, { title: "펫 먹이 완료", cooldownKey: "petFeed", hunger: -20, happiness: 5, health: 2 });
  if (command === "/펫놀기") return petCareCommand(roomState, sender, { title: "펫 놀기 완료", cooldownKey: "petPlay", happiness: 15, energy: -5 });
  if (command === "/펫씻기") return petCareCommand(roomState, sender, { title: "펫 씻기 완료", cooldownKey: "petClean", cleanliness: 25, health: 3 });
  if (command === "/펫재우기") return petCareCommand(roomState, sender, { title: "펫 휴식 완료", cooldownKey: "petSleep", energy: 25, hunger: 5 });
  if (command === "/펫훈련") return petTrainCommand(roomState, sender);
  if (command === "/펫상점") return petShopCommand(roomState, sender);
  if (command === "/날씨" || command === "/오늘날씨" || /^\/.+날씨$/u.test(command)) return weatherCommand(roomState, parsed);
  if (command === "/운세" || command === "/오늘운세") return fortuneCommand(roomState, sender, parsed, identity);
  if (/^\/(?:메시지|메세지|메시지함)(?:\s|$)/.test(command)) return messageInboxCommand(roomState, sender);
  if (command === "/신고") return reportCreateCommand(roomState, sender, parsed);
  if (command === "/신고목록") return requireAdmin(roomState, sender) || reportListCommand(roomState, parsed);
  if (command === "/신고처리") return requireAdmin(roomState, sender) || reportResolveCommand(roomState, sender, parsed);
  if (/^\/(?:최근이벤트|이벤트로그)(?:\s|$)/.test(command)) return requireAdmin(roomState, sender) || recentEventsCommand(state, roomState, sender, text);
  if (/^\/(?:원본로그|원본이벤트)(?:\s|$)/.test(command)) return rawLogCommand(roomState, sender, text);
  if (/^\/(?:출석|출석체크|출첵|ㅊㅊ)$/.test(command)) return attendanceCommand(roomState, sender);
  if (command === "/미출석") return missingAttendanceCommand(roomState);
  if (/^\/출석\s*순위$|^\/출석순위$/.test(compactCommand)) return attendanceRankingCommand(roomState, sender);
  if (/^\/(?:포인트안내|포인트규칙)$/.test(command)) return pointGuideText();
  if (/^\/포인트\s*순위$|^\/포인트순위$/.test(compactCommand)) return rankingText(roomState, sender, "points");
  if (/^\/좋아요\s*순위$|^\/좋아요순위$/.test(compactCommand)) return rankingText(roomState, sender, "likes");
  if (/^\/레벨\s*순위$|^\/레벨순위$/.test(compactCommand)) return rankingText(roomState, sender, "levels");
  if (command === "/채팅오늘") return rankingText(roomState, sender, "todayChats");
  if (command === "/채팅금주") return rankingText(roomState, sender, "weekChats");
  if (command === "/포인트지급") return adminPointAdjustCommand(roomState, sender, text, "grant");
  if (command === "/포인트차감") return adminPointAdjustCommand(roomState, sender, text, "debit");
  if (command === "/포인트설정") return adminPointAdjustCommand(roomState, sender, text, "set");
  if (/^\/(?:포인트|내포인트)(?:\s|$)/.test(command)) return pointViewCommand(roomState, text, sender);
  if (command === "/좋아요") return likeCommand(roomState, sender, text);
  if (command === "/응원") return cheerCommand(roomState, sender, text);
  if (command === "/뽑기목록") return luckyDrawCatalogText();
  if (command === "/자동뽑기") return autoLuckyDrawCommand(roomState, sender, text);
  if (command === "/확률뽑기" || command === "/뽑기") return luckyDrawCommand(roomState, sender);
  if (command === "/홀짝" || /^\/(?:홀|짝)(?:\s|$)/.test(command)) return oddEvenCommand(roomState, sender, text);
  if (command === "/코인" || command === "/동전") return coinFlipCommand(roomState, sender, text);
  if (command === "/룰렛") return rouletteCommand(roomState, sender, text);
  if (command === "/슬롯") return slotMachineCommand(roomState, sender, text);
  if (command === "/복권") return lotteryCommand(roomState, sender, text);
  if (command === "/하이로우") return highLowCommand(roomState, sender, text);
  if (command === "/폭탄피하기") return bombAvoidCommand(roomState, sender, text);
  if (command === "/보물상자") return treasureBoxCommand(roomState, sender, text);
  if (command === "/이체") return transferCommand(roomState, sender, text);
  if (command === "/상점") return shopListCommand(roomState, sender);
  if (command === "/구매") return purchaseItemCommand(roomState, sender, text);
  if (command === "/구매내역") return purchaseHistoryCommand(roomState, sender);
  if (command === "/가방" || command === "/아이템" || command === "/보유아이템") return inventoryCommand(roomState, sender, text);
  if (command === "/가방정리") return inventoryCleanupCommand(roomState, sender);
  if (command === "/아이템상세") return itemDetailCommand(roomState, sender, text);
  if (command === "/판매목록") return saleListCommand(roomState, sender, text);
  if (command === "/판매미리보기") return salePreviewCommand(roomState, sender, text);
  if (command === "/일괄판매") return bulkSellCommand(roomState, sender, text);
  if (command === "/아이템잠금") return inventoryLockCommand(roomState, sender, text, true);
  if (command === "/아이템잠금해제") return inventoryLockCommand(roomState, sender, text, false);
  if (command === "/잠금목록") return inventoryLockListCommand(roomState, sender);
  if (command === "/사용") return useItemCommand(roomState, sender, text);
  if (command === "/가방선물") return giftItemCommand(roomState, sender, text);
  if (command === "/판매") return sellItemCommand(roomState, sender, text);
  if (command === "/상점추가") return shopAddCommand(roomState, sender, text);
  if (command === "/상점수정") return shopUpdateCommand(roomState, sender, text);
  if (command === "/상점삭제") return shopDeleteCommand(roomState, sender, text);
  if (command === "/상점정리") return shopCleanupCommand(roomState, sender);
  if (command === "/상점초기화") return shopResetCommand(roomState, sender);
  if (command === "/상점내역") return shopHistoryCommand(roomState, sender);
  if (command === "/기능아이템목록") return functionalShopItemListCommand(roomState, sender);
  if (command === "/아이템지급") return adminItemTransferCommand(roomState, sender, text, "grant");
  if (command === "/아이템회수") return adminItemTransferCommand(roomState, sender, text, "revoke");
  if (/^\/(?:내정보|레벨)(?:\s|$)/.test(command) || command === "/정보") return memberInfoCommand(roomState, text, sender);
  if (command === "/관리자등록") return adminRegisterCommand(roomState, sender, text);
  if (command === "/관리자삭제") return adminDeleteCommand(roomState, sender, text);
  if (/^\/(?:관리자재설정|관리자초기화)(?:\s|$)/.test(command)) return adminResetCommand(roomState, sender, text);
  if (command === "/관리자목록") return adminListCommand(roomState);
  if (/^\/고유값초기화(?:\s|$)/.test(command)) return identityResetCommand(roomState, sender, text, identity);
  if (command === "/프로필등록" || /^\/프로필\s+등록(?:\s|$)/.test(compactCommand)) {
    return requireAdmin(roomState, sender) || profileRegisterCommand(roomState, sender, text);
  }
  if (command === "/프로필삭제") return requireAdmin(roomState, sender) || profileDeleteCommand(roomState, text);
  if (command === "/프로필" || command === "/프로칠") return profileViewCommand(roomState, text, sender);
  if (command === "/내별명") return myAliasSummaryCommand(roomState, sender);
  if (command === "/별명목록") return requireAdmin(roomState, sender) || aliasListCommand(roomState, text);
  if (command === "/별명등록") return requireAdmin(roomState, sender) || aliasRegisterCommand(roomState, sender, text);
  if (command === "/별명삭제") return requireAdmin(roomState, sender) || aliasDeleteCommand(roomState, text);
  if (command === "/닉병합" || command === "/닉네임병합" || command === "/별명병합") return requireAdmin(roomState, sender) || nicknameMergeCommand(roomState, sender, text);
  if (command === "/입퇴장상세") {
    const denied = requireAdmin(roomState, sender);
    if (denied) return denied;
    const query = text.replace(/^\/입퇴장상세\s*/i, "");
    return personDetailedHistoryText(roomState, query, sender);
  }
  if (command === "/입퇴장현황" || command === "/닉이력") {
    const query = text.replace(/^\/(?:입퇴장현황|닉이력)\s*/i, "");
    return personHistoryText(roomState, query, sender);
  }

  const customReply = customCommandReply(roomState, compactCommand, sender);
  if (customReply) return customReply;

  if (parsed.isCommandAttempt) return unknownCommandNoticeText(roomState, sender, parsed);

  return null;
}

async function handleMessage(state, room, sender, message, identity = {}, detectedEvent = null) {
  const physicalRoomState = identity.physicalRoomState || ensureRoom(state, room);
  const roomState = canonicalDataRoomState(state, physicalRoomState);
  const text = normalizeText(message);
  const event = detectedEvent || detectSystemEvent(message);
  const targetIdentity = identity.targetUserId || "";
  const parsed = parseBotCommand(text);
  const isCustomCommand = Boolean(customCommandMatch(roomState, text));
  const isCommand = parsed.isCommandAttempt || isCustomCommand;
  if (isSubscriptionExpired(roomState) && !subscriptionBypassCommand(text)) {
    return isCommand ? subscriptionExpiredText(roomState) : null;
  }
  if (isDuplicateSystemEvent(roomState, event)) return null;
  if (event?.type === "entered") return recordEntry(roomState, event.name, targetIdentity);
  if (event?.type === "left") return recordExit(roomState, event.name, "left", targetIdentity);
  if (event?.type === "kicked") return recordExit(roomState, event.name, "kicked", targetIdentity);
  if (event?.type === "nickname_changed") return recordNickChange(roomState, event.from, event.to, targetIdentity);
  if (isBridgeReplyEchoMessage(sender, message) || isPassiveAttachmentNotice(sender, message)) return null;
  if (roomJoinPhraseMessage(roomState, sender, message)) return recordJoinPhraseSignal(roomState, sender, message);

  const activityReply = recordActivity(roomState, sender, identity.senderId, { firstChatNotice: !isCommand });
  if (isCommand) {
    const reply = await handleCommand(state, room, sender, message, identity);
    return appendOperationalNotice(roomState, sender, text, decorateCommandReplyFromMessage(message, reply));
  }

  recordMentionMessages(roomState, sender, text);
  return unreadNoticeText(roomState, sender) || activityReply;
}

export async function handleSkill(payload) {
  const state = await loadState();
  const utterance = normalizeText(payload?.userRequest?.utterance);
  const room = "카카오스킬";
  const sender = normalizeText(payload?.userRequest?.user?.properties?.nickname) || "스킬사용자";
  const roomState = ensureRoom(state, room);
  const reply = await handleCommand(state, room, sender, utterance);
  await saveState(state);
  return kakaoText(decorateCommandReplyFromMessage(utterance, reply) || "");
}

export async function handleChatEvent(payload) {
  const timingStartedAt = performance.now();
  const serverReceivedAt = nowIso();
  let loadStateMs = 0;
  let saveStateMs = 0;
  let guardMs = 0;
  let commandMs = 0;
  let logMs = 0;
  let cacheHit = false;
  let duplicate = false;
  let saveRequired = true;
  let eventId = "";
  const withTiming = (body) => ({
    ...body,
    timing: chatTimingPayload(timingStartedAt, {
      receivedAt: serverReceivedAt,
      eventId,
      loadStateMs,
      guardMs,
      commandMs,
      logMs,
      saveStateMs,
      cacheHit,
      duplicate,
      saveRequired
    })
  });
  const applyRecordTiming = (record) => {
    const timing = chatTimingPayload(timingStartedAt, {
      receivedAt: serverReceivedAt,
      eventId,
      loadStateMs,
      guardMs,
      commandMs,
      logMs,
      saveStateMs,
      cacheHit,
      duplicate,
      saveRequired
    });
    if (record?.analyticsLog) {
      record.analyticsLog.totalMs = timing.totalMs;
      record.analyticsLog.loadStateMs = timing.loadStateMs;
      record.analyticsLog.guardMs = timing.guardMs;
      record.analyticsLog.commandMs = timing.commandMs;
      record.analyticsLog.logMs = timing.logMs;
      record.analyticsLog.saveStateMs = timing.saveStateMs;
    }
    if (record?.event) record.event.timing = timing;
    return timing;
  };
  const room = normalizeText(payload?.room);
  const message = normalizeText(payload?.msg || payload?.message);
  const sender = normalizeText(payload?.sender) || "익명";
  const event = payloadSystemEvent(payload, message);
  const identity = payloadIdentity(payload);
  eventId = resolveChatEventId(payload, { room, sender, message });
  const loadStartedAt = performance.now();
  const state = await loadState();
  loadStateMs = elapsedMs(loadStartedAt);
  cacheHit = state?.__cacheHit === true;
  const roomState = ensureRoom(state, room);
  if (eventIdSeen(roomState, eventId)) {
    duplicate = true;
    saveRequired = true;
    const logStartedAt = performance.now();
    const record = recordRawEvent(roomState, { ...payload, eventId }, {
      room,
      sender,
      message,
      event,
      eventId,
      serverReceivedAt,
      status: "duplicate",
      ignoreReason: "duplicate_event",
      duplicate: true,
      saveRequired,
      timing: chatTimingPayload(timingStartedAt, {
        receivedAt: serverReceivedAt,
        eventId,
        loadStateMs,
        cacheHit,
        duplicate,
        saveRequired
      })
    });
    logMs = elapsedMs(logStartedAt);
    record.analyticsLog.logMs = logMs;
    applyRecordTiming(record);
    const saveStartedAt = performance.now();
    await saveState(state);
    saveStateMs = elapsedMs(saveStartedAt);
    applyRecordTiming(record);
    return withTiming({ ok: true, reply: null, ignored: true, duplicate: true, reason: "duplicate_event" });
  }
  const registeredRoom = isRegisteredRoomPayload(payload, state, room);
  const registrationCommand = roomRegistrationCommand(message);
  const guardStartedAt = performance.now();
  if (!registeredRoom && registrationCommand && !isGroupChatPayload(payload)) {
    guardMs = elapsedMs(guardStartedAt);
    return withTiming({ ok: true, reply: null, ignored: true, reason: "non_group_chat" });
  }
  if (!registeredRoom && !registrationCommand && !isGroupChatPayload(payload)) {
    guardMs = elapsedMs(guardStartedAt);
    return withTiming({ ok: true, reply: null, ignored: true, reason: "non_group_chat" });
  }
  if (!registeredRoom && !registrationCommand) {
    guardMs = elapsedMs(guardStartedAt);
    return withTiming({ ok: true, reply: null, ignored: true, reason: "unregistered_room" });
  }
  const licenseGuard = shouldRunLicenseGuard(roomState, message, registrationCommand)
    ? licenseGuardResult(roomState, payload, message, registrationCommand)
    : null;
  guardMs = elapsedMs(guardStartedAt);
  if (licenseGuard) {
    rememberEventId(roomState, eventId);
    const saveStartedAt = performance.now();
    await saveState(state);
    saveStateMs = elapsedMs(saveStartedAt);
    return withTiming(licenseGuard);
  }
  // Runtime chat payloads must not overwrite admin-owned room settings.
  const logStartedAt = performance.now();
  const record = recordRawEvent(roomState, { ...payload, eventId }, {
    room,
    sender,
    message,
    event,
    eventId,
    serverReceivedAt,
    status: "received",
    saveRequired,
    timing: chatTimingPayload(timingStartedAt, {
      receivedAt: serverReceivedAt,
      eventId,
      loadStateMs,
      guardMs,
      cacheHit,
      duplicate,
      saveRequired
    })
  });
  logMs = elapsedMs(logStartedAt);
  record.analyticsLog.logMs = logMs;
  record.event.timing = { ...record.event.timing, logMs };

  if (!message || isBotSender(sender)) {
    rememberEventId(roomState, eventId);
    record.analyticsLog.status = "ignored";
    record.analyticsLog.ignoreReason = !message ? "empty_message" : "bot_sender";
    record.event.status = "ignored";
    record.event.ignoreReason = record.analyticsLog.ignoreReason;
    applyRecordTiming(record);
    const saveStartedAt = performance.now();
    await saveState(state);
    saveStateMs = elapsedMs(saveStartedAt);
    applyRecordTiming(record);
    return withTiming({ ok: true, reply: null, ignored: true });
  }

  const commandStartedAt = performance.now();
  const reply = isReadOnlySaveSkipCommand(message)
    ? await handleCommand(state, room, sender, message, { ...identity, payload, physicalRoomState: roomState })
    : await handleMessage(state, room, sender, message, { ...identity, payload, physicalRoomState: roomState }, event);
  commandMs = elapsedMs(commandStartedAt);
  saveRequired = !isReadOnlySaveSkipCommand(message);
  rememberEventId(roomState, eventId);
  const replyGeneratedAt = nowIso();
  record.analyticsLog.status = reply ? "handled" : "no_reply";
  record.analyticsLog.replyGeneratedAt = replyGeneratedAt;
  record.analyticsLog.replyLength = normalizeText(reply).length;
  record.analyticsLog.saveRequired = saveRequired;
  record.analyticsLog.commandMs = commandMs;
  record.event.status = record.analyticsLog.status;
  applyRecordTiming(record);
  if (saveRequired) {
    const saveStartedAt = performance.now();
    await saveState(state);
    saveStateMs = elapsedMs(saveStartedAt);
  }
  applyRecordTiming(record);
  return withTiming({
    ok: true,
    reply,
    ignored: false,
    handled: Boolean(reply)
  });
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

export async function requestHandler(req, res) {
  try {
    const url = new URL(req.url || "/", "http://localhost");
    const pathname = url.pathname;
    if (await staticResponse(req, res, pathname)) return;
    if (req.method === "GET" && pathname === "/api/auth/kakao/start") {
      await handleKakaoOidcStart(res, url);
      return;
    }
    if (req.method === "GET" && pathname === KAKAO_OIDC_CALLBACK_PATH) {
      await handleKakaoOidcCallback(res, url);
      return;
    }

    const isHealthPath = pathname === "/" || pathname === "/health" || pathname === "/api/health";
    const isSkillPath = pathname === "/skill" || pathname === "/api/skill";
    const isChatEventPath = pathname === "/chat-event" || pathname === "/api/chat-event";
    const adminApi = pathname.startsWith("/api/admin/");
    const publicAccountApi = pathname === "/api/auth/config"
      || pathname === "/api/auth/social/start"
      || pathname === "/api/command-templates"
      || pathname === "/api/command-packs"
      || pathname === "/api/game-pack-help"
      || pathname.startsWith("/api/game-pack-help/")
      || pathname === "/api/signup"
      || pathname === "/api/apply"
      || pathname === "/api/login"
      || pathname === "/api/auth/login/start"
      || pathname === "/api/auth/login/verify"
      || pathname === "/api/auth/password-reset/request"
      || pathname === "/api/login/kakao"
      || pathname === "/api/buyer/guide"
      || pathname === "/api/buyer/console"
      || pathname === "/api/buyer/search"
      || pathname === "/api/buyer/account/profile"
      || pathname === "/api/buyer/account/link-kakao"
      || pathname === "/api/application-inquiries"
      || pathname === "/api/buyer/room-mode-settings"
      || pathname === "/api/buyer/room-feature-settings"
      || pathname === "/api/buyer/game-room-link"
      || pathname === "/api/buyer/restore-requests"
      || pathname === "/api/buyer/room-transfer/create"
      || pathname === "/api/buyer/room-transfer/accept"
      || pathname === "/api/buyer/room-transfer/cancel"
      || pathname === "/api/buyer/command-templates/install"
      || pathname === "/api/buyer/command-packs/apply"
      || pathname === "/api/buyer/room-command-packs"
      || pathname === "/api/buyer/custom-commands"
      || pathname === "/api/buyer/custom-commands/save"
      || pathname === "/api/buyer/room-commands"
      || pathname === "/api/buyer/custom-commands/delete"
      || pathname === "/api/bridge/connect"
      || pathname === "/api/bridge/auto-connect"
      || pathname === "/api/bridge/account-room-sync"
      || pathname === "/api/bridge/room-profile-sync";

    if (adminApi) {
      const adminResult = await handleAdminApi(req, url);
      if (adminResult) {
        jsonResponse(res, adminResult.status, adminResult.body);
        return;
      }
    }

    if (publicAccountApi) {
      const accountResult = await handlePublicAccountApi(req, url);
      if (accountResult) {
        jsonResponse(res, accountResult.status, accountResult.body);
        return;
      }
    }

    if (req.method === "GET") {
      if (isHealthPath) {
        jsonResponse(res, 200, await healthPayload(Object.fromEntries(url.searchParams.entries())));
        return;
      }
      if (isSkillPath || isChatEventPath) {
        jsonResponse(res, 405, { error: "method_not_allowed" });
        return;
      }
      jsonResponse(res, 404, { error: "not_found" });
      return;
    }

    if (req.method === "POST") {
      const payload = await readBody(req);
      if (isSkillPath || payload?.userRequest) {
        jsonResponse(res, 200, await handleSkill(payload));
        return;
      }
      if (isChatEventPath) {
        jsonResponse(res, 200, await handleChatEvent(payload));
        return;
      }
      jsonResponse(res, 404, { error: "not_found" });
      return;
    }

    jsonResponse(res, 404, { error: "not_found" });
  } catch (error) {
    console.error(error);
    const issue = incidentMessage("SERVER_ERROR");
    jsonResponse(res, 500, { ok: false, error: issue.code, issue, reply: issue.message });
  }
}

export default requestHandler;

const server = http.createServer(requestHandler);

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  server.listen(PORT, () => {
    console.log(`${DEFAULT_BOT_NAME} server listening on http://localhost:${PORT}`);
  });
}
