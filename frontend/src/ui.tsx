import { ReactNode, useContext, useEffect } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleProp, StyleSheet, Text, TextInput, TextInputProps, TextStyle, useWindowDimensions, View, ViewStyle } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import Lucide from "@react-native-vector-icons/lucide";
import Animated, { Extrapolation, FadeInDown, interpolate, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withSpring, withTiming, Easing } from "react-native-reanimated";
import { ScrollYContext } from "@/src/scroll";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import * as Haptics from "expo-haptics";
import { fonts, makeStyles, radius, useTheme } from "@/src/theme";

export type IconName = React.ComponentProps<typeof Lucide>["name"];
export const Icon = ({ name, size = 18, color }: { name: IconName; size?: number; color?: string }) => {
  const { colors } = useTheme();
  return <Lucide name={name} size={size} color={color ?? colors.onSurface} />;
};

// ---------- Text ----------
export function H({ children, size = 28, style, testID, numberOfLines }: { children: ReactNode; size?: number; style?: StyleProp<TextStyle>; testID?: string; numberOfLines?: number }) {
  const { colors } = useTheme();
  return <Text testID={testID} numberOfLines={numberOfLines} style={[{ fontFamily: fonts.head, fontSize: size, lineHeight: size * 1.12, color: colors.onSurface, letterSpacing: -0.3 }, style]}>{children}</Text>;
}

export function T({ children, size = 15, weight = "body", muted, style, testID, numberOfLines }: { children: ReactNode; size?: number; weight?: "body" | "semi" | "bold"; muted?: boolean; style?: StyleProp<TextStyle>; testID?: string; numberOfLines?: number }) {
  const { colors } = useTheme();
  return (
    <Text testID={testID} numberOfLines={numberOfLines}
      style={[{ fontFamily: fonts[weight], fontSize: size, lineHeight: size * 1.4, color: muted ? colors.muted : colors.onSurface }, style]}>
      {children}
    </Text>
  );
}

// ---------- Buttons ----------
type BtnProps = { label: string; onPress?: () => void; variant?: "primary" | "secondary" | "link"; icon?: IconName; disabled?: boolean; busy?: boolean; testID?: string; style?: StyleProp<ViewStyle>; big?: boolean; small?: boolean };

export function Btn({ label, onPress, variant = "primary", icon, disabled, busy, testID, style, big, small }: BtnProps) {
  const { colors } = useTheme();
  const s = useBtnStyles();
  if (variant === "link") {
    return (
      <Pressable testID={testID} onPress={onPress} disabled={disabled} hitSlop={6} style={({ pressed }) => [s.link, pressed && { opacity: 0.6 }, style]}>
        {icon && <Icon name={icon} size={16} color={colors.brand} />}
        <Text style={s.linkText}>{label}</Text>
      </Pressable>
    );
  }
  return <PressBtn {...{ label, onPress, variant, icon, disabled, busy, testID, style, big, small }} />;
}

function PressBtn({ label, onPress, variant, icon, disabled, busy, testID, style, big, small }: BtnProps) {
  const { colors } = useTheme();
  const s = useBtnStyles();
  const press = useSharedValue(0);
  const primary = variant === "primary";
  const fg = primary ? colors.onBrandPrimary : colors.onBrandSecondary;
  const off = disabled || busy;
  const radiusV = big ? 24 : radius.btn;
  const faceStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: press.value * 4 }, { scale: 1 - press.value * 0.015 }],
  }));
  const content = (
    <>
      {busy ? <ActivityIndicator color={fg} size="small" /> : icon ? (
        <View style={[s.iconBubble, big && s.iconBubbleBig, { backgroundColor: primary ? colors.onBrandPrimarySoft : colors.surface }]}>
          <Icon name={icon} size={big ? 22 : 16} color={fg} />
        </View>
      ) : null}
      <Text numberOfLines={1} style={[s.label, big && { fontSize: 20 }, small && { fontSize: 14 }, { color: fg }]}>{label}</Text>
    </>
  );
  return (
    <Pressable testID={testID} disabled={off}
      onPressIn={() => { press.value = withSpring(1, { damping: 18, stiffness: 520 }); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); }}
      onPressOut={() => { press.value = withSpring(0, { damping: 12, stiffness: 320 }); }}
      onPress={onPress}
      style={[{ opacity: off ? 0.55 : 1 }, style]}>
      <View>
        <View style={[s.lip, { borderRadius: radiusV, backgroundColor: primary ? colors.brandPrimaryLip : colors.border }]} />
        <Animated.View style={[faceStyle, { borderRadius: radiusV, marginBottom: 4, overflow: "hidden" }, !primary && s.secondary]}>
          {primary ? (
            <LinearGradient colors={[colors.brandPrimaryHighlight, colors.brandPrimary]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
              style={[s.face, big && s.big, small && s.small, s.sheen]}>
              {content}
            </LinearGradient>
          ) : (
            <View style={[s.face, big && s.big, small && s.small]}>{content}</View>
          )}
        </Animated.View>
      </View>
    </Pressable>
  );
}

const useBtnStyles = makeStyles((c) => ({
  lip: { position: "absolute", left: 0, right: 0, top: 4, bottom: 0, borderRadius: radius.btn },
  face: { minHeight: 52, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  big: { minHeight: 76, paddingHorizontal: 32 },
  small: { minHeight: 44, paddingHorizontal: 12, gap: 6 },
  sheen: { borderTopWidth: 1, borderTopColor: c.brandPrimarySheen },
  secondary: { backgroundColor: c.brandSecondary, borderWidth: 1.5, borderColor: c.border },
  iconBubble: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  iconBubbleBig: { width: 40, height: 40, borderRadius: 20 },
  label: { fontFamily: fonts.bold, fontSize: 16, letterSpacing: 0.1 },
  link: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start" },
  linkText: { fontFamily: fonts.semi, fontSize: 15, color: c.brand, textDecorationLine: "underline" },
}));

// ---------- Surfaces ----------
// Cards rise and fade in as they scroll into view (when inside a <Screen>).
export function Card({ children, style, testID, delay = 0 }: { children: ReactNode; style?: StyleProp<ViewStyle>; testID?: string; delay?: number }) {
  const s = useMiscStyles();
  const scrollY = useContext(ScrollYContext);
  const { height } = useWindowDimensions();
  const y = useSharedValue(-1);
  const reveal = useAnimatedStyle(() => {
    if (!scrollY || y.value < 0) return {};
    const p = interpolate(scrollY.value + height - 40 - y.value, [0, 160], [0, 1], Extrapolation.CLAMP);
    return { opacity: 0.2 + 0.8 * p, transform: [{ translateY: (1 - p) * 36 }, { scale: 0.95 + 0.05 * p }] };
  });
  const flat = StyleSheet.flatten(style) || {};
  return (
    <Animated.View style={[reveal, { flex: flat.flex, alignSelf: flat.alignSelf, width: flat.width }]} onLayout={(e) => { y.value = e.nativeEvent.layout.y; }}>
      <Animated.View entering={FadeInDown.delay(delay).duration(420).springify().damping(18)} testID={testID} style={[s.card, style]}>{children}</Animated.View>
    </Animated.View>
  );
}

export function Badge({ label, kind = "neutral", testID, icon }: { label: string; kind?: "ready" | "warn" | "neutral"; testID?: string; icon?: IconName }) {
  const { colors } = useTheme();
  const bg = kind === "ready" ? colors.successSoft : kind === "warn" ? colors.warningSoft : colors.surfaceTertiary;
  const fg = kind === "ready" ? colors.success : kind === "warn" ? colors.warning : colors.muted;
  return (
    <View testID={testID} style={{ flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", backgroundColor: bg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}>
      {icon && <Icon name={icon} size={12} color={fg} />}
      <Text style={{ fontFamily: fonts.semi, fontSize: 12, lineHeight: 17, color: fg }}>{label}</Text>
    </View>
  );
}

export function Notice({ children, kind = "warn", testID }: { children: ReactNode; kind?: "warn" | "ready"; testID?: string }) {
  const { colors } = useTheme();
  return (
    <View testID={testID} style={{ backgroundColor: kind === "warn" ? colors.warningSoft : colors.successSoft, borderRadius: 16, padding: 14 }}>
      <Text style={{ fontFamily: fonts.semi, fontSize: 14, lineHeight: 20, color: kind === "warn" ? colors.warning : colors.success }}>{children}</Text>
    </View>
  );
}

export function Chip({ label, on, onPress, testID, warn }: { label: string; on?: boolean; onPress?: () => void; testID?: string; warn?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityState={{ selected: !!on }} aria-selected={!!on} hitSlop={{ top: 6, bottom: 6 }} onPress={() => { Haptics.selectionAsync().catch(() => {}); onPress?.(); }}
      style={({ pressed }) => ({ flexShrink: 0, height: 36, transform: [{ scale: pressed ? 0.95 : 1 }], paddingHorizontal: 14, borderRadius: 999, borderWidth: 1.5, justifyContent: "center",
        backgroundColor: on ? colors.surfaceInverse : warn ? colors.warningSoft : colors.surfaceSecondary,
        borderColor: on ? colors.surfaceInverse : warn ? colors.warningBorder : colors.border })}>
      <Text style={{ fontFamily: fonts.semi, fontSize: 14, color: on ? colors.onSurfaceInverse : warn ? colors.warning : colors.onSurface }}>{label}</Text>
    </Pressable>
  );
}

export function ChipRow({ children, testID }: { children: ReactNode; testID?: string }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} testID={testID} style={{ flexGrow: 0 }}
      contentContainerStyle={{ gap: 8, alignItems: "center", minHeight: 48 }}>
      {children}
    </ScrollView>
  );
}

export function ChipWrap({ children, testID }: { children: ReactNode; testID?: string }) {
  return <View testID={testID} style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{children}</View>;
}

export function Field({ label, style, ...p }: TextInputProps & { label?: string }) {
  const { colors } = useTheme();
  const s = useMiscStyles();
  return (
    <View style={{ gap: 6 }}>
      {!!label && <T size={14} weight="semi">{label}</T>}
      <TextInput placeholderTextColor={colors.muted} {...p} style={[s.field, p.multiline && { minHeight: 100, paddingTop: 12, textAlignVertical: "top" }, style]} />
    </View>
  );
}

export function Skeleton({ height = 160, testID }: { height?: number; testID?: string }) {
  const s = useMiscStyles();
  const o = useSharedValue(1);
  useEffect(() => { o.value = withRepeat(withSequence(withTiming(0.5, { duration: 700 }), withTiming(1, { duration: 700 })), -1); }, [o]);
  const st = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View testID={testID} style={[s.card, { height }, st]} />;
}

// ---------- Mascot ----------
export const POSES = {
  head: require("../assets/mascot/pup-head.webp"),
  glove: require("../assets/mascot/pup-glove.webp"),
  sleep: require("../assets/mascot/pup-sleep.webp"),
  camera: require("../assets/mascot/pup-camera.webp"),
  wrench: require("../assets/mascot/pup-wrench.webp"),
  phone: require("../assets/mascot/pup-phone.webp"),
  sniff: require("../assets/mascot/pup-sniff.webp"),
  cheer: require("../assets/mascot/pup-cheer.webp"),
  cabin: require("../assets/mascot/cabin-scene.webp"),
};
export type Pose = keyof typeof POSES;

export function Mascot({ pose = "glove", size = 140, motion = "bob", framed }: { pose?: Pose; size?: number; motion?: "bob" | "sniff" | "breathe" | "hop" | "none"; framed?: boolean }) {
  const { colors } = useTheme();
  const v = useSharedValue(0);
  useEffect(() => {
    if (motion === "none") return;
    const d = motion === "sniff" ? 700 : motion === "hop" ? 550 : motion === "breathe" ? 1600 : 1300;
    v.value = withRepeat(withSequence(withTiming(1, { duration: d, easing: Easing.inOut(Easing.ease) }), withTiming(0, { duration: d, easing: Easing.inOut(Easing.ease) })), -1);
  }, [motion, v]);
  const st = useAnimatedStyle(() => {
    if (motion === "sniff") return { transform: [{ translateX: v.value * 8 }, { rotate: `${v.value * 2}deg` }] };
    if (motion === "breathe") return { transform: [{ scale: 1 + v.value * 0.025 }] };
    if (motion === "hop") return { transform: [{ translateY: -v.value * 20 }] };
    if (motion === "bob") return { transform: [{ translateY: -v.value * 8 }, { rotate: `${-v.value * 2}deg` }] };
    return {};
  });
  return (
    <Animated.View style={[{ width: size, height: size }, st]}>
      <Image source={POSES[pose]} contentFit="contain"
        style={[{ width: "100%", height: "100%" }, framed && { borderRadius: 20, borderWidth: 1.5, borderColor: colors.border }]} />
    </Animated.View>
  );
}

export function EmptyState({ pose = "glove", motion = "bob", title, body, children, testID = "empty-state" }: { pose?: Pose; motion?: "bob" | "sniff" | "breathe" | "none"; title: string; body?: string; children?: ReactNode; testID?: string }) {
  return (
    <Card testID={testID} style={{ alignItems: "center", paddingVertical: 32, paddingHorizontal: 20 }}>
      <Mascot pose={pose} motion={motion} size={140} framed={["glove", "sleep", "head"].includes(pose)} />
      <H size={24} style={{ marginTop: 20, textAlign: "center" }}>{title}</H>
      {!!body && <T muted style={{ marginTop: 8, textAlign: "center" }}>{body}</T>}
      {children && <View style={{ marginTop: 20, gap: 10, alignSelf: "stretch" }}>{children}</View>}
    </Card>
  );
}

// ---------- Bottom sheet ----------
export function Sheet({ open, onClose, onDismiss, title, sub, children, testID }: { open: boolean; onClose: () => void; onDismiss?: () => void; title: string; sub?: string; children: ReactNode; testID?: string }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const s = useMiscStyles();
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose} onDismiss={onDismiss} statusBarTranslucent>
      <View style={s.overlay}>
        <Pressable style={{ flex: 1 }} onPress={onClose} testID={testID ? `${testID}-backdrop` : undefined} />
        <View style={[s.sheet, { paddingBottom: insets.bottom + 16, maxHeight: "92%" }]} testID={testID}>
          <View style={s.grab} />
          <View style={s.sheetHead}>
            <View style={{ flex: 1 }}>
              <H size={22}>{title}</H>
              {!!sub && <T size={14} muted>{sub}</T>}
            </View>
            <Pressable onPress={onClose} style={s.close} hitSlop={8} testID={testID ? `${testID}-close-button` : "sheet-close-button"}>
              <Icon name="x" size={20} color={colors.brand} />
            </Pressable>
          </View>
          <KeyboardAwareScrollView bottomOffset={24} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 8, gap: 14 }}>
            {children}
          </KeyboardAwareScrollView>
        </View>
      </View>
    </Modal>
  );
}

export function ConfirmSheet({ open, onClose, title, body, confirmLabel, onConfirm, busy, secondaryLabel, onSecondary, children, testID = "confirm-sheet" }: { open: boolean; onClose: () => void; title: string; body?: string; confirmLabel: string; onConfirm: () => void; busy?: boolean; secondaryLabel?: string; onSecondary?: () => void; children?: ReactNode; testID?: string }) {
  return (
    <Sheet open={open} onClose={onClose} title={title} testID={testID}>
      {!!body && <T muted>{body}</T>}
      {children}
      <Btn label={confirmLabel} onPress={onConfirm} busy={busy} testID={`${testID}-confirm-button`} />
      {secondaryLabel ? (
        <Btn label={secondaryLabel} variant="secondary" onPress={onSecondary} disabled={busy} testID={`${testID}-secondary-button`} />
      ) : (
        <Btn label="Cancel" variant="secondary" onPress={onClose} disabled={busy} testID={`${testID}-cancel-button`} />
      )}
    </Sheet>
  );
}

const useMiscStyles = makeStyles((c) => ({
  card: {
    backgroundColor: c.surfaceSecondary, borderRadius: radius.card, borderWidth: 1.5, borderColor: c.border, borderBottomWidth: 4, padding: 20,
    shadowColor: c.shadow, shadowOpacity: 0.06, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 2,
  },
  field: { minHeight: 48, borderRadius: radius.field, borderWidth: 1.5, borderColor: c.border, backgroundColor: c.surfaceSecondary, paddingHorizontal: 12, fontFamily: fonts.body, fontSize: 16, color: c.onSurface },
  overlay: { flex: 1, backgroundColor: c.overlay },
  sheet: { backgroundColor: c.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1.5, borderColor: c.border },
  grab: { alignSelf: "center", width: 44, height: 5, borderRadius: 3, backgroundColor: c.border, marginTop: 8 },
  sheetHead: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12 },
  close: { width: 44, height: 44, borderRadius: 14, borderWidth: 1.5, borderColor: c.border, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center" },
}));
