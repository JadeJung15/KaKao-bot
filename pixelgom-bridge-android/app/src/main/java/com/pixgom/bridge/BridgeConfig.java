package com.pixgom.bridge;

import android.content.Context;
import android.content.SharedPreferences;
import android.text.TextUtils;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

final class BridgeConfig {
    static final String KAKAO_PACKAGE = "com.kakao.talk";
    static final String DEFAULT_SERVER_URL = "https://pixgom.com/chat-event";
    private static final String OLD_SERVER_URL = "https://ka-kao-bot.vercel.app/chat-event";
    static final String DEFAULT_ROOM_NAME = "픽셀곰";
    static final String DEFAULT_ROOM_ID = "gu25P5vi";
    static final String DEFAULT_ROOM_LINK = "https://open.kakao.com/o/gu25P5vi";
    static final String DEFAULT_JOIN_PHRASE = "픽셀곰 입장확인";
    static final int MONTHLY_PRICE_KRW = 5500;

    private static final String PREFS = "pixelgom_bridge";
    private static final String KEY_ENABLED = "enabled";
    private static final String KEY_SERVER_URL = "server_url";
    private static final String KEY_ROOM_NAME = "room_name";
    private static final String KEY_ROOM_ID = "room_id";
    private static final String KEY_ROOM_LINK = "room_link";
    private static final String KEY_ROOM_PROFILES = "room_profiles";
    private static final String KEY_DEVICE_LICENSE = "device_license";
    private static final String KEY_SCRIPT_ENABLED = "script_enabled";
    private static final String KEY_SCRIPT_SOURCE = "script_source";
    private static final String KEY_FEATURE_ATTENDANCE = "feature_attendance";
    private static final String KEY_FEATURE_POINTS = "feature_points";
    private static final String KEY_FEATURE_RANKINGS = "feature_rankings";
    private static final String KEY_FEATURE_HISTORY = "feature_history";
    private static final String KEY_FEATURE_PROFILES = "feature_profiles";
    private static final String KEY_FEATURE_GAMES = "feature_games";
    private static final String KEY_RECORD_ONLY_MIGRATION = "record_only_migration_v8";
    private static final String KEY_LOGS = "logs";
    private static final String KEY_LAST_CONNECT_SUMMARY = "last_connect_summary";
    private static final String KEY_LAST_PROFILE_SYNC_SUMMARY = "last_profile_sync_summary";
    private static final String KEY_LAST_IGNORE_REASON = "last_ignore_reason";
    private static final String KEY_PENDING_EVENTS = "pending_events";
    private static final String KEY_LAST_SEND_SUCCESS = "last_send_success";
    private static final String KEY_LAST_SEND_FAILURE = "last_send_failure";
    private static final String KEY_LAST_SERVER_TIMING = "last_server_timing";
    private static final String KEY_LAST_COMMAND_SUCCESS = "last_command_success";
    private static final String EMPTY_ROOM_PROFILES = "__PIXGOM_EMPTY_ROOM_PROFILES__";
    private static final int MAX_LOG_LINES = 80;
    private static final int MAX_PENDING_EVENTS = 80;

    private BridgeConfig() {}

    static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static void applyMigrations(Context context) {
        SharedPreferences prefs = prefs(context);
        if (TextUtils.isEmpty(prefs.getString(KEY_ROOM_PROFILES, ""))) {
            String roomName = textOrDefault(prefs.getString(KEY_ROOM_NAME, DEFAULT_ROOM_NAME), DEFAULT_ROOM_NAME);
            String roomId = textOrDefault(prefs.getString(KEY_ROOM_ID, DEFAULT_ROOM_ID), DEFAULT_ROOM_ID);
            String roomLink = textOrDefault(prefs.getString(KEY_ROOM_LINK, DEFAULT_ROOM_LINK), DEFAULT_ROOM_LINK);
            prefs.edit().putString(KEY_ROOM_PROFILES, roomProfileLine(roomName, roomId, roomLink, DEFAULT_JOIN_PHRASE, DEFAULT_ROOM_NAME, deviceLicenseKey(context))).apply();
        }
        if (prefs.getBoolean(KEY_RECORD_ONLY_MIGRATION, false)) return;
        String currentServerUrl = prefs.getString(KEY_SERVER_URL, DEFAULT_SERVER_URL);
        SharedPreferences.Editor editor = prefs.edit()
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
        return firstRoomProfile(context).name;
    }

    static void setRoomName(Context context, String value) {
        prefs(context).edit().putString(KEY_ROOM_NAME, textOrDefault(value, DEFAULT_ROOM_NAME)).apply();
    }

    static String roomId(Context context) {
        return firstRoomProfile(context).roomId;
    }

    static void setRoomId(Context context, String value) {
        prefs(context).edit().putString(KEY_ROOM_ID, textOrDefault(value, DEFAULT_ROOM_ID)).apply();
    }

    static String roomLink(Context context) {
        return firstRoomProfile(context).roomLink;
    }

    static String roomProfilesText(Context context) {
        String stored = prefs(context).getString(KEY_ROOM_PROFILES, defaultRoomProfilesText());
        if (EMPTY_ROOM_PROFILES.equals(stored)) return EMPTY_ROOM_PROFILES;
        return textOrDefault(stored, defaultRoomProfilesText());
    }

    static void setRoomProfilesText(Context context, String value) {
        String text = textOrDefault(value, defaultRoomProfilesText());
        prefs(context).edit().putString(KEY_ROOM_PROFILES, text).apply();
    }

    static String defaultRoomProfilesText() {
        return roomProfileLine(DEFAULT_ROOM_NAME, DEFAULT_ROOM_ID, DEFAULT_ROOM_LINK, DEFAULT_JOIN_PHRASE, DEFAULT_ROOM_NAME, "");
    }

    static void clearServerSettings(Context context) {
        prefs(context).edit()
                .putBoolean(KEY_ENABLED, false)
                .putString(KEY_SERVER_URL, DEFAULT_SERVER_URL)
                .putString(KEY_ROOM_PROFILES, EMPTY_ROOM_PROFILES)
                .remove(KEY_ROOM_NAME)
                .remove(KEY_ROOM_ID)
                .remove(KEY_ROOM_LINK)
                .remove(KEY_DEVICE_LICENSE)
                .remove(KEY_LAST_CONNECT_SUMMARY)
                .remove(KEY_LAST_PROFILE_SYNC_SUMMARY)
                .remove(KEY_LAST_IGNORE_REASON)
                .remove(KEY_PENDING_EVENTS)
                .remove(KEY_LAST_SEND_SUCCESS)
                .remove(KEY_LAST_SEND_FAILURE)
                .remove(KEY_LAST_SERVER_TIMING)
                .remove(KEY_LAST_COMMAND_SUCCESS)
                .apply();
        appendLog(context, "서버 설정 초기화 / 등록 취소 완료");
    }

    static String deviceLicenseKey(Context context) {
        SharedPreferences prefs = prefs(context);
        String existing = prefs.getString(KEY_DEVICE_LICENSE, "");
        if (!TextUtils.isEmpty(existing)) return existing;
        String created = "PXG-" + DEFAULT_ROOM_ID.toUpperCase(Locale.ROOT) + "-" + UUID.randomUUID().toString().replace("-", "").substring(0, 8).toUpperCase(Locale.ROOT);
        prefs.edit().putString(KEY_DEVICE_LICENSE, created).apply();
        return created;
    }

    static void setPrimaryRoomProfile(Context context, String name, String roomId, String roomLink, String joinPhrase, String admins, String licenseKey) {
        List<RoomProfile> profiles = roomProfiles(context);
        RoomProfile updated = new RoomProfile(name, roomId, roomLink, joinPhrase, adminList(admins), textOrDefault(licenseKey, deviceLicenseKey(context)), "general", "");
        if (profiles.isEmpty()) {
            profiles.add(updated);
        } else {
            int generalIndex = -1;
            for (int i = 0; i < profiles.size(); i++) {
                if (!profiles.get(i).isGameRoom()) {
                    generalIndex = i;
                    break;
                }
            }
            if (generalIndex >= 0) {
                profiles.set(generalIndex, updated);
            } else {
                profiles.add(0, updated);
            }
        }
        List<String> lines = new ArrayList<>();
        for (RoomProfile profile : profiles) {
            lines.add(roomProfileLine(profile.name, profile.roomId, profile.roomLink, profile.joinPhrase, TextUtils.join(",", profile.admins), profile.licenseKey, profile.roomRole, profile.canonicalRoomName));
        }
        prefs(context).edit().putString(KEY_ROOM_PROFILES, TextUtils.join("\n", lines)).apply();
    }

    static void addOrUpdateRoomProfile(Context context, String name, String roomId, String roomLink, String joinPhrase, String admins, String licenseKey) {
        addOrUpdateRoomProfile(context, name, roomId, roomLink, joinPhrase, admins, licenseKey, "", "");
    }

    static void addOrUpdateRoomProfile(Context context, String name, String roomId, String roomLink, String joinPhrase, String admins, String licenseKey, String roomRole, String canonicalRoomName) {
        List<RoomProfile> profiles = roomProfiles(context);
        RoomProfile updated = new RoomProfile(name, roomId, roomLink, joinPhrase, adminList(admins), textOrDefault(licenseKey, deviceLicenseKey(context)), roomRole, canonicalRoomName);
        List<RoomProfile> next = new ArrayList<>();
        next.add(updated);

        boolean replaceDefault = shouldReplaceDefaultProfile(profiles, updated);
        for (RoomProfile profile : profiles) {
            if (replaceDefault) continue;
            if (sameRoomProfile(profile, updated)) continue;
            next.add(profile);
        }

        List<String> lines = new ArrayList<>();
        for (RoomProfile profile : next) {
            lines.add(roomProfileLine(profile.name, profile.roomId, profile.roomLink, profile.joinPhrase, TextUtils.join(",", profile.admins), profile.licenseKey, profile.roomRole, profile.canonicalRoomName));
        }
        prefs(context).edit().putString(KEY_ROOM_PROFILES, TextUtils.join("\n", lines)).apply();
    }

    static List<RoomProfile> roomProfiles(Context context) {
        return parseRoomProfiles(roomProfilesText(context));
    }

    static int roomProfileCount(Context context) {
        return roomProfiles(context).size();
    }

    static RoomProfile firstRoomProfile(Context context) {
        return primaryGeneralRoomProfile(context);
    }

    static RoomProfile primaryGeneralRoomProfile(Context context) {
        List<RoomProfile> profiles = roomProfiles(context);
        for (RoomProfile profile : profiles) {
            if (!profile.isGameRoom()) return profile;
        }
        return profiles.isEmpty()
                ? new RoomProfile(DEFAULT_ROOM_NAME, DEFAULT_ROOM_ID, DEFAULT_ROOM_LINK, DEFAULT_JOIN_PHRASE, new String[]{ DEFAULT_ROOM_NAME }, "")
                : profiles.get(0);
    }

    static String roomNames(Context context) {
        List<String> names = new ArrayList<>();
        for (RoomProfile profile : roomProfiles(context)) {
            if (!TextUtils.isEmpty(profile.name)) names.add(profile.name);
        }
        return TextUtils.join(",", names);
    }

    static String roomProfilesSummary(Context context) {
        List<String> rows = new ArrayList<>();
        rows.add(generalRoomProfilesSummary(context));
        rows.add(gameRoomProfilesSummary(context));
        String lastConnect = lastConnectSummary(context);
        if (!TextUtils.isEmpty(lastConnect)) rows.add("최근 연결: " + lastConnect);
        String lastSync = lastProfileSyncSummary(context);
        if (!TextUtils.isEmpty(lastSync)) rows.add("최근 서버 동기화: " + lastSync);
        String lastSuccess = lastCommandSuccessSummary(context);
        if (!TextUtils.isEmpty(lastSuccess)) rows.add("최근 처리 성공: " + lastSuccess);
        String lastIgnore = lastIgnoreReason(context);
        if (!TextUtils.isEmpty(lastIgnore)) rows.add("최근 무시 알림: " + lastIgnore);
        return rows.isEmpty() ? "등록된 방 없음" : TextUtils.join("\n", rows);
    }

    static String generalRoomProfilesSummary(Context context) {
        List<RoomProfile> profiles = roomProfiles(context);
        List<String> rows = new ArrayList<>();
        int index = 1;
        for (RoomProfile profile : profiles) {
            if (profile.isGameRoom()) continue;
            String prefix = index == 1 ? "대표방(일반방)" : "일반방 " + index;
            rows.add(prefix + ": " + roomProfileDisplayLine(profile, false));
            index++;
        }
        if (!rows.isEmpty()) return TextUtils.join("\n", rows);
        RoomProfile fallback = primaryGeneralRoomProfile(context);
        return "대표방(일반방): " + roomProfileDisplayLine(fallback, false);
    }

    static int gameRoomProfileCount(Context context) {
        int count = 0;
        for (RoomProfile profile : roomProfiles(context)) {
            if (profile.isGameRoom()) count++;
        }
        return count;
    }

    static String gameRoomProfilesSummary(Context context) {
        List<String> rows = new ArrayList<>();
        int gameCount = gameRoomProfileCount(context);
        if (gameCount == 0) return "연결된 게임방 없음";
        rows.add("연결된 게임방 " + gameCount + "개");
        int index = 1;
        for (RoomProfile profile : roomProfiles(context)) {
            if (!profile.isGameRoom()) continue;
            rows.add(index + ". " + roomProfileDisplayLine(profile, true));
            index++;
        }
        return TextUtils.join("\n", rows);
    }

    private static String roomProfileDisplayLine(RoomProfile profile, boolean includeCanonical) {
        String canonical = "";
        if (includeCanonical && !TextUtils.isEmpty(profile.canonicalRoomName)) {
            canonical = " / 기준 일반방: " + profile.canonicalRoomName;
        }
        return profile.roleBadge() + " " + profile.name + " / " + profile.roomId + canonical + " / " + profile.joinPhrase;
    }

    static String roomProfilesJson(Context context) {
        JSONArray rooms = new JSONArray();
        try {
            for (RoomProfile profile : roomProfiles(context)) {
                JSONObject room = new JSONObject();
                room.put("roomName", profile.name);
                room.put("roomId", profile.roomId);
                room.put("roomLink", profile.roomLink);
                room.put("joinPhrase", profile.joinPhrase);
                room.put("licenseKey", profile.licenseKey);
                room.put("roomRole", profile.roomRole);
                room.put("canonicalRoomName", profile.canonicalRoomName);
                rooms.put(room);
            }
        } catch (Exception ignored) {
            return "[]";
        }
        return rooms.toString();
    }

    static RoomProfile matchingProfile(Context context, String rawRoom) {
        String raw = normalizedRoomName(rawRoom);
        if (raw.isEmpty()) return null;
        List<RoomProfile> profiles = roomProfiles(context);
        profiles.sort((left, right) -> Integer.compare(normalizedRoomName(right.name).length(), normalizedRoomName(left.name).length()));
        for (RoomProfile profile : profiles) {
            String configured = normalizedRoomName(profile.name);
            if (configured.isEmpty()) continue;
            if (configured.equals(raw) || raw.startsWith(configured + " ") || raw.startsWith(configured + "(")) {
                return profile;
            }
        }
        return null;
    }

    static void applyRoomProfile(BridgeEvent event, RoomProfile profile) {
        if (event == null || profile == null) return;
        event.room = profile.name;
        event.roomId = profile.roomId;
        event.roomLink = profile.roomLink;
        event.joinPhrase = profile.joinPhrase;
        event.licenseKey = profile.licenseKey;
        event.roomAdmins = profile.admins;
        event.monthlyPriceKrw = MONTHLY_PRICE_KRW;
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

    static boolean attendanceEnabled(Context context) {
        return prefs(context).getBoolean(KEY_FEATURE_ATTENDANCE, true);
    }

    static void setAttendanceEnabled(Context context, boolean enabled) {
        prefs(context).edit().putBoolean(KEY_FEATURE_ATTENDANCE, enabled).apply();
    }

    static boolean pointsEnabled(Context context) {
        return prefs(context).getBoolean(KEY_FEATURE_POINTS, true);
    }

    static void setPointsEnabled(Context context, boolean enabled) {
        prefs(context).edit().putBoolean(KEY_FEATURE_POINTS, enabled).apply();
    }

    static boolean rankingsEnabled(Context context) {
        return prefs(context).getBoolean(KEY_FEATURE_RANKINGS, true);
    }

    static void setRankingsEnabled(Context context, boolean enabled) {
        prefs(context).edit().putBoolean(KEY_FEATURE_RANKINGS, enabled).apply();
    }

    static boolean historyEnabled(Context context) {
        return prefs(context).getBoolean(KEY_FEATURE_HISTORY, true);
    }

    static void setHistoryEnabled(Context context, boolean enabled) {
        prefs(context).edit().putBoolean(KEY_FEATURE_HISTORY, enabled).apply();
    }

    static boolean profilesEnabled(Context context) {
        return prefs(context).getBoolean(KEY_FEATURE_PROFILES, true);
    }

    static void setProfilesEnabled(Context context, boolean enabled) {
        prefs(context).edit().putBoolean(KEY_FEATURE_PROFILES, enabled).apply();
    }

    static boolean gamesEnabled(Context context) {
        return prefs(context).getBoolean(KEY_FEATURE_GAMES, false);
    }

    static void setGamesEnabled(Context context, boolean enabled) {
        prefs(context).edit().putBoolean(KEY_FEATURE_GAMES, enabled).apply();
    }

    static String featureSummary(Context context) {
        List<String> enabled = new ArrayList<>();
        if (attendanceEnabled(context)) enabled.add("출석");
        if (pointsEnabled(context)) enabled.add("포인트");
        if (rankingsEnabled(context)) enabled.add("랭킹");
        if (historyEnabled(context)) enabled.add("히스토리");
        if (profilesEnabled(context)) enabled.add("프로필");
        if (scriptEnabled(context)) enabled.add("JS");
        if (gamesEnabled(context)) enabled.add("게임");
        return enabled.isEmpty() ? "모두 꺼짐" : TextUtils.join(", ", enabled);
    }

    static String defaultScriptSource() {
        return DEFAULT_SCRIPT_SOURCE;
    }

    static String normalized(String value) {
        if (value == null) return "";
        return value.replace('\u00a0', ' ').replaceAll("\\s+", " ").trim().toLowerCase(Locale.ROOT);
    }

    static boolean roomMatches(Context context, String rawRoom) {
        return matchingProfile(context, rawRoom) != null;
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

    private static List<RoomProfile> parseRoomProfiles(String value) {
        List<RoomProfile> profiles = new ArrayList<>();
        if (EMPTY_ROOM_PROFILES.equals(value)) return profiles;
        String source = textOrDefault(value, defaultRoomProfilesText());
        for (String rawLine : source.split("\\r?\\n")) {
            String line = rawLine.trim();
            if (line.isEmpty()) continue;
            String[] parts = line.split("\\|", -1);
            String name = parts.length > 0 ? parts[0].trim() : "";
            if (TextUtils.isEmpty(name)) continue;
            String roomId = parts.length > 1 ? textOrDefault(parts[1], DEFAULT_ROOM_ID) : DEFAULT_ROOM_ID;
            String roomLink = parts.length > 2 ? textOrDefault(parts[2], DEFAULT_ROOM_LINK) : DEFAULT_ROOM_LINK;
            String joinPhrase = parts.length > 3 ? textOrDefault(parts[3], DEFAULT_JOIN_PHRASE) : DEFAULT_JOIN_PHRASE;
            String adminsText = parts.length > 4 ? parts[4] : name;
            String licenseKey = parts.length > 5 ? parts[5] : "";
            String roomRole = parts.length > 6 ? parts[6] : "";
            String canonicalRoomName = parts.length > 7 ? parts[7] : "";
            profiles.add(new RoomProfile(name, roomId, roomLink, joinPhrase, adminList(adminsText), licenseKey, roomRole, canonicalRoomName));
        }
        if (profiles.isEmpty()) {
            profiles.add(new RoomProfile(DEFAULT_ROOM_NAME, DEFAULT_ROOM_ID, DEFAULT_ROOM_LINK, DEFAULT_JOIN_PHRASE, new String[]{ DEFAULT_ROOM_NAME }, ""));
        }
        return profiles;
    }

    private static String[] adminList(String value) {
        String source = textOrDefault(value, DEFAULT_ROOM_NAME);
        List<String> admins = new ArrayList<>();
        for (String item : source.split(",")) {
            String name = item.trim();
            if (!name.isEmpty()) admins.add(name);
        }
        if (admins.isEmpty()) admins.add(DEFAULT_ROOM_NAME);
        return admins.toArray(new String[0]);
    }

    private static String roomProfileLine(String name, String roomId, String roomLink, String joinPhrase, String admins, String licenseKey) {
        return roomProfileLine(name, roomId, roomLink, joinPhrase, admins, licenseKey, "", "");
    }

    private static String roomProfileLine(String name, String roomId, String roomLink, String joinPhrase, String admins, String licenseKey, String roomRole, String canonicalRoomName) {
        return textOrDefault(name, DEFAULT_ROOM_NAME) + "|"
                + textOrDefault(roomId, DEFAULT_ROOM_ID) + "|"
                + textOrDefault(roomLink, DEFAULT_ROOM_LINK) + "|"
                + textOrDefault(joinPhrase, DEFAULT_JOIN_PHRASE) + "|"
                + textOrDefault(admins, DEFAULT_ROOM_NAME) + "|"
                + textOrDefault(licenseKey, "") + "|"
                + textOrDefault(roomRole, "") + "|"
                + textOrDefault(canonicalRoomName, "");
    }

    private static boolean sameRoomProfile(RoomProfile left, RoomProfile right) {
        if (left == null || right == null) return false;
        String leftId = normalized(left.roomId);
        String rightId = normalized(right.roomId);
        if (!leftId.isEmpty() && !rightId.isEmpty() && leftId.equals(rightId)) return true;
        return normalizedRoomName(left.name).equals(normalizedRoomName(right.name));
    }

    private static boolean shouldReplaceDefaultProfile(List<RoomProfile> profiles, RoomProfile incoming) {
        if (profiles == null || profiles.size() != 1 || incoming == null) return false;
        RoomProfile only = profiles.get(0);
        if (!DEFAULT_ROOM_ID.equals(only.roomId)) return false;
        if (!normalizedRoomName(DEFAULT_ROOM_NAME).equals(normalizedRoomName(only.name))) return false;
        if (DEFAULT_ROOM_ID.equals(incoming.roomId)) return false;
        return only.licenseKey == null || only.licenseKey.startsWith("PXG-" + DEFAULT_ROOM_ID.toUpperCase(Locale.ROOT) + "-");
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

    static void appendSuccessLog(Context context, String line) {
        String text = textOrDefault(line, "처리 성공");
        setLastCommandSuccessSummary(context, text);
        appendLog(context, "성공: " + text);
    }

    static void appendNoiseLog(Context context, String line) {
        String text = textOrDefault(line, "시스템 알림 무시");
        setLastIgnoreReason(context, text);
        appendLog(context, "노이즈: " + text);
    }

    static void appendDiagnosticLog(Context context, String line) {
        appendLog(context, "진단 원문: " + textOrDefault(line, "상세 없음"));
    }

    static String logs(Context context) {
        return prefs(context).getString(KEY_LOGS, "");
    }

    static String logsForDisplay(Context context) {
        String logs = logs(context);
        if (TextUtils.isEmpty(logs)) return "아직 전송 로그가 없습니다.";
        List<String> success = new ArrayList<>();
        List<String> noise = new ArrayList<>();
        List<String> diagnostic = new ArrayList<>();
        List<String> other = new ArrayList<>();
        for (String line : logs.split("\\n")) {
            String trimmed = line.trim();
            if (trimmed.isEmpty()) continue;
            if (trimmed.contains("  성공: ") || trimmed.contains("  응답: ")) {
                success.add(trimmed);
            } else if (trimmed.contains("  노이즈: ") || trimmed.contains("  무시: ")) {
                noise.add(trimmed);
            } else if (trimmed.contains("  진단 원문: ") || trimmed.contains("  진단: ") || trimmed.contains("진단 payload")) {
                diagnostic.add(trimmed);
            } else {
                other.add(trimmed);
            }
        }
        List<String> sections = new ArrayList<>();
        sections.add("성공/응답 로그\n" + limitedLogSection(success, "최근 성공 응답 없음"));
        sections.add("무시/노이즈 로그\n" + limitedLogSection(noise, "최근 무시 알림 없음"));
        sections.add("진단 원문 로그\n" + limitedLogSection(diagnostic, "최근 진단 원문 없음"));
        if (!other.isEmpty()) sections.add("기타 로그\n" + limitedLogSection(other, "기타 로그 없음"));
        return TextUtils.join("\n\n", sections);
    }

    private static String limitedLogSection(List<String> lines, String emptyText) {
        if (lines == null || lines.isEmpty()) return emptyText;
        List<String> limited = new ArrayList<>();
        int limit = Math.min(lines.size(), 12);
        for (int i = 0; i < limit; i++) limited.add(lines.get(i));
        return TextUtils.join("\n", limited);
    }

    static String newEventId() {
        return "and_" + UUID.randomUUID().toString().replace("-", "");
    }

    static String nowIso() {
        return new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSZ", Locale.KOREA).format(new Date());
    }

    static JSONArray pendingEvents(Context context) {
        String stored = prefs(context).getString(KEY_PENDING_EVENTS, "[]");
        try {
            return new JSONArray(TextUtils.isEmpty(stored) ? "[]" : stored);
        } catch (JSONException error) {
            return new JSONArray();
        }
    }

    static int pendingEventCount(Context context) {
        return pendingEvents(context).length();
    }

    static void setPendingEvents(Context context, JSONArray events) {
        prefs(context).edit().putString(KEY_PENDING_EVENTS, events == null ? "[]" : events.toString()).apply();
    }

    static void enqueuePendingEvent(Context context, JSONObject payload, String reason) {
        JSONArray events = pendingEvents(context);
        JSONObject next = payload == null ? new JSONObject() : payload;
        try {
            next.put("queuedAt", nowIso());
            next.put("lastError", textOrDefault(reason, "send_failed"));
            if (!next.has("eventId") || TextUtils.isEmpty(next.optString("eventId", ""))) next.put("eventId", newEventId());
        } catch (JSONException ignored) {
            // Pending diagnostics must not crash notification handling.
        }
        events.put(next);
        while (events.length() > MAX_PENDING_EVENTS) {
            JSONArray trimmed = new JSONArray();
            for (int index = 1; index < events.length(); index++) trimmed.put(events.opt(index));
            events = trimmed;
        }
        setPendingEvents(context, events);
    }

    static void clearPendingEvents(Context context) {
        prefs(context).edit().putString(KEY_PENDING_EVENTS, "[]").apply();
        appendLog(context, "전송 대기 큐 비움");
    }

    static void setLastSendSuccess(Context context, String value) {
        prefs(context).edit().putString(KEY_LAST_SEND_SUCCESS, textOrDefault(value, "")).apply();
    }

    static String lastSendSuccess(Context context) {
        return prefs(context).getString(KEY_LAST_SEND_SUCCESS, "");
    }

    static void setLastSendFailure(Context context, String value) {
        prefs(context).edit().putString(KEY_LAST_SEND_FAILURE, textOrDefault(value, "")).apply();
    }

    static String lastSendFailure(Context context) {
        return prefs(context).getString(KEY_LAST_SEND_FAILURE, "");
    }

    static void setLastServerTimingSummary(Context context, String value) {
        prefs(context).edit().putString(KEY_LAST_SERVER_TIMING, textOrDefault(value, "")).apply();
    }

    static String lastServerTimingSummary(Context context) {
        return prefs(context).getString(KEY_LAST_SERVER_TIMING, "");
    }

    static void setLastCommandSuccessSummary(Context context, String value) {
        prefs(context).edit().putString(KEY_LAST_COMMAND_SUCCESS, textOrDefault(value, "")).apply();
    }

    static String lastCommandSuccessSummary(Context context) {
        return prefs(context).getString(KEY_LAST_COMMAND_SUCCESS, "");
    }

    static void setLastConnectSummary(Context context, String value) {
        prefs(context).edit().putString(KEY_LAST_CONNECT_SUMMARY, textOrDefault(value, "")).apply();
    }

    static String lastConnectSummary(Context context) {
        return prefs(context).getString(KEY_LAST_CONNECT_SUMMARY, "");
    }

    static void setLastProfileSyncSummary(Context context, String value) {
        prefs(context).edit().putString(KEY_LAST_PROFILE_SYNC_SUMMARY, textOrDefault(value, "")).apply();
    }

    static String lastProfileSyncSummary(Context context) {
        return prefs(context).getString(KEY_LAST_PROFILE_SYNC_SUMMARY, "");
    }

    static void setLastIgnoreReason(Context context, String value) {
        prefs(context).edit().putString(KEY_LAST_IGNORE_REASON, textOrDefault(value, "")).apply();
    }

    static String lastIgnoreReason(Context context) {
        return prefs(context).getString(KEY_LAST_IGNORE_REASON, "");
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

    static final class RoomProfile {
        final String name;
        final String roomId;
        final String roomLink;
        final String joinPhrase;
        final String[] admins;
        final String licenseKey;
        final String roomRole;
        final String canonicalRoomName;

        RoomProfile(String name, String roomId, String roomLink, String joinPhrase, String[] admins, String licenseKey) {
            this(name, roomId, roomLink, joinPhrase, admins, licenseKey, "", "");
        }

        RoomProfile(String name, String roomId, String roomLink, String joinPhrase, String[] admins, String licenseKey, String roomRole, String canonicalRoomName) {
            this.name = textOrDefault(name, DEFAULT_ROOM_NAME);
            this.roomId = textOrDefault(roomId, DEFAULT_ROOM_ID);
            this.roomLink = textOrDefault(roomLink, DEFAULT_ROOM_LINK);
            this.joinPhrase = textOrDefault(joinPhrase, DEFAULT_JOIN_PHRASE);
            this.admins = admins == null || admins.length == 0 ? new String[]{ DEFAULT_ROOM_NAME } : admins;
            this.licenseKey = textOrDefault(licenseKey, "");
            this.roomRole = textOrDefault(roomRole, "");
            this.canonicalRoomName = textOrDefault(canonicalRoomName, "");
        }

        String roleLabel() {
            if ("game".equals(roomRole)) return "게임방";
            if ("general".equals(roomRole)) return "일반방";
            return "일반방";
        }

        String roleBadge() {
            if ("game".equals(roomRole)) return "[게임방]";
            if ("general".equals(roomRole)) return "[일반방]";
            return "[일반방]";
        }

        boolean isGameRoom() {
            return "game".equals(roomRole);
        }
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
