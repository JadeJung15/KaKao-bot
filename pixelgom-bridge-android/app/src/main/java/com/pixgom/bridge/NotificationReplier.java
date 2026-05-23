package com.pixgom.bridge;

import android.app.Notification;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.text.TextUtils;

import android.app.RemoteInput;

final class NotificationReplier {
    private NotificationReplier() {}

    static Result reply(Context context, Notification notification, String message) {
        if (notification == null) return Result.failed("notification 없음", 0, 0);
        if (TextUtils.isEmpty(message)) return Result.failed("응답 메시지 없음", actionCount(notification), 0);
        if (notification.actions == null || notification.actions.length == 0) return Result.failed("알림 액션 없음", 0, 0);
        int remoteInputCount = 0;
        for (Notification.Action action : notification.actions) {
            RemoteInput[] inputs = action.getRemoteInputs();
            if (inputs == null || inputs.length == 0 || action.actionIntent == null) continue;
            remoteInputCount += inputs.length;
            Intent intent = new Intent();
            Bundle results = new Bundle();
            for (RemoteInput input : inputs) {
                results.putCharSequence(input.getResultKey(), message);
            }
            RemoteInput.addResultsToIntent(inputs, intent, results);
            try {
                action.actionIntent.send(context, 0, intent);
                return Result.sent(actionCount(notification), remoteInputCount);
            } catch (PendingIntent.CanceledException ignored) {
                return Result.failed("답장 PendingIntent 취소됨", actionCount(notification), remoteInputCount);
            }
        }
        return Result.failed("RemoteInput 답장 액션 없음", actionCount(notification), remoteInputCount);
    }

    private static int actionCount(Notification notification) {
        return notification == null || notification.actions == null ? 0 : notification.actions.length;
    }

    static final class Result {
        final boolean sent;
        final String reason;
        final int actionCount;
        final int remoteInputCount;

        private Result(boolean sent, String reason, int actionCount, int remoteInputCount) {
            this.sent = sent;
            this.reason = reason;
            this.actionCount = actionCount;
            this.remoteInputCount = remoteInputCount;
        }

        static Result sent(int actionCount, int remoteInputCount) {
            return new Result(true, "", actionCount, remoteInputCount);
        }

        static Result failed(String reason, int actionCount, int remoteInputCount) {
            return new Result(false, reason, actionCount, remoteInputCount);
        }
    }
}
