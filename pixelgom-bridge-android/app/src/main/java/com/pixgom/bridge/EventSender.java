package com.pixgom.bridge;

import android.content.Context;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.OutputStream;
import java.io.InputStreamReader;
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
            byte[] bytes = payload.toString().getBytes(StandardCharsets.UTF_8);
            try (OutputStream output = connection.getOutputStream()) {
                output.write(bytes);
            }

            int status = connection.getResponseCode();
            BufferedReader reader = new BufferedReader(new InputStreamReader(
                    status >= 400 ? connection.getErrorStream() : connection.getInputStream(),
                    StandardCharsets.UTF_8
            ));
            StringBuilder body = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) body.append(line);
            JSONObject response = new JSONObject(body.toString());
            return new SendResult(status, response.optString("reply", ""), response.optBoolean("ignored", false), null);
        } catch (Exception error) {
            return new SendResult(0, "", false, error.getClass().getSimpleName() + ": " + error.getMessage());
        } finally {
            if (connection != null) connection.disconnect();
        }
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
}
