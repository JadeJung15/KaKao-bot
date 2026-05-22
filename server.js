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
  gachaMs: 2 * 60 * 1000
};

const initialDb = {
  users: {},
  rooms: {},
  events: []
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
    return db;
  }

  await ensureDb();
  const raw = await readFile(DB_PATH, "utf8");
  const db = JSON.parse(raw);
  db.users ||= {};
  db.rooms ||= {};
  db.events ||= [];
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
  return String(value || "").trim();
}

function aliasesMatch(text, aliases) {
  return aliases.includes(normalizeText(text));
}

function blockNamesFrom(payload) {
  return [payload?.intent?.name, payload?.userRequest?.block?.name]
    .map(normalizeText)
    .filter(Boolean);
}

function startsWithAny(text, prefixes) {
  return prefixes.some((prefix) => text === prefix || text.startsWith(`${prefix} `));
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

function ensureUser(db, id, nickname, room = "") {
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
      activeQuiz: null,
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
  user.activeQuiz ??= null;
  user.activeUpDown ??= null;
  user.inventory ||= {};
  user.daily ||= {};
  user.cooldowns ||= {};
  user.createdAt ||= nowIso();
  user.updatedAt ||= nowIso();
  if (nickname && user.nickname !== nickname) user.nickname = nickname;
  if (room && user.room !== room) user.room = room;
  user.level = levelFor(user.points);
  return user;
}

function touchRoom(db, room) {
  if (!room) return;
  db.rooms[room] ||= { name: room, chatCount: 0, wordChain: null, createdAt: nowIso(), updatedAt: nowIso() };
  db.rooms[room].chatCount ??= 0;
  db.rooms[room].wordChain ??= null;
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

function rankUsers(db, selector, limit = 10, room = "") {
  return Object.values(db.users)
    .filter((user) => selector(user) > 0 && (!room || user.room === room))
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
      return `${rank} ${user.nickname} - ${selector(user).toLocaleString()}${suffix} / LV.${user.level}`;
    })
  ].join("\n");
}

function helpText(text = "") {
  const topic = normalizeText(text).replace(/^(\/?\?|\/?도움말|\/?도움|명령어|\/help)\s*/i, "");
  if (["게임", "game", "놀이"].includes(topic)) return gameHelpText();
  if (["랭킹", "순위", "rank"].includes(topic)) return rankingHelpText();
  if (["포인트", "point", "경제"].includes(topic)) return pointHelpText();

  return [
    "픽셀곰 도움말",
    "/? 게임 - 게임 명령어",
    "/? 랭킹 - 순위 명령어",
    "/? 포인트 - 포인트/경제 명령어",
    "",
    "기본",
    "/상태, /내정보, /도움말, /?",
    "/출석, /ㅊㅊ, /출첵",
    "/지역등록 서울, /지역전체",
    "/운세, /미션, /칭찬",
    "",
    "자동 적립",
    `카톡방 메시지 1회당 +${POINT_RULES.chat}P`,
    "일반 채팅에는 답장하지 않고 명령어에만 답합니다."
  ].join("\n");
}

function gameHelpText() {
  return [
    "픽셀곰 게임",
    "/가위바위보 가위|바위|보 - 승리 +20P, 비김 +5P",
    "/주사위 - 10분마다 1~6P",
    "/동전 앞|뒤 - 맞히면 +8P",
    "/홀짝 홀|짝 - 맞히면 +12P",
    "/룰렛 - 1분마다 랜덤 보상",
    "/뽑기 - 10P로 아이템/보상 뽑기",
    "/행운상자 - 하루 1회 +5~50P",
    "/업다운 - 1~100 숫자 맞히기",
    "/끝말 시작 사과, /끝말 과자",
    "/퀴즈 - 산수 퀴즈 받기",
    "/정답 숫자 - 퀴즈 정답 제출",
    "/랜덤 1 100, /골라 치킨 피자"
  ].join("\n");
}

function rankingHelpText() {
  return [
    "픽셀곰 랭킹",
    "/포인트순위 또는 랭킹",
    "/채팅순위",
    "/레벨순위",
    "/출석순위",
    "/게임순위",
    "/지역통계"
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

function statusText() {
  return [
    "픽셀곰 서버 정상 연결",
    `시간: ${new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}`,
    `일반 채팅 1회당 +${POINT_RULES.chat}P 적립 중`
  ].join("\n");
}

function profileText(user) {
  const itemCount = Object.values(user.inventory || {}).reduce((sum, count) => sum + count, 0);
  return [
    `${user.nickname}님의 정보`,
    `칭호: ${titleFor(user)}`,
    `레벨: LV.${user.level}`,
    `포인트: ${user.points.toLocaleString()}P`,
    `채팅: ${user.chatCount.toLocaleString()}회`,
    `출석 연속: ${user.attendanceStreak || 0}일`,
    `게임: ${user.gameWins.toLocaleString()}승 / ${user.gamePlays.toLocaleString()}회`,
    `아이템: ${itemCount.toLocaleString()}개`,
    user.region ? `지역: ${user.region}` : "지역: 미등록"
  ].join("\n");
}

function attendance(db, user) {
  const today = todayKst();
  if (user.attendanceDates.includes(today)) {
    return `${user.nickname}님은 오늘 이미 출석했습니다.\n현재 포인트: ${user.points.toLocaleString()}P / LV.${user.level}`;
  }

  const prevDay = yesterday(today);
  user.attendanceStreak = user.lastAttendanceDate === prevDay ? (user.attendanceStreak || 0) + 1 : 1;
  user.lastAttendanceDate = today;
  user.attendanceDates.push(today);

  let gained = POINT_RULES.attendance;
  const lines = [`${user.nickname}님 출석 완료!`, `+${POINT_RULES.attendance}P`];
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

  const lines = [`${nickname}님 지역을 ${region}(으)로 등록했습니다.`];
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
    .filter((user) => user.region && (!room || user.room === room))
    .sort((a, b) => a.nickname.localeCompare(b.nickname, "ko"))
    .reduce((acc, user) => {
      acc[user.region] ||= [];
      acc[user.region].push(`• ${user.nickname}`);
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
    .filter((user) => user.region && (!room || user.room === room))
    .reduce((acc, user) => {
      acc[user.region] = (acc[user.region] || 0) + 1;
      return acc;
    }, {});
  const rows = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko"));
  if (!rows.length) return "아직 지역 통계가 없습니다.\n/지역등록 서울 처럼 등록해주세요.";
  return ["픽셀곰 지역 통계", "", ...rows.map(([region, count], index) => `${index + 1}위 ${region} - ${count}명`)].join("\n");
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
  return [`${user.nickname}: ${mine}`, `픽셀곰: ${bot}`, `결과: ${result}`, `획득: +${gained}P`, `현재: ${user.points.toLocaleString()}P / LV.${user.level}`].join("\n");
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

function inventoryText(user) {
  const names = {
    bear_jelly: "곰젤리",
    star_piece: "별조각",
    lucky_ticket: "행운권",
    golden_bear: "황금곰",
    legend_badge: "전설 배지"
  };
  const rows = Object.entries(user.inventory || {}).filter(([, count]) => count > 0);
  if (!rows.length) return "가방이 비어 있습니다.\n/뽑기 로 아이템을 얻어보세요.";
  return ["픽셀곰 가방", "", ...rows.map(([key, count]) => `• ${names[key] || key} x${count}`)].join("\n");
}

function shopText() {
  return [
    "픽셀곰 상점",
    `현재 구매형 아이템은 준비 중입니다.`,
    `/뽑기 - ${POINT_RULES.gachaCost}P로 아이템/보상 획득`,
    "/가방 - 내 아이템 보기",
    "/송금 닉네임 금액 - 포인트 보내기"
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

function compatibility(user, text) {
  const target = text.replace(/^(\/?궁합|\/compat)\s*/i, "").trim();
  if (!target) return "사용법: /궁합 닉네임";
  const score = Math.abs(hash(`${todayKst()}:${user.nickname}:${target}`)) % 101;
  let comment = "무난한 케미입니다.";
  if (score >= 90) comment = "오늘은 환상의 케미입니다.";
  else if (score >= 70) comment = "분위기가 꽤 좋습니다.";
  else if (score <= 20) comment = "오늘은 거리두기가 필요합니다.";
  return [`${user.nickname}님과 ${target}님의 오늘 궁합`, `${score}%`, comment].join("\n");
}

function compliment(user) {
  const lines = [
    "오늘 말투가 방 분위기를 살립니다.",
    "조용히 있어도 존재감이 있습니다.",
    "센스가 과하지 않고 딱 좋습니다.",
    "오늘은 리액션이 무기입니다.",
    "픽셀곰 기준 오늘의 호감도 상승 중입니다."
  ];
  return `${user.nickname}님\n${lines[Math.floor(Math.random() * lines.length)]}`;
}

function mission(user) {
  const missions = [
    "오늘 채팅 10번 하기",
    "출석하고 /주사위 굴리기",
    "처음 온 사람에게 인사하기",
    "/골라 로 메뉴 하나 정하기",
    "지역 미등록이면 /지역등록 하기"
  ];
  const index = Math.abs(hash(`${todayKst()}:${user.id}:mission`)) % missions.length;
  return `${user.nickname}님의 오늘 미션\n${missions[index]}`;
}

function findUserByNickname(db, room, nickname, excludeId = "") {
  const normalized = normalizeText(nickname);
  return Object.values(db.users).find((candidate) =>
    candidate.id !== excludeId &&
    candidate.nickname === normalized &&
    (!room || candidate.room === room)
  );
}

function transferPoints(db, user, text) {
  const args = text.replace(/^(\/?송금|\/?선물|\/transfer)\s*/i, "").trim().split(/\s+/).filter(Boolean);
  if (args.length < 2) return "사용법: /송금 닉네임 금액";
  const amount = Number(args.at(-1));
  const targetName = args.slice(0, -1).join(" ");
  if (!Number.isInteger(amount) || amount <= 0) return "보낼 포인트는 1 이상의 숫자로 입력해주세요.";
  if (user.points < amount + POINT_RULES.transferFee) return `포인트가 부족합니다.\n현재: ${user.points.toLocaleString()}P`;

  const target = findUserByNickname(db, user.room, targetName, user.id);
  if (!target) return `같은 방에서 ${targetName}님을 찾지 못했습니다.\n상대가 먼저 한 번 채팅하거나 /내정보 를 사용해야 합니다.`;

  addPoints(db, user, -amount - POINT_RULES.transferFee, "transfer_out", { to: target.nickname });
  addPoints(db, target, amount, "transfer_in", { from: user.nickname });
  return [`${target.nickname}님에게 ${amount.toLocaleString()}P를 보냈습니다.`, `내 포인트: ${user.points.toLocaleString()}P`].join("\n");
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

function fortune(user) {
  const messages = [
    "오늘은 선톡보다 리액션이 강한 날입니다.",
    "작은 농담 하나가 분위기를 살립니다.",
    "포인트보다 중요한 건 출석입니다. 그래도 포인트도 챙기세요.",
    "오늘의 행운 명령어는 /주사위 입니다.",
    "말을 아끼면 아쉬운 날입니다. 한마디 더 해도 됩니다."
  ];
  const index = Math.abs(hash(`${todayKst()}:${user.id}`)) % messages.length;
  return `${user.nickname}님의 오늘 운세\n${messages[index]}`;
}

function hash(text) {
  let value = 0;
  for (let i = 0; i < text.length; i += 1) value = (value * 31 + text.charCodeAt(i)) | 0;
  return value;
}

function isBotMessage(sender, text) {
  const names = (process.env.BOT_NAMES || "픽셀곰,하리보").split(",").map((name) => name.trim()).filter(Boolean);
  return names.includes(sender) || text.startsWith("[픽셀곰]");
}

function awardChatPoint(db, user, room, text) {
  if (!text || text.length > 1000) return;
  user.chatCount += 1;
  user.chatPoints += POINT_RULES.chat;
  user.updatedAt = nowIso();
  if (room && db.rooms[room]) db.rooms[room].chatCount += 1;
  addPoints(db, user, POINT_RULES.chat, "chat", { room });
}

async function runCommand(db, user, text, blockNames = []) {
  const commandText = normalizeText(text);
  user.commandCount += 1;

  if (aliasesMatch(commandText, ["/도움말", "도움말", "도움", "/도움", "명령어", "/명령어", "/help", "help", "/?", "?"]) || startsWithAny(commandText, ["/?", "/도움말", "/도움", "/help"]) || blockNames.includes("도움말")) return helpText(commandText);
  if (aliasesMatch(commandText, ["/상태", "상태", "/status", "status"])) return statusText();
  if (aliasesMatch(commandText, ["/게임", "게임", "/game"])) return gameHelpText();
  if (aliasesMatch(commandText, ["/내정보", "내정보", "내정보", "정보", "/정보", "/profile", "/me"])) return profileText(user);
  if (aliasesMatch(commandText, ["/출석", "/출석체크", "/출첵", "/ㅊㅊ", "/ㅊㅅ", "/checkin", "/cc"]) || blockNames.includes("출석체크")) return attendance(db, user);
  if (startsWithAny(commandText, ["/지역등록", "지역등록"]) || blockNames.includes("지역등록")) return registerRegion(db, user, commandText);
  if (aliasesMatch(commandText, ["/지역전체", "지역전체", "지역 목록", "지역"]) || blockNames.includes("지역전체")) return regionListText(db, user.room);
  if (aliasesMatch(commandText, ["/지역통계", "지역통계", "/지역순위", "지역순위"])) return regionStatsText(db, user.room);
  if (aliasesMatch(commandText, ["/포인트순위", "포인트순위", "포인트 순위", "랭킹", "/rank"]) || blockNames.includes("포인트순위")) {
    return rankingText("픽셀곰 포인트 순위", rankUsers(db, (row) => row.points, 10, user.room), (row) => row.points, "P");
  }
  if (aliasesMatch(commandText, ["/채팅순위", "채팅순위", "채팅 순위", "/chatrank"])) {
    return rankingText("픽셀곰 채팅 순위", rankUsers(db, (row) => row.chatCount, 10, user.room), (row) => row.chatCount, "회");
  }
  if (aliasesMatch(commandText, ["/레벨순위", "레벨순위", "레벨 순위", "/levelrank"])) {
    return rankingText("픽셀곰 레벨 순위", rankUsers(db, (row) => row.level * 1000000 + row.points, 10, user.room), (row) => row.level, "레벨");
  }
  if (aliasesMatch(commandText, ["/출석순위", "출석순위", "출석 순위", "/checkinrank"])) {
    return rankingText("픽셀곰 출석 순위", rankUsers(db, (row) => row.attendanceDates?.length || 0, 10, user.room), (row) => row.attendanceDates?.length || 0, "일");
  }
  if (aliasesMatch(commandText, ["/게임순위", "게임순위", "게임 순위", "/gamerank"])) {
    return rankingText("픽셀곰 게임 순위", rankUsers(db, (row) => row.gameWins, 10, user.room), (row) => row.gameWins, "승");
  }
  if (startsWithAny(commandText, ["/가위바위보", "가위바위보", "/rps"])) return rps(db, user, commandText);
  if (aliasesMatch(commandText, ["/주사위", "주사위", "/dice"])) return dice(db, user);
  if (startsWithAny(commandText, ["/동전", "동전", "/coin"])) return coin(db, user, commandText);
  if (startsWithAny(commandText, ["/홀짝", "홀짝", "/oe", "/oddeven"])) return oddEven(db, user, commandText);
  if (aliasesMatch(commandText, ["/룰렛", "룰렛", "/roulette"])) return roulette(db, user);
  if (aliasesMatch(commandText, ["/행운상자", "행운상자", "/상자", "상자", "/luckybox"])) return luckyBox(db, user);
  if (aliasesMatch(commandText, ["/뽑기", "뽑기", "/가챠", "가챠", "/gacha"])) return gacha(db, user);
  if (aliasesMatch(commandText, ["/가방", "가방", "/인벤", "인벤", "/inventory"])) return inventoryText(user);
  if (aliasesMatch(commandText, ["/상점", "상점", "/shop"])) return shopText();
  if (startsWithAny(commandText, ["/업다운", "업다운", "/updown"])) return upDown(db, user, commandText);
  if (startsWithAny(commandText, ["/끝말", "끝말", "/wordchain"])) return wordChain(db, user, commandText);
  if (aliasesMatch(commandText, ["/퀴즈", "퀴즈", "/quiz"])) return quiz(user);
  if (startsWithAny(commandText, ["/정답", "정답", "/answer"])) return answerQuiz(db, user, commandText);
  if (aliasesMatch(commandText, ["/운세", "운세", "/fortune"])) return fortune(user);
  if (aliasesMatch(commandText, ["/미션", "미션", "/mission"])) return mission(user);
  if (aliasesMatch(commandText, ["/칭찬", "칭찬", "/compliment"])) return compliment(user);
  if (startsWithAny(commandText, ["/궁합", "궁합", "/compat"])) return compatibility(user, commandText);
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

  const user = ensureUser(db, userKeyForChat(room, sender), sender, room);
  awardChatPoint(db, user, room, msg);

  const commandPrefixes = [
    "/",
    "지역등록",
    "가위바위보",
    "정답",
    "동전",
    "홀짝",
    "업다운",
    "끝말",
    "랜덤",
    "골라",
    "선택",
    "궁합",
    "송금",
    "선물"
  ];
  const exactCommands = [
    "?",
    "도움말",
    "도움",
    "명령어",
    "상태",
    "내정보",
    "정보",
    "지역전체",
    "지역통계",
    "포인트순위",
    "채팅순위",
    "레벨순위",
    "출석순위",
    "게임순위",
    "게임",
    "주사위",
    "룰렛",
    "뽑기",
    "가챠",
    "행운상자",
    "상자",
    "가방",
    "상점",
    "퀴즈",
    "운세",
    "미션",
    "칭찬"
  ];
  const isCommand = commandPrefixes.some((prefix) => msg.startsWith(prefix)) || exactCommands.includes(msg);
  const reply = isCommand ? await runCommand(db, user, msg) : null;
  await saveDb(db);
  return {
    ok: true,
    reply,
    awarded: POINT_RULES.chat,
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
    if (req.method === "GET" && req.url === "/health") {
      jsonResponse(res, 200, { ok: true, service: "pixelgom-chatroom-bot" });
      return;
    }

    if (req.method === "POST" && req.url === "/skill") {
      jsonResponse(res, 200, await handleSkill(await readBody(req)));
      return;
    }

    if (req.method === "POST" && req.url === "/chat-event") {
      jsonResponse(res, 200, await handleChatEvent(await readBody(req)));
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
