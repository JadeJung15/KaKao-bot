window.PixelgomAuth = (() => {
  let configPromise;
  let clientPromise;

  async function config() {
    if (!configPromise) {
      configPromise = fetch("/api/auth/config", { cache: "no-store" })
        .then((response) => response.json())
        .catch(() => ({ ok: false, auth: { mode: "local" } }));
    }
    return configPromise;
  }

  async function client() {
    const cfg = await config();
    if (!cfg.auth?.supabaseEnabled || !window.supabase?.createClient) return null;
    if (!clientPromise) {
      clientPromise = Promise.resolve(window.supabase.createClient(cfg.auth.supabaseUrl, cfg.auth.supabaseAnonKey));
    }
    return clientPromise;
  }

  async function session() {
    const supabaseClient = await client();
    if (!supabaseClient) return null;
    const { data } = await supabaseClient.auth.getSession();
    return data?.session || null;
  }

  async function accessPayload(fallback = {}) {
    const currentSession = await session();
    if (currentSession?.access_token) return { ...fallback, accessToken: currentSession.access_token };
    return fallback;
  }

  async function storedAccessPayload(fallback = {}) {
    const payload = await accessPayload(fallback);
    if (payload.accessToken) return payload;
    try {
      const buyerToken = sessionStorage.getItem("pixgomBuyerToken");
      if (buyerToken) return { ...fallback, token: buyerToken };
    } catch {
      // Storage can be blocked in some in-app browsers.
    }
    return fallback;
  }

  function hasStoredSessionHint() {
    try {
      if (sessionStorage.getItem("pixgomBuyerToken") || sessionStorage.getItem("pixgomOwnerToken")) return true;
    } catch {
      // Storage can be blocked in some in-app browsers.
    }
    const storageList = [];
    try { storageList.push(localStorage); } catch {}
    try { storageList.push(sessionStorage); } catch {}
    return storageList.some((storage) => {
      try {
        for (let index = 0; index < storage.length; index += 1) {
          const key = storage.key(index) || "";
          if (/^sb-.+-auth-token$/.test(key) && storage.getItem(key)) return true;
        }
      } catch {
        return false;
      }
      return false;
    });
  }

  function createSilentGate(options = {}) {
    const root = options.root || document.body;
    const status = options.status || null;
    const checkingClass = options.checkingClass || "auth-checking";
    const progressClass = options.progressClass || "auth-progress-visible";
    const delayMs = Number.isFinite(options.delayMs) ? options.delayMs : 260;
    const hasHint = hasStoredSessionHint();
    let finished = false;
    const timer = window.setTimeout(() => {
      if (!finished && hasHint) root?.classList.add(progressClass);
    }, delayMs);

    function finish(message = "") {
      finished = true;
      window.clearTimeout(timer);
      root?.classList.remove(checkingClass, progressClass);
      if (status) status.textContent = message;
    }

    function keepQuiet(message = "") {
      if (status) status.textContent = message;
    }

    if (!hasHint) root?.classList.remove(progressClass);
    else keepQuiet("");
    return { hasHint, finish, keepQuiet };
  }

  async function signInWithPassword(email, password) {
    const supabaseClient = await client();
    if (!supabaseClient) return { local: true };
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  async function signUpWithPassword(email, password, metadata = {}) {
    const supabaseClient = await client();
    if (!supabaseClient) return { local: true };
    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
        emailRedirectTo: `${window.location.origin}/signup`
      }
    });
    if (error) throw error;
    return data;
  }

  async function resetPasswordForEmail(email) {
    const supabaseClient = await client();
    if (!supabaseClient) throw new Error("password_reset_requires_supabase");
    const redirectTo = `${window.location.origin}/reset-password`;
    const { data, error } = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
    return data;
  }

  async function updatePassword(password) {
    const supabaseClient = await client();
    if (!supabaseClient) throw new Error("password_reset_requires_supabase");
    const { data, error } = await supabaseClient.auth.updateUser({ password });
    if (error) throw error;
    return data;
  }

  async function signInWithKakao(redirectPath = "/login") {
    const cfg = await config();
    if (cfg.auth?.kakaoOidcEnabled && cfg.auth?.kakaoOidcStartUrl) {
      window.location.href = `${cfg.auth.kakaoOidcStartUrl}?redirect=${encodeURIComponent(redirectPath)}`;
      return;
    }
    const supabaseClient = await client();
    if (!supabaseClient || !cfg.auth?.kakaoEnabled) throw new Error("kakao_login_not_configured");
    const redirectTo = `${window.location.origin}${redirectPath}`;
    const { error } = await supabaseClient.auth.signInWithOAuth({
      provider: "kakao",
      options: { redirectTo }
    });
    if (error) throw error;
  }

  async function signOut() {
    const supabaseClient = await client();
    if (supabaseClient) await supabaseClient.auth.signOut();
    sessionStorage.removeItem("pixgomBuyerToken");
    sessionStorage.removeItem("pixgomOwnerToken");
  }

  function showAuthMode(target, cfg) {
    if (!target) return;
    if (!cfg.auth?.supabaseEnabled) {
      target.textContent = "로컬 계정 모드: 이메일/비밀번호로만 이용합니다.";
      return;
    }
    target.textContent = cfg.auth?.kakaoEnabled
      ? "이메일 또는 카카오로 시작할 수 있습니다."
      : "이메일로 시작할 수 있습니다.";
  }

  function friendlyError(error) {
    const raw = typeof error === "string"
      ? error
      : (error?.message || error?.error || "unknown_error");
    const normalized = String(raw).trim();
    const lower = normalized.toLowerCase();
    const labels = {
      email_required: "이메일을 입력해 주세요.",
      password_required: "비밀번호를 입력해 주세요.",
      password_too_short: "비밀번호는 8자 이상으로 입력해 주세요.",
      password_mismatch: "비밀번호가 일치하지 않습니다.",
      nickname_required: "닉네임을 입력해 주세요.",
      nickname_invalid: "닉네임은 2~30자로 입력해 주세요.",
      terms_required: "필수 약관에 동의해 주세요.",
      privacy_required: "개인정보처리방침에 동의해 주세요.",
      room_name_required: "방 이름을 입력해 주세요. 예: 주식 공부방, 팬카페 공지방",
      openchat_link_required: "오픈채팅방 링크를 https://open.kakao.com/o/... 형식으로 입력해 주세요.",
      room_link_required: "오픈채팅방 링크를 입력해 주세요.",
      admin_name_required: "카톡방에서 사용할 관리자 닉네임을 입력해 주세요.",
      contact_required: "연락 가능한 카카오ID 또는 연락처를 입력해 주세요.",
      invalid_login: "이메일 또는 비밀번호를 확인해 주세요.",
      login_failed: "로그인 정보를 확인해 주세요.",
      signup_failed: "회원가입 정보를 다시 확인해 주세요.",
      apply_failed: "신청 정보를 다시 확인해 주세요.",
      profile_update_failed: "닉네임 저장 정보를 다시 확인해 주세요.",
      inquiry_message_required: "문의 내용을 입력해 주세요.",
      invalid_inquiry_token: "문의 작성 권한을 확인하지 못했습니다. 로그인 후 다시 시도해 주세요.",
      inquiry_token_used: "이미 문의가 접수되었습니다. 추가 문의는 로그인 후 콘솔에서 진행해 주세요.",
      inquiry_token_expired: "문의 작성 시간이 만료되었습니다. 로그인 후 다시 문의해 주세요.",
      application_forbidden: "다른 계정의 신청 내역에는 문의할 수 없습니다.",
      buyer_approval_required: "아직 구매 승인 전입니다. 신청/입금 상태를 먼저 확인해 주세요.",
      receiver_approval_required: "서비스 신청과 입금승인이 완료된 계정만 받을 수 있습니다.",
      transfer_code_required: "6자리 이관 코드를 입력해 주세요.",
      transfer_code_not_found: "유효한 이관 코드를 찾지 못했습니다.",
      transfer_code_expired: "이관 코드가 만료되었습니다. 보내는 사람에게 새 코드를 요청해 주세요.",
      transfer_code_used: "이미 사용된 이관 코드입니다.",
      self_transfer_not_allowed: "같은 계정으로는 방을 이관할 수 없습니다.",
      email_already_registered: "이미 가입된 이메일입니다. 로그인 후 서비스 신청을 진행해 주세요.",
      kakao_login_not_configured: "카카오 로그인이 아직 설정되지 않았습니다. 이메일 로그인을 이용해 주세요.",
      password_reset_requires_supabase: "비밀번호 재설정은 이메일 인증 모드에서 사용할 수 있습니다."
    };
    if (labels[normalized]) return labels[normalized];
    if (lower.includes("invalid login credentials")) return labels.invalid_login;
    if (lower.includes("already registered") || lower.includes("already exists")) return labels.email_already_registered;
    if (lower.includes("email")) return normalized;
    return labels[lower] || normalized || "처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.";
  }

  return {
    config,
    client,
    session,
    accessPayload,
    storedAccessPayload,
    hasStoredSessionHint,
    createSilentGate,
    signInWithPassword,
    signUpWithPassword,
    resetPasswordForEmail,
    updatePassword,
    signInWithKakao,
    signOut,
    showAuthMode,
    friendlyError
  };
})();
