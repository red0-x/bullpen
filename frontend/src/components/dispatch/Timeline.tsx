import { View } from "react-native";
import { makeStyles, useTheme } from "@/src/theme";
import { T } from "@/src/ui";

type Ev = { at: string; text: string; dot: "done" | "pending" | "good" | "alert" };

export const clock = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

/** "WHAT I DID": filled dots for things done, hollow dots for what's coming next. */
export function Timeline({ events }: { events: Ev[] }) {
  const s = useStyles();
  const { colors } = useTheme();
  const tone = { done: colors.brand, good: colors.success, alert: colors.warning, pending: colors.muted };
  if (!events.length) return null;
  return (
    <View style={s.box} testID="what-i-did">
      <T size={12} weight="bold" muted style={{ letterSpacing: 1.2 }}>WHAT I DID</T>
      {events.map((e, i) => (
        <View key={i} style={s.row} testID={`timeline-${i}`}>
          <View style={s.rail}>
            <View style={[s.dot, e.dot === "pending" ? { borderColor: tone.pending, backgroundColor: "transparent" } : { borderColor: tone[e.dot], backgroundColor: tone[e.dot] }]} testID={`timeline-dot-${e.dot}`} />
            {i < events.length - 1 && <View style={s.line} />}
          </View>
          <T size={13} weight="semi" muted style={s.time}>{clock(e.at)}</T>
          <T size={14} style={{ flex: 1, paddingBottom: 14 }} muted={e.dot === "pending"}>{e.text}</T>
        </View>
      ))}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  box: { backgroundColor: c.surfaceSecondary, borderRadius: 18, borderWidth: 1.5, borderColor: c.border, padding: 16, gap: 10 },
  row: { flexDirection: "row", gap: 10 },
  rail: { width: 14, alignItems: "center" },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, marginTop: 3 },
  line: { flex: 1, width: 2, backgroundColor: c.border, marginTop: 2 },
  time: { width: 66 },
}));
