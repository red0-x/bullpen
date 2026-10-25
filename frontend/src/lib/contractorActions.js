"use client";

import { toast } from "sonner";
import { api, errorText } from "@/lib/api";

async function patch(id, body) {
  const { data } = await api.patch(`/contractors/${id}`, body);
  return data.before;
}

export function useContractorActions(reload) {
  const run = async (c, body, message) => {
    try {
      const before = await patch(c.id, body);
      reload();
      toast.success(message, {
        duration: 8000,
        action: { label: "Undo", onClick: async () => { await patch(c.id, before).catch(() => {}); reload(); } },
      });
    } catch (e) {
      toast.error(errorText(e));
    }
  };
  const name = (c) => c.business_name || c.name;
  return {
    pin: (c) => run(c, { pinned: !c.pinned }, c.pinned ? `Unpinned ${name(c)}.` : `Pinned ${name(c)} to the top.`),
    setStatus: (c, status) => run(c, { status }, `${name(c)} marked ${status.replace(/_/g, " ")}.`),
    stillActive: (c) => run(c, { verified_at: new Date().toISOString() }, `Thanks. ${name(c)} is still active.`),
    snooze: (c) => run(c, { snooze_until: new Date(Date.now() + 30 * 864e5).toISOString() }, `Snoozed ${name(c)} for 30 days.`),
  };
}
