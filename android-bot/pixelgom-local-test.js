/*
 * Minimal legacy response(...) test.
 *
 * Paste only this file first. If /로컬상태 does not reply, the issue is
 * notification/app setup, not the Pixelgom server.
 */

function response(room, msg, sender, isGroupChat, replier, imageDB, packageName) {
  if (String(msg).trim() === "/로컬상태") {
    replier.reply("로컬 테스트 성공");
  }
}
