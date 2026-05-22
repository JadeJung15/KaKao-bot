/*
 * MessengerBotR API2 style script.
 *
 * Use this file if the legacy response(...) script does not react at all.
 */

const bot = BotManager.getCurrentBot();

const BOT_SERVER = "https://ka-kao-bot.vercel.app/chat-event";
const BOT_NAMES = ["픽셀곰", "픽셀"];

// Empty list means all rooms. Put exact KakaoTalk room names here to restrict.
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
    .timeout(7000)
    .header("Content-Type", "application/json; charset=utf-8")
    .requestBody(JSON.stringify(payload))
    .post()
    .text();
}

function onMessage(message) {
  const room = String(message.room || "");
  const content = String(message.content || "");
  const sender = String((message.author && message.author.name) || "");

  if (!isAllowedRoom(room)) return;
  if (!content || !sender || isBotSender(sender)) return;

  try {
    if (content.trim() === "/로컬상태") {
      message.reply("픽셀곰 API2 스크립트 실행 중입니다. 이제 /상태 를 보내 서버 연결을 확인하세요.");
      return;
    }

    const raw = postJson(BOT_SERVER, {
      room: room,
      msg: content,
      sender: sender,
      isGroupChat: Boolean(message.isGroupChat),
      packageName: String(message.packageName || "com.kakao.talk")
    });
    const result = JSON.parse(raw);
    if (result && result.reply) {
      message.reply(result.reply);
    }
  } catch (error) {
    if (content.trim() === "/상태") {
      message.reply("픽셀곰 서버에 연결할 수 없습니다.");
    }
  }
}

bot.addListener(Event.MESSAGE, onMessage);
