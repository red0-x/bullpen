export const URGENCY: Record<string, string> = { today: "Today", this_week: "This week", can_wait: "Can wait" };

export const fmtWhen = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : "";

export const slug = (s: string) => s.replace(/\W+/g, "-").toLowerCase();
