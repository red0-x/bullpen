import { useState } from "react";
import { View } from "react-native";
import { api, errorText } from "@/src/api";
import { toast } from "@/src/toast";
import { makeStyles } from "@/src/theme";
import { Btn, T } from "@/src/ui";

/** Plays a contractor reply without a real text (useful while Twilio is on a trial account). */
export function TestReplies({ issueId, who, onDone }: { issueId: string; who: string; onDone: () => void }) {
  const s = useStyles();
  const [busy, setBusy] = useState("");
  const go = async (reply: string) => {
    setBusy(reply);
    try {
      await api(`/issues/${issueId}/dispatch/test-reply`, { method: "POST", body: { reply, time: "7:30 PM" } });
      onDone();
    } catch (e) { toast.error(errorText(e)); } finally { setBusy(""); }
  };
  return (
    <View style={s.box} testID="test-replies">
      <T size={12} weight="bold" muted style={{ letterSpacing: 1.2 }}>TEST: PRETEND {who.toUpperCase()} REPLIED</T>
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        <Btn small variant="secondary" label="YES 7:30 PM" busy={busy === "yes"} onPress={() => go("yes")} testID="test-reply-yes" />
        <Btn small variant="secondary" label="NO" busy={busy === "no"} onPress={() => go("no")} testID="test-reply-no" />
        <Btn small variant="secondary" label="No reply" busy={busy === "silent"} onPress={() => go("silent")} testID="test-reply-silent" />
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  box: { borderRadius: 16, borderWidth: 1.5, borderStyle: "dashed", borderColor: c.border, padding: 12, gap: 8 },
}));
