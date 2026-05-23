package com.pixgom.bridge;

import android.content.Context;
import android.text.TextUtils;

import org.mozilla.javascript.ContextAction;
import org.mozilla.javascript.ContextFactory;
import org.mozilla.javascript.Scriptable;

final class ScriptBotEngine {
    private static final int SCRIPT_TIMEOUT_MS = 1500;

    private ScriptBotEngine() {}

    static Result handle(Context androidContext, BridgeEvent event) {
        if (!BridgeConfig.scriptEnabled(androidContext)) return Result.skipped();
        return run(BridgeConfig.scriptSource(androidContext), event);
    }

    static Result test(String source, BridgeEvent event) {
        return run(source, event);
    }

    private static Result run(String source, BridgeEvent event) {
        if (TextUtils.isEmpty(source)) return Result.skipped();
        TimeoutContextFactory factory = new TimeoutContextFactory(System.currentTimeMillis() + SCRIPT_TIMEOUT_MS);
        try {
            return (Result) factory.call((ContextAction) cx -> {
                cx.setLanguageVersion(org.mozilla.javascript.Context.VERSION_ES6);
                cx.setOptimizationLevel(-1);
                Scriptable scope = cx.initSafeStandardObjects();
                put(scope, "__eventRoom", event.room);
                put(scope, "__eventRawRoom", event.rawRoom);
                put(scope, "__eventMessage", event.message);
                put(scope, "__eventSender", event.sender);
                put(scope, "__eventRoomId", event.roomId);
                put(scope, "__eventRoomLink", event.roomLink);
                put(scope, "__eventPackageName", event.packageName);
                put(scope, "__eventGroupChat", event.groupChat);

                cx.evaluateString(scope, BOOTSTRAP, "pixelgom-bootstrap.js", 1, null);
                cx.evaluateString(scope, source, "pixelgom-user-script.js", 1, null);
                cx.evaluateString(scope, DISPATCH, "pixelgom-dispatch.js", 1, null);
                Object value = scope.get("__pixelgomReply", scope);
                String reply = value == null ? "" : org.mozilla.javascript.Context.toString(value).trim();
                return TextUtils.isEmpty(reply) ? Result.skipped() : Result.reply(reply);
            });
        } catch (Throwable error) {
            return Result.error(error.getClass().getSimpleName() + ": " + error.getMessage());
        }
    }

    private static void put(Scriptable scope, String key, Object value) {
        Object safeValue = value == null ? "" : value;
        scope.put(key, scope, safeValue);
    }

    private static final String BOOTSTRAP =
            "var __pixelgomReplies = [];\n" +
            "var __pixelgomListeners = [];\n" +
            "var Event = { MESSAGE: 'message', COMMAND: 'command' };\n" +
            "var BotManager = {\n" +
            "  getCurrentBot: function() {\n" +
            "    return {\n" +
            "      addListener: function(type, listener) {\n" +
            "        if ((type === Event.MESSAGE || type === Event.COMMAND) && typeof listener === 'function') {\n" +
            "          __pixelgomListeners.push(listener);\n" +
            "        }\n" +
            "      }\n" +
            "    };\n" +
            "  }\n" +
            "};\n" +
            "var Api = {\n" +
            "  canReply: function() { return true; },\n" +
            "  replyRoom: function(room, text) {\n" +
            "    if (text !== undefined && text !== null) __pixelgomReplies.push(String(text));\n" +
            "    return true;\n" +
            "  }\n" +
            "};\n" +
            "function print(value) {}\n";

    private static final String DISPATCH =
            "(function() {\n" +
            "  function pushReply(text) {\n" +
            "    if (text !== undefined && text !== null) __pixelgomReplies.push(String(text));\n" +
            "    return true;\n" +
            "  }\n" +
            "  var replier = { reply: pushReply };\n" +
            "  var message = {\n" +
            "    room: String(__eventRoom || ''),\n" +
            "    rawRoom: String(__eventRawRoom || ''),\n" +
            "    content: String(__eventMessage || ''),\n" +
            "    msg: String(__eventMessage || ''),\n" +
            "    isGroupChat: Boolean(__eventGroupChat),\n" +
            "    packageName: String(__eventPackageName || ''),\n" +
            "    roomId: String(__eventRoomId || ''),\n" +
            "    roomLink: String(__eventRoomLink || ''),\n" +
            "    author: {\n" +
            "      name: String(__eventSender || ''),\n" +
            "      hash: String(__eventRoomId || '') + ':' + String(__eventSender || '')\n" +
            "    },\n" +
            "    reply: pushReply\n" +
            "  };\n" +
            "  if (typeof response === 'function') {\n" +
            "    response(message.room, message.content, message.author.name, message.isGroupChat, replier, null, message.packageName);\n" +
            "  }\n" +
            "  for (var i = 0; i < __pixelgomListeners.length; i++) {\n" +
            "    __pixelgomListeners[i](message);\n" +
            "  }\n" +
            "  __pixelgomReply = __pixelgomReplies.length ? String(__pixelgomReplies[0]) : '';\n" +
            "})();\n";

    private static final class TimeoutContextFactory extends ContextFactory {
        private final long deadline;

        TimeoutContextFactory(long deadline) {
            this.deadline = deadline;
        }

        @Override
        protected org.mozilla.javascript.Context makeContext() {
            org.mozilla.javascript.Context context = super.makeContext();
            context.setOptimizationLevel(-1);
            context.setInstructionObserverThreshold(10000);
            return context;
        }

        @Override
        protected void observeInstructionCount(org.mozilla.javascript.Context context, int instructionCount) {
            if (System.currentTimeMillis() > deadline) {
                throw new IllegalStateException("script timeout");
            }
        }
    }

    static final class Result {
        final boolean handled;
        final String reply;
        final String error;

        private Result(boolean handled, String reply, String error) {
            this.handled = handled;
            this.reply = reply == null ? "" : reply;
            this.error = error;
        }

        static Result skipped() {
            return new Result(false, "", null);
        }

        static Result reply(String reply) {
            return new Result(true, reply, null);
        }

        static Result error(String error) {
            return new Result(false, "", error);
        }

        boolean ok() {
            return error == null;
        }
    }
}
