package com.pixgom.bridge;

import android.content.Context;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.OutputStream;
import java.io.InputStreamReader;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

final class EventSender {
    private EventSender() {}

    static SendResult send(Context context, BridgeEvent event) {
        JSONObject payload = buildPayload(context, event, event == null ? 0 : event.retryCount);
        return sendPayload(context, payload);
    }

    static SendResult sendPayload(Context context, JSONObject payload) {
        HttpURLConnection connection = null;
        long startedAt = System.nanoTime();
        try {
            URL url = new URL(BridgeConfig.serverUrl(context));
            connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod("POST");
            connection.setConnectTimeout(10000);
            connection.setReadTimeout(10000);
            connection.setDoOutput(true);
            connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
            writeJson(connection, payload);

            int status = connection.getResponseCode();
            JSONObject response = new JSONObject(readBody(connection, status));
            JSONObject timing = response.optJSONObject("timing");
            double clientRoundTripMs = elapsedMs(startedAt);
            String timingSummary = timingSummary(timing, clientRoundTripMs);
            if (!timingSummary.isEmpty()) BridgeConfig.setLastServerTimingSummary(context, timingSummary);
            return new SendResult(status, cleanReply(response), response.optBoolean("ignored", false), null, response.optString("eventId", timing == null ? payload.optString("eventId", "") : timing.optString("eventId", payload.optString("eventId", ""))), timingSummary, clientRoundTripMs);
        } catch (Exception error) {
            return new SendResult(0, "", false, error.getClass().getSimpleName() + ": " + error.getMessage(), payload == null ? "" : payload.optString("eventId", ""), "", elapsedMs(startedAt));
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    static RetryResult retryPending(Context context) {
        JSONArray pending = BridgeConfig.pendingEvents(context);
        JSONArray remaining = new JSONArray();
        int success = 0;
        int failed = 0;
        for (int index = 0; index < pending.length(); index++) {
            JSONObject payload = pending.optJSONObject(index);
            if (payload == null) continue;
            int retryCount = payload.optInt("retryCount", 0) + 1;
            try {
                payload.put("retryCount", retryCount);
                payload.put("bridgeSentAt", BridgeConfig.nowIso());
            } catch (Exception ignored) {
                // Keep retry best-effort.
            }
            SendResult result = sendPayload(context, payload);
            if (result.ok()) {
                success++;
            } else {
                failed++;
                try {
                    payload.put("lastError", result.error);
                } catch (Exception ignored) {
                    // Keep failed payload.
                }
                remaining.put(payload);
            }
        }
        BridgeConfig.setPendingEvents(context, remaining);
        return new RetryResult(success, failed, remaining.length());
    }

    static JSONObject buildPayload(Context context, BridgeEvent event, int retryCount) {
        JSONObject payload = new JSONObject();
        try {
            if (event.eventId == null || event.eventId.trim().isEmpty()) event.eventId = BridgeConfig.newEventId();
            event.bridgeSentAt = BridgeConfig.nowIso();
            BridgeConfig.RoomProfile matchedProfile = BridgeConfig.matchingProfile(context, event.rawRoom == null ? event.room : event.rawRoom);
            payload.put("eventId", event.eventId);
            payload.put("bridgeReceivedAt", event.bridgeReceivedAt == null ? "" : event.bridgeReceivedAt);
            payload.put("bridgeSentAt", event.bridgeSentAt);
            payload.put("retryCount", retryCount);
            payload.put("roomProfileCount", BridgeConfig.roomProfileCount(context));
            payload.put("matchedRoomRole", matchedProfile == null ? "" : matchedProfile.roomRole);
            payload.put("canonicalRoomName", matchedProfile == null ? "" : matchedProfile.canonicalRoomName);
            payload.put("room", event.room);
            payload.put("rawRoom", event.rawRoom);
            payload.put("roomId", event.roomId);
            payload.put("roomLink", event.roomLink);
            payload.put("msg", event.message);
            payload.put("sender", event.sender);
            payload.put("eventType", event.eventType == null ? "" : event.eventType);
            payload.put("targetName", event.targetName == null ? "" : event.targetName);
            payload.put("joinPhrase", event.joinPhrase == null ? "" : event.joinPhrase);
            payload.put("licenseKey", event.licenseKey == null ? "" : event.licenseKey);
            payload.put("monthlyPriceKrw", event.monthlyPriceKrw > 0 ? event.monthlyPriceKrw : BridgeConfig.MONTHLY_PRICE_KRW);
            payload.put("roomAdmins", new JSONArray(event.roomAdmins == null ? new String[0] : event.roomAdmins));
            payload.put("isGroupChat", event.groupChat);
            payload.put("rawIsGroupChat", event.groupChat);
            payload.put("packageName", event.packageName);
            payload.put("source", "pixelgom-android-bridge");
        } catch (Exception ignored) {
            // A malformed diagnostic field must not block the base send path.
        }
        return payload;
    }

    static ConnectResult connect(Context context, String code) {
        HttpURLConnection connection = null;
        try {
            JSONObject payload = new JSONObject();
            payload.put("code", code == null ? "" : code.trim());

            URL url = bridgeConnectUrl(context);
            connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod("POST");
            connection.setConnectTimeout(10000);
            connection.setReadTimeout(10000);
            connection.setDoOutput(true);
            connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
            writeJson(connection, payload);

            int status = connection.getResponseCode();
            JSONObject response = new JSONObject(readBody(connection, status));
            if (status < 200 || status >= 300 || !response.optBoolean("ok", false)) {
                return new ConnectResult(status, response.optString("error", "connect_failed"));
            }
            JSONObject room = response.optJSONObject("room");
            if (room == null) return new ConnectResult(status, "room_missing");
            JSONArray roomsArray = response.optJSONArray("rooms");
            List<RoomConnectResult> roomResults = new ArrayList<>();
            if (roomsArray != null && roomsArray.length() > 0) {
                for (int index = 0; index < roomsArray.length(); index++) {
                    JSONObject item = roomsArray.optJSONObject(index);
                    if (item != null) roomResults.add(roomConnectResult(item));
                }
            }
            if (roomResults.isEmpty()) roomResults.add(roomConnectResult(room));
            return new ConnectResult(status, roomResults);
        } catch (Exception error) {
            return new ConnectResult(0, error.getClass().getSimpleName() + ": " + error.getMessage());
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    static ApiResult login(Context context, String email, String password) {
        JSONObject payload = new JSONObject();
        try {
            payload.put("email", email == null ? "" : email.trim());
            payload.put("password", password == null ? "" : password);
        } catch (Exception ignored) {
            // Keep login payload best-effort.
        }
        return postApi(context, "/api/login", payload);
    }

    static ApiResult loginKakao(Context context, String kakaoAccessToken) {
        JSONObject payload = new JSONObject();
        try {
            payload.put("kakaoAccessToken", kakaoAccessToken == null ? "" : kakaoAccessToken);
        } catch (Exception ignored) {
            // Keep Kakao payload best-effort.
        }
        return postApi(context, "/api/login/kakao", payload);
    }

    static ApiResult linkKakao(Context context, String buyerToken, String kakaoAccessToken) {
        JSONObject payload = tokenPayload(buyerToken);
        try {
            payload.put("kakaoAccessToken", kakaoAccessToken == null ? "" : kakaoAccessToken);
        } catch (Exception ignored) {
            // Keep Kakao link payload best-effort.
        }
        return postApi(context, "/api/buyer/account/link-kakao", payload);
    }

    static ApiResult buyerConsole(Context context, String buyerToken) {
        return postApi(context, "/api/buyer/console", tokenPayload(buyerToken));
    }

    static ConnectResult autoConnect(Context context, String buyerToken, JSONArray applicationIds) {
        JSONObject payload = tokenPayload(buyerToken);
        try {
            if (applicationIds != null) payload.put("applicationIds", applicationIds);
        } catch (Exception ignored) {
            // Keep auto-connect payload best-effort.
        }
        ApiResult result = postApi(context, "/api/bridge/auto-connect", payload);
        if (!result.ok()) return new ConnectResult(result.status, result.error);
        return connectResultFromResponse(result.status, result.json);
    }

    static ConnectResult accountRoomSync(Context context, String buyerToken, JSONArray applicationIds) {
        JSONObject payload = tokenPayload(buyerToken);
        try {
            if (applicationIds != null) payload.put("applicationIds", applicationIds);
        } catch (Exception ignored) {
            // Keep room-sync payload best-effort.
        }
        ApiResult result = postApi(context, "/api/bridge/account-room-sync", payload);
        if (!result.ok()) return new ConnectResult(result.status, result.error);
        return connectResultFromResponse(result.status, result.json);
    }

    static ApiResult applyCommandPack(Context context, String buyerToken, String applicationId, String packId, String action) {
        JSONObject payload = tokenPayload(buyerToken);
        try {
            payload.put("applicationId", applicationId == null ? "" : applicationId);
            payload.put("packId", packId == null ? "" : packId);
            payload.put("action", action == null ? "apply" : action);
        } catch (Exception ignored) {
            // Keep command pack payload best-effort.
        }
        return postApi(context, "/api/buyer/command-packs/apply", payload);
    }

    static ApiResult installCommandTemplate(Context context, String buyerToken, String applicationId, String templateId) {
        JSONObject payload = tokenPayload(buyerToken);
        try {
            payload.put("applicationId", applicationId == null ? "" : applicationId);
            payload.put("templateId", templateId == null ? "" : templateId);
        } catch (Exception ignored) {
            // Keep template install payload best-effort.
        }
        return postApi(context, "/api/buyer/command-templates/install", payload);
    }

    static ApiResult deleteCustomCommand(Context context, String buyerToken, String applicationId, String trigger) {
        JSONObject payload = tokenPayload(buyerToken);
        try {
            payload.put("applicationId", applicationId == null ? "" : applicationId);
            payload.put("trigger", trigger == null ? "" : trigger);
        } catch (Exception ignored) {
            // Keep command delete payload best-effort.
        }
        return postApi(context, "/api/buyer/custom-commands/delete", payload);
    }

    static ApiResult saveRoomModeSettings(Context context, String buyerToken, String applicationId, boolean blockGamesInGeneralRoom, boolean blockOpsInGameRoom, boolean sharePointsAndInventory) {
        JSONObject payload = tokenPayload(buyerToken);
        try {
            JSONObject modeSplit = new JSONObject();
            modeSplit.put("blockGamesInGeneralRoom", blockGamesInGeneralRoom);
            modeSplit.put("blockOpsInGameRoom", blockOpsInGameRoom);
            modeSplit.put("sharePointsAndInventory", sharePointsAndInventory);
            payload.put("applicationId", applicationId == null ? "" : applicationId);
            payload.put("modeSplit", modeSplit);
        } catch (Exception ignored) {
            // Keep settings payload best-effort.
        }
        return postApi(context, "/api/buyer/room-mode-settings", payload);
    }

    static ApiResult gamePackHelp(Context context, String topic) {
        String safeTopic = topic == null ? "" : topic.trim();
        if (safeTopic.isEmpty()) return getApi(context, "/api/game-pack-help");
        return getApi(context, "/api/game-pack-help/" + URLEncoder.encode(safeTopic, StandardCharsets.UTF_8));
    }

    private static JSONObject tokenPayload(String buyerToken) {
        JSONObject payload = new JSONObject();
        try {
            payload.put("token", buyerToken == null ? "" : buyerToken);
        } catch (Exception ignored) {
            // Keep token payload best-effort.
        }
        return payload;
    }

    private static ApiResult postApi(Context context, String path, JSONObject payload) {
        HttpURLConnection connection = null;
        try {
            URL url = apiUrl(context, path);
            connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod("POST");
            connection.setConnectTimeout(10000);
            connection.setReadTimeout(10000);
            connection.setDoOutput(true);
            connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
            writeJson(connection, payload == null ? new JSONObject() : payload);

            int status = connection.getResponseCode();
            JSONObject response = new JSONObject(readBody(connection, status));
            if (status < 200 || status >= 300 || !response.optBoolean("ok", false)) {
                return new ApiResult(status, response, response.optString("message", response.optString("error", "request_failed")));
            }
            return new ApiResult(status, response, null);
        } catch (Exception error) {
            return new ApiResult(0, new JSONObject(), error.getClass().getSimpleName() + ": " + error.getMessage());
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private static ApiResult getApi(Context context, String path) {
        HttpURLConnection connection = null;
        try {
            URL url = apiUrl(context, path);
            connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod("GET");
            connection.setConnectTimeout(10000);
            connection.setReadTimeout(10000);

            int status = connection.getResponseCode();
            JSONObject response = new JSONObject(readBody(connection, status));
            if (status < 200 || status >= 300 || !response.optBoolean("ok", false)) {
                return new ApiResult(status, response, response.optString("message", response.optString("error", "request_failed")));
            }
            return new ApiResult(status, response, null);
        } catch (Exception error) {
            return new ApiResult(0, new JSONObject(), error.getClass().getSimpleName() + ": " + error.getMessage());
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private static ConnectResult connectResultFromResponse(int status, JSONObject response) {
        JSONArray roomsArray = response == null ? null : response.optJSONArray("rooms");
        List<RoomConnectResult> roomResults = new ArrayList<>();
        if (roomsArray != null) {
            for (int index = 0; index < roomsArray.length(); index++) {
                JSONObject item = roomsArray.optJSONObject(index);
                if (item != null) roomResults.add(roomConnectResult(item));
            }
        }
        if (roomResults.isEmpty()) {
            JSONObject room = response == null ? null : response.optJSONObject("room");
            if (room != null) roomResults.add(roomConnectResult(room));
        }
        return new ConnectResult(status, roomResults);
    }

    static HealthResult health(Context context) {
        HttpURLConnection connection = null;
        try {
            URL url = healthUrl(context);
            connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod("GET");
            connection.setConnectTimeout(8000);
            connection.setReadTimeout(8000);

            int status = connection.getResponseCode();
            JSONObject response = new JSONObject(readBody(connection, status));
            if (status < 200 || status >= 300 || !response.optBoolean("ok", false)) {
                return new HealthResult(status, response.optString("error", "health_failed"));
            }
            JSONObject dbStatus = response.optJSONObject("dbStatus");
            return new HealthResult(
                    status,
                    response.optString("version", ""),
                    response.optString("latestAndroidVersion", ""),
                    response.optInt("latestAndroidVersionCode", 0),
                    response.optString("minAndroidVersion", ""),
                    response.optInt("minAndroidVersionCode", 0),
                    response.optBoolean("appUpdateRequired", false),
                    dbStatus == null || dbStatus.optBoolean("ok", false),
                    dbStatus == null ? response.optString("storage", "") : dbStatus.optString("label", ""),
                    response.optString("serverTimeKst", response.optString("serverTime", ""))
            );
        } catch (Exception error) {
            return new HealthResult(0, error.getClass().getSimpleName() + ": " + error.getMessage());
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    static ProfileSyncResult roomProfileSync(Context context) {
        HttpURLConnection connection = null;
        try {
            JSONObject payload = new JSONObject();
            payload.put("rooms", new JSONArray(BridgeConfig.roomProfilesJson(context)));

            URL url = roomProfileSyncUrl(context);
            connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod("POST");
            connection.setConnectTimeout(10000);
            connection.setReadTimeout(10000);
            connection.setDoOutput(true);
            connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
            writeJson(connection, payload);

            int status = connection.getResponseCode();
            JSONObject response = new JSONObject(readBody(connection, status));
            if (status < 200 || status >= 300 || !response.optBoolean("ok", false)) {
                return new ProfileSyncResult(status, response.optString("error", "room_profile_sync_failed"));
            }
            JSONArray roomsArray = response.optJSONArray("rooms");
            List<RoomConnectResult> roomResults = new ArrayList<>();
            if (roomsArray != null) {
                for (int index = 0; index < roomsArray.length(); index++) {
                    JSONObject item = roomsArray.optJSONObject(index);
                    if (item != null) roomResults.add(roomConnectResult(item));
                }
            }
            JSONObject summary = response.optJSONObject("summary");
            JSONObject guideUrls = response.optJSONObject("guideUrls");
            return new ProfileSyncResult(
                    status,
                    roomResults,
                    summary == null ? 0 : summary.optInt("requestedRoomCount", 0),
                    summary == null ? roomResults.size() : summary.optInt("syncedRoomCount", roomResults.size()),
                    guideUrls == null ? "" : guideUrls.optString("android", "")
            );
        } catch (Exception error) {
            return new ProfileSyncResult(0, error.getClass().getSimpleName() + ": " + error.getMessage());
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private static void writeJson(HttpURLConnection connection, JSONObject payload) throws Exception {
        byte[] bytes = payload.toString().getBytes(StandardCharsets.UTF_8);
        try (OutputStream output = connection.getOutputStream()) {
            output.write(bytes);
        }
    }

    private static String readBody(HttpURLConnection connection, int status) throws Exception {
        InputStream stream = status >= 400 ? connection.getErrorStream() : connection.getInputStream();
        if (stream == null) return "{}";
        BufferedReader reader = new BufferedReader(new InputStreamReader(
                stream,
                StandardCharsets.UTF_8
        ));
        StringBuilder body = new StringBuilder();
        String line;
        while ((line = reader.readLine()) != null) body.append(line);
        return body.toString();
    }

    private static URL bridgeConnectUrl(Context context) throws Exception {
        URL serverUrl = new URL(BridgeConfig.serverUrl(context));
        String port = serverUrl.getPort() > 0 ? ":" + serverUrl.getPort() : "";
        return new URL(serverUrl.getProtocol() + "://" + serverUrl.getHost() + port + "/api/bridge/connect");
    }

    private static URL healthUrl(Context context) throws Exception {
        URL serverUrl = new URL(BridgeConfig.serverUrl(context));
        String port = serverUrl.getPort() > 0 ? ":" + serverUrl.getPort() : "";
        String query = "versionCode=" + BuildConfig.VERSION_CODE;
        return new URL(serverUrl.getProtocol() + "://" + serverUrl.getHost() + port + "/health?" + query);
    }

    private static URL roomProfileSyncUrl(Context context) throws Exception {
        URL serverUrl = new URL(BridgeConfig.serverUrl(context));
        String port = serverUrl.getPort() > 0 ? ":" + serverUrl.getPort() : "";
        return new URL(serverUrl.getProtocol() + "://" + serverUrl.getHost() + port + "/api/bridge/room-profile-sync");
    }

    private static URL apiUrl(Context context, String path) throws Exception {
        URL serverUrl = new URL(BridgeConfig.serverUrl(context));
        String port = serverUrl.getPort() > 0 ? ":" + serverUrl.getPort() : "";
        String normalizedPath = path == null || path.isEmpty() ? "/" : path;
        if (!normalizedPath.startsWith("/")) normalizedPath = "/" + normalizedPath;
        return new URL(serverUrl.getProtocol() + "://" + serverUrl.getHost() + port + normalizedPath);
    }

    private static String[] stringArray(JSONArray array) {
        if (array == null || array.length() == 0) return new String[]{ BridgeConfig.DEFAULT_ROOM_NAME };
        String[] values = new String[array.length()];
        for (int index = 0; index < array.length(); index++) {
            values[index] = array.optString(index, BridgeConfig.DEFAULT_ROOM_NAME);
        }
        return values;
    }

    private static boolean featureEnabled(JSONObject features, String key, boolean fallback) {
        if (features == null || !features.has(key)) return fallback;
        return features.optBoolean(key, fallback);
    }

    private static RoomConnectResult roomConnectResult(JSONObject room) {
        JSONObject features = room == null ? null : room.optJSONObject("features");
        return new RoomConnectResult(
                room == null ? BridgeConfig.DEFAULT_ROOM_NAME : room.optString("roomName", BridgeConfig.DEFAULT_ROOM_NAME),
                room == null ? BridgeConfig.DEFAULT_ROOM_ID : room.optString("roomId", BridgeConfig.DEFAULT_ROOM_ID),
                room == null ? BridgeConfig.DEFAULT_ROOM_LINK : room.optString("roomLink", BridgeConfig.DEFAULT_ROOM_LINK),
                room == null ? BridgeConfig.DEFAULT_JOIN_PHRASE : room.optString("joinPhrase", BridgeConfig.DEFAULT_JOIN_PHRASE),
                room == null ? "" : room.optString("licenseKey", ""),
                stringArray(room == null ? null : room.optJSONArray("roomAdmins")),
                room == null ? BridgeConfig.DEFAULT_SERVER_URL : room.optString("serverUrl", BridgeConfig.DEFAULT_SERVER_URL),
                featureEnabled(features, "attendance", true),
                featureEnabled(features, "points", true),
                featureEnabled(features, "rankings", true),
                featureEnabled(features, "history", true),
                featureEnabled(features, "profiles", true),
                featureEnabled(features, "localJs", true),
                featureEnabled(features, "games", false),
                room == null ? "" : room.optString("roomRole", ""),
                room == null ? "" : room.optString("canonicalRoomName", "")
        );
    }

    private static String cleanReply(JSONObject response) {
        if (response == null || !response.has("reply") || response.isNull("reply")) return "";
        String value = response.optString("reply", "").trim();
        if (value.equalsIgnoreCase("null") || value.equalsIgnoreCase("undefined")) return "";
        return value;
    }

    private static String timingSummary(JSONObject timing, double clientRoundTripMs) {
        if (timing == null) return "";
        return "eventId=" + timing.optString("eventId", "")
                + " total=" + timing.optDouble("totalMs", 0) + "ms"
                + " command=" + timing.optDouble("commandMs", 0) + "ms"
                + " save=" + timing.optDouble("saveStateMs", 0) + "ms"
                + " appRoundTrip=" + clientRoundTripMs + "ms"
                + " duplicate=" + timing.optBoolean("duplicate", false);
    }

    private static double elapsedMs(long startedAt) {
        return Math.max(0, Math.round((System.nanoTime() - startedAt) / 100000.0) / 10.0);
    }

    static final class SendResult {
        final int status;
        final String reply;
        final boolean ignored;
        final String error;
        final String eventId;
        final String timingSummary;
        final double clientRoundTripMs;

        SendResult(int status, String reply, boolean ignored, String error, String eventId, String timingSummary, double clientRoundTripMs) {
            this.status = status;
            this.reply = reply == null ? "" : reply;
            this.ignored = ignored;
            this.error = error;
            this.eventId = eventId == null ? "" : eventId;
            this.timingSummary = timingSummary == null ? "" : timingSummary;
            this.clientRoundTripMs = Math.max(0, clientRoundTripMs);
        }

        boolean ok() {
            return error == null && status >= 200 && status < 300;
        }
    }

    static final class RetryResult {
        final int success;
        final int failed;
        final int remaining;

        RetryResult(int success, int failed, int remaining) {
            this.success = success;
            this.failed = failed;
            this.remaining = remaining;
        }
    }

    static final class ApiResult {
        final int status;
        final JSONObject json;
        final String error;

        ApiResult(int status, JSONObject json, String error) {
            this.status = status;
            this.json = json == null ? new JSONObject() : json;
            this.error = error;
        }

        boolean ok() {
            return error == null && status >= 200 && status < 300 && json.optBoolean("ok", false);
        }
    }

    static final class ConnectResult {
        final int status;
        final String error;
        final List<RoomConnectResult> roomResults;
        final String roomName;
        final String roomId;
        final String roomLink;
        final String joinPhrase;
        final String licenseKey;
        final String[] admins;
        final String serverUrl;
        final boolean attendance;
        final boolean points;
        final boolean rankings;
        final boolean history;
        final boolean profiles;
        final boolean localJs;
        final boolean games;

        ConnectResult(int status, String error) {
            this.status = status;
            this.error = error;
            this.roomResults = new ArrayList<>();
            this.roomName = "";
            this.roomId = "";
            this.roomLink = "";
            this.joinPhrase = "";
            this.licenseKey = "";
            this.admins = new String[0];
            this.serverUrl = "";
            this.attendance = true;
            this.points = true;
            this.rankings = true;
            this.history = true;
            this.profiles = true;
            this.localJs = true;
            this.games = false;
        }

        ConnectResult(int status, List<RoomConnectResult> roomResults) {
            this.status = status;
            this.error = null;
            this.roomResults = roomResults == null ? new ArrayList<>() : roomResults;
            RoomConnectResult first = this.roomResults.isEmpty() ? null : this.roomResults.get(0);
            this.roomName = first == null ? "" : first.roomName;
            this.roomId = first == null ? "" : first.roomId;
            this.roomLink = first == null ? "" : first.roomLink;
            this.joinPhrase = first == null ? "" : first.joinPhrase;
            this.licenseKey = first == null ? "" : first.licenseKey;
            this.admins = first == null ? new String[0] : first.admins;
            this.serverUrl = first == null ? "" : first.serverUrl;
            this.attendance = first == null || first.attendance;
            this.points = first == null || first.points;
            this.rankings = first == null || first.rankings;
            this.history = first == null || first.history;
            this.profiles = first == null || first.profiles;
            this.localJs = first == null || first.localJs;
            this.games = first != null && first.games;
        }

        boolean ok() {
            return error == null && status >= 200 && status < 300;
        }
    }

    static final class RoomConnectResult {
        final String roomName;
        final String roomId;
        final String roomLink;
        final String joinPhrase;
        final String licenseKey;
        final String[] admins;
        final String serverUrl;
        final boolean attendance;
        final boolean points;
        final boolean rankings;
        final boolean history;
        final boolean profiles;
        final boolean localJs;
        final boolean games;
        final String roomRole;
        final String canonicalRoomName;

        RoomConnectResult(
                String roomName,
                String roomId,
                String roomLink,
                String joinPhrase,
                String licenseKey,
                String[] admins,
                String serverUrl,
                boolean attendance,
                boolean points,
                boolean rankings,
                boolean history,
                boolean profiles,
                boolean localJs,
                boolean games,
                String roomRole,
                String canonicalRoomName
        ) {
            this.roomName = roomName == null ? "" : roomName;
            this.roomId = roomId == null ? "" : roomId;
            this.roomLink = roomLink == null ? "" : roomLink;
            this.joinPhrase = joinPhrase == null ? "" : joinPhrase;
            this.licenseKey = licenseKey == null ? "" : licenseKey;
            this.admins = admins == null ? new String[0] : admins;
            this.serverUrl = serverUrl == null ? "" : serverUrl;
            this.attendance = attendance;
            this.points = points;
            this.rankings = rankings;
            this.history = history;
            this.profiles = profiles;
            this.localJs = localJs;
            this.games = games;
            this.roomRole = roomRole == null ? "" : roomRole;
            this.canonicalRoomName = canonicalRoomName == null ? "" : canonicalRoomName;
        }
    }

    static final class HealthResult {
        final int status;
        final String error;
        final String serverVersion;
        final String latestAndroidVersion;
        final int latestAndroidVersionCode;
        final String minAndroidVersion;
        final int minAndroidVersionCode;
        final boolean appUpdateRequired;
        final boolean dbOk;
        final String storageLabel;
        final String serverTime;

        HealthResult(int status, String error) {
            this.status = status;
            this.error = error;
            this.serverVersion = "";
            this.latestAndroidVersion = "";
            this.latestAndroidVersionCode = 0;
            this.minAndroidVersion = "";
            this.minAndroidVersionCode = 0;
            this.appUpdateRequired = false;
            this.dbOk = false;
            this.storageLabel = "";
            this.serverTime = "";
        }

        HealthResult(
                int status,
                String serverVersion,
                String latestAndroidVersion,
                int latestAndroidVersionCode,
                String minAndroidVersion,
                int minAndroidVersionCode,
                boolean appUpdateRequired,
                boolean dbOk,
                String storageLabel,
                String serverTime
        ) {
            this.status = status;
            this.error = null;
            this.serverVersion = serverVersion == null ? "" : serverVersion;
            this.latestAndroidVersion = latestAndroidVersion == null ? "" : latestAndroidVersion;
            this.latestAndroidVersionCode = latestAndroidVersionCode;
            this.minAndroidVersion = minAndroidVersion == null ? "" : minAndroidVersion;
            this.minAndroidVersionCode = minAndroidVersionCode;
            this.appUpdateRequired = appUpdateRequired;
            this.dbOk = dbOk;
            this.storageLabel = storageLabel == null ? "" : storageLabel;
            this.serverTime = serverTime == null ? "" : serverTime;
        }

        boolean ok() {
            return error == null && status >= 200 && status < 300;
        }
    }

    static final class ProfileSyncResult {
        final int status;
        final String error;
        final List<RoomConnectResult> roomResults;
        final int requestedRoomCount;
        final int syncedRoomCount;
        final String androidGuideUrl;

        ProfileSyncResult(int status, String error) {
            this.status = status;
            this.error = error;
            this.roomResults = new ArrayList<>();
            this.requestedRoomCount = 0;
            this.syncedRoomCount = 0;
            this.androidGuideUrl = "";
        }

        ProfileSyncResult(int status, List<RoomConnectResult> roomResults, int requestedRoomCount, int syncedRoomCount, String androidGuideUrl) {
            this.status = status;
            this.error = null;
            this.roomResults = roomResults == null ? new ArrayList<>() : roomResults;
            this.requestedRoomCount = requestedRoomCount;
            this.syncedRoomCount = syncedRoomCount;
            this.androidGuideUrl = androidGuideUrl == null ? "" : androidGuideUrl;
        }

        boolean ok() {
            return error == null && status >= 200 && status < 300;
        }
    }
}
