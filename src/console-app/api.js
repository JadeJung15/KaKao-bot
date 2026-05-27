export function ownerToken() {
  try {
    return sessionStorage.getItem("pixgomOwnerToken") || "";
  } catch {
    return "";
  }
}

export function buyerToken() {
  try {
    return sessionStorage.getItem("pixgomBuyerToken") || "";
  } catch {
    return "";
  }
}

export function storeTokens(payload = {}) {
  try {
    if (payload.ownerToken) sessionStorage.setItem("pixgomOwnerToken", payload.ownerToken);
    if (payload.guideToken) sessionStorage.setItem("pixgomBuyerToken", payload.guideToken);
  } catch {
    // Storage can be blocked by some embedded browsers.
  }
}

async function adminAuthHeader() {
  const token = ownerToken();
  if (token) return token;
  const auth = window.PixelgomAuth;
  if (auth?.accessPayload) {
    const payload = await auth.accessPayload({});
    if (payload.accessToken) return payload.accessToken;
  }
  return "";
}

async function buyerAuthPayload(extra = {}) {
  const auth = window.PixelgomAuth;
  if (auth?.storedAccessPayload) return auth.storedAccessPayload(extra);
  const token = buyerToken();
  return token ? { ...extra, token } : extra;
}

export async function adminRequest(path, options = {}) {
  const token = await adminAuthHeader();
  const headers = {
    "content-type": "application/json",
    ...(options.headers || {})
  };
  if (token) headers["x-admin-session"] = token;
  const response = await fetch(path, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store"
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || json.ok === false) {
    const message = json.summary || json.message || json.error || `request_failed_${response.status}`;
    throw new Error(message);
  }
  return json;
}

export async function buyerRequest(path, body = {}, options = {}) {
  const payload = await buyerAuthPayload(body);
  const response = await fetch(path, {
    method: options.method || "POST",
    headers: { "content-type": "application/json", ...(options.headers || {}) },
    body: JSON.stringify(payload),
    cache: "no-store"
  });
  const json = await response.json().catch(() => ({}));
  storeTokens(json);
  if (!response.ok || json.ok === false) {
    const message = json.summary || json.message || json.error || `request_failed_${response.status}`;
    throw new Error(message);
  }
  return json;
}

export async function buyerLogin(email, password) {
  const response = await fetch("/api/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
    cache: "no-store"
  });
  const json = await response.json().catch(() => ({}));
  storeTokens(json);
  if (!response.ok || json.ok === false) {
    throw new Error(json.error || "login_failed");
  }
  return json;
}

export function formatError(error) {
  const text = String(error?.message || error || "요청 처리에 실패했습니다.");
  const labels = {
    owner_login_required: "운영자 로그인이 필요합니다.",
    owner_only: "운영자 권한이 필요합니다.",
    buyer_login_required: "구매자 로그인이 필요합니다.",
    buyer_approval_required: "승인/입금 완료된 계정만 사용할 수 있습니다.",
    room_not_found: "방을 찾을 수 없습니다.",
    archived_room_not_found: "보관된 방을 찾을 수 없습니다.",
    inquiry_id_required: "문의 ID가 필요합니다.",
    inquiry_not_found: "문의를 찾을 수 없습니다.",
    invalid_inquiry_status: "문의 상태값이 올바르지 않습니다.",
    report_id_required: "신고 ID가 필요합니다.",
    report_not_found: "신고를 찾을 수 없습니다.",
    nickname_merge_name_required: "기준 닉과 합칠 닉을 모두 입력해 주세요.",
    target_nickname_not_found: "기준 닉 데이터를 찾을 수 없습니다.",
    source_nickname_not_found: "합칠 닉 데이터를 찾을 수 없습니다.",
    nickname_already_merged: "이미 같은 사람 데이터로 연결되어 있습니다.",
    restore_request_not_found: "복구 요청을 찾을 수 없습니다.",
    invalid_restore_request_status: "복구 요청 상태값이 올바르지 않습니다.",
    purge_confirmation_required: "완전 삭제 확인 문구가 필요합니다."
  };
  return labels[text] || text;
}
