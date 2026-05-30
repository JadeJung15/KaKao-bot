package com.pixgom.bridge;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.text.InputType;
import android.text.TextUtils;
import android.view.Gravity;
import android.view.View;
import android.view.WindowInsets;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.ImageButton;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.Switch;
import android.widget.TextView;
import android.widget.Toast;

import com.kakao.sdk.auth.model.OAuthToken;
import com.kakao.sdk.common.KakaoSdk;
import com.kakao.sdk.user.UserApiClient;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import kotlin.Unit;

public class MainActivity extends Activity {
    private static final String WEBSITE_URL = "https://pixgom.com";
    private static final int COLOR_BG = Color.rgb(5, 18, 29);
    private static final int COLOR_PANEL = Color.rgb(24, 41, 58);
    private static final int COLOR_TILE = Color.rgb(31, 50, 69);
    private static final int COLOR_TITLE = Color.rgb(248, 252, 255);
    private static final int COLOR_TEXT = Color.rgb(221, 231, 238);
    private static final int COLOR_MUTED = Color.rgb(145, 164, 179);
    private static final int COLOR_BLUE = Color.rgb(59, 130, 246);
    private static final int COLOR_GOLD = Color.rgb(250, 204, 21);
    private static final int COLOR_GOOD = Color.rgb(74, 222, 128);
    private static final int COLOR_WARN = Color.rgb(251, 191, 36);
    private static final int COLOR_BAD = Color.rgb(248, 113, 113);
    private static final int COLOR_CARD_ALPHA = Color.argb(232, 20, 35, 51);
    private static final int COLOR_CARD_SOFT = Color.rgb(17, 31, 45);
    private static final int COLOR_GREEN_PANEL = Color.rgb(6, 82, 50);
    private static final int COLOR_RED_PANEL = Color.rgb(88, 31, 36);

    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final Handler uiHandler = new Handler(Looper.getMainLooper());
    private boolean introFinished = false;
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
    private TextView accountStatusView;
    private TextView nativeConsoleStatusView;
    private EditText loginEmailInput;
    private EditText loginPasswordInput;
    private EditText signupEmailInput;
    private EditText signupPasswordInput;
    private EditText signupPasswordConfirmInput;
    private EditText signupNicknameInput;
    private EditText applyRoomNameInput;
    private EditText applyRoomLinkInput;
    private EditText applyAdminNameInput;
    private EditText applyContactInput;
    private EditText applyMemoInput;
    private TextView applyPurposeStatusView;
    private EditText otpCodeInput;
    private String otpChallengeToken = "";
    private String otpEmail = "";
    private LinearLayout selectableRoomsContainer;
    private LinearLayout roomDetailContainer;
    private LinearLayout supportContainer;
    private final List<CheckBox> roomSelectionChecks = new ArrayList<>();
    private JSONObject buyerConsoleJson;
    private String nativeConsoleMode = "";
    private String selectedRoomApplicationId = "";
    private String selectedRoomTab = "status";
    private String roomFilterMode = "all";
    private String roomSearchQuery = "";
    private String roomSettingsCategory = "overview";
    private String commandSearchQuery = "";
    private String commandStoreTargetApplicationId = "";
    private String applyRoomPurpose = "general_room";
    private String applyLinkedApplicationId = "";
    private String logFilterMode = "all";
    private Button gameRoomToggleButton;
    private boolean gameRoomListExpanded = false;
    private boolean kakaoInitialized = false;
    private Switch blockGamesInGeneralRoomSwitch;
    private Switch blockOpsInGameRoomSwitch;
    private Switch sharePointsAndInventorySwitch;
    private Switch enabledSwitch;
    private Switch scriptEnabledSwitch;
    private Switch attendanceFeatureSwitch;
    private Switch pointsFeatureSwitch;
    private Switch rankingsFeatureSwitch;
    private Switch historyFeatureSwitch;
    private Switch profilesFeatureSwitch;
    private Switch localJsFeatureSwitch;
    private Switch gamesFeatureSwitch;
    private Switch shopFeatureSwitch;
    private Switch customCommandsFeatureSwitch;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        configureSystemBars();
        BridgeConfig.applyMigrations(this);
        initializeKakaoIfReady();
        showIntroThenHome();
    }

    @Override
    protected void onDestroy() {
        uiHandler.removeCallbacksAndMessages(null);
        executor.shutdownNow();
        super.onDestroy();
    }

    private void showIntroThenHome() {
        introFinished = false;
        View intro = buildIntroContent();
        intro.setAlpha(0f);
        setContentView(intro);
        intro.animate().alpha(1f).setDuration(180).start();
        uiHandler.postDelayed(this::finishIntro, 760);
    }

    private void finishIntro() {
        if (introFinished) return;
        introFinished = true;
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
    }

    private void showConnectionSettings() {
        clearMainRefs();
        setContentView(buildConnectionSettingsContent());
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

    private void showFeatureDashboard() {
        clearMainRefs();
        setContentView(buildFeatureDashboardContent());
    }

    private void showGamePackSettings(String packName) {
        clearMainRefs();
        setContentView(buildGamePackSettingsContent(packName));
    }

    private View buildHomeContent() {
        ScrollView scrollView = baseScrollView();

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        applyScreenPadding(root, 16);
        scrollView.addView(root);

        BridgeConfig.RoomProfile profile = BridgeConfig.firstRoomProfile(this);
        boolean loggedIn = BridgeConfig.isBuyerLoggedIn(this);
        if (!loggedIn) {
            return buildAuthWelcomeContent();
        }

        root.addView(homeHeader());
        root.addView(homeBridgeHero(profile));
        root.addView(homeActionRow());
        root.addView(homeMetricGrid());
        root.addView(homeRoomPreview());
        root.addView(homeLogPreview());

        return withBottomNav(scrollView, "home");
    }

    private void showEmailLogin() {
        clearMainRefs();
        setContentView(buildEmailLoginContent());
    }

    private void showSignup() {
        clearMainRefs();
        setContentView(buildSignupContent());
    }

    private void showOtpVerify(String email, String challengeToken) {
        clearMainRefs();
        otpEmail = email == null ? "" : email;
        otpChallengeToken = challengeToken == null ? "" : challengeToken;
        setContentView(buildOtpContent());
    }

    private void showLoginComplete() {
        clearMainRefs();
        setContentView(buildLoginCompleteContent());
    }

    private View buildAuthWelcomeContent() {
        ScrollView scrollView = baseScrollView();
        scrollView.setBackgroundResource(R.drawable.pixgom_login_night_bg);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        applyScreenPadding(root, 18);
        scrollView.addView(root);

        LinearLayout brandRow = new LinearLayout(this);
        brandRow.setGravity(Gravity.CENTER);
        brandRow.setPadding(0, dp(32), 0, dp(4));
        brandRow.setContentDescription("PIXELGOM");
        TextView brandPixel = text("PIXEL", 30, COLOR_TITLE, true);
        TextView brandGom = text("GOM", 30, COLOR_GOOD, true);
        brandRow.addView(brandPixel);
        brandRow.addView(brandGom);
        root.addView(brandRow);

        TextView sub = text("카카오톡 오픈채팅방 브릿지 플랫폼", 14, COLOR_MUTED, false);
        sub.setGravity(Gravity.CENTER);
        root.addView(sub);

        ImageView bear = assetImage(R.drawable.pixgom_bridge_captain, 128);
        LinearLayout.LayoutParams bearParams = new LinearLayout.LayoutParams(dp(128), dp(128));
        bearParams.gravity = Gravity.CENTER_HORIZONTAL;
        bearParams.setMargins(0, dp(20), 0, dp(18));
        root.addView(bear, bearParams);

        TextView headline = text("운영을 더 쉽고\n빠르게, 픽셀곰과 함께", 24, COLOR_TITLE, true);
        headline.setGravity(Gravity.CENTER);
        headline.setLineSpacing(dp(4), 1f);
        root.addView(headline);

        LinearLayout features = glassPanel();
        features.setPadding(dp(12), dp(10), dp(12), dp(10));
        root.addView(features);
        features.addView(featureLine(R.drawable.ic_log, "카카오톡 알림을 실시간으로 감지", "중요 메시지를 놓치지 않고 빠른 확인"));
        features.addView(featureLine(R.drawable.ic_sync, "서버와 연결하여 자동으로 응답", "명령어 처리부터 게임 기능까지 지원"));
        features.addView(featureLine(R.drawable.ic_users, "여러 방을 한 번에 관리", "모든 운영 상태를 앱에서 확인하고 제어"));

        Button loginButton = primaryButton("로그인하기");
        loginButton.setOnClickListener(v -> showEmailLogin());
        root.addView(loginButton);
        Button signupButton = secondaryButton("회원가입");
        signupButton.setOnClickListener(v -> showSignup());
        root.addView(signupButton);
        Button directButton = flatTextButton("둘러보기");
        directButton.setOnClickListener(v -> showAdvanced());
        root.addView(directButton);
        return scrollView;
    }

    private View buildEmailLoginContent() {
        ScrollView scrollView = baseScrollView();
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        applyScreenPadding(root, 18);
        scrollView.addView(root);
        root.addView(simpleTitleBar("로그인", true, false));

        ImageView bear = assetImage(R.drawable.pixgom_bridge_captain, 82);
        LinearLayout.LayoutParams bearParams = new LinearLayout.LayoutParams(dp(82), dp(82));
        bearParams.gravity = Gravity.CENTER_HORIZONTAL;
        bearParams.setMargins(0, dp(12), 0, dp(10));
        root.addView(bear, bearParams);
        TextView title = text("픽셀곰 계정으로 로그인", 22, COLOR_TITLE, true);
        title.setGravity(Gravity.CENTER);
        root.addView(title);
        TextView body = text("계정으로 로그인하여 방을 관리해보세요.", 14, COLOR_MUTED, false);
        body.setGravity(Gravity.CENTER);
        body.setPadding(0, dp(6), 0, dp(14));
        root.addView(body);

        LinearLayout panel = transparentStack();
        panel.setPadding(dp(14), dp(14), dp(14), dp(14));
        root.addView(panel);
        loginEmailInput = authInput("이메일 또는 아이디", BridgeConfig.buyerEmail(this));
        loginEmailInput.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS);
        panel.addView(loginEmailInput);
        loginPasswordInput = authInput("비밀번호", "");
        loginPasswordInput.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
        panel.addView(loginPasswordInput);
        panel.addView(authOptionRow());
        Button loginButton = primaryButton("로그인");
        loginButton.setOnClickListener(v -> loginWithEmail());
        panel.addView(loginButton);
        panel.addView(orDivider());
        Button kakaoButton = socialButton(kakaoReady() ? "카카오 로그인" : "카카오 준비 중");
        kakaoButton.setEnabled(kakaoReady());
        kakaoButton.setOnClickListener(v -> loginWithKakao());
        panel.addView(kakaoButton);
        Button googleButton = socialButton("Google 준비 중");
        googleButton.setEnabled(false);
        googleButton.setOnClickListener(v -> loginGoogleAppleOAuth("google"));
        panel.addView(googleButton);
        Button appleButton = socialButton("Apple 준비 중");
        appleButton.setEnabled(false);
        appleButton.setOnClickListener(v -> loginGoogleAppleOAuth("apple"));
        panel.addView(appleButton);
        loadAuthButtonState(kakaoButton, googleButton, appleButton);
        accountStatusView = text("로그인 후 인증번호를 확인합니다.", 12, COLOR_MUTED, false);
        accountStatusView.setGravity(Gravity.CENTER);
        accountStatusView.setPadding(0, dp(10), 0, 0);
        panel.addView(accountStatusView);

        Button signupButton = flatTextButton("계정이 없으신가요?  회원가입");
        signupButton.setOnClickListener(v -> showSignup());
        root.addView(signupButton);
        return scrollView;
    }

    private void loadAuthButtonState(Button kakaoButton, Button googleButton, Button appleButton) {
        executor.execute(() -> {
            EventSender.ApiResult result = EventSender.authConfig(this);
            runOnUiThread(() -> {
                JSONObject auth = result.ok() ? result.json.optJSONObject("auth") : null;
                boolean googleEnabled = auth != null && auth.optBoolean("googleEnabled", false);
                boolean appleEnabled = auth != null && auth.optBoolean("appleEnabled", false);
                boolean kakaoEnabled = kakaoReady() && (auth == null || auth.optBoolean("kakaoEnabled", true));
                kakaoButton.setEnabled(kakaoEnabled);
                kakaoButton.setText(kakaoEnabled ? "카카오 로그인" : "카카오 준비 중");
                googleButton.setEnabled(googleEnabled);
                googleButton.setText(googleEnabled ? "Google 로그인" : "Google 준비 중");
                appleButton.setEnabled(appleEnabled);
                appleButton.setText(appleEnabled ? "Apple 로그인" : "Apple 준비 중");
                if (accountStatusView != null && auth != null && !auth.optBoolean("otpEnabled", false)) {
                    accountStatusView.setText("2단계 인증 설정이 꺼져 있으면 바로 로그인됩니다.");
                }
            });
        });
    }

    private View buildSignupContent() {
        ScrollView scrollView = baseScrollView();
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        applyScreenPadding(root, 18);
        scrollView.addView(root);
        root.addView(simpleTitleBar("회원가입", true, false));

        LinearLayout panel = transparentStack();
        panel.setPadding(dp(14), dp(14), dp(14), dp(14));
        root.addView(panel);
        ImageView bear = assetImage(R.drawable.pixgom_bridge_captain, 74);
        LinearLayout.LayoutParams bearParams = new LinearLayout.LayoutParams(dp(74), dp(74));
        bearParams.gravity = Gravity.CENTER_HORIZONTAL;
        panel.addView(bear, bearParams);
        TextView title = text("픽셀곰 계정 만들기", 22, COLOR_TITLE, true);
        title.setGravity(Gravity.CENTER);
        title.setPadding(0, dp(8), 0, dp(4));
        panel.addView(title);
        panel.addView(centerText("간단한 정보로 계정을 생성하세요.", 13, COLOR_MUTED));
        signupEmailInput = authInput("이메일", "");
        signupEmailInput.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS);
        panel.addView(signupEmailInput);
        signupPasswordInput = authInput("비밀번호", "");
        signupPasswordInput.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
        panel.addView(signupPasswordInput);
        signupPasswordConfirmInput = authInput("비밀번호 확인", "");
        signupPasswordConfirmInput.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
        panel.addView(signupPasswordConfirmInput);
        signupNicknameInput = authInput("닉네임", "");
        panel.addView(signupNicknameInput);
        panel.addView(checkTextRow("이용약관 및 개인정보처리방침에 동의합니다.", true));
        Button signupButton = primaryButton("회원가입");
        signupButton.setOnClickListener(v -> signupWithEmail());
        panel.addView(signupButton);
        Button loginButton = flatTextButton("이미 계정이 있으신가요?  로그인");
        loginButton.setOnClickListener(v -> showEmailLogin());
        root.addView(loginButton);
        return scrollView;
    }

    private View buildOtpContent() {
        ScrollView scrollView = baseScrollView();
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        applyScreenPadding(root, 18);
        scrollView.addView(root);
        root.addView(simpleTitleBar("2단계 인증", true, false));

        LinearLayout panel = transparentStack();
        panel.setGravity(Gravity.CENTER_HORIZONTAL);
        panel.setPadding(dp(14), dp(24), dp(14), dp(18));
        root.addView(panel);
        panel.addView(iconCircle(R.drawable.ic_shield, COLOR_CARD_SOFT, dp(96), true));
        TextView title = text("2단계 인증", 24, COLOR_TITLE, true);
        title.setGravity(Gravity.CENTER);
        title.setPadding(0, dp(18), 0, dp(8));
        panel.addView(title);
        panel.addView(centerText("이메일로 발송된 6자리 인증번호를 입력해주세요.", 14, COLOR_MUTED));
        otpCodeInput = authInput("인증번호 6자리", "");
        otpCodeInput.setInputType(InputType.TYPE_CLASS_NUMBER);
        otpCodeInput.setGravity(Gravity.CENTER);
        otpCodeInput.setTextSize(22);
        panel.addView(otpCodeInput);
        accountStatusView = centerText("인증번호 재전송  00:45", 12, COLOR_MUTED);
        panel.addView(accountStatusView);
        Button verifyButton = primaryButton("확인");
        verifyButton.setOnClickListener(v -> verifyEmailOtp());
        panel.addView(verifyButton);
        panel.addView(infoCard(R.drawable.ic_shield, "2단계 인증을 완료하면 계정을 더 안전하게 보호할 수 있습니다."));
        return scrollView;
    }

    private View buildLoginCompleteContent() {
        ScrollView scrollView = baseScrollView();
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        applyScreenPadding(root, 18);
        scrollView.addView(root);
        TextView skip = singleLineText("건너뛰기", 14, COLOR_TEXT, true);
        skip.setGravity(Gravity.END);
        skip.setOnClickListener(v -> showHome());
        root.addView(skip);
        ImageView bear = assetImage(R.drawable.pixgom_bridge_captain, 120);
        LinearLayout.LayoutParams bearParams = new LinearLayout.LayoutParams(dp(120), dp(120));
        bearParams.gravity = Gravity.CENTER_HORIZONTAL;
        bearParams.setMargins(0, dp(34), 0, dp(14));
        root.addView(bear, bearParams);
        TextView title = text("로그인 완료!", 28, COLOR_TITLE, true);
        title.setGravity(Gravity.CENTER);
        root.addView(title);
        root.addView(centerText(BridgeConfig.roomProfileCount(this) + "개의 방이 이 기기에 연결되어 있습니다.", 14, COLOR_MUTED));

        LinearLayout summary = glassPanel();
        summary.setPadding(dp(16), dp(14), dp(16), dp(14));
        root.addView(summary);
        summary.addView(labelValue("연결된 방", BridgeConfig.roomProfileCount(this) + "개"));
        summary.addView(labelValue("브릿지 상태", BridgeConfig.isEnabled(this) ? "실행 중" : "정지"));
        summary.addView(labelValue("최근 응답", shortTimingStatus()));

        Button homeButton = primaryButton("홈으로 이동");
        homeButton.setOnClickListener(v -> showHome());
        root.addView(homeButton);
        Button roomsButton = secondaryButton("방 관리로 이동");
        roomsButton.setOnClickListener(v -> showRooms());
        root.addView(roomsButton);
        return scrollView;
    }

    private LinearLayout buildLoginPanel() {
        LinearLayout loginPanel = panel();
        loginPanel.setPadding(dp(16), dp(16), dp(16), dp(16));
        loginPanel.addView(sectionHeader(R.drawable.pixgom_chat_portal, "로그인", "결제 완료 방을 자동으로 불러옵니다."));

        loginEmailInput = input("이메일", BridgeConfig.buyerEmail(this));
        loginEmailInput.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS);
        loginPanel.addView(loginEmailInput);

        loginPasswordInput = input("비밀번호", "");
        loginPasswordInput.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
        loginPanel.addView(loginPasswordInput);

        Button loginButton = primaryButton("로그인하고 방 자동 연결");
        loginButton.setOnClickListener(v -> loginWithEmail());
        loginPanel.addView(loginButton);

        Button kakaoButton = secondaryButton(kakaoReady() ? "카카오 로그인" : "카카오 준비 중");
        kakaoButton.setEnabled(kakaoReady());
        kakaoButton.setOnClickListener(v -> loginWithKakao());
        loginPanel.addView(kakaoButton);

        accountStatusView = text(kakaoReady() ? "카카오 로그인 사용 가능" : "카카오 Native app key와 key hash 등록 후 사용할 수 있습니다.", 13, COLOR_MUTED, false);
        accountStatusView.setPadding(0, dp(8), 0, 0);
        loginPanel.addView(accountStatusView);
        return loginPanel;
    }

    private void showRooms() {
        if (!BridgeConfig.isBuyerLoggedIn(this)) {
            showHome();
            Toast.makeText(this, "먼저 로그인해 주세요.", Toast.LENGTH_SHORT).show();
            return;
        }
        clearMainRefs();
        setContentView(buildRoomsContent());
        loadBuyerConsole();
    }

    private View buildRoomsContent() {
        ScrollView scrollView = baseScrollView();
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        applyScreenPadding(root, 16);
        scrollView.addView(root);

        root.addView(roomsTitleBar());
        root.addView(roomFilterRow());
        if (!TextUtils.isEmpty(roomSearchQuery)) {
            root.addView(activeSearchSummary("검색: " + roomSearchQuery, v -> {
                roomSearchQuery = "";
                showRooms();
            }));
        }

        nativeConsoleStatusView = singleLineText("내 방을 불러오는 중", 13, COLOR_MUTED, true);
        nativeConsoleStatusView.setPadding(0, dp(6), 0, dp(4));
        root.addView(nativeConsoleStatusView);

        selectableRoomsContainer = transparentStack();
        nativeConsoleMode = "rooms";
        selectableRoomsContainer.setPadding(0, 0, 0, 0);
        root.addView(selectableRoomsContainer);

        Button connectButton = iconTextButton(R.drawable.ic_plus, "선택한 방 이 폰에 연결", true);
        connectButton.setOnClickListener(v -> autoConnectSelectedRooms());
        root.addView(connectButton);

        Button syncButton = iconTextButton(R.drawable.ic_sync, "계정 기준으로 다시 동기화", false);
        syncButton.setOnClickListener(v -> accountRoomSyncSelectedRooms());
        root.addView(syncButton);
        return withBottomNav(scrollView, "rooms");
    }

    private void showRoomDetail(String applicationId, String tab) {
        if (!BridgeConfig.isBuyerLoggedIn(this)) {
            showHome();
            Toast.makeText(this, "먼저 로그인해 주세요.", Toast.LENGTH_SHORT).show();
            return;
        }
        clearMainRefs();
        selectedRoomApplicationId = applicationId == null ? "" : applicationId;
        selectedRoomTab = TextUtils.isEmpty(tab) ? "status" : tab;
        if (!"settings".equals(selectedRoomTab)) roomSettingsCategory = "overview";
        setContentView(buildRoomDetailContent());
        loadBuyerConsole();
    }

    private View buildRoomDetailContent() {
        ScrollView scrollView = baseScrollView();
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        applyScreenPadding(root, 16);
        scrollView.addView(root);

        root.addView(roomDetailTitleBar());

        nativeConsoleStatusView = singleLineText("방 데이터를 불러오는 중", 13, COLOR_MUTED, true);
        nativeConsoleStatusView.setPadding(0, dp(2), 0, dp(6));
        root.addView(nativeConsoleStatusView);

        roomDetailContainer = transparentStack();
        roomDetailContainer.setPadding(0, 0, 0, 0);
        roomDetailContainer.addView(text("불러오는 중입니다.", 14, COLOR_MUTED, false));
        nativeConsoleMode = "room_detail";
        root.addView(roomDetailContainer);
        return withBottomNav(scrollView, "rooms");
    }

    private void showCommandStore() {
        showCommandStore("");
    }

    private void showCommandStore(String applicationId) {
        if (!BridgeConfig.isBuyerLoggedIn(this)) {
            showHome();
            Toast.makeText(this, "먼저 로그인해 주세요.", Toast.LENGTH_SHORT).show();
            return;
        }
        clearMainRefs();
        commandStoreTargetApplicationId = applicationId == null ? "" : applicationId;
        setContentView(buildCommandStoreContent());
        loadBuyerConsole();
    }

    private View buildCommandStoreContent() {
        ScrollView scrollView = baseScrollView();
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        applyScreenPadding(root, 24);
        scrollView.addView(root);

        root.addView(topBar("명령어 스토어", "설치/장착", true));
        root.addView(compactHeroPanel(
                R.drawable.pixgom_speech_bubble,
                "앱에서 바로 장착",
                TextUtils.isEmpty(commandStoreTargetApplicationId) ? "구독 방에 명령어팩과 템플릿을 설치합니다." : "선택한 방에 명령어팩과 템플릿을 설치합니다."));

        nativeConsoleStatusView = text("스토어를 불러오는 중", 14, COLOR_MUTED, true);
        nativeConsoleStatusView.setPadding(0, dp(8), 0, dp(8));
        root.addView(nativeConsoleStatusView);

        LinearLayout storePanel = panel();
        storePanel.setPadding(dp(16), dp(16), dp(16), dp(16));
        storePanel.addView(sectionHeader(
                R.drawable.pixgom_checklist_calendar,
                "추천 팩",
                TextUtils.isEmpty(commandStoreTargetApplicationId) ? "연결된 방에 적용합니다." : "선택한 방에 적용합니다."));
        root.addView(storePanel);
        selectableRoomsContainer = storePanel;
        nativeConsoleMode = "store";
        return scrollView;
    }

    private void showAccount() {
        clearMainRefs();
        setContentView(buildAccountContent());
    }

    private View buildAccountContent() {
        ScrollView scrollView = baseScrollView();
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        applyScreenPadding(root, 24);
        scrollView.addView(root);

        root.addView(topBar("계정", "로그인과 연결", true));
        LinearLayout accountPanel = panel();
        accountPanel.setPadding(dp(16), dp(16), dp(16), dp(16));
        root.addView(accountPanel);
        accountPanel.addView(sectionHeader(R.drawable.pixgom_support_bear, "구매자 계정", accountLabel()));

        if (BridgeConfig.isBuyerLoggedIn(this)) {
            accountPanel.addView(settingCategoryRow(
                    R.drawable.ic_settings,
                    "닉네임",
                    TextUtils.isEmpty(BridgeConfig.buyerNickname(this)) ? "계정 표시 이름을 등록합니다." : BridgeConfig.buyerNickname(this),
                    "수정",
                    v -> showProfileEditDialog()));

            accountPanel.addView(settingCategoryRow(
                    R.drawable.ic_log,
                    "문의/복구",
                    "입금, 설치 오류, 삭제 방 복구를 앱에서 접수합니다.",
                    "열기",
                    v -> showSupport()));

            accountPanel.addView(settingCategoryRow(
                    R.drawable.ic_plus,
                    "서비스 신청",
                    "새 운영방과 게임방을 앱에서 신청합니다.",
                    "신청",
                    v -> showApplyService()));

            Button resetPasswordButton = secondaryButton("비밀번호 재설정 메일 보내기");
            resetPasswordButton.setOnClickListener(v -> showPasswordResetDialog());
            accountPanel.addView(resetPasswordButton);

            Button reloadButton = primaryButton("내 콘솔 새로고침");
            reloadButton.setOnClickListener(v -> loadBuyerConsole());
            accountPanel.addView(reloadButton);

            Button kakaoLinkButton = secondaryButton(kakaoReady() ? "카카오 연결" : "카카오 준비 중");
            kakaoLinkButton.setEnabled(kakaoReady());
            kakaoLinkButton.setOnClickListener(v -> linkKakaoAccount());
            accountPanel.addView(kakaoLinkButton);

            Button logoutButton = secondaryButton("로그아웃");
            logoutButton.setOnClickListener(v -> {
                BridgeConfig.clearBuyerSession(this);
                showHome();
            });
            accountPanel.addView(logoutButton);
        } else {
            accountPanel.addView(buildLoginPanel());
        }
        return scrollView;
    }

    private void showSupport() {
        if (!BridgeConfig.isBuyerLoggedIn(this)) {
            showAccount();
            Toast.makeText(this, "먼저 로그인해 주세요.", Toast.LENGTH_SHORT).show();
            return;
        }
        clearMainRefs();
        setContentView(buildSupportContent());
        loadBuyerConsole();
    }

    private View buildSupportContent() {
        ScrollView scrollView = baseScrollView();
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        applyScreenPadding(root, 18);
        scrollView.addView(root);

        root.addView(topBar("문의/복구", "앱에서 접수", true));
        root.addView(compactSummaryPanel("웹 콘솔 없이 처리", "방별 문의와 삭제 방 복구 요청을 앱에서 바로 보냅니다."));

        nativeConsoleStatusView = singleLineText("콘솔 데이터를 불러오는 중", 13, COLOR_MUTED, true);
        nativeConsoleStatusView.setPadding(0, dp(6), 0, dp(4));
        root.addView(nativeConsoleStatusView);

        supportContainer = transparentStack();
        supportContainer.addView(text("불러오는 중입니다.", 14, COLOR_MUTED, false));
        nativeConsoleMode = "support";
        root.addView(supportContainer);
        return withBottomNav(scrollView, "settings");
    }

    private void showApplyService() {
        if (!BridgeConfig.isBuyerLoggedIn(this)) {
            showEmailLogin();
            Toast.makeText(this, "먼저 로그인해 주세요.", Toast.LENGTH_SHORT).show();
            return;
        }
        clearMainRefs();
        setContentView(buildApplyServiceContent());
        loadBuyerConsole();
    }

    private View buildApplyServiceContent() {
        ScrollView scrollView = baseScrollView();
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        applyScreenPadding(root, 18);
        scrollView.addView(root);

        root.addView(topBar("서비스 신청", "앱에서 접수", true));
        root.addView(compactSummaryPanel("웹사이트 없이 신청", "새 방 정보 입력 후 결제 확인 요청까지 앱에서 처리합니다."));

        LinearLayout form = panel();
        form.setPadding(dp(14), dp(14), dp(14), dp(14));
        root.addView(form);
        form.addView(sectionTitle("신청 종류"));
        applyPurposeStatusView = singleLineText(applyPurposeLabel(), 13, COLOR_GOOD, true);
        form.addView(applyPurposeStatusView);
        form.addView(settingCategoryRow(
                R.drawable.ic_home,
                "일반 운영방",
                "대표 오픈채팅방을 새로 신청합니다.",
                "기본",
                v -> setApplyPurpose("general_room", "")));
        form.addView(settingCategoryRow(
                R.drawable.ic_checklist,
                "게임방 추가",
                "승인된 대표방에 연결된 게임방을 신청합니다.",
                "추가",
                v -> setApplyPurpose("game_room", firstApprovedApplicationId())));

        form.addView(sectionTitle("방 정보"));
        applyRoomNameInput = authInput("방 이름", "");
        form.addView(applyRoomNameInput);
        applyRoomLinkInput = authInput("오픈채팅 링크", "");
        applyRoomLinkInput.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        form.addView(applyRoomLinkInput);
        applyAdminNameInput = authInput("방 관리자 닉네임", "");
        form.addView(applyAdminNameInput);
        applyContactInput = authInput("연락처 또는 카카오 ID (선택)", "");
        form.addView(applyContactInput);
        applyMemoInput = multiLineInput("", 3);
        applyMemoInput.setHint("요청 메모 또는 입금자명을 적어 주세요. (선택)");
        form.addView(applyMemoInput);

        Button submitButton = primaryButton("신청 접수");
        submitButton.setOnClickListener(v -> submitServiceApplication());
        form.addView(submitButton);
        Button supportButton = secondaryButton("결제 확인 요청 보기");
        supportButton.setOnClickListener(v -> showSupport());
        form.addView(supportButton);
        return withBottomNav(scrollView, "settings");
    }

    private View buildFeatureDashboardContent() {
        ScrollView scrollView = baseScrollView();
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        applyScreenPadding(root, 24);
        scrollView.addView(root);

        root.addView(topBar("기능 대시보드", "운영 기능과 게임팩", true));
        root.addView(compactHeroPanel(
                R.drawable.pixgom_dashboard_monitor,
                "2번 안에 설정 진입",
                "자주 보는 기능은 카드에서 바로 열고, 세부 게임 설정은 읽기 전용으로 확인합니다."));

        LinearLayout statusPanel = panel();
        statusPanel.setPadding(dp(16), dp(16), dp(16), dp(16));
        root.addView(statusPanel);
        statusPanel.addView(sectionTitle("운영 요약"));
        statusPanel.addView(statusTile("일반 기능", BridgeConfig.featureSummary(this), true));
        statusPanel.addView(statusTile("게임방", BridgeConfig.gameRoomProfileCount(this) + "개", BridgeConfig.gameRoomProfileCount(this) > 0));
        statusPanel.addView(statusTile("명령어 스토어", safeText(BridgeConfig.lastConsoleSummary(this)), BridgeConfig.isBuyerLoggedIn(this)));

        LinearLayout generalPanel = panel();
        generalPanel.setPadding(dp(16), dp(16), dp(16), dp(16));
        root.addView(generalPanel);
        generalPanel.addView(sectionHeader(R.drawable.pixgom_bridge_captain, "일반 기능", "운영 기본값"));
        generalPanel.addView(dashboardCard(R.drawable.ic_sync, "브릿지 자동응답", BridgeConfig.isEnabled(this) ? "알림을 받아 서버로 전송합니다." : "현재 꺼져 있습니다.", BridgeConfig.isEnabled(this) ? "활성" : "비활성", BridgeConfig.isEnabled(this), v -> toggleBridgeEnabled()));
        generalPanel.addView(dashboardCard(R.drawable.ic_link, "방 자동 연결", "승인/결제 완료 방을 계정 기준으로 불러옵니다.", BridgeConfig.roomProfileCount(this) + "개", BridgeConfig.roomProfileCount(this) > 0, v -> showRooms()));
        generalPanel.addView(dashboardCard(R.drawable.ic_log, "전송 로그", "성공, 실패, 무시, 진단 원문을 확인합니다.", BridgeConfig.pendingEventCount(this) == 0 ? "정상" : "대기 " + BridgeConfig.pendingEventCount(this), BridgeConfig.pendingEventCount(this) == 0, v -> showLogs()));

        LinearLayout gamePanel = panel();
        gamePanel.setPadding(dp(16), dp(16), dp(16), dp(16));
        root.addView(gamePanel);
        gamePanel.addView(sectionHeader(R.drawable.pixgom_speech_bubble, "게임팩", "라꼬봇식 접근성만 반영"));
        gamePanel.addView(dashboardCard(R.drawable.ic_checklist, "채팅 미니게임", "주사위, 뽑기, 홀짝 등 포인트 게임 설정을 확인합니다.", BridgeConfig.gamesEnabled(this) ? "활성" : "비활성", BridgeConfig.gamesEnabled(this), v -> showGamePackSettings("채팅 미니게임")));
        gamePanel.addView(dashboardCard(R.drawable.ic_checklist, "RPG 모험팩", "모험, 던전, 장비, 제작 흐름을 확인합니다.", BridgeConfig.gamesEnabled(this) ? "활성" : "설정 필요", BridgeConfig.gamesEnabled(this), v -> showGamePackSettings("RPG 모험팩")));
        gamePanel.addView(dashboardCard(R.drawable.ic_checklist, "낚시/자동게임", "자동 실행권, 쿨타임, 보상 요약은 서버 기준입니다.", BridgeConfig.gamesEnabled(this) ? "활성" : "설정 필요", BridgeConfig.gamesEnabled(this), v -> showGamePackSettings("낚시/자동게임")));

        LinearLayout premiumPanel = panel();
        premiumPanel.setPadding(dp(16), dp(16), dp(16), dp(16));
        root.addView(premiumPanel);
        premiumPanel.addView(sectionHeader(R.drawable.pixgom_chat_portal, "프리미엄", "계정과 구독"));
        premiumPanel.addView(dashboardCard(R.drawable.ic_home, "구독/승인 상태", "앱은 결제 완료 방만 자동 연결합니다.", subscriptionStatusLabel(), "확인됨".equals(subscriptionStatusLabel()), v -> showRooms()));
        premiumPanel.addView(dashboardCard(R.drawable.ic_settings, "계정", accountLabel(), BridgeConfig.isBuyerLoggedIn(this) ? "로그인됨" : "로그인 필요", BridgeConfig.isBuyerLoggedIn(this), v -> showAccount()));

        LinearLayout commandPanel = panel();
        commandPanel.setPadding(dp(16), dp(16), dp(16), dp(16));
        root.addView(commandPanel);
        commandPanel.addView(sectionHeader(R.drawable.pixgom_checklist_calendar, "명령어/템플릿", "구매자 콘솔 API로 설치"));
        commandPanel.addView(dashboardCard(R.drawable.ic_sync, "명령어 스토어", "명령어팩과 템플릿을 현재 구독 방에 장착합니다.", BridgeConfig.isBuyerLoggedIn(this) ? "사용 가능" : "로그인 필요", BridgeConfig.isBuyerLoggedIn(this), v -> showCommandStore()));
        commandPanel.addView(dashboardCard(R.drawable.ic_settings, "상세 설정", "연결코드, 서버 URL, 로컬 JS는 고급 설정에 있습니다.", "고급", true, v -> showAdvanced()));
        return scrollView;
    }

    private View buildGamePackSettingsContent(String packName) {
        ScrollView scrollView = baseScrollView();
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        applyScreenPadding(root, 96);
        scrollView.addView(root);

        root.addView(topBar(packName, "게임팩 설정", true));
        root.addView(compactHeroPanel(
                R.drawable.pixgom_speech_bubble,
                packName,
                "저장 가능한 공통 항목은 앱에 저장하고, 세부 확률/보상은 서버 설정 기준으로 읽습니다."));

        LinearLayout editPanel = panel();
        editPanel.setPadding(dp(16), dp(16), dp(16), dp(16));
        root.addView(editPanel);
        editPanel.addView(sectionHeader(R.drawable.pixgom_dashboard_monitor, "공통 설정", "현재 앱에서 직접 저장 가능한 항목"));
        Switch packEnabledSwitch = settingSwitch("게임 기능 사용", BridgeConfig.gamesEnabled(this));
        editPanel.addView(packEnabledSwitch);
        editPanel.addView(labelValue("일일 제한", "서버/방 설정 기준 - 앱 1차에서는 읽기 전용"));
        editPanel.addView(labelValue("쿨타임", "명령어별 서버 기준 - 앱 1차에서는 읽기 전용"));
        editPanel.addView(labelValue("응답 메시지", "채팅 답장 문구는 명령어팩/템플릿 기준"));
        editPanel.addView(labelValue("보상 요약", "포인트, 아이템, RPG 보상은 서버 로직 기준"));

        LinearLayout routePanel = panel();
        routePanel.setPadding(dp(16), dp(16), dp(16), dp(16));
        root.addView(routePanel);
        routePanel.addView(sectionHeader(R.drawable.pixgom_checklist_calendar, "빠른 이동", "2탭 안에 필요한 화면으로 이동"));
        routePanel.addView(dashboardCard(R.drawable.ic_sync, "명령어 스토어", "게임팩 장착/템플릿 설치", "이동", true, v -> showCommandStore()));
        routePanel.addView(dashboardCard(R.drawable.ic_link, "내 방", "자동 연결과 구독 방 확인", "이동", true, v -> showRooms()));
        routePanel.addView(dashboardCard(R.drawable.ic_log, "로그", "게임 명령 응답/실패 확인", "이동", true, v -> showLogs()));

        Button saveButton = primaryButton("저장");
        saveButton.setOnClickListener(v -> saveGamePackSettings(packName, packEnabledSwitch));
        Button cancelButton = secondaryButton("취소");
        cancelButton.setOnClickListener(v -> showFeatureDashboard());
        Button resetButton = secondaryButton("초기화");
        resetButton.setOnClickListener(v -> {
            packEnabledSwitch.setChecked(BridgeConfig.gamesEnabled(this));
            Toast.makeText(this, "서버 상세 설정은 변경하지 않았습니다.", Toast.LENGTH_SHORT).show();
        });
        return withBottomActionBar(scrollView, saveButton, cancelButton, resetButton);
    }

    private View buildChecklistContent() {
        ScrollView scrollView = baseScrollView();

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        applyScreenPadding(root, 24);
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
        troublePanel.addView(stepText("2", "방이 다르면 앱의 방 관리에서 다시 동기화하거나 고급 설정에서 연결코드를 복사합니다."));
        troublePanel.addView(stepText("3", "라이선스 오류가 나오면 앱 방 상세의 연결코드와 저장된 방 정보를 확인합니다."));
        troublePanel.addView(stepText("4", "입장 확인은 방장봇 환영 문구가 입장확인 문구와 일치해야 합니다."));
        troublePanel.addView(stepText("5", "이 앱은 화면 감지/접근성 권한을 사용하지 않습니다. 화면을 켜두는 방식으로 운영하지 않습니다."));

        Button copyButton = primaryButton("체크리스트 복사");
        copyButton.setOnClickListener(v -> copyText("픽셀곰 테스트 체크리스트", checklistText()));
        root.addView(copyButton);

        Button guideButton = secondaryButton("방 관리 열기");
        guideButton.setOnClickListener(v -> showRooms());
        root.addView(guideButton);

        Button setupButton = secondaryButton("연결코드 직접 등록");
        setupButton.setOnClickListener(v -> showAdvanced());
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
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        applyScreenPadding(root, 24);
        scrollView.addView(root);

        root.addView(topBar("설정", "필요한 곳만 빠르게", true));

        LinearLayout hub = panel();
        hub.setPadding(dp(12), dp(10), dp(12), dp(12));
        root.addView(hub);
        hub.addView(sectionTitle("설정 메뉴"));
        hub.addView(settingCategoryRow(R.drawable.ic_settings, "일반", "서버, 권한, 대표방", "설정", v -> showConnectionSettings()));
        hub.addView(settingCategoryRow(R.drawable.ic_link, "방 설정", "자동 연결과 방별 관리", BridgeConfig.roomProfileCount(this) + "개", v -> showRooms()));
        hub.addView(settingCategoryRow(R.drawable.ic_checklist, "게임", "게임팩 상태와 도움말", BridgeConfig.gamesEnabled(this) ? "ON" : "OFF", v -> showFeatureDashboard()));
        hub.addView(settingCategoryRow(R.drawable.ic_sync, "명령어", "팩/템플릿 설치", "스토어", v -> showCommandStore()));
        hub.addView(settingCategoryRow(R.drawable.ic_log, "로그", "전송 기록 확인", "열기", v -> showLogs()));
        hub.addView(settingCategoryRow(R.drawable.ic_plus, "서비스 신청", "새 방 신청과 결제 확인", "신청", v -> showApplyService()));
        hub.addView(settingCategoryRow(R.drawable.ic_log, "문의/복구", "입금, 설치 오류, 삭제 방 복구", "접수", v -> showSupport()));
        hub.addView(settingCategoryRow(R.drawable.ic_settings, "고급", "연결코드, 초기화, JS", "지원", v -> showAdvanced()));
        return withBottomNav(scrollView, "settings");
    }

    private View buildConnectionSettingsContent() {
        ScrollView scrollView = baseScrollView();
        mainScrollView = scrollView;

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        applyScreenPadding(root, 24);
        scrollView.addView(root);

        root.addView(topBar("일반 설정", "서버·권한·대표방", true));

        permissionStatus = text("", 14, COLOR_TEXT, false);
        permissionStatus.setPadding(0, dp(14), 0, dp(8));
        root.addView(permissionStatus);

        Button permissionButton = primaryButton("알림 접근 권한 열기");
        permissionButton.setOnClickListener(v -> startActivity(new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)));
        root.addView(permissionButton);

        LinearLayout connectPanel = panel();
        connectPanel.setPadding(dp(16), dp(16), dp(16), dp(16));
        root.addView(connectPanel);
        connectPanel.addView(sectionHeader(R.drawable.pixgom_chat_portal, "연결", "브릿지와 서버 URL"));

        enabledSwitch = new Switch(this);
        enabledSwitch.setText("브릿지 사용");
        enabledSwitch.setTextSize(16);
        enabledSwitch.setTextColor(COLOR_TEXT);
        enabledSwitch.setChecked(BridgeConfig.isEnabled(this));
        enabledSwitch.setOnCheckedChangeListener((button, checked) -> BridgeConfig.setEnabled(this, checked));
        connectPanel.addView(enabledSwitch);

        serverUrlInput = input("서버 URL", BridgeConfig.serverUrl(this));
        connectPanel.addView(serverUrlInput);

        Button accountSyncButton = primaryButton("계정 기준 내 방 자동 연결");
        accountSyncButton.setOnClickListener(v -> showRooms());
        connectPanel.addView(accountSyncButton);

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

        LinearLayout toolPanel = panel();
        toolPanel.setPadding(dp(16), dp(16), dp(16), dp(16));
        root.addView(toolPanel);
        toolPanel.addView(sectionHeader(R.drawable.pixgom_checklist_calendar, "점검 도구", "저장은 하단 고정 버튼을 사용합니다."));
        Button testButton = secondaryButton("서버 테스트 전송");
        testButton.setOnClickListener(v -> sendTestEvent());
        toolPanel.addView(testButton);

        Button checklistButton = secondaryButton("테스트 체크리스트");
        checklistButton.setOnClickListener(v -> showChecklist());
        toolPanel.addView(checklistButton);

        Button diagnosisButton = secondaryButton("진단 내용 복사");
        diagnosisButton.setOnClickListener(v -> copyDiagnosis());
        toolPanel.addView(diagnosisButton);

        Button featureButton = secondaryButton("기능 대시보드");
        featureButton.setOnClickListener(v -> showFeatureDashboard());
        toolPanel.addView(featureButton);

        Button saveButton = primaryButton("저장");
        saveButton.setOnClickListener(v -> saveSettings());
        Button cancelButton = secondaryButton("취소");
        cancelButton.setOnClickListener(v -> showHome());
        Button resetButton = secondaryButton("초기화");
        resetButton.setContentDescription("서버 설정 초기화 / 등록 취소");
        resetButton.setOnClickListener(v -> confirmResetServerSettings());
        return withBottomActionBar(scrollView, saveButton, cancelButton, resetButton);
    }

    private View buildLogsContent() {
        ScrollView scrollView = baseScrollView();
        mainScrollView = scrollView;

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        applyScreenPadding(root, 16);
        scrollView.addView(root);

        root.addView(simpleTitleBar("로그", true, true));
        root.addView(logFilterRow());

        LinearLayout actionPanel = transparentStack();
        actionPanel.setPadding(0, 0, 0, dp(8));
        root.addView(actionPanel);
        actionPanel.addView(quickActionGrid(
                quickAction(R.drawable.ic_copy, "선택 로그 복사", "", v -> copyLogs()),
                quickAction(R.drawable.ic_share, "전체 내보내기", "", v -> shareLogs()),
                quickAction(R.drawable.ic_delete, "전체 삭제", "", v -> {
                    BridgeConfig.clearLogs(this);
                    refreshLogs();
                })
        ));

        logView = text("", 13, COLOR_TEXT, false);
        logView.setBackgroundResource(getResources().getIdentifier("log_background", "drawable", getPackageName()));
        logView.setPadding(dp(14), dp(14), dp(14), dp(14));
        root.addView(logView, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));
        return withBottomNav(scrollView, "logs");
    }

    private View buildAdvancedContent() {
        ScrollView scrollView = baseScrollView();

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        applyScreenPadding(root, 24);
        scrollView.addView(root);

        root.addView(topBar("고급 설정", "자주 쓰지 않는 기능", true));

        LinearLayout manualConnectPanel = panel();
        manualConnectPanel.setPadding(dp(16), dp(16), dp(16), dp(16));
        root.addView(manualConnectPanel);
        manualConnectPanel.addView(sectionHeader(R.drawable.pixgom_chat_portal, "연결코드 직접 등록", "로그인 문제나 운영자 지원 시 사용합니다."));

        serverUrlInput = input("서버 URL", BridgeConfig.serverUrl(this));
        manualConnectPanel.addView(serverUrlInput);

        connectionCodeInput = input("앱 연결코드", "");
        manualConnectPanel.addView(connectionCodeInput);

        Button findConnectCodeButton = secondaryButton("앱에서 연결코드 찾기");
        findConnectCodeButton.setOnClickListener(v -> showConnectCodePicker());
        manualConnectPanel.addView(findConnectCodeButton);

        Button connectButton = primaryButton("연결코드로 방 추가/갱신");
        connectButton.setOnClickListener(v -> connectWithCode());
        manualConnectPanel.addView(connectButton);

        LinearLayout supportPanel = panel();
        supportPanel.setPadding(dp(16), dp(16), dp(16), dp(16));
        root.addView(supportPanel);
        supportPanel.addView(sectionHeader(R.drawable.pixgom_support_bear, "지원", "도움말과 외부 링크"));

        Button privacyButton = secondaryButton("개인정보처리방침 열기");
        privacyButton.setOnClickListener(v -> openUrl(WEBSITE_URL + "/privacy"));
        supportPanel.addView(privacyButton);

        Button guideButton = secondaryButton("내 방 관리");
        guideButton.setOnClickListener(v -> showRooms());
        supportPanel.addView(guideButton);

        Button setupButton = secondaryButton("테스트 체크리스트");
        setupButton.setOnClickListener(v -> showChecklist());
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

        Button saveButton = primaryButton("저장");
        saveButton.setOnClickListener(v -> saveScriptSettings());
        Button cancelButton = secondaryButton("취소");
        cancelButton.setOnClickListener(v -> showHome());
        Button resetButton = secondaryButton("초기화");
        resetButton.setContentDescription("서버 설정 초기화 / 등록 취소");
        resetButton.setOnClickListener(v -> confirmResetServerSettings());
        return withBottomActionBar(scrollView, saveButton, cancelButton, resetButton);
    }

    private View buildIntroContent() {
        LinearLayout screen = new LinearLayout(this);
        screen.setOrientation(LinearLayout.VERTICAL);
        screen.setGravity(Gravity.CENTER);
        screen.setBackgroundColor(COLOR_BG);
        screen.setPadding(dp(24), topSafePadding(), dp(24), bottomSafePadding(24));
        screen.setOnClickListener(v -> finishIntro());

        ImageView logo = assetImage(R.drawable.pixgom_bridge_captain, 128);
        screen.addView(logo);

        TextView title = text("픽셀곰", 28, COLOR_TITLE, true);
        title.setGravity(Gravity.CENTER);
        title.setPadding(0, dp(14), 0, dp(4));
        screen.addView(title);

        TextView subtitle = text("카카오 오픈채팅 운영을 가볍게 연결합니다.", 14, COLOR_MUTED, false);
        subtitle.setGravity(Gravity.CENTER);
        screen.addView(subtitle);
        return screen;
    }

    private ScrollView baseScrollView() {
        ScrollView scrollView = new ScrollView(this);
        scrollView.setFillViewport(true);
        scrollView.setBackgroundResource(getResources().getIdentifier("app_background", "drawable", getPackageName()));
        return scrollView;
    }

    private void configureSystemBars() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            getWindow().setStatusBarColor(COLOR_BG);
            getWindow().setNavigationBarColor(COLOR_BG);
        }
        getWindow().getDecorView().setSystemUiVisibility(0);
    }

    private void applyScreenPadding(LinearLayout root, int bottomDp) {
        root.setPadding(dp(12), topSafePadding(), dp(12), bottomSafePadding(bottomDp));
    }

    private int topSafePadding() {
        return dp(12) + topSystemInset();
    }

    private int bottomSafePadding(int bottomDp) {
        return dp(bottomDp) + Math.min(bottomSystemInset(), dp(24));
    }

    private int topSystemInset() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            WindowInsets insets = getWindow().getDecorView().getRootWindowInsets();
            if (insets != null && insets.getStableInsetTop() > 0) return insets.getStableInsetTop();
        }
        return systemInset("status_bar_height", dp(24));
    }

    private int bottomSystemInset() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            WindowInsets insets = getWindow().getDecorView().getRootWindowInsets();
            if (insets != null && insets.getStableInsetBottom() > 0) return insets.getStableInsetBottom();
        }
        return systemInset("navigation_bar_height", 0);
    }

    private int systemInset(String name, int fallback) {
        int resourceId = getResources().getIdentifier(name, "dimen", "android");
        if (resourceId <= 0) return fallback;
        return getResources().getDimensionPixelSize(resourceId);
    }

    private View withBottomActionBar(ScrollView scrollView, Button primary, Button secondary, Button reset) {
        LinearLayout screen = new LinearLayout(this);
        screen.setOrientation(LinearLayout.VERTICAL);
        screen.setBackgroundColor(COLOR_BG);
        screen.addView(scrollView, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1));

        LinearLayout bar = new LinearLayout(this);
        bar.setOrientation(LinearLayout.HORIZONTAL);
        bar.setGravity(Gravity.CENTER_VERTICAL);
        bar.setPadding(dp(20), dp(10), dp(20), dp(16));
        bar.setBackgroundColor(COLOR_BG);
        addBottomActionButton(bar, secondary, 1);
        addBottomActionButton(bar, reset, 1);
        addBottomActionButton(bar, primary, 2);
        screen.addView(bar, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));
        return screen;
    }

    private View withBottomNav(ScrollView scrollView, String activeTab) {
        LinearLayout screen = new LinearLayout(this);
        screen.setOrientation(LinearLayout.VERTICAL);
        screen.setBackgroundColor(COLOR_BG);
        screen.addView(scrollView, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1));

        LinearLayout nav = new LinearLayout(this);
        nav.setOrientation(LinearLayout.HORIZONTAL);
        nav.setGravity(Gravity.CENTER);
        nav.setPadding(dp(8), dp(6), dp(8), bottomSafePadding(6));
        nav.setBackgroundColor(COLOR_PANEL);
        nav.addView(navButton(R.drawable.ic_home, "홈", "home".equals(activeTab), v -> showHome()));
        nav.addView(navButton(R.drawable.ic_link, "방 관리", "rooms".equals(activeTab), v -> showRooms()));
        nav.addView(navButton(R.drawable.ic_log, "로그", "logs".equals(activeTab), v -> showLogs()));
        nav.addView(navButton(R.drawable.ic_settings, "설정", "settings".equals(activeTab), v -> showSettings()));
        screen.addView(nav, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));
        return screen;
    }

    private LinearLayout navButton(int iconRes, String label, boolean active, View.OnClickListener listener) {
        LinearLayout item = new LinearLayout(this);
        item.setOrientation(LinearLayout.VERTICAL);
        item.setGravity(Gravity.CENTER);
        item.setPadding(0, dp(4), 0, dp(2));
        item.setOnClickListener(listener);
        item.setClickable(true);
        ImageView icon = new ImageView(this);
        icon.setImageResource(iconRes);
        icon.setColorFilter(active ? COLOR_BLUE : COLOR_MUTED);
        item.addView(icon, new LinearLayout.LayoutParams(dp(22), dp(22)));
        TextView text = singleLineText(label, 11, active ? COLOR_BLUE : COLOR_MUTED, true);
        text.setGravity(Gravity.CENTER);
        text.setPadding(0, dp(2), 0, 0);
        item.addView(text);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1);
        item.setLayoutParams(params);
        return item;
    }

    private void addBottomActionButton(LinearLayout bar, Button button, int weight) {
        button.setTextSize(14);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(0, dp(46), weight);
        params.setMargins(dp(4), 0, dp(4), 0);
        button.setLayoutParams(params);
        bar.addView(button);
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
        accountStatusView = null;
        nativeConsoleStatusView = null;
        loginEmailInput = null;
        loginPasswordInput = null;
        applyRoomNameInput = null;
        applyRoomLinkInput = null;
        applyAdminNameInput = null;
        applyContactInput = null;
        applyMemoInput = null;
        applyPurposeStatusView = null;
        selectableRoomsContainer = null;
        roomDetailContainer = null;
        supportContainer = null;
        roomSelectionChecks.clear();
        nativeConsoleMode = "";
        selectedRoomApplicationId = "";
        selectedRoomTab = "status";
        applyRoomPurpose = "general_room";
        applyLinkedApplicationId = "";
        gameRoomToggleButton = null;
        blockGamesInGeneralRoomSwitch = null;
        blockOpsInGameRoomSwitch = null;
        sharePointsAndInventorySwitch = null;
        enabledSwitch = null;
        scriptEnabledSwitch = null;
        attendanceFeatureSwitch = null;
        pointsFeatureSwitch = null;
        rankingsFeatureSwitch = null;
        historyFeatureSwitch = null;
        profilesFeatureSwitch = null;
        localJsFeatureSwitch = null;
        gamesFeatureSwitch = null;
        shopFeatureSwitch = null;
        customCommandsFeatureSwitch = null;
    }

    private LinearLayout topBar(String title, String subtitle, boolean showHomeButton) {
        LinearLayout bar = new LinearLayout(this);
        bar.setOrientation(LinearLayout.HORIZONTAL);
        bar.setGravity(Gravity.CENTER_VERTICAL);
        LinearLayout.LayoutParams barParams = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        barParams.setMargins(0, 0, 0, dp(8));
        bar.setLayoutParams(barParams);

        if (showHomeButton) {
            bar.addView(iconButton(R.drawable.ic_home, "홈으로", v -> showHome()));
        } else {
            ImageView logo = new ImageView(this);
            logo.setImageResource(R.mipmap.ic_launcher);
            logo.setAdjustViewBounds(true);
            logo.setScaleType(ImageView.ScaleType.FIT_CENTER);
            LinearLayout.LayoutParams logoParams = new LinearLayout.LayoutParams(dp(36), dp(36));
            logo.setLayoutParams(logoParams);
            bar.addView(logo);
        }

        LinearLayout copy = new LinearLayout(this);
        copy.setOrientation(LinearLayout.VERTICAL);
        copy.setPadding(dp(10), 0, dp(10), 0);
        TextView titleView = singleLineText(title, 17, COLOR_TITLE, true);
        TextView subtitleView = singleLineText(subtitle, 12, COLOR_MUTED, false);
        copy.addView(titleView);
        copy.addView(subtitleView);
        bar.addView(copy, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));

        if (!showHomeButton) {
            bar.addView(iconButton(R.drawable.ic_settings, "설정", v -> showSettings()));
        }
        return bar;
    }

    private LinearLayout homeHeader() {
        LinearLayout header = new LinearLayout(this);
        header.setOrientation(LinearLayout.HORIZONTAL);
        header.setGravity(Gravity.CENTER_VERTICAL);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        params.setMargins(0, 0, 0, dp(10));
        header.setLayoutParams(params);

        ImageView logo = new ImageView(this);
        logo.setImageResource(R.mipmap.ic_launcher);
        header.addView(logo, new LinearLayout.LayoutParams(dp(52), dp(52)));

        LinearLayout copy = new LinearLayout(this);
        copy.setOrientation(LinearLayout.VERTICAL);
        copy.setPadding(dp(10), 0, 0, 0);
        copy.addView(singleLineText("픽셀곰", 21, COLOR_TITLE, true));
        copy.addView(singleLineText("브릿지", 13, COLOR_MUTED, false));
        header.addView(copy, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        header.addView(iconButton(R.drawable.ic_settings, "설정", v -> showSettings()));
        return header;
    }

    private LinearLayout homeBridgeHero(BridgeConfig.RoomProfile profile) {
        LinearLayout card = glassPanel();
        card.setOrientation(LinearLayout.HORIZONTAL);
        card.setGravity(Gravity.CENTER_VERTICAL);
        card.setPadding(dp(16), dp(14), dp(12), dp(14));
        card.setBackground(roundedBackground(BridgeConfig.isEnabled(this) ? COLOR_GREEN_PANEL : COLOR_RED_PANEL, BridgeConfig.isEnabled(this) ? COLOR_GOOD : COLOR_BAD, 12));

        LinearLayout copy = new LinearLayout(this);
        copy.setOrientation(LinearLayout.VERTICAL);
        TextView title = singleLineText(BridgeConfig.isEnabled(this) ? "● 브릿지 실행 중" : "● 브릿지 정지", 21, BridgeConfig.isEnabled(this) ? COLOR_GOOD : COLOR_BAD, true);
        copy.addView(title);
        copy.addView(singleLineText(BridgeConfig.roomProfileCount(this) + "개 방에 연결되어 있습니다.", 13, COLOR_TEXT, false));
        if (!TextUtils.isEmpty(profile.name)) copy.addView(singleLineText("대표방 " + profile.name, 12, COLOR_MUTED, false));
        card.addView(copy, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));

        ImageButton power = iconButton(R.drawable.ic_power, BridgeConfig.isEnabled(this) ? "브릿지 정지" : "브릿지 시작", v -> toggleBridgeEnabled());
        power.setBackground(roundedBackground(Color.rgb(16, 185, 129), Color.rgb(16, 185, 129), 999));
        LinearLayout.LayoutParams powerParams = new LinearLayout.LayoutParams(dp(64), dp(64));
        powerParams.setMargins(dp(12), 0, 0, 0);
        card.addView(power, powerParams);
        return card;
    }

    private LinearLayout homeActionRow() {
        return quickActionGrid(
                quickAction(R.drawable.ic_link, "연결 확인", "", v -> syncFromHome()),
                quickAction(R.drawable.ic_sync, "자동 연결", "", v -> showRooms()),
                quickAction(R.drawable.ic_more, "더보기", "", v -> showSettings())
        );
    }

    private LinearLayout homeMetricGrid() {
        return statusTileGrid(
                metricTile("연결된 방", BridgeConfig.roomProfileCount(this) + "개", true),
                metricTile("구독 상태", subscriptionStatusLabel(), true),
                metricTile("서버 상태", "정상", true),
                metricTile("대기 큐", BridgeConfig.pendingEventCount(this) + "건", BridgeConfig.pendingEventCount(this) == 0),
                metricTile("최근 응답", shortTimingStatus(), !shortTimingStatus().contains("실패")),
                metricTile("실패 로그", failureCountLabel() + "건", "0".equals(failureCountLabel()))
        );
    }

    private LinearLayout metricTile(String label, String value, boolean ok) {
        LinearLayout tile = glassPanel();
        tile.setPadding(dp(8), dp(7), dp(8), dp(7));
        tile.setMinimumHeight(dp(66));
        tile.addView(singleLineText(label, 12, COLOR_MUTED, false));
        TextView valueView = singleLineText(value, 17, ok ? COLOR_TITLE : COLOR_BAD, true);
        valueView.setPadding(0, dp(2), 0, 0);
        tile.addView(valueView);
        return tile;
    }

    private LinearLayout homeRoomPreview() {
        LinearLayout panel = transparentStack();
        panel.setPadding(0, dp(4), 0, 0);
        panel.addView(sectionHeaderLine("연결된 방", "전체 보기", v -> showRooms()));
        List<BridgeConfig.RoomProfile> profiles = BridgeConfig.roomProfiles(this);
        int limit = Math.min(3, profiles.size());
        if (limit == 0) {
            panel.addView(infoCard(R.drawable.ic_link, "연결된 방이 없습니다. 자동 연결을 먼저 진행해 주세요."));
            return panel;
        }
        for (int index = 0; index < limit; index++) {
            BridgeConfig.RoomProfile room = profiles.get(index);
            panel.addView(homeRoomRow(room.name, BridgeConfig.isEnabled(this), index));
        }
        return panel;
    }

    private LinearLayout homeRoomRow(String name, boolean on, int index) {
        LinearLayout row = glassPanel();
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER_VERTICAL);
        row.setPadding(dp(10), dp(8), dp(10), dp(8));
        row.addView(iconSquare(R.drawable.ic_users, roomColorForIndex(index), dp(28)));
        TextView title = singleLineText(safeText(name), 13, COLOR_TEXT, true);
        title.setPadding(dp(10), 0, dp(8), 0);
        row.addView(title, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        row.addView(statusPill(on ? "ON" : "OFF", on));
        row.addView(singleLineText("최근 응답 " + shortTimingStatus(), 11, COLOR_MUTED, false));
        row.addView(chevronText());
        row.setOnClickListener(v -> showRooms());
        return row;
    }

    private LinearLayout homeLogPreview() {
        LinearLayout panel = transparentStack();
        panel.setPadding(0, dp(4), 0, 0);
        panel.addView(sectionHeaderLine("최근 로그", "전체 보기", v -> showLogs()));
        TextView logs = text(formatLogsForList(BridgeConfig.logsForDisplay(this), "all", 3), 12, COLOR_TEXT, false);
        logs.setBackground(roundedBackground(COLOR_CARD_ALPHA, Color.rgb(36, 54, 72), 10));
        logs.setPadding(dp(12), dp(10), dp(12), dp(10));
        panel.addView(logs);
        return panel;
    }

    private LinearLayout simpleTitleBar(String title, boolean back, boolean settings) {
        LinearLayout bar = new LinearLayout(this);
        bar.setOrientation(LinearLayout.HORIZONTAL);
        bar.setGravity(Gravity.CENTER_VERTICAL);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(46));
        params.setMargins(0, 0, 0, dp(8));
        bar.setLayoutParams(params);
        if (back) bar.addView(iconButton(R.drawable.ic_back, "뒤로", v -> showHome()));
        TextView titleView = singleLineText(title, 20, COLOR_TITLE, true);
        titleView.setGravity(Gravity.CENTER_VERTICAL);
        titleView.setPadding(back ? dp(8) : 0, 0, 0, 0);
        bar.addView(titleView, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, 1));
        if (settings) bar.addView(iconButton(R.drawable.ic_settings, "설정", v -> showSettings()));
        return bar;
    }

    private LinearLayout roomsTitleBar() {
        LinearLayout bar = simpleTitleBar("방 관리", false, false);
        bar.addView(iconButton(R.drawable.ic_search, "검색", v -> showRoomSearchDialog()));
        bar.addView(iconButton(R.drawable.ic_filter, "필터", v -> showRoomFilterDialog()));
        bar.addView(iconButton(R.drawable.ic_plus, "방 추가", v -> showApplyService()));
        return bar;
    }

    private LinearLayout roomDetailTitleBar() {
        LinearLayout bar = new LinearLayout(this);
        bar.setOrientation(LinearLayout.HORIZONTAL);
        bar.setGravity(Gravity.CENTER_VERTICAL);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(46));
        params.setMargins(0, 0, 0, dp(8));
        bar.setLayoutParams(params);
        bar.addView(iconButton(R.drawable.ic_back, "방 관리로", v -> showRooms()));
        TextView titleView = singleLineText(selectedRoomNameLabel(), 20, COLOR_TITLE, true);
        titleView.setPadding(dp(8), 0, 0, 0);
        bar.addView(titleView, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, 1));
        bar.addView(iconButton(R.drawable.ic_settings, "방 설정", v -> showRoomDetail(selectedRoomApplicationId, "settings")));
        return bar;
    }

    private LinearLayout roomFilterRow() {
        LinearLayout row = horizontalScrollRow();
        row.addView(filterChip("전체 " + BridgeConfig.roomProfileCount(this), "all", true));
        row.addView(filterChip("실행 중", "on", true));
        row.addView(filterChip("정지", "off", true));
        row.addView(filterChip("문제 있음", "issue", true));
        return row;
    }

    private LinearLayout logFilterRow() {
        LinearLayout row = horizontalScrollRow();
        row.addView(filterChip("전체", "all", false));
        row.addView(filterChip("성공", "success", false));
        row.addView(filterChip("실패", "fail", false));
        row.addView(filterChip("무시", "ignore", false));
        row.addView(iconButton(R.drawable.ic_filter, "로그 필터", v -> showLogFilterDialog()));
        return row;
    }

    private LinearLayout horizontalScrollRow() {
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER_VERTICAL);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        params.setMargins(0, dp(4), 0, dp(8));
        row.setLayoutParams(params);
        return row;
    }

    private Button filterChip(String label, String mode, boolean rooms) {
        boolean active = rooms ? mode.equals(roomFilterMode) : mode.equals(logFilterMode);
        Button button = baseButton(label);
        button.setTextSize(12);
        button.setTextColor(active ? Color.WHITE : COLOR_MUTED);
        button.setBackground(roundedBackground(active ? COLOR_BLUE : COLOR_CARD_SOFT, active ? COLOR_BLUE : Color.rgb(46, 68, 87), 999));
        button.setOnClickListener(v -> {
            if (rooms) {
                roomFilterMode = mode;
                if (buyerConsoleJson != null) renderRoomChoices(buyerConsoleJson);
                showRooms();
            } else {
                logFilterMode = mode;
                if ("room_detail".equals(nativeConsoleMode) && !TextUtils.isEmpty(selectedRoomApplicationId)) {
                    showRoomDetail(selectedRoomApplicationId, "logs");
                } else {
                    showLogs();
                }
            }
        });
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, dp(34));
        params.setMargins(0, 0, dp(8), 0);
        button.setLayoutParams(params);
        button.setMinWidth(dp(60));
        return button;
    }

    private void showRoomSearchDialog() {
        final EditText input = input("방 이름, roomId, 역할 검색", roomSearchQuery);
        input.setSingleLine(true);
        new AlertDialog.Builder(this)
                .setTitle("방 검색")
                .setView(input)
                .setPositiveButton("검색", (dialog, which) -> {
                    roomSearchQuery = input.getText().toString().trim();
                    showRooms();
                })
                .setNegativeButton("초기화", (dialog, which) -> {
                    roomSearchQuery = "";
                    showRooms();
                })
                .show();
    }

    private void showRoomFilterDialog() {
        final String[] labels = {"전체", "실행 중", "정지", "문제 있음"};
        final String[] modes = {"all", "on", "off", "issue"};
        int checked = 0;
        for (int index = 0; index < modes.length; index++) {
            if (modes[index].equals(roomFilterMode)) checked = index;
        }
        new AlertDialog.Builder(this)
                .setTitle("방 필터")
                .setSingleChoiceItems(labels, checked, (dialog, which) -> {
                    roomFilterMode = modes[which];
                    dialog.dismiss();
                    showRooms();
                })
                .setNegativeButton("닫기", null)
                .show();
    }

    private void showLogFilterDialog() {
        final String[] labels = {"전체", "성공", "실패", "무시"};
        final String[] modes = {"all", "success", "fail", "ignore"};
        int checked = 0;
        for (int index = 0; index < modes.length; index++) {
            if (modes[index].equals(logFilterMode)) checked = index;
        }
        new AlertDialog.Builder(this)
                .setTitle("로그 필터")
                .setSingleChoiceItems(labels, checked, (dialog, which) -> {
                    logFilterMode = modes[which];
                    dialog.dismiss();
                    if ("room_detail".equals(nativeConsoleMode) && !TextUtils.isEmpty(selectedRoomApplicationId)) {
                        showRoomDetail(selectedRoomApplicationId, "logs");
                    } else {
                        showLogs();
                    }
                })
                .setNegativeButton("닫기", null)
                .show();
    }

    private TextView roomTabText(String applicationId, String tab, String label) {
        boolean active = tab.equals(selectedRoomTab);
        TextView view = singleLineText(label, 13, active ? COLOR_BLUE : COLOR_MUTED, true);
        view.setGravity(Gravity.CENTER);
        view.setBackground(roundedBackground(Color.TRANSPARENT, active ? COLOR_BLUE : Color.TRANSPARENT, 0));
        view.setOnClickListener(v -> showRoomDetail(applicationId, tab));
        view.setClickable(true);
        view.setPadding(0, 0, 0, 0);
        view.setLayoutParams(new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, 1));
        return view;
    }

    private String selectedRoomNameLabel() {
        JSONObject room = consoleRoomByApplicationId(buyerConsoleJson, selectedRoomApplicationId);
        if (room != null) return room.optString("roomName", "방 상세");
        if (!TextUtils.isEmpty(selectedRoomApplicationId)) return "방 상세";
        return "방 이름";
    }

    private LinearLayout roomStatusHero(JSONObject room, boolean ok) {
        LinearLayout card = glassPanel();
        card.setOrientation(LinearLayout.HORIZONTAL);
        card.setGravity(Gravity.CENTER_VERTICAL);
        card.setPadding(dp(14), dp(14), dp(10), dp(14));
        card.setBackground(roundedBackground(ok ? COLOR_GREEN_PANEL : COLOR_RED_PANEL, ok ? COLOR_GOOD : COLOR_BAD, 10));
        LinearLayout copy = new LinearLayout(this);
        copy.setOrientation(LinearLayout.VERTICAL);
        copy.addView(singleLineText(ok ? "● 브릿지 실행 중" : "● 확인 필요", 21, ok ? COLOR_GOOD : COLOR_BAD, true));
        copy.addView(singleLineText(ok ? "이 방은 정상적으로 운영 중입니다." : "설정 또는 연결 상태를 확인해 주세요.", 13, COLOR_TEXT, false));
        card.addView(copy, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        ImageView bear = assetImage(ok ? R.drawable.pixgom_bridge_captain : R.drawable.pixgom_support_bear, 74);
        card.addView(bear, new LinearLayout.LayoutParams(dp(74), dp(74)));
        return card;
    }

    private LinearLayout featureLine(int iconRes, String title, String body) {
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER_VERTICAL);
        row.setPadding(0, dp(8), 0, dp(8));
        row.addView(iconSquare(iconRes, COLOR_BLUE, dp(42)));
        LinearLayout copy = new LinearLayout(this);
        copy.setOrientation(LinearLayout.VERTICAL);
        copy.setPadding(dp(12), 0, 0, 0);
        copy.addView(singleLineText(title, 14, COLOR_TITLE, true));
        copy.addView(singleLineText(body, 12, COLOR_MUTED, false));
        row.addView(copy, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        return row;
    }

    private LinearLayout sectionHeaderLine(String title, String action, View.OnClickListener listener) {
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER_VERTICAL);
        row.setPadding(0, dp(8), 0, dp(2));
        row.addView(singleLineText(title, 15, COLOR_TITLE, true), new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        TextView actionView = singleLineText(action + " ›", 12, COLOR_MUTED, false);
        actionView.setGravity(Gravity.END);
        actionView.setOnClickListener(listener);
        row.addView(actionView);
        return row;
    }

    private ImageButton iconButton(int iconRes, String description, View.OnClickListener listener) {
        ImageButton button = new ImageButton(this);
        button.setImageResource(iconRes);
        button.setColorFilter(COLOR_TITLE);
        button.setBackgroundResource(getResources().getIdentifier("icon_button_background", "drawable", getPackageName()));
        button.setContentDescription(description);
        button.setPadding(dp(10), dp(10), dp(10), dp(10));
        button.setOnClickListener(listener);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(dp(42), dp(42));
        button.setLayoutParams(params);
        return button;
    }

    private LinearLayout quickAction(int iconRes, String label, String hint, View.OnClickListener listener) {
        LinearLayout action = new LinearLayout(this);
        action.setOrientation(LinearLayout.VERTICAL);
        action.setGravity(Gravity.CENTER);
        action.setPadding(dp(6), dp(8), dp(6), dp(8));
        int cardColor = COLOR_CARD_SOFT;
        if (label.contains("연결 확인")) cardColor = COLOR_BLUE;
        if (label.contains("자동 연결")) cardColor = Color.rgb(124, 58, 237);
        action.setBackground(roundedBackground(cardColor, Color.rgb(48, 69, 88), 10));
        action.setOnClickListener(listener);
        action.setClickable(true);
        action.setMinimumHeight(dp(78));

        ImageView icon = new ImageView(this);
        icon.setImageResource(iconRes);
        icon.setColorFilter(Color.WHITE);
        icon.setAdjustViewBounds(true);
        action.addView(icon, new LinearLayout.LayoutParams(dp(22), dp(22)));

        TextView labelView = singleLineText(label, 12, COLOR_TITLE, true);
        labelView.setGravity(Gravity.CENTER);
        labelView.setPadding(0, dp(5), 0, 0);
        action.addView(labelView);

        if (!TextUtils.isEmpty(hint)) {
            TextView hintView = singleLineText(hint, 10, COLOR_MUTED, false);
            hintView.setGravity(Gravity.CENTER);
            action.addView(hintView);
        }
        return action;
    }

    private LinearLayout quickActionGrid(View... actions) {
        LinearLayout grid = new LinearLayout(this);
        grid.setOrientation(LinearLayout.VERTICAL);
        LinearLayout.LayoutParams gridParams = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        gridParams.setMargins(0, dp(8), 0, 0);
        grid.setLayoutParams(gridParams);

        int columns = actions.length == 4 ? 2 : actions.length >= 3 ? 3 : 2;
        for (int i = 0; i < actions.length; i += columns) {
            LinearLayout row = new LinearLayout(this);
            row.setOrientation(LinearLayout.HORIZONTAL);
            LinearLayout.LayoutParams rowParams = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
            rowParams.setMargins(0, dp(6), 0, 0);
            row.setLayoutParams(rowParams);
            for (int offset = 0; offset < columns && i + offset < actions.length; offset++) {
                View action = actions[i + offset];
                LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1);
                params.setMargins(offset == 0 ? 0 : dp(4), 0, offset == columns - 1 ? 0 : dp(4), 0);
                action.setLayoutParams(params);
                row.addView(action);
            }
            grid.addView(row);
        }
        return grid;
    }

    private LinearLayout statusTileGrid(View... tiles) {
        LinearLayout grid = new LinearLayout(this);
        grid.setOrientation(LinearLayout.VERTICAL);
        int columns = tiles.length >= 6 ? 3 : 2;
        for (int i = 0; i < tiles.length; i += columns) {
            LinearLayout row = new LinearLayout(this);
            row.setOrientation(LinearLayout.HORIZONTAL);
            LinearLayout.LayoutParams rowParams = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
            rowParams.setMargins(0, 0, 0, dp(6));
            row.setLayoutParams(rowParams);
            for (int offset = 0; offset < columns && i + offset < tiles.length; offset++) {
                View tile = tiles[i + offset];
                LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1);
                params.setMargins(offset == 0 ? 0 : dp(3), 0, offset == columns - 1 ? 0 : dp(3), 0);
                tile.setLayoutParams(params);
                row.addView(tile);
            }
            grid.addView(row);
        }
        return grid;
    }

    private LinearLayout heroPanel(int imageRes, String eyebrow, String title, String body) {
        LinearLayout layout = panel();
        layout.setGravity(Gravity.CENTER);
        layout.setPadding(dp(16), dp(16), dp(16), dp(18));

        ImageView image = assetImage(imageRes, 124);
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

    private LinearLayout compactHeroPanel(int imageRes, String title, String body) {
        LinearLayout layout = panel();
        layout.setOrientation(LinearLayout.HORIZONTAL);
        layout.setGravity(Gravity.CENTER_VERTICAL);
        layout.setPadding(dp(10), dp(10), dp(10), dp(10));

        ImageView image = assetImage(imageRes, 54);
        layout.addView(image);

        LinearLayout copy = new LinearLayout(this);
        copy.setOrientation(LinearLayout.VERTICAL);
        copy.setPadding(dp(10), 0, 0, 0);
        copy.addView(text(title, 17, COLOR_TITLE, true));
        TextView bodyView = text(body, 13, COLOR_MUTED, false);
        bodyView.setPadding(0, dp(3), 0, 0);
        copy.addView(bodyView);
        layout.addView(copy, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        return layout;
    }

    private LinearLayout compactSummaryPanel(String title, String body) {
        LinearLayout layout = panel();
        layout.setPadding(dp(12), dp(10), dp(12), dp(10));
        TextView titleView = text(title, 17, COLOR_TITLE, true);
        TextView bodyView = text(body, 13, COLOR_MUTED, false);
        bodyView.setPadding(0, dp(3), 0, 0);
        layout.addView(titleView);
        layout.addView(bodyView);
        return layout;
    }

    private LinearLayout operatorHomePanel(BridgeConfig.RoomProfile profile) {
        LinearLayout layout = panel();
        layout.setPadding(dp(12), dp(10), dp(12), dp(10));
        layout.addView(sectionTitle("운영 상태"));
        layout.addView(compactStatusStrip(
                compactStatusChip("브릿지", BridgeConfig.isEnabled(this) ? "ON" : "OFF", BridgeConfig.isEnabled(this)),
                compactStatusChip("방", BridgeConfig.roomProfileCount(this) + "개", BridgeConfig.roomProfileCount(this) > 0),
                compactStatusChip("구독", subscriptionStatusLabel(), "확인됨".equals(subscriptionStatusLabel())),
                compactStatusChip("대기", BridgeConfig.pendingEventCount(this) + "개", BridgeConfig.pendingEventCount(this) == 0),
                compactStatusChip("응답", shortTimingStatus(), !shortTimingStatus().contains("실패")),
                compactStatusChip("권한", notificationPermissionEnabled() ? "허용" : "필요", notificationPermissionEnabled())
        ));

        TextView room = singleLineText("대표방  " + (TextUtils.isEmpty(profile.name) ? "등록 필요" : profile.name), 13, COLOR_TEXT, true);
        room.setPadding(0, dp(6), 0, 0);
        layout.addView(room);
        TextView account = singleLineText("계정  " + accountLabel(), 12, COLOR_MUTED, false);
        account.setPadding(0, dp(2), 0, 0);
        layout.addView(account);

        homeDiagnosticsStatus = text("서버 진단: 확인 중", 12, COLOR_MUTED, true);
        homeDiagnosticsStatus.setPadding(0, dp(5), 0, 0);
        homeDiagnosticsStatus.setMaxLines(2);
        homeDiagnosticsStatus.setEllipsize(TextUtils.TruncateAt.END);
        layout.addView(homeDiagnosticsStatus);
        return layout;
    }

    private LinearLayout compactStatusStrip(View... chips) {
        LinearLayout grid = new LinearLayout(this);
        grid.setOrientation(LinearLayout.VERTICAL);
        for (int i = 0; i < chips.length; i += 2) {
            LinearLayout row = new LinearLayout(this);
            row.setOrientation(LinearLayout.HORIZONTAL);
            LinearLayout.LayoutParams rowParams = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
            rowParams.setMargins(0, i == 0 ? 0 : dp(6), 0, 0);
            row.setLayoutParams(rowParams);
            for (int offset = 0; offset < 2 && i + offset < chips.length; offset++) {
                View chip = chips[i + offset];
                LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(0, dp(38), 1);
                params.setMargins(offset == 0 ? 0 : dp(3), 0, offset == 0 ? dp(3) : 0, 0);
                chip.setLayoutParams(params);
                row.addView(chip);
            }
            grid.addView(row);
        }
        return grid;
    }

    private LinearLayout compactStatusChip(String label, String value, boolean ok) {
        LinearLayout chip = new LinearLayout(this);
        chip.setOrientation(LinearLayout.HORIZONTAL);
        chip.setGravity(Gravity.CENTER_VERTICAL);
        chip.setPadding(dp(8), 0, dp(8), 0);
        chip.setBackgroundResource(getResources().getIdentifier("status_tile_background", "drawable", getPackageName()));

        TextView labelView = singleLineText(label, 11, COLOR_MUTED, true);
        chip.addView(labelView, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));

        TextView valueView = singleLineText(value, 12, ok ? COLOR_GOOD : COLOR_WARN, true);
        valueView.setGravity(Gravity.END | Gravity.CENTER_VERTICAL);
        chip.addView(valueView, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        return chip;
    }

    private LinearLayout settingCategoryRow(int iconRes, String title, String body, String status, View.OnClickListener listener) {
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER_VERTICAL);
        row.setPadding(dp(10), dp(8), dp(10), dp(8));
        row.setBackgroundResource(getResources().getIdentifier("status_tile_background", "drawable", getPackageName()));
        row.setClickable(true);
        row.setOnClickListener(listener);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        params.setMargins(0, dp(7), 0, 0);
        row.setLayoutParams(params);

        ImageView icon = new ImageView(this);
        icon.setImageResource(iconRes);
        icon.setColorFilter(COLOR_BLUE);
        row.addView(icon, new LinearLayout.LayoutParams(dp(24), dp(24)));

        LinearLayout copy = new LinearLayout(this);
        copy.setOrientation(LinearLayout.VERTICAL);
        copy.setPadding(dp(10), 0, dp(8), 0);
        copy.addView(singleLineText(title, 15, COLOR_TITLE, true));
        copy.addView(singleLineText(body, 12, COLOR_MUTED, false));
        row.addView(copy, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));

        row.addView(statusBadge(status, true));
        return row;
    }

    private LinearLayout featurePanel(int imageRes, String title, String body) {
        LinearLayout layout = panel();
        layout.setOrientation(LinearLayout.HORIZONTAL);
        layout.setGravity(Gravity.CENTER_VERTICAL);
        layout.setPadding(dp(10), dp(10), dp(10), dp(10));

        ImageView image = assetImage(imageRes, 52);
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

    private LinearLayout dashboardCard(int iconRes, String title, String body, String status, boolean ok, View.OnClickListener listener) {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.HORIZONTAL);
        card.setGravity(Gravity.CENTER_VERTICAL);
        card.setPadding(dp(12), dp(12), dp(12), dp(12));
        card.setBackgroundResource(getResources().getIdentifier("status_tile_background", "drawable", getPackageName()));
        card.setClickable(true);
        card.setOnClickListener(listener);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        params.setMargins(0, dp(8), 0, 0);
        card.setLayoutParams(params);

        ImageView icon = new ImageView(this);
        icon.setImageResource(iconRes);
        icon.setColorFilter(ok ? COLOR_BLUE : COLOR_WARN);
        card.addView(icon, new LinearLayout.LayoutParams(dp(28), dp(28)));

        LinearLayout copy = new LinearLayout(this);
        copy.setOrientation(LinearLayout.VERTICAL);
        copy.setPadding(dp(12), 0, dp(8), 0);
        copy.addView(singleLineText(title, 15, COLOR_TITLE, true));
        TextView bodyView = singleLineText(body, 12, COLOR_MUTED, false);
        bodyView.setPadding(0, dp(3), 0, 0);
        copy.addView(bodyView);
        card.addView(copy, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));

        card.addView(statusBadge(status, ok));
        return card;
    }

    private TextView statusBadge(String value, boolean ok) {
        TextView badge = singleLineText(value, 12, ok ? COLOR_GOOD : COLOR_WARN, true);
        badge.setGravity(Gravity.CENTER);
        badge.setPadding(dp(8), dp(5), dp(8), dp(5));
        badge.setBackgroundResource(getResources().getIdentifier("icon_button_background", "drawable", getPackageName()));
        return badge;
    }

    private LinearLayout sectionHeader(int imageRes, String title, String body) {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.HORIZONTAL);
        layout.setGravity(Gravity.CENTER_VERTICAL);
        layout.setPadding(0, 0, 0, dp(10));

        ImageView image = assetImage(imageRes, 42);
        layout.addView(image);

        LinearLayout copy = new LinearLayout(this);
        copy.setOrientation(LinearLayout.VERTICAL);
        copy.setPadding(dp(10), 0, 0, 0);
        TextView titleView = singleLineText(title, 16, COLOR_TITLE, true);
        TextView bodyView = singleLineText(body, 12, COLOR_MUTED, false);
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

    private void initializeKakaoIfReady() {
        if (!kakaoReady() || kakaoInitialized) return;
        KakaoSdk.init(this, BuildConfig.KAKAO_NATIVE_APP_KEY);
        kakaoInitialized = true;
    }

    private boolean kakaoReady() {
        return !TextUtils.isEmpty(BuildConfig.KAKAO_NATIVE_APP_KEY);
    }

    private String accountLabel() {
        String nickname = BridgeConfig.buyerNickname(this);
        String email = BridgeConfig.buyerEmail(this);
        if (!TextUtils.isEmpty(nickname) && !TextUtils.isEmpty(email)) return nickname + " / " + email;
        if (!TextUtils.isEmpty(email)) return email;
        if (!TextUtils.isEmpty(nickname)) return nickname;
        return BridgeConfig.isBuyerLoggedIn(this) ? "로그인됨" : "로그인 필요";
    }

    private String subscriptionStatusLabel() {
        if (!BridgeConfig.isBuyerLoggedIn(this)) return "로그인 필요";
        String summary = BridgeConfig.lastConsoleSummary(this);
        if (TextUtils.isEmpty(summary)) return "확인 필요";
        if (summary.contains("0개")) return "승인 방 없음";
        return "확인됨";
    }

    private String shortTimingStatus() {
        String failure = BridgeConfig.lastSendFailure(this);
        if (!TextUtils.isEmpty(failure)) return "실패 확인";
        String timing = BridgeConfig.lastServerTimingSummary(this);
        return TextUtils.isEmpty(timing) ? "기록 없음" : shortStatus(timing);
    }

    private void loginWithEmail() {
        String email = loginEmailInput == null ? "" : loginEmailInput.getText().toString().trim();
        String password = loginPasswordInput == null ? "" : loginPasswordInput.getText().toString();
        if (TextUtils.isEmpty(email) || TextUtils.isEmpty(password)) {
            Toast.makeText(this, "이메일과 비밀번호를 입력하세요.", Toast.LENGTH_SHORT).show();
            return;
        }
        if (accountStatusView != null) accountStatusView.setText("로그인 중입니다.");
        executor.execute(() -> {
            EventSender.ApiResult result = EventSender.loginStart(this, email, password);
            runOnUiThread(() -> {
                if (result.ok() && result.json.optBoolean("twoFactorRequired", false)) {
                    showOtpVerify(result.json.optString("email", email), result.json.optString("challengeToken", ""));
                    return;
                }
                handleLoginResult(result, "이메일 로그인");
            });
        });
    }

    private void signupWithEmail() {
        String email = signupEmailInput == null ? "" : signupEmailInput.getText().toString().trim();
        String password = signupPasswordInput == null ? "" : signupPasswordInput.getText().toString();
        String passwordConfirm = signupPasswordConfirmInput == null ? "" : signupPasswordConfirmInput.getText().toString();
        String nickname = signupNicknameInput == null ? "" : signupNicknameInput.getText().toString().trim();
        if (TextUtils.isEmpty(email) || TextUtils.isEmpty(password) || TextUtils.isEmpty(passwordConfirm)) {
            Toast.makeText(this, "이메일과 비밀번호를 입력하세요.", Toast.LENGTH_SHORT).show();
            return;
        }
        if (!password.equals(passwordConfirm)) {
            Toast.makeText(this, "비밀번호 확인이 일치하지 않습니다.", Toast.LENGTH_SHORT).show();
            return;
        }
        if (accountStatusView != null) accountStatusView.setText("계정을 만드는 중입니다.");
        executor.execute(() -> {
            EventSender.ApiResult result = EventSender.signup(this, email, password, passwordConfirm, nickname);
            runOnUiThread(() -> {
                if (result.ok()) {
                    Toast.makeText(this, "회원가입이 완료되었습니다. 로그인해 주세요.", Toast.LENGTH_LONG).show();
                    showEmailLogin();
                } else {
                    String message = authErrorMessage(result, "회원가입에 실패했습니다.");
                    if (accountStatusView != null) accountStatusView.setText(message);
                    Toast.makeText(this, message, Toast.LENGTH_LONG).show();
                }
            });
        });
    }

    private void verifyEmailOtp() {
        String code = otpCodeInput == null ? "" : otpCodeInput.getText().toString().trim();
        if (TextUtils.isEmpty(code)) {
            Toast.makeText(this, "인증번호를 입력하세요.", Toast.LENGTH_SHORT).show();
            return;
        }
        if (accountStatusView != null) accountStatusView.setText("인증번호 확인 중입니다.");
        executor.execute(() -> {
            EventSender.ApiResult result = EventSender.loginVerify(this, otpEmail, otpChallengeToken, code);
            runOnUiThread(() -> handleLoginResult(result, "이메일 2단계 인증"));
        });
    }

    private void requestPasswordReset(String email) {
        if (TextUtils.isEmpty(email)) {
            Toast.makeText(this, "이메일을 입력하세요.", Toast.LENGTH_SHORT).show();
            return;
        }
        executor.execute(() -> {
            EventSender.ApiResult result = EventSender.requestPasswordReset(this, email);
            runOnUiThread(() -> Toast.makeText(
                    this,
                    result.ok() ? "재설정 메일을 보냈습니다. 이메일을 확인해 주세요." : "전송 실패: " + authErrorMessage(result, "다시 시도해 주세요."),
                    Toast.LENGTH_LONG
            ).show());
        });
    }

    private void loginGoogleAppleOAuth(String provider) {
        String label = "apple".equals(provider) ? "Apple" : "Google";
        if (accountStatusView != null) accountStatusView.setText(label + " 로그인 준비 상태 확인 중입니다.");
        executor.execute(() -> {
            EventSender.ApiResult result = EventSender.socialStart(this, provider);
            runOnUiThread(() -> {
                if (!result.ok()) {
                    String message = authErrorMessage(result, label + " 로그인 준비가 필요합니다.");
                    if (accountStatusView != null) accountStatusView.setText(message);
                    Toast.makeText(this, message, Toast.LENGTH_LONG).show();
                    return;
                }
                String url = result.json.optString("url", "");
                if (TextUtils.isEmpty(url)) {
                    String message = label + " 로그인 URL을 받을 수 없습니다.";
                    if (accountStatusView != null) accountStatusView.setText(message);
                    Toast.makeText(this, message, Toast.LENGTH_LONG).show();
                    return;
                }
                openUrl(url);
                if (accountStatusView != null) accountStatusView.setText(label + " 로그인 후 앱으로 돌아와 주세요.");
            });
        });
    }

    private void loginWithKakao() {
        if (!kakaoReady()) {
            Toast.makeText(this, "카카오 Native app key 등록 후 사용할 수 있습니다.", Toast.LENGTH_LONG).show();
            return;
        }
        initializeKakaoIfReady();
        UserApiClient.getInstance().loginWithKakaoTalk(this, (OAuthToken token, Throwable error) -> {
            if (error != null || token == null) {
                UserApiClient.getInstance().loginWithKakaoAccount(this, (OAuthToken accountToken, Throwable accountError) -> {
                    if (accountError != null || accountToken == null) {
                        Toast.makeText(this, "카카오 로그인 실패: " + (accountError == null ? "token_missing" : accountError.getMessage()), Toast.LENGTH_LONG).show();
                    } else {
                        loginWithKakaoToken(accountToken.getAccessToken());
                    }
                    return Unit.INSTANCE;
                });
            } else {
                loginWithKakaoToken(token.getAccessToken());
            }
            return Unit.INSTANCE;
        });
    }

    private void loginWithKakaoToken(String accessToken) {
        if (accountStatusView != null) accountStatusView.setText("카카오 계정 확인 중입니다.");
        executor.execute(() -> {
            EventSender.ApiResult result = EventSender.loginKakao(this, accessToken);
            runOnUiThread(() -> handleLoginResult(result, "카카오 로그인"));
        });
    }

    private void linkKakaoAccount() {
        if (!BridgeConfig.isBuyerLoggedIn(this) || !kakaoReady()) return;
        initializeKakaoIfReady();
        UserApiClient.getInstance().loginWithKakaoTalk(this, (OAuthToken token, Throwable error) -> {
            if (error != null || token == null) {
                UserApiClient.getInstance().loginWithKakaoAccount(this, (OAuthToken accountToken, Throwable accountError) -> {
                    if (accountError != null || accountToken == null) {
                        Toast.makeText(this, "카카오 연결 실패: " + (accountError == null ? "token_missing" : accountError.getMessage()), Toast.LENGTH_LONG).show();
                    } else {
                        linkKakaoToken(accountToken.getAccessToken());
                    }
                    return Unit.INSTANCE;
                });
            } else {
                linkKakaoToken(token.getAccessToken());
            }
            return Unit.INSTANCE;
        });
    }

    private void linkKakaoToken(String accessToken) {
        executor.execute(() -> {
            EventSender.ApiResult result = EventSender.linkKakao(this, BridgeConfig.buyerToken(this), accessToken);
            runOnUiThread(() -> {
                if (result.ok()) {
                    saveBuyerSession(result.json);
                    Toast.makeText(this, "카카오 계정을 연결했습니다.", Toast.LENGTH_SHORT).show();
                    showAccount();
                } else {
                    Toast.makeText(this, "카카오 연결 실패: " + authErrorMessage(result, "다시 시도해 주세요."), Toast.LENGTH_LONG).show();
                }
            });
        });
    }

    private String authErrorMessage(EventSender.ApiResult result, String fallback) {
        String code = "";
        if (result != null && result.json != null) {
            code = result.json.optString("error", "");
            if (TextUtils.isEmpty(code)) code = result.json.optString("message", "");
        }
        if (TextUtils.isEmpty(code) && result != null) code = result.error;
        if (TextUtils.isEmpty(code)) return fallback;
        switch (code) {
            case "invalid_login":
                return "이메일 또는 비밀번호를 확인해 주세요.";
            case "invalid_or_expired_challenge":
                return "인증 시간이 지났습니다. 다시 로그인해 주세요.";
            case "invalid_otp":
            case "invalid_token":
            case "otp_verification_failed":
                return "인증번호를 다시 확인해 주세요.";
            case "email_required":
                return "이메일을 입력해 주세요.";
            case "password_too_short":
                return "비밀번호는 8자 이상 입력해 주세요.";
            case "password_mismatch":
                return "비밀번호 확인이 일치하지 않습니다.";
            case "nickname_required":
                return "닉네임을 입력해 주세요.";
            case "terms_required":
            case "privacy_required":
                return "필수 약관 동의가 필요합니다.";
            case "email_already_registered":
                return "이미 가입된 이메일입니다. 로그인해 주세요.";
            case "nickname_invalid":
                return "닉네임은 2~30자로 입력해 주세요.";
            case "application_id_required":
                return "문의할 방을 선택해 주세요.";
            case "inquiry_message_required":
                return "문의 내용을 입력해 주세요.";
            case "room_name_required":
                return "방 이름을 입력해 주세요.";
            case "openchat_link_required":
                return "오픈채팅 링크를 확인해 주세요.";
            case "admin_name_required":
                return "방 관리자 닉네임을 입력해 주세요.";
            case "linked_room_approval_required":
                return "게임방 추가는 승인된 대표방이 필요합니다.";
            case "game_room_already_exists":
                return "이미 연결된 게임방 신청이 있습니다.";
            case "archived_room_not_found":
                return "복구할 보관 방을 찾지 못했습니다.";
            case "restore_request_forbidden":
                return "이 계정으로 복구 요청할 수 없는 방입니다.";
            case "social_provider_not_configured":
                return "아직 사용할 수 없는 로그인 방식입니다.";
            case "supabase_login_unavailable":
                return "로그인 서버 설정을 확인해 주세요.";
            case "kakao_account_not_linked":
                return "이메일 로그인 후 카카오 계정을 연결해 주세요.";
            case "account_mismatch":
                return "인증 계정이 다릅니다. 처음부터 다시 로그인해 주세요.";
            default:
                return code.contains("_") ? fallback : code;
        }
    }

    private void showProfileEditDialog() {
        final EditText nicknameInput = authInput("닉네임", BridgeConfig.buyerNickname(this));
        new AlertDialog.Builder(this)
                .setTitle("닉네임 수정")
                .setMessage("앱과 구매자 콘솔에 표시되는 이름입니다.")
                .setView(nicknameInput)
                .setPositiveButton("저장", (dialog, which) -> saveBuyerProfile(nicknameInput.getText().toString().trim()))
                .setNegativeButton("취소", null)
                .show();
    }

    private void saveBuyerProfile(String nickname) {
        if (TextUtils.isEmpty(nickname)) {
            Toast.makeText(this, "닉네임을 입력해 주세요.", Toast.LENGTH_SHORT).show();
            return;
        }
        executor.execute(() -> {
            EventSender.ApiResult result = EventSender.saveBuyerProfile(this, BridgeConfig.buyerToken(this), nickname);
            runOnUiThread(() -> {
                if (result.ok()) {
                    saveBuyerSession(result.json);
                    Toast.makeText(this, "계정 정보를 저장했습니다.", Toast.LENGTH_SHORT).show();
                    showAccount();
                } else {
                    Toast.makeText(this, "저장 실패: " + authErrorMessage(result, "다시 시도해 주세요."), Toast.LENGTH_LONG).show();
                }
            });
        });
    }

    private void setApplyPurpose(String purpose, String linkedApplicationId) {
        applyRoomPurpose = TextUtils.isEmpty(purpose) ? "general_room" : purpose;
        applyLinkedApplicationId = linkedApplicationId == null ? "" : linkedApplicationId;
        if ("game_room".equals(applyRoomPurpose) && TextUtils.isEmpty(applyLinkedApplicationId)) {
            applyRoomPurpose = "general_room";
            Toast.makeText(this, "게임방 추가는 승인된 대표방이 필요합니다.", Toast.LENGTH_LONG).show();
        }
        if (applyPurposeStatusView != null) applyPurposeStatusView.setText(applyPurposeLabel());
    }

    private String applyPurposeLabel() {
        if ("game_room".equals(applyRoomPurpose)) return "게임방 추가 신청 · 대표방 연결";
        return "일반 운영방 신청";
    }

    private String firstApprovedApplicationId() {
        JSONArray rooms = buyerConsoleJson == null ? null : buyerConsoleJson.optJSONArray("rooms");
        if (rooms == null) return "";
        String fallback = "";
        for (int index = 0; index < rooms.length(); index++) {
            JSONObject room = rooms.optJSONObject(index);
            if (room == null) continue;
            String applicationId = room.optString("applicationId", "");
            if (TextUtils.isEmpty(fallback)) fallback = applicationId;
            if (!"game".equals(room.optString("roomRole", "")) && !TextUtils.isEmpty(applicationId)) return applicationId;
        }
        return fallback;
    }

    private void submitServiceApplication() {
        String roomName = applyRoomNameInput == null ? "" : applyRoomNameInput.getText().toString().trim();
        String roomLink = applyRoomLinkInput == null ? "" : applyRoomLinkInput.getText().toString().trim();
        String adminName = applyAdminNameInput == null ? "" : applyAdminNameInput.getText().toString().trim();
        String contact = applyContactInput == null ? "" : applyContactInput.getText().toString().trim();
        String memo = applyMemoInput == null ? "" : applyMemoInput.getText().toString().trim();
        if (TextUtils.isEmpty(roomName) || TextUtils.isEmpty(roomLink) || TextUtils.isEmpty(adminName)) {
            Toast.makeText(this, "방 이름, 오픈채팅 링크, 관리자 닉네임을 입력해 주세요.", Toast.LENGTH_LONG).show();
            return;
        }
        if ("game_room".equals(applyRoomPurpose) && TextUtils.isEmpty(applyLinkedApplicationId)) {
            Toast.makeText(this, "게임방 추가는 승인된 대표방이 필요합니다.", Toast.LENGTH_LONG).show();
            return;
        }
        executor.execute(() -> {
            EventSender.ApiResult result = EventSender.applyService(
                    this,
                    BridgeConfig.buyerToken(this),
                    BridgeConfig.buyerEmail(this),
                    roomName,
                    roomLink,
                    adminName,
                    contact,
                    memo,
                    applyRoomPurpose,
                    applyLinkedApplicationId);
            runOnUiThread(() -> {
                if (result.ok()) {
                    BridgeConfig.appendLog(this, "서비스 신청 접수: " + roomName);
                    Toast.makeText(this, "서비스 신청이 접수되었습니다. 결제 확인 요청은 문의/복구에서 보낼 수 있습니다.", Toast.LENGTH_LONG).show();
                    showSupport();
                } else {
                    Toast.makeText(this, "신청 실패: " + authErrorMessage(result, "입력값을 확인해 주세요."), Toast.LENGTH_LONG).show();
                }
            });
        });
    }

    private void showApplicationInquiryDialog(String applicationId, String roomName) {
        showApplicationInquiryDialog(applicationId, roomName, "other", "");
    }

    private void showApplicationInquiryDialog(String applicationId, String roomName, String type, String presetMessage) {
        LinearLayout form = new LinearLayout(this);
        form.setOrientation(LinearLayout.VERTICAL);
        form.setPadding(dp(4), dp(4), dp(4), 0);
        form.addView(text(roomName, 14, COLOR_TEXT, true));
        final EditText messageInput = multiLineInput(presetMessage == null ? "" : presetMessage, 4);
        messageInput.setHint("입금 확인, 설치 오류, 연결 문제 등을 짧게 적어 주세요.");
        form.addView(messageInput);
        new AlertDialog.Builder(this)
                .setTitle("문의 등록")
                .setView(form)
                .setPositiveButton("접수", (dialog, which) -> submitApplicationInquiry(applicationId, roomName, type, messageInput.getText().toString()))
                .setNegativeButton("취소", null)
                .show();
    }

    private void submitApplicationInquiry(String applicationId, String roomName, String type, String message) {
        if (TextUtils.isEmpty(applicationId) || TextUtils.isEmpty(message.trim())) {
            Toast.makeText(this, "문의할 방과 내용을 확인해 주세요.", Toast.LENGTH_SHORT).show();
            return;
        }
        executor.execute(() -> {
            EventSender.ApiResult result = EventSender.createApplicationInquiry(this, BridgeConfig.buyerToken(this), applicationId, type, message);
            runOnUiThread(() -> {
                if (result.ok()) {
                    BridgeConfig.appendLog(this, "문의 접수: " + roomName);
                    Toast.makeText(this, "문의가 접수되었습니다.", Toast.LENGTH_SHORT).show();
                    loadBuyerConsole();
                } else {
                    Toast.makeText(this, "문의 실패: " + authErrorMessage(result, "다시 시도해 주세요."), Toast.LENGTH_LONG).show();
                }
            });
        });
    }

    private void showRestoreRequestDialog(JSONObject archive) {
        String roomName = archive == null ? "보관 방" : archive.optString("roomName", "보관 방");
        LinearLayout form = new LinearLayout(this);
        form.setOrientation(LinearLayout.VERTICAL);
        form.setPadding(dp(4), dp(4), dp(4), 0);
        form.addView(text(roomName, 14, COLOR_TEXT, true));
        final EditText reasonInput = multiLineInput("앱에서 복구 요청", 3);
        reasonInput.setHint("복구가 필요한 이유를 입력해 주세요.");
        form.addView(reasonInput);
        new AlertDialog.Builder(this)
                .setTitle("방 복구 요청")
                .setView(form)
                .setPositiveButton("요청", (dialog, which) -> submitRestoreRequest(
                        archive == null ? "" : archive.optString("id", ""),
                        roomName,
                        reasonInput.getText().toString()))
                .setNegativeButton("취소", null)
                .show();
    }

    private void submitRestoreRequest(String archiveId, String roomName, String reason) {
        if (TextUtils.isEmpty(archiveId)) {
            Toast.makeText(this, "복구할 방을 찾지 못했습니다.", Toast.LENGTH_SHORT).show();
            return;
        }
        executor.execute(() -> {
            EventSender.ApiResult result = EventSender.createRestoreRequest(this, BridgeConfig.buyerToken(this), archiveId, reason);
            runOnUiThread(() -> {
                if (result.ok()) {
                    BridgeConfig.appendLog(this, "복구 요청: " + roomName);
                    Toast.makeText(this, result.json.optBoolean("duplicate", false) ? "이미 접수된 복구 요청입니다." : "복구 요청이 접수되었습니다.", Toast.LENGTH_SHORT).show();
                    loadBuyerConsole();
                } else {
                    Toast.makeText(this, "복구 요청 실패: " + authErrorMessage(result, "다시 시도해 주세요."), Toast.LENGTH_LONG).show();
                }
            });
        });
    }

    private void handleLoginResult(EventSender.ApiResult result, String label) {
        if (!result.ok()) {
            String message = authErrorMessage(result, "로그인에 실패했습니다.");
            if (accountStatusView != null) accountStatusView.setText(message);
            Toast.makeText(this, message, Toast.LENGTH_LONG).show();
            return;
        }
        saveBuyerSession(result.json);
        BridgeConfig.appendLog(this, label + " 완료 / 앱 콘솔 세션 저장");
        showLoginComplete();
    }

    private void saveBuyerSession(JSONObject json) {
        JSONObject account = json == null ? null : json.optJSONObject("account");
        BridgeConfig.setBuyerSession(
                this,
                json == null ? "" : json.optString("guideToken", BridgeConfig.buyerToken(this)),
                account == null ? BridgeConfig.buyerEmail(this) : account.optString("email", BridgeConfig.buyerEmail(this)),
                account == null ? BridgeConfig.buyerNickname(this) : account.optString("nickname", BridgeConfig.buyerNickname(this))
        );
    }

    private void loadBuyerConsole() {
        if (!BridgeConfig.isBuyerLoggedIn(this)) return;
        if (nativeConsoleStatusView != null) nativeConsoleStatusView.setText("콘솔 데이터를 불러오는 중입니다.");
        executor.execute(() -> {
            EventSender.ApiResult result = EventSender.buyerConsole(this, BridgeConfig.buyerToken(this));
            runOnUiThread(() -> {
                if (!result.ok()) {
                    if (nativeConsoleStatusView != null) nativeConsoleStatusView.setText("콘솔 로딩 실패: " + result.error);
                    return;
                }
                buyerConsoleJson = result.json;
                saveBuyerSession(result.json);
                JSONArray rooms = result.json.optJSONArray("rooms");
                int roomCount = rooms == null ? 0 : rooms.length();
                BridgeConfig.setLastConsoleSummary(this, "연결 가능 방 " + roomCount + "개 / " + accountLabel());
                if (nativeConsoleStatusView != null) nativeConsoleStatusView.setText("연결 가능 방 " + roomCount + "개");
                renderRoomChoices(result.json);
                renderCommandStore(result.json);
                renderRoomDetail(result.json);
                renderSupportContent(result.json);
            });
        });
    }

    private void renderRoomChoices(JSONObject consoleJson) {
        if (selectableRoomsContainer == null || !"rooms".equals(nativeConsoleMode)) return;
        selectableRoomsContainer.removeAllViews();
        roomSelectionChecks.clear();
        JSONArray rooms = consoleJson.optJSONArray("rooms");
        if (rooms == null || rooms.length() == 0) {
            selectableRoomsContainer.addView(text("승인/결제 완료된 방이 없습니다.", 14, COLOR_MUTED, false));
            return;
        }
        for (int index = 0; index < rooms.length(); index++) {
            JSONObject room = rooms.optJSONObject(index);
            if (room == null) continue;
            if (!roomMatchesFilter(room)) continue;
            selectableRoomsContainer.addView(selectableRoomCard(room));
        }
        if (selectableRoomsContainer.getChildCount() == 0) {
            selectableRoomsContainer.addView(text("현재 필터에 맞는 방이 없습니다.", 14, COLOR_MUTED, false));
        }
    }

    private void renderSupportContent(JSONObject consoleJson) {
        if (supportContainer == null || !"support".equals(nativeConsoleMode)) return;
        supportContainer.removeAllViews();
        if (consoleJson == null) {
            supportContainer.addView(text("콘솔 데이터를 불러오는 중입니다.", 14, COLOR_MUTED, false));
            return;
        }

        supportContainer.addView(sectionTitle("신청/결제 확인"));
        JSONArray applications = consoleJson.optJSONArray("applications");
        int applicationCount = applications == null ? 0 : applications.length();
        if (applicationCount == 0) {
            supportContainer.addView(settingCategoryRow(
                    R.drawable.ic_plus,
                    "새 서비스 신청",
                    "앱에서 새 운영방 정보를 접수합니다.",
                    "신청",
                    v -> showApplyService()));
        } else {
            for (int index = 0; index < Math.min(applicationCount, 6); index++) {
                JSONObject application = applications.optJSONObject(index);
                if (application == null) continue;
                JSONObject payment = application.optJSONObject("payment");
                String applicationId = application.optString("id", "");
                String roomName = application.optString("roomName", "신청 방");
                String status = application.optString("statusLabel", "결제 대기");
                String paymentStatus = payment == null ? "" : payment.optString("statusLabel", "");
                String body = TextUtils.isEmpty(paymentStatus) ? status : status + " · " + paymentStatus;
                supportContainer.addView(settingCategoryRow(
                        R.drawable.ic_plus,
                        roomName,
                        body,
                        "결제확인",
                        v -> showApplicationInquiryDialog(applicationId, roomName, "payment_check", "입금 확인 요청합니다.")));
            }
        }

        JSONArray rooms = consoleJson.optJSONArray("rooms");
        supportContainer.addView(sectionTitle("방별 문의"));
        if (rooms == null || rooms.length() == 0) {
            supportContainer.addView(text("문의할 승인 방이 없습니다.", 14, COLOR_MUTED, false));
        } else {
            for (int index = 0; index < rooms.length(); index++) {
                JSONObject room = rooms.optJSONObject(index);
                if (room == null) continue;
                String applicationId = room.optString("applicationId", "");
                String roomName = room.optString("roomName", "방");
                String body = room.optString("subscriptionStatusLabel", "상태 확인") + " · " + roomSetupLabel(room);
                supportContainer.addView(settingCategoryRow(
                        R.drawable.ic_log,
                        roomName,
                        body,
                        "문의",
                        v -> showApplicationInquiryDialog(applicationId, roomName)));
            }
        }

        supportContainer.addView(sectionTitle("문의 처리 상태"));
        JSONArray inquiries = consoleJson.optJSONArray("inquiries");
        if (inquiries == null || inquiries.length() == 0) {
            supportContainer.addView(text("접수된 문의가 없습니다.", 14, COLOR_MUTED, false));
        } else {
            int limit = Math.min(inquiries.length(), 5);
            for (int index = 0; index < limit; index++) {
                JSONObject inquiry = inquiries.optJSONObject(index);
                if (inquiry != null) supportContainer.addView(supportStatusCard(
                        inquiry.optString("typeLabel", "문의"),
                        inquiry.optString("roomName", "방"),
                        inquiry.optString("statusLabel", "접수"),
                        inquiry.optString("message", "")));
            }
        }

        supportContainer.addView(sectionTitle("삭제 방 복구"));
        JSONArray archivedRooms = consoleJson.optJSONArray("archivedRooms");
        if (archivedRooms == null || archivedRooms.length() == 0) {
            supportContainer.addView(text("복구 요청 가능한 보관 방이 없습니다.", 14, COLOR_MUTED, false));
        } else {
            for (int index = 0; index < archivedRooms.length(); index++) {
                JSONObject archive = archivedRooms.optJSONObject(index);
                if (archive == null) continue;
                JSONObject request = restoreRequestForArchive(consoleJson, archive.optString("id", ""));
                boolean requested = request != null && !"resolved".equals(request.optString("status", ""));
                String status = requested ? request.optString("statusLabel", "요청됨") : "복구";
                supportContainer.addView(settingCategoryRow(
                        R.drawable.ic_sync,
                        archive.optString("roomName", "보관 방"),
                        shortSupportText(archive.optString("reason", archive.optString("archivedAt", ""))),
                        status,
                        v -> {
                            if (requested) {
                                Toast.makeText(this, "이미 복구 요청이 접수되어 있습니다.", Toast.LENGTH_SHORT).show();
                            } else {
                                showRestoreRequestDialog(archive);
                            }
                        }));
            }
        }

        Button refresh = secondaryButton("문의/복구 상태 새로고침");
        refresh.setOnClickListener(v -> loadBuyerConsole());
        supportContainer.addView(refresh);
    }

    private LinearLayout supportStatusCard(String title, String roomName, String status, String message) {
        LinearLayout card = glassPanel();
        card.setPadding(dp(10), dp(9), dp(10), dp(10));
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER_VERTICAL);
        row.addView(singleLineText(title + " · " + roomName, 14, COLOR_TITLE, true), new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        boolean open = !"처리 완료".equals(status) && !"완료".equals(status);
        row.addView(statusBadge(status, open));
        card.addView(row);
        if (!TextUtils.isEmpty(message)) card.addView(singleLineText(shortSupportText(message), 12, COLOR_MUTED, false));
        return card;
    }

    private JSONObject restoreRequestForArchive(JSONObject consoleJson, String archiveId) {
        JSONArray requests = consoleJson == null ? null : consoleJson.optJSONArray("restoreRequests");
        if (requests == null) return null;
        for (int index = 0; index < requests.length(); index++) {
            JSONObject request = requests.optJSONObject(index);
            if (request != null && archiveId.equals(request.optString("archiveId", ""))) return request;
        }
        return null;
    }

    private String shortSupportText(String value) {
        String text = safeText(value).replace("\n", " / ");
        if (TextUtils.isEmpty(text)) return "상세 내용 없음";
        return text.length() > 52 ? text.substring(0, 49) + "..." : text;
    }

    private LinearLayout selectableRoomCard(JSONObject room) {
        String applicationId = room.optString("applicationId", "");
        boolean ok = !"expired".equals(room.optString("subscriptionStatus", "")) && !"off".equalsIgnoreCase(room.optString("bridgeStatus", ""));
        boolean issue = roomSetupLabel(room).contains("필요") || "expired".equals(room.optString("subscriptionStatus", ""));
        LinearLayout card = glassPanel();
        card.setPadding(dp(12), dp(12), dp(10), dp(12));
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        params.setMargins(0, dp(10), 0, 0);
        card.setLayoutParams(params);
        card.setClickable(true);
        card.setOnClickListener(v -> showRoomDetail(applicationId, "status"));

        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER_VERTICAL);
        card.addView(row);

        row.addView(iconSquare("game".equals(room.optString("roomRole", "")) ? R.drawable.ic_checklist : R.drawable.ic_users,
                roomColorForIndex(Math.abs(applicationId.hashCode()) % 5), dp(52)));

        String packs = commandPackCountLabel(room);
        String setup = roomSetupLabel(room);
        LinearLayout copy = new LinearLayout(this);
        copy.setOrientation(LinearLayout.VERTICAL);
        copy.setPadding(dp(12), 0, dp(8), 0);
        copy.addView(singleLineText(room.optString("roomName", "방"), 16, COLOR_TITLE, true));
        copy.addView(singleLineText((ok ? "브릿지 ON" : "브릿지 OFF") + " · 최근 응답 " + roomLastResponseLabel(room), 12, ok ? COLOR_GOOD : COLOR_BAD, true));
        copy.addView(singleLineText(packs + " · " + setup, 12, COLOR_MUTED, false));
        row.addView(copy, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));

        row.addView(statusPill(issue ? "문제 있음" : (ok ? "ON" : "OFF"), !issue && ok));
        row.addView(chevronText());
        return card;
    }

    private LinearLayout roomOpenCard(JSONObject room) {
        String applicationId = room.optString("applicationId", "");
        LinearLayout card = dashboardCard(
                "game".equals(room.optString("roomRole", "")) ? R.drawable.ic_checklist : R.drawable.ic_home,
                room.optString("roomName", "방"),
                roomRoleLabel(room) + " · " + room.optString("bridgeStatus", "상태 확인") + " · " + room.optString("roomId", ""),
                room.optString("subscriptionStatusLabel", "확인"),
                !"expired".equals(room.optString("subscriptionStatus", "")),
                v -> showRoomDetail(applicationId, "status")
        );
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        params.setMargins(0, dp(8), 0, dp(4));
        card.setLayoutParams(params);
        return card;
    }

    private void renderCommandStore(JSONObject consoleJson) {
        if (selectableRoomsContainer == null || !"store".equals(nativeConsoleMode)) return;
        while (selectableRoomsContainer.getChildCount() > 1) selectableRoomsContainer.removeViewAt(1);
        String applicationId = consoleApplicationIdOrFirst(consoleJson, commandStoreTargetApplicationId);
        if (TextUtils.isEmpty(applicationId)) {
            selectableRoomsContainer.addView(text("명령어를 설치할 승인 방이 없습니다.", 14, COLOR_MUTED, false));
            return;
        }
        JSONObject targetRoom = consoleRoomByApplicationId(consoleJson, applicationId);
        selectableRoomsContainer.addView(infoCard(R.drawable.ic_users, "적용 대상: " + (targetRoom == null ? "첫 번째 승인 방" : targetRoom.optString("roomName", "승인 방"))));
        JSONObject commandPacks = consoleJson.optJSONObject("commandPacks");
        JSONArray packs = commandPacks == null ? null : commandPacks.optJSONArray("packs");
        int packLimit = packs == null ? 0 : Math.min(8, packs.length());
        for (int index = 0; index < packLimit; index++) {
            JSONObject pack = packs.optJSONObject(index);
            if (pack == null) continue;
            selectableRoomsContainer.addView(storeAction(
                    pack.optString("title", "명령어팩"),
                    pack.optString("description", ""),
                    "장착",
                    v -> applyCommandPack(applicationId, pack.optString("id", ""))
            ));
        }
        JSONObject commandStore = consoleJson.optJSONObject("commandStore");
        JSONArray templates = commandStore == null ? null : commandStore.optJSONArray("templates");
        int templateLimit = templates == null ? 0 : Math.min(6, templates.length());
        if (templateLimit > 0) selectableRoomsContainer.addView(sectionTitle("개별 템플릿"));
        for (int index = 0; index < templateLimit; index++) {
            JSONObject template = templates.optJSONObject(index);
            if (template == null || !template.optBoolean("installable", false)) continue;
            selectableRoomsContainer.addView(storeAction(
                    template.optString("title", template.optString("trigger", "템플릿")),
                    template.optString("response", ""),
                    "설치",
                    v -> installCommandTemplate(applicationId, template.optString("id", ""))
            ));
        }
    }

    private void renderRoomDetail(JSONObject consoleJson) {
        if (roomDetailContainer == null || !"room_detail".equals(nativeConsoleMode)) return;
        roomDetailContainer.removeAllViews();
        JSONObject room = consoleRoomByApplicationId(consoleJson, selectedRoomApplicationId);
        if (room == null) {
            roomDetailContainer.addView(text("관리할 방을 찾지 못했습니다. 내 방에서 다시 선택해 주세요.", 14, COLOR_MUTED, false));
            return;
        }
        selectedRoomApplicationId = room.optString("applicationId", selectedRoomApplicationId);
        if (nativeConsoleStatusView != null) {
            nativeConsoleStatusView.setText(room.optString("roomName", "방") + " · " + room.optString("subscriptionStatusLabel", "상태 확인"));
        }

        roomDetailContainer.addView(roomTabGrid(room.optString("applicationId", "")));

        if ("settings".equals(selectedRoomTab)) {
            renderRoomSettingsTab(roomDetailContainer, room);
        } else if ("commands".equals(selectedRoomTab)) {
            renderRoomCommandsTab(roomDetailContainer, room, consoleJson);
        } else if ("logs".equals(selectedRoomTab)) {
            renderRoomLogsTab(roomDetailContainer, room);
        } else if ("games".equals(selectedRoomTab)) {
            renderRoomGamePacksTab(roomDetailContainer, room, consoleJson);
        } else {
            renderRoomStatusTab(roomDetailContainer, room);
        }
    }

    private LinearLayout roomTabGrid(String applicationId) {
        LinearLayout tabs = new LinearLayout(this);
        tabs.setOrientation(LinearLayout.HORIZONTAL);
        tabs.setGravity(Gravity.CENTER_VERTICAL);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(44));
        params.setMargins(0, dp(2), 0, dp(10));
        tabs.setLayoutParams(params);
        tabs.addView(roomTabText(applicationId, "status", "상태"));
        tabs.addView(roomTabText(applicationId, "settings", "설정"));
        tabs.addView(roomTabText(applicationId, "commands", "명령어"));
        tabs.addView(roomTabText(applicationId, "games", "게임팩"));
        tabs.addView(roomTabText(applicationId, "logs", "로그"));
        return tabs;
    }

    private Button roomTabButton(String applicationId, String tab, String label) {
        Button button = tab.equals(selectedRoomTab) ? primaryButton(label) : secondaryButton(label);
        button.setOnClickListener(v -> showRoomDetail(applicationId, tab));
        return button;
    }

    private void renderRoomStatusTab(LinearLayout parent, JSONObject room) {
        boolean ok = !"expired".equals(room.optString("subscriptionStatus", ""));
        parent.addView(roomStatusHero(room, ok));
        LinearLayout status = glassPanel();
        status.setPadding(dp(14), dp(12), dp(14), dp(12));
        parent.addView(status);
        status.addView(labelValue("브릿지 상태", BridgeConfig.isEnabled(this) ? "ON" : "OFF"));
        status.addView(labelValue("구독 상태", room.optString("subscriptionStatusLabel", "정상")));
        status.addView(labelValue("최근 응답", roomLastResponseLabel(room)));
        status.addView(labelValue("대기 큐", BridgeConfig.pendingEventCount(this) + "건"));
        status.addView(labelValue("실패 로그", failureCountLabel() + "건"));
        status.addView(labelValue("설치된 팩", commandPackCountLabel(room)));
        status.addView(labelValue("연결 코드", maskLicense(roomConnectCode(room))));

        Button stopButton = iconTextButton(R.drawable.ic_power, BridgeConfig.isEnabled(this) ? "이 방 브릿지 정지" : "이 방 브릿지 시작", false);
        stopButton.setOnClickListener(v -> toggleBridgeEnabled());
        parent.addView(stopButton);
        Button checkButton = iconTextButton(R.drawable.ic_sync, "연결 다시 확인", false);
        checkButton.setOnClickListener(v -> syncFromHome());
        parent.addView(checkButton);
        Button codeButton = iconTextButton(R.drawable.ic_copy, "연결코드 복사", false);
        codeButton.setOnClickListener(v -> copyRoomConnectCode(room));
        parent.addView(codeButton);
    }

    private void renderRoomSettingsTab(LinearLayout parent, JSONObject room) {
        String applicationId = room.optString("applicationId", "");
        JSONObject features = room.optJSONObject("features");
        if (!"overview".equals(roomSettingsCategory)) {
            renderRoomSettingCategoryDetail(parent, room, applicationId, features);
            return;
        }
        parent.addView(sectionTitle("설정 카테고리"));
        parent.addView(settingCategoryRow(R.drawable.ic_settings, "기본 설정", "방 이름, 운영 모드, 응답 속도", "열기", v -> openRoomSettingCategory(applicationId, "basic")));
        parent.addView(settingCategoryRow(R.drawable.ic_log, "응답 설정", "자동 응답, 접두어, 무시 키워드", "열기", v -> openRoomSettingCategory(applicationId, "response")));
        parent.addView(settingCategoryRow(R.drawable.ic_shield, "운영 제한", "도배 방지, 쿨타임, 야간 모드", "열기", v -> openRoomSettingCategory(applicationId, "limits")));
        parent.addView(settingCategoryRow(R.drawable.ic_link, "고급 설정", "연결 코드, 서버 재연결, 초기화", "열기", v -> showAdvanced()));

        parent.addView(sectionTitle("개별 기능"));
        attendanceFeatureSwitch = settingSwitch("출석", roomFeatureChecked(features, "attendance", true));
        pointsFeatureSwitch = settingSwitch("포인트", roomFeatureChecked(features, "points", true));
        rankingsFeatureSwitch = settingSwitch("랭킹", roomFeatureChecked(features, "rankings", true));
        historyFeatureSwitch = settingSwitch("히스토리", roomFeatureChecked(features, "history", true));
        profilesFeatureSwitch = settingSwitch("프로필", roomFeatureChecked(features, "profiles", true));
        localJsFeatureSwitch = settingSwitch("JS 자동응답", roomFeatureChecked(features, "localJs", true));
        gamesFeatureSwitch = settingSwitch("게임", roomFeatureChecked(features, "games", false));
        shopFeatureSwitch = settingSwitch("상점/가방", roomFeatureChecked(features, "shop", true));
        customCommandsFeatureSwitch = settingSwitch("커스텀 명령어", roomFeatureChecked(features, "customCommands", true));
        parent.addView(attendanceFeatureSwitch);
        parent.addView(pointsFeatureSwitch);
        parent.addView(rankingsFeatureSwitch);
        parent.addView(historyFeatureSwitch);
        parent.addView(profilesFeatureSwitch);
        parent.addView(localJsFeatureSwitch);
        parent.addView(gamesFeatureSwitch);
        parent.addView(shopFeatureSwitch);
        parent.addView(customCommandsFeatureSwitch);

        parent.addView(sectionTitle("분리 설정"));
        boolean isGameRoom = "game_room".equals(room.optString("roomPurpose", ""));
        if (isGameRoom) {
            parent.addView(text("게임방은 기준 일반방의 분리 설정을 따릅니다.", 14, COLOR_MUTED, false));
        } else {
            JSONObject mode = roomModeSplit(room);
            blockGamesInGeneralRoomSwitch = settingSwitch("일반방에서 게임 명령 차단", mode.optBoolean("blockGamesInGeneralRoom", true));
            blockOpsInGameRoomSwitch = settingSwitch("게임방에서 운영 명령 차단", mode.optBoolean("blockOpsInGameRoom", true));
            sharePointsAndInventorySwitch = settingSwitch("포인트/가방 데이터 공유", mode.optBoolean("sharePointsAndInventory", true));
            parent.addView(blockGamesInGeneralRoomSwitch);
            parent.addView(blockOpsInGameRoomSwitch);
            parent.addView(sharePointsAndInventorySwitch);
        }

        Button saveButton = primaryButton("설정 저장");
        saveButton.setOnClickListener(v -> saveRoomSettings(applicationId, !isGameRoom));
        parent.addView(saveButton);
        parent.addView(text("관리자 전용 설정과 결제 상태는 앱에서 변경하지 않습니다.", 12, COLOR_MUTED, false));
    }

    private void openRoomSettingCategory(String applicationId, String category) {
        roomSettingsCategory = TextUtils.isEmpty(category) ? "overview" : category;
        showRoomDetail(applicationId, "settings");
    }

    private void renderRoomSettingCategoryDetail(LinearLayout parent, JSONObject room, String applicationId, JSONObject features) {
        String title = roomSettingCategoryTitle(roomSettingsCategory);
        parent.addView(sectionHeaderLine(title, "목록", v -> openRoomSettingCategory(applicationId, "overview")));

        if ("basic".equals(roomSettingsCategory)) {
            LinearLayout basic = glassPanel();
            basic.setPadding(dp(14), dp(12), dp(14), dp(12));
            parent.addView(basic);
            basic.addView(labelValue("방 이름", room.optString("roomName", "방")));
            basic.addView(labelValue("방 역할", roomRoleLabel(room)));
            basic.addView(labelValue("구독 상태", room.optString("subscriptionStatusLabel", "확인")));
            basic.addView(labelValue("roomId", room.optString("roomId", "-")));
            basic.addView(labelValue("최근 응답", roomLastResponseLabel(room)));
            basic.addView(labelValue("응답 속도", shortTimingStatus()));
            parent.addView(iconTextButton(R.drawable.ic_power, BridgeConfig.isEnabled(this) ? "브릿지 정지" : "브릿지 시작", false));
            parent.getChildAt(parent.getChildCount() - 1).setOnClickListener(v -> toggleBridgeEnabled());
            parent.addView(iconTextButton(R.drawable.ic_sync, "연결 다시 확인", true));
            parent.getChildAt(parent.getChildCount() - 1).setOnClickListener(v -> syncFromHome());
            return;
        }

        prepareRoomFeatureSwitches(features);
        if ("response".equals(roomSettingsCategory)) {
            parent.addView(localJsFeatureSwitch);
            parent.addView(customCommandsFeatureSwitch);
            parent.addView(profilesFeatureSwitch);
            parent.addView(pointsFeatureSwitch);
            parent.addView(text("접두어와 무시 키워드는 현재 서버/웹 콘솔 기준을 따릅니다.", 12, COLOR_MUTED, false));
            Button saveButton = primaryButton("응답 설정 저장");
            saveButton.setOnClickListener(v -> saveRoomSettings(applicationId, false));
            parent.addView(saveButton);
            return;
        }

        if ("limits".equals(roomSettingsCategory)) {
            parent.addView(gamesFeatureSwitch);
            parent.addView(shopFeatureSwitch);
            parent.addView(rankingsFeatureSwitch);
            parent.addView(historyFeatureSwitch);
            boolean isGameRoom = "game_room".equals(room.optString("roomPurpose", ""));
            if (!isGameRoom) {
                parent.addView(sectionTitle("방 분리 제한"));
                JSONObject mode = roomModeSplit(room);
                blockGamesInGeneralRoomSwitch = settingSwitch("일반방에서 게임 명령 차단", mode.optBoolean("blockGamesInGeneralRoom", true));
                blockOpsInGameRoomSwitch = settingSwitch("게임방에서 운영 명령 차단", mode.optBoolean("blockOpsInGameRoom", true));
                sharePointsAndInventorySwitch = settingSwitch("포인트/가방 데이터 공유", mode.optBoolean("sharePointsAndInventory", true));
                parent.addView(blockGamesInGeneralRoomSwitch);
                parent.addView(blockOpsInGameRoomSwitch);
                parent.addView(sharePointsAndInventorySwitch);
            }
            parent.addView(text("도배 방지, 쿨타임, 야간 모드의 세부 수치는 서버 기본값을 사용합니다.", 12, COLOR_MUTED, false));
            Button saveButton = primaryButton("운영 제한 저장");
            saveButton.setOnClickListener(v -> saveRoomSettings(applicationId, !isGameRoom));
            parent.addView(saveButton);
        }
    }

    private void prepareRoomFeatureSwitches(JSONObject features) {
        attendanceFeatureSwitch = settingSwitch("출석", roomFeatureChecked(features, "attendance", true));
        pointsFeatureSwitch = settingSwitch("포인트", roomFeatureChecked(features, "points", true));
        rankingsFeatureSwitch = settingSwitch("랭킹", roomFeatureChecked(features, "rankings", true));
        historyFeatureSwitch = settingSwitch("히스토리", roomFeatureChecked(features, "history", true));
        profilesFeatureSwitch = settingSwitch("프로필", roomFeatureChecked(features, "profiles", true));
        localJsFeatureSwitch = settingSwitch("JS 자동응답", roomFeatureChecked(features, "localJs", true));
        gamesFeatureSwitch = settingSwitch("게임", roomFeatureChecked(features, "games", false));
        shopFeatureSwitch = settingSwitch("상점/가방", roomFeatureChecked(features, "shop", true));
        customCommandsFeatureSwitch = settingSwitch("커스텀 명령어", roomFeatureChecked(features, "customCommands", true));
    }

    private String roomSettingCategoryTitle(String category) {
        if ("basic".equals(category)) return "기본 설정";
        if ("response".equals(category)) return "응답 설정";
        if ("limits".equals(category)) return "운영 제한";
        return "설정 카테고리";
    }

    private void renderRoomCommandsTab(LinearLayout parent, JSONObject room, JSONObject consoleJson) {
        String applicationId = room.optString("applicationId", "");
        parent.addView(commandSearchRow(applicationId));
        parent.addView(sectionTitle("장착된 명령어팩"));
        JSONObject state = room.optJSONObject("commandPacks");
        JSONArray installed = joinedPackDetails(state);
        if (installed.length() == 0) {
            parent.addView(text("장착된 명령어팩이 없습니다.", 14, COLOR_MUTED, false));
        }
        for (int index = 0; index < installed.length(); index++) {
            JSONObject pack = installed.optJSONObject(index);
            if (pack == null) continue;
            String packId = pack.optString("id", "");
            if (!matchesCommandQuery(pack.optString("title", packId), pack.optString("description", ""), packId)) continue;
            String title = pack.optString("title", packId);
            String description = pack.optString("description", pack.optString("tier", ""));
            parent.addView(installedPackAction(
                    title,
                    description,
                    v -> showCommandPackDetail(title, packId, description, pack),
                    v -> changeCommandPack(applicationId, packId, "remove")
            ));
        }

        parent.addView(sectionTitle("추가 가능한 팩"));
        JSONArray packs = consoleJson.optJSONObject("commandPacks") == null ? null : consoleJson.optJSONObject("commandPacks").optJSONArray("packs");
        int packLimit = packs == null ? 0 : Math.min(6, packs.length());
        for (int index = 0; index < packLimit; index++) {
            JSONObject pack = packs.optJSONObject(index);
            if (pack == null) continue;
            String packId = pack.optString("id", "");
            if (!matchesCommandQuery(pack.optString("title", "명령어팩"), pack.optString("description", ""), packId)) continue;
            parent.addView(storeAction(
                    pack.optString("title", "명령어팩"),
                    pack.optString("description", ""),
                    "장착",
                    v -> changeCommandPack(applicationId, packId, "apply")
            ));
        }

        parent.addView(sectionTitle("커스텀 명령어"));
        JSONArray commands = room.optJSONArray("customCommands");
        int commandLimit = commands == null ? 0 : Math.min(8, commands.length());
        if (commandLimit == 0) parent.addView(text("커스텀 명령어가 없습니다.", 14, COLOR_MUTED, false));
        for (int index = 0; index < commandLimit; index++) {
            JSONObject command = commands.optJSONObject(index);
            if (command == null) continue;
            String trigger = command.optString("trigger", "");
            if (!matchesCommandQuery(trigger, command.optString("response", ""), command.optString("description", ""))) continue;
            parent.addView(customCommandAction(applicationId, trigger, command.optString("response", "")));
        }
        Button addCommandButton = iconTextButton(R.drawable.ic_plus, "명령어 직접 추가", true);
        addCommandButton.setOnClickListener(v -> showCustomCommandEditor(applicationId, "", ""));
        Button addPackButton = iconTextButton(R.drawable.ic_plus, "명령어팩 추가", false);
        addPackButton.setOnClickListener(v -> showCommandStore(applicationId));
        Button storeButton = iconTextButton(R.drawable.ic_sync, "스토어에서 찾기", true);
        storeButton.setOnClickListener(v -> showCommandStore(applicationId));
        parent.addView(compactActionGrid(addCommandButton, addPackButton, storeButton));
    }

    private LinearLayout commandSearchRow(String applicationId) {
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER_VERTICAL);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        params.setMargins(0, dp(2), 0, dp(8));
        row.setLayoutParams(params);

        EditText search = searchBox("명령어 검색");
        search.setText(commandSearchQuery);
        row.addView(search, new LinearLayout.LayoutParams(0, dp(42), 1));

        ImageButton searchButton = iconButton(R.drawable.ic_search, "명령어 검색", v -> {
            commandSearchQuery = search.getText().toString().trim();
            showRoomDetail(applicationId, "commands");
        });
        LinearLayout.LayoutParams buttonParams = new LinearLayout.LayoutParams(dp(42), dp(42));
        buttonParams.setMargins(dp(8), dp(10), 0, 0);
        row.addView(searchButton, buttonParams);
        return row;
    }

    private boolean matchesCommandQuery(String... values) {
        if (TextUtils.isEmpty(commandSearchQuery)) return true;
        String query = commandSearchQuery.toLowerCase();
        for (String value : values) {
            if (value != null && value.toLowerCase().contains(query)) return true;
        }
        return false;
    }

    private LinearLayout installedPackAction(String title, String body, View.OnClickListener detailListener, View.OnClickListener removeListener) {
        LinearLayout card = glassPanel();
        card.setPadding(dp(10), dp(9), dp(10), dp(10));
        LinearLayout copy = new LinearLayout(this);
        copy.setOrientation(LinearLayout.VERTICAL);
        copy.addView(singleLineText(title, 15, COLOR_TITLE, true));
        if (!TextUtils.isEmpty(body)) copy.addView(singleLineText(body.length() > 70 ? body.substring(0, 70) + "..." : body, 12, COLOR_MUTED, false));
        card.addView(copy);

        Button detail = secondaryButton("상세 보기");
        detail.setOnClickListener(detailListener);
        Button remove = secondaryButton("해제");
        remove.setOnClickListener(removeListener);
        card.addView(compactActionGrid(detail, remove));
        return card;
    }

    private LinearLayout customCommandAction(String applicationId, String trigger, String response) {
        LinearLayout card = glassPanel();
        card.setPadding(dp(10), dp(9), dp(10), dp(10));
        LinearLayout copy = new LinearLayout(this);
        copy.setOrientation(LinearLayout.VERTICAL);
        copy.addView(singleLineText(trigger, 15, COLOR_TITLE, true));
        if (!TextUtils.isEmpty(response)) copy.addView(singleLineText(response.length() > 70 ? response.substring(0, 70) + "..." : response, 12, COLOR_MUTED, false));
        card.addView(copy);

        Button edit = secondaryButton("수정");
        edit.setOnClickListener(v -> showCustomCommandEditor(applicationId, trigger, response));
        Button delete = secondaryButton("삭제");
        delete.setOnClickListener(v -> deleteCustomCommand(applicationId, trigger));
        card.addView(compactActionGrid(edit, delete));
        return card;
    }

    private void showCommandPackDetail(String title, String packId, String description, JSONObject pack) {
        StringBuilder message = new StringBuilder();
        if (!TextUtils.isEmpty(description)) message.append(description).append("\n\n");
        message.append("팩 ID: ").append(packId);
        JSONArray commands = pack == null ? null : pack.optJSONArray("commands");
        if (commands != null && commands.length() > 0) {
            message.append("\n\n포함 명령어");
            int limit = Math.min(commands.length(), 8);
            for (int index = 0; index < limit; index++) {
                JSONObject command = commands.optJSONObject(index);
                if (command != null) message.append("\n- ").append(command.optString("trigger", command.optString("name", "")));
            }
            if (commands.length() > limit) message.append("\n- 외 ").append(commands.length() - limit).append("개");
        }
        new AlertDialog.Builder(this)
                .setTitle(title)
                .setMessage(message.toString())
                .setPositiveButton("확인", null)
                .show();
    }

    private void renderRoomLogsTab(LinearLayout parent, JSONObject room) {
        String roomName = room.optString("roomName", "");
        parent.addView(logFilterRow());
        parent.addView(quickActionGrid(
                quickAction(R.drawable.ic_copy, "선택 로그 복사", "", v -> copyText(roomName + " 로그", logsForRoom(roomName))),
                quickAction(R.drawable.ic_share, "전체 내보내기", "", v -> shareText(roomName + " 로그", logsForRoom(roomName))),
                quickAction(R.drawable.ic_delete, "전체 삭제", "", v -> {
                    BridgeConfig.clearLogs(this);
                    showRoomDetail(room.optString("applicationId", ""), "logs");
                })
        ));
        TextView logs = text(formatLogsForList(logsForRoom(roomName), logFilterMode), 13, COLOR_TEXT, false);
        logs.setBackgroundResource(getResources().getIdentifier("log_background", "drawable", getPackageName()));
        logs.setPadding(dp(12), dp(12), dp(12), dp(12));
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        params.setMargins(0, dp(10), 0, 0);
        parent.addView(logs, params);
    }

    private void renderRoomGamePacksTab(LinearLayout parent, JSONObject room, JSONObject consoleJson) {
        parent.addView(sectionTitle("게임팩"));
        JSONObject gameSettings = room.optJSONObject("gameSettings");
        parent.addView(labelValue("게임 기능", featureEnabledLabel(room.optJSONObject("features"), "games")));
        parent.addView(labelValue("시즌", gameSettings == null ? "기본값" : gameSettings.optString("seasonName", "기본값")));
        parent.addView(labelValue("주사위 보상", gameSettings == null ? "서버 기준" : gameSettings.optString("diceReward", "서버 기준")));
        parent.addView(labelValue("장착 팩", installedPackSummary(room.optJSONObject("commandPacks"))));
        parent.addView(dashboardCard(R.drawable.ic_checklist, "포인트 확률 게임팩", "10종 확률 게임 도움말을 앱에서 확인합니다.", "도움말", true, v -> loadGamePackHelp()));
        parent.addView(dashboardCard(R.drawable.ic_checklist, "RPG 모험팩", "모험, 던전, 제작, 장비 도움말을 앱에서 확인합니다.", "도움말", true, v -> loadGamePackHelp()));
        parent.addView(dashboardCard(R.drawable.ic_sync, "명령어 스토어", "현재 방에 게임팩을 장착합니다.", "장착", true, v -> showRoomDetail(room.optString("applicationId", ""), "commands")));

        Button helpApiButton = secondaryButton("게임팩 도움말 새로고침");
        helpApiButton.setOnClickListener(v -> loadGamePackHelp());
        parent.addView(helpApiButton);
    }

    private LinearLayout storeAction(String title, String body, String buttonLabel, View.OnClickListener listener) {
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER_VERTICAL);
        row.setPadding(dp(10), dp(8), dp(10), dp(8));
        row.setBackgroundResource(getResources().getIdentifier("status_tile_background", "drawable", getPackageName()));
        LinearLayout.LayoutParams rowParams = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        rowParams.setMargins(0, dp(7), 0, 0);
        row.setLayoutParams(rowParams);

        LinearLayout copy = new LinearLayout(this);
        copy.setOrientation(LinearLayout.VERTICAL);
        copy.addView(singleLineText(title, 15, COLOR_TITLE, true));
        if (!TextUtils.isEmpty(body)) copy.addView(singleLineText(body.length() > 70 ? body.substring(0, 70) + "..." : body, 12, COLOR_MUTED, false));
        row.addView(copy, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));

        Button button = secondaryButton(buttonLabel);
        button.setTextSize(12);
        button.setOnClickListener(listener);
        LinearLayout.LayoutParams buttonParams = new LinearLayout.LayoutParams(dp(72), dp(40));
        buttonParams.setMargins(dp(8), 0, 0, 0);
        button.setLayoutParams(buttonParams);
        row.addView(button);
        return row;
    }

    private JSONArray selectedApplicationIds() {
        JSONArray ids = new JSONArray();
        for (CheckBox check : roomSelectionChecks) {
            if (check.isChecked() && check.getTag() != null) ids.put(String.valueOf(check.getTag()));
        }
        if (ids.length() == 0 && buyerConsoleJson != null) {
            JSONArray rooms = buyerConsoleJson.optJSONArray("rooms");
            if (rooms != null) {
                for (int index = 0; index < rooms.length(); index++) {
                    JSONObject room = rooms.optJSONObject(index);
                    if (room != null && roomMatchesFilter(room)) ids.put(room.optString("applicationId", ""));
                }
            }
        }
        return ids;
    }

    private void autoConnectSelectedRooms() {
        JSONArray ids = selectedApplicationIds();
        if (ids.length() == 0) {
            Toast.makeText(this, "연결할 방을 선택하세요.", Toast.LENGTH_SHORT).show();
            return;
        }
        executor.execute(() -> {
            EventSender.ConnectResult result = EventSender.autoConnect(this, BridgeConfig.buyerToken(this), ids);
            runOnUiThread(() -> applyConnectResult(result, "계정 자동 연결"));
        });
    }

    private void accountRoomSyncSelectedRooms() {
        JSONArray ids = selectedApplicationIds();
        executor.execute(() -> {
            EventSender.ConnectResult result = EventSender.accountRoomSync(this, BridgeConfig.buyerToken(this), ids);
            runOnUiThread(() -> applyConnectResult(result, "계정 동기화"));
        });
    }

    private void applyConnectResult(EventSender.ConnectResult result, String label) {
        if (!result.ok()) {
            BridgeConfig.appendFailureLog(this, label + " 실패: " + result.error);
            Toast.makeText(this, result.error, Toast.LENGTH_LONG).show();
            return;
        }
        applyRoomResults(result);
        BridgeConfig.setLastProfileSyncSummary(this, label + " " + result.roomResults.size() + "개 / 앱 저장 " + BridgeConfig.roomProfileCount(this) + "개");
        BridgeConfig.appendLog(this, label + " 완료 / 등록방 " + BridgeConfig.roomProfileCount(this) + "개");
        Toast.makeText(this, "선택한 방을 이 폰에 연결했습니다.", Toast.LENGTH_SHORT).show();
        refreshHomeDiagnostics();
        loadBuyerConsole();
    }

    private void applyRoomResults(EventSender.ConnectResult result) {
        int generalRooms = 0;
        int gameRooms = 0;
        for (EventSender.RoomConnectResult room : result.roomResults) {
            BridgeConfig.addOrUpdateRoomProfile(this, room.roomName, room.roomId, room.roomLink, room.joinPhrase, TextUtils.join(",", room.admins), room.licenseKey, room.roomRole, room.canonicalRoomName);
            if ("game".equals(room.roomRole)) gameRooms++;
            else generalRooms++;
        }
        BridgeConfig.setLastConnectSummary(this, "서버 응답 " + result.roomResults.size() + "개 / 저장 " + BridgeConfig.roomProfileCount(this) + "개 / 일반방 " + generalRooms + "개 / 게임방 " + gameRooms + "개");
        BridgeConfig.setEnabled(this, true);
        BridgeConfig.setServerUrl(this, TextUtils.isEmpty(result.serverUrl) ? BridgeConfig.DEFAULT_SERVER_URL : result.serverUrl);
        BridgeConfig.setAttendanceEnabled(this, result.attendance);
        BridgeConfig.setPointsEnabled(this, result.points);
        BridgeConfig.setRankingsEnabled(this, result.rankings);
        BridgeConfig.setHistoryEnabled(this, result.history);
        BridgeConfig.setProfilesEnabled(this, result.profiles);
        BridgeConfig.setScriptEnabled(this, result.localJs);
        BridgeConfig.setGamesEnabled(this, result.games);
    }

    private String firstConsoleApplicationId(JSONObject consoleJson) {
        JSONArray rooms = consoleJson == null ? null : consoleJson.optJSONArray("rooms");
        JSONObject room = rooms == null || rooms.length() == 0 ? null : rooms.optJSONObject(0);
        return room == null ? "" : room.optString("applicationId", "");
    }

    private String consoleApplicationIdOrFirst(JSONObject consoleJson, String preferredApplicationId) {
        if (!TextUtils.isEmpty(preferredApplicationId)) {
            JSONArray rooms = consoleJson == null ? null : consoleJson.optJSONArray("rooms");
            for (int index = 0; rooms != null && index < rooms.length(); index++) {
                JSONObject room = rooms.optJSONObject(index);
                if (room != null && preferredApplicationId.equals(room.optString("applicationId", ""))) return preferredApplicationId;
            }
        }
        return firstConsoleApplicationId(consoleJson);
    }

    private void applyCommandPack(String applicationId, String packId) {
        if (TextUtils.isEmpty(applicationId) || TextUtils.isEmpty(packId)) return;
        executor.execute(() -> {
            EventSender.ApiResult result = EventSender.applyCommandPack(this, BridgeConfig.buyerToken(this), applicationId, packId, "apply");
            runOnUiThread(() -> {
                Toast.makeText(this, result.ok() ? "명령어팩을 장착했습니다." : "장착 실패: " + result.error, Toast.LENGTH_LONG).show();
                loadBuyerConsole();
            });
        });
    }

    private void installCommandTemplate(String applicationId, String templateId) {
        if (TextUtils.isEmpty(applicationId) || TextUtils.isEmpty(templateId)) return;
        executor.execute(() -> {
            EventSender.ApiResult result = EventSender.installCommandTemplate(this, BridgeConfig.buyerToken(this), applicationId, templateId);
            runOnUiThread(() -> {
                Toast.makeText(this, result.ok() ? "명령어 템플릿을 설치했습니다." : "설치 실패: " + result.error, Toast.LENGTH_LONG).show();
                loadBuyerConsole();
            });
        });
    }

    private void changeCommandPack(String applicationId, String packId, String action) {
        if (TextUtils.isEmpty(applicationId) || TextUtils.isEmpty(packId)) return;
        executor.execute(() -> {
            EventSender.ApiResult result = EventSender.applyCommandPack(this, BridgeConfig.buyerToken(this), applicationId, packId, action);
            runOnUiThread(() -> {
                String okMessage = "remove".equals(action) ? "명령어팩을 제거했습니다." : "명령어팩을 장착했습니다.";
                Toast.makeText(this, result.ok() ? okMessage : "처리 실패: " + result.error, Toast.LENGTH_LONG).show();
                showRoomDetail(applicationId, "commands");
            });
        });
    }

    private void deleteCustomCommand(String applicationId, String trigger) {
        if (TextUtils.isEmpty(applicationId) || TextUtils.isEmpty(trigger)) return;
        executor.execute(() -> {
            EventSender.ApiResult result = EventSender.deleteCustomCommand(this, BridgeConfig.buyerToken(this), applicationId, trigger);
            runOnUiThread(() -> {
                Toast.makeText(this, result.ok() ? "커스텀 명령어를 삭제했습니다." : "삭제 실패: " + result.error, Toast.LENGTH_LONG).show();
                showRoomDetail(applicationId, "commands");
            });
        });
    }

    private void showCustomCommandEditor(String applicationId, String trigger, String response) {
        if (TextUtils.isEmpty(applicationId)) return;
        boolean editing = !TextUtils.isEmpty(trigger);
        LinearLayout form = new LinearLayout(this);
        form.setOrientation(LinearLayout.VERTICAL);
        form.setPadding(dp(4), dp(4), dp(4), 0);

        EditText triggerInput = input("명령어 예: /공지 또는 공지", trigger);
        triggerInput.setEnabled(!editing);
        form.addView(triggerInput);

        EditText responseInput = multiLineInput(response, 4);
        responseInput.setHint("답장 내용을 입력하세요.");
        form.addView(responseInput);

        TextView note = text(editing ? "명령어 이름은 유지하고 답장만 수정합니다." : "고정 명령어와 같은 이름은 저장되지 않습니다.", 12, COLOR_MUTED, false);
        form.addView(note);

        new AlertDialog.Builder(this)
                .setTitle(editing ? "명령어 수정" : "명령어 추가")
                .setView(form)
                .setNegativeButton("취소", null)
                .setPositiveButton("저장", (dialog, which) -> saveCustomCommand(
                        applicationId,
                        triggerInput.getText().toString().trim(),
                        responseInput.getText().toString().trim()
                ))
                .show();
    }

    private void saveCustomCommand(String applicationId, String trigger, String response) {
        if (TextUtils.isEmpty(applicationId)) return;
        if (TextUtils.isEmpty(trigger) || TextUtils.isEmpty(response)) {
            Toast.makeText(this, "명령어와 답장을 모두 입력해 주세요.", Toast.LENGTH_SHORT).show();
            return;
        }
        executor.execute(() -> {
            EventSender.ApiResult result = EventSender.saveCustomCommand(this, BridgeConfig.buyerToken(this), applicationId, trigger, response);
            runOnUiThread(() -> {
                Toast.makeText(this, result.ok() ? "커스텀 명령어를 저장했습니다." : "저장 실패: " + result.error, Toast.LENGTH_LONG).show();
                showRoomDetail(applicationId, "commands");
            });
        });
    }

    private void saveRoomModeSettings(String applicationId) {
        if (TextUtils.isEmpty(applicationId)) return;
        boolean blockGames = blockGamesInGeneralRoomSwitch == null || blockGamesInGeneralRoomSwitch.isChecked();
        boolean blockOps = blockOpsInGameRoomSwitch == null || blockOpsInGameRoomSwitch.isChecked();
        boolean shareData = sharePointsAndInventorySwitch == null || sharePointsAndInventorySwitch.isChecked();
        executor.execute(() -> {
            EventSender.ApiResult result = EventSender.saveRoomModeSettings(this, BridgeConfig.buyerToken(this), applicationId, blockGames, blockOps, shareData);
            runOnUiThread(() -> {
                Toast.makeText(this, result.ok() ? "방별 분리 설정을 저장했습니다." : "저장 실패: " + result.error, Toast.LENGTH_LONG).show();
                showRoomDetail(applicationId, "settings");
            });
        });
    }

    private void saveRoomSettings(String applicationId, boolean includeModeSettings) {
        if (TextUtils.isEmpty(applicationId)) return;
        JSONObject features = selectedRoomFeaturePayload();
        boolean blockGames = blockGamesInGeneralRoomSwitch == null || blockGamesInGeneralRoomSwitch.isChecked();
        boolean blockOps = blockOpsInGameRoomSwitch == null || blockOpsInGameRoomSwitch.isChecked();
        boolean shareData = sharePointsAndInventorySwitch == null || sharePointsAndInventorySwitch.isChecked();
        executor.execute(() -> {
            EventSender.ApiResult featureResult = EventSender.saveRoomFeatureSettings(this, BridgeConfig.buyerToken(this), applicationId, features);
            EventSender.ApiResult modeResult = null;
            if (featureResult.ok() && includeModeSettings) {
                modeResult = EventSender.saveRoomModeSettings(this, BridgeConfig.buyerToken(this), applicationId, blockGames, blockOps, shareData);
            }
            EventSender.ApiResult finalModeResult = modeResult;
            runOnUiThread(() -> {
                if (!featureResult.ok()) {
                    Toast.makeText(this, "기능 저장 실패: " + featureResult.error, Toast.LENGTH_LONG).show();
                    return;
                }
                saveBuyerSession(finalModeResult != null && finalModeResult.ok() ? finalModeResult.json : featureResult.json);
                if (finalModeResult != null && !finalModeResult.ok()) {
                    Toast.makeText(this, "분리 설정 저장 실패: " + finalModeResult.error, Toast.LENGTH_LONG).show();
                    return;
                }
                Toast.makeText(this, "방 설정을 저장했습니다.", Toast.LENGTH_SHORT).show();
                showRoomDetail(applicationId, "settings");
            });
        });
    }

    private JSONObject selectedRoomFeaturePayload() {
        JSONObject features = new JSONObject();
        try {
            features.put("attendance", attendanceFeatureSwitch == null || attendanceFeatureSwitch.isChecked());
            features.put("points", pointsFeatureSwitch == null || pointsFeatureSwitch.isChecked());
            features.put("rankings", rankingsFeatureSwitch == null || rankingsFeatureSwitch.isChecked());
            features.put("history", historyFeatureSwitch == null || historyFeatureSwitch.isChecked());
            features.put("profiles", profilesFeatureSwitch == null || profilesFeatureSwitch.isChecked());
            features.put("localJs", localJsFeatureSwitch == null || localJsFeatureSwitch.isChecked());
            features.put("games", gamesFeatureSwitch != null && gamesFeatureSwitch.isChecked());
            features.put("shop", shopFeatureSwitch == null || shopFeatureSwitch.isChecked());
            features.put("customCommands", customCommandsFeatureSwitch == null || customCommandsFeatureSwitch.isChecked());
        } catch (Exception ignored) {
            // Keep room feature save payload best-effort.
        }
        return features;
    }

    private void loadGamePackHelp() {
        executor.execute(() -> {
            EventSender.ApiResult result = EventSender.gamePackHelp(this, "");
            runOnUiThread(() -> Toast.makeText(this, result.ok() ? "게임팩 도움말을 확인했습니다." : "도움말 확인 실패: " + result.error, Toast.LENGTH_LONG).show());
        });
    }

    private void toggleBridgeEnabled() {
        boolean next = !BridgeConfig.isEnabled(this);
        BridgeConfig.setEnabled(this, next);
        BridgeConfig.appendLog(this, next ? "브릿지 시작" : "브릿지 정지");
        Toast.makeText(this, next ? "브릿지를 켰습니다." : "브릿지를 껐습니다.", Toast.LENGTH_SHORT).show();
        showHome();
    }

    private void syncFromHome() {
        if (BridgeConfig.isBuyerLoggedIn(this) && BridgeConfig.roomProfileCount(this) == 0) {
            showRooms();
            Toast.makeText(this, "연결 가능한 방을 먼저 선택하세요.", Toast.LENGTH_SHORT).show();
            return;
        }
        syncRoomProfiles();
    }

    private void saveGamePackSettings(String packName, Switch packEnabledSwitch) {
        boolean enabled = packEnabledSwitch != null && packEnabledSwitch.isChecked();
        BridgeConfig.setGamesEnabled(this, enabled);
        BridgeConfig.appendLog(this, "게임팩 공통 설정 저장: " + packName + " / 게임 기능 " + (enabled ? "켜짐" : "꺼짐"));
        Toast.makeText(this, "게임 기능 상태를 저장했습니다. 세부 확률/보상은 서버 설정 기준입니다.", Toast.LENGTH_LONG).show();
        showFeatureDashboard();
    }

    private void saveSettings() {
        BridgeConfig.setEnabled(this, enabledSwitch.isChecked());
        if (serverUrlInput != null) BridgeConfig.setServerUrl(this, serverUrlInput.getText().toString());
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
        if (serverUrlInput != null) BridgeConfig.setServerUrl(this, serverUrlInput.getText().toString());
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
        homeDiagnosticsStatus.setText("진단 중 · 권한 " + (permission ? "허용" : "필요")
                + " · 대표방 " + (TextUtils.isEmpty(profile.name) ? "등록 필요" : profile.name));
        homeDiagnosticsStatus.setTextColor(permission ? COLOR_GOOD : COLOR_BAD);

        executor.execute(() -> {
            EventSender.HealthResult result = EventSender.health(this);
            runOnUiThread(() -> {
                if (homeDiagnosticsStatus == null) return;
                if (result.ok()) {
                    String updateText = result.appUpdateRequired ? "업데이트 필요" : "버전 정상";
                    homeDiagnosticsStatus.setText("서버 정상 · " + safeText(result.storageLabel) + (result.dbOk ? " ok" : " 확인")
                            + " · 앱 " + BuildConfig.VERSION_NAME + " (" + BuildConfig.VERSION_CODE + ")\n"
                            + "최신 " + safeText(result.latestAndroidVersion) + " (" + result.latestAndroidVersionCode + ") · " + updateText);
                    homeDiagnosticsStatus.setTextColor(result.appUpdateRequired || !result.dbOk ? COLOR_WARN : COLOR_GOOD);
                } else {
                    homeDiagnosticsStatus.setText("서버 연결 실패 · " + safeText(result.error)
                            + "\n인터넷, 서버 URL, 보안앱 차단 여부 확인");
                    homeDiagnosticsStatus.setTextColor(COLOR_BAD);
                }
            });
        });
    }

    private void refreshLogs() {
        if (logView == null) return;
        logView.setText(formatLogsForList(BridgeConfig.logsForDisplay(this), logFilterMode));
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

    private void shareText(String label, String value) {
        Intent intent = new Intent(Intent.ACTION_SEND);
        intent.setType("text/plain");
        intent.putExtra(Intent.EXTRA_TEXT, TextUtils.isEmpty(value) ? "공유할 내용이 없습니다." : value);
        startActivity(Intent.createChooser(intent, label));
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
                + "- 방 불일치: 앱 방 관리에서 다시 동기화하거나 고급 설정에서 연결코드 확인\n"
                + "- 라이선스 오류: 앱 방 상세의 연결코드와 저장된 방 정보 확인\n"
                + "- 입장 감지: 방장봇 환영 문구와 입장확인 문구 일치 확인\n"
                + "- 화면 감지: 사용 안 함";
    }

    private JSONObject consoleRoomByApplicationId(JSONObject consoleJson, String applicationId) {
        JSONArray rooms = consoleJson == null ? null : consoleJson.optJSONArray("rooms");
        if (rooms == null || rooms.length() == 0) return null;
        for (int index = 0; index < rooms.length(); index++) {
            JSONObject room = rooms.optJSONObject(index);
            if (room != null && room.optString("applicationId", "").equals(applicationId)) return room;
        }
        return rooms.optJSONObject(0);
    }

    private String roomRoleLabel(JSONObject room) {
        String purpose = room == null ? "" : room.optString("roomPurpose", "");
        String role = room == null ? "" : room.optString("roomRole", "");
        if ("game_room".equals(purpose) || "game".equals(role)) return "게임방";
        if ("general".equals(role)) return "일반방";
        return "단일방";
    }

    private String linkedGameRoomSummary(JSONObject room) {
        JSONArray rooms = room == null ? null : room.optJSONArray("linkedGameRooms");
        if (rooms == null || rooms.length() == 0) return "없음";
        List<String> names = new ArrayList<>();
        for (int index = 0; index < rooms.length(); index++) {
            JSONObject item = rooms.optJSONObject(index);
            if (item != null) names.add(item.optString("roomName", "게임방"));
        }
        return TextUtils.join(", ", names);
    }

    private String commandPackCountLabel(JSONObject room) {
        JSONArray packs = joinedPackDetails(room == null ? null : room.optJSONObject("commandPacks"));
        return "명령어팩 " + packs.length() + "개";
    }

    private String roomSetupLabel(JSONObject room) {
        if (room == null) return "상태 확인";
        if ("expired".equals(room.optString("subscriptionStatus", ""))) return "구독 만료";
        if ("needs_setup".equals(room.optString("bridgeStatus", ""))) return "설정 필요";
        JSONObject features = room.optJSONObject("features");
        if (features != null) {
            JSONArray names = features.names();
            boolean hasEnabled = false;
            for (int index = 0; names != null && index < names.length(); index++) {
                if (features.optBoolean(names.optString(index), false)) {
                    hasEnabled = true;
                    break;
                }
            }
            if (!hasEnabled) return "기능 꺼짐";
        }
        return "정상";
    }

    private JSONObject roomModeSplit(JSONObject room) {
        JSONObject snapshot = room == null ? null : room.optJSONObject("roomStatusSnapshot");
        JSONObject settings = snapshot == null ? null : snapshot.optJSONObject("settings");
        JSONObject mode = settings == null ? null : settings.optJSONObject("modeSplit");
        return mode == null ? new JSONObject() : mode;
    }

    private JSONArray joinedPackDetails(JSONObject state) {
        JSONArray result = new JSONArray();
        if (state == null) return result;
        JSONObject base = state.optJSONObject("basePackDetail");
        if (base != null) result.put(base);
        addPackDetails(result, state.optJSONArray("installedPackDetails"));
        addPackDetails(result, state.optJSONArray("addonPackDetails"));
        return result;
    }

    private void addPackDetails(JSONArray target, JSONArray source) {
        if (source == null) return;
        for (int index = 0; index < source.length(); index++) {
            JSONObject pack = source.optJSONObject(index);
            if (pack != null) target.put(pack);
        }
    }

    private String installedPackSummary(JSONObject state) {
        JSONArray details = joinedPackDetails(state);
        if (details.length() == 0) return "없음";
        List<String> titles = new ArrayList<>();
        for (int index = 0; index < details.length(); index++) {
            JSONObject pack = details.optJSONObject(index);
            if (pack != null) titles.add(pack.optString("title", pack.optString("id", "")));
        }
        return TextUtils.join(", ", titles);
    }

    private String featureEnabledLabel(JSONObject features, String key) {
        if (features == null || !features.has(key)) return "서버 기본값";
        return features.optBoolean(key, false) ? "켜짐" : "꺼짐";
    }

    private boolean roomFeatureChecked(JSONObject features, String key, boolean fallback) {
        if (features == null || !features.has(key)) return fallback;
        return features.optBoolean(key, fallback);
    }

    private String logsForRoom(String roomName) {
        String logs = BridgeConfig.logs(this);
        if (TextUtils.isEmpty(logs)) return "아직 전송 로그가 없습니다.";
        if (TextUtils.isEmpty(roomName)) return BridgeConfig.logsForDisplay(this);
        String[] lines = logs.split("\\r?\\n");
        List<String> matched = new ArrayList<>();
        for (String line : lines) {
            if (line.contains(roomName)) matched.add(line);
        }
        if (matched.isEmpty()) return roomName + " 관련 로컬 로그가 없습니다.";
        int start = Math.max(0, matched.size() - 40);
        return TextUtils.join("\n", matched.subList(start, matched.size()));
    }

    private String safeText(String value) {
        return TextUtils.isEmpty(value) ? "-" : value;
    }

    private String maskLicense(String value) {
        if (TextUtils.isEmpty(value)) return "-";
        if (value.length() <= 10) return value.charAt(0) + "***";
        return value.substring(0, 7) + "..." + value.substring(value.length() - 4);
    }

    private String roomConnectCode(JSONObject room) {
        if (room == null) return "";
        String value = room.optString("bridgeConnectCode", "");
        if (TextUtils.isEmpty(value)) value = room.optString("connectCode", "");
        if (TextUtils.isEmpty(value)) value = room.optString("licenseKey", "");
        return value;
    }

    private void copyRoomConnectCode(JSONObject room) {
        String code = roomConnectCode(room);
        if (TextUtils.isEmpty(code)) {
            Toast.makeText(this, "복사할 연결코드가 없습니다.", Toast.LENGTH_SHORT).show();
            return;
        }
        copyText("연결코드", code);
    }

    private void showConnectCodePicker() {
        if (!BridgeConfig.isBuyerLoggedIn(this)) {
            new AlertDialog.Builder(this)
                    .setTitle("연결코드 찾기")
                    .setMessage("로그인하면 승인된 방의 연결코드를 앱 안에서 바로 복사할 수 있습니다.")
                    .setPositiveButton("로그인", (dialog, which) -> showEmailLogin())
                    .setNegativeButton("닫기", null)
                    .show();
            return;
        }
        executor.execute(() -> {
            EventSender.ApiResult result = EventSender.buyerConsole(this, BridgeConfig.buyerToken(this));
            runOnUiThread(() -> {
                if (!result.ok()) {
                    Toast.makeText(this, "연결코드 목록을 불러오지 못했습니다: " + result.error, Toast.LENGTH_LONG).show();
                    return;
                }
                showConnectCodeDialog(result.json);
            });
        });
    }

    private void showConnectCodeDialog(JSONObject consoleJson) {
        JSONArray source = consoleJson == null ? null : consoleJson.optJSONArray("appConnectCodes");
        if (source == null || source.length() == 0) source = consoleJson == null ? null : consoleJson.optJSONArray("rooms");
        List<String> labels = new ArrayList<>();
        List<String> codes = new ArrayList<>();
        for (int index = 0; source != null && index < source.length(); index++) {
            JSONObject room = source.optJSONObject(index);
            String code = roomConnectCode(room);
            if (room == null || TextUtils.isEmpty(code)) continue;
            labels.add(room.optString("roomName", "승인 방") + " · " + maskLicense(code));
            codes.add(code);
        }
        if (codes.isEmpty()) {
            Toast.makeText(this, "복사 가능한 연결코드가 아직 없습니다.", Toast.LENGTH_LONG).show();
            return;
        }
        CharSequence[] items = labels.toArray(new CharSequence[0]);
        new AlertDialog.Builder(this)
                .setTitle("연결코드 목록")
                .setItems(items, (dialog, which) -> copyText("연결코드", codes.get(which)))
                .setNeutralButton("전체 복사", (dialog, which) -> copyText("연결코드 전체", TextUtils.join("\n", codes)))
                .setNegativeButton("닫기", null)
                .show();
    }

    private boolean roomMatchesFilter(JSONObject room) {
        if (room == null) return false;
        boolean issue = roomSetupLabel(room).contains("필요") || "expired".equals(room.optString("subscriptionStatus", ""));
        boolean on = !"off".equalsIgnoreCase(room.optString("bridgeStatus", "")) && !issue;
        if (!TextUtils.isEmpty(roomSearchQuery)) {
            String query = roomSearchQuery.toLowerCase();
            String haystack = (room.optString("roomName", "")
                    + " " + room.optString("roomId", "")
                    + " " + room.optString("applicationId", "")
                    + " " + roomRoleLabel(room)
                    + " " + room.optString("subscriptionStatusLabel", "")).toLowerCase();
            if (!haystack.contains(query)) return false;
        }
        if ("on".equals(roomFilterMode)) return on;
        if ("off".equals(roomFilterMode)) return !on && !issue;
        if ("issue".equals(roomFilterMode)) return issue;
        return true;
    }

    private String roomLastResponseLabel(JSONObject room) {
        String value = room == null ? "" : room.optString("lastResponseLabel", "");
        if (TextUtils.isEmpty(value)) value = room == null ? "" : room.optString("lastEventAgo", "");
        if (TextUtils.isEmpty(value)) value = shortTimingStatus();
        return safeText(value);
    }

    private String failureCountLabel() {
        String logs = BridgeConfig.logs(this);
        if (TextUtils.isEmpty(logs)) return "0";
        int count = 0;
        for (String line : logs.split("\\r?\\n")) {
            if (line.contains("실패") || line.toLowerCase().contains("fail")) count++;
        }
        return String.valueOf(count);
    }

    private String formatLogsForList(String logs, String mode) {
        return formatLogsForList(logs, mode, 40);
    }

    private String formatLogsForList(String logs, String mode, int limit) {
        if (TextUtils.isEmpty(logs)) return "아직 전송 로그가 없습니다.";
        String[] lines = logs.split("\\r?\\n");
        List<String> filtered = new ArrayList<>();
        for (String line : lines) {
            if (TextUtils.isEmpty(line)) continue;
            boolean success = line.contains("성공") || line.contains("완료") || line.toLowerCase().contains("ok");
            boolean fail = line.contains("실패") || line.toLowerCase().contains("fail") || line.contains("오류");
            boolean ignored = line.contains("무시") || line.contains("ignored");
            if ("success".equals(mode) && !success) continue;
            if ("fail".equals(mode) && !fail) continue;
            if ("ignore".equals(mode) && !ignored) continue;
            filtered.add(line);
        }
        if (filtered.isEmpty()) return "현재 필터에 맞는 로그가 없습니다.";
        int start = Math.max(0, filtered.size() - limit);
        List<String> tail = filtered.subList(start, filtered.size());
        List<String> pretty = new ArrayList<>();
        for (String line : tail) {
            String status = line.contains("실패") ? "실패" : line.contains("무시") ? "무시" : "성공";
            String colorless = line.replace("성공:", "").replace("실패:", "").replace("무시:", "").trim();
            pretty.add(status + "  " + colorless);
        }
        return TextUtils.join("\n\n", pretty);
    }

    private int roomColorForIndex(int index) {
        int[] colors = new int[]{
                Color.rgb(34, 197, 94),
                Color.rgb(59, 130, 246),
                Color.rgb(234, 179, 8),
                Color.rgb(139, 92, 246),
                Color.rgb(236, 72, 153)
        };
        return colors[Math.abs(index) % colors.length];
    }

    private GradientDrawable roundedBackground(int color, int strokeColor, int radiusDp) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(color);
        drawable.setCornerRadius(dp(radiusDp));
        if (strokeColor != Color.TRANSPARENT) drawable.setStroke(dp(1), strokeColor);
        return drawable;
    }

    private boolean notificationPermissionEnabled() {
        String listeners = Settings.Secure.getString(getContentResolver(), "enabled_notification_listeners");
        return listeners != null && listeners.toLowerCase().contains(getPackageName().toLowerCase());
    }

    private LinearLayout glassPanel() {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setBackground(roundedBackground(COLOR_CARD_ALPHA, Color.rgb(42, 62, 82), 10));
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        params.setMargins(0, dp(8), 0, 0);
        layout.setLayoutParams(params);
        return layout;
    }

    private LinearLayout transparentStack() {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        params.setMargins(0, dp(4), 0, 0);
        layout.setLayoutParams(params);
        return layout;
    }

    private ImageView iconSquare(int iconRes, int color, int sizePx) {
        ImageView icon = new ImageView(this);
        icon.setImageResource(iconRes);
        icon.setColorFilter(Color.WHITE);
        icon.setBackground(roundedBackground(color, Color.TRANSPARENT, 10));
        icon.setPadding(dp(8), dp(8), dp(8), dp(8));
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(sizePx, sizePx);
        icon.setLayoutParams(params);
        return icon;
    }

    private ImageView iconCircle(int iconRes, int color, int sizePx, boolean good) {
        ImageView icon = iconSquare(iconRes, color, sizePx);
        icon.setBackground(roundedBackground(color, good ? COLOR_GOOD : Color.TRANSPARENT, 999));
        icon.setPadding(dp(20), dp(20), dp(20), dp(20));
        return icon;
    }

    private TextView statusPill(String label, boolean ok) {
        TextView pill = singleLineText(label, 11, ok ? COLOR_GOOD : COLOR_BAD, true);
        pill.setGravity(Gravity.CENTER);
        pill.setPadding(dp(8), dp(3), dp(8), dp(3));
        pill.setBackground(roundedBackground(ok ? Color.rgb(18, 83, 56) : Color.rgb(82, 37, 41), Color.TRANSPARENT, 999));
        return pill;
    }

    private TextView chevronText() {
        TextView view = singleLineText("›", 24, COLOR_MUTED, false);
        view.setGravity(Gravity.CENTER);
        view.setPadding(dp(8), 0, 0, 0);
        return view;
    }

    private LinearLayout authOptionRow() {
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER_VERTICAL);
        row.setPadding(0, dp(8), 0, dp(4));
        row.addView(checkTextRow("로그인 상태 유지", false), new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        TextView find = singleLineText("비밀번호 찾기", 12, COLOR_GOOD, true);
        find.setGravity(Gravity.END);
        find.setOnClickListener(v -> showPasswordResetDialog());
        row.addView(find);
        return row;
    }

    private void showPasswordResetDialog() {
        String currentEmail = loginEmailInput == null ? BridgeConfig.buyerEmail(this) : loginEmailInput.getText().toString().trim();
        final EditText emailInput = authInput("이메일", currentEmail);
        emailInput.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS);
        new AlertDialog.Builder(this)
                .setTitle("비밀번호 찾기")
                .setMessage("가입한 이메일로 비밀번호 재설정 링크를 보냅니다.")
                .setView(emailInput)
                .setPositiveButton("전송", (dialog, which) -> requestPasswordReset(emailInput.getText().toString().trim()))
                .setNegativeButton("취소", null)
                .show();
    }

    private LinearLayout checkTextRow(String label, boolean checked) {
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER_VERTICAL);
        CheckBox box = new CheckBox(this);
        box.setChecked(checked);
        row.addView(box, new LinearLayout.LayoutParams(dp(34), dp(34)));
        TextView text = singleLineText(label, 12, checked ? COLOR_GOOD : COLOR_MUTED, false);
        row.addView(text, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        return row;
    }

    private TextView orDivider() {
        TextView view = centerText("또는", 12, COLOR_MUTED);
        view.setPadding(0, dp(12), 0, dp(6));
        return view;
    }

    private LinearLayout infoCard(int iconRes, String message) {
        LinearLayout row = glassPanel();
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER_VERTICAL);
        row.setPadding(dp(12), dp(10), dp(12), dp(10));
        row.addView(iconSquare(iconRes, COLOR_CARD_SOFT, dp(34)));
        TextView body = text(message, 12, COLOR_MUTED, false);
        body.setPadding(dp(10), 0, 0, 0);
        row.addView(body, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        return row;
    }

    private LinearLayout activeSearchSummary(String label, View.OnClickListener clearListener) {
        LinearLayout row = glassPanel();
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER_VERTICAL);
        row.setPadding(dp(10), dp(8), dp(10), dp(8));
        TextView text = singleLineText(label, 13, COLOR_TEXT, true);
        row.addView(text, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        TextView clear = singleLineText("초기화", 12, COLOR_GOOD, true);
        clear.setGravity(Gravity.END | Gravity.CENTER_VERTICAL);
        clear.setOnClickListener(clearListener);
        row.addView(clear);
        return row;
    }

    private EditText searchBox(String hint) {
        EditText search = input(hint, "");
        search.setTextSize(13);
        search.setMinHeight(dp(40));
        search.setPadding(dp(12), 0, dp(12), 0);
        return search;
    }

    private LinearLayout panel() {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setBackgroundResource(getResources().getIdentifier("panel_background", "drawable", getPackageName()));
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        params.setMargins(0, dp(8), 0, 0);
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

    private EditText authInput(String hint, String value) {
        EditText editText = input(hint, value);
        editText.setTextColor(COLOR_TITLE);
        editText.setHintTextColor(COLOR_MUTED);
        editText.setSingleLine(true);
        editText.setMinHeight(dp(54));
        editText.setPadding(dp(14), 0, dp(14), 0);
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
        TextView title = text(value, 16, COLOR_TITLE, true);
        title.setPadding(0, 0, 0, dp(6));
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
        layout.setOrientation(LinearLayout.HORIZONTAL);
        layout.setGravity(Gravity.CENTER_VERTICAL);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        params.setMargins(0, 0, 0, dp(8));
        layout.setLayoutParams(params);

        TextView labelView = singleLineText(label, 12, COLOR_MUTED, true);
        TextView valueView = singleLineText(value, 14, COLOR_TEXT, false);
        valueView.setGravity(Gravity.END | Gravity.CENTER_VERTICAL);
        layout.addView(labelView, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        layout.addView(valueView, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 2));
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
        layout.setPadding(dp(8), 0, dp(8), 0);
        layout.setBackgroundResource(getResources().getIdentifier("status_tile_background", "drawable", getPackageName()));
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        params.setMargins(0, 0, 0, 0);
        layout.setLayoutParams(params);
        layout.setMinimumHeight(dp(38));
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
        sw.setTextSize(14);
        sw.setTextColor(COLOR_TEXT);
        sw.setChecked(checked);
        sw.setSingleLine(true);
        sw.setEllipsize(TextUtils.TruncateAt.END);
        sw.setGravity(Gravity.CENTER_VERTICAL);
        sw.setMinHeight(dp(44));
        sw.setPadding(dp(10), 0, dp(10), 0);
        sw.setBackgroundResource(getResources().getIdentifier("status_tile_background", "drawable", getPackageName()));
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        params.setMargins(0, dp(6), 0, 0);
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

    private TextView centerText(String value, int sp, int color) {
        TextView textView = text(value, sp, color, false);
        textView.setGravity(Gravity.CENTER);
        textView.setPadding(0, dp(6), 0, dp(6));
        return textView;
    }

    private TextView singleLineText(String value, int sp, int color, boolean bold) {
        TextView textView = text(value, sp, color, bold);
        textView.setSingleLine(true);
        textView.setEllipsize(TextUtils.TruncateAt.END);
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
        button.setTextColor(COLOR_TITLE);
        button.setBackgroundResource(getResources().getIdentifier("button_secondary", "drawable", getPackageName()));
        return button;
    }

    private Button socialButton(String label) {
        Button button = secondaryButton(label);
        button.setTextColor(COLOR_TITLE);
        return button;
    }

    private Button flatTextButton(String label) {
        Button button = baseButton(label);
        button.setTextColor(COLOR_MUTED);
        button.setBackgroundColor(Color.TRANSPARENT);
        return button;
    }

    private Button iconTextButton(int iconRes, String label, boolean primary) {
        Button button = primary ? primaryButton(label) : secondaryButton(label);
        button.setCompoundDrawablesWithIntrinsicBounds(iconRes, 0, 0, 0);
        button.setCompoundDrawablePadding(dp(8));
        return button;
    }

    private LinearLayout compactActionGrid(Button... buttons) {
        LinearLayout grid = new LinearLayout(this);
        grid.setOrientation(LinearLayout.VERTICAL);
        LinearLayout.LayoutParams gridParams = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        gridParams.setMargins(0, dp(8), 0, 0);
        grid.setLayoutParams(gridParams);

        int columns = buttons.length >= 3 ? 3 : 2;
        for (int i = 0; i < buttons.length; i += columns) {
            LinearLayout row = new LinearLayout(this);
            row.setOrientation(LinearLayout.HORIZONTAL);
            LinearLayout.LayoutParams rowParams = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
            rowParams.setMargins(0, dp(6), 0, 0);
            row.setLayoutParams(rowParams);
            for (int offset = 0; offset < columns && i + offset < buttons.length; offset++) {
                Button button = buttons[i + offset];
                button.setTextSize(12);
                LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(0, dp(42), 1);
                params.setMargins(offset == 0 ? 0 : dp(3), 0, offset == columns - 1 ? 0 : dp(3), 0);
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
        button.setSingleLine(true);
        button.setEllipsize(TextUtils.TruncateAt.END);
        button.setMinWidth(0);
        button.setMinHeight(dp(42));
        button.setPadding(dp(8), 0, dp(8), 0);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            button.setAutoSizeTextTypeUniformWithConfiguration(11, 15, 1, android.util.TypedValue.COMPLEX_UNIT_SP);
        }
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
