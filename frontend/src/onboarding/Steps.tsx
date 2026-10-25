import { useEffect } from "react";
import { View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { makeStyles, useTheme } from "@/src/theme";
import { Icon, T } from "@/src/ui";

const STEPS = ["Address", "Scan rooms", "Finish"];

// Three-part progress bar; each segment fills in turn when the step changes.
export function Steps({ step }: { step: 0 | 1 | 2 }) {
  return (
    <View style={{ flexDirection: "row", gap: 8 }} testID="onboarding-steps">
      {STEPS.map((label, i) => <Segment key={label} label={label} index={i} state={i < step ? "done" : i === step ? "now" : "next"} />)}
    </View>
  );
}

function Segment({ label, index, state }: { label: string; index: number; state: "done" | "now" | "next" }) {
  const { colors } = useTheme();
  const s = useStyles();
  const fill = useSharedValue(0);
  useEffect(() => {
    fill.value = withDelay(120 + index * 140, withTiming(state === "next" ? 0 : state === "now" ? 0.55 : 1, { duration: 700, easing: Easing.out(Easing.cubic) }));
  }, [state, index, fill]);
  const bar = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));
  const on = state !== "next";
  return (
    <View style={{ flex: 1, gap: 8 }} testID={`onboarding-step-${index}-${state}`}>
      <View style={s.track}><Animated.View style={[s.fill, bar]} /></View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <View style={[s.dot, on && s.dotOn]}>
          {state === "done" ? <Icon name="check" size={11} color={colors.onBrandPrimary} /> : <T size={10} weight="bold" style={{ color: on ? colors.onBrandPrimary : colors.muted, lineHeight: 13 }}>{index + 1}</T>}
        </View>
        <T size={12} weight="semi" style={{ color: on ? colors.onSurface : colors.muted }}>{label}</T>
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  track: { height: 6, borderRadius: 3, backgroundColor: c.border, overflow: "hidden" },
  fill: { height: 6, borderRadius: 3, backgroundColor: c.brand },
  dot: { width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: c.surfaceTertiary, borderWidth: 1.5, borderColor: c.border },
  dotOn: { backgroundColor: c.brand, borderColor: c.brand },
}));
