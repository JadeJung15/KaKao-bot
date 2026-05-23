package com.pixgom.bridge;

import android.app.Notification;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.text.TextUtils;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class PixelgomNotificationListener extends NotificationListenerService {
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    @Override
    public void onListenerConnected() {
        BridgeConfig.appendLog(this, "알림 브릿지 연결됨");
    }

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        if (sbn == null || !BridgeConfig.KAKAO_PACKAGE.equals(sbn.getPackageName())) return;
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

        Notification notification = sbn.getNotification();
        executor.execute(() -> {
            EventSender.SendResult result = EventSender.send(this, event);
            if (!result.ok()) {
                BridgeConfig.appendLog(this, "전송 실패: " + result.error);
                return;
            }
            if (result.ignored) {
                BridgeConfig.appendLog(this, "서버 무시: " + event.sender + " / " + preview(event.message));
                return;
            }
            BridgeConfig.appendLog(this, "전송 성공: " + event.sender + " / " + preview(event.message));
            if (!TextUtils.isEmpty(result.reply)) {
                boolean replied = NotificationReplier.reply(this, notification, result.reply);
                BridgeConfig.appendLog(this, replied ? "카카오 답장 전송 성공" : "카카오 답장 액션 없음");
            }
        });
    }

    private String preview(String text) {
        if (text == null) return "";
        return text.length() > 40 ? text.substring(0, 39) + "…" : text;
    }
}
