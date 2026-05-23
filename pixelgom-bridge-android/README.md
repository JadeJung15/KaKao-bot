# 픽셀곰 브릿지 Android

픽셀곰 카카오 운영봇 전용 Android 브릿지 앱입니다.

## 목적

- 카카오톡 알림에서 등록된 오픈채팅방 메시지만 감지합니다.
- 픽셀곰 서버 `POST /chat-event`로 `room`, `sender`, `msg`, `roomId`, `roomLink`를 전송합니다.
- 서버 응답이 있으면 카카오 알림의 답장 액션을 통해 응답을 보냅니다.

## 기본 설정

| 항목 | 값 |
|---|---|
| 패키지명 | `com.pixgom.bridge` |
| 앱 이름 | `픽셀곰 브릿지` |
| 서버 | `https://ka-kao-bot.vercel.app/chat-event` |
| 등록 방 이름 | `픽셀곰` |
| 등록 roomId | `gu25P5vi` |
| 등록 링크 | `https://open.kakao.com/o/gu25P5vi` |
| targetSdk | 35 |
| 배포 형식 | Android App Bundle `.aab` |

## 로컬 빌드

Android Studio가 설치된 Windows 환경 기준:

```powershell
$env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_HOME='C:\Users\jadej\AppData\Local\Android\Sdk'
.\gradlew.bat :app:assembleDebug
.\gradlew.bat :app:bundleRelease
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
```

`keystore/`, `keystore.properties`, `*.jks`는 Git에 포함하지 않습니다.

## 사용 순서

1. 앱 설치
2. 앱 실행
3. `알림 접근 권한 열기`
4. `픽셀곰 브릿지` 알림 접근 허용
5. 방 이름이 실제 카카오방 이름과 다르면 앱 설정에서 수정
6. `서버 테스트 전송`으로 서버 연결 확인
7. 카카오방에서 `/상태` 테스트

## Play Store 준비

- 개인정보처리방침 URL: `https://pixgom.com/privacy`
- Data safety: 카카오 알림의 방 이름, 발신자명, 메시지 내용을 서버로 전송한다고 명시
- 앱 설명에는 "등록된 픽셀곰 운영방 메시지를 운영봇 서버로 전달하는 관리자용 브릿지"라고 제한적으로 설명
- 접근성 권한은 사용하지 않음
- 알림 접근 권한은 앱 핵심 기능 설명과 함께 심사 메모에 작성

## 제한

- NotificationListener 기반이라 카카오 알림에 방 이름이 포함되지 않으면 해당 알림은 전송하지 않습니다.
- 서버 응답 전송은 카카오 알림에 답장 액션이 있을 때만 가능합니다.
- 입장/퇴장/닉변 정확도는 카카오 알림 문구가 실제로 노출되는 경우에 한해 보강됩니다.
