import { useCallback, useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "@/src/auth";
import { Image } from "expo-image";
import { Screen } from "@/src/components/Screen";
import { api, errorText, photoSource } from "@/src/api";
import { URGENCY, fmtWhen } from "@/src/format";
import { toast } from "@/src/toast";
import { makeStyles, useTheme } from "@/src/theme";
import { Badge, Btn, Card, EmptyState, H, Icon, Mascot, Notice, Skeleton, T } from "@/src/ui";
import { FixGuide } from "@/src/components/FixGuide";
import { CandidateCard } from "@/src/components/issue/CandidateCard";
import { RequestSheet } from "@/src/components/issue/RequestSheet";
import { WaitingPanel } from "@/src/components/issue/WaitingPanel";
import { HowDidItGo, OutcomeList, RankChanges } from "@/src/components/issue/Outcomes";
import { itemIcon, itemLabel } from "@/src/onboarding/shared";

const STATUS: Record<string, "warn" | "ready"> = { open: "warn", waiting: "warn", scheduled: "ready", resolved: "ready" };

function IssueHeader({ data }: { data: any }) {
  const router = useRouter();
  const { colors } = useTheme();
  const s = useStyles();
  const { issue, property } = data;
  return (
    <Card style={{ gap: 12 }} testID="issue-header">
      {issue.photo_url ? (
        <Image source={photoSource(issue.photo_url)} style={s.photo} contentFit="cover" testID="issue-photo" />
      ) : (
        <View style={[s.photo, { alignItems: "center", justifyContent: "center" }]}><Mascot pose="wrench" size={130} /></View>
      )}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Badge kind={STATUS[issue.status]} label={issue.status[0].toUpperCase() + issue.status.slice(1)} testID="issue-status" />
        <T size={13} muted numberOfLines={1} style={{ flex: 1 }} testID="issue-meta">
          {[issue.kind === "service" ? "Routine service" : null, issue.urgency && URGENCY[issue.urgency], issue.trade_needed].filter(Boolean).join(" · ")}
        </T>
      </View>
      <T muted testID="issue-diagnosis">{issue.ai_diagnosis || issue.host_note}</T>
      {data.item && (
        <Pressable onPress={() => router.push(`/appliance/${data.item.id}`)} style={({ pressed }) => [s.appliance, pressed && { opacity: 0.75 }]} testID="issue-appliance">
          <Icon name={itemIcon(data.item.name, data.item.category)} size={16} color={colors.brand} />
          <T size={14} weight="semi" style={{ flex: 1 }} testID="issue-appliance-label">{itemLabel(data.item)}</T>
          <T size={12} weight="semi" style={{ color: colors.brand }}>History</T>
          <Icon name="chevron-right" size={16} color={colors.brand} />
        </Pressable>
      )}
      <View style={{ gap: 4 }}>
        <View style={s.row}><Icon name="map-pin" size={14} color={colors.muted} /><T size={14} muted style={{ flex: 1 }}>{property.address}</T></View>
        {issue.guest_arrival && <View style={s.row}><Icon name="clock" size={14} color={colors.warning} /><T size={14} weight="semi" style={{ color: colors.warning }}>Guests arrive {fmtWhen(issue.guest_arrival)}</T></View>}
        {issue.scheduled_for && <View style={s.row}><Icon name="calendar-check" size={14} color={colors.success} /><T size={14} weight="semi" style={{ color: colors.success }} testID="issue-scheduled-for">Booked for {fmtWhen(issue.scheduled_for)}</T></View>}
      </View>
      {issue.updates?.length > 0 && issue.updates.map((u: any, i: number) => <T key={i} size={14} muted>• {u.note || "Added a photo"}</T>)}
      <FixGuide steps={issue.fix_steps || []} safety={issue.safety_note} diy={issue.diy} testID="issue-fix-guide" />
    </Card>
  );
}

function Candidates({ data, onRequest }: { data: any; onRequest: (c: any) => void }) {
  const router = useRouter();
  const [full, setFull] = useState(false);
  const { candidates, active_total, issue, property, amenity } = data;
  const what = (amenity?.label || issue.trade_needed).toLowerCase();
  return (
    <Card style={{ gap: 12 }} testID="candidates-section">
      <H size={22}>{candidates.length ? `Top ${candidates.length} to call` : "Who to call"}</H>
      {active_total === 0 ? (
        <View style={{ gap: 8 }}>
          <Notice testID="no-contractors-notice">You have no {what} contractors at {property.city}.</Notice>
          <Btn label="Add one now" variant="secondary" onPress={() => router.push({ pathname: "/(tabs)/bench", params: { add: "1", trade: issue.trade_needed, city: property.city } })} testID="add-contractor-link" />
        </View>
      ) : candidates.length === 0 ? (
        <Notice testID="all-asked-notice">You&apos;ve asked everyone on the bench for this. Add more contractors after it&apos;s fixed.</Notice>
      ) : (
        <>
          {candidates.map((c: any, i: number) => <CandidateCard key={c.id} c={c} position={i + 1} onRequest={onRequest} />)}
          {candidates.length < 3 && <Notice testID="few-backups-notice">Only {candidates.length} backup{candidates.length === 1 ? "" : "s"} for this. Add more after this is fixed.</Notice>}
        </>
      )}
      <Btn variant="link" label={full ? "Hide full bench" : "See full bench"} onPress={() => setFull(!full)} testID="see-full-bench-button" />
      {full && (
        <View style={{ gap: 8 }} testID="full-bench">
          {data.bench.length === 0 && <T size={14} muted>Nobody on the bench for this trade here yet.</T>}
          {data.bench.map((c: any) => <CandidateCard key={c.id} c={c} position={c.rank} compact />)}
        </View>
      )}
    </Card>
  );
}

export default function IssueScreen() {
  const { user } = useAuth();
  if (user === false) return <Redirect href="/welcome" />;
  return <IssueView />;
}

function IssueView() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState("");
  const [asking, setAsking] = useState<any>(null);
  const [changes, setChanges] = useState<string[]>([]);

  const load = useCallback(async () => {
    try {
      const d = await api(`/issues/${id}`);
      setData(d);
      return d;
    } catch (e) {
      setErr(errorText(e));
    }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const outcomeDone = async (res: any) => {
    setChanges(res?.changes || []);
    const fresh = await load();
    if (res && !res.outcome.showed_up && fresh?.candidates?.[0]) setAsking(fresh.candidates[0]);
  };

  const logged = async (req: any, c: any) => {
    setAsking(null);
    await load();
    toast.success(`Logged your request to ${c.business_name}. Status: Waiting.`, {
      duration: 10000,
      action: { label: "Undo", onPress: async () => { await api(`/requests/${req.id}`, { method: "DELETE" }).catch(() => {}); load(); } },
    });
  };

  const respond = async (req: any, response: string, scheduled_for?: string) => {
    try {
      await api(`/requests/${req.id}/response`, { method: "POST", body: { response, scheduled_for: scheduled_for || null } });
      const fresh = await load();
      const undo = { label: "Undo", onPress: async () => { await api(`/requests/${req.id}/response/undo`, { method: "POST" }).catch(() => {}); load(); } };
      if (response === "booked") toast.success("Booked. Status: Scheduled.", { action: undo, duration: 10000 });
      else {
        const next = fresh?.candidates?.[0];
        const head = response === "declined" ? "Marked declined." : "Marked no answer.";
        toast(next ? `${head} Here's the next backup.` : `${head} Nobody else is left on the bench for this.`, { action: undo, duration: 10000 });
        if (next) setAsking(next);
      }
    } catch (e) { toast.error(errorText(e)); }
  };

  const showCandidates = data && data.issue.status !== "scheduled" && data.issue.status !== "resolved";
  const booked = data ? [...data.requests].reverse().find((r: any) => r.response === "booked") : null;

  return (
    <>
      <Screen back title={data ? `${data.issue.kind === "service" && data.item ? `${data.item.brand ? `${data.item.brand} ${data.item.name.toLowerCase()}` : data.item.name} service` : data.amenity?.label || data.issue.trade_needed} at ${data.property.name}` : "Issue"} testID="issue-screen">
        {err ? (
          <EmptyState pose="sniff" motion="sniff" title="We couldn't find that issue" body={err} testID="issue-error">
            <Btn label="Back to Fix-it list" onPress={() => router.replace("/(tabs)")} />
          </EmptyState>
        ) : !data ? (
          <Skeleton height={300} testID="issue-loading" />
        ) : (
          <>
            <IssueHeader data={data} />
            <RankChanges changes={changes} />
            {data.issue.status === "scheduled" && <HowDidItGo issue={data.issue} booked={booked} onDone={outcomeDone} />}
            <WaitingPanel requests={data.requests} onRespond={respond} />
            {showCandidates && <Candidates data={data} onRequest={setAsking} />}
            <OutcomeList outcomes={data.outcomes || []} onEdited={outcomeDone} />
          </>
        )}
      </Screen>
      {data && <RequestSheet issue={data.issue} contractor={asking} onClose={() => setAsking(null)} onLogged={logged} />}
    </>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  top: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1.5, borderBottomColor: c.border, backgroundColor: c.surface },
  back: { width: 44, height: 44, borderRadius: 14, borderWidth: 1.5, borderColor: c.border, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  photo: { width: "100%", height: 220, borderRadius: 16, backgroundColor: c.surface },
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  appliance: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: c.warningSoft },
}));
