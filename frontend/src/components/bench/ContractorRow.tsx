import { useState } from "react";
import { Pressable, View } from "react-native";
import { slug } from "@/src/format";
import { Actions } from "@/src/contractorActions";
import { makeStyles, useTheme } from "@/src/theme";
import { Btn, Chip, ChipWrap, Field, Icon, Sheet, T } from "@/src/ui";
import { ScorePill } from "@/src/components/issue/CandidateCard";

const STATUS_LABEL: Record<string, string> = { active: "Active", unreachable: "Unreachable", out_of_business: "Out of business" };

export function ContractorRow({ c, actions, position }: { c: any; actions: Actions; position?: number }) {
  const { colors } = useTheme();
  const s = useStyles();
  const [statusOpen, setStatusOpen] = useState(false);
  const grey = !c.rank;
  return (
    <View style={[s.row, grey && s.grey]} testID={`bench-row-${c.id}`}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, opacity: grey ? 0.65 : 1 }}>
        <View style={s.pos}><T weight="bold">{position ?? "–"}</T></View>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            {c.pinned && <Icon name="pin" size={14} color={colors.brand} />}
            <T weight="semi" numberOfLines={1} style={{ flexShrink: 1 }}>{c.business_name || c.name}</T>
            <ScorePill c={c} />
          </View>
          <T size={13} muted testID={`bench-reason-${c.id}`}>{c.reason}</T>
          <T size={12} muted numberOfLines={1}>{c.name} · {c.phone || c.email || "No contact info"}</T>
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {c.status === "active" && (
          <Btn small variant="secondary" icon={c.pinned ? "pin-off" : "pin"} label={c.pinned ? "Unpin" : "Pin"} onPress={() => actions.pin(c)} style={{ flex: 1 }} testID={`pin-button-${c.id}`} />
        )}
        <Pressable onPress={() => setStatusOpen(true)} style={s.status} testID={`status-select-${c.id}`}>
          <T size={14} weight="semi" style={{ flex: 1 }}>{STATUS_LABEL[c.status]}</T>
          <Icon name="chevron-down" size={16} />
        </Pressable>
      </View>
      <Sheet open={statusOpen} onClose={() => setStatusOpen(false)} title="Contractor status" sub={c.business_name || c.name} testID={`status-sheet-${c.id}`}>
        {Object.entries(STATUS_LABEL).map(([k, v]) => (
          <Btn key={k} label={v} variant={c.status === k ? "primary" : "secondary"} testID={`status-option-${k}-${c.id}`}
            onPress={() => { setStatusOpen(false); if (k !== c.status) actions.setStatus(c, k); }} />
        ))}
      </Sheet>
    </View>
  );
}

export function TradePicker({ trades, value, onChange, testID }: { trades: string[]; value: string[]; onChange: (v: string[]) => void; testID: string }) {
  return (
    <ChipWrap testID={testID}>
      {trades.map((t) => {
        const on = value.includes(t);
        return <Chip key={t} label={t} on={on} onPress={() => onChange(on ? value.filter((x) => x !== t) : [...value, t])} testID={`${testID}-${slug(t)}`} />;
      })}
    </ChipWrap>
  );
}

export function AreaPicker({ cities, value, onChange, testID }: { cities: string[]; value: string[]; onChange: (v: string[]) => void; testID: string }) {
  const [other, setOther] = useState(value.filter((v) => !cities.includes(v)).join(", "));
  const apply = (txt: string) => onChange([...value.filter((v) => cities.includes(v)), ...txt.split(",").map((x) => x.trim()).filter(Boolean)]);
  return (
    <View style={{ gap: 8 }}>
      <ChipWrap testID={testID}>
        {cities.map((c) => {
          const on = value.includes(c);
          return <Chip key={c} label={c} on={on} onPress={() => onChange(on ? value.filter((x) => x !== c) : [...value, c])} testID={`${testID}-${slug(c)}`} />;
        })}
      </ChipWrap>
      <Field placeholder="Other areas, comma separated" value={other} onChangeText={(t) => { setOther(t); apply(t); }} testID={`${testID}-other`} />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  row: { borderRadius: 16, borderWidth: 1.5, borderColor: c.border, backgroundColor: c.surfaceSecondary, padding: 12, gap: 10 },
  grey: { backgroundColor: c.surfaceTertiary },
  pos: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: c.border, backgroundColor: c.surface, alignItems: "center", justifyContent: "center" },
  status: { flex: 1, minHeight: 44, marginBottom: 4, borderRadius: 12, borderWidth: 1.5, borderColor: c.border, backgroundColor: c.surfaceSecondary, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 6 },
}));
