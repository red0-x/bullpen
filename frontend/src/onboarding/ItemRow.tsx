import { Pressable, View } from "react-native";
import { Image } from "expo-image";
import { photoSource } from "@/src/api";
import { CATEGORIES, Item, itemIcon } from "@/src/onboarding/shared";
import { makeStyles, useTheme } from "@/src/theme";
import { Badge, Icon, T } from "@/src/ui";

export function ItemRow({ item, onPress, testID }: { item: Item; onPress?: () => void; testID?: string }) {
  const { colors } = useTheme();
  const s = useStyles();
  const sub = [CATEGORIES.find((c) => c.key === item.category)?.label ?? item.category, item.brand, item.model].filter(Boolean).join(" · ");
  return (
    <Pressable onPress={onPress} testID={testID} style={({ pressed }) => [s.row, pressed && { opacity: 0.7, transform: [{ scale: 0.99 }] }]}>
      {item.photo_url ? (
        <Image source={photoSource(item.photo_url)} style={s.thumb} contentFit="cover" />
      ) : (
        <View style={s.icon}><Icon name={itemIcon(item.name, item.category)} size={18} color={colors.brand} /></View>
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <T weight="semi" numberOfLines={1}>{item.name}</T>
        <T size={13} muted numberOfLines={1}>{sub}</T>
      </View>
      {item.source === "ar" && <Badge icon="scan-line" label="AR" kind="ready" />}
      {item.source === "photo" && <Badge icon="image" label="Photo" />}
      {onPress && <Icon name="pencil" size={15} color={colors.muted} />}
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56, paddingVertical: 6 },
  thumb: { width: 44, height: 44, borderRadius: 12, backgroundColor: c.surfaceTertiary },
  icon: { width: 44, height: 44, borderRadius: 12, backgroundColor: c.warningSoft, alignItems: "center", justifyContent: "center" },
}));
