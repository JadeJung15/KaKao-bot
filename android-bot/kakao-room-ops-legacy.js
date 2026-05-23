/*
 * MessengerBotR / KakaoTalkBot legacy response(...) script.
 */

var BOT_SERVER = "https://ka-kao-bot.vercel.app/chat-event";
var BOT_NAMES = ["픽셀곰", "운영봇", "봇"];
// 비워두면 카카오톡이 전달한 실제 방 이름을 사용합니다.
// 방 이름이 내 닉네임처럼 잘못 잡히는 환경에서만 방별로 고정값을 넣으세요.
var ROOM_NAME_OVERRIDE = "";

var ALLOWED_ROOMS = [];

function isAllowedRoom(room) {
  return ALLOWED_ROOMS.length === 0 || ALLOWED_ROOMS.indexOf(room) >= 0;
}

function isBotSender(sender) {
  return BOT_NAMES.indexOf(String(sender)) >= 0;
}

function effectiveRoom(room) {
  var override = String(ROOM_NAME_OVERRIDE || "").trim();
  if (override) return override;
  return String(room || "");
}

function effectiveGroupFlag(isGroupChat, isMultiChat) {
  return Boolean(isGroupChat || isMultiChat);
}

function postJson(url, payload) {
  var Jsoup = org.jsoup.Jsoup;
  return Jsoup.connect(url)
    .ignoreContentType(true)
    .ignoreHttpErrors(true)
    .timeout(10000)
    .header("Content-Type", "application/json; charset=utf-8")
    .requestBody(JSON.stringify(payload))
    .post()
    .text();
}

function profileHash(imageDB) {
  try {
    if (imageDB && imageDB.getProfileHash) return String(imageDB.getProfileHash() || "");
  } catch (error) {}
  try {
    if (imageDB && imageDB.getProfileImage) return String(java.lang.String(imageDB.getProfileImage()).hashCode());
  } catch (error) {}
  return "";
}

function nicknameChangeName(value) {
  var name = String(value || "").replace(/님$/, "").replace(/\s+/g, " ").trim();
  if (!name || name.length > 30) return "";
  if (/https?:|www\.|[{};]/i.test(name)) return "";
  if (/[:：]/.test(name)) return "";
  return name;
}

function nicknameChangeEvent(from, to) {
  var cleanFrom = nicknameChangeName(from);
  var cleanTo = nicknameChangeName(to);
  if (!cleanFrom || !cleanTo || cleanFrom === cleanTo) return {};
  return { eventType: "nickname_changed", fromName: cleanFrom, toName: cleanTo };
}

function systemEvent(text) {
  var match = text.match(/^(.+?)님이 들어왔습니다/);
  if (match) return { eventType: "entered", targetName: match[1] };
  match = text.match(/^(.+?)님이 나갔습니다/);
  if (match) return { eventType: "left", targetName: match[1] };
  match = text.match(/^(.+?)님을 내보냈습니다/);
  if (match) return { eventType: "kicked", targetName: match[1] };
  match = text.match(/^(.+?)\s*(?:➙|->|→)\s*(.+?)$/);
  if (match) return nicknameChangeEvent(match[1], match[2]);
  return {};
}

function response(room, msg, sender, isGroupChat, replier, imageDB, packageName, isMultiChat) {
  var sendRoom = effectiveRoom(room);
  var sendIsGroupChat = effectiveGroupFlag(isGroupChat, isMultiChat);
  if (!isAllowedRoom(sendRoom)) return;
  if (!msg || !sender || isBotSender(sender)) return;

  try {
    var text = String(msg).trim();
    var hash = profileHash(imageDB);
    var event = systemEvent(text);

    if (text === "/로컬상태") {
      replier.reply([
        "픽셀곰 스크립트 실행 중입니다.",
        "방(raw): " + room,
        "방(전송): " + sendRoom,
        "보낸사람: " + sender,
        "프로필해시: " + (hash || "없음"),
        "이벤트: " + (event.eventType || "없음"),
        "단톡(raw): " + Boolean(isGroupChat || isMultiChat),
        "단톡(전송): " + sendIsGroupChat,
        "이제 /상태 를 보내 서버 연결을 확인하세요."
      ].join("\n"));
      return;
    }

    if (!sendIsGroupChat) return;

    var raw = postJson(BOT_SERVER, {
      room: sendRoom,
      rawRoom: String(room || ""),
      msg: msg,
      sender: sender,
      senderId: hash,
      senderHash: hash,
      profileHash: hash,
      eventType: event.eventType || "",
      targetName: event.targetName || "",
      fromName: event.fromName || "",
      toName: event.toName || "",
      isGroupChat: sendIsGroupChat,
      rawIsGroupChat: Boolean(isGroupChat || isMultiChat),
      isMultiChat: isMultiChat,
      packageName: packageName
    });
    var result = JSON.parse(raw);
    if (result && result.reply) {
      replier.reply(result.reply);
    }
  } catch (error) {
    if (String(msg).trim() === "/상태") {
      replier.reply("운영봇 서버에 연결할 수 없습니다.");
    }
  }
}
