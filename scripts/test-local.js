import assert from "node:assert/strict";

const baseUrl = process.env.TEST_BASE_URL || "http://localhost:3000";

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const json = await response.json();
  return { response, json };
}

const health = await request("/health");
assert.equal(health.response.status, 200);
assert.equal(health.json.ok, true);
assert.equal(health.json.service, "kakao-room-ops-bot");
assert.equal(health.json.gamesEnabled, false);

const skill = await request("/skill", {
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
assert.equal(skill.response.status, 200);
assert.match(skill.json.template.outputs[0].simpleText.text, /새 봇 골격/);
assert.match(skill.json.template.outputs[0].simpleText.text, /게임.*제거/);

const chatStatus = await request("/chat-event", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    room: "테스트방",
    msg: "/상태",
    sender: "사용자",
    isGroupChat: true,
    packageName: "com.kakao.talk"
  })
});
assert.equal(chatStatus.response.status, 200);
assert.equal(chatStatus.json.ok, true);
assert.equal(chatStatus.json.handled, true);
assert.match(chatStatus.json.reply, /서버 정상 연결/);
assert.match(chatStatus.json.reply, /게임 기능: 사용 안 함/);

const normalChat = await request("/chat-event", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    room: "테스트방",
    msg: "일반 대화",
    sender: "사용자",
    isGroupChat: true,
    packageName: "com.kakao.talk"
  })
});
assert.equal(normalChat.response.status, 200);
assert.equal(normalChat.json.ok, true);
assert.equal(normalChat.json.reply, null);
assert.equal(normalChat.json.handled, false);

const removedGame = await request("/chat-event", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    room: "테스트방",
    msg: "/낚시",
    sender: "사용자",
    isGroupChat: true,
    packageName: "com.kakao.talk"
  })
});
assert.equal(removedGame.response.status, 200);
assert.match(removedGame.json.reply, /아직 등록되지 않은 명령어/);

const chatGet = await request("/chat-event");
assert.equal(chatGet.response.status, 405);

console.log("Clean bot scaffold tests passed.");
