package com.pixgom.bridge;

import android.app.Activity;
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

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends Activity {
    private static final String WEBSITE_URL = "https://pixgom.com";

    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private TextView permissionStatus;
    private TextView logView;
    private EditText serverUrlInput;
    private EditText roomNameInput;
    private EditText roomIdInput;
    private EditText scriptSourceInput;
    private Switch enabledSwitch;
    private Switch scriptEnabledSwitch;

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

        TextView subtitle = text("픽셀곰 오픈채팅 운영봇을 카카오 알림, 서버, 로컬 JS 자동응답과 연결합니다.", 15, Color.rgb(87, 64, 47), false);
        root.addView(subtitle);

        LinearLayout infoPanel = panel();
        infoPanel.setPadding(dp(14), dp(14), dp(14), dp(14));
        root.addView(infoPanel);

        infoPanel.addView(labelValue("오픈채팅방 주소", BridgeConfig.roomLink(this)));
        infoPanel.addView(labelValue("홈페이지 주소", WEBSITE_URL));
        infoPanel.addView(labelValue("등록 방", BridgeConfig.roomName(this) + " / " + BridgeConfig.roomId(this)));

        Button startButton = primaryButton("시작하기");
        startButton.setOnClickListener(v -> showMain());
        root.addView(startButton);

        Button openChatButton = secondaryButton("오픈채팅방 열기");
        openChatButton.setOnClickListener(v -> openUrl(BridgeConfig.roomLink(this)));
        root.addView(openChatButton);

        Button websiteButton = secondaryButton("홈페이지 열기");
        websiteButton.setOnClickListener(v -> openUrl(WEBSITE_URL));
        root.addView(websiteButton);

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

        TextView subtitle = text("등록된 카카오 오픈채팅 알림만 서버로 전달하고, 서버 응답을 카카오 답장 액션으로 보냅니다.", 15, Color.rgb(87, 64, 47), false);
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

        roomNameInput = input("카카오 방 이름(쉼표로 여러 방)", BridgeConfig.roomName(this));
        panel.addView(roomNameInput);

        roomIdInput = input("오픈채팅 roomId", BridgeConfig.roomId(this));
        panel.addView(roomIdInput);

        Button saveButton = primaryButton("설정 저장");
        saveButton.setOnClickListener(v -> saveSettings());
        panel.addView(saveButton);

        Button testButton = secondaryButton("서버 테스트 전송");
        testButton.setOnClickListener(v -> sendTestEvent());
        panel.addView(testButton);

        Button privacyButton = secondaryButton("개인정보처리방침 열기");
        privacyButton.setOnClickListener(v -> openUrl(WEBSITE_URL + "/privacy"));
        panel.addView(privacyButton);

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
        scriptSourceInput = null;
        enabledSwitch = null;
        scriptEnabledSwitch = null;
    }

    private void saveSettings() {
        BridgeConfig.setEnabled(this, enabledSwitch.isChecked());
        BridgeConfig.setServerUrl(this, serverUrlInput.getText().toString());
        BridgeConfig.setRoomName(this, roomNameInput.getText().toString());
        BridgeConfig.setRoomId(this, roomIdInput.getText().toString());
        BridgeConfig.setAccessibilitySystemEventsEnabled(this, false);
        BridgeConfig.setAccessibilityAutoReplyEnabled(this, false);
        BridgeConfig.setScriptEnabled(this, scriptEnabledSwitch.isChecked());
        BridgeConfig.setScriptSource(this, scriptSourceInput.getText().toString());
        BridgeConfig.appendLog(this, "설정 저장됨 room=" + BridgeConfig.roomName(this) + " id=" + BridgeConfig.roomId(this) + " js=" + BridgeConfig.scriptEnabled(this));
        refreshStatus();
        refreshLogs();
    }

    private void sendTestEvent() {
        saveSettings();
        BridgeEvent event = new BridgeEvent();
        event.room = BridgeConfig.roomName(this);
        event.rawRoom = BridgeConfig.roomName(this);
        event.roomId = BridgeConfig.roomId(this);
        event.roomLink = BridgeConfig.roomLink(this);
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

    private void testScript() {
        BridgeConfig.setScriptSource(this, scriptSourceInput.getText().toString());
        BridgeEvent event = new BridgeEvent();
        event.room = BridgeConfig.roomName(this);
        event.rawRoom = BridgeConfig.roomName(this);
        event.roomId = BridgeConfig.roomId(this);
        event.roomLink = BridgeConfig.roomLink(this);
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
        permissionStatus.setText(permission ? "알림 접근 권한: 허용됨" : "알림 접근 권한: 필요");
        permissionStatus.setTextColor(permission ? Color.rgb(30, 104, 58) : Color.rgb(184, 74, 43));
    }

    private void refreshLogs() {
        String logs = BridgeConfig.logs(this);
        logView.setText(TextUtils.isEmpty(logs) ? "아직 전송 로그가 없습니다." : logs);
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
