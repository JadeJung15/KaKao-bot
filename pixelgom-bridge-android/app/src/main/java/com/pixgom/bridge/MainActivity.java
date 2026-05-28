package com.pixgom.bridge;

import android.app.Activity;
import android.app.AlertDialog;
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
import android.widget.ImageButton;
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
    private static final String BUYER_CONNECT_CODE_URL = BUYER_SETUP_URL + "#app-connect-code";
    private static final int COLOR_BG = Color.rgb(255, 248, 239);
    private static final int COLOR_TITLE = Color.rgb(43, 33, 24);
    private static final int COLOR_TEXT = Color.rgb(67, 51, 39);
    private static final int COLOR_MUTED = Color.rgb(126, 104, 82);
    private static final int COLOR_BLUE = Color.rgb(47, 125, 89);
    private static final int COLOR_GOLD = Color.rgb(244, 176, 45);
    private static final int COLOR_GOOD = Color.rgb(22, 163, 74);
    private static final int COLOR_WARN = Color.rgb(217, 119, 6);
    private static final int COLOR_BAD = Color.rgb(220, 38, 38);

    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private TextView homeDiagnosticsStatus;
    private TextView profileSyncStatus;
    private TextView pendingQueueStatus;
    private TextView permissionStatus;
    private TextView logView;
    private ScrollView mainScrollView;
    private View logSectionView;
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
    private TextView gameRoomProfilesView;
    private Button gameRoomToggleButton;
    private boolean gameRoomListExpanded = false;
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
        if (pendingQueueStatus != null) refreshPendingQueueStatus();
    }

    private void showHome() {
        clearMainRefs();
        setContentView(buildHomeContent());
        refreshHomeDiagnostics();
    }

    private void showMain() {
        showSettings();
    }

    private void showSettings() {
        clearMainRefs();
        setContentView(buildSettingsContent());
        refreshStatus();
        refreshPendingQueueStatus();
    }

    private void showMainLogs() {
        showLogs();
    }

    private void showLogs() {
        clearMainRefs();
        setContentView(buildLogsContent());
        refreshLogs();
    }

    private void showAdvanced() {
        clearMainRefs();
        setContentView(buildAdvancedContent());
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
        root.setPadding(dp(20), dp(18), dp(20), dp(28));
        scrollView.addView(root);

        root.addView(topBar("픽셀곰 브릿지", "카카오 응답 상태", false));

        BridgeConfig.RoomProfile profile = BridgeConfig.firstRoomProfile(this);
        root.addView(heroPanel(
                R.drawable.pixgom_bridge_captain,
                "PIXGOM BRIDGE",
                "카카오 응답 상태를 한눈에",
                "연결, 권한, 로그를 빠르게 점검하는 브릿지 앱입니다."));

        TextView version = text("버전 " + BuildConfig.VERSION_NAME + " (" + BuildConfig.VERSION_CODE + ")", 13, COLOR_BLUE, true);
        version.setGravity(Gravity.CENTER);
        version.setPadding(0, dp(10), 0, 0);
        root.addView(version);

        LinearLayout statusPanel = panel();
        statusPanel.setPadding(dp(16), dp(16), dp(16), dp(16));
        root.addView(statusPanel);
        statusPanel.addView(sectionTitle("지금 상태"));
        statusPanel.addView(statusTile("알림 권한", notificationPermissionEnabled() ? "허용됨" : "필요", notificationPermissionEnabled()));
        statusPanel.addView(statusTile("브릿지", BridgeConfig.isEnabled(this) ? "켜짐" : "꺼짐", BridgeConfig.isEnabled(this)));
        statusPanel.addView(statusTile("등록 방", BridgeConfig.roomProfileCount(this) + "개", BridgeConfig.roomProfileCount(this) > 0));
        statusPanel.addView(statusTile("대기 큐", BridgeConfig.pendingEventCount(this) + "개", BridgeConfig.pendingEventCount(this) == 0));
        statusPanel.addView(statusTile("대표방", TextUtils.isEmpty(profile.name) ? "등록 필요" : profile.name, !TextUtils.isEmpty(profile.name)));
        homeDiagnosticsStatus = text("서버 진단: 확인 중", 14, COLOR_MUTED, true);
        homeDiagnosticsStatus.setPadding(0, dp(12), 0, 0);
        statusPanel.addView(homeDiagnosticsStatus);

        Button startButton = primaryButton("연결 상태 점검");
        startButton.setOnClickListener(v -> showMain());
        root.addView(startButton);

        Button syncButton = secondaryButton("서버와 동기화");
        syncButton.setOnClickListener(v -> syncRoomProfiles());

        Button setupButton = secondaryButton("연결코드 입력");
        setupButton.setOnClickListener(v -> showMain());

        Button logButton = secondaryButton("로그 보기");
        logButton.setOnClickListener(v -> showMainLogs());

        Button checklistButton = secondaryButton("체크리스트");
        checklistButton.setOnClickListener(v -> showChecklist());

        root.addView(quickActionGrid(
                quickAction(R.drawable.ic_sync, "동기화", "서버", v -> syncRoomProfiles()),
                quickAction(R.drawable.ic_link, "연결코드", "방 추가", v -> showMain()),
                quickAction(R.drawable.ic_log, "로그", "확인", v -> showLogs()),
                quickAction(R.drawable.ic_checklist, "체크", "테스트", v -> showChecklist())
        ));

        root.addView(featurePanel(
                R.drawable.pixgom_chat_portal,
                "앱 연결",
                "연결코드로 방과 라이선스를 동기화합니다."));
        root.addView(featurePanel(
                R.drawable.pixgom_dashboard_monitor,
                "최근 진단",
                "서버 timing: " + shortStatus(BridgeConfig.lastServerTimingSummary(this))
                        + "\n동기화: " + shortStatus(BridgeConfig.lastProfileSyncSummary(this))));

        LinearLayout stepsPanel = panel();
        stepsPanel.setPadding(dp(16), dp(16), dp(16), dp(16));
        root.addView(stepsPanel);
        stepsPanel.addView(sectionTitle("오늘 확인"));
        stepsPanel.addView(stepText("1", "알림 권한과 브릿지 ON 상태 확인"));
        stepsPanel.addView(stepText("2", "서버와 동기화 후 카카오방에서 /브릿지 테스트"));
        stepsPanel.addView(stepText("3", "응답 지연 시 로그의 timing만 확인"));

        return scrollView;
    }

    private View buildChecklistContent() {
        ScrollView scrollView = baseScrollView();

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(20), dp(18), dp(20), dp(28));
        scrollView.addView(root);

        root.addView(topBar("체크리스트", "테스트 순서", true));

        root.addView(heroPanel(
                R.drawable.pixgom_checklist_calendar,
                "TEST CHECKLIST",
                "설치 후 같은 순서로 확인",
                "권한, 연결, 카카오방 응답을 짧게 점검합니다."));

        LinearLayout statusPanel = panel();
        statusPanel.setPadding(dp(16), dp(16), dp(16), dp(16));
        root.addView(statusPanel);
        BridgeConfig.RoomProfile profile = BridgeConfig.firstRoomProfile(this);
        statusPanel.addView(sectionTitle("기기 상태"));
        statusPanel.addView(statusRow("알림 권한", notificationPermissionEnabled() ? "허용됨" : "필요", notificationPermissionEnabled()));
        statusPanel.addView(labelValue("버전", BuildConfig.VERSION_NAME + " (" + BuildConfig.VERSION_CODE + ")"));
        statusPanel.addView(labelValue("서버", BridgeConfig.serverUrl(this)));
        statusPanel.addView(labelValue("대표방(일반방)", profile.name));
        statusPanel.addView(labelValue("roomId", profile.roomId));
        statusPanel.addView(labelValue("입장확인 문구", profile.joinPhrase));
        statusPanel.addView(labelValue("라이선스 키", TextUtils.isEmpty(profile.licenseKey) ? BridgeConfig.deviceLicenseKey(this) : profile.licenseKey));
        statusPanel.addView(labelValue("등록 방 목록", BridgeConfig.roomProfilesSummary(this)));

        LinearLayout kakaoPanel = panel();
        kakaoPanel.setPadding(dp(16), dp(16), dp(16), dp(16));
        root.addView(kakaoPanel);
        kakaoPanel.addView(sectionTitle("카카오방 테스트"));
        kakaoPanel.addView(stepText("1", "일반방: /브릿지, /상태, /js상태"));
        kakaoPanel.addView(stepText("2", "게임방: /브릿지, /상태, /js상태"));
        kakaoPanel.addView(stepText("3", "구독: /구독상태"));
        kakaoPanel.addView(stepText("4", "운영: /포인트, /출석"));
        kakaoPanel.addView(stepText("5", "게임: /게임, /주사위"));

        LinearLayout troublePanel = panel();
        troublePanel.setPadding(dp(16), dp(16), dp(16), dp(16));
        root.addView(troublePanel);
        troublePanel.addView(sectionHeader(R.drawable.pixgom_support_bear, "문제 해결", "응답이 없을 때 먼저 볼 항목입니다."));
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

    private View buildSettingsContent() {
        ScrollView scrollView = baseScrollView();
        mainScrollView = scrollView;

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(20), dp(18), dp(20), dp(28));
        scrollView.addView(root);

        root.addView(topBar("연결/방 설정", "방 연결과 기능 토글", true));

        root.addView(heroPanel(
                R.drawable.pixgom_dashboard_monitor,
                "SETUP",
                "연결 정보만 빠르게 정리",
                "방 설정과 서버 연결을 한 화면에서 저장합니다."));

        permissionStatus = text("", 14, COLOR_TEXT, false);
        permissionStatus.setPadding(0, dp(14), 0, dp(8));
        root.addView(permissionStatus);

        Button permissionButton = primaryButton("알림 접근 권한 열기");
        permissionButton.setOnClickListener(v -> startActivity(new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)));
        root.addView(permissionButton);

        LinearLayout connectPanel = panel();
        connectPanel.setPadding(dp(16), dp(16), dp(16), dp(16));
        root.addView(connectPanel);
        connectPanel.addView(sectionHeader(R.drawable.pixgom_chat_portal, "연결", "브릿지, 서버 URL, 연결코드"));

        enabledSwitch = new Switch(this);
        enabledSwitch.setText("브릿지 사용");
        enabledSwitch.setTextSize(16);
        enabledSwitch.setTextColor(COLOR_TEXT);
        enabledSwitch.setChecked(BridgeConfig.isEnabled(this));
        enabledSwitch.setOnCheckedChangeListener((button, checked) -> BridgeConfig.setEnabled(this, checked));
        connectPanel.addView(enabledSwitch);

        serverUrlInput = input("서버 URL", BridgeConfig.serverUrl(this));
        connectPanel.addView(serverUrlInput);

        connectionCodeInput = input("앱 연결코드", "");
        connectPanel.addView(connectionCodeInput);

        Button findConnectCodeButton = secondaryButton("연결코드 찾기/복사");
        findConnectCodeButton.setOnClickListener(v -> openUrl(BUYER_CONNECT_CODE_URL));
        connectPanel.addView(findConnectCodeButton);

        Button connectButton = primaryButton("연결코드로 방 추가/갱신");
        connectButton.setOnClickListener(v -> connectWithCode());
        connectPanel.addView(connectButton);

        LinearLayout diagPanel = panel();
        diagPanel.setPadding(dp(16), dp(16), dp(16), dp(16));
        root.addView(diagPanel);
        diagPanel.addView(sectionHeader(R.drawable.pixgom_dashboard_monitor, "진단", "동기화, 대기 큐, 서버 timing"));

        profileSyncStatus = text("서버 동기화: " + safeText(BridgeConfig.lastProfileSyncSummary(this)), 13, COLOR_MUTED, false);
        profileSyncStatus.setPadding(0, dp(8), 0, 0);
        diagPanel.addView(profileSyncStatus);

        Button profileSyncButton = secondaryButton("서버와 다시 동기화");
        profileSyncButton.setOnClickListener(v -> syncRoomProfiles());
        diagPanel.addView(profileSyncButton);

        pendingQueueStatus = text("전송 대기 상태 확인 중", 13, COLOR_MUTED, false);
        pendingQueueStatus.setPadding(0, dp(8), 0, 0);
        diagPanel.addView(pendingQueueStatus);

        Button retryPendingButton = secondaryButton("전송 대기 재시도");
        retryPendingButton.setOnClickListener(v -> retryPendingEvents());
        diagPanel.addView(retryPendingButton);

        Button clearPendingButton = secondaryButton("대기 큐 비우기");
        clearPendingButton.setOnClickListener(v -> confirmClearPendingEvents());
        diagPanel.addView(clearPendingButton);

        LinearLayout roomPanel = panel();
        roomPanel.setPadding(dp(16), dp(16), dp(16), dp(16));
        root.addView(roomPanel);
        roomPanel.addView(sectionHeader(R.drawable.pixgom_bridge_captain, "방 설정", "대표방과 게임방"));

        roomProfilesSummaryView = text("일반방 목록\n" + BridgeConfig.generalRoomProfilesSummary(this), 13, COLOR_MUTED, false);
        roomProfilesSummaryView.setPadding(0, dp(8), 0, 0);
        roomPanel.addView(roomProfilesSummaryView);

        gameRoomToggleButton = secondaryButton("게임방 목록 펼치기 (" + BridgeConfig.gameRoomProfileCount(this) + "개)");
        gameRoomToggleButton.setOnClickListener(v -> toggleGameRoomList());
        roomPanel.addView(gameRoomToggleButton);

        gameRoomProfilesView = text(BridgeConfig.gameRoomProfilesSummary(this), 13, COLOR_MUTED, false);
        gameRoomProfilesView.setPadding(0, dp(8), 0, dp(4));
        gameRoomProfilesView.setVisibility(View.GONE);
        roomPanel.addView(gameRoomProfilesView);
        refreshRoomProfilesSummary();

        BridgeConfig.RoomProfile profile = BridgeConfig.firstRoomProfile(this);
        roomNameInput = input("카카오 방 이름", profile.name);
        roomPanel.addView(roomNameInput);

        roomIdInput = input("오픈채팅 roomId", profile.roomId);
        roomPanel.addView(roomIdInput);

        roomLinkInput = input("오픈채팅 링크", profile.roomLink);
        roomPanel.addView(roomLinkInput);

        joinPhraseInput = input("입장확인 문구", profile.joinPhrase);
        roomPanel.addView(joinPhraseInput);

        adminsInput = input("관리자 닉네임(쉼표로 구분)", TextUtils.join(",", profile.admins));
        roomPanel.addView(adminsInput);

        licenseKeyInput = input("라이선스 키", TextUtils.isEmpty(profile.licenseKey) ? BridgeConfig.deviceLicenseKey(this) : profile.licenseKey);
        roomPanel.addView(licenseKeyInput);

        TextView roomHelp = text("게임방은 펼치기 목록과 서버 동기화로 확인합니다.", 13, COLOR_MUTED, false);
        roomHelp.setPadding(0, dp(10), 0, 0);
        roomPanel.addView(roomHelp);

        attendanceFeatureSwitch = settingSwitch("출석 보상", BridgeConfig.attendanceEnabled(this));
        roomPanel.addView(attendanceFeatureSwitch);
        pointsFeatureSwitch = settingSwitch("포인트 기능", BridgeConfig.pointsEnabled(this));
        roomPanel.addView(pointsFeatureSwitch);
        rankingsFeatureSwitch = settingSwitch("랭킹 기능", BridgeConfig.rankingsEnabled(this));
        roomPanel.addView(rankingsFeatureSwitch);
        historyFeatureSwitch = settingSwitch("히스토리 기능", BridgeConfig.historyEnabled(this));
        roomPanel.addView(historyFeatureSwitch);
        profilesFeatureSwitch = settingSwitch("프로필 기능", BridgeConfig.profilesEnabled(this));
        roomPanel.addView(profilesFeatureSwitch);
        gamesFeatureSwitch = settingSwitch("게임 기능", BridgeConfig.gamesEnabled(this));
        roomPanel.addView(gamesFeatureSwitch);

        Button saveButton = primaryButton("설정 저장");
        saveButton.setOnClickListener(v -> saveSettings());
        roomPanel.addView(saveButton);

        Button testButton = secondaryButton("서버 테스트 전송");
        testButton.setOnClickListener(v -> sendTestEvent());
        roomPanel.addView(testButton);

        Button checklistButton = secondaryButton("테스트 체크리스트");
        checklistButton.setOnClickListener(v -> showChecklist());
        roomPanel.addView(checklistButton);

        Button diagnosisButton = secondaryButton("진단 내용 복사");
        diagnosisButton.setOnClickListener(v -> copyDiagnosis());
        roomPanel.addView(diagnosisButton);

        return scrollView;
    }

    private View buildLogsContent() {
        ScrollView scrollView = baseScrollView();
        mainScrollView = scrollView;

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(20), dp(18), dp(20), dp(28));
        scrollView.addView(root);

        root.addView(topBar("전송 로그", "성공/실패/무시 기록", true));

        LinearLayout actionPanel = panel();
        actionPanel.setPadding(dp(14), dp(14), dp(14), dp(14));
        root.addView(actionPanel);
        actionPanel.addView(sectionHeader(R.drawable.pixgom_speech_bubble, "로그 작업", "버튼은 항상 로그 위에 표시됩니다."));
        actionPanel.addView(quickActionGrid(
                quickAction(R.drawable.ic_sync, "새로고침", "갱신", v -> refreshLogs()),
                quickAction(R.drawable.ic_copy, "복사", "로그", v -> copyLogs()),
                quickAction(R.drawable.ic_share, "공유", "로그", v -> shareLogs()),
                quickAction(R.drawable.ic_delete, "삭제", "비우기", v -> {
                    BridgeConfig.clearLogs(this);
                    refreshLogs();
                })
        ));

        TextView logHelp = text("정상 응답과 재시도 필요 항목을 먼저 확인하세요. 성공/응답 로그, 실패/재시도 필요 로그, 무시된 알림 로그, 진단 원문 로그를 짧게 표시합니다.", 13, COLOR_MUTED, false);
        logHelp.setPadding(0, dp(10), 0, dp(10));
        actionPanel.addView(logHelp);

        logView = text("", 13, COLOR_TEXT, false);
        logView.setBackgroundResource(getResources().getIdentifier("log_background", "drawable", getPackageName()));
        logView.setPadding(dp(14), dp(14), dp(14), dp(14));
        root.addView(logView, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));
        return scrollView;
    }

    private View buildAdvancedContent() {
        ScrollView scrollView = baseScrollView();

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(20), dp(18), dp(20), dp(28));
        scrollView.addView(root);

        root.addView(topBar("고급 설정", "자주 쓰지 않는 기능", true));

        LinearLayout supportPanel = panel();
        supportPanel.setPadding(dp(16), dp(16), dp(16), dp(16));
        root.addView(supportPanel);
        supportPanel.addView(sectionHeader(R.drawable.pixgom_support_bear, "지원", "도움말과 외부 링크"));

        Button privacyButton = secondaryButton("개인정보처리방침 열기");
        privacyButton.setOnClickListener(v -> openUrl(WEBSITE_URL + "/privacy"));
        supportPanel.addView(privacyButton);

        Button guideButton = secondaryButton("구매자 콘솔 열기");
        guideButton.setOnClickListener(v -> openUrl(BUYER_CONSOLE_URL));
        supportPanel.addView(guideButton);

        Button setupButton = secondaryButton("설치 안내 열기");
        setupButton.setOnClickListener(v -> openUrl(BUYER_SETUP_URL));
        supportPanel.addView(setupButton);

        Button diagnosisShareButton = secondaryButton("진단 공유");
        diagnosisShareButton.setOnClickListener(v -> shareDiagnosis());
        supportPanel.addView(diagnosisShareButton);

        LinearLayout scriptPanel = panel();
        scriptPanel.setPadding(dp(16), dp(16), dp(16), dp(16));
        root.addView(scriptPanel);
        scriptPanel.addView(sectionHeader(R.drawable.pixgom_speech_bubble, "로컬 JS 자동응답", "기기 안에서 테스트하는 보조 스크립트"));

        scriptEnabledSwitch = new Switch(this);
        scriptEnabledSwitch.setText("JS 자동응답 사용");
        scriptEnabledSwitch.setTextSize(16);
        scriptEnabledSwitch.setTextColor(COLOR_TEXT);
        scriptEnabledSwitch.setChecked(BridgeConfig.scriptEnabled(this));
        scriptEnabledSwitch.setOnCheckedChangeListener((button, checked) -> BridgeConfig.setScriptEnabled(this, checked));
        scriptPanel.addView(scriptEnabledSwitch);

        scriptSourceInput = scriptInput(BridgeConfig.scriptSource(this));
        scriptPanel.addView(scriptSourceInput);

        Button scriptSaveButton = primaryButton("JS 저장");
        scriptSaveButton.setOnClickListener(v -> saveScriptSettings());
        scriptPanel.addView(scriptSaveButton);

        Button scriptTestButton = secondaryButton("JS 테스트");
        scriptTestButton.setOnClickListener(v -> testScript());
        scriptPanel.addView(scriptTestButton);

        Button scriptResetButton = secondaryButton("기본 예제 넣기");
        scriptResetButton.setOnClickListener(v -> scriptSourceInput.setText(BridgeConfig.defaultScriptSource()));
        scriptPanel.addView(scriptResetButton);

        LinearLayout resetPanel = panel();
        resetPanel.setPadding(dp(16), dp(16), dp(16), dp(16));
        root.addView(resetPanel);
        resetPanel.addView(sectionHeader(R.drawable.pixgom_support_bear, "초기화", "기기 저장값만 지웁니다."));
        TextView resetHelp = text("구매자 계정과 서버 결제/신청 데이터는 삭제되지 않습니다.", 13, COLOR_MUTED, false);
        resetPanel.addView(resetHelp);

        Button resetButton = secondaryButton("서버 설정 초기화 / 등록 취소");
        resetButton.setOnClickListener(v -> confirmResetServerSettings());
        resetPanel.addView(resetButton);
        return scrollView;
    }

    private ScrollView baseScrollView() {
        ScrollView scrollView = new ScrollView(this);
        scrollView.setFillViewport(true);
        scrollView.setBackgroundColor(COLOR_BG);
        return scrollView;
    }

    private void clearMainRefs() {
        homeDiagnosticsStatus = null;
        profileSyncStatus = null;
        pendingQueueStatus = null;
        permissionStatus = null;
        logView = null;
        mainScrollView = null;
        logSectionView = null;
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
        gameRoomProfilesView = null;
        gameRoomToggleButton = null;
        enabledSwitch = null;
        scriptEnabledSwitch = null;
        attendanceFeatureSwitch = null;
        pointsFeatureSwitch = null;
        rankingsFeatureSwitch = null;
        historyFeatureSwitch = null;
        profilesFeatureSwitch = null;
        gamesFeatureSwitch = null;
    }

    private LinearLayout topBar(String title, String subtitle, boolean showHomeButton) {
        LinearLayout bar = new LinearLayout(this);
        bar.setOrientation(LinearLayout.HORIZONTAL);
        bar.setGravity(Gravity.CENTER_VERTICAL);
        LinearLayout.LayoutParams barParams = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        barParams.setMargins(0, 0, 0, dp(12));
        bar.setLayoutParams(barParams);

        if (showHomeButton) {
            bar.addView(iconButton(R.drawable.ic_home, "홈으로", v -> showHome()));
        } else {
            ImageView logo = new ImageView(this);
            logo.setImageResource(R.mipmap.ic_launcher);
            logo.setAdjustViewBounds(true);
            logo.setScaleType(ImageView.ScaleType.FIT_CENTER);
            LinearLayout.LayoutParams logoParams = new LinearLayout.LayoutParams(dp(42), dp(42));
            logo.setLayoutParams(logoParams);
            bar.addView(logo);
        }

        LinearLayout copy = new LinearLayout(this);
        copy.setOrientation(LinearLayout.VERTICAL);
        copy.setPadding(dp(12), 0, dp(12), 0);
        TextView titleView = text(title, 18, COLOR_TITLE, true);
        TextView subtitleView = text(subtitle, 12, COLOR_MUTED, false);
        copy.addView(titleView);
        copy.addView(subtitleView);
        bar.addView(copy, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));

        if (!showHomeButton) {
            bar.addView(iconButton(R.drawable.ic_settings, "설정", v -> showAdvanced()));
        }
        return bar;
    }

    private ImageButton iconButton(int iconRes, String description, View.OnClickListener listener) {
        ImageButton button = new ImageButton(this);
        button.setImageResource(iconRes);
        button.setColorFilter(COLOR_TITLE);
        button.setBackgroundResource(getResources().getIdentifier("icon_button_background", "drawable", getPackageName()));
        button.setContentDescription(description);
        button.setPadding(dp(10), dp(10), dp(10), dp(10));
        button.setOnClickListener(listener);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(dp(46), dp(46));
        button.setLayoutParams(params);
        return button;
    }

    private LinearLayout quickAction(int iconRes, String label, String hint, View.OnClickListener listener) {
        LinearLayout action = new LinearLayout(this);
        action.setOrientation(LinearLayout.VERTICAL);
        action.setGravity(Gravity.CENTER);
        action.setPadding(dp(10), dp(12), dp(10), dp(12));
        action.setBackgroundResource(getResources().getIdentifier("icon_button_background", "drawable", getPackageName()));
        action.setOnClickListener(listener);
        action.setClickable(true);

        ImageView icon = new ImageView(this);
        icon.setImageResource(iconRes);
        icon.setColorFilter(COLOR_BLUE);
        icon.setAdjustViewBounds(true);
        action.addView(icon, new LinearLayout.LayoutParams(dp(24), dp(24)));

        TextView labelView = text(label, 14, COLOR_TITLE, true);
        labelView.setGravity(Gravity.CENTER);
        labelView.setPadding(0, dp(7), 0, 0);
        action.addView(labelView);

        TextView hintView = text(hint, 11, COLOR_MUTED, false);
        hintView.setGravity(Gravity.CENTER);
        action.addView(hintView);
        return action;
    }

    private LinearLayout quickActionGrid(View... actions) {
        LinearLayout grid = new LinearLayout(this);
        grid.setOrientation(LinearLayout.VERTICAL);
        LinearLayout.LayoutParams gridParams = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        gridParams.setMargins(0, dp(12), 0, 0);
        grid.setLayoutParams(gridParams);

        for (int i = 0; i < actions.length; i += 2) {
            LinearLayout row = new LinearLayout(this);
            row.setOrientation(LinearLayout.HORIZONTAL);
            LinearLayout.LayoutParams rowParams = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
            rowParams.setMargins(0, dp(8), 0, 0);
            row.setLayoutParams(rowParams);
            for (int offset = 0; offset < 2 && i + offset < actions.length; offset++) {
                View action = actions[i + offset];
                LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1);
                params.setMargins(offset == 0 ? 0 : dp(6), 0, offset == 0 ? dp(6) : 0, 0);
                action.setLayoutParams(params);
                row.addView(action);
            }
            grid.addView(row);
        }
        return grid;
    }

    private LinearLayout heroPanel(int imageRes, String eyebrow, String title, String body) {
        LinearLayout layout = panel();
        layout.setGravity(Gravity.CENTER);
        layout.setPadding(dp(18), dp(18), dp(18), dp(20));

        ImageView image = assetImage(imageRes, 136);
        layout.addView(image);

        TextView eyebrowView = text(eyebrow, 13, COLOR_BLUE, true);
        eyebrowView.setGravity(Gravity.CENTER);
        eyebrowView.setPadding(0, dp(10), 0, dp(2));
        layout.addView(eyebrowView);

        TextView titleView = text(title, 25, COLOR_TITLE, true);
        titleView.setGravity(Gravity.CENTER);
        titleView.setPadding(0, 0, 0, dp(6));
        layout.addView(titleView);

        TextView bodyView = text(body, 14, COLOR_MUTED, false);
        bodyView.setGravity(Gravity.CENTER);
        layout.addView(bodyView);
        return layout;
    }

    private LinearLayout featurePanel(int imageRes, String title, String body) {
        LinearLayout layout = panel();
        layout.setOrientation(LinearLayout.HORIZONTAL);
        layout.setGravity(Gravity.CENTER_VERTICAL);
        layout.setPadding(dp(14), dp(14), dp(14), dp(14));

        ImageView image = assetImage(imageRes, 72);
        layout.addView(image);

        LinearLayout copy = new LinearLayout(this);
        copy.setOrientation(LinearLayout.VERTICAL);
        copy.setPadding(dp(12), 0, 0, 0);
        TextView titleView = text(title, 17, COLOR_TITLE, true);
        TextView bodyView = text(body, 13, COLOR_MUTED, false);
        bodyView.setPadding(0, dp(4), 0, 0);
        copy.addView(titleView);
        copy.addView(bodyView);
        layout.addView(copy, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        return layout;
    }

    private LinearLayout sectionHeader(int imageRes, String title, String body) {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.HORIZONTAL);
        layout.setGravity(Gravity.CENTER_VERTICAL);
        layout.setPadding(0, 0, 0, dp(10));

        ImageView image = assetImage(imageRes, 58);
        layout.addView(image);

        LinearLayout copy = new LinearLayout(this);
        copy.setOrientation(LinearLayout.VERTICAL);
        copy.setPadding(dp(12), 0, 0, 0);
        TextView titleView = text(title, 18, COLOR_TITLE, true);
        TextView bodyView = text(body, 13, COLOR_MUTED, false);
        bodyView.setPadding(0, dp(3), 0, 0);
        copy.addView(titleView);
        copy.addView(bodyView);
        layout.addView(copy, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        return layout;
    }

    private ImageView assetImage(int imageRes, int sizeDp) {
        ImageView image = new ImageView(this);
        image.setImageResource(imageRes);
        image.setAdjustViewBounds(true);
        image.setScaleType(ImageView.ScaleType.FIT_CENTER);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(dp(sizeDp), dp(sizeDp));
        params.gravity = Gravity.CENTER;
        image.setLayoutParams(params);
        return image;
    }

    private void saveSettings() {
        BridgeConfig.setEnabled(this, enabledSwitch.isChecked());
        BridgeConfig.setServerUrl(this, serverUrlInput.getText().toString());
        String roomName = roomNameInput.getText().toString().trim();
        String roomId = roomIdInput.getText().toString().trim();
        String roomLink = roomLinkInput.getText().toString().trim();
        String joinPhrase = joinPhraseInput.getText().toString().trim();
        String admins = adminsInput.getText().toString().trim();
        String licenseKey = licenseKeyInput.getText().toString().trim();
        boolean hasRoomInput = !TextUtils.isEmpty(roomName)
                || !TextUtils.isEmpty(roomId)
                || !TextUtils.isEmpty(roomLink)
                || !TextUtils.isEmpty(joinPhrase)
                || !TextUtils.isEmpty(admins)
                || !TextUtils.isEmpty(licenseKey);
        if (BridgeConfig.roomProfileCount(this) > 0 || hasRoomInput) {
            BridgeConfig.setPrimaryRoomProfile(this, roomName, roomId, roomLink, joinPhrase, admins, licenseKey);
        }
        BridgeConfig.setAttendanceEnabled(this, attendanceFeatureSwitch.isChecked());
        BridgeConfig.setPointsEnabled(this, pointsFeatureSwitch.isChecked());
        BridgeConfig.setRankingsEnabled(this, rankingsFeatureSwitch.isChecked());
        BridgeConfig.setHistoryEnabled(this, historyFeatureSwitch.isChecked());
        BridgeConfig.setProfilesEnabled(this, profilesFeatureSwitch.isChecked());
        BridgeConfig.setGamesEnabled(this, gamesFeatureSwitch.isChecked());
        if (scriptEnabledSwitch != null) {
            BridgeConfig.setScriptEnabled(this, scriptEnabledSwitch.isChecked());
        }
        if (scriptSourceInput != null) {
            BridgeConfig.setScriptSource(this, scriptSourceInput.getText().toString());
        }
        BridgeConfig.appendLog(this, "설정 저장됨 room=" + BridgeConfig.roomName(this) + " id=" + BridgeConfig.roomId(this) + " features=" + BridgeConfig.featureSummary(this));
        refreshStatus();
        refreshRoomProfilesSummary();
        refreshLogs();
    }

    private void saveScriptSettings() {
        if (scriptEnabledSwitch != null) {
            BridgeConfig.setScriptEnabled(this, scriptEnabledSwitch.isChecked());
        }
        if (scriptSourceInput != null) {
            BridgeConfig.setScriptSource(this, scriptSourceInput.getText().toString());
        }
        BridgeConfig.appendLog(this, "JS 자동응답 설정 저장됨");
        refreshLogs();
        Toast.makeText(this, "JS 설정을 저장했습니다.", Toast.LENGTH_SHORT).show();
    }

    private void sendTestEvent() {
        if (BridgeConfig.roomProfileCount(this) == 0) {
            Toast.makeText(this, "등록된 방이 없습니다. 앱 연결코드를 먼저 입력하세요.", Toast.LENGTH_SHORT).show();
            return;
        }
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
                    BridgeConfig.appendFailureLog(this, "서버 테스트 실패: " + result.error);
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
                    BridgeConfig.appendFailureLog(this, "앱 자동 연결 실패: " + result.error);
                    Toast.makeText(this, "연결코드를 확인하세요.", Toast.LENGTH_SHORT).show();
                }
                refreshLogs();
            });
        });
    }

    private void syncRoomProfiles() {
        if (BridgeConfig.roomProfileCount(this) == 0) {
            BridgeConfig.setLastProfileSyncSummary(this, "등록된 방 없음 - 앱 연결코드를 먼저 입력하세요.");
            BridgeConfig.appendLog(this, "서버 방 프로필 동기화 건너뜀: 등록된 방 없음");
            refreshProfileSyncStatus();
            refreshRoomProfilesSummary();
            refreshLogs();
            Toast.makeText(this, "등록된 방이 없습니다. 앱 연결코드를 먼저 입력하세요.", Toast.LENGTH_SHORT).show();
            return;
        }
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
                    BridgeConfig.appendFailureLog(this, "서버 방 프로필 동기화 실패: " + result.error);
                    refreshProfileSyncStatus();
                    Toast.makeText(this, "동기화 실패: 등록 방과 라이선스를 확인하세요.", Toast.LENGTH_SHORT).show();
                }
                refreshLogs();
            });
        });
    }

    private void retryPendingEvents() {
        if (BridgeConfig.pendingEventCount(this) == 0) {
            Toast.makeText(this, "전송 대기 이벤트가 없습니다.", Toast.LENGTH_SHORT).show();
            refreshPendingQueueStatus();
            return;
        }
        BridgeConfig.appendLog(this, "전송 대기 재시도 시작");
        refreshLogs();
        executor.execute(() -> {
            EventSender.RetryResult result = EventSender.retryPending(this);
            runOnUiThread(() -> {
                BridgeConfig.appendLog(this, "전송 대기 재시도 완료: 성공 " + result.success + " / 실패 " + result.failed + " / 남음 " + result.remaining);
                refreshPendingQueueStatus();
                refreshLogs();
                Toast.makeText(this, "전송 대기 재시도 완료", Toast.LENGTH_SHORT).show();
            });
        });
    }

    private void confirmClearPendingEvents() {
        new AlertDialog.Builder(this)
                .setTitle("대기 큐 비우기")
                .setMessage("서버로 아직 전송되지 않은 대기 이벤트를 비웁니다. 이미 처리된 서버 데이터는 삭제되지 않습니다.")
                .setPositiveButton("비우기", (dialog, which) -> {
                    BridgeConfig.clearPendingEvents(this);
                    refreshPendingQueueStatus();
                    refreshLogs();
                })
                .setNegativeButton("취소", null)
                .show();
    }

    private void refreshPendingQueueStatus() {
        if (pendingQueueStatus == null) return;
        pendingQueueStatus.setText(
                "대기 중 이벤트: " + BridgeConfig.pendingEventCount(this)
                        + "\n최근 처리 성공: " + safeText(BridgeConfig.lastCommandSuccessSummary(this))
                        + "\n최근 전송 성공: " + safeText(BridgeConfig.lastSendSuccess(this))
                        + "\n최근 전송 실패: " + safeText(BridgeConfig.lastSendFailure(this))
                        + "\n최근 무시 알림: " + safeText(BridgeConfig.lastIgnoreReason(this))
                        + "\n최근 서버 timing: " + safeText(BridgeConfig.lastServerTimingSummary(this))
                        + "\n등록 일반방/게임방: " + BridgeConfig.roomProfileCount(this) + "개 / 게임방 " + BridgeConfig.gameRoomProfileCount(this) + "개"
        );
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
        String registeredRoom = BridgeConfig.roomProfileCount(this) == 0 ? "등록된 방 없음" : BridgeConfig.roomName(this);
        String permissionHelp = permission ? "" : "\n안내: 설정에서 픽셀곰 브릿지를 허용하고, 카카오톡 방 알림을 켜야 대화를 감지합니다.";
        permissionStatus.setText((permission ? "알림 접근 권한: 허용됨" : "알림 접근 권한: 필요")
                + permissionHelp
                + "\n브릿지: " + (BridgeConfig.isEnabled(this) ? "켜짐" : "꺼짐")
                + "\n등록 방: " + registeredRoom
                + "\n등록 방 수: " + BridgeConfig.roomProfileCount(this) + "개"
                + "\n사용 기능: " + BridgeConfig.featureSummary(this));
        permissionStatus.setTextColor(permission ? COLOR_GOOD : COLOR_BAD);
    }

    private void refreshHomeDiagnostics() {
        if (homeDiagnosticsStatus == null) return;
        boolean permission = notificationPermissionEnabled();
        BridgeConfig.RoomProfile profile = BridgeConfig.firstRoomProfile(this);
        homeDiagnosticsStatus.setText("서버 진단: 확인 중\n"
                + "알림 권한: " + (permission ? "허용됨" : "필요") + "\n"
                + "대표 방: " + profile.name + " / " + profile.roomId + "\n"
                + "앱 버전: " + BuildConfig.VERSION_NAME + " (" + BuildConfig.VERSION_CODE + ")");
        homeDiagnosticsStatus.setTextColor(permission ? COLOR_GOOD : COLOR_BAD);

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
                    homeDiagnosticsStatus.setTextColor(result.appUpdateRequired || !result.dbOk ? COLOR_WARN : COLOR_GOOD);
                } else {
                    homeDiagnosticsStatus.setText("서버 진단: 연결 실패\n"
                            + "원인: " + safeText(result.error) + "\n"
                            + "확인: 인터넷 연결, 서버 URL, VPN/보안앱 차단 여부를 확인하세요.");
                    homeDiagnosticsStatus.setTextColor(COLOR_BAD);
                }
            });
        });
    }

    private void refreshLogs() {
        if (logView == null) return;
        logView.setText(BridgeConfig.logsForDisplay(this));
    }

    private void refreshRoomProfilesSummary() {
        if (roomProfilesSummaryView != null) {
            roomProfilesSummaryView.setText("일반방 목록\n" + BridgeConfig.generalRoomProfilesSummary(this));
        }
        if (gameRoomProfilesView != null) {
            gameRoomProfilesView.setText(BridgeConfig.gameRoomProfilesSummary(this));
            gameRoomProfilesView.setVisibility(gameRoomListExpanded && BridgeConfig.gameRoomProfileCount(this) > 0 ? View.VISIBLE : View.GONE);
        }
        if (gameRoomToggleButton != null) {
            int gameCount = BridgeConfig.gameRoomProfileCount(this);
            gameRoomToggleButton.setText(gameCount == 0
                    ? "게임방 없음"
                    : (gameRoomListExpanded ? "게임방 목록 접기" : "게임방 목록 펼치기") + " (" + gameCount + "개)");
            gameRoomToggleButton.setEnabled(gameCount > 0);
        }
    }

    private void toggleGameRoomList() {
        if (BridgeConfig.gameRoomProfileCount(this) == 0) return;
        gameRoomListExpanded = !gameRoomListExpanded;
        refreshRoomProfilesSummary();
    }

    private void refreshProfileSyncStatus() {
        if (profileSyncStatus != null) {
            profileSyncStatus.setText("서버 동기화: " + safeText(BridgeConfig.lastProfileSyncSummary(this)));
        }
    }

    private void confirmResetServerSettings() {
        new AlertDialog.Builder(this)
                .setTitle("서버 설정 초기화")
                .setMessage("이 앱에 저장된 등록 방, 라이선스 키, 최근 연결/동기화 기록을 삭제하고 브릿지를 끕니다.\n\n기기를 바꾸거나 다른 곳에 다시 등록할 때 사용하세요.\n\n구매자 계정과 서버 결제/신청 데이터는 삭제되지 않습니다.")
                .setNegativeButton("취소", null)
                .setPositiveButton("초기화", (dialog, which) -> resetServerSettings())
                .show();
    }

    private void resetServerSettings() {
        BridgeConfig.clearServerSettings(this);
        if (enabledSwitch != null) enabledSwitch.setChecked(false);
        if (serverUrlInput != null) serverUrlInput.setText(BridgeConfig.DEFAULT_SERVER_URL);
        if (connectionCodeInput != null) connectionCodeInput.setText("");
        if (roomNameInput != null) roomNameInput.setText("");
        if (roomIdInput != null) roomIdInput.setText("");
        if (roomLinkInput != null) roomLinkInput.setText("");
        if (joinPhraseInput != null) joinPhraseInput.setText("");
        if (adminsInput != null) adminsInput.setText("");
        if (licenseKeyInput != null) licenseKeyInput.setText("");
        refreshStatus();
        refreshRoomProfilesSummary();
        refreshProfileSyncStatus();
        refreshPendingQueueStatus();
        refreshLogs();
        Toast.makeText(this, "서버 설정을 초기화했습니다. 새 연결코드를 입력해 다시 등록하세요.", Toast.LENGTH_LONG).show();
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
        editText.setTextColor(COLOR_TEXT);
        editText.setHintTextColor(COLOR_MUTED);
        editText.setSelectAllOnFocus(false);
        editText.setBackgroundResource(getResources().getIdentifier("input_background", "drawable", getPackageName()));
        editText.setPadding(dp(12), dp(9), dp(12), dp(9));
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        params.setMargins(0, dp(10), 0, 0);
        editText.setLayoutParams(params);
        return editText;
    }

    private EditText multiLineInput(String value, int minLines) {
        EditText editText = new EditText(this);
        editText.setText(value);
        editText.setTextSize(13);
        editText.setTextColor(COLOR_TEXT);
        editText.setHintTextColor(COLOR_MUTED);
        editText.setGravity(Gravity.TOP | Gravity.START);
        editText.setSingleLine(false);
        editText.setMinLines(minLines);
        editText.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_MULTI_LINE | InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS);
        editText.setHorizontallyScrolling(false);
        editText.setBackgroundResource(getResources().getIdentifier("input_background", "drawable", getPackageName()));
        editText.setPadding(dp(10), dp(10), dp(10), dp(10));
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(150));
        params.setMargins(0, dp(10), 0, 0);
        editText.setLayoutParams(params);
        return editText;
    }

    private TextView sectionTitle(String value) {
        TextView title = text(value, 17, COLOR_TITLE, true);
        title.setPadding(0, 0, 0, dp(8));
        return title;
    }

    private void addSectionIntro(LinearLayout parent, String title, String description) {
        TextView titleView = text(title, 18, COLOR_TITLE, true);
        titleView.setPadding(0, dp(16), 0, dp(4));
        parent.addView(titleView);
        TextView descriptionView = text(description, 13, COLOR_MUTED, false);
        descriptionView.setPadding(0, 0, 0, dp(4));
        parent.addView(descriptionView);
    }

    private LinearLayout labelValue(String label, String value) {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        params.setMargins(0, 0, 0, dp(10));
        layout.setLayoutParams(params);

        TextView labelView = text(label, 12, COLOR_MUTED, true);
        TextView valueView = text(value, 15, COLOR_TEXT, false);
        valueView.setPadding(0, dp(2), 0, 0);
        layout.addView(labelView);
        layout.addView(valueView);
        return layout;
    }

    private String shortStatus(String value) {
        String text = safeText(value);
        if (TextUtils.isEmpty(text) || "-".equals(text)) return "기록 없음";
        String compact = text.replace("\n", " / ");
        return compact.length() > 86 ? compact.substring(0, 83) + "..." : compact;
    }

    private LinearLayout statusTile(String label, String value, boolean ok) {
        LinearLayout layout = labelValue(label, value);
        layout.setPadding(dp(10), dp(8), dp(10), dp(8));
        layout.setBackgroundResource(getResources().getIdentifier("status_tile_background", "drawable", getPackageName()));
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        params.setMargins(0, 0, 0, dp(8));
        layout.setLayoutParams(params);
        TextView valueView = (TextView) layout.getChildAt(1);
        valueView.setTextColor(ok ? COLOR_GOOD : COLOR_BAD);
        valueView.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
        return layout;
    }

    private LinearLayout statusRow(String label, String value, boolean ok) {
        LinearLayout layout = labelValue(label, value);
        TextView valueView = (TextView) layout.getChildAt(1);
        valueView.setTextColor(ok ? COLOR_GOOD : COLOR_BAD);
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
        badge.setBackgroundColor(COLOR_BLUE);
        layout.addView(badge, new LinearLayout.LayoutParams(dp(28), dp(28)));

        TextView body = text(value, 14, COLOR_MUTED, false);
        body.setPadding(dp(10), 0, 0, 0);
        layout.addView(body, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        return layout;
    }

    private Switch settingSwitch(String label, boolean checked) {
        Switch sw = new Switch(this);
        sw.setText(label);
        sw.setTextSize(15);
        sw.setTextColor(COLOR_TEXT);
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
        editText.setTextColor(COLOR_TEXT);
        editText.setHintTextColor(COLOR_MUTED);
        editText.setTypeface(Typeface.MONOSPACE);
        editText.setGravity(Gravity.TOP | Gravity.START);
        editText.setSingleLine(false);
        editText.setMinLines(10);
        editText.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_MULTI_LINE | InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS);
        editText.setHorizontallyScrolling(false);
        editText.setBackgroundResource(getResources().getIdentifier("input_background", "drawable", getPackageName()));
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
        button.setTextColor(COLOR_BLUE);
        button.setBackgroundResource(getResources().getIdentifier("button_secondary", "drawable", getPackageName()));
        return button;
    }

    private LinearLayout compactActionGrid(Button... buttons) {
        LinearLayout grid = new LinearLayout(this);
        grid.setOrientation(LinearLayout.VERTICAL);
        LinearLayout.LayoutParams gridParams = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        gridParams.setMargins(0, dp(12), 0, 0);
        grid.setLayoutParams(gridParams);

        for (int i = 0; i < buttons.length; i += 2) {
            LinearLayout row = new LinearLayout(this);
            row.setOrientation(LinearLayout.HORIZONTAL);
            LinearLayout.LayoutParams rowParams = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
            rowParams.setMargins(0, dp(8), 0, 0);
            row.setLayoutParams(rowParams);
            for (int offset = 0; offset < 2 && i + offset < buttons.length; offset++) {
                Button button = buttons[i + offset];
                LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(0, dp(46), 1);
                params.setMargins(offset == 0 ? 0 : dp(6), 0, offset == 0 ? dp(6) : 0, 0);
                button.setLayoutParams(params);
                row.addView(button);
            }
            grid.addView(row);
        }
        return grid;
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
