import { View } from "react-native";
import { useTheme } from "@/src/theme";
import { Badge, H, Icon, T } from "@/src/ui";

const DIY: Record<string, ["ready" | "neutral" | "warn", string]> = {
  yes: ["ready", "You can probably handle this yourself"],
  maybe: ["neutral", "Might be a DIY fix"],
  no: ["warn", "Call a pro"],
};

export function FixGuide({ steps = [], safety, diy, testID = "fix-guide" }: { steps?: string[]; safety?: string | null; diy?: string | null; testID?: string }) {
  const { colors } = useTheme();
  if (!steps.length && !safety) return null;
  return (
    <View testID={testID} style={{ borderRadius: 16, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface, padding: 14, gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Icon name="wrench" size={18} color={colors.brand} />
        <H size={18}>How to fix it</H>
      </View>
      {diy && DIY[diy] && <Badge kind={DIY[diy][0]} label={DIY[diy][1]} testID={`${testID}-diy`} />}
      {steps.map((s, i) => (
        <View key={i} style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" }}>
            <T size={12} weight="bold">{i + 1}</T>
          </View>
          <T size={14} style={{ flex: 1 }}>{s}</T>
        </View>
      ))}
      {safety && (
        <View testID={`${testID}-safety`} style={{ flexDirection: "row", gap: 8, backgroundColor: colors.warningSoft, borderRadius: 12, padding: 12 }}>
          <Icon name="shield-alert" size={16} color={colors.warning} />
          <T size={14} weight="semi" style={{ flex: 1, color: colors.warning }}>{safety}</T>
        </View>
      )}
      <T size={12} muted>AI suggestion from your photo and note. Check it before acting.</T>
    </View>
  );
}
