import { api, errorText } from "@/src/api";
import { toast } from "@/src/toast";

async function patch(id: string, body: any) {
  const d = await api(`/contractors/${id}`, { method: "PATCH", body });
  return d.before;
}

export type Actions = ReturnType<typeof useContractorActions>;

export function useContractorActions(reload: () => void) {
  const run = async (c: any, body: any, message: string) => {
    try {
      const before = await patch(c.id, body);
      reload();
      toast.success(message, { action: { label: "Undo", onPress: async () => { await patch(c.id, before).catch(() => {}); reload(); } } });
    } catch (e) {
      toast.error(errorText(e));
    }
  };
  const name = (c: any) => c.business_name || c.name;
  return {
    pin: (c: any) => run(c, { pinned: !c.pinned }, c.pinned ? `Unpinned ${name(c)}.` : `Pinned ${name(c)} to the top.`),
    setStatus: (c: any, status: string) => run(c, { status }, `${name(c)} marked ${status.replace(/_/g, " ")}.`),
    stillActive: (c: any) => run(c, { verified_at: new Date().toISOString() }, `Thanks. ${name(c)} is still active.`),
    snooze: (c: any) => run(c, { snooze_until: new Date(Date.now() + 30 * 864e5).toISOString() }, `Snoozed ${name(c)} for 30 days.`),
  };
}
