import { useEffect, useState } from "react";
import { Linking, Platform, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { api, errorText } from "@/src/api";
import { fmtWhen } from "@/src/format";
import { toast } from "@/src/toast";
import { useTheme } from "@/src/theme";
import { Badge, Btn, Field, Mascot, Sheet, T } from "@/src/ui";

export const smsUrl = (phone: string, body: string) =>
  `sms:${phone.replace(/[^\d+]/g, "")}${Platform.OS === "ios" ? "&" : "?"}body=${encodeURIComponent(body)}`;

export function RequestSheet({ issue, contractor, onClose, onLogged }: { issue: any; contractor: any; onClose: () => void; onLogged: (req: any, c: any) => void }) {
  const { colors } = useTheme();
  const [msg, setMsg] = useState("");
  const [ai, setAi] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!contractor) return;
    setLoading(true);
    api(`/issues/${issue.id}/draft`, { method: "POST", timeout: 50000, body: { contractor_id: contractor.id, guest_arrival_text: issue.guest_arrival ? fmtWhen(issue.guest_arrival) : null } })
      .then((d) => { setMsg(d.message); setAi(d.ai); })
      .catch(() => {
        setAi(false);
        setMsg(`Hi ${contractor.name.split(" ")[0]}, we have a problem at our rental: ${issue.ai_diagnosis || issue.host_note || issue.trade_needed}. Could you take a look? Thanks!`);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractor?.id, issue.id]);

  const log = async (channel: "copy" | "messages") => {
    setBusy(true);
    try {
      if (channel === "copy") await Clipboard.setStringAsync(msg).catch(() => {});
      const d = await api("/requests", { method: "POST", body: { issue_id: issue.id, contractor_id: contractor.id, message: msg, channel } });
      const c = contractor;
      onLogged(d, c);
      if (channel === "messages") Linking.openURL(smsUrl(c.phone, msg)).catch(() => toast.error("Couldn't open Messages on this device."));
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={!!contractor} onClose={onClose} title={`Message ${contractor?.business_name || ""}`} sub={contractor ? `${contractor.name} · ${contractor.phone}` : ""} testID="request-dialog">
      {loading ? (
        <View style={{ alignItems: "center", paddingVertical: 24 }} testID="request-draft-loading">
          <Mascot pose="phone" size={120} />
          <T weight="semi" style={{ marginTop: 8 }}>Drafting a friendly message…</T>
        </View>
      ) : (
        <>
          <Badge kind={ai ? "ready" : "warn"} icon={ai ? "sparkles" : undefined} testID="request-draft-source"
            label={ai ? "Drafted by Bullpen. Edit it before you send." : "Couldn't draft right now, here's a simple template."} />
          <Field value={msg} onChangeText={setMsg} multiline maxLength={1500} style={{ minHeight: 170 }} testID="request-message-input" />
          <T size={12} style={{ color: colors.muted }}>Bullpen never sends anything. You send it from your own phone.</T>
          <Btn label="Open in Messages" icon="message-square" busy={busy} disabled={!msg.trim()} onPress={() => log("messages")} testID="request-open-messages-button" />
          <Btn label="Copy text" icon="copy" variant="secondary" disabled={busy || !msg.trim()} onPress={() => log("copy")} testID="request-copy-button" />
        </>
      )}
    </Sheet>
  );
}
