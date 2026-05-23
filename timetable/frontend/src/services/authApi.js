import { api, getAuthStorageKey } from "./api";

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
  const { data } = await api.post("/auth/login", payload);
  return data;
}
