import axios from "axios";

export const api = axios.create({
  baseURL: `${process.env.REACT_APP_BACKEND_URL}/api`,
  withCredentials: true,
  timeout: 20000,
});

api.interceptors.response.use(null, async (err) => {
  const cfg = err.config;
  const skip = ["/auth/refresh", "/auth/login", "/auth/register"].some((p) => cfg?.url?.includes(p));
  if (err.response?.status === 401 && cfg && !cfg._retried && !skip) {
    cfg._retried = true;
    try {
      await api.post("/auth/refresh");
      return api(cfg);
    } catch {
      return Promise.reject(err);
    }
  }
  return Promise.reject(err);
});

export function errorText(err) {
  const detail = err?.response?.data?.detail;
  if (!detail) return err?.code === "ECONNABORTED" ? "That took too long. Please try again." : "Something went wrong. Please try again.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((d) => d?.msg || "").filter(Boolean).join(" ");
  return detail.msg || String(detail);
}
