import { useEffect, useMemo, useState } from "react";
import { Switch, View } from "react-native";
import * as Haptics from "expo-haptics";
import { api, errorText } from "@/src/api";
import { EVERY, fmtDay, isoDay, parseDay, parseMoney, Service, startOfToday } from "@/src/service";
import { toast } from "@/src/toast";
import { useTheme } from "@/src/theme";
import { Btn, Chip, ChipRow, Field, Notice, Sheet, T } from "@/src/ui";

export type ServiceTarget = { id: string; name: string; service?: Service | null };

// Same day of the month as today in a month `ahead` months away (this month = today).
function monthDay(ahead: number) {
  const t = startOfToday();
  const last = new Date(t.getFullYear(), t.getMonth() + ahead + 1, 0).getDate();
  return new Date(t.getFullYear(), t.getMonth() + ahead, Math.min(t.getDate(), last));
}

// Set or change an appliance's service schedule (how often + next due date + email).
export function ScheduleSheet({ target, onClose, onSaved }: { target: ServiceTarget | null; onClose: () => void; onSaved: () => void }) {
  const { colors } = useTheme();
  const [every, setEvery] = useState<3 | 6 | 12>(12);
  const [due, setDue] = useState("");
  const [email, setEmail] = useState(true);
  const [busy, setBusy] = useState<"" | "save" | "stop">("");
  const [error, setError] = useState("");
  const current = target?.service;

  const months = useMemo(() => {
    const out = Array.from({ length: 13 }, (_, i) => isoDay(monthDay(i)));
    if (current && !out.some((d) => d.slice(0, 7) === current.next_due.slice(0, 7))) out.unshift(current.next_due);
    return out;
  }, [current]);

  useEffect(() => {
    if (!target) return;
    setError("");
    setEvery((target.service?.interval_months as 3 | 6 | 12) || 12);
    setDue(target.service?.next_due || isoDay(monthDay(1)));
    setEmail(target.service ? target.service.email : true);
  }, [target]);

  const pickMonth = (d: string) => setDue(current && d.slice(0, 7) === current.next_due.slice(0, 7) ? current.next_due : d);
  // Changing how often moves the due date to match, counted from the last service.
  const pickEvery = (m: 3 | 6 | 12) => {
    setEvery(m);
    if (current?.last_done) {
      const last = parseDay(current.last_done);
      const end = new Date(last.getFullYear(), last.getMonth() + m + 1, 0).getDate();
      setDue(isoDay(new Date(last.getFullYear(), last.getMonth() + m, Math.min(last.getDate(), end))));
    }
  };

  const save = async () => {
    setBusy("save");
    setError("");
    try {
      await api(`/items/${target!.id}/service`, { method: "PUT", body: { interval_months: every, next_due: due, email } });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      toast.success(`Reminder set. Next service ${fmtDay(due)}.`);
      onSaved();
      onClose();
    } catch (e) { setError(errorText(e)); } finally { setBusy(""); }
  };

  const stop = async () => {
    setBusy("stop");
    try {
      await api(`/items/${target!.id}/service`, { method: "DELETE" });
      toast("Service reminders turned off.");
      onSaved();
      onClose();
    } catch (e) { setError(errorText(e)); } finally { setBusy(""); }
  };

  const monthLabel = (d: string, i: number) => {
    const dt = parseDay(d);
    if (current && d === current.next_due && i === 0 && dt < startOfToday()) return `${fmtDay(d)} (overdue)`;
    return d.slice(0, 7) === isoDay(startOfToday()).slice(0, 7) ? "This month" : dt.toLocaleDateString([], { month: "short", year: "numeric" });
  };

  return (
    <Sheet open={!!target} onClose={onClose} title={current ? "Edit service reminder" : "Set a service reminder"} sub={target?.name} testID="schedule-sheet">
      <View style={{ gap: 8 }}>
        <T size={14} weight="semi">How often?</T>
        <ChipRow testID="schedule-interval">
          {([12, 6, 3] as const).map((m) => <Chip key={m} label={EVERY[m]} on={every === m} onPress={() => pickEvery(m)} testID={`schedule-interval-${m}`} />)}
        </ChipRow>
      </View>
      <View style={{ gap: 8 }}>
        <T size={14} weight="semi">Next service due</T>
        <ChipRow testID="schedule-month">
          {months.map((d, i) => <Chip key={d} label={monthLabel(d, i)} on={due.slice(0, 7) === d.slice(0, 7)} onPress={() => pickMonth(d)} testID={`schedule-month-${d.slice(0, 7)}`} />)}
        </ChipRow>
        {!!due && <T size={13} muted testID="schedule-due-text">Due {fmtDay(due, true)}. It shows on your Fix-it list 30 days before.</T>}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <T weight="semi">Email me too</T>
          <T size={13} muted>One email a week before it&apos;s due.</T>
        </View>
        <Switch value={email} onValueChange={setEmail} trackColor={{ true: colors.brand, false: colors.border }} thumbColor={colors.surfaceSecondary}
          accessibilityLabel="Email me a week before" testID="schedule-email-switch" />
      </View>
      {!!error && <Notice testID="schedule-error">{error}</Notice>}
      <Btn label="Save reminder" icon="bell-ring" busy={busy === "save"} disabled={!!busy || !due} onPress={save} testID="schedule-save-button" />
      {!!current && <Btn label="Stop reminders" icon="bell-off" variant="secondary" busy={busy === "stop"} disabled={!!busy} onPress={stop} testID="schedule-stop-button" />}
    </Sheet>
  );
}

const pastDays = () => Array.from({ length: 14 }, (_, i) => { const d = startOfToday(); d.setDate(d.getDate() - i); return isoDay(d); });

// Log a finished service: when, who, what it cost. Moves the next due date on.
export function DoneSheet({ target, onClose, onSaved }: { target: ServiceTarget | null; onClose: () => void; onSaved: () => void }) {
  const days = useMemo(pastDays, []);
  const [day, setDay] = useState(days[0]);
  const [who, setWho] = useState<string | null>(null);
  const [cost, setCost] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pros, setPros] = useState<any[]>([]);

  useEffect(() => {
    if (!target) return;
    setDay(days[0]); setWho(null); setCost(""); setNote(""); setError("");
    api<any[]>("/contractors").then((cs) => setPros(cs.filter((c) => c.status === "active").slice(0, 12))).catch(() => setPros([]));
  }, [target, days]);

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      const r = await api(`/items/${target!.id}/service/done`, { method: "POST", body: { done_on: day, cost: parseMoney(cost), contractor_id: who, note } });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onSaved();
      onClose();
      toast.success(`Service logged. Next one ${fmtDay(r.service.next_due, true)}.`, {
        duration: 10000,
        action: { label: "Undo", onPress: async () => { await api(`/service-logs/${r.log.id}`, { method: "DELETE" }).catch((e) => toast.error(errorText(e))); onSaved(); } },
      });
    } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  };

  const dayLabel = (d: string, i: number) => (i === 0 ? "Today" : i === 1 ? "Yesterday" : fmtDay(d));
  return (
    <Sheet open={!!target} onClose={onClose} title="Mark service done" sub={target?.name} testID="done-sheet">
      <View style={{ gap: 8 }}>
        <T size={14} weight="semi">When?</T>
        <ChipRow testID="done-day">
          {days.map((d, i) => <Chip key={d} label={dayLabel(d, i)} on={day === d} onPress={() => setDay(d)} testID={`done-day-${i}`} />)}
        </ChipRow>
      </View>
      <View style={{ gap: 8 }}>
        <T size={14} weight="semi">Who did it?</T>
        <ChipRow testID="done-who">
          <Chip label="I did it" on={!who} onPress={() => setWho(null)} testID="done-who-me" />
          {pros.map((c) => <Chip key={c.id} label={c.business_name || c.name} on={who === c.id} onPress={() => setWho(c.id)} testID={`done-who-${c.id}`} />)}
        </ChipRow>
      </View>
      <Field label="What did it cost? (optional)" value={cost} onChangeText={setCost} placeholder="$0" keyboardType="decimal-pad" maxLength={12} testID="done-cost-input" />
      <Field label="Note (optional)" value={note} onChangeText={setNote} placeholder="Flushed the tank, replaced the anode" maxLength={500} testID="done-note-input" />
      {!!error && <Notice testID="done-error">{error}</Notice>}
      <Btn label="Log service" icon="check" busy={busy} disabled={busy} onPress={save} testID="done-save-button" />
    </Sheet>
  );
}
