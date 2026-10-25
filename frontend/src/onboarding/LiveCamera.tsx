// In-app live camera (expo-camera): works in Expo Go, native builds and the web preview.
// Take several shots in a row, then hand them back. Handles its own permission states.
import { useRef, useState } from "react";
import { ActivityIndicator, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming, ZoomIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { makeStyles, useTheme } from "@/src/theme";
import { Btn, H, Icon, Mascot, T } from "@/src/ui";
import { useAfterDismiss } from "./useCameraGate";

type Props = { open: boolean; title: string; onClose: () => void; onDone: (uris: string[]) => void; onUpload?: () => void };

export function LiveCamera(p: Props) {
  const after = useAfterDismiss();
  // Gallery / upload: close the camera first, then open the picker once it's really gone.
  const upload = p.onUpload && (() => { after.queue(p.onUpload!); p.onClose(); });
  return (
    <Modal visible={p.open} animationType="slide" presentationStyle="fullScreen" onRequestClose={p.onClose} onDismiss={after.onDismiss} statusBarTranslucent>
      {p.open && <CameraBody {...p} onUpload={upload} />}
    </Modal>
  );
}

function CameraBody({ title, onClose, onDone, onUpload }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const s = useStyles();
  const [perm, request] = useCameraPermissions();
  const cam = useRef<CameraView>(null);
  const [ready, setReady] = useState(false);
  const [shots, setShots] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const flash = useSharedValue(0);
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value }));

  const shoot = async () => {
    if (!cam.current || busy || !ready) return;
    setBusy(true);
    flash.value = withSequence(withTiming(0.85, { duration: 60 }), withTiming(0, { duration: 260 }));
    try {
      const pic = await cam.current.takePictureAsync({ quality: 0.8 });
      if (pic?.uri) {
        setShots((x) => [...x, pic.uri]);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      }
    } catch {
      setError("That shot didn't take. Try again.");
    } finally {
      setBusy(false);
    }
  };

  if (!perm) {
    return <View style={[s.root, s.center]} testID="live-camera-loading"><ActivityIndicator color={colors.onSurfaceInverse} /></View>;
  }

  if (!perm.granted) {
    const blocked = !perm.canAskAgain;
    return (
      <View style={[s.root, s.permWrap, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]} testID="live-camera-permission">
        <Pressable onPress={onClose} style={s.round} hitSlop={8} testID="live-camera-close-button"><Icon name="x" size={20} color={colors.onSurfaceInverse} /></Pressable>
        <View style={[s.center, { gap: 16 }]}>
          <Mascot pose="camera" size={150} motion="bob" />
          <H size={26} style={{ color: colors.onSurfaceInverse, textAlign: "center" }}>{blocked ? "Camera is turned off" : "Use your camera"}</H>
          <T style={{ color: colors.onSurfaceInverse, opacity: 0.8, textAlign: "center" }}>
            {blocked ? "Turn the camera on for this app in Settings, or upload photos you already have." : "Snap each room so Bullpen can spot the appliances and fixtures in it."}
          </T>
        </View>
        <View style={{ gap: 12 }}>
          {blocked
            ? <Btn big label="Open Settings" icon="settings" onPress={() => Linking.openSettings()} testID="live-camera-settings-button" />
            : <Btn big label="Allow camera" icon="camera" onPress={() => request()} testID="live-camera-allow-button" />}
          {onUpload && <Btn label="Upload photos instead" variant="secondary" onPress={onUpload} testID="live-camera-upload-button" />}
        </View>
      </View>
    );
  }

  return (
    <View style={s.root} testID="live-camera">
      <CameraView ref={cam} style={StyleSheet.absoluteFill} facing="back" onCameraReady={() => setReady(true)}
        onMountError={(e) => setError(e?.message || "The camera couldn't start.")} />
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.surface }, flashStyle]} />
      <View style={[s.top, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={onClose} style={s.round} hitSlop={8} testID="live-camera-close-button"><Icon name="x" size={20} color={colors.onSurfaceInverse} /></Pressable>
        <View style={s.pill}>
          <T size={13} weight="semi" style={{ color: colors.onSurfaceInverse }} numberOfLines={1}>
            {error || (ready ? title : "Starting camera…")}
          </T>
        </View>
      </View>
      <View style={{ flex: 1 }} pointerEvents="none" />
      {shots.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.strip} testID="live-camera-shots">
          {shots.map((u, i) => (
            <Animated.View key={u + i} entering={ZoomIn.springify().damping(14)}>
              <Image source={{ uri: u }} style={s.thumb} contentFit="cover" />
            </Animated.View>
          ))}
        </ScrollView>
      )}
      <View style={[s.bottom, { paddingBottom: insets.bottom + 20 }]}>
        <View style={{ flex: 1 }}>
          {onUpload && shots.length === 0 && (
            <Pressable onPress={onUpload} style={s.round} hitSlop={8} testID="live-camera-gallery-button">
              <Icon name="images" size={20} color={colors.onSurfaceInverse} />
            </Pressable>
          )}
        </View>
        <Pressable onPress={shoot} disabled={!ready || busy} style={({ pressed }) => [s.shutter, (pressed || busy) && { transform: [{ scale: 0.92 }] }, !ready && { opacity: 0.5 }]}
          accessibilityLabel="Take photo" testID="live-camera-shutter-button">
          <View style={s.shutterCore}>{busy && <ActivityIndicator color={colors.brand} />}</View>
        </Pressable>
        <View style={{ flex: 1, alignItems: "flex-end" }}>
          {shots.length > 0 && (
            <Btn small label={`Use ${shots.length}`} icon="check" onPress={() => onDone(shots)} testID="live-camera-done-button" />
          )}
        </View>
      </View>
      {Platform.OS === "web" && !ready && !error && <View style={[StyleSheet.absoluteFill, s.center]} pointerEvents="none"><ActivityIndicator color={colors.onSurfaceInverse} /></View>}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surfaceInverse },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  permWrap: { paddingHorizontal: 24, justifyContent: "space-between" },
  top: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 20 },
  round: { width: 48, height: 48, borderRadius: 24, backgroundColor: c.overlay, alignItems: "center", justifyContent: "center" },
  pill: { flexShrink: 1, backgroundColor: c.overlay, borderRadius: 999, paddingHorizontal: 14, minHeight: 36, justifyContent: "center" },
  strip: { gap: 8, paddingHorizontal: 20, paddingBottom: 12 },
  thumb: { width: 56, height: 72, borderRadius: 10, borderWidth: 2, borderColor: c.onSurfaceInverse },
  bottom: { flexDirection: "row", alignItems: "center", paddingHorizontal: 24, paddingTop: 8 },
  shutter: { width: 80, height: 80, borderRadius: 40, borderWidth: 4, borderColor: c.onSurfaceInverse, alignItems: "center", justifyContent: "center" },
  shutterCore: { width: 64, height: 64, borderRadius: 32, backgroundColor: c.surface, alignItems: "center", justifyContent: "center" },
}));
