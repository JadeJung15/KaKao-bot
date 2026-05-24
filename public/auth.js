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
    if (currentSession?.access_token) return { accessToken: currentSession.access_token };
    return fallback;
  }

  async function signInWithPassword(email, password) {
    const supabaseClient = await client();
    if (!supabaseClient) return { local: true };
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  async function signUpWithPassword(email, password) {
    const supabaseClient = await client();
    if (!supabaseClient) return { local: true };
    const { data, error } = await supabaseClient.auth.signUp({ email, password });
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
      options: { redirectTo }
    });
    if (error) throw error;
  }

  async function signOut() {
    const supabaseClient = await client();
    if (supabaseClient) await supabaseClient.auth.signOut();
    sessionStorage.removeItem("pixgomBuyerToken");
  }

  function showAuthMode(target, cfg) {
    if (!target) return;
    if (!cfg.auth?.supabaseEnabled) {
      target.textContent = "로컬 계정 모드: 이메일/비밀번호로만 이용합니다.";
      return;
    }
    target.textContent = cfg.auth?.kakaoEnabled
      ? "Supabase 로그인 사용 중: 이메일/비밀번호 또는 카카오 로그인을 사용할 수 있습니다."
      : "Supabase 이메일 로그인을 사용합니다. 카카오 로그인은 제공자 설정 후 열립니다.";
  }

  return {
    config,
    client,
    session,
    accessPayload,
    signInWithPassword,
    signUpWithPassword,
    signInWithKakao,
    signOut,
    showAuthMode
  };
})();
