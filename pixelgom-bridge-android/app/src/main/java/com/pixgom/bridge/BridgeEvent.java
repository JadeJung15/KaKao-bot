package com.pixgom.bridge;

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
    boolean groupChat;

    boolean hasRequiredFields() {
        return notBlank(room) && notBlank(roomId) && notBlank(message) && notBlank(sender);
    }

    private boolean notBlank(String value) {
        return value != null && !value.trim().isEmpty();
    }
}
