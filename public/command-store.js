(() => {
  const grid = document.querySelector("[data-template-grid]");
  const summary = document.querySelector("[data-template-summary]");
  const statusBox = document.querySelector("[data-template-status]");
  const searchInput = document.querySelector("[data-template-search]");
  const categoryInput = document.querySelector("[data-template-category]");
  const audienceInput = document.querySelector("[data-template-audience]");
  const installPanel = document.querySelector("[data-install-panel]");
  const installRoomInput = document.querySelector("[data-install-room]");
  const filterBar = document.querySelector("[data-template-filters]");
  const editor = document.querySelector("[data-template-editor]");
  const installedPanel = document.querySelector("[data-installed-panel]");
  const installedList = document.querySelector("[data-installed-list]");
  const refreshInstalledButton = document.querySelector("[data-refresh-installed]");

  let catalog = { templates: [], categories: [], summary: {}, total: 0 };
  let buyerToken = "";
  let buyerRooms = [];
  let currentMode = "featured";
  let currentTemplateId = "";
  const favorites = new Set(readList("pixgomCommandFavorites"));
  const cart = new Set(readList("pixgomCommandCart"));

  function readList(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || "[]");
    } catch {
      return [];
    }
  }

  function writeSet(key, set) {
    localStorage.setItem(key, JSON.stringify([...set]));
  }

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
      "game-template": "게임 연결",
      roadmap: "로드맵"
    };
    return labels[value] || value;
  }

  function templateById(id) {
    return catalog.templates.find((item) => item.id === id);
  }

  function renderSummary() {
    summary.innerHTML = `
      <article><strong>${catalog.total}</strong><span>전체 템플릿</span></article>
      <article><strong>${catalog.summary?.installable || 0}</strong><span>설치 가능</span></article>
      <article><strong>${cart.size}</strong><span>장바구니</span></article>
      <article><strong>${favorites.size}</strong><span>즐겨찾기</span></article>
    `;
  }

  function renderCategoryOptions() {
    categoryInput.innerHTML = `<option value="all">전체 카테고리</option>`;
    for (const category of catalog.categories || []) {
      if (category.id === "fixed-current") continue;
      const option = document.createElement("option");
      option.value = category.id;
      option.textContent = `${category.title} (${category.count})`;
      categoryInput.appendChild(option);
    }
  }

  function modeMatches(template) {
    if (currentMode === "featured") return template.installable && template.kind !== "fixed";
    if (currentMode === "installable") return template.installable;
    if (currentMode === "game") return template.kind === "game-template";
    if (currentMode === "admin") return template.audience === "admin";
    if (currentMode === "favorite") return favorites.has(template.id);
    if (currentMode === "cart") return cart.has(template.id);
    return true;
  }

  function templateMatches(template) {
    const term = (searchInput.value || "").trim().toLowerCase();
    const category = categoryInput.value;
    const audience = audienceInput.value;
    if (!modeMatches(template)) return false;
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

  function selectTemplate(templateId) {
    currentTemplateId = templateId;
    const template = templateById(templateId);
    if (!template) return;
    renderEditor(template);
    renderTemplates();
  }

  function renderTemplates() {
    const templates = catalog.templates.filter(templateMatches).slice(0, 72);
    grid.innerHTML = templates.map((template) => `
      <article class="template-card ${template.id === currentTemplateId ? "is-selected" : ""}">
        <button class="template-select" type="button" data-select-template="${escapeHtml(template.id)}">
          <span>${escapeHtml(template.categoryTitle)}</span>
          <strong>${escapeHtml(template.command)}</strong>
          <b>${escapeHtml(template.title)}</b>
        </button>
        <p>${escapeHtml(template.description)}</p>
        <div class="template-badges">
          <span>${escapeHtml(audienceLabel(template.audience))}</span>
          <span>${escapeHtml(kindLabel(template.kind))}</span>
          <span>${template.proxyCommand ? `${escapeHtml(template.proxyCommand)} 연결` : template.installable ? "설치 가능" : "기본/예약"}</span>
        </div>
        <div class="template-actions">
          <button class="button button-secondary" type="button" data-favorite-template="${escapeHtml(template.id)}">${favorites.has(template.id) ? "즐겨찾기 해제" : "즐겨찾기"}</button>
          <button class="button button-secondary" type="button" data-cart-template="${escapeHtml(template.id)}">${cart.has(template.id) ? "장바구니 제거" : "장바구니"}</button>
        </div>
      </article>
    `).join("");
    if (!templates.length) grid.innerHTML = `<article class="buyer-empty"><h3>검색 결과 없음</h3><p>추천, 설치 가능, 게임 연결 같은 빠른 보기를 선택해 범위를 줄여보세요.</p></article>`;
    statusBox.textContent = `현재 ${templates.length}개를 표시 중입니다. 검색과 빠른 보기로 전체 ${catalog.total}개 템플릿을 좁혀볼 수 있습니다.`;
    renderSummary();
  }

  function renderEditor(template) {
    editor.innerHTML = `
      <div class="template-editor-head">
        <p class="section-kicker">Editor</p>
        <h2>${escapeHtml(template.title)}</h2>
        <span>${escapeHtml(template.categoryTitle)} · ${escapeHtml(audienceLabel(template.audience))}</span>
      </div>
      <label class="wide-label">명령어
        <input data-editor-trigger type="text" value="${escapeHtml(template.command)}" ${template.installable ? "" : "disabled"}>
      </label>
      <label class="wide-label">응답 문구
        <textarea data-editor-response rows="9" ${template.installable ? "" : "disabled"}>${escapeHtml(template.response || "서버에 내장된 고정 기능입니다.")}</textarea>
      </label>
      <div class="template-editor-note">
        ${template.proxyCommand ? `${escapeHtml(template.proxyCommand)} 미니게임 엔진에 연결됩니다.` : template.installable ? "설치 전 문구를 방 분위기에 맞게 수정할 수 있습니다." : "고정 명령어는 설치하거나 수정할 수 없습니다."}
      </div>
      <div class="template-actions">
        <button class="button button-secondary" type="button" data-copy-current>복사</button>
        <button class="button button-secondary" type="button" data-favorite-current>${favorites.has(template.id) ? "즐겨찾기 해제" : "즐겨찾기"}</button>
        <button class="button button-secondary" type="button" data-cart-current>${cart.has(template.id) ? "장바구니 제거" : "장바구니"}</button>
        <button class="button button-primary" type="button" data-install-current ${template.installable && buyerToken ? "" : "disabled"}>편집 내용 설치</button>
      </div>
    `;
  }

  function toggleSet(set, key, storageKey) {
    if (set.has(key)) set.delete(key);
    else set.add(key);
    writeSet(storageKey, set);
    renderSummary();
    renderTemplates();
    const template = templateById(currentTemplateId);
    if (template) renderEditor(template);
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
        installedPanel.hidden = false;
        installRoomInput.innerHTML = buyerRooms.map((room) => `<option value="${escapeHtml(room.applicationId)}">${escapeHtml(room.roomName)}</option>`).join("");
        await loadInstalledCommands();
      }
    } catch {
      buyerToken = "";
      buyerRooms = [];
    }
  }

  async function installTemplate(templateId) {
    const template = templateById(templateId);
    if (!template) return;
    if (!buyerToken) {
      statusBox.textContent = "구매자 로그인 후 설치할 수 있습니다.";
      return;
    }
    const trigger = editor.querySelector("[data-editor-trigger]")?.value || template.command;
    const responseText = editor.querySelector("[data-editor-response]")?.value || template.response;
    const response = await fetch("/api/buyer/command-templates/install", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        token: buyerToken,
        applicationId: installRoomInput.value,
        templateId,
        trigger,
        response: responseText
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
    cart.delete(templateId);
    writeSet("pixgomCommandCart", cart);
    statusBox.textContent = `${data.command.trigger} 명령어를 ${data.room.roomName} 방에 담았습니다.`;
    await loadInstalledCommands();
    renderTemplates();
  }

  async function loadInstalledCommands() {
    if (!buyerToken || !installRoomInput.value) return;
    const response = await fetch("/api/buyer/custom-commands", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        token: buyerToken,
        applicationId: installRoomInput.value
      })
    });
    const data = await response.json();
    if (!response.ok || data.ok === false) {
      installedList.innerHTML = `<p>설치된 명령어를 불러오지 못했습니다.</p>`;
      return;
    }
    renderInstalledCommands(data.commands || []);
  }

  function renderInstalledCommands(commands) {
    if (!commands.length) {
      installedList.innerHTML = `<article class="installed-command-empty">아직 설치된 커스텀 명령어가 없습니다.</article>`;
      return;
    }
    installedList.innerHTML = commands.map((command) => `
      <article class="installed-command-card">
        <strong>${escapeHtml(command.trigger)}</strong>
        <p>${escapeHtml(command.response.split(/\n/)[0] || "응답 문구 없음")}</p>
        <span>${command.proxyCommand ? `${escapeHtml(command.proxyCommand)} 게임 연결` : "문구형"}</span>
        <button class="button button-secondary" type="button" data-delete-command="${escapeHtml(command.trigger)}">삭제</button>
      </article>
    `).join("");
  }

  async function deleteInstalledCommand(trigger) {
    const response = await fetch("/api/buyer/custom-commands/delete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        token: buyerToken,
        applicationId: installRoomInput.value,
        trigger
      })
    });
    const data = await response.json();
    statusBox.textContent = response.ok && data.ok !== false
      ? `${trigger} 명령어를 삭제했습니다.`
      : `삭제 실패: ${data.error || "unknown_error"}`;
    await loadInstalledCommands();
  }

  grid.addEventListener("click", (event) => {
    const selectButton = event.target.closest("[data-select-template]");
    const favoriteButton = event.target.closest("[data-favorite-template]");
    const cartButton = event.target.closest("[data-cart-template]");
    if (selectButton) selectTemplate(selectButton.dataset.selectTemplate);
    if (favoriteButton) toggleSet(favorites, favoriteButton.dataset.favoriteTemplate, "pixgomCommandFavorites");
    if (cartButton) toggleSet(cart, cartButton.dataset.cartTemplate, "pixgomCommandCart");
  });

  editor.addEventListener("click", async (event) => {
    if (!currentTemplateId) return;
    const template = templateById(currentTemplateId);
    if (!template) return;
    if (event.target.closest("[data-copy-current]")) {
      const trigger = editor.querySelector("[data-editor-trigger]")?.value || template.command;
      const response = editor.querySelector("[data-editor-response]")?.value || template.response;
      await navigator.clipboard.writeText(`${trigger}\n${response}`);
      statusBox.textContent = `${trigger} 템플릿을 복사했습니다.`;
    }
    if (event.target.closest("[data-favorite-current]")) toggleSet(favorites, currentTemplateId, "pixgomCommandFavorites");
    if (event.target.closest("[data-cart-current]")) toggleSet(cart, currentTemplateId, "pixgomCommandCart");
    if (event.target.closest("[data-install-current]")) await installTemplate(currentTemplateId);
  });

  installedList.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-delete-command]");
    if (button) await deleteInstalledCommand(button.dataset.deleteCommand);
  });

  filterBar.addEventListener("click", (event) => {
    const button = event.target.closest("[data-filter-mode]");
    if (!button) return;
    currentMode = button.dataset.filterMode;
    filterBar.querySelectorAll("button").forEach((item) => item.classList.toggle("is-active", item === button));
    renderTemplates();
  });

  [searchInput, categoryInput, audienceInput].forEach((input) => {
    input.addEventListener("input", renderTemplates);
    input.addEventListener("change", renderTemplates);
  });

  installRoomInput.addEventListener("change", loadInstalledCommands);
  refreshInstalledButton?.addEventListener("click", loadInstalledCommands);

  async function boot() {
    const response = await fetch("/api/command-templates");
    catalog = await response.json();
    renderCategoryOptions();
    renderSummary();
    await loadBuyerState();
    const first = catalog.templates.find((template) => template.installable && template.kind !== "fixed");
    if (first) selectTemplate(first.id);
    renderTemplates();
  }

  boot().catch((error) => {
    statusBox.textContent = `명령어 스토어를 불러오지 못했습니다: ${error.message}`;
  });
})();
