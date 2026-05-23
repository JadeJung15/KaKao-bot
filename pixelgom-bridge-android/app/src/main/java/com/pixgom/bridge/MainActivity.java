package com.pixgom.bridge;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.provider.Settings;
import android.text.TextUtils;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.CompoundButton;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.Switch;
import android.widget.TextView;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends Activity {
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private TextView permissionStatus;
    private TextView logView;
    private EditText serverUrlInput;
    private EditText roomNameInput;
    private EditText roomIdInput;
    private Switch enabledSwitch;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(buildContent());
    }

    @Override
    protected void onResume() {
        super.onResume();
        refreshStatus();
        refreshLogs();
    }

    private View buildContent() {
        ScrollView scrollView = new ScrollView(this);
        scrollView.setFillViewport(true);
        scrollView.setBackgroundColor(Color.rgb(255, 246, 231));

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(18), dp(18), dp(18), dp(28));
        scrollView.addView(root);

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
        enabledSwitch.setOnCheckedChangeListener((CompoundButton button, boolean checked) -> BridgeConfig.setEnabled(this, checked));
        panel.addView(enabledSwitch);

        serverUrlInput = input("서버 URL", BridgeConfig.serverUrl(this));
        panel.addView(serverUrlInput);

        roomNameInput = input("카카오 방 이름", BridgeConfig.roomName(this));
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
        privacyButton.setOnClickListener(v -> openUrl("https://pixgom.com/privacy"));
        panel.addView(privacyButton);

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

    private void saveSettings() {
        BridgeConfig.setEnabled(this, enabledSwitch.isChecked());
        BridgeConfig.setServerUrl(this, serverUrlInput.getText().toString());
        BridgeConfig.setRoomName(this, roomNameInput.getText().toString());
        BridgeConfig.setRoomId(this, roomIdInput.getText().toString());
        BridgeConfig.appendLog(this, "설정 저장됨 room=" + BridgeConfig.roomName(this) + " id=" + BridgeConfig.roomId(this));
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
