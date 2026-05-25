import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { clearAuthStorage, getStoredAuth, setStoredAuth } from "../services/authApi";
import { AUTH_ERROR_MESSAGES, consumeAuthNotice, setAuthNotice } from "../services/authErrors";
import { clearAuthTokens, setAuthTokens, setTokenRefreshHandler, setUnauthorizedHandler } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => getStoredAuth());
  const [loading, setLoading] = useState(false);
  const [authNotice, setAuthNoticeState] = useState(() => consumeAuthNotice());

  useEffect(() => {
    setAuthTokens(auth?.accessToken ?? null, auth?.refreshToken ?? null);
  }, [auth]);

  useEffect(() => {
    setUnauthorizedHandler((error) => {
      setAuthNotice(error?.message || AUTH_ERROR_MESSAGES.session_expired);
      clearAuthStorage();
      clearAuthTokens();
      setAuth(null);
      window.location.assign("/login");
    });
    setTokenRefreshHandler((nextAccessToken) => {
      setAuth((currentAuth) => {
        if (!currentAuth) {
          return currentAuth;
        }
        const nextAuth = { ...currentAuth, accessToken: nextAccessToken };
        setStoredAuth(nextAuth);
        return nextAuth;
      });
    });
  }, []);

  const value = useMemo(
    () => ({
      auth,
      authNotice,
      user: auth?.user ?? null,
      token: auth?.accessToken ?? null,
      loading,
      isAuthenticated: Boolean(auth?.accessToken),
      loginSuccess(payload) {
        const nextAuth = {
          accessToken: payload.access_token,
          refreshToken: payload.refresh_token,
          user: payload.user,
        };
        setStoredAuth(nextAuth);
        setAuth(nextAuth);
        setAuthNotice(null);
        setAuthNoticeState(null);
      },
      logout() {
        clearAuthStorage();
        clearAuthTokens();
        setAuth(null);
        setAuthNotice(null);
        setAuthNoticeState(null);
        window.location.assign("/login");
      },
      clearAuthNotice() {
        setAuthNotice(null);
        setAuthNoticeState(null);
      },
      setLoading,
    }),
    [auth, authNotice, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
