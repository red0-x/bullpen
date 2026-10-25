import { Pressable, View } from "react-native";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import { photoSource } from "@/src/api";
import { useAuth } from "@/src/auth";
import { Screen } from "@/src/components/Screen";
import { RentalCover } from "@/src/components/RentalArt";
import { itemIcon, roomTitle, useOnboarding } from "@/src/onboarding/shared";
import { serviceBadge } from "@/src/service";
import { makeStyles, useTheme } from "@/src/theme";
import { Badge, Btn, Card, EmptyState, Icon, Notice, Skeleton, T } from "@/src/ui";

// Every tagged appliance in one rental, grouped by room, with its service status.
export default function AppliancesScreen() {
  const { user } = useAuth();
  if (user === false) return <Redirect href="/welcome" />;
  return <AppliancesView />;
}

function AppliancesView() {
  const { pid } = useLocalSearchParams<{ pid: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const s = useStyles();
  const { state, error, load } = useOnboarding(pid);
  const p = state?.property;
  const rooms = (state?.rooms || []).filter((r) => r.items.length);
  const all = rooms.flatMap((r) => r.items) as any[];
  const due = all.filter((i) => { const b = serviceBadge(i.service); return b && b.kind === "warn"; }).length;

  return (
    <Screen back eyebrow={p?.name || "Rental"} title="Appliances" sub="Tap one to see its repairs, services and what they cost." onRefresh={load} testID="appliances">
      {!!error && <Notice testID="appliances-error">{error}</Notice>}
      {!state && !error && <Skeleton height={240} testID="appliances-loading" />}
      {p && (
        <View style={s.coverWrap}>
          <RentalCover p={p} height={110} testID="appliances-cover" />
        </View>
      )}
      {state && all.length > 0 && (
        <T size={14} muted testID="appliances-summary">
          {[`${all.length} tagged`, `${all.filter((i) => i.service).length} with reminders`, due > 0 ? `${due} due soon` : null].filter(Boolean).join(" · ")}
        </T>
      )}
      {state && all.length === 0 && (
        <EmptyState pose="sniff" motion="sniff" title="Nothing tagged yet" body="Scan a room and tag its appliances. Each one gets its own service reminders and repair history." testID="appliances-empty">
          <Btn label="Scan rooms" icon="scan-line" onPress={() => router.push(`/onboarding/rooms?pid=${pid}`)} testID="appliances-scan-button" />
        </EmptyState>
      )}
      {rooms.map((r, ri) => (
        <Card key={r.id} delay={ri * 60} style={{ gap: 2 }} testID={`appliances-room-${r.id}`}>
          <T size={13} weight="bold" style={{ color: colors.brand, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>{roomTitle(r)}</T>
          {r.items.map((it: any) => {
            const b = serviceBadge(it.service);
            return (
              <Pressable key={it.id} onPress={() => router.push(`/appliance/${it.id}`)} style={({ pressed }) => [s.row, pressed && { opacity: 0.7, transform: [{ scale: 0.99 }] }]} testID={`appliances-item-${it.id}`}>
                {it.photo_url
                  ? <Image source={photoSource(it.photo_url)} style={s.thumb} contentFit="cover" />
                  : <View style={s.icon}><Icon name={itemIcon(it.name, it.category)} size={18} color={colors.brand} /></View>}
                <View style={{ flex: 1, gap: 2 }}>
                  <T weight="semi" numberOfLines={1}>{it.name}</T>
                  <T size={13} muted numberOfLines={1}>{[it.brand, it.model].filter(Boolean).join(" · ") || "No brand yet"}</T>
                </View>
                {b?.kind === "warn" ? <Badge kind="warn" label={b.label} testID={`appliances-item-${it.id}-badge`} /> : <T size={12} muted testID={`appliances-item-${it.id}-badge`}>{b ? b.label : "No reminder"}</T>}
                <Icon name="chevron-right" size={16} color={colors.muted} />
              </Pressable>
            );
          })}
        </Card>
      ))}
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  coverWrap: { borderRadius: 20, overflow: "hidden", borderWidth: 1.5, borderColor: c.border },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 60, paddingVertical: 6 },
  thumb: { width: 44, height: 44, borderRadius: 12, backgroundColor: c.surfaceTertiary },
  icon: { width: 44, height: 44, borderRadius: 12, backgroundColor: c.warningSoft, alignItems: "center", justifyContent: "center" },
}));
