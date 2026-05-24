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
    const remaining = Number(room.subscription?.remainingDays);
    if (!Number.isFinite(remaining)) return "구독 상태 확인 필요";
    if (remaining < 0) return "구독 만료";
    if (remaining <= 7) return `만료 임박 ${remaining}일`;
    return `정상 ${remaining}일 남음`;
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
        </dl>
        <div class="buyer-card-actions">
          <button class="button button-secondary" type="button" data-copy="${escapeHtml(room.bridgeConnectCode || "")}">연결코드 복사</button>
          <button class="button button-secondary" type="button" data-copy="${escapeHtml(room.licenseKey || "")}">라이선스 복사</button>
        </div>
      </article>
    `).join("");
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
        <a href="/setup">설치</a>
        <a href="/license">라이선스</a>
      </nav>
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
        statusBox.textContent = "복사했습니다.";
      });
    });
  }

  async function boot() {
    const cfg = await window.PixelgomAuth.config();
    window.PixelgomAuth.showAuthMode(document.querySelector("[data-auth-mode]"), cfg);
    if (kakaoButton) kakaoButton.hidden = !cfg.auth?.kakaoEnabled;
    const savedToken = sessionStorage.getItem("pixgomBuyerToken");
    if (savedToken) {
      requestConsole({ token: savedToken }).catch(() => sessionStorage.removeItem("pixgomBuyerToken"));
      return;
    }
    const payload = await window.PixelgomAuth.accessPayload({});
    if (payload.accessToken) requestConsole(payload).catch(() => {});
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
        ? "구매 승인 후 이용할 수 있습니다."
        : `콘솔 접근 실패: ${error.message}`;
    }
  });

  kakaoButton?.addEventListener("click", async () => {
    statusBox.textContent = "카카오 로그인으로 이동합니다.";
    try {
      await window.PixelgomAuth.signInWithKakao("/console");
    } catch (error) {
      statusBox.textContent = `카카오 로그인 실패: ${error.message}`;
    }
  });

  signOutButton?.addEventListener("click", async () => {
    await window.PixelgomAuth.signOut();
    window.location.href = "/login";
  });

  boot();
})();
