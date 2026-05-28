# Android 1.0.32 내부 테스트 체크리스트

기준일: 2026-05-28

## 빌드 정보

- versionName: 1.0.32
- versionCode: 33
- applicationId: com.pixgom.bridge
- 내부 테스트 트랙: Play Console internal testing
- AAB: `pixelgom-bridge-android/app/build/outputs/bundle/release/app-release.aab`
- APK: `pixelgom-bridge-android/app/build/outputs/apk/release/app-release.apk`
- AAB SHA256: `cab7df1507ced43c019ad493b5e06c4b24277f80f368583d56c1e274f68f5a1e`

## 업로드 전 확인

- Play Console 앱 등록 정보, 패키지명, applicationId는 변경하지 않습니다.
- 업로드 대상은 내부 테스트 트랙으로 제한합니다.
- 운영 health의 latestAndroidVersion/latestAndroidVersionCode는 Play Console 내부 테스트 업로드와 봇폰 업데이트 확인 후 반영합니다.
- 봇폰 직접 APK 덮어쓰기 설치는 서명 불일치 가능성이 있어 기본 경로로 사용하지 않습니다.
- 업로드 전 `npm.cmd run android:release-report`의 versionName/versionCode와 SHA256을 다시 확인합니다.

## Play Console 내부 테스트 릴리즈 노트

```text
Android 1.0.32(33)

- 홈 화면에서 알림 권한, 브릿지 상태, 등록 방, 대기 큐, 최근 timing을 먼저 확인하도록 정리
- 설정/진단, 서버 동기화, 전송 로그, 연결코드 붙여넣기 동선을 단축
- 성공/응답 로그, 실패/재시도 필요 로그, 무시된 알림 로그, 진단 원문 로그 구분 유지
- 답장 우선 큐와 앱 timing 로그 기준을 보강해 명령어 응답 지연 원인 확인 개선
```

## 업로드 후 봇폰 QA

- Play Console 내부 테스트 링크에서 봇폰 앱을 1.0.32(33)로 업데이트합니다.
- 앱 첫 화면에서 알림 권한, 브릿지 ON/OFF, 등록 방 수, 대기 큐, 최근 timing을 확인합니다.
- 앱에서 서버와 동기화를 실행하고 대표방/게임방 목록이 맞는지 확인합니다.
- 카카오방에서 `/브릿지`, `/상태`, `/주사위`를 보내고 앱 성공/응답 로그와 실패/재시도 필요 로그를 확인합니다.
- 운영자 콘솔 `/admin`의 실시간 로그/속도 진단에서 같은 이벤트가 들어오는지 확인합니다.

## 운영 health 반영 기준

- 내부 테스트 업로드 완료
- 봇폰 업데이트 완료
- `/브릿지`, `/상태`, `/주사위` 실사용 QA 통과
- 운영 smoke와 health 재확인 통과
- 위 4개 조건 충족 후 `server.js`의 latest Android 버전 안내를 1.0.32(33)로 반영합니다.
