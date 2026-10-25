import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as VideoThumbnails from "expo-video-thumbnails";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInDown, LinearTransition } from "react-native-reanimated";
import { api, errorText, photoSource } from "@/src/api";
import { RoomScanner } from "@/src/ar/RoomScanner";
import { arUnavailableText, useArSupport } from "@/src/ar/ScanAvailability";
import type { ScanResult } from "@/src/ar/types";
import { Screen } from "@/src/components/Screen";
import { ItemRow } from "@/src/onboarding/ItemRow";
import { ItemSheet } from "@/src/onboarding/ItemSheet";
import { LiveCamera } from "@/src/onboarding/LiveCamera";
import { PhotoTagger } from "@/src/onboarding/PhotoTagger";
import { Frame, ItemDraft, itemIcon, mergeSuggestions, Room, ROOM_TYPES, roomMeta, roomTitle, sqft, Suggestion, uploadFile, uploadPhoto } from "@/src/onboarding/shared";
import { useCameraGate } from "@/src/onboarding/useCameraGate";
import { toast } from "@/src/toast";
import { makeStyles, useTheme } from "@/src/theme";
import { Btn, Card, Chip, ChipWrap, Field, H, Icon, Notice, Sheet, Skeleton, T } from "@/src/ui";

export default function RoomCapture() {
  const { id, scan } = useLocalSearchParams<{ id: string; scan?: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const s = useStyles();
  const [room, setRoom] = useState<Room | null>(null);
  const [error, setError] = useState("");
  const { support } = useArSupport();
  const [scanner, setScanner] = useState<"roomplan" | "xr" | null>(null);
  const [working, setWorking] = useState("");
  const [draft, setDraft] = useState<ItemDraft | null>(null);
  const [tagFrame, setTagFrame] = useState<Frame | null>(null);
  const [editing, setEditing] = useState<{ type: string; label: string } | null>(null);
  const [liveCam, setLiveCam] = useState(false);

  const load = useCallback(async () => {
    try { setRoom(await api<Room>(`/onboarding/rooms/${id}`)); setError(""); } catch (e) { setError(errorText(e)); }
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const patch = async (body: any) => {
    const r = await api<Room>(`/onboarding/rooms/${id}`, { method: "PATCH", body });
    setRoom(r);
    return r;
  };

  const pickPhotos = async () => {
    try {
      const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: true, selectionLimit: 6, quality: 0.85 });
      if (!r.canceled) addFrames(r.assets.map((a) => a.uri));
    } catch { toast.error("Those photos didn't load. Try again."); }
  };
  const camera = useCameraGate(pickPhotos);

  // Save photos, then let AI spot appliances in the first new one.
  const addFrames = async (uris: string[]) => {
    if (!room || !uris.length) return;
    try {
      const fresh: Frame[] = [];
      for (let i = 0; i < uris.length; i++) {
        setWorking(uris.length > 1 ? `Saving photo ${i + 1} of ${uris.length}…` : "Saving photo…");
        fresh.push(await uploadPhoto(uris[i]));
      }
      // Re-read the room so a second batch never overwrites the first one's photos.
      const latest = await api<Room>(`/onboarding/rooms/${id}`);
      let r = await patch({ scan_data: { frames: [...(latest.scan_data.frames || []), ...fresh] } });
      setWorking("Spotting appliances…");
      const sg = await api("/onboarding/suggest", { method: "POST", body: { photo: fresh[0].url }, timeout: 60000 }).catch(() => null);
      if (sg?.ok && sg.items?.length) {
        const cur = r.scan_data.suggested;
        r = await patch({ scan_data: { suggested: {
          type: cur?.type || sg.room_type, items: mergeSuggestions(cur?.items || [], sg.items, r.items),
          source: cur?.source || "photo", photo_url: (cur as any)?.photo_url || fresh[0].url,
        } } });
      }
      const spotted = !!(sg?.ok && sg.items?.length);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      const saved = fresh.length > 1 ? `${fresh.length} photos saved.` : "Photo saved.";
      toast.success(spotted ? `${saved} Check what Bullpen spotted below.` : `${saved} Nothing spotted automatically, so tap a photo to tag items.`);
    } catch (e) { toast.error(errorText(e)); } finally { setWorking(""); }
  };

  // In-app live camera: no system picker, so nothing can block it from opening.
  const takePhoto = () => setLiveCam(true);

  // Walkthrough video -> four still frames, treated like photos.
  const recordVideo = () => camera.ensure(async () => {
    try {
      const r = await ImagePicker.launchCameraAsync({ mediaTypes: ["videos"], videoMaxDuration: 30 });
      const a = r.canceled ? null : r.assets[0];
      if (!a) return;
      setWorking("Pulling frames from your video…");
      const dur = a.duration || 10000;
      const uris: string[] = [];
      for (const f of [0.1, 0.35, 0.6, 0.85]) {
        try { uris.push((await VideoThumbnails.getThumbnailAsync(a.uri, { time: Math.round(dur * f), quality: 0.8 })).uri); } catch {}
      }
      if (!uris.length) { setWorking(""); toast.error("Couldn't read that video. Try photos instead."); return; }
      await addFrames(uris);
    } catch { setWorking(""); toast.error("Video recording isn't available here. Try photos instead."); }
  }, "Record a quick walkthrough. Bullpen pulls clear frames from it to spot appliances.");

  const startAR = () => camera.ensure(() => setScanner(support?.roomplan ? "roomplan" : "xr"),
    "Bullpen uses the camera to map the room in AR and tag each appliance where it sits.");

  // Arrived from a room's "Scan in 3D" button: open the scanner straight away (once).
  const autoScan = useRef(scan === "1");
  useEffect(() => {
    if (!autoScan.current || !room || !support) return;
    autoScan.current = false;
    if (support.roomplan || support.xr) startAR();
  }, [room, support]); // eslint-disable-line react-hooks/exhaustive-deps

  const onScan = async (res: ScanResult) => {
    setScanner(null);
    if (!room) return;
    setWorking("Saving your scan…");
    try {
      const scan_data: any = {};
      if (res.method === "roomplan") {
        const json = res.jsonUri ? await uploadFile(res.jsonUri, "room.json", "application/json").catch(() => null) : null;
        const usdz = res.usdzUri ? await uploadFile(res.usdzUri, "room.usdz", "model/vnd.usdz+zip").catch(() => null) : null;
        scan_data.geometry = { method: "roomplan", json_path: json?.path || null, usdz_path: usdz?.path || null, summary: res.summary || null };
      } else {
        scan_data.ar = { method: res.method, planes: res.planes || 0, floor_area_m2: res.floor_area_m2 ?? null, anchors: res.items.length };
      }
      if (res.suggested?.items.length) {
        const cur = room.scan_data.suggested;
        scan_data.suggested = { type: res.suggested.type || cur?.type, items: mergeSuggestions(cur?.items || [], res.suggested.items, room.items), source: "scan" };
      }
      await patch({ scan_data });
      for (let i = 0; i < res.items.length; i++) {
        const it = res.items[i];
        setWorking(`Saving ${it.name} (${i + 1} of ${res.items.length})…`);
        const photo = it.photoUri ? await uploadPhoto(it.photoUri).catch(() => null) : null;
        await api(`/onboarding/rooms/${id}/items`, { method: "POST", body: { name: it.name, category: it.category, position: it.position || null, photo_url: photo?.url || null, source: "ar" } });
      }
      await load();
      toast.success(res.items.length ? `Scan saved with ${res.items.length} tagged.` : "Scan saved.");
    } catch (e) { toast.error(errorText(e)); } finally { setWorking(""); }
  };

  const suggested = room?.scan_data.suggested;
  const dropSuggestion = (name: string) => suggested && patch({ scan_data: { suggested: { ...suggested, items: suggested.items.filter((x) => x.name !== name) } } });

  const adding0 = useRef(false); // sync guard: state updates too late for two taps in the same frame
  const [adding, setAdding] = useState<string | null>(null); // suggestion being added (blocks double taps)
  const addSuggestion = async (sg: Suggestion) => {
    if (adding0.current) return;
    adding0.current = true;
    setAdding(sg.name);
    try {
      await api(`/onboarding/rooms/${id}/items`, { method: "POST", body: {
        name: sg.name, category: sg.category, brand: sg.brand || null, source: suggested?.source === "scan" ? "ar" : "photo",
        photo_url: suggested?.source === "photo" ? (suggested as any).photo_url || null : null,
      } });
      await dropSuggestion(sg.name);
      Haptics.selectionAsync().catch(() => {});
    } catch (e) { toast.error(errorText(e)); } finally { adding0.current = false; setAdding(null); }
  };

  const addAll = async () => {
    if (!suggested || adding0.current) return;
    adding0.current = true;
    setWorking(`Adding ${suggested.items.length} items…`);
    try {
      for (const sg of suggested.items) {
        await api(`/onboarding/rooms/${id}/items`, { method: "POST", body: {
          name: sg.name, category: sg.category, brand: sg.brand || null, source: suggested.source === "scan" ? "ar" : "photo",
          photo_url: suggested.source === "photo" ? (suggested as any).photo_url || null : null,
        } });
      }
      await patch({ scan_data: { suggested: { ...suggested, items: [] } } });
      toast.success("All added.");
    } catch (e) { toast.error(errorText(e)); } finally { adding0.current = false; setWorking(""); }
  };

  const markDone = async () => {
    try {
      if (room?.status !== "complete") await patch({ status: "complete" });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      if (router.canGoBack()) router.back(); else router.replace(`/onboarding/rooms?pid=${room?.property_id}`);
    } catch (e) { toast.error(errorText(e)); }
  };

  const saveRoom = async () => {
    if (!editing) return;
    try { await patch({ type: editing.type, label: editing.label }); setEditing(null); } catch (e) { toast.error(errorText(e)); }
  };

  if (!room) {
    return (
      <Screen back title="Room" testID="room">
        {error ? <View style={{ gap: 10 }}><Notice testID="room-error">{error}</Notice><Btn label="Try again" variant="secondary" onPress={load} /></View> : <Skeleton height={260} testID="room-loading" />}
      </Screen>
    );
  }

  const meta = roomMeta(room.type);
  const frames = room.scan_data.frames || [];
  const geo = room.scan_data.geometry;
  const ar = room.scan_data.ar;
  const area = geo?.summary?.floor_area_m2 ?? ar?.floor_area_m2;
  const arReady = !!support && (support.roomplan || support.xr);
  const done = room.status === "complete";
  const typeHint = room.type === "other" && suggested?.type && suggested.type !== "other" ? suggested.type : null;

  return (
    <Screen back eyebrow={meta.label} title={roomTitle(room)} sub="Scan it in 3D or add photos, then check the appliances Bullpen tagged." testID="room">
      <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
        <Btn variant="link" icon="pencil" label="Rename" onPress={() => setEditing({ type: room.type, label: room.label })} testID="room-edit-button" />
      </View>

      {!!working && (
        <Animated.View entering={FadeIn} style={s.working} testID="room-working">
          <ActivityIndicator color={colors.brand} />
          <T weight="semi" style={{ flex: 1 }}>{working}</T>
        </Animated.View>
      )}

      <Card style={{ gap: 14 }} testID="room-capture-card">
        <View style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
          <View style={s.heroIcon}><Icon name="cuboid" size={26} color={colors.brand} /></View>
          <View style={{ flex: 1 }}>
            <H size={22}>{geo || ar ? "3D scan saved" : "3D room scan"}</H>
            <T size={14} muted>{geo || ar ? "Scan again any time, or add photos for close-ups." : arReady ? "Walk the room slowly with your phone. It takes about a minute." : "Not available here. Add photos below."}</T>
          </View>
        </View>
        {(geo || ar) && (
          <View style={s.stats} testID="room-scan-stats">
            {area ? <Stat icon="square-dashed-bottom" value={`${sqft(area)}`} label="sq ft" /> : null}
            {geo?.summary ? <Stat icon="door-open" value={`${geo.summary.doors + geo.summary.openings}`} label="doors" /> : null}
            {geo?.summary ? <Stat icon="layers-3" value={`${geo.summary.walls}`} label="walls" /> : null}
            {ar ? <Stat icon="layers-3" value={`${ar.planes}`} label="surfaces" /> : null}
            <Stat icon="box" value={`${room.items.length}`} label="items" />
          </View>
        )}
        {arReady ? (
          <Btn big={!geo && !ar} label={geo || ar ? "Scan again in 3D" : "Scan room in 3D"} icon="scan-line"
            onPress={startAR} disabled={!!working} testID="room-ar-scan-button" />
        ) : support && (
          <Notice testID="room-ar-unavailable">{arUnavailableText()}</Notice>
        )}
        <T size={13} weight="semi" muted style={{ textAlign: "center" }}>{arReady ? "Or add photos" : "Add photos"}</T>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Btn label="Camera" icon="camera" variant={arReady || frames.length ? "secondary" : "primary"} style={{ flex: 1 }} onPress={takePhoto} disabled={!!working} testID="room-take-photo-button" />
          <Btn label="Upload" icon="image-plus" variant="secondary" style={{ flex: 1 }} onPress={pickPhotos} disabled={!!working} testID="room-upload-button" />
        </View>
        {Platform.OS !== "web" && <Btn label="Record a walkthrough video" icon="video" variant="link" style={{ alignSelf: "center" }} onPress={recordVideo} disabled={!!working} testID="room-video-button" />}
      </Card>

      {frames.length > 0 && (
        <View style={{ gap: 10 }} testID="room-photos">
          <View style={{ flexDirection: "row", alignItems: "baseline" }}>
            <H size={20} style={{ flex: 1 }}>Photos</H>
            <T size={13} muted>Tap one to tag items</T>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }} style={{ marginHorizontal: -20 }} contentInset={{ left: 20, right: 20 }}>
            <View style={{ width: 10 }} />
            {frames.map((f, i) => {
              const n = room.items.filter((it) => it.photo_url === f.url && it.frame_point).length;
              return (
                <Animated.View key={f.path} entering={FadeInDown.delay(i * 60)}>
                  <Pressable onPress={() => setTagFrame(f)} style={({ pressed }) => [s.frame, pressed && { transform: [{ scale: 0.97 }] }]} testID={`room-photo-${i}`}>
                    <Image source={photoSource(f.url)} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
                    <View style={s.frameBadge}>
                      <Icon name="crosshair" size={12} color={colors.onSurfaceInverse} />
                      <T size={11} weight="bold" style={{ color: colors.onSurfaceInverse }}>{n ? `${n} tagged` : "Tag"}</T>
                    </View>
                  </Pressable>
                </Animated.View>
              );
            })}
            <View style={{ width: 10 }} />
          </ScrollView>
        </View>
      )}

      {(!!suggested?.items.length || typeHint) && (
        <Card style={{ gap: 12 }} testID="room-suggestions">
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Icon name="sparkles" size={16} color={colors.brand} />
            <H size={20} style={{ flex: 1 }}>{suggested?.source === "scan" ? "Found in your scan" : "Spotted in your photo"}</H>
          </View>
          {typeHint && (
            <View style={s.hint} testID="room-type-hint">
              <T size={14} style={{ flex: 1 }}>Looks like a <T size={14} weight="bold">{roomMeta(typeHint).label.toLowerCase()}</T>.</T>
              <Btn small label="Use it" onPress={() => patch({ type: typeHint })} testID="room-type-hint-button" />
            </View>
          )}
          {!!suggested?.items.length && <T size={14} muted>Tap + to add it, or × if it isn&apos;t there.</T>}
          {suggested?.items.map((sg, i) => (
            <Animated.View key={sg.name} entering={FadeInDown.delay(i * 60)} layout={LinearTransition} style={s.suggestRow} testID={`suggestion-${i}`}>
              <View style={s.sIcon}><Icon name={itemIcon(sg.name, sg.category)} size={16} color={colors.brand} /></View>
              <View style={{ flex: 1 }}>
                <T weight="semi">{sg.name}</T>
                {!!sg.brand && <T size={12} muted>{sg.brand}</T>}
              </View>
              <Pressable onPress={() => dropSuggestion(sg.name)} disabled={!!adding} style={s.mini} hitSlop={4} testID={`suggestion-${i}-dismiss`} accessibilityLabel={`Dismiss ${sg.name}`}>
                <Icon name="x" size={16} color={colors.muted} />
              </Pressable>
              <Pressable onPress={() => addSuggestion(sg)} disabled={!!adding} style={[s.mini, s.miniOn, !!adding && adding !== sg.name && { opacity: 0.5 }]} hitSlop={4} testID={`suggestion-${i}-add`} accessibilityLabel={`Add ${sg.name}`}>
                {adding === sg.name ? <ActivityIndicator size="small" color={colors.onBrandPrimary} /> : <Icon name="plus" size={16} color={colors.onBrandPrimary} />}
              </Pressable>
            </Animated.View>
          ))}
          {(suggested?.items.length || 0) > 1 && <Btn small variant="secondary" icon="plus" label={`Add all ${suggested!.items.length}`} onPress={addAll} disabled={!!working} testID="suggestions-add-all-button" />}
        </Card>
      )}

      <Card style={{ gap: 4 }} testID="room-items">
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
          <H size={20} style={{ flex: 1 }}>Tagged items</H>
          <T size={14} weight="semi" muted testID="room-items-count">{room.items.length}</T>
        </View>
        {room.items.length === 0
          ? <T size={14} muted style={{ paddingVertical: 8 }}>Nothing tagged yet. Scan, tap a photo, or add one by hand.</T>
          : room.items.map((it) => <ItemRow key={it.id} item={it} onPress={() => setDraft({ ...it, room_id: room.id })} testID={`room-item-${it.id}`} />)}
        <Btn variant="link" icon="plus" label="Add an item by hand" onPress={() => setDraft({ room_id: room.id, source: "manual" })} testID="room-add-item-button" />
      </Card>

      <Btn big label={done ? "Back to rooms" : "Room done"} icon="check" onPress={markDone} disabled={!!working} testID="room-done-button" />

      <ItemSheet draft={draft} roomType={room.type} roomName={roomTitle(room)} onClose={() => setDraft(null)} onSaved={load} />
      <PhotoTagger frame={tagFrame} room={room} onClose={() => setTagFrame(null)} onChanged={load} />
      <RoomScanner open={!!scanner} mode={scanner || "xr"} roomType={room.type} scanName={`room-${room.id.slice(0, 8)}`} xrOk={!!support?.xr}
        onClose={(m) => { setScanner(null); if (m) toast(m); }} onDone={onScan} />
      {camera.sheet}
      <LiveCamera open={liveCam} title={`Snap the ${roomTitle(room).toLowerCase()}`} onClose={() => setLiveCam(false)}
        onDone={(uris) => { setLiveCam(false); addFrames(uris); }} onUpload={pickPhotos} />
      <Sheet open={!!editing} onClose={() => setEditing(null)} title="Edit room" testID="edit-room-sheet">
        <ChipWrap testID="edit-room-types">
          {ROOM_TYPES.map((t) => <Chip key={t.type} label={t.label} on={editing?.type === t.type} onPress={() => setEditing((e) => e && { ...e, type: t.type })} testID={`edit-room-type-${t.type.replace(/\s+/g, "-")}`} />)}
        </ChipWrap>
        <Field label="Name (optional)" value={editing?.label || ""} onChangeText={(v) => setEditing((e) => e && { ...e, label: v })} placeholder={meta.label} maxLength={80} testID="edit-room-label-input" />
        <Btn label="Save" icon="check" onPress={saveRoom} testID="edit-room-save-button" />
      </Sheet>
    </Screen>
  );
}

function Stat({ icon, value, label }: { icon: any; value: string; label: string }) {
  const { colors } = useTheme();
  const s = useStyles();
  return (
    <View style={s.stat}>
      <Icon name={icon} size={14} color={colors.brand} />
      <H size={18}>{value}</H>
      <T size={12} muted>{label}</T>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  working: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderRadius: 16, backgroundColor: c.warningSoft },
  heroIcon: { width: 56, height: 56, borderRadius: 18, backgroundColor: c.warningSoft, alignItems: "center", justifyContent: "center" },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  stat: { flexGrow: 1, minWidth: 72, alignItems: "center", gap: 2, paddingVertical: 10, borderRadius: 14, backgroundColor: c.surfaceTertiary },
  frame: { width: 132, height: 168, borderRadius: 18, overflow: "hidden", backgroundColor: c.surfaceTertiary, borderWidth: 1.5, borderColor: c.border },
  frameBadge: { position: "absolute", left: 8, bottom: 8, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: c.overlay, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  hint: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 14, backgroundColor: c.successSoft },
  suggestRow: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 52 },
  sIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: c.warningSoft, alignItems: "center", justifyContent: "center" },
  mini: { width: 44, height: 44, borderRadius: 14, borderWidth: 1.5, borderColor: c.border, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  miniOn: { backgroundColor: c.brand, borderColor: c.brand },
}));
