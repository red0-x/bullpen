// iOS: Apple RoomPlan (LiDAR iPhones/iPads) builds a 3D floor plan and detects appliances.
// iPhones without LiDAR fall back to ARKit tagging through munim-xr.
import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Platform, StyleSheet, View } from "react-native";
import { fetch as expoFetch } from "expo/fetch";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { makeStyles, useTheme } from "@/src/theme";
import { Btn, H, Icon, T } from "@/src/ui";
import { XRTagger, xrSupport } from "./XRTagger";
import { parseRoomPlan, type ArSupport, type ScannerProps } from "./types";

let RP: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- loaded lazily: missing in Expo Go / web
  RP = require("expo-roomplan");
} catch {
  RP = null;
}

export async function getArSupport(): Promise<ArSupport> {
  return { roomplan: !!RP && parseInt(String(Platform.Version), 10) >= 16, xr: await xrSupport() };
}

export function RoomScanner(p: ScannerProps) {
  const [mode, setMode] = useState(p.mode);
  const [notice, setNotice] = useState("");
  useEffect(() => { if (p.open) { setMode(p.mode); setNotice(""); } }, [p.open, p.mode]);

  const noLidar = () => {
    if (!p.xrOk) return p.onClose("This iPhone can't run room scans. Add photos instead.");
    setNotice("This iPhone has no LiDAR, so tag appliances in AR instead.");
    setMode("xr");
  };

  return (
    <Modal visible={p.open} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => p.onClose()}>
      {p.open && (mode === "roomplan" && RP ? <RoomPlanCapture {...p} onUnsupported={noLidar} /> : <XRTagger {...p} notice={notice} />)}
    </Modal>
  );
}

function RoomPlanCapture({ scanName, onClose, onDone, onUnsupported }: ScannerProps & { onUnsupported: () => void }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const s = useStyles();
  const [processing, setProcessing] = useState(false);
  const { viewProps, controls } = RP.useRoomPlanView({
    scanName, exportType: RP.ExportType.Parametric, exportOnFinish: true, sendFileLoc: true,
    onStatus: (e: any) => {
      const { status, errorMessage } = e.nativeEvent || {};
      if (status !== "Error") return;
      if (/not supported/i.test(errorMessage || "")) onUnsupported();
      else onClose(/permission/i.test(errorMessage || "") ? "Bullpen needs the camera to scan. Turn it on in Settings." : "The scan stopped. Try again, or add photos instead.");
    },
    onExported: async (e: any) => {
      const { scanUrl, jsonUrl } = e.nativeEvent || {};
      let parsed = {};
      try { if (jsonUrl) parsed = parseRoomPlan(JSON.parse(await (await expoFetch(jsonUrl)).text())); } catch {}
      onDone({ method: "roomplan", jsonUri: jsonUrl, usdzUri: scanUrl, items: [], ...parsed });
    },
  });

  useEffect(() => {
    controls.start();
    return () => controls.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={s.root} testID="roomplan-capture">
      <RP.RoomPlanView style={StyleSheet.absoluteFill} {...viewProps} />
      <View style={[s.top, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
        <Btn small variant="secondary" label="Cancel" icon="x" onPress={() => { controls.cancel(); onClose(); }} disabled={processing} testID="roomplan-cancel-button" />
        <View style={{ flex: 1 }} />
        <Btn small label="Done" icon="check" onPress={() => { setProcessing(true); controls.finishScan(); }} disabled={processing} testID="roomplan-done-button" />
      </View>
      {!processing && (
        <Animated.View entering={FadeInDown.delay(400)} style={[s.tip, { marginBottom: insets.bottom + 20 }]} pointerEvents="none">
          <Icon name="scan-line" size={16} color={colors.onSurfaceInverse} />
          <T size={14} weight="semi" style={{ color: colors.onSurfaceInverse, flex: 1 }}>Walk the room slowly. Walls, doors and appliances are mapped as you go.</T>
        </Animated.View>
      )}
      {processing && (
        <Animated.View entering={FadeIn} style={[StyleSheet.absoluteFill, s.processing]}>
          <ActivityIndicator color={colors.onSurfaceInverse} size="large" />
          <H size={22} style={{ color: colors.onSurfaceInverse }}>Building your floor plan…</H>
        </Animated.View>
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surfaceInverse, justifyContent: "space-between" },
  top: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20 },
  tip: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 20, backgroundColor: c.overlay, borderRadius: 16, padding: 14 },
  processing: { backgroundColor: c.overlay, alignItems: "center", justifyContent: "center", gap: 16 },
}));
