import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { buyerLogin, buyerRequest, buyerToken, formatError } from "./api.js";
import { bridgeLabel, buyerSummaries, formatDate, formatKrw, roomRoleLabel, snapshot } from "./domain.js";
import { EmptyState, FieldRow, StatusBadge, SummaryGrid, ToastHost } from "./ui.jsx";

function consoleViewFromLocation() {
  const params = new URLSearchParams(window.location.search || "");
  const explicit = params.get("view") || document.body?.dataset?.consoleView || "";
  if (["setup", "rooms", "license", "requests"].includes(explicit)) return explicit;
  if (window.location.pathname === "/setup" || window.location.pathname === "/buyer-guide") return "setup";
  if (window.location.pathname === "/my-rooms") return "rooms";
  if (window.location.pathname === "/license") return "license";
  return "overview";
}

async function copyTextToClipboard(value = "") {
  const text = String(value || "");
  if (!text) return false;
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "readonly");
  textarea.style.position = "fixed";
  textarea.style.top = "-1000px";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(textarea);
  return copied;
}

function BuyerSearchPanel({ onToast, onOpenResult }) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (!query.trim()) return;
    const token = buyerToken();
    const params = new URLSearchParams({ q: query.trim() });
    if (token) params.set("token", token);
    setLoading(true);
    try {
      const response = await fetch(`/api/buyer/search?${params.toString()}`, { cache: "no-store" });
      const json = await response.json();
      if (!response.ok || json.ok === false) throw new Error(json.error || "buyer_search_failed");
      setResult(json);
    } catch (error) {
      onToast?.({ tone: "bad", message: formatError(error) });
    } finally {
      setLoading(false);
    }
  }

  const sections = result?.sections || {};
  const resultCounts = result ? [
    ["방", sections.rooms?.length || 0],
    ["결제", sections.payments?.length || 0],
    ["앱 연결", sections.appConnection?.length || 0],
    ["명령어", sections.commands?.length || 0],
    ["게임/가방", sections.games?.length || 0],
    ["별명", sections.aliases?.length || 0]
  ] : [];
  return (
    <section className="console-search-panel" aria-labelledby="buyer-search-title">
      <form className="console-search-form" onSubmit={submit}>
        <div>
          <p className="console-eyebrow">내 콘솔 검색</p>
          <h2 id="buyer-search-title">방, 결제, 앱 연결, 명령어, 게임/가방, 별명 검색</h2>
          <p>동명이인 가능성 있음, 관리자 확인 필요 상태는 자동 병합하지 않습니다.</p>
        </div>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="방명, 명령어, 별명, 앱 연결 상태 검색" aria-label="구매자 콘솔 통합 검색어" />
        <button type="submit" disabled={loading}>{loading ? "검색 중" : "검색"}</button>
      </form>
      {result ? (
        <>
        <p className="console-search-status" role="status" aria-live="polite">
          검색 결과 요약: {resultCounts.map(([label, count]) => `${label} ${count}개`).join(" · ")}
        </p>
        <div className="console-search-results" aria-label="구매자 콘솔 검색 결과">
          <BuyerSearchSection title="방" items={sections.rooms || []} render={(item) => `${item.roomName} · ${item.subscriptionStatusLabel || ""} · ${item.bridgeStatus}`} actionLabel="내 방 열기" onOpen={(item) => onOpenResult?.({ view: "rooms", target: "rooms", label: item.roomName || "내 방" })} />
          <BuyerSearchSection title="결제" items={sections.payments || []} render={(item) => `${item.roomName} · ${item.statusLabel} · ${item.paymentStatusLabel}`} actionLabel="라이선스 열기" onOpen={(item) => onOpenResult?.({ view: "license", target: "dashboard", label: item.roomName || "결제" })} />
          <BuyerSearchSection title="앱 연결" items={sections.appConnection || []} render={(item) => `${item.roomName} · ${item.appConnectCodeStatus}`} actionLabel="코드 보기" onOpen={(item) => onOpenResult?.({ view: "setup", target: "app-connect-code", label: item.roomName || "앱 연결 코드" })} />
          <BuyerSearchSection title="명령어" items={sections.commands || []} render={(item) => `${item.command} · ${item.description}`} actionLabel="스토어 열기" onOpen={() => onOpenResult?.({ href: "/command-store", label: "명령어 스토어" })} />
          <BuyerSearchSection title="게임/가방" items={sections.games || []} render={(item) => `${item.title} · ${item.installCode}`} actionLabel="팩 보기" onOpen={() => onOpenResult?.({ href: "/command-store", label: "명령어팩" })} />
          <BuyerSearchSection title="별명" items={sections.aliases || []} render={(item) => `${item.displayName} · ${item.conflictNotice || item.identitySummary}`} actionLabel="내 방 열기" onOpen={(item) => onOpenResult?.({ view: "rooms", target: "rooms", label: item.displayName || "별명" })} />
        </div>
        </>
      ) : null}
    </section>
  );
}

function BuyerSearchSection({ title, items = [], render, actionLabel = "열기", onOpen }) {
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

function BuyerGameUsageSummary({ summary = {} }) {
  return (
    <section className="console-game-overview">
      <div>
        <p className="console-eyebrow">Game Summary</p>
        <h3>내 게임 이용 요약</h3>
        <p>{summary.enabled === false ? "게임 기능 꺼짐" : "사용 가능 콘텐츠를 확인하세요."}</p>
      </div>
      <div className="console-compact-list">
        <span>사용 가능 콘텐츠: {(summary.availableContent || []).join(", ") || "기본 명령어"}</span>
        <span>다음 할 일: {(summary.nextActions || []).join(" · ")}</span>
        <span>가방 정리 추천: {summary.cleanupRecommendation || "정리할 아이템이 없습니다."}</span>
        <span>앱 연결 상태: {summary.appConnectionHint || "설치 안내 탭에서 확인"}</span>
      </div>
    </section>
  );
}

function BuyerApp() {
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState(consoleViewFromLocation);
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

  async function copyAppConnectCode(room) {
    try {
      const copied = await copyTextToClipboard(room?.bridgeConnectCode || "");
      setToast({
        tone: copied ? "good" : "bad",
        message: copied ? `${room?.roomName || "방"} 앱 연결 코드를 복사했습니다.` : "복사에 실패했습니다. 코드를 길게 눌러 직접 복사해 주세요."
      });
    } catch (error) {
      setToast({ tone: "bad", message: "복사에 실패했습니다. 코드를 길게 눌러 직접 복사해 주세요." });
    }
  }

  function handleBuyerSearchOpen({ view = "overview", target = "", href = "", label = "결과" } = {}) {
    if (href) {
      window.location.href = href;
      return;
    }
    setActiveView(view);
    setToast({ tone: "good", message: `${label} 위치로 이동합니다.` });
    window.setTimeout(() => {
      const selector = target ? `#${target}` : "#dashboard";
      document.querySelector(selector)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  const groups = useMemo(() => payload?.roomGroups || [], [payload]);
  const appConnectCodeRooms = useMemo(() => (
    payload?.appConnectCodes?.length ? payload.appConnectCodes : payload?.rooms || []
  ), [payload?.appConnectCodes, payload?.rooms]);
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
          <div className="console-action-row">
            <a className="console-secondary-link" href="/">홈으로</a>
          </div>
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
          <p>대시보드에서 방 상태, 결제/라이선스, 앱 연결 상태, 게임방 분리 설정과 문의 흐름을 한곳에서 확인합니다.</p>
        </div>
        <div className="console-hero-actions">
          <a className="console-secondary-link" href="/">홈으로</a>
          <button type="button" onClick={() => load()}>새로고침</button>
        </div>
      </header>
      <BuyerConsoleTabs activeView={activeView} onChange={setActiveView} />
      {payload ? <BuyerStepOverview payload={payload} onRefresh={() => load()} /> : null}
      {payload ? <SummaryGrid id="dashboard" label="구매자 대시보드 요약" items={buyerSummaries(payload)} /> : null}
      {payload ? <BuyerAppConnectionCheckCard rooms={appConnectCodeRooms} onRefresh={() => load()} /> : null}
      {payload ? <BuyerSearchPanel onToast={setToast} onOpenResult={handleBuyerSearchOpen} /> : null}
      {payload ? <AppConnectCodePanel rooms={appConnectCodeRooms} applications={payload.applications || []} onCopy={copyAppConnectCode} /> : null}
      {payload ? <BuyerGuidePanel payload={payload} activeView={activeView} /> : null}
      <section className="buyer-room-grid" id="rooms">
        {(groups.length ? groups : payload?.rooms?.map((room) => ({ baseRoom: room, gameRooms: [], roomModeSettings: null })) || []).map((group) => (
          <RoomGroupCard key={group.baseRoom?.applicationId || group.baseRoom?.roomName || group.baseApplication?.id} group={group} onReload={load} setToast={setToast} />
        ))}
        {!loading && payload && !payload.rooms?.length && <EmptyState title="이용 중인 방이 없습니다.">신청/결제가 완료되면 이곳에 방 상태가 표시됩니다.</EmptyState>}
      </section>
      <section className="buyer-actions-panel" id="requests">
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

function BuyerStepOverview({ payload = {}, onRefresh }) {
  const applications = payload.applications || [];
  const rooms = payload.rooms || [];
  const appConnectCodes = payload.appConnectCodes || [];
  const pendingCount = applications.filter((application) => (
    application.paymentReviewNeeded || application.appConnectCodeStatus === "pending_approval"
  )).length;
  const approvedCount = appConnectCodes.length;
  const connectedCount = rooms.filter((room) => room.bridgeStatus === "ready" || snapshot(room).bridge?.status === "ready").length;
  const syncWaitingCount = Math.max(approvedCount - connectedCount, 0);
  const steps = [
    {
      title: "승인 전",
      value: pendingCount ? `${pendingCount}건 대기` : "대기 없음",
      text: "입금 확인 요청",
      tone: pendingCount ? "warn" : "good",
      action: <a href="#requests">문의 등록</a>
    },
    {
      title: "승인 후",
      value: approvedCount ? `${approvedCount}개 코드` : "코드 대기",
      text: "앱 연결 코드 복사",
      tone: approvedCount ? "good" : "warn",
      action: <a href="#app-connect-code">코드 보기</a>
    },
    {
      title: "앱 동기화",
      value: syncWaitingCount ? `${syncWaitingCount}개 남음` : "완료",
      text: "앱에서 붙여넣기",
      tone: syncWaitingCount ? "warn" : "good",
      action: <a href="/console?from=android&view=setup#app-connect-code">붙여넣기</a>
    },
    {
      title: "방 상태",
      value: rooms.length ? `${connectedCount}/${rooms.length} 준비` : "방 없음",
      text: "앱 연결 완료 확인",
      tone: rooms.length && connectedCount === rooms.length ? "good" : "neutral",
      action: <button type="button" onClick={onRefresh}>새로고침</button>
    }
  ];
  return (
    <section className="buyer-step-overview" data-buyer-step-overview="true" aria-label="구매자 진행 단계">
      {steps.map((step) => (
        <article className={`buyer-step-card buyer-step-${step.tone}`} key={step.title}>
          <span>{step.title}</span>
          <strong>{step.value}</strong>
          <p>{step.text}</p>
          <div className="buyer-step-action">{step.action}</div>
        </article>
      ))}
    </section>
  );
}

function BuyerAppConnectionCheckCard({ rooms = [], onRefresh }) {
  const issuedRooms = rooms.filter((room) => room.bridgeConnectCode);
  const readyRooms = rooms.filter((room) => room.bridgeStatus === "ready" || snapshot(room).bridge?.status === "ready");
  const gameRooms = rooms.filter((room) => room.roomRole === "game" || snapshot(room).role === "game");
  return (
    <section className="buyer-app-check-card" aria-label="앱 연결 상태 확인">
      <div>
        <p className="console-eyebrow">App QA</p>
        <h2>앱 연결 상태 확인</h2>
        <p>실제 방 QA는 /브릿지, /상태, /주사위 후 앱 로그만 확인합니다.</p>
      </div>
      <div className="console-compact-list">
        <span>연결코드 발급: {issuedRooms.length}개</span>
        <span>앱 연결 준비: {readyRooms.length}개</span>
        <span>게임방 연결: {gameRooms.length}개</span>
        <span>확인 위치: 성공/응답 로그, 실패/재시도 로그, 무시 로그</span>
      </div>
      <div className="console-action-row">
        <a href="/console?from=android&view=setup#app-connect-code">연결코드 보기</a>
        <button type="button" onClick={onRefresh}>상태 새로고침</button>
      </div>
    </section>
  );
}

function AppConnectCodePanel({ rooms = [], applications = [], onCopy }) {
  const connectRooms = rooms.filter((room) => room.bridgeConnectCode);
  const pendingApplications = applications.filter((application) => application.appConnectCodeStatus && application.appConnectCodeStatus !== "ready");
  return (
    <section className="buyer-connect-code-panel" id="app-connect-code" data-app-connect-code="true">
      <div className="console-section-head">
        <div>
          <p className="console-eyebrow">App Connect Code</p>
          <h2>앱 연결 코드</h2>
          <p>코드를 복사해 Android 앱에 붙여넣으면 방 설정이 동기화됩니다.</p>
        </div>
        <StatusBadge label={`${connectRooms.length}개 발급`} status={connectRooms.length ? "ready" : "needs_setup"} />
      </div>
      <div className="buyer-connect-code-list">
        {connectRooms.map((room) => (
          <article className="buyer-connect-code-card" key={room.applicationId || room.roomName}>
            <div className="buyer-connect-code-meta">
              <span>{roomRoleLabel(room)}</span>
              <strong>{room.roomName || "방명 미지정"}</strong>
              <small>{room.roomRole === "game" ? "게임방만 다시 등록할 때 사용합니다." : "일반방 코드를 먼저 입력하면 연결된 게임방까지 함께 등록됩니다."}</small>
            </div>
            <code>{room.bridgeConnectCode}</code>
            <div className="console-action-row">
              <button type="button" onClick={() => onCopy?.(room)}>연결 코드 복사</button>
              <a href="/console?from=android&view=setup#app-connect-code">앱에서 붙여넣기 안내</a>
            </div>
          </article>
        ))}
        {!connectRooms.length ? (
          <EmptyState title="아직 복사할 앱 연결 코드가 없습니다.">서비스 신청과 입금승인이 완료되면 승인된 방별 코드가 여기에 표시됩니다.</EmptyState>
        ) : null}
        {pendingApplications.length ? (
          <div className="buyer-connect-code-pending">
            <strong>발급 대기 신청</strong>
            {pendingApplications.map((application) => (
              <span key={application.id}>{application.roomName || "방명 미지정"} · {application.appConnectCodeStatusLabel || "입금승인 후 발급"}</span>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function BuyerConsoleTabs({ activeView, onChange }) {
  const tabs = [
    ["overview", "대시보드"],
    ["setup", "설치 안내"],
    ["rooms", "내 방"],
    ["license", "라이선스"],
    ["requests", "문의/복구"]
  ];
  return (
    <nav className="buyer-console-tabs" aria-label="구매자 콘솔 보기">
      {tabs.map(([value, label]) => (
        <button key={value} type="button" className={activeView === value ? "is-active" : ""} aria-current={activeView === value ? "page" : undefined} onClick={() => onChange(value)}>
          {label}
        </button>
      ))}
    </nav>
  );
}

function DashboardIntro({ type }) {
  const isBuyer = type === "buyer";
  return (
    <section className="console-dashboard-intro" aria-label={isBuyer ? "구매자 대시보드 위치 안내" : "운영자 대시보드 위치 안내"}>
      <div>
        <p className="console-eyebrow">Dashboard</p>
        <h2>{isBuyer ? "구매자 대시보드" : "운영자 대시보드"}</h2>
        <p>{isBuyer ? "/console 첫 화면입니다. 상단 대시보드 탭에서 결제, 앱 연결, 내 방 상태를 바로 확인합니다." : "/admin 첫 화면입니다. 운영 방, 결제 확인, 문제 방, 종료 보관을 먼저 확인합니다."}</p>
      </div>
    </section>
  );
}

function BuyerGuidePanel({ payload = {}, activeView }) {
  const guideUrls = payload.guideUrls || {};
  const roomCount = payload.rooms?.length || 0;
  const readyRooms = (payload.rooms || []).filter((room) => room.bridgeStatus === "ready").length;
  const guideSections = payload.guideSections || [];
  return (
    <section className={`buyer-guide-react-panel view-${activeView}`}>
      <article className="console-compact-section">
        <div>
          <p className="console-eyebrow">앱 연결 상태</p>
          <h2>{activeView === "setup" ? "설치 안내와 서버 동기화" : "앱과 콘솔 상태를 같은 기준으로 확인"}</h2>
          <p>앱은 서버와 상시 push 연결이 아니라 연결코드 입력, 앱 실행/복귀, 수동 새로고침 시 최신 방 상태를 다시 맞추는 방식으로 동기화합니다.</p>
        </div>
        <div className="console-status-list">
          <strong>요약</strong>
          <span>승인 방 {roomCount}개 · 앱 연결 준비 {readyRooms}개</span>
          <span>설치 안내: {guideUrls.setup || "/console?view=setup"}</span>
          <span>Android 앱 진입: {guideUrls.android || "/console?from=android&view=setup"}</span>
        </div>
        <div className="console-action-row">
          <a href="/console?view=setup">설치 안내 열기</a>
          <a href="/console?view=rooms">내 방 상태</a>
          <button type="button" onClick={() => window.location.reload()}>서버와 다시 동기화</button>
        </div>
      </article>
      {(activeView === "setup" || activeView === "overview") ? (
        <div className="buyer-guide-grid">
          {guideSections.map((section) => (
            <article className="buyer-guide-section" key={section.title}>
              <h3>{section.title}</h3>
              <ol>{(section.items || []).map((item) => <li key={item}>{item}</li>)}</ol>
            </article>
          ))}
          <article className="buyer-guide-section">
            <h3>처음 해야 할 순서</h3>
            <ol>
              <li>서비스 신청과 입금승인 상태를 확인합니다.</li>
              <li>앱에서 구매자 콘솔 버튼을 눌러 설치 안내를 엽니다.</li>
              <li>일반방 연결코드를 입력하고 게임방이 함께 등록되는지 확인합니다.</li>
              <li>각 방에서 /브릿지, /상태, /js상태를 확인합니다.</li>
            </ol>
          </article>
        </div>
      ) : null}
    </section>
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
  const aliasSummary = room.aliasSummary || {};
  const aliasCount = Math.max(0, Number(aliasSummary.aliasCount || 0)).toLocaleString("ko-KR");
  const aliasProfiles = Math.max(0, Number(aliasSummary.totalProfiles || 0)).toLocaleString("ko-KR");
  const aliasMerges = Math.max(0, Number(aliasSummary.mergedAliasCount || 0)).toLocaleString("ko-KR");
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
      <BuyerGameUsageSummary summary={room.gameUsageSummary || {}} />
      <div className="console-alias-summary" data-alias-summary="buyer">
        <div className="console-section-head compact">
          <div>
            <p className="console-eyebrow">Alias Summary</p>
            <h3>별명 요약</h3>
            <p>일반방과 게임방에서 다른 닉을 쓰는 참여자를 같은 사람 데이터로 연결해 관리합니다.</p>
          </div>
          <span>{aliasCount}개 별명</span>
        </div>
        <div className="console-field-grid console-compact-stats">
          <FieldRow label="참여자">{aliasProfiles}명</FieldRow>
          <FieldRow label="별명">{aliasCount}개</FieldRow>
          <FieldRow label="병합">{aliasMerges}건</FieldRow>
        </div>
        <p className="console-settings-note">내 별명은 카톡에서 /내별명, 운영자는 /별명목록으로 확인할 수 있습니다.</p>
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
