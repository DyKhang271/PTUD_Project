import axios from "axios";

import { createAuthError, mapRefreshError } from "./authErrors";

const AUTH_STORAGE_KEY = "timetable_auth";

let accessToken = null;
let refreshToken = null;
let onUnauthorized = null;
let onTokenRefresh = null;
let isRefreshing = false;
let refreshSubscribers = [];

export function getAuthStorageKey() {
  return AUTH_STORAGE_KEY;
}

export function setAuthTokens(nextAccessToken, nextRefreshToken) {
  accessToken = nextAccessToken ?? null;
  refreshToken = nextRefreshToken ?? null;
}

export function clearAuthTokens() {
  accessToken = null;
  refreshToken = null;
  isRefreshing = false;
  refreshSubscribers = [];
}

export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

export function setTokenRefreshHandler(handler) {
  onTokenRefresh = handler;
}

export const api = axios.create({
  baseURL: import.meta.env.VITE_TIMETABLE_API_BASE_URL || "http://localhost:8001",
  headers: {
    "Content-Type": "application/json",
  },
});

export const portalApi = axios.create({
  baseURL: import.meta.env.VITE_PORTAL_API_BASE_URL || "http://localhost:8000/api",
  headers: {
    "Content-Type": "application/json",
  },
});

function notifyUnauthorized(error) {
  if (typeof onUnauthorized === "function") {
    onUnauthorized(error);
  }
}

function subscribeTokenRefresh() {
  return new Promise((resolve, reject) => {
    refreshSubscribers.push({ resolve, reject });
  });
}

function flushRefreshSubscribers(error, nextAccessToken) {
  const subscribers = refreshSubscribers;
  refreshSubscribers = [];
  for (const subscriber of subscribers) {
    if (error) {
      subscriber.reject(error);
    } else {
      subscriber.resolve(nextAccessToken);
    }
  }
}

api.interceptors.request.use((config) => {
  config.headers = config.headers || {};
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

async function refreshPortalAccessToken() {
  if (!refreshToken) {
    throw createAuthError("session_expired");
  }

  try {
    const { data } = await portalApi.post("/auth/refresh", {
      refresh_token: refreshToken,
    });

    const nextAccessToken = String(data?.access_token || "").trim();
    const tokenType = String(data?.token_type || "").trim().toLowerCase();
    if (!nextAccessToken || tokenType !== "bearer") {
      throw createAuthError("session_expired");
    }

    accessToken = nextAccessToken;
    if (typeof onTokenRefresh === "function") {
      onTokenRefresh(nextAccessToken);
    }
    return nextAccessToken;
  } catch (error) {
    throw mapRefreshError(error);
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error?.config;
    const status = error?.response?.status;

    if (status !== 401 || !originalRequest) {
      return Promise.reject(error);
    }

    if (originalRequest._retry) {
      const authError = createAuthError("session_expired", {
        status,
        cause: error,
      });
      notifyUnauthorized(authError);
      return Promise.reject(authError);
    }

    if (!refreshToken) {
      const authError = createAuthError("session_expired", {
        status,
        cause: error,
      });
      notifyUnauthorized(authError);
      return Promise.reject(authError);
    }

    originalRequest._retry = true;

    if (isRefreshing) {
      try {
        const nextAccessToken = await subscribeTokenRefresh();
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${nextAccessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        return Promise.reject(refreshError);
      }
    }

    isRefreshing = true;
    try {
      const nextAccessToken = await refreshPortalAccessToken();
      flushRefreshSubscribers(null, nextAccessToken);
      originalRequest.headers = originalRequest.headers || {};
      originalRequest.headers.Authorization = `Bearer ${nextAccessToken}`;
      return api(originalRequest);
    } catch (refreshError) {
      flushRefreshSubscribers(refreshError, null);
      notifyUnauthorized(refreshError);
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);
