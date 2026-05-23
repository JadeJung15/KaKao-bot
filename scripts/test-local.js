import assert from "node:assert/strict";

const baseUrl = process.env.TEST_BASE_URL || "http://localhost:3000";

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
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

const health = await request("/health");
assert.equal(health.response.status, 200);
assert.equal(health.json.ok, true);
assert.equal(health.json.service, "kakao-room-ops-bot");
assert.equal(health.json.gamesEnabled, false);
assert.match(health.json.features.join(","), /profile-registry/);
assert.match(health.json.features.join(","), /message-inbox/);
assert.match(health.json.features.join(","), /detailed-member-history/);
assert.match(health.json.features.join(","), /admin-commands/);

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
assert.match(help.json.template.outputs[0].simpleText.text, /게임.*사용하지 않습니다/);

const form = await chat("/공질", "관리자");
assert.equal(form.response.status, 200);
assert.match(form.json.reply, /☑닉 \/성별/);

const adminRegister = await chat("/관리자등록 관리자", "관리자");
assert.match(adminRegister.json.reply, /관리자로 등록/);

const adminList = await chat("/관리자목록", "관리자");
assert.match(adminList.json.reply, /관리자/);

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
assert.match(firstEntry.json.reply, /첫 입장을 환영/);

await chat("새친구 남님이 나갔습니다.", "오픈채팅봇");
const secondEntry = await chat("새친구 남님이 들어왔습니다.", "오픈채팅봇");
assert.match(secondEntry.json.reply, /2회 재입장/);
assert.match(secondEntry.json.reply, /입장 히스토리/);
assert.match(secondEntry.json.reply, /퇴장 히스토리/);

const nickChange = await chat("새친구 남 ➙ 새이름 남", "오픈채팅봇");
assert.match(nickChange.json.reply, /닉네임 변경/);
assert.match(nickChange.json.reply, /새친구 남 ➙ 새이름 남/);
assert.match(nickChange.json.reply, /최초닉/);

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
