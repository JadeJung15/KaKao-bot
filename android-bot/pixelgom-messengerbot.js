/*
 * MessengerBotR / KakaoTalkBot style script.
 *
 * 1. Install an Android auto-reply bot app that supports the response(...) API.
 * 2. Create a new script and paste this file.
 * 3. Keep KakaoTalk notifications enabled for the target chatroom.
 * 4. The bot account must be in the chatroom.
 */

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

function profileHash(imageDB) {
  try {
    if (imageDB && imageDB.getProfileHash) return String(imageDB.getProfileHash() || "");
  } catch (error) {}
  return "";
}

function response(room, msg, sender, isGroupChat, replier, imageDB, packageName, isMultiChat) {
  if (!isAllowedRoom(room)) return;
  if (!msg || !sender || isBotSender(sender)) return;

  try {
    if (String(msg).trim() === "/로컬상태") {
      replier.reply("픽셀곰 스크립트 실행 중입니다. 이제 /상태 를 보내 서버 연결을 확인하세요.");
      return;
    }

    const raw = postJson(BOT_SERVER, {
      room: room,
      msg: msg,
      sender: sender,
      senderHash: profileHash(imageDB),
      isGroupChat: isGroupChat,
      isMultiChat: isMultiChat,
      packageName: packageName
    });
    const result = JSON.parse(raw);
    if (result && result.reply) {
      replier.reply(result.reply);
    }
  } catch (error) {
    if (String(msg).trim() === "/상태") {
      replier.reply("픽셀곰 서버에 연결할 수 없습니다.");
    }
  }
}
