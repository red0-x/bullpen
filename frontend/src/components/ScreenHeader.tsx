import { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/auth";
import { makeStyles, useTheme } from "@/src/theme";
import { H, Icon, Mascot, T } from "@/src/ui";

// Sticky app bar used on every tab: puppy + wordmark + logout, then the page title.
export function ScreenHeader({ eyebrow, title, sub, right }: { eyebrow?: string; title: string; sub?: string; right?: ReactNode }) {
  const insets = useSafeAreaInsets();
  const { logout } = useAuth();
  const { colors } = useTheme();
  const s = useStyles();
  return (
    <View style={[s.wrap, { paddingTop: insets.top + 8 }]} testID="app-header">
      <View style={s.bar}>
        <View style={s.logo}><Mascot pose="head" size={38} motion="breathe" /></View>
        <H size={22} style={{ flex: 1 }} testID="header-wordmark">Bullpen</H>
        {right}
        <Pressable onPress={logout} style={s.iconBtn} hitSlop={6} testID="header-logout-button" accessibilityLabel="Log out">
          <Icon name="log-out" size={18} color={colors.brand} />
        </Pressable>
      </View>
      <View style={{ paddingTop: 12 }}>
        {!!eyebrow && <T size={12} weight="bold" muted style={{ textTransform: "uppercase", letterSpacing: 1 }}>{eyebrow}</T>}
        <H size={30} testID="page-title">{title}</H>
        {!!sub && <T size={14} muted style={{ marginTop: 2 }}>{sub}</T>}
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { backgroundColor: c.surface, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1.5, borderBottomColor: c.border },
  bar: { flexDirection: "row", alignItems: "center", gap: 10 },
  logo: { width: 42, height: 42, borderRadius: 12, borderWidth: 1.5, borderColor: c.border, overflow: "hidden", backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  iconBtn: { width: 44, height: 44, borderRadius: 14, borderWidth: 1.5, borderColor: c.border, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center" },
}));
