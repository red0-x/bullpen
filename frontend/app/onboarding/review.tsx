import { useEffect, useState } from "react";
import { Modal, Pressable, View } from "react-native";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import Animated, { Easing, FadeIn, useAnimatedStyle, useSharedValue, withDelay, withTiming, ZoomIn } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { api, errorText } from "@/src/api";
import { useAuth } from "@/src/auth";
import { Screen } from "@/src/components/Screen";
import { ItemRow } from "@/src/onboarding/ItemRow";
import { ItemSheet } from "@/src/onboarding/ItemSheet";
import { MapPreview } from "@/src/onboarding/MapPreview";
import { ItemDraft, Room, roomMeta, roomTitle, useOnboarding } from "@/src/onboarding/shared";
import { Steps } from "@/src/onboarding/Steps";
import { toast } from "@/src/toast";
import { makeStyles, useTheme } from "@/src/theme";
import { Badge, Btn, Card, H, Icon, Mascot, Notice, Skeleton, T } from "@/src/ui";

export default function ReviewStep() {
  const router = useRouter();
  const { patchUser } = useAuth();
  const { colors } = useTheme();
  const s = useStyles();
  const { pid } = useLocalSearchParams<{ pid?: string }>();
  const { state, error, load } = useOnboarding(pid || undefined);
  const [draft, setDraft] = useState<{ d: ItemDraft; room: Room } | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  if (state && !state.property) return <Redirect href="/onboarding" />;

  const rooms = state?.rooms || [];
  const items = rooms.flatMap((r) => r.items);
  const p = state?.property;
  const first = !!state?.first_setup;

  const finish = async () => {
    setBusy(true);
    try {
      await api("/onboarding/complete", { method: "POST", params: { property_id: p?.id } });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setDone(true);
    } catch (e) { toast.error(errorText(e)); } finally { setBusy(false); }
  };

  const enter = () => {
    setDone(false);
    patchUser({ onboarding_complete: true });
    if (first) router.replace("/(tabs)");
    else router.dismissTo("/(tabs)/properties"); // pop the setup screens instead of stacking a second Rentals
  };

  return (
    <Screen back eyebrow={`${first ? "Set up" : p?.name || "Rental"} · Step 3 of 3`} title="Look it over" sub="Fix anything that's off. You can add more any time." onRefresh={load} testID="onboarding-review">
      <Steps step={2} />
      {!!error && <Notice testID="review-error">{error}</Notice>}
      {!state && !error && <Skeleton height={240} testID="review-loading" />}
      {p && (
        <Card style={{ gap: 14 }} testID="review-property-card">
          {p.geocode?.lat != null && <MapPreview lat={p.geocode.lat} lng={p.geocode.lng} height={130} testID="review-map" />}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <H size={22} testID="review-property-name">{p.name}</H>
              <T size={14} muted>{p.address}</T>
              {p.geocode?.verified === false && <Badge icon="map-pin" label="No map pin yet" testID="review-unverified-badge" />}
            </View>
            <Btn variant="link" label="Edit" onPress={() => router.push(`/onboarding?pid=${p.id}`)} testID="review-edit-address-button" />
          </View>
        </Card>
      )}
      {state && (
        <View style={{ flexDirection: "row", gap: 10 }} testID="review-stats">
          <StatTile value={rooms.length} label={rooms.length === 1 ? "room" : "rooms"} icon="house" delay={0} />
          <StatTile value={items.length} label={items.length === 1 ? "item" : "items"} icon="box" delay={90} />
          <StatTile value={items.filter((i) => i.category === "appliance").length} label="appliances" icon="plug-zap" delay={180} />
        </View>
      )}
      {state && rooms.length === 0 && (
        <Notice testID="review-no-rooms">No rooms yet, and that&apos;s fine. Scan them later from the Rentals tab.</Notice>
      )}
      {rooms.map((r, i) => {
        const doneRoom = r.status === "complete";
        return (
          <Card key={r.id} delay={i * 70} style={{ gap: 4 }} testID={`review-room-${r.id}`}>
            <Pressable onPress={() => router.push(`/onboarding/room/${r.id}`)} style={({ pressed }) => [s.roomHead, pressed && { opacity: 0.75 }]} testID={`review-room-${r.id}-open`}>
              <View style={s.roomIcon}><Icon name={roomMeta(r.type).icon} size={18} color={colors.brand} /></View>
              <H size={20} style={{ flex: 1 }} numberOfLines={1}>{roomTitle(r)}</H>
              <Badge kind={doneRoom ? "ready" : "warn"} label={doneRoom ? "Done" : "To scan"} />
              <Icon name="chevron-right" size={18} color={colors.muted} />
            </Pressable>
            {r.items.length
              ? r.items.map((it) => <ItemRow key={it.id} item={it} onPress={() => setDraft({ d: { ...it, room_id: r.id }, room: r })} testID={`review-item-${it.id}`} />)
              : <T size={14} muted style={{ paddingVertical: 6 }}>Nothing tagged yet.</T>}
          </Card>
        );
      })}
      {state && (
        <View style={{ gap: 12, marginTop: 8 }}>
          <Btn big label={state.complete ? "Save & close" : "Finish setup"} icon="party-popper" busy={busy} onPress={finish} testID="review-finish-button" />
          <Btn variant="link" label="Add more rooms" onPress={() => (router.canGoBack() ? router.back() : router.replace(`/onboarding/rooms?pid=${p?.id}`))} style={{ alignSelf: "center" }} testID="review-more-rooms-button" />
        </View>
      )}
      <ItemSheet draft={draft?.d || null} roomType={draft?.room.type || "other"} roomName={draft ? roomTitle(draft.room) : undefined} onClose={() => setDraft(null)} onSaved={load} />
      <Celebrate open={done} name={p?.name || "Your rental"} rooms={rooms.length} items={items.length} onGo={enter} cta={first ? "Open Bullpen" : "Back to rentals"} />
    </Screen>
  );
}

function StatTile({ value, label, icon, delay }: { value: number; label: string; icon: any; delay: number }) {
  const { colors } = useTheme();
  const s = useStyles();
  return (
    <Animated.View entering={ZoomIn.delay(delay).springify().damping(14)} style={s.tile}>
      <Icon name={icon} size={16} color={colors.brand} />
      <H size={28}>{value}</H>
      <T size={12} muted>{label}</T>
    </Animated.View>
  );
}

const BURST = 14;

function Celebrate({ open, name, rooms, items, onGo, cta }: { open: boolean; name: string; rooms: number; items: number; onGo: () => void; cta: string }) {
  const s = useStyles();
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onGo} statusBarTranslucent>
      <View style={s.overlay}>
        <Animated.View entering={ZoomIn.springify().damping(13)} style={s.party} testID="onboarding-celebrate">
          <View style={{ alignItems: "center", justifyContent: "center" }}>
            {open && Array.from({ length: BURST }).map((_, i) => <Spark key={i} i={i} />)}
            <Mascot pose="cheer" size={170} motion="hop" />
          </View>
          <H size={30} style={{ textAlign: "center" }}>You&apos;re all set!</H>
          <T muted style={{ textAlign: "center" }}>
            {name} is ready{rooms ? ` with ${rooms} ${rooms === 1 ? "room" : "rooms"} and ${items} tagged ${items === 1 ? "item" : "items"}` : ""}. When something breaks, Bullpen already knows what&apos;s there.
          </T>
          <Animated.View entering={FadeIn.delay(500)} style={{ alignSelf: "stretch" }}>
            <Btn big label={cta} icon="arrow-right" onPress={onGo} testID="onboarding-enter-app-button" />
          </Animated.View>
        </Animated.View>
      </View>
    </Modal>
  );
}

// One confetti dot flying out from behind the mascot.
function Spark({ i }: { i: number }) {
  const { colors } = useTheme();
  const v = useSharedValue(0);
  const palette = [colors.brand, colors.star, colors.success, colors.warning, colors.brandPrimaryHighlight];
  const angle = (i / BURST) * Math.PI * 2;
  const dist = 110 + (i % 3) * 22;
  useEffect(() => { v.value = withDelay(150 + (i % 4) * 40, withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) })); }, [v, i]);
  const st = useAnimatedStyle(() => ({
    opacity: v.value < 0.7 ? 1 : 1 - (v.value - 0.7) / 0.3,
    transform: [{ translateX: Math.cos(angle) * dist * v.value }, { translateY: Math.sin(angle) * dist * v.value }, { scale: 0.4 + v.value * 0.8 }, { rotate: `${v.value * 180}deg` }],
  }));
  return <Animated.View pointerEvents="none" style={[{ position: "absolute", width: 12, height: i % 2 ? 12 : 6, borderRadius: 3, backgroundColor: palette[i % palette.length] }, st]} />;
}

const useStyles = makeStyles((c) => ({
  roomHead: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 48, marginBottom: 4 },
  roomIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: c.warningSoft, alignItems: "center", justifyContent: "center" },
  tile: { flex: 1, alignItems: "center", gap: 2, paddingVertical: 16, borderRadius: 18, borderWidth: 1.5, borderColor: c.border, borderBottomWidth: 4, backgroundColor: c.surfaceSecondary },
  overlay: { flex: 1, backgroundColor: c.overlay, alignItems: "center", justifyContent: "center", padding: 24 },
  party: { width: "100%", maxWidth: 420, backgroundColor: c.surface, borderRadius: 28, borderWidth: 1.5, borderColor: c.border, padding: 24, gap: 14, alignItems: "center" },
}));
