package com.pixgom.bridge;

import org.json.JSONException;
import org.json.JSONObject;

final class BridgeEvent {
    String room;
    String rawRoom;
    String roomId;
    String roomLink;
    String message;
    String sender;
    String packageName;
    String eventType;
    String targetName;
    String joinPhrase;
    String licenseKey;
    String[] roomAdmins;
    int monthlyPriceKrw;
    boolean groupChat;
    long postedAtMs;
    String senderPersonNameMasked;
    String senderPersonKeyHash;
    String senderPersonUriHash;
    String messagingUserNameMasked;
    String messagingUserKeyHash;
    String messagingUserUriHash;
    String notificationKeyHash;
    String notificationGroupKeyHash;
    String senderId;
    String profileHash;
    String authorHash;
    String senderIdSource;
    String identityPrimaryField;
    String identityHashAlgorithm;
    String identityExtractionVersion;
    boolean senderPersonKeyPresent;
    boolean senderPersonUriPresent;
    boolean messagingUserKeyPresent;
    boolean messagingUserUriPresent;
    boolean notificationKeyPresent;
    boolean notificationGroupKeyPresent;

    boolean hasRequiredFields() {
        return notBlank(room) && notBlank(roomId) && notBlank(message) && notBlank(sender);
    }

    JSONObject diagnosticPayloadV2() {
        JSONObject payload = new JSONObject();
        try {
            payload.put("payloadVersion", "2-diagnostic");
            payload.put("room", valueOrEmpty(room));
            payload.put("rawRoom", valueOrEmpty(rawRoom));
            payload.put("roomId", valueOrEmpty(roomId));
            payload.put("sender", valueOrEmpty(sender));
            payload.put("msgPreview", preview(message, 80));
            payload.put("source", "pixelgom-android-bridge");

            JSONObject identity = new JSONObject();
            putNullable(identity, "senderPersonKeyHash", senderPersonKeyHash);
            putNullable(identity, "senderPersonUriHash", senderPersonUriHash);
            putNullable(identity, "messagingUserKeyHash", messagingUserKeyHash);
            putNullable(identity, "messagingUserUriHash", messagingUserUriHash);
            putNullable(identity, "senderId", senderId);
            putNullable(identity, "profileHash", profileHash);
            putNullable(identity, "authorHash", authorHash);
            putNullable(identity, "notificationKeyHash", notificationKeyHash);
            putNullable(identity, "notificationGroupKeyHash", notificationGroupKeyHash);
            putNullable(identity, "senderPersonNameMasked", senderPersonNameMasked);
            putNullable(identity, "messagingUserNameMasked", messagingUserNameMasked);
            payload.put("identity", identity);

            JSONObject identityMeta = new JSONObject();
            identityMeta.put("hashAlgorithm", valueOrDefault(identityHashAlgorithm, "sha256"));
            identityMeta.put("extractionVersion", valueOrDefault(identityExtractionVersion, "android-bridge-v2-diagnostic"));
            identityMeta.put("senderPersonKeyPresent", senderPersonKeyPresent);
            identityMeta.put("senderPersonUriPresent", senderPersonUriPresent);
            identityMeta.put("messagingUserKeyPresent", messagingUserKeyPresent);
            identityMeta.put("messagingUserUriPresent", messagingUserUriPresent);
            identityMeta.put("notificationKeyPresent", notificationKeyPresent);
            identityMeta.put("notificationGroupKeyPresent", notificationGroupKeyPresent);
            identityMeta.put("senderIdSource", valueOrDefault(senderIdSource, "unknown"));
            identityMeta.put("profileHashSource", hasText(profileHash) ? "profile_hash" : "none");
            identityMeta.put("authorHashSource", hasText(authorHash) ? "room_sender_hash" : "none");
            identityMeta.put("primaryCandidateField", valueOrDefault(identityPrimaryField, "none"));
            identityMeta.put("fallbackUsed", "room_sender".equals(valueOrDefault(senderIdSource, "unknown")) || "nickname".equals(valueOrDefault(senderIdSource, "unknown")) || "unknown".equals(valueOrDefault(senderIdSource, "unknown")));
            payload.put("identityMeta", identityMeta);
        } catch (JSONException error) {
            try {
                payload.put("payloadVersion", "2-diagnostic");
                payload.put("error", "diagnostic_payload_build_failed");
            } catch (JSONException ignored) {
                // Keep the diagnostic path non-fatal.
            }
        }
        return payload;
    }

    String diagnosticSummaryLine() {
        return "identity-v2"
                + " senderIdSource=" + valueOrDefault(senderIdSource, "unknown")
                + " primary=" + valueOrDefault(identityPrimaryField, "none")
                + " senderPersonKeyHash=" + shortHash(senderPersonKeyHash)
                + " senderPersonUriHash=" + shortHash(senderPersonUriHash)
                + " messagingUserKeyHash=" + shortHash(messagingUserKeyHash)
                + " messagingUserUriHash=" + shortHash(messagingUserUriHash)
                + " notificationKeyHash=" + shortHash(notificationKeyHash)
                + " notificationGroupKeyHash=" + shortHash(notificationGroupKeyHash);
    }

    private boolean notBlank(String value) {
        return value != null && !value.trim().isEmpty();
    }

    private static boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }

    private static String valueOrEmpty(String value) {
        return value == null ? "" : value;
    }

    private static String valueOrDefault(String value, String fallback) {
        return hasText(value) ? value : fallback;
    }

    private static void putNullable(JSONObject object, String key, String value) throws JSONException {
        object.put(key, hasText(value) ? value : JSONObject.NULL);
    }

    private static String shortHash(String hash) {
        if (!hasText(hash)) return "null";
        return hash.length() <= 12 ? hash : hash.substring(0, 12);
    }

    private static String preview(String value, int maxLength) {
        String text = valueOrEmpty(value).replace('\n', ' ').replace('\r', ' ').trim();
        if (text.length() <= maxLength) return text;
        return text.substring(0, maxLength - 1) + "…";
    }
}
