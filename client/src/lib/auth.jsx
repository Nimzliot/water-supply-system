import { createContext, useContext, useEffect, useMemo, useState } from "react";
import api, { SESSION_EXPIRED_EVENT, clearSession, getToken, storeSession } from "./api";
import { socket } from "./socket";

const AuthContext = createContext(null);
const SOCKET_RETRY_GAP_MS = 30000;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async () => {
    if (!getToken()) {
      setLoading(false);
      return;
    }

    try {
      const { data } = await api.get("/auth/profile");
      setUser(data.user);
      socket.connect();
    } catch {
      clearSession();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();

    const handleExpired = () => {
      setUser(null);
      socket.disconnect();
    };

    // The socket is rejected when its token has expired. A profile call refreshes the token.
    let lastSocketRetry = 0;
    const handleConnectError = (error) => {
      if (error?.message !== "Unauthorized" || Date.now() - lastSocketRetry < SOCKET_RETRY_GAP_MS) return;
      lastSocketRetry = Date.now();
      api.get("/auth/profile").then(() => socket.connect()).catch(() => {});
    };

    window.addEventListener(SESSION_EXPIRED_EVENT, handleExpired);
    socket.on("connect_error", handleConnectError);

    return () => {
      window.removeEventListener(SESSION_EXPIRED_EVENT, handleExpired);
      socket.off("connect_error", handleConnectError);
    };
  }, []);

  const login = async (payload) => {
    const { data } = await api.post("/auth/login", payload);
    storeSession(data.session);
    setUser(data.user);
    socket.connect();
  };

  const register = async (payload) => {
    await api.post("/auth/register", payload);
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } finally {
      clearSession();
      setUser(null);
      socket.disconnect();
    }
  };

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      register,
      logout,
      refreshProfile: loadProfile
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
