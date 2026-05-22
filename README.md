# 카카오 운영봇

카카오톡 오픈채팅방 운영 보조용 새 봇 서버입니다.

기존 게임, 포인트, 레벨, 상점, RPG 기능은 제거했습니다. 새 방향은 라꼬봇을 벤치마크로 삼되, 우선 방 관리와 운영 보조 기능을 쌓기 쉬운 최소 서버 골격입니다.

벤치마크: https://laggobot.com/

## 현재 범위

- 채팅방 봇 웹훅: `POST /chat-event`
- 카카오 i 스킬 웹훅: `POST /skill`
- 상태 확인: `GET /health`
- 루트 상태 확인: `GET /`
- 게임 기능: 사용 안 함
- 로컬 DB/포인트 저장: 사용 안 함

## 기본 명령어

```text
/상태
/로컬상태
/도움말
/벤치마크
```

일반 채팅에는 답장하지 않습니다. 아직 등록되지 않은 `/` 명령어에는 안내 메시지만 반환합니다.

## 실행

```powershell
npm.cmd install
npm.cmd start
```

로컬 테스트:

```powershell
npm.cmd run test:local
```

## 배포

Vercel 배포 기준입니다.

```text
/
/health
/chat-event
/skill
```

`vercel.json`에서 `/`와 `/health`는 `/api/health`로 연결됩니다.

현재 골격은 DB를 사용하지 않으므로 `DATABASE_URL`이 필요 없습니다. 운영 기능을 추가하면서 저장이 필요해지면 그때 PostgreSQL 또는 다른 저장소를 붙입니다.

## 안드로이드 자동응답 앱 연결

1. MessengerBotR/KakaoTalkBot 계열 자동응답 앱을 설치합니다.
2. API2 방식이 가능하면 `android-bot/kakao-room-ops-api2.js` 내용을 붙여넣습니다.
3. API2가 반응하지 않으면 `android-bot/kakao-room-ops-legacy.js` 내용을 붙여넣습니다.
4. 앱에서 `/로컬상태`를 보내 스크립트 실행을 확인합니다.
5. `/상태`를 보내 서버 연결을 확인합니다.

운영 URL이 정해지면 스크립트의 `BOT_SERVER`를 아래 형식으로 맞춥니다.

```js
const BOT_SERVER = "https://ka-kao-bot.vercel.app/chat-event";
```

## 다음 구현 후보

- 공지 등록/조회
- 금칙어 감지
- 관리자 명령어
- 입퇴장/재입장 기록
- 닉네임 변경 기록
- 방별 설정
- ChatGPT/Gemini 응답 연동
