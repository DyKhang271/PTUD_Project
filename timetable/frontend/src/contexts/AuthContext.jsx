import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { clearAuthStorage, getStoredAuth, setStoredAuth } from "../services/authApi";
import { setAccessToken, setUnauthorizedHandler } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => getStoredAuth());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setAccessToken(auth?.accessToken ?? null);
  }, [auth]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearAuthStorage();
      setAuth(null);
      window.location.assign("/login");
    });
  }, []);

  const value = useMemo(
    () => ({
      auth,
      user: auth?.user ?? null,
      token: auth?.accessToken ?? null,
      loading,
      isAuthenticated: Boolean(auth?.accessToken),
      loginSuccess(payload) {
        const nextAuth = {
          accessToken: payload.access_token,
          user: payload.user,
        };
        setStoredAuth(nextAuth);
        setAuth(nextAuth);
      },
      logout() {
        clearAuthStorage();
        setAuth(null);
        window.location.assign("/login");
      },
      setLoading,
    }),
    [auth, loading],
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
