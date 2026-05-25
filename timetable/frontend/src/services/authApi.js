import { getAuthStorageKey, portalApi } from "./api";
import { mapLoginError, normalizeAuthPayload } from "./authErrors";

const loginEndpointByRole = {
  student: "/auth/student-login",
  teacher: "/auth/teacher-login",
  admin: "/auth/admin-login",
};

export function getStoredAuth() {
  const raw = window.localStorage.getItem(getAuthStorageKey());
  return raw ? JSON.parse(raw) : null;
}

export function setStoredAuth(auth) {
  window.localStorage.setItem(getAuthStorageKey(), JSON.stringify(auth));
}

export function clearAuthStorage() {
  window.localStorage.removeItem(getAuthStorageKey());
}

export async function login(payload) {
  const role = String(payload?.role || "").trim().toLowerCase();
  const endpoint = loginEndpointByRole[role];
  if (!endpoint) {
    throw mapLoginError({ response: { status: 403, data: {} } });
  }

  const username = String(payload?.username || payload?.email || "").trim();
  const password = String(payload?.password || "");
  const requestPayload =
    role === "student"
      ? { mssv: username, password }
      : { username, password };

  try {
    const { data } = await portalApi.post(endpoint, requestPayload);
    return normalizeAuthPayload(data, role);
  } catch (error) {
    throw mapLoginError(error);
  }
}
