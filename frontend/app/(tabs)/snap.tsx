import { useCallback, useEffect, useState } from "react";
import { Linking, ScrollView, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, errorText } from "@/src/api";
import { URGENCY } from "@/src/format";
import { usesNativeTabs } from "@/src/navigation";
import { toast } from "@/src/toast";
import { storage } from "@/src/utils/storage";
import { makeStyles, useTheme } from "@/src/theme";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { FixGuide } from "@/src/components/FixGuide";
import { DirectoryCard } from "@/src/components/DirectoryCard";
import { smsUrl } from "@/src/components/issue/RequestSheet";
import { Badge, Btn, Card, Chip, ChipRow, ConfirmSheet, EmptyState, Field, H, Icon, Mascot, Notice, Sheet, Skeleton, T } from "@/src/ui";

const LAST = "last_property";
type Photo = { uri: string; base64: string };

function autoFill(g: any, props: any[], remembered: string | null) {
  const property_id = g.property_id || (props.some((p) => p.id === remembered) ? remembered : props[0]?.id);
  const prop = props.find((p) => p.id === property_id);
  const amenity = prop?.amenities.find((a: any) => a.id === g.amenity_id) || prop?.amenities.find((a: any) => a.trade === g.trade);
  return { ...g, property_id, amenity_id: amenity?.id || null, urgency: g.urgency || "this_week" };
}

async function toJpeg(uri: string): Promise<Photo> {
  const r = await manipulateAsync(uri, [{ resize: { width: 1280 } }], { compress: 0.82, format: SaveFormat.JPEG, base64: true });
  return { uri: r.uri, base64: r.base64! };
}

function Capture({ onPhoto, onText }: { onPhoto: (p: Photo) => void; onText: (t: string) => void }) {
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState("");
  const [perm, setPerm] = useState<"explain" | "blocked" | null>(null);

  const launchCamera = async () => {
    const r = await ImagePicker.launchCameraAsync({ quality: 0.9 });
    if (!r.canceled && r.assets[0]) onPhoto(await toJpeg(r.assets[0].uri));
  };
  const takePicture = async () => {
    try {
      const cur = await ImagePicker.getCameraPermissionsAsync();
      if (cur.granted) return launchCamera();
      setPerm(cur.canAskAgain ? "explain" : "blocked");
    } catch {
      toast.error("The camera isn't available here. Upload a photo instead.");
    }
  };
  const askCamera = async () => {
    const res = await ImagePicker.requestCameraPermissionsAsync();
    if (res.granted) { setPerm(null); launchCamera(); } else setPerm(res.canAskAgain ? "explain" : "blocked");
  };
  const upload = async () => {
    try {
      const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.9 });
      if (!r.canceled && r.assets[0]) onPhoto(await toJpeg(r.assets[0].uri));
    } catch {
      toast.error("That photo didn't load. Try another.");
    }
  };

  return (
    <View style={{ alignItems: "center", gap: 20, paddingVertical: 8 }} testID="snap-capture">
      <Mascot pose="camera" size={170} />
      <View style={{ gap: 8 }}>
        <H size={36} style={{ textAlign: "center" }}>Something broke?</H>
        <T muted style={{ textAlign: "center" }}>Take a picture. Bullpen works out what&apos;s wrong, how to fix it and who to call.</T>
      </View>
      <Btn big label="Take a picture" icon="camera" onPress={takePicture} style={{ alignSelf: "stretch" }} testID="snap-take-picture-button" />
      <View style={{ flexDirection: "row", gap: 10, alignSelf: "stretch" }}>
        <Btn label="Upload" icon="image-up" variant="secondary" style={{ flex: 1 }} onPress={upload} testID="snap-upload-button" />
        <Btn label="Describe it" icon="pen-line" variant="secondary" style={{ flex: 1 }} onPress={() => setTyping(!typing)} testID="snap-type-button" />
      </View>
      {typing && (
        <Card style={{ gap: 10, alignSelf: "stretch" }}>
          <Field value={text} onChangeText={setText} multiline placeholder="Hot tub at Tahoe won't heat. Guests arrive Friday 4pm." testID="snap-text-input" />
          <Btn label="Find help" disabled={!text.trim()} onPress={() => onText(text)} testID="snap-text-go-button" />
        </Card>
      )}
      <Sheet open={!!perm} onClose={() => setPerm(null)} title={perm === "blocked" ? "Camera is turned off" : "Snap what broke"} testID="camera-permission-sheet">
        <T muted>{perm === "blocked"
          ? "Bullpen needs the camera to photograph what broke. Turn it on in Settings, or upload a photo instead."
          : "Bullpen uses your camera so it can see the problem and find the right person to fix it."}</T>
        {perm === "blocked"
          ? <Btn label="Open Settings" icon="settings" onPress={() => { setPerm(null); Linking.openSettings(); }} testID="camera-open-settings-button" />
          : <Btn label="Allow camera" icon="camera" onPress={askCamera} testID="camera-allow-button" />}
        <Btn label="Upload a photo instead" variant="secondary" onPress={() => { setPerm(null); upload(); }} testID="camera-upload-instead-button" />
      </Sheet>
    </View>
  );
}

function Summary({ d, props, trades, setD, remembered }: { d: any; props: any[]; trades: string[]; setD: (d: any) => void; remembered: string | null }) {
  const [edit, setEdit] = useState(false);
  const prop = props.find((p) => p.id === d.property_id);
  const amenity = prop?.amenities.find((a: any) => a.id === d.amenity_id);
  return (
    <View style={{ gap: 8 }} testID="snap-summary">
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        <Badge kind="ready" label={d.trade} testID="snap-trade" />
        <Badge label={`${amenity ? `${amenity.label} · ` : ""}${prop?.name || ""}`} testID="snap-property" />
        <Badge kind="warn" label={URGENCY[d.urgency]} testID="snap-urgency" />
      </View>
      <Btn variant="link" label={edit ? "Done" : "Wrong? Change"} onPress={() => setEdit(!edit)} testID="snap-change-button" />
      {edit && (
        <View style={{ gap: 6 }}>
          <T size={13} weight="semi">Trade</T>
          <ChipRow testID="snap-trade-select">
            {trades.map((t) => <Chip key={t} label={t} on={d.trade === t} onPress={() => setD({ ...d, trade: t, amenity_id: prop?.amenities.find((a: any) => a.trade === t)?.id || null })} testID={`snap-trade-option-${t.replace(/\W+/g, "-").toLowerCase()}`} />)}
          </ChipRow>
          <T size={13} weight="semi">Property</T>
          <ChipRow testID="snap-property-select">
            {props.map((p) => <Chip key={p.id} label={p.name} on={d.property_id === p.id} onPress={() => setD(autoFill({ ...d, property_id: p.id, amenity_id: null }, props, remembered))} testID={`snap-property-option-${p.id}`} />)}
          </ChipRow>
          <T size={13} weight="semi">Urgency</T>
          <ChipRow testID="snap-urgency-select">
            {Object.entries(URGENCY).map(([k, v]) => <Chip key={k} label={v} on={d.urgency === k} onPress={() => setD({ ...d, urgency: k })} testID={`snap-urgency-option-${k}`} />)}
          </ChipRow>
        </View>
      )}
    </View>
  );
}

export default function Snap() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const s = useStyles();
  const [props, setProps] = useState<any[] | null>(null);
  const [trades, setTrades] = useState<string[]>([]);
  const [remembered, setRemembered] = useState<string | null>(null);
  const [step, setStep] = useState<"capture" | "thinking" | "retry" | "results">("capture");
  const [input, setInput] = useState<{ photo: Photo | null; note: string }>({ photo: null, note: "" });
  const [d, setD] = useState<any>(null);
  const [notice, setNotice] = useState("");
  const [list, setList] = useState<any[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [existing, setExisting] = useState<any>(null);

  useFocusEffect(useCallback(() => {
    Promise.all([api("/properties"), api("/trades")]).then(([p, t]) => { setProps(p); setTrades(t); }).catch((e) => toast.error(errorText(e)));
    storage.getItem(LAST, null as string | null).then(setRemembered);
  }, []));

  useEffect(() => {
    if (!d?.trade) return;
    setList(null);
    api("/directory", { params: { trade: d.trade } }).then((r) => setList(r.results)).catch(() => setList([]));
  }, [d?.trade]);

  const run = async (photo: Photo | null, note: string) => {
    setInput({ photo, note });
    setStep("thinking");
    setNotice("");
    try {
      const r = await api("/issues/diagnose", { method: "POST", body: { photo_base64: photo?.base64 || null, note }, timeout: 60000 });
      if (!r.ok || !r.draft.trade) {
        setNotice(r.ok ? "We couldn't tell from the photo. Try another angle, closer to the problem, or describe it." : r.message);
        return setStep("retry");
      }
      if (r.draft.is_rental_issue === false) setNotice("This doesn't look like part of your rental, but here's how to handle it and who could help.");
      else if (!r.draft.can_tell) setNotice("We weren't fully sure from the photo, so this is our best guess. A closer photo helps.");
      setD(autoFill({ ...r.draft, diagnosis: r.draft.diagnosis || note }, props || [], remembered));
      setStep("results");
    } catch {
      setNotice("Couldn't read that right now. Try again, or describe it instead.");
      setStep("retry");
    }
  };

  const reset = () => { setStep("capture"); setD(null); setInput({ photo: null, note: "" }); setNotice(""); };

  const track = async (force: boolean) => {
    if (!force && d.amenity_id) {
      const r = await api("/issues/open-for", { params: { amenity_id: d.amenity_id } }).catch(() => ({}));
      if (r.issue) return setExisting(r.issue);
    }
    setBusy(true);
    try {
      const r = await api("/issues", { method: "POST", timeout: 30000, body: {
        property_id: d.property_id, amenity_id: d.amenity_id, trade_needed: d.trade, urgency: d.urgency, host_note: input.note,
        ai_diagnosis: d.diagnosis, fix_steps: d.fix_steps || [], safety_note: d.safety_note || null, diy: d.diy || null,
        guest_arrival: d.guest_arrival ? new Date(d.guest_arrival).toISOString() : null, photo_base64: input.photo?.base64 || null,
      } });
      await storage.setItem(LAST, d.property_id);
      reset();
      router.push(`/issue/${r.id}`);
    } catch (e) { toast.error(errorText(e)); } finally { setBusy(false); }
  };

  const addToExisting = async () => {
    setBusy(true);
    try {
      await api(`/issues/${existing.id}/add`, { method: "POST", body: { note: d.diagnosis || input.note, photo_base64: input.photo?.base64 || null } });
      const id = existing.id;
      setExisting(null);
      reset();
      router.push(`/issue/${id}`);
    } catch (e) { toast.error(errorText(e)); } finally { setBusy(false); }
  };

  const textBiz = (b: any) => {
    const prop = props?.find((p) => p.id === d.property_id);
    const msg = `Hi ${b.business_name}, I host a rental (${prop?.name}). ${d.diagnosis} Could you help? Urgency: ${URGENCY[d.urgency]}.`;
    Linking.openURL(smsUrl(b.phone, msg)).catch(() => toast.error("Couldn't open Messages on this device."));
  };

  const bottom = (usesNativeTabs ? insets.bottom : 0) + 24;
  let body;
  if (props?.length === 0) {
    body = (
      <EmptyState pose="sniff" motion="sniff" testID="broke-no-properties" title="Add a property first" body="Bullpen needs your rentals to file the fix.">
        <Btn label="Go to properties" onPress={() => router.push("/(tabs)/properties")} />
      </EmptyState>
    );
  } else if (step === "capture" && !props) body = <Skeleton height={300} testID="snap-loading" />;
  else if (step === "capture") body = <Capture onPhoto={(p) => run(p, "")} onText={(t) => run(null, t)} />;
  else if (step === "thinking") {
    body = (
      <Card style={{ alignItems: "center", paddingVertical: 40, gap: 8 }} testID="diagnose-thinking">
        {input.photo && <Image source={{ uri: input.photo.uri }} style={{ width: 200, height: 150, borderRadius: 16 }} contentFit="cover" />}
        <Mascot pose="sniff" motion="sniff" size={140} />
        <H size={24}>Sniffing it out…</H>
        <T size={14} muted style={{ textAlign: "center" }}>Finding what&apos;s wrong and the best people nearby.</T>
      </Card>
    );
  } else if (step === "retry") {
    body = (
      <View style={{ gap: 16 }} testID="snap-retry">
        <Notice testID="snap-notice">{notice}</Notice>
        <Capture onPhoto={(p) => run(p, "")} onText={(t) => run(null, t)} />
      </View>
    );
  } else {
    body = (
      <View style={{ gap: 16 }} testID="snap-results">
        <Card style={{ gap: 14 }}>
          {input.photo && <Image source={{ uri: input.photo.uri }} style={s.photo} contentFit="contain" testID="snap-photo" />}
          {!!notice && <Notice testID="snap-notice">{notice}</Notice>}
          <View style={{ gap: 4 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Icon name="sparkles" size={14} color={colors.muted} /><T size={14} weight="semi" muted>What&apos;s wrong</T>
            </View>
            <T size={17} testID="snap-diagnosis">{d.diagnosis || `Looks like a ${d.trade.toLowerCase()} job. Add a closer photo for a sharper read.`}</T>
          </View>
          <Summary d={d} props={props!} trades={trades} setD={setD} remembered={remembered} />
          <FixGuide steps={d.fix_steps || []} safety={d.safety_note} diy={d.diy} testID="snap-fix-guide" />
          <Btn label={busy ? "Saving…" : "Track this & see my bench"} busy={busy} onPress={() => track(false)} testID="snap-track-button" />
          <Btn label="New photo" icon="rotate-ccw" variant="secondary" onPress={reset} testID="snap-retake-button" />
        </Card>
        <View style={{ gap: 4 }} testID="snap-directory">
          <H size={24}>Best {d.trade.toLowerCase()} pros near San Francisco</H>
          <T size={14} muted>Ranked by reviews, distance and reply speed.</T>
          <Badge kind="warn" label="Sample listings" />
        </View>
        {list === null && <Skeleton height={120} />}
        {list?.length === 0 && <Card><T muted>No listings for this trade yet.</T></Card>}
        {list?.map((b) => <DirectoryCard key={b.id} b={b} cities={props!.map((p) => p.city)} onText={textBiz} />)}
        <ConfirmSheet open={!!existing} onClose={() => setExisting(null)} testID="existing-issue-sheet"
          title={`There's already an open ${d.trade.toLowerCase()} issue there. Add to it?`}
          body={existing ? `"${existing.ai_diagnosis || existing.host_note || "Open issue"}" is still open.` : ""}
          confirmLabel="Add to it" onConfirm={addToExisting} busy={busy}
          secondaryLabel="Start a new one" onSecondary={() => { setExisting(null); track(true); }} />
      </View>
    );
  }

  return (
    <View style={s.root}>
      <ScreenHeader eyebrow="Snap & go" title="Something broke" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: bottom, gap: 16 }} keyboardShouldPersistTaps="handled" testID="snap-screen">
        {body}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  photo: { width: "100%", height: 240, borderRadius: 16, backgroundColor: c.surface },
}));
