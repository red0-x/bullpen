import { useCallback, useState } from "react";
import { Pressable, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { api, errorText } from "@/src/api";
import { toast } from "@/src/toast";
import { makeStyles, useTheme } from "@/src/theme";
import { Screen } from "@/src/components/Screen";
import { AmenityIcon } from "@/src/components/AmenityIcon";
import { useCoverPicker } from "@/src/components/CoverSheet";
import { RentalCover } from "@/src/components/RentalArt";
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
          <T weight="semi" size={14} numberOfLines={2}>{a.label}</T>
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
      <Btn label="Load demo" icon="database" small variant={status?.demo_loaded ? "secondary" : "primary"} onPress={load} disabled={busy} style={{ flex: 1 }} testID="demo-load-button" />
      {status?.demo_loaded && <Btn label="Reset demo" icon="rotate-ccw" small variant="secondary" onPress={() => setConfirm(true)} disabled={busy} style={{ flex: 1 }} testID="demo-reset-button" />}
      <ConfirmSheet open={confirm} onClose={() => setConfirm(false)} title="Reset demo data?" confirmLabel="Yes, reset it" onConfirm={reset} busy={busy} testID="demo-reset-sheet"
        body={"This deletes all demo properties, contractors, issues and job history, then loads a fresh copy." + (own > 0 ? ` Your own ${own} record${own === 1 ? "" : "s"} you added stay untouched.` : "")} />
    </View>
  );
}

function SetupCard({ ob }: { ob: any }) {
  const router = useRouter();
  const { colors } = useTheme();
  const s = useStyles();
  if (!ob || ob.complete) return null;
  return (
    <Card style={{ gap: 12, backgroundColor: colors.warningSoft }} testID="setup-card">
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={s.setupIcon}><Icon name="scan-line" size={22} color={colors.brand} /></View>
        <View style={{ flex: 1 }}>
          <H size={20}>Finish setting up</H>
          <T size={14} muted>Add your address and scan your rooms so Bullpen knows every appliance.</T>
        </View>
      </View>
      <Btn label="Continue setup" icon="arrow-right" onPress={() => router.push(ob.property ? `/onboarding/rooms?pid=${ob.property.id}` : "/onboarding")} testID="setup-card-button" />
    </Card>
  );
}

// Rooms & appliances + map pin for one rental (any rental, demo ones included).
function RoomsFooter({ p }: { p: any }) {
  const router = useRouter();
  const { colors } = useTheme();
  const s = useStyles();
  const tid = `property-card-${p.id}`;
  return (
    <View style={s.foot} testID={`${tid}-rooms`}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Icon name="cuboid" size={16} color={colors.brand} />
        <T size={14} weight="semi" style={{ flex: 1 }} testID={`${tid}-rooms-summary`}>
          {p.rooms_count ? `${p.rooms_count} ${p.rooms_count === 1 ? "room" : "rooms"} · ${p.items_count} tagged ${p.items_count === 1 ? "item" : "items"}` : "No rooms scanned yet"}
        </T>
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Btn small variant="secondary" icon="scan-line" label={p.rooms_count ? "Rooms" : "Scan rooms"} style={{ flex: 1 }}
          onPress={() => router.push(`/onboarding/rooms?pid=${p.id}`)} testID={`${tid}-rooms-button`} />
        {p.items_count > 0 && (
          <Btn small variant="secondary" icon="plug-zap" label="Appliances" style={{ flex: 1 }} onPress={() => router.push(`/appliances?pid=${p.id}`)} testID={`${tid}-appliances-button`} />
        )}
      </View>
      {p.geocode?.verified === false && (
        <Btn small variant="secondary" icon="map-pin-plus" label="Pin on map" onPress={() => router.push(`/onboarding?pid=${p.id}&pin=1`)} testID={`${tid}-pin-button`} />
      )}
    </View>
  );
}

export default function Properties() {
  const router = useRouter();
  const { colors } = useTheme();
  const s = useStyles();
  const [props, setProps] = useState<any[] | null>(null);
  const [status, setStatus] = useState<any>(null);
  const [ob, setOb] = useState<any>(null);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const [p, st, o] = await Promise.all([api("/properties"), api("/demo/status"), api("/onboarding").catch(() => null)]);
      setProps(p); setStatus(st); setOb(o); setError("");
    } catch (e) { setError(errorText(e)); }
  }, []);
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));
  const cover = useCoverPicker(refresh);

  return (
    <Screen eyebrow="Your properties" title="Rentals" sub="Every amenity and how many backups you have for it." onRefresh={refresh} testID="properties-list">
        <SetupCard ob={ob} />
        <Btn big label="Add a rental" icon="house-plus" onPress={() => router.push("/onboarding?new=1")} testID="add-rental-button" />
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
          const gaps = p.amenities.filter((a: any) => a.active_count < 2).length;
          return (
            <Card key={p.id} delay={i * 80} style={{ gap: 14 }} testID={`property-card-${p.id}`}>
              <View style={s.banner}>
                <RentalCover p={p} busy={cover.busyId === p.id} testID={`property-card-${p.id}-cover`} />
                <Pressable onPress={() => cover.open(p)} style={({ pressed }) => [s.coverBtn, pressed && { transform: [{ scale: 0.95 }] }]}
                  accessibilityLabel={`Change cover photo for ${p.name}`} testID={`property-card-${p.id}-cover-button`}>
                  <Icon name="camera" size={15} color={colors.brand} />
                  <T size={13} weight="semi" style={{ color: colors.brand }}>{p.cover_photo ? "Change" : "Add photo"}</T>
                </Pressable>
              </View>
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <H size={22} testID={`property-card-${p.id}-name`}>{p.name}</H>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                    <Icon name="map-pin" size={13} color={colors.muted} /><T size={14} muted numberOfLines={1} style={{ flexShrink: 1 }}>{p.city || p.address || "No address yet"}</T>
                  </View>
                </View>
                {p.amenities.length === 0 ? <Badge label="No amenities yet" /> : gaps > 0 ? <Badge kind="warn" label={`${gaps} ${gaps === 1 ? "gap" : "gaps"}`} /> : <Badge kind="ready" label="All covered" />}
              </View>
              {p.amenities.length === 0 ? <T size={14} muted>Amenities you track show up here with their backups.</T> : (
                <View style={s.grid}>
                  {p.amenities.map((a: any) => <View key={a.id} style={s.cell}><AmenityTile a={a} /></View>)}
                </View>
              )}
              <RoomsFooter p={p} />
            </Card>
          );
        })}
        {cover.sheet}
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  grid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -5 },
  cell: { width: "50%", padding: 5 },
  tile: { minHeight: 116, borderRadius: 16, borderWidth: 1.5, borderColor: c.border, backgroundColor: c.surface, padding: 10, gap: 8 },
  tileIcon: { width: 34, height: 34, borderRadius: 8, borderWidth: 1.5, borderColor: c.border, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  setupIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: c.surfaceSecondary, borderWidth: 1.5, borderColor: c.border, alignItems: "center", justifyContent: "center" },
  foot: { gap: 10, paddingTop: 12, borderTopWidth: 1.5, borderTopColor: c.border },
  banner: { marginTop: -20, marginHorizontal: -20, borderTopLeftRadius: 18.5, borderTopRightRadius: 18.5, overflow: "hidden" },
  coverBtn: { position: "absolute", right: 12, bottom: 12, minHeight: 44, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14,
    borderRadius: 999, backgroundColor: c.surfaceSecondary, borderWidth: 1.5, borderColor: c.border },
}));
