(() => {
  const form = document.querySelector("[data-console-login]");
  const statusBox = document.querySelector("[data-console-status]");
  const content = document.querySelector("[data-console-content]");
  const kakaoButton = document.querySelector("[data-kakao-login]");
  const signOutButton = document.querySelector("[data-sign-out]");
  const initialView = document.body.dataset.consoleView || "overview";

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
          <a class="button button-primary" href="${escapeHtml(action.primary.href)}">${escapeHtml(action.primary.label)}</a>
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

  function renderRooms(rooms = []) {
    if (!rooms.length) {
      return `<article class="buyer-empty"><h3>승인된 방이 없습니다</h3><p>운영자가 입금 확인 후 승인하면 이곳에 방별 라이선스와 연결코드가 표시됩니다.</p></article>`;
    }
    return rooms.map((room) => `
      <article class="buyer-room-card">
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
        ${renderRoomPacks(room)}
        <div class="buyer-room-action-strip">
          <div>
            <strong>다음 할 일</strong>
            <span>앱 연결 후 명령어 스토어에서 운영 기본팩을 첫 설치로 진행하세요.</span>
          </div>
          <button class="button button-primary" type="button" data-copy="${escapeHtml(room.bridgeConnectCode || "")}" data-copy-label="앱 연결코드">앱 연결코드 복사</button>
          <a class="button button-secondary" href="/setup">설치 안내 보기</a>
          <a class="button button-secondary" href="/command-store?room=${encodeURIComponent(room.applicationId || "")}">명령어 스토어 열기</a>
        </div>
        ${renderRoomCommands(room)}
        ${renderRoomCommandSearch(room)}
        <div class="buyer-card-actions">
          <button class="button button-secondary" type="button" data-copy="${escapeHtml(room.bridgeConnectCode || "")}" data-copy-label="앱 연결코드">연결코드 복사</button>
          <button class="button button-secondary" type="button" data-copy="${escapeHtml(room.licenseKey || "")}" data-copy-label="라이선스 키">라이선스 복사</button>
          <a class="button button-secondary" href="/command-store?room=${encodeURIComponent(room.applicationId || "")}">방별 명령어 관리</a>
        </div>
      </article>
    `).join("");
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
      <div class="buyer-room-grid">${renderRooms(data.rooms || [])}</div>
    `;
  }

  function sectionClass(name) {
    return initialView === name ? "buyer-panel is-primary" : "buyer-panel";
  }

  function renderConsole(data) {
    const rooms = data.rooms || [];
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
      <section class="${sectionClass("overview")}">
        <h2>신청 상태</h2>
        <div class="buyer-mini-grid">${renderApplications(data.applications || [])}</div>
      </section>
      <section class="${sectionClass("rooms")}">
        <h2>내 방</h2>
        <div class="buyer-room-grid">${renderRooms(rooms)}</div>
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
    document.querySelector("[data-console-gate]")?.setAttribute("hidden", "");
    if (signOutButton) signOutButton.hidden = false;
    statusBox.textContent = "구매자 콘솔을 불러왔습니다.";
    content.querySelectorAll("[data-copy]").forEach((button) => {
      button.addEventListener("click", async () => {
        const value = button.dataset.copy || "";
        if (!value) return;
        await navigator.clipboard.writeText(value);
        statusBox.textContent = `${button.dataset.copyLabel || "값"}를 복사했습니다.`;
      });
    });
    content.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-copy-command]");
      if (!button) return;
      await navigator.clipboard.writeText(button.dataset.copyCommand || "");
      statusBox.textContent = "명령어 예시를 복사했습니다.";
    });
    bindRoomCommandSearch();
  }

  async function boot() {
    const cfg = await window.PixelgomAuth.config();
    window.PixelgomAuth.showAuthMode(document.querySelector("[data-auth-mode]"), cfg);
    if (kakaoButton) kakaoButton.hidden = !cfg.auth?.kakaoEnabled;
    const savedToken = sessionStorage.getItem("pixgomBuyerToken");
    if (savedToken) {
      requestConsole({ token: savedToken }).catch((error) => {
        sessionStorage.removeItem("pixgomBuyerToken");
        statusBox.innerHTML = `${escapeHtml(window.PixelgomAuth.friendlyError(error))} <a href="/login">로그인 화면</a>`;
      });
      return;
    }
    const payload = await window.PixelgomAuth.accessPayload({});
    if (payload.accessToken) {
      requestConsole(payload).catch((error) => {
        statusBox.innerHTML = `콘솔 접근 실패: ${escapeHtml(window.PixelgomAuth.friendlyError(error))} <a href="/login">재로그인</a>`;
      });
    }
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
