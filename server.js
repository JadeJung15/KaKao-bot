import http from "node:http";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const DEFAULT_BOT_NAME = process.env.BOT_DISPLAY_NAME || "운영봇";
const ROOM_BRAND_NAME = process.env.ROOM_BRAND_NAME || "무잔썸";
const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_DIR = path.join(__dirname, "data");
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, "room-ops-db.json");
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

export const APP_VERSION = "0.4.33";
export const FEATURES = [
  "health-check",
  "chat-event-webhook",
  "kakao-skill-webhook",
  "role-based-help",
  "identity-conflict-guard",
  "profile-registry",
  "alias-registry",
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
  "no-games",
  "bridge-self-test-commands",
  "entry-reentry-candidate-history",
  "reserved-name-nickname-guard"
];

const DEFAULT_REGISTERED_ROOM_LINKS = ["https://open.kakao.com/o/gu25P5vi"];

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
const REENTRY_CANDIDATE_WINDOW_MS = 24 * 60 * 60 * 1000;
const LUCKY_DRAW_OUTCOMES = [
  { threshold: 0.05, label: "대박", reward: 500, chance: "5%" },
  { threshold: 0.20, label: "성공", reward: 200, chance: "15%" },
  { threshold: 0.50, label: "본전", reward: 100, chance: "30%" },
  { threshold: 1, label: "꽝", reward: 0, chance: "50%" }
];
const MAX_LIKE_AMOUNT = 999;

const initialState = {
  rooms: {},
  updatedAt: null
};

let pgPool;

function normalizeText(value) {
  return String(value ?? "").trim();
}

function compactSpaces(value) {
  return normalizeText(value).replace(/\s+/g, " ");
}

function keyFor(value) {
  return compactSpaces(value).toLowerCase();
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
    relativePath = pathname === "/" ? "index.html" : decodeURIComponent(pathname.replace(/^\/+/, ""));
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
    const cacheControl = [".ico", ".jpg", ".jpeg", ".png", ".svg", ".webp"].includes(extension)
      ? "public, max-age=31536000, immutable"
      : "no-cache";
    res.writeHead(200, {
      "content-type": STATIC_CONTENT_TYPES[extension] || "application/octet-stream",
      "cache-control": cacheControl
    });
    if (req.method === "HEAD") res.end();
    else res.end(body);
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
  await rename(tmpPath, DB_PATH);
}

function normalizeState(state) {
  state.rooms ||= {};
  return state;
}

function roomKey(room) {
  return keyFor(room || "default");
}

function roomTitle(room) {
  return normalizeText(room) || "기본방";
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
    events: [],
    rawEvents: [],
    peopleByIdentity: {},
    ambiguousIdentities: []
  };
  const roomState = state.rooms[key];
  roomState.name ||= roomTitle(room);
  roomState.profiles ||= {};
  roomState.aliases ||= {};
  roomState.people ||= {};
  roomState.admins ||= [];
  roomState.inbox ||= {};
  roomState.events ||= [];
  roomState.rawEvents ||= [];
  roomState.peopleByIdentity ||= {};
  roomState.ambiguousIdentities ||= [];
  for (const person of Object.values(roomState.people)) normalizePersonState(person);
  return roomState;
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
  const key = trustedIdentityKey || displayKey;
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
  if (trustedIdentityKey && displayKey && trustedIdentityKey !== displayKey) remapPersonKey(roomState, trustedIdentityKey, displayKey, person);
  if (!isAmbiguousIdentity(roomState, identityId)) attachPersonIdentity(roomState, displayKey || key, person, identityId);
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
  person.identities ||= [];
  person.firstChatReentryNotices ||= [];
  return person;
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

function recordRoomEvent(roomState, event) {
  roomState.events.push({ ...event, at: nowIso() });
  if (roomState.events.length > 500) roomState.events = roomState.events.slice(-500);
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

function registeredRoomIds() {
  const ids = listValues(
    process.env.REGISTERED_ROOM_IDS,
    process.env.REGISTERED_OPENCHAT_IDS,
    ...DEFAULT_REGISTERED_ROOM_LINKS
  );
  const links = listValues(process.env.REGISTERED_ROOM_LINKS, process.env.REGISTERED_OPENCHAT_LINKS);
  return new Set([...ids, ...links].map(openChatRoomId).filter(Boolean));
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

function isRegisteredRoomPayload(payload = {}) {
  const ids = registeredRoomIds();
  if (!ids.size) return true;
  const roomId = payloadRoomId(payload);
  return Boolean(roomId && ids.has(roomId));
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

function recordRawEvent(roomState, payload, meta = {}) {
  roomState.rawEvents ||= [];
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
  return `${profile.name}님의 별명이 ${alias} (으)로 등록되었습니다.`;
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

function unreadMessages(roomState, sender) {
  const key = resolveName(roomState, sender);
  return (roomState.inbox?.[key] || []).filter((message) => !message.readAt);
}

function unreadNoticeText(roomState, sender) {
  const messages = unreadMessages(roomState, sender);
  if (!messages.length) return null;
  const displayName = displayNameForKey(roomState, resolveName(roomState, sender), sender);
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
  if (!messages.length) return "메시지가 없습니다.";

  const readAt = nowIso();
  for (const message of messages) message.readAt = readAt;

  const displayName = displayNameForKey(roomState, key, sender);
  const lines = [`💌 ${displayName}님, ${messages.length}건의 메시지가 있습니다.`, ""];
  messages.forEach((message, index) => {
    lines.push(`${index + 1}.`);
    lines.push(`‣ 시간 : ${kstDateTime(new Date(message.at))}`);
    lines.push(`‣ 보낸사람 : ${message.from}`);
    lines.push(`‣ 내용 : ${message.content}`);
    if (index < messages.length - 1) lines.push("");
  });
  return lines.join("\n");
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

function recordActivity(roomState, sender, identityId = "", options = {}) {
  const person = ensurePerson(roomState, sender, identityId);
  if (!person) return null;
  const reentryNotice = options.firstChatNotice ? firstChatReentryNotice(roomState, person, sender, identityId) : null;
  const dateKey = kstDateKey();
  const weekKey = kstWeekKey();
  person.lastSeenAt = nowIso();
  person.points += CHAT_POINT_REWARD;
  person.chats.total += 1;
  person.chats.byDate[dateKey] = (person.chats.byDate[dateKey] || 0) + 1;
  person.chats.byWeek[weekKey] = (person.chats.byWeek[weekKey] || 0) + 1;
  const notices = grantExpAndLevel(person, CHAT_EXP_REWARD);
  return reentryNotice || notices[0] || null;
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
    `• /뽑기 : 가상 포인트 뽑기 ${formatPoint(LUCKY_DRAW_POINT_COST)}`,
    "• /홀 금액 또는 /짝 금액 : 맞히면 x2",
    "• /이체 닉네임 포인트 : 수수료 10%",
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

  const roll = Math.random();
  const outcome = LUCKY_DRAW_OUTCOMES.find((item) => roll < item.threshold) || LUCKY_DRAW_OUTCOMES.at(-1);
  person.points -= LUCKY_DRAW_POINT_COST;
  person.spentPoints += LUCKY_DRAW_POINT_COST;
  if (outcome.reward > 0) person.points += outcome.reward;

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

  const result = Math.random() < 0.5 ? "홀" : "짝";
  const isWin = bet.choice === result;
  const reward = isWin ? bet.amount * 2 : 0;
  person.points -= bet.amount;
  person.spentPoints += bet.amount;
  if (reward > 0) person.points += reward;

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
    `♟ ${person.currentName}님 ${ROOM_BRAND_NAME}에 와줘서 고마워♡☃`,
    "친구들과 함께 즐겁게 소통하는 공간이야 ♡",
    "",
    "☻그냥 나가게되면 1년간 썸못탄다ㅋ",
    "☻지금 나가면 뱃살 다머리~ ☻",
    "",
    "♡ 반말로 인사먼저 나눠보자!!",
    "",
    "♡ ①좋아요 누르기!!",
    "♡ 하트는 우리 방에 큰 힘♧",
    "",
    "♛ ②대화의 규칙!!",
    "☞ 두글자로 해주고 뒤에 성별 붙여줘",
    "",
    "♚ ③프로필작성!!",
    "☞ 너의 썸상과 매력을 어필해줘",
    "☞ 프로필 안내는 운영진 공지를 확인해줘",
    "",
    "☻ 자삭은 안돼, 가려야할게 있음 이야기해줘",
    "빠르게 처리해줄게!",
    "",
    `♡ 즐겁게 소통하며, 썸상의 친구들을 알아보고 ${ROOM_BRAND_NAME}에서 썸타보자!!`
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

function statusText(room = "") {
  return [
    `${DEFAULT_BOT_NAME} 서버 정상 연결`,
    `시간: ${kstTimestamp()}`,
    `방: ${room || "미지정"}`,
    `버전: ${APP_VERSION}`,
    "게임 기능: 사용 안 함"
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

export function healthPayload() {
  return {
    ok: true,
    service: "kakao-room-ops-bot",
    version: APP_VERSION,
    mode: "operations",
    storage: process.env.DATABASE_URL ? "postgres" : "local-json",
    gamesEnabled: false,
    features: FEATURES
  };
}

function helpText(isAdminUser = false) {
  const lines = [
    `${DEFAULT_BOT_NAME} ${isAdminUser ? "관리자 명령어" : "참여자 명령어"}`,
    "",
    "기본",
    "/상태 - 서버 연결 상태 확인",
    "/도움말 - 현재 명령어 확인",
    "/브릿지 - 브릿지 연결 진단",
    "/js상태 - 브릿지 JS 호환 진단",
    "",
    "운영",
    "/메시지 - 내 메시지함 확인",
    "/최근이벤트 - 브릿지 원본 이벤트 확인",
    "",
    "포인트",
    "/출석, /출석체크 - 일일 출석 보상",
    "/포인트, /내포인트 - 내 포인트 확인",
    "/내정보, /레벨 - 레벨/포인트/채팅 정보",
    "/좋아요 닉네임 1~999 - 포인트로 하트 보내기",
    "/응원 닉네임 메시지 - 포인트 응원 카드",
    "/뽑기 - 공개 확률 포인트 뽑기",
    "/홀 금액, /짝 금액 - 맞히면 x2",
    "/이체 닉네임 포인트 - 포인트 이체",
    "/포인트순위, /좋아요순위, /레벨순위",
    "/채팅오늘, /채팅금주",
    "",
    "프로필",
    "/프로필 닉네임",
    "",
    "히스토리",
    "/입퇴장현황 닉네임",
    "/닉이력 닉네임",
    ""
  ];

  if (isAdminUser) {
    lines.push(
      "관리자",
      "/원본로그 - 최신 원본 JSON 확인",
      "/프로필등록 닉네임 && 프로필내용",
      "/프로필삭제 닉네임",
      "/별명등록 닉네임 별명",
      "/별명삭제 별명",
      "/입퇴장상세 닉네임",
      "/관리자등록 닉네임",
      "/관리자삭제 닉네임",
      "/관리자재설정 닉네임1,닉네임2",
      "/관리자초기화 - 방 관리자 목록 초기화",
      "/관리자목록",
      "/고유값초기화 닉네임 - 이름 섞임 방지",
      "/포인트지급 닉네임 포인트",
      "/포인트차감 닉네임 포인트",
      "/포인트설정 닉네임 포인트",
      ""
    );
  }

  lines.push("실제 금전, 상점, 아이템 기능은 사용하지 않습니다.");
  return lines.join("\n");
}

function kakaoText(text) {
  return {
    version: "2.0",
    template: {
      outputs: [{ simpleText: { text } }]
    }
  };
}

async function handleCommand(state, room, sender, message, identity = {}) {
  const roomState = ensureRoom(state, room);
  const text = normalizeText(message);
  const command = compactSpaces(text);

  if (command === "/상태" || command === "/status") return statusText(room);
  if (command === "/브릿지" || command === "/bridge") return bridgeServerText(room);
  if (command === "/js상태" || command === "/jsstatus") return bridgeJsServerText();
  if (command === "/로컬상태") return `${DEFAULT_BOT_NAME} 자동응답 스크립트가 실행 중입니다. 이제 /상태 를 보내 서버 연결을 확인하세요.`;
  if (command === "/" || command === "/도움말" || command === "/help" || command === "/?") return helpText(isAdmin(roomState, sender));
  if (/^\/(?:메시지|메세지|메시지함)(?:\s|$)/.test(command)) return messageInboxCommand(roomState, sender);
  if (/^\/(?:최근이벤트|이벤트로그)(?:\s|$)/.test(command)) return recentEventsCommand(state, roomState, sender, text);
  if (/^\/(?:원본로그|원본이벤트)(?:\s|$)/.test(command)) return rawLogCommand(roomState, sender, text);
  if (/^\/(?:출석|출석체크|출첵)$/.test(command)) return attendanceCommand(roomState, sender);
  if (/^\/(?:포인트안내|포인트규칙)$/.test(command)) return pointGuideText();
  if (/^\/포인트\s*순위$|^\/포인트순위$/.test(command)) return rankingText(roomState, sender, "points");
  if (/^\/좋아요\s*순위$|^\/좋아요순위$/.test(command)) return rankingText(roomState, sender, "likes");
  if (/^\/레벨\s*순위$|^\/레벨순위$/.test(command)) return rankingText(roomState, sender, "levels");
  if (command === "/채팅오늘") return rankingText(roomState, sender, "todayChats");
  if (command === "/채팅금주") return rankingText(roomState, sender, "weekChats");
  if (command.startsWith("/포인트지급 ")) return adminPointAdjustCommand(roomState, sender, text, "grant");
  if (command.startsWith("/포인트차감 ")) return adminPointAdjustCommand(roomState, sender, text, "debit");
  if (command.startsWith("/포인트설정 ")) return adminPointAdjustCommand(roomState, sender, text, "set");
  if (/^\/(?:포인트|내포인트)(?:\s|$)/.test(command)) return pointViewCommand(roomState, text, sender);
  if (command.startsWith("/좋아요 ")) return likeCommand(roomState, sender, text);
  if (command.startsWith("/응원 ")) return cheerCommand(roomState, sender, text);
  if (command === "/확률뽑기" || command === "/뽑기") return luckyDrawCommand(roomState, sender);
  if (command.startsWith("/홀짝") || /^\/(?:홀|짝)(?:\s|$)/.test(command)) return oddEvenCommand(roomState, sender, text);
  if (command.startsWith("/이체 ")) return transferCommand(roomState, sender, text);
  if (/^\/(?:내정보|레벨)(?:\s|$)/.test(command) || command.startsWith("/정보 ")) return memberInfoCommand(roomState, text, sender);
  if (command.startsWith("/관리자등록 ")) return adminRegisterCommand(roomState, sender, text);
  if (command.startsWith("/관리자삭제 ")) return adminDeleteCommand(roomState, sender, text);
  if (/^\/(?:관리자재설정|관리자초기화)(?:\s|$)/.test(command)) return adminResetCommand(roomState, sender, text);
  if (command === "/관리자목록") return adminListCommand(roomState);
  if (/^\/고유값초기화(?:\s|$)/.test(command)) return identityResetCommand(roomState, sender, text, identity);
  if (command.startsWith("/프로필등록 ") || command.startsWith("/프로필 등록 ")) {
    return requireAdmin(roomState, sender) || profileRegisterCommand(roomState, sender, text);
  }
  if (command.startsWith("/프로필삭제 ")) return requireAdmin(roomState, sender) || profileDeleteCommand(roomState, text);
  if (command.startsWith("/프로필 ") || command === "/프로필" || command.startsWith("/프로칠 ")) return profileViewCommand(roomState, text, sender);
  if (command.startsWith("/별명등록 ")) return requireAdmin(roomState, sender) || aliasRegisterCommand(roomState, sender, text);
  if (command.startsWith("/별명삭제 ")) return requireAdmin(roomState, sender) || aliasDeleteCommand(roomState, text);
  if (command.startsWith("/입퇴장상세")) {
    const denied = requireAdmin(roomState, sender);
    if (denied) return denied;
    const query = text.replace(/^\/입퇴장상세\s*/i, "");
    return personDetailedHistoryText(roomState, query, sender);
  }
  if (command.startsWith("/입퇴장현황") || command.startsWith("/닉이력")) {
    const query = text.replace(/^\/(?:입퇴장현황|닉이력)\s*/i, "");
    return personHistoryText(roomState, query, sender);
  }

  if (command.startsWith("/")) {
    return [
      "아직 등록되지 않은 명령어입니다.",
      "/도움말 로 현재 사용 가능한 명령어를 확인해주세요."
    ].join("\n");
  }

  return null;
}

async function handleMessage(state, room, sender, message, identity = {}, detectedEvent = null) {
  const roomState = ensureRoom(state, room);
  const text = normalizeText(message);
  const event = detectedEvent || detectSystemEvent(message);
  const targetIdentity = identity.targetUserId || "";
  if (event?.type === "entered") return recordEntry(roomState, event.name, targetIdentity);
  if (event?.type === "left") return recordExit(roomState, event.name, "left", targetIdentity);
  if (event?.type === "kicked") return recordExit(roomState, event.name, "kicked", targetIdentity);
  if (event?.type === "nickname_changed") return recordNickChange(roomState, event.from, event.to, targetIdentity);

  const isCommand = text.startsWith("/");
  const activityReply = recordActivity(roomState, sender, identity.senderId, { firstChatNotice: !isCommand });
  if (isCommand) return handleCommand(state, room, sender, message, identity);

  recordMentionMessages(roomState, sender, text);
  return unreadNoticeText(roomState, sender) || activityReply;
}

export async function handleSkill(payload) {
  const state = await loadState();
  const utterance = normalizeText(payload?.userRequest?.utterance);
  const room = "카카오스킬";
  const sender = normalizeText(payload?.userRequest?.user?.properties?.nickname) || "스킬사용자";
  const roomState = ensureRoom(state, room);
  const reply = (await handleCommand(state, room, sender, utterance)) || helpText(isAdmin(roomState, sender));
  await saveState(state);
  return kakaoText(reply);
}

export async function handleChatEvent(payload) {
  const room = normalizeText(payload?.room);
  const message = normalizeText(payload?.msg || payload?.message);
  const sender = normalizeText(payload?.sender) || "익명";
  const event = payloadSystemEvent(payload, message);
  const identity = payloadIdentity(payload);
  const registeredRoom = isRegisteredRoomPayload(payload);
  if (!registeredRoom && !isGroupChatPayload(payload)) {
    return { ok: true, reply: null, ignored: true, reason: "non_group_chat" };
  }
  if (!registeredRoom) {
    return { ok: true, reply: null, ignored: true, reason: "unregistered_room" };
  }
  const state = await loadState();
  const roomState = ensureRoom(state, room);
  recordRawEvent(roomState, payload, { room, sender, message, event });

  if (!message || isBotSender(sender)) {
    await saveState(state);
    return { ok: true, reply: null, ignored: true };
  }

  const reply = await handleMessage(state, room, sender, message, identity, event);
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
    const pathname = new URL(req.url || "/", "http://localhost").pathname;
    if (await staticResponse(req, res, pathname)) return;

    const isHealthPath = pathname === "/" || pathname === "/health" || pathname === "/api/health";
    const isSkillPath = pathname === "/skill" || pathname === "/api/skill";
    const isChatEventPath = pathname === "/chat-event" || pathname === "/api/chat-event";

    if (req.method === "GET") {
      if (isHealthPath) {
        jsonResponse(res, 200, healthPayload());
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
    jsonResponse(res, 500, { ok: false, reply: "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요." });
  }
}

export default requestHandler;

const server = http.createServer(requestHandler);

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  server.listen(PORT, () => {
    console.log(`${DEFAULT_BOT_NAME} server listening on http://localhost:${PORT}`);
  });
}
