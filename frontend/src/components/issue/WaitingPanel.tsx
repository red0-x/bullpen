import { useMemo, useState } from "react";
import { View } from "react-native";
import { fmtWhen } from "@/src/format";
import { makeStyles } from "@/src/theme";
import { Badge, Btn, Card, Chip, ChipRow, ConfirmSheet, H, T } from "@/src/ui";

const LABEL: Record<string, string> = { no_answer: "No answer", declined: "Declined", booked: "Booked" };
const TIMES = [8, 10, 12, 14, 16, 18];

function nextDays() {
  const out: Date[] = [];
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  for (let i = 0; i < 8; i++) out.push(new Date(d.getTime() + i * 864e5));
  return out;
}
const dayLabel = (d: Date, i: number) => (i === 0 ? "Today" : i === 1 ? "Tomorrow" : d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" }));
const hourLabel = (h: number) => `${h % 12 || 12} ${h < 12 ? "am" : "pm"}`;

export function WaitingPanel({ requests, onRespond }: { requests: any[]; onRespond: (r: any, response: string, when?: string) => void }) {
  const s = useStyles();
  const days = useMemo(nextDays, []);
  const [booking, setBooking] = useState<any>(null);
  const [day, setDay] = useState(1);
  const [hour, setHour] = useState(10);
  if (!requests.length) return null;
  const pending = requests.filter((r) => !r.response);
  const done = requests.filter((r) => r.response);

  const save = () => {
    const d = new Date(days[day]);
    d.setHours(hour);
    onRespond(booking, "booked", d.toISOString());
    setBooking(null);
  };

  return (
    <Card style={{ gap: 12 }} testID="waiting-panel">
      <H size={22}>Requests</H>
      {pending.map((r) => (
        <View key={r.id} style={s.pending} testID={`pending-request-${r.id}`}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <T weight="semi">Waiting on {r.contractor?.business_name}</T>
            <Badge kind="warn" label="Waiting" />
          </View>
          <T size={13} muted>Asked {fmtWhen(r.sent_at)}</T>
          <Btn label="Booked" icon="calendar-check" onPress={() => { setBooking(r); setDay(1); setHour(10); }} testID={`response-booked-${r.id}`} />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Btn label="No answer" icon="phone-off" variant="secondary" small style={{ flex: 1 }} onPress={() => onRespond(r, "no_answer")} testID={`response-no-answer-${r.id}`} />
            <Btn label="Declined" icon="thumbs-down" variant="secondary" small style={{ flex: 1 }} onPress={() => onRespond(r, "declined")} testID={`response-declined-${r.id}`} />
          </View>
        </View>
      ))}
      {done.map((r) => (
        <View key={r.id} style={s.done} testID={`done-request-${r.id}`}>
          <T weight="semi" numberOfLines={1} style={{ flex: 1 }}>{r.contractor?.business_name}</T>
          <Badge kind={r.response === "booked" && !r.no_show ? "ready" : r.no_show ? "warn" : "neutral"} label={r.no_show ? "No-show" : LABEL[r.response]} />
        </View>
      ))}
      <ConfirmSheet open={!!booking} onClose={() => setBooking(null)} testID="booking-sheet"
        title={`When is ${booking?.contractor?.business_name || "they"} coming?`}
        body="Pick the day and time they booked. The issue moves to Scheduled." confirmLabel="Save booking" onConfirm={save}>
        <T size={14} weight="semi">Day</T>
        <ChipRow testID="booked-day-row">
          {days.map((d, i) => <Chip key={i} label={dayLabel(d, i)} on={day === i} onPress={() => setDay(i)} testID={`booked-day-${i}`} />)}
        </ChipRow>
        <T size={14} weight="semi">Time</T>
        <ChipRow testID="booked-time-row">
          {TIMES.map((h) => <Chip key={h} label={hourLabel(h)} on={hour === h} onPress={() => setHour(h)} testID={`booked-time-${h}`} />)}
        </ChipRow>
      </ConfirmSheet>
    </Card>
  );
}

const useStyles = makeStyles((c) => ({
  pending: { borderRadius: 16, borderWidth: 1.5, borderColor: c.border, backgroundColor: c.surface, padding: 12, gap: 8 },
  done: { flexDirection: "row", alignItems: "center", gap: 8, borderTopWidth: 1.5, borderTopColor: c.border, paddingTop: 10 },
}));
