import { useState } from "react";
import { Pressable, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { makeStyles, useTheme } from "@/src/theme";
import { Icon, T } from "@/src/ui";

type Pick = { name: string; short: string; tag: string; reason: string; why?: string; detail?: string };

function BaseballCard({ p, n, best }: { p: Pick; n: number; best?: boolean }) {
  const s = useStyles();
  const { colors } = useTheme();
  const fresh = p.tag === "New to you";
  return (
    <View style={[s.card, best && s.cardBest]} testID={`pick-card-${n}`}>
      {best ? (
        <View style={s.bestRibbon}><T size={11} weight="bold" style={{ color: colors.onBrand, letterSpacing: 1.2 }} testID="best-pick-label">BEST PICK</T></View>
      ) : (
        <T size={12} weight="bold" muted>#{n}</T>
      )}
      <View style={[s.avatar, best && { width: 52, height: 52 }]}>
        <T size={best ? 20 : 15} weight="bold" style={{ color: colors.brand }}>{p.name.replace(/[^A-Za-z ]/g, "").split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("")}</T>
      </View>
      <T size={best ? 16 : 13} weight="bold" numberOfLines={2} style={{ textAlign: "center" }} testID={`pick-name-${n}`}>{p.name}</T>
      <View style={[s.tag, fresh && { backgroundColor: colors.warningSoft }]}>
        <T size={11} weight="semi" style={{ color: fresh ? colors.warning : colors.success }} testID={`pick-tag-${n}`}>{p.tag}</T>
      </View>
      {best && <T size={13} muted numberOfLines={2} style={{ textAlign: "center" }} testID="pick-reason-1">{p.reason}</T>}
    </View>
  );
}

/** #1 sits raised in front with BEST PICK, #2 and #3 tilt out behind it. */
export function PickCards({ picks }: { picks: Pick[] }) {
  const s = useStyles();
  const { colors } = useTheme();
  const [why, setWhy] = useState(false);
  const [a, b, c] = picks;
  if (!a) return null;
  return (
    <View style={{ gap: 12 }} testID="pick-cards">
      <T size={20} weight="bold" style={{ fontFamily: "Head" }} testID="your-best-title">Here are your {picks.length} best</T>
      <View style={s.stack}>
        {b && <Animated.View entering={FadeIn.delay(150)} style={[s.back, { left: 0, transform: [{ rotate: "-8deg" }] }]}><BaseballCard p={b} n={2} /></Animated.View>}
        {c && <Animated.View entering={FadeIn.delay(250)} style={[s.back, { right: 0, transform: [{ rotate: "8deg" }] }]}><BaseballCard p={c} n={3} /></Animated.View>}
        <Animated.View entering={FadeInDown.springify()} style={s.front}><BaseballCard p={a} n={1} best /></Animated.View>
      </View>
      <Pressable onPress={() => setWhy(!why)} style={({ pressed }) => [s.pill, pressed && { opacity: 0.7 }]} testID="why-1-pill" accessibilityRole="button">
        <Icon name="info" size={14} color={colors.brand} />
        <T size={13} weight="semi" style={{ color: colors.brand }}>Why #1?</T>
      </Pressable>
      {why && <T size={14} muted style={{ textAlign: "center" }} testID="why-1-text">{a.why}</T>}
    </View>
  );
}

/** Single raised card for the "Trying next" state. */
export function NextCard({ pick }: { pick: Pick }) {
  const s = useStyles();
  return (
    <Animated.View entering={FadeInDown.springify()} style={{ alignItems: "center" }}>
      <View style={{ width: "62%" }}><BaseballCard p={pick} n={1} best /></View>
      {pick.why && <T size={13} muted style={[{ textAlign: "center", marginTop: 8 }, s.whyNext]}>{pick.why}</T>}
    </Animated.View>
  );
}

const useStyles = makeStyles((c) => ({
  stack: { height: 250, marginTop: 8 },
  back: { position: "absolute", top: 34, width: "46%", opacity: 0.92 },
  front: { position: "absolute", top: 0, left: "20%", width: "60%", zIndex: 3 },
  card: {
    backgroundColor: c.surfaceSecondary, borderRadius: 18, borderWidth: 1.5, borderColor: c.border, padding: 12, gap: 8, alignItems: "center",
    minHeight: 190, shadowColor: c.shadow, shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 2,
  },
  cardBest: { borderColor: c.brand, borderWidth: 2, minHeight: 220, paddingTop: 0, shadowOpacity: 0.22, shadowRadius: 14, elevation: 8 },
  bestRibbon: { backgroundColor: c.brand, paddingHorizontal: 12, paddingVertical: 4, borderBottomLeftRadius: 10, borderBottomRightRadius: 10 },
  avatar: { width: 40, height: 40, borderRadius: 999, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  tag: { backgroundColor: c.successSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  pill: { alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, minHeight: 36, borderRadius: 999, borderWidth: 1.5, borderColor: c.brand, backgroundColor: c.surfaceSecondary },
  whyNext: { paddingHorizontal: 8 },
}));
