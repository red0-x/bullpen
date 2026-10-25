import { useState } from "react";
import { View } from "react-native";
import { api, errorText } from "@/src/api";
import { toast } from "@/src/toast";
import { makeStyles } from "@/src/theme";
import { Btn, Field, T } from "@/src/ui";

/** Bullpen texts the host updates; asks once for their mobile number. */
export function HostPhone({ onSaved }: { onSaved: () => void }) {
  const s = useStyles();
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await api("/me/phone", { method: "PUT", body: { phone } });
      toast.success("Saved. I'll text you updates.");
      onSaved();
    } catch (e) { toast.error(errorText(e)); } finally { setBusy(false); }
  };
  return (
    <View style={s.box} testID="host-phone">
      <T size={14} weight="semi">Where should I text you updates?</T>
      <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
        <View style={{ flex: 1 }}><Field placeholder="415 555 0123" keyboardType="phone-pad" value={phone} onChangeText={setPhone} testID="host-phone-input" /></View>
        <Btn small label="Save" busy={busy} disabled={phone.replace(/\D/g, "").length < 10} onPress={save} testID="host-phone-save" />
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  box: { backgroundColor: c.surfaceTertiary, borderRadius: 16, padding: 12, gap: 8 },
}));
