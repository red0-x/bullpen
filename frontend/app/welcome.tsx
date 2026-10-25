import { Redirect, useRouter } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";
import { Image } from "expo-image";
import Animated, { Easing, Extrapolation, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/auth";
import { ScrollYContext } from "@/src/scroll";
import { makeStyles } from "@/src/theme";
import { Btn, Card, H, Icon, Mascot, POSES, T } from "@/src/ui";

const TRADES = ["Plumbing", "Hot tub & spa", "Pool service", "HVAC", "Appliance repair", "Cleaning", "Electrical"];

function Marquee() {
  const s = useStyles();
  const x = useSharedValue(0);
  useEffect(() => { x.value = withRepeat(withTiming(1, { duration: 18000, easing: Easing.linear }), -1); }, [x]);
  const st = useAnimatedStyle(() => ({ transform: [{ translateX: -x.value * 700 }] }));
  return (
    <View style={s.marquee} testID="landing-marquee">
      <Animated.View style={[{ flexDirection: "row", gap: 10 }, st]}>
        {[...TRADES, ...TRADES, ...TRADES].map((t, i) => (
          <View key={i} style={s.pill}><T size={14} weight="semi">{t}</T></View>
        ))}
      </Animated.View>
    </View>
  );
}

const STEPS = [
  ["camera", "Snap a photo of what broke", "Add a note like \u201cguests arrive Friday 4pm.\u201d"],
  ["sparkles", "Bullpen works out what\u2019s wrong", "It confirms the trade you need and how to fix it."],
  ["send", "Ask the top 3 with one tap", "A friendly message is drafted. You send it from your phone."],
  ["trending-up", "The bench gets smarter", "Every outcome updates the scores, so the best people rise."],
] as const;

const SCORE = [["Shows up", 40], ["Rating", 25], ["On time", 20], ["Reply speed", 15]] as const;

export default function Welcome() {
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => { scrollY.value = e.contentOffset.y; });
  const heroStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(scrollY.value, [-100, 0, 300], [-30, 0, 120], Extrapolation.CLAMP) },
      { scale: interpolate(scrollY.value, [-100, 0, 300], [1.15, 1, 0.8], Extrapolation.CLAMP) },
    ],
    opacity: interpolate(scrollY.value, [0, 280], [1, 0.2], Extrapolation.CLAMP),
  }));

  if (user) return <Redirect href="/(tabs)" />;
  if (user === null) {
    return <View style={s.center} testID="auth-loading"><Mascot pose="head" size={72} motion="breathe" /></View>;
  }

  return (
    <ScrollYContext.Provider value={scrollY}>
    <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} style={s.root} contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40, paddingHorizontal: 20, gap: 28 }} testID="landing-screen">
      <View style={s.nav}>
        <View style={s.logo}><Image source={POSES.head} style={{ width: 40, height: 40 }} /></View>
        <H size={24} style={{ flex: 1 }}>Bullpen</H>
        <Btn label="Log in" variant="secondary" small onPress={() => router.push("/login")} testID="landing-login-button" />
      </View>

      <View style={{ gap: 18 }}>
        <Animated.View style={[s.heroArt, heroStyle]}><Mascot pose="glove" size={230} /></Animated.View>
        <H size={46} testID="landing-title">Always a backup in the bullpen.</H>
        <T size={17} muted>
          Bullpen keeps a ranked bench of contractors for every property and amenity. Snap a photo of what broke and get the top 3 people to call, with one tap to ask them.
        </T>
        <Btn label="Build my bench, free" onPress={() => router.push({ pathname: "/login", params: { mode: "register" } })} testID="landing-register-button" />
        <Btn label="I already have an account" variant="secondary" onPress={() => router.push("/login")} testID="landing-login-secondary-button" />
      </View>

      <Marquee />

      <View style={{ gap: 12 }} testID="landing-how">
        <H size={28}>How it works</H>
        {STEPS.map(([icon, title, body], i) => (
          <Card key={title} delay={i * 80} style={s.step}>
            <View style={s.stepNum}><T weight="bold">{i + 1}</T></View>
            <View style={{ flex: 1, gap: 2 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Icon name={icon} size={16} />
                <T weight="bold" style={{ flex: 1 }}>{title}</T>
              </View>
              <T size={14} muted>{body}</T>
            </View>
          </Card>
        ))}
      </View>

      <Card style={{ gap: 12 }} testID="landing-score">
        <H size={24}>Scores from real outcomes</H>
        <T size={14} muted>Calculated in code, with a one-line reason for every rank. New contractors start at 60. Unreachable ones never rank.</T>
        {SCORE.map(([label, pct]) => (
          <View key={label} style={{ gap: 4 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <T size={14} weight="semi">{label}</T>
              <T size={14} muted>{pct}%</T>
            </View>
            <View style={s.track}><View style={[s.fill, { width: `${pct * 2}%` }]} /></View>
          </View>
        ))}
      </Card>

      <Card style={{ alignItems: "center", gap: 12 }}>
        <Image source={POSES.cabin} style={{ width: "100%", aspectRatio: 1.5, borderRadius: 16 }} contentFit="cover" />
        <H size={26} style={{ textAlign: "center" }}>Built for small hosts</H>
        <T muted style={{ textAlign: "center" }}>For hosts with 1 to 5 rentals. Every property and amenity covered with two backups each.</T>
        <Btn label="Start my bench" style={{ alignSelf: "stretch" }} onPress={() => router.push({ pathname: "/login", params: { mode: "register" } })} testID="landing-start-button" />
      </Card>
    </Animated.ScrollView>
    </ScrollYContext.Provider>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.surface },
  nav: { flexDirection: "row", alignItems: "center", gap: 10 },
  logo: { width: 44, height: 44, borderRadius: 12, borderWidth: 1.5, borderColor: c.border, overflow: "hidden", alignItems: "center", justifyContent: "center", backgroundColor: c.surfaceSecondary },
  heroArt: { alignItems: "center", justifyContent: "center", paddingVertical: 8 },
  marquee: { marginHorizontal: -20, overflow: "hidden", paddingVertical: 4 },
  pill: { flexShrink: 0, height: 40, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1.5, borderColor: c.border, backgroundColor: c.surfaceSecondary, justifyContent: "center" },
  step: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  stepNum: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: c.border, backgroundColor: c.surface, alignItems: "center", justifyContent: "center" },
  track: { height: 10, borderRadius: 5, backgroundColor: c.surfaceTertiary, overflow: "hidden" },
  fill: { height: 10, borderRadius: 5, backgroundColor: c.brandPrimary },
}));
