# 픽셀곰 명령어 라우팅 운영 문서

## 라우팅 기준

- 봇 명령어는 첫 줄의 첫 번째 토큰만 검사합니다.
- `/` 또는 `／`로 시작하지 않는 일반 메시지는 고정 명령어로 처리하지 않습니다.
- `ㅊㅊ`은 기존 호환을 위해 `/ㅊㅊ`로 처리합니다.
- `/` 단독, URL, 날짜, 파일 경로처럼 보이는 입력은 조용히 무시합니다.
- 미등록 `/명령어`는 기본적으로 조용히 무시합니다.
- 운영상 안내가 꼭 필요할 때만 `UNKNOWN_COMMAND_NOTICE_ENABLED=true` 또는 `roomState.commandRouting.unknownNoticeEnabled=true`로 켭니다.
- 안내를 켠 경우에는 방 30초, 사용자 60초 쿨다운을 적용합니다.

## unread와 `/메시지`

- unread 안내 상태는 `roomState.unreadNoticeStates`에 저장합니다.
- 저장 기준은 사용자 key, unread count, latest unread id 조합입니다.
- 같은 unread 상태는 앱 재시작이나 알림 재수신 후에도 다시 안내하지 않습니다.
- `/메시지`는 최대 5건을 표시하고 표시된 메시지만 읽음 처리합니다.
- 읽지 않은 메시지가 없으면 `읽지 않은 메시지가 없습니다.`를 반환합니다.

## 날씨 명령어

- 지원 명령어: `/날씨`, `/날씨 서울`, `/오늘날씨`, `/시흥날씨`, `/서울날씨`
- 기본 지역은 `roomState.settings.defaultWeatherRegion` 또는 `DEFAULT_WEATHER_REGION` 환경변수로 설정합니다.
- 기본 지역이 없으면 `/날씨`와 `/오늘날씨`는 사용법을 안내합니다.
- 날씨 API는 Open-Meteo를 사용하며 API 키를 코드에 저장하지 않습니다.
- 테스트에서는 `OPEN_METEO_BASE_URL`로 fixture 서버를 지정할 수 있습니다.

## 운세 명령어

- 지원 명령어: `/운세`, `/오늘운세`
- 데이터 파일: `data/fortune-pool.json`
- 카테고리: `flow`, `caution`, `luck`, `advice`
- 현재 샘플은 카테고리별 40개이며, 같은 구조로 각 400개까지 확장할 수 있습니다.
- 같은 날짜와 같은 사용자 고유값이면 같은 결과가 나오도록 seed를 고정합니다.

## 명령어 검색 API

- 구매자: `POST /api/buyer/room-commands`
- 관리자: `POST /api/admin/room-commands`
- 구매자 요청 예시:

```json
{
  "token": "buyer-token",
  "applicationId": "app_xxx",
  "q": "날씨"
}
```

- 응답 항목은 `command`, `aliases`, `category`, `description`, `examples`, `available`, `installed`, `requiresRole`, `requiresLicense`, `status`, `disabledReason`를 포함합니다.
- 검색 대상은 registry, 스토어 템플릿, 방별 커스텀 명령어를 조합합니다.
- 검색은 공백과 쉼표 기준 다중 키워드, 대소문자 무시 방식입니다.

## 화면 사용법

- `/my-rooms`와 구매자 콘솔 방 카드에서 명령어 검색을 사용할 수 있습니다.
- 검색어가 없으면 해당 방 기준 기본 명령어 목록을 표시합니다.
- 사용 가능한 명령어는 복사 버튼을 제공합니다.
- 설치가 필요한 스토어 명령어는 명령어 스토어로 이동합니다.
- 준비중 명령어는 `준비중`으로 표시하고 사용 가능 명령어처럼 보이지 않게 합니다.

## 배포 전 확인

```powershell
npm.cmd run check:deploy
npm.cmd run smoke:local
```

운영 배포와 Play Console 작업은 별도 지시가 있을 때만 진행합니다.
