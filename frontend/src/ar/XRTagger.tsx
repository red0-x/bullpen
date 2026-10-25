// AR tagging with munim-xr (ARCore on Android, ARKit on iPhones without LiDAR).
// Maps the floor from detected planes and lets the host point at an appliance and tag it in place.
// Loaded lazily: in Expo Go / without a native build the module is missing and xrSupport() is false.
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import Animated, { Easing, FadeIn, FadeInDown, FadeOut, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { presetsFor, sqft } from "@/src/onboarding/shared";
import { fonts, makeStyles, useTheme } from "@/src/theme";
import { Btn, Chip, ChipRow, Icon, T } from "@/src/ui";
import type { ScanItem, ScannerProps } from "./types";

let XR: any = null;
let nitroCallback: ((fn: any) => any) | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- loaded lazily: missing in Expo Go / web
  XR = require("munim-xr");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  nitroCallback = require("react-native-nitro-modules").callback;
} catch {
  XR = null;
}

export async function xrSupport(): Promise<boolean> {
  if (!XR || !nitroCallback) return false;
  try {
    const a = await XR.checkAvailability();
    return a === "unknown" ? !!XR.isSupported() : a !== "unsupported";
  } catch {
    return false;
  }
}

type Tag = ScanItem & { anchorId?: string };

export function XRTagger({ roomType, onClose, onDone, notice }: ScannerProps & { notice?: string }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const s = useStyles();
  const xrRef = useRef<any>(null);
  const started = useRef(false);
  const planes = useRef(new Map<string, any>());
  const timer = useRef<any>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const [tracking, setTracking] = useState<"unavailable" | "limited" | "normal">("limited");
  const [floor, setFloor] = useState({ area: 0, planes: 0 });
  const [tags, setTags] = useState<Tag[]>([]);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<{ id: number; text: string } | null>(null);
  const [custom, setCustom] = useState<string | null>(null);
  const [error, setError] = useState("");

  // Floor = the lowest horizontal planes (ARCore can't tell a floor from a table top).
  const recompute = () => {
    const horiz = [...planes.current.values()].filter((p) => p.alignment === "horizontal" && p.classification !== "ceiling");
    const minY = Math.min(...horiz.map((p) => p.center?.y ?? 0));
    const area = horiz.filter((p) => p.classification === "floor" || (p.center?.y ?? 0) - minY < 0.3)
      .reduce((a, p) => a + (p.extent?.x || 0) * (p.extent?.z || 0), 0);
    setFloor({ area, planes: planes.current.size });
  };
  const schedule = () => {
    if (timer.current) return;
    timer.current = setTimeout(() => { timer.current = null; recompute(); }, 300);
  };

  const start = async () => {
    if (started.current || !xrRef.current) return;
    started.current = true;
    try {
      const a = await XR.checkAvailability();
      if ((a === "not-installed" || a === "update-required") && !(await XR.requestInstall())) {
        closeRef.current("Google Play Services for AR is needed to scan. Add photos instead.");
        return;
      }
      await xrRef.current.start();
    } catch {
      setError("AR couldn't start. Close and try again, or add photos instead.");
    }
  };

  const handlers = useMemo(() => {
    if (!nitroCallback) return null;
    const cb = nitroCallback;
    const upsert = (p: any) => { planes.current.set(p.id, p); schedule(); };
    return {
      hybridRef: cb((ref: any) => { xrRef.current = ref; setTimeout(start, 0); }),
      onPlaneDetected: cb(upsert),
      onPlaneUpdated: cb(upsert),
      onPlaneRemoved: cb((id: string) => { planes.current.delete(id); schedule(); }),
      onTrackingStateChange: cb((st: any) => setTracking(st)),
      onError: cb((m: string) => setError(m || "AR hit a problem.")),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => {
    clearTimeout(timer.current);
    try { xrRef.current?.pause(); } catch {}
  }, []);

  const say = (text: string) => setFlash({ id: Date.now(), text });

  const tag = async (name: string, category: string) => {
    if (busy || !xrRef.current) return;
    setBusy(true);
    try {
      const hits = await xrRef.current.hitTest(0.5, 0.5);
      const hit = hits?.[0];
      let position: Tag["position"];
      let anchorId: string | undefined;
      if (hit) {
        const anchor = await xrRef.current.createAnchor(hit.pose).catch(() => null);
        anchorId = anchor?.id;
        position = { ...hit.pose.position, distance_m: Math.round(hit.distance * 100) / 100, ...(anchorId ? { anchor_id: anchorId } : {}) };
      } else {
        const cam = xrRef.current.getCameraPose();
        if (cam) position = { ...cam.position, estimated: "camera" };
      }
      let photoUri: string | undefined;
      try {
        const p: string = await xrRef.current.captureSnapshot();
        photoUri = p.startsWith("file://") ? p : `file://${p}`;
      } catch {}
      setTags((t) => [...t, { name, category, position, photoUri, anchorId }]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      say(hit ? `Tagged ${name} · ${hit.distance.toFixed(1)} m away` : `Tagged ${name}`);
    } catch {
      say("Couldn't place that. Point at the appliance and try again.");
    } finally {
      setBusy(false);
      setCustom(null);
    }
  };

  const undo = () => {
    const last = tags[tags.length - 1];
    if (!last) return;
    if (last.anchorId) { try { xrRef.current?.removeAnchor(last.anchorId); } catch {} }
    setTags((t) => t.slice(0, -1));
    say(`Removed ${last.name}`);
  };

  const finish = () => onDone({
    method: Platform.OS === "ios" ? "arkit" : "arcore", planes: planes.current.size,
    floor_area_m2: floor.area > 0 ? Math.round(floor.area * 10) / 10 : undefined,
    items: tags.map(({ anchorId: _a, ...t }) => t),
  });

  const status = tracking !== "normal" ? "Move your phone slowly to map the room"
    : floor.planes === 0 ? "Point at the floor to start mapping"
    : floor.area > 0 ? `Floor ≈ ${sqft(floor.area)} sq ft · ${floor.planes} surfaces` : `${floor.planes} surfaces found`;

  if (!XR || !handlers) {
    return (
      <View style={[s.root, s.center, { padding: 24, gap: 16 }]} testID="xr-unavailable">
        <T style={{ color: colors.onSurfaceInverse, textAlign: "center" }}>AR isn&apos;t available in this build. Add photos instead.</T>
        <Btn label="Close" variant="secondary" onPress={() => onClose()} />
      </View>
    );
  }

  return (
    <View style={s.root} testID="xr-tagger">
      <XR.XRView style={StyleSheet.absoluteFill} planeDetection="both" depthEnabled={false} lightEstimationEnabled={false}
        frameCallbackFps={0} trackableUpdateMaxHz={5} {...handlers} />
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <View style={[s.top, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={() => onClose()} style={s.round} hitSlop={8} testID="xr-close-button">
            <Icon name="x" size={20} color={colors.onSurfaceInverse} />
          </Pressable>
          <View style={s.pill} testID="xr-status">
            <View style={[s.dot, { backgroundColor: tracking === "normal" ? colors.successSoft : colors.star }]} />
            <T size={13} weight="semi" numberOfLines={1} style={{ color: colors.onSurfaceInverse, flexShrink: 1 }}>{status}</T>
          </View>
        </View>
        {!!(notice || error) && (
          <Animated.View entering={FadeInDown} style={s.banner}>
            <T size={13} weight="semi" style={{ color: colors.onSurfaceInverse }}>{error || notice}</T>
          </Animated.View>
        )}
        <View style={s.center} pointerEvents="none">
          <Reticle active={tracking === "normal"} busy={busy} />
          {flash && (
            <Animated.View key={flash.id} entering={FadeIn.duration(150)} exiting={FadeOut.duration(250)} style={[s.pill, { marginTop: 24 }]}>
              <Icon name="circle-check" size={14} color={colors.successSoft} />
              <T size={13} weight="semi" style={{ color: colors.onSurfaceInverse }}>{flash.text}</T>
            </Animated.View>
          )}
        </View>
        <KeyboardAvoidingView behavior="padding">
          <View style={[s.panel, { paddingBottom: insets.bottom + 16 }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <T size={14} weight="semi" style={{ flex: 1 }}>Aim the circle at an appliance, then tap its name.</T>
              {tags.length > 0 && <Btn variant="link" label="Undo" onPress={undo} testID="xr-undo-button" />}
            </View>
            {custom !== null ? (
              <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                <TextInput value={custom} onChangeText={setCustom} autoFocus placeholder="What is it?" placeholderTextColor={colors.muted}
                  style={s.input} onSubmitEditing={() => custom.trim() && tag(custom.trim(), "appliance")} testID="xr-custom-input" />
                <Btn small label="Tag" disabled={!custom.trim() || busy} onPress={() => tag(custom.trim(), "appliance")} testID="xr-custom-tag-button" />
              </View>
            ) : (
              <ChipRow testID="xr-presets">
                {presetsFor(roomType).map((p) => <Chip key={p.name} label={p.name} onPress={() => tag(p.name, p.category)} testID={`xr-tag-${p.name.replace(/\W+/g, "-").toLowerCase()}`} />)}
                <Chip label="Other…" onPress={() => setCustom("")} testID="xr-tag-other" />
              </ChipRow>
            )}
            <Btn label={tags.length ? `Done · ${tags.length} tagged` : "Done"} icon="check" onPress={finish} testID="xr-done-button" />
          </View>
        </KeyboardAvoidingView>
      </View>
    </View>
  );
}

function Reticle({ active, busy }: { active: boolean; busy: boolean }) {
  const { colors } = useTheme();
  const s = useStyles();
  const v = useSharedValue(0);
  useEffect(() => { v.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.out(Easing.quad) }), -1); }, [v]);
  const ring = useAnimatedStyle(() => ({ opacity: active ? 0.9 - v.value * 0.9 : 0.35, transform: [{ scale: active ? 0.8 + v.value * 0.6 : 1 }] }));
  return (
    <View style={s.reticle}>
      <Animated.View style={[s.ring, ring]} />
      <View style={[s.core, active && { borderColor: colors.onSurfaceInverse }]}>
        {busy ? <ActivityIndicator color={colors.onSurfaceInverse} size="small" /> : <View style={[s.centerDot, active && { backgroundColor: colors.brandPrimaryHighlight }]} />}
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surfaceInverse },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  top: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 20 },
  round: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.overlay, alignItems: "center", justifyContent: "center" },
  pill: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: c.overlay, borderRadius: 999, paddingHorizontal: 14, minHeight: 36, flexShrink: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  banner: { marginHorizontal: 20, marginTop: 12, backgroundColor: c.overlay, borderRadius: 14, padding: 12 },
  reticle: { width: 96, height: 96, alignItems: "center", justifyContent: "center" },
  ring: { position: "absolute", width: 96, height: 96, borderRadius: 48, borderWidth: 2, borderColor: c.onSurfaceInverse },
  core: { width: 44, height: 44, borderRadius: 22, borderWidth: 2.5, borderColor: c.border, alignItems: "center", justifyContent: "center" },
  centerDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.onSurfaceInverse },
  panel: { backgroundColor: c.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 12 },
  input: { flex: 1, minHeight: 44, borderRadius: 10, borderWidth: 1.5, borderColor: c.border, backgroundColor: c.surfaceSecondary, paddingHorizontal: 12, fontFamily: fonts.body, fontSize: 16, color: c.onSurface },
}));
