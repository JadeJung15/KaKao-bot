import assert from "node:assert/strict";
import http from "node:http";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

let server;
let testDbPath;
let baseUrl = process.env.TEST_BASE_URL || "";

if (!baseUrl) {
  testDbPath = path.join(repoRoot, "data", `test-room-ops-db-${process.pid}.json`);
  process.env.DB_PATH = testDbPath;
  process.env.ADMIN_NAMES = "";
  await unlink(testDbPath).catch(() => {});

  const { requestHandler } = await import("../server.js");
  server = http.createServer(requestHandler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
}

async function cleanup() {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (testDbPath) await unlink(testDbPath).catch(() => {});
}

async function request(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, options);
  const json = await response.json();
  return { response, json };
}

async function chat(msg, sender = "사용자", room = "테스트방") {
  return request("/chat-event", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      room,
      msg,
      sender,
      isGroupChat: true,
      packageName: "com.kakao.talk"
    })
  });
}

async function chatPayload(payload) {
  return request("/chat-event", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
}

try {
  const health = await request("/health");
  assert.equal(health.response.status, 200);
  assert.equal(health.json.ok, true);
  assert.equal(health.json.service, "kakao-room-ops-bot");
  assert.equal(health.json.gamesEnabled, false);
  assert.match(health.json.features.join(","), /profile-registry/);
  assert.match(health.json.features.join(","), /message-inbox/);
  assert.match(health.json.features.join(","), /detailed-member-history/);
  assert.match(health.json.features.join(","), /admin-commands/);
  assert.match(health.json.features.join(","), /point-ledger/);
  assert.match(health.json.features.join(","), /like-points/);
  assert.match(health.json.features.join(","), /attendance-rewards/);
  assert.match(health.json.features.join(","), /member-rankings/);
  assert.match(health.json.features.join(","), /raw-event-log/);
  assert.match(health.json.features.join(","), /stable-user-ids/);
  assert.match(health.json.features.join(","), /bridge-auto-extract/);
  assert.match(health.json.features.join(","), /identity-nickname-summary/);
  assert.match(health.json.features.join(","), /raw-identity-nickname-recovery/);
  assert.match(health.json.features.join(","), /cross-room-identity-nickname-recovery/);

  const help = await request("/skill", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      userRequest: {
        timezone: "Asia/Seoul",
        utterance: "/도움말",
        user: {
          id: "test-user",
          type: "accountId",
          properties: { nickname: "테스터" }
        }
      }
    })
  });
  assert.equal(help.response.status, 200);
  assert.match(help.json.template.outputs[0].simpleText.text, /프로필등록/);
  assert.match(help.json.template.outputs[0].simpleText.text, /메시지/);
  assert.match(help.json.template.outputs[0].simpleText.text, /입퇴장상세/);
  assert.match(help.json.template.outputs[0].simpleText.text, /관리자등록/);
  assert.match(help.json.template.outputs[0].simpleText.text, /관리자재설정/);
  assert.match(help.json.template.outputs[0].simpleText.text, /최근이벤트/);
  assert.match(help.json.template.outputs[0].simpleText.text, /원본로그/);
  assert.match(help.json.template.outputs[0].simpleText.text, /포인트/);
  assert.match(help.json.template.outputs[0].simpleText.text, /좋아요/);
  assert.match(help.json.template.outputs[0].simpleText.text, /이체/);
  assert.match(help.json.template.outputs[0].simpleText.text, /출석/);
  assert.match(help.json.template.outputs[0].simpleText.text, /게임.*사용하지 않습니다/);

  const form = await chat("/공질", "관리자");
  assert.equal(form.response.status, 200);
  assert.match(form.json.reply, /☑닉 \/성별/);

  const unsafeAdminRegister = await chat("/관리자등록 침입자", "침입자", "관리자보안방");
  assert.match(unsafeAdminRegister.json.reply, /초기 관리자는 환경변수/);

  process.env.ADMIN_NAMES = "관리자";

  const adminRegister = await chat("/관리자등록 관리자", "관리자");
  assert.match(adminRegister.json.reply, /관리자로 등록/);

  const adminList = await chat("/관리자목록", "관리자");
  assert.match(adminList.json.reply, /관리자/);

  const tempAdminRegister = await chat("/관리자등록 임시관리자", "관리자");
  assert.match(tempAdminRegister.json.reply, /관리자로 등록/);

  const adminResetDenied = await chat("/관리자재설정 관리자,부관리자", "사용자");
  assert.match(adminResetDenied.json.reply, /관리자 전용/);

  const adminReset = await chat("/관리자재설정 관리자,부관리자", "관리자");
  assert.match(adminReset.json.reply, /관리자 목록이 재설정/);
  assert.match(adminReset.json.reply, /관리자/);
  assert.match(adminReset.json.reply, /부관리자/);

  const adminListAfterReset = await chat("/관리자목록", "관리자");
  assert.match(adminListAfterReset.json.reply, /부관리자/);
  assert.doesNotMatch(adminListAfterReset.json.reply, /임시관리자/);

  const uniqueEntry = await chatPayload({
    room: "고유값방",
    msg: "고유대상 남님이 들어왔습니다.",
    sender: "오픈채팅봇",
    targetUserId: "openchat-user-1",
    senderId: "openchat-bot"
  });
  assert.match(uniqueEntry.json.reply, /무잔썸에 와줘서 고마워/);

  await chatPayload({
    room: "고유값방",
    msg: "고유대상 남님이 나갔습니다.",
    sender: "오픈채팅봇",
    targetUserId: "openchat-user-1",
    senderId: "openchat-bot"
  });

  const uniqueReentry = await chatPayload({
    room: "고유값방",
    msg: "바뀐대상 남님이 들어왔습니다.",
    sender: "오픈채팅봇",
    targetUserId: "openchat-user-1",
    senderId: "openchat-bot"
  });
  assert.match(uniqueReentry.json.reply, /2회 재입장/);
  assert.match(uniqueReentry.json.reply, /고유대상 남/);
  assert.match(uniqueReentry.json.reply, /바뀐대상 남/);

  const recentEvents = await chat("/최근이벤트 5", "일반사용자", "고유값방");
  assert.match(recentEvents.json.reply, /targetUserId : openchat-user-1/);
  assert.match(recentEvents.json.reply, /id 후보/);

  const rawLogDenied = await chat("/원본로그 3", "일반사용자", "고유값방");
  assert.match(rawLogDenied.json.reply, /관리자 전용/);

  const rawLog = await chat("/원본로그 4", "관리자", "고유값방");
  assert.match(rawLog.json.reply, /원본 이벤트 로그/);
  assert.match(rawLog.json.reply, /targetUserId/);

  const explicitEntry = await chatPayload({
    room: "자동추출방",
    msg: "브릿지 원문",
    sender: "오픈채팅봇",
    eventType: "entered",
    targetName: "자동대상 남",
    profileHash: "bridge-bot-hash"
  });
  assert.match(explicitEntry.json.reply, /무잔썸에 와줘서 고마워/);

  const explicitNickChange = await chatPayload({
    room: "자동추출방",
    msg: "닉변 원문",
    sender: "오픈채팅봇",
    eventType: "nickname_changed",
    fromName: "자동대상 남",
    toName: "자동변경 남"
  });
  assert.match(explicitNickChange.json.reply, /자동대상 남 -> 자동변경 남/);

  const profileHashChat = await chatPayload({
    room: "자동추출방",
    msg: "프로필 해시 테스트",
    sender: "해시사용자 남",
    profileHash: "profile-hash-user-1"
  });
  assert.equal(profileHashChat.json.reply, null);

  const autoEvents = await chat("/최근이벤트 5", "관리자", "자동추출방");
  assert.match(autoEvents.json.reply, /event : nickname_changed/);
  assert.match(autoEvents.json.reply, /senderId : profile-hash-user-1/);

  await chatPayload({
    room: "해시닉변방",
    msg: "예전 닉네임으로 보낸 채팅",
    sender: "예전해시닉 남",
    profileHash: "profile-hash-rename-1"
  });

  await chatPayload({
    room: "해시닉변방",
    msg: "새 닉네임으로 보낸 채팅",
    sender: "새해시닉 남",
    profileHash: "profile-hash-rename-1"
  });

  const hashRenameEvents = await chat("/최근이벤트 5", "일반사용자", "해시닉변방");
  assert.match(hashRenameEvents.json.reply, /회원이력 : 새해시닉 남 \(이전닉: 예전해시닉 남\)/);

  await chatPayload({
    room: "원본복구방",
    msg: "구버전 시점 채팅",
    sender: "복구전닉 남",
    senderId: "raw-recover-id-1",
    profileHash: "raw-recover-id-1"
  });

  const recoverEventsBeforePersonRename = await chatPayload({
    room: "원본복구방",
    msg: "/최근이벤트 5",
    sender: "복구후닉 남",
    profileHash: "raw-recover-id-1"
  });
  assert.match(recoverEventsBeforePersonRename.json.reply, /회원이력 : 복구후닉 남 \(이전닉: 복구전닉 남\)/);

  await chatPayload({
    room: "원본복구이전방",
    msg: "다른 방에 남은 예전 채팅",
    sender: "이전방닉 남",
    senderId: "cross-room-recover-id-1",
    profileHash: "cross-room-recover-id-1"
  });

  const crossRoomRecoverEvents = await chatPayload({
    room: "원본복구현재방",
    msg: "/최근이벤트 10",
    sender: "현재방닉 남",
    senderId: "cross-room-recover-id-1",
    profileHash: "cross-room-recover-id-1"
  });
  assert.match(crossRoomRecoverEvents.json.reply, /회원이력 : 현재방닉 남 \(이전닉: 이전방닉 남\)/);

  const linkDenied = await chat("/링크등록 얼공방 https://open.kakao.com/o/denied", "사용자");
  assert.match(linkDenied.json.reply, /관리자 전용/);

  const profileRegister = await chat(`/프로필등록 미미 여 && ☑닉 /성별 : 미미 / 여
☑MBTI / 키 : 엔프피 / 153
☑지역 / 기미돌 : 경기 / 기
☑매력어필 : 작고소듕
☑썸상 : 크고 건강하신 연하남`, "관리자");
  assert.match(profileRegister.json.reply, /프로필이 등록되었습니다/);

  const aliasRegister = await chat("/별명등록 미미 여 미미", "관리자");
  assert.match(aliasRegister.json.reply, /별명이 미미/);

  const profileView = await chat("/프로필 미미", "사용자");
  assert.match(profileView.json.reply, /미미 여/);
  assert.match(profileView.json.reply, /엔프피/);

  const linkMissing = await chat("/건의방", "사용자");
  assert.match(linkMissing.json.reply, /링크가 아직 등록되지 않았습니다/);

  const linkRegister = await chat("/링크등록 건의방 https://open.kakao.com/o/test", "관리자");
  assert.match(linkRegister.json.reply, /링크가 등록/);

  const linkView = await chat("/건의방", "사용자");
  assert.match(linkView.json.reply, /https:\/\/open\.kakao\.com\/o\/test/);

  await chat("포인트 기능 테스트 시작", "포순이 여");

  const attendance = await chat("/출석", "포순이 여");
  assert.match(attendance.json.reply, /포순이 여님 출석/);
  assert.match(attendance.json.reply, /🅟100 획득/);

  const attendanceDuplicate = await chat("/출석체크", "포순이 여");
  assert.match(attendanceDuplicate.json.reply, /이미 출첵/);

  const pointGrant = await chat("/포인트지급 포순이 여 1000", "관리자");
  assert.match(pointGrant.json.reply, /포인트 지급 완료/);
  assert.match(pointGrant.json.reply, /포순이 여/);

  const pointView = await chat("/포인트", "포순이 여");
  assert.match(pointView.json.reply, /포순이 여님의 포인트 : 🅟/);

  const invalidLikeAmount = await chat("/좋아요 미미 10000", "포순이 여");
  assert.match(invalidLikeAmount.json.reply, /1 ~ 999 범위/);

  const likeReply = await chat("/좋아요 미미 10", "포순이 여");
  assert.match(likeReply.json.reply, /💕/);

  const selfLike = await chat("/좋아요 포순이 1", "포순이 여");
  assert.match(selfLike.json.reply, /님 말고 다른 사람/);

  const transfer = await chat("/이체 미미 100", "포순이 여");
  assert.match(transfer.json.reply, /이체 완료/);
  assert.match(transfer.json.reply, /수수료 : 🅟10/);

  const memberInfo = await chat("/내정보", "포순이 여");
  assert.match(memberInfo.json.reply, /레벨/);
  assert.match(memberInfo.json.reply, /보유 포인트/);
  assert.match(memberInfo.json.reply, /소비한 포인트/);
  assert.match(memberInfo.json.reply, /경험치/);

  const receiverInfo = await chat("/내정보", "미미 여");
  assert.match(receiverInfo.json.reply, /♥ x 10/);

  const pointRank = await chat("/포인트순위", "포순이 여");
  assert.match(pointRank.json.reply, /채팅방 포인트 순위/);
  assert.match(pointRank.json.reply, /포순이 여/);

  const likeRank = await chat("/좋아요순위", "포순이 여");
  assert.match(likeRank.json.reply, /채팅방 좋아요순위/);
  assert.match(likeRank.json.reply, /미미 여 ♥10/);

  const levelRank = await chat("/레벨순위", "포순이 여");
  assert.match(levelRank.json.reply, /채팅방 레벨 순위/);

  const todayChatRank = await chat("/채팅오늘", "포순이 여");
  assert.match(todayChatRank.json.reply, /오늘 채팅 순위/);

  const weekChatRank = await chat("/채팅금주", "포순이 여");
  assert.match(weekChatRank.json.reply, /이번 주 채팅 순위/);

  const adminDebit = await chat("/포인트차감 포순이 여 10", "관리자");
  assert.match(adminDebit.json.reply, /포인트 차감 완료/);

  const mentionMessage = await chat("미미야 확인해줘 @미미 여", "관리자");
  assert.equal(mentionMessage.json.reply, null);

  const unreadNotice = await chat("왔어", "미미 여");
  assert.match(unreadNotice.json.reply, /읽지 않은 메시지가 1건/);
  assert.match(unreadNotice.json.reply, /\/메시지/);

  const inbox = await chat("/메시지", "미미 여");
  assert.match(inbox.json.reply, /💌 미미 여님, 1건의 메시지/);
  assert.match(inbox.json.reply, /보낸사람 : 관리자/);
  assert.match(inbox.json.reply, /미미야 확인해줘/);

  const emptyInbox = await chat("/메세지", "미미 여");
  assert.match(emptyInbox.json.reply, /메시지가 없습니다/);

  const firstEntry = await chat("새친구 남님이 들어왔습니다.타인, 기관 등의 사칭에 유의해 주세요.", "오픈채팅봇");
  assert.match(firstEntry.json.reply, /무잔썸에 와줘서 고마워/);
  assert.match(firstEntry.json.reply, /친구들과 함께 즐겁게 소통/);
  assert.match(firstEntry.json.reply, /두글자로 해주고 뒤에 성별/);
  assert.match(firstEntry.json.reply, /공식질문작성/);

  const exitReply = await chat("새친구 남님이 나갔습니다.", "오픈채팅봇");
  assert.match(exitReply.json.reply, /새친구 남님 안녕히 가세요/);
  assert.match(exitReply.json.reply, /닉네임 히스토리/);
  assert.match(exitReply.json.reply, /입장 히스토리/);
  assert.match(exitReply.json.reply, /퇴장 히스토리/);

  const secondEntry = await chat("새친구 남님이 들어왔습니다.", "오픈채팅봇");
  assert.match(secondEntry.json.reply, /2회 재입장/);
  assert.match(secondEntry.json.reply, /강퇴이력 : 0회/);
  assert.match(secondEntry.json.reply, /입장 히스토리/);
  assert.match(secondEntry.json.reply, /퇴장 히스토리/);

  const nickChange = await chat("새친구 남 ➙ 새이름 남", "오픈채팅봇");
  assert.match(nickChange.json.reply, /닉네임 변경/);
  assert.match(nickChange.json.reply, /새친구 남 -> 새이름 남/);
  assert.match(nickChange.json.reply, /최초닉/);
  assert.match(nickChange.json.reply, /• 새이름 남/);

  const kickedFirstEntry = await chat("재입장 남님이 들어왔습니다.", "오픈채팅봇");
  assert.match(kickedFirstEntry.json.reply, /무잔썸에 와줘서 고마워/);

  await chat("재입장 남님을 내보냈습니다.", "오픈채팅봇");

  const kickedReentry = await chat("재입장 남님이 들어왔습니다.", "오픈채팅봇");
  assert.match(kickedReentry.json.reply, /2회 재입장/);
  assert.match(kickedReentry.json.reply, /강퇴이력 : 1회/);
  assert.match(kickedReentry.json.reply, /강퇴사유 : 미등록/);

  await chat("새이름 남님을 내보냈습니다.", "오픈채팅봇");

  const detailedHistory = await chat("/입퇴장상세 새이름", "관리자");
  assert.match(detailedHistory.json.reply, /입퇴장 상세/);
  assert.match(detailedHistory.json.reply, /입장 2회/);
  assert.match(detailedHistory.json.reply, /퇴장 1회/);
  assert.match(detailedHistory.json.reply, /강퇴 1회/);
  assert.match(detailedHistory.json.reply, /닉변 1회/);

  const nickHistory = await chat("/닉이력 새이름", "사용자");
  assert.match(nickHistory.json.reply, /새친구 남/);
  assert.match(nickHistory.json.reply, /새이름 남/);

  const normalChat = await chat("일반 대화", "사용자");
  assert.equal(normalChat.json.reply, null);
  assert.equal(normalChat.json.handled, false);

  const removedGame = await chat("/낚시", "사용자");
  assert.match(removedGame.json.reply, /아직 등록되지 않은 명령어/);

  const chatGet = await request("/chat-event");
  assert.equal(chatGet.response.status, 405);

  console.log("Room ops bot tests passed.");
} finally {
  await cleanup();
}
