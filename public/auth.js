window.PixelgomAuth = (() => {
  let configPromise;
  let clientPromise;
  const KAKAO_LOGIN_SCOPES = "profile_nickname";

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
    const supabaseClient = await client();
    if (!supabaseClient || !cfg.auth?.kakaoEnabled) throw new Error("kakao_login_not_configured");
    const redirectTo = `${window.location.origin}${redirectPath}`;
    const { error } = await supabaseClient.auth.signInWithOAuth({
      provider: "kakao",
      options: { redirectTo, scopes: KAKAO_LOGIN_SCOPES }
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

  return {
    config,
    client,
    session,
    accessPayload,
    signInWithPassword,
    signUpWithPassword,
    resetPasswordForEmail,
    updatePassword,
    signInWithKakao,
    signOut,
    showAuthMode
  };
})();
