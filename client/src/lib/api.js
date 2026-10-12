import axios from "axios";

const baseURL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";
const TOKEN_KEY = "water_token";
const REFRESH_KEY = "water_refresh_token";
export const SESSION_EXPIRED_EVENT = "water:session-expired";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function storeSession(session) {
  localStorage.setItem(TOKEN_KEY, session.access_token);
  if (session.refresh_token) {
    localStorage.setItem(REFRESH_KEY, session.refresh_token);
  }
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

const api = axios.create({ baseURL });

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshing = null;

async function refreshSession() {
  const refresh_token = localStorage.getItem(REFRESH_KEY);
  if (!refresh_token) throw new Error("No refresh token");

  const { data } = await axios.post(`${baseURL}/auth/refresh`, { refresh_token });
  storeSession(data.session);
  return data.session.access_token;
}

// Supabase access tokens last about an hour. On a 401, swap in a fresh one and retry once.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const isSignIn = original?.url === "/auth/login" || original?.url === "/auth/register";

    if (error.response?.status !== 401 || !original || original._retried || isSignIn) {
      throw error;
    }

    original._retried = true;

    try {
      refreshing = refreshing || refreshSession().finally(() => {
        refreshing = null;
      });
      const token = await refreshing;
      original.headers.Authorization = `Bearer ${token}`;
      return api(original);
    } catch {
      clearSession();
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
      throw error;
    }
  }
);

export default api;
