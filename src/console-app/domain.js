export function formatKrw(value) {
  const amount = Number(value || 0);
  return `${amount.toLocaleString("ko-KR")}원`;
}

export function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

export function statusTone(status = "") {
  if (["active", "ready", "paid", "approved", "approved_paid", "ok", "resolved"].includes(status)) return "good";
  if (["pending", "pending_payment", "payment_required", "approved_unpaid", "awaiting_manual_deposit", "needs_setup", "expiring_soon", "open", "in_review"].includes(status)) return "warn";
  if (["expired", "rejected", "archived", "purged", "cancelled", "on_hold", "error"].includes(status)) return "bad";
  return "neutral";
}

export function snapshot(room = {}) {
  return room.roomStatusSnapshot || room.statusSnapshot || {};
}

export function lifecycleLabel(room = {}) {
  const snap = snapshot(room);
  return snap.lifecycle?.label || room.subscriptionStatusLabel || room.subscription?.statusLabel || (room.enabled === false ? "비활성" : "상태 확인");
}

export function bridgeLabel(room = {}) {
  const snap = snapshot(room);
  return snap.bridge?.label || room.bridgeStatus || room.diagnostics?.bridgeStatus || "unknown";
}

export function roomRoleLabel(room = {}) {
  const role = snapshot(room).role || room.roomRole || "standard";
  if (role === "general") return "일반방";
  if (role === "game") return "게임방";
  return "단일방";
}

export function roomRowFromGroup(group = {}) {
  const base = group.baseRoom || group.room || {};
  const lifecycle = snapshot(base).lifecycle || group.baseApplication?.lifecycle || {};
  return {
    id: group.baseApplication?.id || base.name || group.gameRooms?.[0]?.name || "ungrouped",
    name: base.name || group.baseApplication?.roomName || group.gameRooms?.[0]?.name || "방 미지정",
    role: base.roomRole || "general",
    lifecycle: lifecycle.label || lifecycleLabel(base),
    lifecycleStatus: lifecycle.status || snapshot(base).lifecycle?.status || "",
    lifecycleTone: lifecycle.tone || statusTone(lifecycle.status),
    bridge: bridgeLabel(base),
    games: group.gameRooms || [],
    raw: group
  };
}

function roomActivityTime(room = {}) {
  const diagnostics = room.diagnostics || snapshot(room).diagnostics || {};
  const candidates = [
    diagnostics.lastAnalyticsLogAt,
    diagnostics.lastRawEventAt,
    diagnostics.lastEventAt
  ];
  return Math.max(0, ...candidates.map((value) => {
    const time = new Date(value || 0).getTime();
    return Number.isFinite(time) ? time : 0;
  }));
}

function rowActivityTime(row = {}) {
  const rooms = [
    row.raw?.baseRoom,
    row.raw?.room,
    ...(row.raw?.gameRooms || [])
  ].filter(Boolean);
  return Math.max(0, ...rooms.map(roomActivityTime));
}

export function preferredAdminRow(rows = [], selectedId = "") {
  const selected = rows.find((row) => row.id === selectedId);
  if (selected) return selected;
  const withActivity = rows
    .map((row, index) => ({ row, index, activityAt: rowActivityTime(row) }))
    .filter((item) => item.activityAt > 0)
    .sort((left, right) => right.activityAt - left.activityAt || left.index - right.index);
  return withActivity[0]?.row || rows[0] || null;
}

export function combinedGameOpsOverview(rooms = []) {
  const overviews = rooms
    .map((room) => room?.gameOpsOverview)
    .filter(Boolean);
  if (!overviews.length) return {};

  const first = overviews[0] || {};
  const packs = new Map();
  const cooldowns = new Map();
  const commandCounts = new Map();
  let shopItemCount = 0;
  let enabled = false;

  for (const overview of overviews) {
    if (overview.enabled !== false) enabled = true;
    shopItemCount += Math.max(0, Number(overview.shopItemCount || 0));
    for (const pack of overview.installedGamePacks || []) {
      const key = pack.id || pack.code || pack.title;
      if (key && !packs.has(key)) packs.set(key, pack);
    }
    for (const cooldown of overview.cooldowns || []) {
      const key = cooldown.command || "";
      if (key && !cooldowns.has(key)) cooldowns.set(key, cooldown);
    }
    for (const item of overview.recentTopCommands || []) {
      const command = item.command || "";
      if (!command) continue;
      commandCounts.set(command, (commandCounts.get(command) || 0) + Math.max(0, Number(item.count || 0)));
    }
  }

  return {
    ...first,
    enabled,
    statusLabel: enabled ? "게임 사용 가능" : (first.statusLabel || "게임 꺼짐"),
    installedGamePacks: [...packs.values()],
    cooldowns: [...cooldowns.values()],
    rewards: first.rewards || {},
    shopItemCount,
    recentTopCommands: [...commandCounts.entries()]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .slice(0, 5)
      .map(([command, count]) => ({ command, count }))
  };
}

export function roomSummaries(rooms = [], archivedRooms = []) {
  const active = rooms.filter((room) => ["active", "expiring_soon"].includes(snapshot(room).lifecycle?.status)).length;
  const paymentReviewNeeded = rooms.filter((room) => ["pending_payment", "approved_unpaid"].includes(snapshot(room).lifecycle?.status)).length;
  return [
    { label: "운영 방", value: active || rooms.length, tone: "good" },
    { label: "결제 확인", value: paymentReviewNeeded, tone: "warn" },
    { label: "문제 방", value: rooms.filter((room) => room.diagnostics?.ok === false).length, tone: "bad" },
    { label: "종료 보관", value: archivedRooms.length, tone: "neutral" }
  ];
}

export function buyerSummaries(payload = {}) {
  const rooms = payload.rooms || [];
  const applications = payload.applications || [];
  const lifecycle = payload.lifecycleSummary || {};
  return [
    { label: "이용 중인 방", value: lifecycle.active || rooms.filter((room) => snapshot(room).lifecycle?.available).length, tone: "good" },
    { label: "결제 확인", value: lifecycle.paymentReviewNeeded ?? applications.filter((item) => ["pending_payment", "approved_unpaid"].includes(item.lifecycle?.status)).length, tone: "warn" },
    { label: "게임방 신청 가능", value: payload.canApplyGameRoom ? "가능" : "확인", tone: payload.canApplyGameRoom ? "good" : "neutral" },
    { label: "문의/신고", value: (payload.inquiries || []).filter((item) => item.status !== "resolved").length + (payload.reports || []).filter((item) => item.status !== "resolved").length, tone: "warn" },
    { label: "복구 요청", value: (payload.restoreRequests || []).length, tone: "neutral" }
  ];
}
