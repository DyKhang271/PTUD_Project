const AUTH_NOTICE_KEY = "timetable_auth_notice";

export const AUTH_ERROR_MESSAGES = {
  invalid_credentials: "Tai khoan hoac mat khau khong dung",
  access_denied: "Tai khoan khong co quyen truy cap he thong thoi khoa bieu",
  login_unreachable: "Khong the ket noi may chu dang nhap",
  session_expired: "Phien dang nhap da het han, vui long dang nhap lai",
  invalid_auth_response: "Khong the xac thuc phien dang nhap",
};

export class AuthError extends Error {
  constructor(code, message, options = {}) {
    super(message);
    this.name = "AuthError";
    this.code = code;
    this.status = options.status ?? null;
    this.cause = options.cause;
  }
}

export function createAuthError(code, options = {}) {
  return new AuthError(code, AUTH_ERROR_MESSAGES[code] || AUTH_ERROR_MESSAGES.invalid_auth_response, options);
}

export function setAuthNotice(message) {
  if (!message) {
    window.sessionStorage.removeItem(AUTH_NOTICE_KEY);
    return;
  }
  window.sessionStorage.setItem(AUTH_NOTICE_KEY, message);
}

export function consumeAuthNotice() {
  const value = window.sessionStorage.getItem(AUTH_NOTICE_KEY);
  window.sessionStorage.removeItem(AUTH_NOTICE_KEY);
  return value;
}

export function normalizeAuthPayload(payload, expectedRole) {
  if (!payload || payload.success !== true) {
    throw createAuthError("invalid_credentials");
  }

  const accessToken = String(payload.access_token || "").trim();
  const refreshToken = String(payload.refresh_token || "").trim();
  const tokenType = String(payload.token_type || "").trim().toLowerCase();
  const rawUser = payload.user || {};
  const userId = String(rawUser.id || rawUser.external_id || "").trim();
  const role = String(rawUser.role || payload.role || "").trim().toLowerCase();

  if (!accessToken || !refreshToken || tokenType !== "bearer" || !userId || !role) {
    throw createAuthError("invalid_auth_response");
  }

  if (expectedRole && role !== expectedRole) {
    throw createAuthError("access_denied");
  }

  if (!["student", "teacher", "admin"].includes(role)) {
    throw createAuthError("access_denied");
  }

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: tokenType,
    user: {
      id: userId,
      external_id: String(rawUser.external_id || userId),
      role,
      full_name: rawUser.full_name || null,
      email: rawUser.email || null,
    },
  };
}

export function mapLoginError(error) {
  if (error instanceof AuthError) {
    return error;
  }

  if (!error?.response) {
    return createAuthError("login_unreachable", { cause: error });
  }

  const status = error.response.status;
  const data = error.response.data || {};
  if (status === 401 || data?.success === false) {
    return createAuthError("invalid_credentials", { status, cause: error });
  }

  if (status === 403) {
    return createAuthError("access_denied", { status, cause: error });
  }

  return createAuthError("invalid_auth_response", { status, cause: error });
}

export function mapRefreshError(error) {
  if (error instanceof AuthError) {
    return error;
  }

  if (!error?.response) {
    return createAuthError("session_expired", { cause: error });
  }

  return createAuthError("session_expired", {
    status: error.response.status,
    cause: error,
  });
}
