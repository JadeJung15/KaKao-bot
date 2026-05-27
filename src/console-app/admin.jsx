import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { adminRequest, formatError, ownerToken } from "./api.js";
import { bridgeLabel, formatDate, formatKrw, roomRoleLabel, roomRowFromGroup, roomSummaries, snapshot } from "./domain.js";
import { DetailTabs, EmptyState, FieldRow, StatusBadge, SummaryGrid, ToastHost, Toolbar } from "./ui.jsx";

const DETAIL_TABS = [
  { id: "settings", label: "설정" },
  { id: "billing", label: "신청/결제" },
  { id: "commands", label: "명령어/운영자" },
  { id: "reports", label: "신고" },
  { id: "transfers", label: "이관" },
  { id: "inquiries", label: "문의" },
  { id: "logs", label: "방별 로그" },
  { id: "backup", label: "백업/복구" },
  { id: "history", label: "이력" }
];

function roomMatches(row, search, filter) {
  const text = `${row.name} ${row.lifecycle} ${row.lifecycleStatus} ${row.bridge} ${row.raw?.baseApplication?.email || ""}`.toLowerCase();
  const query = (search || "").trim().toLowerCase();
  if (query && !text.includes(query)) return false;
  if (filter === "active") return ["active", "expiring_soon"].includes(row.lifecycleStatus);
  if (filter === "pending") return ["pending_payment", "approved_unpaid", "needs_setup", "expiring_soon"].includes(row.lifecycleStatus) || !/ready/.test(row.bridge);
  if (filter === "archived") return row.lifecycleStatus === "archived";
  return true;
}

function isPaymentApprovalRequest(application = {}) {
  const applicationStatus = application.status || "";
  const lifecycleStatus = application.lifecycle?.status || "";
  const paymentStatus = application.payment?.status || application.lifecycle?.paymentStatus || "";
  return (
    application.paymentReviewNeeded === true ||
    ["pending_payment", "approved_unpaid"].includes(applicationStatus) ||
    ["pending_payment", "approved_unpaid"].includes(lifecycleStatus) ||
    ["awaiting_manual_deposit", "payment_requested", "pending"].includes(paymentStatus) ||
    application.lifecycle?.paymentReviewNeeded === true
  );
}

function isPaymentInquiry(inquiry = {}) {
  return ["deposit_check", "payment_check"].includes(inquiry.type) && inquiry.status !== "resolved";
}

function paymentInquiriesByApplication(inquiries = []) {
  const map = new Map();
  inquiries.filter(isPaymentInquiry).forEach((inquiry) => {
    const applicationId = inquiry.applicationId || inquiry.application?.id || "";
    if (!applicationId || map.has(applicationId)) return;
    map.set(applicationId, inquiry);
  });
  return map;
}

function paymentApprovalQueueItems(applications = [], inquiries = []) {
  const inquiryMap = paymentInquiriesByApplication(inquiries);
  const byId = new Map();
  applications.filter(isPaymentApprovalRequest).forEach((application) => {
    const id = application.id || application.applicationId || "";
    if (!id) return;
    byId.set(id, { ...application, paymentInquiry: inquiryMap.get(id) || null });
  });
  inquiryMap.forEach((inquiry, applicationId) => {
    if (byId.has(applicationId)) return;
    if (inquiry.application?.id) {
      byId.set(applicationId, { ...inquiry.application, paymentInquiry: inquiry, paymentReviewNeeded: true });
    }
  });
  return [...byId.values()].sort((left, right) => {
    const leftAt = left.paymentInquiry?.createdAt || left.payment?.requestedAt || left.createdAt || "";
    const rightAt = right.paymentInquiry?.createdAt || right.payment?.requestedAt || right.createdAt || "";
    return String(rightAt).localeCompare(String(leftAt));
  });
}

function adminSummaryItems(rooms = [], archivedRooms = [], applications = [], inquiries = []) {
  const base = roomSummaries(rooms, archivedRooms);
  const paymentReviewNeeded = paymentApprovalQueueItems(applications, inquiries).length;
  return base.map((item) => (
    item.label === "결제 확인"
      ? { ...item, value: Math.max(Number(item.value) || 0, paymentReviewNeeded), help: "신청/결제 승인 요청 기준" }
      : item
  ));
}

function IntegratedAdminSearch({ selectedRoomName = "", onToast, onOpenResult }) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event?.preventDefault();
    if (!query.trim()) return;
    const params = new URLSearchParams({ q: query.trim() });
    if (selectedRoomName) params.set("roomName", selectedRoomName);
    setLoading(true);
    try {
      setResult(await adminRequest(`/api/admin/search?${params.toString()}`));
    } catch (error) {
      onToast?.({ tone: "bad", message: formatError(error) });
    } finally {
      setLoading(false);
    }
  }

  const sections = result?.sections || {};
  const people = sections.people || [];
  const resultCounts = result ? [
    ["방", sections.rooms?.length || 0],
    ["명령어", sections.commands?.length || 0],
    ["로그", sections.logs?.length || 0],
    ["문의", sections.inquiries?.length || 0],
    ["동명이인 후보", people.length]
  ] : [];
  return (
    <section className="console-search-panel" aria-labelledby="admin-search-title">
      <form onSubmit={submit} className="console-search-form">
        <div>
          <p className="console-eyebrow">운영자 통합 검색</p>
          <h2 id="admin-search-title">방, 신청자, 닉네임, 별명, 로그, 문의 검색</h2>
          <p>동명이인 후보는 자동 병합하지 않고 닉병합 도구로 연결합니다.</p>
        </div>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="방명, 닉네임, 별명, 명령어, 로그 검색" aria-label="운영자 통합 검색어" />
        <button type="submit" disabled={loading}>{loading ? "검색 중" : "검색"}</button>
      </form>
      {result ? (
        <>
        <p className="console-search-status" role="status" aria-live="polite">
          검색 결과 요약: {resultCounts.map(([label, count]) => `${label} ${count}개`).join(" · ")}
        </p>
        <div className="console-search-results" aria-label="운영자 통합 검색 결과">
          <SearchSection title="방" items={sections.rooms || []} render={(item) => `${item.roomName} · ${item.roleLabel || item.role} · ${item.bridgeStatus}`} actionLabel="방 상세 열기" onOpen={(item) => onOpenResult?.({ roomName: item.roomName, tab: "settings", label: "방 상세" })} />
          <SearchSection title="명령어" items={sections.commands || []} render={(item) => `${item.command} · ${item.description}`} actionLabel="명령어 탭 열기" onOpen={() => onOpenResult?.({ tab: "commands", label: "명령어/운영자" })} />
          <SearchSection title="로그" items={sections.logs || []} render={(item) => `${item.roomName} · ${item.command || item.eventType} · ${item.messagePreview}`} actionLabel="로그 탭 열기" onOpen={(item) => onOpenResult?.({ roomName: item.roomName, tab: "logs", label: "방별 로그" })} />
          <SearchSection title="문의" items={sections.inquiries || []} render={(item) => `${item.roomName} · ${item.statusLabel} · ${item.message}`} actionLabel="문의 탭 열기" onOpen={(item) => onOpenResult?.({ roomName: item.roomName || item.mainRoomName, tab: "inquiries", label: "문의" })} />
          <div className="console-search-section" aria-label={`동명이인 후보 검색 결과 ${people.length}개`}>
            <strong>동명이인 후보 <span>{people.length}개</span></strong>
            {people.length ? people.map((item) => (
              <button type="button" className="console-compact-row console-search-result-button" key={`${item.roomName}-${item.personKey}`} onClick={() => onOpenResult?.({ roomName: item.roomName, tab: "commands", label: "닉병합 도구" })}>
                <span>{item.displayName} · {item.roomName}</span>
                <small>{item.identityStatus === "conflict_possible" ? "동명이인 후보" : item.identitySummary} · 별명 {item.aliases?.join(", ") || "없음"} · 가방 {item.inventoryQuantity}</small>
                <code>{item.mergeCommand || "닉병합 기준닉 합칠닉"}</code>
              </button>
            )) : <p>검색된 참여자가 없습니다.</p>}
          </div>
        </div>
        </>
      ) : null}
    </section>
  );
}

function SearchSection({ title, items = [], render, actionLabel = "열기", onOpen }) {
  return (
    <div className="console-search-section" aria-label={`${title} 검색 결과 ${items.length}개`}>
      <strong>{title} <span>{items.length}개</span></strong>
      {items.length ? items.slice(0, 5).map((item, index) => (
        <button type="button" className="console-compact-row console-search-result-button" key={`${title}-${index}`} onClick={() => onOpen?.(item)}>
          <span>{render(item)}</span>
          <small>{actionLabel}</small>
        </button>
      )) : <p>결과 없음</p>}
    </div>
  );
}

function GameOpsOverviewPanel({ overview = {} }) {
  const packs = overview.installedGamePacks || [];
  const cooldowns = overview.cooldowns || [];
  return (
    <section className="console-game-overview">
      <div>
        <p className="console-eyebrow">Game Ops</p>
        <h3>게임 운영 요약</h3>
        <p>{overview.statusLabel || "게임 상태 확인 필요"}</p>
      </div>
      <div className="console-compact-list">
        <span>장착 팩: {packs.length ? packs.map((pack) => pack.title).join(", ") : "없음"}</span>
        <span>쿨타임: {cooldowns.map((item) => `${item.command} ${item.seconds}s`).join(" · ") || "기본값"}</span>
        <span>보상 설정: 주사위 {overview.rewards?.diceReward ?? "-"} · 낚시 {overview.rewards?.fishingReward || "-"}</span>
        <span>상점 상품: {overview.shopItemCount ?? 0}개</span>
        <span>게임 명령어 TOP: {(overview.recentTopCommands || []).map((item) => `${item.command} ${item.count}`).join(" · ") || "기록 없음"}</span>
      </div>
    </section>
  );
}

function AdminApp() {
  const [state, setState] = useState({ loading: true, rooms: [], roomGroups: [], applications: [], reports: [], transfers: [], inquiries: [], archivedRooms: [], restoreRequests: [] });
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [selectedId, setSelectedId] = useState("");
  const [tab, setTab] = useState("settings");
  const [toast, setToast] = useState(null);
  const [purgeForms, setPurgeForms] = useState({});
  const [actionForms, setActionForms] = useState({});
  const [logState, setLogState] = useState({ loading: false, logs: [], rooms: [], summary: null, error: "" });
  const [logFilters, setLogFilters] = useState({ room: "", q: "", command: "", type: "", limit: "100" });
  const [approvingApplicationId, setApprovingApplicationId] = useState("");

  async function load() {
    setState((current) => ({ ...current, loading: true }));
    try {
      const [rooms, applications, reports, transfers, inquiries, archived, restoreRequests] = await Promise.all([
        adminRequest("/api/admin/rooms"),
        adminRequest("/api/admin/applications"),
        adminRequest("/api/admin/reports?status=all"),
        adminRequest("/api/admin/transfers?status=all"),
        adminRequest("/api/admin/application-inquiries?status=all"),
        adminRequest("/api/admin/archived-rooms").catch(() => ({ archivedRooms: [] })),
        adminRequest("/api/admin/restore-requests?status=all").catch(() => ({ requests: [] }))
      ]);
      setState({
        loading: false,
        rooms: rooms.rooms || [],
        roomGroups: rooms.roomGroups || [],
        summary: rooms.summary || {},
        applications: applications.applications || [],
        reports: reports.reports || [],
        transfers: transfers.transfers || [],
        inquiries: inquiries.inquiries || [],
        archivedRooms: archived.archivedRooms || [],
        restoreRequests: restoreRequests.requests || []
      });
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: formatError(error) }));
    }
  }

  useEffect(() => { load(); }, []);

  const rows = useMemo(() => {
    const grouped = (state.roomGroups || []).map(roomRowFromGroup);
    const groupedNames = new Set(grouped.map((row) => row.name));
    const looseRooms = (state.rooms || [])
      .filter((room) => !groupedNames.has(room.name))
      .map((room) => ({ id: room.name, name: room.name, role: room.roomRole, lifecycle: snapshot(room).lifecycle?.label || room.subscription?.statusLabel, lifecycleStatus: snapshot(room).lifecycle?.status || "", lifecycleTone: snapshot(room).lifecycle?.tone, bridge: bridgeLabel(room), games: [], raw: { baseRoom: room, gameRooms: [] } }));
    return [...grouped, ...looseRooms].filter((row) => roomMatches(row, search, filter));
  }, [state.roomGroups, state.rooms, search, filter]);

  const selected = rows.find((row) => row.id === selectedId) || rows[0] || null;
  const baseRoom = selected?.raw?.baseRoom || selected?.raw?.room || {};
  const baseApp = selected?.raw?.baseApplication || {};
  const paymentApprovalRequests = useMemo(
    () => paymentApprovalQueueItems(state.applications || [], state.inquiries || []),
    [state.applications, state.inquiries]
  );
  const summaryItems = useMemo(() => adminSummaryItems(state.rooms, state.archivedRooms, state.applications, state.inquiries), [state.rooms, state.archivedRooms, state.applications, state.inquiries]);
  const logRoomOptions = useMemo(() => {
    const candidates = [baseRoom, ...(selected?.raw?.gameRooms || [])]
      .map((room) => room?.name)
      .filter(Boolean);
    return [...new Set(candidates)];
  }, [baseRoom.name, selected?.id, selected?.raw?.gameRooms]);

  function roomSavePayload(overrides = {}) {
    return {
      originalRoomName: baseRoom.name,
      room: baseRoom.name,
      roomId: baseRoom.roomIds?.[0] || baseApp.roomId || "",
      roomLink: baseRoom.roomLinks?.[0] || baseApp.roomLink || "",
      roomAdmins: baseRoom.admins || [],
      licenseKey: baseRoom.licenseKey || "",
      subscriptionExpiresAt: baseRoom.subscription?.expiresAt || "",
      registered: baseRoom.registered !== false,
      enabled: baseRoom.enabled !== false,
      features: baseRoom.features || {},
      ...overrides
    };
  }

  async function loadRoomLogs(overrides = {}) {
    const nextFilters = { ...logFilters, ...overrides };
    const roomName = nextFilters.room || baseRoom.name || selected?.name || "";
    if (!roomName) return;
    const params = new URLSearchParams({
      room: roomName,
      limit: nextFilters.limit || "100"
    });
    if (nextFilters.q) params.set("q", nextFilters.q);
    if (nextFilters.command) params.set("command", nextFilters.command);
    if (nextFilters.type) params.set("type", nextFilters.type);
    setLogState((current) => ({ ...current, loading: true, error: "" }));
    try {
      const result = await adminRequest(`/api/admin/room-logs?${params.toString()}`);
      setLogFilters({ ...nextFilters, room: roomName });
      setLogState({
        loading: false,
        logs: result.logs || [],
        rooms: result.rooms || [],
        summary: result.summary || {},
        error: ""
      });
    } catch (error) {
      setLogState((current) => ({ ...current, loading: false, error: formatError(error) }));
    }
  }

  useEffect(() => {
    if (tab !== "logs" || !selected) return;
    loadRoomLogs({ room: baseRoom.name || selected.name });
    // The log panel should refresh when the selected room changes; filter edits are applied by the explicit 조회 button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, selected?.id]);

  async function archiveSelected() {
    if (!baseRoom.name) return;
    try {
      await adminRequest("/api/admin/rooms/archive", { method: "POST", body: { roomName: baseRoom.name, reason: "관리자 콘솔 보관" } });
      setToast({ tone: "good", message: "방을 이용 종료 보관으로 이동했습니다." });
      await load();
    } catch (error) {
      setToast({ tone: "bad", message: formatError(error) });
    }
  }

  async function bulkArchiveRooms() {
    const form = actionForms.bulkArchive || {};
    try {
      const result = await adminRequest("/api/admin/rooms/bulk-archive", {
        method: "POST",
        body: {
          confirmBulkArchive: form.confirm || "",
          reason: form.reason || "고객 0명 초기화 보관 처리"
        }
      });
      setToast({ tone: "good", message: `활성 방 ${result.summary?.archivedCount || 0}개를 보관했습니다. 회원 계정은 유지됩니다.` });
      updateActionForm("bulkArchive", { confirm: "", reason: "" });
      await load();
    } catch (error) {
      setToast({ tone: "bad", message: formatError(error) });
    }
  }

  async function forceArchiveRoom() {
    const form = actionForms.forceArchive || {};
    try {
      await adminRequest("/api/admin/rooms/force-archive", {
        method: "POST",
        body: {
          roomName: form.roomName || "",
          reason: form.reason || "관리자 강제 보관 처리"
        }
      });
      setToast({ tone: "good", message: "대상 방을 강제 보관 처리했습니다." });
      updateActionForm("forceArchive", { roomName: "", reason: "" });
      await load();
    } catch (error) {
      setToast({ tone: "bad", message: formatError(error) });
    }
  }

  async function forceDeleteRoom() {
    const form = actionForms.forceDelete || {};
    try {
      await adminRequest("/api/admin/rooms/force-delete", {
        method: "POST",
        body: {
          roomName: form.roomName || "",
          confirmRoomName: form.confirmRoomName || "",
          confirmPermanentDelete: form.confirmPermanentDelete || ""
        }
      });
      setToast({ tone: "good", message: "대상 방을 완전 삭제 처리했습니다." });
      updateActionForm("forceDelete", { roomName: "", confirmRoomName: "", confirmPermanentDelete: "" });
      await load();
    } catch (error) {
      setToast({ tone: "bad", message: formatError(error) });
    }
  }

  async function restoreArchived(archive, extra = {}) {
    try {
      await adminRequest("/api/admin/rooms/restore", { method: "POST", body: { archiveId: archive.id, ...extra } });
      setToast({ tone: "good", message: "보관 방을 복구했습니다." });
      await load();
    } catch (error) {
      setToast({ tone: "bad", message: formatError(error) });
    }
  }

  async function resolveRestoreRequest(request, status = "resolved") {
    try {
      await adminRequest("/api/admin/restore-requests/resolve", {
        method: "POST",
        body: {
          requestId: request.id,
          status,
          resolution: status === "resolved" ? "관리자 콘솔 처리 완료" : "관리자 확인중"
        }
      });
      setToast({ tone: "good", message: status === "resolved" ? "복구 요청을 완료 처리했습니다." : "복구 요청을 확인중으로 변경했습니다." });
      await load();
    } catch (error) {
      setToast({ tone: "bad", message: formatError(error) });
    }
  }

  function updateActionForm(id, patch) {
    setActionForms((current) => ({ ...current, [id]: { ...(current[id] || {}), ...patch } }));
  }

  async function resolveReport(report) {
    const form = actionForms[`report:${report.roomName}:${report.id}`] || {};
    try {
      await adminRequest("/api/admin/reports/resolve", {
        method: "POST",
        body: {
          roomName: report.roomName,
          reportId: report.id,
          resolution: form.resolution || "관리자 콘솔 처리 완료"
        }
      });
      setToast({ tone: "good", message: "신고를 처리 완료했습니다." });
      await load();
    } catch (error) {
      setToast({ tone: "bad", message: formatError(error) });
    }
  }

  async function updateInquiry(inquiry, status = "resolved") {
    const form = actionForms[`inquiry:${inquiry.id}`] || {};
    try {
      await adminRequest("/api/admin/application-inquiries/resolve", {
        method: "POST",
        body: {
          inquiryId: inquiry.id,
          status,
          resolution: form.resolution || (status === "resolved" ? "관리자 콘솔 처리 완료" : "관리자 확인중")
        }
      });
      setToast({ tone: "good", message: status === "resolved" ? "문의를 처리 완료했습니다." : "문의를 확인중으로 변경했습니다." });
      await load();
    } catch (error) {
      setToast({ tone: "bad", message: formatError(error) });
    }
  }

  function updatePurgeForm(archiveId, patch) {
    setPurgeForms((current) => ({ ...current, [archiveId]: { ...(current[archiveId] || {}), ...patch } }));
  }

  async function purgeArchived(archive) {
    const form = purgeForms[archive.id] || {};
    try {
      await adminRequest("/api/admin/rooms/purge", {
        method: "POST",
        body: {
          archiveId: archive.id,
          confirmRoomName: form.confirmRoomName || "",
          confirmPermanentDelete: form.confirmPermanentDelete || "",
          resolution: "관리자 콘솔 완전 삭제"
        }
      });
      setToast({ tone: "good", message: "보관 방을 완전 삭제 처리했습니다." });
      setPurgeForms((current) => ({ ...current, [archive.id]: {} }));
      await load();
    } catch (error) {
      setToast({ tone: "bad", message: formatError(error) });
    }
  }

  async function approveApplication(application) {
    const applicationId = application?.id || application?.applicationId || "";
    if (!applicationId || approvingApplicationId) return;
    setApprovingApplicationId(applicationId);
    try {
      await adminRequest("/api/admin/applications/approve", {
        method: "POST",
        body: { applicationId, months: 1 }
      });
      setToast({ tone: "good", message: "입금승인을 완료했습니다. 방 이용 상태를 갱신했습니다." });
      await load();
    } catch (error) {
      setToast({ tone: "bad", message: formatError(error) });
    } finally {
      setApprovingApplicationId("");
    }
  }

  function openAdminSearchResult({ roomName = "", tab: nextTab = "settings", label = "상세" } = {}) {
    const targetRoomName = roomName || baseRoom.name || selected?.name || "";
    const matchedRow = rows.find((row) => (
      row.name === targetRoomName || row.raw?.gameRooms?.some((room) => room.name === targetRoomName)
    ));
    if (matchedRow) {
      setFilter("all");
      setSelectedId(matchedRow.id);
    } else if (targetRoomName) {
      setSearch(targetRoomName);
    }
    setTab(nextTab);
    setToast({ tone: "good", message: `${targetRoomName ? `${targetRoomName} · ` : ""}${label}로 이동했습니다.` });
    window.setTimeout(() => {
      document.getElementById("일반방")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  if (!ownerToken() && state.error) {
    return (
      <main className="console-app-shell">
        <section className="console-login-panel">
          <h1>일반방 중심 통합 운영 콘솔</h1>
          <p>운영자 로그인이 필요합니다. 로그인 후 다시 접속해 주세요.</p>
          <div className="console-action-row">
            <a className="console-secondary-link" href="/">홈으로</a>
            <a className="console-primary-link" href="/login">로그인</a>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="console-app-shell admin-react-console">
      <header className="console-hero">
        <div>
          <p className="console-eyebrow">Pixgom Admin</p>
          <h1>일반방 중심 통합 운영 콘솔</h1>
          <p>대시보드에서 운영 방, 결제 확인, 문제 방을 먼저 보고 신청, 결제, 설정, 신고, 이관, 문의, 백업/복구를 방 단위로 관리합니다.</p>
        </div>
        <div className="console-hero-actions">
          <a className="console-secondary-link" href="/">홈으로</a>
          <button type="button" onClick={load}>새로고침</button>
        </div>
      </header>
      <DashboardIntro />
      <SummaryGrid id="dashboard" label="운영자 대시보드 요약" items={summaryItems} />
      <IntegratedAdminSearch selectedRoomName={baseRoom.name || selected?.name || ""} onToast={setToast} onOpenResult={openAdminSearchResult} />
      <PaymentApprovalQueue
        applications={paymentApprovalRequests}
        approvingApplicationId={approvingApplicationId}
        onApprove={approveApplication}
      />
      <section className="console-layout">
        <aside className="console-sidebar" aria-label="운영 메뉴">
          <a href="#dashboard">대시보드</a>
          {["일반방", "신청/결제", "신고", "이관", "문의", "방별 로그", "종료 보관", "백업/복구"].map((item) => <a href={`#${item}`} key={item}>{item}</a>)}
        </aside>
        <section className="console-main-panel" id="일반방">
          <Toolbar search={search} onSearch={setSearch} filter={filter} onFilter={setFilter} />
          <div className="console-table-wrap">
            <table className="console-table">
              <thead>
                <tr>
                  <th>일반방</th>
                  <th>상태</th>
                  <th>브릿지</th>
                  <th>게임방</th>
                  <th>결제</th>
                  <th>선택</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className={selected?.id === row.id ? "selected" : ""}>
                    <td>
                      <strong>{row.name}</strong>
                      <small>{roomRoleLabel(row.raw?.baseRoom || {})}</small>
                    </td>
                    <td><StatusBadge label={row.lifecycle} status={row.lifecycleStatus} tone={row.lifecycleTone} /></td>
                    <td><StatusBadge label={row.bridge} status={row.bridge} /></td>
                    <td>{row.games.length ? `${row.games.length}개 연결` : "없음"}</td>
                    <td><StatusBadge label={row.raw?.baseApplication?.lifecycle?.paymentStatusLabel || row.raw?.baseApplication?.payment?.statusLabel || "-"} status={row.raw?.baseApplication?.lifecycle?.paymentStatus} /></td>
                    <td><button type="button" onClick={() => setSelectedId(row.id)}>상세</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows.length && <EmptyState title="표시할 방이 없습니다.">검색 조건을 바꾸거나 새로고침해 주세요.</EmptyState>}
          </div>
        </section>
        <aside className="console-detail-panel" aria-label="방 상세">
          {selected ? (
            <>
              <div className="console-detail-head">
                <div>
                  <p className="console-eyebrow">방 상세</p>
                  <h2>{selected.name}</h2>
                </div>
                <StatusBadge label={roomRoleLabel(baseRoom)} status={snapshot(baseRoom).role} />
              </div>
              <DetailTabs tabs={DETAIL_TABS} current={tab} onChange={setTab} />
              <GameOpsOverviewPanel overview={baseRoom.gameOpsOverview || {}} />
              {tab === "settings" && (
                <AdminSettingsPanel
                  baseRoom={baseRoom}
                  baseApp={baseApp}
                  onSaved={load}
                  onArchive={archiveSelected}
                  setToast={setToast}
                />
              )}
              {tab === "billing" && (
                <section className="console-detail-section">
                  <FieldRow label="신청번호">{baseApp.id}</FieldRow>
                  <FieldRow label="신청자">{baseApp.email || baseApp.contact}</FieldRow>
                  <FieldRow label="결제 상태">{baseApp.payment?.statusLabel}</FieldRow>
                  <FieldRow label="이용 상태">{baseApp.lifecycle?.label}</FieldRow>
                  <FieldRow label="다음 조치">{baseApp.lifecycle?.actionRequired}</FieldRow>
                  <FieldRow label="결제요청 일시">{formatDate(baseApp.payment?.requestedAt)}</FieldRow>
                  <FieldRow label="입금액">{formatKrw(baseApp.payment?.amountKrw)}</FieldRow>
                </section>
              )}
              {tab === "commands" && (
                <AdminCommandToolsPanel
                  baseRoom={baseRoom}
                  baseApp={baseApp}
                  roomSavePayload={roomSavePayload}
                  onSaved={load}
                  setToast={setToast}
                />
              )}
              {tab === "reports" && (
                <ReportsPanel
                  items={state.reports.filter((item) => item.roomName === selected.name)}
                  forms={actionForms}
                  onChange={updateActionForm}
                  onResolve={resolveReport}
                />
              )}
              {tab === "transfers" && <TransfersPanel items={state.transfers.filter((item) => item.roomName === selected.name)} />}
              {tab === "inquiries" && (
                <InquiriesPanel
                  items={state.inquiries.filter((item) => item.roomName === selected.name || item.mainRoomName === selected.name)}
                  forms={actionForms}
                  onChange={updateActionForm}
                  onReview={(item) => updateInquiry(item, "in_review")}
                  onResolve={(item) => updateInquiry(item, "resolved")}
                />
              )}
              {tab === "logs" && (
                <RoomLogsPanel
                  roomOptions={logRoomOptions}
                  filters={logFilters}
                  setFilters={setLogFilters}
                  logState={logState}
                  onLoad={loadRoomLogs}
                />
              )}
              {tab === "backup" && (
                <BackupPanel baseRoom={baseRoom} setToast={setToast} />
              )}
              {tab === "history" && (
                <section className="console-detail-section">
                  <FieldRow label="장기 분석 로그">{baseRoom.diagnostics?.analyticsLogCount || 0}건</FieldRow>
                  <FieldRow label="최근 분석 로그">{formatDate(baseRoom.diagnostics?.lastAnalyticsLogAt)}</FieldRow>
                  <FieldRow label="최근 이벤트">{formatDate(baseRoom.diagnostics?.lastEventAt)}</FieldRow>
                  <FieldRow label="최근 원본 이벤트">{formatDate(baseRoom.diagnostics?.lastRawEventAt)}</FieldRow>
                </section>
              )}
              {selected.raw?.gameRooms?.length ? (
                <details className="console-game-rooms" open>
                  <summary>연결된 게임방</summary>
                  {selected.raw.gameRooms.map((room) => (
                    <div className="console-linked-room" key={room.name}>
                      <strong>{room.name}</strong>
                      <span>{bridgeLabel(room)}</span>
                    </div>
                  ))}
                </details>
              ) : null}
            </>
          ) : <EmptyState title="방을 선택해 주세요.">일반방 테이블에서 상세를 누르면 설정 흐름이 표시됩니다.</EmptyState>}
        </aside>
      </section>
      <section className="console-archive-panel" id="종료 보관">
        <h2>이용 종료된 방</h2>
        <p>삭제 대신 보관 처리된 방입니다. 복구 전 기존 설정과 신청/결제 연결을 확인합니다.</p>
        <RestoreRequestsPanel
          requests={state.restoreRequests}
          onReview={(request) => resolveRestoreRequest(request, "in_review")}
          onResolve={(request) => resolveRestoreRequest(request, "resolved")}
          onRestore={(request) => restoreArchived({ id: request.archiveId }, { restoreRequestId: request.id, resolution: "구매자 복구 요청 승인" })}
        />
        <AdminArchiveToolsPanel
          forms={actionForms}
          onChange={updateActionForm}
          onBulkArchive={bulkArchiveRooms}
          onForceArchive={forceArchiveRoom}
          onForceDelete={forceDeleteRoom}
        />
        <div className="console-card-list">
          {(state.archivedRooms || []).map((archive) => (
            <ArchivedRoomCard
              key={archive.id}
              archive={archive}
              purgeForm={purgeForms[archive.id] || {}}
              onPurgeField={(patch) => updatePurgeForm(archive.id, patch)}
              onRestore={() => restoreArchived(archive)}
              onPurge={() => purgeArchived(archive)}
            />
          ))}
          {!state.archivedRooms?.length && <EmptyState title="보관된 방이 없습니다.">이용 종료 처리된 방이 여기에 표시됩니다.</EmptyState>}
        </div>
      </section>
      <ToastHost message={toast?.message || state.error} tone={toast?.tone || "bad"} onClose={() => setToast(null)} />
    </main>
  );
}

function parseQuickCommand(value = "", trigger = "", response = "") {
  const text = value.trim();
  if (text.includes("=")) {
    const [left, ...right] = text.split("=");
    return { trigger: left.trim(), response: right.join("=").trim() };
  }
  return { trigger: trigger.trim(), response: response.trim() };
}

function commandKey(trigger = "") {
  return String(trigger || "").trim();
}

function PaymentApprovalQueue({ applications = [], approvingApplicationId = "", onApprove }) {
  return (
    <section className="console-payment-approval-panel" id="신청/결제" data-payment-approval-queue="true">
      <div className="console-section-head">
        <div>
          <p className="console-eyebrow">Payment Review</p>
          <h2>결제 승인 요청</h2>
          <p>구매자가 신청 접수 후 입금 확인이 필요한 건을 방 목록과 별도로 표시합니다.</p>
        </div>
        <StatusBadge label={`${applications.length}건`} status={applications.length ? "pending_payment" : "ok"} />
      </div>
      <div className="console-card-list compact">
        {applications.map((application) => {
          const id = application.id || application.applicationId || "";
          const requester = application.email || application.contact || application.account?.email || "-";
          const mainRoom = application.mainRoom?.roomName || application.linkedApplication?.roomName || application.linkedApplication?.roomNameSnapshot || "";
          const paymentInquiry = application.paymentInquiry || null;
          return (
            <article className="console-card console-workflow-card console-payment-request-card" key={id || application.roomName}>
              <div>
                <strong>{application.roomName || "방명 미지정"}</strong>
                <span>
                  신청번호 {id || "-"} · {application.payment?.statusLabel || application.lifecycle?.paymentStatusLabel || "결제 확인 필요"}
                </span>
                <small>신청자 {requester} · 결제요청 일시 {formatDate(application.payment?.requestedAt || application.createdAt)}</small>
                <small>입금액 {formatKrw(application.payment?.amountKrw || application.plan?.monthlyPriceKrw)} · 이용 상태 {application.lifecycle?.label || application.status}</small>
                {paymentInquiry ? <small>결제 확인 문의: {paymentInquiry.typeLabel || "입금 확인 요청"} · {paymentInquiry.message || "문의 내용 없음"}</small> : null}
                {mainRoom ? <small>기준 일반방: {mainRoom}</small> : null}
              </div>
              <div className="console-workflow-actions compact">
                <button type="button" onClick={() => onApprove(application)} disabled={approvingApplicationId === id}>
                  {approvingApplicationId === id ? "승인 중" : "입금승인"}
                </button>
              </div>
            </article>
          );
        })}
        {!applications.length && (
          <EmptyState title="결제 승인 요청이 없습니다.">신규 신청 또는 입금 확인이 필요한 건이 접수되면 여기에 바로 표시됩니다.</EmptyState>
        )}
      </div>
    </section>
  );
}

function AdminCommandToolsPanel({ baseRoom = {}, roomSavePayload, onSaved, setToast }) {
  const [commandForm, setCommandForm] = useState({ quick: "", trigger: "", response: "" });
  const [adminName, setAdminName] = useState("");
  const [mergeForm, setMergeForm] = useState({ targetName: "", sourceName: "", preview: null });
  const [mergeData, setMergeData] = useState({ loading: false, history: [], candidates: [] });
  const [saving, setSaving] = useState(false);
  const commands = baseRoom.customCommands || [];
  const admins = baseRoom.admins || [];
  const aliasSummary = baseRoom.aliasSummary || {};

  useEffect(() => {
    setCommandForm({ quick: "", trigger: "", response: "" });
    setAdminName("");
    setMergeForm({ targetName: "", sourceName: "", preview: null });
    setMergeData({ loading: false, history: [], candidates: [] });
  }, [baseRoom.name]);

  async function saveRoomPatch(patch, successMessage) {
    if (saving || !baseRoom.name) return;
    setSaving(true);
    try {
      await adminRequest("/api/admin/rooms", {
        method: "POST",
        body: roomSavePayload(patch)
      });
      setToast({ tone: "good", message: successMessage });
      await onSaved();
    } catch (error) {
      setToast({ tone: "bad", message: formatError(error) });
    } finally {
      setSaving(false);
    }
  }

  async function saveCommand(event) {
    event.preventDefault();
    const parsed = parseQuickCommand(commandForm.quick, commandForm.trigger, commandForm.response);
    if (!parsed.trigger || !parsed.response) {
      setToast({ tone: "bad", message: "명령어와 응답을 입력해 주세요. 예: 사과=맛있어" });
      return;
    }
    const nextCommand = {
      trigger: parsed.trigger,
      response: parsed.response,
      updatedAt: new Date().toISOString(),
      updatedBy: "admin_console"
    };
    const nextCommands = commands.filter((item) => commandKey(item.trigger) !== commandKey(parsed.trigger));
    nextCommands.push(nextCommand);
    await saveRoomPatch({ customCommands: nextCommands }, "커스텀 명령어를 저장했습니다.");
    setCommandForm({ quick: "", trigger: "", response: "" });
  }

  async function deleteCommand(trigger) {
    const nextCommands = commands.filter((item) => commandKey(item.trigger) !== commandKey(trigger));
    await saveRoomPatch({ customCommands: nextCommands }, `${trigger} 명령어를 삭제했습니다.`);
  }

  async function addAdmin(event) {
    event.preventDefault();
    const name = adminName.trim();
    if (!name) {
      setToast({ tone: "bad", message: "등록할 관리자 닉네임을 입력해 주세요." });
      return;
    }
    const nextAdmins = [...new Set([...admins, name])];
    await saveRoomPatch({ roomAdmins: nextAdmins }, "관리자를 등록했습니다.");
    setAdminName("");
  }

  async function deleteAdmin(name) {
    const nextAdmins = admins.filter((item) => item !== name);
    await saveRoomPatch({ roomAdmins: nextAdmins }, "관리자를 삭제했습니다.");
  }

  async function previewNicknameMerge(event) {
    event.preventDefault();
    if (saving || !baseRoom.name) return;
    if (!mergeForm.targetName.trim() || !mergeForm.sourceName.trim()) {
      setToast({ tone: "bad", message: "기준 닉과 합칠 닉을 모두 입력해 주세요." });
      return;
    }
    setSaving(true);
    try {
      const result = await adminRequest("/api/admin/nickname-merge/preview", {
        method: "POST",
        body: {
          roomName: baseRoom.name,
          targetName: mergeForm.targetName,
          sourceName: mergeForm.sourceName
        }
      });
      setMergeForm((current) => ({ ...current, preview: result.preview }));
      setToast({ tone: "good", message: "병합 미리보기를 불러왔습니다." });
    } catch (error) {
      setMergeForm((current) => ({ ...current, preview: null }));
      setToast({ tone: "bad", message: formatError(error) });
    } finally {
      setSaving(false);
    }
  }

  async function executeNicknameMerge() {
    if (saving || !baseRoom.name) return;
    setSaving(true);
    try {
      const result = await adminRequest("/api/admin/nickname-merge", {
        method: "POST",
        body: {
          roomName: baseRoom.name,
          targetName: mergeForm.targetName,
          sourceName: mergeForm.sourceName
        }
      });
      setMergeForm({ targetName: result.preview?.target?.name || mergeForm.targetName, sourceName: "", preview: result.preview });
      setToast({ tone: "good", message: "닉네임 데이터를 병합했습니다." });
      await loadNicknameMerges();
      await onSaved();
    } catch (error) {
      setToast({ tone: "bad", message: formatError(error) });
    } finally {
      setSaving(false);
    }
  }

  async function loadNicknameMerges() {
    if (!baseRoom.name) return;
    setMergeData((current) => ({ ...current, loading: true }));
    try {
      const params = new URLSearchParams({ roomName: baseRoom.name });
      const result = await adminRequest(`/api/admin/nickname-merges?${params.toString()}`);
      setMergeData({ loading: false, history: result.history || [], candidates: result.candidates || [] });
    } catch (error) {
      setMergeData((current) => ({ ...current, loading: false }));
      setToast({ tone: "bad", message: formatError(error) });
    }
  }

  function useMergeCandidate(candidate) {
    setMergeForm({
      targetName: candidate.target?.name || "",
      sourceName: candidate.source?.name || "",
      preview: null
    });
  }

  async function undoNicknameMerge(item) {
    if (saving || !baseRoom.name || !item?.id) return;
    setSaving(true);
    try {
      await adminRequest("/api/admin/nickname-merge/undo", {
        method: "POST",
        body: { roomName: baseRoom.name, mergeId: item.id }
      });
      setToast({ tone: "good", message: "닉네임 병합을 되돌렸습니다." });
      await loadNicknameMerges();
      await onSaved();
    } catch (error) {
      setToast({ tone: "bad", message: formatError(error) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="console-detail-section console-utility-panel">
      <div className="console-section-head">
        <div>
          <p className="console-eyebrow">Commands & Admins</p>
          <h3>커스텀 명령어 / 관리자</h3>
        </div>
        <StatusBadge label={`${commands.length}개 명령어 · ${admins.length}명 관리자`} status="ok" />
      </div>
      <div className="console-field-grid console-compact-stats">
        <FieldRow label="설치 명령어">{baseRoom.commandCount || commands.length || 0}개</FieldRow>
        <FieldRow label="장착 팩">{(baseRoom.commandPacks?.installedPacks || []).length || 0}개</FieldRow>
      </div>
      <AliasSummaryPanel summary={aliasSummary} />
      <form className="console-mini-form console-nickname-merge-form" onSubmit={previewNicknameMerge}>
        <div className="console-section-head compact">
          <div>
            <p className="console-eyebrow">Nickname Merge</p>
            <h3>닉네임 병합 도구</h3>
            <p>일반방과 게임방에서 다른 닉을 쓰는 참여자의 포인트, 가방, 출석, 게임 데이터를 기준 닉으로 합칩니다.</p>
          </div>
        </div>
        <div className="console-two-column-form">
          <label>
            <span>기준 닉</span>
            <input value={mergeForm.targetName} onChange={(event) => setMergeForm({ ...mergeForm, targetName: event.target.value, preview: null })} placeholder="오리 95" />
          </label>
          <label>
            <span>합칠 닉</span>
            <input value={mergeForm.sourceName} onChange={(event) => setMergeForm({ ...mergeForm, sourceName: event.target.value, preview: null })} placeholder="오리" />
          </label>
        </div>
        <div className="console-action-row">
          <button type="submit" disabled={saving}>병합 미리보기</button>
          <button type="button" onClick={executeNicknameMerge} disabled={saving || !mergeForm.preview}>닉네임 병합 실행</button>
          <button type="button" onClick={loadNicknameMerges} disabled={saving || mergeData.loading}>{mergeData.loading ? "불러오는 중" : "후보 불러오기"}</button>
        </div>
        {mergeForm.preview ? <NicknameMergePreview preview={mergeForm.preview} /> : null}
        <NicknameMergeHistoryPanel
          candidates={mergeData.candidates}
          history={mergeData.history}
          onUseCandidate={useMergeCandidate}
          onUndo={undoNicknameMerge}
          saving={saving}
        />
      </form>
      <form className="console-mini-form console-command-form" onSubmit={saveCommand}>
        <label>
          <span>빠른 등록</span>
          <input value={commandForm.quick} onChange={(event) => setCommandForm({ ...commandForm, quick: event.target.value })} placeholder="사과=맛있어" />
        </label>
        <div className="console-two-column-form">
          <label>
            <span>명령어</span>
            <input value={commandForm.trigger} onChange={(event) => setCommandForm({ ...commandForm, trigger: event.target.value })} placeholder="사과 또는 /공지" />
          </label>
          <label>
            <span>응답</span>
            <input value={commandForm.response} onChange={(event) => setCommandForm({ ...commandForm, response: event.target.value })} placeholder="맛있어" />
          </label>
        </div>
        <button type="submit" disabled={saving}>{saving ? "저장 중" : "명령어 저장"}</button>
      </form>
      <div className="console-compact-list" aria-label="커스텀 명령어 목록">
        {commands.map((command) => (
          <div className="console-compact-row" key={command.trigger}>
            <div>
              <strong>{command.trigger}</strong>
              <span>{command.response}</span>
            </div>
            <button type="button" onClick={() => deleteCommand(command.trigger)} disabled={saving}>명령어 삭제</button>
          </div>
        ))}
        {!commands.length ? <EmptyState title="등록된 커스텀 명령어가 없습니다.">예: 사과=맛있어 형식으로 바로 추가할 수 있습니다.</EmptyState> : null}
      </div>
      <form className="console-mini-form console-admin-form" onSubmit={addAdmin}>
        <label>
          <span>관리자 등록</span>
          <input value={adminName} onChange={(event) => setAdminName(event.target.value)} placeholder="카카오 닉네임" />
        </label>
        <button type="submit" disabled={saving}>관리자 등록</button>
      </form>
      <div className="console-compact-list" aria-label="관리자 목록">
        {admins.map((name) => (
          <div className="console-compact-row" key={name}>
            <div>
              <strong>{name}</strong>
              <span>방 관리자</span>
            </div>
            <button type="button" onClick={() => deleteAdmin(name)} disabled={saving}>관리자 삭제</button>
          </div>
        ))}
        {!admins.length ? <EmptyState title="등록된 관리자가 없습니다.">관리자 닉네임을 등록하면 채팅 관리자 명령어를 사용할 수 있습니다.</EmptyState> : null}
      </div>
    </section>
  );
}

function formatCount(value = 0, suffix = "") {
  return `${Math.max(0, Math.trunc(Number(value) || 0)).toLocaleString("ko-KR")}${suffix}`;
}

function NicknameMergePreview({ preview = {} }) {
  const target = preview.target || {};
  const source = preview.source || {};
  const merged = preview.merged || {};
  return (
    <div className="console-preview-box console-nickname-merge-preview" data-nickname-merge-preview="true">
      <strong>병합 미리보기</strong>
      <span>기준: {target.name} · 합칠 닉: {source.name}</span>
      <div className="console-field-grid console-compact-stats">
        <FieldRow label="포인트">{formatCount(target.points)} + {formatCount(source.points)} = {formatCount(merged.points)}</FieldRow>
        <FieldRow label="가방">{formatCount(merged.inventoryItemTypes, "종")} / {formatCount(merged.inventoryQuantity, "개")}</FieldRow>
        <FieldRow label="출석">{formatCount(merged.attendanceCount, "일")}</FieldRow>
        <FieldRow label="채팅">{formatCount(merged.chatTotal, "회")}</FieldRow>
        <FieldRow label="몬스터">{formatCount(merged.monsterCount, "마리")}</FieldRow>
        <FieldRow label="펫">{merged.hasPet ? "보유" : "없음"}</FieldRow>
      </div>
      <small>실행 명령어: {preview.command}</small>
      <small>병합 후 합칠 닉은 기준 닉의 별명으로 연결되어 같은 사람 데이터로 조회됩니다.</small>
    </div>
  );
}

function NicknameMergeHistoryPanel({ candidates = [], history = [], onUseCandidate, onUndo, saving = false }) {
  return (
    <div className="console-compact-list console-nickname-merge-history" data-nickname-merge-history="true">
      <strong>병합 후보</strong>
      {candidates.map((candidate) => (
        <div className="console-compact-row" key={`${candidate.target?.key}:${candidate.source?.key}`}>
          <div>
            <strong>{candidate.target?.name} ← {candidate.source?.name}</strong>
            <span>{candidate.reason} · 점수 {candidate.score}</span>
            <small>{candidate.command}</small>
          </div>
          <button type="button" onClick={() => onUseCandidate(candidate)} disabled={saving}>후보 사용</button>
        </div>
      ))}
      {!candidates.length ? <small>후보 불러오기를 누르면 숫자/공백만 다른 닉네임 후보를 찾습니다.</small> : null}
      <strong>병합 이력</strong>
      {history.map((item) => (
        <div className="console-compact-row" key={item.id}>
          <div>
            <strong>{item.targetName} ← {item.sourceName}</strong>
            <span>{item.status === "undone" ? "되돌림" : "활성"} · {formatDate(item.createdAt)} · {item.by || "admin"}</span>
            {item.undoneAt ? <small>되돌린 시각: {formatDate(item.undoneAt)}</small> : null}
          </div>
          <button type="button" onClick={() => onUndo(item)} disabled={saving || item.status === "undone"}>되돌리기</button>
        </div>
      ))}
      {!history.length ? <small>아직 병합 이력이 없습니다.</small> : null}
    </div>
  );
}

function AliasSummaryPanel({ summary = {} }) {
  const items = summary.items || [];
  return (
    <div className="console-alias-summary" data-alias-summary="admin">
      <div className="console-section-head compact">
        <div>
          <p className="console-eyebrow">Alias Summary</p>
          <h3>별명 요약</h3>
          <p>카톡 별명, 일반방/게임방 닉 병합 상태를 같은 데이터 기준으로 확인합니다.</p>
        </div>
        <StatusBadge label={`${summary.aliasCount || 0}개 별명`} status="ok" />
      </div>
      <div className="console-field-grid console-compact-stats">
        <FieldRow label="대상">{formatCount(summary.totalProfiles, "명")}</FieldRow>
        <FieldRow label="별명">{formatCount(summary.aliasCount, "개")}</FieldRow>
        <FieldRow label="병합">{formatCount(summary.mergedAliasCount, "건")}</FieldRow>
      </div>
      <div className="console-compact-list">
        {items.slice(0, 6).map((item) => (
          <div className="console-compact-row" key={item.key || item.name}>
            <div>
              <strong>{item.name}</strong>
              <span>{(item.aliases || []).length ? item.aliases.join(", ") : "등록 별명 없음"}</span>
            </div>
            <small>{item.mergeStatus === "merged" ? "병합됨" : "단일 닉"}</small>
          </div>
        ))}
        {!items.length ? <small>아직 표시할 별명 데이터가 없습니다.</small> : null}
      </div>
    </div>
  );
}

function AdminArchiveToolsPanel({ forms = {}, onChange, onBulkArchive, onForceArchive, onForceDelete }) {
  const bulk = forms.bulkArchive || {};
  const forceArchive = forms.forceArchive || {};
  const forceDelete = forms.forceDelete || {};
  return (
    <details className="console-danger-zone console-admin-archive-tools">
      <summary>방 보관 / 고객 0명 초기화 도구</summary>
      <p>회원 계정은 유지하고 방과 신청/결제 연결만 보관 처리합니다. 전체 초기화는 `ARCHIVE_ALL_ROOMS` 확인값이 필요합니다.</p>
      <div className="console-two-column-form">
        <label>
          <span>전체 보관 확인</span>
          <input value={bulk.confirm || ""} onChange={(event) => onChange("bulkArchive", { confirm: event.target.value })} placeholder="ARCHIVE_ALL_ROOMS" />
        </label>
        <label>
          <span>보관 사유</span>
          <input value={bulk.reason || ""} onChange={(event) => onChange("bulkArchive", { reason: event.target.value })} placeholder="고객 0명 초기화 보관 처리" />
        </label>
      </div>
      <div className="console-action-row">
        <button type="button" className="danger" onClick={onBulkArchive}>전체 방 보관</button>
      </div>
      <div className="console-two-column-form">
        <label>
          <span>강제 보관 방명</span>
          <input value={forceArchive.roomName || ""} onChange={(event) => onChange("forceArchive", { roomName: event.target.value })} placeholder="방명" />
        </label>
        <label>
          <span>강제 보관 사유</span>
          <input value={forceArchive.reason || ""} onChange={(event) => onChange("forceArchive", { reason: event.target.value })} placeholder="미연동/오류 복구용 보관" />
        </label>
      </div>
      <div className="console-action-row">
        <button type="button" onClick={onForceArchive}>강제 보관</button>
      </div>
      <div className="console-two-column-form">
        <label>
          <span>강제 삭제 방명</span>
          <input value={forceDelete.roomName || ""} onChange={(event) => onChange("forceDelete", { roomName: event.target.value })} placeholder="방명" />
        </label>
        <label>
          <span>방명 재입력</span>
          <input value={forceDelete.confirmRoomName || ""} onChange={(event) => onChange("forceDelete", { confirmRoomName: event.target.value })} placeholder="동일 방명" />
        </label>
        <label>
          <span>삭제 확인 문구</span>
          <input value={forceDelete.confirmPermanentDelete || ""} onChange={(event) => onChange("forceDelete", { confirmPermanentDelete: event.target.value })} placeholder="PERMANENT_DELETE" />
        </label>
      </div>
      <div className="console-action-row">
        <button type="button" className="danger" onClick={onForceDelete}>강제 완전 삭제</button>
      </div>
    </details>
  );
}

function RestoreRequestsPanel({ requests = [], onReview, onResolve, onRestore }) {
  const visible = requests.slice(0, 8);
  return (
    <section className="console-restore-panel" aria-label="복구 요청">
      <div className="console-section-head">
        <div>
          <p className="console-eyebrow">Restore Requests</p>
          <h3>구매자 복구 요청</h3>
        </div>
        <StatusBadge label={`${requests.filter((request) => request.status !== "resolved").length}건 대기`} status="open" />
      </div>
      <div className="console-card-list compact">
        {visible.map((request) => (
          <article className="console-card console-restore-card" key={request.id}>
            <div>
              <strong>{request.roomName || "방명 미지정"}</strong>
              <span>{request.statusLabel} · {formatDate(request.createdAt)}</span>
              <small>{request.reason || "복구 요청"}</small>
            </div>
            <div className="console-action-row">
              {request.status === "open" && <button type="button" onClick={() => onReview(request)}>확인중</button>}
              {request.archivedRoomExists && <button type="button" onClick={() => onRestore(request)}>복구 실행</button>}
              <button type="button" onClick={() => onResolve(request)}>완료 처리</button>
            </div>
          </article>
        ))}
        {!visible.length && <EmptyState title="복구 요청이 없습니다.">구매자 콘솔에서 접수된 복구 요청이 여기에 표시됩니다.</EmptyState>}
      </div>
    </section>
  );
}

function ArchivedRoomCard({ archive, purgeForm = {}, onPurgeField, onRestore, onPurge }) {
  return (
    <article className="console-card console-archive-card">
      <div className="console-archive-summary">
        <strong>{archive.roomName}</strong>
        <span>{formatDate(archive.archivedAt)} · {archive.reason || "보관 처리"}</span>
        <small>연결 신청 {archive.affectedApplicationIds?.length || 0}건 · 복구 전 방명 충돌 여부를 확인합니다.</small>
      </div>
      <div className="console-action-row">
        <button type="button" onClick={onRestore}>복구</button>
      </div>
      <details className="console-danger-zone">
        <summary>완전 삭제 확인</summary>
        <p>완전 삭제는 되돌릴 수 없습니다. 방명과 `PERMANENT_DELETE`를 모두 입력해야 실행됩니다.</p>
        <label>
          <span>방명 확인</span>
          <input value={purgeForm.confirmRoomName || ""} onChange={(event) => onPurgeField({ confirmRoomName: event.target.value })} placeholder={archive.roomName} />
        </label>
        <label>
          <span>삭제 확인 문구</span>
          <input value={purgeForm.confirmPermanentDelete || ""} onChange={(event) => onPurgeField({ confirmPermanentDelete: event.target.value })} placeholder="PERMANENT_DELETE" />
        </label>
        <button type="button" className="danger" onClick={onPurge}>완전 삭제</button>
      </details>
    </article>
  );
}

function BackupPanel({ baseRoom = {}, setToast }) {
  const [payloadText, setPayloadText] = useState("");
  const [validation, setValidation] = useState(null);
  const [checking, setChecking] = useState(false);

  async function validateBackup() {
    setChecking(true);
    try {
      const parsed = JSON.parse(payloadText || "{}");
      const result = await adminRequest("/api/admin/backup/validate", { method: "POST", body: parsed });
      setValidation(result);
      setToast({ tone: "good", message: "백업 복구 미리보기를 확인했습니다." });
    } catch (error) {
      setValidation(null);
      setToast({ tone: "bad", message: formatError(error) });
    } finally {
      setChecking(false);
    }
  }

  return (
    <section className="console-detail-section console-backup-panel">
      <p>방 단위 백업/복구만 허용됩니다. 전체 state 덮어쓰기는 차단됩니다.</p>
      <div className="console-action-row">
        <a href="/api/admin/backup" target="_blank" rel="noreferrer">백업 JSON 확인</a>
        <span>현재 선택 방: {baseRoom.name || "방 선택 필요"}</span>
      </div>
      <label>
        <span>복구 미리보기 JSON</span>
        <textarea value={payloadText} onChange={(event) => setPayloadText(event.target.value)} placeholder='{"schemaVersion":1,"rooms":[...]}' />
      </label>
      <button type="button" onClick={validateBackup} disabled={checking || !payloadText.trim()}>{checking ? "검증 중" : "복구 dry-run 검증"}</button>
      {validation ? (
        <div className="console-preview-box">
          <strong>변경 요약</strong>
          <span>{validation.summary}</span>
          <span>대상 방 {validation.roomCount || 0}개 · 스키마 {validation.schemaVersion}</span>
        </div>
      ) : null}
    </section>
  );
}

function ReportsPanel({ items = [], forms = {}, onChange, onResolve }) {
  const [status, setStatus] = useState("open");
  const visible = items.filter((item) => status === "all" || item.status === status);
  return (
    <section className="console-detail-section">
      <PanelFilter label="신고 상태" value={status} onChange={setStatus} options={[["open", "미처리"], ["resolved", "완료"], ["all", "전체"]]} />
      <div className="console-card-list compact">
        {visible.map((report) => {
          const key = `report:${report.roomName}:${report.id}`;
          return (
            <article className="console-card console-workflow-card" key={key}>
              <div>
                <strong>{report.id} · {report.target || "대상 미지정"}</strong>
                <span>{report.status === "resolved" ? "완료" : "미처리"} · 신고자 {report.reporter || "-"} · {formatDate(report.createdAt)}</span>
                <small>{report.reason || "신고 사유 없음"}</small>
                {report.resolution ? <small>처리 메모: {report.resolution}</small> : null}
              </div>
              {report.status !== "resolved" ? (
                <div className="console-workflow-actions">
                  <textarea value={forms[key]?.resolution || ""} onChange={(event) => onChange(key, { resolution: event.target.value })} placeholder="처리 메모" />
                  <button type="button" onClick={() => onResolve(report)}>처리 완료</button>
                </div>
              ) : null}
            </article>
          );
        })}
        {!visible.length && <EmptyState title="표시할 신고가 없습니다.">상태 필터를 바꾸거나 다른 방을 선택해 주세요.</EmptyState>}
      </div>
    </section>
  );
}

function InquiriesPanel({ items = [], forms = {}, onChange, onReview, onResolve }) {
  const [status, setStatus] = useState("open");
  const visible = items.filter((item) => status === "all" || item.status === status || (status === "open" && item.status !== "resolved"));
  return (
    <section className="console-detail-section">
      <PanelFilter label="문의 상태" value={status} onChange={setStatus} options={[["open", "접수/확인중"], ["in_review", "확인중"], ["resolved", "완료"], ["all", "전체"]]} />
      <div className="console-card-list compact">
        {visible.map((inquiry) => {
          const key = `inquiry:${inquiry.id}`;
          return (
            <article className="console-card console-workflow-card" key={inquiry.id}>
              <div>
                <strong>{inquiry.typeLabel || "문의"} · {inquiry.roomName || "방명 미지정"}</strong>
                <span>{inquiry.statusLabel} · {formatDate(inquiry.createdAt)}</span>
                <small>{inquiry.message || "문의 내용 없음"}</small>
                {inquiry.resolution ? <small>관리자 메모: {inquiry.resolution}</small> : null}
              </div>
              {inquiry.status !== "resolved" ? (
                <div className="console-workflow-actions">
                  <textarea value={forms[key]?.resolution || ""} onChange={(event) => onChange(key, { resolution: event.target.value })} placeholder="관리자 메모" />
                  {inquiry.status !== "in_review" ? <button type="button" onClick={() => onReview(inquiry)}>확인중</button> : null}
                  <button type="button" onClick={() => onResolve(inquiry)}>완료</button>
                </div>
              ) : null}
            </article>
          );
        })}
        {!visible.length && <EmptyState title="표시할 문의가 없습니다.">상태 필터를 바꾸거나 다른 방을 선택해 주세요.</EmptyState>}
      </div>
    </section>
  );
}

function TransfersPanel({ items = [] }) {
  const [status, setStatus] = useState("all");
  const visible = items.filter((item) => status === "all" || item.status === status);
  return (
    <section className="console-detail-section">
      <PanelFilter label="이관 상태" value={status} onChange={setStatus} options={[["all", "전체"], ["pending", "대기"], ["accepted", "완료"], ["cancelled", "취소"], ["expired", "만료"]]} />
      <div className="console-card-list compact">
        {visible.map((transfer) => (
          <article className="console-card console-workflow-card" key={transfer.id}>
            <div>
              <strong>{transfer.statusLabel || transfer.status} · {transfer.roomName}</strong>
              <span>보낸 계정: {transfer.fromAccount?.email || transfer.fromAccount?.nickname || "-"}</span>
              <span>받는 계정: {transfer.toAccount?.email || transfer.toAccount?.nickname || "-"}</span>
              <small>생성 {formatDate(transfer.createdAt)} · 만료 {formatDate(transfer.expiresAt)} · 수락 {formatDate(transfer.acceptedAt)}</small>
              {transfer.cancelReason ? <small>취소 사유: {transfer.cancelReason}</small> : null}
            </div>
          </article>
        ))}
        {!visible.length && <EmptyState title="표시할 이관 내역이 없습니다.">상태 필터를 바꾸거나 다른 방을 선택해 주세요.</EmptyState>}
      </div>
    </section>
  );
}

function RoomLogsPanel({ roomOptions = [], filters = {}, setFilters, logState = {}, onLoad }) {
  const update = (patch) => setFilters((current) => ({ ...current, ...patch }));
  function logCsv(logs = []) {
    const headers = ["at", "room", "sender", "eventType", "command", "isCommand", "messagePreview", "messageHash", "senderHash"];
    const cell = (value) => {
      const text = String(value ?? "");
      return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    return [headers.join(","), ...logs.map((log) => headers.map((key) => cell(log[key])).join(","))].join("\n");
  }
  function downloadLogs(format) {
    const logs = logState.logs || [];
    const roomName = filters.room || roomOptions[0] || "all-rooms";
    const fileSafeRoom = roomName.replace(/[^\w가-힣-]+/g, "-") || "all-rooms";
    const filename = `pixgom-room-logs-${fileSafeRoom}.${format}`;
    const content = format === "csv"
      ? logCsv(logs)
      : JSON.stringify({ summary: logState.summary || {}, filters, logs }, null, 2);
    const blob = new Blob([content], { type: format === "csv" ? "text/csv;charset=utf-8" : "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <section className="console-detail-section console-log-panel" id="방별 로그">
      <div className="console-section-head">
        <div>
          <p className="console-eyebrow">Room Analytics</p>
          <h3>방별 로그</h3>
        </div>
        <StatusBadge label={`${logState.summary?.matchedLogs || 0}건 표시`} status="ok" />
      </div>
      <div className="console-log-filters" aria-label="방별 로그 필터">
        <label>
          <span>방 선택</span>
          <select value={filters.room || roomOptions[0] || ""} onChange={(event) => update({ room: event.target.value })}>
            {roomOptions.map((roomName) => <option value={roomName} key={roomName}>{roomName}</option>)}
          </select>
        </label>
        <label>
          <span>로그 검색</span>
          <input value={filters.q || ""} onChange={(event) => update({ q: event.target.value })} placeholder="발신자, 메시지, 명령어 검색" />
        </label>
        <label>
          <span>명령어 필터</span>
          <input value={filters.command || ""} onChange={(event) => update({ command: event.target.value })} placeholder="/포인트" />
        </label>
        <label>
          <span>이벤트 타입</span>
          <input value={filters.type || ""} onChange={(event) => update({ type: event.target.value })} placeholder="entered, left 등" />
        </label>
        <label>
          <span>조회 수</span>
          <select value={filters.limit || "100"} onChange={(event) => update({ limit: event.target.value })}>
            <option value="50">50건</option>
            <option value="100">100건</option>
            <option value="300">300건</option>
            <option value="500">500건</option>
          </select>
        </label>
      </div>
      <div className="console-action-row">
        <button type="button" onClick={() => onLoad()} disabled={logState.loading || !roomOptions.length}>
          {logState.loading ? "조회 중" : "로그 조회"}
        </button>
        <button type="button" onClick={() => downloadLogs("csv")} disabled={logState.loading || !logState.logs?.length}>CSV 다운로드</button>
        <button type="button" onClick={() => downloadLogs("json")} disabled={logState.loading || !logState.logs?.length}>JSON 다운로드</button>
      </div>
      <div className="console-field-grid">
        <FieldRow label="보관 방 수">{logState.summary?.rooms || 0}</FieldRow>
        <FieldRow label="전체 로그">{logState.summary?.totalLogs || 0}건</FieldRow>
        <FieldRow label="필터 결과">{logState.summary?.matchedLogs || 0}건</FieldRow>
        <FieldRow label="최근 24시간">{logState.summary?.recent24h || 0}건</FieldRow>
        <FieldRow label="명령어 로그">{logState.summary?.commandLogs || 0}건</FieldRow>
        <FieldRow label="오류 로그">{logState.summary?.errorLogs || 0}건</FieldRow>
        <FieldRow label="현재 방">{filters.room || roomOptions[0] || "-"}</FieldRow>
      </div>
      <div className="console-preview-box">
        <strong>상위 명령어</strong>
        {(logState.summary?.topCommands || []).map((item) => <span key={item.command}>{item.command} · {item.count}건</span>)}
        {!logState.summary?.topCommands?.length ? <span>아직 집계된 명령어가 없습니다.</span> : null}
      </div>
      {logState.error ? <EmptyState title="로그 조회 실패">{logState.error}</EmptyState> : null}
      <div className="console-card-list compact">
        {(logState.logs || []).map((log) => (
          <article className="console-card console-log-card" key={`${log.at}-${log.messageHash}-${log.senderHash}`}>
            <div>
              <strong>{log.command || log.eventType || "채팅"} · {formatDate(log.at)}</strong>
              <span>{log.room || "-"} · {log.sender || "익명"} · 길이 {log.messageLength || 0}</span>
              <small>{log.messagePreview || "메시지 없음"}</small>
            </div>
            <div className="console-log-meta">
              <StatusBadge label={log.isCommand ? "명령어" : "일반"} status={log.isCommand ? "ok" : "neutral"} />
              {log.eventType ? <StatusBadge label={log.eventType} status="open" /> : null}
              <small>msg {log.messageHash || "-"} · sender {log.senderHash || "-"}</small>
            </div>
          </article>
        ))}
        {!logState.loading && !logState.logs?.length ? <EmptyState title="표시할 로그가 없습니다.">방을 선택하고 로그 조회를 눌러 주세요.</EmptyState> : null}
      </div>
    </section>
  );
}

function PanelFilter({ label, value, onChange, options = [] }) {
  return (
    <label className="console-inline-filter">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}
      </select>
    </label>
  );
}

function ListPanel({ items = [], empty }) {
  if (!items.length) return <EmptyState title={empty}>{empty}</EmptyState>;
  return (
    <div className="console-card-list compact">
      {items.slice(0, 8).map((item) => (
        <article className="console-card" key={item.id || item.transferId || item.createdAt}>
          <strong>{item.title || item.reason || item.statusLabel || item.status || item.id}</strong>
          <span>{formatDate(item.createdAt || item.updatedAt || item.resolvedAt)}</span>
        </article>
      ))}
    </div>
  );
}

function DashboardIntro() {
  return (
    <section className="console-dashboard-intro" aria-label="운영자 대시보드 위치 안내">
      <div>
        <p className="console-eyebrow">Dashboard</p>
        <h2>운영자 대시보드</h2>
        <p>/admin 첫 화면입니다. 운영 방, 결제 확인, 문제 방, 종료 보관을 먼저 확인한 뒤 아래에서 방 상세를 관리합니다.</p>
      </div>
    </section>
  );
}

function AdminSettingsPanel({ baseRoom = {}, baseApp = {}, onSaved, onArchive, setToast }) {
  const currentMode = snapshot(baseRoom).settings?.modeSplit || {};
  const [form, setForm] = useState({
    roomName: baseRoom.name || "",
    enabled: baseRoom.enabled !== false,
    registered: baseRoom.registered !== false,
    blockGamesInGeneralRoom: currentMode.blockGamesInGeneralRoom !== false,
    blockOpsInGameRoom: currentMode.blockOpsInGameRoom !== false,
    sharePointsAndInventory: currentMode.sharePointsAndInventory !== false
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const mode = snapshot(baseRoom).settings?.modeSplit || {};
    setForm({
      roomName: baseRoom.name || "",
      enabled: baseRoom.enabled !== false,
      registered: baseRoom.registered !== false,
      blockGamesInGeneralRoom: mode.blockGamesInGeneralRoom !== false,
      blockOpsInGameRoom: mode.blockOpsInGameRoom !== false,
      sharePointsAndInventory: mode.sharePointsAndInventory !== false
    });
  }, [baseRoom.name, baseRoom.enabled, baseRoom.registered, currentMode.updatedAt]);

  async function saveSettings(event) {
    event.preventDefault();
    if (saving || !baseRoom.name) return;
    setSaving(true);
    try {
      await adminRequest("/api/admin/rooms", {
        method: "POST",
        body: {
          originalRoomName: baseRoom.name,
          room: form.roomName || baseRoom.name,
          roomId: baseRoom.roomIds?.[0] || baseApp.roomId || "",
          roomLink: baseRoom.roomLinks?.[0] || baseApp.roomLink || "",
          roomAdmins: baseRoom.admins || [],
          licenseKey: baseRoom.licenseKey || "",
          subscriptionExpiresAt: baseRoom.subscription?.expiresAt || "",
          enabled: form.enabled,
          registered: form.registered,
          modeSplit: {
            blockGamesInGeneralRoom: form.blockGamesInGeneralRoom,
            blockOpsInGameRoom: form.blockOpsInGameRoom,
            sharePointsAndInventory: form.sharePointsAndInventory
          }
        }
      });
      setToast({ tone: "good", message: "방 설정을 저장하고 상태 스냅샷을 갱신했습니다." });
      await onSaved();
    } catch (error) {
      setToast({ tone: "bad", message: formatError(error) });
    } finally {
      setSaving(false);
    }
  }

  const history = snapshot(baseRoom).settings?.history || baseRoom.settingsHistory || [];
  return (
    <form className="console-detail-section console-settings-form" onSubmit={saveSettings}>
      <label>
        <span>방 이름</span>
        <input value={form.roomName} onChange={(event) => setForm({ ...form, roomName: event.target.value })} />
      </label>
      <div className="console-field-grid">
        <FieldRow label="방 역할">{roomRoleLabel(baseRoom)}</FieldRow>
        <FieldRow label="연결 상태">{bridgeLabel(baseRoom)}</FieldRow>
        <FieldRow label="마지막 설정 저장">{formatDate(snapshot(baseRoom).settings?.lastSavedAt)}</FieldRow>
        <FieldRow label="구매자 수정">{snapshot(baseRoom).permissions?.buyerEditable?.join(", ") || "제한형"}</FieldRow>
      </div>
      <div className="console-settings-strip">
        <label><input type="checkbox" checked={form.enabled} onChange={(event) => setForm({ ...form, enabled: event.target.checked })} /> 방 사용</label>
        <label><input type="checkbox" checked={form.registered} onChange={(event) => setForm({ ...form, registered: event.target.checked })} /> 등록 방</label>
        <label><input type="checkbox" checked={form.blockGamesInGeneralRoom} onChange={(event) => setForm({ ...form, blockGamesInGeneralRoom: event.target.checked })} /> 일반방 게임 차단</label>
        <label><input type="checkbox" checked={form.blockOpsInGameRoom} onChange={(event) => setForm({ ...form, blockOpsInGameRoom: event.target.checked })} /> 게임방 운영 차단</label>
        <label><input type="checkbox" checked={form.sharePointsAndInventory} onChange={(event) => setForm({ ...form, sharePointsAndInventory: event.target.checked })} /> 포인트/가방 공유</label>
      </div>
      <div className="console-action-row">
        <button type="submit" disabled={saving}>{saving ? "저장 중" : "설정 저장"}</button>
        <button type="button" className="danger" onClick={onArchive} disabled={saving}>이용 종료 보관</button>
      </div>
      <div className="console-history-list">
        <strong>설정 변경 이력</strong>
        {history.slice(0, 5).map((item) => (
          <span key={`${item.at}-${item.type}`}>{formatDate(item.at)} · {item.by || "system"} · {item.summary || item.type}</span>
        ))}
        {!history.length ? <span>아직 저장 이력이 없습니다.</span> : null}
      </div>
    </form>
  );
}

createRoot(document.getElementById("pixgom-console-root")).render(<AdminApp />);
