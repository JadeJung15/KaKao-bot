package com.pixgom.bridge;

import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Bundle;
import android.provider.Settings;
import android.text.InputType;
import android.text.TextUtils;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.Switch;
import android.widget.TextView;
import android.widget.Toast;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends Activity {
    private static final String WEBSITE_URL = "https://pixgom.com";

    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private TextView permissionStatus;
    private TextView logView;
    private EditText serverUrlInput;
    private EditText connectionCodeInput;
    private EditText roomNameInput;
    private EditText roomIdInput;
    private EditText roomLinkInput;
    private EditText joinPhraseInput;
    private EditText adminsInput;
    private EditText licenseKeyInput;
    private EditText scriptSourceInput;
    private TextView roomProfilesSummaryView;
    private Switch enabledSwitch;
    private Switch scriptEnabledSwitch;
    private Switch attendanceFeatureSwitch;
    private Switch pointsFeatureSwitch;
    private Switch rankingsFeatureSwitch;
    private Switch historyFeatureSwitch;
    private Switch profilesFeatureSwitch;
    private Switch gamesFeatureSwitch;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        BridgeConfig.applyMigrations(this);
        showHome();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (permissionStatus != null) refreshStatus();
        if (logView != null) refreshLogs();
    }

    private void showHome() {
        clearMainRefs();
        setContentView(buildHomeContent());
    }

    private void showMain() {
        setContentView(buildMainContent());
        refreshStatus();
        refreshLogs();
    }

    private View buildHomeContent() {
        ScrollView scrollView = baseScrollView();

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(18), dp(18), dp(18), dp(28));
        scrollView.addView(root);

        ImageView hero = new ImageView(this);
        hero.setImageResource(getResources().getIdentifier("pixelgom_home", "drawable", getPackageName()));
        hero.setScaleType(ImageView.ScaleType.CENTER_CROP);
        root.addView(hero, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(220)));

        TextView title = text("픽셀곰 브릿지", 30, Color.rgb(58, 37, 24), true);
        title.setPadding(0, dp(18), 0, dp(4));
        root.addView(title);

        TextView version = text("버전 " + BuildConfig.VERSION_NAME + " (" + BuildConfig.VERSION_CODE + ")", 14, Color.rgb(111, 78, 49), true);
        version.setPadding(0, 0, 0, dp(12));
        root.addView(version);

        TextView subtitle = text("오픈채팅 운영봇을 카카오 알림 기반으로 연결합니다. 화면 감지는 사용하지 않습니다.", 15, Color.rgb(87, 64, 47), false);
        root.addView(subtitle);

        LinearLayout infoPanel = panel();
        infoPanel.setPadding(dp(14), dp(14), dp(14), dp(14));
        root.addView(infoPanel);

        BridgeConfig.RoomProfile profile = BridgeConfig.firstRoomProfile(this);
        infoPanel.addView(statusRow("알림 권한", notificationPermissionEnabled() ? "허용됨" : "필요", notificationPermissionEnabled()));
        infoPanel.addView(labelValue("대표 방", profile.name));
        infoPanel.addView(labelValue("등록 방 수", BridgeConfig.roomProfileCount(this) + "개"));
        infoPanel.addView(labelValue("등록 방 목록", BridgeConfig.roomProfilesSummary(this)));
        infoPanel.addView(labelValue("입장확인 문구", profile.joinPhrase));
        infoPanel.addView(labelValue("라이선스 키", TextUtils.isEmpty(profile.licenseKey) ? BridgeConfig.deviceLicenseKey(this) : profile.licenseKey));
        infoPanel.addView(labelValue("월 이용금액", "5,500원 / 방 1개 / 30일"));
        infoPanel.addView(labelValue("사용 기능", BridgeConfig.featureSummary(this)));
        infoPanel.addView(labelValue("관리 콘솔", WEBSITE_URL + "/admin"));
        infoPanel.addView(labelValue("구매자 가이드", WEBSITE_URL + "/buyer-guide"));

        LinearLayout stepsPanel = panel();
        stepsPanel.setPadding(dp(14), dp(14), dp(14), dp(14));
        root.addView(stepsPanel);
        stepsPanel.addView(text("처음 설정 순서", 18, Color.rgb(58, 37, 24), true));
        stepsPanel.addView(stepText("1", "알림 접근 권한을 허용합니다."));
        stepsPanel.addView(stepText("2", "구매자 가이드에서 앱 연결코드를 복사해 자동 설정합니다."));
        stepsPanel.addView(stepText("3", "서버 테스트 전송 후 카카오방에서 /브릿지를 확인합니다."));

        Button startButton = primaryButton("시작하기");
        startButton.setOnClickListener(v -> showMain());
        root.addView(startButton);

        Button permissionButton = secondaryButton("알림 권한 열기");
        permissionButton.setOnClickListener(v -> startActivity(new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)));
        root.addView(permissionButton);

        Button openChatButton = secondaryButton("오픈채팅방 열기");
        openChatButton.setOnClickListener(v -> openUrl(BridgeConfig.roomLink(this)));
        root.addView(openChatButton);

        Button websiteButton = secondaryButton("홈페이지 열기");
        websiteButton.setOnClickListener(v -> openUrl(WEBSITE_URL));
        root.addView(websiteButton);

        Button guideButton = secondaryButton("구매자 가이드 열기");
        guideButton.setOnClickListener(v -> openUrl(WEBSITE_URL + "/buyer-guide"));
        root.addView(guideButton);

        Button consoleButton = secondaryButton("관리 콘솔 열기");
        consoleButton.setOnClickListener(v -> openUrl(WEBSITE_URL + "/admin"));
        root.addView(consoleButton);

        return scrollView;
    }

    private View buildMainContent() {
        ScrollView scrollView = baseScrollView();

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(18), dp(18), dp(18), dp(28));
        scrollView.addView(root);

        Button homeButton = secondaryButton("홈으로");
        homeButton.setOnClickListener(v -> showHome());
        root.addView(homeButton);

        TextView version = text("버전 " + BuildConfig.VERSION_NAME + " (" + BuildConfig.VERSION_CODE + ")", 13, Color.rgb(111, 78, 49), true);
        version.setPadding(0, dp(12), 0, 0);
        root.addView(version);

        ImageView hero = new ImageView(this);
        hero.setImageResource(getResources().getIdentifier("pixelgom_hero", "drawable", getPackageName()));
        hero.setScaleType(ImageView.ScaleType.CENTER_CROP);
        root.addView(hero, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(160)));

        TextView title = text("픽셀곰 브릿지", 28, Color.rgb(58, 37, 24), true);
        title.setPadding(0, dp(18), 0, dp(4));
        root.addView(title);

        TextView subtitle = text("방 설정은 한 칸씩 입력하면 됩니다. 복잡한 구분자 형식은 더 이상 직접 입력하지 않아도 됩니다.", 15, Color.rgb(87, 64, 47), false);
        root.addView(subtitle);

        permissionStatus = text("", 14, Color.rgb(58, 37, 24), false);
        permissionStatus.setPadding(0, dp(14), 0, dp(8));
        root.addView(permissionStatus);

        Button permissionButton = primaryButton("알림 접근 권한 열기");
        permissionButton.setOnClickListener(v -> startActivity(new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)));
        root.addView(permissionButton);

        LinearLayout panel = panel();
        panel.setPadding(dp(14), dp(14), dp(14), dp(14));
        root.addView(panel);

        enabledSwitch = new Switch(this);
        enabledSwitch.setText("브릿지 사용");
        enabledSwitch.setTextSize(16);
        enabledSwitch.setTextColor(Color.rgb(58, 37, 24));
        enabledSwitch.setChecked(BridgeConfig.isEnabled(this));
        enabledSwitch.setOnCheckedChangeListener((button, checked) -> BridgeConfig.setEnabled(this, checked));
        panel.addView(enabledSwitch);

        serverUrlInput = input("서버 URL", BridgeConfig.serverUrl(this));
        panel.addView(serverUrlInput);

        TextView connectTitle = text("앱 자동 연결", 20, Color.rgb(58, 37, 24), true);
        connectTitle.setPadding(0, dp(16), 0, 0);
        panel.addView(connectTitle);

        TextView connectHelp = text("구매자 가이드에서 복사한 앱 연결코드를 붙여넣으면 방 이름, roomId, 링크, 관리자, 라이선스가 자동 추가됩니다. 같은 방은 갱신되고 새 방은 목록에 추가됩니다.", 13, Color.rgb(111, 78, 49), false);
        connectHelp.setPadding(0, dp(8), 0, 0);
        panel.addView(connectHelp);

        connectionCodeInput = input("앱 연결코드", "");
        panel.addView(connectionCodeInput);

        Button connectButton = secondaryButton("연결코드로 방 추가/갱신");
        connectButton.setOnClickListener(v -> connectWithCode());
        panel.addView(connectButton);

        TextView roomTitle = text("대표 방 설정", 20, Color.rgb(58, 37, 24), true);
        roomTitle.setPadding(0, dp(16), 0, 0);
        panel.addView(roomTitle);

        roomProfilesSummaryView = text("등록 방 목록\n" + BridgeConfig.roomProfilesSummary(this), 13, Color.rgb(111, 78, 49), false);
        roomProfilesSummaryView.setPadding(0, dp(8), 0, 0);
        panel.addView(roomProfilesSummaryView);

        BridgeConfig.RoomProfile profile = BridgeConfig.firstRoomProfile(this);
        roomNameInput = input("카카오 방 이름", profile.name);
        panel.addView(roomNameInput);

        roomIdInput = input("오픈채팅 roomId", profile.roomId);
        panel.addView(roomIdInput);

        roomLinkInput = input("오픈채팅 링크", profile.roomLink);
        panel.addView(roomLinkInput);

        joinPhraseInput = input("입장확인 문구", profile.joinPhrase);
        panel.addView(joinPhraseInput);

        adminsInput = input("관리자 닉네임(쉼표로 구분)", TextUtils.join(",", profile.admins));
        panel.addView(adminsInput);

        licenseKeyInput = input("라이선스 키", TextUtils.isEmpty(profile.licenseKey) ? BridgeConfig.deviceLicenseKey(this) : profile.licenseKey);
        panel.addView(licenseKeyInput);

        TextView roomHelp = text("대표 방 설정은 목록 첫 번째 방을 직접 수정할 때만 사용하세요. 여러 방은 구매자 가이드의 방별 연결코드를 차례대로 붙여넣으면 됩니다.", 13, Color.rgb(111, 78, 49), false);
        roomHelp.setPadding(0, dp(10), 0, 0);
        panel.addView(roomHelp);

        TextView featureTitle = text("방별 기능", 20, Color.rgb(58, 37, 24), true);
        featureTitle.setPadding(0, dp(18), 0, 0);
        panel.addView(featureTitle);

        attendanceFeatureSwitch = settingSwitch("출석 보상", BridgeConfig.attendanceEnabled(this));
        panel.addView(attendanceFeatureSwitch);
        pointsFeatureSwitch = settingSwitch("포인트 기능", BridgeConfig.pointsEnabled(this));
        panel.addView(pointsFeatureSwitch);
        rankingsFeatureSwitch = settingSwitch("랭킹 기능", BridgeConfig.rankingsEnabled(this));
        panel.addView(rankingsFeatureSwitch);
        historyFeatureSwitch = settingSwitch("히스토리 기능", BridgeConfig.historyEnabled(this));
        panel.addView(historyFeatureSwitch);
        profilesFeatureSwitch = settingSwitch("프로필 기능", BridgeConfig.profilesEnabled(this));
        panel.addView(profilesFeatureSwitch);
        gamesFeatureSwitch = settingSwitch("게임 기능", BridgeConfig.gamesEnabled(this));
        panel.addView(gamesFeatureSwitch);

        Button saveButton = primaryButton("설정 저장");
        saveButton.setOnClickListener(v -> saveSettings());
        panel.addView(saveButton);

        Button testButton = secondaryButton("서버 테스트 전송");
        testButton.setOnClickListener(v -> sendTestEvent());
        panel.addView(testButton);

        Button diagnosisButton = secondaryButton("진단 내용 복사");
        diagnosisButton.setOnClickListener(v -> copyDiagnosis());
        panel.addView(diagnosisButton);

        Button privacyButton = secondaryButton("개인정보처리방침 열기");
        privacyButton.setOnClickListener(v -> openUrl(WEBSITE_URL + "/privacy"));
        panel.addView(privacyButton);

        Button guideButton = secondaryButton("구매자 가이드 열기");
        guideButton.setOnClickListener(v -> openUrl(WEBSITE_URL + "/buyer-guide"));
        panel.addView(guideButton);

        Button consoleButton = secondaryButton("관리 콘솔 열기");
        consoleButton.setOnClickListener(v -> openUrl(WEBSITE_URL + "/admin"));
        panel.addView(consoleButton);

        TextView scriptTitle = text("로컬 JS 자동응답", 20, Color.rgb(58, 37, 24), true);
        scriptTitle.setPadding(0, dp(18), 0, dp(8));
        root.addView(scriptTitle);

        LinearLayout scriptPanel = panel();
        scriptPanel.setPadding(dp(14), dp(14), dp(14), dp(14));
        root.addView(scriptPanel);

        scriptEnabledSwitch = new Switch(this);
        scriptEnabledSwitch.setText("JS 자동응답 사용");
        scriptEnabledSwitch.setTextSize(16);
        scriptEnabledSwitch.setTextColor(Color.rgb(58, 37, 24));
        scriptEnabledSwitch.setChecked(BridgeConfig.scriptEnabled(this));
        scriptEnabledSwitch.setOnCheckedChangeListener((button, checked) -> BridgeConfig.setScriptEnabled(this, checked));
        scriptPanel.addView(scriptEnabledSwitch);

        scriptSourceInput = scriptInput(BridgeConfig.scriptSource(this));
        scriptPanel.addView(scriptSourceInput);

        Button scriptSaveButton = primaryButton("JS 저장");
        scriptSaveButton.setOnClickListener(v -> saveSettings());
        scriptPanel.addView(scriptSaveButton);

        Button scriptTestButton = secondaryButton("JS 테스트");
        scriptTestButton.setOnClickListener(v -> testScript());
        scriptPanel.addView(scriptTestButton);

        Button scriptResetButton = secondaryButton("기본 예제 넣기");
        scriptResetButton.setOnClickListener(v -> scriptSourceInput.setText(BridgeConfig.defaultScriptSource()));
        scriptPanel.addView(scriptResetButton);

        TextView logTitle = text("전송 로그", 20, Color.rgb(58, 37, 24), true);
        logTitle.setPadding(0, dp(18), 0, dp(8));
        root.addView(logTitle);

        logView = text("", 13, Color.rgb(72, 52, 38), false);
        logView.setBackgroundResource(getResources().getIdentifier("panel_background", "drawable", getPackageName()));
        logView.setPadding(dp(14), dp(14), dp(14), dp(14));
        root.addView(logView, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));

        Button refreshButton = secondaryButton("로그 새로고침");
        refreshButton.setOnClickListener(v -> refreshLogs());
        root.addView(refreshButton);

        Button copyLogButton = secondaryButton("로그 복사");
        copyLogButton.setOnClickListener(v -> copyLogs());
        root.addView(copyLogButton);

        Button shareButton = secondaryButton("진단 공유");
        shareButton.setOnClickListener(v -> shareDiagnosis());
        root.addView(shareButton);

        Button clearButton = secondaryButton("로그 지우기");
        clearButton.setOnClickListener(v -> {
            BridgeConfig.clearLogs(this);
            refreshLogs();
        });
        root.addView(clearButton);

        return scrollView;
    }

    private ScrollView baseScrollView() {
        ScrollView scrollView = new ScrollView(this);
        scrollView.setFillViewport(true);
        scrollView.setBackgroundColor(Color.rgb(255, 246, 231));
        return scrollView;
    }

    private void clearMainRefs() {
        permissionStatus = null;
        logView = null;
        serverUrlInput = null;
        roomNameInput = null;
        roomIdInput = null;
        roomLinkInput = null;
        joinPhraseInput = null;
        adminsInput = null;
        licenseKeyInput = null;
        connectionCodeInput = null;
        scriptSourceInput = null;
        roomProfilesSummaryView = null;
        enabledSwitch = null;
        scriptEnabledSwitch = null;
        attendanceFeatureSwitch = null;
        pointsFeatureSwitch = null;
        rankingsFeatureSwitch = null;
        historyFeatureSwitch = null;
        profilesFeatureSwitch = null;
        gamesFeatureSwitch = null;
    }

    private void saveSettings() {
        BridgeConfig.setEnabled(this, enabledSwitch.isChecked());
        BridgeConfig.setServerUrl(this, serverUrlInput.getText().toString());
        BridgeConfig.setPrimaryRoomProfile(
                this,
                roomNameInput.getText().toString(),
                roomIdInput.getText().toString(),
                roomLinkInput.getText().toString(),
                joinPhraseInput.getText().toString(),
                adminsInput.getText().toString(),
                licenseKeyInput.getText().toString()
        );
        BridgeConfig.setAttendanceEnabled(this, attendanceFeatureSwitch.isChecked());
        BridgeConfig.setPointsEnabled(this, pointsFeatureSwitch.isChecked());
        BridgeConfig.setRankingsEnabled(this, rankingsFeatureSwitch.isChecked());
        BridgeConfig.setHistoryEnabled(this, historyFeatureSwitch.isChecked());
        BridgeConfig.setProfilesEnabled(this, profilesFeatureSwitch.isChecked());
        BridgeConfig.setGamesEnabled(this, gamesFeatureSwitch.isChecked());
        BridgeConfig.setScriptEnabled(this, scriptEnabledSwitch.isChecked());
        BridgeConfig.setScriptSource(this, scriptSourceInput.getText().toString());
        BridgeConfig.appendLog(this, "설정 저장됨 room=" + BridgeConfig.roomName(this) + " id=" + BridgeConfig.roomId(this) + " features=" + BridgeConfig.featureSummary(this));
        refreshStatus();
        refreshRoomProfilesSummary();
        refreshLogs();
    }

    private void sendTestEvent() {
        saveSettings();
        BridgeConfig.RoomProfile profile = BridgeConfig.firstRoomProfile(this);
        BridgeEvent event = new BridgeEvent();
        event.room = profile.name;
        event.rawRoom = profile.name;
        event.roomId = profile.roomId;
        event.roomLink = profile.roomLink;
        BridgeConfig.applyRoomProfile(event, profile);
        event.sender = "픽셀곰앱테스트";
        event.message = "/상태";
        event.packageName = getPackageName();
        event.groupChat = true;
        event.eventType = "";
        event.targetName = "";

        BridgeConfig.appendLog(this, "서버 테스트 시작");
        refreshLogs();
        executor.execute(() -> {
            EventSender.SendResult result = EventSender.send(this, event);
            runOnUiThread(() -> {
                if (result.ok()) {
                    String reply = TextUtils.isEmpty(result.reply) ? "응답 없음" : result.reply.replace("\n", " / ");
                    BridgeConfig.appendLog(this, "서버 테스트 성공: " + reply);
                } else {
                    BridgeConfig.appendLog(this, "서버 테스트 실패: " + result.error);
                }
                refreshLogs();
            });
        });
    }

    private void connectWithCode() {
        String code = connectionCodeInput == null ? "" : connectionCodeInput.getText().toString().trim();
        if (TextUtils.isEmpty(code)) {
            Toast.makeText(this, "앱 연결코드를 입력하세요.", Toast.LENGTH_SHORT).show();
            return;
        }
        BridgeConfig.setServerUrl(this, serverUrlInput.getText().toString());
        BridgeConfig.appendLog(this, "앱 연결코드 확인 시작");
        refreshLogs();
        executor.execute(() -> {
            EventSender.ConnectResult result = EventSender.connect(this, code);
            runOnUiThread(() -> {
                if (result.ok()) {
                    BridgeConfig.setServerUrl(this, TextUtils.isEmpty(result.serverUrl) ? BridgeConfig.DEFAULT_SERVER_URL : result.serverUrl);
                    BridgeConfig.addOrUpdateRoomProfile(this, result.roomName, result.roomId, result.roomLink, result.joinPhrase, TextUtils.join(",", result.admins), result.licenseKey);
                    BridgeConfig.setAttendanceEnabled(this, result.attendance);
                    BridgeConfig.setPointsEnabled(this, result.points);
                    BridgeConfig.setRankingsEnabled(this, result.rankings);
                    BridgeConfig.setHistoryEnabled(this, result.history);
                    BridgeConfig.setProfilesEnabled(this, result.profiles);
                    BridgeConfig.setScriptEnabled(this, result.localJs);
                    BridgeConfig.setGamesEnabled(this, result.games);
                    BridgeConfig.appendLog(this, "앱 자동 연결 완료: " + result.roomName + " / " + result.roomId + " / 등록방 " + BridgeConfig.roomProfileCount(this) + "개");
                    if (serverUrlInput != null) serverUrlInput.setText(BridgeConfig.serverUrl(this));
                    if (roomNameInput != null) roomNameInput.setText(result.roomName);
                    if (roomIdInput != null) roomIdInput.setText(result.roomId);
                    if (roomLinkInput != null) roomLinkInput.setText(result.roomLink);
                    if (joinPhraseInput != null) joinPhraseInput.setText(result.joinPhrase);
                    if (adminsInput != null) adminsInput.setText(TextUtils.join(",", result.admins));
                    if (licenseKeyInput != null) licenseKeyInput.setText(result.licenseKey);
                    if (attendanceFeatureSwitch != null) attendanceFeatureSwitch.setChecked(result.attendance);
                    if (pointsFeatureSwitch != null) pointsFeatureSwitch.setChecked(result.points);
                    if (rankingsFeatureSwitch != null) rankingsFeatureSwitch.setChecked(result.rankings);
                    if (historyFeatureSwitch != null) historyFeatureSwitch.setChecked(result.history);
                    if (profilesFeatureSwitch != null) profilesFeatureSwitch.setChecked(result.profiles);
                    if (scriptEnabledSwitch != null) scriptEnabledSwitch.setChecked(result.localJs);
                    if (gamesFeatureSwitch != null) gamesFeatureSwitch.setChecked(result.games);
                    refreshStatus();
                    refreshRoomProfilesSummary();
                    Toast.makeText(this, "방 설정이 추가/갱신되었습니다.", Toast.LENGTH_SHORT).show();
                } else {
                    BridgeConfig.appendLog(this, "앱 자동 연결 실패: " + result.error);
                    Toast.makeText(this, "연결코드를 확인하세요.", Toast.LENGTH_SHORT).show();
                }
                refreshLogs();
            });
        });
    }

    private void testScript() {
        BridgeConfig.setScriptSource(this, scriptSourceInput.getText().toString());
        BridgeConfig.RoomProfile profile = BridgeConfig.firstRoomProfile(this);
        BridgeEvent event = new BridgeEvent();
        event.room = profile.name;
        event.rawRoom = profile.name;
        event.roomId = profile.roomId;
        event.roomLink = profile.roomLink;
        BridgeConfig.applyRoomProfile(event, profile);
        event.sender = "픽셀곰앱테스트";
        event.message = "/브릿지";
        event.packageName = getPackageName();
        event.groupChat = true;
        event.eventType = "";
        event.targetName = "";

        ScriptBotEngine.Result result = ScriptBotEngine.test(scriptSourceInput.getText().toString(), event);
        if (!result.ok()) {
            BridgeConfig.appendLog(this, "JS 테스트 실패: " + result.error);
        } else if (result.handled) {
            BridgeConfig.appendLog(this, "JS 테스트 성공: " + result.reply.replace("\n", " / "));
        } else {
            BridgeConfig.appendLog(this, "JS 테스트 응답 없음");
        }
        refreshLogs();
    }

    private void refreshStatus() {
        boolean permission = notificationPermissionEnabled();
        permissionStatus.setText((permission ? "알림 접근 권한: 허용됨" : "알림 접근 권한: 필요")
                + "\n브릿지: " + (BridgeConfig.isEnabled(this) ? "켜짐" : "꺼짐")
                + "\n등록 방: " + BridgeConfig.roomName(this)
                + "\n사용 기능: " + BridgeConfig.featureSummary(this));
        permissionStatus.setTextColor(permission ? Color.rgb(30, 104, 58) : Color.rgb(184, 74, 43));
    }

    private void refreshLogs() {
        String logs = BridgeConfig.logs(this);
        logView.setText(TextUtils.isEmpty(logs) ? "아직 전송 로그가 없습니다." : logs);
    }

    private void refreshRoomProfilesSummary() {
        if (roomProfilesSummaryView != null) {
            roomProfilesSummaryView.setText("등록 방 목록\n" + BridgeConfig.roomProfilesSummary(this));
        }
    }

    private void copyDiagnosis() {
        copyText("픽셀곰 진단", diagnosisText());
    }

    private void copyLogs() {
        String logs = BridgeConfig.logs(this);
        copyText("픽셀곰 로그", TextUtils.isEmpty(logs) ? "아직 전송 로그가 없습니다." : logs);
    }

    private void shareDiagnosis() {
        Intent intent = new Intent(Intent.ACTION_SEND);
        intent.setType("text/plain");
        intent.putExtra(Intent.EXTRA_TEXT, diagnosisText());
        startActivity(Intent.createChooser(intent, "픽셀곰 진단 공유"));
    }

    private void copyText(String label, String value) {
        ClipboardManager clipboard = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
        if (clipboard != null) {
            clipboard.setPrimaryClip(ClipData.newPlainText(label, value));
            Toast.makeText(this, "복사되었습니다.", Toast.LENGTH_SHORT).show();
        }
    }

    private String diagnosisText() {
        BridgeConfig.RoomProfile profile = BridgeConfig.firstRoomProfile(this);
        return "픽셀곰 브릿지 진단\n"
                + "버전: " + BuildConfig.VERSION_NAME + " (" + BuildConfig.VERSION_CODE + ")\n"
                + "브릿지: " + (BridgeConfig.isEnabled(this) ? "켜짐" : "꺼짐") + "\n"
                + "알림 권한: " + (notificationPermissionEnabled() ? "허용됨" : "필요") + "\n"
                + "서버: " + BridgeConfig.serverUrl(this) + "\n"
                + "대표 방: " + profile.name + "\n"
                + "roomId: " + profile.roomId + "\n"
                + "입장확인: " + profile.joinPhrase + "\n"
                + "라이선스: " + (TextUtils.isEmpty(profile.licenseKey) ? BridgeConfig.deviceLicenseKey(this) : profile.licenseKey) + "\n"
                + "방별 설정: " + BridgeConfig.roomProfileCount(this) + "개\n"
                + "등록 방 목록:\n" + BridgeConfig.roomProfilesSummary(this) + "\n"
                + "기능: " + BridgeConfig.featureSummary(this) + "\n"
                + "화면 감지: 사용 안 함";
    }

    private boolean notificationPermissionEnabled() {
        String listeners = Settings.Secure.getString(getContentResolver(), "enabled_notification_listeners");
        return listeners != null && listeners.toLowerCase().contains(getPackageName().toLowerCase());
    }

    private LinearLayout panel() {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setBackgroundResource(getResources().getIdentifier("panel_background", "drawable", getPackageName()));
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        params.setMargins(0, dp(16), 0, 0);
        layout.setLayoutParams(params);
        return layout;
    }

    private EditText input(String hint, String value) {
        EditText editText = new EditText(this);
        editText.setHint(hint);
        editText.setSingleLine(true);
        editText.setText(value);
        editText.setTextSize(15);
        editText.setSelectAllOnFocus(false);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        params.setMargins(0, dp(10), 0, 0);
        editText.setLayoutParams(params);
        return editText;
    }

    private EditText multiLineInput(String value, int minLines) {
        EditText editText = new EditText(this);
        editText.setText(value);
        editText.setTextSize(13);
        editText.setGravity(Gravity.TOP | Gravity.START);
        editText.setSingleLine(false);
        editText.setMinLines(minLines);
        editText.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_MULTI_LINE | InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS);
        editText.setHorizontallyScrolling(false);
        editText.setBackgroundColor(Color.rgb(255, 252, 246));
        editText.setPadding(dp(10), dp(10), dp(10), dp(10));
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(150));
        params.setMargins(0, dp(10), 0, 0);
        editText.setLayoutParams(params);
        return editText;
    }

    private LinearLayout labelValue(String label, String value) {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        params.setMargins(0, 0, 0, dp(10));
        layout.setLayoutParams(params);

        TextView labelView = text(label, 12, Color.rgb(111, 78, 49), true);
        TextView valueView = text(value, 15, Color.rgb(58, 37, 24), false);
        valueView.setPadding(0, dp(2), 0, 0);
        layout.addView(labelView);
        layout.addView(valueView);
        return layout;
    }

    private LinearLayout statusRow(String label, String value, boolean ok) {
        LinearLayout layout = labelValue(label, value);
        TextView valueView = (TextView) layout.getChildAt(1);
        valueView.setTextColor(ok ? Color.rgb(30, 104, 58) : Color.rgb(184, 74, 43));
        valueView.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
        return layout;
    }

    private LinearLayout stepText(String number, String value) {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.HORIZONTAL);
        layout.setGravity(Gravity.CENTER_VERTICAL);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        params.setMargins(0, dp(10), 0, 0);
        layout.setLayoutParams(params);

        TextView badge = text(number, 13, Color.WHITE, true);
        badge.setGravity(Gravity.CENTER);
        badge.setBackgroundColor(Color.rgb(62, 128, 106));
        layout.addView(badge, new LinearLayout.LayoutParams(dp(28), dp(28)));

        TextView body = text(value, 14, Color.rgb(87, 64, 47), false);
        body.setPadding(dp(10), 0, 0, 0);
        layout.addView(body, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        return layout;
    }

    private Switch settingSwitch(String label, boolean checked) {
        Switch sw = new Switch(this);
        sw.setText(label);
        sw.setTextSize(15);
        sw.setTextColor(Color.rgb(58, 37, 24));
        sw.setChecked(checked);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        params.setMargins(0, dp(8), 0, 0);
        sw.setLayoutParams(params);
        return sw;
    }

    private EditText scriptInput(String value) {
        EditText editText = new EditText(this);
        editText.setText(value);
        editText.setTextSize(13);
        editText.setTypeface(Typeface.MONOSPACE);
        editText.setGravity(Gravity.TOP | Gravity.START);
        editText.setSingleLine(false);
        editText.setMinLines(10);
        editText.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_MULTI_LINE | InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS);
        editText.setHorizontallyScrolling(false);
        editText.setBackgroundColor(Color.rgb(255, 252, 246));
        editText.setPadding(dp(10), dp(10), dp(10), dp(10));
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(240));
        params.setMargins(0, dp(10), 0, 0);
        editText.setLayoutParams(params);
        return editText;
    }

    private TextView text(String value, int sp, int color, boolean bold) {
        TextView textView = new TextView(this);
        textView.setText(value);
        textView.setTextSize(sp);
        textView.setTextColor(color);
        textView.setLineSpacing(dp(2), 1.0f);
        if (bold) textView.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
        return textView;
    }

    private Button primaryButton(String label) {
        Button button = baseButton(label);
        button.setTextColor(Color.WHITE);
        button.setBackgroundResource(getResources().getIdentifier("button_primary", "drawable", getPackageName()));
        return button;
    }

    private Button secondaryButton(String label) {
        Button button = baseButton(label);
        button.setTextColor(Color.rgb(58, 37, 24));
        button.setBackgroundResource(getResources().getIdentifier("button_secondary", "drawable", getPackageName()));
        return button;
    }

    private Button baseButton(String label) {
        Button button = new Button(this);
        button.setText(label);
        button.setTextSize(15);
        button.setAllCaps(false);
        button.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(48));
        params.setMargins(0, dp(10), 0, 0);
        button.setLayoutParams(params);
        return button;
    }

    private void openUrl(String url) {
        startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
    }

    private int dp(int value) {
        return (int) (value * getResources().getDisplayMetrics().density + 0.5f);
    }
}
