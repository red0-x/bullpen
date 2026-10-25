import { useCallback, useState } from "react";
import { View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { api, errorText } from "@/src/api";
import { URGENCY, fmtWhen } from "@/src/format";
import { useContractorActions, Actions } from "@/src/contractorActions";
import { toast } from "@/src/toast";
import { Screen } from "@/src/components/Screen";
import { DoneSheet, ServiceTarget } from "@/src/components/ServiceSheets";
import { Badge, Btn, Card, EmptyState, H, Notice, Skeleton, T } from "@/src/ui";

const TOP = 5; // Fix-it shows the most urgent five; the rest sit behind "Show all"

const KIND: Record<string, ["warn" | "neutral", string]> = {
  issue: ["warn", "Waiting on a contractor"],
  outcome: ["neutral", "Outcome not logged"],
  service: ["warn", "Service due"],
  gap: ["warn", "Coverage gap"],
  stale: ["neutral", "Stale contact"],
  watch: ["warn", "Bench watch"],
};

function ServiceAction({ item, onDone }: { item: any; onDone: (t: ServiceTarget) => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const tid = `fixit-action-${item.id}`;
  const book = async () => {
    setBusy(true);
    try {
      const r = await api(`/items/${item.item_id}/service/book`, { method: "POST" });
      router.push(`/issue/${r.id}`);
    } catch (e) { toast.error(errorText(e)); } finally { setBusy(false); }
  };
  return (
    <View style={{ gap: 8 }}>
      <Btn label="Mark done" icon="check" onPress={() => onDone({ id: item.item_id, name: item.title.split(":")[0] })} testID={tid} />
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Btn label="Book a pro" icon="calendar-plus" variant="secondary" small busy={busy} style={{ flex: 1 }} onPress={book} testID={`${tid}-book`} />
        <Btn label="History" icon="history" variant="secondary" small style={{ flex: 1 }} onPress={() => router.push(`/appliance/${item.item_id}`)} testID={`${tid}-history`} />
      </View>
    </View>
  );
}

function ItemAction({ item, actions, reload }: { item: any; actions: Actions; reload: () => void }) {
  const router = useRouter();
  const tid = `fixit-action-${item.id}`;
  const c = { id: item.contractor_id, business_name: item.title.split(":")[0] };
  if (item.kind === "issue" || item.kind === "outcome") {
    return <Btn label={item.action} onPress={() => router.push(`/issue/${item.issue_id}`)} testID={tid} />;
  }
  if (item.kind === "gap") {
    return <Btn label={item.action} onPress={() => router.push({ pathname: "/(tabs)/bench", params: { add: "1", trade: item.trade, city: item.city } })} testID={tid} />;
  }
  if (item.kind === "watch") {
    const ack = async (value: boolean) => {
      await api(`/watch/alerts/${item.signal_id}/ack`, { method: "POST", params: { acknowledged: value } });
      reload();
    };
    return (
      <Btn label={item.action} variant="secondary" testID={tid} onPress={async () => {
        try {
          await ack(true);
          toast("Alert cleared.", { action: { label: "Undo", onPress: () => ack(false) } });
        } catch (e) {
          toast.error(errorText(e));
        }
      }} />
    );
  }
  return (
    <View style={{ gap: 8 }}>
      <Btn label="Still active" onPress={() => actions.stillActive(c)} testID={tid} />
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Btn label="Out of business" variant="secondary" small style={{ flex: 1 }} onPress={() => actions.setStatus(c, "out_of_business")} testID={`${tid}-out`} />
        <Btn label="Snooze 30 days" variant="secondary" small style={{ flex: 1 }} onPress={() => actions.snooze(c)} testID={`${tid}-snooze`} />
      </View>
    </View>
  );
}

export default function FixIt() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState("");
  const [done, setDone] = useState<ServiceTarget | null>(null);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(() => api("/fixit").then((d) => { setData(d); setErr(""); }).catch((e) => setErr(errorText(e))), []);
  const actions = useContractorActions(load);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const tiles: [string, string][] = [["waiting", "Waiting"], ...(data?.counts.service ? [["service", "Service"] as [string, string]] : []), ["gaps", "Gaps"], ["stale", "Stale"]];

  return (
    <Screen eyebrow="Home" title="Fix-it list" sub="What needs you today, in order." onRefresh={load} testID="fixit-list">
        <Btn big label="Something broke" icon="siren" onPress={() => router.push("/(tabs)/snap")} testID="fixit-something-broke-button" />
        {data?.items.length > 0 && (
          <View style={{ flexDirection: "row", gap: 10 }} testID="fixit-counts">
            {tiles.map(([k, l]) => (
              <Card key={k} style={{ flex: 1, padding: 14, gap: 0 }} testID={`fixit-count-${k}`}>
                <H size={28}>{data.counts[k] + (k === "waiting" ? data.counts.outcomes : 0)}</H>
                <T size={13} muted>{l}</T>
              </Card>
            ))}
          </View>
        )}
        {!!err && <Notice testID="fixit-error">{err}</Notice>}
        {!data && !err && <Skeleton height={140} testID="fixit-loading" />}
        {data?.items.length === 0 && (data.setup.properties === 0 || data.setup.contractors === 0) && (
          <EmptyState pose="glove" testID="fixit-setup-state" title="Let's build your bench"
            body={data.setup.properties === 0 ? "Add your rentals and the contractors you use. Bullpen will flag gaps and stale contacts here." : "Your rental is set up. Now add the contractors you use, and Bullpen will flag gaps and stale contacts here."}>
            <Btn label={data.setup.properties === 0 ? "Load demo or add properties" : "Add your contractors"}
              onPress={() => router.push(data.setup.properties === 0 ? "/(tabs)/properties" : "/(tabs)/bench")} testID="fixit-setup-properties-button" />
            <Btn label="Import contacts" variant="secondary" onPress={() => router.push({ pathname: "/(tabs)/bench", params: { tab: "import" } })} testID="fixit-setup-import-button" />
          </EmptyState>
        )}
        {data?.items.length === 0 && data.setup.properties > 0 && data.setup.contractors > 0 && (
          <EmptyState pose="sleep" motion="breathe" testID="fixit-empty-state" title="Your bench is ready. Nothing needs you today." />
        )}
        {data?.items.slice(0, showAll ? undefined : TOP).map((i: any, idx: number) => (
          <Card key={i.id} delay={Math.min(idx, 8) * 50} style={{ gap: 12 }} testID={`fixit-item-${i.id}`}>
            <View style={{ flexDirection: "row" }}>
              <Badge kind={KIND[i.kind][0]} label={i.kind === "issue" && i.status === "open" ? "Needs a contractor" : i.kind === "service" && i.overdue ? "Service overdue" : KIND[i.kind][1]} />
            </View>
            <View style={{ gap: 2 }}>
              <T weight="semi" size={16}>{i.title}</T>
              {(i.subtitle || i.urgency || i.guest_arrival || i.scheduled_for) && (
                <T size={14} muted>
                  {[i.urgency && URGENCY[i.urgency], i.subtitle, i.guest_arrival && `Guests ${fmtWhen(i.guest_arrival)}`, i.scheduled_for && `Booked for ${fmtWhen(i.scheduled_for)}`].filter(Boolean).join(" · ")}
                </T>
              )}
            </View>
            {i.kind === "service" ? <ServiceAction item={i} onDone={setDone} /> : <ItemAction item={i} actions={actions} reload={load} />}
          </Card>
        ))}
        {data?.items.length > TOP && (
          <Btn label={showAll ? "Show fewer" : `Show all ${data.items.length}`} icon={showAll ? "chevron-up" : "chevron-down"} variant="secondary"
            onPress={() => setShowAll((v) => !v)} testID="fixit-show-all-button" />
        )}
        <DoneSheet target={done} onClose={() => setDone(null)} onSaved={load} />
    </Screen>
  );
}
