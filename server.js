import http from "node:http";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "data");
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, "pixelgom-db.json");
const PORT = Number(process.env.PORT || 3000);
const STATE_ID = process.env.PIXELGOM_STATE_ID || "main";
const APP_VERSION = "0.7.1";
const FEATURES = ["chat-import", "nickname-history", "period-ranks", "room-overview", "live-user-rank", "name-only-nicknames", "typing-games", "rpg-120-pools", "item-sell", "shop-forge-alchemy", "pets", "enhancement-scrolls", "auto-adventure"];

let pgPool;

const LEVELS = [
  { level: 1, point: 0 },
  { level: 2, point: 100 },
  { level: 3, point: 300 },
  { level: 4, point: 700 },
  { level: 5, point: 1500 },
  { level: 6, point: 3000 },
  { level: 7, point: 6000 },
  { level: 8, point: 10000 },
  { level: 9, point: 15000 },
  { level: 10, point: 21000 }
];

const POINT_RULES = {
  chat: 1,
  attendance: 30,
  firstRegion: 10,
  rpsWin: 20,
  rpsDraw: 5,
  diceMin: 1,
  diceMax: 6,
  quizCorrect: 20,
  sevenDayStreak: 50,
  coinWin: 8,
  oddEvenWin: 12,
  upDownBase: 35,
  luckyBoxMin: 5,
  luckyBoxMax: 50,
  gachaCost: 10,
  transferFee: 0
};

const COOLDOWNS = {
  rpsMs: 30 * 1000,
  diceMs: 10 * 60 * 1000,
  coinMs: 15 * 1000,
  oddEvenMs: 20 * 1000,
  rouletteMs: 60 * 1000,
  gachaMs: 2 * 60 * 1000,
  fishingMs: 30 * 1000,
  gatherMs: 25 * 1000,
  adventureMs: 45 * 1000,
  huntMs: 45 * 1000,
  dungeonMs: 2 * 60 * 1000,
  restMs: 60 * 1000,
  petTrainMs: 45 * 1000,
  petBattleMs: 90 * 1000
};

const initialDb = {
  users: {},
  rooms: {},
  events: [],
  identityLinks: {},
  membershipEvents: [],
  importKeys: {}
};

function nowIso() {
  return new Date().toISOString();
}

function todayKst() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function yesterday(dateString) {
  const date = new Date(`${dateString}T00:00:00+09:00`);
  date.setUTCDate(date.getUTCDate() - 1);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function ensureDb() {
  await mkdir(path.dirname(DB_PATH), { recursive: true });
  if (!existsSync(DB_PATH)) {
    await saveDb(structuredClone(initialDb));
  }
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
    CREATE TABLE IF NOT EXISTS pixelgom_state (
      id text PRIMARY KEY,
      data jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

async function loadDbFromPostgres(pool) {
  await ensurePgDb(pool);
  const result = await pool.query("SELECT data FROM pixelgom_state WHERE id = $1", [STATE_ID]);
  if (!result.rows.length) {
    const db = structuredClone(initialDb);
    await saveDbToPostgres(pool, db);
    return db;
  }
  const data = result.rows[0].data;
  return typeof data === "string" ? JSON.parse(data) : data;
}

async function saveDbToPostgres(pool, db) {
  await ensurePgDb(pool);
  await pool.query(
    `
      INSERT INTO pixelgom_state (id, data, updated_at)
      VALUES ($1, $2::jsonb, now())
      ON CONFLICT (id)
      DO UPDATE SET data = EXCLUDED.data, updated_at = now()
    `,
    [STATE_ID, JSON.stringify(db)]
  );
}

async function loadDb() {
  const pool = await getPgPool();
  if (pool) {
    const db = await loadDbFromPostgres(pool);
    db.users ||= {};
    db.rooms ||= {};
    db.events ||= [];
    db.identityLinks ||= {};
    db.membershipEvents ||= [];
    db.importKeys ||= {};
    return db;
  }

  await ensureDb();
  const raw = await readFile(DB_PATH, "utf8");
  const db = JSON.parse(raw);
  db.users ||= {};
  db.rooms ||= {};
  db.events ||= [];
  db.identityLinks ||= {};
  db.membershipEvents ||= [];
  db.importKeys ||= {};
  return db;
}

async function saveDb(db) {
  const pool = await getPgPool();
  if (pool) {
    await saveDbToPostgres(pool, db);
    return;
  }

  await mkdir(path.dirname(DB_PATH), { recursive: true });
  const tmpPath = `${DB_PATH}.tmp`;
  await writeFile(tmpPath, `${JSON.stringify(db, null, 2)}\n`, "utf8");
  await rename(tmpPath, DB_PATH);
}

function levelFor(points) {
  return LEVELS.reduce((current, row) => (points >= row.point ? row.level : current), 1);
}

function titleFor(user) {
  if (user.points >= 21000) return "전설";
  if (user.chatCount >= 1000) return "수다왕";
  if (user.attendanceStreak >= 30) return "출석장인";
  if (user.gameWins >= 100) return "게임고수";
  if (user.level >= 7) return "핵인싸";
  if (user.level >= 4) return "활동러";
  return "새싹";
}

function kakaoText(text) {
  return {
    version: "2.0",
    template: {
      outputs: [{ simpleText: { text } }]
    }
  };
}

function jsonResponse(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim();
}

function botNames() {
  return (process.env.BOT_NAMES || "픽셀곰,픽셀,하리보,오픈채팅봇")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
}

function isPixelgomMentionCommand(text) {
  const value = normalizeText(text);
  return /^@?픽셀곰(?:아)?(?:\s|$|[!?.,~])/i.test(value) || /^@?픽셀(?:아)?(?:\s|$|[!?.,~])/i.test(value);
}

function aliasesMatch(text, aliases) {
  const normalized = normalizeText(text);
  if (aliases.includes(normalized)) return true;
  const compacted = normalized.replace(/\s+/g, "");
  return aliases.some((alias) => normalizeText(alias).replace(/\s+/g, "") === compacted);
}

function blockNamesFrom(payload) {
  return [payload?.intent?.name, payload?.userRequest?.block?.name]
    .map(normalizeText)
    .filter(Boolean);
}

function startsWithAny(text, prefixes) {
  return prefixes.some((prefix) => {
    if (text === prefix) return true;
    if (!text.startsWith(prefix)) return false;
    const next = text.slice(prefix.length, prefix.length + 1);
    return /\s/.test(next);
  });
}

function userIdFromSkill(payload) {
  return normalizeText(payload?.userRequest?.user?.id) || "skill-anonymous";
}

function displayNameFromSkill(payload) {
  const props = payload?.userRequest?.user?.properties || {};
  return normalizeText(props.nickname || props.plusfriendUserKey) || "익명";
}

function userKeyForChat(room, sender) {
  return `chat:${room}:${sender}`;
}

function normalizeParticipantName(value) {
  return normalizeText(value).replace(/\s+/g, " ").replace(/님$/, "");
}

function displayNickname(value) {
  const normalized = normalizeParticipantName(value);
  return normalized.replace(/\s+(남자|여자|남성|여성|남|여)$/i, "").trim() || normalized || "익명";
}

function displayUserName(user) {
  return displayNickname(user?.nickname || "익명");
}

function nicknameLookupKey(value) {
  return normalizeParticipantName(value)
    .replace(/^@+/, "")
    .replace(/[()[\]{}<>]/g, "")
    .replace(/\s+/g, "")
    .replace(/(남자|여자|남성|여성|남|여)$/i, "")
    .toLowerCase();
}

function nicknameFullKey(value) {
  return normalizeParticipantName(value)
    .replace(/^@+/, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

function userNicknameCandidates(user) {
  return uniqueValues([
    user.nickname,
    ...(user.aliases || []),
    ...(user.nicknameHistory || []).map((row) => row.nickname)
  ]);
}

function roomUsers(db, room, options = {}) {
  const seen = new Set();
  return Object.values(db.users)
    .filter((user) => !room || user.room === room)
    .map((user) => db.users[canonicalUserId(db, user.id)] || user)
    .filter((user) => options.includeInactive || isActiveUser(user))
    .filter((user) => {
      if (!user || seen.has(user.id)) return false;
      seen.add(user.id);
      return true;
    });
}

function findUsersByName(db, room, query, excludeId = "", options = {}) {
  const clean = normalizeParticipantName(query);
  const fullKey = nicknameFullKey(clean);
  const nameKey = nicknameLookupKey(clean);
  if (!nameKey) return [];
  const excluded = excludeId ? canonicalUserId(db, excludeId) : "";
  const candidates = roomUsers(db, room, options).filter((user) => user.id !== excluded);
  const exact = candidates.filter((user) =>
    userNicknameCandidates(user).some((name) => nicknameFullKey(name) === fullKey)
  );
  if (exact.length) return exact;
  return candidates.filter((user) =>
    userNicknameCandidates(user).some((name) => nicknameLookupKey(name) === nameKey)
  );
}

function nameLookupFailure(name, matches) {
  if (matches.length <= 1) return "";
  return [
    `${displayNickname(name)} 닉네임이 여러 명입니다.`,
    "전체 닉네임으로 다시 입력해주세요.",
    ...matches.slice(0, 5).map((user) => `• ${displayUserName(user)}`)
  ].join("\n");
}

function findOneUserByName(db, room, query, excludeId = "", options = {}) {
  const matches = findUsersByName(db, room, query, excludeId, options);
  if (matches.length === 1) return { user: matches[0], error: "" };
  if (matches.length > 1) return { user: null, error: nameLookupFailure(query, matches) };
  return { user: null, error: "" };
}

function canonicalUserId(db, id) {
  let current = id;
  const seen = new Set();
  while (db.identityLinks?.[current] && !seen.has(current)) {
    seen.add(current);
    current = db.identityLinks[current];
  }
  return current;
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))];
}

function isActiveUser(user) {
  return user && user.status !== "left" && user.status !== "kicked";
}

function isRegisteredUser(user) {
  return Boolean(user?.accountRegistered);
}

function isPlayableUser(user) {
  return isActiveUser(user) && isRegisteredUser(user);
}

function registeredRoomUsers(db, room) {
  return roomUsers(db, room).filter(isRegisteredUser);
}

function addNicknameSeen(user, nickname, source = "seen") {
  const name = normalizeText(nickname);
  if (!name) return;
  const now = nowIso();
  user.aliases ||= [];
  user.nicknameHistory ||= [];
  if (!user.aliases.includes(name)) user.aliases.push(name);

  const last = user.nicknameHistory.at(-1);
  if (!last || last.nickname !== name) {
    if (last && !last.lastSeenAt) last.lastSeenAt = now;
    user.nicknameHistory.push({
      nickname: name,
      firstSeenAt: now,
      lastSeenAt: now,
      source
    });
  } else {
    last.lastSeenAt = now;
  }
}

function mergeUsers(db, targetId, sourceId, reason = "merge") {
  const targetKey = canonicalUserId(db, targetId);
  const sourceKey = canonicalUserId(db, sourceId);
  if (targetKey === sourceKey) return db.users[targetKey];

  const target = db.users[targetKey];
  const source = db.users[sourceKey];
  if (!target || !source) return target || source;

  target.points += source.points || 0;
  target.level = levelFor(target.points);
  target.chatCount += source.chatCount || 0;
  target.chatPoints += source.chatPoints || 0;
  target.chatChars = (target.chatChars || 0) + (source.chatChars || 0);
  target.commandCount += source.commandCount || 0;
  target.gameWins += source.gameWins || 0;
  target.gamePlays += source.gamePlays || 0;
  target.attendanceDates = uniqueValues([...(target.attendanceDates || []), ...(source.attendanceDates || [])]).sort();
  target.attendanceStreak = Math.max(target.attendanceStreak || 0, source.attendanceStreak || 0);
  target.lastAttendanceDate = [target.lastAttendanceDate, source.lastAttendanceDate].filter(Boolean).sort().at(-1) || "";
  target.aliases = uniqueValues([...(target.aliases || []), source.nickname, ...(source.aliases || [])]);
  target.autoAdventureAllowed ||= Boolean(source.autoAdventureAllowed);
  target.equipment ||= {};
  for (const [slot, item] of Object.entries(source.equipment || {})) {
    if (!target.equipment[slot] || (item?.level || 0) > (target.equipment[slot]?.level || 0)) target.equipment[slot] = item;
  }
  if (!target.pet && source.pet) target.pet = source.pet;
  target.nicknameHistory = [...(target.nicknameHistory || []), ...(source.nicknameHistory || [])]
    .filter((row) => row?.nickname)
    .sort((a, b) => String(a.firstSeenAt || "").localeCompare(String(b.firstSeenAt || "")));
  target.inventory ||= {};
  for (const [key, count] of Object.entries(source.inventory || {})) {
    target.inventory[key] = (target.inventory[key] || 0) + count;
  }
  target.mergedFrom = uniqueValues([...(target.mergedFrom || []), sourceKey, ...(source.mergedFrom || [])]);
  target.updatedAt = nowIso();

  for (const event of db.events || []) {
    if (event.userId === sourceKey) {
      event.userId = targetKey;
      event.mergedFrom = sourceKey;
    }
  }
  db.identityLinks ||= {};
  db.identityLinks[sourceKey] = targetKey;
  delete db.users[sourceKey];
  db.events.push({
    userId: targetKey,
    nickname: target.nickname,
    amount: 0,
    reason,
    meta: { sourceId: sourceKey },
    createdAt: nowIso()
  });
  return target;
}

function ensureUser(db, id, nickname, room = "", options = {}) {
  id = canonicalUserId(db, id);
  if (!db.users[id]) {
    db.users[id] = {
      id,
      nickname,
      room,
      points: 0,
      level: 1,
      region: "",
      attendanceDates: [],
      attendanceStreak: 0,
      lastAttendanceDate: "",
      chatCount: 0,
      chatPoints: 0,
      commandCount: 0,
      gameWins: 0,
      gamePlays: 0,
      chatChars: 0,
      accountRegistered: false,
      registeredAt: "",
      isAdmin: false,
      autoAdventureAllowed: false,
      aliases: [],
      nicknameHistory: [],
      activeQuiz: null,
      activeTyping: null,
      activeInitialQuiz: null,
      activeBaseball: null,
      rpg: {},
      pet: null,
      equipment: {},
      cooldowns: {},
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
  }
  const user = db.users[id];
  user.points ??= 0;
  user.level ??= 1;
  user.region ??= "";
  user.attendanceDates ||= [];
  user.attendanceStreak ??= 0;
  user.lastAttendanceDate ??= "";
  user.chatCount ??= 0;
  user.chatPoints ??= 0;
  user.commandCount ??= 0;
  user.gameWins ??= 0;
  user.gamePlays ??= 0;
  user.chatChars ??= 0;
  user.accountRegistered ??= false;
  user.registeredAt ||= "";
  user.isAdmin ??= false;
  user.autoAdventureAllowed ??= false;
  user.aliases ||= [];
  user.nicknameHistory ||= [];
  user.activeQuiz ??= null;
  user.activeTyping ??= null;
  user.activeInitialQuiz ??= null;
  user.activeBaseball ??= null;
  user.activeUpDown ??= null;
  user.rpg ||= {};
  user.pet ??= null;
  user.equipment ||= {};
  user.inventory ||= {};
  user.daily ||= {};
  user.cooldowns ||= {};
  user.status ||= "active";
  user.createdAt ||= nowIso();
  user.updatedAt ||= nowIso();
  addNicknameSeen(user, nickname, options.source || "seen");
  if (nickname && user.nickname !== nickname) user.nickname = nickname;
  if (room && user.room !== room) user.room = room;
  user.lastSeenAt = nowIso();
  if (options.markActive !== false) user.status = "active";
  user.level = levelFor(user.points);
  return user;
}

function touchRoom(db, room) {
  if (!room) return;
  db.rooms[room] ||= { name: room, chatCount: 0, wordChain: null, createdAt: nowIso(), updatedAt: nowIso() };
  db.rooms[room].chatCount ??= 0;
  db.rooms[room].wordChain ??= null;
  db.rooms[room].fastFinger ??= null;
  db.rooms[room].auto ||= {
    noticeEnabled: false,
    noticeEvery: 30,
    noticeText: "처음이면 /가입 후 /게임 또는 /모험 입력!",
    lastNoticeChatCount: 0
  };
  db.rooms[room].updatedAt = nowIso();
}

function addPoints(db, user, amount, reason, meta = {}) {
  if (!amount) return { beforeLevel: user.level, afterLevel: user.level, leveledUp: false };
  const beforeLevel = user.level;
  user.points += amount;
  user.level = levelFor(user.points);
  user.updatedAt = nowIso();
  db.events.push({
    userId: user.id,
    nickname: user.nickname,
    amount,
    reason,
    meta,
    createdAt: nowIso()
  });
  return {
    beforeLevel,
    afterLevel: user.level,
    leveledUp: user.level > beforeLevel
  };
}

function addEvent(db, user, reason, meta = {}) {
  db.events.push({
    userId: user.id,
    nickname: user.nickname,
    amount: 0,
    reason,
    meta,
    createdAt: nowIso()
  });
}

function rankUsers(db, selector, limit = 10, room = "") {
  return Object.values(db.users)
    .filter((user) => selector(user) > 0 && (!room || user.room === room) && isPlayableUser(user))
    .sort((a, b) => selector(b) - selector(a) || a.nickname.localeCompare(b.nickname, "ko"))
    .slice(0, limit);
}

function rankingText(title, rows, selector, suffix) {
  if (!rows.length) return `${title}\n\n아직 기록이 없습니다.`;
  const medals = ["1위", "2위", "3위"];
  return [
    title,
    "",
    ...rows.map((user, index) => {
      const rank = medals[index] || `${index + 1}위`;
      return `${rank} ${displayUserName(user)} - ${selector(user).toLocaleString()}${suffix} / LV.${user.level}`;
    })
  ].join("\n");
}

function dateKeyKst(value = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(value));
}

function parseYmd(ymd) {
  const [year, month, day] = ymd.split("-").map(Number);
  return { year, month, day };
}

function shiftYmd(ymd, days) {
  const { year, month, day } = parseYmd(ymd);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

function weekKeyKst(value = new Date()) {
  const ymd = dateKeyKst(value);
  const { year, month, day } = parseYmd(ymd);
  const dayOfWeek = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  return shiftYmd(ymd, mondayOffset);
}

function monthKeyKst(value = new Date()) {
  return dateKeyKst(value).slice(0, 7);
}

function periodKeyKst(period, value = new Date()) {
  if (period === "week") return weekKeyKst(value);
  if (period === "month") return monthKeyKst(value);
  return dateKeyKst(value);
}

function periodLabel(period) {
  if (period === "week") return "이번 주";
  if (period === "month") return "이번 달";
  return "오늘";
}

function periodTypingRankText(db, room, period = "day", metric = "chars") {
  const targetKey = periodKeyKst(period);
  const totals = {};
  for (const event of db.events || []) {
    if (event.reason !== "chat") continue;
    if (room && event.meta?.room !== room) continue;
    if (periodKeyKst(period, event.createdAt) !== targetKey) continue;
    const userId = canonicalUserId(db, event.userId);
    if (db.users[userId] && !isPlayableUser(db.users[userId])) continue;
    const amount = metric === "messages" ? 1 : Number(event.meta?.textLength || 0);
    totals[userId] ||= { userId, nickname: displayNickname(db.users[userId]?.nickname || event.nickname || "익명"), value: 0, level: db.users[userId]?.level || 1 };
    totals[userId].value += amount;
  }

  const rows = Object.values(totals)
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value || a.nickname.localeCompare(b.nickname, "ko"))
    .slice(0, 10);
  const title = `픽셀곰 ${periodLabel(period)} ${metric === "messages" ? "채팅" : "타수"} 순위`;
  if (!rows.length) return `${title}\n\n아직 기록이 없습니다.`;
  return [
    title,
    "",
    ...rows.map((row, index) => `${index + 1}위 ${displayNickname(row.nickname)} - ${row.value.toLocaleString()}${metric === "messages" ? "회" : "타"} / LV.${row.level}`)
  ].join("\n");
}

function periodRoomStats(db, room, period = "day") {
  const targetKey = periodKeyKst(period);
  const totals = {};
  for (const event of db.events || []) {
    if (event.reason !== "chat") continue;
    if (room && event.meta?.room !== room) continue;
    if (periodKeyKst(period, event.createdAt) !== targetKey) continue;
    const userId = canonicalUserId(db, event.userId);
    if (db.users[userId] && !isPlayableUser(db.users[userId])) continue;
    const textLength = Number(event.meta?.textLength || 0);
    totals[userId] ||= {
      userId,
      nickname: displayNickname(db.users[userId]?.nickname || event.nickname || "익명"),
      level: db.users[userId]?.level || 1,
      messages: 0,
      chars: 0
    };
    totals[userId].messages += 1;
    totals[userId].chars += textLength;
  }

  const rows = Object.values(totals);
  return {
    rows,
    totalMessages: rows.reduce((sum, row) => sum + row.messages, 0),
    totalChars: rows.reduce((sum, row) => sum + row.chars, 0)
  };
}

function topRows(rows, key, limit = 5) {
  return [...rows]
    .filter((row) => row[key] > 0)
    .sort((a, b) => b[key] - a[key] || a.nickname.localeCompare(b.nickname, "ko"))
    .slice(0, limit);
}

function sortedRows(rows, key) {
  return [...rows]
    .filter((row) => row[key] > 0)
    .sort((a, b) => b[key] - a[key] || a.nickname.localeCompare(b.nickname, "ko"));
}

function rankPosition(rows, userId, key) {
  const canonicalId = userId;
  const ranked = sortedRows(rows, key);
  const index = ranked.findIndex((row) => row.userId === canonicalId);
  const row = index >= 0 ? ranked[index] : null;
  return {
    rank: index >= 0 ? index + 1 : null,
    total: ranked.length,
    value: row ? row[key] : 0
  };
}

function periodOverviewText(db, room, period = "day") {
  const stats = periodRoomStats(db, room, period);
  const title = `픽셀곰 ${periodLabel(period)} 실시간 방순위`;
  if (!stats.rows.length) return `${title}\n\n아직 기록이 없습니다.`;

  const charRows = topRows(stats.rows, "chars");
  const messageRows = topRows(stats.rows, "messages");
  const lines = [
    title,
    `기준: 지금`,
    `참여: ${stats.rows.length.toLocaleString()}명`,
    `채팅: ${stats.totalMessages.toLocaleString()}회`,
    `타수: ${stats.totalChars.toLocaleString()}타`,
    "",
    "타수 TOP5",
    ...(charRows.length ? charRows.map((row, index) => `${index + 1}위 ${displayNickname(row.nickname)} - ${row.chars.toLocaleString()}타`) : ["기록 없음"]),
    "",
    "채팅 TOP5",
    ...(messageRows.length ? messageRows.map((row, index) => `${index + 1}위 ${displayNickname(row.nickname)} - ${row.messages.toLocaleString()}회`) : ["기록 없음"])
  ];
  return lines.join("\n");
}

function cumulativePointRank(db, user) {
  const rows = Object.values(db.users)
    .filter((row) => row.room === user.room && row.points > 0)
    .sort((a, b) => b.points - a.points || a.nickname.localeCompare(b.nickname, "ko"));
  const index = rows.findIndex((row) => row.id === user.id);
  return {
    rank: index >= 0 ? index + 1 : null,
    total: rows.length,
    value: index >= 0 ? rows[index].points : user.points || 0
  };
}

function rankLine(label, rank) {
  const rankText = rank.rank ? `${rank.rank}위/${rank.total}명` : `기록 없음`;
  return `${label}: ${rankText} (${rank.value.toLocaleString()})`;
}

function myRankText(db, user, period = "day") {
  const stats = periodRoomStats(db, user.room, period);
  const canonicalId = canonicalUserId(db, user.id);
  const chars = rankPosition(stats.rows, canonicalId, "chars");
  const messages = rankPosition(stats.rows, canonicalId, "messages");
  const points = cumulativePointRank(db, user);
  return [
    `${displayUserName(user)}님의 ${periodLabel(period)} 실시간 순위`,
    `기준: 지금`,
    rankLine("타수", chars) + "타",
    rankLine("채팅", messages) + "회",
    rankLine("포인트", points) + "P",
    "",
    "전체 순위는 /방순위"
  ].join("\n");
}

function botIntroText() {
  return [
    "픽셀곰은 카톡 텍스트 RPG 봇입니다.",
    "일반 채팅은 +1P, 게임 승리는 추가 보상으로 쌓입니다.",
    "",
    "자주 쓰는 명령어",
    "/게임 - 전체 게임 목록",
    "/모험 - RPG 도움말",
    "/캐릭터 - 내 RPG 상태",
    "/낚시, /채집, /탐험, /사냥, /던전",
    "/상점, /판매, /강화, /펫, /오토모험",
    "/타자, /초성, /야구, /끝말",
    "/게임순위 - 게임 승리 순위"
  ].join("\n");
}

function noticeText() {
  return [
    "🐻 픽셀곰 RPG 간단 사용법",
    "",
    "명령어는 반드시 / 로 시작합니다.",
    "",
    "시작",
    "/게임 또는 /ㄱㅇ - 전체 게임",
    "/모험 또는 /ㅁㅎ - RPG 도움말",
    "/캐릭터 또는 /캐릭 - 내 상태",
    "",
    "자주 쓰는 명령어",
    "/ㅊㅊ - 출석",
    "/낚시 또는 /ㄴㅅ",
    "/채집 또는 /ㅊㅈ",
    "/탐험 또는 /ㅌㅎ",
    "/사냥 또는 /ㅅㄴ",
    "/던전 또는 /ㄷㅈ",
    "/상점, /판매, /강화",
    "/펫, /펫훈련, /펫대전",
    "/휴식 또는 /ㅎㅅ",
    "/가방 또는 /ㄱㅂ",
    "",
    "미니게임",
    "/타자 또는 /ㅌㅈ",
    "/초성 또는 /초",
    "/야구 또는 /ㅇㄱ",
    "/선착순 시작 단어",
    "",
    "자세한 사용법은 /도움말 참고"
  ].join("\n");
}

function helpText(text = "") {
  const topic = normalizeText(text).replace(/^(\/?\?|\/?도움말|\/?도움|명령어|\/help)\s*/i, "");
  if (["게임", "game", "놀이"].includes(topic)) return gameHelpText();
  if (["공지", "notice", "간단"].includes(topic)) return noticeText();
  if (["랭킹", "순위", "rank"].includes(topic)) return rankingHelpText();
  if (["포인트", "point", "경제"].includes(topic)) return pointHelpText();
  if (["관리", "admin", "등록"].includes(topic)) return adminHelpText();

  return [
    "픽셀곰 도움말",
    "/공지 - 간단 사용법",
    "/? 게임 - 게임 명령어",
    "/모험 - 픽셀곰 RPG",
    "/? 랭킹 - 순위 명령어",
    "/? 포인트 - 포인트/경제 명령어",
    "/? 관리 - 일괄등록/닉네임 이력",
    "",
    "게임",
    "/낚시, /채집, /탐험, /사냥, /던전, /휴식",
    "/타자, /초성, /야구, /선착순, /끝말",
    "/캐릭터, /가방, /게임순위",
    "",
    "기본/순위",
    "/상태, /봇소개, /내정보, /?",
    "/버전",
    "/실시간순위, /방순위, /내순위",
    "",
    "자동 적립",
    `카톡방 메시지 1회당 +${POINT_RULES.chat}P`,
    "일반 채팅에는 답장하지 않고 명령어에만 답합니다."
  ].join("\n");
}

function gameHelpText() {
  return [
    "픽셀곰 게임센터",
    "/모험 또는 /ㅁㅎ - 픽셀곰 RPG 도움말",
    "/캐릭터 또는 /캐릭 - RPG 상태",
    "/낚시(/ㄴㅅ), /채집(/ㅊㅈ), /탐험(/ㅌㅎ)",
    "/사냥(/ㅅㄴ), /던전(/ㄷㅈ), /휴식(/ㅎㅅ)",
    "/상점, /구매, /판매, /강화, /대장간, /연금술",
    "/펫, /펫입양, /펫훈련, /펫대전",
    "/오토모험 - 권한 있는 사람만 자동 진행",
    "",
    "타이핑 게임",
    "/타자 또는 /ㅌㅈ - 제시문 빨리 입력",
    "/초성 또는 /초 - 초성 보고 단어 맞히기",
    "/야구 또는 /ㅇㄱ - 숫자야구 3자리",
    "/선착순 시작 단어, /ㅅㅊ 단어",
    "/끝말 시작 사과, /끝말 과자",
    "/업다운 - 1~100 숫자 맞히기",
    "/퀴즈 - 산수 퀴즈",
    "",
    "운빨/포인트 게임",
    "/가위바위보 가위|바위|보 - 승리 +20P, 비김 +5P",
    "/주사위 - 10분마다 1~6P",
    "/동전 앞|뒤 - 맞히면 +8P",
    "/홀짝 홀|짝 - 맞히면 +12P",
    "/룰렛 - 1분마다 랜덤 보상",
    "/뽑기 - 10P로 아이템/보상 뽑기",
    "/행운상자 - 하루 1회 +5~50P",
    "/랜덤 1 100, /골라 치킨 피자",
    "",
    "자세한 사용법은 /도움말 참고"
  ].join("\n");
}

function rankingHelpText() {
  return [
    "픽셀곰 랭킹",
    "/실시간순위, /방순위 또는 /순위 - 오늘 채팅/타수 TOP",
    "/내순위 - 내 현재 타수/채팅/포인트 등수",
    "/주간순위, /월간순위",
    "/포인트순위",
    "/채팅순위",
    "/타수순위",
    "/일간타수순위, /주간타수순위, /월간타수순위",
    "/일간채팅순위, /주간채팅순위, /월간채팅순위",
    "/레벨순위",
    "/출석순위",
    "/게임순위",
    "/지역통계"
  ].join("\n");
}

function adminHelpText() {
  return [
    "픽셀곰 관리",
    "/가입 - 계정 등록",
    "/공지 - 간단 사용법",
    "/관리자목록",
    "/관리자추가 닉네임",
    "/관리자해제 닉네임",
    "/지급 닉네임 금액",
    "/송금 닉네임 금액 - 관리자는 차감 없이 생성 송금",
    "/오토권한 닉네임",
    "/오토해제 닉네임",
    "/자동공지 - 현재 설정",
    "/자동공지 켜기|끄기",
    "/자동공지 간격 30",
    "/자동공지 설정 내용",
    "/일괄등록 닉네임1, 닉네임2",
    "/일괄등록 후 줄바꿈으로 여러 명 입력 가능",
    "/대화가져오기 - 카카오 대화 복사본으로 참여자/타수 가져오기",
    "/등록현황 - 이 방 등록 인원 수",
    "/입퇴장현황 - 입장/퇴장/내보냄 기록",
    "/닉이력 - 내 닉네임 이력",
    "/닉이력 닉네임 - 해당 닉네임 이력 조회",
    "/닉연결 이전닉 - 이전 닉네임 기록을 내 현재 닉네임으로 합치기"
  ].join("\n");
}

function pointHelpText() {
  return [
    "픽셀곰 포인트",
    `일반 채팅 +${POINT_RULES.chat}P`,
    `출석 +${POINT_RULES.attendance}P, 7일 연속 +${POINT_RULES.sevenDayStreak}P`,
    `지역 최초 등록 +${POINT_RULES.firstRegion}P`,
    "/송금 닉네임 금액 - 같은 방 유저에게 포인트 보내기",
    "/상점 - 현재 준비된 아이템 보기",
    "/가방 - 내 아이템 보기"
  ].join("\n");
}

function registrationGuideText(user) {
  return [
    "픽셀곰 계정 등록이 필요합니다.",
    "/가입 입력하면 바로 시작할 수 있어요.",
    "",
    "가입 후 이용 가능",
    "/게임, /모험, /낚시, /던전, /포인트순위",
    "",
    "자세한 사용법은 /공지 또는 /도움말 참고"
  ].join("\n");
}

function registerAccount(db, user) {
  if (user.accountRegistered) {
    return [
      `${displayUserName(user)}님은 이미 가입되어 있습니다.`,
      user.isAdmin ? "권한: 관리자" : "권한: 일반",
      "게임은 /게임 또는 /모험"
    ].join("\n");
  }

  const firstInRoom = user.room ? registeredRoomUsers(db, user.room).length === 0 : false;
  user.accountRegistered = true;
  user.registeredAt = nowIso();
  if (firstInRoom) user.isAdmin = true;
  user.updatedAt = nowIso();
  return [
    `${displayUserName(user)}님 계정 등록 완료!`,
    firstInRoom ? "이 방 첫 가입자라 관리자 권한이 부여되었습니다." : "이제 픽셀곰 게임을 이용할 수 있습니다.",
    "",
    "시작 명령어",
    "/게임 - 전체 게임",
    "/모험 - RPG 도움말",
    "/캐릭터 - 내 상태"
  ].join("\n");
}

function requireAdmin(user) {
  return user.isAdmin ? "" : "관리자만 사용할 수 있는 명령어입니다.";
}

function adminListText(db, room) {
  const admins = registeredRoomUsers(db, room).filter((user) => user.isAdmin);
  if (!admins.length) return "등록된 관리자가 없습니다.";
  return ["픽셀곰 관리자 목록", ...admins.map((user) => `• ${displayUserName(user)}`)].join("\n");
}

function setAdminRole(db, user, text, enabled) {
  const denied = requireAdmin(user);
  if (denied) return denied;
  const targetName = text.replace(/^(\/?(관리자추가|관리자등록|관리자해제|관리자삭제))\s*/i, "").trim();
  if (!targetName) return enabled ? "사용법: /관리자추가 닉네임" : "사용법: /관리자해제 닉네임";
  const result = findOneUserByName(db, user.room, targetName, user.id);
  if (result.error) return result.error;
  if (!result.user || !isRegisteredUser(result.user)) return `${displayNickname(targetName)}님은 가입된 계정이 아닙니다.`;
  result.user.isAdmin = enabled;
  result.user.updatedAt = nowIso();
  return `${displayUserName(result.user)}님 관리자 권한을 ${enabled ? "부여" : "해제"}했습니다.`;
}

function grantPoints(db, user, text) {
  const denied = requireAdmin(user);
  if (denied) return denied;
  const args = text.replace(/^(\/?(포인트지급|지급|포인트주기))\s*/i, "").trim().split(/\s+/).filter(Boolean);
  if (args.length < 2) return "사용법: /지급 닉네임 금액";
  const amount = Number(args.at(-1));
  const targetName = args.slice(0, -1).join(" ");
  if (!Number.isInteger(amount) || amount <= 0) return "지급 포인트는 1 이상의 숫자로 입력해주세요.";
  const result = findOneUserByName(db, user.room, targetName, user.id);
  if (result.error) return result.error;
  if (!result.user || !isRegisteredUser(result.user)) return `${displayNickname(targetName)}님은 가입된 계정이 아닙니다.`;
  const level = addPoints(db, result.user, amount, "admin_grant", { from: user.nickname });
  return [
    `${displayUserName(result.user)}님에게 ${amount.toLocaleString()}P 지급 완료`,
    `현재 포인트: ${result.user.points.toLocaleString()}P / LV.${result.user.level}`,
    level.leveledUp ? `레벨업! LV.${level.beforeLevel} -> LV.${level.afterLevel}` : ""
  ].filter(Boolean).join("\n");
}

function autoNoticeText(db, user, text) {
  const denied = requireAdmin(user);
  if (denied) return denied;
  if (!user.room) return "자동공지 설정은 채팅방에서만 가능합니다.";
  touchRoom(db, user.room);
  const auto = db.rooms[user.room].auto;
  const raw = text.replace(/^(\/?(자동공지|오토|자동))\s*/i, "").trim();
  if (!raw) {
    return [
      "픽셀곰 자동공지",
      `상태: ${auto.noticeEnabled ? "켜짐" : "꺼짐"}`,
      `간격: 채팅 ${auto.noticeEvery}회`,
      `내용: ${auto.noticeText}`,
      "",
      "/자동공지 켜기",
      "/자동공지 끄기",
      "/자동공지 간격 30",
      "/자동공지 설정 내용"
    ].join("\n");
  }
  if (["켜기", "on"].includes(raw)) {
    auto.noticeEnabled = true;
    auto.lastNoticeChatCount = db.rooms[user.room].chatCount || 0;
    return "자동공지 켜짐";
  }
  if (["끄기", "off"].includes(raw)) {
    auto.noticeEnabled = false;
    return "자동공지 꺼짐";
  }
  const interval = raw.match(/^(간격|주기)\s+(\d{1,3})$/);
  if (interval) {
    auto.noticeEvery = Math.max(5, Math.min(200, Number(interval[2])));
    return `자동공지 간격: 채팅 ${auto.noticeEvery}회`;
  }
  const message = raw.replace(/^(설정|내용)\s*/i, "").trim();
  if (!message) return "사용법: /자동공지 설정 내용";
  auto.noticeText = message.slice(0, 300);
  return ["자동공지 내용 설정 완료", auto.noticeText].join("\n");
}

function maybeAutoNotice(db, roomName) {
  const room = db.rooms?.[roomName];
  const auto = room?.auto;
  if (!auto?.noticeEnabled) return null;
  const every = Math.max(5, Number(auto.noticeEvery || 30));
  if ((room.chatCount || 0) - (auto.lastNoticeChatCount || 0) < every) return null;
  auto.lastNoticeChatCount = room.chatCount || 0;
  return auto.noticeText || "처음이면 /가입 후 /게임 또는 /모험 입력!";
}

function statusText() {
  return [
    "픽셀곰 서버 정상 연결",
    `시간: ${new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}`,
    `일반 채팅 1회당 +${POINT_RULES.chat}P 적립 중`
  ].join("\n");
}

function versionText() {
  return [
    "픽셀곰 버전",
    `버전: ${APP_VERSION}`,
    `시간: ${new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}`,
    `기능: ${FEATURES.join(", ")}`
  ].join("\n");
}

function profileText(user) {
  const itemCount = Object.values(user.inventory || {}).reduce((sum, count) => sum + count, 0);
  return [
    `${displayUserName(user)}님의 정보`,
    user.accountRegistered ? "계정: 등록됨" : "계정: 미등록",
    user.isAdmin ? "권한: 관리자" : "권한: 일반",
    user.autoAdventureAllowed ? "오토모험: 허용" : "오토모험: 미허용",
    `칭호: ${titleFor(user)}`,
    `레벨: LV.${user.level}`,
    `포인트: ${user.points.toLocaleString()}P`,
    `채팅: ${user.chatCount.toLocaleString()}회`,
    `타수: ${(user.chatChars || 0).toLocaleString()}타`,
    `출석 연속: ${user.attendanceStreak || 0}일`,
    `게임: ${user.gameWins.toLocaleString()}승 / ${user.gamePlays.toLocaleString()}회`,
    `아이템: ${itemCount.toLocaleString()}개`,
    user.region ? `지역: ${user.region}` : "지역: 미등록"
  ].join("\n");
}

function attendance(db, user) {
  const today = todayKst();
  if (user.attendanceDates.includes(today)) {
    return `${displayUserName(user)}님은 오늘 이미 출석했습니다.\n현재 포인트: ${user.points.toLocaleString()}P / LV.${user.level}`;
  }

  const prevDay = yesterday(today);
  user.attendanceStreak = user.lastAttendanceDate === prevDay ? (user.attendanceStreak || 0) + 1 : 1;
  user.lastAttendanceDate = today;
  user.attendanceDates.push(today);

  let gained = POINT_RULES.attendance;
  const lines = [`${displayUserName(user)}님 출석 완료!`, `+${POINT_RULES.attendance}P`];
  if (user.attendanceStreak > 0 && user.attendanceStreak % 7 === 0) {
    gained += POINT_RULES.sevenDayStreak;
    lines.push(`7일 연속 보너스 +${POINT_RULES.sevenDayStreak}P`);
  }
  const level = addPoints(db, user, gained, "attendance", { streak: user.attendanceStreak });
  lines.push(`연속 출석: ${user.attendanceStreak}일`);
  lines.push(`현재 포인트: ${user.points.toLocaleString()}P / LV.${user.level}`);
  if (level.leveledUp) lines.push(`레벨업! LV.${level.beforeLevel} -> LV.${level.afterLevel}`);
  return lines.join("\n");
}

function registerRegion(db, user, text) {
  const args = text.replace(/^\/?지역등록\s*/, "").trim().split(/\s+/).filter(Boolean);
  if (args.length < 1) return "사용법: /지역등록 지역\n예시: /지역등록 서울\n닉네임을 바꾸려면 /지역등록 민지 서울";

  const nickname = args.length === 1 ? user.nickname : args[0];
  const region = args.length === 1 ? args[0] : args.slice(1).join(" ");
  const wasEmpty = !user.region;
  user.nickname = nickname;
  user.region = region;
  user.updatedAt = nowIso();

  const lines = [`${displayNickname(nickname)}님 지역을 ${region}(으)로 등록했습니다.`];
  if (wasEmpty) {
    const level = addPoints(db, user, POINT_RULES.firstRegion, "first_region");
    lines.push(`최초 지역등록 +${POINT_RULES.firstRegion}P`);
    if (level.leveledUp) lines.push(`레벨업! LV.${level.beforeLevel} -> LV.${level.afterLevel}`);
  }
  lines.push(`현재 포인트: ${user.points.toLocaleString()}P / LV.${user.level}`);
  return lines.join("\n");
}

function regionListText(db, room = "") {
  const grouped = Object.values(db.users)
    .filter((user) => user.region && (!room || user.room === room) && isActiveUser(user))
    .sort((a, b) => a.nickname.localeCompare(b.nickname, "ko"))
    .reduce((acc, user) => {
      acc[user.region] ||= [];
      acc[user.region].push(`• ${displayUserName(user)}`);
      return acc;
    }, {});

  if (!Object.keys(grouped).length) {
    return "아직 등록된 지역이 없습니다.\n/지역등록 서울 처럼 등록해주세요.";
  }

  return Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b, "ko"))
    .map(([region, names]) => `[ ${region} ]\n\n${names.join("\n")}`)
    .join("\n\n");
}

function regionStatsText(db, room = "") {
  const counts = Object.values(db.users)
    .filter((user) => user.region && (!room || user.room === room) && isActiveUser(user))
    .reduce((acc, user) => {
      acc[user.region] = (acc[user.region] || 0) + 1;
      return acc;
    }, {});
  const rows = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko"));
  if (!rows.length) return "아직 지역 통계가 없습니다.\n/지역등록 서울 처럼 등록해주세요.";
  return ["픽셀곰 지역 통계", "", ...rows.map(([region, count], index) => `${index + 1}위 ${region} - ${count}명`)].join("\n");
}

function parseBulkNames(text) {
  const raw = text.replace(/^\/?일괄등록\s*/i, "").trim();
  return raw
    .split(/[\n,;]+/)
    .map((name) => name.replace(/^[\s•\-*0-9.()]+/, "").trim())
    .filter((name) => !/^\[[^\]]+\]$/.test(name))
    .filter((name) => !/^\d{4}년\s+\d{1,2}월\s+\d{1,2}일/.test(name))
    .filter((name) => name !== "..." && name !== "…")
    .filter((name) => name.length > 0 && name.length <= 30);
}

function bulkRegister(db, user, text) {
  if (!user.room) return "일괄등록은 채팅방에서만 사용할 수 있습니다.";
  if (!user.isAdmin) return "관리자만 일괄등록을 사용할 수 있습니다.";
  const names = uniqueValues(parseBulkNames(text));
  if (!names.length) {
    return [
      "사용법:",
      "/일괄등록 민지, 철수, 영희",
      "",
      "또는",
      "/일괄등록",
      "민지",
      "철수",
      "영희"
    ].join("\n");
  }

  let created = 0;
  let existing = 0;
  for (const name of names) {
    const id = userKeyForChat(user.room, name);
    if (db.users[id]) existing += 1;
    else created += 1;
    const row = ensureUser(db, id, name, user.room, { source: "bulk" });
    row.accountRegistered = true;
    row.registeredAt ||= nowIso();
    row.bulkRegisteredAt ||= nowIso();
  }
  return [
    "일괄등록 완료",
    `신규: ${created}명`,
    `기존: ${existing}명`,
    `총 입력: ${names.length}명`,
    "참고: 카카오 알림 봇은 방 전체 명단을 자동으로 읽을 수 없어, 붙여넣은 명단 기준으로 등록합니다."
  ].join("\n");
}

function registrationStatusText(db, room) {
  const users = Object.values(db.users).filter((user) => !room || user.room === room);
  const activeUsers = users.filter(isActiveUser);
  const registeredUsers = activeUsers.filter(isRegisteredUser);
  const admins = registeredUsers.filter((user) => user.isAdmin).length;
  const active = activeUsers.length;
  const chatted = activeUsers.filter((user) => (user.chatCount || 0) > 0).length;
  const left = users.filter((user) => user.status === "left").length;
  const kicked = users.filter((user) => user.status === "kicked").length;
  const bulk = activeUsers.filter((user) => user.bulkRegisteredAt).length;
  return [
    "픽셀곰 등록현황",
    `계정 등록: ${registeredUsers.length}명`,
    `관리자: ${admins}명`,
    `감지 인원: ${active}명`,
    `채팅 감지: ${chatted}명`,
    `일괄등록: ${bulk}명`,
    `제외 기록: 퇴장 ${left}명 / 내보냄 ${kicked}명`
  ].join("\n");
}

function nicknameHistoryText(db, user, text) {
  const query = text.replace(/^\/?닉이력\s*/i, "").trim();
  let target = user;
  if (query) {
    const result = findOneUserByName(db, user.room, query, "", { includeInactive: true });
    if (result.error) return result.error;
    target = result.user;
    if (!target) return `${displayNickname(query)}님의 닉네임 이력을 찾지 못했습니다.`;
  }
  const history = target.nicknameHistory || [];
  if (!history.length) return `${displayUserName(target)}님의 닉네임 이력이 아직 없습니다.`;
  return [
    `${displayUserName(target)}님의 닉네임 이력`,
    "",
    ...history.map((row, index) => `${index + 1}. ${displayNickname(row.nickname)} (${dateKeyKst(row.firstSeenAt)}부터)`)
  ].join("\n");
}

function linkNickname(db, user, text) {
  const previousName = text.replace(/^\/?닉연결\s*/i, "").trim();
  if (!previousName) return "사용법: /닉연결 이전닉\n예시: /닉연결 우주";
  const result = findOneUserByName(db, user.room, previousName, user.id, { includeInactive: true });
  if (result.error) return result.error;
  const previous = result.user;
  if (!previous) return `${previousName} 기록을 찾지 못했습니다.\n먼저 /일괄등록 으로 이전 닉네임을 등록할 수 있습니다.`;
  const merged = mergeUsers(db, user.id, previous.id, "nickname_link");
  addNicknameSeen(merged, previousName, "linked");
  return [
    "닉네임 기록을 연결했습니다.",
    `이전 닉네임: ${displayNickname(previousName)}`,
    `현재 닉네임: ${displayUserName(merged)}`,
    "이후 순위/포인트/채팅 기록은 합산됩니다."
  ].join("\n");
}

function stripTranscriptCommand(text) {
  return text.replace(/^\/?(대화가져오기|대화등록)\s*/i, "").trim();
}

function isTranscriptImportCommand(text) {
  return /^\/?(대화가져오기|대화등록)(\s|$)/i.test(normalizeText(text));
}

function parseKoreanDateLine(line) {
  const match = normalizeText(line).match(/^(\d{4})년\s+(\d{1,2})월\s+(\d{1,2})일/);
  if (!match) return "";
  const [, year, month, day] = match;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseKoreanTime(date, ampm, hourText, minuteText) {
  let hour = Number(hourText);
  if (ampm === "오전" && hour === 12) hour = 0;
  if (ampm === "오후" && hour !== 12) hour += 12;
  const hh = String(hour).padStart(2, "0");
  return new Date(`${date}T${hh}:${minuteText}:00+09:00`).toISOString();
}

function parseMembershipLine(line, date) {
  const text = normalizeText(line);
  const rules = [
    { action: "join", regex: /^(.+?)님이 들어왔습니다\./ },
    { action: "leave", regex: /^(.+?)님이 나갔습니다\./ },
    { action: "kick", regex: /^(.+?)님을 내보냈습니다\./ }
  ];
  for (const rule of rules) {
    const match = text.match(rule.regex);
    if (!match) continue;
    const nickname = normalizeParticipantName(match[1]);
    if (!nickname) return null;
    return {
      action: rule.action,
      nickname,
      createdAt: new Date(`${date || todayKst()}T00:00:00+09:00`).toISOString()
    };
  }
  return null;
}

function parseChatTranscript(text) {
  const raw = stripTranscriptCommand(text);
  const messages = [];
  const memberships = [];
  const lines = raw.split(/\r?\n/);
  let currentDate = "";
  let currentMessage = null;
  let sequence = 0;

  const flushMessage = () => {
    if (!currentMessage) return;
    currentMessage.text = currentMessage.text.trim();
    messages.push(currentMessage);
    currentMessage = null;
  };

  for (const line of lines) {
    const date = parseKoreanDateLine(line);
    if (date) {
      flushMessage();
      currentDate = date;
      continue;
    }

    const chat = line.match(/^\[([^\]]+)\]\s+\[(오전|오후)\s+(\d{1,2}):(\d{2})\]\s?(.*)$/);
    if (chat) {
      flushMessage();
      const [, senderRaw, ampm, hour, minute, body] = chat;
      const dateForMessage = currentDate || todayKst();
      currentMessage = {
        sender: normalizeParticipantName(senderRaw),
        text: body || "",
        createdAt: parseKoreanTime(dateForMessage, ampm, hour, minute),
        seq: sequence++
      };
      continue;
    }

    const membership = parseMembershipLine(line, currentDate);
    if (membership) {
      flushMessage();
      membership.seq = sequence++;
      memberships.push(membership);
      continue;
    }

    if (/^관리자가 메시지를 가렸습니다\./.test(normalizeText(line))) {
      flushMessage();
      continue;
    }

    if (currentMessage) {
      currentMessage.text += `\n${line}`;
    }
  }

  flushMessage();
  return { messages, memberships };
}

function markMembership(db, room, nickname, action, createdAt) {
  const id = userKeyForChat(room, nickname);
  const existed = Boolean(db.users[canonicalUserId(db, id)] || db.users[id]);
  const user = ensureUser(db, id, nickname, room, { source: "membership", markActive: action === "join" });
  if (action === "join") {
    user.status = "active";
    user.joinedAt = createdAt;
  } else if (action === "leave") {
    user.status = "left";
    user.leftAt = createdAt;
  } else if (action === "kick") {
    user.status = "kicked";
    user.kickedAt = createdAt;
  }
  user.membershipUpdatedAt = nowIso();
  return { user, existed };
}

function importTranscript(db, user, text) {
  if (!user.room) return "대화가져오기는 채팅방에서만 사용할 수 있습니다.";
  const raw = stripTranscriptCommand(text);
  if (!raw) {
    return [
      "사용법:",
      "/대화가져오기",
      "2026년 5월 22일 금요일",
      "[미정 남] [오후 4:49] 안녕",
      "우주 남님이 나갔습니다."
    ].join("\n");
  }

  db.importKeys ||= {};
  db.membershipEvents ||= [];
  const parsed = parseChatTranscript(text);
  const createdUserIds = new Set();
  const touchedUserIds = new Set();
  let importedMessages = 0;
  let duplicateMessages = 0;
  let importedChars = 0;
  const membershipCounts = { join: 0, leave: 0, kick: 0 };

  const items = [
    ...parsed.memberships.map((event) => ({ type: "membership", ...event })),
    ...parsed.messages.map((message) => ({ type: "message", ...message }))
  ].sort((a, b) => a.seq - b.seq);

  for (const item of items) {
    if (item.type === "membership") {
      if (botNames().includes(item.nickname)) continue;
      const key = `member:${user.room}:${item.action}:${item.createdAt}:${item.nickname}`;
      if (db.importKeys[key]) continue;
      const result = markMembership(db, user.room, item.nickname, item.action, item.createdAt);
      touchedUserIds.add(result.user.id);
      if (!result.existed) createdUserIds.add(result.user.id);
      membershipCounts[item.action] += 1;
      db.membershipEvents.push({
        room: user.room,
        nickname: item.nickname,
        action: item.action,
        createdAt: item.createdAt,
        importedAt: nowIso()
      });
      db.importKeys[key] = nowIso();
      continue;
    }

    if (!item.sender || botNames().includes(item.sender)) continue;
    const key = `chat:${user.room}:${item.createdAt}:${item.sender}:${hash(item.text)}`;
    if (db.importKeys[key]) {
      duplicateMessages += 1;
      continue;
    }
    const id = userKeyForChat(user.room, item.sender);
    const existed = Boolean(db.users[canonicalUserId(db, id)] || db.users[id]);
    const target = ensureUser(db, id, item.sender, user.room, { source: "import" });
    target.accountRegistered = true;
    target.registeredAt ||= nowIso();
    touchedUserIds.add(target.id);
    if (!existed) createdUserIds.add(target.id);
    const textLength = textLengthForStats(item.text);
    target.chatCount += 1;
    target.chatPoints = (target.chatPoints || 0) + POINT_RULES.chat;
    target.chatChars = (target.chatChars || 0) + textLength;
    target.points += POINT_RULES.chat;
    target.level = levelFor(target.points);
    target.lastSeenAt = item.createdAt;
    target.status = "active";
    target.updatedAt = nowIso();
    if (user.room && db.rooms[user.room]) db.rooms[user.room].chatCount += 1;
    db.events.push({
      userId: target.id,
      nickname: target.nickname,
      amount: POINT_RULES.chat,
      reason: "chat",
      meta: {
        room: user.room,
        textLength,
        imported: true,
        importKey: key
      },
      createdAt: item.createdAt
    });
    db.importKeys[key] = nowIso();
    importedMessages += 1;
    importedChars += textLength;
  }

  if (!importedMessages && !parsed.memberships.length) {
    return "가져올 수 있는 대화 형식을 찾지 못했습니다.\n카카오 대화 내보내기처럼 [닉네임] [오후 4:49] 메시지 형식으로 붙여넣어주세요.";
  }

  return [
    "대화가져오기 완료",
    `메시지: ${importedMessages.toLocaleString()}건`,
    `중복 제외: ${duplicateMessages.toLocaleString()}건`,
    `타수: ${importedChars.toLocaleString()}타`,
    `참여자: ${touchedUserIds.size.toLocaleString()}명 처리 / 신규 ${createdUserIds.size.toLocaleString()}명`,
    `입퇴장: 입장 ${membershipCounts.join}명 / 퇴장 ${membershipCounts.leave}명 / 내보냄 ${membershipCounts.kick}명`,
    `포인트: 메시지 1건당 +${POINT_RULES.chat}P 반영`
  ].join("\n");
}

function membershipStatusText(db, room) {
  const users = Object.values(db.users).filter((row) => !room || row.room === room);
  const active = users.filter((row) => row.status !== "left" && row.status !== "kicked").length;
  const left = users.filter((row) => row.status === "left").length;
  const kicked = users.filter((row) => row.status === "kicked").length;
  const events = (db.membershipEvents || [])
    .filter((event) => !room || event.room === room)
    .slice(-10)
    .reverse();
  const label = { join: "입장", leave: "퇴장", kick: "내보냄" };
  const lines = [
    "픽셀곰 입퇴장현황",
    `현재 추정: ${active}명`,
    `퇴장: ${left}명`,
    `내보냄: ${kicked}명`
  ];
  if (events.length) {
    lines.push("", "최근 기록");
    for (const event of events) {
      lines.push(`• ${dateKeyKst(event.createdAt)} ${displayNickname(event.nickname)} - ${label[event.action] || event.action}`);
    }
  }
  return lines.join("\n");
}

const TYPING_PROMPTS = [
  "오늘도 방 분위기는 우리가 살린다",
  "픽셀곰은 조용히 포인트를 적립한다",
  "퇴근 전까지 수다력 충전 완료",
  "오타 없이 빠르게 치면 보너스",
  "채팅방의 주인공은 바로 지금",
  "불금에는 타자 속도도 올라간다",
  "한 글자씩 침착하게 입력하기",
  "빠른 손가락이 포인트를 부른다",
  "오늘의 수다왕은 누구일까요",
  "웃긴 말 한마디가 방을 살린다",
  "순위는 조용히 올라가는 중",
  "반응 속도보다 정확도가 먼저",
  "카톡 게임은 타이밍이 생명",
  "모두가 보는 앞에서 정답 도전",
  "오늘도 재미있게 놀아보자",
  "점수보다 중요한 건 참여",
  "방 분위기는 다 같이 만든다",
  "짧고 굵게 한 판 더",
  "빠르게 치고 포인트 받자",
  "픽셀곰 게임방 오픈"
];

const INITIAL_QUIZ_WORDS = [
  { word: "보이스룸", hint: "카카오 오픈채팅 기능" },
  { word: "출석체크", hint: "하루 한 번 포인트" },
  { word: "포인트", hint: "채팅하면 쌓이는 것" },
  { word: "수다왕", hint: "채팅 많이 하는 사람" },
  { word: "불금", hint: "금요일 분위기" },
  { word: "퇴근", hint: "직장인이 기다리는 순간" },
  { word: "타자게임", hint: "빠르게 입력하는 게임" },
  { word: "끝말잇기", hint: "단어 이어가기" },
  { word: "숫자야구", hint: "스트라이크와 볼" },
  { word: "초성퀴즈", hint: "자음만 보고 맞히기" },
  { word: "카카오톡", hint: "지금 쓰는 메신저" },
  { word: "오픈채팅", hint: "방 이름에 자주 붙는 말" },
  { word: "랜덤뽑기", hint: "운에 맡기는 선택" },
  { word: "행운상자", hint: "하루 한 번 여는 보상" },
  { word: "실시간순위", hint: "오늘 랭킹 확인" },
  { word: "닉네임", hint: "방에서 보이는 이름" },
  { word: "신입환영", hint: "새로 온 사람에게 하는 말" },
  { word: "공질", hint: "자기소개 질문" },
  { word: "하트인증", hint: "신입 절차 중 하나" },
  { word: "게임순위", hint: "승리 랭킹" }
];

const INITIALS = [
  "ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"
];

function compactGameAnswer(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[\s.,!?'"`~…:;()[\]{}<>·ㆍ|/\\_-]+/g, "");
}

function initialsOf(text) {
  return Array.from(normalizeText(text)).map((char) => {
    const code = char.charCodeAt(0) - 0xac00;
    if (code < 0 || code > 11171) return char;
    return INITIALS[Math.floor(code / 588)] || char;
  }).join("");
}

function randomDigits(count = 3) {
  const digits = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
  for (let i = digits.length - 1; i > 0; i -= 1) {
    const j = randomInt(0, i);
    [digits[i], digits[j]] = [digits[j], digits[i]];
  }
  return digits.slice(0, count).join("");
}

function typingGame(db, user, text) {
  const raw = text.replace(/^(\/?타자게임|\/?타자|\/typing)\s*/i, "").trim();
  if (["포기", "그만", "종료", "stop", "quit"].includes(raw)) {
    user.activeTyping = null;
    return "타자게임을 종료했습니다.";
  }

  if (!raw || ["시작", "start"].includes(raw) || !user.activeTyping) {
    const prompt = TYPING_PROMPTS[Math.floor(Math.random() * TYPING_PROMPTS.length)];
    user.activeTyping = { prompt, createdAt: nowIso() };
    user.gamePlays += 1;
    return ["타자게임 시작", "아래 문장을 /타자 뒤에 그대로 입력하세요.", "", prompt, "", `예시: /타자 ${prompt}`].join("\n");
  }

  const active = user.activeTyping;
  const elapsed = Math.max(1, Math.round((Date.now() - Date.parse(active.createdAt)) / 1000));
  if (compactGameAnswer(raw) !== compactGameAnswer(active.prompt)) {
    return ["오타가 있습니다.", "제시문", active.prompt].join("\n");
  }

  user.activeTyping = null;
  user.gameWins += 1;
  const reward = elapsed <= 15 ? 30 : elapsed <= 30 ? 22 : elapsed <= 60 ? 15 : 8;
  addPoints(db, user, reward, "typing_game", { elapsed, prompt: active.prompt });
  return [`타자 성공! ${elapsed}초`, `+${reward}P`, `현재: ${user.points.toLocaleString()}P / LV.${user.level}`].join("\n");
}

function initialQuiz(db, user, text) {
  const raw = text.replace(/^(\/?초성퀴즈|\/?초성|\/initial)\s*/i, "").trim();
  if (["포기", "그만", "종료", "stop", "quit"].includes(raw)) {
    user.activeInitialQuiz = null;
    return "초성퀴즈를 종료했습니다.";
  }

  if (!raw || ["시작", "start"].includes(raw) || !user.activeInitialQuiz) {
    const quiz = INITIAL_QUIZ_WORDS[Math.floor(Math.random() * INITIAL_QUIZ_WORDS.length)];
    user.activeInitialQuiz = { ...quiz, initials: initialsOf(quiz.word), createdAt: nowIso() };
    user.gamePlays += 1;
    return [`초성퀴즈`, `초성: ${user.activeInitialQuiz.initials}`, `힌트: ${quiz.hint}`, `정답: /초성 단어`].join("\n");
  }

  const quiz = user.activeInitialQuiz;
  if (compactGameAnswer(raw) !== compactGameAnswer(quiz.word)) {
    return [`오답입니다.`, `초성: ${quiz.initials}`, `힌트: ${quiz.hint}`].join("\n");
  }

  user.activeInitialQuiz = null;
  user.gameWins += 1;
  addPoints(db, user, 20, "initial_quiz", { word: quiz.word });
  return [`정답! ${quiz.word}`, "+20P", `현재: ${user.points.toLocaleString()}P / LV.${user.level}`].join("\n");
}

function numberBaseball(db, user, text) {
  const raw = text.replace(/^(\/?숫자야구|\/?야구|\/baseball)\s*/i, "").trim();
  if (["포기", "그만", "종료", "stop", "quit"].includes(raw)) {
    const answer = user.activeBaseball?.answer;
    user.activeBaseball = null;
    return answer ? `숫자야구 종료. 정답은 ${answer}였습니다.` : "진행 중인 숫자야구가 없습니다.";
  }

  if (!raw || ["시작", "start"].includes(raw) || !user.activeBaseball) {
    user.activeBaseball = { answer: randomDigits(3), attempts: 0, createdAt: nowIso() };
    user.gamePlays += 1;
    return "숫자야구 시작!\n서로 다른 숫자 3개를 맞혀보세요.\n예시: /야구 123";
  }

  if (!/^\d{3}$/.test(raw) || new Set(raw).size !== 3) {
    return "서로 다른 숫자 3개를 입력해주세요.\n예시: /야구 123";
  }

  const game = user.activeBaseball;
  game.attempts += 1;
  let strikes = 0;
  let balls = 0;
  for (let i = 0; i < raw.length; i += 1) {
    if (raw[i] === game.answer[i]) strikes += 1;
    else if (game.answer.includes(raw[i])) balls += 1;
  }

  if (strikes === 3) {
    const reward = Math.max(8, 38 - game.attempts * 4);
    user.activeBaseball = null;
    user.gameWins += 1;
    addPoints(db, user, reward, "number_baseball", { attempts: game.attempts });
    return [`정답! ${raw}`, `${game.attempts}번 만에 성공`, `+${reward}P`, `현재: ${user.points.toLocaleString()}P / LV.${user.level}`].join("\n");
  }

  if (game.attempts >= 9) {
    const answer = game.answer;
    user.activeBaseball = null;
    return `실패! 정답은 ${answer}였습니다.`;
  }
  return `${raw}: ${strikes}S ${balls}B\n남은 기회: ${9 - game.attempts}번`;
}

function fastFinger(db, user, text) {
  if (!user.room) return "선착순은 채팅방에서만 사용할 수 있습니다.";
  touchRoom(db, user.room);
  const room = db.rooms[user.room];
  const raw = text.replace(/^(\/?선착순|\/fast)\s*/i, "").trim();
  const [mode, ...rest] = raw.split(/\s+/).filter(Boolean);

  if (["종료", "끝", "stop"].includes(mode)) {
    room.fastFinger = null;
    return "선착순 게임을 종료했습니다.";
  }

  if (["시작", "start"].includes(mode)) {
    const answer = rest.join(" ");
    if (!answer) return "사용법: /선착순 시작 단어";
    room.fastFinger = { answer, starterId: user.id, createdAt: nowIso() };
    return [`선착순 시작!`, `제시어: ${answer}`, `가장 먼저 /선착순 ${answer} 입력하면 승리`].join("\n");
  }

  if (!room.fastFinger) return "진행 중인 선착순 게임이 없습니다.\n/선착순 시작 단어";
  if (!raw) return `제시어: ${room.fastFinger.answer}`;
  if (compactGameAnswer(raw) !== compactGameAnswer(room.fastFinger.answer)) return "오답입니다.";

  const answer = room.fastFinger.answer;
  room.fastFinger = null;
  user.gamePlays += 1;
  user.gameWins += 1;
  addPoints(db, user, 15, "fast_finger", { answer });
  return [`선착순 성공! ${displayUserName(user)}님`, `정답: ${answer}`, "+15P", `현재: ${user.points.toLocaleString()}P / LV.${user.level}`].join("\n");
}

function rpgLevelFor(exp) {
  return Math.floor(Math.sqrt(Math.max(0, exp) / 45)) + 1;
}

function ensureRpg(user) {
  user.rpg ||= {};
  user.rpg.exp ||= 0;
  user.rpg.level = rpgLevelFor(user.rpg.exp);
  user.rpg.maxHp = 100 + (user.rpg.level - 1) * 8;
  user.rpg.maxEnergy = 100 + (user.rpg.level - 1) * 5;
  user.rpg.hp ??= user.rpg.maxHp;
  user.rpg.energy ??= user.rpg.maxEnergy;
  user.rpg.hp = Math.min(user.rpg.maxHp, Math.max(0, user.rpg.hp));
  user.rpg.energy = Math.min(user.rpg.maxEnergy, Math.max(0, user.rpg.energy));
  return user.rpg;
}

function rpgStats(user) {
  const rpg = ensureRpg(user);
  const itemCount = Object.values(user.inventory || {}).reduce((sum, count) => sum + count, 0);
  const weapon = user.equipment?.weapon || { level: 0 };
  const armor = user.equipment?.armor || { level: 0 };
  const pet = user.pet || {};
  return {
    attack: 8 + rpg.level * 3 + weapon.level * 4 + Math.floor((pet.level || 0) / 2) + Math.floor((user.gameWins || 0) / 5),
    defense: 7 + rpg.level * 2 + armor.level * 4 + Math.floor((pet.level || 0) / 3) + Math.floor(itemCount / 5),
    speed: 6 + rpg.level + (pet.level || 0) + Math.floor((user.attendanceStreak || 0) / 3),
    luck: 5 + Math.floor((user.points || 0) / 200) + Math.floor((user.chatCount || 0) / 30) + Math.floor((pet.wins || 0) / 3)
  };
}

function formatStats(stats) {
  return `⚔️공격 ${stats.attack} / 🛡️방어 ${stats.defense} / 💨민첩 ${stats.speed} / 🍀행운 ${stats.luck}`;
}

function addInventory(user, key, count = 1) {
  user.inventory ||= {};
  user.inventory[key] = (user.inventory[key] || 0) + count;
}

function addRpgExp(user, exp) {
  const rpg = ensureRpg(user);
  const before = rpg.level;
  rpg.exp += exp;
  ensureRpg(user);
  return { before, after: user.rpg.level, leveledUp: user.rpg.level > before };
}

function cooldownLeft(user, key, durationMs) {
  const last = user.cooldowns?.[key] || 0;
  return Math.max(0, Math.ceil((durationMs - (Date.now() - last)) / 1000));
}

function spendEnergy(user, amount) {
  const rpg = ensureRpg(user);
  if (rpg.energy < amount) return false;
  rpg.energy -= amount;
  return true;
}

function pickWeighted(rows) {
  const total = rows.reduce((sum, row) => sum + row.weight, 0);
  let roll = randomInt(1, total);
  return rows.find((row) => {
    roll -= row.weight;
    return roll <= 0;
  }) || rows[0];
}

const RPG_POOL_SIZE = 120;

function buildPool(leftRows, rightRows, maker, limit = RPG_POOL_SIZE) {
  const rows = [];
  for (const left of leftRows) {
    for (const right of rightRows) {
      rows.push(maker(left, right, rows.length));
      if (rows.length >= limit) return rows;
    }
  }
  return rows;
}

function rarityByIndex(index) {
  const slot = index % 10;
  if (slot >= 9) return { points: 55, exp: 55, weight: 3, difficulty: 5 };
  if (slot >= 7) return { points: 32, exp: 34, weight: 8, difficulty: 4 };
  if (slot >= 4) return { points: 16, exp: 18, weight: 18, difficulty: 3 };
  return { points: 6, exp: 8, weight: 30, difficulty: 1 };
}

function inventoryKey(category, label) {
  return `${category}:${label}`;
}

const FISHING_CATCHES = buildPool(
  ["은빛", "별빛", "황금", "달빛", "새벽", "노을", "유리", "그림자", "폭신", "고대", "무지개", "픽셀"],
  ["송사리", "잉어", "연어", "도미", "복어", "장어", "메기", "산천어", "참치", "고래 조각"],
  (prefix, fish, index) => {
    const rarity = rarityByIndex(index);
    const label = `${prefix} ${fish}`;
    return {
      label,
      key: inventoryKey("fish", label),
      points: rarity.points,
      exp: rarity.exp,
      weight: rarity.weight
    };
  }
);

const GATHERING_ITEMS = buildPool(
  ["싱싱한", "달콤한", "반짝이는", "따뜻한", "차가운", "향긋한", "고요한", "폭신한", "희귀한", "고대의", "무지개", "픽셀"],
  ["허브", "꿀열매", "버섯", "꽃잎", "씨앗", "나뭇가지", "수정", "이끼", "열매", "별조각"],
  (prefix, item, index) => {
    const rarity = rarityByIndex(index);
    const label = `${prefix} ${item}`;
    return {
      label,
      key: inventoryKey("gather", label),
      points: Math.max(1, rarity.points - 2),
      exp: rarity.exp,
      weight: rarity.weight
    };
  }
);

const ADVENTURE_EVENTS = buildPool(
  ["곰숲", "달빛 언덕", "꿀벌 들판", "픽셀 폐허", "노을 계곡", "유리 호수", "별무리 길", "안개 숲", "고대 다리", "무지개 습지", "바람 초원", "비밀 오두막"],
  ["샘물을 발견했습니다", "보물상자를 열었습니다", "반짝 발자국을 따라갔습니다", "가시덤불에 긁혔습니다", "길을 잃고 경험을 얻었습니다", "숨은 꿀단지를 찾았습니다", "작은 요정에게 도움을 받았습니다", "낡은 지도를 주웠습니다", "돌풍을 만나 기력이 줄었습니다", "빛나는 흔적을 기록했습니다"],
  (place, event, index) => {
    const rarity = rarityByIndex(index);
    const isBad = index % 10 === 3 || index % 10 === 8;
    const label = `${place} ${event}`;
    return {
      text: `${place}에서 ${event}.`,
      points: isBad ? 0 : rarity.points,
      exp: isBad ? Math.max(7, rarity.exp - 4) : rarity.exp,
      hp: index % 10 === 3 ? -12 : index % 10 === 6 ? 12 : 0,
      energy: index % 10 === 8 ? -8 : index % 10 === 0 ? 8 : 0,
      item: isBad ? "" : inventoryKey("adventure", label),
      itemLabel: label,
      weight: rarity.weight
    };
  }
);

const HUNT_MONSTERS = buildPool(
  ["장난꾸러기", "숲속", "꿀도둑", "별빛", "그림자", "고대", "노을", "얼음", "폭풍", "무지개", "픽셀", "왕관"],
  ["슬라임", "고블린", "늑대", "버섯병정", "멧돼지", "박쥐", "해골", "골렘", "드레이크", "곰수호자"],
  (prefix, monster, index) => {
    const rarity = rarityByIndex(index);
    const name = `${prefix} ${monster}`;
    return {
      name,
      difficulty: rarity.difficulty,
      points: rarity.points + 8,
      exp: rarity.exp + 10,
      damage: 6 + rarity.difficulty * 7,
      item: inventoryKey("hunt", `${name} 전리품`),
      itemLabel: `${name} 전리품`,
      weight: rarity.weight
    };
  }
);

const DUNGEON_REWARDS = buildPool(
  ["낡은", "푸른", "붉은", "황금", "달빛", "별빛", "고대", "왕관", "무지개", "픽셀", "비밀", "전설의"],
  ["비늘", "룬", "보석", "열쇠", "문장", "유물", "팔찌", "망토 조각", "왕관 조각", "심장석"],
  (prefix, reward, index) => {
    const rarity = rarityByIndex(index);
    const label = `${prefix} ${reward}`;
    return {
      key: inventoryKey("dungeon", label),
      label,
      weight: rarity.weight
    };
  }
);

const FORGE_RESULTS = buildPool(
  ["튼튼한", "가벼운", "날카로운", "묵직한", "빛나는", "그림자", "불꽃", "얼음", "바람", "왕관", "픽셀", "전설의"],
  ["단검", "검", "방패", "장갑", "부츠", "망치", "낚싯대", "활", "갑옷 조각", "부적"],
  (prefix, item, index) => {
    const rarity = rarityByIndex(index);
    const label = `${prefix} ${item}`;
    return {
      key: inventoryKey("forge", label),
      label,
      points: Math.floor(rarity.points / 2),
      exp: rarity.exp,
      weight: rarity.weight
    };
  }
);

const ALCHEMY_RESULTS = buildPool(
  ["맑은", "달콤한", "쌉쌀한", "반짝이는", "따뜻한", "차가운", "고요한", "폭신한", "무지개", "픽셀", "비밀", "전설의"],
  ["회복약", "기력약", "행운약", "용기약", "집중약", "수다약", "낚시약", "탐험약", "사냥약", "별가루"],
  (prefix, item, index) => {
    const rarity = rarityByIndex(index);
    const label = `${prefix} ${item}`;
    return {
      key: inventoryKey("alchemy", label),
      label,
      points: Math.floor(rarity.points / 2),
      exp: rarity.exp,
      hp: item.includes("회복") ? 25 : 0,
      energy: item.includes("기력") ? 25 : 0,
      weight: rarity.weight
    };
  }
);

const PET_TYPES = buildPool(
  ["꿀잠", "달빛", "별빛", "복슬", "용감한", "장난꾸러기", "고대", "무지개", "픽셀", "폭풍", "그림자", "왕관"],
  ["곰", "여우", "고양이", "강아지", "토끼", "펭귄", "용", "햄스터", "수달", "늑대"],
  (prefix, animal, index) => {
    const rarity = rarityByIndex(index);
    const emojis = ["🐻", "🦊", "🐱", "🐶", "🐰", "🐧", "🐉", "🐹", "🦦", "🐺"];
    return {
      name: `${prefix} ${animal}`,
      emoji: emojis[index % emojis.length],
      attack: 4 + rarity.difficulty * 2,
      defense: 3 + rarity.difficulty * 2,
      speed: 3 + rarity.difficulty,
      weight: rarity.weight
    };
  }
);

function rpgHelpText() {
  return [
    "픽셀곰 RPG",
    "결과에는 닉네임을 표시하고, 성별 표기는 빼고 불러요.",
    "/캐릭터 또는 /캐릭 - 내 RPG 상태",
    "/낚시 또는 /ㄴㅅ - 물고기/보물",
    "/채집 또는 /ㅊㅈ - 재료 수집",
    "/탐험 또는 /ㅌㅎ - 랜덤 이벤트",
    "/사냥 또는 /ㅅㄴ - 몬스터 전투",
    "/던전 또는 /ㄷㅈ - 큰 보상 도전",
    "/상점, /구매, /판매, /시세",
    "/대장간 또는 /제련 - 장비 제작",
    "/연금술 또는 /연금 - 물약 제작",
    "/휴식 또는 /ㅎㅅ - HP/기력 회복",
    "/가방 또는 /ㄱㅂ - 아이템 확인",
    "",
    "전체 도움말은 /도움말 참고"
  ].join("\n");
}

function rpgProfile(user) {
  const rpg = ensureRpg(user);
  const stats = rpgStats(user);
  const weaponLevel = user.equipment?.weapon?.level || 0;
  const armorLevel = user.equipment?.armor?.level || 0;
  return [
    `🐻 ${displayUserName(user)}님의 픽셀곰 RPG`,
    `RPG LV.${rpg.level} / EXP ${rpg.exp.toLocaleString()}`,
    `❤️ HP ${rpg.hp}/${rpg.maxHp}`,
    `⚡ 기력 ${rpg.energy}/${rpg.maxEnergy}`,
    formatStats(stats),
    `🗡️ 무기 +${weaponLevel} / 🛡️ 방어구 +${armorLevel}`,
    user.pet ? `🐾 펫 ${user.pet.emoji || "🐾"} ${user.pet.name} LV.${user.pet.level}` : "🐾 펫 없음",
    `💰 포인트 ${user.points.toLocaleString()}P`,
    `🎮 게임 ${user.gameWins.toLocaleString()}승 / ${user.gamePlays.toLocaleString()}회`,
    "명령어: /낚시 /채집 /탐험 /사냥 /던전 /강화 /펫"
  ].join("\n");
}

function formatRpgResult(title, user, rows, levelResult = null) {
  const rpg = ensureRpg(user);
  const lines = [title, `닉네임: ${displayUserName(user)}`, ...rows, `RPG LV.${rpg.level} / ❤️HP ${rpg.hp}/${rpg.maxHp} / ⚡기력 ${rpg.energy}/${rpg.maxEnergy}`, formatStats(rpgStats(user)), `💰 포인트 ${user.points.toLocaleString()}P`];
  if (levelResult?.leveledUp) lines.splice(1, 0, `RPG 레벨업! LV.${levelResult.before} -> LV.${levelResult.after}`);
  return lines.join("\n");
}

function fishing(db, user) {
  const left = cooldownLeft(user, "fishing", COOLDOWNS.fishingMs);
  if (left > 0) return `낚시는 ${left}초 뒤에 다시 가능합니다.`;
  if (!spendEnergy(user, 8)) return "기력이 부족합니다.\n/휴식 으로 회복하세요.";

  user.cooldowns.fishing = Date.now();
  user.gamePlays += 1;
  const result = pickWeighted(FISHING_CATCHES);

  if (result.key) addInventory(user, result.key);
  if (result.points) addPoints(db, user, result.points, "fishing", { item: result.label });
  if (result.points > 0) user.gameWins += 1;
  const level = addRpgExp(user, result.exp);
  return formatRpgResult("🎣 픽셀곰 낚시", user, [`획득: ${result.label}`, `+${result.points}P / +${result.exp}EXP`], level);
}

function gathering(db, user) {
  const left = cooldownLeft(user, "gather", COOLDOWNS.gatherMs);
  if (left > 0) return `채집은 ${left}초 뒤에 다시 가능합니다.`;
  if (!spendEnergy(user, 6)) return "기력이 부족합니다.\n/휴식 으로 회복하세요.";

  user.cooldowns.gather = Date.now();
  user.gamePlays += 1;
  const result = pickWeighted(GATHERING_ITEMS);

  addInventory(user, result.key);
  addPoints(db, user, result.points, "gathering", { item: result.label });
  user.gameWins += 1;
  const level = addRpgExp(user, result.exp);
  return formatRpgResult("🌿 픽셀곰 채집", user, [`획득: ${result.label}`, `+${result.points}P / +${result.exp}EXP`], level);
}

function adventure(db, user) {
  const left = cooldownLeft(user, "adventure", COOLDOWNS.adventureMs);
  if (left > 0) return `탐험은 ${left}초 뒤에 다시 가능합니다.`;
  if (!spendEnergy(user, 10)) return "기력이 부족합니다.\n/휴식 으로 회복하세요.";

  const rpg = ensureRpg(user);
  user.cooldowns.adventure = Date.now();
  user.gamePlays += 1;
  const event = pickWeighted(ADVENTURE_EVENTS);

  if (event.item) addInventory(user, event.item);
  if (event.points) addPoints(db, user, event.points, "adventure", { event: event.text });
  if (event.points > 0) user.gameWins += 1;
  rpg.hp = Math.min(rpg.maxHp, Math.max(0, rpg.hp + (event.hp || 0)));
  rpg.energy = Math.min(rpg.maxEnergy, Math.max(0, rpg.energy + (event.energy || 0)));
  const level = addRpgExp(user, event.exp);
  return formatRpgResult("🗺️ 픽셀곰 탐험", user, [event.text, `+${event.points}P / +${event.exp}EXP`], level);
}

function hunt(db, user) {
  const left = cooldownLeft(user, "hunt", COOLDOWNS.huntMs);
  if (left > 0) return `사냥은 ${left}초 뒤에 다시 가능합니다.`;
  const rpg = ensureRpg(user);
  if (rpg.hp < 20) return "HP가 낮아서 사냥할 수 없습니다.\n/휴식 으로 회복하세요.";
  if (!spendEnergy(user, 12)) return "기력이 부족합니다.\n/휴식 으로 회복하세요.";

  user.cooldowns.hunt = Date.now();
  user.gamePlays += 1;
  const monster = pickWeighted(HUNT_MONSTERS);
  const winChance = Math.min(85, 55 + rpg.level * 5 - monster.difficulty * 6);
  const won = randomInt(1, 100) <= winChance;

  if (won) {
    addInventory(user, monster.item);
    addPoints(db, user, monster.points, "hunt_win", { monster: monster.name });
    user.gameWins += 1;
    const level = addRpgExp(user, monster.exp);
    return formatRpgResult("⚔️ 픽셀곰 사냥 성공", user, [`상대: ${monster.name}`, `+${monster.points}P / +${monster.exp}EXP`, `획득: ${itemDisplayName(monster.item)}`], level);
  }

  rpg.hp = Math.max(0, rpg.hp - monster.damage);
  const level = addRpgExp(user, Math.ceil(monster.exp / 3));
  return formatRpgResult("⚔️ 픽셀곰 사냥 실패", user, [`상대: ${monster.name}`, `피해: -${monster.damage}HP`, `+${Math.ceil(monster.exp / 3)}EXP`], level);
}

function dungeon(db, user) {
  const left = cooldownLeft(user, "dungeon", COOLDOWNS.dungeonMs);
  if (left > 0) return `던전은 ${left}초 뒤에 다시 가능합니다.`;
  const rpg = ensureRpg(user);
  if (rpg.hp < 35) return "HP가 낮아서 던전에 들어갈 수 없습니다.\n/휴식 으로 회복하세요.";
  if (!spendEnergy(user, 20)) return "기력이 부족합니다.\n/휴식 으로 회복하세요.";

  user.cooldowns.dungeon = Date.now();
  user.gamePlays += 1;
  const success = randomInt(1, 100) <= Math.min(78, 42 + rpg.level * 6);
  if (success) {
    const points = randomInt(45, 90);
    const exp = randomInt(70, 120);
    const item = pickWeighted(DUNGEON_REWARDS);
    addInventory(user, item.key);
    addPoints(db, user, points, "dungeon_clear", { item: item.label });
    user.gameWins += 1;
    const level = addRpgExp(user, exp);
    return formatRpgResult("🏰 던전 클리어!", user, [`보상: ${item.label}`, `+${points}P / +${exp}EXP`], level);
  }

  const damage = randomInt(18, 40);
  rpg.hp = Math.max(0, rpg.hp - damage);
  const exp = randomInt(20, 40);
  const level = addRpgExp(user, exp);
  return formatRpgResult("🏰 던전 실패", user, [`피해: -${damage}HP`, `그래도 +${exp}EXP`], level);
}

function restRpg(user) {
  const left = cooldownLeft(user, "rest", COOLDOWNS.restMs);
  if (left > 0) return `휴식은 ${left}초 뒤에 다시 가능합니다.`;
  const rpg = ensureRpg(user);
  user.cooldowns.rest = Date.now();
  rpg.hp = rpg.maxHp;
  rpg.energy = rpg.maxEnergy;
  return [`휴식 완료`, `HP ${rpg.hp}/${rpg.maxHp}`, `기력 ${rpg.energy}/${rpg.maxEnergy}`].join("\n");
}

function rps(db, user, text) {
  const now = Date.now();
  const last = user.cooldowns?.rps || 0;
  if (now - last < COOLDOWNS.rpsMs) return "가위바위보는 30초에 한 번만 가능합니다.";

  const rawChoice = text.replace(/^(\/?가위바위보|\/rps)\s*/i, "").trim();
  const choiceMap = {
    scissors: "가위",
    scissor: "가위",
    sci: "가위",
    "1": "가위",
    rock: "바위",
    r: "바위",
    "2": "바위",
    paper: "보",
    p: "보",
    "3": "보"
  };
  const mine = choiceMap[rawChoice.toLowerCase()] || rawChoice;
  const choices = ["가위", "바위", "보"];
  if (!choices.includes(mine)) return "사용법: /가위바위보 가위|바위|보\n또는 /rps rock|paper|scissors";

  const bot = choices[Math.floor(Math.random() * choices.length)];
  const win =
    (mine === "가위" && bot === "보") ||
    (mine === "바위" && bot === "가위") ||
    (mine === "보" && bot === "바위");
  const draw = mine === bot;
  const gained = win ? POINT_RULES.rpsWin : draw ? POINT_RULES.rpsDraw : 0;
  user.cooldowns.rps = now;
  user.gamePlays += 1;
  if (win) user.gameWins += 1;
  if (gained) addPoints(db, user, gained, win ? "rps_win" : "rps_draw", { mine, bot });

  const result = win ? "승리" : draw ? "비김" : "패배";
  return [`${displayUserName(user)}: ${mine}`, `픽셀곰: ${bot}`, `결과: ${result}`, `획득: +${gained}P`, `현재: ${user.points.toLocaleString()}P / LV.${user.level}`].join("\n");
}

function dice(db, user) {
  const now = Date.now();
  const last = user.cooldowns?.dice || 0;
  if (now - last < COOLDOWNS.diceMs) return "주사위는 10분에 한 번만 가능합니다.";

  const rolled = Math.floor(Math.random() * POINT_RULES.diceMax) + POINT_RULES.diceMin;
  user.cooldowns.dice = now;
  user.gamePlays += 1;
  addPoints(db, user, rolled, "dice", { rolled });
  return `주사위 결과: ${rolled}\n+${rolled}P\n현재: ${user.points.toLocaleString()}P / LV.${user.level}`;
}

function quiz(user) {
  const a = Math.floor(Math.random() * 20) + 1;
  const b = Math.floor(Math.random() * 20) + 1;
  const op = ["+", "-", "*"][Math.floor(Math.random() * 3)];
  const answer = op === "+" ? a + b : op === "-" ? a - b : a * b;
  user.activeQuiz = { answer, createdAt: nowIso(), question: `${a} ${op} ${b}` };
  user.updatedAt = nowIso();
  return `퀴즈!\n${a} ${op} ${b} = ?\n/정답 숫자 로 답해주세요.`;
}

function answerQuiz(db, user, text) {
  if (!user.activeQuiz) return "진행 중인 퀴즈가 없습니다.\n/퀴즈 로 새 문제를 받아보세요.";
  const answer = Number(text.replace(/^(\/?정답|\/answer)\s*/i, "").trim());
  if (!Number.isFinite(answer)) return "사용법: /정답 숫자";

  const correct = answer === user.activeQuiz.answer;
  const question = user.activeQuiz.question;
  user.activeQuiz = null;
  if (!correct) return `오답입니다.\n문제: ${question}`;

  user.gameWins += 1;
  user.gamePlays += 1;
  addPoints(db, user, POINT_RULES.quizCorrect, "quiz_correct", { question });
  return `정답입니다!\n+${POINT_RULES.quizCorrect}P\n현재: ${user.points.toLocaleString()}P / LV.${user.level}`;
}

function coin(db, user, text) {
  const now = Date.now();
  const last = user.cooldowns?.coin || 0;
  if (now - last < COOLDOWNS.coinMs) return "동전은 15초에 한 번만 가능합니다.";

  const raw = text.replace(/^(\/?동전|\/coin)\s*/i, "").trim();
  const map = { front: "앞", head: "앞", heads: "앞", h: "앞", back: "뒤", tail: "뒤", tails: "뒤", t: "뒤" };
  const guess = map[raw.toLowerCase()] || raw;
  const result = Math.random() < 0.5 ? "앞" : "뒤";
  user.cooldowns.coin = now;
  user.gamePlays += 1;

  if (!guess) return `동전 결과: ${result}`;
  if (!["앞", "뒤"].includes(guess)) return "사용법: /동전 앞|뒤";

  const won = guess === result;
  if (won) {
    user.gameWins += 1;
    addPoints(db, user, POINT_RULES.coinWin, "coin_win", { guess, result });
  }
  return [`동전 결과: ${result}`, won ? `정답! +${POINT_RULES.coinWin}P` : "아쉽게 틀렸습니다.", `현재: ${user.points.toLocaleString()}P / LV.${user.level}`].join("\n");
}

function oddEven(db, user, text) {
  const now = Date.now();
  const last = user.cooldowns?.oddEven || 0;
  if (now - last < COOLDOWNS.oddEvenMs) return "홀짝은 20초에 한 번만 가능합니다.";

  const raw = text.replace(/^(\/?홀짝|\/oe|\/oddeven)\s*/i, "").trim();
  const map = { odd: "홀", o: "홀", even: "짝", e: "짝" };
  const guess = map[raw.toLowerCase()] || raw;
  if (!["홀", "짝"].includes(guess)) return "사용법: /홀짝 홀|짝";

  const number = randomInt(1, 100);
  const result = number % 2 === 0 ? "짝" : "홀";
  const won = guess === result;
  user.cooldowns.oddEven = now;
  user.gamePlays += 1;
  if (won) {
    user.gameWins += 1;
    addPoints(db, user, POINT_RULES.oddEvenWin, "odd_even_win", { guess, number });
  }
  return [`숫자: ${number} (${result})`, won ? `정답! +${POINT_RULES.oddEvenWin}P` : "아쉽게 틀렸습니다.", `현재: ${user.points.toLocaleString()}P / LV.${user.level}`].join("\n");
}

function roulette(db, user) {
  const now = Date.now();
  const last = user.cooldowns?.roulette || 0;
  if (now - last < COOLDOWNS.rouletteMs) return "룰렛은 1분에 한 번만 가능합니다.";

  const rewards = [
    { label: "꽝", points: 0 },
    { label: "곰젤리", points: 3 },
    { label: "작은 별", points: 7 },
    { label: "반짝 보너스", points: 15 },
    { label: "황금곰", points: 30 },
    { label: "대박", points: 50 }
  ];
  const reward = rewards[Math.floor(Math.random() * rewards.length)];
  user.cooldowns.roulette = now;
  user.gamePlays += 1;
  if (reward.points > 0) addPoints(db, user, reward.points, "roulette", { label: reward.label });
  return [`룰렛 결과: ${reward.label}`, `획득: +${reward.points}P`, `현재: ${user.points.toLocaleString()}P / LV.${user.level}`].join("\n");
}

function luckyBox(db, user) {
  const today = todayKst();
  if (user.daily.luckyBox === today) return "행운상자는 하루에 한 번만 열 수 있습니다.";
  const reward = randomInt(POINT_RULES.luckyBoxMin, POINT_RULES.luckyBoxMax);
  user.daily.luckyBox = today;
  user.gamePlays += 1;
  addPoints(db, user, reward, "lucky_box");
  return [`행운상자 개봉!`, `+${reward}P`, `현재: ${user.points.toLocaleString()}P / LV.${user.level}`].join("\n");
}

function gacha(db, user) {
  const now = Date.now();
  const last = user.cooldowns?.gacha || 0;
  if (now - last < COOLDOWNS.gachaMs) return "뽑기는 2분에 한 번만 가능합니다.";
  if (user.points < POINT_RULES.gachaCost) return `뽑기는 ${POINT_RULES.gachaCost}P가 필요합니다.\n현재: ${user.points.toLocaleString()}P`;

  const items = [
    { key: "bear_jelly", name: "곰젤리", points: 0, weight: 40 },
    { key: "star_piece", name: "별조각", points: 5, weight: 28 },
    { key: "lucky_ticket", name: "행운권", points: 12, weight: 20 },
    { key: "golden_bear", name: "황금곰", points: 30, weight: 10 },
    { key: "legend_badge", name: "전설 배지", points: 80, weight: 2 }
  ];
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let roll = randomInt(1, total);
  const item = items.find((candidate) => {
    roll -= candidate.weight;
    return roll <= 0;
  }) || items[0];

  user.cooldowns.gacha = now;
  user.gamePlays += 1;
  user.inventory[item.key] = (user.inventory[item.key] || 0) + 1;
  addPoints(db, user, -POINT_RULES.gachaCost, "gacha_cost", { item: item.name });
  if (item.points > 0) addPoints(db, user, item.points, "gacha_reward", { item: item.name });
  return [`뽑기 결과: ${item.name}`, `비용: -${POINT_RULES.gachaCost}P`, `보너스: +${item.points}P`, `현재: ${user.points.toLocaleString()}P / LV.${user.level}`].join("\n");
}

const ITEM_CATALOG = {
  bear_jelly: { name: "곰젤리", sell: 2 },
  star_piece: { name: "별조각", sell: 5 },
  lucky_ticket: { name: "행운권", sell: 10 },
  golden_bear: { name: "황금곰", sell: 24 },
  legend_badge: { name: "전설 배지", sell: 60 },
  silver_minnow: { name: "은빛 송사리", sell: 4 },
  star_carp: { name: "별빛 잉어", sell: 8 },
  gold_salmon: { name: "황금 연어", sell: 18 },
  moon_whale_shard: { name: "달빛 고래 조각", sell: 45 },
  wet_boot: { name: "젖은 장화", sell: 1 },
  herb: { name: "허브", sell: 3 },
  honey_berry: { name: "꿀열매", sell: 5 },
  glow_mushroom: { name: "반짝 버섯", sell: 10 },
  dry_branch: { name: "마른 나뭇가지", sell: 1 },
  spring_water: { name: "샘물", sell: 4 },
  honey_pot: { name: "꿀단지", sell: 10 },
  bear_mark: { name: "곰 발자국", sell: 8 },
  tiny_treasure: { name: "작은 보물상자", sell: 20 },
  slime_jelly: { name: "슬라임 젤리", sell: 7 },
  shadow_leaf: { name: "그림자 잎", sell: 12 },
  wild_tusk: { name: "멧돼지 엄니", sell: 16 },
  golem_core: { name: "골렘 코어", sell: 30 },
  ancient_scale: { name: "고대 비늘", sell: 24 },
  pixel_relic: { name: "픽셀 유물", sell: 35 },
  bear_crown: { name: "곰왕관 조각", sell: 50 },
  healing_potion: { name: "회복 물약", cost: 35, sell: 12, shop: true, use: "heal" },
  energy_potion: { name: "기력 물약", cost: 35, sell: 12, shop: true, use: "energy" },
  iron_ore: { name: "철광석", cost: 25, sell: 9, shop: true },
  alchemy_dust: { name: "연금 가루", cost: 30, sell: 10, shop: true },
  lucky_charm: { name: "행운 부적", cost: 80, sell: 25, shop: true, use: "points" },
  weapon_scroll: { name: "무기 주문서", cost: 60, sell: 20, shop: true },
  armor_scroll: { name: "방어구 주문서", cost: 60, sell: 20, shop: true },
  blessed_scroll: { name: "축복 주문서", cost: 150, sell: 45, shop: true },
  pet_food: { name: "펫 간식", cost: 25, sell: 8, shop: true },
  pet_ticket: { name: "펫 입양권", cost: 100, sell: 35, shop: true }
};

const CATEGORY_SELL_VALUES = {
  fish: 6,
  gather: 5,
  adventure: 8,
  hunt: 14,
  dungeon: 24,
  forge: 22,
  alchemy: 16
};

function itemDisplayName(key) {
  if (ITEM_CATALOG[key]) return ITEM_CATALOG[key].name;
  if (String(key).includes(":")) return String(key).split(":").slice(1).join(":");
  return String(key);
}

function itemSellValue(key) {
  if (ITEM_CATALOG[key]?.sell != null) return ITEM_CATALOG[key].sell;
  const category = String(key).split(":")[0];
  return CATEGORY_SELL_VALUES[category] || 3;
}

function shopItems() {
  return Object.entries(ITEM_CATALOG)
    .filter(([, item]) => item.shop)
    .map(([key, item]) => ({ key, ...item }));
}

function findShopItem(query) {
  const key = nicknameLookupKey(query);
  return shopItems().find((item) => nicknameLookupKey(item.name) === key || nicknameLookupKey(item.name).includes(key));
}

function findInventoryKey(user, query) {
  const wanted = nicknameLookupKey(query);
  if (!wanted) return "";
  const keys = Object.keys(user.inventory || {}).filter((key) => (user.inventory[key] || 0) > 0);
  return keys.find((key) => nicknameLookupKey(itemDisplayName(key)) === wanted)
    || keys.find((key) => nicknameLookupKey(itemDisplayName(key)).includes(wanted))
    || "";
}

function removeInventory(user, key, count = 1) {
  user.inventory ||= {};
  user.inventory[key] = Math.max(0, (user.inventory[key] || 0) - count);
  if (user.inventory[key] <= 0) delete user.inventory[key];
}

function inventoryText(user) {
  const rows = Object.entries(user.inventory || {}).filter(([, count]) => count > 0);
  if (!rows.length) return "가방이 비어 있습니다.\n/뽑기 로 아이템을 얻어보세요.";
  return [
    `${displayUserName(user)}님의 가방`,
    "",
    ...rows.map(([key, count]) => `• ${itemDisplayName(key)} x${count} / 판매 ${itemSellValue(key)}P`)
  ].join("\n");
}

function shopText() {
  return [
    "🛒 픽셀곰 상점",
    ...shopItems().map((item) => `• ${item.name} ${item.cost}P / 판매 ${item.sell}P`),
    "",
    "명령어",
    "/구매 아이템명 [수량]",
    "/판매 아이템명 [수량]",
    "/판매 전체",
    "/시세",
    "/사용 회복 물약",
    "/대장간, /강화, /연금술",
    "/펫, /펫훈련, /펫대전",
    `/뽑기 - ${POINT_RULES.gachaCost}P로 아이템/보상 획득`,
    "/가방 - 내 아이템 보기"
  ].join("\n");
}

function buyItem(db, user, text) {
  const raw = text.replace(/^(\/?구매|\/?buy)\s*/i, "").trim();
  if (!raw) return shopText();
  const args = raw.split(/\s+/).filter(Boolean);
  const last = Number(args.at(-1));
  const count = Number.isInteger(last) && last > 0 ? Math.min(20, last) : 1;
  const itemName = (count > 1 ? args.slice(0, -1) : args).join(" ");
  const item = findShopItem(itemName);
  if (!item) return "상점에서 찾지 못했습니다.\n/상점 으로 목록을 확인해주세요.";
  const cost = item.cost * count;
  if (user.points < cost) return `포인트가 부족합니다.\n필요: ${cost.toLocaleString()}P\n현재: ${user.points.toLocaleString()}P`;
  addPoints(db, user, -cost, "shop_buy", { item: item.name, count });
  addInventory(user, item.key, count);
  return [
    "구매 완료",
    `닉네임: ${displayUserName(user)}`,
    `${item.name} x${count}`,
    `비용: -${cost.toLocaleString()}P`,
    `현재: ${user.points.toLocaleString()}P / LV.${user.level}`
  ].join("\n");
}

function sellItem(db, user, text) {
  const raw = text.replace(/^(\/?판매|\/?팔기|\/sell)\s*/i, "").trim();
  const rows = Object.entries(user.inventory || {}).filter(([, count]) => count > 0);
  if (!raw) return "사용법: /판매 아이템명 [수량]\n예시: /판매 별조각 2\n전체 판매: /판매 전체";
  if (!rows.length) return "가방이 비어 있습니다.";

  if (["전체", "전부", "all"].includes(raw.toLowerCase())) {
    const total = rows.reduce((sum, [key, count]) => sum + itemSellValue(key) * count, 0);
    user.inventory = {};
    addPoints(db, user, total, "sell_all", { items: rows.length });
    return [
      "전체 판매 완료",
      `닉네임: ${displayUserName(user)}`,
      `판매금: +${total.toLocaleString()}P`,
      `현재: ${user.points.toLocaleString()}P / LV.${user.level}`
    ].join("\n");
  }

  const args = raw.split(/\s+/).filter(Boolean);
  const last = Number(args.at(-1));
  const count = Number.isInteger(last) && last > 0 ? last : 1;
  const itemName = (count > 1 ? args.slice(0, -1) : args).join(" ");
  const key = findInventoryKey(user, itemName);
  if (!key) return `${itemName} 아이템을 가방에서 찾지 못했습니다.\n/가방 으로 확인해주세요.`;
  const owned = user.inventory[key] || 0;
  const sellCount = Math.min(count, owned);
  const gained = itemSellValue(key) * sellCount;
  removeInventory(user, key, sellCount);
  addPoints(db, user, gained, "sell_item", { item: itemDisplayName(key), count: sellCount });
  return [
    "판매 완료",
    `닉네임: ${displayUserName(user)}`,
    `${itemDisplayName(key)} x${sellCount}`,
    `판매금: +${gained.toLocaleString()}P`,
    `현재: ${user.points.toLocaleString()}P / LV.${user.level}`
  ].join("\n");
}

function priceText(user, text) {
  const raw = text.replace(/^(\/?시세|\/?가격|\/price)\s*/i, "").trim();
  if (raw) {
    const key = findInventoryKey(user, raw) || findShopItem(raw)?.key || raw;
    return [`픽셀곰 시세`, `${itemDisplayName(key)}: 판매 ${itemSellValue(key)}P`].join("\n");
  }
  return [
    "픽셀곰 시세",
    "낚시 물고기: 6P",
    "채집 재료: 5P",
    "탐험 보물: 8P",
    "사냥 전리품: 14P",
    "던전 보상: 24P",
    "대장간 장비: 22P",
    "연금술 결과물: 16P",
    "",
    "내 아이템 상세는 /가방"
  ].join("\n");
}

function useItem(db, user, text) {
  const raw = text.replace(/^(\/?사용|\/?use)\s*/i, "").trim();
  if (!raw) return "사용법: /사용 회복 물약\n사용 가능: 회복 물약, 기력 물약, 행운 부적";
  const key = findInventoryKey(user, raw);
  if (!key) return `${raw} 아이템을 가방에서 찾지 못했습니다.`;
  const item = ITEM_CATALOG[key];
  if (!item?.use) return `${itemDisplayName(key)}은(는) 바로 사용할 수 없는 아이템입니다.\n/판매 로 포인트로 바꿀 수 있어요.`;

  const rpg = ensureRpg(user);
  removeInventory(user, key, 1);
  if (item.use === "heal") {
    rpg.hp = Math.min(rpg.maxHp, rpg.hp + 60);
    return [`아이템 사용`, `닉네임: ${displayUserName(user)}`, `${item.name}: HP +60`, `HP ${rpg.hp}/${rpg.maxHp}`].join("\n");
  }
  if (item.use === "energy") {
    rpg.energy = Math.min(rpg.maxEnergy, rpg.energy + 60);
    return [`아이템 사용`, `닉네임: ${displayUserName(user)}`, `${item.name}: 기력 +60`, `기력 ${rpg.energy}/${rpg.maxEnergy}`].join("\n");
  }
  const gained = randomInt(8, 20);
  addPoints(db, user, gained, "use_lucky_charm");
  return [`아이템 사용`, `닉네임: ${displayUserName(user)}`, `${item.name}: +${gained}P`, `현재: ${user.points.toLocaleString()}P / LV.${user.level}`].join("\n");
}

function forgeItem(db, user, text) {
  const raw = text.replace(/^(\/?대장간|\/?제련|\/forge)\s*/i, "").trim();
  if (!raw && !/^\/?(제련|강화|forge)/i.test(text)) {
    return [
      "⚒️ 픽셀곰 대장간",
      "철광석 1개와 40P로 장비를 제작합니다.",
      "장비 결과물은 120종입니다.",
      "",
      "/제련",
      "/강화 무기 또는 /강화 방어구",
      "/구매 철광석"
    ].join("\n");
  }
  const cost = 40;
  if ((user.inventory?.iron_ore || 0) < 1) return "철광석이 필요합니다.\n/구매 철광석";
  if (user.points < cost) return `포인트가 부족합니다.\n필요: ${cost}P\n현재: ${user.points.toLocaleString()}P`;
  removeInventory(user, "iron_ore", 1);
  addPoints(db, user, -cost, "forge_cost");
  const item = pickWeighted(FORGE_RESULTS);
  addInventory(user, item.key);
  if (item.points) addPoints(db, user, item.points, "forge_bonus", { item: item.label });
  const level = addRpgExp(user, item.exp);
  return formatRpgResult("대장간 제련 완료", user, [`획득: ${item.label}`, `비용: 철광석 x1 / -${cost}P`, `보너스: +${item.points}P / +${item.exp}EXP`], level);
}

function alchemyItem(db, user, text) {
  const raw = text.replace(/^(\/?연금술|\/?연금|\/alchemy)\s*/i, "").trim();
  if (!raw && !/^\/?(연금|alchemy)/i.test(text)) {
    return [
      "픽셀곰 연금술",
      "연금 가루 1개와 35P로 물약/가루를 만듭니다.",
      "연금 결과물은 120종입니다.",
      "",
      "/연금",
      "/구매 연금 가루"
    ].join("\n");
  }
  const cost = 35;
  if ((user.inventory?.alchemy_dust || 0) < 1) return "연금 가루가 필요합니다.\n/구매 연금 가루";
  if (user.points < cost) return `포인트가 부족합니다.\n필요: ${cost}P\n현재: ${user.points.toLocaleString()}P`;
  removeInventory(user, "alchemy_dust", 1);
  addPoints(db, user, -cost, "alchemy_cost");
  const item = pickWeighted(ALCHEMY_RESULTS);
  addInventory(user, item.key);
  if (item.points) addPoints(db, user, item.points, "alchemy_bonus", { item: item.label });
  const rpg = ensureRpg(user);
  rpg.hp = Math.min(rpg.maxHp, rpg.hp + (item.hp || 0));
  rpg.energy = Math.min(rpg.maxEnergy, rpg.energy + (item.energy || 0));
  const level = addRpgExp(user, item.exp);
  return formatRpgResult("연금술 성공", user, [`획득: ${item.label}`, `비용: 연금 가루 x1 / -${cost}P`, `보너스: +${item.points}P / +${item.exp}EXP`], level);
}

function enhanceEquipment(db, user, text) {
  const raw = text.replace(/^(\/?강화|\/enhance)\s*/i, "").trim();
  if (!raw) {
    const weapon = user.equipment?.weapon?.level || 0;
    const armor = user.equipment?.armor?.level || 0;
    return [
      "✨ 픽셀곰 강화",
      `닉네임: ${displayUserName(user)}`,
      `🗡️ 무기 +${weapon}`,
      `🛡️ 방어구 +${armor}`,
      "",
      "/강화 무기",
      "/강화 방어구",
      "/구매 무기 주문서",
      "/구매 방어구 주문서",
      "/구매 축복 주문서"
    ].join("\n");
  }
  const type = /방어|갑옷|armor/i.test(raw) ? "armor" : "weapon";
  const label = type === "armor" ? "방어구" : "무기";
  const scrollKey = /축복|bless/i.test(raw) ? "blessed_scroll" : type === "armor" ? "armor_scroll" : "weapon_scroll";
  const scrollName = itemDisplayName(scrollKey);
  if ((user.inventory?.[scrollKey] || 0) < 1) return `${scrollName}가 필요합니다.\n/구매 ${scrollName}`;
  user.equipment ||= {};
  user.equipment[type] ||= { level: 0, attempts: 0 };
  const level = user.equipment[type].level || 0;
  const cost = 50 + level * 25;
  if (user.points < cost) return `포인트가 부족합니다.\n필요: ${cost.toLocaleString()}P\n현재: ${user.points.toLocaleString()}P`;

  removeInventory(user, scrollKey, 1);
  addPoints(db, user, -cost, "enhance_cost", { type, level });
  user.equipment[type].attempts = (user.equipment[type].attempts || 0) + 1;
  const chance = Math.max(25, 82 - level * 6 + (scrollKey === "blessed_scroll" ? 12 : 0));
  const success = randomInt(1, 100) <= chance;
  if (success) user.equipment[type].level = level + 1;
  return [
    success ? "✨ 강화 성공!" : "💥 강화 실패",
    `닉네임: ${displayUserName(user)}`,
    `${label}: +${level} -> +${user.equipment[type].level}`,
    `주문서: ${scrollName}`,
    `성공률: ${chance}%`,
    `비용: -${cost.toLocaleString()}P`,
    formatStats(rpgStats(user))
  ].join("\n");
}

function petLevelFor(exp) {
  return Math.floor(Math.sqrt(Math.max(0, exp) / 35)) + 1;
}

function syncPet(pet) {
  if (!pet) return null;
  pet.exp ||= 0;
  pet.level = petLevelFor(pet.exp);
  pet.wins ||= 0;
  pet.battles ||= 0;
  return pet;
}

function petStats(pet) {
  const row = syncPet(pet);
  if (!row) return { attack: 0, defense: 0, speed: 0 };
  return {
    attack: row.attack + row.level * 2,
    defense: row.defense + row.level * 2,
    speed: row.speed + row.level
  };
}

function formatPetStats(pet) {
  const stats = petStats(pet);
  return `⚔️공격 ${stats.attack} / 🛡️방어 ${stats.defense} / 💨민첩 ${stats.speed}`;
}

function petStatusText(user) {
  const pet = syncPet(user.pet);
  if (!pet) {
    return [
      "🐾 픽셀곰 펫",
      "아직 펫이 없습니다.",
      "/펫입양 으로 첫 펫을 무료 입양할 수 있어요.",
      "",
      "명령어",
      "/펫입양",
      "/펫훈련",
      "/펫대전"
    ].join("\n");
  }
  return [
    `🐾 ${displayUserName(user)}님의 펫`,
    `${pet.emoji || "🐾"} ${pet.name} LV.${pet.level}`,
    `EXP ${pet.exp.toLocaleString()}`,
    formatPetStats(pet),
    `대전 ${pet.wins.toLocaleString()}승 / ${pet.battles.toLocaleString()}회`,
    "",
    "/펫훈련, /펫대전"
  ].join("\n");
}

function adoptPet(db, user) {
  const replacing = Boolean(user.pet);
  if (replacing && (user.inventory?.pet_ticket || 0) < 1) {
    return "이미 펫이 있습니다.\n새 펫을 다시 입양하려면 /구매 펫 입양권 후 /펫입양";
  }
  if (replacing) removeInventory(user, "pet_ticket", 1);
  const template = pickWeighted(PET_TYPES);
  user.pet = {
    name: template.name,
    emoji: template.emoji,
    attack: template.attack,
    defense: template.defense,
    speed: template.speed,
    exp: 0,
    level: 1,
    wins: 0,
    battles: 0,
    adoptedAt: nowIso()
  };
  addEvent(db, user, "pet_adopt", { pet: user.pet.name });
  return [
    replacing ? "🐾 새 펫 입양 완료" : "🐾 첫 펫 입양 완료",
    `닉네임: ${displayUserName(user)}`,
    `${user.pet.emoji} ${user.pet.name}`,
    formatPetStats(user.pet),
    "/펫훈련 으로 키우고 /펫대전 으로 싸울 수 있어요."
  ].join("\n");
}

function petCommand(db, user, text) {
  const raw = text.replace(/^(\/?펫|\/pet)\s*/i, "").trim();
  if (!raw) return petStatusText(user);
  if (["입양", "분양", "adopt"].includes(raw)) return adoptPet(db, user);
  return petStatusText(user);
}

function petTrain(db, user) {
  const pet = syncPet(user.pet);
  if (!pet) return "펫이 없습니다.\n/펫입양 먼저 해주세요.";
  const left = cooldownLeft(user, "petTrain", COOLDOWNS.petTrainMs);
  if (left > 0) return `펫훈련은 ${left}초 뒤에 다시 가능합니다.`;
  user.cooldowns.petTrain = Date.now();
  const usedFood = (user.inventory?.pet_food || 0) > 0;
  if (usedFood) removeInventory(user, "pet_food", 1);
  const exp = usedFood ? randomInt(35, 55) : randomInt(15, 25);
  pet.exp += exp;
  syncPet(pet);
  const points = usedFood ? 10 : 4;
  addPoints(db, user, points, "pet_train", { pet: pet.name, exp, usedFood });
  return [
    "🐾 펫훈련 완료",
    `닉네임: ${displayUserName(user)}`,
    `${pet.emoji} ${pet.name} LV.${pet.level}`,
    usedFood ? "펫 간식 사용: 훈련 효과 증가" : "펫 간식 없이 기본 훈련",
    `+${exp} PET EXP / +${points}P`,
    formatPetStats(pet)
  ].join("\n");
}

function petBattle(db, user, text) {
  const pet = syncPet(user.pet);
  if (!pet) return "펫이 없습니다.\n/펫입양 먼저 해주세요.";
  const left = cooldownLeft(user, "petBattle", COOLDOWNS.petBattleMs);
  if (left > 0) return `펫대전은 ${left}초 뒤에 다시 가능합니다.`;

  const targetName = text.replace(/^(\/?펫대전|\/petbattle)\s*/i, "").trim();
  let enemyOwner = null;
  let enemy = null;
  if (targetName) {
    const result = findOneUserByName(db, user.room, targetName, user.id);
    if (result.error) return result.error;
    enemyOwner = result.user;
    enemy = syncPet(enemyOwner?.pet);
  }
  if (!enemy) {
    const wild = pickWeighted(PET_TYPES);
    enemy = {
      ...wild,
      exp: randomInt(0, 180),
      level: randomInt(1, Math.max(2, pet.level + 1)),
      wins: 0,
      battles: 0
    };
    enemyOwner = null;
  }

  user.cooldowns.petBattle = Date.now();
  const mineStats = petStats(pet);
  const enemyStats = petStats(enemy);
  const myPower = mineStats.attack * 2 + mineStats.defense + mineStats.speed + randomInt(1, 30);
  const enemyPower = enemyStats.attack * 2 + enemyStats.defense + enemyStats.speed + randomInt(1, 30);
  const won = myPower >= enemyPower;
  pet.battles += 1;
  pet.exp += won ? 45 : 18;
  if (won) pet.wins += 1;
  syncPet(pet);
  if (enemyOwner?.pet) {
    enemyOwner.pet.battles = (enemyOwner.pet.battles || 0) + 1;
    enemyOwner.pet.exp = (enemyOwner.pet.exp || 0) + (won ? 8 : 25);
    if (!won) enemyOwner.pet.wins = (enemyOwner.pet.wins || 0) + 1;
    syncPet(enemyOwner.pet);
  }

  const reward = won ? 25 : 7;
  addPoints(db, user, reward, won ? "pet_battle_win" : "pet_battle_lose", { enemy: enemy.name });
  user.gamePlays += 1;
  if (won) user.gameWins += 1;
  return [
    won ? "🏆 펫대전 승리!" : "🐾 펫대전 패배",
    `닉네임: ${displayUserName(user)}`,
    `내 펫: ${pet.emoji} ${pet.name} LV.${pet.level}`,
    `상대: ${enemy.emoji || "🐾"} ${enemy.name} LV.${enemy.level}${enemyOwner ? ` (${displayUserName(enemyOwner)})` : " (야생)"}`,
    `전투력: ${myPower} vs ${enemyPower}`,
    `보상: +${reward}P`,
    formatPetStats(pet)
  ].join("\n");
}

function setAutoAdventurePermission(db, user, text, enabled) {
  const denied = requireAdmin(user);
  if (denied) return denied;
  const targetName = text.replace(/^(\/?(오토권한|오토허용|오토해제|오토금지))\s*/i, "").trim();
  if (!targetName) return enabled ? "사용법: /오토권한 닉네임" : "사용법: /오토해제 닉네임";
  const result = findOneUserByName(db, user.room, targetName, user.id);
  if (result.error) return result.error;
  if (!result.user || !isRegisteredUser(result.user)) return `${displayNickname(targetName)}님은 가입된 계정이 아닙니다.`;
  result.user.autoAdventureAllowed = enabled;
  result.user.updatedAt = nowIso();
  return `${displayUserName(result.user)}님 오토모험 권한을 ${enabled ? "허용" : "해제"}했습니다.`;
}

function compactAutoResult(label, result) {
  const lines = String(result || "").split("\n").filter(Boolean);
  const detail = lines.find((line) => /획득|상대|보상|피해|뒤에|부족|낮아서|클리어|실패/.test(line)) || lines[0] || "결과 없음";
  return `${label} ${detail}`;
}

function autoAdventure(db, user) {
  if (!user.isAdmin && !user.autoAdventureAllowed) {
    return "오토모험 권한이 필요합니다.\n관리자가 /오토권한 닉네임 으로 허용할 수 있습니다.";
  }
  const results = [
    compactAutoResult("🎣 낚시:", fishing(db, user)),
    compactAutoResult("🌿 채집:", gathering(db, user)),
    compactAutoResult("🗺️ 탐험:", adventure(db, user)),
    compactAutoResult("⚔️ 사냥:", hunt(db, user)),
    compactAutoResult("🏰 던전:", dungeon(db, user))
  ];
  return [
    "🤖 오토모험 결과",
    `닉네임: ${displayUserName(user)}`,
    ...results,
    "",
    `현재: ${user.points.toLocaleString()}P / LV.${user.level}`,
    formatStats(rpgStats(user))
  ].join("\n");
}

function upDown(db, user, text) {
  const value = text.replace(/^(\/?업다운|\/updown)\s*/i, "").trim();
  if (["포기", "그만", "stop", "quit"].includes(value)) {
    user.activeUpDown = null;
    return "업다운 게임을 종료했습니다.";
  }

  if (!value || ["시작", "start"].includes(value) || !user.activeUpDown) {
    user.activeUpDown = { answer: randomInt(1, 100), attempts: 0, createdAt: nowIso() };
    user.gamePlays += 1;
    return "업다운 시작!\n1부터 100 사이 숫자를 맞혀보세요.\n예시: /업다운 50";
  }

  const guess = Number(value);
  if (!Number.isInteger(guess) || guess < 1 || guess > 100) return "1부터 100 사이 숫자를 입력해주세요.\n예시: /업다운 50";

  user.activeUpDown.attempts += 1;
  const { answer, attempts } = user.activeUpDown;
  if (guess === answer) {
    const reward = Math.max(5, POINT_RULES.upDownBase - (attempts - 1) * 5);
    user.activeUpDown = null;
    user.gameWins += 1;
    addPoints(db, user, reward, "updown_win", { attempts });
    return [`정답! ${attempts}번 만에 맞혔습니다.`, `+${reward}P`, `현재: ${user.points.toLocaleString()}P / LV.${user.level}`].join("\n");
  }

  if (attempts >= 7) {
    user.activeUpDown = null;
    return `실패! 정답은 ${answer}였습니다.`;
  }
  return `${guess}보다 ${guess < answer ? "UP" : "DOWN"}\n남은 기회: ${7 - attempts}번`;
}

function pickOne(text) {
  const raw = text.replace(/^(\/?골라|\/?선택|\/pick|\/choose)\s*/i, "").trim();
  const choices = raw.split(/[,/| ]+/).map((item) => item.trim()).filter(Boolean);
  if (choices.length < 2) return "사용법: /골라 치킨 피자 족발\n또는 /선택 치킨,피자,족발";
  const picked = choices[Math.floor(Math.random() * choices.length)];
  return `픽셀곰의 선택: ${picked}`;
}

function randomNumber(text) {
  const args = text.replace(/^(\/?랜덤|\/random)\s*/i, "").trim().split(/\s+/).filter(Boolean).map(Number);
  const min = Number.isFinite(args[0]) ? args[0] : 1;
  const max = Number.isFinite(args[1]) ? args[1] : 100;
  if (!Number.isInteger(min) || !Number.isInteger(max) || min >= max) return "사용법: /랜덤 1 100";
  return `랜덤 결과: ${randomInt(min, max)}`;
}

function compatibility(db, user, text) {
  const targetName = text.replace(/^(\/?궁합|\/compat)\s*/i, "").trim();
  if (!targetName) return "사용법: /궁합 닉네임";
  const result = findOneUserByName(db, user.room, targetName, user.id);
  if (result.error) return result.error;
  const target = result.user?.nickname || targetName;
  const score = Math.abs(hash(`${todayKst()}:${user.nickname}:${target}`)) % 101;
  const comment = stablePick(COMPATIBILITY_MESSAGES, `${todayKst()}:${user.nickname}:${target}:compatibility`);
  return [`${displayUserName(user)}님과 ${displayNickname(target)}님의 오늘 궁합`, `${score}%`, comment].join("\n");
}

function compliment(user) {
  const message = stablePick(COMPLIMENT_MESSAGES, `${todayKst()}:${user.id}:${user.nickname}:compliment`);
  return `${displayUserName(user)}님\n${message}`;
}

function mission(user) {
  const message = stablePick(MISSION_MESSAGES, `${todayKst()}:${user.id}:${user.nickname}:mission`);
  return `${displayUserName(user)}님의 오늘 미션\n${message}`;
}

function findUserByNickname(db, room, nickname, excludeId = "") {
  return findOneUserByName(db, room, nickname, excludeId).user;
}

function transferPoints(db, user, text) {
  const args = text.replace(/^(\/?송금|\/?선물|\/transfer)\s*/i, "").trim().split(/\s+/).filter(Boolean);
  if (args.length < 2) return "사용법: /송금 닉네임 금액";
  const amount = Number(args.at(-1));
  const targetName = args.slice(0, -1).join(" ");
  if (!Number.isInteger(amount) || amount <= 0) return "보낼 포인트는 1 이상의 숫자로 입력해주세요.";
  if (!user.isAdmin && user.points < amount + POINT_RULES.transferFee) return `포인트가 부족합니다.\n현재: ${user.points.toLocaleString()}P`;

  const result = findOneUserByName(db, user.room, targetName, user.id);
  if (result.error) return result.error;
  const target = result.user;
  if (!target) return `같은 방에서 ${displayNickname(targetName)}님을 찾지 못했습니다.\n상대가 먼저 한 번 채팅하거나 /내정보 를 사용해야 합니다.`;

  if (user.isAdmin) {
    addPoints(db, target, amount, "admin_transfer_create", { from: user.nickname });
    return [`${displayUserName(target)}님에게 ${amount.toLocaleString()}P 생성 송금 완료`, `관리자 송금은 차감되지 않습니다.`, `상대 포인트: ${target.points.toLocaleString()}P / LV.${target.level}`].join("\n");
  }
  addPoints(db, user, -amount - POINT_RULES.transferFee, "transfer_out", { to: target.nickname });
  addPoints(db, target, amount, "transfer_in", { from: user.nickname });
  return [`${displayUserName(target)}님에게 ${amount.toLocaleString()}P를 보냈습니다.`, `내 포인트: ${user.points.toLocaleString()}P`].join("\n");
}

function wordChain(db, user, text) {
  if (!user.room) return "끝말잇기는 채팅방에서만 사용할 수 있습니다.";
  touchRoom(db, user.room);
  const room = db.rooms[user.room];
  const raw = text.replace(/^(\/?끝말|\/wordchain)\s*/i, "").trim();
  const args = raw.split(/\s+/).filter(Boolean);
  const mode = args[0] || "";

  if (["종료", "끝", "stop"].includes(mode)) {
    room.wordChain = null;
    return "끝말잇기를 종료했습니다.";
  }

  if (["시작", "start"].includes(mode)) {
    const firstWord = args[1];
    if (!firstWord || firstWord.length < 2) return "사용법: /끝말 시작 사과";
    room.wordChain = {
      lastWord: firstWord,
      lastChar: Array.from(firstWord).at(-1),
      used: [firstWord],
      updatedAt: nowIso()
    };
    return `끝말잇기 시작!\n첫 단어: ${firstWord}\n다음 글자: ${room.wordChain.lastChar}`;
  }

  if (!room.wordChain) return "진행 중인 끝말잇기가 없습니다.\n/끝말 시작 사과 로 시작하세요.";
  const word = args[0];
  if (!word || word.length < 2) return `다음 글자: ${room.wordChain.lastChar}\n예시: /끝말 ${room.wordChain.lastChar}...`;
  const chars = Array.from(word);
  if (chars[0] !== room.wordChain.lastChar) return `${room.wordChain.lastWord} 다음은 '${room.wordChain.lastChar}'(으)로 시작해야 합니다.`;
  if (room.wordChain.used.includes(word)) return "이미 사용한 단어입니다.";

  room.wordChain.used.push(word);
  room.wordChain.lastWord = word;
  room.wordChain.lastChar = chars.at(-1);
  room.wordChain.updatedAt = nowIso();
  user.gamePlays += 1;
  addPoints(db, user, 3, "word_chain", { word });
  return [`끝말 성공! +3P`, `현재 단어: ${word}`, `다음 글자: ${room.wordChain.lastChar}`].join("\n");
}

function makeMessagePool(starts, endings) {
  const variants = [
    "가볍게 시작하면 좋습니다.",
    "너무 급하게 몰아가지 마세요.",
    "짧은 리액션이 도움이 됩니다.",
    "오늘 안에 한 번 더 기회가 옵니다.",
    "분위기를 보고 천천히 움직이세요.",
    "작은 농담 하나가 흐름을 바꿉니다.",
    "상대 말에 먼저 맞춰보세요.",
    "무리하지 않으면 결과가 좋아집니다.",
    "편한 말투가 가장 강합니다.",
    "한 박자 쉬면 더 잘 보입니다.",
    "먼저 웃어주면 길이 열립니다.",
    "대화의 온도를 낮게 유지하세요."
  ];
  const rows = [];
  for (const start of starts) {
    for (const ending of endings) {
      rows.push(`${start} ${ending}`);
      if (rows.length === 120) return rows;
    }
  }
  let index = 0;
  while (rows.length < 120) {
    rows.push(`${starts[index % starts.length]} ${endings[(index * 3) % endings.length]} ${variants[index % variants.length]}`);
    index += 1;
  }
  return rows;
}

function stablePick(rows, key) {
  return rows[Math.abs(hash(key)) % rows.length];
}

const FORTUNE_MESSAGES = makeMessagePool(
  [
    "오늘은 리액션이 살아나는 날입니다.",
    "오늘은 말 한마디가 분위기를 바꾸는 날입니다.",
    "오늘은 타이밍을 잘 잡으면 웃음이 따라옵니다.",
    "오늘은 가볍게 던진 농담이 운을 부릅니다.",
    "오늘은 먼저 인사하면 흐름이 좋아집니다.",
    "오늘은 조용히 있다가도 존재감이 올라갑니다.",
    "오늘은 너무 진지하지 않은 태도가 잘 맞습니다.",
    "오늘은 작은 배려가 크게 돌아옵니다.",
    "오늘은 질문보다 공감이 강한 날입니다.",
    "오늘은 방 분위기를 살릴 기회가 있습니다."
  ],
  [
    "선 넘지 않는 장난을 챙기세요.",
    "답장 타이밍을 조금 빠르게 가져가세요.",
    "새로 온 사람에게 한마디 건네면 좋습니다.",
    "말을 아끼기보다 짧게라도 반응하세요.",
    "출석과 한마디 수다가 행운 포인트입니다.",
    "웃고 넘기면 오해가 줄어듭니다.",
    "오늘의 행운 명령어는 /방순위 입니다.",
    "상대 말에 한 번 더 받아주면 좋습니다.",
    "가벼운 칭찬이 생각보다 잘 먹힙니다.",
    "무리한 드립보다 안정적인 리액션이 낫습니다."
  ]
);

const RELATIONSHIP_MESSAGES = makeMessagePool(
  [
    "연애운은 천천히 올라오는 중입니다.",
    "썸운은 대화에서 먼저 열립니다.",
    "오늘은 자연스러운 관심 표현이 좋습니다.",
    "오늘은 급하게 밀어붙이면 흐름이 꺾입니다.",
    "오늘은 웃긴 사람에게 시선이 갑니다.",
    "오늘은 편하게 말 거는 쪽이 유리합니다.",
    "오늘은 티 안 나는 배려가 점수입니다.",
    "오늘은 말투가 호감도를 좌우합니다.",
    "오늘은 먼저 다가가도 나쁘지 않습니다.",
    "오늘은 기대보다 여유가 더 매력입니다."
  ],
  [
    "짧은 질문으로 시작하세요.",
    "장난 뒤에는 꼭 리액션을 붙이세요.",
    "상대가 말할 틈을 남겨두세요.",
    "너무 센 농담은 잠깐 아껴두세요.",
    "공통 관심사를 잡으면 확률이 올라갑니다.",
    "오늘은 보이스보다 채팅 예열이 먼저입니다.",
    "가볍게 칭찬하면 분위기가 부드러워집니다.",
    "한 번에 결론 내지 말고 흐름을 보세요.",
    "읽씹보다 짧은 답장이 낫습니다.",
    "무리하지 않으면 다음 기회가 생깁니다."
  ]
);

const COMPATIBILITY_MESSAGES = makeMessagePool(
  [
    "둘의 케미는 오늘 대화 타이밍에 달렸습니다.",
    "둘의 분위기는 가벼운 농담에서 살아납니다.",
    "둘은 생각보다 리액션 합이 중요합니다.",
    "둘은 서로 말 속도를 맞추면 좋아집니다.",
    "둘은 장난 수위를 낮추면 더 편해집니다.",
    "둘은 질문 하나로 흐름을 만들 수 있습니다.",
    "둘은 오늘 무리하지 않을수록 자연스럽습니다.",
    "둘은 웃음 포인트가 맞으면 급상승합니다.",
    "둘은 짧은 대화가 길게 이어질 가능성이 있습니다.",
    "둘은 배려가 보이면 분위기가 좋아집니다."
  ],
  [
    "먼저 가볍게 안부를 던져보세요.",
    "상대 말에 한 번 더 받아치면 좋습니다.",
    "과한 장난보다 센스 있는 리액션이 낫습니다.",
    "오늘은 천천히 친해지는 쪽이 유리합니다.",
    "공통 주제를 하나만 잡아도 충분합니다.",
    "칭찬은 짧고 구체적으로 하는 게 좋습니다.",
    "타이밍만 맞으면 대화가 길어질 수 있습니다.",
    "오늘은 웃음보다 안정감이 더 중요합니다.",
    "서로 템포를 맞추면 점수가 올라갑니다.",
    "무리한 플러팅은 잠깐 참는 게 좋습니다."
  ]
);

const COMPLIMENT_MESSAGES = makeMessagePool(
  [
    "오늘 말투가 방 분위기를 살립니다.",
    "오늘 존재감이 자연스럽게 올라갑니다.",
    "오늘 리액션이 꽤 좋습니다.",
    "오늘 센스가 과하지 않고 좋습니다.",
    "오늘 대화 흐름을 편하게 만듭니다.",
    "오늘 한마디가 생각보다 잘 먹힙니다.",
    "오늘 웃음 포인트를 잘 잡습니다.",
    "오늘 부담 없이 말 거는 힘이 있습니다.",
    "오늘 채팅 텐션이 안정적입니다.",
    "오늘 분위기 맞추는 감이 좋습니다."
  ],
  [
    "이대로만 가면 호감도 유지입니다.",
    "짧게 받아쳐도 충분히 매력 있습니다.",
    "방이 조용할 때 한마디 하면 좋습니다.",
    "너무 꾸미지 않아도 괜찮습니다.",
    "가볍게 웃어주는 게 강점입니다.",
    "선 넘지 않는 장난이 잘 어울립니다.",
    "오늘은 대화 받는 쪽이 더 빛납니다.",
    "편한 말투가 장점으로 보입니다.",
    "상대가 말하기 좋게 만들어줍니다.",
    "픽셀곰 기준 오늘 점수 좋습니다."
  ]
);

const MISSION_MESSAGES = makeMessagePool(
  [
    "오늘 미션은 채팅 5번 하기입니다.",
    "오늘 미션은 새로 온 사람에게 인사하기입니다.",
    "오늘 미션은 /방순위 한 번 확인하기입니다.",
    "오늘 미션은 웃긴 리액션 하나 남기기입니다.",
    "오늘 미션은 밥 메뉴 하나 공유하기입니다.",
    "오늘 미션은 누군가에게 가벼운 칭찬하기입니다.",
    "오늘 미션은 보이스룸 얘기 한 번 꺼내기입니다.",
    "오늘 미션은 지역 미등록이면 등록하기입니다.",
    "오늘 미션은 /운세 결과 공유하기입니다.",
    "오늘 미션은 조용한 사람 한 번 불러보기입니다."
  ],
  [
    "성공하면 방 분위기가 조금 살아납니다.",
    "무리하지 말고 자연스럽게 하면 됩니다.",
    "짧게 해도 인정입니다.",
    "오늘 안에만 하면 됩니다.",
    "실패해도 포인트는 마음속에 적립됩니다.",
    "타이밍이 보이면 바로 해보세요.",
    "너무 진지하게 하지 않아도 됩니다.",
    "가볍게 던질수록 성공 확률이 높습니다.",
    "혼자 하기 어렵다면 누군가를 태그하세요.",
    "픽셀곰이 조용히 지켜봅니다."
  ]
);

function fortune(user) {
  const message = stablePick(FORTUNE_MESSAGES, `${todayKst()}:${user.id}:${user.nickname}:fortune`);
  return `${displayUserName(user)}님의 오늘 운세\n${message}`;
}

function relationshipFortune(user, text) {
  const target = normalizeText(text)
    .replace(/^\/?(연애운|남친|여친|썸운)\s*/i, "")
    .replace(/^@?픽셀곰아?\s*/i, "")
    .replace(/^@?픽셀아?\s*/i, "")
    .replace(/(남친|여친|연애|썸|언제|생겨|\?|는|은|이|가|에게|한테)/g, "")
    .trim();
  const label = target || displayUserName(user);
  const message = stablePick(RELATIONSHIP_MESSAGES, `${todayKst()}:${user.id}:${label}:relationship`);
  return `${displayNickname(label)}님의 연애운\n${message}`;
}

function hash(text) {
  let value = 0;
  for (let i = 0; i < text.length; i += 1) value = (value * 31 + text.charCodeAt(i)) | 0;
  return value;
}

function isBotMessage(sender, text) {
  return botNames().includes(sender) || text.startsWith("[픽셀곰]");
}

function textLengthForStats(text) {
  const normalized = normalizeText(text).replace(/\s+/g, " ");
  if (["사진", "이모티콘", "동영상", "음성메시지", "파일"].includes(normalized)) return 0;
  return Array.from(String(text || "").trim()).length;
}

function awardChatPoint(db, user, room, text, options = {}) {
  if (!text || text.length > 1000) return;
  const textLength = options.textLength ?? textLengthForStats(text);
  user.chatCount += 1;
  user.chatPoints += POINT_RULES.chat;
  user.chatChars += textLength;
  user.updatedAt = nowIso();
  if (room && db.rooms[room]) db.rooms[room].chatCount += 1;
  addPoints(db, user, POINT_RULES.chat, "chat", { room, textLength });
}

async function runCommand(db, user, text, blockNames = []) {
  const commandText = normalizeText(text);
  user.commandCount += 1;

  if (!commandText.startsWith("/") && !blockNames.length) return null;

  if (aliasesMatch(commandText, ["/도움말", "도움말", "도움", "/도움", "명령어", "/명령어", "/help", "help", "/?", "?"]) || startsWithAny(commandText, ["/?", "/도움말", "/도움", "/help"]) || blockNames.includes("도움말")) return helpText(commandText);
  if (aliasesMatch(commandText, ["/공지", "/간단", "/notice"])) return noticeText();
  if (aliasesMatch(commandText, ["/상태", "상태", "/status", "status"])) return statusText();
  if (aliasesMatch(commandText, ["/버전", "/version", "/ver"])) return versionText();
  if (aliasesMatch(commandText, ["/봇소개", "봇소개", "/픽셀곰소개", "픽셀곰소개", "/픽셀소개", "픽셀소개", "/브리핑", "브리핑", "/설명", "설명", "픽셀곰", "픽셀"]) || (isPixelgomMentionCommand(commandText) && /(뭐|누구|로봇|봇|설명)/.test(commandText))) return botIntroText();
  if (aliasesMatch(commandText, ["/가입", "/계정등록", "/계정", "/등록"])) return registerAccount(db, user);
  if (!isRegisteredUser(user)) return registrationGuideText(user);

  if (aliasesMatch(commandText, ["/실시간순위", "실시간순위", "/실시간랭킹", "실시간랭킹", "/현재순위", "현재순위", "/방순위", "방순위", "/오늘순위", "오늘순위", "/오늘랭킹", "오늘랭킹", "/랭킹", "랭킹", "/순위", "순위", "/순웨", "순웨"])) return periodOverviewText(db, user.room, "day");
  if (aliasesMatch(commandText, ["/내순위", "내순위", "/내등수", "내등수", "/내랭킹", "내랭킹", "/나는몇등", "나는몇등"])) return myRankText(db, user, "day");
  if (aliasesMatch(commandText, ["/주간순위", "주간순위", "/주간랭킹", "주간랭킹"])) return periodOverviewText(db, user.room, "week");
  if (aliasesMatch(commandText, ["/월간순위", "월간순위", "/월간랭킹", "월간랭킹"])) return periodOverviewText(db, user.room, "month");
  if (aliasesMatch(commandText, ["/게임", "게임", "/ㄱㅇ", "/game"])) return gameHelpText();
  if (aliasesMatch(commandText, ["/내정보", "내정보", "내정보", "정보", "/정보", "/profile", "/me"])) return profileText(user);
  if (aliasesMatch(commandText, ["/출석", "/출석체크", "/출첵", "/ㅊㅊ", "/ㅊㅅ", "/checkin", "/cc"]) || blockNames.includes("출석체크")) return attendance(db, user);
  if (startsWithAny(commandText, ["/지역등록", "지역등록"]) || blockNames.includes("지역등록")) return registerRegion(db, user, commandText);
  if (aliasesMatch(commandText, ["/지역전체", "지역전체", "지역 목록", "지역"]) || blockNames.includes("지역전체")) return regionListText(db, user.room);
  if (aliasesMatch(commandText, ["/지역통계", "지역통계", "/지역순위", "지역순위"])) return regionStatsText(db, user.room);
  if (startsWithAny(commandText, ["/일괄등록", "일괄등록"])) return bulkRegister(db, user, commandText);
  if (startsWithAny(commandText, ["/대화가져오기", "대화가져오기", "/대화등록", "대화등록"])) return importTranscript(db, user, commandText);
  if (aliasesMatch(commandText, ["/등록현황", "등록현황"])) return registrationStatusText(db, user.room);
  if (aliasesMatch(commandText, ["/입퇴장현황", "입퇴장현황", "/입장현황", "입장현황"])) return membershipStatusText(db, user.room);
  if (startsWithAny(commandText, ["/닉이력", "닉이력"])) return nicknameHistoryText(db, user, commandText);
  if (startsWithAny(commandText, ["/닉연결", "닉연결"])) return linkNickname(db, user, commandText);
  if (aliasesMatch(commandText, ["/포인트순위", "포인트순위", "포인트 순위", "랭킹", "/rank"]) || blockNames.includes("포인트순위")) {
    return rankingText("픽셀곰 포인트 순위", rankUsers(db, (row) => row.points, 10, user.room), (row) => row.points, "P");
  }
  if (aliasesMatch(commandText, ["/채팅순위", "채팅순위", "채팅 순위", "/chatrank"])) {
    return rankingText("픽셀곰 채팅 순위", rankUsers(db, (row) => row.chatCount, 10, user.room), (row) => row.chatCount, "회");
  }
  if (aliasesMatch(commandText, ["/타수순위", "타수순위", "/typerank"])) {
    return rankingText("픽셀곰 누적 타수 순위", rankUsers(db, (row) => row.chatChars || 0, 10, user.room), (row) => row.chatChars || 0, "타");
  }
  if (aliasesMatch(commandText, ["/일간타수순위", "일간타수순위", "/오늘타수", "오늘타수", "/타수", "타수", "/몇타", "몇타"])) return periodTypingRankText(db, user.room, "day", "chars");
  if (aliasesMatch(commandText, ["/주간타수순위", "주간타수순위", "/이번주타수", "이번주타수"])) return periodTypingRankText(db, user.room, "week", "chars");
  if (aliasesMatch(commandText, ["/월간타수순위", "월간타수순위", "/이번달타수", "이번달타수"])) return periodTypingRankText(db, user.room, "month", "chars");
  if (aliasesMatch(commandText, ["/일간채팅순위", "일간채팅순위", "/오늘채팅", "오늘채팅", "/채팅랭킹", "채팅랭킹"])) return periodTypingRankText(db, user.room, "day", "messages");
  if (aliasesMatch(commandText, ["/주간채팅순위", "주간채팅순위", "/이번주채팅", "이번주채팅"])) return periodTypingRankText(db, user.room, "week", "messages");
  if (aliasesMatch(commandText, ["/월간채팅순위", "월간채팅순위", "/이번달채팅", "이번달채팅"])) return periodTypingRankText(db, user.room, "month", "messages");
  if (aliasesMatch(commandText, ["/레벨순위", "레벨순위", "레벨 순위", "/levelrank"])) {
    return rankingText("픽셀곰 레벨 순위", rankUsers(db, (row) => row.level * 1000000 + row.points, 10, user.room), (row) => row.level, "레벨");
  }
  if (aliasesMatch(commandText, ["/출석순위", "출석순위", "출석 순위", "/checkinrank"])) {
    return rankingText("픽셀곰 출석 순위", rankUsers(db, (row) => row.attendanceDates?.length || 0, 10, user.room), (row) => row.attendanceDates?.length || 0, "일");
  }
  if (aliasesMatch(commandText, ["/게임순위", "게임순위", "게임 순위", "/gamerank"])) {
    return rankingText("픽셀곰 게임 순위", rankUsers(db, (row) => row.gameWins, 10, user.room), (row) => row.gameWins, "승");
  }
  if (aliasesMatch(commandText, ["/관리자목록", "/관리자", "/admin"])) return adminListText(db, user.room);
  if (startsWithAny(commandText, ["/관리자추가", "/관리자등록"])) return setAdminRole(db, user, commandText, true);
  if (startsWithAny(commandText, ["/관리자해제", "/관리자삭제"])) return setAdminRole(db, user, commandText, false);
  if (startsWithAny(commandText, ["/포인트지급", "/지급", "/포인트주기"])) return grantPoints(db, user, commandText);
  if (startsWithAny(commandText, ["/오토권한", "/오토허용"])) return setAutoAdventurePermission(db, user, commandText, true);
  if (startsWithAny(commandText, ["/오토해제", "/오토금지"])) return setAutoAdventurePermission(db, user, commandText, false);
  if (aliasesMatch(commandText, ["/오토모험", "/자동모험", "/automode"])) return autoAdventure(db, user);
  if (startsWithAny(commandText, ["/자동공지", "/오토", "/자동"])) return autoNoticeText(db, user, commandText);

  if (startsWithAny(commandText, ["/가위바위보", "가위바위보", "/rps"])) return rps(db, user, commandText);
  if (aliasesMatch(commandText, ["/주사위", "주사위", "/dice"])) return dice(db, user);
  if (startsWithAny(commandText, ["/동전", "동전", "/coin"])) return coin(db, user, commandText);
  if (startsWithAny(commandText, ["/홀짝", "홀짝", "/oe", "/oddeven"])) return oddEven(db, user, commandText);
  if (aliasesMatch(commandText, ["/룰렛", "룰렛", "/roulette"])) return roulette(db, user);
  if (aliasesMatch(commandText, ["/행운상자", "행운상자", "/상자", "상자", "/luckybox"])) return luckyBox(db, user);
  if (aliasesMatch(commandText, ["/뽑기", "뽑기", "/가챠", "가챠", "/gacha"])) return gacha(db, user);
  if (aliasesMatch(commandText, ["/가방", "가방", "/ㄱㅂ", "/인벤", "인벤", "/inventory"])) return inventoryText(user);
  if (aliasesMatch(commandText, ["/상점", "상점", "/shop"])) return shopText();
  if (startsWithAny(commandText, ["/구매", "/buy"])) return buyItem(db, user, commandText);
  if (startsWithAny(commandText, ["/판매", "/팔기", "/sell"])) return sellItem(db, user, commandText);
  if (startsWithAny(commandText, ["/시세", "/가격", "/price"])) return priceText(user, commandText);
  if (startsWithAny(commandText, ["/사용", "/use"])) return useItem(db, user, commandText);
  if (aliasesMatch(commandText, ["/모험", "모험", "/ㅁㅎ", "/rpg", "rpg"])) return rpgHelpText();
  if (aliasesMatch(commandText, ["/캐릭터", "캐릭터", "/캐릭", "/내캐릭", "내캐릭", "/character"])) return rpgProfile(user);
  if (aliasesMatch(commandText, ["/낚시", "낚시", "/ㄴㅅ", "/fish", "fish"])) return fishing(db, user);
  if (aliasesMatch(commandText, ["/채집", "채집", "/ㅊㅈ", "/gather", "gather"])) return gathering(db, user);
  if (aliasesMatch(commandText, ["/탐험", "탐험", "/ㅌㅎ", "/adventure", "adventure"])) return adventure(db, user);
  if (aliasesMatch(commandText, ["/사냥", "사냥", "/ㅅㄴ", "/hunt", "hunt"])) return hunt(db, user);
  if (aliasesMatch(commandText, ["/던전", "던전", "/ㄷㅈ", "/dungeon", "dungeon"])) return dungeon(db, user);
  if (aliasesMatch(commandText, ["/휴식", "휴식", "/ㅎㅅ", "/rest", "rest"])) return restRpg(user);
  if (startsWithAny(commandText, ["/대장간", "/제련", "/forge"])) return forgeItem(db, user, commandText);
  if (startsWithAny(commandText, ["/강화", "/enhance"])) return enhanceEquipment(db, user, commandText);
  if (startsWithAny(commandText, ["/연금술", "/연금", "/alchemy"])) return alchemyItem(db, user, commandText);
  if (aliasesMatch(commandText, ["/펫입양", "/petadopt"])) return adoptPet(db, user);
  if (startsWithAny(commandText, ["/펫훈련", "/pettrain"])) return petTrain(db, user);
  if (startsWithAny(commandText, ["/펫대전", "/petbattle"])) return petBattle(db, user, commandText);
  if (startsWithAny(commandText, ["/펫", "/pet"])) return petCommand(db, user, commandText);
  if (startsWithAny(commandText, ["/타자게임", "타자게임", "/타자", "타자", "/ㅌㅈ", "/typing"])) return typingGame(db, user, commandText);
  if (startsWithAny(commandText, ["/초성퀴즈", "초성퀴즈", "/초성", "초성", "/초", "/initial"])) return initialQuiz(db, user, commandText);
  if (startsWithAny(commandText, ["/숫자야구", "숫자야구", "/야구", "야구", "/ㅇㄱ", "/baseball"])) return numberBaseball(db, user, commandText);
  if (startsWithAny(commandText, ["/선착순", "선착순", "/ㅅㅊ", "/fast"])) return fastFinger(db, user, commandText);
  if (startsWithAny(commandText, ["/업다운", "업다운", "/updown"])) return upDown(db, user, commandText);
  if (startsWithAny(commandText, ["/끝말", "끝말", "/wordchain"])) return wordChain(db, user, commandText);
  if (aliasesMatch(commandText, ["/퀴즈", "퀴즈", "/quiz"])) return quiz(user);
  if (startsWithAny(commandText, ["/정답", "정답", "/answer"])) return answerQuiz(db, user, commandText);
  if (aliasesMatch(commandText, ["/운세", "운세", "/fortune"])) return fortune(user);
  if (startsWithAny(commandText, ["/연애운", "연애운", "/남친", "남친", "/여친", "여친", "/썸운", "썸운"])) return relationshipFortune(user, commandText);
  if (aliasesMatch(commandText, ["/미션", "미션", "/mission"])) return mission(user);
  if (aliasesMatch(commandText, ["/칭찬", "칭찬", "/compliment"])) return compliment(user);
  if (startsWithAny(commandText, ["/궁합", "궁합", "/compat"])) return compatibility(db, user, commandText);
  if (startsWithAny(commandText, ["/랜덤", "랜덤", "/random"])) return randomNumber(commandText);
  if (startsWithAny(commandText, ["/골라", "골라", "/선택", "선택", "/pick", "/choose"])) return pickOne(commandText);
  if (startsWithAny(commandText, ["/송금", "송금", "/선물", "선물", "/transfer"])) return transferPoints(db, user, commandText);

  return null;
}

export async function handleSkill(payload) {
  const db = await loadDb();
  const utterance = normalizeText(payload?.userRequest?.utterance);
  const blockNames = blockNamesFrom(payload);
  const user = ensureUser(db, userIdFromSkill(payload), displayNameFromSkill(payload));
  user.accountRegistered = true;
  user.registeredAt ||= nowIso();
  const reply = await runCommand(db, user, utterance, blockNames);
  await saveDb(db);
  return kakaoText(reply || "알 수 없는 명령어입니다.\n/도움말 을 입력해보세요.");
}

export async function handleChatEvent(payload) {
  const db = await loadDb();
  const room = normalizeText(payload.room);
  const msg = normalizeText(payload.msg || payload.message);
  const sender = normalizeText(payload.sender) || "익명";
  touchRoom(db, room);

  if (isBotMessage(sender, msg)) {
    await saveDb(db);
    return { ok: true, reply: null, ignored: true };
  }

  const userId = userKeyForChat(room, sender);
  const user = ensureUser(db, userId, sender, room, { source: "seen" });
  const isCommand = msg.startsWith("/");
  let awarded = 0;
  if (isRegisteredUser(user)) {
    awardChatPoint(db, user, room, msg, { textLength: isTranscriptImportCommand(msg) ? 0 : undefined });
    awarded = POINT_RULES.chat;
  }
  const reply = isCommand ? await runCommand(db, user, msg) : null;
  const autoReply = !isCommand && isRegisteredUser(user) ? maybeAutoNotice(db, room) : null;
  await saveDb(db);
  return {
    ok: true,
    reply: reply || autoReply,
    awarded,
    points: user.points,
    level: user.level
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

    if (req.method === "GET") {
      jsonResponse(res, 200, { ok: true, service: "pixelgom-chatroom-bot", version: APP_VERSION, features: FEATURES });
      return;
    }

    if (req.method === "POST") {
      const payload = await readBody(req);
      if (pathname === "/skill" || pathname === "/api/skill" || payload?.userRequest) {
        jsonResponse(res, 200, await handleSkill(payload));
        return;
      }
      jsonResponse(res, 200, await handleChatEvent(payload));
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

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  server.listen(PORT, () => {
    console.log(`Pixelgom bot server listening on http://localhost:${PORT}`);
  });
}
