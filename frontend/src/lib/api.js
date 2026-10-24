import axios from "axios";

export const api = axios.create({
  baseURL: `${process.env.REACT_APP_BACKEND_URL}/api`,
  withCredentials: true,
  timeout: 20000,
});

export function errorText(err) {
  const detail = err?.response?.data?.detail;
  if (!detail) return err?.code === "ECONNABORTED" ? "That took too long. Please try again." : "Something went wrong. Please try again.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((d) => d?.msg || "").filter(Boolean).join(" ");
  return detail.msg || String(detail);
}
