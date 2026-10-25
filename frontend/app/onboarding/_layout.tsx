import { Redirect, Stack } from "expo-router";
import { View } from "react-native";
import { useAuth } from "@/src/auth";
import { colors } from "@/src/theme";
import { Mascot } from "@/src/ui";

// Property setup flow: address -> rooms (AR scan or photos) -> review.
export default function OnboardingLayout() {
  const { user } = useAuth();
  if (user === false) return <Redirect href="/welcome" />;
  if (!user) {
    return <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface }} testID="onboarding-loading"><Mascot pose="head" size={72} motion="breathe" /></View>;
  }
  return <Stack screenOptions={{ headerShown: false, animation: "slide_from_right", contentStyle: { backgroundColor: colors.surface } }} />;
}
