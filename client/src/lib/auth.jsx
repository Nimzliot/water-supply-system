import { createContext, useContext, useEffect, useMemo, useState } from "react";
import api from "./api";
import { socket } from "./socket";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async () => {
    const token = localStorage.getItem("water_token");
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const { data } = await api.get("/auth/profile");
      setUser(data.user);
      socket.auth = { token };
      socket.connect();
    } catch {
      localStorage.removeItem("water_token");
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const login = async (payload) => {
    const { data } = await api.post("/auth/login", payload);
    localStorage.setItem("water_token", data.session.access_token);
    setUser(data.user);
    socket.auth = { token: data.session.access_token };
    socket.connect();
  };

  const register = async (payload) => {
    await api.post("/auth/register", payload);
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } finally {
      localStorage.removeItem("water_token");
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

