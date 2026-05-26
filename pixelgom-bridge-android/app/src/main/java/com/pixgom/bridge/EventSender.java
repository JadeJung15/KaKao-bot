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
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

final class EventSender {
    private EventSender() {}

    static SendResult send(Context context, BridgeEvent event) {
        HttpURLConnection connection = null;
        try {
            JSONObject payload = new JSONObject();
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
            return new SendResult(status, cleanReply(response), response.optBoolean("ignored", false), null);
        } catch (Exception error) {
            return new SendResult(0, "", false, error.getClass().getSimpleName() + ": " + error.getMessage());
        } finally {
            if (connection != null) connection.disconnect();
        }
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
                featureEnabled(features, "games", false)
        );
    }

    private static String cleanReply(JSONObject response) {
        if (response == null || !response.has("reply") || response.isNull("reply")) return "";
        String value = response.optString("reply", "").trim();
        if (value.equalsIgnoreCase("null") || value.equalsIgnoreCase("undefined")) return "";
        return value;
    }

    static final class SendResult {
        final int status;
        final String reply;
        final boolean ignored;
        final String error;

        SendResult(int status, String reply, boolean ignored, String error) {
            this.status = status;
            this.reply = reply == null ? "" : reply;
            this.ignored = ignored;
            this.error = error;
        }

        boolean ok() {
            return error == null && status >= 200 && status < 300;
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
                boolean games
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
}
