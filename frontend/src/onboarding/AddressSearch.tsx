import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { api, errorText } from "@/src/api";
import { makeStyles, useTheme } from "@/src/theme";
import { Field, Icon, T } from "@/src/ui";

export type Geo = {
  formatted_address: string; lat: number; lng: number; location_type?: string; partial_match?: boolean;
  city?: string; state?: string; postal_code?: string; place_id?: string | null; street?: string; source?: "google" | "osm";
};
type Suggestion = { id: string; main: string; secondary: string; geo: Geo | null };

const newSession = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

// Address field with live suggestions as the host types (Google Places, OpenStreetMap when Google is off).
export function AddressSearch({ value, onChangeText, onPick, onSubmit, settled, testID = "address-input" }: {
  value: string; onChangeText: (v: string) => void; onPick: (g: Geo) => void; onSubmit: () => void;
  settled: boolean; // a confirmed address is showing: don't search
  testID?: string;
}) {
  const { colors } = useTheme();
  const s = useStyles();
  const [list, setList] = useState<Suggestion[]>([]);
  const [source, setSource] = useState<"google" | "osm" | null>(null);
  const [loading, setLoading] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);
  const [error, setError] = useState("");
  const session = useRef(newSession());
  const seq = useRef(0);

  useEffect(() => {
    const q = value.trim();
    if (settled || q.length < 4) { seq.current++; setList([]); setLoading(false); return; }
    const my = ++seq.current;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await api<{ source: "google" | "osm"; suggestions: Suggestion[] }>("/onboarding/autocomplete", { params: { q, session: session.current } });
        if (my !== seq.current) return; // a newer keystroke won
        setList(r.suggestions);
        setSource(r.source);
        setError("");
      } catch (e) {
        if (my === seq.current) { setList([]); setError(errorText(e)); }
      } finally {
        if (my === seq.current) setLoading(false);
      }
    }, 320);
    return () => clearTimeout(t);
  }, [value, settled]);

  const choose = async (sg: Suggestion) => {
    if (sg.geo) { seq.current++; setList([]); onPick(sg.geo); return; }
    setOpening(sg.id);
    try {
      const g = await api<Geo>("/onboarding/place", { method: "POST", body: { place_id: sg.id, session: session.current } });
      seq.current++;
      setList([]);
      session.current = newSession(); // Google session ends with the details call
      onPick(g);
    } catch (e) { setError(errorText(e)); } finally { setOpening(null); }
  };

  const showList = !settled && (list.length > 0 || loading);
  return (
    <View style={{ gap: 8 }}>
      <Field label="Street address" value={value} onChangeText={onChangeText} placeholder="Start typing: 123 Lakeview Dr…" autoComplete="street-address"
        textContentType="fullStreetAddress" returnKeyType="search" onSubmitEditing={onSubmit} maxLength={300} autoCorrect={false} testID={testID} />
      {showList && (
        <Animated.View entering={FadeIn.duration(180)} style={s.list} testID="address-suggestions">
          {loading && list.length === 0 && (
            <View style={s.row}><ActivityIndicator color={colors.brand} size="small" /><T size={14} muted>Finding matching addresses…</T></View>
          )}
          {list.map((sg, i) => (
            <Animated.View key={sg.id} entering={FadeInDown.delay(i * 40).duration(220)}>
              <Pressable onPress={() => choose(sg)} disabled={!!opening} style={({ pressed }) => [s.row, i > 0 && s.divider, pressed && { backgroundColor: colors.surfaceTertiary }]}
                testID={`address-suggestion-${i}`}>
                <View style={s.pin}>{opening === sg.id ? <ActivityIndicator size="small" color={colors.brand} /> : <Icon name="map-pin" size={16} color={colors.brand} />}</View>
                <View style={{ flex: 1 }}>
                  <T weight="semi" numberOfLines={1}>{sg.main}</T>
                  {!!sg.secondary && <T size={13} muted numberOfLines={1}>{sg.secondary}</T>}
                </View>
                <Icon name="arrow-up-left" size={16} color={colors.muted} />
              </Pressable>
            </Animated.View>
          ))}
          {list.length > 0 && (
            <T size={11} muted style={s.credit} testID="address-suggestions-credit">
              {source === "osm" ? "Suggestions © OpenStreetMap contributors" : "Powered by Google"}
            </T>
          )}
        </Animated.View>
      )}
      {!!error && !settled && <T size={13} muted testID="address-suggestions-error">{error}</T>}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  list: { borderRadius: 16, borderWidth: 1.5, borderColor: c.border, backgroundColor: c.surfaceSecondary, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56, paddingHorizontal: 14, paddingVertical: 8 },
  divider: { borderTopWidth: 1, borderTopColor: c.border },
  pin: { width: 32, height: 32, borderRadius: 10, backgroundColor: c.warningSoft, alignItems: "center", justifyContent: "center" },
  credit: { textAlign: "right", paddingHorizontal: 14, paddingBottom: 8 },
}));
