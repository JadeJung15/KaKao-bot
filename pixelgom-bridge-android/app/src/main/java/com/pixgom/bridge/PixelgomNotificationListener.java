package com.pixgom.bridge;

import android.app.Notification;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.text.TextUtils;

import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class PixelgomNotificationListener extends NotificationListenerService {
    private static final Object RECENT_LOCK = new Object();
    private static final LinkedHashMap<String, Long> RECENT_EVENTS = new LinkedHashMap<>();
    private static final long DUPLICATE_WINDOW_MS = 4500;
    private static final long RECENT_TTL_MS = 30000;
    private static final int MAX_RECENT_EVENTS = 80;

    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    @Override
    public void onListenerConnected() {
        BridgeConfig.applyMigrations(this);
        BridgeConfig.appendLog(this, "알림 브릿지 연결됨");
    }

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        if (sbn == null || !BridgeConfig.KAKAO_PACKAGE.equals(sbn.getPackageName())) return;
        BridgeConfig.applyMigrations(this);
        if (!BridgeConfig.isEnabled(this)) return;

        String configuredRoom = BridgeConfig.roomName(this);
        BridgeEvent event = KakaoNotificationParser.parse(
                sbn,
                configuredRoom,
                BridgeConfig.roomId(this),
                BridgeConfig.roomLink(this)
        );
        if (event == null) {
            BridgeConfig.appendLog(this, "무시: 카카오 알림에서 방/메시지 추출 실패");
            return;
        }
        if (!BridgeConfig.roomMatches(this, event.rawRoom)) {
            BridgeConfig.appendLog(this, "무시: 등록방 아님 rawRoom=" + event.rawRoom);
            return;
        }
        if (!event.hasRequiredFields()) {
            BridgeConfig.appendLog(this, "무시: 필수값 부족 sender=" + event.sender + " msg=" + event.message);
            return;
        }
        if (shouldIgnoreEchoOrPassiveNotice(event)) {
            BridgeConfig.appendLog(this, "무시: 픽셀곰 답장/수동 알림 에코 " + preview(event.message));
            return;
        }
        if (isDuplicate(event)) {
            BridgeConfig.appendLog(this, "무시: 중복 알림 " + event.sender + " / " + preview(event.message));
            return;
        }

        Notification notification = sbn.getNotification();
        BridgeConfig.appendLog(this, "수신: " + event.rawRoom + " / " + event.sender + " / " + preview(event.message));
        executor.execute(() -> {
            String localReply = BridgeLocalCommands.reply(this, event);
            if (!TextUtils.isEmpty(localReply)) {
                BridgeConfig.appendLog(this, "로컬 명령 응답 생성: " + preview(localReply));
                sendReply(notification, localReply);
                return;
            }

            EventSender.SendResult result = EventSender.send(this, event);
            String reply = "";
            if (!result.ok()) {
                BridgeConfig.appendLog(this, "전송 실패: " + result.error);
            } else if (result.ignored) {
                BridgeConfig.appendLog(this, "서버 무시: " + event.sender + " / " + preview(event.message));
                return;
            } else {
                BridgeConfig.appendLog(this, "서버 전송 성공: " + event.sender + " / " + preview(event.message));
                reply = result.reply;
            }

            if (TextUtils.isEmpty(reply) || isServerUnknownCommand(reply)) {
                ScriptBotEngine.Result scriptResult = ScriptBotEngine.handle(this, event);
                if (!scriptResult.ok()) {
                    BridgeConfig.appendLog(this, "JS 오류: " + scriptResult.error);
                } else if (scriptResult.handled) {
                    reply = scriptResult.reply;
                    BridgeConfig.appendLog(this, "JS 응답 생성: " + preview(reply));
                }
            }

            if (!TextUtils.isEmpty(reply)) {
                sendReply(notification, reply);
            }
        });
    }

    private void sendReply(Notification notification, String reply) {
        NotificationReplier.Result replyResult = NotificationReplier.reply(this, notification, reply);
        if (replyResult.sent) {
            BridgeConfig.appendLog(this, "카카오 답장 전송 성공");
        } else {
            BridgeConfig.appendLog(this, "카카오 답장 실패: " + replyResult.reason + " actions=" + replyResult.actionCount + " remoteInputs=" + replyResult.remoteInputCount);
        }
    }

    private boolean isServerUnknownCommand(String reply) {
        if (reply == null) return false;
        return reply.contains("아직 등록되지 않은 명령어입니다");
    }

    private boolean shouldIgnoreEchoOrPassiveNotice(BridgeEvent event) {
        String message = normalize(event.message);
        String combined = normalize(event.sender + " " + event.message);
        if (message.isEmpty() || message.startsWith("/")) return false;
        if ("미정".equals(normalize(event.sender)) && isPassiveAttachmentNotice(message)) return true;
        String[] echoMarkers = {
                "운영봇 서버 정상 연결",
                "픽셀곰 브릿지 앱 단독 응답 정상",
                "픽셀곰 브릿지 로컬 상태 정상",
                "픽셀곰 브릿지 JS",
                "닉네임 히스토리",
                "입장 히스토리",
                "퇴장 히스토리",
                "강퇴이력",
                "회 재입장",
                "님 어서오세요",
                "님 안녕히 가세요",
                "【 닉네임 변경 】",
                "님의 포인트 :",
                "이미 출석 하셨습니다",
                "획득"
        };
        for (String marker : echoMarkers) {
            if (combined.contains(marker)) return true;
        }
        return false;
    }

    private boolean isPassiveAttachmentNotice(String message) {
        return message.matches("^(사진|동영상|영상|파일|이모티콘|스티커|음성메시지).{0,12}보냈습니다\\.?$");
    }

    private String normalize(String text) {
        return text == null ? "" : text.replace('\u00a0', ' ').replaceAll("\\s+", " ").trim();
    }

    private boolean isDuplicate(BridgeEvent event) {
        long now = System.currentTimeMillis();
        String key = event.room + "|" + event.rawRoom + "|" + event.sender + "|" + event.message;
        synchronized (RECENT_LOCK) {
            Iterator<Map.Entry<String, Long>> iterator = RECENT_EVENTS.entrySet().iterator();
            while (iterator.hasNext()) {
                Map.Entry<String, Long> entry = iterator.next();
                if (now - entry.getValue() > RECENT_TTL_MS) iterator.remove();
            }
            Long lastSeen = RECENT_EVENTS.get(key);
            if (lastSeen != null && now - lastSeen < DUPLICATE_WINDOW_MS) return true;
            RECENT_EVENTS.put(key, now);
            while (RECENT_EVENTS.size() > MAX_RECENT_EVENTS) {
                Iterator<String> keys = RECENT_EVENTS.keySet().iterator();
                if (keys.hasNext()) {
                    keys.next();
                    keys.remove();
                }
            }
            return false;
        }
    }

    private String preview(String text) {
        if (text == null) return "";
        return text.length() > 40 ? text.substring(0, 39) + "…" : text;
    }
}
