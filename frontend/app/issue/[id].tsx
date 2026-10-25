import { useCallback, useEffect, useState } from "react";
import { TextInput, View } from "react-native";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "@/src/auth";
import { Screen } from "@/src/components/Screen";
import { api, errorText } from "@/src/api";
import { toast } from "@/src/toast";
import { makeStyles, useTheme } from "@/src/theme";
import { Btn, EmptyState, H, Icon, Notice, Skeleton, T } from "@/src/ui";
import { NextCard, PickCards } from "@/src/components/dispatch/PickCards";
import { Timeline, clock } from "@/src/components/dispatch/Timeline";
import { TestReplies } from "@/src/components/dispatch/TestReplies";
import { HostPhone } from "@/src/components/dispatch/HostPhone";
import { HowDidItGo, OutcomeList, RankChanges } from "@/src/components/issue/Outcomes";

export default function IssueScreen() {
  const { user } = useAuth();
  if (user === false) return <Redirect href="/welcome" />;
  return <IssueView />;
}

function Composer({ d, issueId, onSent }: { d: any; issueId: string; onSent: () => void }) {
  const s = useStyles();
  const { colors } = useTheme();
  const [msg, setMsg] = useState(d.message);
  const [busy, setBusy] = useState(false);
  useEffect(() => setMsg(d.message), [d.message]);
  const send = async () => {
    setBusy(true);
    try {
      if (msg.trim() !== d.message) await api(`/issues/${issueId}/dispatch`, { method: "PATCH", body: { message: msg.trim() } });
      await api(`/issues/${issueId}/dispatch/send`, { method: "POST" });
      onSent();
    } catch (e) { toast.error(errorText(e)); } finally { setBusy(false); }
  };
  return (
    <View style={{ gap: 8 }}>
      <T size={12} weight="bold" muted style={{ letterSpacing: 1.2 }} testID="ill-text-label">I&apos;LL TEXT {d.current.short.toUpperCase()}</T>
      <TextInput value={msg} onChangeText={setMsg} multiline style={s.msg} placeholderTextColor={colors.muted} testID="dispatch-message-input" />
      <T size={12} muted>They never see your number. Replies come to me.</T>
      <Btn big label="Send it" icon="send" busy={busy} disabled={!msg.trim()} onPress={send} testID="send-it-button" />
    </View>
  );
}

function IssueView() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const [d, setD] = useState<any>(null);
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState("");
  const [changes, setChanges] = useState<string[]>([]);

  const load = useCallback(async () => {
    try {
      const [dd, full] = await Promise.all([api(`/issues/${id}/dispatch`), api(`/issues/${id}`)]);
      setD(dd);
      setData(full);
    } catch (e) { setErr(errorText(e)); }
  }, [id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (d?.state !== "waiting") return;
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [d?.state, load]);

  const outcomeDone = async (res: any) => { setChanges(res?.changes || []); await load(); };
  const booked = data ? [...data.requests].reverse().find((r: any) => r.response === "booked") : null;

  return (
    <Screen back title={d ? d.chip : "Issue"} testID="issue-screen">
      {err ? (
        <EmptyState pose="sniff" motion="sniff" title="We couldn't find that issue" body={err} testID="issue-error">
          <Btn label="Back to Fix-it list" onPress={() => router.replace("/(tabs)")} />
        </EmptyState>
      ) : !d || !data ? (
        <Skeleton height={300} testID="issue-loading" />
      ) : (
        <View style={{ gap: 20 }} testID={`dispatch-${d.state}`}>
          <View style={{ gap: 4 }}>
            <T size={12} weight="bold" muted style={{ letterSpacing: 1.2 }} testID="dispatch-eyebrow">{d.eyebrow.toUpperCase()}</T>
            <H size={26} testID="dispatch-headline">{d.headline}</H>
          </View>

          {d.state === "pick" && (
            <>
              <PickCards picks={d.picks} />
              <Composer d={d} issueId={id} onSent={load} />
            </>
          )}

          {d.state === "next" && d.current && (
            <>
              <View style={{ gap: 4 }}>
                <H size={22} testID="trying-next-title">Trying next</H>
                <T muted>{d.prev} didn&apos;t answer, so I picked {d.current.name}.</T>
              </View>
              <NextCard pick={d.current} />
              <Composer d={d} issueId={id} onSent={load} />
              <Timeline events={d.timeline} />
            </>
          )}

          {d.state === "waiting" && d.current && (
            <>
              <View style={{ gap: 4 }}>
                <H size={24} testID="waiting-title">Waiting on {d.current.short}</H>
                <T muted testID="waiting-sub">
                  Texted at {clock(d.sent_at)}. {d.called ? "Called too." : `I'll call at ${clock(d.call_at)}.`} If no reply by {clock(d.next_at)}, I&apos;ll try the next one.
                </T>
              </View>
              <Timeline events={d.timeline} />
              <TestReplies issueId={id} who={d.current.short} onDone={load} />
            </>
          )}

          {d.state === "booked" && (
            <>
              <View style={{ gap: 6, alignItems: "flex-start" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Icon name="calendar-check" size={26} color={colors.success} />
                  <H size={28} testID="booked-title">Booked</H>
                </View>
                <T size={17} weight="semi" testID="booked-detail">{d.current?.name || d.picks[0]?.name}, {d.booked_text}</T>
                <T muted>I&apos;ll text you the day after to ask how it went.</T>
              </View>
              <Timeline events={d.timeline} />
              <RankChanges changes={changes} />
              {data.issue.status === "scheduled" && <HowDidItGo issue={data.issue} booked={booked} onDone={outcomeDone} />}
            </>
          )}

          {d.state === "empty" && (
            <View style={{ gap: 8 }}>
              <Notice testID="no-contractors-notice">Nobody left to try for this at {data.property.name}.</Notice>
              <Btn label="Add a pro" variant="secondary" onPress={() => router.push({ pathname: "/(tabs)/bench", params: { add: "1", trade: data.issue.trade_needed, city: data.property.city } })} testID="add-contractor-link" />
              <Timeline events={d.timeline} />
            </View>
          )}

          {!d.host_phone_set && d.state !== "booked" && <HostPhone onSaved={load} />}
          <OutcomeList outcomes={data.outcomes || []} onEdited={outcomeDone} />
        </View>
      )}
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  msg: {
    minHeight: 110, borderRadius: 16, borderWidth: 1.5, borderColor: c.border, backgroundColor: c.surfaceSecondary,
    padding: 14, fontSize: 15, lineHeight: 21, color: c.onSurface, fontFamily: "Body", textAlignVertical: "top",
  },
}));
