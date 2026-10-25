import { useEffect, useState } from "react";
import { Platform, View } from "react-native";
import Constants from "expo-constants";
import { makeStyles, useTheme } from "@/src/theme";
import { Card, H, Icon, T } from "@/src/ui";
import { getArSupport } from "./RoomScanner";
import type { ArSupport } from "./types";

const isExpoGo = Constants.executionEnvironment === "storeClient";

// Whether this phone can run the 3D / AR room scan (null while checking).
export function useArSupport() {
  const [support, setSupport] = useState<ArSupport | null>(null);
  useEffect(() => { getArSupport().then(setSupport).catch(() => setSupport({ roomplan: false, xr: false })); }, []);
  return { support, ready: !!support && (support.roomplan || support.xr) };
}

// Plain answer to "why can't I scan here?"
export function arUnavailableText() {
  if (Platform.OS === "web") return "3D scanning runs in the Bullpen app on your phone, not in a browser. Here, add photos of each room instead.";
  if (isExpoGo) return "3D scanning needs the installed Bullpen app (made with Publish), not Expo Go. Add photos of each room meanwhile.";
  return "This phone can't scan in 3D. Add photos of each room instead.";
}

// Top of the "Scan rooms" step: what the 3D scan does and whether it works on this device.
export function ScanIntro({ support }: { support: ArSupport | null }) {
  const { colors } = useTheme();
  const s = useStyles();
  if (!support) return null;
  const ready = support.roomplan || support.xr;
  return (
    <Card style={[s.card, ready && { backgroundColor: colors.successSoft }]} testID="scan-intro">
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={s.icon}><Icon name="cuboid" size={24} color={ready ? colors.success : colors.brand} /></View>
        <View style={{ flex: 1 }}>
          <H size={20}>3D room scan</H>
          <T size={13} weight="semi" style={{ color: ready ? colors.success : colors.warning }} testID="scan-intro-status">
            {ready ? "Ready on this phone" : "Not available here"}
          </T>
        </View>
      </View>
      <T size={14} muted testID="scan-intro-body">
        {support.roomplan ? "Tap Scan in 3D on a room, then walk it slowly. Bullpen maps the walls, doors and appliances in about a minute."
          : support.xr ? "Tap Scan in 3D on a room, then point your phone at each appliance to tag it where it sits."
          : arUnavailableText()}
      </T>
      {!ready && <T size={13} muted testID="scan-intro-devices">Works in the installed app on iPhone 12 Pro or newer (full 3D), and on most other iPhones and Android phones (AR tagging).</T>}
    </Card>
  );
}

const useStyles = makeStyles((c) => ({
  card: { gap: 10 },
  icon: { width: 48, height: 48, borderRadius: 16, backgroundColor: c.surfaceSecondary, borderWidth: 1.5, borderColor: c.border, alignItems: "center", justifyContent: "center" },
}));
