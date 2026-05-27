import http from "node:http";
import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { copyFile, mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { existsSync } from "node:fs";
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

export const APP_VERSION = "0.5.05";
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
  "rpg-equipment-set-bonus"
];

const DEFAULT_REGISTERED_ROOM_LINKS = ["https://open.kakao.com/o/gu25P5vi"];
const MONTHLY_PRICE_KRW = Math.max(0, Number(process.env.MONTHLY_PRICE_KRW || 5500)) || 5500;
const ADDITIONAL_ROOM_PRICE_KRW = Math.max(0, Number(process.env.ADDITIONAL_ROOM_PRICE_KRW || 2200)) || 2200;
const DEFAULT_SUBSCRIPTION_DAYS = Math.max(1, Number(process.env.DEFAULT_SUBSCRIPTION_DAYS || 30));
const ROOM_ANALYTICS_LOG_LIMIT = Math.max(100, Number(process.env.ROOM_ANALYTICS_LOG_LIMIT || 5000));
const ROOM_ANALYTICS_EXPORT_LIMIT = Math.max(10, Number(process.env.ROOM_ANALYTICS_EXPORT_LIMIT || 500));
const ROOM_ANALYTICS_MESSAGE_PREVIEW_LIMIT = 240;
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
const LATEST_ANDROID_VERSION = normalizeText(process.env.LATEST_ANDROID_VERSION || "1.0.27");
const MIN_ANDROID_VERSION_CODE = Math.max(1, Number(process.env.MIN_ANDROID_VERSION_CODE || 18));
const LATEST_ANDROID_VERSION_CODE = Math.max(MIN_ANDROID_VERSION_CODE, Number(process.env.LATEST_ANDROID_VERSION_CODE || 28));
const SUPABASE_URL = normalizeText(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
const SUPABASE_ANON_KEY = normalizeText(process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "");
const SUPABASE_KAKAO_ENABLED = normalizeText(process.env.SUPABASE_KAKAO_ENABLED || "false") === "true";
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
  oddEven: 5 * 1000
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
  oddEven: "홀짝은"
});
const GAME_REWARD_MAX = 1000000;
const GAME_SEASON_NAME_LIMIT = 40;
const SHOP_PRODUCT_LIMIT = 50;
const SHOP_PRODUCT_NAME_LIMIT = 40;
const SHOP_PRODUCT_DESCRIPTION_LIMIT = 140;
const SHOP_TRANSACTION_LIMIT = 300;
const SHOP_MAX_PRICE = 1000000;
const SHOP_MAX_QUANTITY = 99;
const BAIT_ITEM_ID = 9001;
const CAPTURE_STONE_ITEM_ID = 9301;
const PET_SNACK_ITEM_ID = 9302;
const FISH_ITEM_ID_START = 10000;
const FISH_SPECIES_COUNT = 60;
const FISH_GRADE_COUNT = 5;
const FISH_CATALOG_SIZE = FISH_SPECIES_COUNT * FISH_GRADE_COUNT;
const RPG_ITEM_ID_START = 11000;
const RPG_ITEM_CATALOG_SIZE = 500;
const RPG_WEAPON_ITEM_ID_START = 12000;
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
    commands: ["/상태", "/도움말", "/브릿지", "/js상태", "/로컬상태", "/메시지", "/신고", "/출석", "/출첵", "/ㅊㅊ", "/포인트", "/내정보", "/프로필", "/닉이력"]
  },
  {
    title: "포인트/랭킹",
    commands: ["/좋아요", "/응원", "/이체", "/미출석", "/출석순위", "/포인트순위", "/좋아요순위", "/레벨순위", "/채팅오늘", "/채팅금주"]
  },
  {
    title: "상점/가방",
    commands: ["/상점", "/구매", "/구매내역", "/가방", "/사용", "/가방선물", "/판매"]
  },
  {
    title: "관리자",
    commands: ["/방등록", "/방정보", "/방목록", "/방삭제", "/입장문구", "/기능목록", "/기능켜기", "/기능끄기", "/구독상태", "/구독연장", "/구독만료", "/관리자등록", "/관리자삭제", "/관리자목록", "/최근이벤트", "/원본로그", "/신고목록", "/신고처리", "/프로필등록", "/프로필삭제", "/별명등록", "/별명삭제", "/닉병합", "/입퇴장상세", "/고유값초기화", "/포인트지급", "/포인트차감", "/포인트설정", "/상점추가", "/상점수정", "/상점삭제", "/상점초기화", "/상점내역", "/아이템지급", "/아이템회수", "/명령어등록", "/명령어삭제", "/명령어목록", "/명령어팩목록", "/명령어팩제거"]
  },
  {
    title: "게임/연동 예약",
    commands: [
      "/게임", "/주사위", "/낚시", "/탐험", "/뽑기", "/뽑기목록", "/홀", "/짝", "/미끼상점", "/미끼구매", "/어항", "/수족관",
      "/던전", "/던전목록", "/대장간", "/제작", "/장비", "/장착",
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
const RPG_WEAPON_RECIPES = RPG_EQUIPMENT_RECIPES;
const PIXEL_MONSTER_ELEMENTS = Object.freeze(["숲", "바위", "물결", "불꽃", "바람", "빛", "그림자"]);
const PIXEL_MONSTER_RARITIES = Object.freeze([
  { id: "common", label: "일반", catchRate: 0.65 },
  { id: "uncommon", label: "고급", catchRate: 0.45 },
  { id: "rare", label: "희귀", catchRate: 0.30 },
  { id: "epic", label: "영웅", catchRate: 0.18 }
]);
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
    power: recipe.power
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
  "/상점추가", "/상점수정", "/상점삭제", "/상점초기화", "/상점내역",
  "/아이템지급", "/아이템회수",
  "/닉병합"
]);
const COMMAND_PACK_ALWAYS_INSTALLED_COMMANDS = Object.freeze([
  "/상태", "/도움말", "/방등록", "/신고", "/신고목록", "/신고처리",
  "/명령어검색", "/명령어설치", "/설치확인", "/설치취소", "/명령어설치목록",
  "/명령어팩", "/명령어팩목록", "/명령어팩제거", "/게임팩도움말",
  ...ADMIN_MANAGEMENT_COMMANDS
]);

const COMMAND_PACK_COMMANDS = Object.freeze({
  "ops-core": ["/상태", "/도움말", "/브릿지", "/js상태", "/메시지", "/날씨", "/운세", "/신고"],
  "attendance-growth": ["/출석", "/미출석", "/출석순위", "/포인트", "/내정보", "/포인트순위"],
  "point-economy": ["/포인트", "/내정보", "/좋아요", "/응원", "/이체", "/포인트순위", "/좋아요순위", "/레벨순위"],
  "game-chance": ["/게임", "/주사위", "/낚시", "/탐험", "/뽑기", "/뽑기목록", "/홀", "/짝", "/홀짝", "/미끼상점", "/미끼구매", "/어항", "/수족관", "/포인트"],
  "rpg-adventure": ["/던전", "/던전목록", "/대장간", "/제작가능", "/제작", "/장비", "/장착", "/세트아이템", "/가방", "/판매", "/포인트"],
  "pixel-monster-rpg": ["/몬스터탐험", "/포획", "/몬스터", "/몬스터목록", "/몬스터훈련", "/몬스터전투", "/몬스터도감", "/포인트"],
  "pet-raising": ["/펫입양", "/펫", "/펫먹이", "/펫놀기", "/펫씻기", "/펫재우기", "/펫훈련", "/펫상점", "/포인트"],
  "shop-inventory": ["/상점", "/구매", "/가방", "/사용", "/가방선물", "/판매", "/구매내역"],
  "custom-command": ["/명령어목록", "/커스텀명령어", "/고정명령어", "/명령어등록", "/명령어수정", "/명령어삭제", "/커스텀등록", "/커스텀수정", "/커스텀삭제"],
  "profile-history": ["/프로필", "/프로필등록", "/프로필삭제", "/별명등록", "/별명삭제", "/닉병합", "/입퇴장현황", "/닉이력", "/입퇴장상세"],
  "admin-ops": ["/관리자등록", "/관리자삭제", "/관리자재설정", "/관리자초기화", "/관리자목록", "/방등록", "/방정보", "/방목록", "/방삭제", "/기능목록", "/기능", "/기능켜기", "/기능끄기", "/구독상태", "/구독연장", "/구독만료", "/원본로그", "/원본이벤트", "/최근이벤트", "/이벤트로그", "/신고목록", "/신고처리", "/명령어검색", "/명령어설치", "/설치확인", "/설치취소", "/명령어설치목록", "/명령어팩", "/명령어팩목록", "/명령어팩제거", "/게임팩도움말", ...ADMIN_MANAGEMENT_COMMANDS],
  "event-engagement": ["/출석", "/좋아요", "/응원", "/운세", "/날씨", "/채팅오늘", "/채팅금주", "/포인트순위"]
});
const ALL_IN_ONE_PACK_COMMANDS = Object.freeze([...new Set(Object.values(COMMAND_PACK_COMMANDS).flat())]);

const LEGACY_PACK_COMMANDS = Object.freeze({
  "basic-ops": ["/도움말", "/메시지", "/프로필"],
  "basic-ops-plus": ["/도움말", "/메시지", "/출석", "/ㅊㅊ", "/미출석", "/포인트", "/내정보", "/출석순위", "/포인트순위", "/레벨순위", "/프로필"],
  "basic-ops-pro": ["/도움말", "/메시지", "/출석", "/ㅊㅊ", "/미출석", "/포인트", "/내정보", "/출석순위", "/포인트순위", "/레벨순위", "/상점", "/구매", "/구매내역", "/가방", "/사용", "/가방선물", "/판매", "/프로필"],
  "addon-mini-games-3": ["/게임", "/주사위", "/낚시", "/탐험", "/뽑기", "/뽑기목록", "/홀", "/짝", "/미끼상점", "/미끼구매", "/어항", "/수족관"]
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
    description: "채팅방 내부 가상 포인트만 사용하는 뽑기와 홀짝 게임 팩입니다.",
    features: { games: true, points: true },
    fixedCommands: COMMAND_PACK_COMMANDS["game-chance"],
    customCommands: [],
    tags: ["게임", "뽑기", "홀짝", "확률", "가상포인트"]
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
    intro: "던전에서 재료를 얻고 대장간에서 무기를 제작해 장착하는 모험형 게임팩입니다.",
    firstSteps: ["/명령어설치 pk.006", "/기능켜기 게임", "/던전", "/제작가능", "/제작 12001"],
    adminSetup: ["명령어팩 장착: /명령어설치 pk.006", "게임 기능 켜기: /기능켜기 게임", "상점/가방 기능 확인: /기능목록"],
    examples: ["/던전", "/던전 중급", "/대장간", "/제작가능", "/제작 12001", "/세트아이템"],
    related: ["shop-inventory", "pet-raising"]
  },
  monster: {
    title: "픽셀몬스터 수집팩",
    path: "/help/monster",
    packIds: ["pixel-monster-rpg"],
    aliases: ["monster", "몬스터", "픽셀몬스터"],
    intro: "오리지널 픽셀몬스터를 발견, 포획, 훈련, 전투하는 수집형 RPG 팩입니다.",
    firstSteps: ["/명령어설치 pk.007", "/기능켜기 게임", "/몬스터탐험", "/포획", "/몬스터목록"],
    adminSetup: ["명령어팩 장착: /명령어설치 pk.007", "게임 기능 켜기: /기능켜기 게임", "설치 확인: /명령어설치목록"],
    examples: ["/몬스터탐험", "/포획", "/몬스터목록", "/몬스터훈련", "/몬스터전투"],
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
    title: "미니게임 확률팩",
    path: "/help/games",
    packIds: ["game-chance"],
    aliases: ["games", "game", "게임", "미니게임"],
    intro: "주사위, 낚시, 탐험, 뽑기, 홀짝을 제공하는 채팅방 미니게임 팩입니다.",
    firstSteps: ["/명령어설치 pk.004", "/기능켜기 게임", "/게임", "/주사위"],
    adminSetup: ["게임 확률팩: /명령어설치 pk.004", "게임 기능 켜기: /기능켜기 게임"],
    examples: ["/게임", "/주사위", "/미끼구매 3", "/낚시", "/홀 100"],
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
  await pool.query(`
    CREATE TABLE IF NOT EXISTS kakao_room_ops_state (
      id text PRIMARY KEY,
      data jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
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
  if (pool) return normalizeState(await loadStateFromPostgres(pool));

  await mkdir(path.dirname(DB_PATH), { recursive: true });
  if (!existsSync(DB_PATH)) {
    const state = cloneInitialState();
    await saveState(state);
    return state;
  }
  const raw = await readFile(DB_PATH, "utf8");
  return normalizeState(JSON.parse(raw));
}

async function saveState(state) {
  const pool = await getPgPool();
  if (pool) {
    await saveStateToPostgres(pool, state);
    return;
  }

  state.updatedAt = nowIso();
  await mkdir(path.dirname(DB_PATH), { recursive: true });
  const tmpPath = `${DB_PATH}.tmp`;
  await writeFile(tmpPath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  await replaceStateFile(tmpPath, DB_PATH);
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
  return Object.values(state.accounts || {}).find((account) => (
    account.auth?.provider === normalizedProvider
    && account.auth?.externalId === normalizedExternalId
  ));
}

function supabaseEnabled() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
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
      kakaoMode: kakaoOidcEnabled ? "oidc" : "supabase-oauth",
      kakaoOidcEnabled,
      kakaoOidcStartUrl: kakaoOidcEnabled ? "/api/auth/kakao/start" : "",
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
    roomRole: roomView?.roomRole || "standard",
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
    gameSettings: roomView?.gameSettings || DEFAULT_GAME_SETTINGS,
    roomStatusSnapshot: roomView?.roomStatusSnapshot || (roomState ? roomStatusSnapshot(state, roomState, { application, account }) : null),
    subscription,
    monthlyPriceKrw: roomView?.subscription?.monthlyPriceKrw || application.plan?.monthlyPriceKrw || MONTHLY_PRICE_KRW,
    serverUrl: "https://pixgom.com/chat-event",
    bridgeConnectCode
  };
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

function pixelMonsterSpeciesById(speciesId = "") {
  const id = normalizeText(speciesId);
  return PIXEL_MONSTER_SPECIES.find((species) => species.speciesId === id) || null;
}

function normalizeOwnedMonsters(value = []) {
  return (Array.isArray(value) ? value : [])
    .map((monster) => {
      const species = pixelMonsterSpeciesById(monster?.speciesId);
      if (!species) return null;
      return {
        id: normalizeText(monster.id) || randomBytes(4).toString("hex"),
        speciesId: species.speciesId,
        name: compactSpaces(monster.name || species.name).slice(0, 24) || species.name,
        element: species.element,
        rarity: species.rarity,
        level: Math.max(1, Math.trunc(Number(monster.level || 1))),
        exp: Math.max(0, Math.trunc(Number(monster.exp || 0))),
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
  return [
    "픽셀곰 고정 명령어",
    "",
    "고정 명령어는 기본 운영과 향후 게임 연동을 위해 예약되어 있어 커스텀 명령어로 덮어쓸 수 없습니다.",
    "",
    ...groups.flatMap((group) => [group.title, group.commands.join(", "), ""]),
    "커스텀 명령어는 /명령어등록 /공지 내용, /명령어등록 공지 내용, /명령어등록 !공지 내용처럼 추가합니다.",
    "/공지, 공지, !공지, .공지 는 서로 다른 명령어로 구분됩니다."
  ].join("\n").trim();
}

function gameCommandCatalogText() {
  return [
    "픽셀곰 게임 명령어",
    "",
    "현재 사용",
    "/게임 - 미니게임 안내",
    "/주사위 - 1~6 결과에 따라 포인트 획득",
    "/낚시 - 랜덤 보상 획득",
    "/탐험 - 랜덤 보상 획득",
    "/뽑기 - 가상 포인트 뽑기",
    "/뽑기목록 - 뽑기 확률과 보상 확인",
    "/홀 금액 또는 /짝 금액 - 홀짝 베팅",
    "",
    "예약",
    "/픽셀곰게임 - 별도 픽셀곰 게임 연동 예정",
    "/게임연동 - 모바일게임 포인트 연동 예정",
    "",
    "게임 예약 명령어는 커스텀 명령어로 등록할 수 없습니다."
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
  return [
    "방별 기능 설정",
    "",
    ...featureLines(roomState),
    "",
    "관리자 명령",
    "/기능켜기 출석",
    "/기능끄기 게임"
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
  person.gameCooldowns = normalizeGameCooldowns(person.gameCooldowns || {});
  person.equipment = normalizeEquipment(person.equipment || {});
  person.monsters = normalizeOwnedMonsters(person.monsters || []);
  person.pendingMonster = normalizePendingMonster(person.pendingMonster || null);
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
  return roomState.profiles[key]?.name || roomState.people[key]?.currentName || stripKakaoSuffix(fallback) || key;
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

function mergePersonData(roomState, targetKey, sourceKey, options = {}) {
  if (!targetKey || !sourceKey) return { ok: false, error: "not_found" };
  if (targetKey === sourceKey) return { ok: true, merged: false, targetKey, sourceKey };
  roomState.people ||= {};
  const targetPerson = normalizePersonState(roomState.people[targetKey] || ensurePerson(roomState, options.targetName || targetKey));
  const sourcePerson = normalizePersonState(roomState.people[sourceKey] || ensurePerson(roomState, options.sourceName || sourceKey));
  if (!targetPerson || !sourcePerson) return { ok: false, error: "not_found" };

  const targetName = targetPerson.currentName || options.targetName || displayNameForKey(roomState, targetKey, targetKey);
  const sourceName = sourcePerson.currentName || options.sourceName || displayNameForKey(roomState, sourceKey, sourceKey);
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
  recordRoomEvent(roomState, {
    type: "nickname_merged",
    target: targetName,
    source: sourceName,
    by: options.by || "",
    reason: options.source || "manual_merge"
  });
  return { ok: true, merged: true, targetKey, sourceKey, targetName, sourceName, points: targetPerson.points };
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
  const log = {
    at: nowIso(),
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
    candidateIdentityCount: identity.candidates?.length || 0
  };
  roomState.analyticsLogs.push(log);
  if (roomState.analyticsLogs.length > ROOM_ANALYTICS_LOG_LIMIT) {
    roomState.analyticsLogs = roomState.analyticsLogs.slice(-ROOM_ANALYTICS_LOG_LIMIT);
  }
  return log;
}

function recordRawEvent(roomState, payload, meta = {}) {
  roomState.rawEvents ||= [];
  recordRoomAnalyticsLog(roomState, payload, meta);
  const identity = payloadIdentity(payload);
  const event = {
    at: nowIso(),
    route: "chat-event",
    room: meta.room || "",
    sender: meta.sender || "",
    message: meta.message || "",
    eventType: meta.event?.type || "",
    eventName: meta.event?.name || meta.event?.to || "",
    identity,
    payload: sanitizePayload(payload)
  };
  roomState.rawEvents.push(event);
  if (roomState.rawEvents.length > 50) roomState.rawEvents = roomState.rawEvents.slice(-50);
  return event;
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
  return /^\/(?:구독상태|구독연장|구독만료|방정보|방등록|방설정|입장문구|방목록|기능|기능목록|기능켜기|기능끄기|도움말|help|\?)(?:\s|$)/i.test(normalizeText(text));
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
  return [
    `${roomState.name || "현재방"} 방 설정`,
    "",
    `등록: ${settings.registered ? "켜짐" : "꺼짐"}`,
    `입장확인 문구: ${settings.joinPhrase || DEFAULT_JOIN_PHRASE}`,
    `관리자: ${(roomState.admins || []).length ? `${roomState.admins.length}명 등록` : "미등록"}`,
    `구독 상태: ${subscription.status === "expired" ? "만료" : subscription.status === "active" ? "정상" : "미설정"}`,
    "상세 운영 정보는 관리 콘솔에서만 확인합니다.",
    "",
    "방별 기능",
    ...featureLines(roomState)
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

function grantExpAndLevel(person, expAmount) {
  normalizePersonState(person);
  person.exp += Math.max(0, Number(expAmount) || 0);
  const notices = [];
  while (person.exp >= requiredExpForLevel(person.level)) {
    const fromLevel = person.level;
    person.exp -= requiredExpForLevel(person.level);
    person.level += 1;
    person.points += LEVEL_UP_POINT_REWARD;
    notices.push([
      `${person.currentName}님 레벨업!`,
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
  const notices = grantExpAndLevel(person, CHAT_EXP_REWARD);
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
  const today = kstDateKey();
  if (person.attendance.dates.includes(today)) return `${person.currentName}님 이미 출첵 하셨습니다.`;

  const lastDate = person.attendance.dates.at(-1);
  person.attendance.currentStreak = lastDate === previousDateKey(today) ? person.attendance.currentStreak + 1 : 1;
  person.attendance.dates.push(today);
  person.points += ATTENDANCE_POINT_REWARD;
  const notices = grantExpAndLevel(person, ATTENDANCE_EXP_REWARD);
  const firstLine = person.attendance.currentStreak > 1
    ? `${person.currentName}님 ${person.attendance.currentStreak}일 연속 출석!`
    : `${person.currentName}님 출석!`;
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
    ...people.slice(0, 30).map((person, index) => `${index + 1}. ${person.currentName}`),
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
    lines.push(`${medal(rank)} ${item.person.currentName} ${formatNumber(item.person.attendance.dates.length)}일`);
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
  if (!targetKey) return `"${parsed.target}" 사용자를 찾을 수 없습니다.`;
  if (targetKey === personKey(sender)) return "님 말고 다른 사람";

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
  if (parsed.key === personKey(sender)) return "본인에게는 응원 카드를 보낼 수 없습니다.";
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
    `${senderPerson.currentName} -> ${receiver.currentName}`,
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
    `${person.currentName}님 ${outcome.label}`,
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
  return {
    productId: Math.trunc(Number(match[1])),
    quantity: Math.min(SHOP_MAX_QUANTITY, Math.max(1, Math.trunc(Number(match[2] || 1))))
  };
}

function baitShopCommand(roomState, sender) {
  const person = ensurePerson(roomState, sender);
  const bait = systemProductById(BAIT_ITEM_ID);
  return [
    "미끼 상점",
    "",
    `${bait.id}. ${bait.name} - ${formatPoint(bait.price)} / 판매가 ${formatPoint(bait.sellPrice)}`,
    `   ${bait.description}`,
    "",
    `보유 포인트: ${formatPoint(person.points)}`,
    `보유 미끼: ${inventoryQuantity(person, BAIT_ITEM_ID)}개`,
    "",
    "/미끼구매 수량 으로 구매합니다."
  ].join("\n");
}

function baitPurchaseCommand(roomState, sender, text) {
  const body = compactSpaces(text.replace(/^\/미끼구매\s*/i, ""));
  const quantity = Math.min(SHOP_MAX_QUANTITY, Math.max(1, Math.trunc(Number(body || 1))));
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
  const parsed = parseProductQuantityCommand(text, /^\/판매\s*/i);
  if (!parsed?.productId || !parsed.quantity) return "형식: /판매 번호 수량";
  const product = inventoryProductById(roomState, parsed.productId);
  if (!product) return "판매 가능한 아이템 번호가 아닙니다. /가방 으로 보유 아이템을 확인해주세요.";
  const unitPrice = productSellPrice(product);
  if (!unitPrice) return "판매할 수 없는 아이템입니다.";
  const person = ensurePerson(roomState, sender);
  const nextQuantity = removeInventory(person, parsed.productId, parsed.quantity);
  if (nextQuantity < 0) return "판매할 아이템 수량이 부족합니다.";
  const totalPrice = unitPrice * parsed.quantity;
  person.points += totalPrice;
  recordShopTransaction(roomState, {
    type: "sell",
    productId: parsed.productId,
    productName: product.name || `상품 #${parsed.productId}`,
    quantity: parsed.quantity,
    unitPrice,
    totalPrice,
    from: person.currentName,
    to: person.currentName,
    by: person.currentName
  });
  return [
    "판매 완료",
    "",
    `• 상품 : ${product.name || `상품 #${parsed.productId}`}`,
    `• 수량 : ${parsed.quantity}개`,
    `• 지급 포인트 : ${formatPoint(totalPrice)}`,
    `• 남은 수량 : ${nextQuantity}개`,
    `• 보유 포인트 : ${formatPoint(person.points)}`
  ].join("\n");
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
        rarity: product?.rarity || ""
      };
    })
    .filter((item) => item.quantity > 0)
    .sort((left, right) => left.productId - right.productId);
}

function inventoryCommand(roomState, sender, text) {
  const query = stripKakaoSuffix(text.replace(/^\/가방\s*/i, ""));
  let target = sender;
  if (query) {
    const denied = requireAdmin(roomState, sender);
    if (denied) return denied;
    target = query;
  }
  const key = existingPersonKey(roomState, target) || (query ? "" : personKey(sender));
  const person = key ? roomState.people[key] || ensurePerson(roomState, target) : null;
  if (!person) return `"${target}" 사용자를 찾을 수 없습니다.`;
  const rows = inventoryRows(roomState, person);
  if (!rows.length) {
    return [
      `${person.currentName}님의 가방`,
      "",
      "보유한 아이템이 없습니다.",
      "/상점 으로 구매 가능한 상품을 확인하세요."
    ].join("\n");
  }
  return [
    `${person.currentName}님의 가방`,
    "",
    ...rows.map((item) => `${item.productId}. ${item.name} x ${item.quantity} / 판매가: ${formatPoint(item.sellPrice)}`),
    "",
    "/사용 번호 로 아이템을 사용하거나 /판매 번호 수량 으로 판매합니다."
  ].join("\n");
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
  const fishRows = inventoryRows(roomState, person).filter((item) => isFishProductId(item.productId));
  if (!fishRows.length) {
    return [
      `${person.currentName}님의 어항`,
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
    `${person.currentName}님의 어항`,
    "",
    `수집: ${fishRows.length}/${FISH_CATALOG_SIZE}종`,
    `보유 물고기: ${totalQuantity}마리`,
    `총 판매가: ${formatPoint(totalSellPrice)}`,
    `등급별: ${gradeLine}`,
    "",
    ...fishRows.slice(0, 20).map((item) => `${item.productId}. ${item.name} x ${item.quantity} / 판매가: ${formatPoint(item.sellPrice)}`),
    fishRows.length > 20 ? `...외 ${fishRows.length - 20}종` : "",
    "",
    "/판매 번호 수량 으로 물고기를 포인트로 판매할 수 있습니다."
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
  if (targetKey === personKey(sender)) return "본인에게는 선물할 수 없습니다.";
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
    `• 보낸 사람 : ${giver.currentName}`,
    `• 받은 사람 : ${receiver.currentName}`,
    `• 수량 : ${parsed.quantity}개`,
    `• 받은 사람 보유 : ${receiverQuantity}개`
  ].join("\n");
}

function purchaseHistoryCommand(roomState, sender) {
  const person = ensurePerson(roomState, sender);
  const nameKey = personKey(person.currentName);
  const transactions = shopState(roomState).transactions
    .filter((item) => [item.from, item.to, item.by].some((name) => personKey(name) === nameKey))
    .slice(-10)
    .reverse();
  if (!transactions.length) return `${person.currentName}님의 구매/아이템 내역이 없습니다.`;
  return [
    `${person.currentName}님 구매/아이템 내역`,
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
  return [
    "상점 상품이 추가되었습니다.",
    "",
    productLine(product)
  ].join("\n");
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
  const product = shopProductById(roomState, productId);
  if (!product) return "상품 번호를 찾을 수 없습니다.";
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
  return `${product.name} 상품을 상점에서 숨겼습니다. 기존 가방 아이템은 유지됩니다.`;
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
    `• 대상 : ${person.currentName}`,
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
    `참여자 : ${person.currentName}`,
    `선택 : ${bet.choice}`,
    `베팅 : ${formatPoint(bet.amount)}`,
    `결과 : ${result}`,
    `당첨 : ${isWin ? "성공" : "실패"}`,
    `배당 : x2`,
    `지급 포인트 : ${formatPoint(reward)}`,
    `보유 포인트 : ${formatPoint(person.points)}`
  ].join("\n");
}

function transferCommand(roomState, sender, text) {
  const parsed = parseTargetAndAmount(text, /^\/이체\s*/i);
  if (!parsed?.target || !parsed.amount) return "형식: /이체 닉네임 포인트";

  const senderPerson = ensurePerson(roomState, sender);
  const targetKey = existingPersonKey(roomState, parsed.target);
  if (!targetKey) return `"${parsed.target}" 사용자를 찾을 수 없습니다.`;
  if (targetKey === personKey(sender)) return "본인에게는 이체할 수 없습니다.";

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
  const alias = roomState.profiles[targetKey]?.alias ? ` (별명 : ${roomState.profiles[targetKey].alias})` : "";
  return [
    "✅ 이체 완료",
    "",
    `• 송금인 : ${senderPerson.currentName}`,
    `• 수취인 : ${receiver.currentName}${alias}`,
    `• 포인트 : ${formatPoint(parsed.amount)}`,
    `• 수수료 : ${formatPoint(fee)}`
  ].join("\n");
}

function diceGameCommand(roomState, sender) {
  const person = ensurePerson(roomState, sender);
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
    `${person.currentName}님 결과: ${roll}`,
    `획득: ${formatPoint(reward)}`,
    `보유: ${formatPoint(person.points)}`
  ].join("\n");
}

function fishingGameCommand(roomState, sender) {
  const person = ensurePerson(roomState, sender);
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
    `${person.currentName}님이 #${item.id} ${item.name}을(를) 낚았습니다.`,
    `가방에 보관: ${item.name} x ${itemQuantity}`,
    `판매가 : ${formatPoint(item.sellPrice)}`,
    `남은 미끼 : ${inventoryQuantity(person, BAIT_ITEM_ID)}개`
  ].join("\n");
}

function exploreGameCommand(roomState, sender) {
  const person = ensurePerson(roomState, sender);
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
    `${person.currentName}님이 #${item.id} ${item.name}을(를) 발견했습니다.`,
    `가방에 보관: ${item.name} x ${itemQuantity}`,
    `판매가 : ${formatPoint(item.sellPrice)}`
  ].join("\n");
}

const DUNGEON_CONFIGS = Object.freeze([
  { key: "beginner", names: ["", "초급", "초급 광산", "광산"], title: "초급 광산", blankChance: 0.25, itemStart: 0, itemEnd: 119 },
  { key: "middle", names: ["중급", "중급 유적", "유적"], title: "중급 유적", blankChance: 0.30, itemStart: 80, itemEnd: 299 },
  { key: "advanced", names: ["상급", "상급 심연", "심연"], title: "상급 심연", blankChance: 0.35, itemStart: 240, itemEnd: 499 }
]);

function dungeonConfigFromText(text = "") {
  const body = compactSpaces(text.replace(/^\/던전\s*/i, ""));
  return DUNGEON_CONFIGS.find((config) => config.names.includes(body)) || DUNGEON_CONFIGS[0];
}

function dungeonListCommand() {
  return [
    "픽셀곰 던전 목록",
    "",
    ...DUNGEON_CONFIGS.map((config) => `• ${config.title}: 꽝 ${Math.round(config.blankChance * 100)}%, 재료 #${RPG_ITEM_ID_START + config.itemStart}~#${RPG_ITEM_ID_START + config.itemEnd}`),
    "",
    "/던전 또는 /던전 중급 으로 입장합니다.",
    "/대장간 에서 재료 제작식을 확인할 수 있습니다."
  ].join("\n");
}

function randomDungeonItem(config) {
  if (Math.random() < config.blankChance) return null;
  const span = Math.max(1, config.itemEnd - config.itemStart + 1);
  const offset = config.itemStart + Math.floor(Math.random() * span);
  return systemProductById(RPG_ITEM_ID_START + offset) || systemProductById(RPG_ITEM_ID_START);
}

function dungeonCommand(roomState, sender, text) {
  const person = ensurePerson(roomState, sender);
  const cooldown = gameCooldownText(person, "dungeon");
  if (cooldown) return cooldown;
  const config = dungeonConfigFromText(text);
  const item = randomDungeonItem(config);
  markGameCooldown(person, "dungeon");
  if (!item) {
    recordRoomEvent(roomState, { type: "dungeon_blank", name: person.currentName, dungeon: config.title });
    return [
      "던전 결과",
      "",
      `${person.currentName}님이 ${config.title}을(를) 탐험했습니다.`,
      "결과: 꽝",
      "아무것도 얻지 못했습니다."
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
    `${person.currentName}님이 ${config.title}에서 #${item.id} ${item.name}을(를) 획득했습니다.`,
    `가방에 보관: ${item.name} x ${quantity}`,
    `판매가 : ${formatPoint(item.sellPrice)}`
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

function rpgRecipeLine(recipe, person = null) {
  const slot = RPG_EQUIPMENT_SLOT_LABELS[recipe.slot || "weapon"] || "장비";
  const setName = recipe.setId ? ` / ${RPG_EQUIPMENT_SETS[recipe.setId]?.name || "세트"}` : "";
  const craftable = person ? (rpgRecipeCanCraft(person, recipe) ? "제작 가능" : "재료 부족") : "";
  const craftableText = craftable ? ` / ${craftable}` : "";
  return `${recipe.itemId}. [${slot}${setName}] ${recipe.name} - ${rpgMaterialText(recipe, person)} + ${formatPoint(recipe.pointCost)} / 전투력 +${recipe.power}${craftableText}`;
}

function blacksmithCommand(roomState = null, sender = "") {
  const person = roomState && sender ? ensurePerson(roomState, sender) : null;
  return [
    "픽셀곰 대장간",
    "",
    "제작 종류: 무기 / 방어구 / 장신구 / 세트",
    "",
    ...RPG_WEAPON_RECIPES.map((recipe) => rpgRecipeLine(recipe, person)),
    "",
    "/제작가능 으로 지금 만들 수 있는 장비를 확인합니다.",
    "/제작 번호 로 장비를 만들면 현재 장비보다 강할 때 자동 장착됩니다.",
    "/세트아이템 으로 세트 보너스를 확인합니다."
  ].join("\n");
}

function craftWeaponCommand(roomState, sender, text) {
  const recipeId = parseProductIdFromCommand(text, /^\/제작\s*/i);
  const recipe = RPG_WEAPON_RECIPES.find((item) => item.itemId === recipeId);
  if (!recipe) return "형식: /제작 12001";
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

function craftableEquipmentCommand(roomState, sender) {
  const person = ensurePerson(roomState, sender);
  const craftable = RPG_WEAPON_RECIPES.filter((recipe) => rpgRecipeCanCraft(person, recipe));
  return [
    "제작 가능 목록",
    "",
    ...(craftable.length
      ? craftable.map((recipe) => rpgRecipeLine(recipe, person))
      : ["현재 제작 가능한 장비가 없습니다. /던전에서 재료를 모아주세요."]),
    "",
    `보유 포인트 : ${formatPoint(person.points)}`,
    "전체 제작식: /대장간",
    "세트 보너스: /세트아이템"
  ].join("\n");
}

function rpgEquipmentSlot(product) {
  if (!product) return "";
  if (["weapon", "armor", "accessory"].includes(product.slot)) return product.slot;
  if (["weapon", "armor", "accessory"].includes(product.category)) return product.category;
  return "";
}

function autoEquipIfBetter(person, product) {
  const slot = rpgEquipmentSlot(product);
  if (!slot) return false;
  person.equipment = normalizeEquipment(person.equipment || {});
  const current = systemProductById(person.equipment[slot]);
  if (!current || Number(product.power || 0) > Number(current.power || 0)) {
    person.equipment[slot] = String(product.id);
    return true;
  }
  return false;
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
  const weapon = systemProductById(person.equipment?.weapon);
  const armor = systemProductById(person.equipment?.armor);
  const accessory = systemProductById(person.equipment?.accessory);
  const setBonus = rpgSetBonusSummary(person);
  const basePower = [weapon, armor, accessory].reduce((sum, item) => sum + Number(item?.power || 0), 0);
  return [
    `${person.currentName}님의 장비`,
    "",
    `• 무기 : ${weapon ? `${weapon.name} (#${weapon.id}, 전투력 +${weapon.power || 0})` : "미장착"}`,
    `• 방어구 : ${armor ? `${armor.name} (#${armor.id}, 전투력 +${armor.power || 0})` : "미장착"}`,
    `• 장신구 : ${accessory ? `${accessory.name} (#${accessory.id}, 전투력 +${accessory.power || 0})` : "미장착"}`,
    `• 세트 효과 : ${setBonus.active.length ? setBonus.active.join(", ") : "없음"}`,
    `• 총 전투력 : +${basePower + setBonus.totalBonus}`,
    "",
    "/장착 번호 로 가방의 장비를 장착합니다.",
    "/제작가능, /세트아이템 으로 다음 제작 목표를 확인하세요."
  ].join("\n");
}

function equipWeaponCommand(roomState, sender, text) {
  const productId = parseProductIdFromCommand(text, /^\/장착\s*/i);
  const product = systemProductById(productId);
  const slot = rpgEquipmentSlot(product);
  if (!product || !slot) return "형식: /장착 12001";
  const person = ensurePerson(roomState, sender);
  if (inventoryQuantity(person, productId) <= 0) return "가방에 해당 장비가 없습니다.";
  person.equipment[slot] = String(productId);
  return [
    "장착 완료",
    "",
    `• 종류 : ${RPG_EQUIPMENT_SLOT_LABELS[slot] || "장비"}`,
    `• 장비 : ${product.name}`,
    `• 전투력 : +${product.power || 0}`
  ].join("\n");
}

function rpgSetItemsCommand() {
  const lines = ["RPG 세트 아이템", ""];
  for (const [setId, set] of Object.entries(RPG_EQUIPMENT_SETS)) {
    const pieces = set.pieces.map((id) => {
      const product = systemProductById(id);
      return `#${id} ${product?.name || id}`;
    }).join(", ");
    lines.push(`• ${set.name}: ${set.description}`);
    lines.push(`  구성: ${pieces}`);
    lines.push(`  보너스: 2세트 +${set.bonuses[2] || 0}, 3세트 +${set.bonuses[3] || 0}`);
  }
  lines.push("", "제작식: /대장간", "지금 가능한 제작: /제작가능");
  return lines.join("\n");
}

function monsterDexCommand() {
  const preview = PIXEL_MONSTER_SPECIES.slice(0, 10)
    .map((species) => `${species.speciesId}. ${species.name} [${species.element}/${species.rarityLabel}]`)
    .join("\n");
  return [
    "픽셀몬스터 도감",
    "",
    `총 ${PIXEL_MONSTER_SPECIES_COUNT}종`,
    preview,
    "",
    "/몬스터탐험 으로 발견하고 /포획 으로 수집합니다."
  ].join("\n");
}

function randomPixelMonsterSpecies() {
  return PIXEL_MONSTER_SPECIES[Math.floor(Math.random() * PIXEL_MONSTER_SPECIES.length)] || PIXEL_MONSTER_SPECIES[0];
}

function monsterExploreCommand(roomState, sender) {
  const person = ensurePerson(roomState, sender);
  const cooldown = gameCooldownText(person, "monsterExplore");
  if (cooldown) return cooldown;
  const species = randomPixelMonsterSpecies();
  person.pendingMonster = { speciesId: species.speciesId, discoveredAt: nowIso() };
  markGameCooldown(person, "monsterExplore");
  return [
    "몬스터 탐험",
    "",
    `${person.currentName}님이 ${species.name}을(를) 발견했습니다.`,
    `속성: ${species.element} / 등급: ${species.rarityLabel}`,
    "/포획 으로 포획을 시도하세요."
  ].join("\n");
}

function monsterCaptureCommand(roomState, sender) {
  const person = ensurePerson(roomState, sender);
  const pending = normalizePendingMonster(person.pendingMonster);
  if (!pending) return "발견한 몬스터가 없습니다. /몬스터탐험 으로 먼저 찾아주세요.";
  const species = pixelMonsterSpeciesById(pending.speciesId);
  const firstMonsterBonus = person.monsters.length === 0;
  const success = firstMonsterBonus || Math.random() < species.catchRate;
  person.pendingMonster = null;
  if (!success) {
    return [
      "포획 실패",
      "",
      `${species.name}이(가) 도망갔습니다.`,
      "다시 /몬스터탐험 으로 도전해 주세요."
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
    caughtAt: nowIso()
  };
  person.monsters.push(monster);
  return [
    "포획 성공",
    "",
    `${person.currentName}님이 ${species.name}을(를) 동료로 맞이했습니다.`,
    `보유 몬스터: ${person.monsters.length}마리`
  ].join("\n");
}

function monsterListCommand(roomState, sender) {
  const person = ensurePerson(roomState, sender);
  if (!person.monsters.length) return `${person.currentName}님의 몬스터가 없습니다. /몬스터탐험 으로 시작해 주세요.`;
  return [
    `${person.currentName}님의 몬스터`,
    "",
    ...person.monsters.slice(0, 20).map((monster, index) => {
      const species = pixelMonsterSpeciesById(monster.speciesId);
      return `${index + 1}. ${monster.name} Lv.${monster.level} [${species?.element || monster.element}] EXP ${monster.exp}`;
    })
  ].join("\n");
}

function firstOwnedMonster(person) {
  normalizePersonState(person);
  return person.monsters[0] || null;
}

function monsterTrainCommand(roomState, sender) {
  const person = ensurePerson(roomState, sender);
  const monster = firstOwnedMonster(person);
  if (!monster) return "훈련할 몬스터가 없습니다. /몬스터탐험 과 /포획 을 먼저 진행해 주세요.";
  const cooldown = gameCooldownText(person, "monsterTrain");
  if (cooldown) return cooldown;
  monster.exp += 25;
  if (monster.exp >= monster.level * 50) {
    monster.exp = 0;
    monster.level += 1;
  }
  markGameCooldown(person, "monsterTrain");
  return [
    "몬스터 훈련",
    "",
    `${monster.name} 훈련 완료`,
    `레벨: ${monster.level}`,
    `경험치: ${monster.exp}`
  ].join("\n");
}

function monsterBattleCommand(roomState, sender) {
  const person = ensurePerson(roomState, sender);
  const monster = firstOwnedMonster(person);
  if (!monster) return "전투할 몬스터가 없습니다. /몬스터탐험 과 /포획 을 먼저 진행해 주세요.";
  const cooldown = gameCooldownText(person, "monsterBattle");
  if (cooldown) return cooldown;
  const species = pixelMonsterSpeciesById(monster.speciesId);
  const power = (species?.basePower || 10) + monster.level * 3;
  const reward = 20 + monster.level * 5;
  monster.exp += 15;
  person.points += reward;
  markGameCooldown(person, "monsterBattle");
  return [
    "몬스터 전투",
    "",
    `${monster.name}이(가) 훈련용 상대와 전투했습니다.`,
    `전투력: ${power}`,
    `획득: ${formatPoint(reward)}`,
    `보유 포인트: ${formatPoint(person.points)}`
  ].join("\n");
}

function petAdoptCommand(roomState, sender, text) {
  const person = ensurePerson(roomState, sender);
  if (person.pet) return `${person.currentName}님은 이미 ${person.pet.name}을(를) 키우고 있습니다. /펫 으로 상태를 확인해 주세요.`;
  const name = compactSpaces(text.replace(/^\/펫입양\s*/i, "")).slice(0, 24) || "픽셀펫";
  const species = PET_SPECIES[Math.floor(Math.random() * PET_SPECIES.length)] || PET_SPECIES[0];
  person.pet = normalizePetState({ name, species, hunger: 20, happiness: 70, energy: 70, cleanliness: 70, health: 90, level: 1, exp: 0, bornAt: nowIso(), updatedAt: nowIso() });
  return [
    "펫 입양 완료",
    "",
    `${person.currentName}님이 ${person.pet.name} (${person.pet.species})을(를) 입양했습니다.`,
    "/펫 으로 상태를 확인해 주세요."
  ].join("\n");
}

function petStatusCommand(roomState, sender) {
  const person = ensurePerson(roomState, sender);
  if (!person.pet) return "키우는 펫이 없습니다. /펫입양 이름 으로 입양해 주세요.";
  const pet = person.pet;
  return [
    `${person.currentName}님의 펫`,
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
    "펫 상점",
    "",
    `${snack.id}. ${snack.name} - ${formatPoint(snack.price)} / 판매가 ${formatPoint(snack.sellPrice)}`,
    "v1에서는 /펫먹이, /펫놀기, /펫씻기, /펫재우기 를 바로 사용할 수 있습니다.",
    `보유 포인트: ${formatPoint(person.points)}`
  ].join("\n");
}

function gameHelpText(roomState) {
  const enabled = featureEnabled(roomState, "games");
  const settings = gameSettings(roomState);
  return [
    "픽셀곰 미니게임",
    "",
    `상태: ${enabled ? "켜짐" : "꺼짐"}`,
    `시즌: ${settings.seasonName}`,
    gameSeasonStatusText(settings),
    gameSeasonPeriodText(settings),
    `주사위 기본 보상: ${formatPoint(settings.diceReward)} x 결과`,
    `낚시: 기본 미끼 1개로 300종 물고기 중 1개 획득`,
    `탐험: 판매 가능한 전리품 획득`,
    `RPG: 던전 재료 ${RPG_ITEM_CATALOG_SIZE}종, 장비 제작, 자동 장착, 세트 보너스`,
    `픽셀몬스터: 오리지널 몬스터 ${PIXEL_MONSTER_SPECIES_COUNT}종 수집`,
    "펫키우기: 개인별 펫 입양, 돌봄, 훈련",
    "",
    "/주사위 - 1~6 결과에 따라 포인트 획득, 10초 쿨타임",
    "/미끼상점, /미끼구매 수량 - 낚시 미끼 구매",
    "/낚시 - 물고기를 가방에 보관, 30초 쿨타임",
    "/어항 또는 /수족관 - 물고기 수집 현황",
    "/탐험 - 전리품을 가방에 보관, 20초 쿨타임",
    "/던전, /대장간, /제작가능, /제작 번호, /장비, /세트아이템 - RPG 모험",
    "/몬스터탐험, /포획, /몬스터목록, /몬스터훈련, /몬스터전투 - 수집 RPG",
    "/펫입양, /펫, /펫먹이, /펫놀기, /펫씻기, /펫재우기, /펫훈련 - 펫키우기",
    `/뽑기 - 가상 포인트 뽑기 ${formatPoint(LUCKY_DRAW_POINT_COST)}, 10초 쿨타임`,
    "/뽑기목록 - 뽑기 확률과 보상 확인",
    "/홀 금액 또는 /짝 금액 - 홀짝 베팅, 5초 쿨타임",
    "/판매 번호 수량 - 가방 아이템을 포인트로 판매",
    "",
    enabled ? "게임 보상 아이템은 /가방 에 들어가며 /판매 로 포인트화할 수 있습니다." : "관리자가 /기능켜기 게임 을 실행하면 사용할 수 있습니다."
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
    `• 대상 : ${person.currentName}`,
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
  const nameLine = `${profile?.alias ? "🌿" : "🥚"}${person.currentName}${profile?.alias ? ` (${profile.alias})` : ""}`;
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
    lines.push(`${medal(rank)} ${item.person.currentName} ${config.value(item, total)}`);
  });
  if (!rows.length) lines.push("기록 없음");
  return lines.join("\n");
}

function personHistoryText(roomState, query, sender) {
  const target = stripKakaoSuffix(query) || sender;
  const key = resolveName(roomState, target);
  const person = roomState.people[key];
  if (!person) return `"${target}" 닉네임 기록이 없습니다.`;
  const lines = [`${person.currentName || target}님 히스토리`, ""];
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
      `• ${person.currentName || "이름없음"} - 마지막 퇴장 ${shortKstDate(new Date(lastExitAt))}`,
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
    `${person.currentName || target}님 입퇴장 상세`,
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

function welcomeText(person, reentryCandidateText = "") {
  const lines = [
    `${person.currentName}님 어서오세요👀`
  ];
  if (reentryCandidateText) lines.push("", reentryCandidateText);
  return lines.join("\n");
}

function reentryText(roomState, person) {
  const kickCount = person.kicks?.length || 0;
  const lines = [
    `⚠ ${person.currentName}님 ${person.entries.length}회 재입장 ⚠`,
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
  if (count <= 1) return welcomeText(person, identityId ? "" : recentExitCandidateText(roomState, person.currentName));
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
    `${person.currentName}님 안녕히 가세요👀`,
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
  "/게임", "/게임명령어", "/주사위", "/낚시", "/탐험", "/뽑기", "/확률뽑기", "/뽑기목록", "/홀", "/짝", "/홀짝",
  "/미끼상점", "/미끼구매", "/어항", "/수족관",
  "/던전", "/던전목록", "/대장간", "/제작가능", "/제작", "/장비", "/장착", "/세트아이템",
  "/몬스터탐험", "/포획", "/몬스터", "/몬스터목록", "/몬스터훈련", "/몬스터전투", "/몬스터도감",
  "/펫입양", "/펫", "/펫먹이", "/펫놀기", "/펫씻기", "/펫재우기", "/펫훈련", "/펫상점"
]);
const GAME_ROOM_ECONOMY_COMMANDS = new Set([
  "/포인트", "/내포인트", "/내정보", "/레벨", "/정보", "/가방", "/판매", "/구매내역", "/상점", "/구매"
]);
const GAME_ROOM_DIAGNOSTIC_COMMANDS = new Set([
  "/상태", "/status", "/브릿지", "/bridge", "/js상태", "/jsstatus", "/로컬상태", "/도움말", "/help", "/?", "/게임팩도움말"
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
  if (/^\/(?:프로필|프로칠|프로필등록|프로필삭제|별명등록|별명삭제|닉병합|닉네임병합|별명병합)(?:\s|$)/.test(command)) return "profiles";
  if (/^\/(?:게임|주사위|낚시|탐험|확률뽑기|뽑기|뽑기목록|홀짝|홀|짝|미끼상점|미끼구매|어항|수족관|던전|던전목록|대장간|제작가능|제작|장비|장착|세트아이템|몬스터탐험|포획|몬스터|몬스터목록|몬스터훈련|몬스터전투|몬스터도감|펫입양|펫|펫먹이|펫놀기|펫씻기|펫재우기|펫훈련|펫상점)(?:\s|$)/.test(command)) return "games";
  if (/^\/(?:포인트|내포인트|좋아요|응원|응원카드|이체|포인트지급|포인트차감|포인트설정|내정보|레벨|정보)(?:\s|$)/.test(command)) return "points";
  if (/^\/(?:상점|구매|구매내역|가방|사용|가방선물|판매|상점추가|상점수정|상점삭제|상점초기화|상점내역|아이템지급|아이템회수)(?:\s|$)/.test(command)) return "shop";
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
  registryEntry("/도움말", "기본", "현재 사용 가능한 명령어 확인", { aliases: ["/help", "/?"], searchableKeywords: ["help", "명령어"] }),
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
  registryEntry("/내정보", "포인트", "레벨, 포인트, 채팅 정보 확인", { aliases: ["/레벨"], requiresFeature: "points" }),
  registryEntry("/좋아요", "포인트", "포인트로 하트 보내기", { examples: ["/좋아요 닉네임 10"], requiresFeature: "points", searchableKeywords: ["하트"] }),
  registryEntry("/응원", "포인트", "포인트 응원 카드 보내기", { examples: ["/응원 닉네임 메시지"], requiresFeature: "points" }),
  registryEntry("/뽑기", "게임", "공개 확률 포인트 뽑기", { aliases: ["/확률뽑기"], requiresFeature: "games", searchableKeywords: ["포인트", "확률", "랜덤"] }),
  registryEntry("/뽑기목록", "게임", "뽑기 확률과 보상 확인", { requiresFeature: "games", searchableKeywords: ["포인트", "확률", "보상"] }),
  registryEntry("/홀", "게임", "홀짝 포인트 베팅", { aliases: ["/짝", "/홀짝"], examples: ["/홀 100", "/짝 100"], requiresFeature: "games", searchableKeywords: ["포인트", "베팅"] }),
  registryEntry("/이체", "포인트", "포인트 이체", { examples: ["/이체 닉네임 100"], requiresFeature: "points" }),
  registryEntry("/포인트순위", "랭킹", "방별 랭킹 확인", { aliases: ["/좋아요순위", "/레벨순위", "/채팅오늘", "/채팅금주"], requiresFeature: "rankings" }),
  registryEntry("/미끼상점", "게임", "낚시용 미끼 가격 확인", { requiresFeature: "games", searchableKeywords: ["낚시", "미끼", "상점"] }),
  registryEntry("/미끼구매", "게임", "포인트로 낚시 미끼 구매", { examples: ["/미끼구매 10"], requiresFeature: "games", searchableKeywords: ["낚시", "미끼", "구매"] }),
  registryEntry("/어항", "게임", "보유 물고기와 수집률 확인", { aliases: ["/수족관"], requiresFeature: "games", searchableKeywords: ["낚시", "물고기", "수집"] }),
  registryEntry("/상점", "상점/가방", "구매 가능한 아이템 확인", { requiresFeature: "shop" }),
  registryEntry("/구매", "상점/가방", "포인트로 아이템 구매", { examples: ["/구매 1", "/구매 1 10"], requiresFeature: "shop" }),
  registryEntry("/가방", "상점/가방", "내 아이템 확인", { requiresFeature: "shop" }),
  registryEntry("/사용", "상점/가방", "아이템 사용", { examples: ["/사용 1"], requiresFeature: "shop" }),
  registryEntry("/가방선물", "상점/가방", "아이템 선물", { examples: ["/가방선물 닉네임 1 1"], requiresFeature: "shop" }),
  registryEntry("/판매", "상점/가방", "가방 아이템을 포인트로 판매", { examples: ["/판매 10000 1"], requiresFeature: "shop" }),
  registryEntry("/구매내역", "상점/가방", "구매와 아이템 내역", { requiresFeature: "shop" }),
  registryEntry("/게임", "게임", "미니게임 안내", { requiresFeature: "games" }),
  registryEntry("/주사위", "게임", "주사위 보상 게임", { requiresFeature: "games" }),
  registryEntry("/낚시", "게임", "낚시 보상 게임", { requiresFeature: "games" }),
  registryEntry("/탐험", "게임", "탐험 보상 게임", { requiresFeature: "games" }),
  registryEntry("/던전", "RPG", "던전 탐험과 재료 획득", { aliases: ["/던전목록"], examples: ["/던전", "/던전 중급"], requiresFeature: "games", searchableKeywords: ["RPG", "모험", "재료"] }),
  registryEntry("/대장간", "RPG", "장비 제작 레시피 확인", { aliases: ["/제작", "/제작가능", "/장비", "/장착", "/세트아이템"], examples: ["/대장간", "/제작가능", "/제작 12001"], requiresFeature: "games", searchableKeywords: ["무기", "방어구", "장신구", "제작", "장비", "세트"] }),
  registryEntry("/몬스터탐험", "픽셀몬스터", "오리지널 몬스터 발견", { aliases: ["/포획", "/몬스터", "/몬스터목록", "/몬스터훈련", "/몬스터전투", "/몬스터도감"], requiresFeature: "games", searchableKeywords: ["몬스터", "수집", "도감"] }),
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
  registryEntry("/입퇴장현황", "히스토리", "입퇴장과 닉네임 이력 조회", { aliases: ["/닉이력"], examples: ["/닉이력 닉네임"], requiresFeature: "history" }),
  registryEntry("/원본로그", "관리자", "최신 원본 JSON 확인", { aliases: ["/원본이벤트"], visibility: "admin", requiresRole: "admin", requiresFeature: "history" }),
  registryEntry("/최근이벤트", "관리자", "브릿지 원본 이벤트 요약", { aliases: ["/이벤트로그"], visibility: "admin", requiresRole: "admin", requiresFeature: "history" }),
  registryEntry("/신고목록", "관리자", "접수된 신고 목록 확인", { visibility: "admin", requiresRole: "admin", searchableKeywords: ["신고", "처리", "관리자"] }),
  registryEntry("/신고처리", "관리자", "신고 처리 완료 기록", { visibility: "admin", requiresRole: "admin", examples: ["/신고처리 R0001 처리 완료"], searchableKeywords: ["신고", "처리", "관리자"] }),
  registryEntry("/프로필등록", "관리자", "프로필 등록", { aliases: ["/프로필 등록"], visibility: "admin", requiresRole: "admin", requiresFeature: "profiles" }),
  registryEntry("/프로필삭제", "관리자", "프로필 삭제", { visibility: "admin", requiresRole: "admin", requiresFeature: "profiles" }),
  registryEntry("/별명등록", "관리자", "별명 등록", { visibility: "admin", requiresRole: "admin", requiresFeature: "profiles" }),
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
  registryEntry("/상점추가", "관리자", "상점과 아이템 관리", { aliases: ["/상점수정", "/상점삭제", "/상점초기화", "/상점내역", "/아이템지급", "/아이템회수"], visibility: "admin", requiresRole: "admin", requiresFeature: "shop" })
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
  const lines = [`${DEFAULT_BOT_NAME} ${isAdminUser ? "관리자 명령어" : "참여자 명령어"}`, ""];
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
  const subscription = updateSubscriptionStatus(roomState);
  const diagnostics = roomDiagnostics(roomState);
  const license = licenseSettings(roomState);
  const settings = roomState.settings || {};
  const role = normalizeRoomRole(settings.roomRole);
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
      buyerEditable: ["modeSplit", "commandPacks", "inquiries", "transfers", "restoreRequests"],
      adminOnly: ["roomName", "license", "payment", "subscription", "admins"]
    },
    diagnostics
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

function adminRoomLogsPayload(state = {}, query = {}) {
  const requestedRoom = normalizeText(query.room || query.roomName || "");
  const requestedType = normalizeText(query.type || query.eventType || "");
  const requestedCommand = normalizeText(query.command || "");
  const keyword = normalizeText(query.q || query.query || "");
  const limit = Math.min(
    Math.max(1, Number(query.limit || ROOM_ANALYTICS_EXPORT_LIMIT) || ROOM_ANALYTICS_EXPORT_LIMIT),
    ROOM_ANALYTICS_EXPORT_LIMIT
  );
  const rooms = Object.values(state.rooms || {}).filter((roomState) => {
    if (!requestedRoom) return true;
    return roomKey(roomState.name) === roomKey(requestedRoom);
  });
  const allLogs = rooms.flatMap((roomState) => (roomState.analyticsLogs || []).map((log) => ({
    ...log,
    room: log.room || roomState.name || ""
  })));
  const filtered = allLogs
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
  const now = Date.now();
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
      q: keyword
    },
    summary: {
      rooms: roomSummaries.length,
      totalLogs: roomSummaries.reduce((sum, room) => sum + room.count, 0),
      matchedLogs: filtered.length,
      recent24h,
      commandLogs: commandLogs.length,
      errorLogs: errorLogs.length,
      topCommands
    },
    rooms: roomSummaries,
    logs: filtered.slice(0, limit)
  };
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function roomLogsCsv(logs = []) {
  const headers = ["at", "room", "sender", "eventType", "command", "isCommand", "messagePreview", "messageHash", "senderHash"];
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

function roomViewExpiringSoon(room, warningDays = 7) {
  const remaining = Number(room.subscription?.remainingDays);
  return room.subscription?.status === "active" && Number.isFinite(remaining) && remaining >= 0 && remaining <= warningDays;
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
    return {
      baseApplication: publicApplicationView(application, state),
      baseRoom: roomByKey.get(roomKey(application.roomName)) || roomAdminView(ensureRoom(state, application.roomName), state, { application }),
      gameApplications: linkedGameApplications.map((item) => publicApplicationView(item, state)),
      gameRooms: linkedGameApplications.map((item) => roomByKey.get(roomKey(item.roomName)) || roomAdminView(ensureRoom(state, item.roomName), state, { application: item })),
      roomModeSettings: roomModeSettingsPayload(state, application, linkedGameApplications),
      bridgeDiagnostics: bridgeConnectDiagnosticsPayload(state, account, application, bridgeConnectRoomsPayload(state, account, application)),
      bridgeRoomsPreview: bridgeConnectRoomsPayload(state, account, application),
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
      gameRooms: [roomByKey.get(roomKey(gameApplication.roomName)) || roomAdminView(ensureRoom(state, gameApplication.roomName), state, { application: gameApplication })],
      roomModeSettings: roomModeSettingsPayload(state, {}, [gameApplication]),
      bridgeDiagnostics: bridgeConnectDiagnosticsPayload(state, account, gameApplication, bridgeConnectRoomsPayload(state, account, gameApplication)),
      bridgeRoomsPreview: bridgeConnectRoomsPayload(state, account, gameApplication),
      connectCode: applicationRoomPayload(state, account, gameApplication).bridgeConnectCode || ""
    });
  }
  return groups.sort((left, right) => keyFor(left.baseRoom?.name || left.gameRooms?.[0]?.name).localeCompare(keyFor(right.baseRoom?.name || right.gameRooms?.[0]?.name)));
}

function adminRoomsPayload(state) {
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

function loginAccount(state, payload = {}) {
  const email = normalizeEmail(payload.email);
  const password = String(payload.password || "");
  const account = findAccountByEmail(state, email);
  if (!account || !verifyPassword(password, account.passwordHash)) {
    return { ok: false, status: 401, error: "invalid_login" };
  }
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
    const account = external.account;
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
  return loginAccount(state, body);
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
  if (/주사위|낚시|탐험|뽑기|홀짝|게임/u.test(commandText)) candidates.push("game-chance");
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
    .slice(0, 12);
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
  const lines = ["명령어 설치 현황"];
  lines.push("", "장착된 팩", ...(packs.length ? packs.map((pack) => {
    const detail = publicCommandPack(pack, current);
    const commandNames = detail.commandsDetailed.map((item) => item.command).join(", ");
    return `- ${detail.installCode || pack.id} ${pack.title} · ${detail.commandCount}개\n  포함 명령어: ${commandNames}`;
  }) : ["- 없음"]));
  lines.push("", `커스텀 명령어 ${commands.length}개`, ...(commands.length ? commands.slice(0, 12).map((command) => [
    `- ${command.trigger}`,
    `  설치 코드 : ${command.installCode || "직접등록"}`,
    `  삭제 코드 : ${command.deleteCode}`,
    `  예: ${command.deleteCommand}`
  ].join("\n")) : ["- 없음"]));
  if (draft) lines.push("", `확인 대기: /설치확인 ${draft.code} (${draft.expiresAt.slice(11, 16)}까지)`);
  if (!current.installedPackIds.length && !current.basePackId && !current.addonPackIds.length) lines.push("", "추천: /명령어설치 pk.001 로 운영 기본팩을 먼저 장착해 보세요.");
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
  return [
    "사용 가능한 명령어팩",
    "",
    ...packs.map((pack) => {
      const detail = publicCommandPack(pack);
      return `- ${detail.installCode} ${pack.title} · ${detail.commandCount}개`;
    }),
    "",
    "상세: /명령어팩 pk.001",
    "설치: /명령어설치 pk.001",
    "제거: /명령어팩제거 pk.001"
  ].join("\n");
}

function commandPackDetailText(pack, roomState = null) {
  const detail = publicCommandPack(pack, roomState?.settings?.commandPacks || {});
  const commands = detail.commandsDetailed.map((item) => {
    const featureText = item.requiresFeature ? ` / 기능:${featureLabel(item.requiresFeature)}` : "";
    const roleText = item.requiresRole === "admin" ? " / 관리자" : "";
    return `- ${item.command} - ${item.description}${roleText}${featureText}`;
  });
  return [
    `${detail.title}`,
    "",
    detail.description,
    "",
    `팩 코드: ${detail.installCode || detail.id}`,
    `포함 명령어: ${detail.commandCount}개`,
    `도움말: ${detail.helpPath || "/command-store"}`,
    "",
    "포함 명령어",
    ...commands,
    "",
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

  if (req.method === "POST" && url.pathname === "/api/buyer/account/profile") {
    const body = await readBody(req);
    const state = await loadState();
    const result = await buyerAccountProfileFromRequest(state, req, body);
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
  const registryItem = resolveCommandRegistryItem(command, compactCommand);
  if (registryItem && !commandInstalledInRoom(registryItem, roomState)) return commandInstallRequiredText(registryItem);
  const requiredFeature = commandFeatureKey(compactCommand);
  if (requiredFeature && !featureEnabled(roomState, requiredFeature)) return featureDisabledText(requiredFeature);
  if (command === "/도움말" || command === "/help" || command === "/?") {
    const helpTopic = parsed.args.join(" ");
    return helpTopic ? gamePackHelpText(helpTopic) : helpText(roomState, sender);
  }
  if (command === "/게임") return gameHelpText(roomState);
  if (command === "/주사위") return diceGameCommand(roomState, sender);
  if (command === "/미끼상점") return baitShopCommand(roomState, sender);
  if (command === "/미끼구매") return baitPurchaseCommand(roomState, sender, text);
  if (command === "/낚시") return fishingGameCommand(roomState, sender);
  if (command === "/어항" || command === "/수족관") return aquariumCommand(roomState, sender, text);
  if (command === "/탐험") return exploreGameCommand(roomState, sender);
  if (command === "/던전목록") return dungeonListCommand();
  if (command === "/던전") return dungeonCommand(roomState, sender, text);
  if (command === "/대장간") return blacksmithCommand(roomState, sender);
  if (command === "/제작가능") return craftableEquipmentCommand(roomState, sender);
  if (command === "/제작") return craftWeaponCommand(roomState, sender, text);
  if (command === "/장비") return equipmentCommand(roomState, sender);
  if (command === "/장착") return equipWeaponCommand(roomState, sender, text);
  if (command === "/세트아이템") return rpgSetItemsCommand();
  if (command === "/몬스터도감") return monsterDexCommand();
  if (command === "/몬스터탐험") return monsterExploreCommand(roomState, sender);
  if (command === "/포획") return monsterCaptureCommand(roomState, sender);
  if (command === "/몬스터" || command === "/몬스터목록") return monsterListCommand(roomState, sender);
  if (command === "/몬스터훈련") return monsterTrainCommand(roomState, sender);
  if (command === "/몬스터전투") return monsterBattleCommand(roomState, sender);
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
  if (command === "/확률뽑기" || command === "/뽑기") return luckyDrawCommand(roomState, sender);
  if (command === "/홀짝" || /^\/(?:홀|짝)(?:\s|$)/.test(command)) return oddEvenCommand(roomState, sender, text);
  if (command === "/이체") return transferCommand(roomState, sender, text);
  if (command === "/상점") return shopListCommand(roomState, sender);
  if (command === "/구매") return purchaseItemCommand(roomState, sender, text);
  if (command === "/구매내역") return purchaseHistoryCommand(roomState, sender);
  if (command === "/가방") return inventoryCommand(roomState, sender, text);
  if (command === "/사용") return useItemCommand(roomState, sender, text);
  if (command === "/가방선물") return giftItemCommand(roomState, sender, text);
  if (command === "/판매") return sellItemCommand(roomState, sender, text);
  if (command === "/상점추가") return shopAddCommand(roomState, sender, text);
  if (command === "/상점수정") return shopUpdateCommand(roomState, sender, text);
  if (command === "/상점삭제") return shopDeleteCommand(roomState, sender, text);
  if (command === "/상점초기화") return shopResetCommand(roomState, sender);
  if (command === "/상점내역") return shopHistoryCommand(roomState, sender);
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
    return appendOperationalNotice(roomState, sender, text, reply);
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
  return kakaoText(reply || "");
}

export async function handleChatEvent(payload) {
  const room = normalizeText(payload?.room);
  const message = normalizeText(payload?.msg || payload?.message);
  const sender = normalizeText(payload?.sender) || "익명";
  const event = payloadSystemEvent(payload, message);
  const identity = payloadIdentity(payload);
  const state = await loadState();
  const roomState = ensureRoom(state, room);
  const registeredRoom = isRegisteredRoomPayload(payload, state, room);
  const registrationCommand = roomRegistrationCommand(message);
  if (!registeredRoom && registrationCommand && !isGroupChatPayload(payload)) {
    return { ok: true, reply: null, ignored: true, reason: "non_group_chat" };
  }
  if (!registeredRoom && !registrationCommand && !isGroupChatPayload(payload)) {
    return { ok: true, reply: null, ignored: true, reason: "non_group_chat" };
  }
  if (!registeredRoom && !registrationCommand) {
    return { ok: true, reply: null, ignored: true, reason: "unregistered_room" };
  }
  const licenseGuard = licenseGuardResult(roomState, payload, message, registrationCommand);
  if (licenseGuard) {
    await saveState(state);
    return licenseGuard;
  }
  // Runtime chat payloads must not overwrite admin-owned room settings.
  recordRawEvent(roomState, payload, { room, sender, message, event });

  if (!message || isBotSender(sender)) {
    await saveState(state);
    return { ok: true, reply: null, ignored: true };
  }

  const reply = await handleMessage(state, room, sender, message, { ...identity, payload, physicalRoomState: roomState }, event);
  await saveState(state);
  return {
    ok: true,
    reply,
    ignored: false,
    handled: Boolean(reply)
  };
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
      || pathname === "/api/command-templates"
      || pathname === "/api/command-packs"
      || pathname === "/api/game-pack-help"
      || pathname.startsWith("/api/game-pack-help/")
      || pathname === "/api/signup"
      || pathname === "/api/apply"
      || pathname === "/api/login"
      || pathname === "/api/buyer/guide"
      || pathname === "/api/buyer/console"
      || pathname === "/api/buyer/account/profile"
      || pathname === "/api/application-inquiries"
      || pathname === "/api/buyer/room-mode-settings"
      || pathname === "/api/buyer/game-room-link"
      || pathname === "/api/buyer/restore-requests"
      || pathname === "/api/buyer/room-transfer/create"
      || pathname === "/api/buyer/room-transfer/accept"
      || pathname === "/api/buyer/room-transfer/cancel"
      || pathname === "/api/buyer/command-templates/install"
      || pathname === "/api/buyer/command-packs/apply"
      || pathname === "/api/buyer/room-command-packs"
      || pathname === "/api/buyer/custom-commands"
      || pathname === "/api/buyer/room-commands"
      || pathname === "/api/buyer/custom-commands/delete"
      || pathname === "/api/bridge/connect"
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
