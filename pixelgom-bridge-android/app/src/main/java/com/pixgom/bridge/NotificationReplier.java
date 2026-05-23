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

    static boolean reply(Context context, Notification notification, String message) {
        if (notification == null || TextUtils.isEmpty(message) || notification.actions == null) return false;
        for (Notification.Action action : notification.actions) {
            RemoteInput[] inputs = action.getRemoteInputs();
            if (inputs == null || inputs.length == 0 || action.actionIntent == null) continue;
            Intent intent = new Intent();
            Bundle results = new Bundle();
            for (RemoteInput input : inputs) {
                results.putCharSequence(input.getResultKey(), message);
            }
            RemoteInput.addResultsToIntent(inputs, intent, results);
            try {
                action.actionIntent.send(context, 0, intent);
                return true;
            } catch (PendingIntent.CanceledException ignored) {
                return false;
            }
        }
        return false;
    }
}
