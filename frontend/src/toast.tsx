import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fonts, makeStyles } from "@/src/theme";

type Action = { label: string; onPress: () => void };
type Toast = { id: number; message: string; kind: "info" | "success" | "error"; action?: Action; duration: number };
type Opts = { action?: Action; duration?: number };

let listener: ((t: Toast | null) => void) | null = null;
let seq = 0;

function show(message: string, kind: Toast["kind"], opts: Opts = {}) {
  listener?.({ id: ++seq, message, kind, action: opts.action, duration: opts.duration ?? (opts.action ? 8000 : 3500) });
}

export const toast = Object.assign((m: string, o?: Opts) => show(m, "info", o), {
  success: (m: string, o?: Opts) => show(m, "success", o),
  error: (m: string, o?: Opts) => show(m, "error", o),
  dismiss: () => listener?.(null),
});

export function ToastHost() {
  const [t, setT] = useState<Toast | null>(null);
  const insets = useSafeAreaInsets();
  const s = useStyles();

  useEffect(() => {
    listener = setT;
    return () => { listener = null; };
  }, []);

  useEffect(() => {
    if (!t) return;
    const timer = setTimeout(() => setT((cur) => (cur?.id === t.id ? null : cur)), t.duration);
    return () => clearTimeout(timer);
  }, [t]);

  if (!t) return null;
  return (
    <View pointerEvents="box-none" style={[s.wrap, { bottom: insets.bottom + 76 }]}>
      <Animated.View key={t.id} entering={FadeInDown.duration(200)} exiting={FadeOutDown.duration(150)}
        style={[s.toast, t.kind === "error" && s.error]} testID="toast">
        <Text style={s.text} testID="toast-message">{t.message}</Text>
        {t.action && (
          <Pressable style={s.action} hitSlop={8} testID="toast-action-button"
            onPress={() => { const a = t.action!; setT(null); a.onPress(); }}>
            <Text style={s.actionText}>{t.action.label}</Text>
          </Pressable>
        )}
      </Animated.View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { position: "absolute", left: 16, right: 16, alignItems: "center" },
  toast: {
    width: "100%", maxWidth: 480, flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: c.surfaceInverse, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 16,
  },
  error: { backgroundColor: c.warning },
  text: { flex: 1, color: c.onSurfaceInverse, fontFamily: fonts.semi, fontSize: 14, lineHeight: 20 },
  action: { minHeight: 36, paddingHorizontal: 12, borderRadius: 10, backgroundColor: c.surfaceSecondary, justifyContent: "center" },
  actionText: { color: c.brand, fontFamily: fonts.bold, fontSize: 14 },
}));
