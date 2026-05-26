(() => {
  function storageValue(storage, key) {
    try {
      return storage.getItem(key) || "";
    } catch {
      return "";
    }
  }

  function hasSupabaseSession() {
    try {
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index) || "";
        if (!key.startsWith("sb-") || !key.endsWith("-auth-token")) continue;
        const value = JSON.parse(localStorage.getItem(key) || "{}");
        if (value?.access_token || value?.currentSession?.access_token) return true;
      }
    } catch {
      return false;
    }
    return false;
  }

  function isLoginLink(anchor) {
    try {
      return new URL(anchor.href, window.location.origin).pathname === "/login";
    } catch {
      return anchor.getAttribute("href") === "/login";
    }
  }

  function isConsoleLink(anchor) {
    try {
      return new URL(anchor.href, window.location.origin).pathname === "/console";
    } catch {
      return anchor.getAttribute("href") === "/console";
    }
  }

  function linkElement({ href, label, className = "" }) {
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.textContent = label;
    if (className) anchor.className = className;
    return anchor;
  }

  function normalizeSiteNavigation() {
    const header = document.querySelector(".site-header");
    const nav = header?.querySelector(".nav-links");
    if (!header || !nav || nav.dataset.pixgomUnified === "true") return;

    const primaryLinks = [
      { href: "/#features", label: "기능" },
      { href: "/command-store", label: "명령어" },
      { href: "/#pricing", label: "요금" },
      { href: "/updates", label: "업데이트" },
      { href: "/console", label: "콘솔" },
      { href: "/login", label: "로그인" },
      { href: "/apply", label: "서비스 신청", className: "nav-cta" }
    ];
    nav.replaceChildren(...primaryLinks.map(linkElement));
    nav.dataset.pixgomUnified = "true";

    if (!header.querySelector("[data-nav-menu-toggle]")) {
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "nav-menu-toggle";
      toggle.dataset.navMenuToggle = "true";
      toggle.setAttribute("aria-expanded", "false");
      toggle.textContent = "메뉴";
      toggle.addEventListener("click", () => {
        const open = header.classList.toggle("nav-open");
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
      });
      nav.insertAdjacentElement("afterend", toggle);
    }
  }

  normalizeSiteNavigation();

  const ownerToken = storageValue(sessionStorage, "pixgomOwnerToken");
  const buyerToken = storageValue(sessionStorage, "pixgomBuyerToken");
  const loggedIn = Boolean(ownerToken || buyerToken || hasSupabaseSession());
  if (!loggedIn) return;

  const targetHref = ownerToken ? "/admin" : "/console";
  const targetText = ownerToken ? "운영자 어드민" : "구매자 콘솔";

  function signOut() {
    try {
      sessionStorage.removeItem("pixgomOwnerToken");
      sessionStorage.removeItem("pixgomBuyerToken");
      for (let index = localStorage.length - 1; index >= 0; index -= 1) {
        const key = localStorage.key(index) || "";
        if (key.startsWith("sb-") && key.endsWith("-auth-token")) localStorage.removeItem(key);
      }
    } catch {
      // Ignore storage cleanup failures and still move the user to login.
    }
    window.location.href = "/login";
  }

  for (const anchor of document.querySelectorAll(".site-header a, a[href='/login']")) {
    if (isLoginLink(anchor)) {
      anchor.href = "/account";
      anchor.textContent = "정보수정";
      anchor.classList.add("nav-logged-in");
    } else if (isConsoleLink(anchor)) {
      anchor.href = targetHref;
      anchor.textContent = targetText;
      anchor.classList.add("nav-logged-in");
    } else {
      continue;
    }
    if (!document.querySelector(".site-header .nav-logout")) {
      const logoutButton = document.createElement("button");
      logoutButton.type = "button";
      logoutButton.className = "nav-logout";
      logoutButton.textContent = "로그아웃";
      logoutButton.addEventListener("click", signOut);
      anchor.insertAdjacentElement("afterend", logoutButton);
    }
  }
})();
