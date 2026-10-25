import { useState } from "react";
import { Pressable, View } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { api, errorText } from "@/src/api";
import { useAuth } from "@/src/auth";
import { Screen } from "@/src/components/Screen";
import { itemIcon, Room, ROOM_TYPES, roomMeta, roomTitle, useOnboarding } from "@/src/onboarding/shared";
import { Steps } from "@/src/onboarding/Steps";
import { toast } from "@/src/toast";
import { makeStyles, useTheme } from "@/src/theme";
import { Badge, Btn, Card, ConfirmSheet, EmptyState, Field, H, Icon, Notice, Sheet, Skeleton, T } from "@/src/ui";

const STARTER = ["kitchen", "living room", "bedroom", "bathroom"];

export default function RoomsStep() {
  const router = useRouter();
  const { patchUser } = useAuth();
  const { colors } = useTheme();
  const s = useStyles();
  const { state, error, load } = useOnboarding();
  const [adding, setAdding] = useState(false);
  const [type, setType] = useState("kitchen");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState<"" | "add" | "starter" | "delete" | "later">("");
  const [del, setDel] = useState<Room | null>(null);
  const [laterOpen, setLaterOpen] = useState(false);

  if (state && !state.property) return <Redirect href="/onboarding" />;

  const create = async () => {
    setBusy("add");
    try {
      const r = await api<Room>("/onboarding/rooms", { method: "POST", body: { type, label: label.trim() } });
      setAdding(false);
      setLabel("");
      router.push(`/onboarding/room/${r.id}`);
    } catch (e) { toast.error(errorText(e)); } finally { setBusy(""); }
  };

  const starter = async () => {
    setBusy("starter");
    try {
      for (const t of STARTER) await api("/onboarding/rooms", { method: "POST", body: { type: t, label: "" } });
      await load();
      toast.success("Added 4 rooms. Tap one to scan it.");
    } catch (e) { toast.error(errorText(e)); } finally { setBusy(""); }
  };

  const remove = async () => {
    if (!del) return;
    setBusy("delete");
    try { await api(`/onboarding/rooms/${del.id}`, { method: "DELETE" }); setDel(null); await load(); toast(`${roomTitle(del)} removed.`); }
    catch (e) { toast.error(errorText(e)); } finally { setBusy(""); }
  };

  const later = async () => {
    setBusy("later");
    try {
      await api("/onboarding/complete", { method: "POST" });
      setLaterOpen(false);
      patchUser({ onboarding_complete: true });
      router.replace("/(tabs)");
    } catch (e) { toast.error(errorText(e)); } finally { setBusy(""); }
  };

  const p = state?.property;
  return (
    <Screen back eyebrow="Set up · Step 2 of 3" title="Rooms & appliances" onRefresh={load} testID="onboarding-rooms"
      sub="Scan each room and tag what's in it, so Bullpen knows every appliance when something breaks.">
      <Steps step={1} />
      {!!error && <Notice testID="rooms-error">{error}</Notice>}
      {!state && !error && <Skeleton height={220} testID="rooms-loading" />}
      {p && (
        <Card style={s.propRow} testID="rooms-property-card">
          <View style={s.propIcon}><Icon name="house" size={20} color={colors.brand} /></View>
          <View style={{ flex: 1 }}>
            <T weight="semi" numberOfLines={1}>{p.name}</T>
            <T size={13} muted numberOfLines={1}>{p.address}</T>
          </View>
          <Btn variant="link" label="Edit" onPress={() => router.push("/onboarding")} testID="rooms-edit-address-button" />
        </Card>
      )}

      {state && state.rooms.length === 0 && (
        <EmptyState pose="sniff" motion="sniff" title="Which rooms are there?" body="Start with the basics in one tap, or add rooms one at a time." testID="rooms-empty">
          <Btn label="Add the basic 4 rooms" icon="layout-grid" busy={busy === "starter"} disabled={!!busy} onPress={starter} testID="rooms-starter-button" />
          <T size={13} muted style={{ textAlign: "center" }}>Kitchen, living room, bedroom and bathroom</T>
          <Btn label="Add one room" icon="plus" variant="secondary" disabled={!!busy} onPress={() => setAdding(true)} testID="rooms-add-first-button" />
        </EmptyState>
      )}

      {state?.rooms.map((r, i) => <RoomCard key={r.id} r={r} i={i} onOpen={() => router.push(`/onboarding/room/${r.id}`)} onDelete={() => setDel(r)} />)}

      {state && state.rooms.length > 0 && (
        <Btn label="Add another room" icon="plus" variant="secondary" onPress={() => setAdding(true)} testID="rooms-add-button" />
      )}

      {state && (
        <View style={{ gap: 12, marginTop: 8 }}>
          <Btn big label="Review & finish" icon="arrow-right" onPress={() => router.push("/onboarding/review")} testID="rooms-review-button" />
          {!state.complete && <Btn variant="link" label="Skip rooms, scan them later" onPress={() => setLaterOpen(true)} style={{ alignSelf: "center" }} testID="rooms-skip-button" />}
        </View>
      )}

      <Sheet open={adding} onClose={() => setAdding(false)} title="Add a room" sub="Pick the closest match." testID="add-room-sheet">
        <View style={s.grid} testID="room-type-grid">
          {ROOM_TYPES.map((t) => {
            const on = t.type === type;
            return (
              <View key={t.type} style={s.cell}>
                <Pressable onPress={() => setType(t.type)} style={({ pressed }) => [s.tile, on && s.tileOn, pressed && { transform: [{ scale: 0.96 }] }]} testID={`room-type-${t.type.replace(/\s+/g, "-")}`}>
                  <Icon name={t.icon} size={22} color={on ? colors.brand : colors.muted} />
                  <T size={13} weight="semi" numberOfLines={1}>{t.label}</T>
                </Pressable>
              </View>
            );
          })}
        </View>
        <Field label="Name (optional)" value={label} onChangeText={setLabel} placeholder={`e.g. Upstairs ${roomMeta(type).label.toLowerCase()}`} maxLength={80} testID="room-label-input" />
        <Btn label="Add & scan it" icon="scan-line" busy={busy === "add"} disabled={!!busy} onPress={create} testID="add-room-confirm-button" />
      </Sheet>
      <ConfirmSheet open={!!del} onClose={() => setDel(null)} title={`Remove ${del ? roomTitle(del) : "room"}?`} confirmLabel="Remove room" onConfirm={remove} busy={busy === "delete"} testID="delete-room-sheet"
        body={del?.items.length ? `Its ${del.items.length} tagged ${del.items.length === 1 ? "item goes" : "items go"} too.` : "Nothing has been tagged in it yet."} />
      <ConfirmSheet open={laterOpen} onClose={() => setLaterOpen(false)} title="Scan rooms later?" confirmLabel="Finish with the address" onConfirm={later} busy={busy === "later"} testID="rooms-later-sheet"
        body="Your address is saved and Bullpen opens now. Scan rooms any time from the Rentals tab." />
    </Screen>
  );
}

function RoomCard({ r, i, onOpen, onDelete }: { r: Room; i: number; onOpen: () => void; onDelete: () => void }) {
  const { colors } = useTheme();
  const s = useStyles();
  const meta = roomMeta(r.type);
  const frames = r.scan_data.frames?.length || 0;
  const scanned = !!(r.scan_data.geometry || r.scan_data.ar);
  const done = r.status === "complete";
  const bits = [`${r.items.length} ${r.items.length === 1 ? "item" : "items"}`, frames ? `${frames} photo${frames > 1 ? "s" : ""}` : null, scanned ? "AR scan" : null].filter(Boolean).join(" · ");
  return (
    <Card delay={i * 70} style={{ padding: 0 }} testID={`room-card-${r.id}`}>
      <Pressable onPress={onOpen} style={({ pressed }) => [s.roomRow, pressed && { opacity: 0.8 }]} testID={`room-card-${r.id}-open`}>
        <View style={[s.roomIcon, done && { backgroundColor: colors.successSoft }]}><Icon name={meta.icon} size={22} color={done ? colors.success : colors.brand} /></View>
        <View style={{ flex: 1, gap: 2 }}>
          <H size={20} numberOfLines={1}>{roomTitle(r)}</H>
          <T size={13} muted numberOfLines={1}>{bits}</T>
        </View>
        <Badge kind={done ? "ready" : "warn"} icon={done ? "check" : undefined} label={done ? "Done" : "To scan"} />
        <Icon name="chevron-right" size={18} color={colors.muted} />
      </Pressable>
      <View style={s.roomFoot}>
        <View style={{ flexDirection: "row", gap: 6, flex: 1 }}>
          {r.items.slice(0, 6).map((it) => <View key={it.id} style={s.bubble}><Icon name={itemIcon(it.name, it.category)} size={13} color={colors.brand} /></View>)}
          {r.items.length > 6 && <View style={s.bubble}><T size={11} weight="bold" muted>+{r.items.length - 6}</T></View>}
          {r.items.length === 0 && <T size={13} muted>Tap to scan or add photos</T>}
        </View>
        <Pressable onPress={onDelete} style={s.trash} hitSlop={6} testID={`room-card-${r.id}-delete`} accessibilityLabel="Remove room">
          <Icon name="trash-2" size={16} color={colors.muted} />
        </Pressable>
      </View>
    </Card>
  );
}

const useStyles = makeStyles((c) => ({
  propRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14 },
  propIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: c.warningSoft, alignItems: "center", justifyContent: "center" },
  roomRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, paddingBottom: 10 },
  roomIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: c.warningSoft, alignItems: "center", justifyContent: "center" },
  roomFoot: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingBottom: 12, paddingTop: 10, borderTopWidth: 1.5, borderTopColor: c.border },
  bubble: { width: 28, height: 28, borderRadius: 14, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  trash: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -5 },
  cell: { width: "33.33%", padding: 5 },
  tile: { minHeight: 76, borderRadius: 16, borderWidth: 1.5, borderColor: c.border, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center", gap: 6, padding: 8 },
  tileOn: { borderColor: c.brand, backgroundColor: c.warningSoft },
}));
