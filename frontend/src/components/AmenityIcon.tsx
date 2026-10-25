import { useTheme } from "@/src/theme";
import { Icon, IconName } from "@/src/ui";

const ICONS: Record<string, IconName> = {
  pool: "waves", hot_tub: "bath", plumbing: "droplets", kitchen_appliances: "refrigerator", hvac: "thermometer", cleaning: "sparkles", custom: "plug",
};

export function AmenityIcon({ type, size = 18 }: { type: string; size?: number }) {
  const { colors } = useTheme();
  return <Icon name={ICONS[type] || "plug"} size={size} color={colors.brand} />;
}
