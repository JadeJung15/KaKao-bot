import assert from "node:assert/strict";

const PRIORITY_FIELDS = [
  "senderPersonKeyHash",
  "senderPersonUriHash",
  "messagingUserKeyHash",
  "messagingUserUriHash",
  "senderId",
  "profileHash",
  "authorHash"
];

const RESERVED_NAMES = new Set([
  "미정",
  "익명",
  "unknown",
  "unknown user",
  "anonymous",
  "undefined",
  "null"
].map((value) => normalizeText(value)));

const SENDER_ID_SOURCE = Object.freeze({
  PERSON_KEY: "person_key",
  PERSON_URI: "person_uri",
  MESSAGING_USER_KEY: "messaging_user_key",
  MESSAGING_USER_URI: "messaging_user_uri",
  BRIDGE_VERIFIED: "bridge_verified",
  PROFILE_HASH: "profile_hash",
  ROOM_SENDER: "room_sender",
  NICKNAME: "nickname",
  UNKNOWN: "unknown"
});

const SENDER_ID_AUTO_RENAME_ALLOWED_SOURCES = new Set([
  SENDER_ID_SOURCE.PERSON_KEY,
  SENDER_ID_SOURCE.PERSON_URI,
  SENDER_ID_SOURCE.MESSAGING_USER_KEY,
  SENDER_ID_SOURCE.MESSAGING_USER_URI,
  SENDER_ID_SOURCE.BRIDGE_VERIFIED
]);

const SENDER_ID_AUTO_RENAME_DENIED_SOURCES = new Set([
  SENDER_ID_SOURCE.PROFILE_HASH,
  SENDER_ID_SOURCE.ROOM_SENDER,
  SENDER_ID_SOURCE.NICKNAME,
  SENDER_ID_SOURCE.UNKNOWN
]);

function normalizeText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeName(value) {
  return normalizeText(value).replace(/님$/, "");
}

function isReservedName(value) {
  const key = normalizeText(value).toLowerCase();
  return !key || RESERVED_NAMES.has(key);
}

function resolveIdentity(payload) {
  const identity = payload.identity && typeof payload.identity === "object" ? payload.identity : {};
  const conflictLogs = [];

  const pick = (field) => {
    const identityValue = normalizeText(identity[field]);
    const topValue = normalizeText(payload[field]);
    if (identityValue && topValue && identityValue !== topValue) {
      conflictLogs.push({
        type: "alias_conflict",
        field,
        identityValue,
        topValue
      });
    }
    if (identityValue) return identityValue;
    if (topValue) return topValue;
    return "";
  };

  return {
    senderPersonKeyHash: normalizeText(identity.senderPersonKeyHash),
    senderPersonUriHash: normalizeText(identity.senderPersonUriHash),
    messagingUserKeyHash: normalizeText(identity.messagingUserKeyHash),
    messagingUserUriHash: normalizeText(identity.messagingUserUriHash),
    senderId: pick("senderId"),
    profileHash: pick("profileHash"),
    authorHash: pick("authorHash"),
    notificationKeyHash: normalizeText(identity.notificationKeyHash),
    notificationGroupKeyHash: normalizeText(identity.notificationGroupKeyHash),
    conflictLogs
  };
}

function pickUserKey(payload, resolved) {
  for (const field of PRIORITY_FIELDS) {
    const value = normalizeText(resolved[field]);
    if (value) return { field, value };
  }

  const roomId = normalizeText(payload.roomId);
  const sender = normalizeName(payload.sender);
  if (roomId && sender) return { field: "roomIdSender", value: `${roomId}:${sender}` };
  if (sender) return { field: "sender", value: sender };
  return { field: "none", value: "" };
}

function candidateRecord(state, userKey, field) {
  if (!state.byUserKey[userKey]) {
    state.byUserKey[userKey] = {
      field,
      lastName: "",
      namesSeen: new Set(),
      history: [],
      ambiguous: false
    };
  }
  return state.byUserKey[userKey];
}

function evaluateEvent(state, payload) {
  const sender = normalizeName(payload.sender);
  const resolved = resolveIdentity(payload);
  const selected = pickUserKey(payload, resolved);
  const senderIdSource = normalizeText(payload?.identityMeta?.senderIdSource || SENDER_ID_SOURCE.UNKNOWN);
  const roomId = normalizeText(payload.roomId);
  state.roomFallbackLastByRoom ||= {};
  const priorRoomSender = roomId ? normalizeName(state.roomFallbackLastByRoom[roomId]) : "";
  const hasAnyIdentityValue = Boolean(
    resolved.senderPersonKeyHash
    || resolved.senderPersonUriHash
    || resolved.messagingUserKeyHash
    || resolved.messagingUserUriHash
    || resolved.senderId
    || resolved.profileHash
    || resolved.authorHash
  );

  const result = {
    userKey: selected.value,
    userKeyField: selected.field,
    decision: "no_identity",
    allowAutoRename: false,
    ambiguous: false,
    suspects: false,
    renamed: false,
    conflictLogs: resolved.conflictLogs
  };

  if (!selected.value) {
    result.suspects = true;
    return result;
  }

  const record = candidateRecord(state, selected.value, selected.field);
  const previousName = record.lastName;
  const changedName = Boolean(previousName && sender && previousName !== sender);

  if (sender) {
    record.namesSeen.add(sender);
    record.history.push(sender);
    if (record.history.length > 20) record.history = record.history.slice(-20);
  }

  if (changedName) {
    result.renamed = true;
    const returnedOldName = record.history.slice(0, -1).includes(sender);
    const tooManyNames = record.namesSeen.size >= 3;
    if (returnedOldName || tooManyNames) record.ambiguous = true;
  }

  record.lastName = sender || record.lastName;
  result.ambiguous = record.ambiguous;

  const reservedTransition = changedName && (isReservedName(previousName) || isReservedName(sender));
  const fallbackReservedTransition = !hasAnyIdentityValue
    && Boolean(roomId && priorRoomSender && sender && priorRoomSender !== sender)
    && (isReservedName(priorRoomSender) || isReservedName(sender));

  if (!hasAnyIdentityValue && roomId && sender) {
    state.roomFallbackLastByRoom[roomId] = sender;
  }

  if (selected.field === "senderPersonKeyHash" || selected.field === "senderPersonUriHash") {
    if (record.ambiguous) {
      result.decision = "deny_ambiguous";
      result.suspects = true;
    } else if (reservedTransition) {
      result.decision = "suspect_reserved_transition";
      result.suspects = true;
    } else if (changedName) {
      result.decision = "allow_auto_rename";
      result.allowAutoRename = true;
    } else {
      result.decision = "track";
    }
    return result;
  }

  if (selected.field === "messagingUserKeyHash" || selected.field === "messagingUserUriHash") {
    result.decision = "candidate_only";
    result.suspects = true;
    return result;
  }

  if (selected.field === "senderId") {
    const stableSource = SENDER_ID_AUTO_RENAME_ALLOWED_SOURCES.has(senderIdSource);
    if (record.ambiguous) {
      result.decision = "deny_ambiguous";
      result.suspects = true;
    } else if (!stableSource) {
      result.decision = "candidate_only";
      result.suspects = true;
    } else if (reservedTransition) {
      result.decision = "suspect_reserved_transition";
      result.suspects = true;
    } else if (changedName) {
      result.decision = "allow_auto_rename";
      result.allowAutoRename = true;
    } else {
      result.decision = "track";
    }
    return result;
  }

  if (selected.field === "profileHash") {
    result.decision = "candidate_only_profile";
    result.suspects = true;
    return result;
  }

  if (selected.field === "authorHash") {
    result.decision = "deny_authorhash_primary";
    result.suspects = true;
    return result;
  }

  if (selected.field === "roomIdSender" || selected.field === "sender") {
    if (reservedTransition || fallbackReservedTransition) {
      result.decision = "suspect_reserved_transition";
    } else {
      result.decision = "fallback_only";
    }
    result.suspects = true;
    return result;
  }

  result.suspects = true;
  return result;
}

function runCase(testCase) {
  const state = { byUserKey: {}, roomFallbackLastByRoom: {} };
  const eventResults = testCase.events.map((payload) => evaluateEvent(state, payload));
  const final = eventResults[eventResults.length - 1];

  const summary = {
    id: testCase.id,
    finalDecision: final.decision,
    allowAutoRename: final.allowAutoRename,
    ambiguous: final.ambiguous,
    userKeyField: final.userKeyField,
    conflictCount: eventResults.reduce((sum, row) => sum + row.conflictLogs.length, 0),
    passed: false,
    reason: ""
  };

  try {
    if (testCase.expect.finalDecision) assert.equal(final.decision, testCase.expect.finalDecision);
    if (typeof testCase.expect.allowAutoRename === "boolean") assert.equal(final.allowAutoRename, testCase.expect.allowAutoRename);
    if (typeof testCase.expect.ambiguous === "boolean") assert.equal(final.ambiguous, testCase.expect.ambiguous);
    if (testCase.expect.userKeyField) assert.equal(final.userKeyField, testCase.expect.userKeyField);
    if (typeof testCase.expect.minConflictCount === "number") {
      assert.ok(summary.conflictCount >= testCase.expect.minConflictCount);
    }
    summary.passed = true;
  } catch (error) {
    summary.passed = false;
    summary.reason = error instanceof Error ? error.message : String(error);
  }

  return { summary, events: eventResults };
}

const testCases = [
  {
    id: "TC-01",
    events: [
      { payloadVersion: "2", roomId: "R1", sender: "철수", identity: { senderPersonKeyHash: "K1" } },
      { payloadVersion: "2", roomId: "R1", sender: "민수", identity: { senderPersonKeyHash: "K1" } }
    ],
    expect: { finalDecision: "allow_auto_rename", allowAutoRename: true, ambiguous: false, userKeyField: "senderPersonKeyHash" }
  },
  {
    id: "TC-02",
    events: [
      { payloadVersion: "2", roomId: "R1", sender: "라온", identity: { senderPersonUriHash: "U1" } },
      { payloadVersion: "2", roomId: "R1", sender: "하온", identity: { senderPersonUriHash: "U1" } }
    ],
    expect: { finalDecision: "allow_auto_rename", allowAutoRename: true, ambiguous: false, userKeyField: "senderPersonUriHash" }
  },
  {
    id: "TC-03",
    events: [
      { payloadVersion: "2", roomId: "R1", sender: "유저A", identity: { messagingUserKeyHash: "MK1" } }
    ],
    expect: { finalDecision: "candidate_only", allowAutoRename: false, ambiguous: false, userKeyField: "messagingUserKeyHash" }
  },
  {
    id: "TC-04",
    events: [
      { payloadVersion: "2", roomId: "R1", sender: "봄", identity: { senderId: "S1" }, senderId: "S1", identityMeta: { senderIdSource: SENDER_ID_SOURCE.BRIDGE_VERIFIED } },
      { payloadVersion: "2", roomId: "R1", sender: "여름", identity: { senderId: "S1" }, senderId: "S1", identityMeta: { senderIdSource: SENDER_ID_SOURCE.BRIDGE_VERIFIED } }
    ],
    expect: { finalDecision: "allow_auto_rename", allowAutoRename: true, ambiguous: false, userKeyField: "senderId" }
  },
  {
    id: "TC-05",
    events: [
      { payloadVersion: "2", roomId: "R1", sender: "유저B", identity: { profileHash: "P1" }, profileHash: "P1" }
    ],
    expect: { finalDecision: "candidate_only_profile", allowAutoRename: false, ambiguous: false, userKeyField: "profileHash" }
  },
  {
    id: "TC-06",
    events: [
      { payloadVersion: "2", roomId: "R1", sender: "유저C", identity: { authorHash: "R1:유저C" }, authorHash: "R1:유저C" }
    ],
    expect: { finalDecision: "deny_authorhash_primary", allowAutoRename: false, ambiguous: false, userKeyField: "authorHash" }
  },
  {
    id: "TC-07",
    events: [
      { payloadVersion: "2", roomId: "R1", sender: "유저D", identity: {} }
    ],
    expect: { finalDecision: "fallback_only", allowAutoRename: false, ambiguous: false, userKeyField: "roomIdSender" }
  },
  {
    id: "TC-08A",
    events: [
      { payloadVersion: "2", roomId: "R1", sender: "미정", identity: {} },
      { payloadVersion: "2", roomId: "R1", sender: "두팔", identity: {} }
    ],
    expect: { finalDecision: "suspect_reserved_transition", allowAutoRename: false, ambiguous: false, userKeyField: "roomIdSender" }
  },
  {
    id: "TC-08B",
    events: [
      { payloadVersion: "2", roomId: "R1", sender: "미정", identity: { senderPersonKeyHash: "K8" } },
      { payloadVersion: "2", roomId: "R1", sender: "두팔", identity: { senderPersonKeyHash: "K8" } }
    ],
    expect: { finalDecision: "suspect_reserved_transition", allowAutoRename: false, ambiguous: false, userKeyField: "senderPersonKeyHash" }
  },
  {
    id: "TC-09",
    events: [
      { payloadVersion: "2", roomId: "R1", sender: "홍길동", identity: { senderPersonKeyHash: "K9A" } },
      { payloadVersion: "2", roomId: "R1", sender: "홍길동", identity: { senderPersonKeyHash: "K9B" } }
    ],
    expect: { finalDecision: "track", allowAutoRename: false, ambiguous: false, userKeyField: "senderPersonKeyHash" }
  },
  {
    id: "TC-10",
    events: [
      { payloadVersion: "2", roomId: "R1", sender: "닉1", identity: { senderPersonKeyHash: "KX" } },
      { payloadVersion: "2", roomId: "R1", sender: "닉2", identity: { senderPersonKeyHash: "KX" } },
      { payloadVersion: "2", roomId: "R1", sender: "닉1", identity: { senderPersonKeyHash: "KX" } }
    ],
    expect: { finalDecision: "deny_ambiguous", allowAutoRename: false, ambiguous: true, userKeyField: "senderPersonKeyHash" }
  },
  {
    id: "TC-11",
    events: [
      { payloadVersion: "2", roomId: "R1", sender: "유저E", identity: { senderPersonKeyHash: "KE", notificationKeyHash: "N1" } },
      { payloadVersion: "2", roomId: "R1", sender: "유저E", identity: { senderPersonKeyHash: "KE", notificationKeyHash: "N2" } }
    ],
    expect: { finalDecision: "track", allowAutoRename: false, ambiguous: false, userKeyField: "senderPersonKeyHash" }
  },
  {
    id: "TC-12",
    events: [
      {
        payloadVersion: "2",
        roomId: "R1",
        sender: "유저F",
        identity: { senderPersonKeyHash: "KF", senderId: "SID_A" },
        senderId: "SID_B",
        identityMeta: { senderIdSource: SENDER_ID_SOURCE.PERSON_KEY }
      },
      {
        payloadVersion: "2",
        roomId: "R1",
        sender: "유저G",
        identity: { senderId: "SID_X" },
        senderId: "SID_Y",
        identityMeta: { senderIdSource: SENDER_ID_SOURCE.UNKNOWN }
      }
    ],
    expect: { finalDecision: "candidate_only", allowAutoRename: false, ambiguous: false, userKeyField: "senderId", minConflictCount: 2 }
  },
  {
    id: "TC-13A",
    events: [
      { payloadVersion: "2", roomId: "R13", sender: "초기", identity: { senderId: "S13A" }, senderId: "S13A", identityMeta: { senderIdSource: SENDER_ID_SOURCE.ROOM_SENDER } },
      { payloadVersion: "2", roomId: "R13", sender: "변경", identity: { senderId: "S13A" }, senderId: "S13A", identityMeta: { senderIdSource: SENDER_ID_SOURCE.ROOM_SENDER } }
    ],
    expect: { finalDecision: "candidate_only", allowAutoRename: false, ambiguous: false, userKeyField: "senderId" }
  },
  {
    id: "TC-13B",
    events: [
      { payloadVersion: "2", roomId: "R13", sender: "초기", identity: { senderId: "S13B" }, senderId: "S13B", identityMeta: { senderIdSource: SENDER_ID_SOURCE.NICKNAME } },
      { payloadVersion: "2", roomId: "R13", sender: "변경", identity: { senderId: "S13B" }, senderId: "S13B", identityMeta: { senderIdSource: SENDER_ID_SOURCE.NICKNAME } }
    ],
    expect: { finalDecision: "candidate_only", allowAutoRename: false, ambiguous: false, userKeyField: "senderId" }
  },
  {
    id: "TC-13C",
    events: [
      { payloadVersion: "2", roomId: "R13", sender: "초기", identity: { senderId: "S13C" }, senderId: "S13C", identityMeta: { senderIdSource: SENDER_ID_SOURCE.UNKNOWN } },
      { payloadVersion: "2", roomId: "R13", sender: "변경", identity: { senderId: "S13C" }, senderId: "S13C", identityMeta: { senderIdSource: SENDER_ID_SOURCE.UNKNOWN } }
    ],
    expect: { finalDecision: "candidate_only", allowAutoRename: false, ambiguous: false, userKeyField: "senderId" }
  },
  {
    id: "TC-13D",
    events: [
      { payloadVersion: "2", roomId: "R13", sender: "초기", identity: { senderId: "S13D" }, senderId: "S13D", identityMeta: { senderIdSource: SENDER_ID_SOURCE.PROFILE_HASH } },
      { payloadVersion: "2", roomId: "R13", sender: "변경", identity: { senderId: "S13D" }, senderId: "S13D", identityMeta: { senderIdSource: SENDER_ID_SOURCE.PROFILE_HASH } }
    ],
    expect: { finalDecision: "candidate_only", allowAutoRename: false, ambiguous: false, userKeyField: "senderId" }
  }
];

const runResults = testCases.map(runCase);
const rows = runResults.map((item) => item.summary);
const failures = rows.filter((row) => !row.passed);

function runSenderIdSourceMatrix() {
  const rows = Object.values(SENDER_ID_SOURCE).map((source) => {
    const state = { byUserKey: {}, roomFallbackLastByRoom: {} };
    evaluateEvent(state, {
      payloadVersion: "2",
      roomId: "SM",
      sender: "원닉",
      identity: { senderId: `SID-${source}` },
      senderId: `SID-${source}`,
      identityMeta: { senderIdSource: source }
    });
    const second = evaluateEvent(state, {
      payloadVersion: "2",
      roomId: "SM",
      sender: "변경닉",
      identity: { senderId: `SID-${source}` },
      senderId: `SID-${source}`,
      identityMeta: { senderIdSource: source }
    });
    const expectedAllow = SENDER_ID_AUTO_RENAME_ALLOWED_SOURCES.has(source);
    const pass = second.allowAutoRename === expectedAllow;
    return {
      source,
      expected: expectedAllow ? "ALLOW" : "DENY",
      actual: second.allowAutoRename ? "ALLOW" : "DENY",
      decision: second.decision,
      pass,
      reason: pass ? "" : `expected ${expectedAllow ? "ALLOW" : "DENY"} but got ${second.allowAutoRename ? "ALLOW" : "DENY"}`
    };
  });
  return rows;
}

const senderIdSourceRows = runSenderIdSourceMatrix();
const senderIdSourceFailures = senderIdSourceRows.filter((row) => !row.pass);

console.log("Bridge Payload v2 로컬 시뮬레이션 테스트");
console.log("TC-01~TC-12 + TC-08A/TC-08B + senderIdSource 금지 출처 검증");
console.table(
  rows.map((row) => ({
    TC: row.id,
    PASS: row.passed ? "OK" : "FAIL",
    decision: row.finalDecision,
    allowAutoRename: row.allowAutoRename ? "Y" : "N",
    ambiguous: row.ambiguous ? "Y" : "N",
    keyField: row.userKeyField,
    conflicts: row.conflictCount
  }))
);

console.log("\nsenderIdSource 허용/금지 매트릭스");
console.table(
  senderIdSourceRows.map((row) => ({
    source: row.source,
    expected: row.expected,
    actual: row.actual,
    decision: row.decision,
    PASS: row.pass ? "OK" : "FAIL"
  }))
);

if (failures.length || senderIdSourceFailures.length) {
  console.log("\n실패 케이스:");
  for (const failure of failures) {
    console.log(`- ${failure.id}: ${failure.reason}`);
  }
  for (const failure of senderIdSourceFailures) {
    console.log(`- senderIdSource(${failure.source}): ${failure.reason}`);
  }
  process.exitCode = 1;
} else {
  console.log("\n모든 케이스 통과");
}
