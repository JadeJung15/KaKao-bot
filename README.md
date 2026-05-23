# 카카오 운영봇

카카오톡 오픈채팅방 운영 보조용 봇 서버입니다.

라꼬봇을 벤치마크로 보고, 현재는 게임이 아니라 방 운영 기능을 우선 구현합니다.

벤치마크: https://laggobot.com/

## 현재 범위

- 채팅방 봇 웹훅: `POST /chat-event`
- 카카오 i 스킬 웹훅: `POST /skill`
- 상태 확인: `GET /health`
- 루트 상태 확인: `GET /`
- 게임 기능: 사용 안 함
- 저장소: 로컬 JSON 또는 PostgreSQL

## 명령어

기본:

```text
/상태
/로컬상태
/도움말
/벤치마크
```

운영:

```text
/공질
/건의방
/얼공방
/무한성
/링크등록 건의방 https://...
```

프로필:

```text
/프로필등록 닉네임 && 공질내용
/프로필 닉네임
/프로필삭제 닉네임
/별명등록 닉네임 별명
/별명삭제 별명
```

히스토리:

```text
/입퇴장현황 닉네임
/닉이력 닉네임
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

로컬 DB 초기화:

```powershell
npm.cmd run reset
```

## 저장소

로컬에서는 기본적으로 `data/room-ops-db.json`에 저장합니다.

Vercel production에서 프로필과 입퇴장 기록을 유지하려면 PostgreSQL 환경변수를 설정해야 합니다.

```text
DATABASE_URL=postgresql://...
PGSSL=require
BOT_STATE_ID=main
```

DB가 없으면 서버는 동작하지만, 서버리스 환경에서는 저장 데이터가 영구 보장되지 않습니다.

## 배포

Vercel 배포 기준입니다.

```text
/
/health
/chat-event
/skill
```

`vercel.json`에서 `/`와 `/health`는 `/api/health`로 연결됩니다.

## 안드로이드 자동응답 앱 연결

1. MessengerBotR/KakaoTalkBot 계열 자동응답 앱을 설치합니다.
2. API2 방식이 가능하면 `android-bot/kakao-room-ops-api2.js` 내용을 붙여넣습니다.
3. API2가 반응하지 않으면 `android-bot/kakao-room-ops-legacy.js` 내용을 붙여넣습니다.
4. 앱에서 `/로컬상태`를 보내 스크립트 실행을 확인합니다.
5. `/상태`를 보내 서버 연결을 확인합니다.

현재 운영 URL:

```js
const BOT_SERVER = "https://ka-kao-bot.vercel.app/chat-event";
```

## 구현 원칙

- 게임, 포인트, 상점, RPG는 다시 넣지 않습니다.
- 먼저 방 운영에 필요한 프로필, 별명, 링크, 입퇴장, 닉변 기록을 안정화합니다.
- 저장이 필요한 기능은 로컬 JSON과 PostgreSQL 저장소를 모두 지원합니다.
