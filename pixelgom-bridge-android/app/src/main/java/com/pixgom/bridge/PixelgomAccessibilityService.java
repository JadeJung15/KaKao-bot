package com.pixgom.bridge;

import android.accessibilityservice.AccessibilityService;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.TextUtils;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class PixelgomAccessibilityService extends AccessibilityService {
    private static final Pattern ENTERED = Pattern.compile("^(.+?)님이\\s*들어왔습니다\\.?$");
    private static final Pattern LEFT = Pattern.compile("^(.+?)님이\\s*나갔습니다\\.?$");
    private static final Pattern KICKED = Pattern.compile("^(.+?)님을\\s*내보냈습니다\\.?$");
    private static final long SCAN_THROTTLE_MS = 220;
    private static final long DUPLICATE_WINDOW_MS = 60000;
    private static final int MAX_TEXT_NODES = 260;
    private static final int MAX_RECENT_EVENTS = 120;

    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final LinkedHashMap<String, Long> recentEvents = new LinkedHashMap<>();
    private long lastScanAt = 0L;

    @Override
    protected void onServiceConnected() {
        BridgeConfig.applyMigrations(this);
        BridgeConfig.appendLog(this, "화면 브릿지 연결됨");
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event == null || event.getPackageName() == null) return;
        if (!BridgeConfig.KAKAO_PACKAGE.contentEquals(event.getPackageName())) return;
        BridgeConfig.applyMigrations(this);
        if (!BridgeConfig.isEnabled(this) || !BridgeConfig.accessibilitySystemEventsEnabled(this)) return;

        long now = System.currentTimeMillis();
        if (now - lastScanAt < SCAN_THROTTLE_MS) return;
        lastScanAt = now;

        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null) return;

        List<String> texts = new ArrayList<>();
        collectTexts(root, texts);
        if (texts.isEmpty()) return;

        String rawRoom = findRoomTitle(texts);
        if (TextUtils.isEmpty(rawRoom)) return;

        List<SystemLine> systemLines = findSystemLines(texts);
        for (SystemLine line : systemLines) {
            BridgeEvent bridgeEvent = buildBridgeEvent(rawRoom, line);
            if (!BridgeConfig.roomMatches(this, bridgeEvent.rawRoom)) {
                BridgeConfig.appendLog(this, "화면 무시: 등록방 아님 rawRoom=" + bridgeEvent.rawRoom);
                continue;
            }
            if (isDuplicate(bridgeEvent)) continue;
            handleEvent(bridgeEvent);
        }
    }

    @Override
    public void onInterrupt() {
        BridgeConfig.appendLog(this, "화면 브릿지 중단됨");
    }

    private void handleEvent(BridgeEvent event) {
        BridgeConfig.appendLog(this, "화면 감지: " + event.rawRoom + " / " + event.message);
        executor.execute(() -> {
            EventSender.SendResult result = EventSender.send(this, event);
            if (!result.ok()) {
                BridgeConfig.appendLog(this, "화면 전송 실패: " + result.error);
                return;
            }
            if (result.ignored) {
                BridgeConfig.appendLog(this, "화면 서버 무시: " + preview(event.message));
                return;
            }
            BridgeConfig.appendLog(this, "화면 서버 전송 성공: " + preview(event.message));
            if (!TextUtils.isEmpty(result.reply) && BridgeConfig.accessibilityAutoReplyEnabled(this)) {
                mainHandler.post(() -> replyInCurrentChat(result.reply));
            }
        });
    }

    private BridgeEvent buildBridgeEvent(String rawRoom, SystemLine line) {
        BridgeEvent event = new BridgeEvent();
        event.room = BridgeConfig.roomName(this);
        event.rawRoom = rawRoom;
        event.roomId = BridgeConfig.roomId(this);
        event.roomLink = BridgeConfig.roomLink(this);
        event.sender = "카카오시스템";
        event.message = line.message;
        event.packageName = BridgeConfig.KAKAO_PACKAGE;
        event.groupChat = true;
        event.eventType = line.eventType;
        event.targetName = line.targetName;
        return event;
    }

    private void collectTexts(AccessibilityNodeInfo node, List<String> out) {
        if (node == null || out.size() >= MAX_TEXT_NODES) return;
        addText(out, node.getText());
        addText(out, node.getContentDescription());
        for (int i = 0; i < node.getChildCount() && out.size() < MAX_TEXT_NODES; i++) {
            collectTexts(node.getChild(i), out);
        }
    }

    private void addText(List<String> out, CharSequence value) {
        if (value == null) return;
        String text = value.toString().replace('\u00a0', ' ').trim();
        if (!text.isEmpty()) out.add(text);
    }

    private String findRoomTitle(List<String> texts) {
        for (String text : texts) {
            if (isSystemEventText(text)) continue;
            if (BridgeConfig.roomMatches(this, text)) return text;
        }
        return "";
    }

    private List<SystemLine> findSystemLines(List<String> texts) {
        List<SystemLine> lines = new ArrayList<>();
        for (String text : texts) {
            SystemLine line = parseSystemLine(text);
            if (line != null) lines.add(line);
        }
        return lines;
    }

    private boolean isSystemEventText(String text) {
        return parseSystemLine(text) != null;
    }

    private SystemLine parseSystemLine(String value) {
        String text = value == null ? "" : value.replace('\u00a0', ' ').replaceAll("\\s+", " ").trim();
        if (text.isEmpty()) return null;
        SystemLine line = matchLine(text, ENTERED, "entered", "님이 들어왔습니다");
        if (line != null) return line;
        line = matchLine(text, LEFT, "left", "님이 나갔습니다");
        if (line != null) return line;
        return matchLine(text, KICKED, "kicked", "님을 내보냈습니다");
    }

    private SystemLine matchLine(String text, Pattern pattern, String eventType, String suffix) {
        Matcher matcher = pattern.matcher(text);
        if (!matcher.matches()) return null;
        String target = matcher.group(1).trim();
        if (target.isEmpty() || target.length() > 40) return null;
        return new SystemLine(target + suffix, eventType, target);
    }

    private boolean isDuplicate(BridgeEvent event) {
        long now = System.currentTimeMillis();
        String key = event.rawRoom + "|" + event.eventType + "|" + event.targetName + "|" + event.message;
        synchronized (recentEvents) {
            Iterator<Map.Entry<String, Long>> iterator = recentEvents.entrySet().iterator();
            while (iterator.hasNext()) {
                Map.Entry<String, Long> entry = iterator.next();
                if (now - entry.getValue() > DUPLICATE_WINDOW_MS) iterator.remove();
            }
            if (recentEvents.containsKey(key)) return true;
            recentEvents.put(key, now);
            while (recentEvents.size() > MAX_RECENT_EVENTS) {
                Iterator<String> keys = recentEvents.keySet().iterator();
                if (keys.hasNext()) {
                    keys.next();
                    keys.remove();
                }
            }
            return false;
        }
    }

    private void replyInCurrentChat(String reply) {
        if (TextUtils.isEmpty(reply)) return;
        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null) {
            BridgeConfig.appendLog(this, "화면 답장 실패: 활성 화면 없음");
            return;
        }
        AccessibilityNodeInfo input = findEditable(root);
        if (input == null) {
            BridgeConfig.appendLog(this, "화면 답장 실패: 입력창 없음");
            return;
        }
        Bundle args = new Bundle();
        args.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, reply);
        boolean typed = input.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args);
        if (!typed) {
            BridgeConfig.appendLog(this, "화면 답장 실패: 입력 불가");
            return;
        }
        mainHandler.postDelayed(this::clickSendButton, 180);
    }

    private AccessibilityNodeInfo findEditable(AccessibilityNodeInfo node) {
        if (node == null) return null;
        if (node.isEditable() && node.isEnabled()) return node;
        for (int i = 0; i < node.getChildCount(); i++) {
            AccessibilityNodeInfo match = findEditable(node.getChild(i));
            if (match != null) return match;
        }
        return null;
    }

    private void clickSendButton() {
        AccessibilityNodeInfo root = getRootInActiveWindow();
        AccessibilityNodeInfo send = findSendButton(root);
        if (send == null) {
            BridgeConfig.appendLog(this, "화면 답장 실패: 전송 버튼 없음");
            return;
        }
        boolean clicked = send.performAction(AccessibilityNodeInfo.ACTION_CLICK);
        BridgeConfig.appendLog(this, clicked ? "화면 답장 전송 성공" : "화면 답장 실패: 전송 클릭 불가");
    }

    private AccessibilityNodeInfo findSendButton(AccessibilityNodeInfo node) {
        if (node == null) return null;
        if (node.isClickable() && looksLikeSend(node)) return node;
        for (int i = 0; i < node.getChildCount(); i++) {
            AccessibilityNodeInfo match = findSendButton(node.getChild(i));
            if (match != null) return match;
        }
        return null;
    }

    private boolean looksLikeSend(AccessibilityNodeInfo node) {
        String text = nodeText(node.getText());
        String desc = nodeText(node.getContentDescription());
        return containsSendWord(text) || containsSendWord(desc);
    }

    private String nodeText(CharSequence value) {
        return value == null ? "" : value.toString().trim().toLowerCase();
    }

    private boolean containsSendWord(String value) {
        return value.contains("전송") || value.contains("보내기") || value.contains("send");
    }

    private String preview(String text) {
        if (text == null) return "";
        return text.length() > 40 ? text.substring(0, 39) + "…" : text;
    }

    private static final class SystemLine {
        final String message;
        final String eventType;
        final String targetName;

        SystemLine(String message, String eventType, String targetName) {
            this.message = message;
            this.eventType = eventType;
            this.targetName = targetName;
        }
    }
}
