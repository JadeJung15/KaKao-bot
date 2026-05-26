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
    private static final String BUYER_CONSOLE_URL = WEBSITE_URL + "/console";
    private static final String BUYER_SETUP_URL = WEBSITE_URL + "/console?from=android&view=setup";

    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private TextView homeDiagnosticsStatus;
    private TextView profileSyncStatus;
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
        if (homeDiagnosticsStatus != null) refreshHomeDiagnostics();
        if (permissionStatus != null) refreshStatus();
        if (logView != null) refreshLogs();
    }

    private void showHome() {
        clearMainRefs();
        setContentView(buildHomeContent());
        refreshHomeDiagnostics();
    }

    private void showMain() {
        setContentView(buildMainContent());
        refreshStatus();
        refreshLogs();
    }

    private void showChecklist() {
        clearMainRefs();
        setContentView(buildChecklistContent());
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
        infoPanel.addView(labelValue("구매자 콘솔", BUYER_CONSOLE_URL));
        infoPanel.addView(labelValue("설치 안내", BUYER_SETUP_URL));
        infoPanel.addView(labelValue("서버 동기화", BridgeConfig.lastProfileSyncSummary(this)));
        homeDiagnosticsStatus = text("서버 진단: 확인 중", 14, Color.rgb(111, 78, 49), true);
        homeDiagnosticsStatus.setPadding(0, dp(12), 0, 0);
        infoPanel.addView(homeDiagnosticsStatus);

        LinearLayout stepsPanel = panel();
        stepsPanel.setPadding(dp(14), dp(14), dp(14), dp(14));
        root.addView(stepsPanel);
        stepsPanel.addView(text("처음 설정 순서", 18, Color.rgb(58, 37, 24), true));
        stepsPanel.addView(stepText("1", "알림 접근 권한을 허용합니다."));
        stepsPanel.addView(stepText("2", "구매자 콘솔의 설치 안내에서 앱 연결코드를 복사해 자동 설정합니다."));
        stepsPanel.addView(stepText("3", "일반방 연결코드 1번으로 연결된 게임방까지 함께 등록되는지 확인합니다."));
        stepsPanel.addView(stepText("4", "서버 테스트 전송 후 각 카카오방에서 /브릿지를 확인합니다."));

        Button startButton = primaryButton("시작하기");
        startButton.setOnClickListener(v -> showMain());
        root.addView(startButton);

        Button checklistButton = secondaryButton("테스트 체크리스트");
        checklistButton.setOnClickListener(v -> showChecklist());
        root.addView(checklistButton);

        Button refreshDiagnosticsButton = secondaryButton("서버 진단 새로고침");
        refreshDiagnosticsButton.setOnClickListener(v -> refreshHomeDiagnostics());
        root.addView(refreshDiagnosticsButton);

        Button permissionButton = secondaryButton("알림 권한 열기");
        permissionButton.setOnClickListener(v -> startActivity(new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)));
        root.addView(permissionButton);

        Button openChatButton = secondaryButton("오픈채팅방 열기");
        openChatButton.setOnClickListener(v -> openUrl(BridgeConfig.roomLink(this)));
        root.addView(openChatButton);

        Button websiteButton = secondaryButton("홈페이지 열기");
        websiteButton.setOnClickListener(v -> openUrl(WEBSITE_URL));
        root.addView(websiteButton);

        Button guideButton = secondaryButton("구매자 콘솔 열기");
        guideButton.setOnClickListener(v -> openUrl(BUYER_CONSOLE_URL));
        root.addView(guideButton);

        Button setupButton = secondaryButton("설치 안내 열기");
        setupButton.setOnClickListener(v -> openUrl(BUYER_SETUP_URL));
        root.addView(setupButton);

        Button syncButton = secondaryButton("서버와 다시 동기화");
        syncButton.setOnClickListener(v -> syncRoomProfiles());
        root.addView(syncButton);

        return scrollView;
    }

    private View buildChecklistContent() {
        ScrollView scrollView = baseScrollView();

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(18), dp(18), dp(18), dp(28));
        scrollView.addView(root);

        Button homeButton = secondaryButton("홈으로");
        homeButton.setOnClickListener(v -> showHome());
        root.addView(homeButton);

        TextView title = text("테스트 체크리스트", 28, Color.rgb(58, 37, 24), true);
        title.setPadding(0, dp(18), 0, dp(4));
        root.addView(title);

        TextView subtitle = text("설치 후 구매자와 운영자가 같은 순서로 확인할 수 있게 정리한 화면입니다.", 15, Color.rgb(87, 64, 47), false);
        root.addView(subtitle);

        LinearLayout statusPanel = panel();
        statusPanel.setPadding(dp(14), dp(14), dp(14), dp(14));
        root.addView(statusPanel);
        BridgeConfig.RoomProfile profile = BridgeConfig.firstRoomProfile(this);
        statusPanel.addView(statusRow("알림 권한", notificationPermissionEnabled() ? "허용됨" : "필요", notificationPermissionEnabled()));
        statusPanel.addView(labelValue("버전", BuildConfig.VERSION_NAME + " (" + BuildConfig.VERSION_CODE + ")"));
        statusPanel.addView(labelValue("서버", BridgeConfig.serverUrl(this)));
        statusPanel.addView(labelValue("대표 방", profile.name));
        statusPanel.addView(labelValue("roomId", profile.roomId));
        statusPanel.addView(labelValue("입장확인 문구", profile.joinPhrase));
        statusPanel.addView(labelValue("라이선스 키", TextUtils.isEmpty(profile.licenseKey) ? BridgeConfig.deviceLicenseKey(this) : profile.licenseKey));
        statusPanel.addView(labelValue("등록 방 목록", BridgeConfig.roomProfilesSummary(this)));

        LinearLayout kakaoPanel = panel();
        kakaoPanel.setPadding(dp(14), dp(14), dp(14), dp(14));
        root.addView(kakaoPanel);
        kakaoPanel.addView(text("카카오방 테스트 순서", 20, Color.rgb(58, 37, 24), true));
        kakaoPanel.addView(stepText("1", "일반방에서 /브릿지, /상태, /js상태를 확인합니다."));
        kakaoPanel.addView(stepText("2", "게임방이 있으면 같은 순서로 /브릿지, /상태, /js상태를 확인합니다."));
        kakaoPanel.addView(stepText("3", "/구독상태 - 5,500원/30일 구독 만료일 확인"));
        kakaoPanel.addView(stepText("4", "/포인트, /출석 - 기본 운영 기능 확인"));
        kakaoPanel.addView(stepText("5", "/게임, /주사위 - 게임 기능과 방별 보상 설정 확인"));

        LinearLayout troublePanel = panel();
        troublePanel.setPadding(dp(14), dp(14), dp(14), dp(14));
        root.addView(troublePanel);
        troublePanel.addView(text("문제 해결", 20, Color.rgb(58, 37, 24), true));
        troublePanel.addView(stepText("1", "응답이 없으면 알림 접근 권한과 카카오톡 알림 표시를 먼저 확인합니다."));
        troublePanel.addView(stepText("2", "방이 다르면 구매자 콘솔의 설치 안내에서 연결코드를 다시 확인하거나 서버와 다시 동기화합니다."));
        troublePanel.addView(stepText("3", "라이선스 오류가 나오면 구매자 콘솔의 라이선스 키와 앱의 키가 같은지 확인합니다."));
        troublePanel.addView(stepText("4", "입장 확인은 방장봇 환영 문구가 입장확인 문구와 일치해야 합니다."));
        troublePanel.addView(stepText("5", "이 앱은 화면 감지/접근성 권한을 사용하지 않습니다. 화면을 켜두는 방식으로 운영하지 않습니다."));

        Button copyButton = primaryButton("체크리스트 복사");
        copyButton.setOnClickListener(v -> copyText("픽셀곰 테스트 체크리스트", checklistText()));
        root.addView(copyButton);

        Button guideButton = secondaryButton("구매자 콘솔 열기");
        guideButton.setOnClickListener(v -> openUrl(BUYER_CONSOLE_URL));
        root.addView(guideButton);

        Button setupButton = secondaryButton("설치 안내 열기");
        setupButton.setOnClickListener(v -> openUrl(BUYER_SETUP_URL));
        root.addView(setupButton);

        Button syncButton = secondaryButton("서버와 다시 동기화");
        syncButton.setOnClickListener(v -> syncRoomProfiles());
        root.addView(syncButton);

        Button settingButton = secondaryButton("설정 화면으로 이동");
        settingButton.setOnClickListener(v -> showMain());
        root.addView(settingButton);

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

        TextView connectHelp = text("구매자 콘솔 설치 안내에서 복사한 앱 연결코드를 붙여넣으면 방 이름, roomId, 링크, 관리자, 라이선스가 자동 추가됩니다. Android 1.0.24 이상은 서버와 다시 동기화로 저장된 방의 최신 설정도 확인합니다.", 13, Color.rgb(111, 78, 49), false);
        connectHelp.setPadding(0, dp(8), 0, 0);
        panel.addView(connectHelp);

        connectionCodeInput = input("앱 연결코드", "");
        panel.addView(connectionCodeInput);

        Button connectButton = secondaryButton("연결코드로 방 추가/갱신");
        connectButton.setOnClickListener(v -> connectWithCode());
        panel.addView(connectButton);

        profileSyncStatus = text("서버 동기화: " + safeText(BridgeConfig.lastProfileSyncSummary(this)), 13, Color.rgb(111, 78, 49), false);
        profileSyncStatus.setPadding(0, dp(8), 0, 0);
        panel.addView(profileSyncStatus);

        Button profileSyncButton = secondaryButton("서버와 다시 동기화");
        profileSyncButton.setOnClickListener(v -> syncRoomProfiles());
        panel.addView(profileSyncButton);

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

        TextView roomHelp = text("대표 방 설정은 목록 첫 번째 방을 직접 수정할 때만 사용하세요. 여러 방은 구매자 콘솔의 설치 안내에서 연결코드를 확인하거나 서버와 다시 동기화하면 됩니다.", 13, Color.rgb(111, 78, 49), false);
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

        Button checklistButton = secondaryButton("테스트 체크리스트");
        checklistButton.setOnClickListener(v -> showChecklist());
        panel.addView(checklistButton);

        Button diagnosisButton = secondaryButton("진단 내용 복사");
        diagnosisButton.setOnClickListener(v -> copyDiagnosis());
        panel.addView(diagnosisButton);

        Button privacyButton = secondaryButton("개인정보처리방침 열기");
        privacyButton.setOnClickListener(v -> openUrl(WEBSITE_URL + "/privacy"));
        panel.addView(privacyButton);

        Button guideButton = secondaryButton("구매자 콘솔 열기");
        guideButton.setOnClickListener(v -> openUrl(BUYER_CONSOLE_URL));
        panel.addView(guideButton);

        Button setupButton = secondaryButton("설치 안내 열기");
        setupButton.setOnClickListener(v -> openUrl(BUYER_SETUP_URL));
        panel.addView(setupButton);

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

        Button shareLogButton = secondaryButton("로그 공유");
        shareLogButton.setOnClickListener(v -> shareLogs());
        root.addView(shareLogButton);

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
        homeDiagnosticsStatus = null;
        profileSyncStatus = null;
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
                    int generalRooms = 0;
                    int gameRooms = 0;
                    for (EventSender.RoomConnectResult room : result.roomResults) {
                        BridgeConfig.addOrUpdateRoomProfile(this, room.roomName, room.roomId, room.roomLink, room.joinPhrase, TextUtils.join(",", room.admins), room.licenseKey, room.roomRole, room.canonicalRoomName);
                        if ("game".equals(room.roomRole)) {
                            gameRooms++;
                        } else {
                            generalRooms++;
                        }
                    }
                    BridgeConfig.setLastConnectSummary(this, "서버 응답 " + result.roomResults.size() + "개 / 저장 " + BridgeConfig.roomProfileCount(this) + "개 / 일반방 " + generalRooms + "개 / 게임방 " + gameRooms + "개");
                    BridgeConfig.setLastProfileSyncSummary(this, "연결코드 응답 " + result.roomResults.size() + "개 / 앱 저장 " + BridgeConfig.roomProfileCount(this) + "개");
                    BridgeConfig.setAttendanceEnabled(this, result.attendance);
                    BridgeConfig.setPointsEnabled(this, result.points);
                    BridgeConfig.setRankingsEnabled(this, result.rankings);
                    BridgeConfig.setHistoryEnabled(this, result.history);
                    BridgeConfig.setProfilesEnabled(this, result.profiles);
                    BridgeConfig.setScriptEnabled(this, result.localJs);
                    BridgeConfig.setGamesEnabled(this, result.games);
                    BridgeConfig.appendLog(this, "앱 자동 연결 완료: " + result.roomName + " / " + result.roomId + " / 연결코드 응답 " + result.roomResults.size() + "개 / 등록방 " + BridgeConfig.roomProfileCount(this) + "개 / 연결된 게임방까지 자동 등록");
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
                    refreshProfileSyncStatus();
                    Toast.makeText(this, "방 설정이 추가/갱신되었습니다.", Toast.LENGTH_SHORT).show();
                } else {
                    BridgeConfig.appendLog(this, "앱 자동 연결 실패: " + result.error);
                    Toast.makeText(this, "연결코드를 확인하세요.", Toast.LENGTH_SHORT).show();
                }
                refreshLogs();
            });
        });
    }

    private void syncRoomProfiles() {
        BridgeConfig.appendLog(this, "서버 방 프로필 동기화 시작");
        refreshLogs();
        executor.execute(() -> {
            EventSender.ProfileSyncResult result = EventSender.roomProfileSync(this);
            runOnUiThread(() -> {
                if (result.ok()) {
                    int generalRooms = 0;
                    int gameRooms = 0;
                    for (EventSender.RoomConnectResult room : result.roomResults) {
                        BridgeConfig.addOrUpdateRoomProfile(this, room.roomName, room.roomId, room.roomLink, room.joinPhrase, TextUtils.join(",", room.admins), room.licenseKey, room.roomRole, room.canonicalRoomName);
                        if ("game".equals(room.roomRole)) gameRooms++;
                        else generalRooms++;
                    }
                    String summary = "요청 " + result.requestedRoomCount
                            + "개 / 서버 응답 " + result.syncedRoomCount
                            + "개 / 앱 저장 " + BridgeConfig.roomProfileCount(this)
                            + "개 / 일반방 " + generalRooms + "개 / 게임방 " + gameRooms + "개";
                    BridgeConfig.setLastProfileSyncSummary(this, summary);
                    BridgeConfig.appendLog(this, "서버 방 프로필 동기화 완료: " + summary);
                    refreshStatus();
                    refreshRoomProfilesSummary();
                    refreshProfileSyncStatus();
                    Toast.makeText(this, "서버와 다시 동기화했습니다.", Toast.LENGTH_SHORT).show();
                } else {
                    String summary = "실패: " + result.error;
                    BridgeConfig.setLastProfileSyncSummary(this, summary);
                    BridgeConfig.appendLog(this, "서버 방 프로필 동기화 실패: " + result.error);
                    refreshProfileSyncStatus();
                    Toast.makeText(this, "동기화 실패: 등록 방과 라이선스를 확인하세요.", Toast.LENGTH_SHORT).show();
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
        if (permissionStatus == null) return;
        boolean permission = notificationPermissionEnabled();
        String permissionHelp = permission ? "" : "\n안내: 설정에서 픽셀곰 브릿지를 허용하고, 카카오톡 방 알림을 켜야 대화를 감지합니다.";
        permissionStatus.setText((permission ? "알림 접근 권한: 허용됨" : "알림 접근 권한: 필요")
                + permissionHelp
                + "\n브릿지: " + (BridgeConfig.isEnabled(this) ? "켜짐" : "꺼짐")
                + "\n등록 방: " + BridgeConfig.roomName(this)
                + "\n등록 방 수: " + BridgeConfig.roomProfileCount(this) + "개"
                + "\n사용 기능: " + BridgeConfig.featureSummary(this));
        permissionStatus.setTextColor(permission ? Color.rgb(30, 104, 58) : Color.rgb(184, 74, 43));
    }

    private void refreshHomeDiagnostics() {
        if (homeDiagnosticsStatus == null) return;
        boolean permission = notificationPermissionEnabled();
        BridgeConfig.RoomProfile profile = BridgeConfig.firstRoomProfile(this);
        homeDiagnosticsStatus.setText("서버 진단: 확인 중\n"
                + "알림 권한: " + (permission ? "허용됨" : "필요") + "\n"
                + "대표 방: " + profile.name + " / " + profile.roomId + "\n"
                + "앱 버전: " + BuildConfig.VERSION_NAME + " (" + BuildConfig.VERSION_CODE + ")");
        homeDiagnosticsStatus.setTextColor(permission ? Color.rgb(30, 104, 58) : Color.rgb(184, 74, 43));

        executor.execute(() -> {
            EventSender.HealthResult result = EventSender.health(this);
            runOnUiThread(() -> {
                if (homeDiagnosticsStatus == null) return;
                if (result.ok()) {
                    String updateText = result.appUpdateRequired
                            ? "\n앱 업데이트: 필요 - Play 비공개 테스트 최신 빌드로 업데이트하세요."
                            : "\n앱 업데이트: 사용 가능 - 서버 최소 버전을 충족합니다.";
                    homeDiagnosticsStatus.setText("서버 진단: 정상\n"
                            + "서버 버전: " + result.serverVersion + "\n"
                            + "서버 시간: " + safeText(result.serverTime) + "\n"
                            + "저장소: " + safeText(result.storageLabel) + (result.dbOk ? " 정상" : " 확인 필요") + "\n"
                            + "내 앱: " + BuildConfig.VERSION_NAME + " (" + BuildConfig.VERSION_CODE + ")\n"
                            + "서버 기준 최신: " + safeText(result.latestAndroidVersion) + " (" + result.latestAndroidVersionCode + ")\n"
                            + "서버 기준 최소: " + safeText(result.minAndroidVersion) + " (" + result.minAndroidVersionCode + ")"
                            + updateText);
                    homeDiagnosticsStatus.setTextColor(result.appUpdateRequired || !result.dbOk ? Color.rgb(184, 111, 28) : Color.rgb(30, 104, 58));
                } else {
                    homeDiagnosticsStatus.setText("서버 진단: 연결 실패\n"
                            + "원인: " + safeText(result.error) + "\n"
                            + "확인: 인터넷 연결, 서버 URL, VPN/보안앱 차단 여부를 확인하세요.");
                    homeDiagnosticsStatus.setTextColor(Color.rgb(184, 74, 43));
                }
            });
        });
    }

    private void refreshLogs() {
        if (logView == null) return;
        String logs = BridgeConfig.logs(this);
        logView.setText(TextUtils.isEmpty(logs) ? "아직 전송 로그가 없습니다." : logs);
    }

    private void refreshRoomProfilesSummary() {
        if (roomProfilesSummaryView != null) {
            roomProfilesSummaryView.setText("등록 방 목록\n" + BridgeConfig.roomProfilesSummary(this));
        }
    }

    private void refreshProfileSyncStatus() {
        if (profileSyncStatus != null) {
            profileSyncStatus.setText("서버 동기화: " + safeText(BridgeConfig.lastProfileSyncSummary(this)));
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

    private void shareLogs() {
        String logs = BridgeConfig.logs(this);
        Intent intent = new Intent(Intent.ACTION_SEND);
        intent.setType("text/plain");
        intent.putExtra(Intent.EXTRA_TEXT, TextUtils.isEmpty(logs) ? "아직 전송 로그가 없습니다." : logs);
        startActivity(Intent.createChooser(intent, "픽셀곰 로그 공유"));
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
                + "라이선스: " + maskLicense(TextUtils.isEmpty(profile.licenseKey) ? BridgeConfig.deviceLicenseKey(this) : profile.licenseKey) + "\n"
                + "방별 설정: " + BridgeConfig.roomProfileCount(this) + "개\n"
                + "등록 방 목록:\n" + BridgeConfig.roomProfilesSummary(this) + "\n"
                + "기능: " + BridgeConfig.featureSummary(this) + "\n"
                + "화면 감지: 사용 안 함";
    }

    private String checklistText() {
        BridgeConfig.RoomProfile profile = BridgeConfig.firstRoomProfile(this);
        return "픽셀곰 브릿지 테스트 체크리스트\n"
                + "버전: " + BuildConfig.VERSION_NAME + " (" + BuildConfig.VERSION_CODE + ")\n"
                + "알림 권한: " + (notificationPermissionEnabled() ? "허용됨" : "필요") + "\n"
                + "서버: " + BridgeConfig.serverUrl(this) + "\n"
                + "대표 방: " + profile.name + "\n"
                + "roomId: " + profile.roomId + "\n"
                + "입장확인 문구: " + profile.joinPhrase + "\n"
                + "라이선스: " + maskLicense(TextUtils.isEmpty(profile.licenseKey) ? BridgeConfig.deviceLicenseKey(this) : profile.licenseKey) + "\n"
                + "등록 방 목록:\n" + BridgeConfig.roomProfilesSummary(this) + "\n\n"
                + "카카오방 테스트 순서\n"
                + "1. 일반방 /브릿지, /상태, /js상태\n"
                + "2. 게임방 /브릿지, /상태, /js상태\n"
                + "3. /구독상태\n"
                + "4. /포인트, /출석\n"
                + "5. /게임, /주사위\n\n"
                + "문제 해결\n"
                + "- 응답 없음: 알림 접근 권한, 카카오톡 알림 표시, 서버 URL 확인\n"
                + "- 방 불일치: 구매자 콘솔 설치 안내의 연결코드 재적용 또는 서버와 다시 동기화\n"
                + "- 라이선스 오류: 구매자 콘솔과 앱의 라이선스 키 일치 확인\n"
                + "- 입장 감지: 방장봇 환영 문구와 입장확인 문구 일치 확인\n"
                + "- 화면 감지: 사용 안 함";
    }

    private String safeText(String value) {
        return TextUtils.isEmpty(value) ? "-" : value;
    }

    private String maskLicense(String value) {
        if (TextUtils.isEmpty(value)) return "-";
        if (value.length() <= 10) return value.charAt(0) + "***";
        return value.substring(0, 7) + "..." + value.substring(value.length() - 4);
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
