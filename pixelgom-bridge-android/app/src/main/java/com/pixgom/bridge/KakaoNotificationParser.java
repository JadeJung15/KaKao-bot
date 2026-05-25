package com.pixgom.bridge;

import android.app.Notification;
import android.app.Person;
import android.os.Bundle;
import android.os.Parcelable;
import android.service.notification.StatusBarNotification;
import android.text.TextUtils;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.List;

final class KakaoNotificationParser {
    private KakaoNotificationParser() {}

    static BridgeEvent parse(StatusBarNotification statusBarNotification, String configuredRoom, String roomId, String roomLink) {
        Notification notification = statusBarNotification.getNotification();
        if (notification == null || notification.extras == null) return null;

        Bundle extras = notification.extras;
        String title = text(extras, Notification.EXTRA_TITLE);
        String rawText = bestMessageText(extras);
        String conversationTitle = text(extras, Notification.EXTRA_CONVERSATION_TITLE);
        String subText = text(extras, Notification.EXTRA_SUB_TEXT);
        String summaryText = text(extras, Notification.EXTRA_SUMMARY_TEXT);
        String room = firstMatchingRoom(configuredRoom, conversationTitle, subText, summaryText, title);
        if (TextUtils.isEmpty(room)) room = firstText(conversationTitle, subText, summaryText);
        boolean androidGroup = extras.getBoolean("android.isGroupConversation", false);

        if (TextUtils.isEmpty(room) && roomTitleMatches(title, configuredRoom)) {
            room = BridgeConfig.matchingRoomName(configuredRoom, title);
        }
        if (TextUtils.isEmpty(room)) return null;

        ParsedMessage parsed = parseSenderMessage(rawText);
        String sender = firstText(lastMessageSender(extras), parsed.sender);
        String text = firstText(parsed.message, rawText);

        if (TextUtils.isEmpty(sender) && !roomTitleMatches(title, configuredRoom)) sender = title;
        if (BridgeConfig.normalized(sender).equals(BridgeConfig.normalized(room)) && !TextUtils.isEmpty(parsed.sender)) {
            sender = parsed.sender;
        }
        if (TextUtils.isEmpty(room)) return null;
        if (TextUtils.isEmpty(sender) || BridgeConfig.normalized(sender).equals(BridgeConfig.normalized(room))) sender = "미정";
        if (TextUtils.isEmpty(text)) return null;
        boolean group = androidGroup || !TextUtils.isEmpty(room);
        String matchedConfiguredRoom = BridgeConfig.matchingRoomName(configuredRoom, room);

        BridgeEvent event = new BridgeEvent();
        event.room = TextUtils.isEmpty(matchedConfiguredRoom) ? room : matchedConfiguredRoom;
        event.rawRoom = room;
        event.roomId = roomId;
        event.roomLink = roomLink;
        event.sender = sender;
        event.message = text;
        event.packageName = statusBarNotification.getPackageName();
        event.groupChat = group;
        fillDiagnosticIdentity(event, statusBarNotification, extras);
        fillSystemEvent(event);
        return event;
    }

    private static String text(Bundle extras, String key) {
        CharSequence value = extras.getCharSequence(key);
        return value == null ? "" : value.toString().trim();
    }

    private static String bestMessageText(Bundle extras) {
        String systemText = firstSystemEventText(extras);
        if (!TextUtils.isEmpty(systemText)) return systemText;
        return firstText(
                lastMessageText(extras),
                lastTextLine(extras),
                text(extras, Notification.EXTRA_BIG_TEXT),
                text(extras, Notification.EXTRA_TEXT)
        );
    }

    private static String firstSystemEventText(Bundle extras) {
        String fromMessages = firstSystemEventTextFromMessages(extras);
        if (!TextUtils.isEmpty(fromMessages)) return fromMessages;

        CharSequence[] lines = extras.getCharSequenceArray(Notification.EXTRA_TEXT_LINES);
        if (lines != null) {
            for (int i = lines.length - 1; i >= 0; i--) {
                CharSequence line = lines[i];
                String candidate = systemEventLine(line == null ? "" : line.toString());
                if (!TextUtils.isEmpty(candidate)) return candidate;
            }
        }

        String candidate = systemEventLine(text(extras, Notification.EXTRA_BIG_TEXT));
        if (!TextUtils.isEmpty(candidate)) return candidate;
        return systemEventLine(text(extras, Notification.EXTRA_TEXT));
    }

    private static String firstSystemEventTextFromMessages(Bundle extras) {
        Parcelable[] messages = extras.getParcelableArray(Notification.EXTRA_MESSAGES);
        if (messages == null || messages.length == 0) return "";
        for (int i = messages.length - 1; i >= 0; i--) {
            Parcelable parcelable = messages[i];
            if (parcelable instanceof Bundle) {
                Bundle message = (Bundle) parcelable;
                String candidate = systemEventLine(message.getCharSequence("text") == null ? "" : message.getCharSequence("text").toString());
                if (!TextUtils.isEmpty(candidate)) return candidate;
            }
        }
        return "";
    }

    private static String lastTextLine(Bundle extras) {
        CharSequence[] lines = extras.getCharSequenceArray(Notification.EXTRA_TEXT_LINES);
        if (lines == null || lines.length == 0) return "";
        for (int i = lines.length - 1; i >= 0; i--) {
            CharSequence line = lines[i];
            if (!TextUtils.isEmpty(line)) return line.toString().trim();
        }
        return "";
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

    private static void fillDiagnosticIdentity(BridgeEvent event, StatusBarNotification statusBarNotification, Bundle extras) {
        Person senderPerson = lastMessageSenderPerson(extras);
        Person messagingUser = messagingUser(extras);

        String senderPersonName = senderPerson == null || senderPerson.getName() == null ? "" : senderPerson.getName().toString().trim();
        String senderPersonKey = senderPerson == null ? "" : safeTrim(senderPerson.getKey());
        String senderPersonUri = senderPerson == null ? "" : safeTrim(senderPerson.getUri());

        String messagingUserName = messagingUser == null || messagingUser.getName() == null ? "" : messagingUser.getName().toString().trim();
        String messagingUserKey = messagingUser == null ? "" : safeTrim(messagingUser.getKey());
        String messagingUserUri = messagingUser == null ? "" : safeTrim(messagingUser.getUri());

        String notificationKey = statusBarNotification == null ? "" : safeTrim(statusBarNotification.getKey());
        String notificationGroupKey = statusBarNotification == null ? "" : safeTrim(statusBarNotification.getGroupKey());

        event.senderPersonNameMasked = maskName(senderPersonName);
        event.messagingUserNameMasked = maskName(messagingUserName);
        event.senderPersonKeyHash = sha256(senderPersonKey);
        event.senderPersonUriHash = sha256(senderPersonUri);
        event.messagingUserKeyHash = sha256(messagingUserKey);
        event.messagingUserUriHash = sha256(messagingUserUri);
        event.notificationKeyHash = sha256(notificationKey);
        event.notificationGroupKeyHash = sha256(notificationGroupKey);

        event.senderPersonKeyPresent = hasText(senderPersonKey);
        event.senderPersonUriPresent = hasText(senderPersonUri);
        event.messagingUserKeyPresent = hasText(messagingUserKey);
        event.messagingUserUriPresent = hasText(messagingUserUri);
        event.notificationKeyPresent = hasText(notificationKey);
        event.notificationGroupKeyPresent = hasText(notificationGroupKey);

        event.authorHash = sha256(composeAuthorSeed(event.roomId, event.sender));
        event.profileHash = "";
        event.identityHashAlgorithm = "sha256";
        event.identityExtractionVersion = "android-bridge-v2-diagnostic-1";

        event.senderId = "";
        event.senderIdSource = "unknown";
        event.identityPrimaryField = "none";

        if (hasText(event.senderPersonKeyHash)) {
            event.senderId = event.senderPersonKeyHash;
            event.senderIdSource = "person_key";
            event.identityPrimaryField = "senderPersonKeyHash";
            return;
        }
        if (hasText(event.senderPersonUriHash)) {
            event.senderId = event.senderPersonUriHash;
            event.senderIdSource = "person_uri";
            event.identityPrimaryField = "senderPersonUriHash";
            return;
        }
        if (hasText(event.messagingUserKeyHash)) {
            event.senderId = event.messagingUserKeyHash;
            event.senderIdSource = "messaging_user_key";
            event.identityPrimaryField = "messagingUserKeyHash";
            return;
        }
        if (hasText(event.messagingUserUriHash)) {
            event.senderId = event.messagingUserUriHash;
            event.senderIdSource = "messaging_user_uri";
            event.identityPrimaryField = "messagingUserUriHash";
            return;
        }
        if (hasText(event.authorHash)) {
            event.senderId = event.authorHash;
            event.senderIdSource = "room_sender";
            event.identityPrimaryField = "authorHash";
            return;
        }
        if (hasText(event.sender)) {
            event.senderId = sha256(event.sender);
            event.senderIdSource = "nickname";
            event.identityPrimaryField = "sender";
        }
    }

    private static Person lastMessageSenderPerson(Bundle extras) {
        Parcelable[] messages = extras.getParcelableArray(Notification.EXTRA_MESSAGES);
        if (messages == null || messages.length == 0) return null;
        try {
            List<Notification.MessagingStyle.Message> parsed = Notification.MessagingStyle.Message.getMessagesFromBundleArray(messages);
            for (int i = parsed.size() - 1; i >= 0; i--) {
                Notification.MessagingStyle.Message message = parsed.get(i);
                if (message == null || TextUtils.isEmpty(message.getText())) continue;
                Person person = message.getSenderPerson();
                if (person != null) return person;
            }
        } catch (Throwable ignored) {
            return null;
        }
        return null;
    }

    private static Person messagingUser(Bundle extras) {
        Object fromConstant = extras.get(Notification.EXTRA_MESSAGING_PERSON);
        if (fromConstant instanceof Person) return (Person) fromConstant;
        Object fromKey = extras.get("android.messagingUser");
        if (fromKey instanceof Person) return (Person) fromKey;
        return null;
    }

    private static String maskName(String value) {
        String text = safeTrim(value);
        if (!hasText(text)) return "";
        if (text.length() == 1) return "*";
        if (text.length() == 2) return text.substring(0, 1) + "*";
        return text.substring(0, 1) + "***" + text.substring(text.length() - 1);
    }

    private static String composeAuthorSeed(String roomId, String sender) {
        String safeRoomId = safeTrim(roomId);
        String safeSender = safeTrim(sender);
        if (!hasText(safeRoomId) || !hasText(safeSender)) return "";
        return safeRoomId + ":" + safeSender;
    }

    private static String sha256(String value) {
        String text = safeTrim(value);
        if (!hasText(text)) return "";
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashed = digest.digest(text.getBytes(StandardCharsets.UTF_8));
            StringBuilder builder = new StringBuilder(hashed.length * 2);
            for (byte unit : hashed) builder.append(String.format("%02x", unit));
            return builder.toString();
        } catch (Throwable ignored) {
            return "";
        }
    }

    private static boolean hasText(String value) {
        return !TextUtils.isEmpty(value == null ? "" : value.trim());
    }

    private static String safeTrim(String value) {
        return value == null ? "" : value.trim();
    }

    private static boolean roomTitleMatches(String value, String configuredRoom) {
        return !TextUtils.isEmpty(BridgeConfig.matchingRoomName(configuredRoom, value));
    }

    private static String firstMatchingRoom(String configuredRoom, String... values) {
        for (String value : values) {
            String matched = BridgeConfig.matchingRoomName(configuredRoom, value);
            if (!TextUtils.isEmpty(matched)) return matched;
        }
        return "";
    }

    private static ParsedMessage parseSenderMessage(String value) {
        String text = value == null ? "" : value.trim();
        if (text.isEmpty()) return new ParsedMessage("", "");

        ParsedMessage colon = splitByDelimiter(text, " : ");
        if (colon.hasBoth()) return colon;
        colon = splitByDelimiter(text, ": ");
        if (colon.hasBoth()) return colon;
        colon = splitByDelimiter(text, "： ");
        if (colon.hasBoth()) return colon;

        int newline = text.indexOf('\n');
        if (newline > 0) {
            String sender = text.substring(0, newline).trim();
            String message = text.substring(newline + 1).trim();
            if (looksLikeSender(sender) && !message.isEmpty()) return new ParsedMessage(sender, message);
        }
        return new ParsedMessage("", text);
    }

    private static ParsedMessage splitByDelimiter(String text, String delimiter) {
        int index = text.indexOf(delimiter);
        if (index <= 0) return new ParsedMessage("", "");
        String sender = text.substring(0, index).trim();
        String message = text.substring(index + delimiter.length()).trim();
        if (!looksLikeSender(sender) || message.isEmpty()) return new ParsedMessage("", "");
        return new ParsedMessage(sender, message);
    }

    private static boolean looksLikeSender(String sender) {
        if (sender == null) return false;
        String text = sender.trim();
        return !text.isEmpty() && text.length() <= 40 && !text.startsWith("/");
    }

    private static void fillSystemEvent(BridgeEvent event) {
        String message = event.message == null ? "" : event.message.trim();
        message = systemEventLine(message);
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

    private static String systemEventLine(String value) {
        String text = value == null ? "" : value.replace('\u00a0', ' ').trim();
        if (text.isEmpty()) return "";
        for (String line : text.split("\\r?\\n")) {
            String cleaned = line.trim();
            if (isSystemEventLine(cleaned)) return cleaned;
        }
        String compact = text.replaceAll("\\s+", " ");
        String[] endings = { "님이 들어왔습니다", "님이 나갔습니다", "님을 내보냈습니다" };
        for (String ending : endings) {
            int index = compact.indexOf(ending);
            if (index > 0) return compact.substring(0, index + ending.length()).trim();
        }
        return isSystemEventLine(compact) ? compact : "";
    }

    private static boolean isSystemEventLine(String value) {
        if (TextUtils.isEmpty(value)) return false;
        return value.endsWith("님이 들어왔습니다")
                || value.endsWith("님이 나갔습니다")
                || value.endsWith("님을 내보냈습니다");
    }

    private static final class ParsedMessage {
        final String sender;
        final String message;

        ParsedMessage(String sender, String message) {
            this.sender = sender == null ? "" : sender;
            this.message = message == null ? "" : message;
        }

        boolean hasBoth() {
            return !TextUtils.isEmpty(sender) && !TextUtils.isEmpty(message);
        }
    }
}
