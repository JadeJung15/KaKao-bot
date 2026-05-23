package com.pixgom.bridge;

import android.app.Notification;
import android.os.Bundle;
import android.os.Parcelable;
import android.service.notification.StatusBarNotification;
import android.text.TextUtils;

final class KakaoNotificationParser {
    private KakaoNotificationParser() {}

    static BridgeEvent parse(StatusBarNotification statusBarNotification, String configuredRoom, String roomId, String roomLink) {
        Notification notification = statusBarNotification.getNotification();
        if (notification == null || notification.extras == null) return null;

        Bundle extras = notification.extras;
        String title = text(extras, Notification.EXTRA_TITLE);
        String text = firstText(
                lastMessageText(extras),
                text(extras, Notification.EXTRA_BIG_TEXT),
                text(extras, Notification.EXTRA_TEXT)
        );
        String room = firstText(
                text(extras, Notification.EXTRA_CONVERSATION_TITLE),
                text(extras, Notification.EXTRA_SUB_TEXT),
                text(extras, Notification.EXTRA_SUMMARY_TEXT)
        );
        String sender = firstText(lastMessageSender(extras), title);
        boolean group = extras.getBoolean("android.isGroupConversation", false) || !TextUtils.isEmpty(room);

        if (TextUtils.isEmpty(room) && BridgeConfig.normalized(title).equals(BridgeConfig.normalized(configuredRoom))) {
            room = configuredRoom;
        }
        if (TextUtils.isEmpty(room)) return null;
        if (TextUtils.isEmpty(sender) || BridgeConfig.normalized(sender).equals(BridgeConfig.normalized(room))) sender = "미정";
        if (TextUtils.isEmpty(text)) return null;

        BridgeEvent event = new BridgeEvent();
        event.room = configuredRoom;
        event.rawRoom = room;
        event.roomId = roomId;
        event.roomLink = roomLink;
        event.sender = sender;
        event.message = text;
        event.packageName = statusBarNotification.getPackageName();
        event.groupChat = group;
        fillSystemEvent(event);
        return event;
    }

    private static String text(Bundle extras, String key) {
        CharSequence value = extras.getCharSequence(key);
        return value == null ? "" : value.toString().trim();
    }

    private static String firstText(String... values) {
        for (String value : values) {
            if (!TextUtils.isEmpty(value)) return value.trim();
        }
        return "";
    }

    private static String lastMessageText(Bundle extras) {
        Bundle message = lastMessage(extras);
        CharSequence value = message == null ? null : message.getCharSequence("text");
        return value == null ? "" : value.toString().trim();
    }

    private static String lastMessageSender(Bundle extras) {
        Bundle message = lastMessage(extras);
        if (message == null) return "";
        CharSequence sender = message.getCharSequence("sender");
        return sender == null ? "" : sender.toString().trim();
    }

    private static Bundle lastMessage(Bundle extras) {
        Parcelable[] messages = extras.getParcelableArray(Notification.EXTRA_MESSAGES);
        if (messages == null || messages.length == 0) return null;
        for (int i = messages.length - 1; i >= 0; i--) {
            if (messages[i] instanceof Bundle) {
                Bundle message = (Bundle) messages[i];
                if (!TextUtils.isEmpty(message.getCharSequence("text"))) return message;
            }
        }
        return null;
    }

    private static void fillSystemEvent(BridgeEvent event) {
        String message = event.message == null ? "" : event.message.trim();
        if (message.endsWith("님이 들어왔습니다")) {
            event.eventType = "entered";
            event.targetName = message.replace("님이 들어왔습니다", "").trim();
        } else if (message.endsWith("님이 나갔습니다")) {
            event.eventType = "left";
            event.targetName = message.replace("님이 나갔습니다", "").trim();
        } else if (message.endsWith("님을 내보냈습니다")) {
            event.eventType = "kicked";
            event.targetName = message.replace("님을 내보냈습니다", "").trim();
        } else {
            event.eventType = "";
            event.targetName = "";
        }
    }
}
