import { useEffect, useRef, useState } from "react";
import { Keyboard, Pressable, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import Animated, { FadeInDown } from "react-native-reanimated";
import { api, errorText } from "@/src/api";
import { needsOnboarding, useAuth } from "@/src/auth";
import { Screen } from "@/src/components/Screen";
import { AddressSearch, Geo } from "@/src/onboarding/AddressSearch";
import { MapPreview } from "@/src/onboarding/MapPreview";
import { useOnboarding } from "@/src/onboarding/shared";
import { Steps } from "@/src/onboarding/Steps";
import { toast } from "@/src/toast";
import { makeStyles, useTheme } from "@/src/theme";
import { Badge, Btn, Card, ConfirmSheet, Field, Icon, Notice, POSES, T } from "@/src/ui";

// /onboarding            first setup (gated)
// /onboarding?new=1      add another rental
// /onboarding?pid=X      edit a rental's address (&pin=1 when it has no map pin yet)
export default function AddressStep() {
  const { user, patchUser } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();
  const s = useStyles();
  const params = useLocalSearchParams<{ pid?: string; new?: string; pin?: string }>();
  const pid = params.pid || undefined;
  const isNew = params.new === "1" && !pid;
  const { state } = useOnboarding(pid, !isNew);
  const [q, setQ] = useState("");
  const [name, setName] = useState("");
  const [results, setResults] = useState<Geo[] | null>(null);
  const [picked, setPicked] = useState<Geo | null>(null);
  const [busy, setBusy] = useState<"" | "find" | "save" | "skip">("");
  const [error, setError] = useState("");
  const [skipOpen, setSkipOpen] = useState(false);
  const [lookupFailed, setLookupFailed] = useState(false); // no match -> allow saving as typed
  const prefilled = useRef(false);
  const revisit = !!user && !needsOnboarding(user);

  // Coming back to this step: start from the saved address. No pin yet -> live suggestions run on it.
  useEffect(() => {
    const p = isNew ? null : state?.property;
    if (!p || prefilled.current) return;
    prefilled.current = true;
    setQ(p.address);
    setName(p.name || "");
    if (p.geocode?.lat != null) setPicked({ ...p.geocode, formatted_address: p.address });
    else setLookupFailed(true);
  }, [state?.property, isNew]);

  const onType = (v: string) => {
    setQ(v);
    if (picked && v !== picked.formatted_address) { setPicked(null); setResults(null); }
  };

  const pick = (g: Geo) => { Keyboard.dismiss(); setPicked(g); setQ(g.formatted_address); setResults(null); setError(""); setLookupFailed(false); };

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

  const save = async (asTyped = false) => {
    if (!picked && !asTyped) return;
    setBusy("save");
    setError("");
    try {
      const prop = await api<any>("/onboarding/property", { method: "POST", body: {
        name: name.trim(), property_id: pid || null, new: isNew,
        ...(asTyped ? { address: q.trim(), geocode: { unverified: true } } : { address: picked!.formatted_address, geocode: picked }),
      } });
      if (pid) {
        if (params.pin === "1" && !asTyped) toast.success("Pinned on the map.");
        if (router.canGoBack()) router.back(); else router.replace(`/onboarding/rooms?pid=${prop.id}`);
      } else if (isNew) router.replace(`/onboarding/rooms?pid=${prop.id}`);
      else router.push(`/onboarding/rooms?pid=${prop.id}`);
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

  const title = isNew ? "Add a rental" : params.pin === "1" ? "Pin it on the map" : pid ? "Edit address" : "Where's your rental?";
  const sub = params.pin === "1" ? "Pick the matching address so contractors get an exact map pin."
    : "Start typing and pick your address. We pin it on the map so every contractor finds it first time.";
  const editing = !!pid && !isNew; // fixing one rental's address: no 3-step progress
  return (
    <Screen back={revisit} eyebrow={editing ? "Rental address" : `${isNew ? "New rental" : "Set up"} · Step 1 of 3`} title={title} sub={sub} testID="onboarding-address">
      {!editing && <Steps step={0} />}
      {!pid && (
        <Animated.View entering={FadeInDown.duration(500)} style={s.hero}>
          <Image source={POSES.cabin} style={s.heroImg} contentFit="contain" />
        </Animated.View>
      )}
      <Card style={{ gap: 14 }} testID="address-form">
        <AddressSearch value={q} onChangeText={onType} onPick={pick} onSubmit={find} settled={!!picked} />
        <Field label="Nickname (optional)" value={name} onChangeText={setName} placeholder="Lake cabin" maxLength={80} testID="property-name-input" />
        {!!error && <Notice testID="address-error">{error}</Notice>}
        {!picked && (
          <Btn label="Find address" icon="search" busy={busy === "find"} disabled={!!busy || q.trim().length < 5} variant="secondary" onPress={find} testID="address-find-button" />
        )}
        {lookupFailed && !picked && q.trim().length >= 5 && (
          <Animated.View entering={FadeInDown.springify().damping(16)} style={{ gap: 8 }} testID="address-as-typed">
            <Btn label="Save as typed" icon="arrow-right" busy={busy === "save"} disabled={!!busy} onPress={() => save(true)} testID="address-save-typed-button" />
            <T size={13} muted style={{ textAlign: "center" }}>It won&apos;t have a map pin yet. You can pin it later from Rentals.</T>
          </Animated.View>
        )}
      </Card>

      {results && results.length > 1 && (
        <View style={{ gap: 10 }} testID="address-results">
          <T weight="semi">Which one is it?</T>
          {results.map((r, i) => (
            <Animated.View key={r.place_id || r.formatted_address} entering={FadeInDown.delay(i * 70).springify().damping(16)}>
              <Pressable onPress={() => pick(r)} style={({ pressed }) => [s.result, pressed && { transform: [{ scale: 0.99 }] }]} testID={`address-result-${i}`}>
                <View style={s.radio} />
                <View style={{ flex: 1 }}>
                  <T weight="semi">{r.formatted_address}</T>
                  {r.partial_match && <T size={12} muted>Close match</T>}
                </View>
              </Pressable>
            </Animated.View>
          ))}
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
              <Btn variant="link" label="Change" onPress={() => { setPicked(null); }} testID="address-change-button" />
            </View>
            {picked.partial_match
              ? <Notice>Close match only. Double-check the street number and zip.</Notice>
              : picked.location_type === "ROOFTOP" && <Badge kind="ready" icon="circle-check" label="Exact spot found" />}
            <Btn big label={pid ? "Save address" : "Use this address"} icon="arrow-right" busy={busy === "save"} disabled={!!busy} onPress={() => save()} testID="address-confirm-button" />
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
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: c.border },
  pin: { width: 44, height: 44, borderRadius: 14, backgroundColor: c.warningSoft, alignItems: "center", justifyContent: "center" },
}));
