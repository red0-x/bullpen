import { Redirect, Tabs } from "expo-router";
import { NativeTabs } from "expo-router/native-tabs";
import { Platform, View } from "react-native";
import Lucide from "@react-native-vector-icons/lucide";
import { useAuth } from "@/src/auth";
import { usesNativeTabs } from "@/src/navigation";
import { colors, fonts } from "@/src/theme";
import { Mascot } from "@/src/ui";

const TABS = [
  { name: "index", label: "Fix-it", icon: "wrench", sf: "wrench.and.screwdriver.fill" },
  { name: "snap", label: "Snap", icon: "camera", sf: "camera.fill" },
  { name: "bench", label: "Bench", icon: "users", sf: "person.3.fill" },
  { name: "properties", label: "Rentals", icon: "house", sf: "house.fill" },
] as const;

export default function TabsLayout() {
  const { user } = useAuth();
  if (user === false) return <Redirect href="/welcome" />;
  if (!user) {
    return <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface }} testID="auth-loading"><Mascot pose="head" size={72} motion="breathe" /></View>;
  }

  if (usesNativeTabs) {
    return (
      <NativeTabs tintColor={colors.brand}>
        {TABS.map((t) => (
          <NativeTabs.Trigger key={t.name} name={t.name}>
            <NativeTabs.Trigger.Icon sf={t.sf as any} />
            <NativeTabs.Trigger.Label>{t.label}</NativeTabs.Trigger.Label>
          </NativeTabs.Trigger>
        ))}
      </NativeTabs>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.surfaceSecondary, borderTopColor: colors.border, borderTopWidth: 1.5, ...(Platform.OS === "web" ? { height: 64 } : {}) },
        tabBarItemStyle: { alignSelf: "center" },
        tabBarLabelStyle: { fontFamily: fonts.semi, fontSize: 12 },
      }}>
      {TABS.map((t) => (
        <Tabs.Screen key={t.name} name={t.name} options={{
          title: t.label,
          tabBarButtonTestID: `tab-${t.name}`,
          tabBarIcon: ({ color, size }) => <Lucide name={t.icon} size={size - 2} color={color} />,
        }} />
      ))}
    </Tabs>
  );
}
