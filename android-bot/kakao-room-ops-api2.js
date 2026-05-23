/*
 * MessengerBotR API2 script.
 */

const bot = BotManager.getCurrentBot();

const BOT_SERVER = "https://ka-kao-bot.vercel.app/chat-event";
const BOT_NAMES = ["픽셀곰", "운영봇", "봇"];

const ALLOWED_ROOMS = [];

function isAllowedRoom(room) {
  return ALLOWED_ROOMS.length === 0 || ALLOWED_ROOMS.indexOf(room) >= 0;
}

function isBotSender(sender) {
  return BOT_NAMES.indexOf(String(sender)) >= 0;
}

function postJson(url, payload) {
  const Jsoup = org.jsoup.Jsoup;
  return Jsoup.connect(url)
    .ignoreContentType(true)
    .ignoreHttpErrors(true)
    .timeout(10000)
    .header("Content-Type", "application/json; charset=utf-8")
    .requestBody(JSON.stringify(payload))
    .post()
    .text();
}

function authorHash(message) {
  try {
    if (message.author && message.author.hash) return String(message.author.hash || "");
    if (message.author && message.author.id) return String(message.author.id || "");
    if (message.author && message.author.userHash) return String(message.author.userHash || "");
    if (message.author && message.author.profileHash) return String(message.author.profileHash || "");
  } catch (error) {}
  return "";
}

function systemEvent(text) {
  let match = text.match(/^(.+?)님이 들어왔습니다/);
  if (match) return { eventType: "entered", targetName: match[1] };
  match = text.match(/^(.+?)님이 나갔습니다/);
  if (match) return { eventType: "left", targetName: match[1] };
  match = text.match(/^(.+?)님을 내보냈습니다/);
  if (match) return { eventType: "kicked", targetName: match[1] };
  match = text.match(/^(.+?)\s*(?:➙|->|→)\s*(.+?)$/);
  if (match) return { eventType: "nickname_changed", fromName: match[1], toName: match[2] };
  return {};
}

function onMessage(message) {
  const room = String(message.room || "");
  const content = String(message.content || "");
  const sender = String((message.author && message.author.name) || "");

  if (!isAllowedRoom(room)) return;
  if (!content || !sender || isBotSender(sender)) return;

  try {
    const hash = authorHash(message);
    const event = systemEvent(content.trim());

    if (content.trim() === "/로컬상태") {
      message.reply([
        "픽셀곰 API2 스크립트 실행 중입니다.",
        "방: " + room,
        "보낸사람: " + sender,
        "프로필해시: " + (hash || "없음"),
        "이벤트: " + (event.eventType || "없음"),
        "이제 /상태 를 보내 서버 연결을 확인하세요."
      ].join("\n"));
      return;
    }

    const raw = postJson(BOT_SERVER, {
      room: room,
      msg: content,
      sender: sender,
      senderId: hash,
      senderHash: hash,
      profileHash: hash,
      eventType: event.eventType || "",
      targetName: event.targetName || "",
      fromName: event.fromName || "",
      toName: event.toName || "",
      isGroupChat: Boolean(message.isGroupChat),
      packageName: String(message.packageName || "com.kakao.talk")
    });
    const result = JSON.parse(raw);
    if (result && result.reply) {
      message.reply(result.reply);
    }
  } catch (error) {
    if (content.trim() === "/상태") {
      message.reply("운영봇 서버에 연결할 수 없습니다.");
    }
  }
}

bot.addListener(Event.MESSAGE, onMessage);
