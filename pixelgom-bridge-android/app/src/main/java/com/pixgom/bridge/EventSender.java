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
            JSONObject features = new JSONObject();
            features.put("attendance", BridgeConfig.attendanceEnabled(context));
            features.put("points", BridgeConfig.pointsEnabled(context));
            features.put("rankings", BridgeConfig.rankingsEnabled(context));
            features.put("history", BridgeConfig.historyEnabled(context));
            features.put("profiles", BridgeConfig.profilesEnabled(context));
            features.put("localJs", BridgeConfig.scriptEnabled(context));
            features.put("games", BridgeConfig.gamesEnabled(context));
            payload.put("features", features);
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
            JSONObject features = room.optJSONObject("features");
            return new ConnectResult(
                    status,
                    room.optString("roomName", BridgeConfig.DEFAULT_ROOM_NAME),
                    room.optString("roomId", BridgeConfig.DEFAULT_ROOM_ID),
                    room.optString("roomLink", BridgeConfig.DEFAULT_ROOM_LINK),
                    room.optString("joinPhrase", BridgeConfig.DEFAULT_JOIN_PHRASE),
                    room.optString("licenseKey", ""),
                    stringArray(room.optJSONArray("roomAdmins")),
                    room.optString("serverUrl", BridgeConfig.DEFAULT_SERVER_URL),
                    featureEnabled(features, "attendance", true),
                    featureEnabled(features, "points", true),
                    featureEnabled(features, "rankings", true),
                    featureEnabled(features, "history", true),
                    featureEnabled(features, "profiles", true),
                    featureEnabled(features, "localJs", true),
                    featureEnabled(features, "games", false)
            );
        } catch (Exception error) {
            return new ConnectResult(0, error.getClass().getSimpleName() + ": " + error.getMessage());
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

        ConnectResult(
                int status,
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
            this.status = status;
            this.error = null;
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

        boolean ok() {
            return error == null && status >= 200 && status < 300;
        }
    }
}
