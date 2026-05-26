(() => {
  const form = document.querySelector("[data-console-login]");
  const statusBox = document.querySelector("[data-console-status]");
  const content = document.querySelector("[data-console-content]");
  const gate = document.querySelector("[data-console-gate]");
  const kakaoButton = document.querySelector("[data-kakao-login]");
  const signOutButton = document.querySelector("[data-sign-out]");
  const initialView = document.body.dataset.consoleView || "overview";
  const authGate = window.PixelgomAuth?.createSilentGate({
    root: gate,
    status: statusBox,
    checkingClass: "is-auth-checking"
  });
  const BASIC_PACK_INSTALL_COMMAND = "/명령어설치 pk.001";

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatKrw(value) {
    return `${Number(value || 0).toLocaleString("ko-KR")}원`;
  }

  function roomStatus(room) {
    if (room.subscriptionStatusLabel) return room.subscriptionStatusLabel;
    const remaining = Number(room.subscription?.remainingDays);
    if (!Number.isFinite(remaining)) return "구독 상태 확인 필요";
    if (remaining < 0) return "구독 만료";
    if (remaining <= 7) return `만료 임박 ${remaining}일`;
    return `정상 ${remaining}일 남음`;
  }

  function statusText(ok, waitingText, doneText) {
    return ok ? doneText : waitingText;
  }

  function onboardingSteps(data) {
    const applications = data.applications || [];
    const rooms = data.rooms || [];
    const approved = rooms.length > 0;
    const hasApplication = applications.length > 0;
    const hasConnectCode = rooms.some((room) => room.bridgeConnectCode);
    return [
      {
        title: "계정 만들기",
        ok: true,
        detail: data.account?.email || data.account?.nickname || "로그인 완료"
      },
      {
        title: "서비스 신청",
        ok: hasApplication,
        detail: statusText(hasApplication, "아직 신청 내역이 없습니다.", `${applications.length}건 확인`)
      },
      {
        title: "운영자 승인",
        ok: approved,
        detail: statusText(approved, "입금 확인 후 승인됩니다.", `${rooms.length}개 방 승인됨`)
      },
      {
        title: "앱 연결",
        ok: hasConnectCode,
        detail: statusText(hasConnectCode, "승인 후 방별 연결코드가 표시됩니다.", "연결코드 복사 가능")
      },
      {
        title: "첫 명령어 설치",
        ok: approved,
        detail: approved ? "명령어 스토어에서 운영 기본팩부터 설치하세요." : "승인 후 명령어 설치가 열립니다."
      }
    ];
  }

  function hasInstalledCommandPack(room = {}) {
    const packs = room.commandPacks || {};
    return Boolean(
      packs.basePackId
      || packs.basePackTitle
      || (packs.addonPackIds || []).length
      || (packs.addonPackTitles || []).length
      || (packs.installedPackIds || []).length
      || (packs.installedPackTitles || []).length
    );
  }

  function nextAction(data) {
    const applications = data.applications || [];
    const rooms = data.rooms || [];
    if (!applications.length && !rooms.length) {
      return {
        detail: "아직 신청 내역이 없습니다. 먼저 서비스 신청서를 접수해 주세요.",
        primary: { label: "서비스 신청하기", href: "/apply" },
        secondary: { label: "요금 확인", href: "/license" }
      };
    }
    if (!rooms.length) {
      return {
        detail: "신청은 접수됐고 입금/운영자 승인 대기 상태입니다. 승인되면 연결코드가 표시됩니다.",
        primary: { label: "입금/승인 대기 상태 확인", href: "/console" },
        secondary: { label: "오픈채팅 문의", href: "https://open.kakao.com/o/gu25P5vi" }
      };
    }
    const firstRoom = rooms[0] || {};
    if (!hasInstalledCommandPack(firstRoom)) {
      return {
        detail: `${firstRoom.roomName || "승인된 방"}에 운영 기본팩을 먼저 설치하면 /상태, /도움말, /메시지, /날씨, /운세 흐름을 바로 확인할 수 있습니다.`,
        primary: { label: "운영 기본팩 설치 명령어 복사", copy: BASIC_PACK_INSTALL_COMMAND },
        secondary: { label: "설치 안내 보기", href: "/setup" }
      };
    }
    return {
      detail: `${firstRoom.roomName || "승인된 방"} 연결코드를 앱에 넣고, 운영 기본팩을 첫 명령어로 설치해 주세요.`,
      primary: { label: "명령어 스토어 열기", href: `/command-store?room=${encodeURIComponent(firstRoom.applicationId || "")}` },
      secondary: { label: "설치 안내 보기", href: "/setup" }
    };
  }

  function renderNextAction(data) {
    const action = nextAction(data);
    return `
      <section class="buyer-next-action" aria-label="다음 행동">
        <div>
          <p class="section-kicker">Next</p>
          <h2>${escapeHtml(action.primary.label)}</h2>
          <p>${escapeHtml(action.detail)}</p>
        </div>
        <div class="buyer-next-buttons">
          ${action.primary.copy
            ? `<button class="button button-primary" type="button" data-copy="${escapeHtml(action.primary.copy)}" data-copy-label="${escapeHtml(action.primary.label)}">${escapeHtml(action.primary.label)}</button>`
            : `<a class="button button-primary" href="${escapeHtml(action.primary.href)}">${escapeHtml(action.primary.label)}</a>`}
          <a class="button button-secondary" href="${escapeHtml(action.secondary.href)}">${escapeHtml(action.secondary.label)}</a>
        </div>
      </section>
    `;
  }

  function renderOnboarding(data) {
    const steps = onboardingSteps(data);
    return `
      <section class="buyer-onboarding" aria-label="처음 시작 체크리스트">
        <div class="buyer-onboarding-head">
          <div>
            <p class="section-kicker">Start</p>
            <h2>처음 시작 체크리스트</h2>
            <p>구매자가 지금 어디까지 완료됐는지 한눈에 확인합니다.</p>
          </div>
          <a class="button button-secondary" href="/setup">설치 안내 보기</a>
        </div>
        <div class="buyer-step-grid">
          ${steps.map((step, index) => `
            <article class="buyer-step-card" data-state="${step.ok ? "done" : "waiting"}">
              <strong>${index + 1}</strong>
              <div>
                <h3>${escapeHtml(step.title)}</h3>
                <p>${escapeHtml(step.detail)}</p>
              </div>
            </article>
          `).join("")}
        </div>
      </section>
    `;
  }

  async function requestConsole(payload = {}) {
    const response = await fetch("/api/buyer/console", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    const json = await response.json();
    if (!response.ok || json.ok === false) throw new Error(json.error || "buyer_console_failed");
    if (json.guideToken) sessionStorage.setItem("pixgomBuyerToken", json.guideToken);
    renderConsole(json);
  }

  async function authPayloadFromForm() {
    const fallback = form ? Object.fromEntries(new FormData(form).entries()) : {};
    return window.PixelgomAuth ? window.PixelgomAuth.accessPayload(fallback) : fallback;
  }

  function buyerTokenPayload() {
    const token = sessionStorage.getItem("pixgomBuyerToken") || "";
    if (!token) throw new Error("buyer_approval_required");
    return { token };
  }

  async function requestBuyerAction(path, payload = {}) {
    const response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...buyerTokenPayload(), ...payload })
    });
    const json = await response.json();
    if (!response.ok || json.ok === false) throw new Error(json.error || "buyer_action_failed");
    if (json.guideToken) sessionStorage.setItem("pixgomBuyerToken", json.guideToken);
    return json;
  }

  function showConsoleGate(message = "구매 승인된 계정으로 로그인하세요.") {
    authGate?.finish(message);
    gate?.classList.remove("is-auth-checking");
    gate?.removeAttribute("hidden");
    if (form) form.hidden = false;
    if (statusBox) statusBox.textContent = message;
  }

  function renderApplications(applications = []) {
    if (!applications.length) {
      return `<article class="buyer-empty"><h3>신청 내역 없음</h3><p>서비스 신청 후 입금 확인이 완료되면 라이선스와 연결코드가 표시됩니다.</p><a class="button button-primary" href="/apply">서비스 신청</a></article>`;
    }
    return applications.map((application) => `
      <article class="buyer-mini-card">
        <strong>${escapeHtml(application.roomName)}</strong>
        <span>${escapeHtml(application.statusLabel)} · ${escapeHtml(application.payment?.statusLabel || "")}</span>
        <small>${formatKrw(application.payment?.amountKrw)} / ${escapeHtml(application.createdAt || "-")}</small>
      </article>
    `).join("");
  }

  function renderTransferAcceptPanel() {
    return `
      <section class="buyer-panel buyer-transfer-panel" data-transfer-accept-panel>
        <div>
          <p class="section-kicker">Transfer</p>
          <h2>방 소유권 이관</h2>
          <p>서비스 신청과 입금승인이 완료된 계정만 방을 받을 수 있습니다.</p>
        </div>
        <form class="buyer-transfer-form" data-transfer-accept-form>
          <label>이관 코드<input name="code" type="text" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" required placeholder="6자리 숫자"></label>
          <button class="button button-primary" type="submit">이관 코드 입력</button>
        </form>
      </section>
    `;
  }

  function renderTransferHistory(transfers = []) {
    if (!transfers.length) {
      return `
        <section class="buyer-panel buyer-transfer-history" aria-label="이관 내역">
          <h2>이관 내역</h2>
          <article class="buyer-empty"><h3>이관 내역 없음</h3><p>방을 넘기거나 받은 기록이 이곳에 표시됩니다.</p></article>
        </section>
      `;
    }
    return `
      <section class="buyer-panel buyer-transfer-history" aria-label="이관 내역">
        <h2>이관 내역</h2>
        <div class="buyer-transfer-history-list">
          ${transfers.slice(0, 8).map((transfer) => `
            <article class="buyer-transfer-history-card" data-status="${escapeHtml(transfer.status || "pending")}">
              <strong>${escapeHtml(transfer.roomName || "방 이름 없음")}</strong>
              <span>${escapeHtml(transfer.direction === "received" ? "받은 이관" : "보낸 이관")} · ${escapeHtml(transfer.statusLabel || transfer.status || "대기")}</span>
              <small>생성 ${escapeHtml(transfer.createdAt || "-")}${transfer.acceptedAt ? ` · 수락 ${escapeHtml(transfer.acceptedAt)}` : ""}${transfer.cancelledAt ? ` · 취소 ${escapeHtml(transfer.cancelledAt)}` : ""}</small>
            </article>
          `).join("")}
        </div>
      </section>
    `;
  }

  function renderRoomCard(room, options = {}) {
    const firstInstall = !hasInstalledCommandPack(room);
    const compact = options.compact === true;
    return `
      <article class="buyer-room-card${compact ? " is-compact-room" : ""}" data-first-install="${firstInstall ? "true" : "false"}">
        <div class="buyer-room-head">
          <h3>${escapeHtml(room.roomName)}</h3>
          <span>${escapeHtml(roomStatus(room))}</span>
        </div>
        <dl>
          <div><dt>roomId</dt><dd>${escapeHtml(room.roomId || "미등록")}</dd></div>
          <div><dt>오픈채팅 링크</dt><dd>${escapeHtml(room.roomLink || "미등록")}</dd></div>
          <div><dt>입장확인 문구</dt><dd>${escapeHtml(room.joinPhrase || "미등록")}</dd></div>
          <div><dt>관리자</dt><dd>${escapeHtml((room.roomAdmins || []).join(", ") || room.adminName || "미등록")}</dd></div>
          <div><dt>라이선스 키</dt><dd><code>${escapeHtml(room.licenseKey || "승인 후 발급")}</code></dd></div>
          <div><dt>앱 연결코드</dt><dd><code>${escapeHtml(room.bridgeConnectCode || "승인 후 발급")}</code></dd></div>
          <div><dt>라이선스 상태</dt><dd>${escapeHtml(room.licenseStatus || "확인 필요")}</dd></div>
          <div><dt>브릿지 상태</dt><dd>${escapeHtml(room.bridgeStatus === "ready" ? "연결 준비 완료" : "앱 연결 필요")}</dd></div>
          <div><dt>구독 상태</dt><dd>${escapeHtml(roomStatus(room))}</dd></div>
          <div><dt>구독 안내</dt><dd>${escapeHtml(room.subscriptionNotice || "상태 확인 후 필요 시 운영자에게 문의해 주세요.")}</dd></div>
          <div><dt>커스텀 명령어</dt><dd>${escapeHtml(String(room.commandCount ?? (room.customCommands || []).length))}개 설치됨</dd></div>
        </dl>
        ${options.hideLinkedGameRooms ? "" : renderLinkedGameRooms(room)}
        ${renderRoomPacks(room)}
        <div class="buyer-room-action-strip">
          <div>
            <strong>다음 할 일</strong>
            <span>${firstInstall ? "앱 연결코드 복사, 설치 안내 확인, 운영 기본팩 설치 명령어 복사 순서로 진행하세요." : "설치된 팩을 기준으로 필요한 명령어를 검색하거나 스토어에서 추가하세요."} 일반방과 게임방은 같은 브릿지 앱에 방별 연결코드를 차례대로 입력합니다.</span>
          </div>
          <button class="button button-primary" type="button" data-copy="${escapeHtml(room.bridgeConnectCode || "")}" data-copy-label="앱 연결코드">앱 연결코드 복사</button>
          <a class="button button-secondary" href="/setup">설치 안내 보기</a>
          ${room.canApplyGameRoom ? `<a class="button button-primary" href="${escapeHtml(room.gameRoomApplyUrl || "/apply?roomPurpose=game_room")}">게임방 추가 신청</a>` : ""}
          ${firstInstall ? `<button class="button button-primary" type="button" data-copy="${BASIC_PACK_INSTALL_COMMAND}" data-copy-label="운영 기본팩 설치 명령어">운영 기본팩 설치 명령어 복사</button>` : ""}
          <a class="button button-secondary" href="/command-store?room=${encodeURIComponent(room.applicationId || "")}">명령어 스토어 열기</a>
        </div>
        ${renderRoomCommands(room)}
        ${renderRoomCommandSearch(room)}
        <div class="buyer-card-actions">
          <button class="button button-secondary" type="button" data-copy="${escapeHtml(room.licenseKey || "")}" data-copy-label="라이선스 키">라이선스 복사</button>
        </div>
        <div class="buyer-transfer-card" data-room-transfer-card data-application-id="${escapeHtml(room.applicationId || "")}" data-room-name="${escapeHtml(room.roomName || "")}">
          <div>
            <strong>방 소유권 이관</strong>
            <span>6자리 코드를 만들어 받을 사람에게 전달하세요. 받는 사람은 입금승인이 완료된 계정이어야 합니다.</span>
          </div>
          <div class="buyer-transfer-actions">
            <button class="button button-secondary" type="button" data-transfer-create>이관 코드 생성</button>
            <button class="button button-secondary" type="button" data-transfer-cancel hidden>코드 취소</button>
          </div>
          <p data-transfer-output></p>
        </div>
      </article>
    `;
  }

  function renderRooms(rooms = []) {
    if (!rooms.length) {
      return `<article class="buyer-empty"><h3>승인된 방이 없습니다</h3><p>운영자가 입금 확인 후 승인하면 이곳에 방별 라이선스와 연결코드가 표시됩니다.</p></article>`;
    }
    return rooms.map((room) => renderRoomCard(room)).join("");
  }

  function renderRoomModeSettings(group = {}) {
    const baseRoom = group.baseRoom || {};
    const settings = group.roomModeSettings || {};
    if (!baseRoom.applicationId || !settings.enabled) {
      return `<p class="buyer-room-note">게임방을 추가하면 이곳에서 일반방/게임방 분리 설정을 한 번에 관리할 수 있습니다.</p>`;
    }
    return `
      <form class="buyer-room-mode-settings" data-room-mode-form data-application-id="${escapeHtml(baseRoom.applicationId || "")}">
        <div>
          <strong>일반방+게임방 통합 설정</strong>
          <span>두 방의 포인트, 가방, 게임 데이터는 하나로 공유됩니다.</span>
        </div>
        <label class="check-row">
          <input type="checkbox" name="generalRoomGameBlocked" ${settings.generalRoomGameBlocked ? "checked" : ""}>
          <span>일반방에서 게임 실행 명령어 차단</span>
        </label>
        <label class="check-row">
          <input type="checkbox" name="gameRoomOpsBlocked" ${settings.gameRoomOpsBlocked ? "checked" : ""}>
          <span>게임방에서 운영/공지 명령어 차단</span>
        </label>
        <button class="button button-secondary" type="submit">분리 설정 저장</button>
        <p data-room-mode-output></p>
      </form>
    `;
  }

  function renderRoomGroups(groups = [], rooms = []) {
    if (!groups.length) return renderRooms(rooms);
    return groups.map((group) => {
      const baseRoom = group.baseRoom;
      const gameRooms = group.gameRooms || [];
      if (!baseRoom) return renderRooms(gameRooms);
      return `
        <article class="buyer-room-group-card">
          ${renderRoomCard(baseRoom, { hideLinkedGameRooms: true })}
          ${renderRoomModeSettings(group)}
          <details class="buyer-game-room-details" ${gameRooms.length ? "" : "open"}>
            <summary>게임방 ${gameRooms.length ? `${gameRooms.length}개 연결됨` : "추가 전"}</summary>
            ${gameRooms.length
              ? `<div class="buyer-game-room-list">${gameRooms.map((room) => renderRoomCard(room, { compact: true })).join("")}</div>`
              : `<p class="buyer-room-note">게임방 추가 신청 후 승인되면 이 영역에 접어서 관리됩니다.</p>`}
          </details>
        </article>
      `;
    }).join("");
  }

  function renderLinkedGameRooms(room) {
    if (room.roomPurpose === "game_room") {
      return `<section class="buyer-linked-game-rooms"><strong>게임방</strong><span>이 방은 게임 전용 방입니다. 포인트와 가방 데이터는 기준 일반방과 함께 사용합니다.</span></section>`;
    }
    const linked = room.linkedGameRooms || [];
    if (!linked.length) {
      return `<section class="buyer-linked-game-rooms"><strong>게임방 연결</strong><span>승인된 일반방은 게임방 추가 신청으로 별도 게임방을 붙일 수 있습니다.</span></section>`;
    }
    return `
      <section class="buyer-linked-game-rooms">
        <strong>연결된 게임방</strong>
        <div>
          ${linked.map((item) => `
            <article>
              <span>${escapeHtml(item.roomName || "게임방")}</span>
              <small>${escapeHtml(item.statusLabel || item.status || "상태 확인")} · ${escapeHtml(item.paymentStatusLabel || item.paymentStatus || "결제 확인")}</small>
              ${item.bridgeConnectCode ? `<button class="button button-secondary" type="button" data-copy="${escapeHtml(item.bridgeConnectCode)}" data-copy-label="게임방 연결코드">게임방 연결코드 복사</button>` : ""}
            </article>
          `).join("")}
        </div>
      </section>
    `;
  }

  function renderRoomCommands(room) {
    const commands = (room.customCommands || []).slice(0, 5);
    if (!commands.length) return `<p class="buyer-room-note">아직 이 방에 설치된 커스텀 명령어가 없습니다.</p>`;
    return `
      <div class="buyer-command-preview">
        ${commands.map((command) => `<span>${escapeHtml(command.trigger)} · ${escapeHtml((command.response || "").split(/\n/)[0].slice(0, 22))}</span>`).join("")}
      </div>
    `;
  }

  function renderRoomPacks(room) {
    const packs = room.commandPacks || {};
    const installed = packs.installedPackTitles || packs.installedPackIds || [];
    const base = packs.basePackTitle || packs.basePackId || "";
    const addons = packs.addonPackTitles || packs.addonPackIds || [];
    if (!installed.length && !base && !addons.length) {
      return `<p class="buyer-room-note">아직 장착된 명령어 팩이 없습니다. 명령어 스토어에서 운영 기본팩을 장착해 보세요.</p>`;
    }
    const packText = installed.length
      ? installed.join(", ")
      : `기본팩 ${base || "없음"}${addons.length ? ` · 애드온 ${addons.join(", ")}` : ""}`;
    return `
      <section class="buyer-pack-summary">
        <div>
          <strong>장착된 명령어 팩</strong>
          <span>${escapeHtml(packText)}</span>
        </div>
        <a class="button button-secondary" href="/command-store?room=${encodeURIComponent(room.applicationId || "")}">팩 관리</a>
      </section>
    `;
  }

  function renderRoomCommandSearch(room) {
    return `
      <section class="buyer-command-search" data-room-command-search data-application-id="${escapeHtml(room.applicationId || "")}">
        <div class="buyer-command-search-head">
          <strong>명령어 검색</strong>
          <span>${escapeHtml(room.roomName || "선택한 방")} 기준</span>
        </div>
        <div class="buyer-command-search-form">
          <input type="search" data-room-command-query placeholder="날씨, 운세, 메시지, 공지, 관리">
          <button class="button button-secondary" type="button" data-room-command-submit>검색</button>
        </div>
        <div class="buyer-command-results" data-room-command-results>
          <article class="buyer-empty">이 방에서 사용할 수 있는 명령어를 검색합니다.</article>
        </div>
      </section>
    `;
  }

  function commandStatusLabel(item) {
    const labels = {
      available: "사용 가능",
      install_required: "설치 필요",
      admin_only: "관리자 전용",
      disabled: "비활성화됨",
      coming_soon: "준비중"
    };
    return labels[item.status] || item.status || "확인 필요";
  }

  function renderCommandSearchResults(container, data, applicationId) {
    const items = data.items || [];
    if (!items.length) {
      container.innerHTML = `<article class="buyer-empty">해당 방에서 사용할 수 있는 명령어를 찾지 못했습니다.</article>`;
      return;
    }
    container.innerHTML = items.slice(0, 30).map((item) => `
      <article class="buyer-command-result" data-status="${escapeHtml(item.status || "")}">
        <div>
          <strong>${escapeHtml(item.command)}</strong>
          <span>${escapeHtml(commandStatusLabel(item))}</span>
        </div>
        <p>${escapeHtml(item.description || "")}</p>
        <small>${escapeHtml(item.category || "")}${item.sourcePackTitle ? ` · ${escapeHtml(item.sourcePackTitle)} 소속` : ""}${item.aliases?.length ? ` · alias ${escapeHtml(item.aliases.join(", "))}` : ""}${item.disabledReason ? ` · ${escapeHtml(item.disabledReason)}` : ""}</small>
        <div class="buyer-card-actions">
          ${item.available ? `<button class="button button-secondary" type="button" data-copy-command="${escapeHtml(item.examples?.[0] || item.command)}">복사</button>` : ""}
          ${item.status === "install_required" ? `<a class="button button-secondary" href="/command-store?room=${encodeURIComponent(applicationId)}">스토어</a>` : ""}
        </div>
      </article>
    `).join("");
  }

  async function loadRoomCommandSearch(panel) {
    const applicationId = panel.dataset.applicationId || "";
    const query = panel.querySelector("[data-room-command-query]")?.value || "";
    const results = panel.querySelector("[data-room-command-results]");
    const token = sessionStorage.getItem("pixgomBuyerToken") || "";
    if (!applicationId || !token || !results) return;
    results.innerHTML = `<article class="buyer-empty">명령어를 불러오는 중입니다.</article>`;
    const response = await fetch("/api/buyer/room-commands", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, applicationId, q: query })
    });
    const data = await response.json();
    if (!response.ok || data.ok === false) {
      results.innerHTML = `<article class="buyer-empty">명령어를 불러오지 못했습니다.</article>`;
      return;
    }
    if (data.guideToken) sessionStorage.setItem("pixgomBuyerToken", data.guideToken);
    renderCommandSearchResults(results, data, applicationId);
  }

  function bindRoomCommandSearch() {
    content.querySelectorAll("[data-room-command-search]").forEach((panel) => {
      const submit = panel.querySelector("[data-room-command-submit]");
      const input = panel.querySelector("[data-room-command-query]");
      submit?.addEventListener("click", () => loadRoomCommandSearch(panel));
      input?.addEventListener("keydown", (event) => {
        if (event.key === "Enter") loadRoomCommandSearch(panel);
      });
      loadRoomCommandSearch(panel);
    });
  }

  function renderSetup(rooms = []) {
    const firstCode = rooms[0]?.bridgeConnectCode || "";
    return `
      <article class="buyer-guide-section">
        <h3>앱 연결 순서</h3>
        <ol>
          <li>픽셀곰 브릿지 앱을 설치하고 알림 접근 권한을 허용합니다.</li>
          <li>아래 연결코드를 앱의 연결코드 자동 설정에 붙여넣습니다.</li>
          <li>일반방과 게임방을 함께 쓰는 경우 두 방의 연결코드를 같은 브릿지 앱에 차례로 붙여넣습니다.</li>
          <li>앱에서 서버 테스트 전송을 실행합니다.</li>
          <li>카카오방에서 /브릿지, /상태, /js상태 순서로 확인합니다.</li>
        </ol>
        ${firstCode ? `<pre class="buyer-code">${escapeHtml(firstCode)}</pre>` : `<p>승인된 방이 생기면 연결코드가 표시됩니다.</p>`}
      </article>
      <article class="buyer-guide-section">
        <h3>권한 체크</h3>
        <ol>
          <li>카카오톡 알림이 켜져 있어야 합니다.</li>
          <li>등록된 방 이름과 앱의 등록 방 이름이 같아야 합니다.</li>
          <li>배터리 절전이 강하면 알림 수신이 지연될 수 있습니다.</li>
          <li>픽셀곰 브릿지는 기본 운영에서 화면 감지를 사용하지 않습니다.</li>
        </ol>
      </article>
    `;
  }

  function renderLicense(data) {
    return `
      <article class="buyer-guide-section">
        <h3>요금과 라이선스</h3>
        <ol>
          <li>기본 요금: 방 1개 / 30일 / ${formatKrw(data.plan?.monthlyPriceKrw)}</li>
          <li>추가 방: 방마다 / 30일 / ${formatKrw(data.plan?.additionalRoomPriceKrw || 2200)}</li>
          <li>구독이 만료되면 서버 응답이 차단됩니다.</li>
          <li>라이선스 키는 승인된 방마다 별도로 발급됩니다.</li>
          <li>앱을 재설치해도 연결코드를 다시 입력하면 같은 라이선스를 사용할 수 있습니다.</li>
        </ol>
      </article>
      <div class="buyer-room-grid">${renderRoomGroups(data.roomGroups || [], data.rooms || [])}</div>
    `;
  }

  function sectionClass(name) {
    return initialView === name ? "buyer-panel is-primary" : "buyer-panel";
  }

  function renderConsole(data) {
    const rooms = data.rooms || [];
    const roomGroups = data.roomGroups || [];
    content.hidden = false;
    content.innerHTML = `
      <section class="buyer-console-hero">
        <div>
          <p class="section-kicker">Buyer Console</p>
          <h1>${escapeHtml(data.account.email || data.account.nickname || "카카오 계정")} 콘솔</h1>
          <p>구매자는 이 화면에서 자기 방, 연결코드, 라이선스, 설치 순서만 확인합니다. 전체 운영 관리는 판매자 어드민에서만 처리합니다.</p>
        </div>
        <img src="/assets/pixgom-guardian.png" alt="">
      </section>
      <nav class="buyer-console-tabs" aria-label="구매자 콘솔 메뉴">
        <a href="/console">요약</a>
        <a href="/my-rooms">내 방</a>
        <a href="/command-store">명령어 스토어</a>
        <a href="/setup">설치</a>
        <a href="/license">라이선스</a>
      </nav>
      ${renderNextAction(data)}
      ${renderOnboarding(data)}
      ${renderTransferAcceptPanel()}
      ${renderTransferHistory(data.transfers || [])}
      <section class="${sectionClass("overview")}">
        <h2>신청 상태</h2>
        <div class="buyer-mini-grid">${renderApplications(data.applications || [])}</div>
      </section>
      <section class="${sectionClass("rooms")}">
        <h2>내 방</h2>
        <div class="buyer-room-grid">${renderRoomGroups(roomGroups, rooms)}</div>
      </section>
      <section class="${sectionClass("setup")}">
        <h2>설치와 연결</h2>
        <div class="buyer-guide-grid">${renderSetup(rooms)}</div>
      </section>
      <section class="${sectionClass("license")}">
        <h2>라이선스</h2>
        ${renderLicense(data)}
      </section>
    `;
    gate?.setAttribute("hidden", "");
    if (signOutButton) signOutButton.hidden = false;
    statusBox.textContent = "구매자 콘솔을 불러왔습니다.";
    content.querySelectorAll("[data-copy]").forEach((button) => {
      button.addEventListener("click", async () => {
        const value = button.dataset.copy || "";
        if (!value) return;
        await navigator.clipboard.writeText(value);
        const label = button.dataset.copyLabel || "값";
        statusBox.textContent = `${label}를 복사했습니다.${label.includes("설치 명령어") ? " 카톡방에 붙여넣고 /설치확인 코드로 완료하세요." : ""}`;
      });
    });
    content.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-copy-command]");
      if (!button) return;
      await navigator.clipboard.writeText(button.dataset.copyCommand || "");
      statusBox.textContent = "명령어 예시를 복사했습니다.";
    });
    content.querySelectorAll("[data-transfer-create]").forEach((button) => {
      button.addEventListener("click", async () => {
        const card = button.closest("[data-room-transfer-card]");
        const output = card.querySelector("[data-transfer-output]");
        try {
          output.textContent = "이관 코드를 생성하는 중입니다.";
          const json = await requestBuyerAction("/api/buyer/room-transfer/create", {
            applicationId: card.dataset.applicationId,
            confirmRoomName: card.dataset.roomName
          });
          card.dataset.transferId = json.transfer.id || "";
          const cancelButton = card.querySelector("[data-transfer-cancel]");
          if (cancelButton) cancelButton.hidden = false;
          output.innerHTML = `이관 코드 <code>${escapeHtml(json.transfer.code)}</code> · ${escapeHtml(json.transfer.expiresAt || "")}까지 유효`;
          statusBox.textContent = "이관 코드를 생성했습니다. 받는 사람에게 6자리 코드만 전달하세요.";
        } catch (error) {
          output.textContent = window.PixelgomAuth.friendlyError(error);
          statusBox.textContent = output.textContent;
        }
      });
    });
    content.querySelectorAll("[data-transfer-cancel]").forEach((button) => {
      button.addEventListener("click", async () => {
        const card = button.closest("[data-room-transfer-card]");
        const output = card.querySelector("[data-transfer-output]");
        try {
          await requestBuyerAction("/api/buyer/room-transfer/cancel", { transferId: card.dataset.transferId || "" });
          button.hidden = true;
          output.textContent = "이관 코드를 취소했습니다.";
          statusBox.textContent = "이관 코드가 취소되었습니다.";
        } catch (error) {
          output.textContent = window.PixelgomAuth.friendlyError(error);
          statusBox.textContent = output.textContent;
        }
      });
    });
    content.querySelector("[data-transfer-accept-form]")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const acceptForm = event.currentTarget;
      const code = new FormData(acceptForm).get("code");
      try {
        statusBox.textContent = "방 소유권 이관을 확인하는 중입니다.";
        await requestBuyerAction("/api/buyer/room-transfer/accept", { code });
        statusBox.textContent = "방 소유권 이관이 완료되었습니다.";
        acceptForm.reset();
        await requestConsole(buyerTokenPayload());
      } catch (error) {
        statusBox.textContent = window.PixelgomAuth.friendlyError(error);
      }
    });
    content.querySelectorAll("[data-room-mode-form]").forEach((modeForm) => {
      modeForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const output = modeForm.querySelector("[data-room-mode-output]");
        try {
          if (output) output.textContent = "분리 설정을 저장하는 중입니다.";
          const values = Object.fromEntries(new FormData(modeForm).entries());
          await requestBuyerAction("/api/buyer/room-mode-settings", {
            applicationId: modeForm.dataset.applicationId || "",
            generalRoomGameBlocked: values.generalRoomGameBlocked === "on",
            gameRoomOpsBlocked: values.gameRoomOpsBlocked === "on"
          });
          if (output) output.textContent = "일반방+게임방 통합 설정을 저장했습니다.";
          statusBox.textContent = "방 분리 설정이 저장되었습니다.";
          await requestConsole(buyerTokenPayload());
        } catch (error) {
          if (output) output.textContent = window.PixelgomAuth.friendlyError(error);
          statusBox.textContent = window.PixelgomAuth.friendlyError(error);
        }
      });
    });
    bindRoomCommandSearch();
  }

  async function boot() {
    if (!authGate?.hasHint) showConsoleGate();
    const cfg = await window.PixelgomAuth.config();
    window.PixelgomAuth.showAuthMode(document.querySelector("[data-auth-mode]"), cfg);
    if (kakaoButton) kakaoButton.hidden = !cfg.auth?.kakaoEnabled;
    if (!authGate?.hasHint) return;
    const savedToken = sessionStorage.getItem("pixgomBuyerToken");
    if (savedToken) {
      requestConsole({ token: savedToken }).catch((error) => {
        sessionStorage.removeItem("pixgomBuyerToken");
        showConsoleGate(window.PixelgomAuth.friendlyError(error));
      });
      return;
    }
    const payload = await window.PixelgomAuth.accessPayload({});
    if (payload.accessToken) {
      requestConsole(payload).catch((error) => {
        showConsoleGate(`콘솔 접근 실패: ${window.PixelgomAuth.friendlyError(error)}`);
      });
      return;
    }
    showConsoleGate();
  }

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    statusBox.textContent = "구매자 인증 중입니다.";
    try {
      const values = Object.fromEntries(new FormData(form).entries());
      await window.PixelgomAuth.signInWithPassword(values.email, values.password);
      await requestConsole(await authPayloadFromForm());
      form.reset();
    } catch (error) {
      statusBox.textContent = error.message === "buyer_approval_required"
        ? window.PixelgomAuth.friendlyError("buyer_approval_required")
        : `콘솔 접근 실패: ${window.PixelgomAuth.friendlyError(error)}`;
    }
  });

  kakaoButton?.addEventListener("click", async () => {
    statusBox.textContent = "카카오 로그인으로 이동합니다.";
    try {
      await window.PixelgomAuth.signInWithKakao("/console");
    } catch (error) {
      statusBox.textContent = `카카오 로그인 실패: ${window.PixelgomAuth.friendlyError(error)}`;
    }
  });

  signOutButton?.addEventListener("click", async () => {
    await window.PixelgomAuth.signOut();
    window.location.href = "/login";
  });

  boot();
})();
