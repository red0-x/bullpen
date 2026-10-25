import { ReactNode, useState } from "react";
import { Pressable, RefreshControl, View } from "react-native";
import { useRouter } from "expo-router";
import Animated, { Extrapolation, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/auth";
import { usesNativeTabs } from "@/src/navigation";
import { ScrollYContext } from "@/src/scroll";
import { makeStyles, useTheme } from "@/src/theme";
import { H, Icon, Mascot, T } from "@/src/ui";

type Props = {
  eyebrow?: string;
  title: string;
  sub?: string;
  children: ReactNode;
  onRefresh?: () => Promise<any> | void;
  below?: ReactNode; // sticky content under the app bar (e.g. chip row)
  back?: boolean; // stack screen: back button instead of logo + logout
  testID?: string;
};

export function Screen({ eyebrow, title, sub, children, onRefresh, below, back, testID }: Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { logout } = useAuth();
  const { colors } = useTheme();
  const s = useStyles();
  const [refreshing, setRefreshing] = useState(false);
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => { scrollY.value = e.contentOffset.y; });

  const wordStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [20, 70], [1, 0], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollY.value, [20, 70], [0, -8], Extrapolation.CLAMP) }],
  }));
  const barTitleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [50, 100], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollY.value, [50, 100], [10, 0], Extrapolation.CLAMP) }],
  }));
  const edgeStyle = useAnimatedStyle(() => ({ opacity: interpolate(scrollY.value, [0, 24], [0, 1], Extrapolation.CLAMP) }));
  const titleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 110], [1, 0], Extrapolation.CLAMP),
    transform: [
      { translateY: interpolate(scrollY.value, [-120, 0, 140], [-20, 0, 50], Extrapolation.CLAMP) },
      { scale: interpolate(scrollY.value, [-120, 0], [1.06, 1], Extrapolation.CLAMP) },
    ],
  }));

  const bottom = back ? insets.bottom + 32 : (usesNativeTabs ? insets.bottom : 0) + 32;

  return (
    <View style={s.root} testID={testID ? `${testID}-screen` : undefined}>
      <View style={[s.bar, { paddingTop: insets.top + 8 }]} testID="app-header">
        {back ? (
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))} style={s.iconBtn} hitSlop={6} testID="screen-back-button">
            <Icon name="arrow-left" size={20} color={colors.brand} />
          </Pressable>
        ) : (
          <View style={s.logo}><Mascot pose="head" size={38} motion="breathe" /></View>
        )}
        <View style={{ flex: 1, justifyContent: "center", height: 44 }}>
          {!back && (
            <Animated.View style={[s.abs, wordStyle]}>
              <H size={22} testID="header-wordmark">Bullpen</H>
            </Animated.View>
          )}
          <Animated.View style={[s.abs, barTitleStyle]}>
            <H size={19} numberOfLines={1} testID="header-title">{title}</H>
          </Animated.View>
        </View>
        {!back && (
          <Pressable onPress={logout} style={s.iconBtn} hitSlop={6} testID="header-logout-button" accessibilityLabel="Log out">
            <Icon name="log-out" size={18} color={colors.brand} />
          </Pressable>
        )}
        <Animated.View pointerEvents="none" style={[s.edge, edgeStyle]} />
      </View>
      {below}
      <ScrollYContext.Provider value={scrollY}>
        <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} keyboardShouldPersistTaps="handled" testID={testID}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: bottom, gap: 20 }}
          refreshControl={onRefresh ? (
            <RefreshControl tintColor={colors.brand} colors={[colors.brand]} refreshing={refreshing}
              onRefresh={async () => { setRefreshing(true); await onRefresh(); setRefreshing(false); }} />
          ) : undefined}>
          <Animated.View style={[{ gap: 4 }, titleStyle]}>
            {eyebrow && (
              <View style={s.eyebrow}><T size={11} weight="bold" style={{ color: colors.brand, letterSpacing: 1.4, textTransform: "uppercase" }}>{eyebrow}</T></View>
            )}
            <H size={38} testID="page-title">{title}</H>
            {sub && <T size={15} muted>{sub}</T>}
          </Animated.View>
          {children}
        </Animated.ScrollView>
      </ScrollYContext.Provider>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  bar: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingBottom: 10, backgroundColor: c.surface },
  abs: { position: "absolute", left: 0, right: 0 },
  edge: { position: "absolute", left: 0, right: 0, bottom: 0, height: 1.5, backgroundColor: c.border },
  logo: { width: 44, height: 44, borderRadius: 14, borderWidth: 1.5, borderColor: c.border, overflow: "hidden", backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  iconBtn: { width: 44, height: 44, borderRadius: 14, borderWidth: 1.5, borderColor: c.border, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  eyebrow: { alignSelf: "flex-start", backgroundColor: c.surfaceSecondary, borderWidth: 1.5, borderColor: c.border, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, marginBottom: 6 },
}));
