"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { api, errorText } from "@/lib/api";
import { PageTitle } from "@/components/PageTitle";
import { EmptyState } from "@/components/EmptyState";
import { Mascot } from "@/components/Mascot";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CaptureStep } from "@/components/broke/CaptureStep";
import { ReviewStep } from "@/components/broke/ReviewStep";

const EMPTY = { photo: null, note: "", arrival: "" };
const CANT_TELL = "We couldn't tell from the photo. What needs fixing?";
const CANT_TELL_NOTE = "We couldn't tell from your note. What needs fixing?";

export default function SomethingBrokePage() {
  const router = useRouter();
  const [props, setProps] = useState(null);
  const [trades, setTrades] = useState([]);
  const [input, setInput] = useState(EMPTY);
  const [step, setStep] = useState("capture");
  const [draft, setDraft] = useState(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [existing, setExisting] = useState(null);

  useEffect(() => {
    Promise.all([api.get("/properties"), api.get("/trades")])
      .then(([p, t]) => { setProps(p.data); setTrades(t.data); })
      .catch((e) => toast.error(errorText(e)));
  }, []);

  const diagnose = async () => {
    setStep("thinking");
    let d = { property_id: props.length === 1 ? props[0].id : null, amenity_id: null, trade: null, urgency: "this_week", diagnosis: input.note };
    let msg = "";
    try {
      const { data } = await api.post("/issues/diagnose", { photo_base64: input.photo?.base64 || null, note: input.note }, { timeout: 60000 });
      if (!data.ok) msg = data.message;
      else {
        const g = data.draft;
        d = { ...d, ...Object.fromEntries(Object.entries(g).filter(([, v]) => v !== null && v !== undefined)), property_id: g.property_id || d.property_id };
        if (!g.can_tell || !g.trade) msg = input.photo ? CANT_TELL : CANT_TELL_NOTE;
        if (!g.diagnosis) d.diagnosis = input.note;
        if (g.guest_arrival && !input.arrival) setInput((i) => ({ ...i, arrival: g.guest_arrival.slice(0, 16) }));
      }
    } catch {
      msg = "Couldn't read that right now. Tell us what broke below.";
    }
    setDraft(d);
    setNotice(msg);
    setStep("review");
  };

  const payload = () => ({
    property_id: draft.property_id, amenity_id: draft.amenity_id || null, trade_needed: draft.trade,
    urgency: draft.urgency, host_note: input.note, ai_diagnosis: draft.diagnosis || null,
    guest_arrival: input.arrival ? new Date(input.arrival).toISOString() : null, photo_base64: input.photo?.base64 || null,
  });

  const create = useCallback(async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/issues", payload(), { timeout: 30000 });
      router.push(`/issue/?id=${data.id}`);
    } catch (e) {
      toast.error(errorText(e));
      setBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, input]);

  const confirm = async () => {
    if (draft.amenity_id) {
      const { data } = await api.get("/issues/open-for", { params: { amenity_id: draft.amenity_id } }).catch(() => ({ data: {} }));
      if (data.issue) return setExisting(data.issue);
    }
    create();
  };

  const addToExisting = async () => {
    setBusy(true);
    try {
      await api.post(`/issues/${existing.id}/add`, { note: [draft.diagnosis, input.note].filter(Boolean).join(" · "), photo_base64: input.photo?.base64 || null });
      router.push(`/issue/?id=${existing.id}`);
    } catch (e) {
      toast.error(errorText(e));
      setBusy(false);
    }
  };

  const amenityLabel = props?.flatMap((p) => p.amenities).find((a) => a.id === draft?.amenity_id)?.label?.toLowerCase() || "";

  if (props?.length === 0) {
    return (
      <EmptyState pose="sniff" motion="sniff" testId="broke-no-properties" title="Add a property first" body="Bullpup needs to know your rentals before it can find the right people.">
        <Link href="/properties/" className="btn btn-primary">Go to properties</Link>
      </EmptyState>
    );
  }

  return (
    <>
      <PageTitle eyebrow="Quick fix" title="Something broke" sub="Snap a photo. Bullpup works out what's wrong and who can fix it. You check everything before anything is saved." />
      <link rel="preload" as="image" href="/mascot/pup-sniff.webp" />
      {step === "capture" && <CaptureStep value={input} onChange={setInput} onSubmit={diagnose} busy={!props} />}
      {step === "thinking" && (
        <div className="card py-14 flex flex-col items-center text-center" data-testid="diagnose-thinking">
          <Mascot pose="sniff" motion="sniff" className="w-44 h-40" />
          <p className="mt-4 font-head text-2xl">Sniffing it out…</p>
          <p className="text-cocoa text-sm mt-1">Usually takes 5 to 15 seconds.</p>
        </div>
      )}
      {step === "review" && draft && (
        <ReviewStep draft={draft} setDraft={setDraft} notice={notice} properties={props} trades={trades} photo={input.photo}
          onConfirm={confirm} onBack={() => { setStep("capture"); setDraft(null); }} busy={busy} />
      )}
      <ConfirmDialog
        open={!!existing}
        onOpenChange={(o) => !o && setExisting(null)}
        title={`There's already an open ${amenityLabel} issue. Add to it?`}
        body={existing ? `"${existing.ai_diagnosis || existing.host_note || "Open issue"}" is still open. Adding keeps everything in one place.` : ""}
        confirmLabel="Add to it"
        onConfirm={addToExisting}
        busy={busy}
        secondaryLabel="Start a new one"
        onSecondary={() => { setExisting(null); create(); }}
      />
    </>
  );
}
