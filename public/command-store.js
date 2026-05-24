(() => {
  const grid = document.querySelector("[data-template-grid]");
  const summary = document.querySelector("[data-template-summary]");
  const statusBox = document.querySelector("[data-template-status]");
  const searchInput = document.querySelector("[data-template-search]");
  const categoryInput = document.querySelector("[data-template-category]");
  const audienceInput = document.querySelector("[data-template-audience]");
  const installPanel = document.querySelector("[data-install-panel]");
  const installRoomInput = document.querySelector("[data-install-room]");

  let catalog = { templates: [], categories: [], summary: {}, total: 0 };
  let buyerToken = "";
  let buyerRooms = [];

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function audienceLabel(value) {
    return value === "admin" ? "관리자용" : "참여자용";
  }

  function kindLabel(value) {
    const labels = {
      fixed: "기본 기능",
      custom: "문구형",
      "game-template": "게임 템플릿",
      roadmap: "로드맵"
    };
    return labels[value] || value;
  }

  function renderSummary() {
    summary.innerHTML = `
      <article><strong>${catalog.total}</strong><span>전체 템플릿</span></article>
      <article><strong>${catalog.summary?.installable || 0}</strong><span>방에 설치 가능</span></article>
      <article><strong>${catalog.summary?.games || 0}</strong><span>게임 확장 후보</span></article>
      <article><strong>${catalog.categories?.length || 0}</strong><span>카테고리</span></article>
    `;
  }

  function renderCategoryOptions() {
    for (const category of catalog.categories || []) {
      const option = document.createElement("option");
      option.value = category.id;
      option.textContent = `${category.title} (${category.count})`;
      categoryInput.appendChild(option);
    }
  }

  function templateMatches(template) {
    const term = (searchInput.value || "").trim().toLowerCase();
    const category = categoryInput.value;
    const audience = audienceInput.value;
    if (category !== "all" && template.categoryId !== category) return false;
    if (audience !== "all" && template.audience !== audience) return false;
    if (!term) return true;
    const haystack = [
      template.title,
      template.command,
      template.categoryTitle,
      template.description,
      ...(template.tags || [])
    ].join(" ").toLowerCase();
    return haystack.includes(term);
  }

  function renderTemplates() {
    const templates = catalog.templates.filter(templateMatches).slice(0, 120);
    grid.innerHTML = templates.map((template) => `
      <article class="template-card">
        <div class="template-card-head">
          <span>${escapeHtml(template.categoryTitle)}</span>
          <strong>${escapeHtml(template.command)}</strong>
        </div>
        <h2>${escapeHtml(template.title)}</h2>
        <p>${escapeHtml(template.description)}</p>
        <div class="template-badges">
          <span>${escapeHtml(audienceLabel(template.audience))}</span>
          <span>${escapeHtml(kindLabel(template.kind))}</span>
          <span>${template.installable ? "설치 가능" : "기본/예약"}</span>
        </div>
        <pre>${escapeHtml(template.response || "서버에 내장된 고정 기능입니다.")}</pre>
        <div class="template-actions">
          <button class="button button-secondary" type="button" data-copy-template="${escapeHtml(template.id)}">복사</button>
          <button class="button button-primary" type="button" data-install-template="${escapeHtml(template.id)}" ${template.installable && buyerToken ? "" : "disabled"}>내 방에 담기</button>
        </div>
      </article>
    `).join("");
    if (!templates.length) grid.innerHTML = `<article class="buyer-empty"><h3>검색 결과 없음</h3><p>다른 카테고리나 검색어를 선택해 주세요.</p></article>`;
    statusBox.textContent = `현재 ${templates.length}개를 표시 중입니다. 전체 ${catalog.total}개 템플릿이 준비되어 있습니다.`;
  }

  async function loadBuyerState() {
    if (!window.PixelgomAuth) return;
    const savedToken = sessionStorage.getItem("pixgomBuyerToken");
    const payload = savedToken ? { token: savedToken } : await window.PixelgomAuth.accessPayload({});
    if (!payload.token && !payload.accessToken && !payload.email) return;
    try {
      const response = await fetch("/api/buyer/console", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok || data.ok === false) return;
      buyerToken = data.guideToken || savedToken || "";
      buyerRooms = data.rooms || [];
      if (buyerToken) sessionStorage.setItem("pixgomBuyerToken", buyerToken);
      if (buyerRooms.length) {
        installPanel.hidden = false;
        installRoomInput.innerHTML = buyerRooms.map((room) => `<option value="${escapeHtml(room.applicationId)}">${escapeHtml(room.roomName)}</option>`).join("");
      }
    } catch {
      buyerToken = "";
      buyerRooms = [];
    }
  }

  async function installTemplate(templateId) {
    if (!buyerToken) {
      statusBox.textContent = "구매자 로그인 후 설치할 수 있습니다.";
      return;
    }
    const response = await fetch("/api/buyer/command-templates/install", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        token: buyerToken,
        applicationId: installRoomInput.value,
        templateId
      })
    });
    const data = await response.json();
    if (!response.ok || data.ok === false) {
      statusBox.textContent = `설치 실패: ${data.error || "unknown_error"}`;
      return;
    }
    if (data.guideToken) {
      buyerToken = data.guideToken;
      sessionStorage.setItem("pixgomBuyerToken", buyerToken);
    }
    statusBox.textContent = `${data.command.trigger} 명령어를 ${data.room.roomName} 방에 담았습니다.`;
  }

  grid.addEventListener("click", async (event) => {
    const copyButton = event.target.closest("[data-copy-template]");
    const installButton = event.target.closest("[data-install-template]");
    if (copyButton) {
      const template = catalog.templates.find((item) => item.id === copyButton.dataset.copyTemplate);
      if (!template) return;
      await navigator.clipboard.writeText(`${template.command}\n${template.response || template.description}`);
      statusBox.textContent = `${template.command} 템플릿을 복사했습니다.`;
    }
    if (installButton) {
      await installTemplate(installButton.dataset.installTemplate);
      renderTemplates();
    }
  });

  [searchInput, categoryInput, audienceInput].forEach((input) => {
    input.addEventListener("input", renderTemplates);
    input.addEventListener("change", renderTemplates);
  });

  async function boot() {
    const response = await fetch("/api/command-templates");
    catalog = await response.json();
    renderCategoryOptions();
    renderSummary();
    await loadBuyerState();
    renderTemplates();
  }

  boot().catch((error) => {
    statusBox.textContent = `명령어 스토어를 불러오지 못했습니다: ${error.message}`;
  });
})();
