import assert from "node:assert/strict";

const baseUrl = process.env.TEST_BASE_URL || "http://localhost:3000";

function payload(utterance, id = "u1") {
  return {
    userRequest: {
      timezone: "Asia/Seoul",
      utterance,
      user: {
        id,
        type: "accountId",
        properties: {
          nickname: "테스터"
        }
      }
    },
    bot: {
      id: "691bfe71c2e8b90caa9b9ad4",
      name: "픽셀곰"
    }
  };
}

async function skill(utterance, id) {
  const response = await fetch(`${baseUrl}/skill`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(payload(utterance, id))
  });
  assert.equal(response.status, 200);
  const json = await response.json();
  return json.template.outputs[0].simpleText.text;
}

async function chat(msg, sender = `민지-${Date.now()}`, room = "테스트방") {
  const response = await fetch(`${baseUrl}/chat-event`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      room,
      msg,
      sender,
      isGroupChat: true,
      packageName: "com.kakao.talk"
    })
  });
  assert.equal(response.status, 200);
  return response.json();
}

const help = await skill("/도움말");
assert.match(help, /픽셀곰 도움말/);

const region = await skill("/지역등록 민지 서울", "u-minji");
assert.match(region, /서울/);

const attendance = await skill("/출석", "u-minji");
assert.match(attendance, /출석 완료|이미 출석/);

const ranking = await skill("/포인트순위");
assert.match(ranking, /민지|테스터|포인트/);

const regions = await skill("/지역전체");
assert.match(regions, /서울/);

const sender = `민지-${Date.now()}`;
const normalChat = await chat("안녕하세요", sender);
assert.equal(normalChat.ok, true);
assert.equal(normalChat.awarded, 1);
assert.equal(normalChat.reply, null);

const profile = await chat("/내정보", sender);
assert.match(profile.reply, /포인트|채팅/);

const chatRank = await chat("/채팅순위", sender);
assert.match(chatRank.reply, /채팅 순위|민지/);

const shortHelp = await chat("/?");
assert.match(shortHelp.reply, /픽셀곰 도움말/);

const shortCheckin = await chat("/ㅊㅊ", `출석-${Date.now()}`);
assert.match(shortCheckin.reply, /출석 완료|이미 출석/);

const plainCheckin = await chat("ㅊㅊ", `일반채팅-${Date.now()}`);
assert.equal(plainCheckin.reply, null);

const rps = await chat("/rps rock", `${sender}-game`);
assert.match(rps.reply, /결과|획득/);

const dice = await chat("/dice", `${sender}-dice`);
assert.match(dice.reply, /주사위 결과/);

const coin = await chat("/동전 앞", `${sender}-coin`);
assert.match(coin.reply, /동전 결과/);

const oddEven = await chat("/홀짝 홀", `${sender}-oe`);
assert.match(oddEven.reply, /숫자:/);

const roulette = await chat("/룰렛", `${sender}-roulette`);
assert.match(roulette.reply, /룰렛 결과/);

const luckyBoxUser = `${sender}-box`;
const luckyBox = await chat("/행운상자", luckyBoxUser);
assert.match(luckyBox.reply, /행운상자/);

const gachaUser = `${sender}-gacha`;
await chat("/출석", gachaUser);
const gacha = await chat("/뽑기", gachaUser);
assert.match(gacha.reply, /뽑기 결과/);

const updownUser = `${sender}-updown`;
const updownStart = await chat("/업다운", updownUser);
assert.match(updownStart.reply, /업다운 시작/);
const updownGuess = await chat("/업다운 50", updownUser);
assert.match(updownGuess.reply, /UP|DOWN|정답|실패/);

const random = await chat("/랜덤 1 3", `${sender}-random`);
assert.match(random.reply, /랜덤 결과/);

const pick = await chat("/골라 치킨 피자", `${sender}-pick`);
assert.match(pick.reply, /픽셀곰의 선택/);

const compat = await chat("/궁합 철수", `${sender}-compat`);
assert.match(compat.reply, /궁합/);

const levelRank = await chat("/레벨순위", sender);
assert.match(levelRank.reply, /레벨 순위/);

console.log("Local skill and chat-event tests passed.");
