package com.pixgom.bridge;

import android.content.Context;

final class BridgeLocalCommands {
    private BridgeLocalCommands() {}

    static String reply(Context context, BridgeEvent event) {
        String command = BridgeConfig.normalized(event.message);
        if (command.equals("/브릿지") || command.equals("/bridge")) {
            return bridgeStatus(context, event);
        }
        if (command.equals("/js상태") || command.equals("/jsstatus")) {
            return jsStatus(context, event);
        }
        if (command.equals("/로컬상태") || command.equals("/localstatus")) {
            return localStatus(context, event);
        }
        return "";
    }

    private static String bridgeStatus(Context context, BridgeEvent event) {
        return "픽셀곰 브릿지 앱 단독 응답 정상\n" +
                "버전: " + BuildConfig.VERSION_NAME + " (" + BuildConfig.VERSION_CODE + ")\n" +
                "방: " + safe(event.room) + "\n" +
                "방(raw): " + safe(event.rawRoom) + "\n" +
                "보낸사람: " + safe(event.sender) + "\n" +
                "roomId: " + safe(event.roomId) + "\n" +
                "화면 감지: " + (BridgeConfig.accessibilitySystemEventsEnabled(context) ? "켜짐" : "꺼짐") + "\n" +
                "화면 자동답장: " + (BridgeConfig.accessibilityAutoReplyEnabled(context) ? "켜짐" : "꺼짐") + "\n" +
                "JS 자동응답: " + (BridgeConfig.scriptEnabled(context) ? "켜짐" : "꺼짐") + "\n" +
                "MessengerBot 없이 이 응답이 보이면 삭제 테스트 통과입니다.";
    }

    private static String jsStatus(Context context, BridgeEvent event) {
        BridgeEvent testEvent = new BridgeEvent();
        testEvent.room = event.room;
        testEvent.rawRoom = event.rawRoom;
        testEvent.roomId = event.roomId;
        testEvent.roomLink = event.roomLink;
        testEvent.sender = event.sender;
        testEvent.message = "/js상태";
        testEvent.packageName = event.packageName;
        testEvent.groupChat = event.groupChat;
        ScriptBotEngine.Result result = ScriptBotEngine.test(BridgeConfig.scriptSource(context), testEvent);
        if (!result.ok()) {
            return "픽셀곰 브릿지 JS 엔진 오류\n" + result.error;
        }
        if (result.handled) {
            return result.reply + "\n버전: " + BuildConfig.VERSION_NAME;
        }
        return "픽셀곰 브릿지 JS 엔진은 실행됐지만 응답이 없습니다.\n기본 예제를 다시 저장한 뒤 테스트하세요.";
    }

    private static String localStatus(Context context, BridgeEvent event) {
        return "픽셀곰 브릿지 로컬 상태 정상\n" +
                "브릿지: 켜짐\n" +
                "대상 앱: 카카오톡(" + BridgeConfig.KAKAO_PACKAGE + ")\n" +
                "등록방: " + BridgeConfig.roomName(context) + "\n" +
                "roomId: " + BridgeConfig.roomId(context) + "\n" +
                "화면 감지: " + (BridgeConfig.accessibilitySystemEventsEnabled(context) ? "켜짐" : "꺼짐") + "\n" +
                "화면 자동답장: " + (BridgeConfig.accessibilityAutoReplyEnabled(context) ? "켜짐" : "꺼짐") + "\n" +
                "JS 자동응답: " + (BridgeConfig.scriptEnabled(context) ? "켜짐" : "꺼짐");
    }

    private static String safe(String value) {
        return value == null || value.trim().isEmpty() ? "미정" : value.trim();
    }
}
