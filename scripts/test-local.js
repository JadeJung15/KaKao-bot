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

async function chat(msg, sender = `민지-${Date.now()}`, room = "테스트방", extra = {}) {
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
      packageName: "com.kakao.talk",
      ...extra
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

const typingUser = `타수-${Date.now()}`;
await chat("가나다라마바사", typingUser);
const typingRank = await chat("/타수순위", typingUser);
assert.match(typingRank.reply, /누적 타수 순위|타수/);
const dayTypingRank = await chat("/일간타수순위", typingUser);
assert.match(dayTypingRank.reply, /오늘 타수 순위|타수/);
const weekTypingRank = await chat("/주간타수순위", typingUser);
assert.match(weekTypingRank.reply, /이번 주 타수 순위|타수/);
const monthTypingRank = await chat("/월간타수순위", typingUser);
assert.match(monthTypingRank.reply, /이번 달 타수 순위|타수/);
const dayChatRank = await chat("/일간채팅순위", typingUser);
assert.match(dayChatRank.reply, /오늘 채팅 순위|채팅/);

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

const stamp = Date.now();
const admin = `관리자-${stamp}`;
const oldNick = `우주${stamp}`;
const nextNick = `천사${stamp}`;
const thirdNick = `민지${stamp}`;
const bulk = await chat(`/일괄등록
[ 경기 ]
• ${oldNick}
• ${nextNick}

[ 서울 ]
• ${thirdNick}`, admin, `명단방-${stamp}`);
assert.match(bulk.reply, /일괄등록 완료/);
assert.match(bulk.reply, /총 입력: 3명/);
const registerStatus = await chat("/등록현황", admin, `명단방-${stamp}`);
assert.match(registerStatus.reply, /등록 인원/);
const bulkHistory = await chat(`/닉이력 ${oldNick}`, admin, `명단방-${stamp}`);
assert.match(bulkHistory.reply, new RegExp(oldNick));

const linkRoom = `닉방-${stamp}`;
await chat(`/일괄등록 ${oldNick}`, admin, linkRoom);
await chat("한달 뒤 재입장", nextNick, linkRoom);
const link = await chat(`/닉연결 ${oldNick}`, nextNick, linkRoom);
assert.match(link.reply, /닉네임 기록을 연결/);
const linkedHistory = await chat("/닉이력", nextNick, linkRoom);
assert.match(linkedHistory.reply, new RegExp(oldNick));
assert.match(linkedHistory.reply, new RegExp(nextNick));

const profileRoom = `프로필방-${stamp}`;
const profileHash = `profile-${stamp}`;
await chat("처음 입장", oldNick, profileRoom, { profileHash });
await chat("닉네임 변경 후 입장", nextNick, profileRoom, { profileHash });
const autoHistory = await chat("/닉이력", nextNick, profileRoom, { profileHash });
assert.match(autoHistory.reply, new RegExp(oldNick));
assert.match(autoHistory.reply, new RegExp(nextNick));

const transcriptRoom = `대화방-${stamp}`;
const transcriptImport = await chat(`/대화가져오기
2026년 5월 22일 금요일
미정 남님이 들어왔습니다. 타인, 기관 등의 사칭에 유의해 주세요.
[미정 남] [오전 11:26] 하이하이
[소영 여] [오전 11:26] /신입환영
[오픈채팅봇] [오전 11:26] 어서와
유진 남님이 나갔습니다.
[우주 남] [오전 11:27] 이모티콘
흐물한 어피치님을 내보냈습니다.
[지오 남] [오후 2:02] 🌸닉넴 / 성별 : 지오 남
🌸상세지역 :인천 부평`, admin, transcriptRoom);
assert.match(transcriptImport.reply, /대화가져오기 완료/);
assert.match(transcriptImport.reply, /메시지: 4건/);
assert.match(transcriptImport.reply, /입장 1명 \/ 퇴장 1명 \/ 내보냄 1명/);
const importedTypingRank = await chat("/일간타수순위", admin, transcriptRoom);
assert.match(importedTypingRank.reply, /미정 남|소영 여|지오 남/);
const membership = await chat("/입퇴장현황", admin, transcriptRoom);
assert.match(membership.reply, /유진 남/);
assert.match(membership.reply, /흐물한 어피치/);

console.log("Local skill and chat-event tests passed.");
