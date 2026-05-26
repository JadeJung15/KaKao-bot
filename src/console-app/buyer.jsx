import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { buyerLogin, buyerRequest, buyerToken, formatError } from "./api.js";
import { bridgeLabel, buyerSummaries, formatDate, formatKrw, roomRoleLabel, snapshot } from "./domain.js";
import { EmptyState, FieldRow, StatusBadge, SummaryGrid, ToastHost } from "./ui.jsx";

function BuyerApp() {
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [login, setLogin] = useState({ email: "", password: "" });
  const [toast, setToast] = useState(null);
  const [inquiryForm, setInquiryForm] = useState({ applicationId: "", type: "payment_check", message: "" });
  const [sendingInquiry, setSendingInquiry] = useState(false);

  async function load(extra = {}) {
    setLoading(true);
    try {
      const json = await buyerRequest("/api/buyer/console", extra);
      setPayload(json);
    } catch (error) {
      setToast({ tone: "bad", message: formatError(error) });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (buyerToken() || window.PixelgomAuth?.hasStoredSessionHint?.()) load();
    else setLoading(false);
  }, []);

  async function submitLogin(event) {
    event.preventDefault();
    try {
      await buyerLogin(login.email, login.password);
      await load();
      setToast({ tone: "good", message: "로그인되었습니다." });
    } catch (error) {
      setToast({ tone: "bad", message: formatError(error) });
    }
  }

  async function requestRestore(archive) {
    try {
      const result = await buyerRequest("/api/buyer/restore-requests", { archiveId: archive.id, reason: "구매자 콘솔 복구 요청" });
      await load();
      setToast({ tone: "good", message: result.duplicate ? "이미 접수된 복구 요청이 있습니다." : "복구 요청이 접수되었습니다." });
    } catch (error) {
      setToast({ tone: "bad", message: formatError(error) });
    }
  }

  async function submitInquiry(event) {
    event.preventDefault();
    const applicationId = inquiryForm.applicationId || payload?.applications?.[0]?.id || payload?.rooms?.[0]?.applicationId || "";
    if (!applicationId || !inquiryForm.message.trim() || sendingInquiry) return;
    setSendingInquiry(true);
    try {
      await buyerRequest("/api/application-inquiries", {
        applicationId,
        type: inquiryForm.type,
        message: inquiryForm.message.trim()
      });
      setInquiryForm({ applicationId, type: inquiryForm.type, message: "" });
      await load();
      setToast({ tone: "good", message: "문의가 접수되었습니다." });
    } catch (error) {
      setToast({ tone: "bad", message: formatError(error) });
    } finally {
      setSendingInquiry(false);
    }
  }

  const groups = useMemo(() => payload?.roomGroups || [], [payload]);
  const restoreRequestsByArchive = useMemo(() => {
    const entries = (payload?.restoreRequests || []).map((request) => [request.archiveId, request]);
    return new Map(entries);
  }, [payload?.restoreRequests]);

  if (!payload && !loading) {
    return (
      <main className="console-app-shell buyer-react-console">
        <section className="console-login-panel">
          <h1>구매자 셀프 관리 콘솔</h1>
          <p>내 방 상태, 결제/라이선스, 게임방 연결, 문의와 복구 요청을 확인하려면 로그인해 주세요.</p>
          <form onSubmit={submitLogin} className="console-login-form">
            <label>이메일<input value={login.email} onChange={(event) => setLogin({ ...login, email: event.target.value })} autoComplete="email" /></label>
            <label>비밀번호<input value={login.password} onChange={(event) => setLogin({ ...login, password: event.target.value })} type="password" autoComplete="current-password" /></label>
            <button type="submit">로그인</button>
          </form>
        </section>
        <ToastHost message={toast?.message} tone={toast?.tone} onClose={() => setToast(null)} />
      </main>
    );
  }

  return (
    <main className="console-app-shell buyer-react-console">
      <header className="console-hero">
        <div>
          <p className="console-eyebrow">Pixgom Console</p>
          <h1>구매자 셀프 관리 콘솔</h1>
          <p>방 상태, 결제/라이선스, 앱 연결 상태, 게임방 분리 설정과 문의 흐름을 한곳에서 확인합니다.</p>
        </div>
        <button type="button" onClick={() => load()}>새로고침</button>
      </header>
      {payload ? <SummaryGrid items={buyerSummaries(payload)} /> : null}
      <section className="buyer-room-grid">
        {(groups.length ? groups : payload?.rooms?.map((room) => ({ baseRoom: room, gameRooms: [], roomModeSettings: null })) || []).map((group) => (
          <RoomGroupCard key={group.baseRoom?.applicationId || group.baseRoom?.roomName || group.baseApplication?.id} group={group} onReload={load} setToast={setToast} />
        ))}
        {!loading && payload && !payload.rooms?.length && <EmptyState title="이용 중인 방이 없습니다.">신청/결제가 완료되면 이곳에 방 상태가 표시됩니다.</EmptyState>}
      </section>
      <section className="buyer-actions-panel">
        <article>
          <h2>문의 / 이관 / 복구 요청</h2>
          <p>구매자가 직접 수정 가능한 항목은 게임방 분리 설정, 명령어팩, 문의, 이관, 복구 요청으로 제한됩니다.</p>
          <div className="console-action-row">
            <a href="/apply">서비스 신청</a>
            <a href="/command-store">명령어팩 관리</a>
            <a href="/account">정보수정</a>
          </div>
          <form className="console-mini-form" onSubmit={submitInquiry}>
            <label>
              <span>문의 대상</span>
              <select value={inquiryForm.applicationId || payload?.applications?.[0]?.id || ""} onChange={(event) => setInquiryForm({ ...inquiryForm, applicationId: event.target.value })}>
                {(payload?.applications || []).map((application) => <option key={application.id} value={application.id}>{application.roomName} · {application.statusLabel}</option>)}
              </select>
            </label>
            <label>
              <span>문의 종류</span>
              <select value={inquiryForm.type} onChange={(event) => setInquiryForm({ ...inquiryForm, type: event.target.value })}>
                <option value="payment_check">결제 확인 요청</option>
                <option value="deposit_check">입금 확인 요청</option>
                <option value="other">기타 문의</option>
              </select>
            </label>
            <label>
              <span>문의 내용</span>
              <textarea value={inquiryForm.message} onChange={(event) => setInquiryForm({ ...inquiryForm, message: event.target.value })} placeholder="입금/설치/오류 확인 요청 내용을 입력하세요." />
            </label>
            <button type="submit" disabled={sendingInquiry || !inquiryForm.message.trim()}>{sendingInquiry ? "접수 중" : "문의 등록"}</button>
          </form>
          <StatusList title="문의 처리 상태" items={payload?.inquiries || []} empty="접수된 문의가 없습니다." />
          <StatusList title="내 신고 상태" items={payload?.reports || []} empty="본인 방과 관련된 신고가 없습니다." />
          <StatusList title="이관 요청 상태" items={payload?.transfers || []} empty="진행 중인 이관 내역이 없습니다." />
        </article>
        <article>
          <h2>이용 종료된 방</h2>
          {(payload?.archivedRooms || []).map((archive) => (
            <div className="console-linked-room" key={archive.id}>
              <div>
                <strong>{archive.roomName}</strong>
                <span>{formatDate(archive.archivedAt)}</span>
                {restoreRequestsByArchive.get(archive.id) ? <small>복구 요청 상태: {restoreRequestsByArchive.get(archive.id).statusLabel}</small> : null}
              </div>
              <button type="button" onClick={() => requestRestore(archive)} disabled={restoreRequestsByArchive.get(archive.id)?.status !== undefined && restoreRequestsByArchive.get(archive.id)?.status !== "resolved"}>
                {restoreRequestsByArchive.get(archive.id)?.status && restoreRequestsByArchive.get(archive.id)?.status !== "resolved" ? "요청 접수됨" : "복구 요청"}
              </button>
            </div>
          ))}
          {!payload?.archivedRooms?.length ? <p>보관된 방이 없습니다.</p> : null}
          {(payload?.restoreRequests || []).length ? (
            <div className="console-restore-status-list">
              <strong>복구 요청 상태</strong>
              {payload.restoreRequests.map((request) => (
                <span key={request.id}>{request.roomName} · {request.statusLabel} · {formatDate(request.updatedAt || request.createdAt)}</span>
              ))}
            </div>
          ) : null}
        </article>
      </section>
      <ToastHost message={toast?.message} tone={toast?.tone} onClose={() => setToast(null)} />
    </main>
  );
}

function StatusList({ title, items = [], empty }) {
  const visible = items.slice(0, 5);
  return (
    <div className="console-status-list">
      <strong>{title}</strong>
      {visible.map((item) => (
        <span key={item.id || item.applicationId || item.createdAt}>
          {item.roomName || item.target || item.counterpart?.email || "항목"} · {item.statusLabel || item.status || item.typeLabel || "상태 확인"} · {formatDate(item.updatedAt || item.createdAt || item.acceptedAt)}
        </span>
      ))}
      {!visible.length ? <span>{empty}</span> : null}
    </div>
  );
}

function RoomGroupCard({ group = {}, onReload, setToast }) {
  const room = group.baseRoom || {};
  const mode = group.roomModeSettings || {};
  const snapshotMode = snapshot(room).settings?.modeSplit || {};
  const hasGameRooms = Boolean((group.gameRooms || room.linkedGameRooms || []).length);
  const [form, setForm] = useState({
    blockGamesInGeneralRoom: mode.blockGamesInGeneralRoom ?? mode.generalRoomGameBlocked ?? snapshotMode.blockGamesInGeneralRoom ?? true,
    blockOpsInGameRoom: mode.blockOpsInGameRoom ?? mode.gameRoomOpsBlocked ?? snapshotMode.blockOpsInGameRoom ?? true,
    sharePointsAndInventory: mode.sharePointsAndInventory ?? mode.sharedData ?? snapshotMode.sharePointsAndInventory ?? true
  });
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setForm({
      blockGamesInGeneralRoom: mode.blockGamesInGeneralRoom ?? mode.generalRoomGameBlocked ?? snapshotMode.blockGamesInGeneralRoom ?? true,
      blockOpsInGameRoom: mode.blockOpsInGameRoom ?? mode.gameRoomOpsBlocked ?? snapshotMode.blockOpsInGameRoom ?? true,
      sharePointsAndInventory: mode.sharePointsAndInventory ?? mode.sharedData ?? snapshotMode.sharePointsAndInventory ?? true
    });
  }, [room.applicationId, mode.updatedAt, snapshotMode.updatedAt]);

  async function saveDefaultSplit() {
    if (saving || !hasGameRooms) return;
    setSaving(true);
    try {
      await buyerRequest("/api/buyer/room-mode-settings", {
        applicationId: room.applicationId || group.baseApplication?.id,
        blockGamesInGeneralRoom: form.blockGamesInGeneralRoom,
        blockOpsInGameRoom: form.blockOpsInGameRoom,
        sharePointsAndInventory: form.sharePointsAndInventory
      });
      await onReload();
      setToast({ tone: "good", message: "일반방/게임방 분리 설정을 저장했습니다." });
    } catch (error) {
      setToast({ tone: "bad", message: formatError(error) });
    } finally {
      setSaving(false);
    }
  }
  return (
    <article className="buyer-room-card">
      <div className="buyer-room-card-head">
        <div>
          <p className="console-eyebrow">내 방 상태</p>
          <h2>{room.roomName || group.baseApplication?.roomName || "방명 미지정"}</h2>
        </div>
        <StatusBadge label={snapshot(room).lifecycle?.label || room.subscriptionStatusLabel} status={snapshot(room).lifecycle?.status} tone={snapshot(room).lifecycle?.tone} />
      </div>
      <div className="console-field-grid">
        <FieldRow label="역할">{roomRoleLabel(room)}</FieldRow>
        <FieldRow label="브릿지">{bridgeLabel(room)}</FieldRow>
        <FieldRow label="결제/라이선스">{snapshot(room).lifecycle?.paymentStatusLabel || room.licenseStatus || "확인 필요"}</FieldRow>
        <FieldRow label="다음 할 일">{snapshot(room).lifecycle?.actionRequired || "상태 확인"}</FieldRow>
        <FieldRow label="만료일">{formatDate(room.subscription?.expiresAt)}</FieldRow>
        <FieldRow label="월 이용료">{formatKrw(room.monthlyPriceKrw)}</FieldRow>
        <FieldRow label="연결코드">{room.bridgeConnectCode ? "발급됨" : "승인 후 표시"}</FieldRow>
      </div>
      <details className="console-game-rooms" open>
        <summary>게임방 접기/펼치기</summary>
        {(group.gameRooms || room.linkedGameRooms || []).map((gameRoom) => (
          <div className="console-linked-room" key={gameRoom.roomName || gameRoom.applicationId}>
            <strong>{gameRoom.roomName}</strong>
            <span>{gameRoom.roomStatusSnapshot?.lifecycle?.label || gameRoom.paymentStatusLabel || gameRoom.bridgeStatus || "상태 확인"}</span>
          </div>
        ))}
        {!(group.gameRooms || room.linkedGameRooms || []).length ? <p>연결된 게임방이 없습니다.</p> : null}
      </details>
      <div className="console-settings-strip">
        <label><input type="checkbox" checked={form.blockGamesInGeneralRoom} onChange={(event) => setForm({ ...form, blockGamesInGeneralRoom: event.target.checked })} disabled={!hasGameRooms || saving} /> 일반방 게임 차단</label>
        <label><input type="checkbox" checked={form.blockOpsInGameRoom} onChange={(event) => setForm({ ...form, blockOpsInGameRoom: event.target.checked })} disabled={!hasGameRooms || saving} /> 게임방 운영 차단</label>
        <label><input type="checkbox" checked={form.sharePointsAndInventory} onChange={(event) => setForm({ ...form, sharePointsAndInventory: event.target.checked })} disabled={!hasGameRooms || saving} /> 포인트/가방 공유</label>
        <button type="button" onClick={saveDefaultSplit} disabled={!hasGameRooms || saving}>{saving ? "저장 중" : "분리 설정 저장"}</button>
      </div>
      <p className="console-settings-note">마지막 설정 저장: {formatDate(snapshot(room).settings?.lastSavedAt || mode.lastSavedAt)}</p>
    </article>
  );
}

createRoot(document.getElementById("pixgom-console-root")).render(<BuyerApp />);
