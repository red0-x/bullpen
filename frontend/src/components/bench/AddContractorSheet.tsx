import { useEffect, useState } from "react";
import { View } from "react-native";
import { api, errorText } from "@/src/api";
import { toast } from "@/src/toast";
import { Btn, Field, Sheet, T } from "@/src/ui";
import { AreaPicker, TradePicker } from "./ContractorRow";

const BLANK = { name: "", business_name: "", phone: "", email: "", trades: [] as string[], service_area: [] as string[], notes: "" };

export function AddContractorSheet({ open, preset, trades, cities, onClose, onSaved }: { open: boolean; preset: any; trades: string[]; cities: string[]; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState(BLANK);
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<typeof BLANK>) => setF((x) => ({ ...x, ...p }));

  useEffect(() => { if (open) setF({ ...BLANK, ...(preset || {}) }); }, [open, preset]);

  const save = async () => {
    setBusy(true);
    try {
      const d = await api("/contractors", { method: "POST", body: f });
      onSaved();
      onClose();
      const id = d.contractor.id;
      toast.success(d.slots.length ? `Added to ${d.slots.join(", ")}.` : "Added. They don't match a property slot yet; check trade and area.", {
        action: { label: "Undo", onPress: async () => { await api(`/contractors/${id}`, { method: "DELETE" }).catch(() => {}); onSaved(); } },
      });
    } catch (e) { toast.error(errorText(e)); } finally { setBusy(false); }
  };

  return (
    <Sheet open={open} onClose={onClose} title="+ Add contractor" sub="They're matched to your properties by trade and service area." testID="add-contractor-dialog">
      {open && (
        <>
          <Field label="Contact name" value={f.name} onChangeText={(v) => set({ name: v })} testID="add-contractor-name-input" />
          <Field label="Business name" value={f.business_name} onChangeText={(v) => set({ business_name: v })} testID="add-contractor-business_name-input" />
          <Field label="Phone" value={f.phone} keyboardType="phone-pad" onChangeText={(v) => set({ phone: v })} testID="add-contractor-phone-input" />
          <Field label="Email" value={f.email} keyboardType="email-address" autoCapitalize="none" onChangeText={(v) => set({ email: v })} testID="add-contractor-email-input" />
          <View style={{ gap: 6 }}>
            <T size={14} weight="semi">Trade(s)</T>
            <TradePicker trades={trades} value={f.trades} onChange={(v) => set({ trades: v })} testID="add-contractor-trades" />
          </View>
          <View style={{ gap: 6 }}>
            <T size={14} weight="semi">Service area</T>
            <AreaPicker cities={cities} value={f.service_area} onChange={(v) => set({ service_area: v })} testID="add-contractor-areas" />
          </View>
          <Field label="Notes" value={f.notes} multiline onChangeText={(v) => set({ notes: v })} testID="add-contractor-notes-input" />
          <Btn label="Save contractor" busy={busy} disabled={!f.name.trim() || !f.trades.length} onPress={save} testID="add-contractor-save-button" />
        </>
      )}
    </Sheet>
  );
}
