import { useEffect, useRef, useState } from "react";
import { Keyboard, Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import Animated, { FadeInDown } from "react-native-reanimated";
import { api, errorText } from "@/src/api";
import { needsOnboarding, useAuth } from "@/src/auth";
import { Screen } from "@/src/components/Screen";
import { MapPreview } from "@/src/onboarding/MapPreview";
import { useOnboarding } from "@/src/onboarding/shared";
import { Steps } from "@/src/onboarding/Steps";
import { toast } from "@/src/toast";
import { makeStyles, useTheme } from "@/src/theme";
import { Badge, Btn, Card, ConfirmSheet, Field, Icon, Notice, POSES, T } from "@/src/ui";

type Geo = { formatted_address: string; lat: number; lng: number; location_type?: string; partial_match?: boolean; city?: string; state?: string; postal_code?: string; place_id?: string };

export default function AddressStep() {
  const { user, patchUser } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();
  const s = useStyles();
  const { state } = useOnboarding();
  const [q, setQ] = useState("");
  const [name, setName] = useState("");
  const [results, setResults] = useState<Geo[] | null>(null);
  const [picked, setPicked] = useState<Geo | null>(null);
  const [busy, setBusy] = useState<"" | "find" | "save" | "skip">("");
  const [error, setError] = useState("");
  const [skipOpen, setSkipOpen] = useState(false);
  const [lookupFailed, setLookupFailed] = useState(false); // Google couldn't check it -> allow saving as typed
  const prefilled = useRef(false);
  const revisit = !!user && !needsOnboarding(user);

  // Coming back to this step: start from the saved address.
  useEffect(() => {
    const p = state?.property;
    if (!p || prefilled.current) return;
    prefilled.current = true;
    setQ(p.address);
    setName(p.name || "");
    if (p.geocode?.lat != null) setPicked({ ...p.geocode, formatted_address: p.address });
    else setLookupFailed(true);
  }, [state?.property]);

  const onType = (v: string) => {
    setQ(v);
    if (picked && v !== picked.formatted_address) { setPicked(null); setResults(null); }
  };

  const find = async () => {
    if (q.trim().length < 5) return setError("Type the full street address, city and zip.");
    Keyboard.dismiss();
    setBusy("find");
    setError("");
    setResults(null);
    setPicked(null);
    setLookupFailed(false);
    try {
      const r = await api<{ results: Geo[] }>("/onboarding/geocode", { method: "POST", body: { address: q.trim() } });
      setResults(r.results);
      if (r.results.length === 1) pick(r.results[0]);
    } catch (e) { setError(errorText(e)); setLookupFailed(true); } finally { setBusy(""); }
  };

  const pick = (g: Geo) => { setPicked(g); setQ(g.formatted_address); };

  const save = async (asTyped = false) => {
    if (!picked && !asTyped) return;
    setBusy("save");
    setError("");
    try {
      await api("/onboarding/property", { method: "POST", body: asTyped
        ? { name: name.trim(), address: q.trim(), geocode: { unverified: true } }
        : { name: name.trim(), address: picked!.formatted_address, geocode: picked } });
      router.push("/onboarding/rooms");
    } catch (e) { setError(errorText(e)); } finally { setBusy(""); }
  };

  const skip = async () => {
    setBusy("skip");
    try {
      await api("/onboarding/skip", { method: "POST" });
      setSkipOpen(false);
      patchUser({ onboarding_skipped: true });
      router.replace("/(tabs)");
    } catch (e) { toast.error(errorText(e)); } finally { setBusy(""); }
  };

  return (
    <Screen back={revisit} eyebrow="Set up · Step 1 of 3" title="Where's your rental?" sub="We pin it on the map so every contractor finds it the first time." testID="onboarding-address">
      <Steps step={0} />
      <Animated.View entering={FadeInDown.duration(500)} style={s.hero}>
        <Image source={POSES.cabin} style={s.heroImg} contentFit="contain" />
      </Animated.View>
      <Card style={{ gap: 14 }} testID="address-form">
        <Field label="Street address" value={q} onChangeText={onType} placeholder="123 Lakeview Dr, South Lake Tahoe, CA" autoComplete="street-address"
          textContentType="fullStreetAddress" returnKeyType="search" onSubmitEditing={find} maxLength={300} testID="address-input" />
        <Field label="Nickname (optional)" value={name} onChangeText={setName} placeholder="Lake cabin" maxLength={80} testID="property-name-input" />
        {!!error && <Notice testID="address-error">{error}</Notice>}
        <Btn label="Find address" icon="search" busy={busy === "find"} disabled={!!busy || q.trim().length < 5} variant={picked || lookupFailed ? "secondary" : "primary"} onPress={find} testID="address-find-button" />
        {lookupFailed && !picked && q.trim().length >= 5 && (
          <Animated.View entering={FadeInDown.springify().damping(16)} style={{ gap: 8 }} testID="address-as-typed">
            <Btn big label="Save as typed" icon="arrow-right" busy={busy === "save"} disabled={!!busy} onPress={() => save(true)} testID="address-save-typed-button" />
            <T size={13} muted style={{ textAlign: "center" }}>It won&apos;t have a map pin yet. You can look it up again later.</T>
          </Animated.View>
        )}
      </Card>

      {results && results.length > 1 && (
        <View style={{ gap: 10 }} testID="address-results">
          <T weight="semi">Which one is it?</T>
          {results.map((r, i) => {
            const on = picked?.formatted_address === r.formatted_address;
            return (
              <Animated.View key={r.place_id || i} entering={FadeInDown.delay(i * 70).springify().damping(16)}>
                <Pressable onPress={() => pick(r)} style={({ pressed }) => [s.result, on && s.resultOn, pressed && { transform: [{ scale: 0.99 }] }]} testID={`address-result-${i}`}>
                  <View style={[s.radio, on && s.radioOn]}>{on && <View style={s.radioDot} />}</View>
                  <View style={{ flex: 1 }}>
                    <T weight="semi">{r.formatted_address}</T>
                    {r.partial_match && <T size={12} muted>Close match</T>}
                  </View>
                </Pressable>
              </Animated.View>
            );
          })}
        </View>
      )}

      {picked && (
        <Animated.View entering={FadeInDown.springify().damping(16)} testID="address-confirm">
          <Card style={{ gap: 14 }}>
            <MapPreview lat={picked.lat} lng={picked.lng} />
            <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
              <View style={s.pin}><Icon name="map-pinned" size={20} color={colors.brand} /></View>
              <View style={{ flex: 1 }}>
                <T weight="semi" testID="address-picked">{picked.formatted_address}</T>
                <T size={13} muted>{[picked.city, picked.state, picked.postal_code].filter(Boolean).join(" · ")}</T>
              </View>
            </View>
            {picked.partial_match
              ? <Notice>Close match only. Double-check the street number and zip.</Notice>
              : picked.location_type === "ROOFTOP" && <Badge kind="ready" icon="circle-check" label="Exact spot found" />}
            <Btn big label="Use this address" icon="arrow-right" busy={busy === "save"} disabled={!!busy} onPress={() => save()} testID="address-confirm-button" />
          </Card>
        </Animated.View>
      )}

      {!revisit && <Btn variant="link" label="Skip setup for now" onPress={() => setSkipOpen(true)} style={{ alignSelf: "center" }} testID="onboarding-skip-button" />}
      <ConfirmSheet open={skipOpen} onClose={() => setSkipOpen(false)} title="Skip setup for now?" confirmLabel="Skip for now" onConfirm={skip} busy={busy === "skip"} testID="skip-sheet"
        body="You can use Bullpen right away. Finish your address and room scans from the Rentals tab whenever you like." />
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  hero: { alignItems: "center" },
  heroImg: { width: "100%", aspectRatio: 1.5, maxHeight: 200 },
  result: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56, padding: 14, borderRadius: 16, borderWidth: 1.5, borderColor: c.border, backgroundColor: c.surfaceSecondary },
  resultOn: { borderColor: c.brand, backgroundColor: c.warningSoft },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: c.border, alignItems: "center", justifyContent: "center" },
  radioOn: { borderColor: c.brand },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: c.brand },
  pin: { width: 44, height: 44, borderRadius: 14, backgroundColor: c.warningSoft, alignItems: "center", justifyContent: "center" },
}));
