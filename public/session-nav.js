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

  const ownerToken = storageValue(sessionStorage, "pixgomOwnerToken");
  const buyerToken = storageValue(sessionStorage, "pixgomBuyerToken");
  const loggedIn = Boolean(ownerToken || buyerToken || hasSupabaseSession());
  if (!loggedIn) return;

  const targetHref = ownerToken ? "/admin" : "/console";
  const targetText = ownerToken ? "운영자 어드민" : "구매자 콘솔";

  for (const anchor of document.querySelectorAll("a")) {
    if (!isLoginLink(anchor)) continue;
    anchor.href = targetHref;
    anchor.textContent = targetText;
    anchor.classList.add("nav-logged-in");
  }
})();
