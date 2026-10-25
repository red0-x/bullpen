import { useState } from "react";
import { Linking, Pressable, View } from "react-native";
import { Image } from "expo-image";
import { api, errorText } from "@/src/api";
import { toast } from "@/src/toast";
import { makeStyles, useTheme } from "@/src/theme";
import { Badge, Btn, Card, H, Icon, IconName, T } from "@/src/ui";

export const DIR_PHOTOS: Record<string, any> = {
  "/directory/p0.jpg": require("../../assets/directory/p0.jpg"),
  "/directory/p1.jpg": require("../../assets/directory/p1.jpg"),
  "/directory/p2.jpg": require("../../assets/directory/p2.jpg"),
  "/directory/p3.jpg": require("../../assets/directory/p3.jpg"),
  "/directory/p4.jpg": require("../../assets/directory/p4.jpg"),
  "/directory/p5.jpg": require("../../assets/directory/p5.jpg"),
  "/directory/p6.jpg": require("../../assets/directory/p6.jpg"),
  "/directory/p7.jpg": require("../../assets/directory/p7.jpg"),
  "/directory/p8.jpg": require("../../assets/directory/p8.jpg"),
  "/directory/p9.jpg": require("../../assets/directory/p9.jpg"),
  "/directory/p10.jpg": require("../../assets/directory/p10.jpg"),
  "/directory/p11.jpg": require("../../assets/directory/p11.jpg"),
  "/directory/p12.jpg": require("../../assets/directory/p12.jpg"),
  "/directory/p13.jpg": require("../../assets/directory/p13.jpg"),
};

const mins = (m: number) => (m < 60 ? `${m} min` : `${Math.round(m / 6) / 10} h`);

function Metric({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  const { colors } = useTheme();
  const s = useStyles();
  return (
    <View style={s.metric}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        <Icon name={icon} size={12} color={colors.muted} /><T size={12} muted numberOfLines={1}>{label}</T>
      </View>
      <T size={14} weight="semi">{value}</T>
    </View>
  );
}

export function DirectoryCard({ b, cities, onText }: { b: any; cities: string[]; onText: (b: any) => void }) {
  const { colors } = useTheme();
  const s = useStyles();
  const [open, setOpen] = useState(b.rank === 1);
  const [saved, setSaved] = useState(false);
  const tid = `dir-${b.id}`;

  const save = async () => {
    try {
      const d = await api("/contractors", { method: "POST", body: {
        name: b.business_name, business_name: b.business_name, phone: b.phone, email: b.email, trades: [b.trade],
        service_area: ["San Francisco", ...cities], notes: `Sample SF directory listing · ${b.rating}★ (${b.review_count} reviews)`,
      } });
      setSaved(true);
      toast.success(`${b.business_name} added to your bench.`, {
        action: { label: "Undo", onPress: async () => { await api(`/contractors/${d.contractor.id}`, { method: "DELETE" }).catch(() => {}); setSaved(false); } },
      });
    } catch (e) { toast.error(errorText(e)); }
  };

  return (
    <Card testID={tid} style={[{ padding: 0, overflow: "hidden" }, b.rank === 1 && { borderColor: colors.brand }]}>
      <Pressable onPress={() => setOpen(!open)} style={s.head} testID={`${tid}-toggle`}>
        <Image source={DIR_PHOTOS[b.photos[0]]} style={s.thumb} contentFit="cover" />
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
            {b.rank === 1 && <Badge kind="ready" label="Best match" />}
            <Badge label={String(b.score)} />
          </View>
          <T weight="semi" numberOfLines={1}>{b.business_name}</T>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Icon name="star" size={12} color={colors.star} />
            <T size={13} muted numberOfLines={1} style={{ flex: 1 }}>{b.reason}</T>
          </View>
        </View>
        <Icon name={open ? "chevron-up" : "chevron-down"} size={20} />
      </Pressable>
      {open && (
        <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 14 }} testID={`${tid}-details`}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {b.photos.map((p: string) => <Image key={p} source={DIR_PHOTOS[p]} style={s.photo} contentFit="cover" />)}
          </View>
          <View style={s.grid}>
            <Metric icon="clock" label="Usually replies in" value={mins(b.avg_response_minutes)} />
            <Metric icon="badge-check" label="Jobs completed" value={b.jobs_completed.toLocaleString()} />
            <Metric icon="star" label="In business" value={`${b.years_in_business} years`} />
            <Metric icon="shield-check" label="Licensed / insured" value={`${b.licensed ? "Yes" : "No"} / ${b.insured ? "Yes" : "No"}`} />
            <Metric icon="zap" label="Emergency calls" value={b.emergency_service ? "Yes, 24/7" : "Business hours"} />
            <Metric icon="map-pin" label="Distance" value={`${b.distance_miles} mi · ${b.neighborhood}`} />
          </View>
          <H size={18}>Reviews</H>
          {b.reviews.map((r: any, i: number) => (
            <View key={i} style={s.review}>
              <T size={14} weight="semi">{r.author} · {"★".repeat(r.rating)}<T size={14} style={{ color: colors.border }}>{"★".repeat(5 - r.rating)}</T> <T size={12} muted>{r.when}</T></T>
              <T size={14}>{r.text}</T>
            </View>
          ))}
          <Btn label={`Call ${b.phone}`} icon="phone" onPress={() => Linking.openURL(`tel:${b.phone.replace(/[^\d+]/g, "")}`)} testID={`${tid}-call`} />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Btn label="Text them" icon="message-square" variant="secondary" small style={{ flex: 1 }} onPress={() => onText(b)} testID={`${tid}-text`} />
            <Btn label="Map" icon="map-pin" variant="secondary" small style={{ flex: 1 }} onPress={() => Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(b.address)}`)} testID={`${tid}-map`} />
          </View>
          <Btn label={saved ? "On your bench" : "Save to bench"} icon="user-plus" variant="secondary" disabled={saved} onPress={save} testID={`${tid}-save`} />
          <T size={12} muted>{b.address} · Sample listing (made-up business)</T>
        </View>
      )}
    </Card>
  );
}

const useStyles = makeStyles((c) => ({
  head: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  thumb: { width: 56, height: 56, borderRadius: 12 },
  photo: { flex: 1, height: 120, borderRadius: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  metric: { width: "48%", flexGrow: 1, backgroundColor: c.surface, borderWidth: 1.5, borderColor: c.border, borderRadius: 12, padding: 10, gap: 2 },
  review: { borderWidth: 1.5, borderColor: c.border, borderRadius: 12, padding: 10, gap: 2 },
}));
