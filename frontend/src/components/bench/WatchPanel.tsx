import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import { api, errorText } from "@/src/api";
import { fmtWhen } from "@/src/format";
import { toast } from "@/src/toast";
import { useTheme } from "@/src/theme";
import { Badge, Btn, Card, H, Icon, Notice, Skeleton, T } from "@/src/ui";

const SIG: [string, string, (v: string) => string][] = [
  ["response_time", "Reply time", (v) => `${Math.round(+v / 6) / 10} h`],
  ["public_rating", "Rating", (v) => `${v} stars`],
  ["business_open", "Business", (v) => (v === "yes" ? "Open" : "Closed")],
  ["phone_working", "Phone", (v) => (v === "yes" ? "Working" : "Disconnected")],
  ["license_status", "License", (v) => v],
];
const BAD = (t: string, v: string) =>
  t === "business_open" || t === "phone_working" ? v !== "yes" : t === "license_status" ? v !== "active" : t === "response_time" ? +v >= 240 : false;

export function WatchPanel({ onChanged }: { onChanged: () => void }) {
  const { colors } = useTheme();
  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [changes, setChanges] = useState<string[] | null>(null);

  const load = useCallback(() => api("/watch").then(setData).catch((e) => toast.error(errorText(e))), []);
  useEffect(() => { load(); }, [load]);

  const check = async () => {
    setBusy(true);
    try {
      const res = await api("/watch/check", { method: "POST" });
      setChanges(res.changes);
      await load();
      onChanged();
    } catch (e) { toast.error(errorText(e)); } finally { setBusy(false); }
  };

  return (
    <View style={{ gap: 16 }} testID="watch-panel">
      <Card style={{ gap: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Icon name="radar" size={20} color={colors.brand} />
          <H size={22}>Bench watch</H>
        </View>
        <Badge kind="warn" label="Sample data, not live checks" testID="watch-sample-label" />
        <T size={14} muted>Signals beyond your own jobs: reply time, public rating, business open, phone working, license. Flags mark someone unreachable.</T>
        {data?.last_run && <T size={12} muted>Last check {fmtWhen(data.last_run)}</T>}
        <Btn label={busy ? "Checking…" : "Check now"} busy={busy} onPress={check} testID="watch-check-now-button" />
      </Card>
      {changes && (
        <Notice kind="ready" testID="watch-changes">{["What changed:", ...changes.map((c) => `• ${c}`)].join("\n")}</Notice>
      )}
      {!data && <Skeleton height={200} />}
      {data?.contractors.length === 0 && <Card><T muted>No contractors to watch yet.</T></Card>}
      {data?.contractors.map((c: any) => (
        <Card key={c.id} style={{ gap: 8, opacity: c.rank ? 1 : 0.6 }} testID={`watch-row-${c.id}`}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <T weight="semi" numberOfLines={1} style={{ flex: 1 }}>{c.business_name || c.name}</T>
            <Badge label={c.score != null ? String(c.score) : "–"} />
          </View>
          <T size={12} muted numberOfLines={2}>{c.reason}</T>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {SIG.map(([t, label, f]) => {
              const v = c.signals?.[t]?.value;
              return <Badge key={t} kind={v && BAD(t, v) ? "warn" : "neutral"} label={`${label}: ${v ? f(v) : "–"}`} />;
            })}
          </View>
        </Card>
      ))}
    </View>
  );
}
