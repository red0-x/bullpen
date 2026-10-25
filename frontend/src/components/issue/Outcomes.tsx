import { useState } from "react";
import { Pressable, View } from "react-native";
import { api, errorText } from "@/src/api";
import { fmtWhen } from "@/src/format";
import { money, parseMoney } from "@/src/service";
import { toast } from "@/src/toast";
import { useTheme } from "@/src/theme";
import { Badge, Btn, Card, Chip, Field, H, Icon, T } from "@/src/ui";

function YesNo({ label, value, onChange, disabled, testID }: { label: string; value: boolean | null; onChange: (v: boolean) => void; disabled?: boolean; testID: string }) {
  return (
    <View style={{ gap: 6, opacity: disabled ? 0.5 : 1 }}>
      <T size={14} weight="semi">{label}</T>
      <View style={{ flexDirection: "row", gap: 8 }} pointerEvents={disabled ? "none" : "auto"}>
        <Chip label="Yes" on={value === true} onPress={() => onChange(true)} testID={`${testID}-yes`} />
        <Chip label="No" on={value === false} onPress={() => onChange(false)} testID={`${testID}-no`} />
      </View>
    </View>
  );
}

type F = { showed_up: boolean | null; on_time: boolean | null; rating: number; note: string; cost?: string };

export function OutcomeForm({ initial, onSubmit, busy, submitLabel = "Save outcome", testID = "outcome-form" }: { initial?: F; onSubmit: (f: any) => void; busy?: boolean; submitLabel?: string; testID?: string }) {
  const { colors } = useTheme();
  const [f, setF] = useState<F>(initial || { showed_up: null, on_time: null, rating: 0, note: "", cost: "" });
  const set = (p: Partial<F>) => setF({ ...f, ...p });
  const ready = f.showed_up !== null && f.rating > 0 && (f.showed_up === false || f.on_time !== null);
  return (
    <View style={{ gap: 14 }} testID={testID}>
      <View style={{ flexDirection: "row", gap: 24 }}>
        <YesNo label="Showed up?" value={f.showed_up} onChange={(v) => set({ showed_up: v, on_time: v ? f.on_time : false })} testID={`${testID}-showed`} />
        <YesNo label="On time?" value={f.on_time} disabled={f.showed_up === false} onChange={(v) => set({ on_time: v })} testID={`${testID}-ontime`} />
      </View>
      <View style={{ gap: 6 }}>
        <T size={14} weight="semi">Rating</T>
        <View style={{ flexDirection: "row", gap: 4 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Pressable key={n} onPress={() => set({ rating: n })} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }} testID={`${testID}-star-${n}`} accessibilityLabel={`${n} stars`}>
              <Icon name="star" size={28} color={n <= f.rating ? colors.star : colors.border} />
            </Pressable>
          ))}
        </View>
      </View>
      <Field label="Note (optional)" value={f.note} maxLength={1000} onChangeText={(v) => set({ note: v })} placeholder="Fixed the heater, left it clean" testID={`${testID}-note`} />
      {f.showed_up === true && (
        <Field label="What did it cost? (optional)" value={f.cost || ""} maxLength={12} keyboardType="decimal-pad" onChangeText={(v) => set({ cost: v })} placeholder="$0" testID={`${testID}-cost`} />
      )}
      <Btn label={submitLabel} busy={busy} disabled={!ready} onPress={() => onSubmit({ showed_up: f.showed_up, rating: f.rating, note: f.note, on_time: !!f.on_time, cost: f.showed_up ? parseMoney(f.cost || "") : null })} testID={`${testID}-submit`} />
    </View>
  );
}

const movedDown = (c: string) => {
  const m = /from #(\d+) to #(\d+)/.exec(c);
  return m ? +m[2] > +m[1] : false;
};

export function RankChanges({ changes }: { changes: string[] }) {
  const { colors } = useTheme();
  if (!changes?.length) return null;
  return (
    <View style={{ backgroundColor: colors.successSoft, borderRadius: 16, padding: 14, gap: 6 }} testID="rank-changes">
      <H size={18} style={{ color: colors.success }}>Bench updated</H>
      {changes.map((c, i) => (
        <View key={i} style={{ flexDirection: "row", gap: 8 }}>
          <Icon name={movedDown(c) ? "trending-down" : "trending-up"} size={16} color={colors.success} />
          <T size={14} weight="semi" style={{ flex: 1, color: colors.success }}>{c}</T>
        </View>
      ))}
    </View>
  );
}

export function HowDidItGo({ issue, booked, onDone }: { issue: any; booked: any; onDone: (d: any) => void }) {
  const [busy, setBusy] = useState(false);
  const submit = async (f: any) => {
    setBusy(true);
    try {
      const d = await api(`/issues/${issue.id}/outcome`, { method: "POST", body: { ...f, contractor_id: booked?.contractor_id } });
      onDone(d);
      toast.success(f.showed_up ? "Saved. Issue resolved." : "Saved. Issue reopened so you can call the next backup.", {
        duration: d.undo_seconds * 1000,
        action: { label: "Undo", onPress: async () => { await api(`/outcomes/${d.outcome.id}/undo`, { method: "POST" }).catch((e) => toast.error(errorText(e))); onDone(null); } },
      });
    } catch (e) { toast.error(errorText(e)); } finally { setBusy(false); }
  };
  return (
    <Card style={{ gap: 12 }} testID="how-did-it-go">
      <View>
        <H size={22}>How did it go?</H>
        <T size={14} muted>{booked?.contractor?.business_name} was booked for {fmtWhen(issue.scheduled_for)}.</T>
      </View>
      <OutcomeForm onSubmit={submit} busy={busy} />
    </Card>
  );
}

export function OutcomeList({ outcomes, onEdited }: { outcomes: any[]; onEdited: (d: any) => void }) {
  const { colors } = useTheme();
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!outcomes.length) return null;
  const save = async (o: any, f: any) => {
    setBusy(true);
    try {
      const d = await api(`/outcomes/${o.id}`, { method: "PUT", body: f });
      setEditing(null);
      onEdited(d);
      toast.success("Outcome updated. The old version is kept in history.");
    } catch (e) { toast.error(errorText(e)); } finally { setBusy(false); }
  };
  return (
    <Card style={{ gap: 12 }} testID="outcome-list">
      <H size={22}>Job outcomes</H>
      {outcomes.map((o) => (
        <View key={o.id} style={{ borderRadius: 16, borderWidth: 1.5, borderColor: colors.border, padding: 12, gap: 8 }} testID={`outcome-${o.id}`}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <T weight="semi" numberOfLines={1} style={{ flex: 1 }}>{o.business_name}</T>
            <Btn label="Edit" icon="pencil" variant="secondary" small onPress={() => setEditing(editing === o.id ? null : o.id)} testID={`outcome-edit-${o.id}`} />
          </View>
          <View style={{ flexDirection: "row", gap: 6 }}>
            <Badge kind={o.showed_up ? "ready" : "warn"} label={o.showed_up ? (o.on_time ? "On time" : "Late") : "No-show"} />
            <Badge label={`${o.rating} stars`} />
            {o.cost != null && <Badge label={money(o.cost)} testID={`outcome-${o.id}-cost`} />}
          </View>
          {!!o.note && <T size={14} muted>{o.note}</T>}
          {editing === o.id && (
            <View style={{ borderTopWidth: 1.5, borderTopColor: colors.border, paddingTop: 12 }}>
              <OutcomeForm testID={`outcome-edit-form-${o.id}`} initial={{ showed_up: o.showed_up, on_time: o.on_time, rating: o.rating, note: o.note, cost: o.cost != null ? String(o.cost) : "" }}
                onSubmit={(f) => save(o, f)} busy={busy} submitLabel="Save changes" />
            </View>
          )}
        </View>
      ))}
    </Card>
  );
}
