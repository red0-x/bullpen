import { Linking, Pressable, View } from "react-native";
import { makeStyles, useTheme } from "@/src/theme";
import { Badge, Btn, Icon, T } from "@/src/ui";

export function ScorePill({ c }: { c: any }) {
  if (!c.rank) return <Badge label="Not ranked" />;
  return <Badge kind={c.is_new ? "neutral" : c.score >= 75 ? "ready" : "warn"} label={String(c.score)} testID={`score-${c.id}`} />;
}

export function CandidateCard({ c, position, onRequest, compact }: { c: any; position?: number; onRequest?: (c: any) => void; compact?: boolean }) {
  const { colors } = useTheme();
  const s = useStyles();
  const grey = !c.rank;
  return (
    <View style={[s.card, grey && s.grey]} testID={`candidate-${c.id}`}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        {!!position && <View style={s.pos}><T weight="bold" size={16}>{position}</T></View>}
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            {c.pinned && <Icon name="pin" size={14} color={colors.brand} />}
            <T weight="semi" numberOfLines={1} style={{ flexShrink: 1 }}>{c.business_name}</T>
            <ScorePill c={c} />
            {c.contacted && <Badge label="Already asked" />}
          </View>
          <T size={13} muted numberOfLines={2} testID={`reason-${c.id}`}>{c.reason}</T>
          {!compact && !!c.phone && (
            <Pressable onPress={() => Linking.openURL(`tel:${c.phone.replace(/[^\d+]/g, "")}`)} style={s.phone} testID={`phone-${c.id}`} hitSlop={6}>
              <Icon name="phone" size={13} color={colors.brand} /><T size={14} weight="semi" style={{ color: colors.brand }}>{c.phone}</T>
            </Pressable>
          )}
        </View>
      </View>
      {onRequest && <Btn label="Request" icon="send" onPress={() => onRequest(c)} testID={`request-button-${c.id}`} />}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  card: { borderRadius: 16, borderWidth: 1.5, borderColor: c.border, backgroundColor: c.surfaceSecondary, padding: 12, gap: 10 },
  grey: { backgroundColor: c.surfaceTertiary, opacity: 0.75 },
  pos: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: c.border, backgroundColor: c.surface, alignItems: "center", justifyContent: "center" },
  phone: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 32, alignSelf: "flex-start" },
}));
