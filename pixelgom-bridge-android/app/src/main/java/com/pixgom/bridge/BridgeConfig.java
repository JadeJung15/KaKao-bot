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
    static final String DEFAULT_SERVER_URL = "https://pixgom.com/chat-event";
    private static final String OLD_SERVER_URL = "https://ka-kao-bot.vercel.app/chat-event";
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
    private static final String KEY_ACCESSIBILITY_SYSTEM_EVENTS = "accessibility_system_events";
    private static final String KEY_ACCESSIBILITY_AUTO_REPLY = "accessibility_auto_reply";
    private static final String KEY_RECORD_ONLY_MIGRATION = "record_only_migration_v8";
    private static final String KEY_LOGS = "logs";
    private static final int MAX_LOG_LINES = 80;

    private BridgeConfig() {}

    static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static void applyMigrations(Context context) {
        SharedPreferences prefs = prefs(context);
        if (prefs.getBoolean(KEY_RECORD_ONLY_MIGRATION, false)) return;
        String currentServerUrl = prefs.getString(KEY_SERVER_URL, DEFAULT_SERVER_URL);
        SharedPreferences.Editor editor = prefs.edit()
                .putBoolean(KEY_ACCESSIBILITY_SYSTEM_EVENTS, false)
                .putBoolean(KEY_ACCESSIBILITY_AUTO_REPLY, false)
                .putBoolean(KEY_RECORD_ONLY_MIGRATION, true);
        if (OLD_SERVER_URL.equals(currentServerUrl)) editor.putString(KEY_SERVER_URL, DEFAULT_SERVER_URL);
        editor.apply();
        appendLog(context, "업데이트 적용: 화면 감지/자동답장을 끄고 알림 브릿지 전용으로 전환");
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

    static boolean accessibilitySystemEventsEnabled(Context context) {
        return false;
    }

    static void setAccessibilitySystemEventsEnabled(Context context, boolean enabled) {
        prefs(context).edit().putBoolean(KEY_ACCESSIBILITY_SYSTEM_EVENTS, enabled).apply();
    }

    static boolean accessibilityAutoReplyEnabled(Context context) {
        return false;
    }

    static void setAccessibilityAutoReplyEnabled(Context context, boolean enabled) {
        prefs(context).edit().putBoolean(KEY_ACCESSIBILITY_AUTO_REPLY, enabled).apply();
    }

    static String normalized(String value) {
        if (value == null) return "";
        return value.replace('\u00a0', ' ').replaceAll("\\s+", " ").trim().toLowerCase(Locale.ROOT);
    }

    static boolean roomMatches(Context context, String rawRoom) {
        return !matchingRoomName(roomName(context), rawRoom).isEmpty();
    }

    static String matchingRoomName(String configuredRooms, String rawRoom) {
        String raw = normalizedRoomName(rawRoom);
        if (raw.isEmpty()) return "";
        List<String> configuredRoomNames = roomNameList(configuredRooms);
        configuredRoomNames.sort((left, right) -> Integer.compare(normalizedRoomName(right).length(), normalizedRoomName(left).length()));
        for (String configuredRoom : configuredRoomNames) {
            String configured = normalizedRoomName(configuredRoom);
            if (configured.isEmpty()) continue;
            if (configured.equals(raw) || raw.startsWith(configured + " ") || raw.startsWith(configured + "(")) {
                return configuredRoom.trim();
            }
        }
        return "";
    }

    static List<String> roomNameList(String value) {
        List<String> names = new ArrayList<>();
        String source = textOrDefault(value, DEFAULT_ROOM_NAME);
        for (String item : source.split("[,\\n]")) {
            String name = item.trim();
            if (!name.isEmpty()) names.add(name);
        }
        if (names.isEmpty()) names.add(DEFAULT_ROOM_NAME);
        return names;
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
