import { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, errorText } from "@/src/api";
import { usesNativeTabs } from "@/src/navigation";
import { toast } from "@/src/toast";
import { makeStyles, useTheme } from "@/src/theme";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { AmenityIcon } from "@/src/components/AmenityIcon";
import { Badge, Btn, Card, ConfirmSheet, EmptyState, H, Icon, Notice, Skeleton, T } from "@/src/ui";

function CoverageBadge({ count, testID }: { count: number; testID: string }) {
  if (count === 0) return <Badge kind="warn" label="No contractors" testID={testID} />;
  if (count === 1) return <Badge label="1 contractor" testID={testID} />;
  return <Badge kind="ready" label={`Ready · ${count}`} testID={testID} />;
}

function AmenityTile({ a }: { a: any }) {
  const router = useRouter();
  const s = useStyles();
  const top = a.top?.[0];
  const tid = `amenity-tile-${a.id}`;
  return (
    <Pressable style={({ pressed }) => [s.tile, pressed && { opacity: 0.75 }]} testID={tid}
      onPress={() => router.push({ pathname: "/(tabs)/bench", params: { focus: a.id } })}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={s.tileIcon}><AmenityIcon type={a.type} /></View>
        <View style={{ flex: 1 }}>
          <T weight="semi" size={14} numberOfLines={1}>{a.label}</T>
          <T size={12} muted numberOfLines={1}>{a.trade}</T>
        </View>
      </View>
      <CoverageBadge count={a.active_count} testID={`${tid}-badge`} />
      {top && <T size={12} muted numberOfLines={2} testID={`${tid}-top`}><T size={12} weight="semi">#1 {top.business_name}</T> · {top.score}</T>}
    </Pressable>
  );
}

function DemoControls({ status, onChange }: { status: any; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const undoLoad = async () => {
    try { await api("/demo", { method: "DELETE" }); toast("Demo data removed."); onChange(); } catch (e) { toast.error(errorText(e)); }
  };
  const load = async () => {
    setBusy(true);
    try {
      const d = await api("/demo/load", { method: "POST" });
      if (d.status === "already_loaded") toast("Demo data is already loaded.");
      else toast.success("Demo data loaded.", { action: { label: "Undo", onPress: undoLoad } });
      onChange();
    } catch (e) { toast.error(errorText(e)); } finally { setBusy(false); }
  };
  const reset = async () => {
    setBusy(true);
    try { await api("/demo/reset", { method: "POST" }); toast.success("Demo data reset to a fresh start."); setConfirm(false); onChange(); }
    catch (e) { toast.error(errorText(e)); } finally { setBusy(false); }
  };
  const own = (status?.own_contractors || 0) + (status?.own_properties || 0);
  return (
    <View style={{ flexDirection: "row", gap: 10 }} testID="demo-controls">
      <Btn label="Load demo" icon="database" variant={status?.demo_loaded ? "secondary" : "primary"} onPress={load} disabled={busy} style={{ flex: 1 }} testID="demo-load-button" />
      {status?.demo_loaded && <Btn label="Reset demo" icon="rotate-ccw" variant="secondary" onPress={() => setConfirm(true)} disabled={busy} style={{ flex: 1 }} testID="demo-reset-button" />}
      <ConfirmSheet open={confirm} onClose={() => setConfirm(false)} title="Reset demo data?" confirmLabel="Yes, reset it" onConfirm={reset} busy={busy} testID="demo-reset-sheet"
        body={"This deletes all demo properties, contractors, issues and job history, then loads a fresh copy." + (own > 0 ? ` Your own ${own} record${own === 1 ? "" : "s"} you added stay untouched.` : "")} />
    </View>
  );
}

export default function Properties() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const s = useStyles();
  const [props, setProps] = useState<any[] | null>(null);
  const [status, setStatus] = useState<any>(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [p, st] = await Promise.all([api("/properties"), api("/demo/status")]);
      setProps(p); setStatus(st); setError("");
    } catch (e) { setError(errorText(e)); }
  }, []);
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  return (
    <View style={s.root}>
      <ScreenHeader eyebrow="Your rentals" title="Properties" sub="Every amenity and how many backups you have for it." />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: (usesNativeTabs ? insets.bottom : 0) + 24, gap: 16 }} testID="properties-list"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await refresh(); setRefreshing(false); }} />}>
        <DemoControls status={status} onChange={refresh} />
        {!!error && (
          <View style={{ gap: 8 }} testID="properties-error">
            <Notice>{error}</Notice>
            <Btn label="Try again" variant="secondary" onPress={refresh} />
          </View>
        )}
        {props === null && !error && <Skeleton height={220} testID="properties-loading" />}
        {props?.length === 0 && (
          <EmptyState testID="properties-empty-state" title="No properties yet" body="Load the demo to see Bullpen with three sample rentals and a bench of made-up contractors." />
        )}
        {props?.map((p, i) => {
          const gaps = p.amenities.filter((a: any) => a.active_count === 0).length;
          return (
            <Card key={p.id} delay={i * 80} style={{ gap: 14 }} testID={`property-card-${p.id}`}>
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <H size={22} testID={`property-card-${p.id}-name`}>{p.name}</H>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                    <Icon name="map-pin" size={13} color={colors.muted} /><T size={14} muted>{p.city}</T>
                  </View>
                </View>
                {gaps > 0 ? <Badge kind="warn" label={`${gaps} ${gaps === 1 ? "gap" : "gaps"}`} /> : <Badge kind="ready" label="All covered" />}
              </View>
              {p.amenities.length === 0 ? <T size={14} muted>No amenities yet.</T> : (
                <View style={s.grid}>
                  {p.amenities.map((a: any) => <View key={a.id} style={s.cell}><AmenityTile a={a} /></View>)}
                </View>
              )}
            </Card>
          );
        })}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  grid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -5 },
  cell: { width: "50%", padding: 5 },
  tile: { minHeight: 116, borderRadius: 16, borderWidth: 1.5, borderColor: c.border, backgroundColor: c.surface, padding: 10, gap: 8 },
  tileIcon: { width: 34, height: 34, borderRadius: 8, borderWidth: 1.5, borderColor: c.border, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center" },
}));
