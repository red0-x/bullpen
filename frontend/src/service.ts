// Appliance service schedule helpers (dates are local "YYYY-MM-DD" days).
export type Service = { interval_months: 3 | 6 | 12; next_due: string; last_done?: string | null; email: boolean; days_left?: number; label?: string; state?: "overdue" | "soon" | "ok" };

export const EVERY: Record<number, string> = { 3: "Every 3 months", 6: "Every 6 months", 12: "Every year" };
export const SOON_DAYS = 30;

export const parseDay = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
};
export const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const startOfToday = () => { const t = new Date(); t.setHours(0, 0, 0, 0); return t; };

export const fmtDay = (iso?: string | null, year = false) =>
  iso ? parseDay(iso).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric", ...(year ? { year: "numeric" } : {}) }) : "";
// Datetimes from the server (created_at etc.) in the phone's own time zone.
export const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }) : "");

export const daysUntil = (iso: string) => Math.round((parseDay(iso).getTime() - startOfToday().getTime()) / 864e5);

export const dueText = (days: number) =>
  days < 0 ? `Overdue by ${-days} day${days === -1 ? "" : "s"}` : days === 0 ? "Due today" : `Due in ${days} day${days === 1 ? "" : "s"}`;

export function serviceBadge(svc?: Service | null): { kind: "warn" | "ready"; label: string } | null {
  if (!svc) return null;
  const d = daysUntil(svc.next_due);
  if (d < 0) return { kind: "warn", label: "Overdue" };
  if (d <= SOON_DAYS) return { kind: "warn", label: dueText(d) };
  return { kind: "ready", label: `Next ${parseDay(svc.next_due).toLocaleDateString([], { month: "short", year: "numeric" })}` };
}

export const money = (n?: number | null) =>
  n == null ? "" : n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });

// "$1,250.50" / "1250.5" -> 1250.5; empty -> null
export const parseMoney = (s: string) => {
  const v = parseFloat(s.replace(/[^0-9.]/g, ""));
  return Number.isFinite(v) ? Math.round(v * 100) / 100 : null;
};
