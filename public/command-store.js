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
  const installedSearchInput = document.querySelector("[data-installed-search]");
  const refreshInstalledButton = document.querySelector("[data-refresh-installed]");
  const packPanel = document.querySelector("[data-command-pack-panel]");
  const packGrid = document.querySelector("[data-command-pack-grid]");
  const packCurrent = document.querySelector("[data-command-pack-current]");
  const loadMoreButton = document.querySelector("[data-load-more]");

  let catalog = { templates: [], categories: [], summary: {}, total: 0 };
  let packCatalog = { packs: [], current: {}, summary: {} };
  let buyerToken = "";
  let buyerRooms = [];
  let installedCommandsCache = [];
  let currentMode = "featured";
  let currentTemplateId = "";
  let visibleLimit = 24;
  const favorites = new Set(readList("pixgomCommandFavorites"));
  const cart = new Set(readList("pixgomCommandCart"));
  const packCart = new Set(readList("pixgomCommandPackCart"));

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

  async function copyText(value) {
    await navigator.clipboard.writeText(value);
  }

  function audienceLabel(value) {
    return value === "admin" ? "관리자용" : "참여자용";
  }

  function kindLabel(value) {
    const labels = {
      fixed: "기본 기능",
      custom: "문구형",
      bundle: "세트",
      "game-template": "게임 연결",
      roadmap: "로드맵"
    };
    return labels[value] || value;
  }

  function isBundleTemplate(template) {
    return (template.commands || []).length > 1;
  }

  function templateCommandRows(template) {
    if (isBundleTemplate(template)) return template.commands;
    return [{
      trigger: template.command,
      response: template.response || "",
      proxyCommand: template.proxyCommand || ""
    }];
  }

  function templateCardCommandText(template) {
    return isBundleTemplate(template) ? `${template.commands.length}개 세트` : template.command;
  }

  function templateInstallBadge(template) {
    if (template.status === "coming_soon") return "준비중";
    if (template.disabledReason) return "설치 불가";
    if (isBundleTemplate(template)) return `${template.commands.length}개 세트 설치`;
    if (template.proxyCommand) return `${template.proxyCommand} 연결`;
    return template.installable ? "바로 사용" : "기본/예약";
  }

  function templateById(id) {
    return catalog.templates.find((item) => item.id === id);
  }

  function packById(id) {
    return (packCatalog.packs || []).find((item) => item.id === id);
  }

  function packSlotLabel(value) {
    const labels = { pack: "명령어팩", base: "기본팩", addon: "애드온", combo: "조합팩" };
    return labels[value] || value || "팩";
  }

  function packCommandText(pack) {
    const fixed = (pack.fixedCommands || []).length;
    const custom = (pack.customCommands || []).length;
    return `${fixed + custom}개 명령어${fixed ? ` · 고정 ${fixed}개` : ""}${custom ? ` · 커스텀 ${custom}개` : ""}`;
  }

  function compactInstallCodes(codes) {
    let lastType = "";
    return codes.map((code) => {
      const match = String(code).match(/^(pk|no|st)\.(\d{3})$/);
      if (!match) return code;
      const [, type, number] = match;
      const value = type === lastType ? number : code;
      lastType = type;
      return value;
    });
  }

  function cartInstallItems() {
    const packItems = [...packCart]
      .map((id) => packById(id))
      .filter((pack) => pack?.installCode)
      .map((pack) => ({ code: pack.installCode, title: pack.title, type: "팩" }));
    const templateItems = [...cart]
      .map((id) => templateById(id))
      .filter((template) => template?.installCode)
      .map((template) => ({ code: template.installCode, title: template.title, type: template.installCodeType === "set" ? "세트" : "명령어" }));
    return [...packItems, ...templateItems];
  }

  function cartInstallCommandText() {
    const codes = compactInstallCodes(cartInstallItems().map((item) => item.code));
    return codes.length ? `/명령어설치 ${codes.join(" ")}` : "";
  }

  function renderSummary() {
    const installCommand = cartInstallCommandText();
    summary.innerHTML = `
      <article><strong>${catalog.total}</strong><span>전체 템플릿</span></article>
      <article><strong>${catalog.summary?.installable || 0}</strong><span>설치 가능</span></article>
      <article><strong>${cart.size + packCart.size}</strong><span>장바구니</span></article>
      <article><strong>${favorites.size}</strong><span>즐겨찾기</span></article>
      ${installCommand ? `
        <article class="command-cart-copy">
          <strong>카톡 설치</strong>
          <span data-cart-install-preview>${escapeHtml(installCommand)}</span>
          <button class="button button-secondary" type="button" data-copy-cart-install>카톡 설치 명령어 복사</button>
          <button class="button button-secondary" type="button" data-clear-cart>장바구니 비우기</button>
        </article>
      ` : `
        <article class="command-cart-copy">
          <strong>카톡 설치</strong>
          <span>장바구니에 담으면 한 번에 붙여넣을 설치 명령어가 만들어집니다.</span>
        </article>
      `}
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
    if (currentMode === "packs") return false;
    if (currentMode === "bundle") return isBundleTemplate(template);
    if (currentMode === "installable") return template.installable;
    if (currentMode === "game") return template.kind === "game-template" || template.categoryId === "bundle-game" || (template.commands || []).some((command) => command.proxyCommand);
    if (currentMode === "participant") return template.audience === "participant";
    if (currentMode === "admin") return template.audience === "admin";
    if (currentMode === "favorite") return favorites.has(template.id);
    if (currentMode === "cart") return cart.has(template.id);
    return true;
  }

  function renderCommandPacks() {
    if (!packPanel || !packGrid) return;
    const current = packCatalog.current || {};
    const packs = packCatalog.packs || [];
    packPanel.hidden = currentMode !== "packs" && !packs.some((pack) => pack.installed);
    if (packPanel.hidden) return;
    const installedTitles = packs.filter((pack) => (current.installedPackIds || []).includes(pack.id)).map((pack) => pack.title);
    packCurrent.textContent = installedTitles.length
      ? `현재 ${installedTitles.join(", ")}`
      : "아직 장착된 명령어 팩이 없습니다.";
    const visiblePacks = currentMode === "packs" ? packs : packs.filter((pack) => pack.installed);
    packGrid.innerHTML = visiblePacks.map((pack) => {
      const actionLabel = pack.installed ? "해제" : "장착";
      return `
        <article class="command-pack-card" data-installed="${pack.installed ? "true" : "false"}">
          <div>
            <span>${escapeHtml(packSlotLabel(pack.slot))} · ${escapeHtml(pack.tier)}</span>
            <strong>${escapeHtml(pack.title)}</strong>
          </div>
          <p>${escapeHtml(pack.description)}</p>
          <small>${escapeHtml(pack.installCode ? `${pack.installCode} · ${packCommandText(pack)}` : packCommandText(pack))}</small>
          <div class="template-badges">
            ${(pack.fixedCommands || []).slice(0, 4).map((command) => `<span>${escapeHtml(command)}</span>`).join("")}
            ${(pack.customCommands || []).slice(0, 4).map((command) => `<span>${escapeHtml(command.trigger)}</span>`).join("")}
          </div>
          <div class="template-actions">
            <button class="button button-secondary" type="button" data-cart-pack="${escapeHtml(pack.id)}">${packCart.has(pack.id) ? "장바구니 제거" : "장바구니 담기"}</button>
            <button class="button button-primary" type="button" data-apply-pack="${escapeHtml(pack.id)}" data-pack-action="${pack.installed ? "remove" : "apply"}" ${buyerToken && buyerRooms.length ? "" : "disabled"}>${escapeHtml(actionLabel)}</button>
          </div>
        </article>
      `;
    }).join("");
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
      template.kind,
      templateInstallBadge(template),
      ...(template.commands || []).flatMap((command) => [command.trigger, command.response]),
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
    renderCommandPacks();
    const matchedTemplates = catalog.templates.filter(templateMatches);
    const templates = matchedTemplates.slice(0, visibleLimit);
    grid.innerHTML = templates.map((template) => `
      <article class="template-card ${template.id === currentTemplateId ? "is-selected" : ""}">
        <button class="template-select" type="button" data-select-template="${escapeHtml(template.id)}">
          <span>${escapeHtml(template.categoryTitle)}</span>
          <strong>${escapeHtml(templateCardCommandText(template))}</strong>
          <b>${escapeHtml(template.title)}</b>
        </button>
        <p>${escapeHtml(template.description)}</p>
        <div class="template-badges">
          ${template.installCode ? `<span>${escapeHtml(template.installCode)}</span>` : ""}
          <span>${escapeHtml(audienceLabel(template.audience))}</span>
          <span>${escapeHtml(kindLabel(template.kind))}</span>
          <span>${escapeHtml(templateInstallBadge(template))}</span>
        </div>
        <div class="template-actions">
          <button class="button button-secondary" type="button" data-favorite-template="${escapeHtml(template.id)}">${favorites.has(template.id) ? "즐겨찾기 해제" : "즐겨찾기"}</button>
          <button class="button button-secondary" type="button" data-cart-template="${escapeHtml(template.id)}">${cart.has(template.id) ? "장바구니 제거" : "장바구니"}</button>
        </div>
      </article>
    `).join("");
    if (!templates.length) grid.innerHTML = `<article class="buyer-empty"><h3>검색 결과 없음</h3><p>추천, 설치 가능, 게임 연결 같은 빠른 보기를 선택해 범위를 줄여보세요.</p></article>`;
    if (loadMoreButton) {
      loadMoreButton.hidden = matchedTemplates.length <= visibleLimit;
      loadMoreButton.textContent = `더 보기 (${templates.length}/${matchedTemplates.length})`;
    }
    statusBox.textContent = `현재 ${templates.length}개를 표시 중입니다. 중복 템플릿은 대표 명령어 1개로 정리했고 기본 추천은 /공지 같은 슬래시 명령어를 우선합니다.`;
    renderSummary();
  }

  function renderEditor(template) {
    const installDisabledReason = !template.installable
      ? (template.disabledReason || "고정 명령어는 설치할 수 없습니다.")
      : !buyerToken
        ? "구매자 로그인 후 설치할 수 있습니다."
        : !buyerRooms.length
          ? "승인된 방이 있어야 설치할 수 있습니다."
          : "";
    const rows = templateCommandRows(template);
    const isBundle = rows.length > 1;
    const editorFields = isBundle
      ? `<div class="template-set-editor">
          ${rows.map((row, index) => `
            <fieldset class="template-command-row" data-editor-command-row="${index}">
              <legend>${index + 1}. ${escapeHtml(row.trigger)}</legend>
              <label>명령어
                <input id="editor-trigger-${index}" name="editorTrigger${index}" data-editor-command-trigger type="text" value="${escapeHtml(row.trigger)}" placeholder="/공지, 공지, !공지, .공지" ${template.installable ? "" : "disabled"}>
              </label>
              <label>응답 문구
                <textarea id="editor-response-${index}" name="editorResponse${index}" data-editor-command-response rows="5" ${template.installable ? "" : "disabled"}>${escapeHtml(row.response || "")}</textarea>
              </label>
              ${row.proxyCommand ? `<span>${escapeHtml(row.proxyCommand)} 게임 엔진 연결</span>` : ""}
            </fieldset>
          `).join("")}
        </div>`
      : `<label class="wide-label">명령어
          <input id="editor-trigger" name="editorTrigger" data-editor-trigger type="text" value="${escapeHtml(template.command)}" placeholder="/공지, 공지, !공지, .공지" ${template.installable ? "" : "disabled"}>
        </label>
        <label class="wide-label">응답 문구
          <textarea id="editor-response" name="editorResponse" data-editor-response rows="9" ${template.installable ? "" : "disabled"}>${escapeHtml(template.response || "서버에 내장된 고정 기능입니다.")}</textarea>
        </label>`;
    editor.innerHTML = `
      <div class="template-editor-head">
        <p class="section-kicker">Editor</p>
        <h2>${escapeHtml(template.title)}</h2>
        <span>${escapeHtml(template.categoryTitle)} · ${escapeHtml(audienceLabel(template.audience))} · ${escapeHtml(templateInstallBadge(template))}</span>
      </div>
      ${editorFields}
      <div class="template-editor-note">
        ${escapeHtml(installDisabledReason || (isBundle ? "세트 안의 명령어와 응답문구를 각각 수정한 뒤 한 번에 설치합니다." : template.proxyCommand ? `${template.proxyCommand} 미니게임 엔진에 연결됩니다.` : "응답문구는 바로 채팅방에서 사용할 수 있는 문장으로 준비되어 있습니다. / 없이도 가능하고 /, !, . 같은 접두 문자도 구분합니다."))}
      </div>
      <div class="template-install-preview" data-install-preview>
        <strong>설치 전 카카오 응답 미리보기</strong>
        <div data-preview-list></div>
      </div>
      <div class="template-actions">
        <button class="button button-secondary" type="button" data-copy-current>응답 문구 복사</button>
        <button class="button button-secondary" type="button" data-copy-install-current ${template.installCode ? "" : "disabled"}>설치 명령어 복사</button>
        <button class="button button-secondary" type="button" data-favorite-current>${favorites.has(template.id) ? "즐겨찾기 해제" : "즐겨찾기"}</button>
        <button class="button button-secondary" type="button" data-cart-current>${cart.has(template.id) ? "장바구니 제거" : "장바구니"}</button>
        <button class="button button-primary" type="button" data-install-current ${template.installable && buyerToken && buyerRooms.length ? "" : "disabled"}>${isBundle ? "세트 설치" : "편집 내용 설치"}</button>
      </div>
    `;
    editor.querySelectorAll("input, textarea").forEach((input) => {
      input.addEventListener("input", () => renderInstallPreview(template));
    });
    renderInstallPreview(template);
  }

  function renderInstallPreview(template) {
    const previewList = editor.querySelector("[data-preview-list]");
    if (!previewList) return;
    const rows = readEditorCommands(template).filter((command) => command.trigger || command.response);
    previewList.innerHTML = rows.map((command) => `
      <article class="preview-command-card">
        <span>사용자가 ${escapeHtml(command.trigger || "명령어")} 입력</span>
        <p>${escapeHtml(command.response || "응답 문구를 입력해 주세요.")}</p>
        ${command.proxyCommand ? `<small>${escapeHtml(command.proxyCommand)} 게임 엔진으로 연결됩니다.</small>` : ""}
      </article>
    `).join("");
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

  function clearCart() {
    cart.clear();
    packCart.clear();
    writeSet("pixgomCommandCart", cart);
    writeSet("pixgomCommandPackCart", packCart);
    renderSummary();
    renderTemplates();
  }

  async function loadCommandPacks() {
    const response = await fetch("/api/command-packs");
    const data = await response.json();
    if (response.ok && data.ok !== false) packCatalog = data;
    renderCommandPacks();
    renderSummary();
  }

  async function loadRoomCommandPacks() {
    if (!buyerToken || !installRoomInput.value) return;
    const response = await fetch("/api/buyer/room-command-packs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: buyerToken, applicationId: installRoomInput.value })
    });
    const data = await response.json();
    if (!response.ok || data.ok === false) return;
    if (data.guideToken) {
      buyerToken = data.guideToken;
      sessionStorage.setItem("pixgomBuyerToken", buyerToken);
    }
    packCatalog = data;
    renderCommandPacks();
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
        const preferredRoom = new URLSearchParams(window.location.search).get("room");
        if (preferredRoom && buyerRooms.some((room) => room.applicationId === preferredRoom)) installRoomInput.value = preferredRoom;
        await loadRoomCommandPacks();
        await loadInstalledCommands();
      } else {
        statusBox.textContent = "로그인은 확인됐지만 승인된 방이 없어 설치 버튼을 사용할 수 없습니다.";
      }
    } catch {
      buyerToken = "";
      buyerRooms = [];
    }
  }

  function readEditorCommands(template) {
    const rows = [...editor.querySelectorAll("[data-editor-command-row]")];
    if (rows.length) {
      const fallbackRows = templateCommandRows(template);
      return rows.map((row, index) => ({
        trigger: row.querySelector("[data-editor-command-trigger]")?.value || fallbackRows[index]?.trigger || "",
        response: row.querySelector("[data-editor-command-response]")?.value || fallbackRows[index]?.response || "",
        proxyCommand: fallbackRows[index]?.proxyCommand || ""
      }));
    }
    return [{
      trigger: editor.querySelector("[data-editor-trigger]")?.value || template.command,
      response: editor.querySelector("[data-editor-response]")?.value || template.response,
      proxyCommand: template.proxyCommand || ""
    }];
  }

  function editorClipboardText(template) {
    return readEditorCommands(template)
      .map((command) => `${command.trigger}\n${command.response}`)
      .join("\n\n---\n\n");
  }

  async function installTemplate(templateId) {
    const template = templateById(templateId);
    if (!template) return;
    if (!buyerToken) {
      statusBox.textContent = "구매자 로그인 후 설치할 수 있습니다.";
      return;
    }
    if (!installRoomInput.value) {
      statusBox.textContent = "설치할 방을 먼저 선택하세요. 승인된 방이 없다면 구매자 콘솔에서 신청/결제 상태를 확인해주세요.";
      return;
    }
    const editedCommands = readEditorCommands(template);
    const singleCommand = editedCommands[0] || {};
    const response = await fetch("/api/buyer/command-templates/install", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        token: buyerToken,
        applicationId: installRoomInput.value,
        templateId,
        trigger: singleCommand.trigger,
        response: singleCommand.response,
        commands: editedCommands
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
    statusBox.textContent = data.installedCount > 1
      ? `${data.installedCount}개 명령어 세트를 ${data.room.roomName} 방에 설치했습니다.`
      : `${data.command.trigger} 명령어를 ${data.room.roomName} 방에 담았습니다.`;
    await loadInstalledCommands();
    renderTemplates();
  }

  async function applyCommandPack(packId, action = "apply") {
    const pack = packById(packId);
    if (!pack) return;
    if (!buyerToken || !installRoomInput.value) {
      statusBox.textContent = "구매자 로그인 후 명령어 팩을 장착할 수 있습니다.";
      return;
    }
    const body = { token: buyerToken, applicationId: installRoomInput.value, commandPackId: pack.id, action };
    const response = await fetch("/api/buyer/command-packs/apply", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await response.json();
    if (!response.ok || data.ok === false) {
      statusBox.textContent = `팩 장착 실패: ${data.error || "unknown_error"}`;
      return;
    }
    if (data.guideToken) {
      buyerToken = data.guideToken;
      sessionStorage.setItem("pixgomBuyerToken", buyerToken);
    }
    packCart.delete(pack.id);
    writeSet("pixgomCommandPackCart", packCart);
    statusBox.textContent = `${pack.title} ${action === "remove" ? "해제" : "장착"} 완료`;
    await loadRoomCommandPacks();
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
    installedCommandsCache = data.commands || [];
    renderInstalledCommands(installedCommandsCache);
  }

  function renderInstalledCommands(commands) {
    const term = (installedSearchInput?.value || "").trim().toLowerCase();
    const filtered = term
      ? commands.filter((command) => [command.trigger, command.response, command.proxyCommand, command.sourceTemplateKind].join(" ").toLowerCase().includes(term))
      : commands;
    if (!filtered.length) {
      installedList.innerHTML = `<article class="installed-command-empty">아직 설치된 커스텀 명령어가 없습니다.</article>`;
      return;
    }
    installedList.innerHTML = filtered.map((command) => `
      <article class="installed-command-card">
        <strong>${escapeHtml(command.trigger)}</strong>
        <p>${escapeHtml(command.response.split(/\n/)[0] || "응답 문구 없음")}</p>
        <span>${command.sourcePackTitle ? `${escapeHtml(command.sourcePackTitle)} 소속` : command.proxyCommand ? `${escapeHtml(command.proxyCommand)} 게임 연결` : "문구형"}</span>
        <small>${escapeHtml(command.updatedAt ? `수정 ${command.updatedAt.slice(0, 10)}` : "수정일 미기록")}</small>
        <button class="button button-secondary" type="button" data-edit-command="${escapeHtml(command.trigger)}">편집</button>
        <button class="button button-secondary" type="button" data-delete-command="${escapeHtml(command.trigger)}">삭제</button>
      </article>
    `).join("");
  }

  function editInstalledCommand(trigger) {
    const command = installedCommandsCache.find((item) => item.trigger === trigger);
    if (!command) return;
    const template = templateById(command.sourceTemplateId) || catalog.templates.find((item) => item.installable && !isBundleTemplate(item));
    if (!template) {
      statusBox.textContent = `${trigger} 명령어를 편집할 템플릿을 찾지 못했습니다.`;
      return;
    }
    selectTemplate(template.id);
    const rows = [...editor.querySelectorAll("[data-editor-command-row]")];
    if (rows.length) {
      const row = rows.find((item) => item.querySelector("[data-editor-command-trigger]")?.value === command.trigger) || rows[0];
      const triggerInput = row.querySelector("[data-editor-command-trigger]");
      const responseInput = row.querySelector("[data-editor-command-response]");
      if (triggerInput) triggerInput.value = command.trigger;
      if (responseInput) responseInput.value = command.response;
    } else {
      const triggerInput = editor.querySelector("[data-editor-trigger]");
      const responseInput = editor.querySelector("[data-editor-response]");
      if (triggerInput) triggerInput.value = command.trigger;
      if (responseInput) responseInput.value = command.response;
    }
    renderInstallPreview(template);
    editor.scrollIntoView({ behavior: "smooth", block: "start" });
    statusBox.textContent = `${trigger} 명령어를 Editor로 불러왔습니다. 응답을 수정한 뒤 다시 설치하면 업데이트됩니다.`;
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

  packGrid?.addEventListener("click", async (event) => {
    const cartButton = event.target.closest("[data-cart-pack]");
    const applyButton = event.target.closest("[data-apply-pack]");
    if (cartButton) toggleSet(packCart, cartButton.dataset.cartPack, "pixgomCommandPackCart");
    if (applyButton) await applyCommandPack(applyButton.dataset.applyPack, applyButton.dataset.packAction || "apply");
  });

  summary.addEventListener("click", async (event) => {
    if (event.target.closest("[data-copy-cart-install]")) {
      const command = cartInstallCommandText();
      if (!command) return;
      await copyText(command);
      const items = cartInstallItems();
      statusBox.textContent = `${items.length}개 항목의 카톡 설치 명령어를 복사했습니다. 채팅방에 붙여넣은 뒤 /설치확인 코드로 완료하세요.`;
    }
    if (event.target.closest("[data-clear-cart]")) {
      clearCart();
      statusBox.textContent = "장바구니를 비웠습니다.";
    }
  });

  editor.addEventListener("click", async (event) => {
    if (!currentTemplateId) return;
    const template = templateById(currentTemplateId);
    if (!template) return;
    if (event.target.closest("[data-copy-current]")) {
      await copyText(editorClipboardText(template));
      statusBox.textContent = `${template.title} 응답 문구를 복사했습니다.`;
    }
    if (event.target.closest("[data-copy-install-current]")) {
      if (!template.installCode) return;
      await copyText(`/명령어설치 ${template.installCode}`);
      statusBox.textContent = `${template.installCode} 설치 명령어를 복사했습니다. 채팅방에 붙여넣어 미리보기를 확인하세요.`;
    }
    if (event.target.closest("[data-favorite-current]")) toggleSet(favorites, currentTemplateId, "pixgomCommandFavorites");
    if (event.target.closest("[data-cart-current]")) toggleSet(cart, currentTemplateId, "pixgomCommandCart");
    if (event.target.closest("[data-install-current]")) await installTemplate(currentTemplateId);
  });

  installedList.addEventListener("click", async (event) => {
    const editButton = event.target.closest("[data-edit-command]");
    const button = event.target.closest("[data-delete-command]");
    if (editButton) editInstalledCommand(editButton.dataset.editCommand);
    if (button) await deleteInstalledCommand(button.dataset.deleteCommand);
  });

  filterBar.addEventListener("click", (event) => {
    const button = event.target.closest("[data-filter-mode]");
    if (!button) return;
    currentMode = button.dataset.filterMode;
    visibleLimit = 24;
    filterBar.querySelectorAll("button").forEach((item) => item.classList.toggle("is-active", item === button));
    renderTemplates();
  });

  [searchInput, categoryInput, audienceInput].forEach((input) => {
    input.addEventListener("input", () => {
      visibleLimit = 24;
      renderTemplates();
    });
    input.addEventListener("change", () => {
      visibleLimit = 24;
      renderTemplates();
    });
  });

  installRoomInput.addEventListener("change", async () => {
    await loadRoomCommandPacks();
    await loadInstalledCommands();
  });
  installedSearchInput?.addEventListener("input", () => renderInstalledCommands(installedCommandsCache));
  refreshInstalledButton?.addEventListener("click", loadInstalledCommands);
  loadMoreButton?.addEventListener("click", () => {
    visibleLimit += 24;
    renderTemplates();
  });

  async function boot() {
    const response = await fetch("/api/command-templates");
    catalog = await response.json();
    renderCategoryOptions();
    renderSummary();
    await loadCommandPacks();
    await loadBuyerState();
    const first = catalog.templates.find((template) => template.installable && template.kind !== "fixed");
    if (first) selectTemplate(first.id);
    renderTemplates();
  }

  boot().catch((error) => {
    statusBox.textContent = `명령어 스토어를 불러오지 못했습니다: ${error.message}`;
  });
})();
