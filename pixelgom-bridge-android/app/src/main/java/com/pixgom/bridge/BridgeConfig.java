package com.pixgom.bridge;

import android.content.Context;
import android.content.SharedPreferences;
import android.text.TextUtils;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;

final class BridgeConfig {
    static final String KAKAO_PACKAGE = "com.kakao.talk";
    static final String DEFAULT_SERVER_URL = "https://ka-kao-bot.vercel.app/chat-event";
    static final String DEFAULT_ROOM_NAME = "픽셀곰";
    static final String DEFAULT_ROOM_ID = "gu25P5vi";
    static final String DEFAULT_ROOM_LINK = "https://open.kakao.com/o/gu25P5vi";

    private static final String PREFS = "pixelgom_bridge";
    private static final String KEY_ENABLED = "enabled";
    private static final String KEY_SERVER_URL = "server_url";
    private static final String KEY_ROOM_NAME = "room_name";
    private static final String KEY_ROOM_ID = "room_id";
    private static final String KEY_ROOM_LINK = "room_link";
    private static final String KEY_SCRIPT_ENABLED = "script_enabled";
    private static final String KEY_SCRIPT_SOURCE = "script_source";
    private static final String KEY_LOGS = "logs";
    private static final int MAX_LOG_LINES = 80;

    private BridgeConfig() {}

    static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static boolean isEnabled(Context context) {
        return prefs(context).getBoolean(KEY_ENABLED, true);
    }

    static void setEnabled(Context context, boolean enabled) {
        prefs(context).edit().putBoolean(KEY_ENABLED, enabled).apply();
    }

    static String serverUrl(Context context) {
        return textOrDefault(prefs(context).getString(KEY_SERVER_URL, DEFAULT_SERVER_URL), DEFAULT_SERVER_URL);
    }

    static void setServerUrl(Context context, String value) {
        prefs(context).edit().putString(KEY_SERVER_URL, textOrDefault(value, DEFAULT_SERVER_URL)).apply();
    }

    static String roomName(Context context) {
        return textOrDefault(prefs(context).getString(KEY_ROOM_NAME, DEFAULT_ROOM_NAME), DEFAULT_ROOM_NAME);
    }

    static void setRoomName(Context context, String value) {
        prefs(context).edit().putString(KEY_ROOM_NAME, textOrDefault(value, DEFAULT_ROOM_NAME)).apply();
    }

    static String roomId(Context context) {
        return textOrDefault(prefs(context).getString(KEY_ROOM_ID, DEFAULT_ROOM_ID), DEFAULT_ROOM_ID);
    }

    static void setRoomId(Context context, String value) {
        prefs(context).edit().putString(KEY_ROOM_ID, textOrDefault(value, DEFAULT_ROOM_ID)).apply();
    }

    static String roomLink(Context context) {
        return textOrDefault(prefs(context).getString(KEY_ROOM_LINK, DEFAULT_ROOM_LINK), DEFAULT_ROOM_LINK);
    }

    static boolean scriptEnabled(Context context) {
        return prefs(context).getBoolean(KEY_SCRIPT_ENABLED, true);
    }

    static void setScriptEnabled(Context context, boolean enabled) {
        prefs(context).edit().putBoolean(KEY_SCRIPT_ENABLED, enabled).apply();
    }

    static String scriptSource(Context context) {
        return textOrDefault(prefs(context).getString(KEY_SCRIPT_SOURCE, DEFAULT_SCRIPT_SOURCE), DEFAULT_SCRIPT_SOURCE);
    }

    static void setScriptSource(Context context, String value) {
        prefs(context).edit().putString(KEY_SCRIPT_SOURCE, textOrDefault(value, DEFAULT_SCRIPT_SOURCE)).apply();
    }

    static String defaultScriptSource() {
        return DEFAULT_SCRIPT_SOURCE;
    }

    static String normalized(String value) {
        if (value == null) return "";
        return value.replace('\u00a0', ' ').replaceAll("\\s+", " ").trim().toLowerCase(Locale.ROOT);
    }

    static boolean roomMatches(Context context, String rawRoom) {
        String configured = normalizedRoomName(roomName(context));
        String raw = normalizedRoomName(rawRoom);
        if (configured.isEmpty() || raw.isEmpty()) return false;
        if (configured.equals(raw)) return true;
        return raw.startsWith(configured + " ") || raw.startsWith(configured + "(");
    }

    static void appendLog(Context context, String line) {
        String now = new SimpleDateFormat("MM-dd HH:mm:ss", Locale.KOREA).format(new Date());
        String existing = prefs(context).getString(KEY_LOGS, "");
        List<String> lines = new ArrayList<>();
        if (!TextUtils.isEmpty(existing)) {
            for (String item : existing.split("\\n")) {
                if (!TextUtils.isEmpty(item.trim())) lines.add(item);
            }
        }
        lines.add(0, now + "  " + line);
        while (lines.size() > MAX_LOG_LINES) lines.remove(lines.size() - 1);
        prefs(context).edit().putString(KEY_LOGS, TextUtils.join("\n", lines)).apply();
    }

    static String logs(Context context) {
        return prefs(context).getString(KEY_LOGS, "");
    }

    static void clearLogs(Context context) {
        prefs(context).edit().remove(KEY_LOGS).apply();
    }

    private static String textOrDefault(String value, String fallback) {
        if (value == null) return fallback;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? fallback : trimmed;
    }

    private static String normalizedRoomName(String value) {
        String text = normalized(value);
        text = text.replaceAll("\\s*\\([0-9]+\\)$", "");
        text = text.replaceAll("\\s+[0-9]+$", "");
        return text.trim();
    }

    private static final String DEFAULT_SCRIPT_SOURCE =
            "// MessengerBot 호환 예제입니다. 서버 응답이 없거나 미등록 명령이면 실행됩니다.\n" +
            "const bot = BotManager.getCurrentBot();\n" +
            "\n" +
            "bot.addListener(Event.MESSAGE, function(message) {\n" +
            "  if (message.content === '/브릿지') {\n" +
            "    message.reply('픽셀곰 브릿지 JS 자동응답 작동 중입니다.');\n" +
            "  }\n" +
            "});\n" +
            "\n" +
            "// 레거시 MessengerBot 형식도 지원합니다.\n" +
            "function response(room, msg, sender, isGroupChat, replier, imageDB, packageName) {\n" +
            "  if (msg === '/js상태') {\n" +
            "    replier.reply('JS 엔진 정상 작동');\n" +
            "  }\n" +
            "}\n";
}
