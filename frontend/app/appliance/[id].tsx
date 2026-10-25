import { useCallback, useState } from "react";
import { Pressable, View } from "react-native";
import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import Animated, { ZoomIn } from "react-native-reanimated";
import { api, errorText, photoSource } from "@/src/api";
import { useAuth } from "@/src/auth";
import { Screen } from "@/src/components/Screen";
import { DoneSheet, ScheduleSheet, ServiceTarget } from "@/src/components/ServiceSheets";
import { ItemSheet } from "@/src/onboarding/ItemSheet";
import { itemIcon, ItemDraft } from "@/src/onboarding/shared";
import { daysUntil, dueText, EVERY, fmtDate, fmtDay, money } from "@/src/service";
import { toast } from "@/src/toast";
import { makeStyles, useTheme } from "@/src/theme";
import { Badge, Btn, Card, EmptyState, H, Icon, IconName, Notice, Skeleton, T } from "@/src/ui";

const STATUS: Record<string, [string, "warn" | "ready" | "neutral"]> = {
  open: ["Needs a contractor", "warn"], waiting: ["Waiting on a reply", "warn"], scheduled: ["Booked", "ready"], resolved: ["Fixed", "ready"],
};

export default function ApplianceScreen() {
  const { user } = useAuth();
  if (user === false) return <Redirect href="/welcome" />;
  return <ApplianceView />;
}

function ApplianceView() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const s = useStyles();
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState("");
  const [schedule, setSchedule] = useState<ServiceTarget | null>(null);
  const [done, setDone] = useState<ServiceTarget | null>(null);
  const [edit, setEdit] = useState<ItemDraft | null>(null);
  const [booking, setBooking] = useState(false);

  const load = useCallback(() => api(`/items/${id}/history`).then((d) => { setData(d); setErr(""); }).catch((e) => setErr(errorText(e))), [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const item = data?.item;
  const svc = data?.service;
  const target: ServiceTarget | null = item ? { id: item.id, name: label(item), service: svc } : null;

  const book = async () => {
    if (data.open_service_issue) return router.push(`/issue/${data.open_service_issue}`);
    setBooking(true);
    try {
      const r = await api(`/items/${id}/service/book`, { method: "POST" });
      router.push(`/issue/${r.id}`);
    } catch (e) { toast.error(errorText(e)); } finally { setBooking(false); }
  };

  // Newest first: finished services and repair jobs together.
  const timeline = data ? [
    ...data.services.map((x: any) => ({ type: "service", at: x.done_on, x })),
    ...data.repairs.map((x: any) => ({ type: "repair", at: (x.fixed_on || x.date).slice(0, 10), x })),
  ].sort((a, b) => (a.at < b.at ? 1 : -1)) : [];
  const lastService = data?.services[0]?.done_on || svc?.last_done;

  return (
    <Screen back eyebrow={item ? [item.room, item.property_name].filter(Boolean).join(" · ") : "Appliance"} title={item ? label(item) : "Appliance"}
      onRefresh={load} testID="appliance">
      {!!err && (
        <EmptyState pose="sniff" motion="sniff" title="We couldn't find that appliance" body={err} testID="appliance-error">
          <Btn label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/properties"))} />
        </EmptyState>
      )}
      {!data && !err && <Skeleton height={260} testID="appliance-loading" />}
      {item && (
        <>
          <Card style={s.head} testID="appliance-header">
            {item.photo_url
              ? <Image source={photoSource(item.photo_url)} style={s.photo} contentFit="cover" />
              : <View style={s.icon}><Icon name={itemIcon(item.name, item.category)} size={26} color={colors.brand} /></View>}
            <View style={{ flex: 1, gap: 2 }}>
              <T weight="semi" numberOfLines={1}>{item.name}</T>
              <T size={13} muted numberOfLines={2}>{[item.brand, item.model].filter(Boolean).join(" · ") || "No brand or model yet"}</T>
              {!!item.notes && <T size={13} muted numberOfLines={2}>{item.notes}</T>}
            </View>
            <Btn variant="link" label="Edit" onPress={() => setEdit({ ...item, room_id: item.room_id })} testID="appliance-edit-button" />
          </Card>

          <View style={{ flexDirection: "row", gap: 10 }} testID="appliance-stats">
            <Stat value={money(data.total_cost) || "$0"} label="spent" icon="wallet" delay={0} testID="appliance-total" />
            <Stat value={String(data.jobs)} label={data.jobs === 1 ? "job" : "jobs"} icon="wrench" delay={80} testID="appliance-jobs" />
            <Stat value={lastService ? fmtDay(lastService).split(", ")[1] || fmtDay(lastService) : "Never"} label="last service" icon="calendar-check" delay={160} testID="appliance-last" />
          </View>

          <ServiceCard svc={svc} openIssue={data.open_service_issue} booking={booking}
            onSet={() => setSchedule(target)} onDone={() => setDone(target)} onBook={book} />

          <Card style={{ gap: 4 }} testID="appliance-history">
            <H size={22}>History</H>
            {timeline.length === 0 && (
              <T muted style={{ paddingVertical: 6 }} testID="appliance-history-empty">
                Nothing yet. Repairs from Snap and finished services show up here, with who did them and what they cost.
              </T>
            )}
            {timeline.map((e: any, i: number) => e.type === "service"
              ? <ServiceRow key={e.x.id} x={e.x} last={i === timeline.length - 1} />
              : <RepairRow key={e.x.issue_id} x={e.x} last={i === timeline.length - 1} onPress={() => router.push(`/issue/${e.x.issue_id}`)} />)}
          </Card>
        </>
      )}
      <ScheduleSheet target={schedule} onClose={() => setSchedule(null)} onSaved={load} />
      <DoneSheet target={done} onClose={() => setDone(null)} onSaved={load} />
      <ItemSheet draft={edit} roomType="other" roomName={item?.room} onClose={() => setEdit(null)} onSaved={load} showHistory={false} />
    </Screen>
  );
}

const label = (i: any) => (i.brand ? `${i.brand} ${i.name.toLowerCase()}` : i.name);

function ServiceCard({ svc, openIssue, booking, onSet, onDone, onBook }: { svc: any; openIssue: string | null; booking: boolean; onSet: () => void; onDone: () => void; onBook: () => void }) {
  const { colors } = useTheme();
  const s = useStyles();
  if (!svc) {
    return (
      <Card style={{ gap: 12, backgroundColor: colors.warningSoft }} testID="appliance-service-card">
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={s.bell}><Icon name="bell-plus" size={22} color={colors.brand} /></View>
          <View style={{ flex: 1 }}>
            <H size={20}>No service reminder yet</H>
            <T size={14} muted>Water heaters, HVAC and hot tubs last longer with a regular check.</T>
          </View>
        </View>
        <Btn label="Set a reminder" icon="bell-ring" onPress={onSet} testID="appliance-set-service-button" />
      </Card>
    );
  }
  const days = daysUntil(svc.next_due);
  const late = days < 0;
  const soon = days <= 30;
  return (
    <Card style={{ gap: 12 }} testID="appliance-service-card">
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={[s.bell, late && { backgroundColor: colors.warningSoft }]}><Icon name={late ? "alarm-clock" : "calendar-clock"} size={22} color={late ? colors.warning : colors.brand} /></View>
        <View style={{ flex: 1, gap: 2 }}>
          <T size={13} weight="semi" muted>{EVERY[svc.interval_months]}</T>
          <H size={20} testID="appliance-next-due">{fmtDay(svc.next_due, true)}</H>
        </View>
        <Badge kind={soon ? "warn" : "ready"} label={soon ? dueText(days) : "On track"} testID="appliance-service-badge" />
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Icon name={svc.email ? "mail-check" : "mail-x"} size={14} color={colors.muted} />
        <T size={13} muted style={{ flex: 1 }}>{svc.email ? "Fix-it reminds you 30 days before, plus an email a week before." : "Fix-it reminds you 30 days before. Emails are off."}</T>
      </View>
      {!!openIssue && <Notice kind="ready" testID="appliance-open-job">A service job is on the go. Open it to book or log how it went.</Notice>}
      <Btn label="Mark done" icon="check" onPress={onDone} testID="appliance-done-button" />
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Btn label={openIssue ? "Open job" : "Book a pro"} icon="calendar-plus" variant="secondary" busy={booking} small style={{ flex: 1 }} onPress={onBook} testID="appliance-book-button" />
        <Btn label="Edit" icon="pencil" variant="secondary" small style={{ flex: 1 }} onPress={onSet} testID="appliance-edit-service-button" />
      </View>
    </Card>
  );
}

function Dot({ icon, tone, last }: { icon: IconName; tone: "ready" | "brand" | "warn"; last: boolean }) {
  const { colors } = useTheme();
  const s = useStyles();
  const bg = tone === "ready" ? colors.successSoft : colors.warningSoft;
  const fg = tone === "ready" ? colors.success : tone === "warn" ? colors.warning : colors.brand;
  return (
    <View style={{ alignItems: "center" }}>
      <View style={[s.dot, { backgroundColor: bg }]}><Icon name={icon} size={16} color={fg} /></View>
      {!last && <View style={s.line} />}
    </View>
  );
}

function ServiceRow({ x, last }: { x: any; last: boolean }) {
  const s = useStyles();
  return (
    <View style={s.row} testID={`history-service-${x.id}`}>
      <Dot icon="calendar-check" tone="ready" last={last} />
      <View style={s.body}>
        <View style={s.top}>
          <T weight="semi" style={{ flex: 1 }}>Service done</T>
          {x.cost != null && <T size={14} weight="semi" testID={`history-service-${x.id}-cost`}>{money(x.cost)}</T>}
        </View>
        <T size={13} muted>{fmtDay(x.done_on, true)} · {x.contractor || "You did it"}</T>
        {!!x.note && <T size={13} muted numberOfLines={3}>{x.note}</T>}
      </View>
    </View>
  );
}

function RepairRow({ x, last, onPress }: { x: any; last: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const s = useStyles();
  const [st, kind] = STATUS[x.status] || STATUS.open;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.row, pressed && { opacity: 0.7 }]} testID={`history-repair-${x.issue_id}`}>
      <Dot icon={x.kind === "service" ? "calendar-clock" : "wrench"} tone={x.status === "resolved" ? "ready" : x.kind === "service" ? "brand" : "warn"} last={last} />
      <View style={s.body}>
        <View style={s.top}>
          <T weight="semi" style={{ flex: 1 }} numberOfLines={2}>{x.kind === "service" ? "Service job" : x.what}</T>
          {x.cost != null && <T size={14} weight="semi" testID={`history-repair-${x.issue_id}-cost`}>{money(x.cost)}</T>}
        </View>
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          <Badge kind={kind} label={st} />
          <T size={12} muted>{[x.rating != null ? `${x.rating} stars` : null, x.no_shows > 0 ? `${x.no_shows} no-show${x.no_shows > 1 ? "s" : ""}` : null].filter(Boolean).join(" · ")}</T>
        </View>
        <T size={13} muted>{fmtDate(x.fixed_on || x.date)}{x.contractor ? ` · ${x.contractor}` : ""}</T>
      </View>
      <Icon name="chevron-right" size={16} color={colors.muted} />
    </Pressable>
  );
}

function Stat({ value, label: l, icon, delay, testID }: { value: string; label: string; icon: IconName; delay: number; testID: string }) {
  const { colors } = useTheme();
  const s = useStyles();
  return (
    <Animated.View entering={ZoomIn.delay(delay).springify().damping(14)} style={s.tile} testID={testID}>
      <Icon name={icon} size={16} color={colors.brand} />
      <H size={22} numberOfLines={1}>{value}</H>
      <T size={12} muted>{l}</T>
    </Animated.View>
  );
}

const useStyles = makeStyles((c) => ({
  head: { flexDirection: "row", alignItems: "center", gap: 14 },
  photo: { width: 56, height: 56, borderRadius: 16, backgroundColor: c.surfaceTertiary },
  icon: { width: 56, height: 56, borderRadius: 16, backgroundColor: c.warningSoft, alignItems: "center", justifyContent: "center" },
  bell: { width: 48, height: 48, borderRadius: 16, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  tile: { flex: 1, alignItems: "center", gap: 2, paddingVertical: 14, paddingHorizontal: 6, borderRadius: 18, borderWidth: 1.5, borderColor: c.border, borderBottomWidth: 4, backgroundColor: c.surfaceSecondary },
  row: { flexDirection: "row", gap: 12, minHeight: 56 },
  body: { flex: 1, gap: 4, paddingTop: 4, paddingBottom: 14 },
  top: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  dot: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", marginTop: 2 },
  line: { flex: 1, width: 2, backgroundColor: c.border, marginVertical: 2 },
}));
