import http from "node:http";
import { fileURLToPath } from "node:url";

const PORT = Number(process.env.PORT || 3000);
const DEFAULT_BOT_NAME = process.env.BOT_DISPLAY_NAME || "운영봇";

export const APP_VERSION = "0.1.0";
export const FEATURES = [
  "health-check",
  "chat-event-webhook",
  "kakao-skill-webhook",
  "clean-room-bot-scaffold",
  "no-games"
];

function normalizeText(value) {
  return String(value ?? "").trim();
}

function botNames() {
  return (process.env.BOT_NAMES || `${DEFAULT_BOT_NAME},봇`)
    .split(",")
    .map((name) => normalizeText(name))
    .filter(Boolean);
}

function kstTimestamp() {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    dateStyle: "medium",
    timeStyle: "medium"
  }).format(new Date());
}

function jsonResponse(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

export function healthPayload() {
  return {
    ok: true,
    service: "kakao-room-ops-bot",
    version: APP_VERSION,
    mode: "clean-slate",
    gamesEnabled: false,
    benchmark: "https://laggobot.com/",
    features: FEATURES
  };
}

function kakaoText(text) {
  return {
    version: "2.0",
    template: {
      outputs: [
        {
          simpleText: {
            text
          }
        }
      ]
    }
  };
}

function helpText() {
  return [
    `${DEFAULT_BOT_NAME} 새 봇 골격`,
    "",
    "사용 가능 명령어",
    "/상태 - 서버 연결 상태 확인",
    "/로컬상태 - 폰 자동응답 스크립트 확인",
    "/도움말 - 현재 명령어 확인",
    "/벤치마크 - 새 봇 참고 방향 확인",
    "",
    "기존 게임, 포인트, 레벨, 상점, RPG 기능은 제거되었습니다.",
    "다음 구현 범위는 방 관리, 공지, 입퇴장/닉네임 감지, 운영 보조 기능 중심으로 추가하면 됩니다."
  ].join("\n");
}

function benchmarkText() {
  return [
    "벤치마크: 라꼬봇",
    "https://laggobot.com/",
    "",
    "참고할 방향",
    "- 카카오톡 오픈채팅방 운영 보조",
    "- 입퇴장/재입장 감지",
    "- 닉네임 변경 감지",
    "- 공지 및 관리자 기능",
    "- 필요 시 AI 응답 연동",
    "",
    "제외 범위",
    "- 게임",
    "- 포인트/아이템/상점",
    "- RPG/레벨 경쟁"
  ].join("\n");
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

function handleCommand(message, context = {}) {
  const text = normalizeText(message);
  const command = text.replace(/\s+/g, " ");

  if (command === "/상태" || command === "/status") return statusText(context.room);
  if (command === "/로컬상태") return `${DEFAULT_BOT_NAME} 자동응답 스크립트가 실행 중입니다. 이제 /상태 를 보내 서버 연결을 확인하세요.`;
  if (command === "/도움말" || command === "/help" || command === "/?") return helpText();
  if (command === "/벤치마크" || command === "/benchmark") return benchmarkText();

  if (command.startsWith("/")) {
    return [
      "아직 등록되지 않은 명령어입니다.",
      "/도움말 로 현재 사용 가능한 명령어를 확인해주세요."
    ].join("\n");
  }

  return null;
}

function isBotSender(sender) {
  return botNames().includes(normalizeText(sender));
}

export async function handleSkill(payload) {
  const utterance = normalizeText(payload?.userRequest?.utterance);
  const reply = handleCommand(utterance) || helpText();
  return kakaoText(reply);
}

export async function handleChatEvent(payload) {
  const room = normalizeText(payload?.room);
  const message = normalizeText(payload?.msg || payload?.message);
  const sender = normalizeText(payload?.sender) || "익명";

  if (!message || isBotSender(sender)) {
    return { ok: true, reply: null, ignored: true };
  }

  const reply = handleCommand(message, { room, sender });
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
