import { useState } from "react";
import { View } from "react-native";
import { api, errorText } from "@/src/api";
import { toast } from "@/src/toast";
import { useTheme } from "@/src/theme";
import { Btn, Card, Chip, ChipRow, Field, H, Mascot, Notice, T } from "@/src/ui";

function Row({ r, i, update, trades }: { r: any; i: number; update: (p: any) => void; trades: string[] }) {
  const { colors } = useTheme();
  const tid = `import-row-${i}`;
  const unsureTrade = !r.trades.length || r.unsure?.includes("trade");
  return (
    <View testID={tid} style={{ borderRadius: 16, borderWidth: 1.5, borderColor: colors.border, padding: 12, gap: 10, backgroundColor: r.include ? colors.surfaceSecondary : colors.surfaceTertiary, opacity: r.include ? 1 : 0.7 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Chip label={r.include ? "✓ Save this one" : "Skipped"} on={r.include} onPress={() => update({ include: !r.include })} testID={`${tid}-include`} />
        {r.slots?.length > 0 && <T size={12} muted style={{ flex: 1, textAlign: "right" }} numberOfLines={2}>Fits: {r.slots.join(", ")}</T>}
      </View>
      {r.duplicate_of && (
        <View style={{ backgroundColor: colors.warningSoft, borderRadius: 12, padding: 10, gap: 8 }} testID={`${tid}-duplicate`}>
          <T size={14} weight="semi" style={{ color: colors.warning }}>Looks like {r.duplicate_of.business_name} is already on your bench. Merge or keep both?</T>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Chip label="Merge" on={r.choice === "merge"} onPress={() => update({ choice: "merge" })} testID={`${tid}-merge`} />
            <Chip label="Keep both" on={r.choice === "new"} onPress={() => update({ choice: "new" })} testID={`${tid}-new`} />
          </View>
        </View>
      )}
      <Field value={r.name} placeholder="Name" onChangeText={(v) => update({ name: v })} testID={`${tid}-name`} />
      <Field value={r.business_name} placeholder="Business" onChangeText={(v) => update({ business_name: v })} testID={`${tid}-business`} />
      <Field value={r.phone} placeholder="Phone" onChangeText={(v) => update({ phone: v })} testID={`${tid}-phone`} />
      <Field value={r.email} placeholder="Email" autoCapitalize="none" onChangeText={(v) => update({ email: v })} testID={`${tid}-email`} />
      <Field value={r.service_area.join(", ")} placeholder="Service area" onChangeText={(v) => update({ service_area: v.split(",").map((x) => x.trim()).filter(Boolean) })} testID={`${tid}-area`} />
      <T size={13} weight="semi" style={unsureTrade ? { color: colors.warning } : undefined}>{unsureTrade ? "Pick a trade" : "Trade"}</T>
      <ChipRow testID={`${tid}-trade`}>
        {trades.map((t) => (
          <Chip key={t} label={t} on={r.trades[0] === t} warn={unsureTrade && r.trades[0] !== t}
            onPress={() => update({ trades: [t, ...r.trades.slice(1).filter((x: string) => x !== t)] })} testID={`${tid}-trade-${t.replace(/\W+/g, "-").toLowerCase()}`} />
        ))}
      </ChipRow>
      {!!r.notes && <T size={12} muted>Notes: {r.notes}</T>}
    </View>
  );
}

export function ImportPanel({ trades, onSaved, onManual }: { trades: string[]; onSaved: () => void; onManual: () => void }) {
  const [text, setText] = useState("");
  const [rows, setRows] = useState<any[] | null>(null);
  const [msg, setMsg] = useState("");
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  const extract = async () => {
    setBusy(true); setMsg(""); setFailed(false); setRows(null);
    try {
      const d = await api("/contractors/extract", { method: "POST", body: { text }, timeout: 60000 });
      if (!d.ok) { setFailed(true); setMsg(d.message); }
      else if (!d.rows.length) setMsg(d.message);
      else setRows(d.rows.map((r: any) => ({ ...r, include: true, choice: r.duplicate_of ? "merge" : "new" })));
    } catch {
      setFailed(true); setMsg("Couldn't read that right now.");
    } finally { setBusy(false); }
  };

  const save = async () => {
    const chosen = rows!.filter((r) => r.include);
    setBusy(true);
    try {
      const payload = chosen.map(({ name, business_name, phone, email, trades: t, service_area, notes, choice, duplicate_of }) =>
        ({ name, business_name, phone, email, trades: t, service_area, notes, merge_into: choice === "merge" ? duplicate_of?.id : null }));
      const d = await api("/contractors/import", { method: "POST", body: { rows: payload } });
      const placed = Object.entries(d.slots as Record<string, string[]>).filter(([, s]) => s.length);
      const where = placed.length ? ` Added to ${placed.map(([n, s]) => `${n} (${s.join(", ")})`).join("; ")}.` : " None matched a property slot yet.";
      toast.success(`Saved ${d.created} new, merged ${d.merged}.${where}`, {
        duration: 10000,
        action: { label: "Undo", onPress: async () => { await api(`/contractors/import/${d.batch_id}/undo`, { method: "POST" }).catch(() => {}); onSaved(); } },
      });
      setRows(null); setText(""); onSaved();
    } catch (e) { toast.error(errorText(e)); } finally { setBusy(false); }
  };

  const update = (i: number) => (p: any) => setRows(rows!.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const chosen = rows?.filter((r) => r.include) || [];
  const missing = chosen.filter((r) => !r.trades.length || !r.name.trim()).length;

  return (
    <View style={{ gap: 16 }} testID="import-panel">
      <Card style={{ gap: 10 }}>
        <H size={22}>Paste your contractors from anywhere.</H>
        <T size={14} muted>Notes, old texts, a spreadsheet, an email signature. Bullpup pulls out each person and shows you before saving.</T>
        <Field value={text} onChangeText={setText} multiline maxLength={20000} style={{ minHeight: 180 }}
          placeholder={"Mike's Plumbing (510) 555-0100, Oakland\nJenny - hot tub repair, Tahoe, jenny@example.com"} testID="import-text-input" />
        <Btn label={busy && !rows ? "Reading…" : "Find contractors"} icon="clipboard-paste" disabled={busy || !text.trim()} onPress={extract} testID="import-extract-button" />
        <Btn label="+ Add contractor" variant="secondary" onPress={onManual} testID="import-manual-add-button" />
      </Card>
      {busy && !rows && (
        <Card style={{ alignItems: "center" }} testID="import-loading"><Mascot pose="sniff" motion="sniff" size={120} /><T weight="semi">Reading your list…</T></Card>
      )}
      {!!msg && (
        <View style={{ gap: 8 }} testID={failed ? "import-ai-failed" : "import-nothing-found"}>
          <Notice>{msg}</Notice>
          {failed && <Btn label="+ Add contractor" variant="secondary" onPress={onManual} testID="import-fallback-add-button" />}
        </View>
      )}
      {rows && (
        <Card style={{ gap: 12 }} testID="import-preview">
          <H size={22}>Found {rows.length} contractor{rows.length === 1 ? "" : "s"}</H>
          <T size={14} muted>Check each one. Fields in blush need you to pick.</T>
          {rows.map((r, i) => <Row key={r.key ?? i} r={r} i={i} update={update(i)} trades={trades} />)}
          {missing > 0 && <Notice testID="import-missing-note">Pick a trade for {missing} contractor{missing === 1 ? "" : "s"} first.</Notice>}
          <Btn label={`Save ${chosen.length} to my bench`} busy={busy} disabled={!chosen.length || missing > 0} onPress={save} testID="import-save-button" />
        </Card>
      )}
    </View>
  );
}
