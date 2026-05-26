import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { adminRequest, formatError, ownerToken } from "./api.js";
import { bridgeLabel, formatDate, formatKrw, roomRoleLabel, roomRowFromGroup, roomSummaries, snapshot } from "./domain.js";
import { DetailTabs, EmptyState, FieldRow, StatusBadge, SummaryGrid, ToastHost, Toolbar } from "./ui.jsx";

const DETAIL_TABS = [
  { id: "settings", label: "설정" },
  { id: "billing", label: "신청/결제" },
  { id: "commands", label: "명령어" },
  { id: "reports", label: "신고" },
  { id: "transfers", label: "이관" },
  { id: "inquiries", label: "문의" },
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

function AdminApp() {
  const [state, setState] = useState({ loading: true, rooms: [], roomGroups: [], applications: [], reports: [], transfers: [], inquiries: [], archivedRooms: [], restoreRequests: [] });
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [selectedId, setSelectedId] = useState("");
  const [tab, setTab] = useState("settings");
  const [toast, setToast] = useState(null);
  const [purgeForms, setPurgeForms] = useState({});
  const [actionForms, setActionForms] = useState({});

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

  if (!ownerToken() && state.error) {
    return (
      <main className="console-app-shell">
        <section className="console-login-panel">
          <h1>일반방 중심 통합 운영 콘솔</h1>
          <p>운영자 로그인이 필요합니다. 로그인 후 다시 접속해 주세요.</p>
          <a className="console-primary-link" href="/login">로그인</a>
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
          <p>신청, 결제, 설정, 신고, 이관, 문의, 백업/복구를 방 단위로 한 화면에서 관리합니다.</p>
        </div>
        <button type="button" onClick={load}>새로고침</button>
      </header>
      <SummaryGrid items={roomSummaries(state.rooms, state.archivedRooms)} />
      <section className="console-layout">
        <aside className="console-sidebar" aria-label="운영 메뉴">
          {["운영현황", "일반방", "신청/결제", "신고", "이관", "문의", "종료 보관", "백업/복구"].map((item) => <a href={`#${item}`} key={item}>{item}</a>)}
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
                <section className="console-detail-section">
                  <FieldRow label="설치 명령어">{baseRoom.commandCount || 0}개</FieldRow>
                  <FieldRow label="장착 팩">{(baseRoom.commandPacks?.installedPacks || []).length || 0}개</FieldRow>
                </section>
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
              {tab === "backup" && (
                <BackupPanel baseRoom={baseRoom} setToast={setToast} />
              )}
              {tab === "history" && (
                <section className="console-detail-section">
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
