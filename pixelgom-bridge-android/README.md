# 픽셀곰 브릿지 Android

픽셀곰 카카오 운영봇 전용 Android 브릿지 앱입니다.

## 목적

- 카카오톡 알림에서 등록된 오픈채팅방 메시지만 감지합니다.
- 픽셀곰 서버 `POST /chat-event`로 `room`, `sender`, `msg`, `roomId`, `roomLink`를 전송합니다.
- 서버 응답이 있으면 카카오 알림의 답장 액션을 통해 응답을 보냅니다.
- 서버 응답이 없을 때는 앱 안의 로컬 JS 자동응답 스크립트가 보조 응답을 만들 수 있습니다.

## 기본 설정

| 항목 | 값 |
|---|---|
| 패키지명 | `com.pixgom.bridge` |
| 앱 이름 | `픽셀곰 브릿지` |
| 서버 | `https://pixgom.com/chat-event` |
| 방 설정 | 구매자 가이드의 앱 연결코드로 자동 설정, 필요 시 수동 수정 |
| 월 이용금액 | `5,500원` |
| targetSdk | 35 |
| 배포 형식 | Android App Bundle `.aab` |
| 현재 서버 권장 | `1.0.29` / versionCode `30` |
| 내부 테스트 등록 | `1.0.29` / versionCode `30` |

## 로컬 빌드

Android Studio가 설치된 Windows 환경 기준:

```powershell
$env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_HOME='C:\Users\jadej\AppData\Local\Android\Sdk'
.\gradlew.bat :app:assembleDebug
.\gradlew.bat :app:bundleRelease
npm.cmd run android:release-report
```

Release 업로드 전에는 Play Console용 서명 설정을 별도로 연결해야 합니다.

## Play 업로드 키

Play Console 내부 테스트에 올릴 `.aab`는 디버그 키가 아니라 업로드 키로 서명해야 합니다.

```powershell
$env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'
New-Item -ItemType Directory -Force -Path .\keystore
& "$env:JAVA_HOME\bin\keytool.exe" -genkeypair -v -keystore .\keystore\pixelgom-upload.jks -alias pixelgom-upload -keyalg RSA -keysize 4096 -validity 10000
Copy-Item .\keystore.properties.example .\keystore.properties
```

`keystore.properties`에 실제 비밀번호를 넣은 뒤 다시 빌드합니다.

```powershell
.\gradlew.bat :app:bundleRelease
npm.cmd run android:release-report
```

`keystore/`, `keystore.properties`, `*.jks`는 Git에 포함하지 않습니다.

## 사용 순서

1. 앱 설치
2. 앱 실행
3. `시작하기`
4. `알림 접근 권한 열기`에서 `픽셀곰 브릿지` 알림 접근 허용
5. 앱의 `앱 연결코드` 입력칸 아래 `연결코드 찾기/복사`를 눌러 외부 브라우저에서 `https://pixgom.com/console?from=android&view=setup#app-connect-code` 열기
6. 구매자 콘솔의 앱 연결 코드 카드에서 코드를 복사해 앱 입력칸에 붙여넣고 `연결코드로 방 추가/갱신` 실행
7. Android 1.0.29 이상에서는 입력칸 주변에서 연결코드 찾기/복사를 바로 열 수 있고, 일반방 연결코드 1번으로 연결된 게임방까지 자동 등록됩니다. 대표방은 일반방으로 표시하고 게임방은 접기/펼치기 목록에서 전체 등록 방을 확인할 수 있습니다.
8. 전송 실패 이벤트는 앱 내부 대기 큐에 보관되며, `전송 대기 재시도`로 서버에 다시 보낼 수 있습니다. 앱 화면에서 최근 서버 timing, 최근 성공/실패, 대기 이벤트 수를 확인합니다.
8. 필요하면 대표 방 설정에서 방 이름, roomId, 링크, 입장확인 문구, 관리자, 라이선스 키를 직접 수정
9. 추가 방은 `https://pixgom.com/admin` 관리 콘솔에서 등록
10. 방별 기능 ON/OFF에서 출석, 포인트, 랭킹, 히스토리, 게임 사용 여부 설정
11. `서버 테스트 전송`으로 서버 연결 확인
12. `테스트 체크리스트`에서 일반방과 게임방의 `/브릿지`, `/상태`, `/js상태`를 각각 점검
13. 필요한 경우 `JS 자동응답 사용`을 켜고 스크립트를 저장
14. 카카오방에서 `/구독상태`, `/포인트`, `/출석`, `/게임`, `/주사위` 테스트
15. 방장봇 환영문구를 방별 입장확인 문구로 맞춘 뒤 첫 채팅 히스토리 보정을 테스트
16. 기기를 바꾸거나 다른 환경에 다시 등록할 때는 `서버 설정 초기화 / 등록 취소`로 앱 안의 등록 방과 라이선스 기록을 지운 뒤 새 연결코드를 입력합니다.

## 로컬 JS 자동응답

`로컬 JS 자동응답`은 MessengerBot의 핵심 실행 형태를 픽셀곰 전용으로 줄여 넣은 기능입니다.
`/브릿지`, `/js상태`, `/로컬상태`는 서버 설정과 무관하게 앱이 직접 응답합니다.
그 외 서버가 응답을 만들지 않은 메시지나 서버의 미등록 명령어 응답에 대해 앱 내부 JS가 실행됩니다.

지원하는 기본 형태:

```javascript
const bot = BotManager.getCurrentBot();

bot.addListener(Event.MESSAGE, function(message) {
  if (message.content === "/브릿지") {
    message.reply("픽셀곰 브릿지 JS 자동응답 작동 중입니다.");
  }
});

function response(room, msg, sender, isGroupChat, replier, imageDB, packageName) {
  if (msg === "/js상태") {
    replier.reply("JS 엔진 정상 작동");
  }
}
```

초기 버전은 안전을 위해 매 메시지마다 스크립트를 새로 실행하고 1.5초 제한을 둡니다.
장기 상태 저장, 파일 API, 이미지 API, 전체 MessengerBot API 호환은 후속 업데이트 범위입니다.

## Play Store 준비

- 개인정보처리방침 URL: `https://pixgom.com/privacy`
- 업로드 트랙: 내부 테스트(Internal testing)
- AAB 생성 후 `npm.cmd run android:release-report`로 경로, versionName, versionCode, SHA256을 확인
- Data safety: 카카오 알림의 방 이름, 발신자명, 메시지 내용을 서버로 전송한다고 명시
- 앱 설명에는 "등록된 픽셀곰 운영방 메시지를 운영봇 서버로 전달하는 관리자용 브릿지"라고 제한적으로 설명
- 접근성 권한은 사용하지 않음
- 알림 접근 권한은 앱 핵심 기능 설명과 함께 심사 메모에 작성

## 제한

- NotificationListener 기반이라 카카오 알림에 방 이름이 포함되지 않으면 해당 알림은 전송하지 않습니다.
- 화면 감지/접근성 서비스는 앱에 포함하지 않습니다.
- 서버 응답 전송은 카카오 알림에 답장 액션이 있을 때만 가능합니다.
- 입장/퇴장/닉변 정확도는 카카오 알림 문구가 실제로 노출되는 경우에 한해 보강됩니다.
- 로컬 JS는 픽셀곰 전용 보조 엔진이며, 범용 MessengerBot 전체 API를 모두 포함하지는 않습니다.
