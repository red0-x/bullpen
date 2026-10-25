import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { photoSource } from "@/src/api";
import { makeStyles, useTheme } from "@/src/theme";
import { Icon } from "@/src/ui";

// Google static map (proxied by the server so the key stays private). Falls back to a drawn pin.
export function MapPreview({ lat, lng, height = 170, testID = "map-preview" }: { lat: number; lng: number; height?: number; testID?: string }) {
  const { colors } = useTheme();
  const s = useStyles();
  const [failed, setFailed] = useState(false);
  const pulse = useSharedValue(0);
  useEffect(() => { setFailed(false); }, [lat, lng]);
  useEffect(() => { pulse.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }), -1); }, [pulse]);
  const ring = useAnimatedStyle(() => ({ opacity: 1 - pulse.value, transform: [{ scale: 0.6 + pulse.value * 1.6 }] }));
  return (
    <View style={[s.wrap, { height }]} testID={testID}>
      {!failed ? (
        <Image source={photoSource(`/api/onboarding/staticmap?lat=${lat}&lng=${lng}`)} style={StyleSheet.absoluteFill} contentFit="cover" transition={400}
          onError={() => setFailed(true)} testID={`${testID}-image`} />
      ) : (
        <LinearGradient colors={[colors.surfaceTertiary, colors.warningSoft]} style={[StyleSheet.absoluteFill, s.center]} testID={`${testID}-fallback`}>
          <View style={s.roadH} /><View style={s.roadV} />
          <Animated.View style={[s.ring, ring]} />
          <View style={s.pin}><Icon name="map-pin" size={22} color={colors.onBrandPrimary} /></View>
        </LinearGradient>
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { borderRadius: 16, overflow: "hidden", borderWidth: 1.5, borderColor: c.border, backgroundColor: c.surfaceTertiary },
  center: { alignItems: "center", justifyContent: "center" },
  roadH: { position: "absolute", left: 0, right: 0, top: "58%", height: 10, backgroundColor: c.surfaceSecondary },
  roadV: { position: "absolute", top: 0, bottom: 0, left: "30%", width: 10, backgroundColor: c.surfaceSecondary },
  ring: { position: "absolute", width: 56, height: 56, borderRadius: 28, backgroundColor: c.brand },
  pin: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.brand, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: c.surfaceSecondary },
}));
