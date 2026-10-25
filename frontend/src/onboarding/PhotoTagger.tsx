import { useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import Animated, { FadeInUp, ZoomIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { photoSource } from "@/src/api";
import { ItemSheet } from "@/src/onboarding/ItemSheet";
import { Frame, ItemDraft, itemIcon, Room, roomTitle } from "@/src/onboarding/shared";
import { makeStyles, useTheme } from "@/src/theme";
import { H, Icon, T } from "@/src/ui";

// Full-screen photo: tap a spot to tag the appliance there; tap a pin to edit it.
export function PhotoTagger({ frame, room, onClose, onChanged }: { frame: Frame | null; room: Room; onClose: () => void; onChanged: () => void }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const s = useStyles();
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [ratio, setRatio] = useState(4 / 3);
  const [draft, setDraft] = useState<ItemDraft | null>(null);
  const pins = room.items.filter((i) => frame && i.photo_url === frame.url && i.frame_point);

  // Where the photo actually sits inside the box with contentFit="contain".
  const rect = useMemo(() => {
    const { w, h } = box;
    if (!w || !h) return null;
    if (w / h > ratio) { const dw = h * ratio; return { x: (w - dw) / 2, y: 0, w: dw, h }; }
    const dh = w / ratio;
    return { x: 0, y: (h - dh) / 2, w, h: dh };
  }, [box, ratio]);

  const onTap = (e: any) => {
    if (!rect || !frame) return;
    // Native gives locationX/Y; react-native-web only gives the DOM offsetX/Y.
    const ev = e.nativeEvent;
    const lx = Number.isFinite(ev.locationX) ? ev.locationX : ev.offsetX;
    const ly = Number.isFinite(ev.locationY) ? ev.locationY : ev.offsetY;
    const x = (lx - rect.x) / rect.w;
    const y = (ly - rect.y) / rect.h;
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 1 || y < 0 || y > 1) return;
    setDraft({ room_id: room.id, photo_url: frame.url, frame_point: { x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000 }, source: "photo" });
  };

  return (
    <Modal visible={!!frame} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={s.root} testID="photo-tagger">
        <View style={[s.bar, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={onClose} style={s.close} hitSlop={8} testID="photo-tagger-close-button">
            <Icon name="x" size={20} color={colors.onSurfaceInverse} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <H size={20} style={{ color: colors.onSurfaceInverse }}>Tap to tag</H>
            <T size={13} style={{ color: colors.onSurfaceInverse, opacity: 0.75 }}>{roomTitle(room)} · {pins.length} tagged here</T>
          </View>
        </View>
        <Pressable style={{ flex: 1 }} onPress={onTap} onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })} testID="photo-tagger-canvas">
          {frame && (
            <Image source={photoSource(frame.url)} style={StyleSheet.absoluteFill} contentFit="contain" pointerEvents="none"
              onLoad={(e) => e.source?.width && setRatio(e.source.width / e.source.height)} />
          )}
          {rect && pins.map((p) => (
            <Animated.View key={p.id} entering={ZoomIn.springify().damping(14)}
              style={[s.pinWrap, { left: rect.x + p.frame_point!.x * rect.w - 22, top: rect.y + p.frame_point!.y * rect.h - 22 }]}>
              <Pressable onPress={() => setDraft({ ...p, room_id: room.id })} style={s.pin} hitSlop={6} testID={`photo-pin-${p.id}`}>
                <Icon name={itemIcon(p.name, p.category)} size={18} color={colors.onBrandPrimary} />
              </Pressable>
              <View style={s.pinLabel} pointerEvents="none"><T size={11} weight="bold" numberOfLines={1} style={{ color: colors.onSurface }}>{p.name}</T></View>
            </Animated.View>
          ))}
        </Pressable>
        <Animated.View entering={FadeInUp.delay(200)} style={[s.hint, { marginBottom: insets.bottom + 16 }]}>
          <Icon name="crosshair" size={16} color={colors.onSurfaceInverse} />
          <T size={14} weight="semi" style={{ color: colors.onSurfaceInverse, flex: 1 }}>Tap an appliance or fixture in the photo to tag it.</T>
        </Animated.View>
        <ItemSheet draft={draft} roomType={room.type} roomName={roomTitle(room)} onClose={() => setDraft(null)} onSaved={onChanged} />
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surfaceInverse },
  bar: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingBottom: 12 },
  close: { width: 44, height: 44, borderRadius: 14, backgroundColor: c.overlay, alignItems: "center", justifyContent: "center" },
  pinWrap: { position: "absolute", alignItems: "center", width: 44 },
  pin: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.brand, borderWidth: 3, borderColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  pinLabel: { marginTop: 4, backgroundColor: c.surfaceSecondary, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1, minWidth: 60, maxWidth: 120, alignItems: "center" },
  hint: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 20, marginTop: 12, backgroundColor: c.overlay, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12 },
}));
